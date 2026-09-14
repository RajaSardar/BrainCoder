"use client";

import { useRef, useState } from "react";
import { Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

interface PageInfo {
  index: number;
  url: string;
}

export default function PdfRemovePages() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setRemoving(new Set());
    try {
      const buffer = await file.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const list: PageInfo[] = [];
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
        list.push({ index: n, url: canvas.toDataURL("image/jpeg", 0.8) });
      }
      setPages(list);
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      setBytes(new Uint8Array(buffer));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (n: number) => {
    setRemoving((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const removePages = async () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const keep = [];
      for (let i = 0; i < src.getPageCount(); i++)
        if (!removing.has(i + 1)) keep.push(i);
      const copied = await out.copyPages(src, keep);
      copied.forEach((p) => out.addPage(p));
      const gone = removing.size;
      downloadBlob(await out.save(), `${base}-kept-pages.pdf`);
      setMessage(
        gone === 0
          ? "No pages selected to remove — downloaded the full document."
          : `Removed ${gone} page${gone === 1 ? "" : "s"} (${keep.length} remaining).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
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
            ? `${name} — ${pages.length} pages`
            : "Select a PDF, then mark the pages to delete."}
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

      {pages.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={busy || pages.length === 0}
              onClick={() => void removePages()}
            >
              <Trash2 className="w-4 h-4 mr-1.5 inline" />
              {busy
                ? "Working…"
                : `Delete ${removing.size} page${removing.size === 1 ? "" : "s"}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setRemoving(
                  removing.size === pages.length
                    ? new Set()
                    : new Set(pages.map((p) => p.index)),
                )
              }
            >
              {removing.size === pages.length
                ? "Clear"
                : `Select all ${pages.length}`}
            </Button>
            <span className="text-xs text-slate-400">
              Tap a page to mark it for deletion.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pages.map((p) => {
              const on = removing.has(p.index);
              return (
                <button
                  key={p.index}
                  type="button"
                  onClick={() => toggle(p.index)}
                  className={`group relative rounded-xl border-2 overflow-hidden transition ${
                    on
                      ? "border-red-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Page ${p.index} preview`}
                    className="w-full aspect-[3/4] object-cover bg-slate-100"
                    loading="lazy"
                  />
                  <span
                    className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold shadow ${
                      on
                        ? "bg-red-500 text-white"
                        : "bg-white/90 text-slate-600"
                    }`}
                  >
                    {on ? "✕" : p.index}
                  </span>
                  <span
                    className={`absolute inset-0 transition ${on ? "bg-red-500/10 ring-1 ring-inset ring-red-500" : "group-hover:bg-slate-900/5"}`}
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
