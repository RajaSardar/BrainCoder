import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const FIXTURE = new URL("./encrypted.pdf", import.meta.url);

const PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function utf8(s) {
  return new TextEncoder().encode(s);
}

function padPw(s) {
  const b = utf8(s).slice(0, 32);
  const out = new Uint8Array(32);
  out.set(b);
  for (let i = b.length; i < 32; i++) out[i] = PAD[i - b.length];
  return out;
}

function md5(...chunks) {
  const h = createHash("md5");
  for (const c of chunks) h.update(c);
  return Uint8Array.from(h.digest());
}

function rc4(key, data) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    const t = S[i]; S[i] = S[j]; S[j] = t;
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    const t = S[i]; S[i] = S[j]; S[j] = t;
    out[k] = data[k] ^ S[(S[i] + S[j]) & 0xff];
  }
  return out;
}

function toHex(b) {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const ID0 = Uint8Array.from({ length: 16 }, (_, i) => 0x10 + i);
const P = -44; // 0xFFFFFFD4
const P_LE = Uint8Array.from([P & 0xff, (P >> 8) & 0xff, (P >> 16) & 0xff, (P >>> 24) & 0xff]);

// O entry (Algorithm 3.3): RC4(first 5 bytes of MD5(padded owner), padded user)
const O = rc4(md5(padPw("owner")).subarray(0, 5), padPw("pw"));
// file encryption key for the real password (Algorithm 3.2), 40-bit
const fileKey = md5(padPw("pw"), O, P_LE, ID0).subarray(0, 5);
// U entry (Algorithm 3.4): RC4(fileKey, 32-byte padding)
const U = rc4(fileKey, PAD);

const oHex = toHex(O);
const uHex = toHex(U);
const idHex = toHex(ID0);

const objects = [
  `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
  `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`,
  `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj`,
  `4 0 obj\n<< /Filter /Standard /V 1 /R 2 /O <${oHex}> /U <${uHex}> /P ${P} /Length 40 >>\nendobj`,
];

let out = "%PDF-1.4\n";
const offsets = [];
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(out));
  out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xrefStart = Buffer.byteLength(out);
out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
out += `trailer\n<<\n/Root 1 0 R\n/Size ${objects.length + 1}\n/Encrypt 4 0 R\n/ID [<${idHex}> <${idHex}>]\n>>\nstartxref\n${xrefStart}\n%%EOF`;

writeFileSync(FIXTURE, out);
console.log(`wrote ${FIXTURE.pathname} (${Buffer.byteLength(out)} bytes)`);