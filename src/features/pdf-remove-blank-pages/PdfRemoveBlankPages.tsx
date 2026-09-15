"use client";

import { useRef, useState } from "react";
import {
  Trash2,
  Loader2,
  FileText,
  ScanLine,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { extractPdfsWasm } from "@/lib/wasm-core";

interface PageInfo {
  index: number;
  url: string;
  blank: boolean;
}

function isBlankCanvas(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let opaque = 0;
  let dark = 0;
  let lumSum = 0;
  for (let i = 0; i < data.length; i += 8) {
    const a = data[i + 3];
    if (a < 40) {
      opaque++;
      continue;
    }
    opaque++;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lumSum += lum;
    if (lum < 240) dark++;
  }
  if (opaque === 0) return true;
  const ratio = dark / opaque;
  const mean = lumSum / opaque;
  return ratio < 0.002 || (mean > 250 && ratio < 0.01);
}

export default function PdfRemoveBlankPages() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setRemoving(new Set());
    try {
      const buffer = await file.arrayBuffer();
      const exportBytes = new Uint8Array(buffer.slice(0));
      const pdfjsData = new Uint8Array(buffer.slice(0));
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data: pdfjsData }).promise;
      const list: PageInfo[] = [];
      const blankFlags: number[] = [];
      const thumbScale = 0.45;
      const scanScale = 0.4;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const tView = page.getViewport({ scale: thumbScale });
        const tCanvas = document.createElement("canvas");
        tCanvas.width = Math.floor(tView.width);
        tCanvas.height = Math.floor(tView.height);
        const tCtx = tCanvas.getContext("2d");
        if (!tCtx) continue;
        await page.render({ canvas: tCanvas, viewport: tView }).promise;
        const sView = page.getViewport({ scale: scanScale });
        const sCanvas = document.createElement("canvas");
        sCanvas.width = Math.floor(sView.width);
        sCanvas.height = Math.floor(sView.height);
        await page.render({ canvas: sCanvas, viewport: sView }).promise;
        blankFlags.push(isBlankCanvas(sCanvas) ? 1 : 0);
        list.push({
          index: n,
          url: tCanvas.toDataURL("image/jpeg", 0.8),
          blank: false,
        });
      }
      const blanks = new Set<number>();
      list.forEach((p, idx) => {
        p.blank = blankFlags[idx] === 1;
        if (p.blank) blanks.add(p.index);
      });
      setPages(list);
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      setBytes(exportBytes);
      setRemoving(blanks);
      setMessage(
        blanks.size === 0
          ? `No blank pages found — the document has ${doc.numPages} page${doc.numPages === 1 ? "" : "s"}.`
          : `Detected ${blanks.size} blank page${blanks.size === 1 ? "" : "s"} and preselected them for removal.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
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
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    const t0 = performance.now();
    try {
      const keep = [];
      for (let i = 0; i < pages.length; i++)
        if (!removing.has(pages[i].index)) keep.push(pages[i].index - 1);
      const wasmOut = await extractPdfsWasm(bytes, [keep]);
      if (wasmOut && wasmOut[0]) {
        downloadBlob(wasmOut[0], `${base}-no-blank-pages.pdf`);
        const gone = removing.size;
        setMessage(
          gone === 0
            ? "No pages selected — downloaded the full document."
            : `Removed ${gone} blank page${gone === 1 ? "" : "s"} (${keep.length} remaining) (Rust/WASM core · ${(performance.now() - t0).toFixed(1)} ms).`,
        );
        return;
      }
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await out.copyPages(src, keep);
      copied.forEach((p) => out.addPage(p));
      const gone = removing.size;
      downloadBlob(await out.save(), `${base}-no-blank-pages.pdf`);
      setMessage(
        gone === 0
          ? "No pages selected — downloaded the full document."
          : `Removed ${gone} blank page${gone === 1 ? "" : "s"} (${keep.length} remaining) (JS fallback · ${(performance.now() - t0).toFixed(1)} ms).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const blankCount = pages.filter((p) => p.blank).length;

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
            ? `${name} — ${pages.length} pages`
            : "Select a PDF to detect and delete empty pages."}
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

      {pages.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={busy || pages.length === 0}
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
              disabled={blankCount === 0}
              onClick={() => setRemoving(new Set(pages.filter((p) => p.blank).map((p) => p.index)))}
            >
              <ScanLine className="w-3.5 h-3.5 mr-1.5 inline" />
              Select {blankCount} blank
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
              {removing.size === pages.length ? "Clear" : `Select all ${pages.length}`}
            </Button>
            <span className="text-xs text-slate-400">
              Pages marked blank are preselected. Tap any page to toggle it.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pages.map((p) => {
              const on = removing.has(p.index);
              return (
                <button
                  key={p.index}
                  type="button"
                  onClick={() => toggle(p.index)}
                  className={`group relative rounded-xl border-2 overflow-hidden transition ${
                    on
                      ? "border-red-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Page ${p.index} preview`}
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
                  {p.blank && (
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold text-slate-500 bg-white/90 rounded-md px-1.5 py-0.5 shadow">
                      blank
                    </span>
                  )}
                  <span
                    className={`absolute inset-0 transition ${on ? "bg-red-500/10 ring-1 ring-inset ring-red-500" : "group-hover:bg-slate-900/5"}`}
                  />
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Blank detection runs in your browser by analyzing every page&apos;s
            ink coverage — nothing is uploaded.
          </p>
        </>
      )}
    </div>
  );
}