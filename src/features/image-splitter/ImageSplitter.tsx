"use client";

import { useState } from "react";
import { Grid3x3 } from "lucide-react";
import { SliderField, Button } from "@/components/ui";

interface Tile {
  id: string;
  dataUrl: string;
  cols: number;
  rows: number;
}

export default function ImageSplitter() {
  const [src, setSrc] = useState("");
  const [name, setName] = useState("image");
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(2);
  const [tiles, setTiles] = useState<Tile[]>([]);

  const onPick = (file: File) => {
    if (!file) return;
    setName(file.name.replace(/\.[^.]+$/, ""));
    const img = new window.Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(String(reader.result));
      setTiles([]);
    };
    reader.readAsDataURL(file);
  };

  const split = () => {
    if (!src || !dims) return;
    const img = new window.Image();
    img.onload = () => {
      const c = Math.max(1, Math.min(cols, 12));
      const r = Math.max(1, Math.min(rows, 12));
      const tw = Math.floor(dims.w / c);
      const th = Math.floor(dims.h / r);
      const out: Tile[] = [];
      for (let y = 0; y < r; y++) {
        for (let x = 0; x < c; x++) {
          const canvas = document.createElement("canvas");
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.drawImage(img, x * tw, y * th, tw, th, 0, 0, tw, th);
          out.push({ id: `${y}-${x}`, dataUrl: canvas.toDataURL("image/png"), cols: c, rows: r });
        }
      }
      setTiles(out);
    };
    img.src = src;
  };

  const downloadOne = (tile: Tile, i: number) => {
    const a = document.createElement("a");
    a.href = tile.dataUrl;
    a.download = `${name}-${tile.rows}x${tile.cols}-${i + 1}.png`;
    a.click();
  };

  const downloadAll = () => {
    tiles.forEach((t, i) => setTimeout(() => downloadOne(t, i), i * 120));
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Grid3x3 className="w-4 h-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-slate-700">Image Splitter</h2>
      </div>

      <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 cursor-pointer hover:border-sky-400 hover:bg-sky-50/50 transition">
        <span>Choose an image…</span>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} className="hidden" />
      </label>

      {src && dims && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{name} · {dims.w}×{dims.h}px</span>
            <span className="font-mono">{tiles.length > 0 ? `${tiles.length} tiles` : ""}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <SliderField label="Columns" value={cols} min={1} max={12} onChange={setCols} />
            <SliderField label="Rows" value={rows} min={1} max={12} onChange={setRows} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={split}>Split into {cols * rows} tiles</Button>
            {tiles.length > 0 && (
              <button
                type="button"
                onClick={downloadAll}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
              >
                Download all ({tiles.length} PNGs)
              </button>
            )}
          </div>
        </div>
      )}

      {tiles.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 6)}, minmax(0, 1fr))` }}>
          {tiles.map((t, i) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-2 space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.dataUrl} alt={`Tile ${i + 1} of ${name}`} className="w-full rounded-lg object-contain bg-slate-50" />
              <button
                type="button"
                onClick={() => downloadOne(t, i)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                tile {i + 1}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">Tiles are exported at full resolution — edge cells may be slightly smaller when the image doesn’t divide evenly.</p>
    </div>
  );
}