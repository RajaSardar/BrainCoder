/**
 * Everything the HTML → image tool needs to agree on with itself, with no
 * browser API in sight: the caps, the output-naming convention, the pixel
 * budget and the error classification. The component, the Node mirror audit and
 * the marketing copy all read these numbers from here, so a cap can never be
 * stated in one place and enforced in another.
 */

export const MAX_INPUT_BYTES = 200 * 1024;
export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const SCALE_STEP = 0.5;
export const DEFAULT_SCALE = 2;
export const MIN_CAPTURE_WIDTH = 240;
export const MAX_CAPTURE_WIDTH = 1200;
export const DEFAULT_CAPTURE_WIDTH = 480;
export const MAX_SIDE_PX = 8192;
export const MAX_OUTPUT_PX = 16_000_000;
export const CAPTURE_BACKGROUND = "#ffffff";
export const JPEG_QUALITY = 0.92;
export const IMAGE_TIMEOUT_MS = 5000;
export const DEFAULT_STEM = "capture";

/** The two hard limits, phrased for the UI so the numbers are never retyped. */
export const PIXEL_BUDGET_LABEL = `${MAX_OUTPUT_PX / 1_000_000} MP`;
export const SIDE_LIMIT_LABEL = `${MAX_SIDE_PX} px`;

/**
 * The preset buttons, derived from the range and step so a control can never
 * offer a scale the planner would refuse.
 */
export const SCALE_CHOICES: number[] = (() => {
  const out: number[] = [];
  for (let v = MIN_SCALE; v <= MAX_SCALE + 1e-9; v += SCALE_STEP) {
    out.push(Math.round(v * 100) / 100);
  }
  return out;
})();

export type CaptureFormat = "png" | "jpeg" | "webp";

export interface CaptureFormatSpec {
  id: CaptureFormat;
  label: string;
  extension: string;
  mime: string;
  lossless: boolean;
  note: string;
}

/**
 * PNG is genuinely lossless, so the quality argument is ignored for it; JPEG and
 * WebP are lossy and take the quality argument. Saying so per format is the
 * honest way to present a three-way choice.
 */
export const CAPTURE_FORMATS: CaptureFormatSpec[] = [
  {
    id: "png",
    label: "PNG",
    extension: "png",
    mime: "image/png",
    lossless: true,
    note: "Lossless and the largest file. Best for UI, code and anything with flat colour or sharp text.",
  },
  {
    id: "jpeg",
    label: "JPEG",
    extension: "jpg",
    mime: "image/jpeg",
    lossless: false,
    note: `Lossy at quality ${JPEG_QUALITY}, and it has no transparency channel. Best for photos and gradients.`,
  },
  {
    id: "webp",
    label: "WebP",
    extension: "webp",
    mime: "image/webp",
    lossless: false,
    note: `Lossy at quality ${JPEG_QUALITY}, usually smaller than JPEG at the same quality, with transparency. Not every browser can encode it — the tool tells you if yours falls back to PNG.`,
  },
];

export function formatSpec(format: CaptureFormat): CaptureFormatSpec {
  return CAPTURE_FORMATS.find((f) => f.id === format) ?? CAPTURE_FORMATS[0];
}

export function mimeFor(format: CaptureFormat): string {
  return formatSpec(format).mime;
}

export function extensionFor(format: CaptureFormat): string {
  return formatSpec(format).extension;
}

/**
 * A canvas can refuse the MIME type you ask for and hand back another one — a
 * `toBlob` call for WebP returns `image/png` on browsers without a WebP
 * encoder. Naming that file `.webp` would hand the user a lie about the bytes,
 * so the extension is always derived from the type that actually came back.
 */
export function formatForMime(mime: string): CaptureFormat | null {
  const match = CAPTURE_FORMATS.find((f) => f.mime === mime.trim().toLowerCase());
  return match ? match.id : null;
}

/** A local copy of the repo's byte formatter: this module must stay dependency-free. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) || 0, units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function round2(value: number): number {
  return Math.floor(value * 100) / 100;
}

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCALE;
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  return Math.round(clamped / SCALE_STEP) * SCALE_STEP;
}

export function clampCaptureWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CAPTURE_WIDTH;
  return Math.round(Math.min(MAX_CAPTURE_WIDTH, Math.max(MIN_CAPTURE_WIDTH, value)));
}

/**
 * Renders any effective scale exactly, so a capture the planner cut to 2.73x
 * is never reported as the 2.5x the user picked. Only whole and two-decimal
 * fractions occur: the requested scale is a 0.5 step and the budget division
 * is rounded to two places, so nothing is invented or lost here.
 */
export function scaleLabel(scale: number): string {
  const value = Number.isFinite(scale) ? Math.round(scale * 100) / 100 : DEFAULT_SCALE;
  return `${value.toFixed(2).replace(/\.?0+$/, "")}x`;
}

/**
 * Path separators, reserved characters and control codes become "-", and a stem
 * left with nothing but dots and dashes ("....", "-") falls back to the default,
 * so the file is never called `....-2x.png` or hidden by a leading dot.
 */
function safeStem(source: string): string {
  let out = "";
  for (const ch of source) {
    const code = ch.codePointAt(0) ?? 0;
    const reserved = code < 32 || code === 127 || '\\/:*?"<>|'.includes(ch);
    out += reserved ? "-" : ch;
  }
  return out.replace(/^[.\-]+|[.\-]+$/g, "");
}

export function outputNameFor(source: string, scale: number, format: CaptureFormat): string {
  const base = safeStem(source.replace(/\.(?:html?|xhtml|htm|txt|md|svg)$/i, "")).trim();
  return `${base || DEFAULT_STEM}-${scaleLabel(scale)}.${extensionFor(format)}`;
}

/**
 * The same name, decided by the bytes the canvas really produced. `null` means
 * the canvas handed back a type this tool has no name for, which is a bug in
 * the browser rather than a reason to guess an extension.
 */
export function outputNameForMime(source: string, scale: number, mime: string): string | null {
  const format = formatForMime(mime);
  return format ? outputNameFor(source, scale, format) : null;
}

export type BudgetLimit = "side" | "area" | null;

export interface OutputPlan {
  cssWidth: number;
  cssHeight: number;
  requestedScale: number;
  scale: number;
  width: number;
  height: number;
  pixels: number;
  reduced: boolean;
  overBudget: boolean;
  limit: BudgetLimit;
}

/**
 * html2canvas sizes its canvas as `floor(cssSize * scale)`, so the projection
 * below is the exact size the browser will allocate. The scale is only ever
 * reduced to fit the budget, never below 1x: rendering under 1x would soften
 * text to fake a size the user did not ask for.
 */
export function planOutput(cssWidth: number, cssHeight: number, requestedScale: number): OutputPlan {
  const w = Math.max(0, Math.floor(Number.isFinite(cssWidth) ? cssWidth : 0));
  const h = Math.max(0, Math.floor(Number.isFinite(cssHeight) ? cssHeight : 0));
  const req = clampScale(requestedScale);
  if (w === 0 || h === 0) {
    return {
      cssWidth: w,
      cssHeight: h,
      requestedScale: req,
      scale: 0,
      width: 0,
      height: 0,
      pixels: 0,
      reduced: false,
      overBudget: true,
      limit: null,
    };
  }
  const bySide = Math.min(MAX_SIDE_PX / w, MAX_SIDE_PX / h);
  const byArea = Math.sqrt(MAX_OUTPUT_PX / (w * h));
  const limit: BudgetLimit = bySide < byArea ? "side" : "area";
  const budget = Math.min(bySide, byArea);
  const base = { cssWidth: w, cssHeight: h, requestedScale: req, limit };
  if (budget < MIN_SCALE) {
    const width = Math.floor(w * MIN_SCALE);
    const height = Math.floor(h * MIN_SCALE);
    return { ...base, scale: MIN_SCALE, width, height, pixels: width * height, reduced: true, overBudget: true };
  }
  const scale = Math.min(req, round2(budget));
  const width = Math.floor(w * scale);
  const height = Math.floor(h * scale);
  return { ...base, scale, width, height, pixels: width * height, reduced: scale < req, overBudget: false };
}

/**
 * The capture box has to be on screen: html2canvas clones the document into an
 * iframe sized to the viewport and crops to the element's own bounds, so an
 * element scrolled out of view is captured from outside the frame.
 */
export function captureIsOnScreen(top: number, bottom: number, viewportHeight: number): boolean {
  return top >= 0 && bottom <= viewportHeight;
}

export type CaptureErrorKind = "empty" | "too-large" | "encode" | "unknown";

/**
 * html2canvas and canvas.toBlob both throw bare engine errors, and the raw text
 * ("Unable to load image", "IndexSizeError: …") is not something a user can act
 * on. Every path is mapped to one of four honest messages instead.
 */
export function classifyCaptureError(err: unknown): CaptureErrorKind {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/indexsize|invalidstate/i.test(name) || /indexsize|source image width is 0|width is 0/i.test(message)) {
    return "empty";
  }
  if (/data size|exceeds the maximum|allocation|out of memory|memory access|too large/i.test(message)) {
    return "too-large";
  }
  // A canvas taint failure and an encoder failure arrive as a bare DOMException,
  // so the kind is only in `name`; checking the message alone would file these
  // under "unknown" and send the user looking for the wrong problem.
  if (/securityerror|encodingerror|notsupportederror/i.test(name) || /unable to load image|tainted|securityerror|encodingerror|unable to encode|unsupported/i.test(message)) {
    return "encode";
  }
  return "unknown";
}

export function captureErrorMessage(kind: CaptureErrorKind): string {
  if (kind === "empty") {
    return "The preview measured zero pixels wide or tall, so there was nothing to capture. Give the HTML some visible content, or widen the capture box, and try again.";
  }
  if (kind === "too-large") {
    return `The browser refused to allocate that canvas. A capture is capped at ${PIXEL_BUDGET_LABEL} and ${SIDE_LIMIT_LABEL} per side: lower the scale, or capture the document in smaller sections.`;
  }
  if (kind === "encode") {
    return "The canvas could not be encoded to an image. That usually means an embedded resource could not be fetched — an image served without CORS headers, or a font that has not loaded. Try PNG, or embed the image as a data URI.";
  }
  return "The capture did not finish. Try a lower scale, reload the page and capture again — nothing was downloaded.";
}
