"use client";

import { useRef, useState } from "react";
import {
  Loader2,
  FileText,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

type Quality = "1" | "1.5" | "2";

const QUALITIES: { value: Quality; label: string }[] = [
  { value: "1", label: "Draft (1×)" },
  { value: "1.5", label: "Normal (1.5×)" },
  { value: "2", label: "High (2×)" },
];

export default function PdfFlatten() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [data, setData] = useState<Uint8Array | null>(null);
  const [count, setCount] = useState(0);
  const [quality, setQuality] = useState<Quality>("1.5");
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
      const buffer = await file.arrayBuffer();
      const pdfjsData = new Uint8Array(buffer.slice(0));
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data: pdfjsData }).promise;
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      setData(pdfjsData);
      setCount(doc.numPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const flatten = async () => {
    if (!data) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
      const { PDFDocument } = await import("pdf-lib");
      const scaleF = Number(quality);
      const out = await PDFDocument.create();
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const vpTiny = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: scaleF });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport: vp }).promise;
        const png = await new Promise<string>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Could not encode page image."));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Could not read page image."));
            reader.readAsDataURL(blob);
          }, "image/png");
        });
        const image = await out.embedPng(png);
        const outPage = out.addPage([vpTiny.width, vpTiny.height]);
        outPage.drawImage(image, {
          x: 0,
          y: 0,
          width: vpTiny.width,
          height: vpTiny.height,
        });
      }
      downloadBlob(await out.save(), `${base}-flattened.pdf`);
      setMessage(
        `Flattened ${doc.numPages} page${doc.numPages === 1 ? "" : "s"} into a single image layer each.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flatten failed");
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
            ? `${name} — ${count} page${count === 1 ? "" : "s"}`
            : "Flatten a PDF by converting every page to a single image — removes text selection and interactive layers."}
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

      {data && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 max-w-xl">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Output quality
            </p>
            <div className="flex flex-wrap gap-2">
              {QUALITIES.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => setQuality(q.value)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition ${
                    quality === q.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={busy || count === 0}
              onClick={() => void flatten()}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
              ) : (
                <Layers className="w-4 h-4 mr-1.5 inline" />
              )}
              {busy ? "Flattening…" : "Flatten and download PDF"}
            </Button>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Rendered locally — pages become images, text is no longer selectable.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}