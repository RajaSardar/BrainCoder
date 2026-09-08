"use client";

import { useRef, useState } from "react";
import { Scissors, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

interface PageInfo {
  index: number;
  url: string;
}

interface SourcePdf {
  name: string;
  base: string;
  bytes: Uint8Array;
  pages: PageInfo[];
}

export default function PdfSplit() {
  const [pdf, setPdf] = useState<SourcePdf | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
      const bytes = new Uint8Array(buffer);
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const pages: PageInfo[] = [];
      const scale = 0.45;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvas, viewport }).promise;
        pages.push({ index: n, url: canvas.toDataURL("image/jpeg", 0.8) });
      }
      setPdf({ name: file.name, base: file.name.replace(/\.pdf$/i, ""), bytes, pages });
      setSelected(new Set(pages.map((p) => p.index)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
      setPdf(null);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (n: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const extractSelected = async (separate: boolean) => {
    if (!pdf || selected.size === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const order = Array.from(selected).sort((a, b) => a - b);
      if (!separate) {
        const out = await PDFDocument.create();
        const src = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true });
        const copied = await out.copyPages(src, order.map((p) => p - 1));
        copied.forEach((p) => out.addPage(p));
        downloadBlob(await out.save(), `${pdf.base}-pages-${order.join("-")}.pdf`);
        setMessage(`Exported ${order.length} page${order.length === 1 ? "" : "s"} as one PDF.`);
      } else {
        const src = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true });
        for (const p of order) {
          const out = await PDFDocument.create();
          const [copied] = await out.copyPages(src, [p - 1]);
          out.addPage(copied);
          downloadBlob(await out.save(), `${pdf.base}-page-${p}.pdf`);
        }
        setMessage(`Downloaded ${order.length} PDF file${order.length === 1 ? "" : "s"} (one per page).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
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
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {pdf ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500">
          {pdf ? `${pdf.name} — ${pdf.pages.length} pages` : "Select a PDF to split into individual pages."}
        </span>
      </div>

      {error && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">{error}</div>}
      {message && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message}</div>}

      {pdf && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={busy || selected.size === 0} onClick={() => void extractSelected(false)}>
              <Scissors className="w-4 h-4" />
              {busy ? "Working…" : `Extract ${selected.size} page${selected.size === 1 ? "" : "s"} → one PDF`}
            </Button>
            <Button type="button" variant="secondary" disabled={busy || selected.size === 0} onClick={() => void extractSelected(true)}>
              <Scissors className="w-4 h-4" />
              Download each separately
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelected(selected.size === pdf.pages.length ? new Set() : new Set(pdf.pages.map((p) => p.index)))}
            >
              {selected.size === pdf.pages.length ? "Clear all" : "Select all"}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pdf.pages.map((p) => {
              const on = selected.has(p.index);
              return (
                <button
                  key={p.index}
                  type="button"
                  onClick={() => toggle(p.index)}
                  className={`group relative rounded-xl border-2 overflow-hidden transition ${on ? "border-indigo-500" : "border-slate-200 hover:border-slate-300"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Page ${p.index} preview`}
                    className="w-full aspect-[3/4] object-cover bg-slate-100"
                    loading="lazy"
                  />
                  <span
                    className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold shadow ${on ? "bg-indigo-500 text-white" : "bg-white/90 text-slate-600"}`}
                  >
                    {p.index}
                  </span>
                  <span
                    className={`absolute inset-0 transition ${on ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500" : "group-hover:bg-slate-900/5"}`}
                  />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}