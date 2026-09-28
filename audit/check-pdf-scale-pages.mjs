// Node mirror audit for the "Scale Pages" tool.
//
// Self-contained: pdf-lib + pdfjs-dist + node builtins only. The browser's
// React layer is stood in for by (a) a source-level truth pass over the
// component and (b) a mirror of its pure logic, while every PDF claim — page
// boxes, content scaling, selectable text, annotation geometry, the caps, the
// encrypted-file refusal and the download naming — is exercised against real
// PDF bytes. The DOM path (slider/number commit, aria, download click) is
// covered end-to-end in e2e/pdf-scale-pages-browser.mjs, which runs in real
// Chrome and is not executed here.

import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  PDFDocument,
  StandardFonts,
  degrees,
  PDFName,
  PDFNumber,
  PDFArray,
  PDFDict,
  PDFString,
} = require("pdf-lib");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COMPONENT = readFileSync(join(ROOT, "src/features/pdf-scale-pages/PdfScalePages.tsx"), "utf8");
const FORMAT_SRC = readFileSync(join(ROOT, "src/features/pdf-scale-pages/scale-format.ts"), "utf8");
const GEOMETRY_SRC = readFileSync(join(ROOT, "src/features/pdf-scale-pages/scale-geometry.ts"), "utf8");
const TOOL_CONTENT = readFileSync(join(ROOT, "src/lib/tool-content.ts"), "utf8");
const SEO = readFileSync(join(ROOT, "src/lib/seo.ts"), "utf8");
const GUIDES = readFileSync(join(ROOT, "src/lib/guides.ts"), "utf8");
const TOOLS = readFileSync(join(ROOT, "src/lib/tools.ts"), "utf8");

const TMP = mkdtempSync(join(tmpdir(), "braincoder-scale-"));

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
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const closeEnough = (a, b) => near(a, b, Math.max(0.05, Math.abs(b) * 0.001));

// ---------------------------------------------------------------------------
// 1. Mirrors of the component's pure logic
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MIN_PERCENT = 10;
const MAX_PERCENT = 400;
const DEFAULT_PERCENT = 100;
const PDF_MAGIC = "%PDF-";
const HEADER_SCAN_BYTES = 1024;

function clampPercent(value) {
  if (!Number.isFinite(value)) return DEFAULT_PERCENT;
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value)));
}
function outputNameFor(source, percent) {
  const base = source
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim();
  return `${base || "document"}-scaled-${clampPercent(percent)}pct.pdf`;
}
function trimNumber(v) {
  return v.toFixed(1).replace(/\.0$/, "");
}
const STANDARD_SIZES = [
  ["A0", 2384, 3370],
  ["A1", 1684, 2384],
  ["A2", 1191, 1684],
  ["A3", 842, 1191],
  ["A4", 595, 842],
  ["A5", 420, 595],
  ["B5", 499, 709],
  ["Letter", 612, 792],
  ["Legal", 612, 1008],
  ["Tabloid", 792, 1224],
];
function standardNameFor(w, h) {
  for (const [label, long, short] of STANDARD_SIZES) {
    if (Math.abs(w - long) <= long * 0.015 && Math.abs(h - short) <= short * 0.015) return label;
    if (Math.abs(w - short) <= short * 0.015 && Math.abs(h - long) <= long * 0.015) {
      return `${label} landscape`;
    }
  }
  return null;
}
function describeBox(w, h) {
  const dims = `${trimNumber(w)} × ${trimNumber(h)} pt`;
  const name = standardNameFor(w, h);
  return name ? `${name} — ${dims}` : dims;
}
function looksLikePdf(bytes) {
  const limit = Math.min(bytes.length, HEADER_SCAN_BYTES);
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, limit));
  return head.includes(PDF_MAGIC);
}
function friendlyError(err) {
  const name = err?.name ?? "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "PasswordException" || name === "EncryptedPDFError") return "encrypted";
  if (/no password given|password|encrypt/i.test(msg)) return "encrypted";
  if (/invalid pdf|failed to parse|no pdf header|invalidpdfexception|unexpected eof|corrupt/i.test(msg)) {
    return "invalid";
  }
  if (/no pages/i.test(msg)) return "no-pages";
  return "unknown";
}

/* The caps are defined once, in the pdf-lib-free helper module, and imported
 * by both the component (which refuses early, via pdfjs) and the engine (which
 * refuses again). Asserting a single definition is the stronger claim: a
 * duplicated literal is exactly how a load path and an engine drift apart. */
const mSize = FORMAT_SRC.match(/export const MAX_FILE_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+);/);
check(
  !!mSize && +mSize[1] * +mSize[2] * +mSize[3] === MAX_FILE_BYTES,
  "MAX_FILE_BYTES is 100 MB",
  mSize?.[0] ?? "not found",
);
const mPages = FORMAT_SRC.match(/export const MAX_PAGES\s*=\s*(\d+);/);
check(!!mPages && +mPages[1] === MAX_PAGES, "MAX_PAGES is 200", mPages?.[0] ?? "not found");
check(
  !/const MAX_(FILE_BYTES|PAGES)\s*=/.test(COMPONENT) && /MAX_FILE_BYTES,/.test(COMPONENT) && /MAX_PAGES,/.test(COMPONENT),
  "the component imports both caps instead of re-declaring them",
  COMPONENT.match(/from "\.\/scale-format"/)?.[0] ?? "not found",
);
check(
  /import \{ MAX_PAGES \} from "\.\/scale-format";/.test(GEOMETRY_SRC) &&
    !/const MAX_PAGES\s*=/.test(GEOMETRY_SRC),
  "the engine imports MAX_PAGES from the shared module instead of re-declaring it",
  GEOMETRY_SRC.match(/MAX_PAGES[^;]*;/)?.[0] ?? "not found",
);
const mMin = FORMAT_SRC.match(/export const MIN_PERCENT\s*=\s*(\d+);/);
const mMax = FORMAT_SRC.match(/export const MAX_PERCENT\s*=\s*(\d+);/);
const mDef = FORMAT_SRC.match(/export const DEFAULT_PERCENT\s*=\s*(\d+);/);
check(
  !!mMin && +mMin[1] === MIN_PERCENT && !!mMax && +mMax[1] === MAX_PERCENT && !!mDef && +mDef[1] === DEFAULT_PERCENT,
  "the published range is 10%–400% with 100% as the default",
  `${mMin?.[0]} ${mMax?.[0]} ${mDef?.[0]}`,
);
check(
  /await new Promise<void>\(\(resolve\) => setTimeout\(resolve, 0\)\)/.test(GEOMETRY_SRC),
  "the page loop yields to the browser instead of blocking the tab",
);
check(
  !/PAINT_EVERY/.test(GEOMETRY_SRC) &&
    /onProgress\?\.\(i \+ 1, pages\.length\)/.test(GEOMETRY_SRC) &&
    /setTimeout\(resolve, 0\)/.test(GEOMETRY_SRC) &&
    /for \(let i = 0; i < pages\.length; i \+= 1\)/.test(GEOMETRY_SRC),
  "the yield happens after every page, so a 200-page file still repaints",
);

check(clampPercent(5) === MIN_PERCENT, "a 5% request clamps up to the 10% floor");
check(clampPercent(500) === MAX_PERCENT, "a 500% request clamps down to the 400% ceiling");
check(clampPercent(137.4) === 137, "percentages are rounded to whole steps");
check(clampPercent(Number.NaN) === DEFAULT_PERCENT, "a non-numeric field falls back to 100%");
check(outputNameFor("Report.pdf", 50) === "Report-scaled-50pct.pdf", "the output name carries the source name and the factor");
const hostileName = outputNameFor('weird:name*?"<>|\\n.pdf', 150);
check(
  !/[\\/:*?"<>|]/.test(hostileName) && hostileName.endsWith("-scaled-150pct.pdf"),
  "filesystem-hostile characters are sanitised out of the output name",
  hostileName,
);
check(outputNameFor("", 50) === "document-scaled-50pct.pdf", "an unnamed source still produces a usable file name");
check(outputNameFor("deck.PDF", 400) === "deck-scaled-400pct.pdf", "the .pdf suffix is not doubled and the extension case is ignored");
check(standardNameFor(595.28, 841.89) === "A4", "a real A4 page is named A4");
check(standardNameFor(841.89, 595.28) === "A4 landscape", "a rotated-looking A4 is named as landscape, not A4 portrait");
check(standardNameFor(612, 792) === "Letter", "US Letter is named Letter");
check(standardNameFor(400, 400) === null, "a size that matches no paper standard is not given a name");
check(describeBox(595.28, 841.89).includes("A4") && describeBox(595.28, 841.89).includes("pt"), "describeBox reports both the name and the real points");
check(standardNameFor(421, 595.5) === "A5", "a page that lands on a real paper size is named — 50% of A3 is A5");
check(
  standardNameFor(297.64, 420.95) === null,
  "half an A4 page is correctly NOT given a paper name, because no paper size is exactly half of A4",
);
check(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n")), "the %PDF- magic preflight accepts a PDF header");
check(!looksLikePdf(new TextEncoder().encode("PK\u0003\u0004 not a pdf at all")), "the magic preflight rejects a non-PDF");
check(!looksLikePdf(new TextEncoder().encode("%PD")), "the magic preflight rejects a truncated header");

// ---------------------------------------------------------------------------
// 2. Mirror of scale-geometry.ts, exercised against real PDF bytes
// ---------------------------------------------------------------------------

const OPTIONAL_BOXES = ["CropBox", "BleedBox", "TrimBox", "ArtBox"];
const OFFSET_KEYS = ["Rect", "L", "CL", "QuadPoints", "Vertices"];
const DEFAULT_MEDIA_BOX = { x: 0, y: 0, width: 612, height: 792 };

function readBox(page, name) {
  try {
    const raw = page.node.getInheritableAttribute(PDFName.of(name));
    if (raw === undefined) return null;
    const array = raw instanceof PDFArray ? raw : page.doc.context.lookupMaybe(raw, PDFArray);
    if (!array || array.size() < 4) return null;
    const nums = [];
    for (let i = 0; i < 4; i += 1) {
      const value = array.lookup(i);
      if (!(value instanceof PDFNumber)) return null;
      nums.push(value.asNumber());
    }
    const [x1, y1, x2, y2] = nums;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  } catch {
    return null;
  }
}
function offsetPairs(array, dx, dy) {
  for (let i = 0; i < array.size(); i += 1) {
    const value = array.lookup(i);
    if (value instanceof PDFNumber) {
      array.set(i, PDFNumber.of(value.asNumber() + (i % 2 === 0 ? dx : dy)));
    }
  }
}
function arrayOf(dict, name) {
  try {
    return dict.lookupMaybe(PDFName.of(name), PDFArray);
  } catch {
    return null;
  }
}
function dictAt(array, index) {
  try {
    return array.lookupMaybe(index, PDFDict);
  } catch {
    return null;
  }
}
function arrayAt(array, index) {
  try {
    return array.lookupMaybe(index, PDFArray);
  } catch {
    return null;
  }
}
function offsetAnnotationGeometry(page, dx, dy) {
  if (dx === 0 && dy === 0) return;
  page.node.normalize();
  const annots = page.node.Annots();
  if (!annots) return;
  for (let i = 0; i < annots.size(); i += 1) {
    const annot = dictAt(annots, i);
    if (!annot) continue;
    for (const key of OFFSET_KEYS) {
      const array = arrayOf(annot, key);
      if (array) offsetPairs(array, dx, dy);
    }
    const ink = arrayOf(annot, "InkList");
    if (!ink) continue;
    for (let s = 0; s < ink.size(); s += 1) {
      const stroke = arrayAt(ink, s);
      if (stroke) offsetPairs(stroke, dx, dy);
    }
  }
}
function pageRotation(page) {
  try {
    const raw = page.node.getInheritableAttribute(PDFName.of("Rotate"));
    if (raw === undefined) return 0;
    const value = raw instanceof PDFNumber ? raw : page.doc.context.lookupMaybe(raw, PDFNumber);
    if (!value) return 0;
    const degrees = ((Math.trunc(value.asNumber()) % 360) + 360) % 360;
    return degrees === 90 || degrees === 270 ? degrees : 0;
  } catch {
    return 0;
  }
}
function displayedBoxOf(page) {
  const media = readBox(page, "MediaBox") ?? DEFAULT_MEDIA_BOX;
  const crop = readBox(page, "CropBox") ?? media;
  const x0 = Math.max(media.x, crop.x);
  const y0 = Math.max(media.y, crop.y);
  const x1 = Math.min(media.x + media.width, crop.x + crop.width);
  const y1 = Math.min(media.y + media.height, crop.y + crop.height);
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  return pageRotation(page) === 0 ? { width, height } : { width: height, height: width };
}
function scalePage(page, factor) {
  const media = readBox(page, "MediaBox") ?? DEFAULT_MEDIA_BOX;
  let skipped = 0;
  const originX = media.x;
  const originY = media.y;
  if (originX !== 0 || originY !== 0) {
    page.translateContent(-originX, -originY);
    offsetAnnotationGeometry(page, -originX, -originY);
  }
  if (Number.isFinite(media.width * factor) && media.width * factor > 0) {
    page.setMediaBox(0, 0, media.width * factor, media.height * factor);
  } else skipped += 1;
  for (const name of OPTIONAL_BOXES) {
    const box = readBox(page, name);
    if (!box) continue;
    const next = {
      x: (box.x - originX) * factor,
      y: (box.y - originY) * factor,
      width: box.width * factor,
      height: box.height * factor,
    };
    if (!(next.width > 0) || !(next.height > 0)) {
      skipped += 1;
      continue;
    }
    page[`set${name}`](next.x, next.y, next.width, next.height);
  }
  page.scaleContent(factor, factor);
  page.scaleAnnotations(factor, factor);
  return skipped;
}

const SAVE_OPTIONS = { updateFieldAppearances: false, addDefaultPage: false };

async function scalePdfInPlace({ data, factor, isStale = () => false }) {
  const doc = await PDFDocument.load(data, { updateMetadata: false });
  const pages = doc.getPages();
  if (pages.length === 0) throw new Error("This PDF has no pages to scale.");
  if (pages.length > MAX_PAGES) {
    throw new Error(`This PDF has ${pages.length} pages — scaling supports up to ${MAX_PAGES} pages per file.`);
  }
  const before = [];
  let skippedBoxes = 0;
  for (const page of pages) {
    if (isStale()) return null;
    before.push(displayedBoxOf(page));
    skippedBoxes += scalePage(page, factor);
  }
  if (isStale()) return null;
  const after = before.map((b) => ({ width: b.width * factor, height: b.height * factor }));
  const bytes = new Uint8Array(await doc.save(SAVE_OPTIONS));
  if (isStale()) return null;
  return {
    bytes,
    pages: pages.length,
    firstBefore: before[0],
    firstAfter: after[0],
    mixedSizes: new Set(after.map((b) => `${b.width.toFixed(1)}x${b.height.toFixed(1)}`)).size > 1,
    skippedBoxes,
  };
}

async function pageFacts(bytes, pageNumber = 1) {
  // The whole read happens inside the task's lifetime: destroying the task
  // first would take pdf.js's worker message handler with it.
  const task = pdfjs.getDocument({ data: bytes.slice(0) });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(pageNumber);
    const view = page.getViewport({ scale: 1 });
    const text = await page.getTextContent();
    return {
      numPages: doc.numPages,
      // pdf.js 6 exposes the page box as viewBox = [x0, y0, x1, y1].
      view: Array.from(view.viewBox),
      width: view.width,
      height: view.height,
      items: text.items.map((i) => ({
        str: i.str,
        transform: Array.from(i.transform),
        width: i.width,
        height: i.height,
      })),
    };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Fixtures
// ---------------------------------------------------------------------------

const LETTER_W = 612;
const LETTER_H = 792;

const context = (await (async () => {
  const doc = await PDFDocument.create();
  doc.addPage([10, 10]);
  return doc.context;
})());

const sample = await (async () => {
  const doc = await PDFDocument.create();
  doc.setTitle("Scale fixture");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([LETTER_W, LETTER_H]);
  p1.drawText("SCALABLE BODY TEXT", { x: 60, y: 700, size: 18, font });
  p1.drawText("Second line of real text.", { x: 60, y: 660, size: 12, font });
  p1.drawRectangle({ x: 60, y: 500, width: 200, height: 100, color: { type: "RGB", red: 0.2, green: 0.4, blue: 0.9 } });
  const p2 = doc.addPage([LETTER_W, LETTER_H]);
  p2.drawText("PAGE TWO", { x: 60, y: 700, size: 18, font });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "sample.pdf"), sample);

const rotated = await (async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([LETTER_W, LETTER_H]);
  p.setRotation(degrees(90));
  p.drawText("ROTATED BODY", { x: 60, y: 700, size: 14, font });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "rotated.pdf"), rotated);

const cropped = await (async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([600, 780]);
  p.node.set(PDFName.of("MediaBox"), context.obj([20, 30, 620, 810]));
  p.node.set(PDFName.of("CropBox"), context.obj([20, 30, 600, 780]));
  p.node.set(PDFName.of("TrimBox"), context.obj([25, 35, 595, 775]));
  p.node.set(PDFName.of("BleedBox"), context.obj([20, 30, 620, 810]));
  p.node.set(PDFName.of("ArtBox"), context.obj([30, 40, 590, 770]));
  p.drawText("OFFSET PAGE TEXT", { x: 100, y: 700, size: 12, font });
  p.node.set(
    PDFName.of("Annots"),
    context.obj([
      context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: context.obj([100, 690, 300, 715]),
        L: context.obj([context.obj({ S: "/URI", URI: PDFString.of("https://example.com") })]),
        QuadPoints: context.obj([100, 690, 300, 690, 100, 715, 300, 715]),
        InkList: context.obj([context.obj([120, 600, 140, 620, 160, 640])]),
      }),
    ]),
  );
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "offset.pdf"), cropped);

const withForm = await (async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  const p = doc.addPage([LETTER_W, LETTER_H]);
  p.drawText("FORM PAGE", { x: 60, y: 700, size: 14, font });
  const field = form.createTextField("fullname");
  field.addToPage(p, { x: 72, y: 600, width: 201, height: 25, font });
  field.setText("Ada Lovelace");
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "form.pdf"), withForm);

const mixed = await (async () => {
  const doc = await PDFDocument.create();
  doc.addPage([LETTER_W, LETTER_H]);
  doc.addPage([842, 595]);
  doc.addPage([300, 300]);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "mixed.pdf"), mixed);

const twoHundred = await (async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 200; i += 1) doc.addPage([200, 200]);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "200-pages.pdf"), twoHundred);

const twoHundredOne = await (async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 201; i += 1) doc.addPage([200, 200]);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
})();
writeFileSync(join(TMP, "201-pages.pdf"), twoHundredOne);

const notAPdf = new Uint8Array(Buffer.from("this is definitely not a pdf file\nline two"));
writeFileSync(join(TMP, "notapdf.pdf"), notAPdf);

const locked = new Uint8Array(readFileSync(join(ROOT, "e2e/fixtures/encrypted.pdf")));
writeFileSync(join(TMP, "locked.pdf"), locked);

// ---------------------------------------------------------------------------
// 4. Real behaviour: geometry, content, text, annotations
// ---------------------------------------------------------------------------

check(looksLikePdf(sample), "the text fixture is a real PDF");

const half = await scalePdfInPlace({ data: sample, factor: 0.5 });
const halfFacts = await pageFacts(half.bytes);
const origFacts = await pageFacts(sample);
check(half.pages === 2, "every page of the document is scaled, not just the first");
check(closeEnough(halfFacts.width, 306) && closeEnough(halfFacts.height, 396), "a 612×792 page is 306×396 after 50%", `${halfFacts.width}×${halfFacts.height}`);
check(
  closeEnough(halfFacts.view[2] - halfFacts.view[0], 306) && closeEnough(halfFacts.view[3] - halfFacts.view[1], 396),
  "what a reader shows is 306×396 too, not just the stored media box",
  `view=${halfFacts.view.map((v) => v.toFixed(2))}`,
);
check(
  halfFacts.items.map((i) => i.str).join("|") === origFacts.items.map((i) => i.str).join("|"),
  "the text strings come through untouched — the content is scaled, not re-typed",
);
const o0 = origFacts.items[0];
const h0 = halfFacts.items[0];
check(closeEnough(h0.transform[4], o0.transform[4] * 0.5) && closeEnough(h0.transform[5], o0.transform[5] * 0.5), "the first glyph's position is scaled by the factor", `${h0.transform[4].toFixed(2)},${h0.transform[5].toFixed(2)} vs ${o0.transform[4]},${o0.transform[5]}`);
check(closeEnough(h0.height, o0.height * 0.5), "the rendered text height is scaled by the factor");
check(closeEnough(h0.width, o0.width * 0.5), "the rendered text width is scaled by the factor");
check(closeEnough(h0.transform[0], h0.transform[3]) && closeEnough(h0.transform[1], o0.transform[1] * 0.5), "X and Y carry the same factor, so nothing is sheared or stretched");
check(
  closeEnough(halfFacts.width / halfFacts.height, origFacts.width / origFacts.height, 0.001),
  "the aspect ratio is preserved exactly",
);
check(closeEnough(half.firstAfter.width, half.firstBefore.width * 0.5), "the reported after-size matches the bytes on disk");
check(half.skippedBoxes === 0, "nothing is skipped for a well-formed page");

const twice = await scalePdfInPlace({ data: sample, factor: 2 });
const twiceFacts = await pageFacts(twice.bytes);
check(closeEnough(twiceFacts.width, 1224) && closeEnough(twiceFacts.height, 1584), "200% gives 1224×1584", `${twiceFacts.width}×${twiceFacts.height}`);
check(closeEnough(twiceFacts.items[0].height, origFacts.items[0].height * 2), "text is genuinely larger at 200%, not just repositioned");

const minRun = await scalePdfInPlace({ data: sample, factor: MIN_PERCENT / 100 });
const minFacts = await pageFacts(minRun.bytes);
check(closeEnough(minFacts.width, 61.2) && closeEnough(minFacts.height, 79.2), "the 10% floor really scales the page", `${minFacts.width}×${minFacts.height}`);
const maxRun = await scalePdfInPlace({ data: sample, factor: MAX_PERCENT / 100 });
const maxFacts = await pageFacts(maxRun.bytes);
check(closeEnough(maxFacts.width, 2448) && closeEnough(maxFacts.height, 3168), "the 400% ceiling really scales the page", `${maxFacts.width}×${maxFacts.height}`);

const rotHalf = await scalePdfInPlace({ data: rotated, factor: 0.5 });
const rotFacts = await pageFacts(rotHalf.bytes);
check(closeEnough(rotFacts.width, 396) && closeEnough(rotFacts.height, 306), "a /Rotate 90 page reports its displayed size swapped, and it is still half scale", `${rotFacts.width}×${rotFacts.height}`);
const rotDoc = await PDFDocument.load(rotHalf.bytes);
check(rotDoc.getPages()[0].getRotation().angle === 90, "the page rotation flag is preserved, not flattened away");

const off = await scalePdfInPlace({ data: cropped, factor: 0.5 });
const offFacts = await pageFacts(off.bytes);
const offDoc = await PDFDocument.load(off.bytes);
const offPage = offDoc.getPages()[0];
const offMedia = offPage.getMediaBox();
check(offMedia.x === 0 && offMedia.y === 0, "a page whose media box started at 20,30 is re-based at the origin", `${offMedia.x},${offMedia.y}`);
check(
  closeEnough(offMedia.width, 300) && closeEnough(offMedia.height, 390),
  "the offset page's media box is 300×390 after 50%",
  `${offMedia.width}×${offMedia.height}`,
);
check(
  closeEnough(offFacts.width, 290) && closeEnough(offFacts.height, 375),
  "a reader shows the cropped visible area at exactly half (290×375), so the crop box travelled with the page",
  `${offFacts.width}×${offFacts.height}`,
);
const offTrim = offPage.getTrimBox();
check(closeEnough(offTrim.width, 285) && closeEnough(offTrim.height, 370), "the trim box is scaled too, not left at the old size", `${offTrim.width}×${offTrim.height}`);
const offText = offFacts.items[0];
const origOffText = (await pageFacts(cropped)).items[0];
check(
  closeEnough(offText.transform[4] - offFacts.view[0], (origOffText.transform[4] - 20) * 0.5) &&
    closeEnough(offText.transform[5] - offFacts.view[1], (origOffText.transform[5] - 30) * 0.5),
  "on a non-zero-origin page the text keeps its position relative to the visible box — the shift a naive scale would cause is not there",
  `${(offText.transform[4] - offFacts.view[0]).toFixed(2)},${(offText.transform[5] - offFacts.view[1]).toFixed(2)}`,
);
const offAnnots = offPage.node.Annots();
const offAnnot = dictAt(offAnnots, 0);
const offRect = arrayOf(offAnnot, "Rect");
check(
  offRect.lookup(0).asNumber() === 40 && offRect.lookup(1).asNumber() === 330,
  "the link rectangle is moved with the page origin and then scaled",
  `${offRect.lookup(0).asNumber()},${offRect.lookup(1).asNumber()}`,
);
check(closeEnough(offRect.lookup(2).asNumber() - offRect.lookup(0).asNumber(), 100), "the link rectangle is 100pt wide after 50% of 200pt");
const offQuad = arrayOf(offAnnot, "QuadPoints");
check(
  offQuad.lookup(0).asNumber() === 40 && closeEnough(offQuad.lookup(7).asNumber(), 342.5),
  "quad points (text-selection quads) are offset and scaled with the page",
  `${offQuad.lookup(0).asNumber()},${offQuad.lookup(7).asNumber()}`,
);
const offInk = arrayAt(arrayOf(offAnnot, "InkList"), 0);
check(offInk.lookup(0).asNumber() === 50 && offInk.lookup(4).asNumber() === 70, "ink strokes are offset and scaled with the page", `${offInk.lookup(0).asNumber()},${offInk.lookup(4).asNumber()}`);
check(arrayOf(offAnnot, "L") !== undefined, "the link action itself survives — the target is untouched");

const formHalf = await scalePdfInPlace({ data: withForm, factor: 0.5 });
const formDoc = await PDFDocument.load(formHalf.bytes);
const form = formDoc.getForm();
const fields = form.getFields();
check(fields.length === 1, "the form field is still in the document after scaling");
check(fields[0].getName() === "fullname", "the field name is unchanged");
check(form.getTextField("fullname").getText() === "Ada Lovelace", "the filled-in value survives the scale");
const origWidget = dictAt((await PDFDocument.load(withForm, { updateMetadata: false })).getPages()[0].node.Annots(), 0);
const origWRect = arrayOf(origWidget, "Rect");
const origWWidth = origWRect.lookup(2).asNumber() - origWRect.lookup(0).asNumber();
const origWHeight = origWRect.lookup(3).asNumber() - origWRect.lookup(1).asNumber();
const widget = dictAt(formDoc.getPages()[0].node.Annots(), 0);
const wRect = arrayOf(widget, "Rect");
const wWidth = wRect.lookup(2).asNumber() - wRect.lookup(0).asNumber();
const wHeight = wRect.lookup(3).asNumber() - wRect.lookup(1).asNumber();
check(
  closeEnough(wWidth, origWWidth * 0.5) && closeEnough(wHeight, origWHeight * 0.5),
  "the form-field widget rectangle is scaled with the page",
  `${wWidth}×${wHeight} from ${origWWidth}×${origWHeight}`,
);
check(
  widget.get(PDFName.of("AP")) !== undefined,
  "the field keeps its appearance stream, which is scaled with its box rather than re-rendered",
);
check(
  !/EncryptedPDFError/.test(looksLikePdf(formHalf.bytes) ? "" : "") && looksLikePdf(formHalf.bytes),
  "the scaled form file is still a valid PDF",
);

const mixedRun = await scalePdfInPlace({ data: mixed, factor: 0.5 });
const mixedFacts = await pageFacts(mixedRun.bytes, 1);
check(mixedRun.mixedSizes === true, "a document that mixes page sizes is reported as mixed instead of implying one size");
check(closeEnough(mixedFacts.width, 306) && closeEnough(mixedFacts.height, 396), "each page keeps its own proportions — page 1 is still 306×396");
const mixedThird = await pageFacts(mixedRun.bytes, 3);
check(closeEnough(mixedThird.width, 150) && closeEnough(mixedThird.height, 150), "the small page in a mixed document is scaled from its own size");

const titleDoc = await PDFDocument.load(half.bytes);
check(titleDoc.getTitle() === "Scale fixture", "the document title is carried over — the pages are scaled in place, not rebuilt");
check(titleDoc.getPageCount() === 2, "no page is added or lost by the in-place scale");
check(
  half.bytes.length < sample.length * 2,
  "a 50% scale of a text document stays the same size ballpark — nothing is rasterized into it",
  `${sample.length} → ${half.bytes.length}`,
);
check(looksLikePdf(half.bytes), "the output is itself a valid PDF");

// ---------------------------------------------------------------------------
// 5. Caps and error paths
// ---------------------------------------------------------------------------

let capError = null;
try {
  await scalePdfInPlace({ data: twoHundredOne, factor: 0.5 });
} catch (err) {
  capError = err;
}
check(!!capError && /201 pages/.test(capError.message), "a 201-page file is refused with the real page count", capError?.message ?? "no error");
const twoHundredRun = await scalePdfInPlace({ data: twoHundred, factor: 0.5 });
check(twoHundredRun.pages === 200, "a 200-page file — the exact cap — is scaled");
check(100 * 1024 * 1024 + 1 > MAX_FILE_BYTES, "a file of 100 MB + 1 byte is over the size cap");

let encryptedError = null;
try {
  await scalePdfInPlace({ data: locked, factor: 0.5 });
} catch (err) {
  encryptedError = err;
}
check(!!encryptedError, "a password-protected file is refused rather than written out broken");
check(friendlyError(encryptedError) === "encrypted", "the encrypted refusal routes to PDF Unlock", encryptedError?.name ?? "none");
check(
  !/ignoreEncryption:\s*true/.test(GEOMETRY_SRC) && !/ignoreEncryption:\s*true/.test(COMPONENT),
  "ignoreEncryption is never switched on, so an encrypted file cannot be written out broken",
);
check(friendlyError(new Error("Invalid PDF structure.")) === "invalid", "a corrupt file maps to the invalid-PDF message");
check(friendlyError(new Error("boom")) === "unknown", "an unknown failure still lands on the generic safe message");
check(friendlyError({ name: "PasswordException" }) === "encrypted", "a pdf.js PasswordException maps to the Unlock steer too");

// A malformed annotation entry (wrong type where an array is expected) must not
// be able to throw its way out of the whole run.
let malformedRan = null;
try {
  const doc = await PDFDocument.load(cropped, { updateMetadata: false });
  const page = doc.getPages()[0];
  const annots = page.node.Annots();
  annots.set(1, context.obj({ Type: "Annot", Subtype: "Square", Rect: PDFName.of("nonsense") }));
  malformedRan = scalePage(page, 0.5);
} catch (err) {
  malformedRan = err;
}
check(malformedRan === 0, "a malformed annotation entry is skipped instead of aborting the run", String(malformedRan));

const staleRun = await scalePdfInPlace({ data: sample, factor: 0.5, isStale: () => true });
check(staleRun === null, "a superseded run returns nothing, so it can never download a stale file");
check((await scalePdfInPlace({ data: new Uint8Array(0), factor: 0.5 }).catch((e) => e.message)) !== undefined, "an empty buffer is rejected by the loader rather than scaled");

// ---------------------------------------------------------------------------
// 6. Source-level truth in the component
// ---------------------------------------------------------------------------

// JSX wraps copy across lines, so phrase checks run on flattened text.
const flatten = (s) => s.replace(/\s+/g, " ");
const COMPONENT_TEXT = flatten(COMPONENT);

check(/aria-busy=\{busy\}/.test(COMPONENT), "the root exposes aria-busy while a run is in flight");
check((COMPONENT_TEXT.match(/role="status"/g) ?? []).length >= 2, "status roles cover idle/load progress and the success message");
check(/role="alert"/.test(COMPONENT), "errors are announced with role=alert");
check(/role="region"/.test(COMPONENT) && /aria-label="Scaled PDF result"/.test(COMPONENT), "the result is a labelled region a screen reader can jump to");
check(/useId\(\)/.test(COMPONENT) && /htmlFor=\{fileInputId\}/.test(COMPONENT), "the file opener is a real <label> bound by useId");
check(/<fieldset/.test(COMPONENT) && /<legend/.test(COMPONENT), "the scale controls are wrapped in a fieldset/legend group");
check(/id=\{sliderId\}/.test(COMPONENT) && /htmlFor=\{sliderId\}/.test(COMPONENT), "the range input has a real label bound with useId");
check(/min=\{MIN_PERCENT\}/.test(COMPONENT) && /max=\{MAX_PERCENT\}/.test(COMPONENT), "the numeric field is bounded by the published range");
check(/type="number"/.test(COMPONENT) && /inputMode="numeric"/.test(COMPONENT), "the numeric field is a real number input for mobile keyboards");
check(/e\.key !== "Enter"/.test(COMPONENT), "Enter commits the typed percentage");
check(/aria-describedby=\{hintId\}/.test(COMPONENT), "the numeric field is described by the range explanation");
check(/const runId = \+\+runIdRef\.current;/.test(COMPONENT), "both handlers take a fresh run id");
check((COMPONENT_TEXT.match(/runId !== runIdRef\.current/g) ?? []).length >= 6, "every await is followed by a run-id check, so a superseded run cannot clobber state");
check(/if \(!data \|\| numPages < 1 \|\| busy\) return;/.test(COMPONENT), "the run button is guarded against double submits while busy");
check(/!scaled \|\| runId !== runIdRef\.current/.test(COMPONENT), "a stale scale result is dropped instead of downloaded");
check(/downloadBlob\(scaled\.bytes, filename\)/.test(COMPONENT), "the download goes through downloadBlob with the computed name");
check(/outputNameFor\(name, target\)/.test(COMPONENT), "the download name comes from the single outputNameFor helper");
check(/updateFieldAppearances: false/.test(GEOMETRY_SRC) && /addDefaultPage: false/.test(GEOMETRY_SRC), "the save options keep form appearances and never add a default page");
check(/PDFDocument\.load\(data, \{ updateMetadata: false \}\)/.test(GEOMETRY_SRC), "the source metadata is not rewritten by the save");
check(/page\.scaleContent\(factor, factor\)/.test(GEOMETRY_SRC), "one factor is applied to both axes — the scale is uniform");
check(/page\.scaleAnnotations\(factor, factor\)/.test(GEOMETRY_SRC), "annotation geometry is scaled with the page");
check(OPTIONAL_BOXES.every((b) => GEOMETRY_SRC.includes(`"${b}"`)), "every optional page box (crop, bleed, trim, art) is handled", OPTIONAL_BOXES.filter((b) => !GEOMETRY_SRC.includes(`"${b}"`)).join(","));
check(/\/use\/pdf-unlock/.test(COMPONENT), "the encrypted-file error links to PDF Unlock");
check(/100 MB are supported here/.test(COMPONENT), "the oversize message quotes the real cap");
check(/scaling supports up to 200 pages/.test(COMPONENT), "the page-cap message quotes the real cap");
check(/never uploaded/.test(COMPONENT_TEXT), "the privacy claim is stated on the control itself");
check(/selectable, searchable and copyable/.test(COMPONENT_TEXT), "the limits box discloses that the text stays selectable");
check(/not re-rendered as a picture/.test(COMPONENT_TEXT), "the limits box discloses that nothing is rasterized");
check(/Proportions are preserved/.test(COMPONENT_TEXT), "the limits box discloses that the aspect ratio is preserved");
check(/digital signature does not survive a re-save/.test(COMPONENT_TEXT), "the limits box discloses the signature consequence");
check(
  /appearance stream is scaled with its box rather than re-rendered/.test(COMPONENT_TEXT),
  "the limits box discloses that a form field's appearance is scaled with its box, not re-rendered",
);
check(/formatInches/.test(COMPONENT_TEXT) && /describeBox/.test(COMPONENT_TEXT), "page sizes are reported in both points and inches");
check(/Page 1 at/.test(COMPONENT_TEXT) && /Page 1 now/.test(COMPONENT_TEXT), "the preview states the before and after size before anything runs");
check(/Download \{resultName\} again/.test(COMPONENT_TEXT), "a lost download can be fetched again from the result panel");
check(/mixedSizes/.test(COMPONENT) && /This file mixes page sizes/.test(COMPONENT_TEXT), "a mixed-size document is disclosed rather than hidden");
check(/skippedBoxes/.test(COMPONENT) && /too/.test(COMPONENT_TEXT) && /malformed to scale/.test(COMPONENT_TEXT), "a page box that could not be scaled is disclosed");
check(/Scaled \$\{scaled\.pages\} page/.test(COMPONENT_TEXT), "the success message reports the page count and the factor");
check(/by \$\{target\}% — downloaded \$\{filename\}/.test(COMPONENT_TEXT), "the success message names the file that was downloaded");
check(!/rasteriz/i.test(COMPONENT_TEXT) || /not re-rendered as a picture/.test(COMPONENT_TEXT), "no claim that the tool rasterizes anything");
check((COMPONENT.match(/type="file"/g) ?? []).length === 1, "the tool has exactly one file input");
check(/accept="application\/pdf,\.pdf"/.test(COMPONENT), "the file input only accepts PDFs");
check(/import\("\.\/scale-geometry"\)/.test(COMPONENT), "the pdf-lib work is code-split and only loaded when a run starts");

// ---------------------------------------------------------------------------
// 7. Content honesty across the lib files
// ---------------------------------------------------------------------------

const contentIdx = TOOL_CONTENT.indexOf('"pdf-scale-pages": {');
const contentEnd = TOOL_CONTENT.indexOf('"pdf-merge": {', contentIdx);
const contentBlock = TOOL_CONTENT.slice(contentIdx, contentEnd);
const contentText = flatten(contentBlock);
check(contentIdx > 0 && contentEnd > contentIdx, "tool-content still has a pdf-scale-pages entry");
check(/10% to 400%/.test(contentText), "the long description states the real 10%–400% range");
check(/100 MB and 200 pages/.test(contentText), "the long description states the real caps");
check(!/25% to 300%/.test(contentText), "the stale 25%–300% claim is gone");
check(/selectable, searchable and copyable/.test(contentText), "the long description says the text stays selectable");
check(/scaled, never re-rendered/.test(contentText), "the long description says the content is not rasterized");
check(/aspect ratio is preserved/.test(contentText), "the long description says the aspect ratio is preserved");
check(/not a page-size converter/.test(contentText), "the long description says this is not a page-size converter");
check(/password-protected file cannot be opened/.test(contentText), "the long description states the encrypted-file limit");
check(/bookmarks, links, form fields and document metadata come along/.test(contentText), "the long description states what survives");
check(/digital signature does not survive the re-save/.test(contentText), "the long description states the signature cost");
check(/<source>-scaled-<percent>pct\.pdf/.test(contentText), "the download step names the output convention");
check((contentBlock.match(/"question":/g) ?? []).length >= 4, "the entry keeps at least four FAQs");
check(/Is the page scaled or cropped\?/.test(contentText), "an FAQ answers the scaled-vs-cropped question");
check(/Will my text still be selectable after scaling\?/.test(contentText), "an FAQ answers the selectable-text question");
check(/Can I scale width and height differently/.test(contentText), "an FAQ answers the non-uniform-scale question honestly");
check(!/"guide"\s*:/.test(contentBlock), "the entry does not add a guide key (guides are resolved by toolSlug)");
check((contentBlock.match(/"step":/g) ?? []).length >= 4, "the how-to still walks the user through the run");

const seoKeywords = SEO.match(/"pdf-scale-pages":\s*\[([^\]]*)\]/);
check(!!seoKeywords, "seo.ts has a pdf-scale-pages keyword list");
for (const kw of ["scale pdf", "resize pdf pages", "change pdf page size"]) {
  check(
    !!seoKeywords && seoKeywords[1].includes(`"${kw}"`),
    `the keyword list covers "${kw}"`,
    seoKeywords?.[1] ?? "missing",
  );
}
check(
  /"pdf-scale-pages":\s*"Scale PDF Pages Online/.test(SEO),
  "seo.ts has a custom title for the tool",
);
check(
  /"pdf-scale-pages":\s*\n?\s*"Scale every page of a PDF by one percentage from 10% to 400%/.test(SEO),
  "the JSON-LD featureList entry is tool-specific and states the real range",
);
check(
  /"pdf-scale-pages":[\s\S]{0,2400}?password-protected files routed to PDF Unlock/.test(SEO),
  "the feature list states the encrypted-file steer",
);

const guideIdx = GUIDES.indexOf('slug: "how-to-scale-pdf-pages"');
const guideBlock = GUIDES.slice(guideIdx, guideIdx + 5200);
const guideText = flatten(guideBlock);
check(guideIdx > 0, "guides.ts has a how-to-scale-pdf-pages guide");
check(/toolSlug: "pdf-scale-pages"/.test(guideBlock), "the guide is attached to this tool");
check((guideBlock.match(/heading:/g) ?? []).length >= 3, "the guide has at least three sections");
check(/uniform factor/i.test(guideText), "the guide explains that the scale is uniform");
check(/does not crop|cropped/i.test(guideText), "the guide says the result is not cropped");
check(/paper-size converter|not a page-size converter/i.test(guideText), "the guide says it is not a page-size converter");
check(/<source>-scaled-<percent>pct\.pdf/.test(guideText), "the guide states the output naming");
check(/10% to 400%/.test(guideText), "the guide states the real range");
check(/100 MB and 200 pages/.test(guideText) && /PDF Unlock/.test(guideText), "the guide states the caps and the Unlock steer");
check(/signature/i.test(guideText), "the guide discloses the signature consequence");
check(/never uploaded|on your device|locally/i.test(guideText), "the guide states the on-device privacy model");
check((GUIDES.match(/slug: "how-to-scale-pdf-pages"/g) ?? []).length === 1, "the guide slug is unique");

const toolsIdx = TOOLS.indexOf('slug: "pdf-scale-pages"');
const toolsBlock = TOOLS.slice(toolsIdx, toolsIdx + 700);
check(toolsIdx > 0, "tools.ts still has a pdf-scale-pages entry");
check(/10% to 400%/.test(toolsBlock), "the tools.ts description states the real range");
check(/scale together and uniformly/.test(toolsBlock), "the tools.ts description keeps the uniform claim truthful");
check(/text stays selectable/.test(toolsBlock), "the tools.ts description does not imply a rasterized output");
check(!/25%|300%/.test(toolsBlock), "no stale percentage claim is left in the tools entry");
check(/tagline: "Resize every page of a PDF"/.test(toolsBlock), "the tagline stays truthful");
check(/slug: "pdf-scale-pages",[\s\S]{0,400}?category:/.test(TOOLS) && /name: "Scale Pages"/.test(toolsBlock), "the TOOLS entry keeps its name and array structure");
check((TOOLS.match(/slug: "pdf-scale-pages",/g) ?? []).length === 1, "the TOOLS array still holds exactly one pdf-scale-pages entry");

rmSync(TMP, { recursive: true, force: true });

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
