"use client";

import { useRef, useState, useId } from "react";
import { Download, Loader2, FileDigit } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";
import { extractPdfText, pageRangeSyntaxError } from "@/features/pdf-office/support";
import { downloadBlob } from "@/lib/download";
import Link from "next/link";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export default function PdfToText() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pagesRange, setPagesRange] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const pagesId = useId();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setError("");
    setNote("");
    setText("");
    if (file.size > MAX_FILE_BYTES) {
      setError("Files larger than 100 MB aren't supported here.");
      return;
    }
    const syntax = pageRangeSyntaxError(pagesRange);
    if (syntax) {
      setError(syntax);
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const data = await file.arrayBuffer();
      if (runIdRef.current !== runId) return;
      const result = await extractPdfText(data, {
        pages: pagesRange,
        onPage: (done, total) => {
          if (runIdRef.current === runId) setProgress({ done, total });
        },
      });
      if (runIdRef.current !== runId) return;
      setFileName(file.name.replace(/\.pdf$/i, ""));
      setProgress(null);
      setBusy(false);
      if (!result.trim()) {
        setNote("No selectable text was found — this looks like a scanned PDF. Try PDF OCR to read the page images.");
        return;
      }
      setText(result);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      const name = (err as { name?: string })?.name ?? "";
      if (name === "PasswordException") {
        setError("This PDF is password-protected — unlock it first with PDF Unlock, then extract from the unlocked file.");
      } else if (name === "InvalidPDFException") {
        setError("That file doesn't look like a valid PDF.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to extract text");
      }
      setProgress(null);
      setBusy(false);
    }
  };

  const download = () => {
    if (!text) return;
    const bytes = new TextEncoder().encode("\uFEFF" + text);
    downloadBlob(bytes, `${fileName || "document"}.txt`, "text/plain;charset=utf-8");
  };

  const onPagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setPagesRange(v);
    setRangeError(pageRangeSyntaxError(v) ?? "");
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <div className="flex flex-wrap items-end gap-4">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf"
          className="hidden"
          aria-label="Choose a PDF file"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          <FileDigit className="w-4 h-4 mr-1.5 inline" /> Choose PDF
        </Button>
        <div>
          <label htmlFor={pagesId} className="text-xs font-medium text-slate-500">Pages</label>
          <input
            id={pagesId}
            value={pagesRange}
            placeholder="e.g. 1-3 (all if empty)"
            disabled={busy}
            onChange={onPagesChange}
            className="mt-1 block w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
          />
        </div>
        {text && (
          <>
            <CopyButton text={text} ariaLabel="Copy extracted text" />
            <Button type="button" variant="secondary" onClick={download}>
              <Download className="w-4 h-4 mr-1.5 inline" /> Download .txt
            </Button>
          </>
        )}
      </div>

      {busy && progress && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Extracting text… page {progress.done} of {progress.total}
        </div>
      )}
      {rangeError && !busy && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{rangeError}</div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}
      {note && !busy && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span>{note}</span>
          <Link href="/tools/pdf-ocr" className="font-semibold underline underline-offset-2 hover:text-amber-900 shrink-0">
            Open PDF OCR
          </Link>
        </div>
      )}

      {!busy && !error && !note && !text && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a PDF by clicking or dropping it here"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-600 cursor-pointer hover:border-slate-300 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
        >
          <p className="font-medium text-slate-700 mb-1">Drag and drop a PDF here, or click to browse</p>
          <p>Its text layer is extracted to a plain .txt file — optionally for a page range. Scanned PDFs have no text layer; use PDF OCR for those. 100% local.</p>
        </div>
      )}

      {text && (
        <div>
          <textarea
            value={text}
            readOnly
            rows={14}
            aria-label="Extracted text"
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
          />
          <p className="text-xs text-slate-500 mt-1">
            {text.length.toLocaleString()} characters extracted from {fileName}.
          </p>
        </div>
      )}
    </div>
  );
}