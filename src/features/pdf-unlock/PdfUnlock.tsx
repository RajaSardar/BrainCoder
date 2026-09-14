"use client";

import { useRef, useState } from "react";
import { Unlock, Loader2, FileText } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

export default function PdfUnlock() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPassword("");
    try {
      const data = await file.arrayBuffer();
      const { isEncrypted } = await import("@pdfsmaller/pdf-decrypt");
      const res = await isEncrypted(new Uint8Array(data));
      setName(file.name);
      setBytes(new Uint8Array(data));
      setNeedsPassword(res.encrypted);
      if (!res.encrypted) {
        setMessage(
          "This PDF is not password-protected — it can be opened freely.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
      setBytes(null);
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");
      const out = await decryptPDF(bytes, password);
      downloadBlob(
        new Uint8Array(out),
        `${name.replace(/\.pdf$/i, "")}-unlocked.pdf`,
      );
      setMessage("Password removed — the unlocked PDF has been downloaded.");
    } catch {
      setError(
        "Could not unlock: the password is likely wrong, or the owner password is required.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500">
          {name
            ? `${name} loaded`
            : "Remove the password from a protected PDF (only if you know it)."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {bytes && needsPassword && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5 max-w-md">
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              placeholder="Enter the PDF password"
            />
          </Field>
          <Button type="button" disabled={busy} onClick={() => void unlock()}>
            <Unlock className="w-4 h-4 mr-1.5 inline" />
            {busy ? "Unlocking…" : "Unlock PDF → download"}
          </Button>
          <p className="text-xs text-slate-400">
            Decryption runs entirely on your device — the password and file
            never leave your browser.
          </p>
        </div>
      )}
    </div>
  );
}
