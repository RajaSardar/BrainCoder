"use client";

import { useRef, useState } from "react";
import { Info, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_ROWS = 80;
const MAX_VALUE = 2000;

interface Meta {
  key: string;
  value: string;
}

let pdfjsConfigured = false;

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjsConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfjsConfigured = true;
  }
  return pdfjs;
}

function truncate(value: unknown): string {
  const s = String(value);
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE)}…` : s;
}

// Keeps only the detail that is actually present in the PDF date — never
// invents a month, day or time. Handles both PDF-standard "D:" dates and XMP
// ISO dates so the same screen shows one consistent format.
function formatDate(input: string): string {
  const s = input.trim();
  const pdf = s.match(
    /^D:(\d{4})(?:(\d{2})(?:(\d{2})(?:(\d{2})(?:(\d{2})(?:(\d{2}))?)?)?)?)?(Z|[+-]\d{2}(?:'\d{2}')?)?$/i,
  );
  const iso = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?)?/i,
  );
  const m = pdf ?? iso;
  if (!m) return s;
  const [, y, mo, da, h, mi, se, tz] = m;
  let out = y;
  if (mo) out += `-${mo}`;
  if (da) out += `-${da}`;
  if (h) {
    out += ` ${h}`;
    if (mi) out += `:${mi}`;
    if (se) out += `:${se}`;
  }
  if (tz) {
    const cleaned = tz
      .replace(/'/g, "")
      .replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")
      .replace(/^([+-]\d{2})$/, "$1:00");
    out += ` ${cleaned.toUpperCase()}`;
  }
  return out;
}

function buildRows(
  numPages: number,
  info: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Meta[] {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(info)) lower[k.toLowerCase()] = v;

  const out: Meta[] = [];
  const seen = new Set<string>();
  const push = (key: string, value: unknown) => {
    if (value === undefined || value === null || `${value}` === "") return;
    const lk = key.toLowerCase();
    if (seen.has(lk)) return;
    seen.add(lk);
    out.push({ key, value: truncate(value) });
  };

  push("Pages", numPages);
  for (const key of [
    "Title",
    "Author",
    "Subject",
    "Keywords",
    "Creator",
    "Producer",
  ]) {
    const v = lower[key.toLowerCase()];
    if (v !== undefined && v !== null && `${v}` !== "") push(key, v);
  }
  if (lower["pdfformatversion"] != null && `${lower["pdfformatversion"]}` !== "")
    push("Format", lower["pdfformatversion"]);

  // XMP metadata: pdf.js exposes it as an iterable map of lowercased names.
  const xmp: Record<string, string> = {};
  if (
    metadata &&
    typeof (metadata as unknown as Iterable<unknown>)[Symbol.iterator] ===
      "function"
  ) {
    for (const [k, v] of metadata as unknown as Iterable<
      [string, unknown]
    >) {
      if (v === undefined || v === null) continue;
      const key = String(k).toLowerCase();
      const value = Array.isArray(v)
        ? (v as unknown[]).map((x) => String(x)).join(", ")
        : String(v);
      if (!xmp[key]) xmp[key] = value;
    }
  }

  const xmpFields: Record<string, string> = {
    "dc:title": "Title",
    "dc:creator": "Author",
    "dc:subject": "Keywords",
    "dc:description": "Subject",
    "xmp:creatortool": "Creator",
    "pdf:producer": "Producer",
  };
  for (const [xkey, outKey] of Object.entries(xmpFields)) {
    if (xmp[xkey] && !seen.has(outKey.toLowerCase())) push(outKey, xmp[xkey]);
  }

  const created =
    lower["creationdate"] != null
      ? formatDate(String(lower["creationdate"]))
      : xmp["xmp:createdate"]
        ? formatDate(xmp["xmp:createdate"])
        : null;
  const modified =
    lower["moddate"] != null
      ? formatDate(String(lower["moddate"]))
      : xmp["xmp:modifydate"]
        ? formatDate(xmp["xmp:modifydate"])
        : null;
  if (created) push("Created", created);
  if (modified) push("Modified", modified);

  // Extra / custom Info entries — a Map when the key is non-standard, plain
  // values otherwise. Case-insensitive so "Creationdate" can't sneak back in.
  const extras: Meta[] = [];
  const skip = new Set([
    "title",
    "author",
    "subject",
    "keywords",
    "creator",
    "producer",
    "creationdate",
    "moddate",
    "custom",
    "pdfformatversion",
    "islinearized",
    "isacroformpresent",
    "isxfapresent",
    "issignaturespresent",
    "iscollectionpresent",
    "pdfjsversion",
    "pdfjsrenderer",
  ]);
  for (const [k, v] of Object.entries(info)) {
    const lk = k.toLowerCase();
    if (v === undefined || v === null) continue;
    if (lk === "custom") {
      if (typeof v === "object" && v !== null) {
        const entries =
          v instanceof Map
            ? Array.from(v.entries())
            : Object.entries(v as Record<string, unknown>);
        for (const [ck, cv] of entries) {
          if (cv !== undefined && cv !== null && `${cv}` !== "")
            extras.push({ key: String(ck), value: truncate(cv) });
        }
      }
      continue;
    }
    if (skip.has(lk)) continue;
    const value = Array.isArray(v) ? (v as unknown[]).join(", ") : String(v);
    if (value === "") continue;
    extras.push({ key: k, value: truncate(value) });
  }
  extras.sort((a, b) => a.key.localeCompare(b.key));
  for (const e of extras) push(e.key, e.value);

  return out.slice(0, MAX_ROWS);
}

export default function PdfMetadata() {
  const [name, setName] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [rows, setRows] = useState<Meta[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function friendlyError(err: unknown): string {
    const m = err instanceof Error ? err.message : String(err);
    if (/password|PasswordException/i.test(m))
      return "This PDF is password-protected. Open it with the password in a reader, or unlock it with Unlock PDF, then inspect the metadata here.";
    if (/Failed to parse|Invalid PDF structure|is not a PDF/i.test(m))
      return "This file doesn't look like a valid PDF.";
    return m;
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setRows([]);
    let loadingTask: PDFDocumentLoadingTask | null = null;
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(
          `This PDF is ${Math.round(file.size / 1048576)} MB — files up to 100 MB are supported.`,
        );
      }
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const pdfjs = await getPdfjs();
      try {
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
        const doc = await loadingTask.promise;
        if (runId !== runIdRef.current) return;
        const meta = await doc.getMetadata();
        const info = (meta.info ?? {}) as Record<string, unknown>;
        const metadata = (meta.metadata ?? {}) as unknown as Record<
          string,
          unknown
        >;
        const out = buildRows(doc.numPages, info, metadata);
        if (runId !== runIdRef.current) return;
        const bytes = data.byteLength;
        setSizeText(
          bytes < 1024 * 1024
            ? `${(bytes / 1024).toFixed(1)} KB`
            : `${(bytes / (1024 * 1024)).toFixed(2)} MB`,
        );
        setName(file.name);
        setRows(out);
        if (out.every((r) => r.key === "Pages" || r.key === "Format"))
          setMessage(
            "No title, author or date metadata was found in this PDF — just the page count.",
          );
      } catch (err) {
        if (runId === runIdRef.current) throw new Error(friendlyError(err));
      }
    } catch (err) {
      if (runId === runIdRef.current) {
        setName("");
        setSizeText("");
        setRows([]);
        setError(err instanceof Error ? err.message : "Could not read the PDF.");
      }
    } finally {
      if (loadingTask)
        await loadingTask.destroy().catch(() => {});
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF to inspect"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? "Inspecting PDF metadata…" : ""}
      </span>
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
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name}${sizeText ? ` — ${sizeText}` : ""}`
            : "Inspect the metadata a PDF actually stores — nothing is uploaded."}
        </span>
      </div>

      {error && (
        <div
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          className="rounded-xl bg-sky-50 border border-sky-200 text-sky-700 px-4 py-3 text-sm"
          role="status"
        >
          {message}
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Info className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-800">Metadata</h2>
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