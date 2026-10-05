"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QrCode, Download, X } from "lucide-react";
import { Button, CopyButton, Field, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { QrCapacityError, encodeQr, maxCountFor, selectMode, type EccLevel } from "./qr-encode";
import {
  MAX_INPUT_CHARACTERS,
  MAX_OUTPUT_PX,
  MIN_MODULE_PX,
  QUIET_ZONE_MODULES,
  contrastRatio,
  densityWarning,
  describeSymbol,
  geometry,
  groupDigits,
  inversionWarning,
  lengthRefusal,
  printWarning,
  svgMarkup,
} from "./qr-format";

/** Wide enough for the densest symbol to stay legible, small enough for 375px. */
const PREVIEW_MAX_PX = 320;

const LEVEL_HINT: Record<EccLevel, string> = {
  L: "7% recovery — the most content, the least tolerance for damage",
  M: "15% recovery — the usual compromise",
  Q: "25% recovery — good for print and a logo in the middle",
  H: "30% recovery — the most tolerant, much less content",
};

/** `downloadBlob` takes bytes, so the SVG string is encoded to UTF-8 first. */
function encodeUtf8(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export default function QrCodeGenerator() {
  const [text, setText] = useState("");
  const [level, setLevel] = useState<EccLevel>("M");
  const [dark, setDark] = useState("#000000");
  const [light, setLight] = useState("#ffffff");
  const [requestedPx, setRequestedPx] = useState(512);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const trimmed = text.trim();
  const hasText = trimmed.length > 0;

  // A single mode is chosen for the whole string, so mixed content falls back to
  // bytes and therefore holds fewer characters than the digits-only maximum.
  const mode = useMemo(() => (hasText ? selectMode(trimmed) : "numeric"), [hasText, trimmed]);
  const limit = maxCountFor(mode, level);

  // Refuse before encoding rather than after: over-long input never reaches the
  // encoder, so nothing expensive is attempted and no button is left enabled.
  const overLength = hasText && trimmed.length > MAX_INPUT_CHARACTERS;
  const overLevel = hasText && !overLength && trimmed.length > limit;

  const refusal = useMemo(() => {
    if (overLength) return lengthRefusal(trimmed.length);
    if (overLevel) {
      return `At error correction ${level}, ${mode} mode holds ${groupDigits(limit)} characters in a version 40 code. This text needs ${groupDigits(trimmed.length)}. Pick a lower level, or shorten it.`;
    }
    return "";
  }, [overLength, overLevel, mode, level, limit, trimmed.length]);

  const symbol = useMemo(() => {
    if (!hasText || refusal) return null;
    try {
      return encodeQr(trimmed, level);
    } catch (error) {
      if (error instanceof QrCapacityError) {
        return { refusal: `${groupDigits(error.needed)} ${error.mode} characters will not fit at error correction ${level}; version 40 holds ${groupDigits(error.limit)}.` };
      }
      return { refusal: "That text could not be encoded. Try a shorter string." };
    }
  }, [hasText, trimmed, level, refusal]);

  const encodeFailure = symbol && "refusal" in symbol ? symbol.refusal : "";
  const qr = symbol && !("refusal" in symbol) ? symbol : null;

  const shownError = refusal || encodeFailure;
  const errorActive = hasText && Boolean(shownError) && !errorDismissed;

  // Snap to whole pixels per module. A fractional scale makes the modules blur
  // into each other, which is the usual reason a generated code will not scan.
  const plan = useMemo(() => (qr ? geometry(qr.size, Math.min(requestedPx, MAX_OUTPUT_PX)) : null), [qr, requestedPx]);
  const preview = useMemo(
    () => (qr ? geometry(qr.size, Math.min(PREVIEW_MAX_PX, MAX_OUTPUT_PX)) : null),
    [qr],
  );

  const warnings = useMemo(() => {
    if (!qr) return [] as string[];
    const notes: string[] = [];
    const colour = inversionWarning(dark, light);
    if (colour) notes.push(colour);
    const printed = printWarning(qr.size, 40);
    if (printed) notes.push(printed);
    const dense = densityWarning(qr.version);
    if (dense) notes.push(dense);
    return notes;
  }, [qr, dark, light]);

  // Draw the preview at an exact integer scale with the quiet zone included.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qr || !preview) return;
    canvas.width = preview.pixels;
    canvas.height = preview.pixels;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = light;
    context.fillRect(0, 0, preview.pixels, preview.pixels);
    context.fillStyle = dark;
    const span = preview.scale;
    for (let row = 0; row < qr.size; row += 1) {
      for (let col = 0; col < qr.size; col += 1) {
        if (!qr.modules[row * qr.size + col]) continue;
        const x = (col + preview.quiet) * span;
        const y = (row + preview.quiet) * span;
        context.fillRect(x, y, span, span);
      }
    }
  }, [qr, preview, dark, light]);

  const paint = useCallback(
    (target: number): HTMLCanvasElement => {
      const canvas = document.createElement("canvas");
      canvas.width = target;
      canvas.height = target;
      const context = canvas.getContext("2d");
      if (!context || !qr || !plan) throw new Error("canvas unavailable");
      const span = Math.max(1, Math.floor(target / plan.totalModules));
      const usable = span * plan.totalModules;
      canvas.width = usable;
      canvas.height = usable;
      context.fillStyle = light;
      context.fillRect(0, 0, usable, usable);
      context.fillStyle = dark;
      for (let row = 0; row < qr.size; row += 1) {
        for (let col = 0; col < qr.size; col += 1) {
          if (!qr.modules[row * qr.size + col]) continue;
          context.fillRect((col + plan.quiet) * span, (row + plan.quiet) * span, span, span);
        }
      }
      return canvas;
    },
    [qr, plan, dark, light],
  );

  const downloadPng = useCallback(async () => {
    if (!qr || !plan || busy) return;
    setBusy(true);
    setErrorDismissed(false);
    try {
      const canvas = paint(plan.pixels);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("encode failed");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      downloadBlob(bytes, "qr-code.png", "image/png");
      setFailure("");
    } catch {
      setFailure("The PNG could not be produced. Try a smaller size.");
    } finally {
      setBusy(false);
    }
  }, [qr, plan, paint, busy]);

  const downloadSvg = useCallback(() => {
    if (!qr || busy) return;
    setBusy(true);
    try {
      const markup = svgMarkup(qr.modules, {
        size: qr.size,
        quiet: QUIET_ZONE_MODULES,
        dark,
        light,
        title: trimmed,
      });
      downloadBlob(encodeUtf8(markup), "qr-code.svg", "image/svg+xml;charset=utf-8");
      setFailure("");
    } catch {
      setFailure("The SVG could not be produced. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [qr, trimmed, dark, light, busy]);

  const bytesPerModule = plan ? plan.scale : 0;

  return (
    <div className="space-y-5 w-full" id="qr-code-generator">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <label htmlFor="qr-text-input" className="block text-sm font-medium text-slate-700">
          Text or URL to encode
        </label>
        <span className="text-xs font-mono text-slate-500">
          {groupDigits(trimmed.length)} / {groupDigits(limit)} characters
        </span>
      </div>

      <StyledTextarea
        id="qr-text-input"
        rows={3}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setErrorDismissed(false);
        }}
        placeholder="Enter text or a URL…"
        aria-describedby={`${errorActive ? "qr-code-error " : ""}qr-code-hint`}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      />
      <p id="qr-code-hint" className="text-xs text-slate-500">
        One mode is chosen for the whole string. Text outside ASCII is encoded as UTF-8 bytes with no
        ECI header, so a few readers may interpret non-Latin characters differently.
      </p>

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setText("");
          setErrorDismissed(false);
        }}
        disabled={!hasText}
        className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
      >
        Clear input
      </Button>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Field label={`PNG width: ${plan ? plan.pixels : "—"} px`}>
          <input
            type="range"
            min={128}
            max={MAX_OUTPUT_PX}
            step={4}
            value={requestedPx}
            onChange={(event) => setRequestedPx(Number(event.target.value))}
            aria-label={`PNG width in pixels: ${requestedPx}`}
            className="w-48 min-h-11 accent-emerald-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          />
        </Field>

        <Field label="Error correction">
          <select
            value={level}
            onChange={(event) => {
              setLevel(event.target.value as EccLevel);
              setErrorDismissed(false);
            }}
            aria-label="Error correction level"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 min-h-11 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <option value="L">L — 7%</option>
            <option value="M">M — 15%</option>
            <option value="Q">Q — 25%</option>
            <option value="H">H — 30%</option>
          </select>
        </Field>

        <Field label="Foreground">
          <input
            type="color"
            value={dark}
            onChange={(event) => {
              setDark(event.target.value);
              setErrorDismissed(false);
            }}
            aria-label="Foreground colour"
            className="h-10 w-14 min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          />
        </Field>

        <Field label="Background">
          <input
            type="color"
            value={light}
            onChange={(event) => {
              setLight(event.target.value);
              setErrorDismissed(false);
            }}
            aria-label="Background colour"
            className="h-10 w-14 min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          />
        </Field>
      </div>

      <p className="text-xs text-slate-500">{LEVEL_HINT[level]}</p>

      <div className="space-y-4" aria-busy={busy}>
        {errorActive && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p id="qr-code-error">{shownError}</p>
            <button
              type="button"
              onClick={() => setErrorDismissed(true)}
              aria-label="Dismiss error"
              className="shrink-0 rounded-lg p-1 text-red-500 transition hover:bg-red-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {qr ? (
          <div className="flex flex-wrap items-start gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`QR code preview: ${describeSymbol(qr)}`}
                className="h-auto w-full max-w-72 rounded-xl"
                style={{ imageRendering: "pixelated" }}
              />
              <p className="mt-3 max-w-72 text-xs font-mono text-slate-600">{describeSymbol(qr)}</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={downloadPng}
                disabled={busy}
                className="min-h-11 bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
                Download PNG
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={downloadSvg}
                disabled={busy}
                className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
              >
                <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
                Download SVG
              </Button>
              <CopyButton text={trimmed} label="Copy text" className="min-h-11" disabled={busy} />
            </div>
          </div>
        ) : hasText ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
            {shownError && !errorDismissed ? "Nothing was generated." : "Preparing the code…"}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
            <QrCode className="w-8 h-8 mx-auto text-slate-300 mb-2" aria-hidden="true" />
            Enter some text or a URL to generate a QR code.
          </div>
        )}

        {qr && plan && (
          <dl className="grid gap-1 text-xs font-mono text-slate-600 sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="font-sans text-slate-500">PNG</dt>
              <dd>
                {plan.pixels}×{plan.pixels} px, {bytesPerModule} px per module — a raster image, so it is
                only sharp at that pixel size
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-sans text-slate-500">SVG</dt>
              <dd>Vector: it scales to any size without resampling</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-sans text-slate-500">Contrast</dt>
              <dd>{contrastRatio(dark, light).toFixed(1)}:1 between foreground and background</dd>
            </div>
          </dl>
        )}

        {warnings.length > 0 && (
          <ul className="space-y-2">
            {warnings.map((note) => (
              <li
                key={note}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                {note}
              </li>
            ))}
          </ul>
        )}

        {qr && bytesPerModule < MIN_MODULE_PX && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            At this size each module is under {MIN_MODULE_PX} pixels. Raise the PNG width for printing.
          </p>
        )}

        {failure && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {failure}
          </p>
        )}

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {qr
            ? `QR code ready. ${describeSymbol(qr)}.`
            : hasText && shownError
              ? `Nothing generated. ${shownError}`
              : ""}
        </p>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          What this tool does not promise
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Everything runs in your browser. Nothing is uploaded and no server sees the text.</li>
          <li>
            One mode covers the whole string, so a single lowercase letter in a long URL pushes the whole
            string into UTF-8 byte mode and costs capacity.
          </li>
          <li>Error correction recovers damaged modules; it does not rescue glare, blur or a folded code.</li>
          <li>
            Print needs room: keep each module at 0.5 mm or larger, which is why the PNG width matters
            more than the version number.
          </li>
          <li>The four-module quiet zone around the code is part of the image and must not be cropped.</li>
          <li>Inverted codes (light on dark) scan on many modern phones but not on all of them.</li>
        </ul>
      </details>
    </div>
  );
}