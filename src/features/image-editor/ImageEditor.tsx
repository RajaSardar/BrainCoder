"use client";

import { useRef, useState } from "react";
import {
  Pen,
  Minus,
  Square,
  Circle,
  MoveUpRight,
  Type,
  Undo2,
  Eraser,
  Download,
  ImagePlus,
  Paintbrush,
} from "lucide-react";
import { Button } from "@/components/ui";

type Tool = "pen" | "line" | "rect" | "ellipse" | "arrow" | "text" | "eraser";

const TOOLS: { id: Tool; label: string; icon: typeof Pen }[] = [
  { id: "pen", label: "Brush", icon: Pen },
  { id: "line", label: "Line", icon: Minus },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "arrow", label: "Arrow", icon: MoveUpRight },
  { id: "text", label: "Text", icon: Type },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(4);
  const [fontSize, setFontSize] = useState(28);
  const [hasImage, setHasImage] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [fileName, setFileName] = useState("edited");
  const drawing = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const undoStack = useRef<string[]>([]);

  const setupCanvas = (width: number, height: number) => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const g = c.getContext("2d");
    if (g) {
      g.lineCap = "round";
      g.lineJoin = "round";
    }
  };

  const loadFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setupCanvas(img.naturalWidth, img.naturalHeight);
      const g = canvasRef.current?.getContext("2d");
      if (g) {
        g.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
        g.drawImage(img, 0, 0);
      }
      undoStack.current = [];
      setCanUndo(false);
      setHasImage(true);
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const newBlank = () => {
    setupCanvas(1200, 800);
    const g = canvasRef.current?.getContext("2d");
    if (g) {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, 1200, 800);
    }
    undoStack.current = [];
    setCanUndo(false);
    setHasImage(true);
    setFileName("canvas");
  };

  const snapshot = () => {
    const c = canvasRef.current;
    if (!c) return;
    if (undoStack.current.length > 50) undoStack.current.shift();
    undoStack.current.push(c.toDataURL("image/png"));
    setCanUndo(true);
  };

  const undo = () => {
    const c = canvasRef.current;
    if (!c) return;
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (!prev) {
      const g = c.getContext("2d");
      g?.clearRect(0, 0, c.width, c.height);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const g = c.getContext("2d");
      if (g) {
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0);
      }
    };
    img.src = prev;
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height,
    };
  };

  const restoreSnapshot = (url: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext("2d");
      if (g) {
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0);
      }
    };
    img.src = url;
  };

  const drawShape = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const c = canvasRef.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = size;
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const w = Math.abs(to.x - from.x);
    const h = Math.abs(to.y - from.y);
    if (tool === "line") {
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(to.x, to.y);
      g.stroke();
    } else if (tool === "rect") {
      g.strokeRect(x, y, w, h);
    } else if (tool === "ellipse") {
      g.beginPath();
      g.ellipse(from.x, from.y, w / 2, h / 2, 0, 0, Math.PI * 2);
      g.stroke();
    } else if (tool === "arrow") {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = Math.min(24, size * 6);
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(to.x, to.y);
      g.stroke();
      g.beginPath();
      g.moveTo(to.x, to.y);
      g.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
      g.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
      g.closePath();
      g.fill();
    }
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hasImage) return;
    e.preventDefault();
    const c = canvasRef.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const p = pos(e);
    drawing.current = true;
    start.current = p;
    snapshot();

    if (tool === "pen" || tool === "eraser") {
      g.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      g.lineWidth = size;
      g.beginPath();
      g.moveTo(p.x, p.y);
    } else if (tool === "text") {
      const text = window.prompt("Enter text:");
      if (text) {
        g.font = `${fontSize}px Arial, sans-serif`;
        g.fillStyle = color;
        g.fillText(text, p.x, p.y);
      }
      drawing.current = false;
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const c = canvasRef.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const p = pos(e);
    const base = undoStack.current[undoStack.current.length - 1];
    if (tool === "pen" || tool === "eraser") {
      g.lineTo(p.x, p.y);
      g.stroke();
    } else if (base) {
      restoreSnapshot(base);
      drawShape(start.current, p);
    }
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
  };

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${fileName}-edited.png`;
    a.click();
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="w-4 h-4 mr-1.5 inline" /> Open image
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="secondary" onClick={newBlank}>
          New blank
        </Button>
        <Button type="button" variant="secondary" onClick={undo} disabled={!canUndo}>
          <Undo2 className="w-4 h-4 mr-1.5 inline" /> Undo
        </Button>
        <Button type="button" variant="secondary" onClick={download} disabled={!hasImage}>
          <Download className="w-4 h-4 mr-1.5 inline" /> Download PNG
        </Button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" aria-label="Stroke color" />
        <label className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <Paintbrush className="w-4 h-4" /> Brush
          <input type="range" min={1} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24 accent-indigo-600" />
        </label>
        {tool === "text" && (
          <label className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
            Size <input type="range" min={12} max={120} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-24 accent-indigo-600" />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition ${
              tool === t.id ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 overflow-auto max-h-[560px]">
        {hasImage ? (
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            onPointerCancel={onUp}
            className="max-w-full h-auto rounded-lg shadow-lg bg-white"
            style={{ touchAction: "none", cursor: "crosshair" }}
          />
        ) : (
          <div className="text-center text-sm text-slate-500 py-16">
            Open an image or start with a blank canvas to begin drawing.
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Every stroke can be undone. Select a tool, pick a color and brush size, then draw directly on the canvas.
      </p>
    </div>
  );
}