"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Brush,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Combine,
  Copy,
  Download,
  Eraser,
  FileDown,
  FilePlus,
  FileText,
  Hash,
  Highlighter,
  Image as ImageIcon,
  Loader2,
  Lock,
  Minus,
  MousePointer2,
  PenLine,
  PenTool,
  Redo2,
  RotateCw,
  Scissors,
  Shield,
  Square,
  Stamp,
  SquarePen,
  StickyNote,
  Strikethrough as StrikethroughIcon,
  Trash2,
  Type,
  Underline,
  Undo2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  Annotation,
  AnnotationKind,
  Point,
  createId,
  drawAnnotation,
  getAnnotationBBox,
  hitTestAnnotation,
  pointsToRect,
  rasterToAnnotation,
  resizeRect,
  toTopLeft,
  translateAnnotation,
} from "./annotations";
import {
  ContentRuns,
  extractContentRuns,
  ImageRun,
  TextRun,
} from "./text-structure";
import {
  FormWidget,
  PageDecorationOptions,
  ExportOptions,
  detectFormWidgets,
  loadWorkingDoc,
  mergeAdjacentPages,
  pageOps,
  splitPage,
} from "./pdf-ops";
import { exportFilledPdf, exportPdf, exportPageImage, PageDimensions } from "./export";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0f172a"];
const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#93c5fd", "#fca5a5", "#f9a8d4"];
const STROKE_WIDTHS = [
  { label: "S", value: 1.5 },
  { label: "M", value: 3 },
  { label: "L", value: 6 },
];
const FONT_SIZES = [12, 16, 21, 28];
const OPACITIES = [0.4, 0.6, 0.8, 1];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Tool =
  | "select"
  | "fill"
  | "edit"
  | "pen"
  | "brush"
  | "rect"
  | "oval"
  | "line"
  | "arrow"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "redact"
  | "note"
  | "text"
  | "date"
  | "sign"
  | "rectangle";

const TOOLS: { id: Tool; label: string; group: "view" | "markup" | "insert" | "shapes" }[] = [
  { id: "select", label: "Select", group: "view" },
  { id: "pen", label: "Pen", group: "markup" },
  { id: "brush", label: "Brush", group: "markup" },
  { id: "highlight", label: "Highlight", group: "markup" },
  { id: "underline", label: "Underline", group: "markup" },
  { id: "strikethrough", label: "Strike", group: "markup" },
  { id: "redact", label: "Redact", group: "markup" },
  { id: "note", label: "Note", group: "insert" },
  { id: "edit", label: "Edit", group: "insert" },
  { id: "text", label: "Text", group: "insert" },
  { id: "date", label: "Date", group: "insert" },
  { id: "sign", label: "Sign", group: "insert" },
  { id: "fill", label: "Fill Form", group: "insert" },
  { id: "line", label: "Line", group: "shapes" },
  { id: "arrow", label: "Arrow", group: "shapes" },
  { id: "rectangle", label: "Box", group: "shapes" },
  { id: "oval", label: "Oval", group: "shapes" },
];

const RESIZABLE_KINDS: AnnotationKind[] = [
  "rect",
  "oval",
  "highlight",
  "underline",
  "strikethrough",
  "redact",
  "image",
  "imageEdit",
  "textEdit",
];

interface SavedSignature {
  points?: Point[];
  width: number;
  height: number;
  dataUrl?: string;
}

function todayStr(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function shapeKind(tool: Tool): "rect" | "oval" | "highlight" | "underline" | "strikethrough" | "redact" | null {
  switch (tool) {
    case "rectangle":
      return "rect";
    case "oval":
      return "oval";
    case "highlight":
      return "highlight";
    case "underline":
      return "underline";
    case "strikethrough":
      return "strikethrough";
    case "redact":
      return "redact";
    default:
      return null;
  }
}

const LINE_TOOLS: Tool[] = ["line", "arrow"];

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
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1].value);
  const [brushWidth, setBrushWidth] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(0.6);
  const [fontSize, setFontSize] = useState(16);
  const [zoom, setZoom] = useState(1);

  const [annotationsByPage, setAnnotationsByPage] = useState<Record<number, Annotation[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Record<number, Annotation[][]>>({});
  const [redoStack, setRedoStack] = useState<Record<number, Annotation[][]>>({});
  const [draft, setDraft] = useState<{ x: number; y: number; kind: Tool } | null>(null);
  const [draftText, setDraftText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [runs, setRuns] = useState<ContentRuns | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [editFontSize, setEditFontSize] = useState<number | null>(null);
  const [editImageMenu, setEditImageMenu] = useState<ImageRun | null>(null);
  const runsCacheRef = useRef<Record<number, ContentRuns>>({});
  const editTargetRef = useRef<{ kind: "text"; run: TextRun } | { kind: "image"; run: ImageRun } | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageRef = useRef<ImageRun | null>(null);

  const [menu, setMenu] = useState<"pages" | "doc" | "download" | null>(null);
  const [deco, setDeco] = useState<PageDecorationOptions>({
    enabled: false,
    kind: "watermark",
    text: "DRAFT",
    fontSize: 42,
    color: "#2563eb",
    opacity: 0.2,
    position: "center",
  });
  const [protect, setProtect] = useState({
    userPassword: "",
    ownerPassword: "",
    allowPrinting: true,
    allowCopying: true,
  });
  const [decoOpen, setDecoOpen] = useState(false);
  const [protectOpen, setProtectOpen] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{ data: ArrayBuffer; name: string } | null>(null);
  const [unlockedName, setUnlockedName] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signature, setSignature] = useState<SavedSignature | null>(() => {
    try {
      const raw = window.localStorage.getItem("pdf-editor.signature");
      if (raw) return JSON.parse(raw) as SavedSignature;
    } catch {
      // corrupted saved signature; ignore
    }
    return null;
  });
  const [formWidgets, setFormWidgets] = useState<FormWidget[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});

  const [historyVersion, setHistoryVersion] = useState(0);
  const [displayScale, setDisplayScale] = useState(1);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const docRef = useRef<{ doc: import("pdfjs-dist").PDFDocumentProxy; data: ArrayBuffer } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const annCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTask = useRef<{ cancel: () => void } | null>(null);
  const renderGen = useRef(0);
  const annotationsRef = useRef<Record<number, Annotation[]>>({});
  const undoRef = useRef<Record<number, Annotation[][]>>({});
  const redoRef = useRef<Record<number, Annotation[][]>>({});
  const drawingRef = useRef<
    | { kind: "pen"; points: Point[] }
    | { kind: "rect"; start: Point; current: Point }
    | { kind: "line"; start: Point; current: Point }
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
  const draftRef = useRef<{ x: number; y: number; kind: Tool } | null>(null);
  const pendingSignRef = useRef<Point | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const dim = dimensions[active];

  const canUndo = (undoStack[active]?.length ?? 0) > 0;
  const canRedo = (redoStack[active]?.length ?? 0) > 0;

  const loadPdf = useCallback(async (fileOrBuffer: File | { data: ArrayBuffer; name: string }, targetInitial = 0) => {
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
    setFormWidgets([]);
    setFormValues({});
    setHistoryVersion((v) => v + 1);
    setProgress(0);
    try {
      const data = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer.data;
      try {
        const { isEncrypted } = await import("@pdfsmaller/pdf-decrypt");
        const cryptoInfo = await isEncrypted(new Uint8Array(data));
        if (cryptoInfo.encrypted) {
          const name = fileOrBuffer instanceof File ? fileOrBuffer.name : "document";
          setPasswordPrompt({ data: data.slice(0), name });
          setBusy(false);
          return;
        }
      } catch {
        // Not a standard-encrypted PDF; pdfjs will attempt to read it normally.
      }
      const exportData = data.slice(0);
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;
      try {
        (docRef.current?.doc as { destroy?: () => unknown } | undefined)?.destroy?.();
      } catch {
        // previous document already closed
      }
      docRef.current = { doc, data: exportData };
      runsCacheRef.current = {};
      setRuns(null);
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
      setSourceName(fileOrBuffer instanceof File ? fileOrBuffer.name : fileOrBuffer.name);
      setActive(targetInitial);
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
      annotationsRef.current = { ...annotationsRef.current, [pageIndex]: next };
      undoRef.current = { ...undoRef.current, [pageIndex]: [...(undoRef.current[pageIndex] ?? []), current] };
      redoRef.current = { ...redoRef.current, [pageIndex]: [] };
      setAnnotationsByPage((m) => ({ ...m, [pageIndex]: next }));
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
      for (const ann of list) drawAnnotation(ctx, ann);
      const d = draftRef.current;
      if (d && (d.kind === "text" || d.kind === "date")) {
        const px = 1.5 / scale;
        const w = 168;
        const h = d.kind === "date" ? 30 : 44;
        ctx.save();
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = px;
        ctx.setLineDash([5 / scale, 4 / scale]);
        ctx.strokeRect(d.x, d.y, w, h);
        ctx.restore();
      } else if (d?.kind === "note") {
        drawAnnotation(ctx, {
          id: "draft-note",
          kind: "note",
          color,
          x: d.x,
          y: d.y,
          text: "",
          noteOpen: false,
        });
      }
      if (tool === "select") {
        const selected =
          overrides?.selected ??
          list.find((ann) => ann.id === selectedId) ??
          null;
        if (selected) drawSelection(ctx, selected, scale * dpr);
      }
    },
    [active, dim, tool, selectedId, color, draftRef]
  );

  useEffect(() => {
    annotationsRef.current = annotationsByPage;
  }, [annotationsByPage]);

  const saveSignature = useCallback((sig: SavedSignature) => {
    setSignature(sig);
    try {
      window.localStorage.setItem("pdf-editor.signature", JSON.stringify(sig));
    } catch {
      // storage unavailable; signature stays for this session only
    }
  }, []);

  useEffect(() => {
    undoRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    redoRef.current = redoStack;
  }, [redoStack]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    renderAnnotations();
    void renderBase().then(() => renderAnnotations());
  }, [renderBase, renderAnnotations, historyVersion]);

  useEffect(() => {
    if (tool !== "edit" || !docRef.current) return;
    const r = docRef.current;
    const cached = runsCacheRef.current[active];
    if (cached) {
      setRuns(cached);
      setRunsLoading(false);
      return;
    }
    let cancelled = false;
    setRunsLoading(true);
    void extractContentRuns(r.doc, active)
      .then((res) => {
        if (cancelled) return;
        runsCacheRef.current[active] = res;
        setRuns(res);
        setRunsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRuns(null);
        setRunsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tool, active, loaded]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      void renderBase().then(() => renderAnnotations());
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderBase, renderAnnotations]);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadWorkingDoc(docRef.current?.data ?? new ArrayBuffer(0));
        const widgets = await detectFormWidgets(pdf, active);
        if (!cancelled) setFormWidgets(widgets);
      } catch {
        if (!cancelled) setFormWidgets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, active, historyVersion]);

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
    const pending: Annotation[] = [...(annotationsRef.current[active] ?? [])];
    if (d?.kind === "rect") {
      const shape = shapeKind(tool);
      const rect = pointsToRect(d.start, d.current);
      if (shape) {
        pending.push({
          id: "pending",
          kind: shape,
          color: shape === "highlight" ? highlightColor : color,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          lineWidth: strokeWidth,
        });
      }
    } else if (d?.kind === "line") {
      pending.push({
        id: "pending",
        kind: tool === "line" ? "line" : "arrow",
        color,
        start: d.start,
        end: d.current,
        lineWidth: strokeWidth,
      });
    }
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    for (const ann of pending) drawAnnotation(ctx, ann);
  }, [active, dimensions, color, highlightColor, strokeWidth, tool, annotationsRef]);

  const commitText = useCallback(() => {
    const raw = textareaRef.current?.value ?? draftText;
    const text = raw.trim().split("\n").map((l) => l.trimEnd()).join("\n");
    const d = draft;
    const cleanup = () => {
      setDraft(null);
      setDraftText("");
      setEditFontSize(null);
      editingIdRef.current = null;
      editTargetRef.current = null;
    };
    if (!d) {
      cleanup();
      return;
    }
    const existing = annotationsRef.current[active] ?? [];
    if (editTargetRef.current?.kind === "text") {
      const run = editTargetRef.current.run;
      const enoughForNewText = text.length * 0.58 * run.fontSize;
      const coverWidth = Math.max(run.width, enoughForNewText);
      push(
        active,
        [
          ...existing,
          {
            id: createId(),
            kind: "textEdit",
            color: "#111827",
            x: run.x,
            y: run.y,
            width: coverWidth,
            height: run.height,
            baselineY: run.height - run.fontSize * 0.2,
            fontSize: run.fontSize,
            text,
            originalText: run.text,
          },
        ]
      );
      cleanup();
      return;
    }
    if (editingIdRef.current) {
      const id = editingIdRef.current;
      push(
        active,
        existing.map((ann) => (ann.id === id ? { ...ann, text } : ann))
      );
      cleanup();
      return;
    }
    if (!text) {
      cleanup();
      return;
    }
    if (d.kind === "note") {
      push(active, [
        ...existing,
        { id: createId(), kind: "note", color, x: d.x, y: d.y, text, fontSize: 14, noteOpen: false },
      ]);
      cleanup();
      return;
    }
    if (d.kind === "date") {
      push(active, [
        ...existing,
        { id: createId(), kind: "date", color, x: d.x, y: d.y, text, fontSize },
      ]);
      cleanup();
      return;
    }
    if (d.kind !== "text") {
      cleanup();
      return;
    }
    const ann: Annotation = {
      id: createId(),
      kind: "text",
      color,
      x: d.x,
      y: d.y,
      text,
      fontSize,
    };
    const ctx = annCanvasRef.current?.getContext("2d") ?? null;
    const next = ctx ? toTopLeft(ann, ctx) : ann;
    push(active, [...existing, next]);
    cleanup();
  }, [active, color, draft, draftText, fontSize, push, annotationsRef]);

  const placeSignature = useCallback(
    (sig: SavedSignature, pt: Point) => {
      const existing = annotationsRef.current[active] ?? [];
      if (sig.dataUrl) {
        push(active, [...existing, rasterToAnnotation(sig.dataUrl, pt.x, pt.y, sig.width, sig.height)]);
        return;
      }
      const pts = sig.points ?? [];
      const scale = Math.min(132 / sig.width, 1);
      const scaled = pts.map((p) => ({ x: pt.x + p.x * scale, y: pt.y + p.y * scale }));
      push(active, [
        ...existing,
        {
          id: createId(),
          kind: "brush",
          color: "#2563eb",
          points: scaled,
          lineWidth: 2.5,
          opacity: 1,
        },
      ]);
    },
    [active, push, annotationsRef]
  );

  const handleSign = useCallback(
    (pt: Point) => {
      if (!signature) {
        pendingSignRef.current = pt;
        setSignOpen(true);
        return;
      }
      placeSignature(signature, pt);
    },
    [signature, placeSignature]
  );

  const startEditText = useCallback(
    (run: TextRun) => {
      editTargetRef.current = { kind: "text", run };
      setEditFontSize(run.fontSize);
      setDraftText(run.text);
      setDraft({ x: run.x, y: run.y, kind: "text" });
      setSelectedId(null);
      setEditImageMenu(null);
    },
    []
  );

  const startEditImage = useCallback(
    (run: ImageRun) => {
      editTargetRef.current = { kind: "image", run };
      setEditImageMenu(run);
      setSelectedId(null);
    },
    []
  );

  const hideImage = useCallback(
    (run: ImageRun) => {
      const existing = annotationsRef.current[active] ?? [];
      push(active, [
        ...existing,
        { id: createId(), kind: "imageEdit", color: "#2563eb", x: run.x, y: run.y, width: run.width, height: run.height },
      ]);
      setEditImageMenu(null);
      editTargetRef.current = null;
    },
    [active, push, annotationsRef]
  );

  const replaceImage = useCallback(
    (run: ImageRun) => {
      replaceImageRef.current = run;
      setEditImageMenu(null);
      imageInputRef.current?.click();
    },
    []
  );

  const onReplaceImageFile = useCallback(
    (file: File | undefined) => {
      const run = replaceImageRef.current;
      replaceImageRef.current = null;
      if (!file || !run) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : null;
        if (!dataUrl) return;
        const existing = annotationsRef.current[active] ?? [];
        push(active, [
          ...existing,
          { id: createId(), kind: "imageEdit", color: "#2563eb", x: run.x, y: run.y, width: run.width, height: run.height, dataUrl },
        ]);
        editTargetRef.current = null;
      };
      reader.readAsDataURL(file);
    },
    [active, push, annotationsRef]
  );

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

      if (tool === "fill") return;

      if (tool === "text" || tool === "date" || tool === "note") {
        commitText();
        editingIdRef.current = null;
        editTargetRef.current = null;
        setEditFontSize(null);
        setDraftText(tool === "date" ? todayStr() : "");
        setDraft({ x: pt.x, y: pt.y, kind: tool });
        setSelectedId(null);
        return;
      }

      if (tool === "sign") {
        handleSign(pt);
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
        if (RESIZABLE_KINDS.includes(hit.kind)) {
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

      if (tool === "pen" || tool === "brush") {
        drawingRef.current = { kind: "pen", points: [pt] };
        drawPoint(ctx, pt, color, tool === "brush" ? brushWidth : strokeWidth, tool === "brush" ? brushOpacity : 1);
      } else if (shapeKind(tool)) {
        drawingRef.current = { kind: "rect", start: pt, current: pt };
        redrawWithPendingRect();
      } else if (LINE_TOOLS.includes(tool)) {
        drawingRef.current = { kind: "line", start: pt, current: pt };
        redrawWithPendingRect();
      }
    },
    [
      pageRect,
      tool,
      color,
      strokeWidth,
      brushWidth,
      brushOpacity,
      commitText,
      handleSign,
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
        drawSegment(
          ctx,
          last,
          pt,
          color,
          tool === "brush" ? brushWidth : strokeWidth,
          tool === "brush" ? brushOpacity : 1
        );
      } else {
        d.current = pt;
        redrawWithPendingRect();
      }
    },
    [pageRect, tool, color, strokeWidth, brushWidth, brushOpacity, redrawWithPendingRect, renderAnnotations, active]
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
      } else if (drag.base.kind === "text" || drag.base.kind === "date" || drag.base.kind === "textEdit") {
        editingIdRef.current = drag.base.id;
        setDraftText(drag.base.text ?? "");
        setDraft({ x: drag.base.x ?? 0, y: drag.base.y ?? 0, kind: "text" });
        setSelectedId(null);
      }
      dragRef.current = null;
      renderAnnotations();
      return;
    }

    const d = drawingRef.current;
    if (!d) return;
    const activePage = active;
    const existing = annotationsRef.current[activePage] ?? [];
    if (ctx && d.kind === "pen" && d.points.length > 1) {
      const isBrush = tool === "brush";
      const ann: Annotation = {
        id: createId(),
        kind: isBrush ? "brush" : "pen",
        color,
        points: d.points,
        lineWidth: isBrush ? brushWidth : strokeWidth,
        opacity: isBrush ? brushOpacity : undefined,
      };
      push(activePage, [...existing, ann]);
    } else if (ctx && d.kind === "line") {
      const dist = Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y);
      if (dist > 1) {
        const ann: Annotation = {
          id: createId(),
          kind: tool === "line" ? "line" : "arrow",
          color,
          start: d.start,
          end: d.current,
          lineWidth: strokeWidth,
        };
        push(activePage, [...existing, ann]);
      }
    } else if (ctx && d.kind === "rect") {
      const shape = shapeKind(tool);
      if (!shape) {
        drawingRef.current = null;
        renderAnnotations();
        return;
      }
      const rect = pointsToRect(d.start, d.current);
      if (rect.width > 1 || rect.height > 1) {
        const ann: Annotation = {
          id: createId(),
          kind: shape,
          color: shape === "highlight" ? highlightColor : color,
          ...rect,
          lineWidth: strokeWidth,
        };
        push(activePage, [...existing, ann]);
      }
    }
    drawingRef.current = null;
    renderAnnotations();
  }, [active, tool, color, highlightColor, strokeWidth, brushWidth, brushOpacity, push, renderAnnotations, annotationsRef]);
const undoCb = useCallback(() => {
    const past = undoRef.current[active];
    if (!past || past.length === 0) return;
    const current = annotationsRef.current[active] ?? [];
    const prev = past[past.length - 1];
    annotationsRef.current = { ...annotationsRef.current, [active]: prev };
    undoRef.current = { ...undoRef.current, [active]: past.slice(0, -1) };
    redoRef.current = { ...redoRef.current, [active]: [...(redoRef.current[active] ?? []), current] };
    setAnnotationsByPage((m) => ({ ...m, [active]: prev }));
    setUndoStack((s) => ({ ...s, [active]: past.slice(0, -1) }));
    setRedoStack((r) => ({ ...r, [active]: [...(r[active] ?? []), current] }));
    setHistoryVersion((v) => v + 1);
    setSelectedId(null);
  }, [active, annotationsRef, undoRef, redoRef]);

  const redoCb = useCallback(() => {
    const future = redoRef.current[active];
    if (!future || future.length === 0) return;
    const current = annotationsRef.current[active] ?? [];
    const next = future[future.length - 1];
    annotationsRef.current = { ...annotationsRef.current, [active]: next };
    undoRef.current = { ...undoRef.current, [active]: [...(undoRef.current[active] ?? []), current] };
    redoRef.current = { ...redoRef.current, [active]: future.slice(0, -1) };
    setAnnotationsByPage((m) => ({ ...m, [active]: next }));
    setUndoStack((s) => ({ ...s, [active]: [...(s[active] ?? []), current] }));
    setRedoStack((r) => ({ ...r, [active]: future.slice(0, -1) }));
    setHistoryVersion((v) => v + 1);
    setSelectedId(null);
  }, [active, annotationsRef, undoRef, redoRef]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    push(
      active,
      (annotationsRef.current[active] ?? []).filter((a) => a.id !== selectedId)
    );
  }, [active, selectedId, push, annotationsRef]);

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

  const applyPageOp = useCallback(
    async (op: "rotate" | "deletePage" | "duplicatePage" | "moveLeft" | "moveRight" | "splitH" | "splitV" | "mergeNext") => {
      const r = docRef.current;
      if (!r) return;
      setMenu(null);
      setBusy(true);
      setError("");
      try {
        let bytes: Uint8Array | null = null;
        if (op === "splitH" || op === "splitV") {
          bytes = await splitPage(r.data, active, op === "splitH" ? "horizontal" : "vertical");
        } else if (op === "mergeNext") {
          bytes = await mergeAdjacentPages(r.data, active);
        } else {
          bytes = await pageOps(r.data, op as "rotate", active);
        }
        if (!bytes) {
          setError(op === "deletePage" ? "A PDF needs at least one page." : "That operation isn't possible on this page.");
          setBusy(false);
          return;
        }
        const target =
          op === "deletePage"
            ? Math.max(0, Math.min(active, dimsCountAfterDelete(dimensions.length)))
            : op === "duplicatePage"
              ? Math.min(active + 1, dimensions.length)
              : op === "moveLeft"
                ? Math.max(0, active - 1)
                : op === "moveRight"
                  ? Math.min(dimensions.length - 1, active + 1)
                  : op === "splitH" || op === "splitV"
                    ? Math.min(active, dimensions.length)
                    : op === "mergeNext"
                      ? Math.max(0, active - 1)
                      : active;
        setAnnotationsByPage({});
        void loadPdf({ data: bytes.slice(0).buffer as ArrayBuffer, name: sourceName || "document" }, target);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Page operation failed.");
        setBusy(false);
      }
    },
    [active, dimensions.length, loadPdf, sourceName]
  );

  const buildSecurity = useCallback((): Pick<ExportOptions, "userPassword" | "ownerPassword" | "permissions"> => {
    if (!protect.userPassword && !protect.ownerPassword) return {};
    return {
      userPassword: protect.userPassword || undefined,
      ownerPassword: protect.ownerPassword || undefined,
      permissions: {
        printing: protect.allowPrinting ? "allow" : "notAllowed",
        copying: protect.allowCopying ? "allow" : "notAllowed",
      },
    };
  }, [protect]);

  const save = useCallback(async () => {
    const r = docRef.current;
    if (!r) return;
    setExporting(true);
    setError("");
    setMessage("");
    try {
      const bytes = await exportPdf(r.data, annotationsByPage, dimensions.length, {
        ...buildSecurity(),
        decorations: deco.enabled ? deco : undefined,
      });
      const base = sourceName.replace(/\.pdf$/i, "") || "document";
      downloadBlob(bytes, `${base}-edited.pdf`);
      setMessage("Edited PDF downloaded — annotations are flattened into it.");
      window.setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [sourceName, dimensions.length, annotationsByPage, buildSecurity, deco]);

  const saveSignedCopy = useCallback(async () => {
    const r = docRef.current;
    if (!r) return;
    setExporting(true);
    setError("");
    setMessage("");
    try {
      const bytes = await exportFilledPdf(r.data, annotationsByPage, dimensions.length, {
        ...buildSecurity(),
        decorations: deco.enabled ? deco : undefined,
        formValues,
      });
      const base = sourceName.replace(/\.pdf$/i, "") || "document";
      downloadBlob(bytes, `${base}-signed.pdf`);
      setMessage(formValues && Object.keys(formValues).length > 0
        ? "Signed copy downloaded — form fields were filled in."
        : "Signed copy downloaded.");
      window.setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [sourceName, dimensions.length, annotationsByPage, buildSecurity, deco, formValues]);

  const removePassword = useCallback(async () => {
    const r = docRef.current;
    if (!r) return;
    setMenu(null);
    setExporting(true);
    setError("");
    setMessage("");
    try {
      const { isEncrypted } = await import("@pdfsmaller/pdf-decrypt");
      const srcBytes = new Uint8Array(r.data);
      const info = await isEncrypted(srcBytes);
      if (info.encrypted) throw new Error("This PDF is still encrypted — use Unlock on upload.");
      const base = sourceName.replace(/\.pdf$/i, "") || "document";
      downloadBlob(srcBytes, `${base}-unlocked.pdf`);
      setMessage("Saved a copy without password protection.");
      window.setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove password.");
    } finally {
      setExporting(false);
    }
  }, [sourceName]);

  const handlePasswordPrompt = useCallback(
    async (password: string) => {
      const p = passwordPrompt;
      if (!p) return true;
      try {
        const { decryptPDF, isEncrypted } = await import("@pdfsmaller/pdf-decrypt");
        const srcBytes = new Uint8Array(p.data);
        const info = await isEncrypted(srcBytes);
        const bytes = info.encrypted ? await decryptPDF(srcBytes, password) : srcBytes;
        if (bytes.length === 0) throw new Error("decrypt failed");
        setPasswordPrompt(null);
        setUnlockedName(p.name);
        setMessage(password ? "Unlocked — you can now edit this PDF." : "This PDF had no open password.");
        window.setTimeout(() => setMessage(""), 4000);
        void loadPdf({ data: bytes.slice().buffer as ArrayBuffer, name: p.name });
        return true;
      } catch {
        return false;
      }
    },
    [passwordPrompt, loadPdf]
  );

  const exportImage = useCallback(
    async (format: "png" | "jpeg") => {
      const r = docRef.current;
      if (!r) return;
      setMenu(null);
      setExporting(true);
      setError("");
      setMessage("");
      try {
        const bytes = await exportPageImage(r.data, annotationsByPage, active, format, {
          decorations: deco.enabled ? deco : undefined,
        });
        if (bytes.length === 0) throw new Error("Image export failed.");
        const base = sourceName.replace(/\.pdf$/i, "") || "document";
        downloadBlob(bytes, `${base}-page-${active + 1}.${format === "png" ? "png" : "jpg"}`, format === "png" ? "image/png" : "image/jpeg");
        setMessage(`Page ${active + 1} exported as ${format === "png" ? "PNG" : "JPG"}.`);
        window.setTimeout(() => setMessage(""), 4000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Image export failed.");
      } finally {
        setExporting(false);
      }
    },
    [sourceName, annotationsByPage, active, deco]
  );

  const selectTool = useCallback((t: Tool) => {
    setTool(t);
    setSelectedId(null);
    dragRef.current = null;
    drawingRef.current = null;
    try {
      document.querySelector("textarea")?.blur();
    } catch {
      // no active textarea
    }
    setDraft(null);
    setEditImageMenu(null);
    editTargetRef.current = null;
  }, []);

  const updateFormValue = useCallback(
    (name: string, value: string | boolean) => {
      setFormValues((v) => ({ ...v, [name]: value }));
    },
    []
  );

  const toolIcon = (id: Tool): React.ReactNode => {
    switch (id) {
      case "select":
        return <MousePointer2 className="w-4 h-4" />;
      case "pen":
        return <PenLine className="w-4 h-4" />;
      case "brush":
        return <Brush className="w-4 h-4" />;
      case "highlight":
        return <Highlighter className="w-4 h-4" />;
      case "underline":
        return <Underline className="w-4 h-4" />;
      case "strikethrough":
        return <StrikethroughIcon />;
      case "redact":
        return <Eraser className="w-4 h-4" />;
      case "note":
        return <StickyNote className="w-4 h-4" />;
      case "text":
        return <Type className="w-4 h-4" />;
      case "date":
        return <Calendar className="w-4 h-4" />;
      case "sign":
        return <PenTool className="w-4 h-4" />;
      case "edit":
        return <SquarePen className="w-4 h-4" />;
      case "fill":
        return <Stamp className="w-4 h-4" />;
      case "line":
        return <Minus className="w-4 h-4" />;
      case "arrow":
        return <ArrowUpRight className="w-4 h-4" />;
      case "rectangle":
        return <Square className="w-4 h-4" />;
      case "oval":
        return <Circle className="w-4 h-4" />;
    }
  };

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
                  Highlight, annotate, fill forms, sign and save — all on your device.
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
        {passwordPrompt && (
          <PasswordPromptDialog
            fileName={passwordPrompt.name}
            onCancel={() => setPasswordPrompt(null)}
            onUnlock={async (pw) => handlePasswordPrompt(pw)}
          />
        )}
      </div>
    );
  }

  const showStrokeOptions = ["pen", "brush", "rectangle", "oval", "line", "arrow", "highlight", "underline", "strikethrough"].includes(tool) && tool !== "fill" && tool !== "select";

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
      <div className="flex items-center gap-2 px-3 sm:px-4 h-14 border-b border-slate-200 bg-white/85 backdrop-blur shrink-0 overflow-x-auto">
        <Link
          href="/#tools"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition shrink-0"
        >
          <ArrowLeft className="w-4 h-4" /> All tools
        </Link>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy || exporting}>
          <FileText className="w-4 h-4" />
          Open
        </Button>
        <span className="text-sm text-slate-500 min-w-0 truncate flex-1">{sourceName}</span>
        {error && (
          <span className="hidden sm:inline-flex text-xs text-red-600 truncate max-w-[30ch]" title={error}>
            {error}
          </span>
        )}
        <Button type="button" variant="secondary" onClick={() => void saveSignedCopy()} disabled={busy || exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {exporting ? "Saving…" : "Save signed copy"}
        </Button>
        <Button type="button" onClick={() => void save()} disabled={busy || exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Saving…" : "Save PDF"}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-1.5 border-b border-slate-200 bg-white/85 backdrop-blur shrink-0">
        {(["view", "markup", "insert", "shapes"] as const).map((group) => (
          <div key={group} className="flex items-center gap-1">
            {TOOLS.filter((t) => t.group === group).map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tool === t.id}
                aria-label={t.id === "rectangle" ? "Rectangle" : t.label}
                title={t.label}
                onClick={() => selectTool(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  tool === t.id
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {toolIcon(t.id)}
                <span className="hidden xl:inline">{t.label}</span>
              </button>
            ))}
            <div className="w-px h-6 bg-slate-200 mx-1" />
          </div>
        ))}

        <div className="flex items-center gap-1.5">
          {tool === "highlight" || tool === "underline" || tool === "strikethrough"
            ? HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Highlight color ${c}`}
                  onClick={() => setHighlightColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${highlightColor === c ? "border-slate-900 scale-110" : "border-white shadow"}`}
                  style={{ backgroundColor: c }}
                />
              ))
            : COLORS.map((c) => (
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

        {showStrokeOptions && (
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-label={`Stroke width ${s.label}`}
                onClick={() => {
                  setStrokeWidth(s.value);
                  setBrushWidth(s.value * 3);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  (tool === "brush" ? brushWidth : strokeWidth) === (tool === "brush" ? s.value * 3 : s.value)
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {tool === "brush" && (
          <div className="flex items-center gap-1">
            {OPACITIES.map((o) => (
              <button
                key={o}
                type="button"
                aria-label={`Brush opacity ${o}`}
                onClick={() => setBrushOpacity(o)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  brushOpacity === o ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {Math.round(o * 100)}%
              </button>
            ))}
          </div>
        )}

        {(tool === "text" || tool === "date") && (
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

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={undoCb}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:text-slate-300 disabled:cursor-not-allowed ${!canUndo ? "text-slate-400" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <Undo2 className="w-4 h-4" />
          <span className="hidden sm:inline">Undo</span>
        </button>
        <button
          type="button"
          onClick={redoCb}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:text-slate-300 disabled:cursor-not-allowed ${!canRedo ? "text-slate-400" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <Redo2 className="w-4 h-4" />
          <span className="hidden sm:inline">Redo</span>
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

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === "pages" ? null : "pages")}
            aria-label="Pages menu"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden xl:inline">Pages</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {menu === "pages" && (
            <>
              <button aria-hidden className="fixed inset-0 z-40 cursor-default" onPointerDown={() => setMenu(null)} tabIndex={-1} />
              <div className="absolute z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <MenuAction icon={<FilePlus className="w-4 h-4" />} label="Duplicate current page" onClick={() => void applyPageOp("duplicatePage")} />
                <MenuAction icon={<RotateCw className="w-4 h-4" />} label="Rotate page clockwise" onClick={() => void applyPageOp("rotate")} />
                <MenuAction icon={<ArrowLeftRight className="w-4 h-4" />} label="Move page left" onClick={() => void applyPageOp("moveLeft")} disabled={active === 0} />
                <MenuAction icon={<ArrowLeftRight className="w-4 h-4" />} label="Move page right" onClick={() => void applyPageOp("moveRight")} disabled={active === dimensions.length - 1} />
                <div className="my-1 h-px bg-slate-100" />
                <MenuAction icon={<Scissors className="w-4 h-4" />} label="Split page top/bottom" onClick={() => void applyPageOp("splitH")} />
                <MenuAction icon={<Scissors className="w-4 h-4" />} label="Split page left/right" onClick={() => void applyPageOp("splitV")} />
                <MenuAction icon={<Combine className="w-4 h-4" />} label="Merge next page into this one" onClick={() => void applyPageOp("mergeNext")} disabled={active >= dimensions.length - 1} />
                <div className="my-1 h-px bg-slate-100" />
                <MenuAction icon={<Trash2 className="w-4 h-4" />} label="Delete this page" onClick={() => void applyPageOp("deletePage")} disabled={dimensions.length <= 1} danger />
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === "doc" ? null : "doc")}
            aria-label="Document menu"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden xl:inline">Document</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {menu === "doc" && (
            <>
              <button aria-hidden className="fixed inset-0 z-40 cursor-default" onPointerDown={() => setMenu(null)} tabIndex={-1} />
              <div className="absolute z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <MenuAction icon={<Stamp className="w-4 h-4" />} label="Watermark / page numbers" onClick={() => { setMenu(null); setDecoOpen(true); }} role="" />
                <MenuAction icon={<Lock className="w-4 h-4" />} label="Protect with password" onClick={() => { setMenu(null); setProtectOpen(true); }} />
                <MenuAction icon={<Unlock className="w-4 h-4" />} label="Remove password / unlock" onClick={() => void removePassword()} disabled={!sourceName} />
                {unlockedName ? <div className="px-2 py-1 text-[11px] text-slate-400">Unlocked from {unlockedName}</div> : null}
                <div className="my-1 h-px bg-slate-100" />
                <MenuAction icon={<Hash className="w-4 h-4" />} label={deco.enabled ? "Decoration enabled — shown on export" : "No watermark set"} onClick={() => { setMenu(null); setDecoOpen(true); }} />
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === "download" ? null : "download")}
            aria-label="Export menu"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden xl:inline">Export</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {menu === "download" && (
            <>
              <button aria-hidden className="fixed inset-0 z-40 cursor-default" onPointerDown={() => setMenu(null)} tabIndex={-1} />
              <div className="absolute z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <MenuAction icon={<FileDown className="w-4 h-4" />} label="Export current page as PNG" onClick={() => void exportImage("png")} />
                <MenuAction icon={<ImageIcon className="w-4 h-4" />} label="Export current page as JPG" onClick={() => void exportImage("jpeg")} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-auto bg-slate-100">
        {tool === "edit" && !busy && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 rounded-full bg-slate-900/85 text-white text-xs px-3 py-1.5 shadow-lg pointer-events-none whitespace-nowrap">
            {runsLoading
              ? "Scanning page content…"
              : runs
                ? "Click highlighted text to edit it, or a purple image region to hide or replace it."
                : "No editable text or images detected on this page."}
          </div>
        )}
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
                    : tool === "text" || tool === "date" || tool === "note"
                      ? "text"
                      : tool === "fill"
                        ? "auto"
                        : "crosshair",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
            {tool === "fill" &&
              formWidgets.map((w) => {
                const s = displayScale;
                const left = w.x * s;
                const top = w.y * s;
                const wide = w.width * s;
                const tall = w.height * s;
                const value = formValues[w.name];
                return (
                  <div
                    key={`${w.name}-${w.x}-${w.y}`}
                    className="absolute"
                    style={{ left, top, width: Math.max(wide, 16), height: Math.max(tall, 14) }}
                  >
                    {w.type === "checkbox" || w.type === "radio" ? (
                      <button
                        type="button"
                        onClick={() => updateFormValue(w.name, !value)}
                        aria-label={`Fill ${w.name}`}
                        className={`w-full h-full rounded border-2 flex items-center justify-center transition ${
                          value ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white hover:border-indigo-400"
                        }`}
                      >
                        {value && <Check className="w-3 h-3" />}
                      </button>
                    ) : w.type === "dropdown" ? (
                      <select
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => updateFormValue(w.name, e.target.value)}
                        className="w-full h-full rounded border-2 border-slate-300 bg-white px-1 text-xs focus:border-indigo-500 focus:outline-none"
                        aria-label={`Fill ${w.name}`}
                      >
                        <option value="">—</option>
                        {w.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : w.type === "button" ? (
                      <span className="w-full h-full block bg-slate-100 rounded border border-slate-300 text-[10px] text-slate-400 text-center leading-tight flex items-center justify-center">
                        {w.name}
                      </span>
                    ) : w.type === "signature" ? (
                      <button
                        type="button"
                        onClick={() => handleSign({ x: w.x, y: w.y })}
                        aria-label={`Sign ${w.name}`}
                        className="w-full h-full rounded border-2 border-dashed border-indigo-400 bg-indigo-50/50 text-indigo-500 text-xs transition hover:bg-indigo-100"
                      >
                        Click to sign
                      </button>
                    ) : (
                      <input
                        type="text"
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => updateFormValue(w.name, e.target.value)}
                        className="w-full h-full rounded border-2 border-slate-300 bg-white/95 px-1 text-xs focus:border-indigo-500 focus:outline-none"
                        aria-label={`Fill ${w.name}`}
                        placeholder={w.name}
                      />
                    )}
                  </div>
                );
              })}
            {tool === "edit" && runs && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                {runs.text.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    aria-label={`Edit text: ${tr.text}`}
                    title={tr.text}
                    onClick={() => startEditText(tr)}
                    className="absolute rounded border border-sky-400 bg-sky-200/40 hover:bg-sky-300/60 pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    style={{
                      left: tr.x * displayScale,
                      top: tr.y * displayScale,
                      width: Math.max(tr.width * displayScale, 8),
                      height: Math.max(tr.height * displayScale, 10),
                    }}
                  />
                ))}
                {runs.images.map((im) => (
                  <button
                    key={im.id}
                    type="button"
                    aria-label="Edit image"
                    title="Edit image"
                    onClick={() => startEditImage(im)}
                    className="absolute rounded border-2 border-fuchsia-500 bg-fuchsia-200/30 hover:bg-fuchsia-300/50 pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    style={{
                      left: im.x * displayScale,
                      top: im.y * displayScale,
                      width: Math.max(im.width * displayScale, 8),
                      height: Math.max(im.height * displayScale, 8),
                    }}
                  />
                ))}
              </div>
            )}
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
                    setEditFontSize(null);
                    editingIdRef.current = null;
                    editTargetRef.current = null;
                  }
                }}
                placeholder={draft.kind === "note" ? "Type a note…" : "Type here…"}
                className="absolute border-2 border-indigo-500 bg-white/95 p-1 rounded-md shadow focus:outline-none resize-none"
                style={{
                  left: draft.x * displayScale,
                  top: draft.y * displayScale,
                  fontSize: `${(editFontSize ?? fontSize) * displayScale}px`,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  color,
                  minWidth: 140,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            )}
            {editImageMenu && tool === "edit" && (
              <div
                className="absolute z-40"
                style={{
                  left: editImageMenu.x * displayScale,
                  top: (editImageMenu.y + editImageMenu.height) * displayScale + 4,
                }}
              >
                <div className="w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => hideImage(editImageMenu)}
                    className="block w-full text-left rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Hide image
                  </button>
                  <button
                    type="button"
                    onClick={() => replaceImage(editImageMenu)}
                    className="block w-full text-left rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Replace image…
                  </button>
                </div>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onReplaceImageFile(e.target.files?.[0] ?? undefined)}
            />
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

      {menu && <button aria-hidden className="fixed inset-0 z-[45] cursor-default" onPointerDown={() => setMenu(null)} tabIndex={-1} />}
      {decoOpen && <DecoDialog initial={deco} onClose={() => setDecoOpen(false)} onApply={(next) => { setDeco(next); setDecoOpen(false); }} />}
      {protectOpen && <ProtectDialog initial={protect} onClose={() => setProtectOpen(false)} onApply={(next) => { setProtect(next); setProtectOpen(false); }} />}
      {passwordPrompt && <PasswordPromptDialog fileName={passwordPrompt.name} onCancel={() => setPasswordPrompt(null)} onUnlock={handlePasswordPrompt} />}
      {signOpen && <SignDialog onClose={() => { setSignOpen(false); pendingSignRef.current = null; }} onSave={(sig) => { saveSignature(sig); setSignOpen(false); const p = pendingSignRef.current; pendingSignRef.current = null; if (p) placeSignature(sig, p); }} />}

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
function dimsCountAfterDelete(n: number): number {
  return Math.max(1, n - 1);
}

interface MenuActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  role?: string;
}

function MenuAction({ icon, label, onClick, disabled, danger, role }: MenuActionProps) {
  return (
    <button
      type="button"
      role={role || "menuitem"}
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        disabled
          ? "text-slate-300 cursor-not-allowed"
          : danger
            ? "text-red-600 hover:bg-red-50"
            : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function DecoDialog({
  initial,
  onClose,
  onApply,
}: {
  initial: PageDecorationOptions;
  onClose: () => void;
  onApply: (next: PageDecorationOptions) => void;
}) {
  const [draft, setDraft] = useState<PageDecorationOptions>(initial);
  const update = (patch: Partial<PageDecorationOptions>) => setDraft((d) => ({ ...d, ...patch }));
  const positions: { value: PageDecorationOptions["position"]; label: string }[] = [
    { value: "center", label: "Center" },
    { value: "topLeft", label: "Top left" },
    { value: "topRight", label: "Top right" },
    { value: "bottomLeft", label: "Bottom left" },
    { value: "bottomRight", label: "Bottom right" },
    { value: "bottomCenter", label: "Bottom center" },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">Watermark & page numbers</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="accent-indigo-600" />
              Enabled on export
            </label>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Decoration</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["watermark", "pageNumber", "header", "footer"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => update({ kind: k })}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium border transition ${
                    draft.kind === k ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {k === "watermark" ? "Watermark" : k === "pageNumber" ? "Page number" : k === "header" ? "Header" : "Footer"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Text — use {"{n}"} and {"{N}"} for page numbers</label>
            <input
              type="text"
              value={draft.text}
              onChange={(e) => update({ text: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Size</label>
              <input type="number" min={6} max={200} value={draft.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) || 18 })} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Opacity</label>
              <input type="text" inputMode="decimal" value={String(draft.opacity)} onChange={(e) => update({ opacity: Math.min(1, Math.max(0, Number(e.target.value) || 0)) })} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Position</label>
            <div className="flex flex-wrap gap-1.5">
              {positions.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => update({ position: p.value })}
                  className={`rounded-lg px-2 py-1 text-xs font-medium border transition ${
                    draft.position === p.value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Color</label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={draft.color} onChange={(e) => update({ color: e.target.value })} className="w-9 h-8 rounded border border-slate-300 cursor-pointer" />
              <span className="text-xs text-slate-400">{draft.color}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => onApply(draft)}>Apply</Button>
        </div>
      </div>
    </div>
  );
}

function ProtectDialog({
  initial,
  onClose,
  onApply,
}: {
  initial: { userPassword: string; ownerPassword: string; allowPrinting: boolean; allowCopying: boolean };
  onClose: () => void;
  onApply: (next: { userPassword: string; ownerPassword: string; allowPrinting: boolean; allowCopying: boolean }) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const update = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-indigo-500" />
          <h3 className="text-base font-semibold text-slate-800">Protect with password</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Password to open the PDF</label>
            <input type="password" value={draft.userPassword} onChange={(e) => update({ userPassword: e.target.value })} placeholder="Leave blank for no open password" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Owner password (restricts editing)</label>
            <input type="password" value={draft.ownerPassword} onChange={(e) => update({ ownerPassword: e.target.value })} placeholder="Optional" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="flex items-center gap-1.5">
            <input id="protect-print" type="checkbox" checked={draft.allowPrinting} onChange={(e) => update({ allowPrinting: e.target.checked })} className="accent-indigo-600" />
            <label htmlFor="protect-print" className="text-slate-600">Allow printing</label>
          </div>
          <div className="flex items-center gap-1.5">
            <input id="protect-copy" type="checkbox" checked={draft.allowCopying} onChange={(e) => update({ allowCopying: e.target.checked })} className="accent-indigo-600" />
            <label htmlFor="protect-copy" className="text-slate-600">Allow copying text</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => onApply(draft)}>Protect</Button>
        </div>
      </div>
    </div>
  );
}

function PasswordPromptDialog({
  fileName,
  onCancel,
  onUnlock,
}: {
  fileName: string;
  onCancel: () => void;
  onUnlock: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Unlock className="w-4 h-4 text-indigo-500" />
          <h3 className="text-base font-semibold text-slate-800">This PDF is password protected</h3>
        </div>
        <p className="text-sm text-slate-500 mb-3">Enter the password to open <span className="font-medium text-slate-700">{fileName}</span>.</p>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" && password.length > 0 && !busy) { setBusy(true); void onUnlock(password).then((ok) => { setBusy(false); setError(!ok); }); } }}
              placeholder="••••••••"
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
            />
            {error && <p className="mt-1 text-xs text-red-600">Incorrect password — try again.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={busy || password.length === 0} onClick={() => { setBusy(true); void onUnlock(password).then((ok) => { setBusy(false); setError(!ok); }); }}>
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SignDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (sig: SavedSignature) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState("");

  const getPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const drawTo = (pt: Point) => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const pts = pointsRef.current;
    const last = pts[pts.length - 1];
    pts.push(pt);
    if (last) drawSegment(ctx, last, pt, "#1e293b", 2.5, 1);
  };

  const renderTyped = (text: string) => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, 480, 180);
    if (!text.trim()) return;
    ctx.save();
    ctx.font = "56px 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive";
    ctx.fillStyle = "#1e293b";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 24, 92, 432);
    ctx.restore();
  };

  const captureCanvas = () => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
    let any = false;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const a = data[(y * c.width + x) * 4 + 3];
        if (a > 40) {
          any = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!any) return null;
    const crop = document.createElement("canvas");
    crop.width = maxX - minX + 1;
    crop.height = maxY - minY + 1;
    const cctx = crop.getContext("2d");
    if (!cctx) return null;
    cctx.drawImage(c, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const dataUrl = crop.toDataURL("image/png");
    return { dataUrl, width: crop.width, height: crop.height };
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <PenTool className="w-4 h-4 text-indigo-500" />
          <h3 className="text-base font-semibold text-slate-800">
            {mode === "draw" ? "Draw your signature" : "Type your signature"}
          </h3>
        </div>
        <div className="flex items-center gap-1 mb-3">
          <button
            type="button"
            onClick={() => { setMode("draw"); pointsRef.current = []; }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${mode === "draw" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Draw
          </button>
          <button
            type="button"
            onClick={() => { setMode("type"); renderTyped(typed); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${mode === "type" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Type
          </button>
        </div>
        {mode === "type" && (
          <input
            type="text"
            value={typed}
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
            onInput={(e) => renderTyped((e.target as HTMLInputElement).value)}
            placeholder="Type your full name"
            aria-label="Typed signature name"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 mb-3 focus:border-indigo-500 focus:outline-none"
          />
        )}
        <canvas
          ref={canvasRef}
          width={480}
          height={180}
          onPointerDown={(e) => {
            if (mode !== "draw") return;
            drawing.current = true;
            pointsRef.current = [];
            const ctx = canvasRef.current?.getContext("2d");
            ctx?.clearRect(0, 0, 480, 180);
            drawTo(getPt(e));
            try {
              canvasRef.current?.setPointerCapture(e.pointerId);
            } catch {
              // synthetic pointer
            }
          }}
          onPointerMove={(e) => {
            if (drawing.current && mode === "draw") drawTo(getPt(e));
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 touch-none"
          aria-label="Signature canvas"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            onClick={() => {
              if (mode === "type") {
                renderTyped(typed);
                const cap = captureCanvas();
                if (!cap) {
                  onClose();
                  return;
                }
                onSave(cap);
                return;
              }
              const pts = pointsRef.current;
              if (pts.length < 2) {
                onClose();
                return;
              }
              const xs = pts.map((p) => p.x);
              const ys = pts.map((p) => p.y);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const maxX = Math.max(...xs);
              const maxY = Math.max(...ys);
              const norm = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
              onSave({ points: norm, width: maxX - minX, height: maxY - minY });
            }}
          >
            Use signature
          </Button>
        </div>
      </div>
    </div>
  );
}

function drawPoint(ctx: CanvasRenderingContext2D, p: Point, color: string, width: number, opacity = 1) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawSegment(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number, opacity = 1) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
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
  if (RESIZABLE_KINDS.includes(ann.kind)) {
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