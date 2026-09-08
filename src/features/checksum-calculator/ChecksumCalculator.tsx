"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c));

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);

export function md5Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const ml = bytes.length * 8;
  const withOne = new Uint8Array(bytes.length + 1);
  withOne.set(bytes);
  withOne[bytes.length] = 0x80;
  const paddedLen = (Math.floor((withOne.length + 8) / 64) + 1) * 64;
  const data = new Uint8Array(paddedLen);
  data.set(withOne);
  const dv = new DataView(data.buffer);
  dv.setUint32(paddedLen - 8, ml >>> 0, true);
  dv.setUint32(paddedLen - 4, Math.floor(ml / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < data.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(offset + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + MD5_K[i] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, MD5_S[i])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  return [a0, b0, c0, d0]
    .map((w) =>
      [w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, (w >>> 24) & 0xff]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    )
    .join("");
}

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    t[n] = c;
  }
  return t;
})();

export function crc32Hex(bytes: Uint8Array<ArrayBuffer>): string {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC32_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)) >>> 0;
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

export function crc16CcittHex(bytes: Uint8Array<ArrayBuffer>): string {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return (crc & 0xffff).toString(16).padStart(4, "0").toUpperCase();
}

function bytesToHex(bytes: Uint8Array<ArrayBufferLike>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const MASK64 = 0xffffffffffffffffn;

const ROTATIONS = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

function rotl64(x: bigint, n: number): bigint {
  return (n === 0 ? x : (x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;
}

function keccakF(state: bigint[][]): void {
  for (let round = 0; round < 24; round++) {
    const c: bigint[] = [];
    for (let x = 0; x < 5; x++) c[x] = state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4];
    const d: bigint[] = [];
    for (let x = 0; x < 5; x++) d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x][y] = (state[x][y] ^ d[x]) & MASK64;

    const b: bigint[][] = Array.from({ length: 5 }, () => Array<bigint>(5).fill(0n));
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y][(2 * x + 3 * y) % 5] = rotl64(state[x][y], ROTATIONS[x][y]) & MASK64;
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) state[x][y] = (b[x][y] ^ (~b[(x + 1) % 5][y] & b[(x + 2) % 5][y])) & MASK64;
    }
    state[0][0] = (state[0][0] ^ ROUND_CONSTANTS[round]) & MASK64;
  }
}

function freshState(): bigint[][] {
  return Array.from({ length: 5 }, () => Array<bigint>(5).fill(0n));
}

function keccak(input: Uint8Array, rateBytes: number, outputBytes: number, suffix: number): Uint8Array {
  const state = freshState();
  const m = input.length;
  const padded = new Uint8Array(m + (rateBytes - (m % rateBytes)));
  padded.set(input);
  padded[m] = suffix;
  padded[padded.length - 1] |= 0x80;

  for (let off = 0; off < padded.length; off += rateBytes) {
    for (let i = 0; i < rateBytes; i++) {
      const lane = Math.floor(i / 8);
      const x = lane % 5;
      const y = Math.floor(lane / 5);
      state[x][y] = (state[x][y] ^ (BigInt(padded[off + i]) << BigInt(8 * (i % 8)))) & MASK64;
    }
    keccakF(state);
  }

  const out = new Uint8Array(outputBytes);
  let written = 0;
  while (written < outputBytes) {
    const block = new Uint8Array(rateBytes);
    for (let i = 0; i < rateBytes; i++) {
      const lane = Math.floor(i / 8);
      const x = lane % 5;
      const y = Math.floor(lane / 5);
      block[i] = Number((state[x][y] >> BigInt(8 * (i % 8))) & 0xffn);
    }
    const take = Math.min(rateBytes, outputBytes - written);
    out.set(block.subarray(0, take), written);
    written += take;
    if (written < outputBytes) keccakF(state);
  }
  return out;
}

function sha3Hex(input: string, bits: 224 | 256 | 384 | 512): string {
  const digest = keccak(new TextEncoder().encode(input), RATES[bits], bits / 8, 0x06);
  return bytesToHex(digest);
}

function shakeHex(input: string, bits: 128 | 256): string {
  const rateBytes = bits === 128 ? 168 : 136;
  const digest = keccak(new TextEncoder().encode(input), rateBytes, 32, 0x1f);
  return bytesToHex(digest);
}

const RATES = { 224: 144, 256: 136, 384: 104, 512: 72 };

function keccakHex(input: string, bits: 224 | 256 | 384 | 512): string {
  const digest = keccak(new TextEncoder().encode(input), RATES[bits], bits / 8, 0x01);
  return bytesToHex(digest);
}

const SHA2_K = new Uint32Array([
  0x1428a2f98, 0x171374491, 0x1b5c0fbcf, 0x1e9b5dba5, 0x23956c25b, 0x259f111f1, 0x2923f82a4,
  0x2ab1c5ed5, 0x2d807aa98, 0x312835b01, 0x3243185be, 0x3550c7dc3, 0x372be5d74, 0x380deb1fe,
  0x39bdc06a7, 0x3c19bf174, 0x3e49b69c1, 0x3efbe4786, 0x40fc19dc6, 0x4240ca1cc, 0x42de92c6f,
  0x44a7484aa, 0x45cb0a9dc, 0x476f988da, 0x4983e5152, 0x4a831c66d, 0x4b00327c8, 0x4bf597fc7,
  0x4c6e00bf3, 0x4d5a79147, 0x506ca6351, 0x514292967, 0x527b70a85, 0x52e1b2138, 0x54d2c6dfc,
  0x553380d13, 0x5650a7354, 0x5766a0abb, 0x581c2c92e, 0x592722c85, 0x5a2bfe8a1, 0x5a81a664b,
  0x5c24b8b70, 0x5c76c51a3, 0x5d192e819, 0x5d6990624, 0x5f40e3585, 0x6106aa070, 0x619a4c116,
  0x61e376c08, 0x62748774c, 0x634b0bcb5, 0x6391c0cb3, 0x64ed8aa4a, 0x65b9cca4f, 0x6682e6ff3,
  0x6748f82ee, 0x678a5636f, 0x684c87814, 0x68cc70208, 0x690befffa, 0x6a4506ceb, 0x6bef9a3f7,
  0x6c67178f2,
]);

const rotr32 = (x: number, n: number) => (x >>> n) | (x << (32 - n));

function sha2Hex(input: string, bits: 224 | 256): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const data = new Uint8Array(paddedLen);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const dv = new DataView(data.buffer);
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(paddedLen - 4, bitLen >>> 0);

  let [h0, h1, h2, h3, h4, h5, h6, h7] =
    bits === 224
      ? [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4]
      : [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  for (let off = 0; off < data.length; off += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA2_K[i] + w[i]) | 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const digits = [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((w) => (w >>> 0).toString(16).padStart(8, "0"))
    .join("");
  return bits === 224 ? digits.slice(0, 56) : digits;
}

async function shaHex(input: string, algo: AlgorithmIdentifier): Promise<string> {
  const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacHex(input: string, secret: string, algo: AlgorithmIdentifier): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: algo }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(sig));
}

interface Row {
  label: string;
  value: string;
}

export default function ChecksumCalculator() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog.");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const compute = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const bytes = new TextEncoder().encode(input);
      const list: Row[] = [
        { label: "MD5", value: md5Hex(input) },
        { label: "CRC-16 (CCITT)", value: crc16CcittHex(bytes) },
        { label: "CRC-32", value: crc32Hex(bytes) },
        { label: "SHA-1", value: await shaHex(input, "SHA-1") },
        { label: "SHA-224", value: sha2Hex(input, 224) },
        { label: "SHA-256", value: await shaHex(input, "SHA-256") },
        { label: "SHA-384", value: await shaHex(input, "SHA-384") },
        { label: "SHA-512", value: await shaHex(input, "SHA-512") },
        { label: "SHA3-224", value: sha3Hex(input, 224) },
        { label: "SHA3-256", value: sha3Hex(input, 256) },
        { label: "SHA3-384", value: sha3Hex(input, 384) },
        { label: "SHA3-512", value: sha3Hex(input, 512) },
        { label: "Keccak-224", value: keccakHex(input, 224) },
        { label: "Keccak-256", value: keccakHex(input, 256) },
        { label: "Keccak-384", value: keccakHex(input, 384) },
        { label: "Keccak-512", value: keccakHex(input, 512) },
        { label: "Shake-128 (256-bit)", value: shakeHex(input, 128) },
        { label: "Shake-256 (256-bit)", value: shakeHex(input, 256) },
      ];
      if (secret) {
        list.push(
          await hmacEntry(input, secret, "SHA-1", "HMAC-SHA1"),
          await hmacEntry(input, secret, "SHA-256", "HMAC-SHA256"),
          await hmacEntry(input, secret, "SHA-512", "HMAC-SHA512")
        );
      }
      setRows(list);
      setMessage(secret ? "Computed all hashes plus HMAC signatures." : "Computed all hashes. Add a secret for HMAC signatures.");
    } catch {
      setError("A cryptographic operation failed in this browser.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-teal-600" />
        <h2 className="text-sm font-semibold text-slate-700">Checksum & HMAC Calculator</h2>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={5} placeholder="Text to hash…" />

      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Secret key (optional — enables HMAC)</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Secret for HMAC-SHA1/256/512…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={() => void compute()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Compute hashes
        </Button>
      </div>

      {message && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message}</div>}
      {error && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">{error}</div>}

      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 w-44">Algorithm</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Hash (hex)</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-2 text-xs font-medium text-slate-500">{r.label}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700 break-all">{r.value || "—"}</td>
                  <td className="px-4 py-2">
                    <CopyButton text={r.value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-slate-400">Press “Compute hashes” to see MD5, CRC and SHA results together.</p>
      )}

      <p className="text-xs text-slate-400">
        MD5, CRC-16 and CRC-32 run locally; SHA and HMAC use the browser’s WebCrypto API. Useful for integrity checks.
      </p>
    </div>
  );
}

async function hmacEntry(input: string, secret: string, algo: AlgorithmIdentifier, label: string): Promise<Row> {
  return { label, value: await hmacHex(input, secret, algo) };
}