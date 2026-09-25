"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Loader2, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { buildXlsx } from "@/lib/spreadsheet";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const GAP_THRESHOLD = 24;

let pdfjsReady = false;

function sanitizeXml(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function escapeCsv(s: string): string {
  const neutralized = /^[\t\n\r ]*[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(neutralized))
    return `"${neutralized.replace(/"/g, '""')}"`;
  return neutralized;
}

async function extractGrids(
  data: ArrayBuffer,
  onProgress: (page: number, total: number) => void,
): Promise<{ page: number; rows: string[][] }[]> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjsReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfjsReady = true;
  }
  const task = pdfjs.getDocument({ data: data.slice(0) });
  try {
    const doc = await task.promise;
    const grids: { page: number; rows: string[][] }[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress(p, doc.numPages);
      const page = await doc.getPage(p);
      try {
        const content = await page.getTextContent();
        type Item = { str?: string; transform?: number[]; width?: number };
        const items = (content.items ?? []) as Item[];

        interface Word {
          x: number;
          y: number;
          w: number;
          text: string;
        }
        const words: Word[] = [];
        for (const it of items) {
          if (typeof it.str !== "string" || !it.str.trim()) continue;
          const t = it.transform ?? [];
          const x = t[4] ?? 0;
          const y = t[5] ?? 0;
          words.push({ x, y, w: it.width ?? 4, text: it.str });
        }
        if (words.length === 0) continue;

        words.sort((a, b) =>
          Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x,
        );

        const lines: Word[][] = [];
        let line: Word[] = [words[0]];
        for (let i = 1; i < words.length; i++) {
          const prev = words[i - 1];
          const cur = words[i];
          const sameLine = Math.abs(prev.y - cur.y) <= 2.5 && prev.x <= cur.x;
          if (sameLine) line.push(cur);
          else {
            lines.push(line);
            line = [cur];
          }
        }
        lines.push(line);

        const normRows: string[][] = lines.map((wordsInLine) => {
          const sorted = [...wordsInLine].sort((a, b) => a.x - b.x);
          const cells: string[] = [];
          let cur = sorted[0].text;
          let prevEnd = sorted[0].x + sorted[0].w;
          for (let i = 1; i < sorted.length; i++) {
            const w = sorted[i];
            if (w.x - prevEnd > GAP_THRESHOLD) {
              cells.push(cur.trim());
              cur = w.text;
            } else {
              const gap = w.x - prevEnd;
              cur += gap > 1 ? ` ${w.text}` : w.text;
            }
            prevEnd = Math.max(prevEnd, w.x + w.w);
          }
          cells.push(cur.trim());
          return cells;
        });

        grids.push({ page: p, rows: normRows });
      } finally {
        await page.cleanup();
      }
    }
    return grids;
  } finally {
    await task.destroy().catch(() => {});
  }
}

function friendlyError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/password|encrypted/i.test(m))
    return "This PDF is password-protected. Remove the password with PDF Unlock, then convert it again.";
  if (/Invalid PDF|Failed to parse|No PDF header|encryption/i.test(m))
    return "This file doesn't look like a valid PDF.";
  return "Couldn't read that PDF — try again with a different file.";
}

function userFacing(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing)
    return err.message;
  return friendlyError(err);
}

export default function PdfToExcel() {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setName("");
    setRows([]);
    setMessage("");
    setProgress("");
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `This PDF is ${Math.round(file.size / 1048576)} MB — files up to 100 MB are supported.`,
        );
      }
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const grids = await extractGrids(data, (p, total) => {
        if (runId === runIdRef.current)
          setProgress(`Reading page ${p} of ${total}…`);
      });
      if (runId !== runIdRef.current) return;
      const pageCount = grids.reduce((m, g) => Math.max(m, g.page), 0);
      if (pageCount > MAX_PAGES) {
        throw userFacing(
          `This PDF has ${pageCount} pages — files up to 200 pages are supported. Use PDF Split first.`,
        );
      }
      const all: string[][] = [];
      grids.forEach((g) => {
        if (g.page > 1 && all.length > 0) all.push([]);
        all.push(...g.rows);
      });
      if (all.length === 0) {
        setError(
          "No text found in this PDF. A scanned PDF has no text layer — use the PDF OCR tool instead.",
        );
        setName(file.name);
        return;
      }
      setName(file.name);
      setRows(all);
      setProgress("");
      setMessage(
        `Extracted ${all.length} text rows (${all.reduce((m, r) => m + r.length, 0)} cells) from ${file.name}.`,
      );
    } catch (err) {
      if (runId === runIdRef.current) {
        resetState();
        setError(toUiError(err));
      }
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const cellCount = rows.reduce((m, r) => m + r.length, 0);

  const downloadCsv = () => {
    if (!name || rows.length === 0) return;
    const text =
      "\uFEFF" +
      rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    downloadBlob(
      new TextEncoder().encode(text),
      `${name.replace(/\.pdf$/i, "")}.csv`,
      "text/csv",
    );
  };

  const downloadXlsx = () => {
    if (!name || rows.length === 0) return;
    const sanitized = rows.map((r) => r.map((c) => sanitizeXml(c)));
    downloadBlob(
      buildXlsx([{ name: "Sheet1", rows: sanitized }]),
      `${name.replace(/\.pdf$/i, "")}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF to convert to a spreadsheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
      <span className="sr-only" role="status">
        {busy ? progress || "Reading the PDF…" : ""}
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
          {busy ? (progress || "Working…") : name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name} loaded — ${rows.length} text rows, ${cellCount} cells`
            : "Turn a PDF's text and tables into an .xlsx or .csv spreadsheet."}
        </span>
      </div>

      {error && (
        <div
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
          {/OCR/i.test(error) && (
            <Link
              href="/use/pdf-ocr"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 underline ml-1"
            >
              Open PDF OCR <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}
      {message && (
        <div
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
          role="status"
        >
          {message} Cells are exported as text — spreadsheets treat them as
          labels, not formulas or numbers.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
              Preview (first {Math.min(rows.length, 200)} of {rows.length} rows)
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {r.map((c, j) => (
                        <td
                          key={j}
                          className="px-3 py-2 align-top border-r border-slate-50 min-w-24"
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={downloadXlsx}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" /> Download
              .xlsx
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={downloadCsv}
            >
              Download .csv
            </Button>
          </div>
        </>
      )}
    </div>
  );
}