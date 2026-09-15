"use client";

import { useCallback, useRef, useState } from "react";
import { watchDemoFile } from "@/components/NetworkAudit";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KiB`;

export function LocalHashDemo() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File | undefined) => {
    setError(null);
    setHash(null);
    if (!file) return;
    setFileName(file.name);
    setFileSize(fmtBytes(file.size));
    watchDemoFile(file);
    setBusy(true);
    try {
      const h = await sha256Hex(file);
      setHash(h);
    } catch {
      setError("Hashing failed in this browser context.");
      watchDemoFile(null);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-semibold text-slate-600">
          Live demo — drop a file, it&apos;s hashed locally
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Uses the browser&apos;s own Web Crypto API. No server involved.
        </p>
      </div>

      <div className="p-4 space-y-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 py-6 text-sm text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50 transition disabled:opacity-50"
        >
          {busy
            ? "Hashing on your device…"
            : "Click to pick a file (PDF, image, anything)"}
        </button>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {hash && fileName && (
          <div className="rounded-xl bg-slate-950 px-4 py-3 font-mono text-[11px] leading-relaxed break-all">
            <p className="text-slate-400">file: {fileName}</p>
            <p className="text-slate-400">size: {fileSize}</p>
            <p className="text-emerald-400 mt-1.5">sha256 = {hash}</p>
          </div>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed">
          copy the hash elsewhere, edit the file, repeat — the only way the
          digest changes is if a server round-trip had been involved.
        </p>
      </div>
    </div>
  );
}