"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, ClipboardCopy, FileUp, ImageDown, Loader2, RotateCcw } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { sanitizeCaptureHtml, sanitizeSummary, type SanitizeReport } from "./sanitize";
import {
  CAPTURE_BACKGROUND,
  CAPTURE_FORMATS,
  DEFAULT_CAPTURE_WIDTH,
  DEFAULT_SCALE,
  SCALE_CHOICES,
  IMAGE_TIMEOUT_MS,
  JPEG_QUALITY,
  MAX_CAPTURE_WIDTH,
  MAX_INPUT_BYTES,
  MAX_SCALE,
  MIN_CAPTURE_WIDTH,
  MIN_SCALE,
  PIXEL_BUDGET_LABEL,
  SCALE_STEP,
  SIDE_LIMIT_LABEL,
  captureErrorMessage,
  captureIsOnScreen,
  clampCaptureWidth,
  clampScale,
  classifyCaptureError,
  formatBytes,
  formatSpec,
  mimeFor,
  outputNameFor,
  outputNameForMime,
  planOutput,
  scaleLabel,
  type CaptureFormat,
} from "./capture-format";

const SAMPLE = `<div style="font-family:system-ui,sans-serif;padding:28px;background:#f8fafc">
  <div style="border-radius:14px;background:linear-gradient(135deg,#6366f1,#a855f7);padding:20px;color:#fff;box-shadow:0 10px 24px rgba(79,70,229,.28)">
    <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Release</p>
    <h1 style="margin:6px 0 0;font-size:28px;line-height:1.15">v2.4.0 — capture pipeline</h1>
  </div>
  <table style="width:100%;margin-top:18px;border-collapse:collapse;font-size:13px">
    <tr style="color:#64748b;text-align:left">
      <th style="padding:6px 0;border-bottom:1px solid #e2e8f0">Check</th>
      <th style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right">Result</th>
    </tr>
    <tr><td style="padding:6px 0">Rasterizer</td><td style="padding:6px 0;text-align:right">html2canvas</td></tr>
    <tr><td style="padding:6px 0">Uploaded</td><td style="padding:6px 0;text-align:right">never</td></tr>
  </table>
</div>`;

const CAP_KB = Math.round(MAX_INPUT_BYTES / 1024);


interface Measurement {
  cssWidth: number;
  cssHeight: number;
  overflow: number;
}

interface Result {
  bytes: Uint8Array;
  filename: string;
  width: number;
  height: number;
  scale: number;
  requestedScale: number;
  reduced: boolean;
  mime: string;
}

function userFacing(message: string): Error {
  const err = new Error(message);
  (err as Error & { userFacing?: boolean }).userFacing = true;
  return err;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing) return err.message;
  return captureErrorMessage(classifyCaptureError(err));
}

export default function HtmlToImage() {
  const [html, setHtml] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [format, setFormat] = useState<CaptureFormat>("png");
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [scaleText, setScaleText] = useState(String(DEFAULT_SCALE));
  const [captureWidth, setCaptureWidth] = useState(DEFAULT_CAPTURE_WIDTH);
  const [widthText, setWidthText] = useState(String(DEFAULT_CAPTURE_WIDTH));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [measured, setMeasured] = useState<Measurement>({ cssWidth: 0, cssHeight: 0, overflow: 0 });

  const runIdRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef("");

  const fileId = useId();
  const htmlId = useId();
  const formatId = useId();
  const formatHintId = useId();
  const widthId = useId();
  const scaleId = useId();
  const sliderId = useId();
  const scaleHintId = useId();
  const previewId = useId();

  const bytes = new TextEncoder().encode(html).length;
  const overCap = bytes > MAX_INPUT_BYTES;
  const empty = html.trim().length === 0;
  // Re-tokenising 200 KB of markup on every keystroke is the one way this tool
  // could feel slow, so the sanitize pass is memoized on the input alone.
  const sanitized: SanitizeReport = useMemo(() => sanitizeCaptureHtml(html), [html]);
  const plan = planOutput(measured.cssWidth, measured.cssHeight, scale);
  const spec = formatSpec(format);

  // Any change to the markup or to an output control invalidates the last
  // capture: leaving the old bytes on screen would offer a PNG under a .jpg
  // name at the wrong scale.
  const revokePreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
  };

  const invalidate = () => {
    // Cancels any capture still in flight, so bytes from the markup the user
    // just replaced can never land in the result panel.
    runIdRef.current++;
    setResult(null);
    revokePreview();
    setMessage("");
    setWarning("");
  };

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const read = () => {
      const rect = node.getBoundingClientRect();
      let contentRight = rect.width;
      for (const child of Array.from(node.children)) {
        const r = child.getBoundingClientRect();
        const right = r.right - rect.left;
        if (right > contentRight) contentRight = right;
      }
      setMeasured({
        cssWidth: Math.round(rect.width),
        cssHeight: Math.round(rect.height),
        overflow: Math.round(Math.max(0, contentRight - rect.width)),
      });
    };
    read();
    // The box is overflow-hidden and fixed-width, so its own size does not
    // change when injected content spills past the edge. Reads the laid-out
    // child rects instead (getBoundingClientRect ignores the clip) and a
    // subtree mutation observer re-reads whenever the content changes.
    const observer = new ResizeObserver(read);
    observer.observe(node);
    const mo = new MutationObserver(read);
    mo.observe(node, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, [captureWidth]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    invalidate();
    const run = ++runIdRef.current;
    setError("");
    try {
      if (file.size > MAX_INPUT_BYTES) {
        throw userFacing(
          `That file is ${formatBytes(file.size)}, larger than the ${CAP_KB} KB limit. Trim the HTML or capture it in smaller pieces.`,
        );
      }
      const text = await file.text();
      if (run !== runIdRef.current) return;
      setHtml(text);
      setSourceName(file.name);
      setMessage(`Loaded ${file.name} (${formatBytes(file.size)}). Nothing was uploaded.`);
    } catch (err) {
      if (run !== runIdRef.current) return;
      setError(toUiError(err));
    }
  };

  const onFilePick = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    void loadFile(file);
  };

  const commitScale = (raw: string) => {
    const next = clampScale(Number(raw));
    setScale(next);
    setScaleText(String(next));
    invalidate();
  };

  const commitWidth = (raw: string) => {
    const next = clampCaptureWidth(Number(raw));
    setCaptureWidth(next);
    setWidthText(String(next));
    invalidate();
  };

  const capture = async () => {
    if (busy) return;
    const node = rootRef.current;
    if (!node) return;
    const run = ++runIdRef.current;
    setError("");
    setMessage("");
    setWarning("");

    if (empty) {
      setError("Paste some HTML or open a .html file first — there is nothing to capture yet.");
      return;
    }
    if (overCap) {
      setError(
        `That HTML is ${formatBytes(bytes)}, larger than the ${CAP_KB} KB limit this tool accepts. Trim it down, or capture it in smaller sections.`,
      );
      return;
    }
    if (sanitized.html.trim().length === 0) {
      setError(
        "Nothing renderable is left after sanitizing. The input was only elements that are removed before rendering, such as <script> or inline <svg>.",
      );
      return;
    }
    if (measured.cssWidth === 0 || measured.cssHeight === 0) {
      setError(captureErrorMessage("empty"));
      return;
    }
    if (measured.overflow > 0) {
      setError(
        `This content is ${measured.cssWidth + measured.overflow} px wide but the capture box is ${measured.cssWidth} px. The capture is cropped to the box rather than reflowed, so widen the capture width to at least ${measured.cssWidth + measured.overflow} px, or make the content narrower.`,
      );
      return;
    }
    const planned = planOutput(measured.cssWidth, measured.cssHeight, scale);
    if (planned.overBudget) {
      // Name the limit that was actually hit: a wide, short document fails on
      // pixels, a tall one fails on a single side, and the fix differs.
      const hit =
        planned.limit === "side"
          ? `over the ${SIDE_LIMIT_LABEL} single-side limit`
          : `over the ${PIXEL_BUDGET_LABEL} pixel budget`;
      setError(
        `This content is ${planned.cssWidth} × ${planned.cssHeight} CSS px — ${(planned.pixels / 1_000_000).toFixed(1)} MP even at ${scaleLabel(MIN_SCALE)}, already ${hit}. Make the content smaller, or capture it in sections.`,
      );
      return;
    }

    setBusy(true);
    try {
      const box = node.getBoundingClientRect();
      if (!captureIsOnScreen(box.top, box.bottom, window.innerHeight)) {
        node.scrollIntoView({ block: "center", behavior: "auto" });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      if (run !== runIdRef.current) return;

      const { default: html2canvas } = await import("html2canvas");
      if (run !== runIdRef.current) return;

      const canvas = await html2canvas(node, {
        backgroundColor: CAPTURE_BACKGROUND,
        scale: planned.scale,
        useCORS: true,
        logging: false,
        imageTimeout: IMAGE_TIMEOUT_MS,
        removeContainer: true,
      });
      if (run !== runIdRef.current) return;
      const width = canvas.width;
      const height = canvas.height;
      const wanted = mimeFor(format);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, wanted, format === "png" ? undefined : JPEG_QUALITY),
      );
      canvas.width = 0;
      canvas.height = 0;
      if (run !== runIdRef.current) return;
      if (!blob) throw userFacing(captureErrorMessage("encode"));

      const out = new Uint8Array(await blob.arrayBuffer());
      if (run !== runIdRef.current) return;

      const fellBack = blob.type !== wanted;
      const filename = outputNameForMime(sourceName, planned.scale, blob.type);
      if (!filename) throw userFacing(captureErrorMessage("encode"));
      downloadBlob(out, filename, blob.type);
      const nextUrl = URL.createObjectURL(new Blob([out as Uint8Array<ArrayBuffer>], { type: blob.type }));
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = nextUrl;
      setPreviewUrl(nextUrl);
      setResult({
        bytes: out,
        filename,
        width,
        height,
        scale: planned.scale,
        requestedScale: planned.requestedScale,
        reduced: planned.reduced,
        mime: blob.type,
      });
      setMessage(
        `Captured ${width} × ${height} px at ${scaleLabel(planned.scale)} — downloaded ${filename}.`,
      );
      if (planned.reduced) {
        setWarning(
          `You asked for ${scaleLabel(planned.requestedScale)}; the image was rendered at ${scaleLabel(planned.scale)} so it stays inside the ${PIXEL_BUDGET_LABEL} and ${SIDE_LIMIT_LABEL} limits. The layout is unchanged — only the device-pixel multiplier is smaller, and it is never taken below 1x.`,
        );
      } else if (width !== planned.width || height !== planned.height) {
        setWarning(
          `The browser allocated ${width} × ${height} px rather than the ${planned.width} × ${planned.height} px predicted from the preview, because the content changed size during the capture. The file you downloaded is the real one.`,
        );
      }
      if (fellBack) {
        setWarning((prev) =>
          `${prev ? `${prev} ` : ""}This browser cannot encode ${wanted.toUpperCase()}, so you got ${blob.type.replace("image/", "").toUpperCase()} instead, saved as ${filename} so the extension matches the bytes.`,
        );
      }
      if (sanitized.removedTags.length > 0 || sanitized.removedAttributes > 0) {
        setWarning((prev) => `${prev ? `${prev} ` : ""}${sanitizeSummary(sanitized)}`);
      }
    } catch (err) {
      if (run !== runIdRef.current) return;
      invalidate();
      setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) setBusy(false);
    }
  };

  const copyImage = async () => {
    if (!result) return;
    try {
      const item = new ClipboardItem({
        [result.mime]: new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: result.mime }),
      });
      await navigator.clipboard.write([item]);
      setMessage(`Copied the ${result.width} × ${result.height} px image to your clipboard.`);
    } catch {
      setWarning(
        "This browser would not put an image on the clipboard. Use Download instead — the bytes are the same.",
      );
    }
  };

  const reset = () => {
    setHtml("");
    setSourceName("");
    setFormat("png");
    setScale(DEFAULT_SCALE);
    setScaleText(String(DEFAULT_SCALE));
    setCaptureWidth(DEFAULT_CAPTURE_WIDTH);
    setWidthText(String(DEFAULT_CAPTURE_WIDTH));
    invalidate();
    setError("");
    setMessage("");
    setWarning("");
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={fileRef}
        id={fileId}
        type="file"
        accept="text/html,.html,.htm"
        className="sr-only"
        aria-label="Open an HTML file to capture"
        onChange={(e) => void onFilePick(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? "Rendering the preview into a canvas…" : ""}
      </span>

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <label
          htmlFor={fileId}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 inline-flex items-center gap-2 cursor-pointer ${
              busy
                ? "opacity-60 pointer-events-none"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
            }`}
          >
          <FileUp className="w-4 h-4" aria-hidden="true" />
          Open .html file
        </label>
        <Button type="button" variant="secondary" disabled={busy} onClick={reset}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
          Clear
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <label htmlFor={htmlId} className="block text-sm font-medium text-slate-700">
              HTML source
            </label>
            <p className="text-xs text-slate-600" role="status">
              {Math.round(bytes / 1024)} KB of {CAP_KB} KB
              {overCap ? " — over the limit" : ""}
              {sourceName ? ` · ${sourceName}` : ""}
            </p>
          </div>
          <StyledTextarea
            id={htmlId}
            rows={12}
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              invalidate();
            }}
            className="font-mono text-xs"
            spellCheck={false}
            placeholder="<div style=&quot;…&quot;>Paste HTML here, open a .html file, or load the sample below."
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setHtml(SAMPLE);
                setSourceName("sample");
                invalidate();
              }}
            >
              Load sample
            </Button>
            {sanitized.removedTags.length > 0 || sanitized.removedAttributes > 0 ? (
              <p className="text-xs text-amber-800" role="status">
                {sanitizeSummary(sanitized)}
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <p id={previewId} className="text-sm font-medium text-slate-700 mb-1.5">
            Capture preview — exactly what the image will contain
          </p>
          <div
            aria-labelledby={previewId}
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 overflow-x-auto"
          >
            {/* The capture box is a fixed CSS width and clips its own overflow,
             * which is precisely what html2canvas does with the element it is
             * handed — so the preview and the file cannot disagree about a crop. */}
            <div
              ref={rootRef}
              style={{ width: captureWidth, background: CAPTURE_BACKGROUND }}
              className="mx-auto overflow-hidden"
              dangerouslySetInnerHTML={{ __html: sanitized.html }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-600" role="status">
            {`Measured ${measured.cssWidth} × ${measured.cssHeight} CSS px${
              measured.overflow > 0
                ? ` — the content is ${measured.cssWidth + measured.overflow} px wide, so the capture will be refused until the box is widened`
                : ""
            }.`}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <fieldset className="rounded-2xl border border-slate-200 bg-white p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Output format
          </legend>
          <label htmlFor={formatId} className="block text-sm font-medium text-slate-700 mb-1.5">
            Image format
          </label>
          <select
            id={formatId}
            value={format}
            aria-describedby={formatHintId}
            onChange={(e) => {
              setFormat(e.target.value as CaptureFormat);
              invalidate();
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
          >
            {CAPTURE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <p id={formatHintId} className="mt-2 text-xs text-slate-600">
            {spec.note}
          </p>
        </fieldset>

        <fieldset className="rounded-2xl border border-slate-200 bg-white p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Capture size
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={widthId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Capture width (px)
              </label>
              <input
                id={widthId}
                type="number"
                inputMode="numeric"
                min={MIN_CAPTURE_WIDTH}
                max={MAX_CAPTURE_WIDTH}
                step={1}
                value={widthText}
                onChange={(e) => setWidthText(e.target.value)}
                onBlur={(e) => commitWidth(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  commitWidth(e.currentTarget.value);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>
            <div>
              <label htmlFor={scaleId} className="block text-sm font-medium text-slate-700 mb-1.5">
                Scale (x)
              </label>
              <input
                id={scaleId}
                type="number"
                inputMode="decimal"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={SCALE_STEP}
                aria-describedby={scaleHintId}
                value={scaleText}
                onChange={(e) => setScaleText(e.target.value)}
                onBlur={(e) => commitScale(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  commitScale(e.currentTarget.value);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label htmlFor={sliderId} className="sr-only">
              Scale slider, {scaleLabel(scale)}
            </label>
            <input
              id={sliderId}
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={SCALE_STEP}
              value={scale}
              onChange={(e) => {
                setScaleText(e.target.value);
                commitScale(e.target.value);
              }}
              className="w-full accent-indigo-600"
            />
            <div className="flex gap-1.5 shrink-0">
              {SCALE_CHOICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScaleText(String(s));
                    commitScale(String(s));
                  }}
                  aria-pressed={scale === s}
                  className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    scale === s
                      ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <p id={scaleHintId} className="mt-2 text-xs text-slate-600">
            {`Scale multiplies every CSS pixel, so ${scaleLabel(scale)} of a ${measured.cssWidth} px box is a ${plan.width} × ${plan.height} px image. The cap is ${PIXEL_BUDGET_LABEL} and ${SIDE_LIMIT_LABEL} per side; the scale is lowered rather than the file being refused, and never below 1x.`}
          </p>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void capture()} disabled={busy || empty}>
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          )}
          {busy ? "Capturing…" : `Capture ${measured.cssWidth || 0} × ${measured.cssHeight || 0} CSS px at ${scaleLabel(scale)}`}
        </Button>
        <p className="text-xs text-slate-600" role="status">
          {empty
            ? `Paste HTML or open a .html file to get started. Up to ${CAP_KB} KB, captured at ${MIN_SCALE}–${MAX_SCALE}x. Nothing is uploaded and no request is made for your markup.`
            : `The capture is composited on white and cropped to the ${measured.cssWidth} px box. Nothing is uploaded and no request is made for your markup.`}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}
      {warning && (
        <div
          role="status"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm"
        >
          {warning}
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

      {result && previewUrl && (
        <div
          role="region"
          aria-label="Captured image result"
          className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-800" role="status">
              {result.width} × {result.height} px · {formatBytes(result.bytes.length)} · {result.filename}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void copyImage()}>
                <ClipboardCopy className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                Copy image
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => downloadBlob(result.bytes, result.filename, result.mime)}
              >
                <ImageDown className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                Download {result.filename} again
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`The captured image: ${result.width} by ${result.height} pixels, ${result.filename}`}
              className="block mx-auto"
              style={{ maxWidth: "100%" }}
            />
          </div>
          <p className="text-xs text-slate-600">
            This is the file you downloaded, shown from the same bytes:{" "}
            {result.mime.replace("image/", "").toUpperCase()}
            {result.scale !== result.requestedScale
              ? ` at ${scaleLabel(result.scale)} instead of ${scaleLabel(result.requestedScale)}`
              : ` at ${scaleLabel(result.scale)}`}
            , cropped to the capture box and composited on white. Changing the markup or any output control clears this panel so a stale image can never be re-downloaded under a new name.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">What this capture is — and is not</h3>
        <p className="text-xs text-slate-600">
          It is a re-draw, not a screen grab. html2canvas copies this page into an offscreen
          iframe, reads each element&apos;s computed style and repaints it with the canvas 2D
          API. It does not photograph your screen and it does not use an SVG foreignObject.
        </p>
        <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
          <li>
            Painted: flexbox and grid exactly as your browser laid them out, inline styles, class
            rules, a <code>&lt;style&gt;</code> block, borders, border-radius, box-shadow,
            text-shadow, linear and radial gradients, tables, list markers, <code>::before</code>{" "}
            and <code>::after</code>, and any web font the page has already loaded.
          </li>
          <li>
            Not painted: <code>filter</code>, <code>backdrop-filter</code>,{" "}
            <code>mix-blend-mode</code>, <code>conic-gradient</code>,{" "}
            <code>repeating-linear-gradient</code>, <code>repeating-radial-gradient</code> and{" "}
            <code>object-fit</code>.
          </li>
          <li>
            Removed before rendering: <code>&lt;script&gt;</code>, <code>&lt;iframe&gt;</code>,{" "}
            <code>&lt;object&gt;</code>, inline <code>&lt;svg&gt;</code>, <code>&lt;canvas&gt;</code>,{" "}
            <code>&lt;video&gt;</code>, form controls, and every <code>on*</code> handler or{" "}
            <code>javascript:</code> URL. A <code>&lt;style&gt;</code> block is kept and applied to
            this page, so scope its selectors.
          </li>
          <li>
            An image served without CORS headers is left out of the capture rather than drawn
            blank, and a remote <code>&lt;img src&gt;</code> or CSS <code>url()</code> is fetched
            by your browser exactly as any page would fetch it.
          </li>
          <li>
            <code>vw</code>, <code>vh</code> and <code>position: fixed</code> resolve against the
            browser window, not the {measured.cssWidth} px capture width. Content wider than the
            capture box is refused rather than silently cropped.
          </li>
          <li>
            {`Input is capped at ${CAP_KB} KB, the image at ${PIXEL_BUDGET_LABEL} and ${SIDE_LIMIT_LABEL} per side. A pasted capture is named ${outputNameFor("", scale, format)}; an opened file keeps its own base name.`}
          </li>
        </ul>
      </div>
    </div>
  );
}
