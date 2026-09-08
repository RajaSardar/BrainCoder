"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button, Field, CopyButton } from "@/components/ui";

const SAMPLE = `<h1 style="color:#6366f1; font-family: Arial, sans-serif;">BrainCoder</h1>
<p style="font-family: Arial, sans-serif; color:#334155;">Capture this block as an image.</p>`;

export default function HtmlToImage() {
  const [html, setHtml] = useState(SAMPLE);
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const capture = async () => {
    if (!previewRef.current) return;
    setBusy(true);
    setError("");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true,
      });
      const mime = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
      setDataUrl(canvas.toDataURL(mime, 0.92));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </Field>
        <Field label={`Scale: ${scale}x`}>
          <input
            type="range"
            min={1}
            max={4}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-40 accent-indigo-600"
          />
        </Field>
        <Button type="button" onClick={capture} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" /> : <Camera className="w-4 h-4 mr-1.5 inline" />}
          {busy ? "Capturing…" : "Capture"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">HTML</p>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={12}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-y"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Preview</p>
          <div
            ref={previewRef}
            style={{ width: 460 }}
            className="mx-auto rounded-2xl border border-slate-200 overflow-hidden bg-white"
          >
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {dataUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Captured output" className="max-h-40 rounded-lg" />
          <a
            href={dataUrl}
            download={`capture.${format === "jpeg" ? "jpg" : format}`}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
          >
            Download {format.toUpperCase()}
          </a>
          <CopyButton text={dataUrl} />
        </div>
      )}
    </div>
  );
}