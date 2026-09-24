"use client";

import { useId, useRef, useState } from "react";
import { Lock, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { PDFDocument } from "pdf-lib";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_PASSWORD = 127;

export default function PdfProtect() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [lockPrint, setLockPrint] = useState(false);
  const [lockCopy, setLockCopy] = useState(false);
  const [lockEdit, setLockEdit] = useState(false);
  const [lockAnnotate, setLockAnnotate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const passwordId = useId();
  const confirmId = useId();

  function friendlyError(err: unknown): string {
    const m = err instanceof Error ? err.message : String(err);
    if (/encrypted|already.*encrypt/i.test(m))
      return "This PDF is already password-protected. If you know its password, remove it with Unlock PDF first.";
    if (/Failed to parse|No PDF header/i.test(m))
      return "This file doesn't look like a valid PDF.";
    return m;
  }

  function resetState() {
    setName("");
    setBytes(null);
    setPageCount(null);
    setPassword("");
    setConfirm("");
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
      let doc;
      try {
        doc = await PDFDocument.load(new Uint8Array(data));
      } catch (err) {
        if (runId === runIdRef.current) throw new Error(friendlyError(err));
        return;
      }
      if (runId !== runIdRef.current) return;
      if (doc.getPageCount() > MAX_PAGES) {
        throw new Error(
          `This PDF has ${doc.getPageCount()} pages — up to 200 pages are supported.`,
        );
      }
      setName(file.name);
      setBytes(new Uint8Array(data));
      setPageCount(doc.getPageCount());
    } catch (err) {
      if (runId === runIdRef.current) {
        resetState();
        setError(err instanceof Error ? err.message : "Could not read the PDF.");
      }
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const protect = async () => {
    if (!bytes || !pageCount || busy) return;
    if (password.length < 5) {
      setError("Password must be at least 5 characters.");
      return;
    }
    if (password.length > MAX_PASSWORD) {
      setError("Password must be 127 characters or fewer.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
      const out = await encryptPDF(bytes, password, {
        allowPrinting: !lockPrint,
        allowCopying: !lockCopy,
        allowModifying: !lockEdit,
        allowAnnotating: !lockAnnotate,
      });
      if (runId !== runIdRef.current) return;
      const outBytes = new Uint8Array(out);
      let stillPlain = false;
      try {
        await PDFDocument.load(outBytes);
        stillPlain = true;
      } catch {
        // encrypted output throws on a plain load — that's the proof it took
      }
      if (runId !== runIdRef.current) return;
      if (stillPlain)
        throw new Error("The encrypted copy didn't take — please try again.");
      downloadBlob(
        outBytes,
        `${name.replace(/\.pdf$/i, "")}-protected.pdf`,
      );
      setPassword("");
      setConfirm("");
      setMessage(
        `Protected ${pageCount} page${pageCount === 1 ? "" : "s"} — downloaded ${name.replace(/\.pdf$/i, "")}-protected.pdf. It now opens only with your password.`,
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
        aria-label="Choose a PDF to protect"
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
            ? pageCount
              ? `${name} — ${pageCount} page${pageCount === 1 ? "" : "s"}`
              : `${name} loaded`
            : "Lock a PDF with a password — nothing is uploaded."}
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

      {bytes && pageCount && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5 max-w-md">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-800">
              Set a password
            </legend>
            <div>
              <label
                htmlFor={passwordId}
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Password
              </label>
              <input
                id={passwordId}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                maxLength={MAX_PASSWORD}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder="At least 5 characters"
              />
            </div>
            <div>
              <label
                htmlFor={confirmId}
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Confirm password
              </label>
              <input
                id={confirmId}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                maxLength={MAX_PASSWORD}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder="Repeat the password"
              />
            </div>
            <p className="text-xs text-slate-500">
              At least 5 characters. Use 8+ for anything sensitive.
            </p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">
              Restrict what recipients can do (optional)
            </legend>
            {(
              [
                ["Printing", lockPrint, setLockPrint],
                ["Copying", lockCopy, setLockCopy],
                ["Editing", lockEdit, setLockEdit],
                ["Annotating", lockAnnotate, setLockAnnotate],
              ] as const
            ).map(([label, value, setter]) => (
              <label
                key={label}
                className="flex items-center gap-2.5 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setter(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                Block {label.toLowerCase()}
              </label>
            ))}
            <p className="text-xs text-slate-500">
              Print/copy/edit restrictions are honored by Adobe Acrobat and most
              desktop readers; some minimal or browser-based viewers ignore them.
            </p>
          </fieldset>

          <Button type="button" disabled={busy} onClick={() => void protect()}>
            <Lock className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            {busy ? "Encrypting…" : "Protect PDF → download"}
          </Button>
          <p className="text-xs text-slate-500">
            AES-256 encryption runs entirely on this device — your file and
            password never leave your browser.
          </p>
        </div>
      )}
    </div>
  );
}