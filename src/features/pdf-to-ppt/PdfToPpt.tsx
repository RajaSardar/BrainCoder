"use client";

import { useRef, useState, useId } from "react";
import { Download, Loader2, Presentation, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, SliderField } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  ensurePdfjsWorker,
  pageRangeSyntaxError,
  renderPptSlides,
  buildPptx,
  type PptSlide,
} from "@/features/pdf-office/support";

const MAX_PAGES = 200;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

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

export default function PdfToPpt() {
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [downloaded, setDownloaded] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [scale, setScale] = useState(2);
  const [range, setRange] = useState("");
  const [baseName, setBaseName] = useState("");
  const [docPages, setDocPages] = useState(0);
  const [slides, setSlides] = useState<PptSlide[]>([]);
  const [previews, setPreviews] = useState<Array<{ page: number; url: string }>>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rangeId = useId();

  const markDirty = () => {
    setSettingsDirty(slides.length > 0 || previews.length > 0);
  };

  const render = async (
    rangeValue: string,
    scaleValue: number,
    totalValue = docPages,
  ): Promise<PptSlide[] | null> => {
    const data = bytesRef.current;
    if (!data || totalValue < 1) return null;
    const rangeCheck = pageRangeSyntaxError(rangeValue);
    if (rangeCheck) {
      setError(rangeCheck);
      return null;
    }
    const targets = selectPages(rangeValue, totalValue);
    if (!targets.length) {
      setError("This PDF has no pages to convert.");
      return null;
    }
    if (targets.some((p) => p > totalValue)) {
      setError(`Page numbers go up to ${totalValue} — check your selection.`);
      return null;
    }
    if (targets.length > MAX_PAGES) {
      setError(`This PDF has ${totalValue} pages (limit ${MAX_PAGES} per run) — use PDF Split to divide it, or convert a page range.`);
      return null;
    }
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setInfo("");
    setDownloaded("");
    setProgress({ done: 0, total: targets.length });
    try {
      const result = await renderPptSlides(data, {
        scale: scaleValue,
        targets,
        onPage: (done, total) => setProgress({ done, total }),
      });
      if (runIdRef.current !== runId) return null;
      setSlides(result.slides);
      setPreviews(result.previews);
      setSettingsDirty(false);
      setInfo(
        result.reduced
          ? `Reduced the image scale on ${result.reduced} page${result.reduced === 1 ? "" : "s"} to stay within the browser's canvas limits.`
          : "",
      );
      setProgress(null);
      setBusy(false);
      return result.slides;
    } catch (err) {
      if (runIdRef.current !== runId) return null;
      setError(friendlyRenderError(err));
      setProgress(null);
      setBusy(false);
      return null;
    }
  };

  const download = async () => {
    const pages = bytesRef.current && settingsDirty ? await render(range, scale) : slides;
    const current = Array.isArray(pages) && pages.length ? pages : slides;
    if (!current.length) return;
    const runId = ++runIdRef.current;
    setZipBusy(true);
    setError("");
    setDownloaded("");
    try {
      const pptx = buildPptx(current);
      if (runIdRef.current !== runId) return;
      const name = `${baseName || "slides"}.pptx`;
      downloadBlob(pptx, name, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      setDownloaded(`Downloaded ${name} — ${current.length} slide${current.length === 1 ? "" : "s"}, ${formatBytes(pptx.length)}.`);
      setZipBusy(false);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(err instanceof Error ? err.message : "Failed to build the .pptx");
      setZipBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setError("");
    setInfo("");
    setDownloaded("");
    if (file.size > MAX_FILE_BYTES) {
      setError("Files larger than 100 MB aren't supported here.");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const data = await file.arrayBuffer();
      if (runIdRef.current !== runId) return;
      bytesRef.current = data.slice(0);
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
      setBaseName(file.name.replace(/\.pdf$/i, ""));
      setDocPages(n);
      setSlides([]);
      setPreviews([]);
      setSettingsDirty(false);
      setBusy(false);
      setProgress(null);
      await render(range, scale, n);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(friendlyRenderError(err));
      setProgress(null);
      setBusy(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };
  const openPicker = () => inputRef.current?.click();

  return (
    <div className="space-y-5 w-full" aria-busy={busy || zipBusy}>
      <div className="flex flex-wrap items-end gap-4">
        <input
          ref={inputRef}
          id={rangeId + "-file"}
          type="file"
          accept="application/pdf"
          className="hidden"
          aria-label="Choose a PDF file"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" disabled={busy || zipBusy} onClick={openPicker}>
          <Presentation className="w-4 h-4 mr-1.5 inline" /> Choose PDF
        </Button>
        <div>
          <SliderField label="Slide image quality" min={1} max={3} step={0.5} value={scale} unit="×" onChange={(v) => { setScale(v); markDirty(); }} />
          <p className="text-[11px] text-slate-500">Higher = sharper but larger slides and slower rendering</p>
        </div>
        <div>
          <label htmlFor={rangeId} className="text-xs font-medium text-slate-500">Pages</label>
          <input
            id={rangeId}
            value={range}
            placeholder="e.g. 1-3,5 (all if empty)"
            disabled={busy || zipBusy}
            onChange={(e) => {
              setRange(e.target.value);
              setError(pageRangeSyntaxError(e.target.value) ?? "");
              markDirty();
            }}
            className="mt-1 block w-44 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-60"
          />
        </div>
        {slides.length > 0 && (
          <Button type="button" disabled={zipBusy || busy} onClick={() => void download()}>
            {zipBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5 inline" /> : <Download className="w-4 h-4 mr-1.5 inline" />}
            {zipBusy ? "Building…" : "Download .pptx"}
          </Button>
        )}
        {settingsDirty && slides.length > 0 && (
          <Button type="button" variant="secondary" disabled={busy || zipBusy} onClick={() => void render(range, scale)}>
            <RefreshCw className="w-4 h-4 mr-1.5 inline" /> Re-render
          </Button>
        )}
      </div>

      {busy && progress && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Rendering slide {progress.done} of {progress.total}
        </div>
      )}
      {zipBusy && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Building the .pptx…
        </div>
      )}
      {downloaded && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span>{downloaded} Your file never left this device — the slides are pictures, so the text isn&apos;t editable.</span>
        </div>
      )}
      {info && !busy && !zipBusy && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{info}</div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {!busy && !zipBusy && slides.length === 0 && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a PDF by clicking or dropping it here"
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-600 cursor-pointer hover:border-slate-300 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500"
        >
          <p className="font-medium text-slate-700 mb-1">Drag and drop a PDF here, or click to browse</p>
          <p>Every page becomes a full-slide image in a 16:9 PowerPoint — the slides are pictures, so text isn&apos;t editable. 100% in your browser.</p>
          {docPages > 0 && <p className="mt-2 text-xs text-slate-500">{docPages} page{docPages === 1 ? "" : "s"} in {baseName}.pdf</p>}
        </div>
      )}

      {slides.length > 0 && (
        <div>
          <p className="text-xs text-slate-600 mb-2">
            {slides.length} slide{slides.length === 1 ? "" : "s"} ready
            {docPages > 0 && slides.length < selectPages(range, docPages).length && ` — showing the first ${previews.length} previews`}
            {" · "}16:9 ·{" "}
            <span className="text-slate-500">slides are snapshot images — text inside them isn&apos;t editable</span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {previews.map((p) => (
              <div
                key={p.page}
                className="rounded-lg border border-slate-200 bg-white p-1.5 aspect-video flex items-center justify-center overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Slide ${p.page} preview`}
                  loading="lazy"
                  width={p.url.length > 0 ? 320 : undefined}
                  height={320}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}