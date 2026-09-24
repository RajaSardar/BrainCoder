"use client";

import { useId, useRef, useState } from "react";
import { Unlock, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { PDFDocument } from "pdf-lib";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const UNLOCKED_INVALID = "UNLOCKED_INVALID";

export default function PdfUnlock() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const passwordId = useId();

  function friendlyError(err: unknown): string {
    const m = err instanceof Error ? err.message : String(err);
    if (/Incorrect password/i.test(m))
      return "The password is wrong. Try it again — watch for stray spaces or capitalization.";
    if (/Unsupported encryption/i.test(m))
      return "This PDF uses an encryption method this tool can't unlock yet (AES-128 or a rare scheme). Open it with the password in Adobe Acrobat or Preview instead.";
    if (/not encrypted/i.test(m))
      return "This PDF is not password-protected — it already opens without one.";
    if (m === UNLOCKED_INVALID)
      return "The unlocked file didn't come out valid — the password may be wrong, or the encryption is unsupported.";
    if (/Failed to parse|No PDF header/i.test(m))
      return "This file doesn't look like a valid PDF.";
    if (/Failed to (read|decrypt) PDF/i.test(m))
      return "This PDF couldn't be read — it may be damaged or use an encryption this tool can't unlock.";
    return "Couldn't unlock this PDF — try again.";
  }

  function resetState() {
    setName("");
    setBytes(null);
    setNeedsPassword(false);
    setPassword("");
    setMessage("");
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(
          `This PDF is ${Math.round(file.size / 1048576)} MB — files up to 100 MB are supported.`,
        );
      }
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      let res;
      try {
        const { isEncrypted } = await import("@pdfsmaller/pdf-decrypt");
        res = await isEncrypted(new Uint8Array(data));
      } catch (err) {
        throw new Error(friendlyError(err));
      }
      if (runId !== runIdRef.current) return;
      setName(file.name);
      setBytes(new Uint8Array(data));
      setNeedsPassword(res.encrypted);
      if (!res.encrypted) {
        setMessage(
          "This PDF is not password-protected — it already opens without one.",
        );
      }
    } catch (err) {
      if (runId === runIdRef.current) {
        resetState();
        setError(err instanceof Error ? err.message : "Could not read the PDF.");
      }
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const unlock = async () => {
    if (!bytes || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");
      const out = await decryptPDF(bytes, password);
      if (runId !== runIdRef.current) return;
      const outBytes = new Uint8Array(out);
      const validHeader =
        outBytes.length > 10 &&
        outBytes[0] === 0x25 &&
        outBytes[1] === 0x50 &&
        outBytes[2] === 0x44 &&
        outBytes[3] === 0x46;
      let loadsPlain = false;
      if (validHeader) {
        try {
          await PDFDocument.load(outBytes);
          loadsPlain = true;
        } catch {
          // still encrypted (or broken) — reject rather than ship a bad file
        }
      }
      if (runId !== runIdRef.current) return;
      if (!loadsPlain) throw new Error(UNLOCKED_INVALID);
      downloadBlob(
        outBytes,
        `${name.replace(/\.pdf$/i, "")}-unlocked.pdf`,
      );
      setPassword("");
      setMessage(
        `Downloaded ${name.replace(/\.pdf$/i, "")}-unlocked.pdf — the password was removed.`,
      );
    } catch (err) {
      if (runId === runIdRef.current) setError(friendlyError(err));
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF to unlock"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? "Reading the PDF…" : ""}
      </span>
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
        <span className="text-sm text-slate-500" role="status">
          {name
            ? needsPassword
              ? `${name} loaded — password-protected`
              : `${name} loaded`
            : "Remove the password from a PDF you own — nothing is uploaded."}
        </span>
      </div>

      {error && (
        <div
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
          role="status"
        >
          {message}
        </div>
      )}

      {bytes && needsPassword && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5 max-w-md">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-800">
              Enter the password
            </legend>
            <div>
              <label
                htmlFor={passwordId}
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                PDF password
              </label>
              <input
                id={passwordId}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder="The password this PDF was locked with"
              />
            </div>
            <p className="text-xs text-slate-500">
              The open password and the owner password both work. If the file is
              restricted but opens without a password, leave the field empty and
              unlock.
            </p>
          </fieldset>
          <Button type="button" disabled={busy} onClick={() => void unlock()}>
            <Unlock className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            {busy ? "Unlocking…" : "Unlock PDF → download"}
          </Button>
          <p className="text-xs text-slate-500">
            Decryption runs entirely on this device — the password and file
            never leave your browser.
          </p>
        </div>
      )}
    </div>
  );
}