"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw, Upload } from "lucide-react";
import { Field, Button } from "@/components/ui";
import { formatBytes } from "@/lib/format";

interface ImageInfo {
  url: string;
  width: number;
  height: number;
}

function loadImage(file: File): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export default function ImageResizer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [working, setWorking] = useState(false);

  const handleFile = useCallback((selected: File | undefined) => {
    if (!selected) return;
    setFile(selected);
    setResultUrl(null);
    setResultSize(0);
    loadImage(selected)
      .then((img) => {
        setInfo(img);
        setWidth(img.width);
        setHeight(img.height);
      })
      .catch(() => setInfo(null));
  }, []);

  useEffect(() => {
    return () => {
      if (info) URL.revokeObjectURL(info.url);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [info, resultUrl]);

  const changeWidth = (w: number) => {
    const clamped = Math.max(1, Math.round(w));
    setWidth(clamped);
    if (lockAspect && info && info.width > 0) {
      setHeight(Math.max(1, Math.round((clamped * info.height) / info.width)));
    }
  };

  const changeHeight = (h: number) => {
    const clamped = Math.max(1, Math.round(h));
    setHeight(clamped);
    if (lockAspect && info && info.height > 0) {
      setWidth(Math.max(1, Math.round((clamped * info.width) / info.height)));
    }
  };

  const onResize = async () => {
    if (!info || !width || !height) return;
    setWorking(true);
    const img = new Image();
    img.src = info.url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    if (format === "jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    canvas.toBlob(
      (blob) => {
        setWorking(false);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setResultSize(blob.size);
      },
      mime,
      0.92
    );
  };

  return (
    <div className="space-y-6 w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">
            {file ? file.name : "Choose an image"}
          </h3>
          <p className="text-sm text-slate-500">
            {info
              ? `${info.width}×${info.height} · ${formatBytes(file?.size ?? 0)}`
              : "or drag & drop preferred — PNG, JPG, WebP"}
          </p>
        </div>
      </div>

      {info && (
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-4">
            <Field label={`Width (original ${info.width}px)`}>
              <input
                type="number"
                min={1}
                value={width}
                onChange={(e) => changeWidth(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </Field>
            <Field label={`Height (original ${info.height}px)`}>
              <input
                type="number"
                min={1}
                value={height}
                onChange={(e) => changeHeight(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(e) => setLockAspect(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Lock aspect ratio
            </label>
            <Field label="Output format">
              <div className="flex rounded-xl border border-slate-200 bg-white p-1 w-fit">
                {(["png", "jpeg", "webp"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium uppercase transition ${
                      format === f ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Field>
            <Button type="button" onClick={onResize} disabled={working} className="w-full">
              {working ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> Resizing…
                </>
              ) : (
                <>Resize image</>
              )}
            </Button>
          </div>

          <div>
            <div className="rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.url} alt="Preview" className="max-w-full max-h-72 object-contain" />
            </div>
            {resultUrl && (
              <div className="flex gap-3">
                <a
                  href={resultUrl}
                  download={`resized-${file?.name.replace(/\.[^.]+$/, "") || "image"}.${format}`}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" /> Download ({formatBytes(resultSize)})
                </a>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setResultUrl(null);
                    setResultSize(0);
                    setWidth(0);
                    setHeight(0);
                    setInfo(null);
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}