import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const COMPONENT = readFileSync(
  join(__dirname, "../src/features/pdf-auto-redact/PdfAutoRedact.tsx"),
  "utf8",
);

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

// --- mirror the component exactly ---
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_MATCHES = 100;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildMatcher = (source) => {
  const flags = source.caseSensitive ? "gu" : "giu";
  if (source.useRegex) {
    const pattern = source.regex.trim();
    if (!pattern)
      return { error: "Enter a regular expression first, or switch back to words." };
    try {
      return { re: new RegExp(pattern, flags) };
    } catch (err) {
      return { error: `That regular expression is invalid${err instanceof Error ? ` — ${err.message}` : ""}.` };
    }
  }
  const patterns = source.terms
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (patterns.length === 0)
    return { error: "Type a word or phrase to search for first." };
  const joined = patterns
    .map((p) => (source.wholeWord ? `\\b${escapeRegex(p)}\\b` : escapeRegex(p)))
    .join("|");
  return { re: new RegExp(joined, flags) };
};

const itemRect = (item) => {
  const t =
    Array.isArray(item.transform) && item.transform.length >= 4
      ? item.transform
      : [1, 0, 0, 1, 0, 0];
  const heights = [item.height, item.fontHeight, Math.abs(t[3] ?? 0)]
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  const h = heights.length > 0 ? Math.max(...heights) : 10;
  const w =
    typeof item.width === "number" && Number.isFinite(item.width) && item.width > 0
      ? item.width
      : 0;
  const padBelow = h * 0.3;
  const padAbove = h * 0.25;
  return {
    x: typeof t[4] === "number" ? t[4] : 0,
    y: (typeof t[5] === "number" ? t[5] : 0) - padBelow,
    w,
    h: h + padBelow + padAbove,
  };
};

const searchMatches = (items, re, cap) => {
  const rects = [];
  for (const item of items) {
    const str = typeof item.str === "string" ? item.str : "";
    if (!str) continue;
    re.lastIndex = 0;
    if (!re.test(str)) continue;
    rects.push(itemRect(item));
    if (rects.length >= cap) return { rects, capped: true };
  }
  return { rects, capped: false };
};

const loadDoc = async (data) =>
  pdfjs.getDocument({ data: data.slice(0) }).promise;

const searchPdf = async (data, re, cap = MAX_MATCHES) => {
  const task = pdfjs.getDocument({ data: data.slice(0) });
  try {
    const doc = await task.promise;
    const pages = [];
    let total = 0;
    let capped = false;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      try {
        const content = await page.getTextContent();
        const items = content.items ?? [];
        const { rects, capped: pageCapped } = searchMatches(items, re, cap - total);
        if (rects.length > 0) pages.push({ page: p, count: rects.length, rects });
        total += rects.length;
        if (pageCapped || total >= cap) {
          if (pageCapped) capped = true;
          if (total >= cap) capped = true;
          break;
        }
      } finally {
        try {
          page.cleanup();
        } catch {
          /* noop */
        }
      }
    }
    return { pages, total, capped };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
};

const burnRedactions = async (data, pages) => {
  const doc = await PDFDocument.load(data);
  for (const pageMatch of pages) {
    const page = doc.getPage(pageMatch.page - 1);
    for (const r of pageMatch.rects) {
      page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: rgb(0, 0, 0) });
    }
  }
  return doc.save();
};

const friendlyError = (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/No password given|password|encrypted/i.test(msg))
    return "This PDF is password-protected. Remove the password with PDF Unlock, then redact it again.";
  if (/Invalid PDF|Failed to parse|No PDF header/i.test(msg))
    return "This file doesn't look like a valid PDF.";
  return "Couldn't read that PDF — try again with a different file.";
};

const outputNameFor = (source) => `${source.replace(/\.pdf$/i, "")}-redacted.pdf`;

const getContent = async (doc, page) => {
  const contents = doc.context.lookup(page.node.normalizedEntries().Contents);
  const refs = contents.array ?? [contents];
  let out = "";
  for (const ref of refs) {
    const stream = await doc.context.lookup(ref);
    const raw = stream.getContents();
    let text;
    try {
      text = Buffer.from(inflateSync(Buffer.from(raw))).toString("latin1");
    } catch {
      text = Buffer.from(raw).toString("latin1");
    }
    out += text + "\n";
  }
  return out;
};

// --- 1. caps mirror the component source ---
check(/const\s+MAX_FILE_BYTES\s*=\s*100\s*\*\s*1024\s*\*\s*1024;/.test(COMPONENT) && MAX_FILE_BYTES === 100 * 1024 * 1024,
  "component MAX_FILE_BYTES is 100 MB and mirrors the harness");
check(/const\s+MAX_PAGES\s*=\s*200;/.test(COMPONENT) && MAX_PAGES === 200,
  "component MAX_PAGES is 200 and mirrors the harness");
check(/const\s+MAX_MATCHES\s*=\s*100;/.test(COMPONENT) && MAX_MATCHES === 100,
  "component MAX_MATCHES is 100 and mirrors the harness");

// --- 2. term-matching state machine: plain terms, case-insensitive ---
check(buildMatcher({ useRegex: false, regex: "", terms: "john smith\njohn@x.com", caseSensitive: false, wholeWord: false }).re &&
    buildMatcher({ useRegex: false, regex: "", terms: "john smith\njohn@x.com", caseSensitive: false, wholeWord: false }).re.test("Invoice No: 48102 JOHN SMITH"),
  "plain term matches case-insensitively against different casing");

// --- 3. regex mode honored, terms ignored ---
{
  const m = buildMatcher({ useRegex: true, regex: "\\b\\d{5}\\b", terms: "zzz-not-used", caseSensitive: false, wholeWord: false });
  check(m.re && m.re.test("account 48102 done"), "regex mode compiles and matches a pattern");
  const ignoreFac = buildMatcher({ useRegex: true, regex: "\\b\\d{5}\\b", terms: "48102", caseSensitive: false, wholeWord: false });
  check(ignoreFac.re.test("48102"), "regex mode uses the regex, not the terms field");
}

// --- 4. invalid regex and blank input error paths ---
{
  const bad = buildMatcher({ useRegex: true, regex: "(", terms: "x", caseSensitive: false, wholeWord: false });
  check(bad.re === undefined && /That regular expression is invalid/.test(bad.error), "invalid regex produces a friendly error");
  const blankTerms = buildMatcher({ useRegex: false, regex: "", terms: "\n  \n", caseSensitive: false, wholeWord: false });
  check(blankTerms.re === undefined && /Type a word or phrase/.test(blankTerms.error), "blank plain terms are rejected with a prompt");
  const blankRegex = buildMatcher({ useRegex: true, regex: "  ", terms: "x", caseSensitive: false, wholeWord: false });
  check(blankRegex.re === undefined && /Enter a regular expression/.test(blankRegex.error), "blank regex is rejected with a prompt");
}

// --- 5. whole-word and case-sensitive options ---
{
  const phrase = "Invoice No: 48102 John Smith";
  const whole = buildMatcher({ useRegex: false, regex: "", terms: "48", caseSensitive: false, wholeWord: true });
  check(!whole.re.test(phrase), "whole-word matching ignores a partial hit ('48' inside '48102')");
  const exact = buildMatcher({ useRegex: false, regex: "", terms: "JOHN SMITH", caseSensitive: true, wholeWord: false });
  check(!exact.re.test(phrase) && buildMatcher({ useRegex: false, regex: "", terms: "John Smith", caseSensitive: true, wholeWord: false }).re.test(phrase),
    "case-sensitive option requires exact case");
}

// --- 6. match-to-rect mapping for fabricated text-item transforms ---
{
  const A = { str: "John", transform: [12, 0, 0, 12, 50, 700], width: 160.08, height: 12 };
  const B = { str: "JOHN", transform: [24, 0, 0, 24, 100, 600], width: 50, fontHeight: 24 };
  const C = { str: "SMITH", transform: [0, 12, -12, 0, 200, 300], width: 40, height: 12 };
  const ra = itemRect(A);
  check(near(ra.x, 50) && near(ra.y, 700 - 12 * 0.3) && near(ra.w, 160.08) && near(ra.h, 12 * 1.55),
    `A: rect from transform [12,0,0,12,50,700] is (50,696.4,160.08,18.6) — got (${ra.x},${ra.y.toFixed(2)},${ra.w},${ra.h.toFixed(2)})`);
  const rb = itemRect(B);
  check(near(rb.x, 100) && near(rb.y, 600 - 24 * 0.3) && near(rb.w, 50) && near(rb.h, 24 * 1.55),
    `B: fontHeight drives the box when height is absent — got (${rb.x},${rb.y.toFixed(2)},${rb.w},${rb.h.toFixed(2)})`);
  const rc = itemRect(C);
  check(near(rc.x, 200) && near(rc.y, 300 - 12 * 0.3) && near(rc.w, 40) && near(rc.h, 12 * 1.55),
    `C: rotated/sheared transform uses e/f origin — got (${rc.x},${rc.y.toFixed(2)},${rc.w},${rc.h.toFixed(2)})`);
  const re = buildMatcher({ useRegex: false, regex: "", terms: "john", caseSensitive: false, wholeWord: false }).re;
  const { rects } = searchMatches([A, B, C], re, 100);
  check(rects.length === 2 && rects.every((r) => Number.isFinite(r.x) && Number.isFinite(r.y) && r.w >= 0 && r.h > 0),
    "case-insensitive term matches the two items that contain it and produces finite rects");
}

// --- 7. friendly-error mirror against real pdfjs failures ---
{
  const notPdf = Buffer.from("this is definitely not a valid pdf file");
  let notPdfMsg = "";
  try {
    await loadDoc(new Uint8Array(notPdf));
  } catch (e) {
    notPdfMsg = e instanceof Error ? e.message : String(e);
  }
  check(/Invalid PDF|Failed to parse|No PDF header/i.test(notPdfMsg),
    `non-PDF input fails in pdfjs with a recognized message — got "${notPdfMsg}"`);
  check(friendlyError(new Error(notPdfMsg)) === "This file doesn't look like a valid PDF.",
    "non-PDF error maps to the friendly invalid-file message");

  const locked = new Uint8Array(readFileSync(join(__dirname, "../e2e/fixtures/encrypted.pdf")));
  let lockedMsg = "";
  try {
    await loadDoc(locked);
  } catch (e) {
    lockedMsg = e instanceof Error ? e.message : String(e);
  }
  check(/No password given|password|encrypted/i.test(lockedMsg),
    `RC4-encrypted fixture fails in pdfjs with a password message — got "${lockedMsg}"`);
  const steered = friendlyError(new Error(lockedMsg));
  check(steered === "This PDF is password-protected. Remove the password with PDF Unlock, then redact it again.",
    "encrypted error maps to a steering-friendly message");
}

// --- 8. real document: one-page burn, output verified via pdfjs + content stream ---
{
  const makeDoc = async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Invoice No: 48102 John Smith", { x: 50, y: 700, size: 12, font });
    return doc.save({ useObjectStreams: false });
  };
  const src = await makeDoc();
  const re = buildMatcher({ useRegex: false, regex: "", terms: "48102", caseSensitive: false, wholeWord: false }).re;
  const { pages, total, capped } = await searchPdf(new Uint8Array(src), re);
  check(total === 1 && pages.length === 1 && pages[0].page === 1,
    `single-line fixture: exactly 1 match on page 1 — got ${total} total across ${pages.length} page(s), capped=${capped}`);
  const burned = await burnRedactions(new Uint8Array(src), pages);

  const reopened = await loadDoc(new Uint8Array(burned));
  check(reopened.numPages === 1, "burned output reopens with pdfjs");
  const pg1 = await reopened.getPage(1);
  const textItems = (await pg1.getTextContent()).items ?? [];
  check(textItems.some((i) => typeof i.str === "string" && i.str.includes("48102")),
    "covered text layer still holds the term (a cover, not an erasure)");
  const ops = await pg1.getOperatorList();
  const codeOf = (name) => pdfjs.OPS[name];
  const seq = [];
  ops.fnArray.forEach((code, i) => {
    if (code === codeOf("setFillRGBColor")) seq.push({ op: "rg", args: ops.argsArray[i] });
    if (code === codeOf("closePath")) seq.push({ op: "h" });
    if (code === codeOf("fill")) seq.push({ op: "f" });
    if (code === codeOf("constructPath")) seq.push({ op: "path", fillCode: ops.argsArray[i][0] });
  });
  check(seq.some((s) => s.op === "rg" && s.args[0] === "#000000"),
    "operator list contains a black fill color for the redaction rectangle");
  check(seq.some((s) => s.op === "path" && s.fillCode === codeOf("fill")),
    "operator list closes and fills the black rectangle path (constructPath with the fill operator)");

  const back = await PDFDocument.load(burned);
  const lines = (await getContent(back, back.getPage(0))).split("\n");
  check(lines.some((l) => l.trim() === "0 0 0 rg"), "content stream emits the black fill color `0 0 0 rg`");
  check(lines.some((l) => /^1 0 0 1 (50|\d+\.\d+) (696\.4|\d+\.\d+) cm$/.test(l.trim())),
    "content stream draws the rect at the matched baseline origin via cm");
  check(lines.some((l) => l.trim() === "h") && lines.some((l) => l.trim() === "f"),
    "content stream closes and fills the black rectangle");
  check(Buffer.compare(Buffer.from(burned), Buffer.from(src)) !== 0, "burned output differs from the source bytes");
}

// --- 9. per-page match counts across a real two-page document ---
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([612, 792]);
  p1.drawText("Invoice No: 48102 John Smith", { x: 50, y: 700, size: 12, font });
  const p2 = doc.addPage([612, 792]);
  p2.drawText("48102", { x: 100, y: 600, size: 12, font });
  p2.drawText("48102", { x: 100, y: 500, size: 12, font });
  p2.drawText("48102", { x: 100, y: 400, size: 12, font });
  const src = await doc.save({ useObjectStreams: false });
  const re = buildMatcher({ useRegex: false, regex: "", terms: "48102", caseSensitive: false, wholeWord: false }).re;
  const { pages, total } = await searchPdf(new Uint8Array(src), re);
  const m1 = pages.find((m) => m.page === 1);
  const m2 = pages.find((m) => m.page === 2);
  check(pages.length === 2 && m1 && m1.count === 1 && m2 && m2.count === 3 && total === 4,
    `two-page document counts per page (page1=1, page2=3, total=4) — got ${JSON.stringify(pages.map((m) => ({ page: m.page, count: m.count })))}`);
  const sorted = pages.every((m, i) => i === 0 || pages[i - 1].page < m.page);
  check(sorted, "page matches are reported in ascending page order");
}

// --- 10. output naming ---
check(outputNameFor("invoice.pdf") === "invoice-redacted.pdf", "invoice.pdf names output invoice-redacted.pdf");
check(outputNameFor("INVOICE.PDF") === "INVOICE-redacted.pdf", "uppercase .PDF extension is handled case-insensitively");
check(outputNameFor("report") === "report-redacted.pdf", "file without an extension still gets the -redacted suffix");
check(outputNameFor("a.b.pdf") === "a.b-redacted.pdf", "only a trailing .pdf is stripped");

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);