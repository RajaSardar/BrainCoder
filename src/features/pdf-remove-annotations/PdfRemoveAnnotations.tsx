"use client";

import { useRef, useState } from "react";
import {
  Loader2,
  FileText,
  StickyNote,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

export default function PdfRemoveAnnotations() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [count, setCount] = useState(0);
  const [perPage, setPerPage] = useState<number[]>([]);
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dynamically imported but statically analyzed as unused
      const { PDFDocument, PDFName } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const totals: number[] = [];
      let n = 0;
      for (let i = 0; i < doc.getPageCount(); i++) {
        const annots = doc.getPage(i).node.Annots();
        const pageCount = annots?.size() ?? 0;
        totals.push(pageCount);
        n += pageCount;
      }
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      setBytes(bytes);
      setCount(n);
      setPerPage(totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument, PDFName } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (let i = 0; i < doc.getPageCount(); i++) {
        doc.getPage(i).node.delete(PDFName.Annots);
      }
      doc.catalog.delete(PDFName.of("AcroForm"));
      downloadBlob(await doc.save(), `${base}-no-annotations.pdf`);
      setMessage(
        count === 0
          ? "No annotations were found — the document was downloaded unchanged."
          : `Removed ${count} annotation${count === 1 ? "" : "s"} (comments, highlights, stamps, and links).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const maxPage = perPage.length;

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
            ? `${name} — ${maxPage} page${maxPage === 1 ? "" : "s"}`
            : "Strip comments, highlights, stamps, and links from a PDF while keeping the page content."}
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 max-w-xl">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Found in document
            </p>
            <p className="text-2xl font-bold text-slate-800">
              {count}{" "}
              <span className="text-sm font-medium text-slate-400">
                annotation{count === 1 ? "" : "s"}
              </span>
            </p>
            {count > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {perPage.map((n, i) =>
                  n === 0 ? null : (
                    <span
                      key={i}
                      className="text-[11px] font-medium text-slate-600 bg-slate-100 rounded-lg px-2 py-1"
                    >
                      page {i + 1}: {n}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
              ) : (
                <StickyNote className="w-4 h-4 mr-1.5 inline" />
              )}
              {busy ? "Removing…" : "Remove annotations and download"}
            </Button>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Only annotations are removed — page content is untouched.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}