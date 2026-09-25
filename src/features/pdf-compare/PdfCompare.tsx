"use client";

import { useId, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  GitCompareArrows,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { ensurePdfjsWorker } from "@/features/pdf-office/support";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_DOCS = 5;
const MAX_LINES_PER_PAGE = 1000;
const MAX_VISIBLE_ROWS = 500;

type DiffKind = "same" | "added" | "removed";

interface DiffRow {
  kind: DiffKind;
  aText: string | null;
  bText: string | null;
}

interface DiffOptions {
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
}

interface PageResult {
  page: number;
  rows: DiffRow[];
  added: number;
  removed: number;
}

interface ResultEntry {
  revId: number;
  revName: string;
  revPages: number;
  compared: number;
  pages: PageResult[];
  truncated: number[];
}

interface DocEntry {
  id: number;
  name: string;
  bytes: Uint8Array;
  pages: number;
}

interface DocumentText {
  pages: string[][];
  truncated: number[];
}

interface ReportData {
  origName: string;
  origPages: number;
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
  entries: Array<{
    revName: string;
    revPages: number;
    compared: number;
    pages: PageResult[];
    truncated: number[];
  }>;
}

interface LayoutItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  type?: string;
}

function lineKey(line: string, opts: DiffOptions): string {
  let k = line.trim().replace(/\s+/g, " ");
  if (opts.ignoreCase) k = k.toLowerCase();
  if (opts.ignoreWhitespace) k = k.replace(/\s+/g, "");
  return k;
}

function diffLines(
  aLines: string[],
  bLines: string[],
  opts: DiffOptions,
): DiffRow[] {
  const aKeys = aLines.map((l) => lineKey(l, opts));
  const bKeys = bLines.map((l) => lineKey(l, opts));
  const n = aKeys.length;
  const m = bKeys.length;
  const dp: Int32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        aKeys[i] === bKeys[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aKeys[i] === bKeys[j]) {
      rows.push({ kind: "same", aText: aLines[i], bText: bLines[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: "removed", aText: aLines[i], bText: null });
      i++;
    } else {
      rows.push({ kind: "added", aText: null, bText: bLines[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ kind: "removed", aText: aLines[i], bText: null });
    i++;
  }
  while (j < m) {
    rows.push({ kind: "added", aText: null, bText: bLines[j] });
    j++;
  }
  return rows;
}

interface ItemLike {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
}

function layoutLines(content: { items?: LayoutItem[] }): string[] {
  const text: Array<{
    y: number;
    x: number;
    str: string;
    width: number;
    eol: boolean;
  }> = [];
  const order: Array<{ kind: "text"; idx: number } | { kind: "blank" }> = [];
  for (const raw of content.items ?? []) {
    const item = raw as ItemLike;
    const str = typeof item.str === "string" ? item.str : "";
    if (str) {
      const t = Array.isArray(item.transform)
        ? item.transform
        : [1, 0, 0, 1, 0, 0];
      text.push({
        y: typeof t[5] === "number" ? t[5] : 0,
        x: typeof t[4] === "number" ? t[4] : 0,
        str,
        width: typeof item.width === "number" ? item.width : 0,
        eol: item.hasEOL === true,
      });
      order.push({ kind: "text", idx: text.length - 1 });
    } else if (item.hasEOL) {
      order.push({ kind: "blank" });
    }
  }
  const sortLine = (indices: number[]): string => {
    const items = indices
      .map((i) => text[i])
      .sort((a, b) => a.x - b.x);
    let s = "";
    let endX = 0;
    for (const it of items) {
      const gap = s ? it.x - endX : 0;
      if (s && gap > 1) s += " ";
      s += it.str;
      endX = it.x + it.width;
    }
    return s.trim();
  };
  const out: string[] = [];
  let cur: number[] = [];
  let curY: number | null = null;
  let blankPending = 0;
  const flushLine = () => {
    if (!cur.length) return;
    for (let b = 0; b < blankPending; b++) out.push("");
    blankPending = 0;
    out.push(sortLine(cur));
    cur = [];
    curY = null;
  };
  for (const item of order) {
    if (item.kind === "blank") {
      flushLine();
      blankPending += 1;
      continue;
    }
    const it = text[item.idx];
    if (curY === null) curY = it.y;
    if (Math.abs(it.y - curY) >= 2.5) flushLine();
    cur.push(item.idx);
    if (it.eol) flushLine();
  }
  flushLine();
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

async function extractDocument(data: Uint8Array): Promise<DocumentText> {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfjsWorker(pdfjs);
  const task = pdfjs.getDocument({ data: data.slice(0) });
  const doc = await task.promise;
  try {
    const pages: string[][] = [];
    const truncated: number[] = [];
    const count = Math.min(doc.numPages, MAX_PAGES);
    for (let p = 1; p <= count; p++) {
      const page = await doc.getPage(p);
      try {
        const content = await page.getTextContent();
        const lines = layoutLines(content);
        if (lines.length > MAX_LINES_PER_PAGE) truncated.push(p);
        pages.push(lines.slice(0, MAX_LINES_PER_PAGE));
      } catch {
        pages.push([]);
      }
      try {
        page.cleanup();
      } catch {
        /* noop */
      }
    }
    return { pages, truncated };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

async function loadPdfMeta(data: Uint8Array): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfjsWorker(pdfjs);
  const task = pdfjs.getDocument({ data: data.slice(0) });
  const doc = await task.promise;
  try {
    return doc.numPages;
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

function friendlyError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/Invalid PDF|Failed to parse|No PDF header|Header not found|trailer/i.test(m))
    return "This file doesn't look like a valid PDF.";
  if (/password|encrypted|No password given/i.test(m))
    return "This PDF is already password-protected. If you know its password, remove it with Unlock PDF first.";
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

function reportFileName(origName: string): string {
  return `${origName.replace(/\.pdf$/i, "")}-diff-report.txt`;
}

function buildReportText(data: ReportData): string {
  const lines: string[] = [];
  lines.push("PDF Compare — Text-Layer Diff Report");
  lines.push(
    "Generated locally in your browser. This compares embedded text only, not layout, images, fonts or scans.",
  );
  lines.push("");
  lines.push(
    `Original: ${data.origName} (${data.origPages} page${data.origPages === 1 ? "" : "s"})`,
  );
  lines.push(`Ignore case: ${data.ignoreCase ? "on" : "off"}`);
  lines.push(`Ignore whitespace: ${data.ignoreWhitespace ? "on" : "off"}`);
  lines.push(
    "Lines are matched page by page on normalized content; extra spaces are always collapsed, blanks and ordering matter, and reordered lines count as removed plus added.",
  );
  lines.push("");
  for (const entry of data.entries) {
    lines.push(`--- ${entry.revName} vs ${data.origName} ---`);
    lines.push(
      `${entry.compared} page${entry.compared === 1 ? "" : "s"} compared (shortest shared page count of ${entry.revPages} and ${data.origPages}).`,
    );
    lines.push("");
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const p of entry.pages) {
      totalAdded += p.added;
      totalRemoved += p.removed;
      const label =
        p.added + p.removed === 0
          ? "no changes"
          : `${p.added} added, ${p.removed} removed`;
      lines.push(`Page ${p.page} — ${label}`);
      for (const row of p.rows) {
        if (row.kind === "added") lines.push(`  added: ${row.bText}`);
        else if (row.kind === "removed") lines.push(`  removed: ${row.aText}`);
      }
      lines.push("");
    }
    if (entry.truncated.length > 0) {
      const plural = entry.truncated.length > 1;
      lines.push(
        `Note: page${plural ? "s" : ""} ${entry.truncated.join(", ")} ${plural ? "were" : "was"} trimmed to the first ${MAX_LINES_PER_PAGE} lines for display.`,
      );
      lines.push("");
    }
    const summary =
      totalAdded + totalRemoved === 0
        ? "No differences found."
        : `${totalAdded} added, ${totalRemoved} removed across ${entry.compared} page${entry.compared === 1 ? "" : "s"}.`;
    lines.push(`Summary vs ${entry.revName}: ${summary}`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function fmtBytes(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export default function PdfCompare() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [originalId, setOriginalId] = useState<number | null>(null);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [view, setView] = useState<Record<number, number>>({});
  const runIdRef = useRef(0);
  const docIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsHeadingId = useId();

  const original = docs.find((d) => d.id === originalId) ?? docs[0];

  function resetState() {
    setResults([]);
    setMessage("");
    setProgress("");
  }

  const handleAdd = async (file: File | undefined) => {
    if (!file || busy) return;
    if (docs.length >= MAX_DOCS) {
      setError(
        `Only up to ${MAX_DOCS} PDFs can be compared at once. Remove one before adding another.`,
      );
      return;
    }
    const run = ++runIdRef.current;
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
      if (run !== runIdRef.current) return;
      const header = new TextDecoder().decode(new Uint8Array(data, 0, 5));
      if (header !== "%PDF-") {
        throw userFacing("This file doesn't look like a valid PDF.");
      }
      let pageCount: number;
      try {
        pageCount = await loadPdfMeta(new Uint8Array(data));
      } catch (err) {
        throw toUiError(err);
      }
      if (run !== runIdRef.current) return;
      if (pageCount > MAX_PAGES) {
        throw userFacing(
          `This PDF has ${pageCount} pages — files up to ${MAX_PAGES} pages are supported.`,
        );
      }
      const entry: DocEntry = {
        id: ++docIdRef.current,
        name: file.name,
        bytes: new Uint8Array(data),
        pages: pageCount,
      };
      setDocs((prev) => [...prev, entry]);
      setOriginalId((prev) =>
        docs.length === 0 && prev === null ? entry.id : prev,
      );
      resetState();
    } catch (err) {
      if (run === runIdRef.current) setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) setBusy(false);
    }
  };

  const handleRemove = (id: number) => {
    if (busy) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (originalId === id) setOriginalId(null);
    setResults([]);
    setMessage("");
    setProgress("");
    setError("");
  };

  const handleOriginalChange = (id: number) => {
    if (busy || id === originalId) return;
    setOriginalId(id);
    setResults([]);
    setMessage("");
    setError("");
  };

  const toggleOption = (
    setter: (v: boolean) => void,
    value: boolean,
  ) => {
    if (busy) return;
    setter(value);
    setResults([]);
    setMessage("");
  };

  const compare = async () => {
    if (busy || !original || docs.length < 2) {
      if (!original || docs.length < 2) {
        setError("Add at least two PDFs before comparing.");
      }
      return;
    }
    const run = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress("");
    resetState();
    try {
      const opts: DiffOptions = { ignoreCase, ignoreWhitespace };
      const revDocs = docs.filter((d) => d.id !== original.id);
      setProgress(`Reading ${original.name}…`);
      const baseText = await extractDocument(original.bytes);
      if (run !== runIdRef.current) return;
      const textByRev = new Map<number, DocumentText>();
      for (const d of revDocs) {
        setProgress(`Reading ${d.name}…`);
        const text = await extractDocument(d.bytes);
        if (run !== runIdRef.current) return;
        textByRev.set(d.id, text);
      }
      const entries: ResultEntry[] = [];
      for (const d of revDocs) {
        setProgress(`Comparing ${d.name} against ${original.name}…`);
        const revText = textByRev.get(d.id);
        if (!revText) continue;
        const compared = Math.min(baseText.pages.length, revText.pages.length);
        const pages: PageResult[] = [];
        for (let p = 0; p < compared; p++) {
          const rows = diffLines(
            baseText.pages[p],
            revText.pages[p],
            opts,
          );
          pages.push({
            page: p + 1,
            rows,
            added: rows.filter((r) => r.kind === "added").length,
            removed: rows.filter((r) => r.kind === "removed").length,
          });
        }
        entries.push({
          revId: d.id,
          revName: d.name,
          revPages: revText.pages.length,
          compared,
          pages,
          truncated: revText.truncated,
        });
      }
      if (run !== runIdRef.current) return;
      const nextView: Record<number, number> = {};
      entries.forEach((e) => {
        nextView[e.revId] = 1;
      });
      setView(nextView);
      setResults(entries);
      setMessage(
        `Compared ${entries.length} file${entries.length === 1 ? "" : "s"} against ${original.name}, page by page (up to ${comparedLabel(entries)}).`,
      );
    } catch (err) {
      if (run === runIdRef.current) {
        resetState();
        setError(toUiError(err));
      }
    } finally {
      if (run === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  function comparedLabel(entries: ResultEntry[]): string {
    const pages = entries.map((e) => e.compared);
    if (pages.length === 0) return "0 pages";
    const min = Math.min(...pages);
    const max = Math.max(...pages);
    return min === max ? `${min} pages` : `${min}–${max} pages`;
  }

  const downloadReport = () => {
    if (!original || results.length === 0) return;
    const text = buildReportText({
      origName: original.name,
      origPages: original.pages,
      ignoreCase,
      ignoreWhitespace,
      entries: results.map((r) => ({
        revName: r.revName,
        revPages: r.revPages,
        compared: r.compared,
        pages: r.pages,
        truncated: r.truncated,
      })),
    });
    downloadBlob(
      new TextEncoder().encode(text),
      reportFileName(original.name),
      "text/plain;charset=utf-8",
    );
  };

  const changePage = (revId: number, delta: number, total: number) => {
    setView((v) => {
      const cur = v[revId] ?? 1;
      return { ...v, [revId]: Math.min(total, Math.max(1, cur + delta)) };
    });
  };

  const translatedTruncated = results.reduce(
    (acc: number[], r) => {
      r.truncated.forEach((p) => {
        if (!acc.includes(p)) acc.push(p);
      });
      return acc;
    },
    [],
  );

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Add a PDF to compare"
        className="hidden"
        onChange={(e) => {
          void handleAdd(e.target.files?.[0] ?? undefined);
          e.target.value = "";
        }}
      />
      <span className="sr-only" role="status">
        {busy ? `Busy — ${progress}` : ""}
      </span>

      {error && (
        <div
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || docs.length >= MAX_DOCS}
            onClick={() => inputRef.current?.click()}
          >
            <Plus className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Add PDF
          </Button>
          <p className="mt-2 text-xs text-slate-500" role="status">
            Add 2–5 PDFs. The file you mark as original is the base; every other
            file is compared against it. Nothing is uploaded.
          </p>
        </div>

        {docs.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">
              PDFs to compare
            </legend>
            <ol className="space-y-2">
              {docs.map((d, i) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                >
                  <span className="font-semibold text-slate-700 w-6">
                    {i + 1}.
                  </span>
                  <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span className="font-medium text-slate-800 min-w-0 flex-1 truncate">
                    {d.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {d.pages} page{d.pages === 1 ? "" : "s"} ·{" "}
                    {fmtBytes(d.bytes.length)}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="original"
                      checked={original?.id === d.id}
                      disabled={busy}
                      onChange={() => handleOriginalChange(d.id)}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    Original
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => handleRemove(d.id)}
                    aria-label={`Remove ${d.name}`}
                    className="!px-2.5 !py-1 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500">
              An encrypted or damaged file is rejected the moment you add it.
            </p>
          </fieldset>
        )}

        {docs.length >= 2 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">
              Compare options
            </legend>
            <div className="grid sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={ignoreCase}
                  disabled={busy}
                  onChange={(e) => toggleOption(setIgnoreCase, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                Ignore upper/lower case
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={ignoreWhitespace}
                  disabled={busy}
                  onChange={(e) =>
                    toggleOption(setIgnoreWhitespace, e.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                Ignore whitespace
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  disabled={busy}
                  onChange={(e) =>
                    setOnlyDifferences(e.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                Only show changed lines
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Extra spaces are always collapsed even with ignore-whitespace off.
              Reordered lines count as removed plus added.
            </p>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={busy || docs.length < 2}
            onClick={() => void compare()}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
            ) : (
              <GitCompareArrows className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            )}
            {busy ? "Comparing…" : "Compare PDFs"}
          </Button>
          <span className="text-sm text-slate-500" role="status">
            {docs.length < 2
              ? "Add a second PDF to enable the comparison."
              : `${docs.length} files ready — the shortest file has ${Math.min(...docs.map((d) => d.pages))} page${Math.min(...docs.map((d) => d.pages)) === 1 ? "" : "s"}, so up to that many are compared per file.`}
          </span>
        </div>

        {progress && (
          <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" aria-hidden="true" />
            {progress}
          </div>
        )}
      </div>

      {docs.length >= 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-700 leading-relaxed">
            This tool compares the <span className="font-semibold">text layers</span>{" "}
            of each PDF page and highlights added and removed lines. It is not a
            visual or pixel diff: layout, fonts, images and scanned (image-only)
            pages have no text to compare, so they are reported as unchanged or
            empty. Files are matched on shared page count — pages that exist in
            only one file are not compared.
          </p>
        </div>
      )}

      {results.length > 0 && original && (
        <section
          aria-labelledby={resultsHeadingId}
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id={resultsHeadingId}
                className="text-base font-bold text-slate-900"
              >
                Diff against {original.name}
              </h2>
              <p className="text-xs text-slate-500" role="status">
                {message} Lines shown in red were removed; green were added.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={downloadReport}
            >
              <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
              Download diff report (.txt)
            </Button>
          </div>

          <p className="text-sm text-slate-500">
            {results.reduce((m, r) => m + r.pages.reduce((s, p) => s + p.added + p.removed, 0), 0) === 0
              ? "No differences found in the compared pages."
              : `Changed lines across ${results.length} comparison${results.length === 1 ? "" : "s"}: ${results.reduce((m, r) => m + r.pages.reduce((s, p) => s + p.added, 0), 0)} added, ${results.reduce((m, r) => m + r.pages.reduce((s, p) => s + p.removed, 0), 0)} removed.`}
          </p>
          {translatedTruncated.length > 0 && (
            <p className="text-xs text-slate-500">
              Pages {translatedTruncated.join(", ")} were trimmed to the first{" "}
              {MAX_LINES_PER_PAGE} lines for display.
            </p>
          )}

          {results.map((r) => {
            const cur = view[r.revId] ?? 1;
            const page = r.pages.find((p) => p.page === cur) ?? r.pages[0];
            if (!page) return null;
            const rows = onlyDifferences
              ? page.rows.filter((row) => row.kind !== "same")
              : page.rows;
            const shown = rows.slice(0, MAX_VISIBLE_ROWS);
            const hiddenCount = rows.length - shown.length;
            return (
              <div
                key={r.revId}
                className="rounded-xl border border-slate-200 overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <p className="text-sm font-semibold text-slate-800 min-w-0 truncate">
                    {r.revName}{" "}
                    <span className="text-slate-400 font-normal">
                      vs {original.name}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {page.added + page.removed === 0
                      ? "No changes"
                      : `${page.added} added · ${page.removed} removed`}{" "}
                    on this page
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={cur <= 1 || busy}
                      onClick={() => changePage(r.revId, -1, r.compared)}
                      aria-label="Previous page"
                      className="!px-2.5 !py-1 text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                    <span className="text-xs text-slate-600 tabular-nums">
                      Page {cur} of {r.compared}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={cur >= r.compared || busy}
                      onClick={() => changePage(r.revId, 1, r.compared)}
                      aria-label="Next page"
                      className="!px-2.5 !py-1 text-xs"
                    >
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {r.revPages !== r.compared && (
                  <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
                    Page counts differ ({original.pages} vs {r.revPages}) — only
                    the first {r.compared} shared page
                    {r.compared === 1 ? "" : "s"} were compared.
                  </p>
                )}
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <p className="px-4 py-2 text-xs font-semibold text-slate-500 bg-white">
                    {original.name}
                  </p>
                  <p className="px-4 py-2 text-xs font-semibold text-slate-500 bg-white">
                    {r.revName}
                  </p>
                </div>
                {rows.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">
                    No changed lines on this page.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {shown.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-t border-slate-100 first:border-t-0"
                        >
                          <td
                            className={`px-4 py-1.5 align-top whitespace-pre-wrap break-words w-1/2 ${
                              row.kind === "removed"
                                ? "bg-red-50 text-red-800"
                                : row.kind === "added"
                                  ? "text-slate-300"
                                  : "text-slate-700"
                            }`}
                          >
                            {row.aText !== null &&
                              (row.kind === "removed"
                                ? `− ${row.aText}`
                                : row.kind === "added"
                                  ? ""
                                  : row.aText)}
                          </td>
                          <td
                            className={`px-4 py-1.5 align-top whitespace-pre-wrap break-words w-1/2 ${
                              row.kind === "added"
                                ? "bg-green-50 text-green-800"
                                : row.kind === "removed"
                                  ? "text-slate-300"
                                  : "text-slate-700"
                            }`}
                          >
                            {row.bText !== null &&
                              (row.kind === "added"
                                ? `+ ${row.bText}`
                                : row.kind === "removed"
                                  ? ""
                                  : row.bText)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {hiddenCount > 0 && (
                  <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
                    Showing the first {shown.length} lines of {rows.length} —
                    use Download diff report for the complete list.
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}