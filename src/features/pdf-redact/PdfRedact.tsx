"use client";

import { useId, useRef, useState } from "react";
import { Eraser, FileText, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  renderPdfPages,
  ensurePdfjsWorker,
} from "@/features/pdf-office/support";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const RENDER_SCALE = 1.5;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };

interface Region {
  id: number;
  fx: number;
  fy: number;
  fw: number;
  fh: number;
}

interface PageView {
  index: number;
  url: string;
  width: number;
  height: number;
}

interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfViewportLike {
  width: number;
  height: number;
  convertToPdfPoint(x: number, y: number): number[];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function rectFromFractions(r: Region, vp: PdfViewportLike): PdfRect {
  const x0 = r.fx * vp.width;
  const y0 = r.fy * vp.height;
  const x1 = (r.fx + r.fw) * vp.width;
  const y1 = (r.fy + r.fh) * vp.height;
  const u0 = vp.convertToPdfPoint(x0, y0);
  const u1 = vp.convertToPdfPoint(x1, y1);
  return {
    x: Math.min(u0[0], u1[0]),
    y: Math.min(u0[1], u1[1]),
    width: Math.abs(u1[0] - u0[0]),
    height: Math.abs(u1[1] - u0[1]),
  };
}

function friendlyError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/encrypted|password/i.test(m)) {
    return "This PDF is already password-protected. If you know its password, remove it with Unlock PDF first.";
  }
  if (/Failed to parse|No PDF header|Invalid PDF structure/i.test(m)) {
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  }
  return "Could not read that PDF. It may be corrupt or unsupported.";
}

function userFacing(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing)
    return err.message;
  return friendlyError(err);
}

export default function PdfRedact() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageView[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [regions, setRegions] = useState<Map<number, Region[]>>(new Map());
  const [draft, setDraft] = useState<Region | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [numPage, setNumPage] = useState("1");
  const [numX, setNumX] = useState("");
  const [numY, setNumY] = useState("");
  const [numW, setNumW] = useState("");
  const [numH, setNumH] = useState("");

  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const regionIdRef = useRef(1);

  const openBtnId = useId();
  const pageInputId = useId();
  const xInputId = useId();
  const yInputId = useId();
  const wInputId = useId();
  const hInputId = useId();

  const totalRegions = Array.from(regions.values()).reduce(
    (m, list) => m + list.length,
    0,
  );

  const resetState = () => {
    setBytes(null);
    setName("");
    setPages([]);
    setActivePage(1);
    setRegions(new Map());
    setDraft(null);
    setDragging(false);
    dragStartRef.current = null;
    setMessage("");
    setNumPage("1");
    setNumX("");
    setNumY("");
    setNumW("");
    setNumH("");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const run = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          "That file is larger than 100 MB, which this tool doesn't support. Split it with PDF Split first.",
        );
      }
      const data = await file.arrayBuffer();
      if (run !== runIdRef.current) return;
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(new Uint8Array(data));
      if (run !== runIdRef.current) return;
      if (doc.getPageCount() > MAX_PAGES) {
        throw userFacing(
          "That document has more than 200 pages. Split it with PDF Split first.",
        );
      }
      if (run !== runIdRef.current) return;
      const views = await renderPdfPages(data, RENDER_SCALE);
      if (run !== runIdRef.current) return;
      setName(file.name);
      setBytes(new Uint8Array(data));
      setPages(views.map((v, i) => ({ index: i + 1, ...v })));
      setActivePage(1);
      setRegions(new Map());
      setMessage(
        `Loaded ${views.length} page${views.length === 1 ? "" : "s"}. Draw or enter redaction regions, then export.`,
      );
    } catch (err) {
      if (run !== runIdRef.current) return;
      resetState();
      setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) setBusy(false);
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    void handleFile(file);
  };

  const activeView = pages.find((p) => p.index === activePage);
  const activeRegions = regions.get(activePage) ?? [];
  const dispW = activeView ? activeView.width / RENDER_SCALE : 0;
  const dispH = activeView ? activeView.height / RENDER_SCALE : 0;

  const pointerFrac = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = previewRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  };

  const commitRegion = (page: number, fracs: { fx: number; fy: number; fw: number; fh: number }) => {
    setRegions((prev) => {
      const next = new Map(prev);
      next.set(page, [
        ...(next.get(page) ?? []),
        { ...fracs, id: regionIdRef.current++ },
      ]);
      return next;
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    const pos = pointerFrac(e);
    if (!pos) return;
    dragStartRef.current = pos;
    setDragging(true);
    setDraft(null);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const pos = pointerFrac(e);
    if (!pos) return;
    const s = dragStartRef.current;
    setDraft({
      id: 0,
      fx: Math.min(s.x, pos.x),
      fy: Math.min(s.y, pos.y),
      fw: Math.abs(pos.x - s.x),
      fh: Math.abs(pos.y - s.y),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draft;
    dragStartRef.current = null;
    setDragging(false);
    setDraft(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (d && d.fw > 0.004 && d.fh > 0.004) {
      commitRegion(activePage, { fx: d.fx, fy: d.fy, fw: d.fw, fh: d.fh });
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = null;
    setDragging(false);
    setDraft(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const addByNumbers = () => {
    if (!activeView) return;
    const p = Number(numPage);
    if (!Number.isInteger(p) || p < 1 || p > pages.length) {
      setError(`Enter a page number from 1 to ${pages.length}.`);
      return;
    }
    const x = Number(numX);
    const y = Number(numY);
    const w = Number(numW);
    const h = Number(numH);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
      setError(
        "X and Y must be 0 or positive numbers, measured in points from the top-left corner of the page.",
      );
      return;
    }
    if (!(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0)) {
      setError("Width and height must be numbers greater than zero (in points).");
      return;
    }
    const view = pages.find((v) => v.index === p);
    if (!view) return;
    const dW = view.width / RENDER_SCALE;
    const dH = view.height / RENDER_SCALE;
    if (x + w > dW + 0.75 || y + h > dH + 0.75) {
      setError(
        "That rectangle sticks off the page — make X+width or Y+height smaller.",
      );
      return;
    }
    commitRegion(p, {
      fx: x / dW,
      fy: y / dH,
      fw: w / dW,
      fh: h / dH,
    });
    if (p !== activePage) setActivePage(p);
    setNumX("");
    setNumY("");
    setNumW("");
    setNumH("");
  };

  const removeRegion = (page: number, id: number) => {
    setRegions((prev) => {
      const next = new Map(prev);
      const list = (next.get(page) ?? []).filter((r) => r.id !== id);
      if (list.length) next.set(page, list);
      else next.delete(page);
      return next;
    });
  };

  const clearPage = (page: number) => {
    setRegions((prev) => {
      const next = new Map(prev);
      next.delete(page);
      return next;
    });
  };

  const exportedPageRects = async (): Promise<Map<number, PdfRect[]>> => {
    const pdfjs = await import("pdfjs-dist");
    ensurePdfjsWorker(pdfjs);
    const out = new Map<number, PdfRect[]>();
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    try {
      task = pdfjs.getDocument({ data: bytes!.slice(0) });
      const doc = await task.promise;
      for (let p = 1; p <= doc.numPages; p++) {
        const list = regions.get(p);
        if (!list || list.length === 0) continue;
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        out.set(
          p,
          list.map((r) => rectFromFractions(r, vp)),
        );
      }
      return out;
    } finally {
      if (task) {
        try {
          await task.destroy();
        } catch {
          /* noop */
        }
      }
    }
  };

  const applyRedactions = async () => {
    if (!bytes || busy) return;
    const run = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const rectsByPage = await exportedPageRects();
      if (run !== runIdRef.current) return;
      const { PDFDocument, rgb } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes);
      if (run !== runIdRef.current) return;
      for (const [p, rects] of rectsByPage) {
        const page = doc.getPage(p - 1);
        for (const rect of rects) {
          page.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: rgb(0, 0, 0),
          });
        }
      }
      const saved = await doc.save(SAVE_OPTS);
      if (run !== runIdRef.current) return;
      const filename = `${name.replace(/\.pdf$/i, "")}-redacted.pdf`;
      downloadBlob(saved, filename);
      const touchedPages = rectsByPage.size;
      const total = totalRegions;
      setMessage(
        `Drew ${total} redaction box${total === 1 ? "" : "es"} on ${touchedPages} page${touchedPages === 1 ? "" : "s"} — downloaded ${filename}.`,
      );
    } catch (err) {
      if (run !== runIdRef.current) return;
      setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) setBusy(false);
    }
  };

  const regionPoints = (r: Region) => ({
    x: r.fx * dispW,
    y: r.fy * dispH,
    w: r.fw * dispW,
    h: r.fh * dispH,
  });

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        id={openBtnId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Choose a PDF to redact"
        onChange={(e) => void handlePicker(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? "Working on the PDF…" : ""}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={openBtnId}
          className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 inline-flex items-center gap-2 ${
            busy
              ? "opacity-60 pointer-events-none"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 cursor-pointer"
          }`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="w-4 h-4" aria-hidden="true" />
          )}
          {name ? "Choose another PDF" : "Open PDF"}
        </label>
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name} — ${pages.length} page${pages.length === 1 ? "" : "s"}`
            : "Black out names, numbers and private lines in a PDF. Region editing supports up to 200 pages and 100 MB — nothing is uploaded."}
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

      {bytes && pages.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {pages.map((p) => (
              <button
                key={p.index}
                type="button"
                aria-label={`Edit page ${p.index}${regions.has(p.index) ? `, ${regions.get(p.index)!.length} redaction region${regions.get(p.index)!.length === 1 ? "" : "s"}` : ", no redactions"}`}
                aria-pressed={p.index === activePage}
                onClick={() => {
                  setActivePage(p.index);
                  setDraft(null);
                  dragStartRef.current = null;
                }}
                className={`relative rounded-xl border-2 overflow-hidden transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  p.index === activePage
                    ? "border-indigo-500 ring-2 ring-indigo-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  aria-hidden="true"
                  className="w-full aspect-[3/4] object-cover bg-slate-100"
                  loading="lazy"
                />
                <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold shadow bg-white/90 text-slate-700">
                  {p.index}
                </span>
                {regions.has(p.index) && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow bg-red-500 text-white">
                    {regions.get(p.index)!.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4 items-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-medium text-slate-800">
                  Page {activePage} — redaction regions
                </p>
                <p className="text-xs text-slate-500" role="status">
                  {activeRegions.length === 0
                    ? "No regions on this page yet."
                    : `${activeRegions.length} region${activeRegions.length === 1 ? "" : "s"} on this page.`}
                </p>
              </div>
              {activeView ? (
                <div
                  ref={previewRef}
                  role="img"
                  aria-label={`Page ${activePage} preview — drag to draw a black redaction rectangle, or use the number fields below.`}
                  className="relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden mx-auto select-none touch-none cursor-crosshair"
                  style={{ maxWidth: 640, aspectRatio: `${dispW} / ${dispH}` }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeView.url}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                  {activeRegions.map((r) => (
                    <div
                      key={r.id}
                      aria-hidden="true"
                      className="absolute bg-black border-2 border-red-500/70"
                      style={{
                        left: `${r.fx * 100}%`,
                        top: `${r.fy * 100}%`,
                        width: `${r.fw * 100}%`,
                        height: `${r.fh * 100}%`,
                      }}
                    />
                  ))}
                  {draft && (
                    <div
                      aria-hidden="true"
                      className="absolute bg-black/50 border-2 border-dashed border-white"
                      style={{
                        left: `${draft.fx * 100}%`,
                        top: `${draft.fy * 100}%`,
                        width: `${draft.fw * 100}%`,
                        height: `${draft.fh * 100}%`,
                      }}
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Could not render page {activePage}.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Drag on the page to draw a black region, or add one by exact
                numbers below. Redaction burns a solid black rectangle over the
                content — it is not an overlay a reader can click away.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 sticky top-20">
              <fieldset className="space-y-2.5" disabled={busy}>
                <legend className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Redactions on page {activePage}
                </legend>
                {activeRegions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No regions yet.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {activeRegions.map((r, i) => {
                      const pt = regionPoints(r);
                      return (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 text-xs text-slate-600 rounded-lg bg-slate-50 px-2 py-1.5"
                        >
                          <span>
                            Region {i + 1}: x {Math.round(pt.x)}, y{" "}
                            {Math.round(pt.y)}, w {Math.round(pt.w)}, h{" "}
                            {Math.round(pt.h)} pt
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove region ${i + 1} from page ${activePage}`}
                            onClick={() => removeRegion(activePage, r.id)}
                            className="text-red-500 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {activeRegions.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => clearPage(activePage)}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                    Clear this page
                  </Button>
                )}
              </fieldset>

              <fieldset className="space-y-2.5" disabled={busy}>
                <legend className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Add a region by numbers
                </legend>
                <div className="grid grid-cols-5 gap-2">
                  <label
                    htmlFor={pageInputId}
                    className="block text-[11px] font-medium text-slate-500 col-span-1"
                  >
                    Page
                  </label>
                  <label
                    htmlFor={xInputId}
                    className="block text-[11px] font-medium text-slate-500 col-span-1"
                  >
                    X
                  </label>
                  <label
                    htmlFor={yInputId}
                    className="block text-[11px] font-medium text-slate-500 col-span-1"
                  >
                    Y
                  </label>
                  <label
                    htmlFor={wInputId}
                    className="block text-[11px] font-medium text-slate-500 col-span-1"
                  >
                    W
                  </label>
                  <label
                    htmlFor={hInputId}
                    className="block text-[11px] font-medium text-slate-500 col-span-1"
                  >
                    H
                  </label>
                  <input
                    id={pageInputId}
                    type="number"
                    min={1}
                    max={pages.length}
                    step={1}
                    value={numPage}
                    onChange={(e) => setNumPage(e.target.value)}
                    className="col-span-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  <input
                    id={xInputId}
                    type="number"
                    min={0}
                    step={0.1}
                    value={numX}
                    onChange={(e) => setNumX(e.target.value)}
                    placeholder="0"
                    className="col-span-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  <input
                    id={yInputId}
                    type="number"
                    min={0}
                    step={0.1}
                    value={numY}
                    onChange={(e) => setNumY(e.target.value)}
                    placeholder="0"
                    className="col-span-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  <input
                    id={wInputId}
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={numW}
                    onChange={(e) => setNumW(e.target.value)}
                    placeholder="W"
                    className="col-span-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  <input
                    id={hInputId}
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={numH}
                    onChange={(e) => setNumH(e.target.value)}
                    placeholder="H"
                    className="col-span-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  X and Y are measured in PDF points from the top-left corner of
                  the page; W and H are the width and height in points.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={addByNumbers}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                  Add region
                </Button>
              </fieldset>

              <Button
                type="button"
                disabled={busy || totalRegions === 0}
                onClick={() => void applyRedactions()}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
                ) : (
                  <Eraser className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
                )}
                {busy
                  ? "Redacting…"
                  : `Redact ${totalRegions} region${totalRegions === 1 ? "" : "s"} → PDF`}
              </Button>
              <p className="text-xs text-slate-500">
                {totalRegions === 0
                  ? "Add at least one region to enable export."
                  : "Redaction burns black into the page: the covered text can no longer be seen or copied, but text stored outside the boxes — metadata, form values, or hidden layers elsewhere on the page — is not removed. Redaction is permanent in practice, not a forensic guarantee; open the result in a reader and re-check before sharing. For up to 200 pages and 100 MB."}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}