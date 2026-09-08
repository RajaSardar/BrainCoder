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

function bytesToHex(bytes: Uint8Array<ArrayBuffer>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
        { label: "SHA-256", value: await shaHex(input, "SHA-256") },
        { label: "SHA-384", value: await shaHex(input, "SHA-384") },
        { label: "SHA-512", value: await shaHex(input, "SHA-512") },
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