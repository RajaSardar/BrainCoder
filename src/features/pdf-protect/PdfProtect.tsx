"use client";

import { useRef, useState } from "react";
import { Lock, Loader2, FileText } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

export default function PdfProtect() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await file.arrayBuffer();
      setName(file.name);
      setBytes(new Uint8Array(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const protect = async () => {
    if (!bytes) return;
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
      const out = await encryptPDF(bytes, password, {
        allowPrinting: true,
        allowCopying: true,
        allowModifying: true,
        allowAnnotating: true,
      });
      downloadBlob(
        new Uint8Array(out),
        `${name.replace(/\.pdf$/i, "")}-protected.pdf`,
      );
      setMessage(`Protected “${name}” with a password.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encryption failed");
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
          {name ? `${name} loaded` : "Select a PDF to lock with a password."}
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

      {bytes && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5 max-w-md">
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              placeholder="At least 4 characters"
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              placeholder="Repeat the password"
            />
          </Field>
          <Button type="button" disabled={busy} onClick={() => void protect()}>
            <Lock className="w-4 h-4 mr-1.5 inline" />
            {busy ? "Encrypting…" : "Protect PDF → download"}
          </Button>
          <p className="text-xs text-slate-400">
            Your file never leaves this device. The password-encrypted copy is
            generated locally in your browser.
          </p>
        </div>
      )}
    </div>
  );
}
