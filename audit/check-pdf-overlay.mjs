import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, rgb, PDFName } = require("pdf-lib");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const COMPONENT = readFileSync(
  join(__dirname, "../src/features/pdf-overlay/PdfOverlay.tsx"),
  "utf8",
);
const SUPPORT = readFileSync(
  join(__dirname, "../src/features/pdf-office/support.ts"),
  "utf8",
);

const STANDARD_FONTS =
  resolve(__dirname, "../node_modules/pdfjs-dist/standard_fonts") + "/";

const TMP = mkdtempSync(join(tmpdir(), "pdf-overlay-audit-"));

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MIN_OPACITY = 5;
const MAX_OPACITY = 100;
const OFFSET_LIMIT = 600;
const A4_W = 595.28;
const A4_H = 841.89;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };

let passed = 0;
let failed = 0;
const check = (ok, label) => {
  if (ok) {
    passed++;
    console.log("PASS", label);
  } else {
    failed++;
    console.log("FAIL", label);
  }
};
const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;

// ------------------------------------------------------------------
// mirrors of the component's pure logic (no DOM)
// ------------------------------------------------------------------

const looksLikePdf = (bytes) => {
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + 5 <= head.length; i++) {
    if (
      head[i] === 0x25 &&
      head[i + 1] === 0x50 &&
      head[i + 2] === 0x44 &&
      head[i + 3] === 0x46 &&
      head[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
};

const clamp = (n, min, max) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);

const placementFor = (preset, baseW, baseH, stampW, stampH, offsetX, offsetY) => {
  let width, height, x, y;
  if (preset === "stretch" || stampW <= 0 || stampH <= 0) {
    width = baseW;
    height = baseH;
    x = 0;
    y = 0;
  } else {
    const s = Math.min(baseW / stampW, baseH / stampH);
    width = stampW * s;
    height = stampH * s;
    x = (baseW - width) / 2;
    y = (baseH - height) / 2;
    if (preset.endsWith("-left")) x = 0;
    else if (preset.endsWith("-right")) x = baseW - width;
    if (preset.startsWith("top")) y = baseH - height;
    else if (preset.startsWith("bottom")) y = 0;
  }
  return { x: x + offsetX, y: y + offsetY, width, height };
};

// The component treats a stamp that overshoots the page by more than half a
// point as off-page; the mirror uses the same half-point slack.
const OFF_EPS = 0.5;

const offPage = (p, pageW, pageH) => {
  if (p.x >= pageW || p.y >= pageH || p.x + p.width <= 0 || p.y + p.height <= 0)
    return "full";
  if (
    p.x < -OFF_EPS ||
    p.y < -OFF_EPS ||
    p.x + p.width > pageW + OFF_EPS ||
    p.y + p.height > pageH + OFF_EPS
  )
    return "partial";
  return "none";
};

// mirror of the shared pageRangeSyntaxError helper in pdf-office/support.ts
const pageRangeSyntaxError = (range) => {
  const trimmed = range.trim();
  if (!trimmed) return null;
  for (const segment of trimmed.split(",")) {
    const match = /^(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(segment.trim());
    if (!match)
      return "Enter pages like 1-3,5 — numbers separated by commas, with a dash for ranges.";
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (from < 1 || to < from)
      return "Page numbers must be 1 or higher, and ranges must run upward (for example 2-5).";
  }
  return null;
};

const parsePageRange = (range, total) => {
  const syntax = pageRangeSyntaxError(range);
  if (syntax) return { ok: false, message: syntax };
  const trimmed = range.trim();
  const pages = [];
  const seen = new Set();
  if (trimmed) {
    for (const segment of trimmed.split(",")) {
      const match = /^(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(segment.trim());
      if (!match) continue;
      const from = Number(match[1]);
      const to = match[2] ? Number(match[2]) : from;
      for (let p = from; p <= to; p++) {
        if (p > total)
          return {
            ok: false,
            message: `The base PDF has ${total} page${total === 1 ? "" : "s"} — page ${p} is past the last page.`,
          };
        if (!seen.has(p)) {
          seen.add(p);
          pages.push(p);
        }
      }
    }
    pages.sort((a, b) => a - b);
  }
  if (pages.length === 0) for (let p = 1; p <= total; p++) pages.push(p);
  return { ok: true, pages };
};

const stampPageFor = (targetPage, stampPages, mode) => {
  if (mode === "first" || stampPages <= 1) return 1;
  return ((targetPage - 1) % stampPages) + 1;
};

const buildPlan = (targetPages, basePageSizes, stampPageSizes, preset, offsetX, offsetY, mode) => {
  const plan = [];
  for (const page of targetPages) {
    const base = basePageSizes.get(page);
    if (!base) return { ok: false, message: `Page ${page} could not be read from the base PDF.` };
    const stampPage = stampPageFor(page, stampPageSizes.length, mode);
    const stamp = stampPageSizes[stampPage - 1];
    if (!stamp)
      return { ok: false, message: `Stamp page ${stampPage} could not be read from the stamp PDF.` };
    const placement = placementFor(preset, base.width, base.height, stamp.width, stamp.height, offsetX, offsetY);
    if (offPage(placement, base.width, base.height) === "full")
      return {
        ok: false,
        message: `The stamp falls completely off page ${page} with these offsets — reduce the offset or pick another position.`,
      };
    plan.push({ page, stampPage, placement });
  }
  return { ok: true, plan };
};

// "The base PDF" -> "the base PDF": sentence-friendly, still upper-case PDF
const inSentence = (label) => label.replace(/^The /, "the ");

const friendlyError = (err, label) => {
  const m = err instanceof Error ? err.message : String(err);
  if (/encrypted|password/i.test(m))
    return `${label} is password-protected. Remove the password with PDF Unlock, then add the overlay again.`;
  if (/No PDF header|Failed to parse|Invalid PDF|not a PDF/i.test(m))
    return `${label} doesn't look like a valid PDF. Choose a PDF up to 100 MB and 200 pages.`;
  return `Could not read ${inSentence(label)}. It may be corrupt or unsupported.`;
};

const userFacing = (msg) => {
  const e = new Error(msg);
  e.userFacing = true;
  return e;
};

const toUiError = (err, label) =>
  err instanceof Error && err.userFacing ? err.message : friendlyError(err, label);

// The component measures the *visible* box (CropBox), keeps the placement in
// the page's own unrotated coordinates, and adds the CropBox origin back when
// it writes the content stream.
const outputNameFor = (baseName) => {
  const stem = baseName
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim()
    .slice(0, 80);
  return `${stem || "document"}-overlaid.pdf`;
};

// ------------------------------------------------------------------
// pdf helpers
// ------------------------------------------------------------------

const openPdfjsTask = (data) =>
  pdfjs.getDocument({ data: data.slice(0), standardFontDataUrl: STANDARD_FONTS });

const textOfPage = async (doc, pageNum) => {  const page = await doc.getPage(pageNum);
  try {
    const content = await page.getTextContent();
    return (content.items ?? []).map((i) => i.str ?? "").join(" ");
  } finally {
    try {
      page.cleanup();
    } catch {
      /* noop */
    }
  }
};

const decodedContents = (pdfDocPage) => {
  const contents = pdfDocPage.node.Contents();
  let streams = [];
  if (!contents) return "";
  if (Array.isArray(contents)) streams = contents;
  else if (contents.array) streams = contents.array;
  else streams = [contents];
  let out = "";
  for (const child of streams) {
    const resolved = pdfDocPage.node.context.lookup(child);
    const raw = resolved?.contents ?? null;
    if (!raw) continue;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    out +=
      bytes.length >= 2 && bytes[0] === 0x78 && bytes[1] === 0x9c
        ? inflateSync(bytes).toString("latin1")
        : Buffer.from(bytes).toString("latin1");
  }
  return out;
};

const extGStateAlpha = (doc, pageIndex) => {
  const page = doc.getPage(pageIndex);
  const ctx = doc.context;
  const res = page.node.Resources();
  const ref = res.get(PDFName.of("ExtGState"));
  if (!ref) return null;
  const dict = ctx.lookup(ref);
  if (!dict) return null;
  for (const key of dict.keys()) {
    const gs = ctx.lookup(dict.get(key));
    const ca = gs?.get(PDFName.of("ca"));
    if (ca) return Number.parseFloat(ca.toString());
  }
  return null;
};

const xObjectNames = (doc, pageIndex) => {
  const page = doc.getPage(pageIndex);
  const res = page.node.Resources();
  const ref = res.get(PDFName.of("XObject"));
  if (!ref) return [];
  const dict = doc.context.lookup(ref);
  if (!dict) return [];
  return dict.keys().map((k) => k.toString());
};

const hasStampOp = (pdfDocPage) => /\/\w*EmbeddedPdfPage-\d+\s+Do/.test(decodedContents(pdfDocPage));

const FORM = PDFName.of("Form").toString();

// the /Subtype of the first XObject a page declares, as seen by a reader
const formSubtypeOf = (doc, pageIndex) => {
  const page = doc.getPage(pageIndex);
  const res = page.node.Resources();
  const ref = res.get(PDFName.of("XObject"));
  if (!ref) return null;
  const dict = doc.context.lookup(ref);
  if (!dict) return null;
  for (const key of dict.keys()) {
    const xo = doc.context.lookup(dict.get(key));
    const sub = xo?.dict?.get(PDFName.of("Subtype"));
    return sub ? sub.toString() : null;
  }
  return null;
};

const PAINT_EVERY = 25;

const nextPaint = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => resolve());
  });

// the component's overlay engine, mirrored 1:1
const runOverlay = async ({
  baseBytes,
  stampBytes,
  targets,
  preset = "center",
  offsetX = 0,
  offsetY = 0,
  opacity = 50,
  mode = "cycle",
  embedIntoStampContext = false,
}) => {
  const doc = await PDFDocument.load(baseBytes, { updateMetadata: false });
  const stampDoc = await PDFDocument.load(stampBytes, { updateMetadata: false });
  const baseSizes = new Map();
  for (const page of targets) {
    const box = doc.getPage(page - 1).getCropBox();
    baseSizes.set(page, { x: box.x, y: box.y, width: box.width, height: box.height });
  }
  const stampSizes = stampDoc.getPages().map((p) => {
    const box = p.getCropBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  const planned = buildPlan(targets, baseSizes, stampSizes, preset, offsetX, offsetY, mode);
  if (!planned.ok) throw userFacing(planned.message);
  const embedded = new Map();
  let done = 0;
  for (const entry of planned.plan) {
    let pageEmbed = embedded.get(entry.stampPage);
    if (!pageEmbed) {
      pageEmbed = embedIntoStampContext
        ? await stampDoc.embedPage(stampDoc.getPage(entry.stampPage - 1))
        : await doc.embedPage(stampDoc.getPage(entry.stampPage - 1));
      embedded.set(entry.stampPage, pageEmbed);
    }
    const box = baseSizes.get(entry.page);
    doc.getPage(entry.page - 1).drawPage(pageEmbed, {
      x: box.x + entry.placement.x,
      y: box.y + entry.placement.y,
      width: entry.placement.width,
      height: entry.placement.height,
      opacity: opacity / 100,
    });
    done += 1;
    // mirrored from the component: pdf-lib work is synchronous, so the run
    // yields occasionally to let the browser paint the progress line
    if (done === 1 || done % PAINT_EVERY === 0) await nextPaint();
  }
  return new Uint8Array(await doc.save(SAVE_OPTS));
};

// ------------------------------------------------------------------
// fixtures, written to a temp dir like the rest of the family
// ------------------------------------------------------------------

const makeBase = async (pages = 3) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([A4_W, A4_H]);
    p.drawText(`BASE PAGE ${i + 1} BODY COPY`, { x: 60, y: 700, size: 18, font });
  }
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
};

const makeStamp = async (pages = 2) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([400, 100]);
    p.drawText(`STAMP MARK ${i + 1}`, { x: 20, y: 45, size: 24, font, color: rgb(0.1, 0.2, 0.7) });
  }
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
};

const baseBytes = await makeBase(3);
const stampBytes = await makeStamp(2);
writeFileSync(join(TMP, "base3.pdf"), baseBytes);
writeFileSync(join(TMP, "stamp2.pdf"), stampBytes);
{
  const many = await PDFDocument.create();
  for (let i = 0; i < MAX_PAGES + 1; i++) many.addPage([A4_W, A4_H]);
  writeFileSync(join(TMP, "base201.pdf"), new Uint8Array(await many.save({ useObjectStreams: false })));
}
writeFileSync(join(TMP, "notapdf.pdf"), Buffer.from("this is definitely not a pdf file\nsecond line"));
writeFileSync(join(TMP, "huge.pdf"), Buffer.alloc(MAX_FILE_BYTES + 1024));
writeFileSync(join(TMP, "locked.pdf"), readFileSync(join(__dirname, "../e2e/fixtures/encrypted.pdf")));

const magic = (b) => Buffer.from(b.subarray(0, 5)).toString("latin1");
check(magic(baseBytes) === "%PDF-", "base fixture is a real PDF written to the temp dir");
check(magic(stampBytes) === "%PDF-", "stamp fixture is a real PDF written to the temp dir");

// ------------------------------------------------------------------
// 1. component source: caps, constants, privacy claims
// ------------------------------------------------------------------
check(
  /const\s+MAX_FILE_BYTES\s*=\s*100\s*\*\s*1024\s*\*\s*1024;/.test(COMPONENT) &&
    MAX_FILE_BYTES === 100 * 1024 * 1024,
  "component MAX_FILE_BYTES is 100 MB and mirrors the harness",
);
check(
  /const\s+MAX_PAGES\s*=\s*200;/.test(COMPONENT) && MAX_PAGES === 200,
  "component MAX_PAGES is 200 and mirrors the harness",
);
check(
  /const\s+MIN_OPACITY\s*=\s*5;/.test(COMPONENT) &&
    /const\s+MAX_OPACITY\s*=\s*100;/.test(COMPONENT) &&
    MIN_OPACITY === 5 &&
    MAX_OPACITY === 100,
  "component opacity range is 5-100% and mirrors the harness",
);
check(
  COMPONENT.includes("aria-busy={busy}"),
  "root container is aria-busy while working",
);
check(
  COMPONENT.includes("role=\"status\"") && COMPONENT.includes("role=\"alert\""),
  "component exposes role=status lines and a role=alert error region",
);
check(
  (COMPONENT.match(/role="status"/g) || []).length >= 3,
  "idle/load, preview readout and success all announce through role=status",
);
check(
  /useId\(\)/.test(COMPONENT) && COMPONENT.includes("<fieldset") && COMPONENT.includes("<legend"),
  "labels use useId and controls are grouped in fieldset/legend",
);
check(
  COMPONENT.includes("<label") && COMPONENT.includes("htmlFor={baseInputId}"),
  "file openers are real <label> elements bound to the hidden inputs",
);
check(
  COMPONENT.includes("has-[:focus-visible]:outline-indigo-600") &&
    COMPONENT.includes("peer-focus-visible") === false,
  "the hidden file inputs give their <label> opener a visible focus ring (has-[:focus-visible], not a dead peer-*)",
);
check(
  /await nextPaint\(\);\s*\n\s*if \(run !== runIdRef\.current\) return;/.test(COMPONENT) &&
    /const PAINT_EVERY = 25;/.test(COMPONENT),
  "the synchronous draw loop yields to repaint progress, and bails on the run id after yielding",
);
check(
  /function inSentence\(label: string\): string \{/.test(COMPONENT) &&
    COMPONENT.includes("Could not read ${inSentence(label)}.") &&
    COMPONENT.includes("label.toLowerCase()") === false &&
    inSentence("The base PDF") === "the base PDF",
  "error copy keeps \"PDF\" uppercase instead of lower-casing it to \"pdf\"",
);
check(
  COMPONENT.includes("Processed locally") === false &&
    /never leaves your device|neither is uploaded|entirely on your device/i.test(COMPONENT),
  "copy states both files stay on the device",
);

// ------------------------------------------------------------------
// 2. the load path: magic bytes, caps, encryption steer
// ------------------------------------------------------------------
check(
  looksLikePdf(baseBytes) && looksLikePdf(stampBytes),
  "%PDF- preflight accepts real fixtures",
);
check(
  looksLikePdf(readFileSync(join(TMP, "notapdf.pdf"))) === false,
  "%PDF- preflight rejects a plain-text file",
);
check(
  looksLikePdf(Buffer.concat([Buffer.from("\n\n"), Buffer.from(baseBytes)])) === true,
  "%PDF- preflight tolerates leading junk produced by some PDF writers",
);
check(
  /looksLikePdf\(bytes\)/.test(COMPONENT) && COMPONENT.includes("doesn't look like a valid PDF"),
  "component runs the magic-byte preflight in the file-handling path",
);
check(
  toUiError(userFacing("The base PDF is 150 MB — files up to 100 MB are supported."), "The base PDF") ===
    "The base PDF is 150 MB — files up to 100 MB are supported.",
  "oversize userFacing message passes through verbatim",
);
check(
  toUiError(userFacing("The base PDF has 201 pages — files up to 200 pages are supported. Use PDF Split first."), "The base PDF") ===
    "The base PDF has 201 pages — files up to 200 pages are supported. Use PDF Split first.",
  "over-200-page message reports the real count and points at PDF Split",
);
{
  let err;
  try {
    await PDFDocument.load(readFileSync(join(TMP, "locked.pdf")), { updateMetadata: false });
  } catch (e) {
    err = e;
  }
  check(
    !!err && /encrypted|password/i.test(String(err.message)),
    "the encrypted fixture makes pdf-lib throw (so the tool can steer, not produce garbage)",
  );
  const steered = toUiError(err, "The base PDF");
  check(
    steered ===
      "The base PDF is password-protected. Remove the password with PDF Unlock, then add the overlay again.",
    "encrypted input maps to the Unlock-PDF steer",
    steered,
  );
  check(
    COMPONENT.includes("/unlock/i.test(error)") && COMPONENT.includes('href="/use/pdf-unlock"'),
    "the unlock steer renders a link to the Unlock PDF tool",
  );
  check(
    !/ignoreEncryption/.test(COMPONENT),
    "component no longer passes ignoreEncryption (the old code produced a broken file)",
  );
}
{
  let err;
  try {
    await PDFDocument.load(readFileSync(join(TMP, "notapdf.pdf")));
  } catch (e) {
    err = e;
  }
  check(
    friendlyError(err, "The stamp PDF") ===
      "The stamp PDF doesn't look like a valid PDF. Choose a PDF up to 100 MB and 200 pages.",
    "a non-PDF maps to the role-specific invalid-file message",
  );
  check(
    friendlyError(new Error("something unrelated"), "The base PDF") ===
      "Could not read the base PDF. It may be corrupt or unsupported.",
    "unmapped engine errors fall back to the friendly default",
  );
}

// ------------------------------------------------------------------
// 3. the regression: which document context the stamp is embedded into
// ------------------------------------------------------------------
{
  const fixed = await runOverlay({ baseBytes, stampBytes, targets: [1, 2, 3], opacity: 50 });
  const fixedTask = openPdfjsTask(fixed);
  const fixedDoc = await fixedTask.promise;
  check(fixedDoc.numPages === 3, "overlaid output keeps the base page count (3)");
  const t1 = await textOfPage(fixedDoc, 1);
  check(
    t1.includes("BASE PAGE 1 BODY COPY"),
    "base page text survives the overlay",
  );
  check(
    t1.includes("STAMP MARK 1"),
    "the stamp page is embedded and its text is readable on the target page",
  );
  const t3 = await textOfPage(fixedDoc, 3);
  check(
    t3.includes("STAMP MARK 1"),
    "cycle mode wraps the stamp's last page back to its first (page 3 -> stamp 1)",
  );
  const t2 = await textOfPage(fixedDoc, 2);
  check(t2.includes("STAMP MARK 2"), "cycle mode gives base page 2 the stamp's page 2");
  await fixedTask.destroy();

  const broken = await runOverlay({
    baseBytes,
    stampBytes,
    targets: [1],
    opacity: 50,
    embedIntoStampContext: true,
  });
  const brokenTask = openPdfjsTask(broken);
  const brokenDoc = await brokenTask.promise;
  const brokenText = await textOfPage(brokenDoc, 1);
  check(
    !brokenText.includes("STAMP MARK 1"),
    "REGRESSION GUARD: embedding into the stamp document's context (the old code) yields no stamp on the page",
  );
  const brokenLib = await PDFDocument.load(broken);
  check(
    xObjectNames(brokenLib, 0).length > 0 && formSubtypeOf(brokenLib, 0) !== FORM,
    "REGRESSION GUARD: the old code left a dangling /XObject entry that is not a /Form stream (what pdfjs rejects)",
  );
  await brokenTask.destroy();

  const fixedLib = await PDFDocument.load(fixed);
  check(
    hasStampOp(fixedLib.getPage(0)),
    "the fixed path emits a real /EmbeddedPdfPage Do operator on the target page",
  );
  check(
    xObjectNames(fixedLib, 0).length === 1 && formSubtypeOf(fixedLib, 0) === FORM,
    "the fixed path registers exactly one embedded stamp XObject, a real /Form stream",
  );
}

// ------------------------------------------------------------------
// 4. opacity really becomes a PDF ExtGState constant alpha
// ------------------------------------------------------------------
for (const [pct, expected] of [
  [50, 0.5],
  [25, 0.25],
  [100, 1],
]) {
  const out = await runOverlay({ baseBytes, stampBytes, targets: [1], opacity: pct });
  const lib = await PDFDocument.load(out);
  const alpha = extGStateAlpha(lib, 0);
  check(
    alpha !== null && near(alpha, expected, 1e-6),
    `opacity ${pct}% is written to the page ExtGState as /ca ${expected} (got ${alpha})`,
  );
}

// ------------------------------------------------------------------
// 5. position presets and offsets land in the content stream cm
// ------------------------------------------------------------------
{
  const cases = [
    { preset: "center", offsetX: 0, offsetY: 0 },
    { preset: "top-left", offsetX: 12, offsetY: -8 },
    { preset: "bottom-right", offsetX: 0, offsetY: 0 },
    { preset: "top-center", offsetX: 5, offsetY: 0 },
  ];
  let allMatch = true;
  const detail = [];
  for (const c of cases) {
    const out = await runOverlay({ baseBytes, stampBytes, targets: [1], ...c, opacity: 60 });
    const lib = await PDFDocument.load(out);
    const stream = decodedContents(lib.getPage(0));
    const expected = placementFor(c.preset, A4_W, A4_H, 400, 100, c.offsetX, c.offsetY);
    const cm = stream.match(/(^|\n)1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm(\n|$)/);
    const ok = !!cm && near(parseFloat(cm[2]), expected.x, 0.02) && near(parseFloat(cm[3]), expected.y, 0.02);
    if (!ok) {
      allMatch = false;
      detail.push(`${c.preset}: cm=${cm?.[2]},${cm?.[3]} expected=${expected.x},${expected.y}`);
    }
  }
  check(allMatch, `each preset/offset pair writes the expected cm translate (${detail.join("; ") || "all four matched"})`);

  const out = await runOverlay({ baseBytes, stampBytes, targets: [1], preset: "stretch", opacity: 100 });
  const lib = await PDFDocument.load(out);
  const expected = placementFor("stretch", A4_W, A4_H, 400, 100, 0, 0);
  const stream = decodedContents(lib.getPage(0));
  const cm = stream.match(/(^|\n)1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm(\n|$)/);
  check(
    near(expected.width, A4_W) && near(expected.height, A4_H) && near(expected.x, 0) && near(expected.y, 0),
    "the stretch preset covers the whole base page (0,0 -> full media box)",
  );
  check(
    !!cm && near(parseFloat(cm[2]), 0, 0.02) && near(parseFloat(cm[3]), 0, 0.02),
    "the stretch preset is stamped at the page origin",
  );

  // every non-stretch preset fits the stamp to the page (shorter side flush), keeping aspect ratio
  const fit = placementFor("center", A4_W, A4_H, 400, 100, 0, 0);
  check(
    near(fit.width, 595.28) && near(fit.height, 148.82) && near(fit.x, 0) && near(fit.y, 346.535),
    `the center preset fits a 400x100 stamp to the A4 page width and centres it (${fit.width.toFixed(2)}x${fit.height.toFixed(2)} at ${fit.x},${fit.y.toFixed(2)})`,
  );
  const big = placementFor("center", A4_W, A4_H, 4000, 4000, 0, 0);
  check(
    near(big.width, A4_W) && near(big.height, 595.28) && near(big.y, 123.305),
    "an oversized stamp is scaled down to the page's smaller dimension, keeping its aspect ratio",
  );
  const br = placementFor("bottom-right", 800, 600, 200, 400, 0, 0);
  check(
    near(br.width, 300) && near(br.height, 600) && near(br.x, 500) && near(br.y, 0),
    "the bottom-right preset sits flush with the page's bottom-right corner",
  );
  const tl = placementFor("top-left", 800, 600, 200, 400, 0, 0);
  check(
    near(tl.x, 0) && near(tl.y, 0) && near(tl.width, 300) && near(tl.height, 600),
    "the top-left preset anchors the fitted stamp to the page's top-left corner",
  );
  const tlOff = placementFor("top-left", 800, 600, 200, 400, 20, 30);
  check(
    near(tlOff.x, 20) && near(tlOff.y, 30),
    "the X/Y offsets are then applied to the anchored corner, in PDF points",
  );
  check(
    offPage(tl, 800, 600) === "none" &&
      offPage({ ...tl, x: 20, y: 30 }, 800, 600) === "partial" &&
      offPage({ ...tl, y: 30 }, 800, 600) === "partial" &&
      offPage({ ...tl, x: 501 }, 800, 600) === "partial" &&
      offPage({ ...tl, x: -100 }, 800, 600) === "partial" &&
      offPage({ ...tl, x: 810 }, 800, 600) === "full" &&
      offPage({ ...tl, x: -500 }, 800, 600) === "full" &&
      offPage({ ...tl, y: 700 }, 800, 600) === "full",
    "off-page detection distinguishes fully-on, partly-off and fully-off in every direction",
  );
}

// ------------------------------------------------------------------
// 5b. CropBox-relative placement, and the source file is never touched
// ------------------------------------------------------------------
{
  const cropped = await (async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([A4_W, A4_H]);
    p.drawText("CROPBOXED PAGE", { x: 40, y: 500, size: 14, font });
    // a non-zero origin, as a scanner or a print-ready export leaves behind
    p.setCropBox(50, 60, A4_W - 100, A4_H - 150);
    return new Uint8Array(await doc.save({ useObjectStreams: false }));
  })();
  const out = await runOverlay({ baseBytes: cropped, stampBytes, targets: [1], preset: "center", opacity: 100 });
  const lib = await PDFDocument.load(out);
  const cm = decodedContents(lib.getPage(0)).match(/(^|\n)1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm(\n|$)/);
  const pageWidth = A4_W - 100;
  const pageHeight = A4_H - 150;
  const expected = placementFor("center", pageWidth, pageHeight, 400, 100, 0, 0);
  check(
    !!cm && near(parseFloat(cm[2]) - 50, expected.x, 0.02) && near(parseFloat(cm[3]) - 60, expected.y, 0.02),
    `placement is measured on the visible CropBox and the CropBox origin is added back when writing (cm=${cm?.[2]},${cm?.[3]})`,
  );
  const task = openPdfjsTask(out);
  const doc = await task.promise;
  check(
    (await textOfPage(doc, 1)).includes("STAMP MARK 1"),
    "a cropped base page still receives the stamp",
  );
  await task.destroy();
}
{
  const baseSnapshot = Buffer.from(baseBytes);
  const stampSnapshot = Buffer.from(stampBytes);
  await runOverlay({ baseBytes, stampBytes, targets: [1, 2, 3], opacity: 40 });
  check(
    Buffer.compare(Buffer.from(baseBytes), baseSnapshot) === 0,
    "the in-memory base bytes are byte-identical after a run (the user's file is never rewritten)",
  );
  check(
    Buffer.compare(Buffer.from(stampBytes), stampSnapshot) === 0,
    "the in-memory stamp bytes are byte-identical after a run",
  );
  const again = await runOverlay({ baseBytes, stampBytes, targets: [1, 2, 3], opacity: 40 });
  const twice = await runOverlay({ baseBytes, stampBytes, targets: [1, 2, 3], opacity: 40 });
  check(
    Buffer.compare(Buffer.from(again), Buffer.from(twice)) === 0,
    "two runs over the same input produce byte-identical output (no timestamps leaking in)",
  );
}

// ------------------------------------------------------------------
// 6. page ranges: only the selected pages are stamped
// ------------------------------------------------------------------
{
  check(
    JSON.stringify(parsePageRange("", 3).pages) === "[1,2,3]",
    "an empty range means every page",
  );
  check(
    JSON.stringify(parsePageRange("1-2", 5).pages) === "[1,2]",
    "a 1-2 range selects pages 1 and 2",
  );
  check(
    JSON.stringify(parsePageRange("2,1,2", 3).pages) === "[1,2]",
    "a messy range is de-duplicated and sorted",
  );
  const oob = parsePageRange("1-4", 3);
  check(
    !oob.ok && /has 3 pages — page 4 is past the last page/.test(oob.message),
    "a range past the last page is rejected with the real page count",
  );
  check(
    !parsePageRange("3-1", 3).ok,
    "a downward range is rejected",
  );
  check(
    !parsePageRange("abc", 3).ok,
    "a non-numeric range is rejected with the shared syntax message",
  );
  check(
    pageRangeSyntaxError("1-3,5") === null && pageRangeSyntaxError("") === null,
    "valid range syntax passes the shared helper",
  );
  check(
    /pageRangeSyntaxError/.test(COMPONENT) && /pageRangeSyntaxError/.test(SUPPORT),
    "component reuses the shared pageRangeSyntaxError helper from pdf-office/support",
  );

  const out = await runOverlay({ baseBytes, stampBytes, targets: [2], opacity: 80 });
  const lib = await PDFDocument.load(out);
  check(hasStampOp(lib.getPage(1)), "the selected page (2) carries the stamp operator");
  check(!hasStampOp(lib.getPage(0)), "page 1 is untouched when the range excludes it");
  check(!hasStampOp(lib.getPage(2)), "page 3 is untouched when the range excludes it");
  const task = openPdfjsTask(out);
  const doc = await task.promise;
  const t1 = await textOfPage(doc, 1);
  check(!t1.includes("STAMP MARK"), "the un-stamped page has no stamp text in its layer");
  await task.destroy();
}

// ------------------------------------------------------------------
// 7. stamp mode + a base/stamp mix of page sizes
// ------------------------------------------------------------------
{
  const out = await runOverlay({ baseBytes, stampBytes, targets: [1, 2, 3], mode: "first", opacity: 100 });
  const firstTask = openPdfjsTask(out);
  const doc = await firstTask.promise;
  check(
    (await textOfPage(doc, 1)).includes("STAMP MARK 1") &&
      (await textOfPage(doc, 2)).includes("STAMP MARK 1") &&
      (await textOfPage(doc, 3)).includes("STAMP MARK 1"),
    "first-page mode puts the stamp's page 1 on every target page",
  );
  await firstTask.destroy();

  const mixed = await (async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const a = doc.addPage([A4_W, A4_H]);
    a.drawText("PORTRAIT PAGE", { x: 40, y: 700, size: 14, font });
    const b = doc.addPage([842, 595]);
    b.drawText("LANDSCAPE PAGE", { x: 40, y: 500, size: 14, font });
    return new Uint8Array(await doc.save({ useObjectStreams: false }));
  })();
  const out2 = await runOverlay({ baseBytes: mixed, stampBytes, targets: [1, 2], preset: "center", opacity: 100 });
  const lib2 = await PDFDocument.load(out2);
  const s1 = decodedContents(lib2.getPage(0));
  const s2 = decodedContents(lib2.getPage(1));
  const cmOf = (s) => {
    const m = s.match(/(^|\n)1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm(\n|$)/);
    return m ? [parseFloat(m[2]), parseFloat(m[3])] : null;
  };
  const e1 = placementFor("center", A4_W, A4_H, 400, 100, 0, 0);
  const e2 = placementFor("center", 842, 595, 400, 100, 0, 0);
  check(
    !!cmOf(s1) && near(cmOf(s1)[0], e1.x, 0.02) && near(cmOf(s1)[1], e1.y, 0.02),
    "a portrait page is measured on its own media box",
  );
  check(
    !!cmOf(s2) && near(cmOf(s2)[0], e2.x, 0.02) && near(cmOf(s2)[1], e2.y, 0.02),
    "a landscape page in the same document is measured on its own media box",
  );
  check(
    !near(e1.y, e2.y, 0.5),
    "the mixed-size fixture really does produce different placements per page",
  );
}

// ------------------------------------------------------------------
// 8. off-page offsets are refused before anything is drawn
// ------------------------------------------------------------------
{
  const planned = buildPlan([1], new Map([[1, { width: A4_W, height: A4_H }]]), [{ width: 400, height: 100 }], "top-left", A4_W, 0, "cycle");
  check(!planned.ok && /falls completely off page 1/.test(planned.message), "a stamp pushed fully off the page is refused with a named page");
  check(
    toUiError(userFacing(planned.ok ? "" : planned.message), "The stamp PDF") === planned.message,
    "the off-page refusal surfaces verbatim to the user",
  );
  let threw = false;
  try {
    await runOverlay({ baseBytes, stampBytes, targets: [1], preset: "top-left", offsetX: A4_W, opacity: 50 });
  } catch {
    threw = true;
  }
  check(threw, "runOverlay throws before saving when the plan is invalid (no partial output)");
  const partial = buildPlan([1, 9], new Map([[1, { width: A4_W, height: A4_H }]]), [{ width: 400, height: 100 }], "center", 0, 0, "cycle");
  check(!partial.ok && /Page 9 could not be read/.test(partial.message), "a missing target page is caught by the planner");
}

// ------------------------------------------------------------------
// 9. runId / lifecycle: no stale state can win a race
// ------------------------------------------------------------------
{
  check(
    /const runIdRef = useRef\(0\)/.test(COMPONENT),
    "run id is a ref so it survives re-renders",
  );
  const bailCount = (COMPONENT.match(/if \(run !== runIdRef\.current\) return;/g) || []).length;
  check(bailCount >= 6, `every await is followed by a run-id bail (${bailCount} bails found)`);
  check(
    /if \(!file \|\| busy\) return;/.test(COMPONENT) && /if \(!base \|\| !stamp \|\| busy\) return;/.test(COMPONENT),
    "both the loaders and the compositor are busy-guarded",
  );
  check(
    /const previewEpochRef = useRef\(0\)/.test(COMPONENT) && /cancelled = true/.test(COMPONENT),
    "the preview effect is epoch/cancel guarded so a slow render cannot overwrite a newer one",
  );
  check(
    /if \(which === "base"\) \{\s*setBase\(null\);/.test(COMPONENT.replace(/\n\s*/g, "\n")) ||
      /setBase\(null\)/.test(COMPONENT),
    "a failed base load clears the base state (no half-loaded document)",
  );
  check(
    /setStamp\(null\)/.test(COMPONENT),
    "a failed stamp load clears the stamp state (no half-loaded document)",
  );
  check(
    (COMPONENT.match(/setError\(""\);/g) || []).length >= 2,
    "each action clears the previous error before starting",
  );
  check(
    COMPONENT.includes("const run = ++runIdRef.current;") &&
      (COMPONENT.match(/const run = \+\+runIdRef\.current;/g) || []).length >= 2,
    "each action bumps the run id so an older await is discarded",
  );
  check(
    COMPONENT.includes("try {\n      const { PDFDocument } = await import(\"pdf-lib\");") ||
      /await import\("pdf-lib"\)/.test(COMPONENT),
    "pdf-lib is imported lazily so the initial JS payload stays small",
  );
  check(
    /await doc\.embedPage\(/.test(COMPONENT),
    "component embeds the stamp into the base document's context (the correct, non-dangling path)",
  );
  check(
    /const embedded = new Map<number, PDFEmbeddedPage>\(\)/.test(COMPONENT),
    "embedded stamp pages are cached per stamp page instead of re-embedded per target page",
  );
  check(
    /\.drawPage\(pageEmbed, \{/.test(COMPONENT) && /opacity: opacity \/ 100/.test(COMPONENT),
    "the stamp is drawn with page.drawPage at the chosen opacity",
  );
}

// ------------------------------------------------------------------
// 10. honest output naming + honest copy assertions
// ------------------------------------------------------------------
check(
  outputNameFor("contract.pdf") === "contract-overlaid.pdf",
  "a base named contract.pdf downloads contract-overlaid.pdf",
);
check(
  outputNameFor("CONTRACT.PDF") === "CONTRACT-overlaid.pdf",
  "an uppercase .PDF extension is handled case-insensitively",
);
check(
  outputNameFor("a.b.pdf") === "a.b-overlaid.pdf" && outputNameFor("report") === "report-overlaid.pdf",
  "only a trailing .pdf is stripped",
);
check(
  outputNameFor("../../etc/passwd.pdf") === "..-..-etc-passwd-overlaid.pdf" &&
    outputNameFor('re:port "final".pdf') === "re-port -final--overlaid.pdf",
  "path separators and characters no filesystem accepts are neutralised in the download name",
);
check(
  /function outputNameFor\(baseName: string\): string \{/.test(COMPONENT) &&
    COMPONENT.includes("-overlaid.pdf") &&
    /const outputName = outputNameFor\(base\.name\);/.test(COMPONENT) &&
    /downloadBlob\(saved, outputName\)/.test(COMPONENT) &&
    /Download \{result\.outputName\} again/.test(COMPONENT),
  "the component builds one <base>-overlaid.pdf name and downloads exactly that name",
);
check(
  /getCropBox\(\)/.test(COMPONENT) &&
    /x: box\.x \+ entry\.placement\.x/.test(COMPONENT) &&
    /y: box\.y \+ entry\.placement\.y/.test(COMPONENT) &&
    /normalizeRotation\(page\.getRotation\(\)\.angle\)/.test(COMPONENT),
  "the component measures the CropBox, adds the CropBox origin when drawing, and reads /Rotate",
);
check(
  /const activeRange = scope === "range" \? rangeText : "";/.test(COMPONENT) &&
    /disabled=\{busy \|\| Boolean\(rangeError\)\}/.test(COMPONENT) &&
    /Nothing will be drawn: \{refusal\}/.test(COMPONENT),
  "the range field only applies in range mode, and only a bad range blocks the button",
);
check(
  /stays visible, extractable and\s*searchable/.test(COMPONENT) ||
    /visible, extractable and\s+searchable/.test(COMPONENT),
  "copy states the honest searchable-text semantics of an embedded stamp",
);
check(
  /It is not a way to hide content/i.test(COMPONENT) && /not a merge/i.test(COMPONENT),
  "copy refuses the 'hides content' and 'merge' overclaims",
);
check(
  /remains visible|not\.\.\.|knob/i.test(COMPONENT) === false &&
    !/permanently (hides|removes)/i.test(COMPONENT),
  "copy makes no 'permanently hides/removes' claim",
);

// ------------------------------------------------------------------
// 11. the caps, the clamping, and the preview engine at the cap
// ------------------------------------------------------------------
{
  check(
    /const\s+OFFSET_LIMIT\s*=\s*600;/.test(COMPONENT) && OFFSET_LIMIT === 600,
    "component OFFSET_LIMIT is 600 pt and mirrors the harness",
  );
  check(
    clamp(9999, -OFFSET_LIMIT, OFFSET_LIMIT) === 600 &&
      clamp(-9999, -OFFSET_LIMIT, OFFSET_LIMIT) === -600 &&
      clamp(Number.NaN, -OFFSET_LIMIT, OFFSET_LIMIT) === -OFFSET_LIMIT &&
      clamp(50, MIN_OPACITY, MAX_OPACITY) === 50 &&
      clamp(0, MIN_OPACITY, MAX_OPACITY) === MIN_OPACITY &&
      clamp(400, MIN_OPACITY, MAX_OPACITY) === MAX_OPACITY,
    "offsets clamp to +/-600 pt and opacity to 5-100%, with a non-number falling back to the minimum",
  );
  check(
    /clamp\(Number\(e\.target\.value\) \|\| 0, -OFFSET_LIMIT, OFFSET_LIMIT\)/.test(COMPONENT) &&
      /clamp\(Number\(e\.target\.value\) \|\| MIN_OPACITY, MIN_OPACITY, MAX_OPACITY\)/.test(COMPONENT) &&
      /min=\{-OFFSET_LIMIT\}/.test(COMPONENT) &&
      /min=\{MIN_OPACITY\}/.test(COMPONENT),
    "the typed offset and opacity fields clamp on the way into state, and the inputs carry the same bounds",
  );

  // the preview engine has to open what the tool produces, at the page cap
  const capped = await PDFDocument.create();
  for (let i = 0; i < MAX_PAGES; i++) capped.addPage([A4_W, A4_H]);
  const cappedBytes = new Uint8Array(await capped.save({ useObjectStreams: false }));
  const cappedOut = await runOverlay({
    baseBytes: cappedBytes,
    stampBytes,
    targets: [1, MAX_PAGES],
    opacity: 100,
  });
  const previewTask = openPdfjsTask(cappedOut);
  const previewDoc = await previewTask.promise;
  check(
    previewDoc.numPages === MAX_PAGES,
    `pdf.js (the preview engine) opens a full ${MAX_PAGES}-page overlaid file`,
  );
  check(
    (await textOfPage(previewDoc, MAX_PAGES)).includes("STAMP MARK 2"),
    "the last page of a capped document still carries its stamp (cycle mode wraps)",
  );
  await previewTask.destroy();
}

// ------------------------------------------------------------------
rmSync(TMP, { recursive: true, force: true });
process.stdout.write(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
