/**
 * Everything the image editor needs to agree on with itself, with no browser
 * API in sight: the caps, the header reader that identifies an input, the
 * output-format table, the geometry (the matrix that carries a natural pixel to
 * its place on the canvas), the budget planner, the crop and naming rules and
 * the error classification. The component, the Node mirror audit and the
 * marketing copy all read these numbers from here, so a cap can never be stated
 * in one place and enforced in another.
 *
 * The pixel maths — brightness, contrast, saturation and the filter matrices —
 * lives in `editor-pixels.ts`, which is also free of browser APIs. Canvas work
 * stays in the component.
 */

/* -------------------------------------------------------------------------- */
/* Caps                                                                        */
/* -------------------------------------------------------------------------- */

/** Same byte cap as the sibling image tools, stated once here. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** The export cannot be bigger than an input this tool accepts, so one constant. */
export const MAX_PIXELS = 16_000_000;
export const MAX_SIDE_PX = 8192;
/** The on-screen canvas is this long at most; the file is always full size. */
export const PREVIEW_MAX_SIDE_PX = 1200;
export const MIN_OUTPUT_PX = 8;
export const MIN_CROP_PX = 8;
export const MIN_SCALE = 10;
export const MAX_SCALE = 400;
export const SCALE_STEP = 5;
export const DEFAULT_SCALE = 100;
export const MAX_STEM_CHARS = 60;
export const DEFAULT_STEM = "image";
export const MAX_UNDO = 30;

/** Phrases for the UI, derived from the caps so a number is never retyped. */
export const FILE_SIZE_LABEL = `${MAX_FILE_BYTES / (1024 * 1024)} MB`;
export const PIXEL_BUDGET_LABEL = `${MAX_PIXELS / 1_000_000} MP`;
export const SIDE_LIMIT_LABEL = `${MAX_SIDE_PX} px`;
export const MAX_SIDE_LABEL = String(MAX_SIDE_PX);

/**
 * The scale presets. The slider covers the whole 10–400% range; these are the
 * stops most edits actually land on, and every one of them is a whole
 * percentage inside the range the planner accepts, so a preset can never
 * produce a scale the planner would refuse as untidy.
 */
export const SCALE_CHOICES: number[] = [10, 25, 50, 100, 200, 400];


/* -------------------------------------------------------------------------- */
/* Input formats — identified from the bytes, never from the name              */
/* -------------------------------------------------------------------------- */

export type InputFormatId = "png" | "jpeg" | "gif" | "webp" | "bmp";

export interface InputFormatSpec {
  id: InputFormatId;
  label: string;
  accept: string;
}

export const INPUT_FORMATS: InputFormatSpec[] = [
  { id: "png", label: "PNG", accept: "image/png,.png" },
  { id: "jpeg", label: "JPEG", accept: "image/jpeg,.jpg,.jpeg" },
  { id: "gif", label: "GIF", accept: "image/gif,.gif" },
  { id: "webp", label: "WebP", accept: "image/webp,.webp" },
  { id: "bmp", label: "BMP", accept: "image/bmp,.bmp" },
];

export const ACCEPTED_IMAGE_TYPES = INPUT_FORMATS.map((f) => f.accept).join(",");
export const ACCEPTED_FORMAT_NAMES = "PNG, JPEG, GIF, WebP or BMP";
/** Animation is not carried through, so it is named where the user meets it. */
export const FLATTENED_FORMAT_NAMES = "GIF and animated WebP";

export function inputFormatSpec(id: InputFormatId): InputFormatSpec {
  return INPUT_FORMATS.find((f) => f.id === id) ?? INPUT_FORMATS[0];
}

/** A local copy of the repo's byte formatter: this module stays import-free. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) || 0, units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  return startsWith(
    bytes,
    [...text].map((c) => c.charCodeAt(0)),
    offset,
  );
}

function be16(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 8) | bytes[at + 1];
}

function be32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function le16(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

function le24(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
}

function le32(bytes: Uint8Array, at: number): number {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

/** Signed, because a top-down BMP stores its height as a negative number. */
function sle32(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24);
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Identifies the format from the first bytes of the file, not from its name or
 * the browser's `type`. A `.png` that is really a text file is refused here,
 * before a decoder is handed bytes it cannot read.
 */
export function sniffImageFormat(bytes: Uint8Array): InputFormatId | null {
  if (startsWith(bytes, PNG_MAGIC)) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a")) return "gif";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "webp";
  if (startsWith(bytes, [0x42, 0x4d])) return "bmp";
  return null;
}

function pngSize(bytes: Uint8Array): Size | null {
  // IHDR is required to be the first chunk, so its dimensions are fixed offsets.
  if (!ascii(bytes, 12, "IHDR") || bytes.length < 24) return null;
  return { width: be32(bytes, 16), height: be32(bytes, 20) };
}

function gifSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 10) return null;
  return { width: le16(bytes, 6), height: le16(bytes, 8) };
}

function bmpSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 26) return null;
  const headerSize = le32(bytes, 14);
  if (headerSize === 12) return { width: le16(bytes, 18), height: le16(bytes, 20) };
  if (headerSize >= 40) return { width: le32(bytes, 18), height: Math.abs(sle32(bytes, 22)) };
  return null;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegSize(bytes: Uint8Array): Size | null {
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) return null;
    if (i + 3 >= bytes.length) return null;
    const length = be16(bytes, i + 2);
    if (length < 2) return null;
    if (SOF_MARKERS.has(marker)) {
      if (i + 8 >= bytes.length) return null;
      // precision (1), height (2), width (2)
      return { width: be16(bytes, i + 7), height: be16(bytes, i + 5) };
    }
    i += 2 + length;
  }
  return null;
}

function webpSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 30) return null;
  if (ascii(bytes, 12, "VP8X")) return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  if (ascii(bytes, 12, "VP8L")) {
    const packed = le32(bytes, 21);
    return { width: (packed & 0x3fff) + 1, height: ((packed >> 14) & 0x3fff) + 1 };
  }
  if (ascii(bytes, 12, "VP8 ")) {
    if (!startsWith(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
    return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
  }
  return null;
}

export interface Size {
  width: number;
  height: number;
}

/** Reads the pixel dimensions out of the header without decoding the image. */
export function readImageSize(bytes: Uint8Array, format: InputFormatId): Size | null {
  const size =
    format === "png"
      ? pngSize(bytes)
      : format === "gif"
        ? gifSize(bytes)
        : format === "bmp"
          ? bmpSize(bytes)
          : format === "webp"
            ? webpSize(bytes)
            : jpegSize(bytes);
  if (!size) return null;
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return null;
  if (size.width <= 0 || size.height <= 0) return null;
  return size;
}

export function describeImageSize(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  const size = `${width.toLocaleString("en-US")} × ${height.toLocaleString("en-US")} px`;
  return mp >= 0.1 ? `${size} — ${mp.toFixed(1)} megapixels` : size;
}

export type PreflightReason = "empty" | "size" | "format" | "dimensions" | "pixels" | "side";

export interface PreflightAccepted {
  ok: true;
  format: InputFormatId;
  label: string;
  width: number;
  height: number;
  pixels: number;
}

export interface PreflightRejected {
  ok: false;
  reason: PreflightReason;
  message: string;
}

export type PreflightResult = PreflightAccepted | PreflightRejected;

/** Every refusal is decided before a single byte reaches a decoder. */
export function preflightImage(bytes: Uint8Array, name: string): PreflightResult {
  if (!bytes || bytes.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: `That file is empty. Choose a ${ACCEPTED_FORMAT_NAMES} image to edit.`,
    };
  }
  if (bytes.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "size",
      message: `${name} is ${formatBytes(bytes.length)} (${bytes.length.toLocaleString("en-US")} bytes) — images up to ${FILE_SIZE_LABEL} (${MAX_FILE_BYTES.toLocaleString("en-US")} bytes) are supported here.`,
    };
  }
  const format = sniffImageFormat(bytes);
  if (!format) {
    return {
      ok: false,
      reason: "format",
      message: `${name} is not a ${ACCEPTED_FORMAT_NAMES} image, so there are no pixels to edit. Convert it first.`,
    };
  }
  const label = inputFormatSpec(format).label;
  const size = readImageSize(bytes, format);
  if (!size) {
    return {
      ok: false,
      reason: "dimensions",
      message: `The header of this ${label} does not declare a readable size, so the image was refused. Re-save it and try again.`,
    };
  }
  const pixels = size.width * size.height;
  if (size.width > MAX_SIDE_PX || size.height > MAX_SIDE_PX) {
    return {
      ok: false,
      reason: "side",
      message: `This image is ${size.width} × ${size.height} — one side is over the ${SIDE_LIMIT_LABEL} limit. Resize it to ${SIDE_LIMIT_LABEL} on the long side first.`,
    };
  }
  if (pixels > MAX_PIXELS) {
    return {
      ok: false,
      reason: "pixels",
      message: `This image is ${(pixels / 1_000_000).toFixed(1)} megapixels — the editor works on up to ${PIXEL_BUDGET_LABEL} at a time. Resize it down first.`,
    };
  }
  return { ok: true, format, label, width: size.width, height: size.height, pixels };
}

/* -------------------------------------------------------------------------- */
/* Output formats                                                              */
/* -------------------------------------------------------------------------- */

export type ExportFormatId = "png" | "jpeg" | "webp";

export interface ExportFormatSpec {
  id: ExportFormatId;
  label: string;
  extension: string;
  mime: string;
  lossless: boolean;
  alpha: boolean;
  note: string;
}

export const JPEG_QUALITY_MIN = 0.3;
export const JPEG_QUALITY_MAX = 1;
export const JPEG_QUALITY_STEP = 0.05;
export const DEFAULT_QUALITY = 0.9;

export const EXPORT_FORMATS: ExportFormatSpec[] = [
  {
    id: "png",
    label: "PNG",
    extension: "png",
    mime: "image/png",
    lossless: true,
    alpha: true,
    note: "Lossless and the largest file. The quality slider is ignored for PNG because there is nothing to lose.",
  },
  {
    id: "jpeg",
    label: "JPEG",
    extension: "jpg",
    mime: "image/jpeg",
    lossless: false,
    alpha: false,
    note: "Lossy at the quality you choose, and it has no transparency channel, so transparent pixels are composited on white.",
  },
  {
    id: "webp",
    label: "WebP",
    extension: "webp",
    mime: "image/webp",
    lossless: false,
    alpha: true,
    note: "Lossy at the quality you choose, usually smaller than JPEG, and it keeps transparency. A browser with no WebP encoder gets PNG instead, and the file is named for the bytes it really received.",
  },
];

export const DEFAULT_EXPORT_FORMAT: ExportFormatId = "png";

export function exportFormatSpec(id: ExportFormatId): ExportFormatSpec {
  return EXPORT_FORMATS.find((f) => f.id === id) ?? EXPORT_FORMATS[0];
}

export function mimeFor(id: ExportFormatId): string {
  return exportFormatSpec(id).mime;
}

export function extensionFor(id: ExportFormatId): string {
  return exportFormatSpec(id).extension;
}

/** PNG ignores the quality argument; the two lossy formats take it. */
export function qualityAppliesTo(id: ExportFormatId): boolean {
  return !exportFormatSpec(id).lossless;
}

/**
 * A canvas can refuse the MIME type you ask for and hand back another one — a
 * `toBlob` call for WebP returns `image/png` on a browser without a WebP
 * encoder. Naming that file `.webp` would hand the user a lie about the bytes,
 * so the extension always comes from the type that actually came back.
 */
export function formatForMime(mime: string): ExportFormatId | null {
  const match = EXPORT_FORMATS.find((f) => f.mime === mime.trim().toLowerCase());
  return match ? match.id : null;
}

export function clampQuality(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUALITY;
  const clamped = Math.min(JPEG_QUALITY_MAX, Math.max(JPEG_QUALITY_MIN, value));
  // 0.3 / 0.05 is 6.000000000000001 in binary floating point, so the step is
  // counted in twentieths and divided back — otherwise the 0.30 floor would come
  // back as 0.30000000000000004 and never equal the constant it came from.
  return Math.round(clamped * 20) / 20;
}

export function qualityLabel(value: number): string {
  return clampQuality(value).toFixed(2);
}

/* -------------------------------------------------------------------------- */
/* Geometry: natural pixels to their place on the canvas                       */
/* -------------------------------------------------------------------------- */

export type Rotation = 0 | 90 | 180 | 270;
export const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** `[a, b, c, d, e, f]` maps `(x, y)` to `(a·x + c·y + e, b·x + d·y + f)`. */
export type Matrix = [number, number, number, number, number, number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function applyMatrix(m: Matrix, x: number, y: number): Point {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Applies `n` first and then `m` — the order a canvas transform is drawn in. */
export function multiplyMatrix(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function isRotation(value: number): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

/** The frame after rotation, before any flip. A quarter turn swaps the sides. */
export function frameSize(width: number, height: number, rotation: number): Size {
  const swap = rotation === 90 || rotation === 270;
  return swap ? { width: height, height: width } : { width, height };
}

function rotationMatrix(width: number, height: number, rotation: number): Matrix {
  if (rotation === 90) return [0, 1, -1, 0, height, 0];
  if (rotation === 180) return [-1, 0, 0, -1, width, height];
  if (rotation === 270) return [0, -1, 1, 0, 0, width];
  return IDENTITY;
}

/**
 * Natural pixel → frame pixel: rotate clockwise, then mirror in the frame the
 * user is looking at. The flip comes last so "flip horizontal" always mirrors
 * what is on screen, whichever rotation is applied.
 */
export function transformPoint(
  point: Point,
  natural: Size,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
): Point {
  const rotated = applyMatrix(rotationMatrix(natural.width, natural.height, rotation), point.x, point.y);
  const frame = frameSize(natural.width, natural.height, rotation);
  return {
    x: flipH ? frame.width - rotated.x : rotated.x,
    y: flipV ? frame.height - rotated.y : rotated.y,
  };
}

export function frameMatrix(natural: Size, rotation: number, flipH: boolean, flipV: boolean): Matrix {
  const frame = frameSize(natural.width, natural.height, rotation);
  const flip: Matrix = [
    flipH ? -1 : 1,
    0,
    0,
    flipV ? -1 : 1,
    flipH ? frame.width : 0,
    flipV ? frame.height : 0,
  ];
  return multiplyMatrix(flip, rotationMatrix(natural.width, natural.height, rotation));
}

/** Total, because a rotation and a mirror never move a point out of the frame. */
export function transformRect(
  rect: Rect,
  natural: Size,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
): Rect {
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ].map((p) => transformPoint(p, natural, rotation, flipH, flipV));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export function projectRect(rect: Rect, matrix: Matrix): Rect {
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ].map((p) => applyMatrix(matrix, p.x, p.y));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export function invertMatrix(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return IDENTITY;
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/**
 * The whole pipeline in one matrix: natural → rotate and mirror → crop →
 * uniform scale. The component hands this to `setTransform` and the audit
 * checks that it maps the natural corners exactly onto the output corners and
 * scales both axes by the same number, which is what "never distorts" means.
 */
export function outputMatrix(
  natural: Size,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  crop: Rect | null,
  scale: number,
): Matrix {
  const base = frameMatrix(natural, rotation, flipH, flipV);
  if (!crop) return multiplyMatrix([scale, 0, 0, scale, 0, 0], base);
  const cut = transformRect(crop, natural, rotation, flipH, flipV);
  const shifted = multiplyMatrix(IDENTITY, [1, 0, 0, 1, -cut.x, -cut.y]);
  return multiplyMatrix([scale, 0, 0, scale, 0, 0], multiplyMatrix(shifted, base));
}

/**
 * The one factor that maps the frame to a target box, so the component, the
 * preview and the export cannot each invent their own and drift apart. It is a
 * single `max` on both axes, so the image always covers the box exactly and is
 * never stretched: the aspect ratio of the frame survives to the last pixel.
 */
export function fitScale(size: Size, width: number, height: number): number {
  return Math.max(width / size.width, height / size.height);
}


/* -------------------------------------------------------------------------- */
/* Scale, budget and crop planning                                             */
/* -------------------------------------------------------------------------- */

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCALE;
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  return Math.round(clamped / SCALE_STEP) * SCALE_STEP;
}

export function scaleSize(size: Size, scalePercent: number): Size {
  const k = clampScale(scalePercent) / 100;
  return { width: Math.max(1, Math.round(size.width * k)), height: Math.max(1, Math.round(size.height * k)) };
}

/**
 * The largest scale this tool will accept for a given frame, as a whole
 * percentage. Both caps are checked here, and the answer is the honest one: the
 * export can never be bigger than an input this tool would have accepted.
 */
export function maxScaleFor(size: Size): number {
  const w = Math.max(1, Math.floor(size.width));
  const h = Math.max(1, Math.floor(size.height));
  const bySide = Math.min(MAX_SIDE_PX / w, MAX_SIDE_PX / h);
  const byArea = Math.sqrt(MAX_PIXELS / (w * h));
  const pct = Math.floor(Math.min(bySide, byArea) * 100);
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, pct));
}

export type PlanReason = "pixels" | "side" | "tiny";

export interface OutputPlanAccepted {
  ok: true;
  width: number;
  height: number;
  pixels: number;
  scale: number;
  maxScale: number;
  reduced: false;
}

export interface OutputPlanRejected {
  ok: false;
  reason: PlanReason;
  message: string;
  maxScale: number;
  width: number;
  height: number;
}

export type OutputPlan = OutputPlanAccepted | OutputPlanRejected;

/**
 * The export is refused rather than quietly shrunk. A user who asks for 200% and
 * receives 133% has been handed a different image from the one they asked for,
 * and this tool says what the largest size is instead.
 */
export function planOutput(size: Size, scalePercent: number): OutputPlan {
  const scale = clampScale(scalePercent);
  const out = scaleSize(size, scale);
  const maxScale = maxScaleFor(size);
  const base = { scale, maxScale, width: out.width, height: out.height };
  if (out.width < MIN_OUTPUT_PX || out.height < MIN_OUTPUT_PX) {
    return {
      ok: false,
      reason: "tiny",
      maxScale,
      width: out.width,
      height: out.height,
      message: `${out.width} × ${out.height} px is smaller than the ${MIN_OUTPUT_PX} px minimum on a side. Crop a larger area, or raise the scale.`,
    };
  }
  if (out.width > MAX_SIDE_PX || out.height > MAX_SIDE_PX) {
    return {
      ok: false,
      reason: "side",
      maxScale,
      width: out.width,
      height: out.height,
      message: `At ${scale}% this frame is ${out.width} × ${out.height} px — a side is over the ${SIDE_LIMIT_LABEL} limit. The largest scale this frame accepts is ${maxScale}%, or crop it smaller first.`,
    };
  }
  if (out.width * out.height > MAX_PIXELS) {
    return {
      ok: false,
      reason: "pixels",
      maxScale,
      width: out.width,
      height: out.height,
      message: `At ${scale}% this frame is ${out.width} × ${out.height} px — ${((out.width * out.height) / 1_000_000).toFixed(1)} megapixels, over the ${PIXEL_BUDGET_LABEL} budget. The largest scale this frame accepts is ${maxScale}%, or crop it smaller first.`,
    };
  }
  return { ok: true, ...base, pixels: out.width * out.height, reduced: false };
}

/**
 * A crop is clamped into the frame rather than trusted, and a crop that is
 * entirely outside it is refused with the reason instead of snapping somewhere
 * surprising. Coordinates are in natural pixels, so a crop survives a later
 * rotation: it is carried by `transformRect`.
 */
export function normalizeCrop(requested: Rect, natural: Size, minSize = MIN_CROP_PX): Rect | null {
  // A NaN survives Math.max and Math.min unchanged, and NaN < minSize is false,
  // so a non-finite request has to be turned away before any of the arithmetic.
  if (![requested.x, requested.y, requested.width, requested.height].every(Number.isFinite)) return null;
  const x0 = Math.max(0, Math.min(natural.width, Math.round(Math.min(requested.x, requested.x + requested.width))));
  const y0 = Math.max(0, Math.min(natural.height, Math.round(Math.min(requested.y, requested.y + requested.height))));
  const x1 = Math.max(0, Math.min(natural.width, Math.round(Math.max(requested.x, requested.x + requested.width))));
  const y1 = Math.max(0, Math.min(natural.height, Math.round(Math.max(requested.y, requested.y + requested.height))));
  const width = x1 - x0;
  const height = y1 - y0;
  if (width < minSize || height < minSize) return null;
  return { x: x0, y: y0, width, height };
}

/** The crop as the user sees it: in frame pixels at the current scale. */
export function frameRectOf(crop: Rect | null, natural: Size, rotation: number, flipH: boolean, flipV: boolean): Rect {
  if (!crop) return { x: 0, y: 0, ...frameSize(natural.width, natural.height, rotation) };
  return transformRect(crop, natural, rotation, flipH, flipV);
}

/** The frame rect a drag on the crop view produced, back in natural pixels. */
export function naturalRectOf(frameRect: Rect, natural: Size, rotation: number, flipH: boolean, flipV: boolean): Rect {
  const inverse = invertMatrix(frameMatrix(natural, rotation, flipH, flipV));
  const corners: Point[] = [
    { x: frameRect.x, y: frameRect.y },
    { x: frameRect.x + frameRect.width, y: frameRect.y },
    { x: frameRect.x + frameRect.width, y: frameRect.y + frameRect.height },
    { x: frameRect.x, y: frameRect.y + frameRect.height },
  ].map((p) => applyMatrix(inverse, p.x, p.y));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** The frame the export will be made from: the crop, or all of it. */
export function outputFrame(
  natural: Size,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  crop: Rect | null,
): Size {
  const rect = frameRectOf(crop, natural, rotation, flipH, flipV);
  return { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
}

/**
 * The on-screen canvas is capped at `PREVIEW_MAX_SIDE_PX` so a 16-megapixel edit
 * still repaints, while the exported file is always rendered at full size. For
 * an image at or under the cap this is exactly 1, so the preview and the file
 * are the same pixels — which is the claim the audit checks.
 */
export function previewScaleFor(width: number, height: number): number {
  const longest = Math.max(1, Math.max(width, height));
  return Math.min(1, PREVIEW_MAX_SIDE_PX / longest);
}

export function previewSizeFor(width: number, height: number, scale: number): Size {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/* -------------------------------------------------------------------------- */
/* Render targets: the box a canvas is painted into, and the matrix for it      */
/* -------------------------------------------------------------------------- */

export type ViewMode = "output" | "crop";

/**
 * A canvas the component is about to fill: its backing-store size in pixels and
 * the matrix that carries a natural pixel into it. Every one of these numbers
 * is derived from the state the caller passes, never from a value captured in
 * an earlier render, which is what stops a repaint after a load or a rotation
 * from reusing the previous image's size.
 */
export interface RenderTarget {
  width: number;
  height: number;
  matrix: Matrix;
  /** The uniform factor the matrix applies to both axes. */
  scale: number;
}

/** The region the visible canvas shows: the whole frame while cropping. */
export function viewSize(
  natural: Size,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  crop: Rect | null,
  viewMode: ViewMode,
): Size {
  return outputFrame(natural, rotation, flipH, flipV, viewMode === "crop" ? null : crop);
}

/**
 * Paints the frame (or the crop) into a `width` × `height` box, covering it
 * exactly and without distortion. One matrix, used for the preview, the crop
 * overlay and the export, so what is measured on screen is what is written.
 */
export function renderTarget(
  natural: Size,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  crop: Rect | null,
  width: number,
  height: number,
): RenderTarget {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = fitScale(outputFrame(natural, rotation, flipH, flipV, crop), w, h);
  return {
    width: w,
    height: h,
    scale,
    matrix: outputMatrix(natural, rotation, flipH, flipV, crop, scale),
  };
}

/**
 * The on-screen canvas for a given output size: the file's exact pixel
 * dimensions reduced to the preview cap, with one scale for both axes. Below
 * the cap this is exactly 1, so the screen and the file are the same pixels.
 */
export function previewTarget(
  natural: Size,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  crop: Rect | null,
  output: Size,
): RenderTarget {
  const s = previewScaleFor(output.width, output.height);
  return renderTarget(
    natural,
    rotation,
    flipH,
    flipV,
    crop,
    Math.max(1, Math.round(output.width * s)),
    Math.max(1, Math.round(output.height * s)),
  );
}

/* -------------------------------------------------------------------------- */
/* Output naming                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Path separators, reserved characters and control codes become "-", and a stem
 * left with nothing but dots and dashes falls back to the default, so the file
 * is never called `....png` or hidden behind a leading dot.
 */
function safeStem(source: string): string {
  let out = "";
  for (const ch of source) {
    const code = ch.codePointAt(0) ?? 0;
    const reserved = code < 32 || code === 127 || '\\/:*?"<>|'.includes(ch);
    out += reserved ? "-" : ch;
  }
  return out.replace(/^[.\-]+|[.\-]+$/g, "").slice(0, MAX_STEM_CHARS).trim();
}

export interface NameState {
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  crop: Rect | null;
  scale: number;
  filter: string;
  adjusted: boolean;
  annotated: boolean;
}

/**
 * The name says what the file actually is: the real pixel size, the rotation, a
 * flip, a crop, the filter and whether adjustments or annotations are in it. It
 * never claims an edit that did not happen, and the size comes from the plan
 * rather than from the source, so a crop or a resize cannot be mistaken for
 * the original.
 */
export function outputNameFor(source: string, state: NameState, format: ExportFormatId): string {
  const base = safeStem(source.replace(/\.(?:png|jpe?g|gif|webp|bmp|tiff?|avif|heic)$/i, ""));
  const parts = [`${state.width}x${state.height}`];
  if (state.rotation) parts.push(`${state.rotation}deg`);
  if (state.flipH) parts.push("fliph");
  if (state.flipV) parts.push("flipv");
  if (state.crop) parts.push(`crop${state.crop.width}x${state.crop.height}`);
  if (state.scale !== DEFAULT_SCALE) parts.push(`${state.scale}pct`);
  if (state.filter && state.filter !== "none") parts.push(state.filter);
  if (state.adjusted) parts.push("adjusted");
  if (state.annotated) parts.push("annotated");
  return `${base || DEFAULT_STEM}-${parts.join("-")}.${extensionFor(format)}`;
}

/** The same name, decided by the bytes the canvas really produced. */
export function outputNameForMime(source: string, state: NameState, mime: string): string | null {
  const format = formatForMime(mime);
  return format ? outputNameFor(source, state, format) : null;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export type EditorErrorKind = "decode" | "memory" | "encode" | "unknown";

/**
 * Decoding and encoding failures arrive as bare engine errors, and the raw text
 * is not something a user can act on. Every path maps to one honest message.
 */
export function classifyEditorError(err: unknown): EditorErrorKind {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/out of memory|allocation|memory access|exceeds the maximum|indexsize|rangeerror/i.test(message)) {
    return "memory";
  }
  if (/securityerror|encodingerror|notsupportederror|unable to encode|tainted/i.test(name)) return "encode";
  if (
    /decod|image|bitmap|unsupported|corrupt|data size|invalid|abort/i.test(`${name} ${message}`)
  ) {
    return "decode";
  }
  return "unknown";
}

export const EDITOR_ERROR_MESSAGES: Record<EditorErrorKind, string> = {
  decode:
    "This browser could not decode that file. It may be truncated, or a format this tool names but the browser does not read. Re-save it as PNG and try again.",
  memory: `That image used up too much memory. The editor works on up to ${PIXEL_BUDGET_LABEL} at a time — crop it or scale it down first.`,
  encode:
    "The canvas could not be encoded. That usually means the browser has no encoder for the format you picked. Try PNG.",
  unknown: "That did not finish. Nothing was downloaded — try a smaller image, or a different format.",
};

export function editorErrorMessage(err: unknown): string {
  return EDITOR_ERROR_MESSAGES[classifyEditorError(err)];
}
