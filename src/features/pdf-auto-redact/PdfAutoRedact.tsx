"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, EyeOff, FileText, Loader2, Search, ShieldAlert } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { ensurePdfjsWorker } from "@/features/pdf-office/support";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_MATCHES = 100;

interface RedactRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TextItem {
  str?: string;
  width?: number;
  height?: number;
  fontHeight?: number;
  transform?: number[];
}

interface PageMatch {
  page: number;
  count: number;
  rects: RedactRect[];
}

interface SearchResult {
  pages: PageMatch[];
  total: number;
  capped: boolean;
}

interface MatchSource {
  useRegex: boolean;
  regex: string;
  terms: string;
  caseSensitive: boolean;
  wholeWord: boolean;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMatcher(source: MatchSource): { re?: RegExp; error?: string } {
  const flags = source.caseSensitive ? "gu" : "giu";
  if (source.useRegex) {
    const pattern = source.regex.trim();
    if (!pattern)
      return { error: "Enter a regular expression first, or switch back to words." };
    try {
      return { re: new RegExp(pattern, flags) };
    } catch (err) {
      return {
        error: `That regular expression is invalid${
          err instanceof Error ? ` — ${err.message}` : ""
        }.`,
      };
    }
  }
  const patterns = source.terms
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (patterns.length === 0)
    return { error: "Type a word or phrase to search for first." };
  const joined = patterns
    .map((p) =>
      source.wholeWord ? `\\b${escapeRegex(p)}\\b` : escapeRegex(p),
    )
    .join("|");
  return { re: new RegExp(joined, flags) };
}

function itemRect(item: TextItem): RedactRect {
  const t =
    Array.isArray(item.transform) && item.transform.length >= 4
      ? item.transform
      : [1, 0, 0, 1, 0, 0];
  const heights = [item.height, item.fontHeight, Math.abs(t[3] ?? 0)]
    .filter(
      (v): v is number =>
        typeof v === "number" && Number.isFinite(v) && v > 0,
    );
  const h = heights.length > 0 ? Math.max(...heights) : 10;
  const w =
    typeof item.width === "number" && Number.isFinite(item.width) && item.width > 0
      ? item.width
      : 0;
  const padBelow = h * 0.3;
  const padAbove = h * 0.25;
  return {
    x: typeof t[4] === "number" ? t[4] : 0,
    y: (typeof t[5] === "number" ? t[5] : 0) - padBelow,
    w,
    h: h + padBelow + padAbove,
  };
}

function searchMatches(
  items: TextItem[],
  re: RegExp,
  cap: number,
): { rects: RedactRect[]; capped: boolean } {
  const rects: RedactRect[] = [];
  for (const item of items) {
    const str = typeof item.str === "string" ? item.str : "";
    if (!str) continue;
    re.lastIndex = 0;
    if (!re.test(str)) continue;
    rects.push(itemRect(item));
    if (rects.length >= cap) return { rects, capped: true };
  }
  return { rects, capped: false };
}

async function pdfPageCount(data: Uint8Array): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfjsWorker(pdfjs);
  const task = pdfjs.getDocument({ data: data.slice(0) });
  try {
    const doc = await task.promise;
    return doc.numPages;
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

async function searchPdf(
  data: Uint8Array,
  re: RegExp,
  onProgress: (page: number, total: number) => void,
): Promise<SearchResult> {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfjsWorker(pdfjs);
  const task = pdfjs.getDocument({ data: data.slice(0) });
  try {
    const doc = await task.promise;
    const pages: PageMatch[] = [];
    let total = 0;
    let capped = false;
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress(p, doc.numPages);
      const page = await doc.getPage(p);
      try {
        const content = await page.getTextContent();
        const items = (content.items ?? []) as TextItem[];
        const { rects, capped: pageCapped } = searchMatches(
          items,
          re,
          MAX_MATCHES - total,
        );
        if (rects.length > 0)
          pages.push({ page: p, count: rects.length, rects });
        total += rects.length;
        if (pageCapped || total >= MAX_MATCHES) {
          if (pageCapped) capped = true;
          if (total >= MAX_MATCHES) capped = true;
          break;
        }
      } finally {
        try {
          page.cleanup();
        } catch {
          /* noop */
        }
      }
    }
    return { pages, total, capped };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

async function renderPagePreview(
  data: Uint8Array,
  pageNumber: number,
  rects: RedactRect[],
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfjsWorker(pdfjs);
  const task = pdfjs.getDocument({ data: data.slice(0) });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error(
          "This page is too large to render — it exceeds the browser's drawing buffer limits.",
        );
      await page.render({ canvas, viewport }).promise;
      ctx.fillStyle = "rgba(225, 29, 72, 0.28)";
      ctx.strokeStyle = "rgb(225, 29, 72)";
      ctx.lineWidth = 2;
      for (const r of rects) {
        const [p0x, p0y] = viewport.convertToViewportPoint(r.x, r.y);
        const [p1x, p1y] = viewport.convertToViewportPoint(
          r.x + r.w,
          r.y + r.h,
        );
        const left = Math.min(p0x, p1x);
        const top = Math.min(p0y, p1y);
        const width = Math.abs(p1x - p0x);
        const height = Math.abs(p1y - p0y);
        ctx.fillRect(left, top, width, height);
        ctx.strokeRect(left, top, width, height);
      }
      return canvas.toDataURL("image/png");
    } finally {
      try {
        page.cleanup();
      } catch {
        /* noop */
      }
    }
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

async function burnRedactions(
  data: Uint8Array,
  pages: PageMatch[],
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(data);
  for (const pageMatch of pages) {
    const page = doc.getPage(pageMatch.page - 1);
    for (const r of pageMatch.rects) {
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.w,
        height: r.h,
        color: rgb(0, 0, 0),
      });
    }
  }
  return doc.save();
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/No password given|password|encrypted/i.test(msg))
    return "This PDF is password-protected. Remove the password with PDF Unlock, then redact it again.";
  if (/Invalid PDF|Failed to parse|No PDF header/i.test(msg))
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

function outputNameFor(source: string): string {
  return `${source.replace(/\.pdf$/i, "")}-redacted.pdf`;
}

export default function PdfAutoRedact() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [terms, setTerms] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [regex, setRegex] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const [matches, setMatches] = useState<PageMatch[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [capped, setCapped] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const [activePage, setActivePage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outputName, setOutputName] = useState("");

  const runIdRef = useRef(0);
  const viewEpochRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const termsId = useId();
  const regexId = useId();

  function resetState() {
    setBytes(null);
    setNumPages(0);
    setName("");
    setMessage("");
    setProgress("");
    setSearchMessage("");
    setMatches([]);
    setTotalHits(0);
    setCapped(false);
    setOutput(null);
    setOutputName("");
    setActivePage(1);
    setPreviewUrl(null);
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress("");
    setSearchMessage("");
    setMatches([]);
    setTotalHits(0);
    setCapped(false);
    setOutput(null);
    setOutputName("");
    setActivePage(1);
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `This PDF is ${Math.round(file.size / 1048576)} MB — files up to 100 MB are supported.`,
        );
      }
      const data = new Uint8Array(await file.arrayBuffer());
      if (runId !== runIdRef.current) return;
      const count = await pdfPageCount(data);
      if (runId !== runIdRef.current) return;
      if (count > MAX_PAGES) {
        throw userFacing(
          `This PDF has ${count} pages — files up to 200 pages are supported. Use PDF Split first.`,
        );
      }
      setBytes(data);
      setNumPages(count);
      setName(file.name);
      setPreviewUrl(null);
      setMessage(
        `Loaded ${file.name} — ${count} page${count === 1 ? "" : "s"} ready. Now search for a term to redact.`,
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

  const handleSearch = async () => {
    if (!bytes || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress("");
    setSearchMessage("");
    setMatches([]);
    setTotalHits(0);
    setCapped(false);
    setOutput(null);
    setOutputName("");
    try {
      const matcher = buildMatcher({
        useRegex,
        regex,
        terms,
        caseSensitive,
        wholeWord,
      });
      if (matcher.error || !matcher.re) throw userFacing(matcher.error ?? "");
      const result = await searchPdf(bytes, matcher.re, (p, total) => {
        if (runId === runIdRef.current)
          setProgress(`Searching page ${p} of ${total}…`);
      });
      if (runId !== runIdRef.current) return;
      setMatches(result.pages);
      setTotalHits(result.total);
      setCapped(result.capped);
      if (result.total === 0) {
        const label = useRegex
          ? regex.trim() || "your expression"
          : terms
              .split(/\r?\n/)
              .map((t) => t.trim())
              .filter(Boolean)
              .join(", ");
        setSearchMessage(
          `No matches found for "${label}". The PDF may store this text as an image or as individual outline glyphs — see the notes below.`,
        );
      } else {
        setSearchMessage(
          `Found ${result.total} match${result.total === 1 ? "" : "es"} across ${
            result.pages.length
          } page${result.pages.length === 1 ? "" : "s"}. Review the preview below, then confirm before anything is drawn.`,
        );
      }
      if (result.pages.length > 0) setActivePage(result.pages[0].page);
    } catch (err) {
      if (runId === runIdRef.current) {
        resetState();
        setError(toUiError(err));
      }
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!bytes || matches.length === 0 || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setProgress("");
    try {
      setProgress("Drawing black boxes…");
      const redacted = await burnRedactions(bytes, matches);
      if (runId !== runIdRef.current) return;
      setOutput(redacted);
      setOutputName(outputNameFor(name));
      setMessage(
        "Redactions drawn into a new PDF. Open it and confirm the text is hidden before you share it — the covered words still exist below the boxes in the file.",
      );
    } catch (err) {
      if (runId === runIdRef.current) setError(toUiError(err));
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  useEffect(() => {
    const epoch = ++viewEpochRef.current;
    let cancelled = false;
    void (async () => {
      if (!bytes || numPages === 0) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        return;
      }
      const forPage = matches.find((m) => m.page === activePage);
      const rects = forPage ? forPage.rects : [];
      setPreviewLoading(true);
      try {
        const url = await renderPagePreview(bytes, activePage, rects);
        if (!cancelled && epoch === viewEpochRef.current) setPreviewUrl(url);
      } catch {
        if (!cancelled && epoch === viewEpochRef.current) setPreviewUrl(null);
      } finally {
        if (!cancelled && epoch === viewEpochRef.current)
          setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, numPages, activePage, matches]);

  const hitCountByPage = new Map(
    matches.map((m) => [m.page, m.count] as const),
  );

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF to auto-redact"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
      <span className="sr-only" role="status">
        {busy ? progress || "Working…" : ""}
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
            ? `${name} loaded — ${numPages} pages.`
            : "Find every occurrence of a name, number or phrase in a PDF and cover it with a black box — entirely in your browser."}
        </span>
      </div>

      {error && (
        <div
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
          {/Unlock/i.test(error) && (
            <Link
              href="/use/pdf-unlock"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 underline ml-1"
            >
              Open PDF Unlock <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}
      {message && (
        <div
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
          role="status"
        >
          {message}
        </div>
      )}
      {searchMessage && (
        <div
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
          role="status"
        >
          {searchMessage}
        </div>
      )}

      {bytes && numPages > 0 && (
        <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <legend className="px-2 text-sm font-semibold text-slate-700">
            What to redact
          </legend>
          {useRegex ? (
            <div>
              <label
                htmlFor={regexId}
                className="text-sm font-medium text-slate-700"
              >
                Regular expression
              </label>
              <StyledTextarea
                id={regexId}
                value={regex}
                onChange={(e) => setRegex(e.target.value)}
                placeholder={"\\b\\d{5}\\b"}
                rows={2}
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor={termsId}
                className="text-sm font-medium text-slate-700"
              >
                Word or phrase
              </label>
              <StyledTextarea
                id={termsId}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder={"Address\naccount-4381\nsupport@example.com"}
                rows={2}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Case-sensitive
            </label>
            {!useRegex && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={wholeWord}
                  onChange={(e) => setWholeWord(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                Whole word only
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Use regex
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Matching is case-insensitive unless Case-sensitive is on. Search is
            limited to the PDF&apos;s text layer — text stored as images or as
            individual outline glyphs won&apos;t be found, and a phrase split
            across text runs can be missed. Review the preview before
            confirming.
          </p>
          <Button type="button" disabled={busy} onClick={handleSearch}>
            <Search className="w-4 h-4 mr-1.5 inline" />
            Find matches
          </Button>
        </fieldset>
      )}

      {bytes && numPages > 0 && (
        <>
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <legend className="px-2 text-sm font-semibold text-slate-700">
              Review matches — page {activePage} of {numPages}
            </legend>
            <nav aria-label="Pages" className="flex flex-wrap gap-1.5">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
                const hits = hitCountByPage.get(p) ?? 0;
                const active = p === activePage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setActivePage(p)}
                    aria-current={active ? "page" : undefined}
                    aria-label={`Page ${p}${hits ? ` — ${hits} match${hits === 1 ? "" : "es"}` : ""}`}
                    className={`min-w-8 h-8 rounded-lg px-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      active
                        ? "bg-indigo-600 text-white"
                        : hits
                          ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                    {hits > 0 && (
                      <span className="ml-1 rounded bg-red-600 text-white text-[10px] px-1">
                        {hits}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              {previewLoading ? (
                <div className="flex items-center justify-center py-24 text-sm text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Rendering preview…
                </div>
              ) : previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={`Page ${activePage} preview with redaction boxes`}
                    className="w-full h-auto block"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500 text-center py-16">
                  Couldn&apos;t render this page.
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Red boxes mark the areas that will be covered by a solid black
              box. A match anywhere in a text chunk covers the whole chunk —
              that box hides text, it doesn&apos;t erase it from the file.
            </p>
          </fieldset>

          {matches.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Confirm redaction — {totalHits} match{totalHits === 1 ? "" : "es"}{" "}
                on {matches.length} page{matches.length === 1 ? "" : "s"}
              </h3>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                {matches.map((m) => (
                  <li key={m.page}>
                    Page {m.page} — {m.count} match{m.count === 1 ? "" : "es"}
                  </li>
                ))}
              </ul>
              {capped && (
                <p
                  className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                  role="alert"
                >
                  Search stopped at {MAX_MATCHES} matches. Only the matches
                  shown above will be covered — use a more specific term or
                  regex to stay within the limit.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Solid black boxes are drawn over the matched text in a new,
                separate file. Your original is never modified.
              </p>
              <Button type="button" disabled={busy} onClick={handleConfirm}>
                <ShieldAlert className="w-4 h-4 mr-1.5 inline" />
                Redact these {totalHits} match{totalHits === 1 ? "" : "es"}
              </Button>
            </div>
          )}

          {output && outputName && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="text-sm font-semibold text-emerald-900 mb-3">
                Redacted copy ready
              </h3>
              <Button
                type="button"
                variant="secondary"
                onClick={() => downloadBlob(output, outputName, "application/pdf")}
              >
                <EyeOff className="w-4 h-4 mr-1.5 inline" />
                Download {outputName}
              </Button>
              <p className="text-xs text-emerald-800 mt-3">
                Open the download and try to select or search the redacted
                text before sharing. Because the boxes sit on top of the text,
                the words still exist in the file — this is a visual cover, not
                a permanent erasure.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}