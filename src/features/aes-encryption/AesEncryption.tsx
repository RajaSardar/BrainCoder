"use client";

import { useState } from "react";
import { Lock, Unlock, Loader2 } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
  try {
    const raw = atob(b64.replace(/\s+/g, ""));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

interface Envelope {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

export default function AesEncryption() {
  const [text, setText] = useState("Secret message 🔐");
  const [passphrase, setPassphrase] = useState("");
  const [iterations, setIterations] = useState(150000);
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const encrypt = async () => {
    if (!passphrase) {
      setError("Enter a passphrase first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(passphrase, salt, iterations);
      const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
      const envelope: Envelope = {
        v: 1,
        iter: iterations,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        data: bytesToBase64(new Uint8Array(enc)),
      };
      setOutput(JSON.stringify(envelope, null, 2));
      setMessage(`Encrypted ${formatBytes(text.length)} → ${formatBytes(enc.byteLength)} (AES-256-GCM).`);
    } catch {
      setError("Encryption failed.");
    } finally {
      setBusy(false);
    }
  };

  const decrypt = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const env = JSON.parse(text) as Partial<Envelope>;
      if (env.v !== 1 || !env.salt || !env.iv || !env.data) throw new Error("Invalid envelope.");
      const salt = base64ToBytes(env.salt);
      const iv = base64ToBytes(env.iv);
      const data = base64ToBytes(env.data);
      if (!salt || !iv || !data) throw new Error("Invalid base64 in envelope.");
      const key = await deriveKey(passphrase, salt, env.iter ?? 150000);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
      setOutput(new TextDecoder().decode(plain));
      setMessage("Decrypted successfully.");
    } catch {
      setError("Could not decrypt — wrong passphrase or corrupted data.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Lock className="w-4 h-4 text-rose-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["encrypt", "decrypt"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "encrypt" ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {m === "encrypt" ? "Encrypt" : "Decrypt"}
            </button>
          ))}
        </div>
      </div>

      <StyledTextarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={mode === "encrypt" ? "Message to encrypt…" : 'Paste the JSON envelope…'} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">Passphrase</label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase (PBKDF2 → AES-256-GCM)"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">PBKDF2 iterations: {iterations.toLocaleString()}</label>
          <input
            type="range"
            min={10000}
            max={1000000}
            step={10000}
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            className="w-full accent-rose-600"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={() => void (mode === "encrypt" ? encrypt() : decrypt())}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? "Working…" : mode === "encrypt" ? "Encrypt" : "Decrypt"}
        </Button>
        <CopyButton text={output} />
      </div>

      <textarea
        readOnly
        value={output}
        rows={8}
        placeholder={mode === "encrypt" ? "Your encrypted envelope appears here…" : "Decrypted text appears here…"}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono break-all focus:outline-none resize-y"
      />

      {message && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <p className="text-xs text-slate-400">
        AES-256-GCM with a random salt and IV, encrypted entirely in your browser. The same passphrase (and iterations) decrypts the JSON envelope on any device.
      </p>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}