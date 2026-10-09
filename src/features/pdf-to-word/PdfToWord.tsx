"use client";

import { useState } from "react";
import { Loader2, FileText, ShieldCheck } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { renderPdfPages, buildDocx } from "@/features/pdf-office/support";

function downloadBlob(bytes: Uint8Array, filename: string, type: string) {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PdfToWord() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [done, setDone] = useState(false);
  const [scale, setScale] = useState(2);
  const [totalPages, setTotalPages] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setDone(false);
    setPreview(null);
    try {
      const data = await file.arrayBuffer();
      const images = await renderPdfPages(data, scale);
      setTotalPages(images.length);
      setPreview(images[0]?.url ?? null);
      const docx = await buildDocx(images);
      const base = file.name.replace(/\.pdf$/i, "");
      downloadBlob(
        docx,
        `${base}.docx`,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      setFileName(`${base}.docx`);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message || "Your file could not be converted"}. Try a different PDF, or a lower quality scale.`
          : "Failed to convert PDF",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="space-y-5 w-full"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="pdf-file"
          type="file"
          accept="application/pdf"
          className="hidden"
          aria-label="Choose a PDF file to convert"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          onClick={() => document.getElementById("pdf-file")?.click()}
          disabled={busy}
        >
          <FileText className="w-4 h-4 mr-1.5 inline" /> Choose PDF
        </Button>
        <Field label={`Quality scale: ${scale}x`}>
          <input
            type="range"
            min={1}
            max={3}
            step={0.5}
            value={scale}
            aria-label="Quality scale"
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-40 accent-violet-600"
          />
        </Field>
        {done && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => document.getElementById("pdf-file")?.click()}
          >
            Convert another
          </Button>
        )}
      </div>

      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-slate-500"
        >
          <Loader2 className="w-4 h-4 animate-spin" /> Rendering pages &amp;
          building .docx…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      {!busy && !error && !done && (
        <div
          className={`rounded-2xl border-2 border-dashed p-10 text-center text-sm transition ${
            dragging
              ? "border-violet-400 bg-violet-50 text-violet-700"
              : "border-slate-200 bg-slate-50/50 text-slate-500"
          }`}
        >
          <p className="font-semibold">Drop your PDF here</p>
          <p className="mt-1">
            or click Choose PDF — every page becomes a full-page image in a
            new Word document. Fully client-side.
          </p>
        </div>
      )}

      {done && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 flex items-center gap-3"
        >
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">Saved {fileName}</p>
            <p className="text-emerald-700">
              {totalPages} page{totalPages === 1 ? "" : "s"} converted — your
              file never left this device.
            </p>
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 max-w-sm">
          <p className="text-xs text-slate-400 mb-2">First page preview</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="First page rendered as it will appear in the Word document"
            className="rounded-lg border border-slate-100 w-full"
          />
        </div>
      )}
    </div>
  );
}