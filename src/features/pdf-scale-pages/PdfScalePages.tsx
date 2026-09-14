"use client";

import { useRef, useState } from "react";
import { Loader2, FileText, Scaling, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

interface PageSize {
  width: number;
  height: number;
}

export default function PdfScalePages() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [count, setCount] = useState(0);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [percent, setPercent] = useState(100);
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
      const bytes = new Uint8Array(buffer.slice(0));
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const sizes: PageSize[] = [];
      for (let i = 0; i < doc.getPageCount(); i++) {
        const { width, height } = doc.getPage(i).getSize();
        sizes.push({ width, height });
      }
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      setBytes(bytes);
      setCount(doc.getPageCount());
      setPageSizes(sizes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const scale = () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      void (async () => {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const s = percent / 100;
        for (let i = 0; i < doc.getPageCount(); i++) {
          doc.getPage(i).scale(s, s);
        }
        downloadBlob(await doc.save(), `${base}-scaled.pdf`);
        setMessage(
          `Scaled ${doc.getPageCount()} page${doc.getPageCount() === 1 ? "" : "s"} to ${percent}%.`,
        );
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scale failed");
    } finally {
      setBusy(false);
    }
  };

  const first = pageSizes[0];
  const targetW = first ? (first.width * percent) / 100 : 0;
  const targetH = first ? (first.height * percent) / 100 : 0;

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
            : "Resize every page of a PDF by a percentage — content scales with the page."}
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

      {bytes && first && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 max-w-xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Scale
              </p>
              <p className="text-sm font-bold text-indigo-600">{percent}%</p>
            </div>
            <input
              type="range"
              min={25}
              max={300}
              step={5}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>25%</span>
              <span>100%</span>
              <span>300%</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">Page size preview</p>
            <p>
              <span className="text-slate-400">First page:</span>{" "}
              {first.width.toFixed(0)} × {first.height.toFixed(0)} pt
            </p>
            <p>
              <span className="text-slate-400">Resulting page:</span>{" "}
              {targetW.toFixed(0)} × {targetH.toFixed(0)} pt
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={busy || count === 0}
              onClick={scale}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
              ) : (
                <Scaling className="w-4 h-4 mr-1.5 inline" />
              )}
              {busy ? "Scaling…" : "Scale and download PDF"}
            </Button>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              All pages are scaled uniformly in your browser.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}