"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, ImageDown, FileCode2 } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#eef2ff"/>
  <circle cx="150" cy="100" r="70" fill="#6366f1"/>
  <text x="150" y="112" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="28" font-weight="bold">Hello SVG</text>
</svg>`;

function svgUrl(svg: string): string {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  return URL.createObjectURL(blob);
}

export default function SvgToPng() {
  const [input, setInput] = useState(SAMPLE);
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<"png" | "webp" | "jpeg">("png");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [error, setError] = useState("");

  const url = useMemo(() => (input.trim() ? svgUrl(input) : ""), [input]);

  const convert = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setError("");
    await new Promise((r) => setTimeout(r, 0));
    const img = new Image();
    img.onload = () => {
      const w = Math.round((img.naturalWidth || 1) * scale);
      const h = Math.round((img.naturalHeight || 1) * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Canvas is not available in this browser.");
        setBusy(false);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      setPreview(canvas.toDataURL(`image/${format}`, 0.92));
      setDimensions(`${w} × ${h}px`);
      setBusy(false);
    };
    img.onerror = () => {
      setError("Could not render this SVG — check for missing width/height or invalid markup.");
      setPreview("");
      setDimensions("");
      setBusy(false);
    };
    img.src = url;
  };

  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = `svg-to-${format}.${format === "jpeg" ? "jpg" : format}`;
    a.click();
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block text-xs font-medium text-slate-500 mb-1">Scale</span>
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          >
            {[0.5, 1, 2, 3, 4].map((s) => (
              <option key={s} value={s}>×{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-slate-500 mb-1">Output</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          >
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
        <Button type="button" disabled={busy} onClick={() => void convert()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />} Convert
        </Button>
        {preview && (
          <Button type="button" variant="secondary" onClick={download}>
            <Download className="w-4 h-4" /> Download {dimensions}
          </Button>
        )}
      </div>

      {error && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
            <FileCode2 className="w-4 h-4 text-fuchsia-500" /> SVG markup
          </p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            Preview{dimensions && <span className="text-xs font-normal text-slate-400 ml-2">{dimensions}</span>}
          </p>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 min-h-[280px] flex items-center justify-center p-4">
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="SVG conversion preview" className="max-w-full h-auto shadow-lg rounded-lg" />
            ) : (
              <p className="text-sm text-slate-400">Rendered result appears here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}