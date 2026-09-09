"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  PenLine,
  Type,
  Square,
  Highlighter,
  Undo2,
  Redo2,
  Trash2,
  Download,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  Annotation,
  AnnotationKind,
  Point,
  createId,
  drawAnnotation,
  hitTestAnnotation,
  pointsToRect,
  toTopLeft,
} from "./annotations";
import { exportPdf, type PageDimensions } from "./export";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0f172a"];
const STROKE_WIDTHS = [
  { label: "S", value: 1.5 },
  { label: "M", value: 3 },
  { label: "L", value: 6 },
];
const FONT_SIZES = [10, 12, 16, 20, 28];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Tool = "select" | AnnotationKind;

export default function PdfEditor() {
  const [sourceName, setSourceName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [dimensions, setDimensions] = useState<PageDimensions[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1].value);
  const [fontSize, setFontSize] = useState(16);
  const [zoom, setZoom] = useState(1);

  const [annotationsByPage, setAnnotationsByPage] = useState<Record<number, Annotation[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Record<number, Annotation[][]>>({});
  const [redoStack, setRedoStack] = useState<Record<number, Annotation[][]>>({});
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState("");

  const [historyVersion, setHistoryVersion] = useState(0);
  const [displayScale, setDisplayScale] = useState(1);

  const docRef = useRef<{ doc: import("pdfjs-dist").PDFDocumentProxy; pdfjs: typeof import("pdfjs-dist"); data: ArrayBuffer } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const annCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<
    | { kind: "pen"; points: Point[] }
    | { kind: "rect"; start: Point; current: Point }
    | null
  >(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const dim = dimensions[active];

  const canUndo = (undoStack[active]?.length ?? 0) > 0;
  const canRedo = (redoStack[active]?.length ?? 0) > 0;

  const loadPdf = useCallback(async (file: File) => {
    setBusy(true);
    setError("");
    setMessage("");
    setSourceName("");
    setLoaded(false);
    setThumbs([]);
    setDimensions([]);
    setActive(0);
    setAnnotationsByPage({});
    setUndoStack({});
    setRedoStack({});
    setHistoryVersion((v) => v + 1);
    try {
      const data = await file.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;
      docRef.current = { doc, pdfjs, data };
      const dims: PageDimensions[] = [];
      const t: string[] = [];
      const scale = 0.32;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        dims.push({ width: base.width, height: base.height });
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvas, viewport: vp }).promise;
          t.push(canvas.toDataURL("image/jpeg", 0.75));
        }
        page.cleanup();
      }
      setDimensions(dims);
      setThumbs(t);
      setSourceName(file.name);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this PDF.");
      docRef.current = null;
    } finally {
      setBusy(false);
    }
  }, []);

  const push = useCallback(
    (pageIndex: number, next: Annotation[]) => {
      const current = annotationsByPage[pageIndex] ?? [];
      setAnnotationsByPage((m) => ({ ...m, [pageIndex]: next }));
      setUndoStack((s) => ({ ...s, [pageIndex]: [...(s[pageIndex] ?? []), current] }));
      setRedoStack((r) => ({ ...r, [pageIndex]: [] }));
      setHistoryVersion((v) => v + 1);
      setSelectedId(null);
    },
    [annotationsByPage]
  );

  const renderBase = useCallback(async () => {
    const r = docRef.current;
    const canvas = pageCanvasRef.current;
    if (!r || !canvas || !dim) return;
    const { doc } = r;
    const fit = (containerRef.current?.clientWidth ?? 700) / dim.width;
    const scale = Math.min(fit, 3) * zoom;
    setDisplayScale(scale);
    const dpr = window.devicePixelRatio || 1;
    const displayW = Math.floor(dim.width * scale);
    const displayH = Math.floor(dim.height * scale);
    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const page = await doc.getPage(active + 1);
    const vp = page.getViewport({ scale: scale * dpr });
    await page.render({ canvas, viewport: vp }).promise;
    page.cleanup();
  }, [active, dim, zoom]);

  const renderAnnotations = useCallback(() => {
    const canvas = annCanvasRef.current;
    if (!canvas || !dim) return;
    const scale = canvas.offsetWidth / dim.width;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    for (const ann of annotationsByPage[active] ?? []) drawAnnotation(ctx, ann);
  }, [active, dim, annotationsByPage]);

  useEffect(() => {
    void renderBase().then(renderAnnotations);
  }, [renderBase, renderAnnotations, historyVersion]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      void renderBase().then(renderAnnotations);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderBase, renderAnnotations]);

  const pageRect = useCallback(() => {
    const canvas = annCanvasRef.current;
    if (!canvas || !dim) return null;
    const r = canvas.getBoundingClientRect();
    return {
      width: dim.width,
      height: dim.height,
      toPage: (clientX: number, clientY: number): Point => ({
        x: ((clientX - r.left) / r.width) * dim.width,
        y: ((clientY - r.top) / r.height) * dim.height,
      }),
    };
  }, [dim]);

  const redrawWithPendingRect = useCallback(() => {
    const canvas = annCanvasRef.current;
    const dims = dimensions[active];
    if (!canvas || !dims) return;
    const d = drawingRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = canvas.offsetWidth / dims.width;
    const dpr = window.devicePixelRatio || 1;
    const pending: Annotation[] = [...(annotationsByPage[active] ?? [])];
    if (d?.kind === "rect") {
      const rect = pointsToRect(d.start, d.current);
      pending.push({
        id: "pending",
        kind: tool === "highlight" ? "highlight" : "rect",
        color,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        lineWidth: strokeWidth,
      });
    }
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    for (const ann of pending) drawAnnotation(ctx, ann);
  }, [active, dimensions, color, strokeWidth, tool, annotationsByPage]);

  const commitText = useCallback(() => {
    const text = draftText.trimEnd();
    const p = draft;
    if (!p || !text) {
      setDraft(null);
      return;
    }
    const ann: Annotation = {
      id: createId(),
      kind: "text",
      color,
      x: p.x,
      y: p.y,
      text: text.split("\n").map((l) => l.trimEnd()).join("\n"),
      fontSize,
    };
    const existing = annotationsByPage[active] ?? [];
    const ctx = annCanvasRef.current?.getContext("2d") ?? null;
    const next = ctx ? toTopLeft(ann, ctx) : ann;
    push(active, [...existing, next]);
    setDraft(null);
    setDraftText("");
  }, [active, color, draft, draftText, fontSize, push, annotationsByPage]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pr = pageRect();
      if (!pr) return;
      const pt = pr.toPage(e.clientX, e.clientY);
      const canvas = annCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      if (tool === "text") {
        commitText();
        setDraft(pt);
        setSelectedId(null);
        return;
      }

      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);

      if (tool === "select") {
        const pageAnnotations = annotationsByPage[active] ?? [];
        const idx = [...pageAnnotations].reverse().findIndex((ann) => hitTestAnnotation(ann, pt, ctx));
        const realIdx = idx === -1 ? -1 : pageAnnotations.length - 1 - idx;
        setSelectedId(realIdx === -1 ? null : pageAnnotations[realIdx].id);
        return;
      }

      const dprScale = canvas.offsetWidth / pr.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.setTransform(dprScale * (window.devicePixelRatio || 1), 0, 0, dprScale * (window.devicePixelRatio || 1), 0, 0);

      if (tool === "pen") {
        drawingRef.current = { kind: "pen", points: [pt] };
        drawPoint(ctx, pt, color, strokeWidth);
      } else {
        drawingRef.current = { kind: "rect", start: pt, current: pt };
        redrawWithPendingRect();
      }
    },
    [pageRect, tool, color, strokeWidth, commitText, redrawWithPendingRect, active, annotationsByPage]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const d = drawingRef.current;
      const pr = pageRect();
      const canvas = annCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !d || !pr || !ctx) return;
      const pt = pr.toPage(e.clientX, e.clientY);

      if (d.kind === "pen") {
        const last = d.points[d.points.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1) return;
        d.points.push(pt);
        const dprScale = canvas.offsetWidth / pr.width;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.setTransform(dprScale * (window.devicePixelRatio || 1), 0, 0, dprScale * (window.devicePixelRatio || 1), 0, 0);
        drawSegment(ctx, last, pt, color, strokeWidth);
      } else {
        d.current = pt;
        redrawWithPendingRect();
      }
    },
    [pageRect, color, strokeWidth, redrawWithPendingRect]
  );

  const onPointerUp = useCallback(() => {
    const d = drawingRef.current;
    if (!d) return;
    const canvas = annCanvasRef.current;
    const activePage = active;
    const existing = annotationsByPage[activePage] ?? [];
    const ctx = canvas?.getContext("2d");
    if (ctx && d.kind === "pen" && d.points.length > 1) {
      const ann: Annotation = {
        id: createId(),
        kind: "pen",
        color,
        points: d.points,
        lineWidth: strokeWidth,
      };
      push(activePage, [...existing, ann]);
    } else if (ctx && d.kind === "rect") {
      const rect = pointsToRect(d.start, d.current);
      if (rect.width > 1 || rect.height > 1) {
        const kind = tool === "highlight" ? "highlight" : "rect";
        const ann: Annotation = { id: createId(), kind, color, ...rect, lineWidth: strokeWidth };
        push(activePage, [...existing, ann]);
      }
    }
    drawingRef.current = null;
    renderAnnotations();
  }, [active, color, strokeWidth, tool, push, renderAnnotations, annotationsByPage]);

  const undoCb = useCallback(() => {
    const past = undoStack[active];
    if (!past || past.length === 0) return;
    const current = annotationsByPage[active] ?? [];
    const prev = past[past.length - 1];
    setAnnotationsByPage((m) => ({ ...m, [active]: prev }));
    setUndoStack((s) => ({ ...s, [active]: past.slice(0, -1) }));
    setRedoStack((r) => ({ ...r, [active]: [...(r[active] ?? []), current] }));
    setHistoryVersion((v) => v + 1);
    setSelectedId(null);
  }, [active, undoStack, annotationsByPage]);

  const redoCb = useCallback(() => {
    const future = redoStack[active];
    if (!future || future.length === 0) return;
    const current = annotationsByPage[active] ?? [];
    const next = future[future.length - 1];
    setAnnotationsByPage((m) => ({ ...m, [active]: next }));
    setRedoStack((r) => ({ ...r, [active]: future.slice(0, -1) }));
    setUndoStack((s) => ({ ...s, [active]: [...(s[active] ?? []), current] }));
    setHistoryVersion((v) => v + 1);
    setSelectedId(null);
  }, [active, redoStack, annotationsByPage]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const next = annotationsByPage[active] ?? [];
    push(
      active,
      next.filter((a) => a.id !== selectedId)
    );
  }, [active, selectedId, push, annotationsByPage]);

  const save = useCallback(async () => {
    const r = docRef.current;
    if (!r) return;
    setExporting(true);
    setError("");
    setMessage("");
    try {
      const bytes = await exportPdf(r.data, annotationsByPage, dimensions.length);
      const base = sourceName.replace(/\.pdf$/i, "") || "document";
      downloadBlob(bytes, `${base}-edited.pdf`);
      setMessage("Edited PDF downloaded — annotations are flattened into it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [sourceName, dimensions.length, annotationsByPage]);

  const toolButtons: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "select", label: "Select", icon: <MousePointer2 className="w-4 h-4" /> },
    { id: "pen", label: "Draw", icon: <PenLine className="w-4 h-4" /> },
    { id: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
    { id: "rect", label: "Box", icon: <Square className="w-4 h-4" /> },
    { id: "highlight", label: "Highlight", icon: <Highlighter className="w-4 h-4" /> },
  ];

  if (!loaded) {
    return (
      <div className="w-full">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void loadPdf(e.target.files?.[0] as File)}
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop your PDF here or click to browse for a PDF file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className="rounded-3xl border-2 border-dashed p-10 sm:p-16 text-center transition-all duration-200 cursor-pointer border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/30"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Drop your PDF here</h2>
            <p className="text-sm text-slate-500">or click to browse — free, no sign-up, nothing uploaded</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <Lock className="w-3.5 h-3.5" />
              Annotate text, draw, highlight and save — all on your device.
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        {busy && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Reading PDF…
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void loadPdf(e.target.files?.[0] as File)}
      />

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy || exporting}>
          <FileText className="w-4 h-4" />
          Open
        </Button>
        <span className="text-sm text-slate-500 min-w-0 truncate flex-1">
          {sourceName}
        </span>
        <Button type="button" onClick={() => void save()} disabled={busy || exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Saving…" : "Save PDF"}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1">
          {toolButtons.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tool === t.id}
              onClick={() => {
                setTool(t.id);
                setSelectedId(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tool === t.id
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition ${color === c ? "border-slate-900 scale-110" : "border-white shadow"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
            aria-label="Custom color"
          />
        </div>

        <div className="w-px h-6 bg-slate-200" />

        {(tool === "pen" || tool === "rect") && (
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-label={`Stroke width ${s.label}`}
                onClick={() => setStrokeWidth(s.value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  strokeWidth === s.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {tool === "text" && (
          <div className="flex items-center gap-1">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Font size ${s}`}
                onClick={() => setFontSize(s)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  fontSize === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="w-px h-6 bg-slate-200" />

        <button
          type="button"
          onClick={undoCb}
          disabled={!canUndo}
          aria-label="Undo"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={redoCb}
          disabled={!canRedo}
          aria-label="Redo"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedId}
          aria-label="Delete selection"
          className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Viewer */}
      <div ref={containerRef} className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button
            type="button"
            onClick={() => {
              setActive((p) => Math.max(0, p - 1));
              setSelectedId(null);
              setDraft(null);
            }}
            disabled={active === 0}
            aria-label="Previous page"
            className="rounded-lg p-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="tabular-nums">
            Page {active + 1} of {dimensions.length}
          </span>
          <button
            type="button"
            onClick={() => {
              setActive((p) => Math.min(dimensions.length - 1, p + 1));
              setSelectedId(null);
              setDraft(null);
            }}
            disabled={active === dimensions.length - 1}
            aria-label="Next page"
            className="rounded-lg p-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <button
            type="button"
            onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])}
            aria-label="Zoom out"
            className="rounded-lg p-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])}
            aria-label="Zoom in"
            className="rounded-lg p-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div
          className="relative bg-slate-200/60 rounded-md max-w-full overflow-hidden"
          style={{ boxShadow: "0 12px 32px -8px rgb(15 23 42 / 0.25)" }}
        >
          <canvas ref={pageCanvasRef} className="block max-w-full h-auto" />
          <canvas
            ref={annCanvasRef}
            className="absolute inset-0 touch-none"
            style={{ width: "100%", height: "100%", cursor: tool === "select" ? "default" : "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
          {draft && (
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitText();
                if (e.key === "Escape") {
                  setDraft(null);
                  setDraftText("");
                }
              }}
              placeholder="Type here…"
              className="absolute border-2 border-indigo-500 bg-white/95 p-1 focus:outline-none"
              style={{
                left: draft.x * displayScale,
                top: draft.y * displayScale,
                fontSize: `${fontSize * displayScale}px`,
                fontFamily: "Arial, Helvetica, sans-serif",
                color,
                minWidth: 120,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {thumbs.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setActive(i);
              setSelectedId(null);
              setDraft(null);
            }}
            aria-label={`Go to page ${i + 1}`}
            className={`rounded-lg border-2 overflow-hidden shrink-0 transition ${active === i ? "border-indigo-500" : "border-transparent hover:border-slate-300"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t}
              alt={`Page ${i + 1} preview`}
              className="w-16 h-auto object-cover bg-slate-100"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">{error}</div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message}</div>
      )}
    </div>
  );
}

function drawPoint(ctx: CanvasRenderingContext2D, p: Point, color: string, width: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSegment(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}