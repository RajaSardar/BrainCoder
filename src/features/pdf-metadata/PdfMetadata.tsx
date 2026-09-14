"use client";

import { useRef, useState } from "react";
import { Info, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";

interface Meta {
  key: string;
  value: string;
}

export default function PdfMetadata() {
  const [name, setName] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [rows, setRows] = useState<Meta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setRows([]);
    try {
      const data = await file.arrayBuffer();
      const bytes = data.byteLength;
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;
      const meta = await doc.getMetadata();
      const info = (meta.info ?? {}) as Record<string, unknown>;
      const out: Meta[] = [];
      out.push({ key: "Pages", value: String(doc.numPages) });
      setSizeText(
        bytes < 1024 * 1024
          ? `${(bytes / 1024).toFixed(1)} KB`
          : `${(bytes / (1024 * 1024)).toFixed(2)} MB`,
      );
      const order = [
        "Title",
        "Author",
        "Subject",
        "Keywords",
        "Creator",
        "Producer",
      ];
      for (const k of order) {
        if (
          info[k] !== undefined &&
          info[k] !== null &&
          String(info[k]) !== ""
        ) {
          out.push({ key: k, value: String(info[k]) });
        }
      }
      for (const [k, v] of Object.entries(info)) {
        if (out.some((r) => r.key.toLowerCase() === k.toLowerCase())) continue;
        if (v === undefined || v === null || String(v) === "") continue;
        out.push({ key: k, value: String(v) });
      }
      const dates: Record<string, string> = {};
      const raw = meta.metadata as
        { getAll?: () => Record<string, string> } | undefined;
      if (raw?.getAll) {
        const all = raw.getAll();
        if (all["xmp:CreateDate"]) dates.Created = all["xmp:CreateDate"];
        if (all["xmp:ModifyDate"]) dates.Modified = all["xmp:ModifyDate"];
      }
      if (info.CreationDate) dates.Created = String(info.CreationDate);
      if (info.ModDate) dates.Modified = String(info.ModDate);
      if (dates.Created)
        out.push({ key: "Created", value: formatDate(dates.Created) });
      if (dates.Modified)
        out.push({ key: "Modified", value: formatDate(dates.Modified) });
      setRows(out);
      setName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
      setName("");
    } finally {
      setBusy(false);
    }
  };

  function formatDate(raw: string): string {
    const m = raw.match(/D:(\d{4})(\d{2})?(\d{2})?/);
    if (!m) return raw;
    const yr = m[1];
    const mo = m[2] ?? "01";
    const da = m[3] ?? "01";
    return `${yr}-${mo}-${da}`;
  }

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
          {name ? `${name} — ${sizeText}` : "Inspect the metadata of a PDF."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Info className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800">Metadata</p>
          </div>
          <dl className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div
                key={r.key}
                className="grid grid-cols-1 sm:grid-cols-[180px_1fr] px-5 py-3"
              >
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-0.5">
                  {r.key}
                </dt>
                <dd className="text-sm text-slate-800 break-words whitespace-pre-wrap">
                  {r.value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
