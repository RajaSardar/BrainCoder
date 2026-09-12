"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Brush,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  FilePlus2,
  Highlighter,
  Image,
  Minus,
  MousePointer2,
  Pen,
  Plus,
  Redo2,
  Signature,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  createId,
  drawAnnotation,
  getAnnotationBBox,
  hitTestAnnotation,
  loadImage,
  pointsToRect,
  resizeRect,
  translateAnnotation,
  type Annotation,
  type Point,
} from "@/features/pdf-editor/annotations";
import { downloadBlob } from "@/lib/download";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0f172a"];
const STROKE_WIDTHS = [
  { label: "S", value: 1.5 },
  { label: "M", value: 3 },
  { label: "L", value: 6 },
];
const FONT_SIZES = [12, 16, 21, 28];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const PAGE_PRESETS = [
  { label: "A4", w: 595, h: 842 },
  { label: "Letter", w: 612, h: 792 },
  { label: "Legal", w: 612, h: 1008 },
  { label: "A3", w: 842, h: 1191 },
  { label: "A5", w: 420, h: 595 },
];

type Tool =
  | "select"
  | "pen"
  | "brush"
  | "text"
  | "line"
  | "arrow"
  | "rect"
  | "oval"
  | "highlight"
  | "image"
  | "sign";

interface Page {
  annotations: Annotation[];
}

interface SavedSignature {
  points?: Point[];
  width: number;
  height: number;
  dataUrl?: string;
}

const RESIZABLE_KINDS: Annotation["kind"][] = ["rect", "oval", "highlight", "image"];

function loadSignatures(): SavedSignature[] {
  try {
    const raw = window.localStorage.getItem("pdf-editor.signatures");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const legacy = window.localStorage.getItem("pdf-editor.signature");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed) return [parsed];
    }
  } catch {
    // ignore
  }
  return [];
}

function Thumb({
  anns,
  dim,
  bg,
  active,
  onClick,
  label,
}: {
  anns: Annotation[];
  dim: { width: number; height: number };
  bg: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const s = 0.12;
    c.width = Math.max(1, Math.floor(dim.width * s));
    c.height = Math.max(1, Math.floor(dim.height * s));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, dim.width, dim.height);
    for (const a of anns) drawAnnotation(ctx, a);
    ctx.restore();
  }, [anns, dim, bg]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`w-full rounded-lg border-2 p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        active ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <canvas ref={ref} style={{ aspectRatio: `${dim.width} / ${dim.height}` }} className="w-full h-auto" />
    </button>
  );
}

export default function PdfCreator() {
  const [pages, setPages] = useState<Page[]>([{ annotations: [] }]);
  const [active, setActive] = useState(0);
  const [dim, setDim] = useState({ width: 595, height: 842 });
  const [bgColor, setBgColor] = useState("#ffffff");

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1].value);
  const [fontSize, setFontSize] = useState(16);
  const [zoom, setZoom] = useState(1);
  const [sigIndex, setSigIndex] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Page[][]>([]);
  const [redoStack, setRedoStack] = useState<Page[][]>([]);
  const undoRef = useRef<Page[][]>([]);
  const redoRef = useRef<Page[][]>([]);
  const pagesRef = useRef<Page[]>(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [live, setLive] = useState<Annotation | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingImg = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    type: "draw" | "move" | "resize";
    tool?: Tool;
    anchor: Point;
    points?: Point[];
    id?: string;
    handle?: number;
    orig?: Annotation;
    start?: Point;
  } | null>(null);

  const sigs = useMemo(() => loadSignatures(), []);
  const safeSigIndex = Math.min(sigIndex, Math.max(0, sigs.length - 1));
  const curPage = pages[active];

  function snapshot() {
    undoRef.current.push(pagesRef.current);
    if (undoRef.current.length > 50) undoRef.current.shift();
    redoRef.current = [];
    setUndoStack([...undoRef.current]);
    setRedoStack([]);
  }

  function apply(pageList: Page[]) {
    pagesRef.current = pageList;
    setPages(pageList);
  }

  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(pagesRef.current);
    pagesRef.current = prev;
    setPages(prev);
    setActive((a) => Math.min(a, prev.length - 1));
    setSelectedId(null);
    setUndoStack([...undoRef.current]);
    setRedoStack([...redoRef.current]);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(pagesRef.current);
    pagesRef.current = next;
    setPages(next);
    setActive((a) => Math.min(a, next.length - 1));
    setSelectedId(null);
    setUndoStack([...undoRef.current]);
    setRedoStack([...redoRef.current]);
  }

  function mutate(updater: (pageList: Page[]) => Page[]) {
    snapshot();
    apply(updater(pagesRef.current));
  }

  useEffect(() => {
    const sub = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && tool === "select" && selectedId) {
        e.preventDefault();
        mutate((list) =>
          list.map((p, i) =>
            i === active ? { annotations: p.annotations.filter((a) => a.id !== selectedId) } : p
          )
        );
        setSelectedId(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", sub);
    return () => window.removeEventListener("keydown", sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, selectedId, active]);

  // Draw main canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = Math.max(1, Math.floor(dim.width * zoom));
    c.height = Math.max(1, Math.floor(dim.height * zoom));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, dim.width, dim.height);
    for (const a of curPage.annotations) drawAnnotation(ctx, a);
    if (live) drawAnnotation(ctx, live);
    if (tool === "select" && selectedId) {
      const sel = curPage.annotations.find((a) => a.id === selectedId);
      if (sel) {
        const box = getAnnotationBBox(sel, ctx);
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(box.x - 4 / zoom, box.y - 4 / zoom, box.width + 8 / zoom, box.height + 8 / zoom);
        ctx.setLineDash([]);
        if (RESIZABLE_KINDS.includes(sel.kind)) {
          const h = 10 / zoom;
          for (const [hx, hy] of [
            [box.x, box.y],
            [box.x + box.width, box.y],
            [box.x, box.y + box.height],
            [box.x + box.width, box.y + box.height],
          ] as const) {
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#2563eb";
            ctx.fillRect(hx - h / 2, hy - h / 2, h, h);
            ctx.strokeRect(hx - h / 2, hy - h / 2, h, h);
          }
        }
      }
    }
    ctx.restore();
  }, [pages, active, dim, bgColor, zoom, tool, selectedId, live, curPage]);

  function toPage(e: { clientX: number; clientY: number }): Point {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }

  function startDraw(t: Tool, p: Point) {
    if (t === "pen" || t === "brush") {
      const ann: Annotation = {
        id: createId(),
        kind: t,
        color,
        lineWidth: t === "brush" ? strokeWidth * 3 : strokeWidth,
        opacity: 0.45,
        points: [p],
      };
      dragRef.current = { type: "draw", tool: t, anchor: p, points: [p] };
      setLive(ann);
    } else if (t === "line" || t === "arrow") {
      dragRef.current = { type: "draw", tool: t, anchor: p };
      setLive({ id: createId(), kind: t, color, lineWidth: strokeWidth, start: p, end: p });
    } else {
      const kind = t === "rect" ? "rect" : t === "oval" ? "oval" : "highlight";
      dragRef.current = { type: "draw", tool: t, anchor: p };
      setLive({
        id: createId(),
        kind,
        color: t === "highlight" ? color : color,
        lineWidth: strokeWidth,
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
      });
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const p = toPage(e);
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events have no active pointer; drawing still works via dragRef
    }
    setDraft(null);
    if (tool === "text") {
      setDraft({ x: p.x, y: p.y });
      return;
    }
    if (tool === "image") {
      pendingImg.current = p;
      fileRef.current?.click();
      return;
    }
    if (tool === "sign") {
      placeSignature(p);
      return;
    }
    if (tool === "select") {
      selectDown(p);
      return;
    }
    startDraw(tool, p);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toPage(e);
    if (drag.type === "draw") {
      if (drag.tool === "pen" || drag.tool === "brush") {
        drag.points?.push(p);
        setLive({
          id: drag.points?.[0] ? `${drag.points[0].x}-${drag.points[0].y}` : createId(),
          kind: drag.tool,
          color,
          lineWidth: drag.tool === "brush" ? strokeWidth * 3 : strokeWidth,
          opacity: 0.45,
          points: [...(drag.points ?? [])],
        });
        return;
      }
      if (drag.tool === "line" || drag.tool === "arrow") {
        setLive({
          id: "live-line",
          kind: drag.tool,
          color,
          lineWidth: strokeWidth,
          start: drag.anchor,
          end: p,
        });
        return;
      }
      const kind = drag.tool === "rect" ? "rect" : drag.tool === "oval" ? "oval" : "highlight";
      const box = pointsToRect(drag.anchor, p);
      setLive({ id: "live-shape", kind, color, lineWidth: strokeWidth, ...box });
      return;
    }
    if (drag.type === "move" && drag.id && drag.orig && drag.start) {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      const moved = translateAnnotation(drag.orig, dx, dy);
      applyPageAnnotation(drag.id, moved);
      return;
    }
    if (drag.type === "resize" && drag.id && drag.orig && drag.handle !== undefined) {
      applyPageAnnotation(drag.id, resizeRect(drag.orig, drag.handle, p));
    }
  }

  function applyPageAnnotation(id: string, next: Annotation) {
    setPages((list) =>
      list.map((pg, i) =>
        i === active ? { annotations: pg.annotations.map((a) => (a.id === id ? next : a)) } : pg
      )
    );
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag && drag.type === "draw") {
      const p = toPage(e as unknown as { clientX: number; clientY: number });
      if (drag.tool === "pen" || drag.tool === "brush") {
        const pts = [...(drag.points ?? [])];
        if (pts.length > 0) {
          const ann: Annotation = {
            id: createId(),
            kind: drag.tool,
            color,
            lineWidth: drag.tool === "brush" ? strokeWidth * 3 : strokeWidth,
            opacity: 0.45,
            points: pts.length === 1 ? [pts[0], { x: pts[0].x + 0.5, y: pts[0].y + 0.5 }] : pts,
          };
          mutate((list) =>
            list.map((pg, i) =>
              i === active ? { annotations: [...pg.annotations, ann] } : pg
            )
          );
        }
      } else if (drag.tool === "line" || drag.tool === "arrow") {
        const ann: Annotation = {
          id: createId(),
          kind: drag.tool,
          color,
          lineWidth: strokeWidth,
          start: drag.anchor,
          end: p,
        };
        mutate((list) =>
          list.map((pg, i) => (i === active ? { annotations: [...pg.annotations, ann] } : pg))
        );
      } else {
        const kind = drag.tool === "rect" ? "rect" : drag.tool === "oval" ? "oval" : "highlight";
        const box = pointsToRect(drag.anchor, p);
        if (box.width >= 4 && box.height >= 4) {
          const ann: Annotation = {
            id: createId(),
            kind,
            color,
            lineWidth: strokeWidth,
            ...box,
          };
          mutate((list) =>
            list.map((pg, i) => (i === active ? { annotations: [...pg.annotations, ann] } : pg))
          );
        }
      }
    }
    dragRef.current = null;
    setLive(null);
  }

  function selectDown(p: Point) {
    const ctx = canvasRef.current?.getContext("2d");
    const hit = [...curPage.annotations]
      .reverse()
      .find((a) => ctx && hitTestAnnotation(a, p, ctx));
    if (hit) {
      setSelectedId(hit.id);
      const box = getAnnotationBBox(hit, ctx!);
      const handle = RESIZABLE_KINDS.includes(hit.kind)
        ? handleIndex(p, box)
        : -1;
      if (handle >= 0) {
        dragRef.current = { type: "resize", id: hit.id, handle, orig: hit, anchor: p };
        snapshot();
      } else {
        dragRef.current = { type: "move", id: hit.id, orig: hit, start: p, anchor: p };
        snapshot();
      }
      return;
    }
    setSelectedId(null);
  }

  function handleIndex(p: Point, box: { x: number; y: number; width: number; height: number }): number {
    const h = 10;
    const corners = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ];
    for (let i = 0; i < corners.length; i++) {
      if (Math.abs(p.x - corners[i][0]) <= h && Math.abs(p.y - corners[i][1]) <= h) return i;
    }
    return -1;
  }

  function placeSignature(p: Point) {
    const list = sigs.length > 0 ? sigs : loadSignatures();
    const sig = list[safeSigIndex];
    if (!sig) {
      setMessage("No saved signature yet — create one in the PDF Editor first.");
      return;
    }
    const targetW = Math.min(200, dim.width * 0.5);
    const ratio = targetW / Math.max(1, sig.width || targetW);
    const targetH = (sig.height || targetW) * ratio;
    const x = p.x - targetW / 2;
    const y = p.y - targetH / 2;
    const ann: Annotation =
      sig.dataUrl && sig.dataUrl.startsWith("data:image")
        ? {
            id: createId(),
            kind: "image",
            color: "#2563eb",
            dataUrl: sig.dataUrl,
            x,
            y,
            width: targetW,
            height: targetH,
          }
        : {
            id: createId(),
            kind: "pen",
            color: "#1e293b",
            lineWidth: 1.6,
            points: (sig.points ?? []).map((pt) => ({
              x: x + pt.x * ratio,
              y: y + pt.y * ratio,
            })),
          };
    mutate((list) =>
      list.map((pg, i) => (i === active ? { annotations: [...pg.annotations, ann] } : pg))
    );
  }

  function commitDraft(value: string) {
    if (draft) {
      const lines = value.split("\n");
      const ann: Annotation = {
        id: createId(),
        kind: "text",
        color,
        fontSize,
        text: value,
        x: draft.x,
        y: draft.y,
        width: Math.max(...lines.map((l) => l.length)) * fontSize * 0.55,
        height: lines.length * fontSize * 1.2,
      };
      mutate((list) =>
        list.map((pg, i) => (i === active ? { annotations: [...pg.annotations, ann] } : pg))
      );
    }
    setDraft(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const img = loadImage(dataUrl);
      const at = pendingImg.current ?? { x: 100, y: 100 };
      const tw = Math.min(220, dim.width * 0.5);
      const th = img && img.naturalHeight > 0 ? (img.naturalHeight / Math.max(1, img.naturalWidth)) * tw : tw * 0.75;
      const ann: Annotation = {
        id: createId(),
        kind: "image",
        color: "#2563eb",
        dataUrl,
        x: at.x - tw / 2,
        y: at.y - th / 2,
        width: tw,
        height: th,
      };
      mutate((list) =>
        list.map((pg, i) => (i === active ? { annotations: [...pg.annotations, ann] } : pg))
      );
    };
    reader.readAsDataURL(file);
  }

  const addPage = () => {
    mutate((list) => [...list.map((p) => ({ annotations: [...p.annotations] })), { annotations: [] }]);
    setActive((n) => n + 1);
    setSelectedId(null);
  };
  const duplicatePage = () => {
    mutate((list) => {
      const next = [...list.map((p) => ({ annotations: [...p.annotations] }))];
      next.splice(active + 1, 0, { annotations: [...curPage.annotations] });
      return next;
    });
    setActive((n) => n + 1);
  };
  const removePage = () => {
    if (pages.length <= 1) return;
    mutate((list) => list.filter((_, i) => i !== active));
    setActive((n) => Math.max(0, n - 1));
    setSelectedId(null);
  };
  const movePage = (dir: -1 | 1) => {
    const to = active + dir;
    if (to < 0 || to >= pages.length) return;
    mutate((list) => {
      const next = [...list.map((p) => ({ annotations: [...p.annotations] }))];
      const [moved] = next.splice(active, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setActive(to);
  };

  const setPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pr = PAGE_PRESETS.find((p) => p.label === e.target.value);
    if (pr) setDim({ width: pr.w, height: pr.h });
  };

  const toggleOrientation = () => {
    setDim(({ width, height }) => ({ width: height, height: width }));
  };

  const exportPdfBytes = async (): Promise<Uint8Array> => {
    const { PDFDocument } = await import("pdf-lib");
    const out = await PDFDocument.create();
    const S = 2;
    for (const pg of pages) {
      const c = document.createElement("canvas");
      c.width = Math.floor(dim.width * S);
      c.height = Math.floor(dim.height * S);
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.scale(S, S);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dim.width, dim.height);
      for (const a of pg.annotations) {
        ctx.save();
        try {
          drawAnnotation(ctx, a);
        } catch {
          // skip broken annotation
        }
        ctx.restore();
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        c.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = await out.embedJpg(bytes);
      const p = out.addPage([dim.width, dim.height]);
      p.drawImage(img, { x: 0, y: 0, width: dim.width, height: dim.height });
    }
    return out.save();
  };

  const downloadPdf = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const bytes = await exportPdfBytes();
      downloadBlob(bytes, "created.pdf");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadPng = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const c = document.createElement("canvas");
      const S = 2;
      c.width = Math.floor(dim.width * S);
      c.height = Math.floor(dim.height * S);
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.scale(S, S);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dim.width, dim.height);
      for (const a of curPage.annotations) drawAnnotation(ctx, a);
      const blob = await new Promise<Blob | null>((resolve) =>
        c.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Render failed");
      downloadBlob(new Uint8Array(await blob.arrayBuffer()), "page.png", "image/png");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const zoomOut = () => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)]);
  const zoomIn = () => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)]);

  const toolBtn = (id: Tool, label: string, icon: React.ReactNode) => (
    <button
      key={id}
      type="button"
      aria-label={label}
      aria-pressed={tool === id}
      title={label}
      onClick={() => {
        setTool(id);
        setSelectedId(null);
        setDraft(null);
      }}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        tool === id
          ? "border-indigo-600 bg-indigo-600 text-white shadow"
          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex h-full w-full flex-col bg-slate-100">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
        aria-hidden
        tabIndex={-1}
      />
      <header className="flex h-16 items-center gap-2 border-b border-slate-200 bg-white px-3">
        <span className="hidden sm:block text-sm font-bold text-slate-900 mr-1 whitespace-nowrap">
          Create PDF
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Undo"
            disabled={undoStack.length === 0}
            onClick={undo}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            disabled={redoStack.length === 0}
            onClick={redo}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1" />
        <span className="hidden md:block text-xs text-slate-500 mr-2 whitespace-nowrap">
          Page {active + 1} of {pages.length}
        </span>
        <button
          type="button"
          aria-label="Download PNG"
          title="Download current page as PNG"
          onClick={downloadPng}
          disabled={busy}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Image className="h-4 w-4" /> <span className="hidden sm:inline">PNG</span>
        </button>
        <button
          type="button"
          aria-label="Download PDF"
          onClick={downloadPdf}
          disabled={busy}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Download className="h-4 w-4" /> {busy ? "Exporting…" : "Download PDF"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-slate-200 bg-white p-2 lg:flex">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Pages</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Add page"
                title="Add page"
                onClick={addPage}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Duplicate page"
                title="Duplicate current page"
                onClick={duplicatePage}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Delete page"
                title="Delete current page"
                disabled={pages.length <= 1}
                onClick={removePage}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:text-slate-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {pages.map((pg, i) => (
              <div key={i} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={i > 0 ? `Move page up` : undefined}
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => movePage(-1)}
                  className="flex h-6 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Thumb
                  anns={pg.annotations}
                  dim={dim}
                  bg={bgColor}
                  active={i === active}
                  onClick={() => {
                    setActive(i);
                    setSelectedId(null);
                  }}
                  label={`Select page ${i + 1}`}
                />
                <button
                  type="button"
                  aria-label={i < pages.length - 1 ? "Move page down" : undefined}
                  title="Move down"
                  disabled={i === pages.length - 1}
                  onClick={() => movePage(1)}
                  className="flex h-6 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-2 rounded-xl border border-slate-200 p-2">
            <div className="flex items-center gap-2">
              <label htmlFor="pdf-creator-page-size" className="text-xs font-semibold text-slate-600">
                Size
              </label>
              <select
                id="pdf-creator-page-size"
                aria-label="Page size"
                value={PAGE_PRESETS.find((p) => p.w === dim.width && p.h === dim.height)?.label ?? "Custom"}
                onChange={setPreset}
                className="h-8 flex-1 rounded-lg border border-slate-300 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PAGE_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                aria-label="Page width"
                type="number"
                min={100}
                max={3000}
                value={Math.round(dim.width)}
                onChange={(e) => setDim((d) => ({ ...d, width: Math.max(100, Number(e.target.value) || d.width) }))}
                className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400">×</span>
              <input
                aria-label="Page height"
                type="number"
                min={100}
                max={3000}
                value={Math.round(dim.height)}
                onChange={(e) => setDim((d) => ({ ...d, height: Math.max(100, Number(e.target.value) || d.height) }))}
                className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                aria-label="Swap orientation"
                title="Swap width and height"
                onClick={toggleOrientation}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <FilePlus2 className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="pdf-creator-bg" className="text-xs font-semibold text-slate-600">
                Background
              </label>
              <input
                id="pdf-creator-bg"
                aria-label="Background color"
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-8 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
            {toolBtn("select", "Select", <MousePointer2 className="h-4 w-4" />)}
            {toolBtn("pen", "Pen", <Pen className="h-4 w-4" />)}
            {toolBtn("brush", "Brush", <Brush className="h-4 w-4" />)}
            {toolBtn("highlight", "Highlight", <Highlighter className="h-4 w-4" />)}
            {toolBtn("text", "Text", <Type className="h-4 w-4" />)}
            {toolBtn("rect", "Rectangle", <Square className="h-4 w-4" />)}
            {toolBtn("oval", "Oval", <Circle className="h-4 w-4" />)}
            {toolBtn("line", "Line", <Minus className="h-4 w-4" />)}
            {toolBtn("arrow", "Arrow", <ArrowUpRight className="h-4 w-4" />)}
            {toolBtn("image", "Image", <Image className="h-4 w-4" />)}
            {toolBtn("sign", "Signature", <Signature className="h-4 w-4" />)}
            <span className="mx-1 h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    color === c ? "border-slate-800 scale-110" : "border-white"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              {STROKE_WIDTHS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  aria-label={`Stroke ${s.label}`}
                  onClick={() => setStrokeWidth(s.value)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    strokeWidth === s.value
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {tool === "text" && (
              <div className="flex items-center gap-0.5">
                {FONT_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`Font size ${s}`}
                    onClick={() => setFontSize(s)}
                    className={`flex h-7 w-8 items-center justify-center rounded-lg text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      fontSize === s ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {tool === "sign" && sigs.length > 1 && (
              <div className="flex items-center gap-1">
                {sigs.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Use signature ${i + 1}`}
                    onClick={() => setSigIndex(i)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      safeSigIndex === i ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto bg-slate-200/70 p-4">
            <div className="relative mx-auto w-fit shadow-xl shadow-slate-900/10 ring-1 ring-slate-300">
              <canvas
                ref={canvasRef}
                aria-label="Creation canvas"
                className="block touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
              {draft && (
                <textarea
                  autoFocus
                  aria-label="Text box"
                  onBlur={(e) => commitDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitDraft((e.target as HTMLTextAreaElement).value);
                    if (e.key === "Escape") setDraft(null);
                  }}
                  defaultValue=""
                  placeholder="Type here…"
                  className="absolute resize-none rounded border-2 border-indigo-500 bg-white/95 text-slate-900 focus:outline-none"
                  style={{
                    left: draft.x * zoom,
                    top: draft.y * zoom,
                    width: Math.min(280 * zoom, dim.width * zoom - draft.x * zoom),
                    minHeight: Math.min(fontSize * 1.4, dim.height - draft.y) < 24 ? 24 : fontSize * 1.6,
                    fontSize: fontSize * zoom,
                    lineHeight: `${fontSize * 1.4}px`,
                  }}
                />
              )}
            </div>
          </div>

          <footer className="flex h-10 items-center justify-between border-t border-slate-200 bg-white px-3">
            <span className="text-xs text-slate-500">
              {zoom ? `${Math.round(zoom * 100)}%` : ""}
            </span>
            {message && <span className="text-xs font-semibold text-amber-600">{message}</span>}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={zoomOut}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Reset zoom"
                onClick={() => setZoom(1)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={zoomIn}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}