"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Ruler,
  Scaling,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { ensurePdfjsWorker } from "@/features/pdf-office/support";
import {
  DEFAULT_PERCENT,
  MAX_FILE_BYTES,
  MAX_PAGES,
  MAX_PERCENT,
  MIN_PERCENT,
  PRESETS,
  clampPercent,
  describeBox,
  formatBytes,
  formatInches,
  outputNameFor,
} from "./scale-format";
import type { PageBox, ScaledDocument } from "./scale-geometry";

const PDF_MAGIC = "%PDF-";
const HEADER_SCAN_BYTES = 1024;

/** Page 1 as a reader displays it, in PDF points. */
type FirstPage = PageBox;

function looksLikePdf(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, HEADER_SCAN_BYTES);
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, limit));
  return head.includes(PDF_MAGIC);
}

function friendlyError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "PasswordException" || name === "EncryptedPDFError") {
    return "This PDF is password-protected. Remove the password with PDF Unlock, then scale the unlocked copy.";
  }
  if (/no password given|password|encrypt/i.test(msg)) {
    return "This PDF is password-protected. Remove the password with PDF Unlock, then scale the unlocked copy.";
  }
  if (/invalid pdf|failed to parse|no pdf header|invalidpdfexception|unexpected eof|corrupt/i.test(msg)) {
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  }
  if (/no pages/i.test(msg)) {
    return "That PDF has no pages to scale.";
  }
  return "Couldn't read that PDF — it may be corrupt or in an unsupported format.";
}

function userFacing(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing) {
    return err.message;
  }
  return friendlyError(err);
}

export default function PdfScalePages() {
  const [name, setName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [fileSize, setFileSize] = useState(0);
  const [firstPage, setFirstPage] = useState<FirstPage | null>(null);
  const [percent, setPercent] = useState(DEFAULT_PERCENT);
  const [percentText, setPercentText] = useState(String(DEFAULT_PERCENT));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScaledDocument | null>(null);
  const [resultName, setResultName] = useState("");

  const runIdRef = useRef(0);
  const bytesRef = useRef<Uint8Array | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const percentId = useId();
  const sliderId = useId();
  const hintId = useId();

  const resetResult = () => {
    bytesRef.current = null;
    setName("");
    setNumPages(0);
    setFileSize(0);
    setFirstPage(null);
    setMessage("");
    setResult(null);
    setResultName("");
  };

  const applyPercent = (value: number) => {
    const next = clampPercent(value);
    setPercent(next);
    setPercentText(String(next));
  };

  // The preview follows what is in the field (clamped) so typing 500 shows
  // 400% before it is committed on blur or Enter.
  const shownPercent = clampPercent(Number(percentText) || percent);
  const shownFactor = shownPercent / 100;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress("Reading the PDF…");
    setResult(null);
    setResultName("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB — files up to 100 MB are supported here.`,
        );
      }
      const data = new Uint8Array(await file.arrayBuffer());
      if (runId !== runIdRef.current) return;
      if (data.length === 0) {
        throw userFacing("That file is empty. Choose a PDF with at least one page.");
      }
      if (!looksLikePdf(data)) {
        throw userFacing(
          "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.",
        );
      }
      setProgress("Counting pages…");
      const pdfjs = await import("pdfjs-dist");
      ensurePdfjsWorker(pdfjs);
      // pdf.js takes ownership of the buffer it is given, so it gets a copy.
      const task = pdfjs.getDocument({ data: data.slice(0) });
      let count: number;
      let first: FirstPage;
      try {
        const doc = await task.promise;
        count = doc.numPages;
        if (count > 0) {
          const page = await doc.getPage(1);
          try {
            const view = page.getViewport({ scale: 1 });
            first = { width: view.width, height: view.height };
          } finally {
            try {
              page.cleanup();
            } catch {
              /* noop */
            }
          }
        } else {
          first = { width: 612, height: 792 };
        }
      } finally {
        try {
          await task.destroy();
        } catch {
          /* noop */
        }
      }
      if (runId !== runIdRef.current) return;
      if (count > MAX_PAGES) {
        throw userFacing(
          `This PDF has ${count} pages — scaling supports up to 200 pages per file. Use PDF Split first.`,
        );
      }
      bytesRef.current = data;
      setName(file.name);
      setFileSize(data.length);
      setNumPages(count);
      setFirstPage(first);
      setMessage("Loaded — pick a scale, then make the scaled copy.");
    } catch (err) {
      if (runId !== runIdRef.current) return;
      resetResult();
      setError(toUiError(err));
    } finally {
      if (runId === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    void handleFile(file);
  };

  const handleScale = async () => {
    const data = bytesRef.current;
    if (!data || numPages < 1 || busy) return;
    const target = clampPercent(Number(percentText) || percent);
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    setResultName("");
    setProgress("Scaling page 1…");
    try {
      const { scalePdfInPlace } = await import("./scale-geometry");
      const scaled = await scalePdfInPlace({
        data,
        factor: target / 100,
        onProgress: (done, total) => {
          if (runId === runIdRef.current) setProgress(`Scaling page ${done} of ${total}…`);
        },
        isStale: () => runId !== runIdRef.current,
      });
      if (!scaled || runId !== runIdRef.current) return;
      setProgress("Writing the scaled PDF…");
      const filename = outputNameFor(name, target);
      setResult(scaled);
      setResultName(filename);
      setPercent(target);
      setPercentText(String(target));
      setMessage(
        `Scaled ${scaled.pages} page${scaled.pages === 1 ? "" : "s"} by ${target}% — downloaded ${filename}.`,
      );
      downloadBlob(scaled.bytes, filename);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setResult(null);
      setResultName("");
      setError(toUiError(err));
    } finally {
      if (runId === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const previewAfter: PageBox | null = firstPage
    ? { width: firstPage.width * shownFactor, height: firstPage.height * shownFactor }
    : null;
  const sizeChange =
    result && fileSize > 0 ? Math.round((result.bytes.length / fileSize) * 100) : null;

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only peer"
        aria-label="Choose a PDF to scale"
        onChange={(e) => handlePicker(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? progress || "Working on the PDF…" : ""}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={fileInputId}
          className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition inline-flex items-center gap-2 ${
            busy
              ? "opacity-60 pointer-events-none"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 cursor-pointer"
          } peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="w-4 h-4" aria-hidden="true" />
          )}
          {name ? "Choose another PDF" : "Open PDF"}
        </label>
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name} — ${numPages} page${numPages === 1 ? "" : "s"}, ${formatBytes(fileSize)}`
            : "Scale every page of a PDF by one factor, on this device. Page boxes, content and annotations scale together and the text stays selectable — nothing is uploaded."}
        </span>
        {name && !busy && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              runIdRef.current += 1;
              resetResult();
              setError("");
              setMessage("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
        >
          {error}
          {/Unlock/i.test(error) && (
            <Link
              href="/use/pdf-unlock"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 underline ml-1"
            >
              Open PDF Unlock <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
        >
          {message}
        </div>
      )}

      {numPages > 0 && firstPage && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 max-w-2xl">
          <fieldset className="space-y-3" disabled={busy}>
            <legend className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Scale factor (same on both axes)
            </legend>

            <div className="flex flex-wrap items-center gap-1.5" role="none">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPercent(p)}
                  aria-pressed={shownPercent === p}
                  className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    shownPercent === p
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:items-center">
              <div>
                <label
                  htmlFor={percentId}
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Scale (%)
                </label>
                <input
                  id={percentId}
                  type="number"
                  inputMode="numeric"
                  min={MIN_PERCENT}
                  max={MAX_PERCENT}
                  step={1}
                  value={percentText}
                  aria-describedby={hintId}
                  onChange={(e) => setPercentText(e.target.value)}
                  onBlur={() => applyPercent(Number(percentText) || percent)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    applyPercent(Number(percentText) || percent);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                />
              </div>
              <div>
                <label htmlFor={sliderId} className="sr-only">
                  Scale percentage slider
                </label>
                <input
                  id={sliderId}
                  type="range"
                  min={MIN_PERCENT}
                  max={MAX_PERCENT}
                  step={1}
                  value={shownPercent}
                  onChange={(e) => applyPercent(Number(e.target.value))}
                  className="w-full accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                />
                <p className="text-xs text-slate-500">
                  {MIN_PERCENT}%–{MAX_PERCENT}%, one factor for width and height.
                </p>
              </div>
            </div>
            <p id={hintId} className="text-xs text-slate-500">
              100% is the page as it is. The same factor is applied to width and
              height, so the page keeps its proportions — this scales a page, it
              does not convert it to a different paper size.
            </p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-800">
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-slate-600">Page 1 now</dt>
                <dd className="font-semibold">
                  {describeBox(firstPage.width, firstPage.height)}
                  <span className="block text-slate-500">
                    {formatInches(firstPage.width)} × {formatInches(firstPage.height)}
                  </span>
                </dd>
              </div>
              <div className="rounded-lg bg-indigo-50 px-2.5 py-2">
                <dt className="text-indigo-700">Page 1 at {shownPercent}%</dt>
                <dd className="font-semibold">
                  {previewAfter ? describeBox(previewAfter.width, previewAfter.height) : "—"}
                  {previewAfter && (
                    <span className="block text-indigo-700">
                      {formatInches(previewAfter.width)} × {formatInches(previewAfter.height)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" disabled={busy} onClick={() => void handleScale()}>
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
                ) : (
                  <Scaling className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
                )}
                {busy
                  ? progress || "Scaling…"
                  : `Scale ${numPages} page${numPages === 1 ? "" : "s"} by ${shownPercent}% → PDF`}
              </Button>
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                Scaled on this device — the file is never uploaded.
              </span>
            </div>
          </fieldset>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>What this does, and what it does not:</strong> the page
                content is scaled, not re-rendered as a picture, so text stays
                real text — selectable, searchable and copyable. Every page box
                the page defines (media, crop, bleed, trim, art) is scaled with
                it, and link boxes, comment boxes, ink strokes and form-field
                rectangles follow the page. Proportions are preserved, so 50% of
                an A4 page is still A4-shaped and smaller — use a page-size tool
                if you want to change the paper. A digital signature does not
                survive a re-save, and a form field keeps its value: its
                appearance stream is scaled with its box rather than
                re-rendered for the new size.
              </span>
            </p>
          </div>
        </div>
      )}

      {result && resultName && (
        <div
          role="region"
          aria-label="Scaled PDF result"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3 max-w-2xl"
        >
          <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
            <Ruler className="w-4 h-4" aria-hidden="true" />
            Scaled copy ready
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-emerald-900">
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Pages</dt>
              <dd className="font-semibold">{result.pages}</dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Scale</dt>
              <dd className="font-semibold">
                {Math.round(result.firstAfter.width / result.firstBefore.width * 100)}%
              </dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Output size</dt>
              <dd className="font-semibold">{formatBytes(result.bytes.length)}</dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">vs. original</dt>
              <dd className="font-semibold">
                {sizeChange === null ? "—" : `${sizeChange >= 0 ? "+" : ""}${sizeChange}%`}
              </dd>
            </div>
          </dl>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-emerald-900">
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Page 1 before</dt>
              <dd className="font-semibold">{describeBox(result.firstBefore.width, result.firstBefore.height)}</dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Page 1 after</dt>
              <dd className="font-semibold">
                {describeBox(result.firstAfter.width, result.firstAfter.height)}
                <span className="block text-emerald-700">
                  {formatInches(result.firstAfter.width)} × {formatInches(result.firstAfter.height)}
                </span>
              </dd>
            </div>
          </dl>
          {result.mixedSizes && (
            <p
              role="status"
              className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
            >
              This file mixes page sizes. Every page was scaled by the same
              factor, so the pages now range from{" "}
              {describeBox(result.smallestAfter.width, result.smallestAfter.height)} to{" "}
              {describeBox(result.largestAfter.width, result.largestAfter.height)} — each
              page keeps its own proportions.
            </p>
          )}
          {result.skippedBoxes > 0 && (
            <p
              role="alert"
              className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
            >
              {result.skippedBoxes} page box{result.skippedBoxes === 1 ? " was" : "es were"} too
              malformed to scale and {result.skippedBoxes === 1 ? "was" : "were"} left as they
              were. The page content itself was still scaled.
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadBlob(result.bytes, resultName)}
          >
            <Scaling className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Download {resultName} again
          </Button>
          <p className="text-xs text-emerald-800 flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              The scaled copy is the same document with its pages resized: text,
              fonts, images, bookmarks, links, form fields and document metadata
              are carried over, because the pages are scaled in place rather than
              rebuilt. Open it in a reader and check a page before you send it,
              and keep the original if you still need the old page size.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
