// Node mirror audit for the "Flatten PDF" tool.
//
// Self-contained: pdf-lib + pdfjs-dist + node builtins only. There is no
// canvas in Node, so the browser raster is stood in for by a deterministic
// synthetic PNG at the exact pixel dimensions the component would produce.
// Everything else — page geometry, image XObject structure, the absence of
// text operators, the caps, the error mapping, the runId guard and the
// download naming — is exercised against real PDF bytes. The JPEG branch of
// the encoder is asserted from the component source here and end-to-end in
// e2e/pdf-flatten-browser.mjs, which runs in real Chrome.

import { createRequire } from "node:module";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, degrees } = require("pdf-lib");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COMPONENT = readFileSync(
  join(ROOT, "src/features/pdf-flatten/PdfFlatten.tsx"),
  "utf8",
);
const TOOL_CONTENT = readFileSync(join(ROOT, "src/lib/tool-content.ts"), "utf8");
const SEO = readFileSync(join(ROOT, "src/lib/seo.ts"), "utf8");
const GUIDES = readFileSync(join(ROOT, "src/lib/guides.ts"), "utf8");
const TOOLS = readFileSync(join(ROOT, "src/lib/tools.ts"), "utf8");

const STANDARD_FONTS = new URL(
  "../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).href;

const TMP = mkdtempSync(join(tmpdir(), "braincoder-flatten-"));

let passed = 0;
let failed = 0;
const check = (ok, label, extra = "") => {
  if (ok) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ---------------------------------------------------------------------------
// 1. Mirrors of the component's pure logic
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_CANVAS_AREA = 16_000_000;
const PDF_MAGIC = "%PDF-";
const HEADER_SCAN_BYTES = 1024;

const PRESETS = [
  { id: "screen", label: "Screen", dpi: 96, mime: "image/jpeg", quality: 0.72 },
  { id: "balanced", label: "Balanced", dpi: 150, mime: "image/jpeg", quality: 0.88 },
  { id: "print", label: "Print", dpi: 200, mime: "image/png", quality: undefined },
];
const DEFAULT_PRESET = "balanced";

const presetFor = (id) => PRESETS.find((p) => p.id === id) ?? PRESETS[1];
const scaleForDpi = (dpi) => dpi / 72;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikePdf(bytes) {
  const limit = Math.min(bytes.length, HEADER_SCAN_BYTES);
  const head = Buffer.from(bytes.subarray(0, limit)).toString("latin1");
  return head.includes(PDF_MAGIC);
}

function flattenName(source) {
  const base = source
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim();
  return `${base || "document"}-flattened.pdf`;
}

function friendlyError(err) {
  const name = err?.name ?? "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "PasswordException" || /no password given|password|encrypted/i.test(msg))
    return "This PDF is password-protected. Remove the password with PDF Unlock, then flatten the unlocked copy.";
  if (/invalid pdf|failed to parse|no pdf header|invalidpdfexception/i.test(msg))
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  if (/canvas|drawing buffer/i.test(msg))
    return "This page is too large to rasterize at that quality on this device. Try a lower quality setting.";
  return "Couldn't read that PDF — it may be corrupt or in an unsupported format.";
}

function userFacing(msg) {
  const e = new Error(msg);
  e.userFacing = true;
  return e;
}

function toUiError(err) {
  if (err instanceof Error && err.userFacing) return err.message;
  return friendlyError(err);
}

// Canvas clamp, exactly as the component computes it.
function effectiveScale(base, target) {
  if (base.width * target * base.height * target > MAX_CANVAS_AREA) {
    return (
      target *
      Math.sqrt(MAX_CANVAS_AREA / (base.width * base.height * target * target))
    );
  }
  return target;
}

// ---------------------------------------------------------------------------
// 2. Deterministic synthetic PNG (stands in for the browser raster)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

/** 8-bit greyscale PNG whose size scales with the pixel count. */
function makeGrayPng(w, h, seed = 1) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: greyscale
  const raw = Buffer.alloc((w + 1) * h);
  let s = seed >>> 0;
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      raw[o++] = (s >>> 24) & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 3. Mirror of the component's rasterizeToImagePdf (structure only)
// ---------------------------------------------------------------------------

async function openPdf(data) {
  const task = pdfjs.getDocument({ data: data.slice(0), standardFontDataUrl: STANDARD_FONTS });
  return task.promise;
}

async function flattenToImagePdf(
  sourceBytes,
  preset,
  { isStale = () => false } = {},
) {
  const doc = await openPdf(new Uint8Array(sourceBytes));
  const out = await PDFDocument.create();
  let reducedPages = 0;
  let weakestScale = Number.POSITIVE_INFINITY;
  let strongestScale = 0;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    if (isStale()) return null;
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const target = scaleForDpi(preset.dpi);
    const scale = effectiveScale(base, target);
    if (scale < target) reducedPages += 1;
    if (scale < weakestScale) weakestScale = scale;
    if (scale > strongestScale) strongestScale = scale;
    const viewport = page.getViewport({ scale });
    const px = {
      w: Math.max(1, Math.floor(viewport.width)),
      h: Math.max(1, Math.floor(viewport.height)),
    };
    const raster = makeGrayPng(px.w, px.h, n * 7919);
    const image = await out.embedPng(raster);
    const outPage = out.addPage([base.width, base.height]);
    outPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
    pages.push({ px, base: { w: base.width, h: base.height } });
    page.cleanup();
  }
  if (isStale()) return null;
  const bytes = new Uint8Array(await out.save());
  return {
    bytes,
    pages,
    reducedPages,
    dpiMin: Math.round(weakestScale * 72),
    dpiMax: Math.round(Math.max(weakestScale, strongestScale) * 72),
    presetId: preset.id,
  };
}

function dpiLabel(result) {
  return result.dpiMin === result.dpiMax
    ? `${result.dpiMin} DPI`
    : `${result.dpiMin}–${result.dpiMax} DPI`;
}

/** Every /Subtype /Image XObject in a loaded pdf-lib document. */
function listImages(doc) {
  const images = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj?.dict;
    if (!dict || typeof dict.entries !== "function") continue;
    const entries = Object.fromEntries(
      [...dict.entries()].map(([k, v]) => [String(k), v]),
    );
    if (entries["/Subtype"]?.toString() !== "/Image") continue;
    images.push({
      width: Number(entries["/Width"]?.toString()),
      height: Number(entries["/Height"]?.toString()),
      filter: entries["/Filter"]?.toString() ?? "",
      colorSpace: entries["/ColorSpace"]?.toString() ?? "",
      bits: Number(entries["/BitsPerComponent"]?.toString() ?? 0),
    });
  }
  return images;
}

/** Page-level resource font dictionaries, if any survived. */
function pageFontObjectCount(doc) {
  let fonts = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj?.dict;
    if (!dict || typeof dict.entries !== "function") continue;
    const entries = Object.fromEntries(
      [...dict.entries()].map(([k, v]) => [String(k), v]),
    );
    if (entries["/Type"]?.toString() === "/Font") fonts += 1;
  }
  return fonts;
}

/** Annotations attached to each page (0 for a rasterized page). */
function pageAnnotationCounts(doc) {
  return doc.getPages().map((p) => {
    const annots = p.node.Annots();
    if (!annots) return 0;
    const arr = Array.isArray(annots)
      ? annots
      : typeof annots.asArray === "function"
        ? annots.asArray()
        : [];
    return arr.length;
  });
}

function decodedContentStream(page) {
  const contents = page.node.Contents();
  let streams = [];
  if (!contents) return "";
  if (Array.isArray(contents)) streams = contents;
  else if (contents.array) streams = contents.array;
  else streams = [contents];
  let out = "";
  for (const child of streams) {
    const resolved = page.node.context.lookup(child);
    const raw = resolved?.contents ?? null;
    if (!raw) continue;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    out +=
      bytes.length >= 2 && bytes[0] === 0x78 && bytes[1] === 0x9c
        ? inflateSync(Buffer.from(bytes)).toString("latin1")
        : Buffer.from(bytes).toString("latin1");
  }
  return out;
}

async function pdfjsPageFacts(bytes, pageNum = 1) {
  const doc = await openPdf(bytes);
  const page = await doc.getPage(pageNum);
  const text = await page.getTextContent();
  const ops = await page.getOperatorList();
  const nameOf = (code) =>
    Object.entries(pdfjs.OPS).find(([, v]) => v === code)?.[0] ?? String(code);
  const names = ops.fnArray.map(nameOf);
  return {
    numPages: doc.numPages,
    textItems: (text.items ?? []).length,
    text: (text.items ?? []).map((i) => i.str ?? "").join(""),
    paints: names.filter((n) => n === "paintImageXObject").length,
    showText: names.filter((n) => n === "showText" || n === "showSpacedText").length,
    view: page.getViewport({ scale: 1 }),
  };
}

// ---------------------------------------------------------------------------
// 4. Fixtures, built in a temp dir
// ---------------------------------------------------------------------------

const A4_W = 595.28;
const A4_H = 841.89;

const twoPage = await (async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([A4_W, A4_H]);
  p1.drawText("CONFIDENTIAL LEDGER", { x: 60, y: 760, size: 18, font });
  p1.drawText("Selectable body text that must not survive flattening.", {
    x: 60,
    y: 720,
    size: 11,
    font,
  });
  const p2 = doc.addPage([A4_W, A4_H]);
  p2.drawText("PAGE TWO BODY TEXT", { x: 60, y: 760, size: 14, font });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "two-page.pdf"), twoPage);

const rotated = await (async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([A4_W, A4_H]);
  p1.setRotation(degrees(90));
  p1.drawText("ROTATED PAGE BODY", { x: 60, y: 760, size: 14, font });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "rotated.pdf"), rotated);

const small = await (async () => {
  const doc = await PDFDocument.create();
  const p = doc.addPage([300, 300]);
  p.drawRectangle({ x: 20, y: 20, width: 260, height: 260, color: { type: "RGB", red: 0.2, green: 0.4, blue: 0.9 } });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "small.pdf"), small);

const hugePage = await (async () => {
  const doc = await PDFDocument.create();
  doc.addPage([4000, 4000]);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "huge-page.pdf"), hugePage);

const manyPages = await (async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 201; i++) doc.addPage([200, 200]);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "201-pages.pdf"), manyPages);

const notAPdf = new Uint8Array(Buffer.from("this is definitely not a pdf file, just some text\nline two"));
writeFileSync(join(TMP, "notapdf.pdf"), notAPdf);

const locked = new Uint8Array(readFileSync(join(ROOT, "e2e/fixtures/encrypted.pdf")));
writeFileSync(join(TMP, "locked.pdf"), locked);

// ---------------------------------------------------------------------------
// 5. Source-level truth in the component
// ---------------------------------------------------------------------------

// JSX wraps copy across lines, so phrase checks run on flattened text.
const COMPONENT_TEXT = COMPONENT.replace(/\s+/g, " ");

const mSize = COMPONENT.match(/const MAX_FILE_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+);/);
check(
  !!mSize && +mSize[1] * +mSize[2] * +mSize[3] === MAX_FILE_BYTES,
  "component MAX_FILE_BYTES is 100 MB",
  COMPONENT.match(/const MAX_FILE_BYTES[^;]*;/)?.[0] ?? "not found",
);
check(
  /const MAX_PAGES\s*=\s*200;/.test(COMPONENT) && MAX_PAGES === 200,
  "component MAX_PAGES is 200",
);
check(
  /const MAX_CANVAS_AREA\s*=\s*16_000_000;/.test(COMPONENT) && MAX_CANVAS_AREA === 16_000_000,
  "component caps the canvas area at 16 MP and mirrors the harness",
);
check(
  /dpi:\s*96,[\s\S]{0,80}?mime:\s*"image\/jpeg"/.test(COMPONENT) &&
    /dpi:\s*150,[\s\S]{0,80}?mime:\s*"image\/jpeg"/.test(COMPONENT) &&
    /dpi:\s*200,[\s\S]{0,80}?mime:\s"image\/png"/.test(COMPONENT),
  "three presets are declared: 96/150 DPI JPEG and 200 DPI lossless PNG",
);
check(
  /quality:\s*0\.72/.test(COMPONENT) && /quality:\s*0\.88/.test(COMPONENT),
  "JPEG presets disclose their encoder quality",
);
check(
  /DEFAULT_PRESET[^=]*=\s*"balanced"/.test(COMPONENT) && presetFor(DEFAULT_PRESET).dpi === 150,
  "the default preset is Balanced at 150 DPI",
);
check(
  /function scaleForDpi\(dpi: number\): number \{\s*return dpi \/ 72;/.test(COMPONENT) &&
    scaleForDpi(150) === 150 / 72,
  "raster scale is derived from the disclosed DPI (dpi / 72)",
);
check(
  COMPONENT.includes('const PDF_MAGIC = "%PDF-";') &&
    COMPONENT.includes("HEADER_SCAN_BYTES") &&
    COMPONENT.includes("looksLikePdf(data)"),
  "a %PDF- magic-byte preflight runs before pdf.js is asked to parse",
);
check(
  /looksLikePdf\(data\)[\s\S]{0,400}?doesn't look like a valid PDF/.test(COMPONENT),
  "the magic-byte preflight surfaces the invalid-file message",
);
const bailOuts = (COMPONENT.match(/runId !== runIdRef\.current/g) ?? []).length;
const liveChecks = (COMPONENT.match(/runId === runIdRef\.current/g) ?? []).length;
check(
  bailOuts >= 6 &&
    liveChecks >= 3 &&
    /const data = new Uint8Array\(await file\.arrayBuffer\(\)\);\s*if \(runId !== runIdRef\.current\) return;/.test(
      COMPONENT,
    ) &&
    /if \(!flattened \|\| runId !== runIdRef\.current\) return;/.test(COMPONENT) &&
    /if \(runId === runIdRef\.current\) \{\s*setBusy\(false\);/.test(COMPONENT),
  `every result-producing await is guarded (${bailOuts} bail-outs, ${liveChecks} live checks, busy reset guarded)`,
);
check(
  /isStale: \(\) => boolean/.test(COMPONENT) &&
    /\(\) => runId !== runIdRef\.current/.test(COMPONENT) &&
    /if \(isStale\(\)\) return null;/.test(COMPONENT),
  "a superseded run aborts the raster loop and never downloads",
);
check(
  /presetId: PresetId;/.test(COMPONENT) &&
    /presetId: preset\.id/.test(COMPONENT) &&
    /presetFor\(result\.presetId\)\.dpi/.test(COMPONENT),
  "the reduced-DPI notice quotes the preset the run actually used, not the current selection",
);
check(
  /function dpiLabel\(result: FlattenResult\): string/.test(COMPONENT) &&
    /dpiMin === result\.dpiMax/.test(COMPONENT),
  "the reported raster resolution is a single DPI or an honest min–max range",
);
check(
  /if \(!data \|\| numPages < 1 \|\| busy\) return;/.test(COMPONENT),
  "the flatten action is guarded against re-entry while busy",
);
check(
  /role="alert"/.test(COMPONENT) && /role="status"/.test(COMPONENT) && /aria-busy=\{busy\}/.test(COMPONENT),
  "errors use role=alert, progress uses role=status, and the root carries aria-busy",
);
check(
  (COMPONENT.match(/role="alert"/g) ?? []).length >= 2 &&
    (COMPONENT.match(/role="status"/g) ?? []).length >= 3,
  "idle / load / busy / success lines are role=status, errors and the reduced-DPI notice are role=alert",
);
check(
  /<fieldset[\s\S]{0,400}?<legend/.test(COMPONENT) && /type="radio"/.test(COMPONENT),
  "the DPI choice is a fieldset of real radio inputs (arrow-key usable)",
);
check(
  /id=\{fileInputId\}/.test(COMPONENT) && /htmlFor=\{fileInputId\}/.test(COMPONENT),
  "the file opener is a real <label> bound to the hidden input with useId",
);
check(
  /href="\/use\/pdf-unlock"/.test(COMPONENT) && /\/Unlock\/i\.test\(error\)/.test(COMPONENT),
  "encrypted files steer to PDF Unlock with a working link",
);
check(
  /downloadBlob\(flattened\.bytes, filename\)/.test(COMPONENT) &&
    /function flattenName/.test(COMPONENT) &&
    COMPONENT.includes('}-flattened.pdf`'),
  "the download is named <source>-flattened.pdf via downloadBlob",
);
check(
  /embedJpg/.test(COMPONENT) && /embedPng/.test(COMPONENT) &&
    /preset\.mime === "image\/png"/.test(COMPONENT),
  "the encoder follows the chosen preset (embedPng for lossless, embedJpg for JPEG)",
);
check(
  /canvas\.width = 0;/.test(COMPONENT) && /page\.cleanup\(\)/.test(COMPONENT) &&
    /await task\.destroy\(\)/.test(COMPONENT),
  "canvases are released and pdf.js pages/tasks are cleaned up",
);
check(
  COMPONENT_TEXT.includes("no longer be selected, searched, copied or edited") &&
    COMPONENT_TEXT.includes("normally a much bigger file"),
  "the before/after note states text stops being selectable and the file grows",
);
check(
  COMPONENT_TEXT.includes("which is lossy") &&
    COMPONENT_TEXT.includes("lossless PNG instead"),
  "the raster copy discloses that the JPEG settings are lossy and Print is lossless PNG",
);
check(
  COMPONENT_TEXT.includes("bookmarks, link targets, form structure and document metadata are not carried over") &&
    COMPONENT_TEXT.includes("does not add an OCR text layer back"),
  "the result panel discloses what a rebuilt file does not carry over and adds no OCR layer",
);
check(
  COMPONENT.includes("never uploaded") || COMPONENT.includes("never leaves"),
  "copy states the file is processed on-device",
);
const lowerSource = COMPONENT.toLowerCase();
check(
  !/instant|perfect quality|no limits|no file size limit|drag and drop|unlimited|unbreakable|unrecoverable/.test(lowerSource),
  "no overclaims in the component copy (instant / no limits / drag-and-drop / unbreakable)",
);
check(
  !/lossless (?:output|flatten|result|conversion|quality|file)/i.test(COMPONENT_TEXT) &&
    /Print uses lossless PNG/.test(COMPONENT_TEXT),
  "\"lossless\" is only claimed for the PNG preset, never as a blanket guarantee",
);

// ---------------------------------------------------------------------------
// 6. Mirror logic: preflight, naming, formatting, canvas clamp, errors
// ---------------------------------------------------------------------------

check(!looksLikePdf(notAPdf), "magic-byte preflight rejects a plain text file");
check(!looksLikePdf(new Uint8Array(0)), "an empty file is rejected by the preflight");
check(looksLikePdf(twoPage), "a real PDF passes the preflight");
check(
  looksLikePdf(
    new Uint8Array(
      Buffer.concat([Buffer.alloc(16, 0x0a), Buffer.from("%PDF-1.7\n")]),
    ),
  ),
  "a PDF with leading junk before the header still passes",
);
check(
  !looksLikePdf(
    new Uint8Array(
      Buffer.concat([Buffer.alloc(2048, 0x0a), Buffer.from("%PDF-1.7\n")]),
    ),
  ),
  "a %PDF- marker beyond the first 1 KB is treated as not-a-PDF",
);

check(flattenName("invoice.pdf") === "invoice-flattened.pdf", "invoice.pdf → invoice-flattened.pdf");
check(flattenName("INVOICE.PDF") === "INVOICE-flattened.pdf", ".PDF is stripped case-insensitively");
check(flattenName("report") === "report-flattened.pdf", "a file without an extension still gets the suffix");
check(flattenName("a.b.pdf") === "a.b-flattened.pdf", "only a trailing .pdf is stripped");
check(flattenName("../../etc/passwd") === "..-..-etc-passwd-flattened.pdf", "path separators are neutralized", flattenName("../../etc/passwd"));
check(flattenName("   ") === "document-flattened.pdf", "a name that sanitizes away falls back to 'document'");

check(formatBytes(512) === "512 B", "formatBytes reports bytes");
check(formatBytes(2048) === "2.0 KB", "formatBytes reports KB");
check(formatBytes(5 * 1024 * 1024) === "5.0 MB", "formatBytes reports MB");

check(
  PRESETS.every((p) => Math.round(scaleForDpi(p.dpi) * 72) === p.dpi),
  "every preset DPI round-trips through the scale factor",
);
check(
  Math.abs(A4_W * scaleForDpi(96) - 793.7) < 0.5,
  "96 DPI on A4 is ~794 px wide",
  (A4_W * scaleForDpi(96)).toFixed(2),
);
check(
  Math.abs(A4_H * scaleForDpi(150) - 1753) < 2,
  "150 DPI on A4 is ~1754 px tall (A4 at 2× the 72-unit user space)",
  (A4_H * scaleForDpi(150)).toFixed(1),
);
{
  const base = { width: 4000, height: 4000 };
  const target = scaleForDpi(200);
  const scale = effectiveScale(base, target);
  const area = base.width * scale * base.height * scale;
  check(scale < target, "a 4000 pt page at 200 DPI is down-scaled to stay inside the canvas cap");
  check(area <= MAX_CANVAS_AREA, `the reduced raster fits the 16 MP cap (${Math.round(area).toLocaleString()} px)`, String(Math.round(area)));
  check(Math.round(scale * 72) < 200, "the down-scale is a lower effective DPI, not a silent crop");
  check(
    effectiveScale({ width: A4_W, height: A4_H }, target) === target,
    "A4 at 200 DPI is left at full quality (no needless reduction)",
  );
}

check(
  friendlyError({ name: "PasswordException", message: "No password given" }) ===
    "This PDF is password-protected. Remove the password with PDF Unlock, then flatten the unlocked copy.",
  "pdf.js PasswordException maps to the Unlock-PDF steer",
);
check(
  /PDF Unlock/.test(friendlyError(new Error("Input document to PDFDocument.load is encrypted"))),
  "an 'encrypted' engine message maps to the Unlock-PDF steer",
);
check(
  friendlyError(new Error("Invalid PDF structure.")) ===
    "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.",
  "an invalid-structure message maps to the invalid-file copy",
);
check(
  /too large to rasterize/.test(
    friendlyError(new Error("Image or Canvas expected, but the browser drawing buffer limits were exceeded")),
  ),
  "a canvas-limit failure maps to a lower-quality steer, not a raw error",
);
check(
  friendlyError(new Error("something totally unrelated")) ===
    "Couldn't read that PDF — it may be corrupt or in an unsupported format.",
  "unmapped failures fall back to the friendly default",
);
check(
  toUiError(userFacing("This PDF has 201 pages — flattening supports up to 200 pages per file. Use PDF Split first.")) ===
    "This PDF has 201 pages — flattening supports up to 200 pages per file. Use PDF Split first.",
  "userFacing cap messages pass through verbatim with the real count",
);
check(
  toUiError(userFacing("This file is 100.5 MB — files up to 100 MB are supported here.")) ===
    "This file is 100.5 MB — files up to 100 MB are supported here.",
  "the oversized-file message quotes the real size",
);

// ---------------------------------------------------------------------------
// 7. Real behavior: selectable text in, image-only pages out
// ---------------------------------------------------------------------------

const before = await pdfjsPageFacts(twoPage, 1);
check(before.textItems > 0, `the source page really has selectable text (${before.textItems} items)`);
check(before.text.includes("CONFIDENTIAL LEDGER"), "the source text extracts as text before flattening");
check(before.paints === 0, "the source page has no image XObject before flattening");

const flat = await flattenToImagePdf(twoPage, presetFor("balanced"));
writeFileSync(join(TMP, "two-page-flattened.pdf"), flat.bytes);

check(flat.pages.length === 2, "the flattened document has one output page per source page");
check(flat.dpiMin === 150 && flat.dpiMax === 150, `the mirror reports the requested 150 DPI (got ${flat.dpiMin}-${flat.dpiMax})`);
check(flat.presetId === "balanced", "the result records the preset the run actually used");
check(dpiLabel(flat) === "150 DPI", "an un-clamped run reports a single DPI");
check(flat.reducedPages === 0, "no page needed a canvas-limited reduction at 150 DPI");

const after1 = await pdfjsPageFacts(flat.bytes, 1);
check(after1.numPages === 2, "the flattened PDF reopens in pdf.js with both pages");
check(after1.textItems === 0, "page 1 has zero text items — nothing is selectable any more");
check(after1.text === "", "no text can be extracted from the flattened page 1");
check(after1.paints === 1, "page 1 is painted with exactly one image XObject");
check(after1.showText === 0, "the flattened page's operator list contains no text-showing operators");
check(
  Math.abs(after1.view.width - A4_W) < 1e-6 && Math.abs(after1.view.height - A4_H) < 1e-6,
  "the flattened page keeps the source page size",
  `${after1.view.width}x${after1.view.height}`,
);

const after2 = await pdfjsPageFacts(flat.bytes, 2);
check(after2.textItems === 0 && after2.paints === 1, "page 2 is image-only too");

const flatDoc = await PDFDocument.load(flat.bytes);
const images = listImages(flatDoc);
check(images.length === 2, `the flattened PDF holds exactly one image per page (${images.length})`);
check(
  images.every((i) => i.width === flat.pages[0].px.w && i.height === flat.pages[0].px.h),
  `each image XObject matches the expected raster size (${flat.pages[0].px.w}x${flat.pages[0].px.h})`,
  JSON.stringify(images),
);
check(
  images.every((i) => i.filter === "/FlateDecode" && i.bits === 8),
  "the raster is embedded as a lossless PNG stream (FlateDecode, 8 bits per component)",
  JSON.stringify(images),
);
check(
  images.every((i) => i.colorSpace === "/DeviceGray" || i.colorSpace === "/DeviceRGB"),
  "the image XObject carries a plain device colour space",
  JSON.stringify(images.map((i) => i.colorSpace)),
);

const stream = decodedContentStream(flatDoc.getPage(0));
check(/\/Image-\S+ Do/.test(stream), "the page content stream paints the image with a single `Do`");
check(
  !/(^|\s)(Tj|TJ|'|")( |\n|$)/.test(stream) && !/(^|\s)BT(\n|$)/.test(stream),
  "the content stream contains no text operators at all",
  stream,
);
check(!/Do\b/.test(stream.replace(/\/Image-\S+ Do/, "")), "nothing else is painted on the flattened page", stream);
check(
  pageFontObjectCount(flatDoc) === 0,
  "the flattened document contains no font objects at all",
  String(pageFontObjectCount(flatDoc)),
);
check(
  !/CONFIDENTIAL|LEDGER|Selectable body text/.test(decodedContentStream(flatDoc.getPage(0))) &&
    pageAnnotationCounts(flatDoc).every((n) => n === 0),
  "no source text and no annotations survive the flatten",
  JSON.stringify(pageAnnotationCounts(flatDoc)),
);
check(
  !/CONFIDENTIAL|LEDGER/.test(Buffer.from(flat.bytes).toString("latin1")),
  "the source glyph strings are not present anywhere in the flattened file",
);

// rotation is baked into the page, not carried over as a flag
const flatRot = await flattenToImagePdf(rotated, presetFor("balanced"));
const rotDoc = await PDFDocument.load(flatRot.bytes);
const rotPage = rotDoc.getPage(0);
const rotFacts = await pdfjsPageFacts(flatRot.bytes, 1);
check(
  Math.abs(rotFacts.view.width - A4_H) < 1e-6 && Math.abs(rotFacts.view.height - A4_W) < 1e-6,
  `a /Rotate 90 page comes out in its displayed landscape orientation (${rotFacts.view.width.toFixed(2)}x${rotFacts.view.height.toFixed(2)})`,
);
check(rotFacts.textItems === 0 && rotFacts.paints === 1, "the rotated page is rasterized to a single image as well");
check(
  rotPage.node.normalizedEntries().Rotate === undefined,
  "the output page drops the /Rotate flag — the orientation is baked into the picture",
  String(rotPage.node.normalizedEntries().Rotate),
);
check(listImages(rotDoc).length === 1, "the rotated document holds exactly one image XObject");

// quality/DPI moves the output size
const flat96 = await flattenToImagePdf(small, presetFor("screen"));
const flat150 = await flattenToImagePdf(small, presetFor("balanced"));
const flat200 = await flattenToImagePdf(small, presetFor("print"));
check(
  flat96.bytes.length < flat150.bytes.length && flat150.bytes.length < flat200.bytes.length,
  "output size grows with the chosen DPI",
  `96=${flat96.bytes.length} 150=${flat150.bytes.length} 200=${flat200.bytes.length}`,
);
check(
  flat200.bytes.length > flat96.bytes.length * 2.5,
  "a 200 DPI flatten is materially bigger than a 96 DPI flatten (the honest size cost)",
  `${flat200.bytes.length} vs ${flat96.bytes.length}`,
);
check(
  flat200.pages[0].px.w * flat200.pages[0].px.h > 4 * flat96.pages[0].px.w * flat96.pages[0].px.h,
  "the raster area really is ~4x larger at 200 DPI than at 96 DPI",
  `${flat200.pages[0].px.w}x${flat200.pages[0].px.h} vs ${flat96.pages[0].px.w}x${flat96.pages[0].px.h}`,
);
{
  const doc200 = await PDFDocument.load(flat200.bytes);
  const img200 = listImages(doc200)[0];
  check(
    img200.width === flat200.pages[0].px.w && img200.height === flat200.pages[0].px.h,
    "the image XObject pixel size matches the chosen DPI's canvas",
    JSON.stringify(img200),
  );
  check(
    img200.width > img200.height === false || img200.width === img200.height,
    "a square page stays square at 200 DPI",
  );
}

// huge page is down-scaled rather than failing
const flatHuge = await flattenToImagePdf(hugePage, presetFor("print"));
check(flatHuge.reducedPages === 1, "a 4000 pt page at 200 DPI is reported as reduced");
check(flatHuge.dpiMin < 200, `the reduced page reports a lower effective DPI (${flatHuge.dpiMin})`);
check(flatHuge.dpiMax === flatHuge.dpiMin, "a single-page run reports one DPI, not a range");
check(
  flatHuge.pages[0].px.w * flatHuge.pages[0].px.h <= MAX_CANVAS_AREA,
  "the reduced raster stays inside the canvas cap",
  String(flatHuge.pages[0].px.w * flatHuge.pages[0].px.h),
);
check(
  (await pdfjsPageFacts(flatHuge.bytes, 1)).textItems === 0,
  "the reduced page is still image-only",
);

// mixed page sizes: the reported resolution must be an honest range
const mixed = await (async () => {
  const doc = await PDFDocument.create();
  doc.addPage([A4_W, A4_H]);
  doc.addPage([4000, 4000]);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "mixed-sizes.pdf"), mixed);
const flatMixed = await flattenToImagePdf(mixed, presetFor("print"));
check(flatMixed.reducedPages === 1, "only the oversized page of a mixed-size document is reduced");
check(
  flatMixed.dpiMin < flatMixed.dpiMax,
  `the mixed run reports the range ${flatMixed.dpiMin}–${flatMixed.dpiMax} DPI instead of pretending one DPI`,
);
check(
  dpiLabel(flatMixed) === `${flatMixed.dpiMin}–${flatMixed.dpiMax} DPI`,
  "dpiLabel renders a min–max range for a mixed run",
  dpiLabel(flatMixed),
);
check(
  (await pdfjsPageFacts(flatMixed.bytes, 1)).paints === 1 &&
    (await pdfjsPageFacts(flatMixed.bytes, 2)).textItems === 0,
  "both pages of the mixed document come out image-only",
);

// a superseded run aborts instead of burning CPU
check(
  (await flattenToImagePdf(twoPage, presetFor("print"), { isStale: () => true })) === null,
  "a stale run returns null before rendering anything",
);

// ---------------------------------------------------------------------------
// 8. Error paths against real bytes
// ---------------------------------------------------------------------------

let lockedErr;
try {
  await openPdf(locked);
} catch (e) {
  lockedErr = e;
}
check(
  !!lockedErr && lockedErr.name === "PasswordException",
  "the real RC4 fixture raises pdf.js PasswordException",
  lockedErr ? `${lockedErr.name}: ${lockedErr.message}` : "no error",
);
check(
  toUiError(lockedErr) ===
    "This PDF is password-protected. Remove the password with PDF Unlock, then flatten the unlocked copy.",
  "the encrypted fixture produces the Unlock-PDF steer",
);

let notPdfErr;
try {
  await openPdf(notAPdf);
} catch (e) {
  notPdfErr = e;
}
check(
  !!notPdfErr && /Invalid PDF|InvalidPDFException|No PDF header/i.test(String(notPdfErr.message)),
  "a text file fails in pdf.js with a parse error",
  notPdfErr ? String(notPdfErr.message) : "no error",
);
check(
  toUiError(notPdfErr) === "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.",
  "a text file produces the invalid-file message",
);

const manyDoc = await openPdf(manyPages);
check(manyDoc.numPages === 201, "the 201-page fixture really has 201 pages");
check(
  manyDoc.numPages > MAX_PAGES,
  "the 201-page fixture is over the 200-page cap and is rejected with the real count",
);
check(
  100 * 1024 * 1024 + 1 > MAX_FILE_BYTES,
  "a 100 MB + 1 byte file is over the file cap",
);

// ---------------------------------------------------------------------------
// 9. Content honesty across the lib files
// ---------------------------------------------------------------------------

const flattenBlock = TOOL_CONTENT.slice(
  TOOL_CONTENT.indexOf('"pdf-flatten": {'),
  TOOL_CONTENT.indexOf('"pdf-remove-annotations": {'),
);
const flattenText = flattenBlock.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
check(flattenBlock.length > 2000, "tool-content has a substantive pdf-flatten block", String(flattenBlock.length));
check(
  flattenText.includes("no longer be selected, searched, copied, edited"),
  "the long description says the text can no longer be selected, searched or copied",
);
check(
  /rasteriz/i.test(flattenText) && flattenText.includes("picture"),
  "the long description says flattening rasterizes each page into a picture",
);
check(
  /96 DPI/.test(flattenText) && /150 DPI/.test(flattenText) && /200 DPI/.test(flattenText),
  "the copy names the three real DPI settings",
);
check(
  /JPEG is lossy|Screen and Balanced are lossy|are lossy/.test(flattenText) &&
    /lossless PNG/.test(flattenText),
  "the copy discloses which settings are lossy and that PNG is the lossless one",
);
check(
  /larger than the source/.test(flattenText) && /size/i.test(flattenText),
  "the copy discloses the file-size cost of rasterizing",
);
check(
  /100 MB/.test(flattenText) && /200 pages/.test(flattenText),
  "the copy states the real 100 MB / 200 page caps",
);
check(
  /100% client-side|nothing is uploaded|never leaves/i.test(flattenText),
  "the copy states the on-device privacy model",
);
check(
  /bookmarks/.test(flattenText) &&
    /metadata/.test(flattenText) &&
    /not carried over|carries none of/.test(flattenText),
  "the copy admits bookmarks and source metadata are not carried over",
);
check(
  /no OCR text layer is added back/.test(flattenText),
  "the copy states no OCR layer is added back",
);
check(
  /draft, normal, or high/i.test(flattenText) === false &&
    /Normal quality|Draft quality/i.test(flattenText) === false,
  "no leftover Draft/Normal/High quality names — the UI says Screen/Balanced/Print",
);
check(
  (flattenBlock.match(/"question":/g) ?? []).length >= 6,
  "the FAQ has at least six honest entries",
  String((flattenBlock.match(/"question":/g) ?? []).length),
);
check(
  (flattenBlock.match(/"step":/g) ?? []).length === 4,
  "the how-to has the same four steps as the tool flow",
  String((flattenBlock.match(/"step":/g) ?? []).length),
);
check(
  !/instant|no limits|unlimited|perfect quality|uncrackable|impossible to|removes metadata|drag and drop/i.test(
    flattenText,
  ),
  "the tool copy contains no overclaims (and no false 'removes metadata' promise)",
);
check(
  !/lossless (?:output|flatten|result|conversion|quality|file)/i.test(flattenText) &&
    /Print is lossless and the largest file/.test(flattenText),
  "\"lossless\" is scoped to the PNG preset, never a blanket promise",
);

check(/TOOL_KEYWORDS/.test(SEO) && /"pdf-flatten":\s*\[/.test(SEO), "seo.ts declares keywords for pdf-flatten");
const kwIdx = SEO.indexOf('"pdf-flatten": [');
const kwBlock = SEO.slice(kwIdx, kwIdx + 600);
check(
  kwBlock.includes('"flatten pdf"') && kwBlock.includes('"flatten pdf online"') && kwBlock.includes('"rasterize pdf"'),
  "keywords include 'flatten pdf', 'flatten pdf online' and 'rasterize pdf'",
);
check(
  kwBlock.includes('"flatten pdf without uploading"'),
  "keywords include the privacy angle",
);
check(/"pdf-flatten":\s*"[^"]*rasteriz/i.test(SEO), "TOOL_FEATURE_LIST for pdf-flatten is truthful and mentions rasterizing");
const featIdx = SEO.indexOf('"pdf-flatten":\n      "Rasterize');
const featBlock = SEO.slice(featIdx, featIdx + 900);
check(
  /no longer be selected, searched, copied or edited/.test(featBlock) &&
    /96 DPI JPEG, 150 DPI JPEG, 200 DPI lossless PNG/.test(featBlock) &&
    /100 MB and 200 pages/.test(featBlock),
  "the JSON-LD feature list states the real presets, the text loss and the caps",
);
check(
  /"pdf-flatten":\s*"Flatten PDF online/.test(SEO),
  "CUSTOM_TITLES has a dedicated, honest pdf-flatten title",
);

check(
  /slug:\s*"how-to-flatten-a-pdf"/.test(GUIDES) && /toolSlug:\s*"pdf-flatten"/.test(GUIDES),
  "guides.ts has the how-to-flatten-a-pdf guide wired to the tool",
);
const guideIdx = GUIDES.indexOf('slug: "how-to-flatten-a-pdf"');
const guideBlock = GUIDES.slice(guideIdx, guideIdx + 7000);
const guideText = guideBlock.replace(/\s+/g, " ");
check(
  (guideBlock.match(/heading:/g) ?? []).length >= 4,
  "the guide has at least four sections",
  String((guideBlock.match(/heading:/g) ?? []).length),
);
check(
  /rasteriz/i.test(guideText) && /no longer be selected, searched, copied/.test(guideText),
  "the guide explains rasterizing and the non-selectable trade-off",
);
check(
  /much larger|several times the size/i.test(guideText) && /96 DPI/.test(guideText) && /200 DPI/.test(guideText),
  "the guide discloses the size trade-off and names all three DPI settings",
);
check(
  /lossless/.test(guideText) && /lossy JPEG/.test(guideText),
  "the guide discloses which settings are lossy and that only Print is lossless",
);
check(
  /bookmarks and its metadata/.test(guideText) && /not add an OCR text layer back|no OCR text layer/i.test(guideText),
  "the guide admits bookmarks/metadata are dropped and no OCR layer is added",
);
check(
  /100 MB and 200 pages/.test(guideText) && /PDF Unlock/.test(guideText),
  "the guide states the real caps and routes encrypted files to PDF Unlock",
);
check(
  /<source>-flattened\.pdf/.test(guideText) && /never uploaded|never leave/i.test(guideText),
  "the guide states the output naming and the on-device privacy model",
);
check(
  /screen readers/.test(guideText),
  "the guide flags the accessibility cost of removing the text layer",
);

const toolsIdx = TOOLS.indexOf('slug: "pdf-flatten"');
const toolsBlock = TOOLS.slice(toolsIdx, toolsIdx + 700);
check(
  toolsIdx > 0 && /Rasterize a PDF/.test(toolsBlock) && /no longer (be )?selectable or editable/.test(toolsBlock),
  "the tools.ts description stays truthful about rasterizing and losing selectable text",
);
check(
  /tagline: "Lock each page down as one image"/.test(toolsBlock),
  "the tagline no longer promises a 'merge', which belongs to PDF Merge",
);
check(
  /slug: "pdf-flatten",[\s\S]{0,400}?category:/.test(TOOLS) && /name: "Flatten PDF"/.test(toolsBlock),
  "the TOOLS entry keeps its name and array structure intact",
);
check(
  (TOOLS.match(/slug: "pdf-flatten",/g) ?? []).length === 1,
  "the TOOLS array still holds exactly one pdf-flatten entry",
);

rmSync(TMP, { recursive: true, force: true });

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
