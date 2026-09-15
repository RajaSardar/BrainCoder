"use client";

import { useRef, useState } from "react";
import {
  Loader2,
  FileText,
  Search,
  RotateCcw,
  Download,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { findMatchRects, redactPdfsWasm } from "@/lib/wasm-core";
import { extractContentRuns, type TextRun } from "@/features/pdf-editor/text-structure";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WordRun {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  text: string;
}

interface PageData {
  index: number;
  url: string;
  words: WordRun[];
  pageWidth: number;
  pageHeight: number;
}

export default function PdfAutoRedact() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Map<number, Rect[]>>(new Map());
  const [pagePreview, setPagePreview] = useState("");
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setMatches(new Map());
    setQuery("");
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
      const list: PageData[] = [];
      const scale = 0.45;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const runs = await extractContentRuns(doc, n - 1, { engine: "wasm" });
        list.push({
          index: n,
          url: canvas.toDataURL("image/jpeg", 0.8),
          words: runs.text.map((r: TextRun) => ({
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            fontSize: r.fontSize,
            text: r.text,
          })),
          pageWidth: page.getViewport({ scale: 1 }).width,
          pageHeight: page.getViewport({ scale: 1 }).height,
        });
      }
      setPages(list);
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      setBytes(exportBytes);
      setActivePage(1);
      await loadPagePreview(pdfjsData, 1, pdfjs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const loadPagePreview = async (
    pdfBytes: Uint8Array,
    pageNum: number,
    pdfjsRef?: typeof import("pdfjs-dist"),
  ) => {
    const pdfjs = pdfjsRef ?? (await import("pdfjs-dist"));
    if (!pdfjsRef) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    }
    const doc = await pdfjs.getDocument({ data: pdfBytes.slice(0) }).promise;
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    setPagePreview(canvas.toDataURL("image/png"));
    setPreviewSize({ w: canvas.width, h: canvas.height });
  };

  const findMatches = async () => {
    if (!pages.length) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      setError("Enter a word or phrase to redact.");
      return;
    }
    const t0 = performance.now();
    const found = new Map<number, Rect[]>();
    let engine: "wasm" | "js" = "js";
    for (const p of pages) {
      if (!p.words.length) continue;
      const res = await findMatchRects(p.words, p.pageWidth, p.pageHeight, q);
      if (res.engine === "wasm") engine = "wasm";
      if (res.rects.length) found.set(p.index, res.rects);
    }
    const ms = performance.now() - t0;
    setMatches(found);
    const total = Array.from(found.values()).reduce((m, r) => m + r.length, 0);
    if (total === 0) {
      setError(`No matches for "${query.trim()}" — try a shorter phrase.`);
      return;
    }
    const first = Array.from(found.keys())[0];
    setActivePage(first);
    const pdfjsData = new Uint8Array(bytes!.slice(0));
    void loadPagePreview(pdfjsData, first);
    setMessage(
      `Found ${total} match${total === 1 ? "" : "es"} of "${query.trim()}" across ${found.size} page${found.size === 1 ? "" : "s"} (${engine === "wasm" ? "Rust/WASM core" : "JS fallback"} · ${ms.toFixed(1)} ms).`,
    );
  };

  const applyRedactions = async () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    const t0 = performance.now();
    const total = Array.from(matches.values()).reduce(
      (m, arr) => m + arr.length,
      0,
    );
    const pageRects: number[][][] = pages.map((p) => {
      const group = matches.get(p.index) ?? [];
      const w = p.pageWidth;
      const h = p.pageHeight;
      return group.map((r) => [
        r.x * w,
        h - (r.y + r.h) * h,
        (r.x + r.w) * w,
        h - r.y * h,
      ]);
    });
    try {
      const wasm = await redactPdfsWasm(bytes, pageRects);
      if (wasm) {
        downloadBlob(wasm.bytes, `${base}-redacted.pdf`);
        setMessage(
          `Redacted ${total} occurrence${total === 1 ? "" : "s"} across ${matches.size} page${matches.size === 1 ? "" : "s"} (Rust/WASM core · ${wasm.ms.toFixed(1)} ms).`,
        );
        return;
      }
      const { PDFDocument, rgb } = await import("pdf-lib");
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      for (let i = 0; i < src.getPageCount(); i++) {
        const [copied] = await out.copyPages(src, [i]);
        out.addPage(copied);
        const page = out.getPage(i);
        const { width, height } = page.getSize();
        const pageMatches = matches.get(i + 1) ?? [];
        for (const r of pageMatches) {
          page.drawRectangle({
            x: r.x * width,
            y: height - (r.y + r.h) * height,
            width: r.w * width,
            height: r.h * height,
            color: rgb(0, 0, 0),
          });
        }
      }
      const saved = await out.save();
      downloadBlob(saved, `${base}-redacted.pdf`);
      setMessage(
        `Redacted ${total} occurrence${total === 1 ? "" : "s"} across ${matches.size} page${matches.size === 1 ? "" : "s"} (JS fallback · ${(performance.now() - t0).toFixed(1)} ms).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const totalMatches = Array.from(matches.values()).reduce(
    (m, arr) => m + arr.length,
    0,
  );
  const pageMatches = matches.get(activePage) ?? [];

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
            ? `${name} — search for text to black out automatically.`
            : "Search a PDF for sensitive text and redact every match automatically."}
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") findMatches();
              }}
              placeholder="Sensitive word or phrase… e.g. John Smith"
              className="flex-1 min-w-0 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white"
            />
            <Button type="button" onClick={findMatches} disabled={busy}>
              <Search className="w-4 h-4 mr-1.5 inline" />
              Find matches
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pages.map((p) => (
              <button
                key={p.index}
                type="button"
                onClick={() => {
                  setActivePage(p.index);
                  if (bytes)
                    void loadPagePreview(
                      new Uint8Array(bytes.slice(0)),
                      p.index,
                    );
                }}
                className={`relative rounded-xl border-2 overflow-hidden transition ${
                  activePage === p.index
                    ? "border-indigo-500 ring-2 ring-indigo-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Page ${p.index}`}
                  className="w-full aspect-[3/4] object-cover bg-slate-100"
                  loading="lazy"
                />
                <span className="absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold shadow bg-white/90 text-slate-600">
                  {p.index}
                </span>
                {matches.has(p.index) && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow bg-red-500 text-white">
                    {matches.get(p.index)!.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-start">
            <div
              className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden mx-auto"
              style={{ maxWidth: previewSize.w ? previewSize.w : 600 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pagePreview}
                alt={`Page ${activePage}`}
                className="w-full block pointer-events-none"
                draggable={false}
              />
              {pageMatches.map((r, i) => (
                <div
                  key={i}
                  className="absolute bg-red-500/80 rounded-sm"
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                  }}
                />
              ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 sticky top-20">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Matches
              </p>
              <p className="text-2xl font-bold text-slate-800">
                {totalMatches}
              </p>
              <p className="text-xs text-slate-400">
                Red areas are detected occurrences of your search phrase. All
                matches across every page are blacked out on export.
              </p>
              {pageMatches.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setMatches((prev) => {
                      const next = new Map(prev);
                      next.delete(activePage);
                      return next;
                    });
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 inline" /> Exclude page
                </Button>
              )}
              <Button
                type="button"
                disabled={busy || totalMatches === 0}
                onClick={() => void applyRedactions()}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5 inline" />
                )}
                {busy
                  ? "Exporting…"
                  : `Redact ${totalMatches} match${totalMatches === 1 ? "" : "es"}`}
              </Button>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Runs 100% in your browser — nothing is uploaded.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}