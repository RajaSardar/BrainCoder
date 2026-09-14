"use client";

import { useRef, useState } from "react";
import { Crop as CropIcon, Loader2, FileText } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

export default function PdfCrop() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ratio, setRatio] = useState(0.75);
  const [top, setTop] = useState(0);
  const [right, setRight] = useState(0);
  const [bottom, setBottom] = useState(0);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await file.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;
      const page = await doc.getPage(1);
      const vp = page.getViewport({ scale: 0.85 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext("2d");
      if (ctx) await page.render({ canvas, viewport: vp }).promise;
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
      setRatio(vp.height / vp.width);
      setName(file.name);
      setBytes(new Uint8Array(data.slice(0)));
      setPageCount(doc.numPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const applyCrop = async () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (let i = 0; i < src.getPageCount(); i++) {
        const page = src.getPage(i);
        const { width, height } = page.getSize();
        const lm = (width * left) / 100;
        const rm = (width * right) / 100;
        const bm = (height * bottom) / 100;
        const tm = (height * top) / 100;
        const x = lm;
        const y = bm;
        const w = width - lm - rm;
        const h = height - tm - bm;
        page.setMediaBox(x, y, w, h);
        page.setCropBox(x, y, w, h);
      }
      const out = await src.save();
      downloadBlob(out, `${name.replace(/\.pdf$/i, "")}-cropped.pdf`);
      setMessage(`Cropped all ${src.getPageCount()} pages.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crop failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500">
          {name
            ? `${name} — ${pageCount} pages`
            : "Cut the margins of a PDF by percentage."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {bytes && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Top — ${top}%`}>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={top}
                  onChange={(e) => setTop(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </Field>
              <Field label={`Bottom — ${bottom}%`}>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={bottom}
                  onChange={(e) => setBottom(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </Field>
              <Field label={`Left — ${left}%`}>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={left}
                  onChange={(e) => setLeft(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </Field>
              <Field label={`Right — ${right}%`}>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={right}
                  onChange={(e) => setRight(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </Field>
            </div>
            <Button
              type="button"
              disabled={busy || top + right + bottom + left === 0}
              onClick={() => void applyCrop()}
            >
              <CropIcon className="w-4 h-4 mr-1.5 inline" />
              {busy ? "Cropping…" : "Crop all pages → download"}
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Preview (page 1)
            </p>
            <div
              className="relative mx-auto"
              style={{ aspectRatio: `1 / ${ratio}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Page 1 preview"
                className="absolute inset-0 w-full h-full object-contain rounded-xl"
              />
              <div
                className="absolute inset-0 border-2 border-indigo-500 shadow-[0_0_0_2000px_rgba(255,255,255,0.75)] rounded-lg"
                style={{
                  top: `${top}%`,
                  right: `${right}%`,
                  bottom: `${bottom}%`,
                  left: `${left}%`,
                }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              The highlighted area is what will remain after cropping.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
