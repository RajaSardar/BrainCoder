"use client";

import { useRef, useState } from "react";
import { Droplets, Loader2, FileText } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

export default function PdfWatermark() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [text, setText] = useState("CONFIDENTIAL");
  const [size, setSize] = useState(48);
  const [opacity, setOpacity] = useState(0.25);
  const [angle, setAngle] = useState(-45);
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
      setName(file.name);
      setBytes(new Uint8Array(data));
      setPageCount(doc.numPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const stamp = async () => {
    if (!bytes) return;
    const label = text.trim() || "CONFIDENTIAL";
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument, rgb, degrees } = await import("pdf-lib");
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const { StandardFonts } = await import("pdf-lib");
      const stdFont = await src.embedFont(StandardFonts.HelveticaBold);
      const opacityClamped = Math.min(1, Math.max(0.05, opacity));
      for (let i = 0; i < src.getPageCount(); i++) {
        const page = src.getPage(i);
        const { width, height } = page.getSize();
        const textWidth = stdFont.widthOfTextAtSize(label, size);
        page.drawText(label, {
          x: (width - textWidth) / 2,
          y: height / 2 - size / 2,
          size,
          font: stdFont,
          color: rgb(0.3, 0.3, 0.3),
          opacity: opacityClamped,
          rotate: degrees(angle),
        });
      }
      const out = await src.save();
      downloadBlob(out, `${name.replace(/\.pdf$/i, "")}-watermarked.pdf`);
      setMessage(`Watermarked “${label}” across ${src.getPageCount()} pages.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Watermark failed");
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
            : "Select a PDF to stamp a text watermark on every page."}
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
          <Field label="Watermark text">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              placeholder="CONFIDENTIAL"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={`Font size — ${size} pt`}>
              <input
                type="range"
                min={12}
                max={120}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </Field>
            <Field label={`Opacity — ${Math.round(opacity * 100)}%`}>
              <input
                type="range"
                min={5}
                max={90}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-full accent-indigo-600"
              />
            </Field>
            <Field label={`Angle — ${angle}°`}>
              <input
                type="range"
                min={-90}
                max={90}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </Field>
          </div>
          <Button type="button" disabled={busy} onClick={() => void stamp()}>
            <Droplets className="w-4 h-4 mr-1.5 inline" />
            {busy ? "Stamping…" : "Add watermark → download"}
          </Button>
        </div>
      )}
    </div>
  );
}
