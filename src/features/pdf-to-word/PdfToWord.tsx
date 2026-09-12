"use client";

import { useState } from "react";
import { Loader2, FileText, ShieldCheck } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { renderPdfPages, buildDocx } from "@/features/pdf-office/support";

function downloadBlob(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PdfToWord() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [done, setDone] = useState(false);
  const [scale, setScale] = useState(2);
  const [totalPages, setTotalPages] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
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
      setError(err instanceof Error ? err.message : "Failed to convert PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="pdf-file"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          onClick={() => document.getElementById("pdf-file")?.click()}
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
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Rendering pages &amp;
          building .docx…
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && !done && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Pick a PDF and every page becomes a full-page image inside a new Word
          document. Fully client-side.
        </div>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 flex items-center gap-3">
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
            alt="Page 1"
            className="rounded-lg border border-slate-100 w-full"
          />
        </div>
      )}
    </div>
  );
}
