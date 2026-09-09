"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MousePointer2,
  PenLine,
  Type,
  Square,
  Highlighter,
  ArrowUpRight,
  ArrowLeft,
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
  drawAnnotations,
  getAnnotationBBox,
  hitTestAnnotation,
  pointsToRect,
  resizeRect,
  toTopLeft,
  translateAnnotation,
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [historyVersion, setHistoryVersion] = useState(0);
  const [displayScale, setDisplayScale] = useState(1);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const docRef = useRef<{ doc: import("pdfjs-dist").PDFDocumentProxy; pdfjs: typeof import("pdfjs-dist"); data: ArrayBuffer } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const annCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTask = useRef<{ cancel: () => void } | null>(null);
  const renderGen = useRef(0);
  const annotationsRef = useRef<Record<number, Annotation[]>>({});
  const drawingRef = useRef<
    | { kind: "pen"; points: Point[] }
    | { kind: "rect" | "arrow"; start: Point; current: Point }
    | null
  >(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    id: string;
    base: Annotation;
    current: Annotation;
    start: Point;
    handle: number;
    moved: boolean;
  } | null>(null);
  const editingIdRef = useRef<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const dim = dimensions[active];

  const canUndo = (undoStack[active]?.length ?? 0) > 0;
  const canRedo = (redoStack[active]?.length ?? 0) > 0;

  const loadPdf = useCallback(async (file: File) => {
    setBusy(true);
    if (renderTask.current) {
      try {
        renderTask.current.cancel();
      } catch {
        // ignore
      }
      renderTask.current = null;
    }
    renderGen.current++;
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
    setProgress(0);
    try {
      const data = await file.arrayBuffer();
      const exportData = data.slice(0);
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;
      docRef.current = { doc, pdfjs, data: exportData };
      const dims: PageDimensions[] = [];
      const t: string[] = [];
      const scale = 0.32;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        setProgress(n / doc.numPages);
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
      const current = annotationsRef.current[pageIndex] ?? [];
      setAnnotationsByPage((m) => ({ ...m, [pageIndex]: next }));
      setUndoStack((s) => ({ ...s, [pageIndex]: [...(s[pageIndex] ?? []), current] }));
      setRedoStack((r) => ({ ...r, [pageIndex]: [] }));
      setHistoryVersion((v) => v + 1);
      setSelectedId(null);
    },
    []
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
    const gen = ++renderGen.current;
    if (renderTask.current) {
      try {
        renderTask.current.cancel();
      } catch {
        // task already completed or cancelled
      }
    }
    const page = await doc.getPage(active + 1);
    const vp = page.getViewport({ scale: scale * dpr });
    const task = page.render({ canvas, viewport: vp });
    renderTask.current = task;
    try {
      await task.promise;
    } catch {
      if (gen === renderGen.current) throw Error("page render failed");
      return;
    }
    page.cleanup();
  }, [active, dim, zoom]);

  const renderAnnotations = useCallback(
    (overrides?: { list?: Annotation[]; selected?: Annotation | null }) => {
      const canvas = annCanvasRef.current;
      if (!canvas || !dim) return;
      const scale = canvas.offsetWidth / dim.width;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      const list = overrides?.list ?? annotationsRef.current[active] ?? [];
      drawAnnotations(ctx, list);
      if (tool === "select") {
        const selected =
          overrides?.selected ??
          list.find((ann) => ann.id === selectedId) ??
          null;
        if (selected) drawSelection(ctx, selected, scale * dpr);
      }
    },
    [active, dim, tool, selectedId]
  );

  useEffect(() => {
    annotationsRef.current = annotationsByPage;
  }, [annotationsByPage]);

  useEffect(() => {
    renderAnnotations();
    void renderBase().then(() => renderAnnotations());
  }, [renderBase, renderAnnotations, historyVersion]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      void renderBase().then(() => renderAnnotations());
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
    if (d?.kind === "arrow") {
      pending.push({
        id: "pending",
        kind: "arrow",
        color,
        start: d.start,
        end: d.current,
        lineWidth: strokeWidth,
      });
    } else if (d?.kind === "rect") {
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
    const raw = textareaRef.current?.value ?? draftText;
    const text = raw.trim().split("\n").map((l) => l.trimEnd()).join("\n");
    const p = draft;
    if (!p) {
      setDraft(null);
      editingIdRef.current = null;
      return;
    }
    if (editingIdRef.current) {
      const id = editingIdRef.current;
      const existing = annotationsRef.current[active] ?? [];
      push(
        active,
        existing.map((ann) => (ann.id === id ? { ...ann, text } : ann))
      );
      editingIdRef.current = null;
      setDraft(null);
      setDraftText("");
      return;
    }
    if (!text) {
      setDraft(null);
      return;
    }
    const ann: Annotation = {
      id: createId(),
      kind: "text",
      color,
      x: p.x,
      y: p.y,
      text,
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

      dragRef.current = null;
      drawingRef.current = null;

      if (tool === "text") {
        commitText();
        editingIdRef.current = null;
        setDraft(pt);
        setSelectedId(null);
        return;
      }

      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or non-tracked pointers may reject capture; drawing still works.
      }

      if (tool === "select") {
        const pageAnnotations = annotationsRef.current[active] ?? [];
        const idx = [...pageAnnotations].reverse().findIndex((ann) =>
          hitTestAnnotation(ann, pt, ctx)
        );
        if (idx === -1) {
          dragRef.current = null;
          setSelectedId(null);
          renderAnnotations({ selected: null });
          return;
        }
        const hit = pageAnnotations[pageAnnotations.length - 1 - idx];
        let handle = -1;
        if (hit.kind === "rect" || hit.kind === "highlight") {
          const bounds = getAnnotationBBox(hit, ctx);
          const scalePx = canvas.offsetWidth / pr.width;
          const handleR = 8 / scalePx;
          const corners = [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height },
          ];
          handle = corners.findIndex(
            (c) => Math.hypot(pt.x - c.x, pt.y - c.y) <= handleR
          );
        }
        dragRef.current = {
          mode: handle >= 0 ? "resize" : "move",
          id: hit.id,
          base: hit,
          current: hit,
          start: pt,
          handle,
          moved: false,
        };
        setSelectedId(hit.id);
        setDragging(true);
        renderAnnotations({ selected: hit });
        return;
      }

      const dprScale = canvas.offsetWidth / pr.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.setTransform(dprScale * (window.devicePixelRatio || 1), 0, 0, dprScale * (window.devicePixelRatio || 1), 0, 0);

      if (tool === "pen") {
        drawingRef.current = { kind: "pen", points: [pt] };
        drawPoint(ctx, pt, color, strokeWidth);
      } else {
        drawingRef.current = {
          kind: tool === "arrow" ? "arrow" : "rect",
          start: pt,
          current: pt,
        };
        redrawWithPendingRect();
      }
    },
    [
      pageRect,
      tool,
      color,
      strokeWidth,
      commitText,
      redrawWithPendingRect,
      renderAnnotations,
      active,
    ]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pr = pageRect();
      const canvas = annCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !pr || !ctx) return;
      const pt = pr.toPage(e.clientX, e.clientY);

      const drag = dragRef.current;
      if (drag) {
        if (drag.mode === "move") {
          drag.current = translateAnnotation(
            drag.base,
            pt.x - drag.start.x,
            pt.y - drag.start.y
          );
        } else {
          drag.current = resizeRect(drag.base, drag.handle, pt);
        }
        drag.moved = Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) > 2;
        const list = (annotationsRef.current[active] ?? []).map((ann) =>
          ann.id === drag.id ? drag.current : ann
        );
        renderAnnotations({ list, selected: drag.current });
        return;
      }

      const d = drawingRef.current;
      if (!d) return;

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
    [pageRect, color, strokeWidth, redrawWithPendingRect, renderAnnotations, active]
  );

  const onPointerUp = useCallback(() => {
    const canvas = annCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    setDragging(false);

    const drag = dragRef.current;
    if (drag) {
      const activePage = active;
      const existing = annotationsRef.current[activePage] ?? [];
      if (drag.moved) {
        push(
          activePage,
          existing.map((ann) => (ann.id === drag.id ? drag.current : ann))
        );
      } else if (drag.base.kind === "text") {
        editingIdRef.current = drag.base.id;
        setDraft({ x: drag.base.x ?? 0, y: drag.base.y ?? 0 });
        setDraftText(drag.base.text ?? "");
        setSelectedId(null);
      }
      dragRef.current = null;
      renderAnnotations();
      return;
    }

    const d = drawingRef.current;
    if (!d) return;
    const activePage = active;
    const existing = annotationsByPage[activePage] ?? [];
    if (ctx && d.kind === "pen" && d.points.length > 1) {
      const ann: Annotation = {
        id: createId(),
        kind: "pen",
        color,
        points: d.points,
        lineWidth: strokeWidth,
      };
      push(activePage, [...existing, ann]);
    } else if (ctx && d.kind === "arrow") {
      const dist = Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y);
      if (dist > 1) {
        const ann: Annotation = {
          id: createId(),
          kind: "arrow",
          color,
          start: d.start,
          end: d.current,
          lineWidth: strokeWidth,
        };
        push(activePage, [...existing, ann]);
      }
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redoCb();
        else undoCb();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redoCb();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoCb, redoCb, deleteSelected, selectedId]);

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
      window.setTimeout(() => setMessage(""), 4000);
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
    { id: "arrow", label: "Arrow", icon: <ArrowUpRight className="w-4 h-4" /> },
  ];

  if (!loaded) {
    return (
      <div className="flex-1 min-h-0 w-full flex flex-col bg-slate-100">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void loadPdf(e.target.files?.[0] as File)}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a PDF to edit"
            onClick={() => {
              if (!busy) inputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
            }}
            className={`group w-full max-w-xl rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-200 ${
              busy
                ? "border-indigo-300 bg-indigo-50/40 cursor-default"
                : "border-slate-300 bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800">
                {busy ? "Reading your PDF…" : "Drop your PDF here"}
              </h2>
              <p className="text-sm text-slate-500">
                {busy
                  ? "Parsing pages — this never leaves your device."
                  : "or click to browse — free, no sign-up, nothing uploaded"}
              </p>
              {busy ? (
                <div className="w-56 mt-2">
                  <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Lock className="w-3.5 h-3.5" />
                  Annotate text, draw arrows, highlight and save — all on your device.
                </div>
              )}
            </div>
          </div>
        </div>
        {(error || message) && (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
              error ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
            }`}
          >
            {error || message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-slate-100">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void loadPdf(e.target.files?.[0] as File)}
      />

      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 sm:px-4 h-14 border-b border-slate-200 bg-white/85 backdrop-blur shrink-0">
        <Link
          href="/#tools"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> All tools
        </Link>
        <div className="w-px h-6 bg-slate-200" />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy || exporting}>
          <FileText className="w-4 h-4" />
          Open
        </Button>
        <span className="text-sm text-slate-500 min-w-0 truncate flex-1">
          {sourceName}
        </span>
        {error && (
          <span className="hidden sm:inline-flex text-xs text-red-600 truncate max-w-[30ch]" title={error}>
            {error}
          </span>
        )}
        <Button type="button" onClick={() => void save()} disabled={busy || exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Saving…" : "Save PDF"}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-1.5 border-b border-slate-200 bg-white/85 backdrop-blur shrink-0">
        <div className="flex items-center gap-1">
          {toolButtons.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tool === t.id}
              onClick={() => {
                setTool(t.id);
                setSelectedId(null);
                dragRef.current = null;
                drawingRef.current = null;
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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
              className={`w-6 h-6 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${color === c ? "border-slate-900 scale-110" : "border-white shadow"}`}
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

        {(tool === "pen" || tool === "rect" || tool === "arrow") && (
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-label={`Stroke width ${s.label}`}
                onClick={() => setStrokeWidth(s.value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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
          title="Undo (Ctrl/Cmd+Z)"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={redoCb}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedId}
          aria-label="Delete selection"
          title="Delete selection"
          className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:text-slate-300 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-auto bg-slate-100">
        <div className="min-h-full w-fit mx-auto flex items-center justify-center p-6 sm:p-10">
          <div className="relative bg-white rounded-lg shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 overflow-hidden">
            <canvas ref={pageCanvasRef} className="block" />
            <canvas
              ref={annCanvasRef}
              className="absolute inset-0 touch-none"
              style={{
                width: "100%",
                height: "100%",
                cursor:
                  tool === "select"
                    ? dragging
                      ? "grabbing"
                      : "grab"
                    : tool === "text"
                    ? "text"
                    : "crosshair",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
            {draft && (
              <textarea
                ref={textareaRef}
                autoFocus
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitText();
                  if (e.key === "Escape") {
                    setDraft(null);
                    setDraftText("");
                    editingIdRef.current = null;
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
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-12 border-t border-slate-200 bg-white/85 backdrop-blur shrink-0">
        <button
          type="button"
          onClick={() => {
            setActive((p) => Math.max(0, p - 1));
            setSelectedId(null);
            setDraft(null);
          }}
          disabled={active === 0}
          aria-label="Previous page"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
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
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto items-center py-1">
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
              className={`rounded-md border-2 overflow-hidden shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active === i ? "border-indigo-500" : "border-slate-200 hover:border-slate-400"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t}
                alt={`Page ${i + 1} preview`}
                className="w-12 h-auto object-cover bg-slate-100"
                loading="lazy"
              />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <button
          type="button"
          onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])}
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])}
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {(error || message) && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
            error ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {error || message}
        </div>
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

function drawSelection(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  screenScale: number
) {
  const bounds = getAnnotationBBox(ann, ctx);
  const s = 8 / screenScale;
  const px = 1.5 / screenScale;
  ctx.save();
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = px;
  ctx.setLineDash([5 / screenScale, 4 / screenScale]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.setLineDash([]);
  if (ann.kind === "rect" || ann.kind === "highlight") {
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ];
    for (const c of corners) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = px;
      ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
      ctx.strokeRect(c.x - s / 2, c.y - s / 2, s, s);
    }
  }
  ctx.restore();
}