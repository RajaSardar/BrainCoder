"use client";

import { useRef, useState } from "react";
import { Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { extractPdfsWasm } from "@/lib/wasm-core";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const THUMB_SCALE = 0.45;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };

interface PageInfo {
  index: number;
  url: string;
}

function friendlyReadError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : "";
  const raw = `${name} ${msg}`;
  if (name === "PasswordException" || /password|encrypted/i.test(raw)) {
    return "That PDF is password-protected. Unlock it with PDF Unlock first, then load the unlocked file here.";
  }
  if (
    name === "InvalidPDFException" ||
    /failed to fetch|no pdf header|invalid pdf/i.test(raw)
  ) {
    return "That file doesn't look like a valid PDF.";
  }
  return "Could not read that PDF. It may be corrupt or unsupported.";
}

export default function PdfRemovePages() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);

  const resetState = () => {
    setPages([]);
    setBytes(null);
    setName("");
    setBase("");
    setRemoving(new Set());
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        resetState();
        setError(
          "That file is larger than 100 MB, which this tool doesn't support. Split it with PDF Split first.",
        );
        return;
      }
      const buffer = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const exportBytes = new Uint8Array(buffer.slice(0));
      setMessage("Rendering page previews…");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const data = new Uint8Array(buffer.slice(0));
      const loadingTask = pdfjs.getDocument({ data });
      const doc = await loadingTask.promise;
      try {
        if (doc.numPages > MAX_PAGES) {
          resetState();
          setError(
            `This document has ${doc.numPages} pages, which is more than this tool handles at once (${MAX_PAGES}). Split it with PDF Split first, then trim each part.`,
          );
          return;
        }
        const list: PageInfo[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          if (runId !== runIdRef.current) return;
          setMessage(`Rendering page previews… ${n} of ${doc.numPages}.`);
          const page = await doc.getPage(n);
          try {
            const viewport = page.getViewport({ scale: THUMB_SCALE });
            const canvas = document.createElement("canvas");
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              throw new Error("Could not render this page in the browser.");
            }
            await page.render({ canvas, viewport }).promise;
            list.push({ index: n, url: canvas.toDataURL("image/jpeg", 0.8) });
          } finally {
            page.cleanup();
          }
        }
        if (runId !== runIdRef.current) return;
        setPages(list);
        setBytes(exportBytes);
        setName(file.name);
        setBase(file.name.replace(/\.pdf$/i, ""));
        setMessage(
          list.length === 1
            ? "Loaded 1 page. Mark pages below to remove them."
            : `Loaded ${list.length} pages. Tap any page to mark it for deletion.`,
        );
      } finally {
        await loadingTask.destroy();
      }
    } catch (err) {
      if (runId !== runIdRef.current) return;
      resetState();
      setError(friendlyReadError(err));
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    void handleFile(file);
  };

  const toggle = (n: number) => {
    setRemoving((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const removePages = async () => {
    if (!bytes || removing.size === 0) return;
    if (removing.size === pages.length) {
      setError(
        "Every page is selected — nothing would be left. Tap a page to keep it before deleting.",
      );
      return;
    }
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("Removing selected pages…");
    try {
      const keep: number[] = [];
      for (const p of pages) {
        if (!removing.has(p.index)) keep.push(p.index - 1);
      }
      const wasmOut = await extractPdfsWasm(bytes, [keep]);
      let out: Uint8Array;
      if (wasmOut && wasmOut[0]) {
        out = wasmOut[0];
      } else {
        const { PDFDocument } = await import("pdf-lib");
        const rebuilt = await PDFDocument.create();
        const src = await PDFDocument.load(bytes);
        const copied = await rebuilt.copyPages(src, keep);
        copied.forEach((p) => rebuilt.addPage(p));
        out = await rebuilt.save(SAVE_OPTS);
      }
      if (runId !== runIdRef.current) return;
      const gone = removing.size;
      downloadBlob(out, `${base}-kept-pages.pdf`);
      setMessage(
        `Downloaded ${base}-kept-pages.pdf — removed ${gone} page${gone === 1 ? "" : "s"}, ${keep.length} remaining.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(friendlyReadError(err));
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
        className="hidden"
        aria-label="Choose a PDF to delete pages from"
        onChange={(e) => handlePicker(e.target.files?.[0] ?? undefined)}
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
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name} — ${pages.length} pages`
            : "Open a PDF, tap the pages to delete, and download a file with only what's left. Nothing is uploaded."}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
        >
          {message}
        </div>
      )}

      {pages.length > 0 && (
        <fieldset disabled={busy} className="space-y-4">
          <legend className="text-sm font-medium text-slate-700">
            Pages to delete
          </legend>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={removing.size === 0}
              onClick={() => void removePages()}
            >
              <Trash2 className="w-4 h-4 mr-1.5 inline" />
              {busy
                ? "Working…"
                : `Delete ${removing.size} page${removing.size === 1 ? "" : "s"}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setRemoving(
                  removing.size === pages.length
                    ? new Set()
                    : new Set(pages.map((p) => p.index)),
                )
              }
            >
              {removing.size === pages.length
                ? "Clear"
                : `Select all ${pages.length}`}
            </Button>
            <span className="text-xs text-slate-500">
              Tap a page to mark it for deletion. Marked pages get a red border
              — tap again to keep one.
            </span>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
            role="group"
            aria-label="Page previews"
          >
            {pages.map((p) => {
              const on = removing.has(p.index);
              return (
                <button
                  key={p.index}
                  type="button"
                  onClick={() => toggle(p.index)}
                  aria-pressed={on}
                  aria-label={`Page ${p.index}${on ? ", marked for deletion" : ""}`}
                  className={`group relative rounded-xl border-2 overflow-hidden transition ${
                    on
                      ? "border-red-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    className="w-full aspect-[3/4] object-cover bg-slate-100"
                    loading="lazy"
                  />
                  <span
                    className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold shadow ${
                      on
                        ? "bg-red-500 text-white"
                        : "bg-white/90 text-slate-600"
                    }`}
                  >
                    {on ? "✕" : p.index}
                  </span>
                  <span
                    className={`absolute inset-0 transition ${on ? "bg-red-500/10 ring-1 ring-inset ring-red-500" : "group-hover:bg-slate-900/5"}`}
                  />
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}