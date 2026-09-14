"use client";

import { useRef, useState } from "react";
import { RotateCw, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

export default function PdfRotate() {
  const [name, setName] = useState("");
  const [pages, setPages] = useState(1);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
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
      setBytes(new Uint8Array(data.slice(0)));
      setPages(doc.numPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (angle: number) => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (let i = 0; i < src.getPageCount(); i++) {
        const page = src.getPage(i);
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
      }
      downloadBlob(
        await src.save(),
        `${name.replace(/\.pdf$/i, "")}-rotated.pdf`,
      );
      setMessage(`Rotated all ${src.getPageCount()} pages by ${angle}°.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotate failed");
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
            ? `${name} — ${pages} pages`
            : "Select a PDF to rotate its pages."}
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Rotate direction
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void rotate(90)}
            >
              <RotateCw className="w-4 h-4 mr-1.5 inline" /> 90° clockwise
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void rotate(-90)}
            >
              <RotateCw className="w-4 h-4 mr-1.5 inline -scale-x-100" /> 90°
              counter-clockwise
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void rotate(180)}
            >
              <RotateCw className="w-4 h-4 mr-1.5 inline rotate-90" /> 180°
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Every page is rotated in place and the file is downloaded instantly.
          </p>
        </div>
      )}
    </div>
  );
}
