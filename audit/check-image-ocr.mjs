/**
 * Node mirror audit for the Image OCR tool. No browser, no DOM: the shipped
 * `ocr-format.ts` is transpiled with the repo's own TypeScript compiler and
 * imported, so these checks exercise the real module rather than a hand-written
 * copy of its rules.
 *
 * The interesting part is section 11, which runs the actual recognizer: it
 * renders real glyphs into a PNG, hands that PNG to tesseract.js loaded from
 * this repo, and checks it reads the text back. Everything before that is
 * arithmetic the tool promises to get right.
 *
 *   node audit/check-image-ocr.mjs
 */
import ts from "typescript";
import zlib from "node:zlib";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = "src/features/image-ocr";
const OUT = "audit/.ocr-mirror";
const require = createRequire(path.resolve("package.json"));

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
{
  const source = readFileSync(`${SRC}/ocr-format.ts`, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: "ocr-format.ts",
  }).outputText.replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(`${OUT}/ocr-format.mjs`, js);
}

const F = await import(pathToFileURL(`${OUT}/ocr-format.mjs`).href);
const {
  ACCEPTED_FORMAT_NAMES,
  ACCEPTED_IMAGE_TYPES,
  CONFIDENCE_FLOORS,
  CONFIDENCE_NOTES,
  DEFAULT_LANGUAGE,
  ENGINE_PROGRESS_STATUSES,
  FILE_SIZE_LABEL,
  IMAGE_FORMATS,
  MAX_FILE_BYTES,
  MAX_PIXELS,
  MAX_SIDE_PX,
  OCR_CORE_PATH,
  OCR_ERROR_MESSAGES,
  OCR_LANGUAGES,
  OCR_LANG_PATH,
  OCR_WORKER_PATH,
  PIXEL_BUDGET_LABEL,
  SIDE_LIMIT_LABEL,
  classifyOcrError,
  confidenceBand,
  isSupportedLanguage,
  languageLabel,
  modelSizeLabel,
  normalizeOcrText,
  outputNameFor,
  preflightImage,
  progressLine,
  readImageSize,
  sniffImageFormat,
  textStats,
} = F;

const COMPONENT = readFileSync(`${SRC}/ImageOcr.tsx`, "utf8");
const ENGINE = readFileSync(`${SRC}/ocr-engine.ts`, "utf8");
const TOOLS = readFileSync("src/lib/tools.ts", "utf8");
const CONTENT = readFileSync("src/lib/tool-content.ts", "utf8");
const SEO = readFileSync("src/lib/seo.ts", "utf8");
const GUIDES = readFileSync("src/lib/guides.ts", "utf8");

// ---- header fixtures: real bytes, not mocks ----

const u8 = (...b) => Uint8Array.from(b);

/** A PNG header is fully described by its signature and IHDR chunk. */
function pngHeader(width, height) {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}

/** SOI, an APP0 segment, then the SOF0 that actually carries the dimensions. */
function jpegSof0(width, height) {
  // 2 length bytes + "JFIF\0" + 8 bytes of JFIF fields = 15.
  const app0 = [0xff, 0xe0, 0x00, 0x0f, ...new TextEncoder().encode("JFIF" + String.fromCharCode(0)), 0, 0, 0, 1, 0, 1, 0, 0];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof0]);
}

function gifHeader(width, height) {
  const b = new Uint8Array(13);
  b.set(new TextEncoder().encode("GIF89a"), 0);
  b[6] = width & 0xff;
  b[7] = (width >> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (height >> 8) & 0xff;
  return b;
}

function webpHeader(kind, width, height) {
  const b = new Uint8Array(40);
  b.set(new TextEncoder().encode("RIFF"), 0);
  b.set(new TextEncoder().encode("WEBP"), 8);
  b.set(new TextEncoder().encode(kind), 12);
  if (kind === "VP8X") {
    b[24] = (width - 1) & 0xff;
    b[25] = ((width - 1) >> 8) & 0xff;
    b[26] = ((width - 1) >> 16) & 0xff;
    b[27] = (height - 1) & 0xff;
    b[28] = ((height - 1) >> 8) & 0xff;
    b[29] = ((height - 1) >> 16) & 0xff;
  } else if (kind === "VP8L") {
    const packed = (width - 1) | ((height - 1) << 14);
    b[21] = packed & 0xff;
    b[22] = (packed >> 8) & 0xff;
    b[23] = (packed >> 16) & 0xff;
    b[24] = (packed >>> 24) & 0xff;
  } else {
    b.set([0x9d, 0x01, 0x2a], 23);
    b[26] = width & 0xff;
    b[27] = (width >> 8) & 0x3f;
    b[28] = height & 0xff;
    b[29] = (height >> 8) & 0x3f;
  }
  return b;
}

function bmpHeader(width, height, headerSize = 40) {
  const b = new Uint8Array(30);
  b.set([0x42, 0x4d], 0);
  const view = new DataView(b.buffer);
  view.setUint32(14, headerSize, true);
  view.setUint32(18, width, true);
  view.setUint32(22, height, true);
  return b;
}

// ---- 1. the caps are single-sourced and the labels cannot drift ----

check("the byte cap is exactly 25 MB", MAX_FILE_BYTES === 25 * 1024 * 1024, String(MAX_FILE_BYTES));
check("the pixel cap is exactly 16 megapixels", MAX_PIXELS === 16_000_000, String(MAX_PIXELS));
check("the long-side cap is exactly 8192 px", MAX_SIDE_PX === 8192, String(MAX_SIDE_PX));
check("the size label is derived from the cap, not retyped", FILE_SIZE_LABEL === "25 MB", FILE_SIZE_LABEL);
check("the pixel label is derived from the cap", PIXEL_BUDGET_LABEL === "16 MP", PIXEL_BUDGET_LABEL);
check("the side label is derived from the cap", SIDE_LIMIT_LABEL === "8192 px", SIDE_LIMIT_LABEL);
check("marketing copy quotes the same three numbers", [FILE_SIZE_LABEL, PIXEL_BUDGET_LABEL, SIDE_LIMIT_LABEL].every((v) => CONTENT.includes(v) && SEO.includes(v)));
check("the five advertised formats are exactly the five the parser supports", (() => {
  const labels = IMAGE_FORMATS.map((f) => f.label);
  return (
    labels.join(", ") === "PNG, JPEG, GIF, WebP, BMP" &&
    ACCEPTED_FORMAT_NAMES === "PNG, JPEG, GIF, WebP or BMP" &&
    labels.every((l) => ACCEPTED_FORMAT_NAMES.includes(l)) &&
    new Set(IMAGE_FORMATS.map((f) => f.extension)).size === IMAGE_FORMATS.length
  );
})(), IMAGE_FORMATS.map((f) => f.label).join(", "));
check("the accept attribute lists every format's own mime and extensions", ACCEPTED_IMAGE_TYPES.split(",").length === IMAGE_FORMATS.reduce((n, f) => n + f.accept.split(",").length, 0), ACCEPTED_IMAGE_TYPES);
check("every extension the accept attribute offers belongs to the format it is listed under", (() => {
  const byFormat = Object.fromEntries(
    IMAGE_FORMATS.map((f) => [
      f.id,
      {
        mime: f.accept.split(",")[0],
        extensions: f.accept.split(",").slice(1).map((e) => e.replace(".", "")),
      },
    ]),
  );
  return (
    byFormat.png.mime === "image/png" &&
    byFormat.png.extensions.join() === "png" &&
    byFormat.jpeg.mime === "image/jpeg" &&
    byFormat.jpeg.extensions.join() === "jpg,jpeg" &&
    byFormat.gif.extensions.join() === "gif" &&
    byFormat.webp.mime === "image/webp" &&
    byFormat.bmp.extensions.join() === "bmp" &&
    IMAGE_FORMATS.every((f) => {
      const magic = { png: pngHeader(1, 1), jpeg: jpegSof0(1, 1), gif: gifHeader(1, 1), webp: webpHeader("VP8L", 1, 1), bmp: bmpHeader(1, 1) }[f.id];
      return sniffImageFormat(magic) === f.id;
    })
  );
})());


// ---- 2. the format comes from the bytes, not the file name ----

check("a PNG signature is identified", sniffImageFormat(pngHeader(4, 4)) === "png");
check("a JPEG SOI is identified", sniffImageFormat(jpegSof0(4, 4)) === "jpeg");
check("GIF87a is identified", sniffImageFormat(new TextEncoder().encode("GIF87a\x01\x00\x01\x00")) === "gif");
check("GIF89a is identified", sniffImageFormat(new TextEncoder().encode("GIF89a\x01\x00\x01\x00")) === "gif");
check("a WebP RIFF container is identified", sniffImageFormat(webpHeader("VP8L", 4, 4)) === "webp");
check("a BMP magic pair is identified", sniffImageFormat(bmpHeader(4, 4)) === "bmp");
check("plain text is not an image", sniffImageFormat(new TextEncoder().encode("this is a .png in name only")) === null);
check("a RIFF file that is not WebP is refused", sniffImageFormat(new TextEncoder().encode("RIFF____WAVEfmt ")) === null);
check("a PNG magic prefix with no IHDR still sniffs as png (the size read catches it)", sniffImageFormat(u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) === "png");
check("an empty buffer sniffs as nothing", sniffImageFormat(new Uint8Array(0)) === null);
check("a two-byte buffer does not throw", sniffImageFormat(u8(0xff, 0xd8)) === null);
check("a file called .jpg but holding text is still refused", sniffImageFormat(new TextEncoder().encode("plain text pretending to be a photo")) === null);

// ---- 3. dimensions are read from the header, per format ----

check("PNG dimensions come from IHDR", (() => { const s = readImageSize(pngHeader(1200, 800), "png"); return s.width === 1200 && s.height === 800; })());
check("GIF dimensions come from the logical screen descriptor", (() => { const s = readImageSize(gifHeader(640, 480), "gif"); return s.width === 640 && s.height === 480; })());
check("JPEG dimensions are found past an APP0 segment", (() => { const s = readImageSize(jpegSof0(1024, 768), "jpeg"); return s.width === 1024 && s.height === 768; })());
check("a progressive JPEG (SOF2) is measured too", (() => { const b = jpegSof0(300, 200); const at = b.indexOf(0xc0, 4); b[at + 1] = 0xc2; const s = readImageSize(b, "jpeg"); return s.width === 300 && s.height === 200; })());
check("BMP v3 dimensions come from BITMAPINFOHEADER", (() => { const s = readImageSize(bmpHeader(200, 100), "bmp"); return s.width === 200 && s.height === 100; })());
check("a top-down BMP (negative height) reports a positive size", (() => { const b = bmpHeader(200, 100); new DataView(b.buffer).setInt32(22, -100, true); const s = readImageSize(b, "bmp"); return s.width === 200 && s.height === 100; })());
check("a core-header BMP v2 still yields a size", (() => { const b = bmpHeader(8, 8, 12); const v = new DataView(b.buffer); v.setUint16(18, 8, true); v.setUint16(20, 8, true); const s = readImageSize(b, "bmp"); return s.width === 8 && s.height === 8; })());
check("an extended WebP (VP8X) is measured", (() => { const s = readImageSize(webpHeader("VP8X", 5000, 4000), "webp"); return s.width === 5000 && s.height === 4000; })());
check("a lossless WebP (VP8L) is measured", (() => { const s = readImageSize(webpHeader("VP8L", 321, 123), "webp"); return s.width === 321 && s.height === 123; })());
check("a lossy WebP (VP8 ) is measured", (() => { const s = readImageSize(webpHeader("VP8 ", 640, 360), "webp"); return s.width === 640 && s.height === 360; })());
check("a WebP with an unknown chunk is refused rather than guessed", readImageSize(webpHeader("VP9X", 10, 10), "webp") === null);
check("a PNG with a truncated IHDR is refused", readImageSize(pngHeader(0, 0).slice(0, 20), "png") === null);
check("a zero-dimension header is refused", readImageSize(pngHeader(0, 100), "png") === null);
check("a buffer too short for a BMP header is refused, not crashed on", readImageSize(u8(0x42, 0x4d, 0, 0), "bmp") === null);
check("an unterminated JPEG segment is refused, not looped on", readImageSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), "jpeg") === null);
check("readImageSize is total: no fixture throws", [pngHeader(1, 1), jpegSof0(1, 1), gifHeader(1, 1), webpHeader("VP8L", 1, 1), bmpHeader(1, 1), new Uint8Array(3)].every((b) => {
  try { readImageSize(b, sniffImageFormat(b) ?? "png"); return true; } catch { return false; }
}));

// ---- 4. refusals happen before recognition, and name the real numbers ----

const okPng = preflightImage(pngHeader(800, 600), "receipt.png");
check("a normal PNG is accepted with its real dimensions", okPng.ok && okPng.width === 800 && okPng.height === 600 && okPng.pixels === 480_000, JSON.stringify(okPng));
check("an accepted result names the format for the UI", okPng.ok && okPng.label === "PNG");

const empty = preflightImage(new Uint8Array(0), "empty.png");
check("an empty file is refused as empty", !empty.ok && empty.reason === "empty" && /empty/i.test(empty.message));

const fake = preflightImage(new TextEncoder().encode("not an image at all"), "notes.png");
check("a text file named .png is refused as a format problem", !fake.ok && fake.reason === "format" && /Convert it first/.test(fake.message), JSON.stringify(fake));
check("the format refusal names the file so the user knows which one", fake.message.includes("notes.png"));
check("the format refusal names the formats that would work", fake.message.includes(ACCEPTED_FORMAT_NAMES));

const oversize = preflightImage(new Uint8Array(MAX_FILE_BYTES + 1), "huge.png");
check("a file over the byte cap is refused as too large", !oversize.ok && oversize.reason === "size", JSON.stringify(oversize));
check("the size refusal quotes the file's exact byte count and the real cap", oversize.message.includes((MAX_FILE_BYTES + 1).toLocaleString("en-US")) && oversize.message.includes(MAX_FILE_BYTES.toLocaleString("en-US")) && oversize.message.includes(FILE_SIZE_LABEL), oversize.message);
check("a file exactly on the byte cap is not refused for size", preflightImage(new Uint8Array(MAX_FILE_BYTES), "edge.png").ok === false && preflightImage(new Uint8Array(MAX_FILE_BYTES), "edge.png").reason === "format");

const noHeader = preflightImage(u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "cut.png");
check("a truncated image is refused for its unreadable header", !noHeader.ok && noHeader.reason === "dimensions", JSON.stringify(noHeader));

const longSide = preflightImage(pngHeader(MAX_SIDE_PX + 1, 100), "banner.png");
check("a long side over the limit is refused as 'side'", !longSide.ok && longSide.reason === "side", JSON.stringify(longSide));
check("the side refusal quotes both dimensions and the limit", longSide.message.includes("8193") && longSide.message.includes(SIDE_LIMIT_LABEL), longSide.message);
check("an image exactly on the long-side limit is accepted", (() => { const r = preflightImage(pngHeader(MAX_SIDE_PX, 100), "edge.png"); return r.ok && r.width === MAX_SIDE_PX; })());

const heavy = preflightImage(pngHeader(5000, 5000), "huge.png");
check("25 megapixels is refused as 'pixels', not as 'side'", !heavy.ok && heavy.reason === "pixels", JSON.stringify(heavy));
check("the pixel refusal quotes the real megapixel count and the budget", /25\.0 megapixels/.test(heavy.message) && heavy.message.includes(PIXEL_BUDGET_LABEL), heavy.message);
check("an image exactly on the pixel budget is accepted", (() => { const r = preflightImage(pngHeader(8000, 2000), "edge.png"); return r.ok && r.pixels === 16_000_000; })());
check("the side check runs before the pixel check, so a real message wins", preflightImage(pngHeader(9000, 9000), "both.png").reason === "side");
check("every refusal message is non-empty and ends in a full stop", [empty, fake, oversize, noHeader, longSide, heavy].every((r) => !r.ok && /[.!?]$/.test(r.message)));
check("no refusal leaks a raw stack or an internal identifier", [empty, fake, oversize, noHeader, longSide, heavy].every((r) => !r.ok && !/(\n\s*at\s+\w)|(\.ts:\d)|(\.mjs:\d)|\bundefined\b|\bNaN\b/.test(r.message)), [empty, fake, oversize, noHeader, longSide, heavy].map((r) => r.message).filter((m) => /(\n\s*at\s+\w)|(\.ts:\d)|\bundefined\b|\bNaN\b/.test(m)).join(" || "));

// ---- 5. the download name follows the file and cannot escape ----

check("a .png source becomes <stem>-ocr-<lang>.txt", outputNameFor("receipt.png", "eng") === "receipt-ocr-eng.txt");
check("the language is part of the name so runs do not collide", outputNameFor("receipt.png", "deu") === "receipt-ocr-deu.txt");
check("every known extension is stripped exactly once", ["a.png", "a.PNG", "a.jpg", "a.jpeg", "a.gif", "a.webp", "a.bmp"].every((n) => outputNameFor(n, "eng") === "a-ocr-eng.txt"));
check("a known image extension the tool refuses is still stripped from the name", outputNameFor("scan.tiff", "eng") === "scan-ocr-eng.txt" && outputNameFor("scan.heic", "eng") === "scan-ocr-eng.txt");
check("a name with no extension is used whole", outputNameFor("whiteboard", "eng") === "whiteboard-ocr-eng.txt");
check("an unknown language falls back to the default, not to a 404", outputNameFor("a.png", "klingon") === "a-ocr-eng.txt");
check("a name that is only an extension falls back to the disclosed default", outputNameFor(".png", "eng") === "image-ocr-eng.txt", outputNameFor(".png", "eng"));
check("a hidden dotfile name cannot produce a dot-prefixed download", !outputNameFor(".env.png", "eng").startsWith("."), outputNameFor(".env.png", "eng"));
check("path separators and leading dots are stripped out of the name", (() => { const n = outputNameFor("../../etc/passwd.png", "eng"); return n === "etc-passwd-ocr-eng.txt" && !n.includes("/") && !n.includes(".."); })(), outputNameFor("../../etc/passwd.png", "eng"));
check("reserved characters are replaced and the result is trimmed clean", outputNameFor('re:ceipt<1>.png', "eng") === "re-ceipt-1-ocr-eng.txt", outputNameFor('re:ceipt<1>.png', "eng"));
check("a control character in a name is replaced, not written raw", !/[\x00-\x1f]/.test(outputNameFor("a\u0007b.png", "eng")));
check("a long stem is truncated to a sane name", outputNameFor("x".repeat(400) + ".png", "eng").length <= 60 + "-ocr-eng.txt".length);
check("every language produces a name that is safe and carries its own code", OCR_LANGUAGES.every((l) => {
  const n = outputNameFor("a b.png", l.id);
  return n === `a b-ocr-${l.id}.txt` && !/[\\/:*?"<>|]/.test(n) && !n.includes("..");
}));
check("the twelve names are all distinct", new Set(OCR_LANGUAGES.map((l) => outputNameFor("page.png", l.id))).size === OCR_LANGUAGES.length);

// ---- 6. the recognizer's output is cleaned before anyone sees it ----

check("CRLF and lone CR both become LF", normalizeOcrText("a\r\nb\rc") === "a\nb\nc");
check("a form feed becomes a newline", normalizeOcrText("page one\ff page two".replace("f page", "page")) === "page one\npage two");
check("leading and trailing blank lines are dropped", normalizeOcrText("\n\n\nhello\n\n\n") === "hello");
check("one interior blank line survives, runs collapse to one", normalizeOcrText("a\n\n\n\n\nb") === "a\n\nb");
check("trailing spaces and tabs are trimmed per line", normalizeOcrText("a   \nb\t\t\nc\u00a0\u00a0") === "a\nb\nc");
check("leading indentation inside a line is left alone", normalizeOcrText("    indented") === "    indented");
check("a blank line that holds only spaces is treated as blank", normalizeOcrText("a\n   \n   \n   \nb") === "a\n\nb");
check("empty and non-string input normalize to empty", normalizeOcrText("") === "" && normalizeOcrText(null) === "" && normalizeOcrText(undefined) === "");
check("normalization is idempotent", (() => { const once = normalizeOcrText("\f a  \n\n\n b \f"); return normalizeOcrText(once) === once; })());
check("a lone form feed does not leave an empty document", normalizeOcrText("\f") === "");

const stats = textStats("hello world\nsecond line");
check("stats count characters, words and lines", stats.chars === 23 && stats.words === 4 && stats.lines === 2, JSON.stringify(stats));
check("stats are zero-safe on empty and whitespace", JSON.stringify(textStats("")) === JSON.stringify({ chars: 0, words: 0, lines: 0 }) && JSON.stringify(textStats("   \n  ")) === JSON.stringify({ chars: 0, words: 0, lines: 0 }));
check("stats count a real run without crashing", (() => { const s = textStats("a".repeat(50000)); return s.chars === 50000 && s.words === 1; })());
check("stats and normalization agree on the same text", (() => { const t = normalizeOcrText("\f x  \n\n\n y \f"); return t === " x\n\n y" && textStats(t).chars === 5 && textStats(t).words === 2 && textStats(t).lines === 3; })(), JSON.stringify(normalizeOcrText("\f x  \n\n\n y \f")));

// ---- 7. the confidence number is reported honestly ----

check("confidence is banded, never printed as a percentage of correctness", CONFIDENCE_FLOORS.length === 2 && CONFIDENCE_FLOORS[0].floor === 80 && CONFIDENCE_FLOORS[1].floor === 55);
check("the bands partition the range", [95, 80, 79.9, 55, 54.9, 0].map(confidenceBand).join(",") === "high,high,fair,fair,low,low");
check("a NaN or absent confidence falls to the pessimistic band", confidenceBand(NaN) === "low" && confidenceBand(undefined) === "low");
check("every band has a note that admits uncertainty", Object.values(CONFIDENCE_NOTES).every((n) => typeof n === "string" && n.length > 20));
check("no confidence note claims the text is correct or accurate", !Object.values(CONFIDENCE_NOTES).some((n) => /\b(accurate|correct|perfect|exact)\b/i.test(n)));
check("the lowest band tells the user what to do next", /scan|clearer|larger|straighter/i.test(CONFIDENCE_NOTES.low));

// ---- 8. every engine status becomes a sentence, and nothing else escapes ----

check("the five real engine statuses are the ones mapped", ENGINE_PROGRESS_STATUSES.length === 5);
check("every declared status produces a human line", ENGINE_PROGRESS_STATUSES.every((s) => typeof progressLine(s, 0.5, "eng") === "string" && progressLine(s, 0.5, "eng").length > 0));
check("an unrecognised status returns null rather than leaking a raw string", progressLine("some new status from a future release", 0.5, "eng") === null);
check("an empty or missing status returns null", progressLine("", 0, "eng") === null);
check("no mapped line contains the raw engine status text", ENGINE_PROGRESS_STATUSES.every((s) => !progressLine(s, 0, "eng").toLowerCase().includes(s)));
check("the model-loading line names the language and the download size", /English model \(2\.8 MB\)/.test(progressLine("loading language traineddata", 0.5, "eng")), progressLine("loading language traineddata", 0.5, "eng"));
check("the model-loading line admits it is a first-run cost", /first run only/i.test(progressLine("loading language traineddata", 0, "eng")));
check("a progress percentage is clamped to 0-100", /0%$/.test(progressLine("recognizing text", -5, "eng")) && /100%$/.test(progressLine("recognizing text", 4, "eng")));
check("a NaN progress does not print NaN", !/NaN/.test(progressLine("recognizing text", NaN, "eng")));
check("an unknown language still produces a sensible line", /Preparing/.test(progressLine("initializing api", 0, "klingon")));

// ---- 9. engine failures become a sentence with a next step ----

check("a missing traineddata is classified as a language problem", classifyOcrError(new Error("Failed to load language traineddata")) === "language");
check("a 404 on the model is classified as a language problem", classifyOcrError(new TypeError("Failed to fetch")) === "language");
check("a wasm or worker failure is classified as an engine problem", classifyOcrError(new Error("importScripts failed for tesseract-core")) === "engine");
check("an out-of-memory failure is classified as memory", classifyOcrError(new Error("Cannot enlarge memory array")) === "memory");
check("an unreadable image is classified as an image problem", classifyOcrError(new Error("Image decode failed")) === "image");
check("an unrecognised failure falls back rather than guessing", classifyOcrError(new Error("something odd")) === "unknown" && classifyOcrError(null) === "unknown");
check("a non-Error value does not throw the classifier", classifyOcrError("boom") === "unknown");
check("every classification has a message", Object.keys(OCR_ERROR_MESSAGES).length === 5 && Object.values(OCR_ERROR_MESSAGES).every((m) => m.length > 40));
check("no error message leaks a raw engine string or stack", Object.values(OCR_ERROR_MESSAGES).every((m) => !/(^|\s)Error:|\n\s*at\s+\w|\.js:\d|\.ts:\d/.test(m)), Object.values(OCR_ERROR_MESSAGES).filter((m) => /(^|\s)Error:|\n\s*at\s+\w|\.js:\d|\.ts:\d/.test(m)).join(" | "));
check("the language failure points at the ad blocker, which is the real cause", /ad blocker/i.test(OCR_ERROR_MESSAGES.language));
check("the memory failure tells the user to resize rather than to retry", /[Rr]esize/.test(OCR_ERROR_MESSAGES.memory));

// ---- 10. the language table matches the files this site actually serves ----

const langDir = "public/ocr/traineddata";
const onDisk = readdirSync(langDir).filter((f) => f.endsWith(".traineddata.gz")).map((f) => f.replace(".traineddata.gz", "")).sort();
check("every advertised language has a model served from this origin", OCR_LANGUAGES.every((l) => onDisk.includes(l.id)), OCR_LANGUAGES.filter((l) => !onDisk.includes(l.id)).map((l) => l.id).join(","));
check("every model on disk is advertised, so nothing is shipped unclaimed", onDisk.every((id) => OCR_LANGUAGES.some((l) => l.id === id)), onDisk.filter((id) => !OCR_LANGUAGES.some((l) => l.id === id)).join(","));
check("the advertised download size is the real file size, not a guess", OCR_LANGUAGES.every((l) => statSync(path.join(langDir, `${l.id}.traineddata.gz`)).size === l.modelBytes), OCR_LANGUAGES.filter((l) => statSync(path.join(langDir, `${l.id}.traineddata.gz`)).size !== l.modelBytes).map((l) => `${l.id}: table ${l.modelBytes}, disk ${statSync(path.join(langDir, `${l.id}.traineddata.gz`)).size}`).join("; "));
check("the language list has no duplicate ids", new Set(OCR_LANGUAGES.map((l) => l.id)).size === OCR_LANGUAGES.length);
check("the default language is one of the advertised languages", isSupportedLanguage(DEFAULT_LANGUAGE));
check("an unknown language id is not supported", !isSupportedLanguage("klingon") && !isSupportedLanguage("") && !isSupportedLanguage("ENG"));
check("a language falls back to a real label rather than printing the raw id", languageLabel("klingon") === OCR_LANGUAGES[0].label && languageLabel("deu") === "German");
check("each language declares the script it is for", OCR_LANGUAGES.every((l) => typeof l.script === "string" && l.script.length > 2));
check("the marketing copy names the same twelve languages", OCR_LANGUAGES.every((l) => CONTENT.includes(l.label) && SEO.includes(l.label)), OCR_LANGUAGES.filter((l) => !CONTENT.includes(l.label)).map((l) => l.label).join(","));
check("the model size label is a real formatted size", modelSizeLabel("eng") === "2.8 MB" && modelSizeLabel("fra") === "690.8 KB", modelSizeLabel("eng") + "/" + modelSizeLabel("fra"));

// ---- 11. the copy cannot state a cap, format or language the module denies ----

check("the registry description does not promise accuracy the engine cannot give", !/accurat|reliable|flawless|perfect|all text|every text/i.test(TOOLS.split("slug: \"image-ocr\"")[1]?.split("category:")[0] ?? ""));
check("the long description no longer claims to find 'all readable text'", !/identify and extract all readable text/i.test(CONTENT));
check("the long description no longer claims the tool is 'accurate'", !/provides fast, private, and accurate/i.test(CONTENT));
check("the old 'no upload limits' promise is gone", !/no upload limits/i.test(CONTENT));
check("the feature list names exactly the formats the parser accepts", ["PNG", "JPEG", "GIF", "WebP", "BMP"].every((f) => CONTENT.includes(f)));
check("the feature list states the three caps with the module's own numbers", [FILE_SIZE_LABEL, PIXEL_BUDGET_LABEL, SIDE_LIMIT_LABEL].every((v) => CONTENT.includes(v)));
check("the copy states the image is never uploaded", /never uploaded|never leaves/i.test(CONTENT) && /never uploaded/i.test(COMPONENT));
check("the copy names the engine's own confidence as the engine's opinion", /recognizer's own score for its guesses|opinion of its own guesses/i.test(CONTENT));
check("the copy discloses the engine downsampling large photos", /downsampl/i.test(CONTENT) && /downsampl/i.test(GUIDES));
check("the copy discloses that EXIF rotation is not applied", /EXIF rotation is not applied/i.test(CONTENT) && /EXIF rotation is not applied/i.test(GUIDES));
check("the copy does not promise handwriting accuracy", !/handwriting.{0,40}(works|supported|accurate)/i.test(CONTENT));
check("the guide is registered against this tool", /slug: "how-to-ocr-an-image"[\s\S]{0,900}?toolSlug: "image-ocr"/.test(GUIDES));
check("the guide is in the same list the sitemap is built from", GUIDES.includes('toolSlug: "image-ocr"'));

// ---- 12. the component keeps the promises the copy makes ----

check("the engine is behind a dynamic import, so first paint never pulls wasm", COMPONENT.includes('await import("./ocr-engine")') && !/^import .*tesseract/m.test(COMPONENT));
check("the component passes the File itself, not a copied byte array", COMPONENT.includes("image: image.file") && /image: File/.test(ENGINE));
check("the byte cap is checked before the file is read at all", COMPONENT.indexOf("file.size > MAX_FILE_BYTES") < COMPONENT.indexOf("file.arrayBuffer()"));
check("the preflight runs on the bytes that will be recognized", COMPONENT.includes("preflightImage(bytes, file.name)"));
check("the component imports the caps rather than restating them", COMPONENT.includes("MAX_FILE_BYTES") && !/25\s*MB/.test(COMPONENT));
check("the component surfaces refusals as alerts", COMPONENT.includes('role="alert"'));
check("the component exposes progress and result to assistive tech", (COMPONENT.match(/role="status"/g) ?? []).length >= 2 && COMPONENT.includes("aria-busy={busy}"));
check("the component guards async work with a runId", COMPONENT.includes("runIdRef") && /if \(runId !== runIdRef\.current\) return;/.test(COMPONENT) && /if \(!ocr \|\| runId !== runIdRef\.current\) return;/.test(COMPONENT));
check("a cancelled run cannot write a result", COMPONENT.includes("const terminate = terminateRef.current") && COMPONENT.includes("void terminate?.()"));
check("the worker is terminated in a finally, not only on success", /finally \{[\s\S]{0,120}worker\.terminate\(\)/.test(ENGINE));
check("the object URL is released on clear and on unmount", COMPONENT.includes("URL.revokeObjectURL") && COMPONENT.includes("useEffect(() => releaseUrl, [])"));
check("the engine is asked to terminate the worker as soon as it exists", ENGINE.includes("onWorker(") && ENGINE.includes("worker.terminate()"));
check("the component labels the file input and the language select", COMPONENT.includes("htmlFor={fileInputId}") && COMPONENT.includes("htmlFor={langId}") && COMPONENT.includes("aria-label=\"Choose an image to read text from\""));
check("the language select is described by the model-size note", COMPONENT.includes("aria-describedby={langNoteId}"));
check("the result region has an accessible name", COMPONENT.includes("aria-label=\"Extracted text result\""));
check("the copy button has a distinct accessible name", COMPONENT.includes('ariaLabel="Copy the extracted text"'));
check("an empty result is reported, not silently blank", COMPONENT.includes("No text was recognized") && COMPONENT.includes("Nothing read"));
check("the component states what OCR is and where it fails", /Tesseract, an open-source engine\s+that guesses/.test(COMPONENT) && /handwriting/.test(COMPONENT) && /EXIF/.test(COMPONENT));
check("the component says the caps are refusals, not adjustments", /refused with its real numbers rather than cropped or/.test(COMPONENT));
check("the component's cap text is derived from the module", COMPONENT.includes("FILE_SIZE_LABEL") && COMPONENT.includes("PIXEL_BUDGET_LABEL") && COMPONENT.includes("SIDE_LIMIT_LABEL"));
check("an empty alt on the preview would be a gap; it is descriptive", /alt=\{`Preview of/.test(COMPONENT));

// ---- 13. the engine is self-hosted on every path, with no CDN fallback ----

check("the worker is served from this origin", OCR_WORKER_PATH === "/ocr/worker.min.js" && statSync("public" + OCR_WORKER_PATH).size > 0);
check("the wasm core is served from this origin", OCR_CORE_PATH === "/ocr/" && readdirSync("public/ocr").some((f) => f.startsWith("tesseract-core") && f.endsWith(".js")));
check("the language models are served from this origin", OCR_LANG_PATH === "/ocr/traineddata/");
check("the engine passes all three paths to the worker factory", ENGINE.includes("workerPath: OCR_WORKER_PATH") && ENGINE.includes("corePath: OCR_CORE_PATH") && ENGINE.includes("langPath: OCR_LANG_PATH"));
check("no CDN host appears anywhere in the tool's source", ![COMPONENT, ENGINE].some((s) => /jsdelivr|unpkg|cdnjs|googleapis\.com\/.*tesseract/i.test(s)));
check("tesseract's default jsDelivr paths are not left in place", !/cdn|tessdata\.jsdelivr/.test(ENGINE));
check("the only dependency the tool loads at runtime is tesseract.js", [...ENGINE.matchAll(/from\s+"([^"]+)"/g)].every((m) => m[1] === "./ocr-format"));
check("the engine requests LSTM-only, so it does not pay for the legacy model", ENGINE.includes("const OEM_LSTM_ONLY = 1") && ENGINE.includes("OEM_LSTM_ONLY"));
check("tesseract.js is a real dependency of this project", JSON.parse(readFileSync("package.json", "utf8")).dependencies?.["tesseract.js"] === "^7.0.0");

// ---- 14. the real engine, on a real PNG, with the real self-hosted model ----

/** A PNG encoder, so the fixture under test is a genuine image file. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, gray) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) raw[y * (width + 1) + 1 + x] = gray[y * width + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Rasterizes real glyph outlines with the fontkit that ships with this repo, by
 * flattening each glyph and scanline-filling it. A hand-drawn 5x7 bitmap was
 * tried first and the recognizer returned nonsense for it, which says more about
 * OCR than about this check — so the fixture uses a font the engine has seen.
 */
function renderText(text, sizePx) {
  const fontkit = require("@pdf-lib/fontkit");
  const font = fontkit.create(readFileSync("node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"));
  const run = font.layout(text);
  const scale = sizePx / font.unitsPerEm;
  const polys = [];
  let pen = 0;
  const trace = (path) => {
    const pts = [];
    let cx = 0, cy = 0, sx = 0, sy = 0;
    const line = (x, y) => pts.push([x, y]);
    const curve = (n, f) => {
      for (let i = 1; i <= n; i += 1) f(i / n, line);
    };
    for (const c of path.commands) {
      const a = c.args;
      if (c.command === "moveTo") { cx = sx = a[0]; cy = sy = a[1]; line(cx, cy); }
      else if (c.command === "lineTo") { cx = a[0]; cy = a[1]; line(cx, cy); }
      else if (c.command === "quadraticCurveTo") {
        const x0 = cx, y0 = cy;
        curve(16, (t, push) => { const m = 1 - t; push(m * m * x0 + 2 * m * t * a[0] + t * t * a[2], m * m * y0 + 2 * m * t * a[1] + t * t * a[3]); });
        cx = a[2]; cy = a[3];
      } else if (c.command === "bezierCurveTo") {
        const x0 = cx, y0 = cy;
        curve(16, (t, push) => { const m = 1 - t; push(m ** 3 * x0 + 3 * m * m * t * a[0] + 3 * m * t * t * a[2] + t ** 3 * a[4], m ** 3 * y0 + 3 * m * m * t * a[1] + 3 * m * t * t * a[3] + t ** 3 * a[5]); });
        cx = a[4]; cy = a[5];
      } else if (c.command === "closePath") { line(sx, sy); cx = sx; cy = sy; }
    }
    return pts;
  };
  for (let i = 0; i < run.glyphs.length; i += 1) {
    const g = run.glyphs[i];
    const pos = run.positions[i] ?? {};
    const dx = pen + (pos.xOffset ?? 0);
    const dy = pos.yOffset ?? 0;
    pen += pos.xAdvance ?? 0;
    if (!g.path) continue;
    polys.push(trace(g.path).map(([x, y]) => [(x + dx) * scale, -(y + dy) * scale]));
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pad = Math.round(sizePx * 0.6);
  const w = Math.ceil(maxX - minX) + pad * 2;
  const h = Math.ceil(maxY - minY) + pad * 2;
  const gray = new Uint8Array(w * h).fill(255);
  const edges = [];
  for (const p of polys) for (let i = 0; i < p.length; i += 1) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    const ax = x1 - minX + pad, ay = y1 - minY + pad;
    const bx = x2 - minX + pad, by = y2 - minY + pad;
    if (ay !== by) edges.push([ax, ay, bx, by]);
  }
  for (let y = 0; y < h; y += 1) {
    const sy = y + 0.5;
    const xs = [];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil(xs[i] - 0.5));
      const to = Math.min(w - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = from; x <= to; x += 1) gray[y * w + x] = 0;
    }
  }
  return { w, h, gray };
}

const OCR_WORD = "INVOICE";
const fixture = renderText(OCR_WORD, 96);
const fixturePng = encodePng(fixture.w, fixture.h, fixture.gray);
check("the rendered fixture is a PNG the tool would accept", (() => { const r = preflightImage(fixturePng, "invoice.png"); return r.ok && r.label === "PNG" && r.width === fixture.w; })(), `preflight said ${JSON.stringify(preflightImage(fixturePng, "invoice.png"))}`);
check("the fixture's own header reports the same size twice", (() => { const a = readImageSize(fixturePng, "png"); return a.width === fixture.w && a.height === fixture.h; })());

const langDirTmp = mkdtempSync(path.join(tmpdir(), "image-ocr-audit-"));
try {
  const model = readFileSync(path.join(langDir, "eng.traineddata.gz"));
  const trained = gunzipSync(model);
  check("the shipped English model is a real traineddata, not a stub", trained.length > 5_000_000 && trained.length > model.length && trained.readInt32LE(0) === 24, `gz ${model.length} bytes -> ${trained.length} bytes`);
  writeFileSync(path.join(langDirTmp, "eng.traineddata"), trained);

  const Tesseract = require("tesseract.js");
  const seen = [];
  const worker = await Tesseract.createWorker("eng", 1, {
    langPath: langDirTmp,
    gzip: false,
    logger: (m) => seen.push(m.status),
  });
  try {
    const { data } = await worker.recognize(fixturePng);
    const text = normalizeOcrText(data.text);
    check("the real engine reads the word rendered into the fixture", text.replace(/\s+/g, "").toUpperCase() === OCR_WORD, `engine returned ${JSON.stringify(data.text)}`);
    check("the engine's own confidence is a real number in range", Number.isFinite(data.confidence) && data.confidence > 0 && data.confidence <= 100, String(data.confidence));
    check("a clean fixture lands in a band the copy calls plausible", confidenceBand(data.confidence) !== "low", `${data.confidence} -> ${confidenceBand(data.confidence)}`);
    check("the cleaned text stats the engine's own output", textStats(text).words === 1 && textStats(text).chars === OCR_WORD.length, JSON.stringify(textStats(text)));
    check("the engine emitted the statuses the progress mapper declares", seen.some((s) => s === "recognizing text") && ENGINE_PROGRESS_STATUSES.every((s) => seen.includes(s)), seen.join(" | "));
    check("every status the engine actually sent is one the mapper knows", seen.every((s) => ENGINE_PROGRESS_STATUSES.includes(s)), [...new Set(seen)].filter((s) => !ENGINE_PROGRESS_STATUSES.includes(s)).join(","));
  } finally {
    await worker.terminate();
  }
} catch (err) {
  check("the real engine could be run against the self-hosted model", false, String(err && err.message ? err.message : err));
} finally {
  rmSync(langDirTmp, { recursive: true, force: true });
}

rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
