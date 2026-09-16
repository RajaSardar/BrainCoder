"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  ImageIcon,
  Download,
  Loader2,
  X,
  RefreshCw,
  Lock,
} from "lucide-react";
import {
  compressImageFile,
  formatBytes,
  terminateImageWorker,
  type QualityPreset,
  type OutputFormat,
} from "./client-image";

const PRESETS: {
  id: QualityPreset;
  label: string;
  description: string;
  icon: string;
}[] = [
  { id: "light", label: "Light", description: "Best quality", icon: "🟢" },
  { id: "balanced", label: "Balanced", description: "Good balance", icon: "🟡" },
  { id: "strong", label: "Strong", description: "Smallest size", icon: "🔴" },
];

const FORMATS: { id: OutputFormat; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "webp", label: "WebP" },
  { id: "jpeg", label: "JPEG" },
  { id: "png", label: "PNG" },
  { id: "avif", label: "AVIF" },
];

const RESIZE_OPTIONS: { id: string; label: string; value: number | null }[] = [
  { id: "original", label: "Original size", value: null },
  { id: "1920", label: "Max 1920 px", value: 1920 },
  { id: "1280", label: "Max 1280 px", value: 1280 },
];

const IMAGE_ACCEPT = "image/*";

const RESULT_HEADING_ID = "image-compressor-result-heading";

export default function ImageCompressor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<QualityPreset>("balanced");
  const [format, setFormat] = useState<OutputFormat>("auto");
  const [resize, setResize] = useState<string>("original");
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof compressImageFile>> | null>(null);
  const [previewOn, setPreviewOn] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const busyRef = useRef(false);
  const tokenRef = useRef(0);
  const mountedRef = useRef(true);
  const resultUrlRef = useRef<string | null>(null);

  const clearResult = useCallback(() => {
    setResult(null);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
  }, []);

  const resetAll = useCallback(() => {
    if (busyRef.current) return;
    tokenRef.current++;
    setFile(null);
    clearResult();
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [clearResult]);

  const adjustSettings = useCallback(() => {
    if (busyRef.current) return;
    tokenRef.current++;
    clearResult();
    setError(null);
  }, [clearResult]);

  const handleFile = useCallback(
    (selected: File | null) => {
      if (busyRef.current) return;
      if (!selected) return;
      const isHeic =
        selected.type === "image/heic" ||
        selected.type === "image/heif" ||
        /\.(heic|heif)$/i.test(selected.name);
      if (isHeic) {
        setError("HEIC/HEIF images aren't supported in this browser. Convert to JPG or PNG first.");
        return;
      }
      if (!selected.size) {
        setError("This file is empty.");
        return;
      }
      if (selected.size > 50 * 1024 * 1024) {
        setError("File is too large. Please use an image under 50MB.");
        return;
      }
      if (!selected.type.startsWith("image/")) {
        setError("Please select a valid image file.");
        return;
      }
      tokenRef.current++;
      clearResult();
      setError(null);
      setFile(selected);
    },
    [clearResult]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!file || compressing || busyRef.current) return;
      busyRef.current = true;
      const token = tokenRef.current;
      setCompressing(true);
      setError(null);
      const resizeOpt = RESIZE_OPTIONS.find((r) => r.id === resize);
      compressImageFile(file, {
        preset,
        format,
        maxWidth: resizeOpt?.value ?? null,
        maxHeight: resizeOpt?.value ?? null,
      })
        .then((res) => {
          if (tokenRef.current !== token || !mountedRef.current) {
            URL.revokeObjectURL(res.url);
            return;
          }
          clearResult();
          resultUrlRef.current = res.url;
          setResult(res);
          setPreviewOn(true);
        })
        .catch((err) => {
          if (tokenRef.current !== token || !mountedRef.current) return;
          setError(
            err instanceof Error && err.message
              ? err.message
              : "Something went wrong while compressing. Please try again."
          );
        })
        .finally(() => {
          busyRef.current = false;
          if (tokenRef.current !== token || !mountedRef.current) return;
          setCompressing(false);
        });
    },
    [file, preset, format, resize, compressing, clearResult]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (file || busyRef.current) return;
      handleFile(e.dataTransfer.files?.[0] ?? null);
    },
    [file, handleFile]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      terminateImageWorker();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (result && resultHeadingRef.current) {
      resultHeadingRef.current.focus();
    }
  }, [result]);

  const appliedPresetLabel = PRESETS.find((p) => p.id === preset)?.label ?? "Balanced";
  const appliedFormatLabel = FORMATS.find((f) => f.id === format)?.label ?? "Auto";
  const appliedResizeLabel = RESIZE_OPTIONS.find((r) => r.id === resize)?.label ?? "Original size";

  const statusText = compressing
    ? "Compressing your image in your browser…"
    : error
      ? error
      : result
        ? result.skipped
          ? `Your original ${result.format.toUpperCase()} was returned unchanged (${formatBytes(result.originalSize)}).`
          : `Reduced from ${formatBytes(result.originalSize)} to ${formatBytes(result.compressedSize)} (−${Math.max(0, result.reductionPct)}%).`
        : file
          ? "Image ready to compress."
          : "Ready to compress an image.";

  return (
    <div className="w-full">
      <form onSubmit={onSubmit}>
        {/* Dropzone */}
        <div
          role="button"
          tabIndex={file ? -1 : 0}
          aria-disabled={!!file}
          aria-label={file ? "Image loaded — use Compress below" : "Upload an image"}
          onClick={() => {
            if (!file && !busyRef.current) fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (!file && !busyRef.current && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!file) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
            dragOver
              ? "border-pink-500 bg-pink-50/70 scale-[1.01]"
              : "border-slate-300 bg-white hover:border-pink-400 hover:bg-pink-50/30"
          } ${file ? "cursor-default" : "cursor-pointer"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            aria-label="Choose an image file"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col items-center gap-3">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition ${
                dragOver ? "bg-pink-500" : "bg-gradient-to-br from-rose-500 to-pink-600"
              }`}
            >
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h3 className="max-w-full text-xl font-semibold text-slate-800 [overflow-wrap:anywhere]">
              {file ? file.name : "Drop your image here"}
            </h3>
            <p className="text-sm text-slate-500">
              {file
                ? formatBytes(file.size)
                : "or click to browse — JPG, PNG, WebP, AVIF · up to 50 MB"}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
              <Lock className="w-3.5 h-3.5" />
              Files stay on your device. Nothing is uploaded.
            </div>
          </div>
        </div>

        {error && !compressing && (
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

        {file && !result && (
          <div className="mt-6 space-y-5">
            {/* File chip with remove */}
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
              <ImageIcon className="w-6 h-6 text-pink-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm [overflow-wrap:anywhere]">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={compressing}
                onClick={resetAll}
                className="min-h-11 min-w-11 flex items-center justify-center text-slate-500 hover:text-slate-600 disabled:opacity-50"
                aria-label="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preset selector */}
            <fieldset disabled={compressing}>
              <legend id="preset-legend" className="text-sm font-medium text-slate-700 mb-2">
                Compression level
              </legend>
              <div role="radiogroup" aria-labelledby="preset-legend" className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={preset === p.id}
                    onClick={() => setPreset(p.id)}
                    className={`rounded-xl border-2 px-2 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                      preset === p.id
                        ? "border-pink-500 bg-pink-50 ring-2 ring-pink-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span aria-hidden="true" className="block text-lg leading-none mb-1">{p.icon}</span>
                    <span
                      className={`block text-sm font-semibold ${
                        preset === p.id ? "text-pink-700" : "text-slate-700"
                      }`}
                    >
                      {p.label}
                    </span>
                    <span className="block text-xs text-slate-500">{p.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Output format */}
            <fieldset disabled={compressing}>
              <legend id="format-legend" className="text-sm font-medium text-slate-700 mb-2">
                Output format
              </legend>
              <div role="radiogroup" aria-labelledby="format-legend" className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={format === f.id}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-lg border-2 px-4 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                      format === f.id
                        ? "border-pink-500 bg-pink-50 text-pink-700 font-medium ring-2 ring-pink-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Resize */}
            <fieldset disabled={compressing}>
              <legend id="resize-legend" className="text-sm font-medium text-slate-700 mb-2">
                Resize (optional)
              </legend>
              <div role="radiogroup" aria-labelledby="resize-legend" className="flex flex-wrap gap-2">
                {RESIZE_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={resize === r.id}
                    onClick={() => setResize(r.id)}
                    className={`rounded-lg border-2 px-4 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                      resize === r.id
                        ? "border-pink-500 bg-pink-50 text-pink-700 font-medium ring-2 ring-pink-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={compressing}
              className="w-full bg-gradient-to-r from-rose-600 to-pink-700 text-white py-4 rounded-2xl font-semibold text-lg hover:from-rose-700 hover:to-pink-800 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
            >
              {compressing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" /> Compressing...
                </>
              ) : (
                <>Compress Image</>
              )}
            </button>
          </div>
        )}

        {result && (
          <div role="region" aria-labelledby={RESULT_HEADING_ID} className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <h4
                  id={RESULT_HEADING_ID}
                  ref={resultHeadingRef}
                  tabIndex={-1}
                  className="font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 rounded"
                >
                  {result.skipped ? "Original kept — already optimal" : "Compression complete"}
                </h4>
                <p className="text-xs text-slate-500">
                  {result.resized
                    ? `${result.originalWidth}×${result.originalHeight} → ${result.outputWidth}×${result.outputHeight}`
                    : `${result.originalWidth}×${result.originalHeight}`}{" "}
                  · {result.format.toUpperCase()}
                </p>
                <p className="text-xs text-slate-400">
                  Applied: {appliedPresetLabel} · {appliedFormatLabel} · {appliedResizeLabel}
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => setPreviewOn((v) => !v)}
                className="text-xs font-medium text-pink-600 hover:text-pink-700"
              >
                {previewOn ? "Hide preview" : "Show preview"}
              </button>
            </div>
            {previewOn && (
              <div className="mb-4 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center" style={{ maxHeight: 320 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.url}
                  alt="Result preview"
                  className="max-w-full object-contain"
                  style={{ maxHeight: 320 }}
                />
              </div>
            )}

            {/* Size comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Original</p>
                <p className="text-xl font-bold text-slate-800">{formatBytes(result.originalSize)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">{result.skipped ? "Unchanged" : "Compressed"}</p>
                <p className="text-xl font-bold text-green-600">{formatBytes(result.compressedSize)}</p>
              </div>
            </div>

            {/* Savings bar */}
            {result.originalSize > 0 && result.compressedSize > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{formatBytes(result.originalSize)}</span>
                  <span className="text-green-600 font-semibold">
                    −{Math.max(0, result.reductionPct)}%
                  </span>
                  <span>{formatBytes(result.compressedSize)}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all"
                    style={{ width: `${Math.max(0, result.reductionPct)}%` }}
                  />
                </div>
              </div>
            )}

            {result.skipped && (
              <p className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Your image was already optimal — your original {result.format.toUpperCase()} is
                returned unchanged, so the output is never larger than the upload.
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-6">
              <a
                href={result.url}
                download={`compressed-${file?.name.replace(/\.[^.]+$/, "") || "image"}.${result.extension}`}
                className="flex-1 bg-gradient-to-r from-rose-600 to-pink-700 text-white py-3 rounded-xl font-semibold hover:from-rose-700 hover:to-pink-800 transition flex items-center justify-center gap-2 shadow-md shadow-rose-500/20"
              >
                <Download className="w-5 h-5" /> Download
              </a>
              <button
                type="button"
                onClick={resetAll}
                className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition"
              >
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> New image
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={adjustSettings}
              className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700"
            >
              Adjust settings
            </button>
          </div>
        )}
      </form>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 text-sm text-slate-600">
        {statusText}
      </p>
    </div>
  );
}