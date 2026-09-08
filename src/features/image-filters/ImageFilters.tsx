"use client";

import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

type Filter = "none" | "grayscale" | "invert" | "sepia" | "blur" | "contrast" | "brightness" | "hue-rotate";

const FILTERS: { label: string; value: Filter; css: string; hint: string }[] = [
  { label: "Original", value: "none", css: "", hint: "No filter." },
  { label: "Grayscale", value: "grayscale", css: "grayscale(1)", hint: "Removes color." },
  { label: "Invert", value: "invert", css: "invert(1)", hint: "Inverts all colors." },
  { label: "Sepia", value: "sepia", css: "sepia(0.85)", hint: "Vintage brown tones." },
  { label: "Blur", value: "blur", css: "blur(3px)", hint: "Softens detail." },
  { label: "Contrast", value: "contrast", css: "contrast(1.6)", hint: "Boosts contrast." },
  { label: "Brightness", value: "brightness", css: "brightness(1.4)", hint: "Brightens the image." },
  { label: "Hue-rotate", value: "hue-rotate", css: "hue-rotate(180deg)", hint: "Shifts hues 180°." },
];

export default function ImageFilters() {
  const [src, setSrc] = useState("");
  const [name, setName] = useState("filtered");
  const [filter, setFilter] = useState<Filter>("none");

  const onPick = (file: File) => {
    if (!file) return;
    setName(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const css = FILTERS.find((f) => f.value === filter)?.css ?? "";

  const download = () => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.filter = css;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}-${filter}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, "image/png");
    };
    img.src = src;
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <WandSparkles className="w-4 h-4 text-fuchsia-600" />
        <h2 className="text-sm font-semibold text-slate-700">Image Filters</h2>
      </div>

      <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 cursor-pointer hover:border-fuchsia-400 hover:bg-fuchsia-50/50 transition">
        <span>Choose an image…</span>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} className="hidden" />
      </label>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            title={f.hint}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${filter === f.value ? "bg-fuchsia-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-fuchsia-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {src && (
        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-6 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Filtered preview (${filter})`} style={{ filter: css }} className="max-h-80 max-w-full rounded-lg shadow object-contain" />
        </div>
      )}

      {src && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={download}>Download {filter}.png</Button>
          <CopyButton text={`filter: ${css || "none"};`} label="Copy CSS" />
        </div>
      )}
      <p className="text-xs text-slate-400">Filters render via CSS and are burnt into the downloaded PNG using the Canvas API.</p>
    </div>
  );
}