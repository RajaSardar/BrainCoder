"use client";

import { useRef, useState, useId } from "react";
import { Download, Loader2, FileDigit, FileArchive, RefreshCw } from "lucide-react";
import { Button, SliderField } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { zipSync, type Zippable } from "fflate";
import { ensurePdfjsWorker, pageRangeSyntaxError } from "@/features/pdf-office/support";

type PdfJsModule = typeof import("pdfjs-dist");
type PdfLoadingTask = ReturnType<PdfJsModule["getDocument"]>;
type PdfDocument = Awaited<PdfLoadingTask["promise"]>;
type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;
type PdfViewport = ReturnType<PdfPage["getViewport"]>;

interface PageImage {
  page: number;
  url: string;
  width: number;
  height: number;
}

const MAX_PAGES = 200;
const MAX_CANVAS_AREA = 15_000_000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const PREVIEW_LIMIT = 12;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function selectPages(value: string, total: number): number[] {
  const trimmed = value.trim();
  if (!trimmed) return Array.from({ length: total }, (_, i) => i + 1);
  const out: number[] = [];
  for (const segment of trimmed.split(",")) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(segment.trim());
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    for (let p = from; p <= to; p++) out.push(p);
  }
  return out;
}

function imageExt(url: string): "png" | "jpg" {
  return url.startsWith("data:image/jpeg") ? "jpg" : "png";
}

function friendlyRenderError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "PasswordException") {
    return "This PDF is password-protected — unlock it first with PDF Unlock, then convert the unlocked file.";
  }
  if (name === "InvalidPDFException") {
    return "That file doesn't look like a valid PDF.";
  }
  return err instanceof Error ? err.message : "Failed to render the PDF";
}

export default function PdfToImage() {
  const [pages, setPages] = useState<PageImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [range, setRange] = useState("");
  const [fileName, setFileName] = useState("");
  const [docPages, setDocPages] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [zipDone, setZipDone] = useState("");
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rangeId = useId();
  const formatId = useId();

  const markDirty = () => {
    setSettingsDirty(pages.length > 0);
    if (pages.length > 0) {
      setInfo("Settings changed — re-render to refresh the previews. The ZIP always uses your current settings.");
    }
  };

  const renderPageToCanvas = (
    page: PdfPage,
  ): { canvas: HTMLCanvasElement; viewport: PdfViewport; isReduced: boolean } => {
    const base = page.getViewport({ scale: 1 });
    const w = base.width * scale;
    const h = base.height * scale;
    let factor = scale;
    let isReduced = false;
    if (w * h > MAX_CANVAS_AREA) {
      factor = scale * Math.sqrt(MAX_CANVAS_AREA / (w * h));
      isReduced = true;
    }
    const viewport = page.getViewport({ scale: factor });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not set up the drawing surface.");
    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return { canvas, viewport, isReduced };
  };

  const convert = async (rangeValue: string, total: number) => {
    const data = bytesRef.current;
    if (!data || total < 1) return;
    const rangeCheck = pageRangeSyntaxError(rangeValue);
    if (rangeCheck) {
      setError(rangeCheck);
      return;
    }
    const targets = selectPages(rangeValue, total);
    if (!targets.length) {
      setError("This PDF has no pages to convert.");
      return;
    }
    if (targets.some((p) => p > total)) {
      setError(`Page numbers go up to ${total} — check your selection.`);
      return;
    }
    if (targets.length > MAX_PAGES) {
      setError(`This PDF has ${total} pages (limit ${MAX_PAGES} per run) — use PDF Split to divide it, or convert a page range.`);
      return;
    }
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setInfo("");
    setZipDone("");
    setProgress({ done: 0, total: targets.length });
    const pdfjs = await import("pdfjs-dist");
    ensurePdfjsWorker(pdfjs);
    let doc: PdfDocument | undefined;
    let task: PdfLoadingTask | undefined;
    try {
      task = pdfjs.getDocument({ data: data.slice(0) });
      doc = await task.promise;
      const rendered: PageImage[] = [];
      let reduced = 0;
      for (let i = 0; i < targets.length; i++) {
        if (runIdRef.current !== runId) return;
        const page = await doc.getPage(targets[i]);
        const { canvas, viewport, isReduced } = renderPageToCanvas(page);
        if (isReduced) reduced += 1;
        await page.render({ canvas, viewport }).promise;
        try {
          page.cleanup();
        } catch {
          /* noop */
        }
        if (rendered.length < PREVIEW_LIMIT) {
          rendered.push({
            page: targets[i],
            url: canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", 0.92),
            width: canvas.width,
            height: canvas.height,
          });
        }
        if (runIdRef.current !== runId) return;
        setProgress({ done: i + 1, total: targets.length });
      }
      if (runIdRef.current !== runId) return;
      setPages(rendered);
      setSettingsDirty(false);
      setInfo(
        reduced
          ? `Reduced the scale on ${reduced} page${reduced === 1 ? "" : "s"} to stay within the browser's canvas size limit.`
          : "",
      );
      setProgress(null);
      setBusy(false);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(friendlyRenderError(err));
      setProgress(null);
      setBusy(false);
    } finally {
      try {
        await task?.destroy();
      } catch {
        /* noop */
      }
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setError("");
    setInfo("");
    setZipDone("");
    if (file.size > MAX_FILE_BYTES) {
      setError("Files larger than 100 MB aren't supported here.");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const data = await file.arrayBuffer();
      bytesRef.current = data;
      const pdfjs = await import("pdfjs-dist");
      ensurePdfjsWorker(pdfjs);
      const task = pdfjs.getDocument({ data: data.slice(0) });
      const doc = await task.promise;
      const n = doc.numPages;
      try {
        await task.destroy();
      } catch {
        /* noop */
      }
      if (runIdRef.current !== runId) return;
      setFileName(file.name.replace(/\.pdf$/i, ""));
      setDocPages(n);
      setPages([]);
      setSettingsDirty(false);
      await convert(range, n);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(friendlyRenderError(err));
      setProgress(null);
      setBusy(false);
    }
  };

  const buildZip = async () => {
    const data = bytesRef.current;
    if (!data || docPages < 1) return;
    const rangeCheck = pageRangeSyntaxError(range);
    if (rangeCheck) {
      setError(rangeCheck);
      return;
    }
    const targets = selectPages(range, docPages);
    if (!targets.length) {
      setError("This PDF has no pages to convert.");
      return;
    }
    if (targets.some((p) => p > docPages)) {
      setError(`Page numbers go up to ${docPages} — check your selection.`);
      return;
    }
    if (targets.length > MAX_PAGES) {
      setError("Select up to 200 pages for a ZIP — use PDF Split for larger documents.");
      return;
    }
    const runId = ++runIdRef.current;
    setZipBusy(true);
    setError("");
    setZipDone("");
    setProgress({ done: 0, total: targets.length });
    const pdfjs = await import("pdfjs-dist");
    ensurePdfjsWorker(pdfjs);
    let doc: PdfDocument | undefined;
    let task: PdfLoadingTask | undefined;
    try {
      task = pdfjs.getDocument({ data: data.slice(0) });
      doc = await task.promise;
      const files: Record<string, Uint8Array> = {};
      for (let i = 0; i < targets.length; i++) {
        if (runIdRef.current !== runId) return;
        const page = await doc.getPage(targets[i]);
        const { canvas, viewport } = renderPageToCanvas(page);
        await page.render({ canvas, viewport }).promise;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, format === "jpeg" ? "image/jpeg" : "image/png", 0.92),
        );
        if (!blob) throw new Error("Could not encode the rendered image.");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        files[`${fileName || "page"}-page-${targets[i]}.${format === "jpeg" ? "jpg" : "png"}`] = bytes;
        try {
          page.cleanup();
        } catch {
          /* noop */
        }
        if (runIdRef.current !== runId) return;
        setProgress({ done: i + 1, total: targets.length });
      }
      if (runIdRef.current !== runId) return;
      const zipped = zipSync(files as unknown as Zippable, { level: 6 });
      downloadBlob(zipped, `${fileName || "pages"}-${targets.length}-pages.zip`, "application/zip");
      setZipDone(`${targets.length} page${targets.length === 1 ? "" : "s"} · ${formatBytes(zipped.length)} downloaded.`);
      setZipBusy(false);
      setProgress(null);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(friendlyRenderError(err));
      setZipBusy(false);
      setProgress(null);
    } finally {
      try {
        await task?.destroy();
      } catch {
        /* noop */
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };
  const onRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setRange(v);
    setError(pageRangeSyntaxError(v) ?? "");
    markDirty();
  };

  const count = pages.length ? selectPages(range, docPages).length : 0;

  return (
    <div className="space-y-5 w-full" aria-busy={busy || zipBusy}>
      <div className="flex flex-wrap items-end gap-4">
        <input
          ref={inputRef}
          id={formatId + "-file"}
          type="file"
          accept="application/pdf"
          className="hidden"
          aria-label="Choose a PDF file"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" disabled={busy || zipBusy} onClick={() => inputRef.current?.click()}>
          <FileDigit className="w-4 h-4 mr-1.5 inline" /> Choose PDF
        </Button>
        <div>
          <SliderField label="Output scale" min={1} max={4} step={0.5} value={scale} unit="×" onChange={(v) => { setScale(v); markDirty(); }} />
          <p className="text-[11px] text-slate-400">≈ {Math.round(scale * 72)} PPI at US-Letter size</p>
        </div>
        <div>
          <label htmlFor={formatId} className="text-xs font-medium text-slate-500">Format</label>
          <select
            id={formatId}
            value={format}
            disabled={busy || zipBusy}
            onChange={(e) => { setFormat(e.target.value as "png" | "jpeg"); markDirty(); }}
            className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
          >
            <option value="png">PNG (lossless)</option>
            <option value="jpeg">JPEG (smaller)</option>
          </select>
        </div>
        <div>
          <label htmlFor={rangeId} className="text-xs font-medium text-slate-500">Pages</label>
          <input
            id={rangeId}
            value={range}
            placeholder="e.g. 1-3,5 (all if empty)"
            disabled={busy || zipBusy}
            onChange={onRangeChange}
            className="mt-1 block w-44 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
          />
        </div>
        {pages.length > 0 && (
          <Button type="button" variant="secondary" disabled={zipBusy || busy} onClick={() => void buildZip()}>
            {zipBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5 inline" /> : <FileArchive className="w-4 h-4 mr-1.5 inline" />}
            {zipBusy ? "Zipping…" : "Download ZIP"}
          </Button>
        )}
        {settingsDirty && pages.length > 0 && (
          <Button type="button" variant="secondary" disabled={busy || zipBusy} onClick={() => void convert(range, docPages)}>
            <RefreshCw className="w-4 h-4 mr-1.5 inline" /> Re-render
          </Button>
        )}
      </div>

      {busy && progress && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Rendering page {progress.done} of {progress.total}
        </div>
      )}
      {zipBusy && progress && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Building ZIP — page {progress.done} of {progress.total}
        </div>
      )}
      {zipDone && !zipBusy && (
        <div role="status" className="text-sm text-emerald-700">{zipDone}</div>
      )}
      {info && !busy && !zipBusy && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{info}</div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {!busy && !zipBusy && pages.length === 0 && !error && (
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
          className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-600 cursor-pointer hover:border-slate-300 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          <p className="font-medium text-slate-700 mb-1">Drag and drop a PDF here, or click to browse</p>
          <p>Pages become PNG or JPEG images — choose a page range, adjust the scale, and download one page or a ZIP. 100% in your browser.</p>
          {docPages > 0 && <p className="mt-2 text-xs text-slate-500">{docPages} page{docPages === 1 ? "" : "s"} in {fileName}.pdf</p>}
        </div>
      )}

      {pages.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">
            Converted {Math.min(pages.length, count)} of {count} selected page{count === 1 ? "" : "s"}
            {pages.length < count && ` — the first ${pages.length} shown here; save any page or download the ZIP for all ${count}.`}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((p) => {
              const ext = imageExt(p.url);
              return (
                <div key={p.page} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="rounded-lg bg-slate-100 flex items-center justify-center mb-2 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Page ${p.page} preview`} className="max-h-56 w-auto" />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Page {p.page} · {p.width}×{p.height}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={`Save page ${p.page} as ${ext} image`}
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = p.url;
                        a.download = `${fileName || "page"}-page-${p.page}.${ext}`;
                        a.click();
                      }}
                    >
                      <Download className="w-3.5 h-3.5 mr-1 inline" /> Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}