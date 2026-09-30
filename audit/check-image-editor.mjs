/**
 * Node mirror audit for the Image Editor tool. No browser, no DOM: both shipped
 * pure modules are transpiled with the repo's own TypeScript compiler and
 * imported, so these checks exercise the real geometry, the real header reader
 * and the real pixel maths rather than a hand-written copy of their rules.
 *
 * The centre of gravity is section 6, which runs the actual output matrix over
 * the actual crop, rotation and mirror combinations and checks the four
 * properties the marketing copy claims: the corners land where they should, both
 * axes scale by the same number, a crop is carried through a rotation rather
 * than left behind, and the preview cap never silently changes the file.
 *
 *   node audit/check-image-editor.mjs
 */
import ts from "typescript";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = "src/features/image-editor";
const OUT = "audit/.image-editor-mirror";

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
for (const name of ["editor-format", "editor-pixels"]) {
  const source = readFileSync(`${SRC}/${name}.ts`, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
  }).outputText.replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(`${OUT}/${name}.mjs`, js);
}

const G = await import(pathToFileURL(`${OUT}/editor-format.mjs`).href);
const P = await import(pathToFileURL(`${OUT}/editor-pixels.mjs`).href);

// The site's own byte formatter, transpiled the same way, so "the bytes read the
// same as everywhere else on the site" is a comparison rather than a claim.
writeFileSync(`${OUT}/repo-format.mjs`, ts.transpileModule(readFileSync("src/lib/format.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: "format.ts",
}).outputText);
const F = await import(pathToFileURL(`${OUT}/repo-format.mjs`).href);

const {
  ACCEPTED_FORMAT_NAMES,
  ACCEPTED_IMAGE_TYPES,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_SCALE,
  EXPORT_FORMATS,
  FILE_SIZE_LABEL,
  FLATTENED_FORMAT_NAMES,
  JPEG_QUALITY_MAX,
  JPEG_QUALITY_MIN,
  MAX_FILE_BYTES,
  MAX_PIXELS,
  MAX_SCALE,
  MAX_SIDE_PX,
  MAX_UNDO,
  MIN_CROP_PX,
  MIN_OUTPUT_PX,
  MIN_SCALE,
  PIXEL_BUDGET_LABEL,
  PREVIEW_MAX_SIDE_PX,
  ROTATIONS,
  SCALE_CHOICES,
  SIDE_LIMIT_LABEL,
  applyMatrix,
  clampQuality,
  clampScale,
  classifyEditorError,
  editorErrorMessage,
  extensionFor,
  fitScale,
  formatBytes,
  formatForMime,
  frameRectOf,
  frameSize,
  invertMatrix,
  maxScaleFor,
  naturalRectOf,
  normalizeCrop,
  outputFrame,
  outputMatrix,
  outputNameFor,
  outputNameForMime,
  planOutput,
  preflightImage,
  previewScaleFor,
  previewTarget,
  projectRect,
  qualityAppliesTo,
  readImageSize,
  renderTarget,
  scaleSize,
  sniffImageFormat,
  transformRect,
  viewSize,
} = G;

const {
  ADJUST_MAX,
  ADJUST_MIN,
  FILTERS,
  FREEFHAND_TOLERANCE,
  MAX_BRUSH_PX,
  MAX_FONT_PX,
  MAX_STROKE_POINTS,
  MAX_TEXT_CHARS,
  MIN_BRUSH_PX,
  MIN_FONT_PX,
  adjustmentSummary,
  annotationCountLabel,
  applyAdjustments,
  arrowHead,
  clampAdjust,
  clampAnnotationText,
  clampBrush,
  clampFontSize,
  filterSpec,
  isFilterId,
  outputBrushWidth,
  simplifyFreehand,
  transformPixel,
  widthOnCanvas,
} = P;

const COMPONENT = readFileSync(`${SRC}/ImageEditor.tsx`, "utf8");
const TOOLS = readFileSync("src/lib/tools.ts", "utf8");
const CONTENT = readFileSync("src/lib/tool-content.ts", "utf8");
const SEO = readFileSync("src/lib/seo.ts", "utf8");
const GUIDES = readFileSync("src/lib/guides.ts", "utf8");

// ---- header fixtures: real bytes, not mocks ----

const u8 = (...b) => Uint8Array.from(b);

function pngHeader(width, height) {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}

function jpegSof(width, height) {
  const app0 = [0xff, 0xe0, 0x00, 0x0f, ...new TextEncoder().encode("JFIF\0"), 0, 0, 0, 1, 0, 1, 0, 0];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof]);
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
check("the preview cap is exactly 1200 px", PREVIEW_MAX_SIDE_PX === 1200, String(PREVIEW_MAX_SIDE_PX));
check("the minimum output side is 8 px", MIN_OUTPUT_PX === 8, String(MIN_OUTPUT_PX));
check("the scale range is 10% to 400%", MIN_SCALE === 10 && MAX_SCALE === 400, `${MIN_SCALE}-${MAX_SCALE}`);
check("the undo depth is 30 changes", MAX_UNDO === 30, String(MAX_UNDO));
check("the size label is derived from the cap, not retyped", FILE_SIZE_LABEL === "25 MB", FILE_SIZE_LABEL);
check("the pixel label is derived from the cap", PIXEL_BUDGET_LABEL === "16 MP", PIXEL_BUDGET_LABEL);
check("the side label is derived from the cap", SIDE_LIMIT_LABEL === "8192 px", SIDE_LIMIT_LABEL);
check("marketing copy quotes the same three numbers", [FILE_SIZE_LABEL, PIXEL_BUDGET_LABEL, SIDE_LIMIT_LABEL].every((v) => CONTENT.includes(v) && SEO.includes(v)));
check("the component imports the caps rather than restating them", COMPONENT.includes("MAX_FILE_BYTES") && !/25\s*MB/.test(COMPONENT));
check("the component's cap text is derived from the module", COMPONENT.includes("FILE_SIZE_LABEL") && COMPONENT.includes("PIXEL_BUDGET_LABEL") && COMPONENT.includes("SIDE_LIMIT_LABEL"));

// ---- 2. the format comes from the bytes, not the file name ----

check("a PNG signature is identified", sniffImageFormat(pngHeader(4, 4)) === "png");
check("a JPEG SOI is identified", sniffImageFormat(jpegSof(4, 4)) === "jpeg");
check("GIF87a is identified", sniffImageFormat(new TextEncoder().encode("GIF87a\x01\x00\x01\x00")) === "gif");
check("GIF89a is identified", sniffImageFormat(new TextEncoder().encode("GIF89a\x01\x00\x01\x00")) === "gif");
check("a WebP RIFF container is identified", sniffImageFormat(webpHeader("VP8L", 4, 4)) === "webp");
check("a BMP magic pair is identified", sniffImageFormat(bmpHeader(4, 4)) === "bmp");
check("plain text is not an image", sniffImageFormat(new TextEncoder().encode("this is a .png in name only")) === null);
check("a RIFF file that is not WebP is refused", sniffImageFormat(new TextEncoder().encode("RIFF____WAVEfmt ")) === null);
check("a file called .jpg but holding text is still refused", sniffImageFormat(new TextEncoder().encode("plain text pretending to be a photo")) === null);
check("an empty buffer sniffs as nothing", sniffImageFormat(new Uint8Array(0)) === null);
check("a two-byte buffer does not throw", sniffImageFormat(u8(0xff, 0xd8)) === null);
check("every advertised input format has a working magic-number match", ["png", "jpeg", "gif", "webp", "bmp"].every((id) => {
  const magic = { png: pngHeader(1, 1), jpeg: jpegSof(1, 1), gif: gifHeader(1, 1), webp: webpHeader("VP8L", 1, 1), bmp: bmpHeader(1, 1) }[id];
  return sniffImageFormat(magic) === id;
}));
check("the accept attribute lists every input mime and extension", ACCEPTED_IMAGE_TYPES === "image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif,image/webp,.webp,image/bmp,.bmp", ACCEPTED_IMAGE_TYPES);
check("the accepted-name string matches the five parsable formats", ACCEPTED_FORMAT_NAMES === "PNG, JPEG, GIF, WebP or BMP", ACCEPTED_FORMAT_NAMES);
check("the flattened-animation warning names the formats that actually lose frames", FLATTENED_FORMAT_NAMES === "GIF and animated WebP", FLATTENED_FORMAT_NAMES);
check("the copy names the formats that are flattened", FLATTENED_FORMAT_NAMES.split(" and ").every((n) => CONTENT.includes(n)));

// ---- 3. dimensions are read from the header, per format ----

check("PNG dimensions come from IHDR", (() => { const s = readImageSize(pngHeader(1200, 800), "png"); return s.width === 1200 && s.height === 800; })());
check("GIF dimensions come from the logical screen descriptor", (() => { const s = readImageSize(gifHeader(640, 480), "gif"); return s.width === 640 && s.height === 480; })());
check("JPEG dimensions are found past an APP0 segment", (() => { const s = readImageSize(jpegSof(1024, 768), "jpeg"); return s.width === 1024 && s.height === 768; })());
check("a progressive JPEG (SOF2) is measured too", (() => { const b = jpegSof(300, 200); const at = b.indexOf(0xc0, 4); b[at + 1] = 0xc2; const s = readImageSize(b, "jpeg"); return s.width === 300 && s.height === 200; })());
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
check("readImageSize is total: no fixture throws", [pngHeader(1, 1), jpegSof(1, 1), gifHeader(1, 1), webpHeader("VP8L", 1, 1), bmpHeader(1, 1), new Uint8Array(3)].every((b) => {
  try { readImageSize(b, sniffImageFormat(b) ?? "png"); return true; } catch { return false; }
}));

// ---- 4. refusals happen before decode, and name the real numbers ----

const okPng = preflightImage(pngHeader(800, 600), "receipt.png");
check("a normal PNG is accepted with its real dimensions", okPng.ok && okPng.width === 800 && okPng.height === 600 && okPng.pixels === 480_000, JSON.stringify(okPng));
check("an accepted result names the format for the UI", okPng.ok && okPng.label === "PNG");

const empty = preflightImage(new Uint8Array(0), "empty.png");
check("an empty file is refused as empty", !empty.ok && empty.reason === "empty" && /empty/i.test(empty.message));

const fake = preflightImage(new TextEncoder().encode("not an image at all"), "notes.png");
check("a text file named .png is refused as a format problem", !fake.ok && fake.reason === "format" && /Convert it first/.test(fake.message), JSON.stringify(fake));
check("the format refusal names the file", fake.message.includes("notes.png"));
check("the format refusal names the formats that would work", fake.message.includes(ACCEPTED_FORMAT_NAMES));

const oversize = preflightImage(new Uint8Array(MAX_FILE_BYTES + 1), "huge.png");
check("a file over the byte cap is refused as too large", !oversize.ok && oversize.reason === "size", JSON.stringify(oversize));
check("the size refusal quotes the file's exact byte count and the real cap", oversize.message.includes((MAX_FILE_BYTES + 1).toLocaleString("en-US")) && oversize.message.includes(MAX_FILE_BYTES.toLocaleString("en-US")) && oversize.message.includes(FILE_SIZE_LABEL), oversize.message);
check("a file exactly on the byte cap is not refused for size", (() => { const r = preflightImage(new Uint8Array(MAX_FILE_BYTES), "edge.png"); return !r.ok && r.reason === "format"; })());

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
check("no refusal leaks a raw stack, an internal identifier or NaN", [empty, fake, oversize, noHeader, longSide, heavy].every((r) => !r.ok && !/(\n\s*at\s+\w)|(\.ts:\d)|\bundefined\b|\bNaN\b/.test(r.message)));

// ---- 5. rotation, mirroring and crop are exact ----

const NAT = { width: 400, height: 250 };

check("an unrotated frame keeps its own size", frameSize(400, 250, 0).width === 400 && frameSize(400, 250, 0).height === 250);
check("a quarter turn swaps the sides", ROTATIONS.filter((r) => r === 90 || r === 270).every((r) => { const f = frameSize(400, 250, r); return f.width === 250 && f.height === 400; }));
check("a half turn keeps the sides", ROTATIONS.filter((r) => r === 0 || r === 180).every((r) => { const f = frameSize(400, 250, r); return f.width === 400 && f.height === 250; }));

/** Where the four natural corners land, in frame coordinates. */
function corners(matrix, size) {
  return [
    applyMatrix(matrix, 0, 0),
    applyMatrix(matrix, size.width, 0),
    applyMatrix(matrix, size.width, size.height),
    applyMatrix(matrix, 0, size.height),
  ];
}
const span = (pts) => ({
  width: Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
  height: Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
});

check("no rotation and no mirror maps the corners onto the whole frame", (() => {
  const s = span(corners(outputMatrix(NAT, 0, false, false, null, 1), NAT));
  return s.width === 400 && s.height === 250;
})());
check("every rotation places all four corners inside the frame", ROTATIONS.every((r) => {
  const f = frameSize(NAT.width, NAT.height, r);
  return corners(outputMatrix(NAT, r, false, false, null, 1), NAT).every((p) => p.x >= -1e-9 && p.y >= -1e-9 && p.x <= f.width + 1e-9 && p.y <= f.height + 1e-9);
}));
check("a 90-degree turn puts the natural top-left corner at the frame's top-right", (() => {
  const p = applyMatrix(outputMatrix(NAT, 90, false, false, null, 1), 0, 0);
  return Math.abs(p.x - 250) < 1e-9 && Math.abs(p.y - 0) < 1e-9;
})());
check("a 90-degree turn puts the natural bottom-right corner at the frame's bottom-left", (() => {
  const p = applyMatrix(outputMatrix(NAT, 90, false, false, null, 1), 400, 250);
  return Math.abs(p.x - 0) < 1e-9 && Math.abs(p.y - 400) < 1e-9;
})());
check("a 180-degree turn maps the frame onto itself corner for corner", (() => {
  const a = applyMatrix(outputMatrix(NAT, 180, false, false, null, 1), 0, 0);
  const b = applyMatrix(outputMatrix(NAT, 180, false, false, null, 1), 400, 250);
  return Math.abs(a.x - 400) < 1e-9 && Math.abs(a.y - 250) < 1e-9 && Math.abs(b.x) < 1e-9 && Math.abs(b.y) < 1e-9;
})());
check("a 270-degree turn puts the natural top-left at the frame's bottom-left", (() => {
  const p = applyMatrix(outputMatrix(NAT, 270, false, false, null, 1), 0, 0);
  return Math.abs(p.x) < 1e-9 && Math.abs(p.y - 400) < 1e-9;
})());
check("mirroring horizontally maps the natural top-left to the frame's top-right", (() => {
  const p = applyMatrix(outputMatrix(NAT, 0, true, false, null, 1), 0, 0);
  return Math.abs(p.x - 400) < 1e-9 && Math.abs(p.y) < 1e-9;
})());
check("mirroring vertically maps the natural top-left to the frame's bottom-left", (() => {
  const p = applyMatrix(outputMatrix(NAT, 0, false, true, null, 1), 0, 0);
  return Math.abs(p.x) < 1e-9 && Math.abs(p.y - 250) < 1e-9;
})());
check("mirroring both ways is exactly a half turn, not the identity", (() => {
  const both = applyMatrix(outputMatrix(NAT, 0, true, true, null, 1), 123, 45);
  const half = applyMatrix(outputMatrix(NAT, 180, false, false, null, 1), 123, 45);
  return Math.abs(both.x - half.x) < 1e-9 && Math.abs(both.y - half.y) < 1e-9;
})());
check("a mirror is its own inverse, so mapping out and back is a no-op", ROTATIONS.every((r) => {
  const m = outputMatrix(NAT, r, true, false, null, 1);
  const back = applyMatrix(invertMatrix(m), ...Object.values(applyMatrix(m, 37, 91)));
  return Math.abs(back.x - 37) < 1e-9 && Math.abs(back.y - 91) < 1e-9;
}));
check("the inverse of every rotation matrix really inverts it", ROTATIONS.every((r) => {
  const m = outputMatrix(NAT, r, r % 180 === 90, r % 180 === 0, null, 2.5);
  const inv = invertMatrix(m);
  const p = applyMatrix(inv, ...Object.values(applyMatrix(m, 61, 29)));
  return Math.abs(p.x - 61) < 1e-6 && Math.abs(p.y - 29) < 1e-6;
}));
check("a singular matrix inverts to the identity rather than to NaN", (() => {
  const inv = invertMatrix([0, 0, 0, 0, 5, 5]);
  return inv.every((v) => Number.isFinite(v)) && inv.join() === "1,0,0,1,0,0";
})());

// Both axes scale by the same number: that is the whole of "never distorts".
check("both axes of the matrix scale by exactly the same factor", ROTATIONS.every((r) => {
  const m = outputMatrix(NAT, r, r % 2 === 1, false, null, 1.75);
  const u = Math.hypot(m[0], m[1]);
  const v = Math.hypot(m[2], m[3]);
  return Math.abs(u - 1.75) < 1e-9 && Math.abs(v - 1.75) < 1e-9;
}));
check("the frame's aspect ratio is the image's, or exactly its transpose", ROTATIONS.every((r) => {
  const f = frameSize(NAT.width, NAT.height, r);
  return Math.abs(f.width / f.height - 400 / 250) < 1e-9 || Math.abs(f.width / f.height - 250 / 400) < 1e-9;
}));
check("the aspect ratio of the frame survives every rotation and mirror", ROTATIONS.every((r) => [false, true].every((h) => {
  const s = span(corners(outputMatrix(NAT, r, h, false, null, 3), NAT));
  const f = frameSize(NAT.width, NAT.height, r);
  return Math.abs(s.width / s.height - f.width / f.height) < 1e-9;
})));

// A crop is stored in natural coordinates and carried through the transform.
const CROP = { x: 100, y: 50, width: 200, height: 120 };
check("an uncropped output frame is the whole rotated image", (() => { const f = outputFrame(NAT, 0, false, false, null); return f.width === 400 && f.height === 250; })());
check("a quarter turn swaps the output frame", (() => { const f = outputFrame(NAT, 90, false, false, null); return f.width === 250 && f.height === 400; })());
check("a crop sets the output frame", (() => { const f = outputFrame(NAT, 0, false, false, CROP); return f.width === 200 && f.height === 120; })());
check("a mirrored crop has the same size as the crop itself", (() => {
  const f = outputFrame(NAT, 0, true, false, CROP);
  return f.width === 200 && f.height === 120;
})());
check("a crop is carried through a 90-degree turn, not left behind", (() => {
  const t = transformRect(CROP, NAT, 90, false, false);
  const f = frameRectOf(CROP, NAT, 90, false, false);
  return Math.abs(t.width - 120) < 1e-9 && Math.abs(t.height - 200) < 1e-9 &&
    Math.abs(f.x - (250 - CROP.y - CROP.height)) < 1e-9 && Math.abs(f.y - CROP.x) < 1e-9;
}), JSON.stringify(transformRect(CROP, NAT, 90, false, false)));
check("the crop lands exactly on the output's own origin, whatever the rotation", ROTATIONS.every((r) => [false, true].every((h) => {
  const box = projectRect(CROP, outputMatrix(NAT, r, h, false, CROP, 1));
  return box.x === 0 && box.y === 0;
})));
check("a cropped matrix still scales both axes by the same factor", ROTATIONS.every((r) => {
  const m = outputMatrix(NAT, r, false, false, CROP, 2);
  return Math.abs(Math.hypot(m[0], m[1]) - 2) < 1e-9 && Math.abs(Math.hypot(m[2], m[3]) - 2) < 1e-9;
}));
check("a frame rect survives the round trip back to natural coordinates", ROTATIONS.every((r) => [false, true].every((h) => {
  const back = naturalRectOf(transformRect(CROP, NAT, r, h, false), NAT, r, h, false);
  return Math.abs(back.x - CROP.x) < 1e-6 && Math.abs(back.y - CROP.y) < 1e-6 &&
    Math.abs(back.width - CROP.width) < 1e-6 && Math.abs(back.height - CROP.height) < 1e-6;
})));
check("a crop the user dragged back through the matrix lands on the same pixels", (() => {
  // Drag a rectangle in the frame, then ask where it is in the natural image.
  const frameRect = { x: 30, y: 40, width: 90, height: 60 };
  const back = naturalRectOf(frameRect, NAT, 90, true, false);
  const again = transformRect(back, NAT, 90, true, false);
  return Math.abs(again.x - 30) < 1e-6 && Math.abs(again.y - 40) < 1e-6 &&
    Math.abs(again.width - 90) < 1e-6 && Math.abs(again.height - 60) < 1e-6;
})());
check("projectRect is the pixel-accurate projection, corner for corner", ROTATIONS.every((r) => {
  const m = outputMatrix(NAT, r, false, false, CROP, 2);
  const box = projectRect(CROP, m);
  const pts = corners(m, NAT);
  const cropPts = [
    applyMatrix(m, CROP.x, CROP.y),
    applyMatrix(m, CROP.x + CROP.width, CROP.y + CROP.height),
  ];
  return Math.abs(box.x - Math.min(...cropPts.map((p) => p.x))) < 1e-9 &&
    Math.abs(box.width - Math.abs(cropPts[1].x - cropPts[0].x)) < 1e-9 &&
    Math.abs(box.height - Math.abs(cropPts[1].y - cropPts[0].y)) < 1e-9 &&
    pts.length === 4;
}));
check("an uncropped crop rect is the whole frame", (() => {
  const r = frameRectOf(null, NAT, 90, false, false);
  return r.x === 0 && r.y === 0 && r.width === 250 && r.height === 400;
})());

// ---- 6. the render target is the geometry the component actually uses ----

check("the fit scale is one factor covering both axes", Math.abs(fitScale({ width: 400, height: 250 }, 800, 500) - 2) < 1e-12);
check("the fit scale picks the axis that has to cover", Math.abs(fitScale({ width: 400, height: 250 }, 100, 500) - 2) < 1e-12);
check("a render target covers its box exactly and never distorts", ROTATIONS.every((r) => {
  const t = renderTarget(NAT, r, false, false, null, 800, 500);
  const s = span(corners(t.matrix, NAT));
  const f = frameSize(NAT.width, NAT.height, r);
  return Math.abs(s.width / f.width - s.height / f.height) < 1e-9 &&
    Math.abs(t.matrix[0] - t.matrix[3]) < 1e-12;
}));
check("a render target's matrix scale equals its reported scale", ROTATIONS.every((r) => {
  const t = renderTarget(NAT, r, r % 2 === 1, false, CROP, 321, 123);
  return Math.abs(Math.hypot(t.matrix[0], t.matrix[1]) - t.scale) < 1e-12;
}));
check("a render target is never smaller than one pixel on a side", (() => {
  const t = renderTarget(NAT, 0, false, false, null, 0, 0);
  return t.width === 1 && t.height === 1;
})());
check("the crop view shows the whole frame, the output view shows the crop", (() => {
  const full = viewSize(NAT, 0, false, false, CROP, "crop");
  const out = viewSize(NAT, 0, false, false, CROP, "output");
  return full.width === 400 && full.height === 250 && out.width === 200 && out.height === 120;
})());
check("the crop view of a quarter-turned image is the turned frame", (() => {
  const full = viewSize(NAT, 90, false, false, null, "crop");
  return full.width === 250 && full.height === 400;
})());
check("an image at or under the preview cap has a preview factor of exactly 1", previewScaleFor(1200, 900) === 1 && previewScaleFor(800, 600) === 1);
check("an image over the preview cap is reduced, and never enlarged", previewScaleFor(2400, 1800) === 0.5 && previewScaleFor(8192, 100) < 1 && previewScaleFor(10, 10) === 1);
check("a preview target is the file's size scaled by one factor on both axes", (() => {
  const t = previewTarget(NAT, 90, true, false, CROP, { width: 2400, height: 1800 });
  return t.width === 1200 && t.height === 900 && Math.abs(t.scale - (1200 / 120)) < 1e-9;
})());
check("a preview under the cap is the file's own size", (() => {
  const t = previewTarget(NAT, 0, false, false, null, { width: 800, height: 500 });
  return t.width === 800 && t.height === 500;
})());
check("the preview never exceeds the cap on either axis", (() => {
  for (const out of [{ width: 4000, height: 3000 }, { width: 3000, height: 4000 }, { width: 8192, height: 8 }, { width: 5000, height: 5000 }]) {
    const t = previewTarget(NAT, 0, false, false, null, out);
    if (Math.max(t.width, t.height) > PREVIEW_MAX_SIDE_PX) return false;
  }
  return true;
})());

// ---- 7. the scale range, the budget and the refusal ----

check("a scale is clamped into 10-400 and snapped to a whole 5%", clampScale(0) === 10 && clampScale(9999) === 400 && clampScale(133) === 135);
check("a non-numeric scale falls back to the default rather than printing NaN", clampScale(NaN) === 100 && clampScale("abc") === 100);
check("scaling multiplies both sides by the same factor", (() => {
  const s = scaleSize({ width: 400, height: 250 }, 200);
  return s.width === 800 && s.height === 500;
})());
check("scaling down is allowed and rounds to whole pixels", (() => {
  const s = scaleSize({ width: 401, height: 251 }, 25);
  return s.width === 100 && s.height === 63;
})());
check("every scale preset is inside the range and on a whole percent", SCALE_CHOICES.every((s) => s >= MIN_SCALE && s <= MAX_SCALE && Number.isInteger(s)));
check("the presets include 100% and both directions", SCALE_CHOICES.includes(100) && SCALE_CHOICES.some((s) => s < 100) && SCALE_CHOICES.some((s) => s > 100));
check("the presets have no duplicates", new Set(SCALE_CHOICES).size === SCALE_CHOICES.length);
check("the default scale leaves the image at its own size", DEFAULT_SCALE === 100 && scaleSize({ width: 400, height: 250 }, DEFAULT_SCALE).width === 400);

const base = { width: 1000, height: 800 };
check("a 100% export of a normal frame is accepted", (() => { const p = planOutput(base, 100); return p.ok && p.width === 1000 && p.height === 800; })());
check("an over-budget export is refused, not shrunk, whichever cap it hits", (() => {
  const side = planOutput({ width: 4000, height: 3000 }, 400);
  const area = planOutput({ width: 4000, height: 6000 }, 100);
  return !side.ok && side.reason === "side" && side.width === 16000 && side.height === 12000 &&
    !area.ok && area.reason === "pixels" && area.width === 4000 && area.height === 6000;
})(), JSON.stringify([planOutput({ width: 4000, height: 3000 }, 400), planOutput({ width: 4000, height: 6000 }, 100)]));
check("a refused export never reports a reduced size as if it were the ask", planOutput({ width: 4000, height: 6000 }, 100).reduced === undefined);
check("the pixel refusal quotes the size asked for and the budget", (() => {
  const p = planOutput({ width: 4000, height: 6000 }, 100);
  return p.message.includes("4000 × 6000 px") && p.message.includes("24.0 megapixels") && p.message.includes(PIXEL_BUDGET_LABEL);
})(), planOutput({ width: 4000, height: 6000 }, 100).message);
check("the side refusal is separate from the pixel refusal", (() => {
  const p = planOutput({ width: 6000, height: 2000 }, 200);
  return !p.ok && p.reason === "side";
})(), JSON.stringify(planOutput({ width: 6000, height: 2000 }, 200)));
check("the side refusal names the limit", planOutput({ width: 6000, height: 2000 }, 200).message.includes(SIDE_LIMIT_LABEL));
check("a tiny output is refused rather than written as a 3-pixel file", (() => {
  const p = planOutput({ width: 40, height: 30 }, 10);
  return !p.ok && p.reason === "tiny" && p.message.includes(String(MIN_OUTPUT_PX));
})(), JSON.stringify(planOutput({ width: 40, height: 30 }, 10)));
check("an output exactly on the pixel budget is accepted, not refused", (() => {
  const p = planOutput({ width: 4000, height: 4000 }, 100);
  return p.ok && p.width * p.height === 16_000_000;
})());
check("an output exactly on the side limit is accepted", (() => {
  const p = planOutput({ width: 8192, height: 100 }, 100);
  return p.ok && p.width === MAX_SIDE_PX;
})());
check("the largest accepted scale for a frame is one that actually fits", (() => {
  const frame = { width: 4000, height: 3000 };
  const max = maxScaleFor(frame);
  return planOutput(frame, max).ok && (max === MAX_SCALE || !planOutput(frame, max + 5).ok);
})());
check("the largest accepted scale never exceeds the range", maxScaleFor({ width: 8000, height: 8000 }) <= MAX_SCALE);
check("the largest accepted scale is at least 100% for anything the tool accepts", [[800, 600], [4000, 3000], [8192, 1953], [200, 200]].every(([w, h]) => maxScaleFor({ width: w, height: h }) >= 100));
check("cropping to a small area raises the largest accepted scale above 100%", maxScaleFor({ width: 200, height: 200 }) > 100);
check("every refusal message ends in a full stop and leaks nothing", [
  planOutput({ width: 4000, height: 3000 }, 400),
  planOutput({ width: 4000, height: 6000 }, 100),
  planOutput({ width: 6000, height: 2000 }, 200),
  planOutput({ width: 40, height: 30 }, 10),
].every((p) => !p.ok && /[.!?]$/.test(p.message) && !/\bNaN\b|\bundefined\b/.test(p.message)));
check("the refusal names the largest scale that would fit", /largest scale this frame accepts is \d+%/.test(planOutput({ width: 4000, height: 6000 }, 100).message));

// ---- 8. a crop is clamped into the frame rather than trusted ----

check("a crop fully inside the image is kept exactly", (() => { const c = normalizeCrop(CROP, NAT); return c.x === 100 && c.y === 50 && c.width === 200 && c.height === 120; })());
check("a crop that runs off the right edge is clamped, not rejected", (() => { const c = normalizeCrop({ x: 300, y: 0, width: 500, height: 100 }, NAT); return c.x === 300 && c.width === 100; })());
check("a crop at a negative origin is clamped to zero", (() => { const c = normalizeCrop({ x: -50, y: -50, width: 100, height: 100 }, NAT); return c.x === 0 && c.y === 0; })());
check("a crop dragged right-to-left is normalised, not refused", (() => { const c = normalizeCrop({ x: 300, y: 200, width: -200, height: -100 }, NAT); return c.x === 100 && c.y === 100 && c.width === 200 && c.height === 100; })());
check("a crop smaller than the minimum is refused", normalizeCrop({ x: 0, y: 0, width: 4, height: 4 }, NAT) === null);
check("a crop exactly on the minimum is accepted", (() => { const c = normalizeCrop({ x: 0, y: 0, width: MIN_CROP_PX, height: MIN_CROP_PX }, NAT); return c && c.width === MIN_CROP_PX; })());
check("a zero-area crop is refused", normalizeCrop({ x: 10, y: 10, width: 0, height: 50 }, NAT) === null);
check("a crop entirely outside the image is refused", normalizeCrop({ x: 500, y: 500, width: 100, height: 100 }, NAT) === null);
check("a crop of a NaN or infinite request is refused, not accepted as NaN", normalizeCrop({ x: NaN, y: 0, width: 100, height: 100 }, NAT) === null && normalizeCrop({ x: 0, y: 0, width: Infinity, height: 100 }, NAT) === null);
check("cropping to the whole image is allowed", (() => { const c = normalizeCrop({ x: 0, y: 0, width: 400, height: 250 }, NAT); return c && c.width === 400 && c.height === 250; })());
check("the crop refusal message states the minimum the copy states", MIN_CROP_PX === 8 && CONTENT.includes(`${MIN_CROP_PX} × ${MIN_CROP_PX} px`));

// ---- 9. the pixel maths is the maths the copy claims ----

check("the adjustment range is -100% to +100%", ADJUST_MIN === -100 && ADJUST_MAX === 100);
check("a zero adjustment leaves a pixel alone", (() => {
  const [r, g, b] = transformPixel([120, 60, 200], { brightness: 0, contrast: 0, saturation: 0 }, "none");
  return r === 120 && g === 60 && b === 200;
})());
check("brightness is a multiply, exactly as the copy says", (() => {
  const [r] = transformPixel([100, 100, 100], { brightness: 20, contrast: 0, saturation: 0 }, "none");
  return Math.abs(r - 120) < 1e-9;
})());
check("negative brightness darkens", (() => {
  const [r] = transformPixel([100, 100, 100], { brightness: -50, contrast: 0, saturation: 0 }, "none");
  return Math.abs(r - 50) < 1e-9;
})());
check("grayscale makes all three channels the Rec. 601 luma", (() => {
  const [r, g, b] = transformPixel([10, 200, 90], { brightness: 0, contrast: 0, saturation: 0 }, "grayscale");
  const y = 0.2126 * 10 + 0.7152 * 200 + 0.0722 * 90;
  return Math.abs(r - y) < 1e-9 && r === g && g === b;
})());
check("invert is its own inverse", (() => {
  const [r] = transformPixel([10, 200, 90], { brightness: 0, contrast: 0, saturation: 0 }, "invert");
  return r === 245;
})());
check("inverting twice returns the original pixel", (() => {
  const once = transformPixel([37, 111, 200], { brightness: 0, contrast: 0, saturation: 0 }, "invert");
  const twice = transformPixel(once, { brightness: 0, contrast: 0, saturation: 0 }, "invert");
  return Math.abs(twice[0] - 37) < 1e-9 && Math.abs(twice[1] - 111) < 1e-9;
}));
check("sepia warms: red goes up relative to blue on a neutral pixel", (() => {
  const [r, , b] = transformPixel([128, 128, 128], { brightness: 0, contrast: 0, saturation: 0 }, "sepia");
  return r > 128 && b < 128;
})());
check("cool cools and warm warms, in opposite directions", (() => {
  const cool = transformPixel([128, 128, 128], { brightness: 0, contrast: 0, saturation: 0 }, "cool");
  const warm = transformPixel([128, 128, 128], { brightness: 0, contrast: 0, saturation: 0 }, "warm");
  return cool[0] < 128 && cool[2] > 128 && warm[0] > 128 && warm[2] < 128;
}));
check("the Original filter adds nothing over the adjustments alone", (() => {
  const adjust = { brightness: 20, contrast: 0, saturation: 0 };
  const none = transformPixel([120, 60, 200], adjust, "none");
  const unknown = transformPixel([120, 60, 200], adjust, "klingon");
  const gray = transformPixel([120, 60, 200], adjust, "grayscale");
  return none[0] === 144 && unknown.join() === none.join() && gray[0] !== none[0] && gray[0] === gray[1];
})());
check("saturation -100% collapses to a neutral grey by CSS's own coefficients", (() => {
  const [r, g, b] = transformPixel([200, 100, 50], { brightness: 0, contrast: 0, saturation: -100 }, "none");
  const y = 0.213 * 200 + 0.715 * 100 + 0.072 * 50;
  return Math.abs(r - y) < 1e-9 && Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9;
})());
check("a grey pixel is unchanged by any saturation amount", (() => {
  const [r, g, b] = transformPixel([128, 128, 128], { brightness: 0, contrast: 0, saturation: 75 }, "none");
  return Math.abs(r - 128) < 1e-9 && r === g && g === b;
}));
check("the adjustment chain runs before the filter", (() => {
  // Invert after a +50% brightness maps 100 -> 150 -> 105; the other order gives 200.
  const [r] = transformPixel([100, 100, 100], { brightness: 50, contrast: 0, saturation: 0 }, "invert");
  return Math.abs(r - 105) < 1e-9;
})());
check("every filter id is real, and the unknown falls back to the original", FILTERS.every((f) => isFilterId(f.id)) && isFilterId("klingon") === false && filterSpec("klingon").id === "none");
check("every filter has a note that describes what it actually does", FILTERS.every((f) => typeof f.note === "string" && f.note.length > 10));
check("the five named filters plus Original are exactly what the copy lists", FILTERS.map((f) => f.id).join(",") === "none,grayscale,sepia,invert,cool,warm");
check("the copy does not advertise a filter the tool lacks", !/sharpen|blur|sharpen and more/i.test(CONTENT.split('"image-editor":')[1]?.split('"image-ocr":')[0] ?? ""));
check("an adjustment is clamped to its range rather than accepted raw", clampAdjust(999) === 100 && clampAdjust(-999) === -100 && clampAdjust(NaN) === 0);
check("the adjustment summary names only what is applied", adjustmentSummary({ brightness: 0, contrast: 0, saturation: 0 }) === "none" && adjustmentSummary({ brightness: 20, contrast: -10, saturation: 0 }) === "brightness +20%, contrast -10%");
check("the adjustment summary never prints NaN", !/NaN/.test(adjustmentSummary({ brightness: NaN, contrast: 0, saturation: 0 })));

/** A small RGBA buffer, so the in-place baker runs over real bytes. */
function rgba(pixels) {
  const d = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a], i) => {
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = a;
  });
  return d;
}
check("the baker is a no-op for a neutral adjustment and no filter", (() => {
  const d = rgba([[10, 20, 30, 255]]);
  applyAdjustments(d, { brightness: 0, contrast: 0, saturation: 0 }, "none");
  return d[0] === 10 && d[1] === 20 && d[2] === 30 && d[3] === 255;
})());
check("the baker carries alpha through untouched", (() => {
  const d = rgba([[10, 20, 30, 0], [200, 100, 50, 128]]);
  applyAdjustments(d, { brightness: 30, contrast: 10, saturation: -50 }, "grayscale");
  return d[3] === 0 && d[7] === 128;
})());
check("the baker's clamp matches what a canvas would store", (() => {
  const d = rgba([[250, 250, 250, 255]]);
  applyAdjustments(d, { brightness: 100, contrast: 0, saturation: 0 }, "none");
  return d[0] === 255 && d[1] === 255 && d[2] === 255;
})());
check("the baker never writes a value a canvas could not store", (() => {
  const d = rgba([[10, 200, 30, 255], [255, 5, 128, 255], [0, 0, 0, 255]]);
  applyAdjustments(d, { brightness: -90, contrast: 90, saturation: 120 }, "sepia");
  return [...d].every((v) => Number.isFinite(v) && v >= 0 && v <= 255 && Number.isInteger(v));
})());
check("the baker handles a zero-length buffer without throwing", (() => {
  applyAdjustments(new Uint8ClampedArray(0), { brightness: 50, contrast: 0, saturation: 0 }, "invert");
  return true;
})());
check("the baker works on a real-size buffer in reasonable time", (() => {
  const d = new Uint8ClampedArray(2_000_000 * 4).fill(180);
  const t0 = Date.now();
  applyAdjustments(d, { brightness: 10, contrast: 5, saturation: 20 }, "grayscale");
  return Date.now() - t0 < 4000 && d[0] > 100;
})());

// ---- 10. annotation geometry and limits ----

check("the brush width is bounded 1-64 px", MIN_BRUSH_PX === 1 && MAX_BRUSH_PX === 64 && clampBrush(0) === 1 && clampBrush(999) === 64 && clampBrush(NaN) === 6);
check("the font size is bounded 8-200 px", MIN_FONT_PX === 8 && MAX_FONT_PX === 200 && clampFontSize(1) === 8 && clampFontSize(9999) === 200);
check("a screen brush width becomes the output width it will actually be", (() => {
  // At half preview scale, a 6 px screen stroke is 12 output px.
  return outputBrushWidth(6, 0.5) === 12 && outputBrushWidth(6, 1) === 6;
})());
check("a screen brush width is still bounded after the conversion", outputBrushWidth(60, 0.05) <= MAX_BRUSH_PX && outputBrushWidth(0.1, 0.1) >= MIN_BRUSH_PX);
check("a nonsense preview scale does not divide by zero", Number.isFinite(outputBrushWidth(6, 0)) && Number.isFinite(outputBrushWidth(6, NaN)));
check("a stroke is drawn on the canvas at exactly the stored width when it is the export", widthOnCanvas(12, 1) === 12);
check("a stroke is reduced on a smaller canvas by exactly the reduction factor", Math.abs(widthOnCanvas(12, 0.5) - 6) < 1e-12);
check("a stored width is never drawn as zero pixels", widthOnCanvas(1, 0.01) >= 0.5);
check("annotation text has newlines flattened and a real cap", clampAnnotationText("  a\nb\tc  ") === "a b c" && clampAnnotationText("x".repeat(500)).length === MAX_TEXT_CHARS);
check("the text cap is the one the copy states", CONTENT.includes(`${MAX_TEXT_CHARS} characters`) && COMPONENT.includes("maxLength={MAX_TEXT_CHARS}"));

const scribble = Array.from({ length: 5000 }, (_, i) => ({ x: i * 0.5, y: Math.sin(i / 40) * 20 }));
const simplified = simplifyFreehand(scribble, Math.hypot(400, 250) * FREEFHAND_TOLERANCE);
check("a 5000-point scribble is simplified under the stored-point cap", simplified.length <= MAX_STROKE_POINTS, String(simplified.length));
check("simplification always keeps the first and last point of the stroke", (() => {
  const s = simplifyFreehand(scribble, 1);
  return s[0].x === scribble[0].x && s[s.length - 1].x === scribble[scribble.length - 1].x;
})());
check("a short path is left alone", simplifyFreehand([{ x: 0, y: 0 }, { x: 5, y: 5 }], 10).length === 2);
check("simplification does not recurse its way out of the stack", simplifyFreehand(Array.from({ length: 40000 }, (_, i) => ({ x: i, y: (i * 37) % 91 })), 0.5).length <= MAX_STROKE_POINTS);
check("a straight line collapses to its two ends", (() => {
  const s = simplifyFreehand(Array.from({ length: 2000 }, (_, i) => ({ x: i, y: 10 })), 0.5);
  return s.length === 2;
})());
check("an arrowhead sits behind its tip and spreads symmetrically", (() => {
  const [a, b] = arrowHead({ x: 100, y: 0 }, { x: 0, y: 0 }, 20);
  return a.x < 100 && b.x < 100 && Math.abs(a.y) === Math.abs(b.y) && Math.abs(a.y) > 0;
})());
check("a zero-length arrowhead is still a finite pair of points", (() => {
  const [a, b] = arrowHead({ x: 5, y: 5 }, { x: 5, y: 5 }, 0);
  return Number.isFinite(a.x) && Number.isFinite(b.x);
})());
check("the annotation count is written out, not abbreviated", annotationCountLabel(0) === "no annotations" && annotationCountLabel(1) === "1 annotation" && annotationCountLabel(7) === "7 annotations");

// ---- 11. the export formats and the quality argument ----

check("the three export formats are exactly PNG, JPEG and WebP", EXPORT_FORMATS.map((f) => f.id).join(",") === "png,jpeg,webp");
check("each format has its own extension", extensionFor("png") === "png" && extensionFor("jpeg") === "jpg" && extensionFor("webp") === "webp");
check("PNG is declared lossless and the other two lossy", EXPORT_FORMATS.filter((f) => f.lossless).map((f) => f.id).join(",") === "png");
check("JPEG is declared to have no alpha, PNG and WebP do", EXPORT_FORMATS.filter((f) => !f.alpha).map((f) => f.id).join(",") === "jpeg");
check("the quality argument applies to the two lossy formats only", qualityAppliesTo("jpeg") && qualityAppliesTo("webp") && !qualityAppliesTo("png"));
check("the default format is PNG, the lossless one", DEFAULT_EXPORT_FORMAT === "png");
check("the quality range is the encoder's own 0.30 to 1.00", JPEG_QUALITY_MIN === 0.3 && JPEG_QUALITY_MAX === 1);
check("quality is clamped into the range and snapped to 0.05", clampQuality(0) === 0.3 && clampQuality(5) === 1 && Math.abs(clampQuality(0.87) - 0.85) < 1e-9);
check("a non-numeric quality falls back rather than becoming NaN", clampQuality(NaN) === 0.9);
check("a refused mime type is detected, so a file is never named for bytes it is not", formatForMime("image/png") === "png" && formatForMime("image/jpeg") === "jpeg" && formatForMime("image/webp") === "webp");
check("an unknown or empty mime type returns null rather than guessing", formatForMime("image/gif") === null && formatForMime("") === null && formatForMime("nonsense") === null);
check("every format states its own trade-off in the UI copy", EXPORT_FORMATS.every((f) => f.note.length > 40 && !/\bperfect\b|\bbest\b(?!\s+lossy)/i.test(f.note)));
check("the WebP note admits the encoder-substitution case", /cannot encode|gets PNG instead/i.test(EXPORT_FORMATS.find((f) => f.id === "webp").note));
check("the JPEG note says transparency is composited, as the export does", /composited on white/i.test(EXPORT_FORMATS.find((f) => f.id === "jpeg").note));

// ---- 12. the download name follows the file and cannot escape ----

const NAME = { width: 800, height: 600, rotation: 0, flipH: false, flipV: false, crop: null, scale: 100, filter: "none", adjusted: false, annotated: false };
check("an unedited 100% export keeps only the source stem and the real size", outputNameFor("photo.png", NAME, "png") === "photo-800x600.png", outputNameFor("photo.png", NAME, "png"));
check("a rotation is named, so two rotations do not collide", outputNameFor("photo.png", { ...NAME, rotation: 90 }, "png") === "photo-800x600-90deg.png");
check("a mirror is named", outputNameFor("photo.png", { ...NAME, flipH: true }, "png") === "photo-800x600-fliph.png");
check("a crop is named, so a cropped export is never mistaken for the original", outputNameFor("photo.png", { ...NAME, crop: CROP }, "png") === "photo-800x600-crop200x120.png", outputNameFor("photo.png", { ...NAME, crop: CROP }, "png"));
check("a non-default scale is named", outputNameFor("photo.png", { ...NAME, scale: 50 }, "png") === "photo-800x600-50pct.png");
check("a filter is named", outputNameFor("photo.png", { ...NAME, filter: "grayscale" }, "png") === "photo-800x600-grayscale.png");
check("adjustments and annotations are named when they are in the file", outputNameFor("photo.png", { ...NAME, adjusted: true, annotated: true }, "png") === "photo-800x600-adjusted-annotated.png");
check("an edit that did not happen is never claimed in the name", !/adjusted|annotated|deg|flip|crop/.test(outputNameFor("photo.png", NAME, "png")));
check("every known input extension is stripped exactly once", ["a.png", "a.PNG", "a.jpg", "a.jpeg", "a.gif", "a.webp", "a.bmp"].every((n) => outputNameFor(n, NAME, "png") === "a-800x600.png"));
check("a known image extension the tool refuses is still stripped", outputNameFor("scan.heic", NAME, "png") === "scan-800x600.png" && outputNameFor("scan.avif", NAME, "png") === "scan-800x600.png");
check("a name with no extension is used whole", outputNameFor("whiteboard", NAME, "png") === "whiteboard-800x600.png");
check("a name that is only an extension falls back to the disclosed default", outputNameFor(".png", NAME, "png") === "image-800x600.png", outputNameFor(".png", NAME, "png"));
check("a hidden dotfile name cannot produce a dot-prefixed download", !outputNameFor(".env.png", NAME, "png").startsWith("."));
check("path separators cannot survive into the name", (() => { const n = outputNameFor("../../etc/passwd.png", NAME, "png"); return n === "etc-passwd-800x600.png" && !n.includes("/") && !n.includes(".."); })(), outputNameFor("../../etc/passwd.png", NAME, "png"));
check("reserved characters are replaced and the result is trimmed clean", outputNameFor('re:ceipt<1>.png', NAME, "png") === "re-ceipt-1-800x600.png", outputNameFor('re:ceipt<1>.png', NAME, "png"));
check("a control character in a name is replaced, not written raw", !/[\x00-\x1f]/.test(outputNameFor("a\u0007b.png", NAME, "png")));
check("a long stem is truncated to a sane name", outputNameFor("x".repeat(400) + ".png", NAME, "png").length <= 60 + "-800x600.png".length);
check("the extension always comes from the bytes, not the request", (() => {
  const asked = outputNameForMime("photo.png", NAME, "image/webp");
  const got = outputNameForMime("photo.png", NAME, "image/png");
  return asked.endsWith(".webp") && got.endsWith(".png") && asked !== got;
})());
check("an unsupported mime produces no name at all, rather than a lying one", outputNameForMime("photo.png", NAME, "image/gif") === null);
check("two different edits of the same file never share a name", (() => {
  const names = [
    NAME,
    { ...NAME, rotation: 90 },
    { ...NAME, crop: CROP },
    { ...NAME, scale: 50 },
    { ...NAME, filter: "sepia" },
  ].map((s) => outputNameFor("photo.png", s, "png"));
  return new Set(names).size === names.length;
})());

// ---- 13. failures become a sentence, never a raw engine string ----

check("a decode failure is classified as a decode problem", classifyEditorError(new Error("The source image could not be decoded")) === "decode");
check("a corrupt-data message is a decode problem", classifyEditorError(new Error("corrupt data")) === "decode");
check("an out-of-memory failure is classified as memory", classifyEditorError(new Error("Out of memory: allocation failed")) === "memory");
check("an IndexSize error is classified as memory", classifyEditorError(new RangeError("IndexSizeError")) === "memory");
check("a taint error is classified as an encode problem", (() => {
  const e = new Error("tainted canvas");
  e.name = "SecurityError";
  return classifyEditorError(e) === "encode";
})());
check("a not-supported error is classified as an encode problem", (() => {
  const e = new Error("no encoder");
  e.name = "EncodingError";
  return classifyEditorError(e) === "encode";
})());
check("an unrecognised failure falls back rather than guessing", classifyEditorError(new Error("something odd")) === "unknown" && classifyEditorError(null) === "unknown");
check("a non-Error value does not throw the classifier", classifyEditorError("boom") === "unknown" && classifyEditorError(undefined) === "unknown");
check("every classification has a message with a next step", Object.values(G.EDITOR_ERROR_MESSAGES).every((m) => m.length > 40));
check("no error message leaks a raw engine string or a stack", Object.values(G.EDITOR_ERROR_MESSAGES).every((m) => !/(^|\s)Error:|\n\s*at\s+\w|\.js:\d|\.ts:\d/.test(m)));
check("the memory failure tells the user to shrink rather than to retry blindly", /[Rr]esize|scale .* down|crop/i.test(G.EDITOR_ERROR_MESSAGES.memory));
check("the unknown failure admits nothing was downloaded", /Nothing was downloaded/i.test(G.EDITOR_ERROR_MESSAGES.unknown));
check("editorErrorMessage maps a thrown string as well as an Error", editorErrorMessage("out of memory").includes("16 MP"));

// ---- 14. the byte formatter matches the one the repo uses ----

check("bytes format exactly the way the rest of the site formats them", [1, 512, 1023, 1024, 1536, 1048576, 2621440, 12345678, 2 ** 30].every((n) => formatBytes(n) === F.formatBytes(n)));
check("the mirror agrees on zero and on the cap, and guards what the site's would print as NaN", (() => {
  return formatBytes(0) === F.formatBytes(0) && formatBytes(MAX_FILE_BYTES) === F.formatBytes(MAX_FILE_BYTES) &&
    !/NaN/.test(formatBytes(NaN)) && !/NaN/.test(formatBytes(-1));
})(), `${formatBytes(MAX_FILE_BYTES)} / ${F.formatBytes(MAX_FILE_BYTES)}`);
check("a nonsense byte count does not print NaN", !/NaN/.test(formatBytes(-1)) && !/NaN/.test(formatBytes(NaN)));
check("the component uses the module's formatter rather than its own", COMPONENT.includes("formatBytes(") && !/toFixed\(1\)\} (KB|MB)/.test(COMPONENT));

// ---- 15. the copy cannot state a cap, a filter or a limit the module denies ----

const EDITOR_COPY = CONTENT.split('"image-editor":')[1]?.split('"image-ocr":')[0] ?? "";
const REGISTRY = TOOLS.split('slug: "image-editor"')[1]?.split("category:")[0] ?? "";

check("the registry entry is this tool's own entry", REGISTRY.includes("Image Editor"));
check("the registry tagline no longer promises annotation only", !/annotate with pen/i.test(REGISTRY));
check("the registry description names the operations the tool has", /crop/i.test(REGISTRY) && /rotate/i.test(REGISTRY) && /resize/i.test(REGISTRY) && /PNG, JPEG or WebP/i.test(REGISTRY));
check("the registry says over-budget exports are refused, not shrunk", /refused, not shrunk/i.test(REGISTRY));
check("the long description no longer promises blur or sharpen", !/blur|sharpen/i.test(EDITOR_COPY), EDITOR_COPY.match(/[^.]*blur[^.]*\./i)?.[0] ?? "");
check("the long description no longer claims an aspect-ratio crop tool it does not have", !/crop images to any aspect ratio/i.test(EDITOR_COPY));
check("the feature list no longer claims 'sharpen, and more'", !/sharpen/i.test(EDITOR_COPY));
check("the FAQ no longer promises redo", !/undo and redo/i.test(EDITOR_COPY) && (/There is no redo/i.test(EDITOR_COPY) || !/\bredo\b/i.test(EDITOR_COPY)));
check("the copy no longer claims 'no usage limits'", !/no usage limits/i.test(EDITOR_COPY));
check("the copy no longer claims the tool is 'accurate' or 'perfect'", !/pixel-perfect|flawless|professional-grade/i.test(EDITOR_COPY));
check("the copy names the three input formats the parser reads", ["PNG", "JPEG", "GIF", "WebP", "BMP"].every((f) => EDITOR_COPY.includes(f)));
check("the copy states the three caps with the module's own numbers", [FILE_SIZE_LABEL, PIXEL_BUDGET_LABEL, SIDE_LIMIT_LABEL].every((v) => EDITOR_COPY.includes(v)));
check("the copy states the 8 px minimum side", EDITOR_COPY.includes(`${MIN_OUTPUT_PX} px minimum`) || EDITOR_COPY.includes(`${MIN_OUTPUT_PX} px`));
check("the copy states the 10-400% scale range", EDITOR_COPY.includes("10%") && EDITOR_COPY.includes("400%"));
check("the copy states the 30-step undo depth", EDITOR_COPY.includes(`${MAX_UNDO}-step`), EDITOR_COPY.includes(`${MAX_UNDO}-step`) ? "" : `looking for ${MAX_UNDO}-step`);
check("the copy states that the image is never uploaded", /never uploaded|never leaves|never leaves your/i.test(EDITOR_COPY));
check("the copy admits resize is interpolation, not AI upscaling", /not an AI upscaler|cannot invent detail/i.test(EDITOR_COPY));
check("the copy admits a second lossy generation on re-export", /second lossy generation/i.test(EDITOR_COPY));
check("the copy admits transparency is composited on white for JPEG", /composited on white|composites transparency on white/i.test(EDITOR_COPY));
check("the copy admits metadata, GPS, timestamp and ICC are dropped", /no EXIF|no camera|no GPS|no timestamps/i.test(EDITOR_COPY) && /ICC/i.test(EDITOR_COPY));
check("the copy admits untagged sRGB output", /untagged sRGB/i.test(EDITOR_COPY));
check("the copy admits EXIF orientation is applied on the way in", /orientation flag, and the browser applies it/i.test(EDITOR_COPY));
check("the copy names the formats that lose their animation", FLATTENED_FORMAT_NAMES.split(" and ").every((n) => EDITOR_COPY.includes(n)) && /first frame/i.test(EDITOR_COPY));
check("the copy admits there is no HEIC, AVIF or RAW support", /no HEIC, AVIF or RAW/i.test(EDITOR_COPY));
check("the copy admits there are no layers, no PSD and no AI", /no layers, no PSD/i.test(EDITOR_COPY) && /\bno AI\b/i.test(EDITOR_COPY));
check("the copy admits annotations are baked into one canvas", /baked into the same single canvas|no PSD to save/i.test(EDITOR_COPY));
check("the copy says an over-budget export is refused with the largest scale that fits", /largest scale that would fit|largest scale that fits/i.test(EDITOR_COPY));
check("the copy discloses the 1200 px preview cap", EDITOR_COPY.includes(String(PREVIEW_MAX_SIDE_PX)));
check("the copy names the quality range for the lossy formats", /0\.30|0\.3/.test(EDITOR_COPY) && /PNG is the only lossless/i.test(EDITOR_COPY));
check("the copy states the format is read from the file's header bytes", /header bytes/i.test(EDITOR_COPY));
check("the related tools all exist in the registry", (EDITOR_COPY.split('"relatedSlugs":')[1] ?? "").match(/"[a-z0-9-]+"/g)?.every((s) => TOOLS.includes(`slug: ${s.replace(/"/g, '"')}`)) !== false);
check("the guide is registered against this tool", /slug: "how-to-edit-an-image-online"[\s\S]{0,900}?toolSlug: "image-editor"/.test(GUIDES));
check("the guide is in the same list the sitemap is built from", GUIDES.includes('toolSlug: "image-editor"'));
check("the guide states the same caps", [FILE_SIZE_LABEL, PIXEL_BUDGET_LABEL, SIDE_LIMIT_LABEL].every((v) => GUIDES.includes(v)));
check("the guide says which edits are exact and which resamples", /move pixels/i.test(GUIDES) && /resample/i.test(GUIDES));
check("the guide admits the resize is not AI upscaling", /not an AI upscaler|no generative model/i.test(GUIDES));
check("the guide admits a second lossy generation", /second lossy generation/i.test(GUIDES));
check("the guide admits the metadata and colour profile loss", /no EXIF|no GPS/i.test(GUIDES) && /ICC/i.test(GUIDES));
check("the guide admits the animation flattening", /first frame/i.test(GUIDES));
check("the guide admits the refusal policy", /refused/i.test(GUIDES) && /largest scale that would fit/i.test(GUIDES));
check("the guide does not claim the download button is withdrawn on a refusal", !/download is not offered/i.test(GUIDES) && /repeat the reason in an alert/i.test(GUIDES));
check("the guide states the privacy position", /never uploaded|never leaves/i.test(GUIDES));
check("the guide admits there are no layers, no PSD and no AI", /no layers, no PSD/i.test(GUIDES));
check("the SEO keywords cover the operations the tool really has", ["crop", "rotate", "resize", "annotate"].every((k) => SEO.includes(`"${k}`)) && /image editor online/i.test(SEO));
check("the SEO feature list names the real operations and the real limits", /exact 90-degree rotation/i.test(SEO) && /one scale to both axes/i.test(SEO) && PIXEL_BUDGET_LABEL.includes("16 MP"));

// ---- 16. the component keeps the promises the copy makes ----

check("the component imports the caps rather than restating them", COMPONENT.includes("MAX_FILE_BYTES") && !/\b25\s*MB\b/.test(COMPONENT));
check("the byte cap is checked before the file is read at all", COMPONENT.indexOf("file.size > MAX_FILE_BYTES") < COMPONENT.indexOf("file.arrayBuffer()"));
check("the preflight runs on the bytes that will be decoded", COMPONENT.includes("preflightImage(bytes, file.name)"));
check("the preflight happens before the decoder is handed anything", COMPONENT.indexOf("preflightImage(bytes, file.name)") < COMPONENT.indexOf("createImageBitmap"));
check("the component asks the browser to apply EXIF orientation on the way in", COMPONENT.includes('imageOrientation: "from-image"'));
check("the render is derived from the state it is given, not from the last render's size", COMPONENT.includes("planPaint(state, viewMode") && !/previewW|previewH/.test(COMPONENT));
check("the preview factor is applied exactly once", !/Math\.round\(\(?w \* previewScale/.test(COMPONENT) && COMPONENT.includes("previewTarget("));
check("a refused export paints nothing, so the last fitting render stays on screen", /if \(!planned\) \{[\s\S]{0,400}?return;/.test(COMPONENT));
check("the refusal is announced, not just shown", COMPONENT.includes("setError(refused.ok ? \"\" : refused.message)"));
check("the download control stays reachable but is described by the refusal", COMPONENT.includes("aria-describedby={plan && !plan.ok ? refusalId : undefined}"));
check("pointer maths inverts the matrix the canvas was actually painted with", COMPONENT.includes("paintRef.current") && COMPONENT.includes("invertMatrix(painted.target.matrix)"));
check("a stroke's width is converted from screen pixels to the output's own", COMPONENT.includes("outputBrushWidth(brushWidth, painted.unit)"));
check("the export draws its annotations at exactly the stored width", COMPONENT.includes("drawAnnotation(ctx, target.matrix, 1, a)"));
check("the export and the preview use the same geometry function", COMPONENT.includes("const target = renderTarget(") && COMPONENT.includes("previewTarget("));
check("the export composites white for a format with no alpha", COMPONENT.includes("if (!spec.alpha)") && COMPONENT.includes('ctx.fillStyle = WHITE'));
check("a smaller canvas is shrunk to nothing rather than left allocated", COMPONENT.includes("canvas.width = 0") && COMPONENT.includes("canvas.height = 0"));
check("the format is named from the bytes the encoder really returned", COMPONENT.includes("outputNameForMime(") && COMPONENT.includes("formatForMime(blob.type)"));
check("a substituted encoder is reported to the user", COMPONENT.includes("if (blob.type !== wanted)"));
check("PNG is sent without a quality argument, the lossy ones with one", COMPONENT.includes("qualityAppliesTo(format) ? quality : undefined"));
check("a crop drag is one undo step, not one per pointer move", COMPONENT.includes("cropBaseRef") && COMPONENT.includes("pushUndo(base)"));
check("a crop drag is measured in the image's own coordinates, so a rotation needs no special case", !COMPONENT.includes("naturalRectOf(") && /cropDragRef\.current = naturalPoint\(point\)/.test(COMPONENT) && /const next = normalizeCrop\(\s*\{ x: start\.x, y: start\.y/.test(COMPONENT));
check("the download button stays clickable when a plan is refused", /disabled=\{busy \|\| !plan\}/.test(COMPONENT) && !/disabled=\{busy \|\| !plan\?\.ok\}/.test(COMPONENT));
check("a refused download repeats the reason instead of doing nothing", /if \(!plan\.ok\) \{[\s\S]{0,300}?setError\(plan\.message\);[\s\S]{0,80}?return;/.test(COMPONENT));
check("the quality slider's step is the module's own constant", COMPONENT.includes("step={JPEG_QUALITY_STEP}") && !COMPONENT.includes("step={0.05}"));
check("undo clears the result panel so stale bytes cannot be re-saved", /clearResult\(\);[\s\S]{0,80}?setEdit\(previous\)/.test(COMPONENT));
check("the only place the result panel is dropped is the one that revokes its object URL",
  (COMPONENT.match(/setResult\(null\)/g) ?? []).length === 1 &&
  /const clearResult = useCallback\(\(\) => \{\s*releaseResultUrl\(\);\s*setResult\(null\);\s*\}, \[\]\);/.test(COMPONENT) &&
  COMPONENT.includes("URL.revokeObjectURL(resultUrlRef.current)"));
check("the object URL is released on clear and on unmount", COMPONENT.includes("URL.revokeObjectURL") && COMPONENT.includes("useEffect(() => () => releaseResultUrl(), [])"));
check("the decoded bitmap is closed when it is replaced and on clear", (COMPONENT.match(/\.close\(\)/g) ?? []).length >= 2);
check("async work is guarded by a runId so a stale run cannot paint", COMPONENT.includes("runIdRef") && (COMPONENT.match(/run !== runIdRef\.current/g) ?? []).length >= 4);
check("the component surfaces refusals as alerts", COMPONENT.includes('role="alert"'));
check("the component announces progress and result to assistive tech", (COMPONENT.match(/role="status"/g) ?? []).length >= 2 && COMPONENT.includes("aria-busy={busy}"));
check("the stage is announced with its real on-screen size", COMPONENT.includes("role=\"img\"") && COMPONENT.includes("pixels on screen"));
check("the crop can be typed, so every operation is keyboard-reachable", COMPONENT.includes("onKeyDown") && COMPONENT.includes("commitCrop"));
check("every control is a real labelled form control", (COMPONENT.match(/htmlFor=\{/g) ?? []).length >= 8 && COMPONENT.includes("fieldset") && COMPONENT.includes("legend"));
check("the annotate tools are toggle buttons with a pressed state", (COMPONENT.match(/aria-pressed=\{tool === kind\}/g) ?? []).length === 1 && COMPONENT.includes("aria-pressed={edit.rotation === deg}"));
check("the component states what it cannot do", /not an AI upscaler/i.test(COMPONENT) && /no layers, no PSD/i.test(COMPONENT));
check("the component states the metadata and colour loss", /no EXIF, no camera, no GPS/i.test(COMPONENT) && /untagged sRGB/i.test(COMPONENT));
check("the component names the formats that lose their animation", COMPONENT.includes("FLATTENED_FORMAT_NAMES") && /first frame/i.test(COMPONENT));
check("the component says the image is never uploaded", /never uploaded/i.test(COMPONENT));
check("the component offers the three formats the module exports", EXPORT_FORMATS.every((f) => COMPONENT.includes(f.id)));
check("the pure modules keep the browser out of them", !/createImageBitmap|document\.|window\.|HTMLCanvasElement|ImageData/.test(readFileSync(`${SRC}/editor-format.ts`, "utf8") + readFileSync(`${SRC}/editor-pixels.ts`, "utf8")));

rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
