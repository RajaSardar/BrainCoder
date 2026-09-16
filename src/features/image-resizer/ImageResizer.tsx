"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { formatBytes } from "@/lib/format";

const MAX_DIM = 8192;
const MAX_PIXELS = 40_000_000;

const PRESETS = [
  { label: "256×256", w: 256, h: 256 },
  { label: "640×360", w: 640, h: 360 },
  { label: "1080×1080", w: 1080, h: 1080 },
  { label: "1280×720", w: 1280, h: 720 },
  { label: "1920×1080", w: 1920, h: 1080 },
];

const RESULT_HEADING_ID = "image-resizer-result-heading";

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

function clampDim(v: number): number {
  const raw = Math.round(Number(v));
  return Number.isFinite(raw) ? Math.min(Math.max(1, raw), MAX_DIM) : 1;
}

export default function ImageResizer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const reqRef = useRef(0);
  const mountedRef = useRef(true);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [resultWidth, setResultWidth] = useState(0);
  const [resultHeight, setResultHeight] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (info) URL.revokeObjectURL(info.url);
    };
  }, [info]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  useEffect(() => {
    if (resultUrl && resultHeadingRef.current) {
      resultHeadingRef.current.focus();
    }
  }, [resultUrl]);

  const handleFile = useCallback(
    (selected: File | undefined) => {
      if (working) return;
      if (!selected) return;
      const req = ++reqRef.current;
      if (selected.size > 50 * 1024 * 1024) {
        setError("This file is too large. Please use an image under 50MB.");
        return;
      }
      if (info) URL.revokeObjectURL(info.url);
      setError(null);
      setFile(selected);
      setInfo(null);
      setResultUrl(null);
      setResultSize(0);
      setResultWidth(0);
      setResultHeight(0);
      setWidth(0);
      setHeight(0);
      loadImage(selected)
        .then((img) => {
          if (req !== reqRef.current || !mountedRef.current) {
            URL.revokeObjectURL(img.url);
            return;
          }
          setInfo(img);
          setWidth(img.width);
          setHeight(img.height);
        })
        .catch(() => {
          if (req !== reqRef.current || !mountedRef.current) return;
          setError("Couldn't read this image. Please try a PNG, JPG, or WebP.");
          setFile(null);
          setInfo(null);
          setWidth(0);
          setHeight(0);
        });
    },
    [info, working]
  );

  const changeWidth = useCallback(
    (w: number) => {
      const clamped = clampDim(w);
      setWidth(clamped);
      if (lockAspect && info && info.width > 0) {
        setHeight(clampDim(Math.round((clamped * info.height) / info.width)));
      }
    },
    [lockAspect, info]
  );

  const changeHeight = useCallback(
    (h: number) => {
      const clamped = clampDim(h);
      setHeight(clamped);
      if (lockAspect && info && info.height > 0) {
        setWidth(clampDim(Math.round((clamped * info.width) / info.height)));
      }
    },
    [lockAspect, info]
  );

  const onResize = async () => {
    if (!info || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return;
    const pixels = width * height;
    if (pixels > MAX_PIXELS || width > MAX_DIM || height > MAX_DIM) {
      setError("Target size is too large (max 8192px per side, ~40 megapixels).");
      return;
    }
    const req = ++reqRef.current;
    setWorking(true);
    setError(null);
    try {
      const img = new Image();
      img.src = info.url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Couldn't render this image in your browser.");
      if (format === "jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mime, 0.92);
      });
      if (req !== reqRef.current || !mountedRef.current) return;
      if (!blob) throw new Error("Couldn't encode the resized image.");
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultSize(blob.size);
      setResultWidth(width);
      setResultHeight(height);
    } catch (err) {
      if (req === reqRef.current) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't resize this image. Please try again."
        );
      }
    } finally {
      if (req === reqRef.current && mountedRef.current) setWorking(false);
    }
  };

  const resetAll = useCallback(() => {
    ++reqRef.current;
    setWorking(false);
    setError(null);
    setFile(null);
    setInfo(null);
    setResultUrl(null);
    setResultSize(0);
    setResultWidth(0);
    setResultHeight(0);
    setWidth(0);
    setHeight(0);
    setFormat("png");
    setLockAspect(true);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const downloadBase = file?.name.replace(/\.[^.]+$/, "").replace(/[\u0000-\u001f\u007f]/g, "") || "image";

  return (
    <div className="space-y-6 w-full">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={working}
        aria-label={file ? "Choose another image" : "Choose an image"}
        onClick={() => {
          if (!working) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (!working && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!working) handleFile(e.dataTransfer?.files?.[0]);
        }}
        className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
              : "or drop an image here — PNG, JPG, WebP"}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="min-h-9 min-w-9 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {info && file && (
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-4">
            <fieldset disabled={working}>
              <legend id="resizer-preset-legend" className="text-sm font-medium text-slate-700 mb-2">
                Common preset sizes
              </legend>
              <div role="radiogroup" aria-labelledby="resizer-preset-legend" className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    role="radio"
                    aria-checked={width === p.w && height === p.h}
                    disabled={working}
                    onClick={() => {
                      setWidth(p.w);
                      setHeight(p.h);
                    }}
                    className={`min-h-11 px-4 py-2 rounded-xl border-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      width === p.w && height === p.h
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label={`Width (original ${info.width}px)`}>
              <input
                type="number"
                min={1}
                max={MAX_DIM}
                value={width}
                disabled={working}
                onChange={(e) => changeWidth(Number(e.target.value))}
                aria-label="Width in pixels"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </Field>
            <Field label={`Height (original ${info.height}px)`}>
              <input
                type="number"
                min={1}
                max={MAX_DIM}
                value={height}
                disabled={working}
                onChange={(e) => changeHeight(Number(e.target.value))}
                aria-label="Height in pixels"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={lockAspect}
                disabled={working}
                onChange={(e) => setLockAspect(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Lock aspect ratio
            </label>

            <fieldset disabled={working}>
              <legend id="resizer-format-legend" className="text-sm font-medium text-slate-700 mb-2">
                Output format
              </legend>
              <div role="radiogroup" aria-labelledby="resizer-format-legend" className="flex flex-wrap gap-2">
                {(["png", "jpeg", "webp"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={format === f}
                    disabled={working}
                    onClick={() => setFormat(f)}
                    className={`min-h-11 px-4 py-1.5 rounded-lg text-sm font-medium uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      format === f
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </fieldset>

            <Button type="button" onClick={onResize} disabled={working} className="w-full">
              {working ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin motion-reduce:animate-none inline" /> Resizing…
                </>
              ) : (
                <>Resize image</>
              )}
            </Button>

            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-slate-600">
              {working
                ? "Resizing…"
                : resultUrl
                  ? `Done — resized to ${resultWidth}×${resultHeight} (${formatBytes(resultSize)})`
                  : "Image ready to resize."}
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl ?? info.url}
                alt={resultUrl ? "Resized image" : "Original image"}
                className="max-w-full max-h-72 object-contain"
              />
            </div>

            {resultUrl && (
              <div role="region" aria-labelledby={RESULT_HEADING_ID} className="space-y-2">
                <h3
                  ref={resultHeadingRef}
                  id={RESULT_HEADING_ID}
                  tabIndex={-1}
                  className="text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                >
                  Resized to {resultWidth}×{resultHeight}
                </h3>
                <a
                  href={resultUrl}
                  download={`resized-${downloadBase}.${format}`}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-emerald-700 transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Download className="w-4 h-4" /> Download ({formatBytes(resultSize)})
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={resetAll}
              aria-label="Reset"
              className="min-h-11 min-w-11 flex items-center justify-center border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}