/**
 * Everything the image OCR tool needs to agree on with itself, with no browser
 * API in sight: the caps, the image-header reader, the language table, the
 * output-naming convention and the error classification. The component, the
 * Node mirror audit and the marketing copy all read these numbers from here, so
 * a cap can never be stated in one place and enforced in another.
 *
 * The OCR engine itself is deliberately absent: it is behind a dynamic import in
 * `ocr-engine.ts`, so this module — and therefore the tool's first paint — never
 * pulls the WebAssembly recognizer in.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PIXELS = 16_000_000;
export const MAX_SIDE_PX = 8192;
export const MAX_STEM_CHARS = 60;
export const DEFAULT_STEM = "image";

/** Phrases for the UI, derived from the caps so a number is never retyped. */
export const FILE_SIZE_LABEL = `${MAX_FILE_BYTES / (1024 * 1024)} MB`;
export const PIXEL_BUDGET_LABEL = `${MAX_PIXELS / 1_000_000} MP`;
export const SIDE_LIMIT_LABEL = `${MAX_SIDE_PX} px`;

/**
 * The engine, its WebAssembly core and the language models are all served from
 * this site's own origin. The default in tesseract.js is jsDelivr, so these
 * three paths are what keeps the tool off a third-party CDN.
 */
export const OCR_WORKER_PATH = "/ocr/worker.min.js";
export const OCR_CORE_PATH = "/ocr/";
export const OCR_LANG_PATH = "/ocr/traineddata/";

export type ImageFormatId = "png" | "jpeg" | "gif" | "webp" | "bmp";

export interface ImageFormatSpec {
  id: ImageFormatId;
  label: string;
  extension: string;
  accept: string;
}

export const IMAGE_FORMATS: ImageFormatSpec[] = [
  { id: "png", label: "PNG", extension: "png", accept: "image/png,.png" },
  { id: "jpeg", label: "JPEG", extension: "jpg", accept: "image/jpeg,.jpg,.jpeg" },
  { id: "gif", label: "GIF", extension: "gif", accept: "image/gif,.gif" },
  { id: "webp", label: "WebP", extension: "webp", accept: "image/webp,.webp" },
  { id: "bmp", label: "BMP", extension: "bmp", accept: "image/bmp,.bmp" },
];

export const ACCEPTED_IMAGE_TYPES = IMAGE_FORMATS.map((f) => f.accept).join(",");
export const ACCEPTED_FORMAT_NAMES = "PNG, JPEG, GIF, WebP or BMP";

export interface OcrLanguage {
  id: string;
  label: string;
  script: string;
  /** Byte size of the self-hosted gzipped model fetched on this language's first use. */
  modelBytes: number;
}

export const OCR_LANGUAGES: OcrLanguage[] = [
  { id: "eng", label: "English", script: "Latin", modelBytes: 2952873 },
  { id: "spa", label: "Spanish", script: "Latin", modelBytes: 2100190 },
  { id: "fra", label: "French", script: "Latin", modelBytes: 707406 },
  { id: "deu", label: "German", script: "Latin", modelBytes: 1333102 },
  { id: "por", label: "Portuguese", script: "Latin", modelBytes: 1392239 },
  { id: "ita", label: "Italian", script: "Latin", modelBytes: 1660998 },
  { id: "rus", label: "Russian", script: "Cyrillic", modelBytes: 2679598 },
  { id: "hin", label: "Hindi", script: "Devanagari", modelBytes: 1389692 },
  { id: "ara", label: "Arabic", script: "Arabic", modelBytes: 1661906 },
  { id: "chi_sim", label: "Chinese (simplified)", script: "Han", modelBytes: 1718768 },
  { id: "jpn", label: "Japanese", script: "Japanese", modelBytes: 2030256 },
  { id: "kor", label: "Korean", script: "Hangul", modelBytes: 1572336 },
];

export const DEFAULT_LANGUAGE = "eng";

export function isSupportedLanguage(id: string): boolean {
  return OCR_LANGUAGES.some((l) => l.id === id);
}

/** An unknown id falls back to English rather than reaching the engine as a 404. */
export function languageSpec(id: string): OcrLanguage {
  return OCR_LANGUAGES.find((l) => l.id === id) ?? OCR_LANGUAGES[0];
}

export function languageLabel(id: string): string {
  return languageSpec(id).label;
}

export function formatSpec(id: ImageFormatId): ImageFormatSpec {
  return IMAGE_FORMATS.find((f) => f.id === id) ?? IMAGE_FORMATS[0];
}

/** A local copy of the repo's byte formatter: this module must stay import-free. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) || 0, units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function modelSizeLabel(id: string): string {
  return formatBytes(languageSpec(id).modelBytes);
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
 * before any decoder is handed bytes it cannot read.
 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormatId | null {
  if (startsWith(bytes, PNG_MAGIC)) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a")) return "gif";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "webp";
  if (startsWith(bytes, [0x42, 0x4d])) return "bmp";
  return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  // IHDR is required to be the first chunk, so its dimensions are fixed offsets.
  if (!ascii(bytes, 12, "IHDR") || bytes.length < 24) return null;
  return { width: be32(bytes, 16), height: be32(bytes, 20) };
}

function gifSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  return { width: le16(bytes, 6), height: le16(bytes, 8) };
}

function bmpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 26) return null;
  const headerSize = le32(bytes, 14);
  if (headerSize === 12) return { width: le16(bytes, 18), height: le16(bytes, 20) };
  if (headerSize >= 40) return { width: le32(bytes, 18), height: Math.abs(sle32(bytes, 22)) };
  return null;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
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

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  if (ascii(bytes, 12, "VP8X")) {
    return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  }
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

/**
 * Reads the pixel dimensions out of the format's own header, without decoding
 * the image. This is what lets the tool refuse a 100-megapixel photo before the
 * browser spends memory on it.
 */
export function readImageSize(
  bytes: Uint8Array,
  format: ImageFormatId,
): { width: number; height: number } | null {
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

export type PreflightReason =
  | "empty"
  | "size"
  | "format"
  | "dimensions"
  | "pixels"
  | "side";

export interface PreflightAccepted {
  ok: true;
  format: ImageFormatId;
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

/**
 * Every refusal is decided before a single byte reaches the recognizer, and each
 * message names the fix rather than saying "invalid file".
 */
export function preflightImage(bytes: Uint8Array, name: string): PreflightResult {
  if (!bytes || bytes.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: `That file is empty. Choose a ${ACCEPTED_FORMAT_NAMES} image that contains text.`,
    };
  }
  if (bytes.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "size",
      // The exact byte count is in the message on purpose: a file of 26,214,425
      // bytes prints as "25.0 MB", and only the byte count explains why that is
      // over a 25 MB limit.
      message: `${name} is ${formatBytes(bytes.length)} (${bytes.length.toLocaleString("en-US")} bytes) — images up to ${FILE_SIZE_LABEL} (${MAX_FILE_BYTES.toLocaleString("en-US")} bytes) are supported here.`,
    };
  }
  const format = sniffImageFormat(bytes);
  if (!format) {
    return {
      ok: false,
      reason: "format",
      message: `${name} is not a ${ACCEPTED_FORMAT_NAMES} image, so its text cannot be read. Convert it first.`,
    };
  }
  const label = formatSpec(format).label;
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
      message: `This image is ${(pixels / 1_000_000).toFixed(1)} megapixels — OCR reads up to ${PIXEL_BUDGET_LABEL} in one pass. Resize it down first.`,
    };
  }
  return { ok: true, format, label, width: size.width, height: size.height, pixels };
}

/**
 * Path separators, reserved characters and control codes become "-", and a stem
 * left with nothing but dots and dashes falls back to the default, so the file
 * is never called `....-ocr-eng.txt` or hidden behind a leading dot.
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

/** The language code is part of the name so two runs never overwrite each other. */
export function outputNameFor(source: string, lang: string): string {
  const base = safeStem(source.replace(/\.(?:png|jpe?g|gif|webp|bmp|tiff?|avif|heic)$/i, ""));
  const id = isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  return `${base || DEFAULT_STEM}-ocr-${id}.txt`;
}

/**
 * Tesseract separates pages with a form feed and pads lines with the whitespace
 * it thinks the columns need. Neither survives into a file the user pastes
 * somewhere, so both are normalized here and nowhere else.
 */
export function normalizeOcrText(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) return "";
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+$/g, ""));
  const out: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line.length === 0) {
      blanks += 1;
      if (blanks > 1) continue;
      out.push("");
      continue;
    }
    blanks = 0;
    out.push(line);
  }
  return out.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

export interface TextStats {
  chars: number;
  words: number;
  lines: number;
}

export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  if (!trimmed) return { chars: 0, words: 0, lines: 0 };
  return {
    chars: trimmed.length,
    words: trimmed.split(/\s+/).filter(Boolean).length,
    lines: trimmed.split("\n").length,
  };
}

export type ConfidenceBand = "high" | "fair" | "low";

/**
 * Tesseract's own 0–100 confidence is reported as a band rather than a
 * percentage of correctness: an engine confidence is not an accuracy figure,
 * and printing it as one would be a claim the tool cannot support.
 */
export const CONFIDENCE_FLOORS: { band: ConfidenceBand; floor: number }[] = [
  { band: "high", floor: 80 },
  { band: "fair", floor: 55 },
];

export function confidenceBand(confidence: number): ConfidenceBand {
  if (!Number.isFinite(confidence)) return "low";
  for (const { band, floor } of CONFIDENCE_FLOORS) {
    if (confidence >= floor) return band;
  }
  return "low";
}

export const CONFIDENCE_NOTES: Record<ConfidenceBand, string> = {
  high: "The engine was confident about most of what it read.",
  fair: "Some characters may be wrong — check names, numbers and totals.",
  low: "A lot of this was guessed. A clearer, larger, straighter scan will do better.",
};

export const ENGINE_PROGRESS_STATUSES = [
  "loading tesseract core",
  "initializing tesseract",
  "loading language traineddata",
  "initializing api",
  "recognizing text",
] as const;

/**
 * Turns the engine's internal status strings into a sentence a person can act
 * on, and returns null for anything it does not recognise so a raw engine
 * string can never reach the screen.
 */
export function progressLine(status: string, progress: number, lang: string): string | null {
  const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress * 100))) : 0;
  const label = languageLabel(lang);
  switch (status) {
    case "loading tesseract core":
      return "Loading the OCR engine from this site…";
    case "initializing tesseract":
      return "Starting the OCR engine…";
    case "loading language traineddata":
      return `Loading the ${label} model (${modelSizeLabel(lang)}) — first run only… ${pct}%`;
    case "initializing api":
      return `Preparing the ${label} recognizer…`;
    case "recognizing text":
      return `Reading the text… ${pct}%`;
    default:
      return null;
  }
}

export type OcrErrorKind = "language" | "engine" | "image" | "memory" | "unknown";

export function classifyOcrError(err: unknown): OcrErrorKind {
  const name = (err as { name?: string } | null)?.name ?? "";
  const msg = err instanceof Error ? err.message : String(err);
  const both = `${name} ${msg}`;
  if (/traineddata|language model|404|failed to fetch|networkerror|load.*lang/i.test(both)) {
    return "language";
  }
  if (/tesseractcore|wasm|worker|module|importscripts/i.test(both)) return "engine";
  if (/memory|allocat|out of bounds|abort|rangeerror/i.test(both)) return "memory";
  if (/image|decode|unrecognized|could not read|empty/i.test(both)) return "image";
  return "unknown";
}

export const OCR_ERROR_MESSAGES: Record<OcrErrorKind, string> = {
  language:
    "The language model could not be loaded. It is served from this site, so an ad blocker or a failed request is the likely cause — reload and try again.",
  engine:
    "The OCR engine could not start. This browser could not load the WebAssembly engine that ships with the tool.",
  image:
    "The engine could not read this image. It may be truncated, or a format the decoder does not handle.",
  memory:
    "This image used up too much memory. Resize it down and run it again.",
  unknown:
    "OCR did not finish. A clearer, larger, straighter image usually helps more than retrying the same one.",
};
