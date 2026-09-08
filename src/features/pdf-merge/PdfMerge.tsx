"use client";

import { useRef, useState } from "react";
import { Layers, Plus, Trash2, ArrowUp, ArrowDown, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

interface PdfEntry {
  id: number;
  name: string;
  bytes: Uint8Array;
  pages: number;
}

export default function PdfMerge() {
  const [files, setFiles] = useState<PdfEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setError("");
    for (const file of Array.from(list)) {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const { PDFDocument } = await import("pdf-lib");
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        setFiles((prev) => [
          ...prev,
          { id: Date.now() + Math.random(), name: file.name, bytes, pages: src.getPageCount() },
        ]);
      } catch {
        setError(`Could not read ${file.name} — is it a valid, unencrypted PDF?`);
      }
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (id: number) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const merge = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      downloadBlob(bytes, `merged-${files.length}-files.pdf`);
      setMessage(`Merged ${files.length} PDF(s) into ${out.getPageCount()} pages.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = files.reduce((s, f) => s + f.pages, 0);

  return (
    <div className="space-y-5 w-full">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          <Plus className="w-4 h-4" /> Add PDFs
        </Button>
        <Button type="button" variant="secondary" onClick={() => { setFiles([]); setMessage(""); setError(""); }}>
          <Trash2 className="w-4 h-4" /> Clear all
        </Button>
        <span className="text-sm text-slate-500">
          {files.length > 0
            ? `${files.length} file${files.length === 1 ? "" : "s"} · ${totalPages} pages`
            : "Add two or more PDFs to combine (in the order shown)."}
        </span>
      </div>

      {error && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">{error}</div>}
      {message && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message}</div>}

      {files.length > 0 && (
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {files.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold shrink-0">
                {i + 1}
              </span>
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{f.name}</span>
              <span className="text-xs text-slate-400 shrink-0">{f.pages} pages</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === files.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => remove(f.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" disabled={files.length < 2 || busy} onClick={() => void merge()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          {busy ? "Merging…" : `Merge ${files.length} file${files.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}