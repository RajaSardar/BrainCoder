"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileImage,
  Loader2,
  ScanText,
  ShieldCheck,
  Square,
  TriangleAlert,
} from "lucide-react";
import { Button, CopyButton } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import type { OcrResult } from "./ocr-engine";
import {
  ACCEPTED_FORMAT_NAMES,
  ACCEPTED_IMAGE_TYPES,
  CONFIDENCE_NOTES,
  DEFAULT_LANGUAGE,
  FILE_SIZE_LABEL,
  MAX_FILE_BYTES,
  OCR_ERROR_MESSAGES,
  OCR_LANGUAGES,
  PIXEL_BUDGET_LABEL,
  SIDE_LIMIT_LABEL,
  confidenceBand,
  describeImageSize,
  formatBytes,
  languageLabel,
  modelSizeLabel,
  normalizeOcrText,
  outputNameFor,
  preflightImage,
  textStats,
} from "./ocr-format";

type LoadedImage = {
  name: string;
  size: number;
  url: string;
  label: string;
  width: number;
  height: number;
  pixels: number;
  file: File;
};

const NO_TEXT =
  "No text was recognized in this image. OCR reads printed text best — a larger, straighter, better-lit scan of the same page usually fixes it.";

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg || OCR_ERROR_MESSAGES.unknown;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing) {
    return err.message;
  }
  return friendlyError(err);
}

function describeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function userFacingError(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

export default function ImageOcr() {
  const [lang, setLang] = useState(DEFAULT_LANGUAGE);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [resultName, setResultName] = useState("");

  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const terminateRef = useRef<(() => Promise<void>) | null>(null);
  const fileInputId = useId();
  const langId = useId();
  const langNoteId = useId();

  const releaseUrl = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  useEffect(() => releaseUrl, []);

  const clearAll = () => {
    runIdRef.current += 1;
    releaseUrl();
    terminateRef.current = null;
    setImage(null);
    setResult(null);
    setResultName("");
    setError("");
    setMessage("");
    setProgress("");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    setResultName("");
    setProgress("Reading the file header…");
    try {
      if (file.size > MAX_FILE_BYTES) {
        // The cap is checked before the bytes are read at all, so an oversize
        // file costs a stat rather than a copy of the whole thing.
        throw userFacingError(
          `This file is ${formatBytes(file.size)} (${file.size.toLocaleString("en-US")} bytes) — images up to ${FILE_SIZE_LABEL} (${MAX_FILE_BYTES.toLocaleString("en-US")} bytes) are supported here.`,
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (runId !== runIdRef.current) return;
      const checked = preflightImage(bytes, file.name);
      if (!checked.ok) throw userFacingError(checked.message);
      releaseUrl();
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      setImage({
        name: file.name,
        size: bytes.length,
        url,
        label: checked.label,
        width: checked.width,
        height: checked.height,
        pixels: checked.pixels,
        file,
      });
      setMessage(
        `Ready — ${file.name} is a ${checked.label} of ${describeImageSize(checked.width, checked.height)}, read with the ${languageLabel(lang)} model.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      releaseUrl();
      setImage(null);
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

  const handleCancel = () => {
    runIdRef.current += 1;
    const terminate = terminateRef.current;
    terminateRef.current = null;
    void terminate?.().catch(() => {});
    setBusy(false);
    setProgress("");
    setMessage("Cancelled — the image is still selected and nothing was read from it.");
  };

  const handleExtract = async () => {
    if (!image || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    setResultName("");
    setProgress("Loading the OCR engine from this site…");
    try {
      const { runOcr } = await import("./ocr-engine");
      const ocr = await runOcr({
        image: image.file,
        lang,
        onProgress: (line) => {
          if (runId === runIdRef.current) setProgress(line);
        },
        isStale: () => runId !== runIdRef.current,
        onWorker: (terminate) => {
          terminateRef.current = terminate;
        },
      });
      if (!ocr || runId !== runIdRef.current) return;
      terminateRef.current = null;
      const text = normalizeOcrText(ocr.text);
      const filename = outputNameFor(image.name, lang);
      setResult({ ...ocr, text });
      setResultName(filename);
      setMessage(
        text
          ? `Read ${textStats(text).chars.toLocaleString("en-US")} characters from ${image.name} with the ${languageLabel(lang)} model in ${describeDuration(ocr.durationMs)} — downloaded ${filename}.`
          : NO_TEXT,
      );
      if (text) downloadBlob(new TextEncoder().encode(text), filename, "text/plain");
    } catch (err) {
      if (runId !== runIdRef.current) return;
      terminateRef.current = null;
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

  const band = result ? confidenceBand(result.confidence) : "low";
  const stats = result ? textStats(result.text) : null;

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="sr-only peer"
        aria-label="Choose an image to read text from"
        onChange={(e) => handlePicker(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? progress || "Working on the image…" : ""}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={fileInputId}
          className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition inline-flex items-center gap-2 ${
            busy
              ? "opacity-60 pointer-events-none"
              : "bg-cyan-700 text-white hover:bg-cyan-800 shadow-md shadow-cyan-600/20 cursor-pointer"
          } peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-700`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileImage className="w-4 h-4" aria-hidden="true" />
          )}
          {image ? "Choose another image" : "Open image"}
        </label>
        <span className="text-sm text-slate-500" role="status">
          {image
            ? `${image.name} — ${image.label}, ${describeImageSize(image.width, image.height)}, ${formatBytes(image.size)}`
            : `Open a ${ACCEPTED_FORMAT_NAMES} image of a page, screenshot, receipt or photo and read the printed text out of it. The image is decoded and read on this device — it is never uploaded.`}
        </span>
        {image && !busy && (
          <Button type="button" variant="secondary" onClick={clearAll}>
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
          {/Convert it first/.test(error) && (
            <Link
              href="/use/image-format-converter"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 underline ml-1"
            >
              Open Image Format Converter <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      {message && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            result
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-slate-50 border border-slate-200 text-slate-600"
          }`}
        >
          {message}
        </div>
      )}

      <div className="text-sm text-slate-500" role="status">
        {busy && <Loader2 className="w-4 h-4 animate-spin text-cyan-600 inline-block mr-2" aria-hidden="true" />}
        {busy ? progress : ""}
      </div>

      {image && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={`Preview of ${image.name}: a ${image.label} of ${image.width} by ${image.height} pixels`}
              className="max-h-40 rounded-xl border border-slate-200 w-auto"
            />
            <div className="min-w-56 flex-1">
              <label htmlFor={langId} className="block text-sm font-medium text-slate-700 mb-1">
                Language
              </label>
              <select
                id={langId}
                value={lang}
                disabled={busy}
                aria-describedby={langNoteId}
                onChange={(e) => {
                  setLang(e.target.value);
                  setMessage("");
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
              >
                {OCR_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} ({l.script})
                  </option>
                ))}
              </select>
              <p id={langNoteId} className="text-xs text-slate-500 mt-2">
                {OCR_LANGUAGES.length} languages, one at a time. The {languageLabel(lang)} model is{" "}
                {modelSizeLabel(lang)} and is downloaded from this site the first time you use it,
                then cached by the browser. Pick the language of the text in the image, not the
                language of the page around it.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={busy} onClick={() => void handleExtract()}>
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
              ) : (
                <ScanText className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
              )}
              {busy ? progress || "Reading…" : `Extract text — ${languageLabel(lang)}`}
            </Button>
            {busy && (
              <Button type="button" variant="secondary" onClick={handleCancel}>
                <Square className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                Cancel
              </Button>
            )}
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              Read on this device — the image is never uploaded.
            </span>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>What this is:</strong> Tesseract, an open-source engine that guesses the
                characters in a picture of text. It is good on clean, straight, evenly lit printed
                text and unreliable on handwriting, stylised fonts, low-contrast photos, skew and
                shadows. Nothing here is a measurement of how much of your text is right — the
                result always needs reading over. The caps are {FILE_SIZE_LABEL} per file,{" "}
                {PIXEL_BUDGET_LABEL} per image and {SIDE_LIMIT_LABEL} on the long side, and an
                image over any of them is refused with its real numbers rather than cropped or
                silently downsampled by this tool. A very large photo is downsampled by the engine
                itself, which is where accuracy usually falls apart, so a scan at roughly 300 DPI
                beats a 12-megapixel phone photo. EXIF rotation is not applied either: a photo
                stored sideways comes out sideways, so turn it before you run it.
              </span>
            </p>
          </div>
        </div>
      )}

      {result && !busy && (
        <div
          role="region"
          aria-label="Extracted text result"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3 max-w-2xl"
        >
          <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            {result.text ? "Text read" : "Nothing read"}
          </h3>
          {stats && result.text && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-emerald-900">
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-emerald-700">Characters</dt>
                <dd className="font-semibold">{stats.chars.toLocaleString("en-US")}</dd>
              </div>
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-emerald-700">Words</dt>
                <dd className="font-semibold">{stats.words.toLocaleString("en-US")}</dd>
              </div>
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-emerald-700">Lines</dt>
                <dd className="font-semibold">{stats.lines.toLocaleString("en-US")}</dd>
              </div>
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-emerald-700">Time</dt>
                <dd className="font-semibold">{describeDuration(result.durationMs)}</dd>
              </div>
            </dl>
          )}
          <p role="status" className="text-xs text-emerald-900">
            The engine reported {Math.round(result.confidence)}% confidence for this run —{" "}
            {band} ({CONFIDENCE_NOTES[band]}) That number is the recognizer&apos;s own score for its
            guesses, not a measurement of how much of the text is correct.
          </p>
          {result.text ? (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Extracted text
                </span>
                <span className="ml-auto">
                  <CopyButton text={result.text} ariaLabel="Copy the extracted text" />
                </span>
              </div>
              <pre
                tabIndex={0}
                className="px-5 py-4 text-sm text-slate-700 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
              >
                {result.text}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-slate-600">{NO_TEXT}</p>
          )}
          {result.text && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                downloadBlob(new TextEncoder().encode(result.text), resultName, "text/plain")
              }
            >
              <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
              Download {resultName} again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
