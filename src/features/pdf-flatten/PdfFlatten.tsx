"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Layers,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { ensurePdfjsWorker } from "@/features/pdf-office/support";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
// Browsers refuse very large canvases; large-format pages are rendered at a
// reduced scale instead of failing (the tool says so when it happens).
const MAX_CANVAS_AREA = 16_000_000;
const PDF_MAGIC = "%PDF-";
const HEADER_SCAN_BYTES = 1024;

type PresetId = "screen" | "balanced" | "print";

interface FlattenPreset {
  id: PresetId;
  label: string;
  detail: string;
  /** Dots per inch the page is rasterized at (PDF user space is 72 units/inch). */
  dpi: number;
  mime: "image/jpeg" | "image/png";
  /** undefined = lossless PNG */
  quality: number | undefined;
}

const PRESETS: FlattenPreset[] = [
  {
    id: "screen",
    label: "Screen",
    detail: "96 DPI, JPEG — smallest file, reads fine on a screen",
    dpi: 96,
    mime: "image/jpeg",
    quality: 0.72,
  },
  {
    id: "balanced",
    label: "Balanced",
    detail: "150 DPI, JPEG — everyday viewing and email",
    dpi: 150,
    mime: "image/jpeg",
    quality: 0.88,
  },
  {
    id: "print",
    label: "Print",
    detail: "200 DPI, lossless PNG — sharpest, largest file",
    dpi: 200,
    mime: "image/png",
    quality: undefined,
  },
];

const DEFAULT_PRESET: PresetId = "balanced";

function presetFor(id: PresetId): FlattenPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[1];
}

function scaleForDpi(dpi: number): number {
  return dpi / 72;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Cheap preflight: a PDF must announce itself with the %PDF- header. Real
 * parsing is still done by pdf.js — this only turns an obviously wrong file
 * into a friendly message instead of a raw engine exception.
 */
function looksLikePdf(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, HEADER_SCAN_BYTES);
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, limit));
  return head.includes(PDF_MAGIC);
}

function flattenName(source: string): string {
  const base = source
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim();
  return `${base || "document"}-flattened.pdf`;
}

function friendlyError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "PasswordException" || /no password given|password|encrypted/i.test(msg)) {
    return "This PDF is password-protected. Remove the password with PDF Unlock, then flatten the unlocked copy.";
  }
  if (/invalid pdf|failed to parse|no pdf header|invalidpdfexception/i.test(msg)) {
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  }
  if (/canvas|drawing buffer/i.test(msg)) {
    return "This page is too large to rasterize at that quality on this device. Try a lower quality setting.";
  }
  return "Couldn't read that PDF — it may be corrupt or in an unsupported format.";
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

interface FlattenResult {
  bytes: Uint8Array;
  pages: number;
  reducedPages: number;
  /** The lowest effective DPI actually used across the document. */
  dpiMin: number;
  /** The highest effective DPI used; equal to dpiMin unless a page was clamped. */
  dpiMax: number;
  mime: "image/jpeg" | "image/png";
  /** The preset this run actually used — not whatever is selected right now. */
  presetId: PresetId;
}

async function canvasToBytes(
  canvas: HTMLCanvasElement,
  mime: "image/jpeg" | "image/png",
  quality: number | undefined,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) {
    throw userFacing(
      `This page could not be encoded as an image. Try a different quality setting.`,
    );
  }
  return new Uint8Array(await blob.arrayBuffer());
}

async function rasterizeToImagePdf(
  data: Uint8Array,
  preset: FlattenPreset,
  onProgress: (message: string) => void,
  isStale: () => boolean,
): Promise<FlattenResult | null> {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfjsWorker(pdfjs);
  const { PDFDocument } = await import("pdf-lib");
  const task = pdfjs.getDocument({ data: data.slice(0) });
  let doc: Awaited<typeof task.promise> | undefined;
  try {
    doc = await task.promise;
    const out = await PDFDocument.create();
    let reducedPages = 0;
    let weakestScale = Number.POSITIVE_INFINITY;
    let strongestScale = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      // A newer file/preset run has taken over: stop burning CPU on this one.
      if (isStale()) return null;
      onProgress(`Rasterizing page ${n} of ${doc.numPages}…`);
      const page = await doc.getPage(n);
      try {
        // scale 1 is the page as displayed, i.e. /Rotate already applied. The
        // output page keeps those displayed dimensions and the image is baked
        // in, so the page reads the same but carries no rotation flag.
        const base = page.getViewport({ scale: 1 });
        const target = scaleForDpi(preset.dpi);
        let scale = target;
        if (base.width * target * base.height * target > MAX_CANVAS_AREA) {
          scale = target * Math.sqrt(MAX_CANVAS_AREA / (base.width * base.height * target * target));
          reducedPages += 1;
        }
        if (scale < weakestScale) weakestScale = scale;
        if (scale > strongestScale) strongestScale = scale;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw userFacing(
            "This browser could not create a drawing surface for the page image.",
          );
        }
        // White backing so transparent PDF pages don't turn black in viewers.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport }).promise;
        const imageBytes = await canvasToBytes(canvas, preset.mime, preset.quality);
        const image =
          preset.mime === "image/png"
            ? await out.embedPng(imageBytes)
            : await out.embedJpg(imageBytes);
        const outPage = out.addPage([base.width, base.height]);
        outPage.drawImage(image, {
          x: 0,
          y: 0,
          width: base.width,
          height: base.height,
        });
        // Release the backing store as soon as the image is embedded.
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        try {
          page.cleanup();
        } catch {
          /* noop */
        }
      }
    }
    if (isStale()) return null;
    onProgress("Assembling the new PDF…");
    const bytes = new Uint8Array(await out.save());
    const used = Number.isFinite(weakestScale) ? weakestScale : scaleForDpi(preset.dpi);
    return {
      bytes,
      pages: doc.numPages,
      reducedPages,
      dpiMin: Math.round(used * 72),
      dpiMax: Math.round(Math.max(used, strongestScale) * 72),
      mime: preset.mime,
      presetId: preset.id,
    };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

function dpiLabel(result: FlattenResult): string {
  return result.dpiMin === result.dpiMax
    ? `${result.dpiMin} DPI`
    : `${result.dpiMin}–${result.dpiMax} DPI`;
}

export default function PdfFlatten() {
  const [name, setName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [fileSize, setFileSize] = useState(0);
  const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<FlattenResult | null>(null);
  const [resultName, setResultName] = useState("");

  const runIdRef = useRef(0);
  const bytesRef = useRef<Uint8Array | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const groupId = useId();

  const activePreset = presetFor(preset);

  const resetResult = () => {
    bytesRef.current = null;
    setName("");
    setNumPages(0);
    setFileSize(0);
    setMessage("");
    setResult(null);
    setResultName("");
  };

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
      const task = pdfjs.getDocument({ data: data.slice(0) });
      let count: number;
      try {
        const doc = await task.promise;
        count = doc.numPages;
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
          `This PDF has ${count} pages — flattening supports up to 200 pages per file. Use PDF Split first.`,
        );
      }
      bytesRef.current = data;
      setName(file.name);
      setFileSize(data.length);
      setNumPages(count);
      setMessage(
        `Loaded ${file.name} — ${count} page${count === 1 ? "" : "s"}, ${formatBytes(data.length)}. Pick a quality, then flatten.`,
      );
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

  const handleFlatten = async () => {
    const data = bytesRef.current;
    if (!data || numPages < 1 || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    setResultName("");
    try {
      const flattened = await rasterizeToImagePdf(
        data,
        activePreset,
        (p) => {
          if (runId === runIdRef.current) setProgress(p);
        },
        () => runId !== runIdRef.current,
      );
      if (!flattened || runId !== runIdRef.current) return;
      const filename = flattenName(name);
      setResult(flattened);
      setResultName(filename);
      setMessage(
        `Flattened ${flattened.pages} page${flattened.pages === 1 ? "" : "s"} at ${dpiLabel(flattened)} — ${formatBytes(flattened.bytes.length)}. Downloaded ${filename}.`,
      );
      downloadBlob(flattened.bytes, filename);
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

  const growth =
    result && fileSize > 0
      ? Math.round((result.bytes.length / fileSize) * 100)
      : null;

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only peer"
        aria-label="Choose a PDF to flatten"
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
            : "Flatten a PDF by turning every page into one picture. Text stops being selectable or editable, the file usually gets bigger, and nothing is uploaded."}
        </span>
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

      {numPages > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 max-w-2xl">
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Raster quality (dots per inch)
            </legend>
            <div className="grid gap-2 sm:grid-cols-3" role="none">
              {PRESETS.map((p) => (
                <label
                  key={p.id}
                  htmlFor={`${groupId}-${p.id}`}
                  className="cursor-pointer"
                >
                  <input
                    id={`${groupId}-${p.id}`}
                    type="radio"
                    name={groupId}
                    value={p.id}
                    checked={preset === p.id}
                    onChange={() => setPreset(p.id)}
                    className="peer sr-only"
                  />
                  <span
                    className={`block rounded-xl border px-3 py-2 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600 ${
                      preset === p.id
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      {preset === p.id && (
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-indigo-600"
                          aria-hidden="true"
                        />
                      )}
                      {p.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {p.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Higher DPI looks sharper and produces a bigger file. Screen and
              Balanced encode each page as JPEG, which is lossy — very small
              type can show compression artifacts when zoomed in; Print uses
              lossless PNG instead. Anything already an image in your PDF is
              re-encoded at this quality too, and an unusually large page is
              rasterized below the chosen DPI rather than failing.
            </p>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={busy} onClick={() => void handleFlatten()}>
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
              ) : (
                <Layers className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
              )}
              {busy ? progress || "Flattening…" : `Flatten ${numPages} page${numPages === 1 ? "" : "s"} → PDF`}
            </Button>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              Rendered on this device — the file is never uploaded.
            </span>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>Before and after:</strong> in the original, text is
                real text — selectable, searchable, copyable, and small. In the
                flattened copy each page is one picture, so the text can no
                longer be selected, searched, copied or edited. Links,
                comments, form fields and layers are gone for the same reason.
                That is the point — but the picture is normally a much bigger
                file, and lower DPI makes small print look softer. Keep the
                original for anything you still need to read or copy.
              </span>
            </p>
          </div>
        </div>
      )}

      {result && resultName && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3 max-w-2xl">
          <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            Flattened copy ready
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-emerald-900">
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Pages</dt>
              <dd className="font-semibold">{result.pages}</dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Raster</dt>
              <dd className="font-semibold">
                {dpiLabel(result)} · {result.mime === "image/png" ? "PNG" : "JPEG"}
              </dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Output size</dt>
              <dd className="font-semibold">{formatBytes(result.bytes.length)}</dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">vs. original</dt>
              <dd className="font-semibold">
                {growth === null ? "—" : `${growth >= 0 ? "+" : ""}${growth}%`}
              </dd>
            </div>
          </dl>
          {result.reducedPages > 0 && (
            <p
              role="alert"
              className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
            >
              {result.reducedPages} page{result.reducedPages === 1 ? " was" : "s were"} rendered
              below the {presetFor(result.presetId).dpi} DPI{" "}
              {presetFor(result.presetId).label} setting because the page size exceeded this
              browser&apos;s canvas limit. They will look softer than the rest.
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadBlob(result.bytes, resultName)}
          >
            <Layers className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Download {resultName} again
          </Button>
          <p className="text-xs text-emerald-800">
            Open the download and confirm nothing on the page matters to you as
            editable text before you send it. The flattened copy is rebuilt from
            the pictures, so the source file&apos;s bookmarks, link targets, form
            structure and document metadata are not carried over — and this tool
            does not add an OCR text layer back. Your original is untouched.
          </p>
        </div>
      )}
    </div>
  );
}
