"use client";

import { useRef, useState, useCallback } from "react";
import { Loader2, FileText, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { redactPdfsWasm } from "@/lib/wasm-core";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function PdfRedact() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<
    { index: number; url: string; width: number; height: number }[]
  >([]);
  const [activePage, setActivePage] = useState(1);
  const [pagePreview, setPagePreview] = useState("");
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  const [rects, setRects] = useState<Map<number, Rect[]>>(new Map());
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0));
      const pdfjsData = new Uint8Array(buffer.slice(0));
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data: pdfjsData }).promise;
      const thumbs: { index: number; url: string; width: number; height: number }[] = [];
      const scale = 0.45;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const full = page.getViewport({ scale: 1 });
        thumbs.push({
          index: n,
          url: canvas.toDataURL("image/jpeg", 0.8),
          width: full.width,
          height: full.height,
        });
      }
      setPages(thumbs);
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      setBytes(bytes);
      setActivePage(1);
      setRects(new Map());
      await loadPagePreview(new Uint8Array(bytes.slice(0)), 1, pdfjs);
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

  const getRelative = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!previewRef.current) return { x: 0, y: 0 };
    const rect = previewRef.current.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const pageRects = rects.get(activePage) ?? [];
  const currentRect = current ? [current] : [];

  const onPointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const pos = getRelative(e);
      setDrawing(true);
      setStart(pos);
      setCurrent(null);
    },
    [getRelative],
  );

  const onPointerMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing || !start) return;
      const pos = getRelative(e);
      const r: Rect = {
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y),
      };
      setCurrent(r);
    },
    [drawing, start, getRelative],
  );

  const onPointerUp = useCallback(() => {
    if (!drawing || !current) {
      setDrawing(false);
      setStart(null);
      setCurrent(null);
      return;
    }
    if (current.w > 0.01 && current.h > 0.01) {
      setRects((prev) => {
        const next = new Map(prev);
        next.set(activePage, [...(prev.get(activePage) ?? []), current]);
        return next;
      });
    }
    setDrawing(false);
    setStart(null);
    setCurrent(null);
  }, [drawing, current, activePage]);

  const applyRedactions = async () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    const t0 = performance.now();
    const total = Array.from(rects.values()).reduce(
      (m, arr) => m + arr.length,
      0,
    );
    const pageRects: number[][][] = pages.map((p) => {
      const group = rects.get(p.index) ?? [];
      const w = p.width;
      const h = p.height;
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
          `Drew ${total} redaction box${total === 1 ? "" : "es"} on ${rects.size} page${rects.size === 1 ? "" : "s"} (Rust/WASM core · ${wasm.ms.toFixed(1)} ms).`,
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
        const pageRedacts = rects.get(i + 1) ?? [];
        for (const r of pageRedacts) {
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
        `Drew ${total} redaction box${total === 1 ? "" : "es"} on ${rects.size} page${rects.size === 1 ? "" : "s"} (JS fallback · ${(performance.now() - t0).toFixed(1)} ms).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const totalRects = Array.from(rects.values()).reduce(
    (m, arr) => m + arr.length,
    0,
  );

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
            ? `${name} — draw black boxes over sensitive content, then export.`
            : "Hide private information with black redaction boxes."}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pages.map((p) => (
              <button
                key={p.index}
                type="button"
                onClick={() => {
                  setActivePage(p.index);
                  if (bytes) void loadPagePreview(bytes, p.index);
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
                {rects.has(p.index) && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow bg-red-500 text-white">
                    {rects.get(p.index)!.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div
              ref={previewRef}
              className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden mx-auto select-none"
              style={{
                maxWidth: previewSize.w ? previewSize.w : 600,
                cursor: "crosshair",
              }}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pagePreview}
                alt={`Page ${activePage}`}
                className="w-full block pointer-events-none"
                draggable={false}
              />
              {[...pageRects, ...currentRect].map((r, i) => (
                <div
                  key={i}
                  className="absolute bg-black pointer-events-none rounded-sm"
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
                Redactions
              </p>
              <p className="text-2xl font-bold text-slate-800">{totalRects}</p>
              <p className="text-xs text-slate-400">
                Draw boxes by clicking and dragging on the page.
              </p>
              {pageRects.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setRects((prev) => {
                      const next = new Map(prev);
                      next.delete(activePage);
                      return next;
                    });
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 inline" /> Undo page
                </Button>
              )}
              <Button
                type="button"
                disabled={busy || totalRects === 0}
                onClick={applyRedactions}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5 inline" />
                )}
                {busy
                  ? "Exporting…"
                  : `Export ${totalRects} box${totalRects === 1 ? "" : "es"} → PDF`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
