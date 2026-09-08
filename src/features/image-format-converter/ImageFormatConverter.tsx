"use client";

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { SliderField, Button } from "@/components/ui";

type Format = "image/png" | "image/jpeg" | "image/webp";

const FORMATS: { label: string; value: Format; ext: string }[] = [
  { label: "PNG", value: "image/png", ext: "png" },
  { label: "JPEG", value: "image/jpeg", ext: "jpg" },
  { label: "WebP", value: "image/webp", ext: "webp" },
];

export default function ImageFormatConverter() {
  const [src, setSrc] = useState("");
  const [name, setName] = useState("image");
  const [formatIdx, setFormatIdx] = useState(0);
  const [quality, setQuality] = useState(90);

  const format = FORMATS[formatIdx];
  const isJpeg = format.value === "image/jpeg";

  const onPick = (file: File) => {
    if (!file) return;
    setName(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const download = () => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (isJpeg) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.${format.ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, format.value, quality / 100);
    };
    img.src = src;
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <ImageDown className="w-4 h-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-slate-700">Image Format Converter</h2>
      </div>

      <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition">
        <span>Choose an image…</span>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} className="hidden" />
      </label>

      {src && <div className="rounded-2xl border border-slate-200 bg-slate-100 p-6 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Preview of ${name}`} className="max-h-72 max-w-full rounded-lg shadow object-contain" />
        </div>}

      {src && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Output format</label>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1 w-fit">
              {FORMATS.map((f, i) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setFormatIdx(i)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${i === formatIdx ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <SliderField label="Quality" value={quality} min={10} max={100} onChange={setQuality} unit="%" />
          <Button type="button" onClick={download}>Download {name}.{format.ext}</Button>
          {isJpeg && <p className="text-xs text-slate-400">JPEG does not support transparency — white background is applied.</p>}
        </div>
      )}
    </div>
  );
}