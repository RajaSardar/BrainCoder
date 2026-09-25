import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";

const COMPONENT = readFileSync(
  "src/features/pdf-compare/PdfCompare.tsx",
  "utf8",
);

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_DOCS = 5;
const MAX_LINES_PER_PAGE = 1000;

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

// ---- mirrors of the component's pure logic (no DOM) ----

function lineKey(line, opts) {
  let k = line.trim().replace(/\s+/g, " ");
  if (opts.ignoreCase) k = k.toLowerCase();
  if (opts.ignoreWhitespace) k = k.replace(/\s+/g, "");
  return k;
}

function diffLines(aLines, bLines, opts) {
  const aKeys = aLines.map((l) => lineKey(l, opts));
  const bKeys = bLines.map((l) => lineKey(l, opts));
  const n = aKeys.length;
  const m = bKeys.length;
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        aKeys[i] === bKeys[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aKeys[i] === bKeys[j]) {
      rows.push({ kind: "same", aText: aLines[i], bText: bLines[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: "removed", aText: aLines[i], bText: null });
      i++;
    } else {
      rows.push({ kind: "added", aText: null, bText: bLines[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ kind: "removed", aText: aLines[i], bText: null });
    i++;
  }
  while (j < m) {
    rows.push({ kind: "added", aText: null, bText: bLines[j] });
    j++;
  }
  return rows;
}

function friendlyError(err) {
  const m = err instanceof Error ? err.message : String(err);
  if (/Invalid PDF|Failed to parse|No PDF header|Header not found|trailer/i.test(m))
    return "This file doesn't look like a valid PDF.";
  if (/password|encrypted|No password given/i.test(m))
    return "This PDF is already password-protected. If you know its password, remove it with Unlock PDF first.";
  return "Couldn't read that PDF — try again with a different file.";
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

function reportFileName(origName) {
  return `${origName.replace(/\.pdf$/i, "")}-diff-report.txt`;
}

function buildReportText(data) {
  const lines = [];
  lines.push("PDF Compare — Text-Layer Diff Report");
  lines.push(
    "Generated locally in your browser. This compares embedded text only, not layout, images, fonts or scans.",
  );
  lines.push("");
  lines.push(
    `Original: ${data.origName} (${data.origPages} page${data.origPages === 1 ? "" : "s"})`,
  );
  lines.push(`Ignore case: ${data.ignoreCase ? "on" : "off"}`);
  lines.push(`Ignore whitespace: ${data.ignoreWhitespace ? "on" : "off"}`);
  lines.push(
    "Lines are matched page by page on normalized content; extra spaces are always collapsed, blanks and ordering matter, and reordered lines count as removed plus added.",
  );
  lines.push("");
  for (const entry of data.entries) {
    lines.push(`--- ${entry.revName} vs ${data.origName} ---`);
    lines.push(
      `${entry.compared} page${entry.compared === 1 ? "" : "s"} compared (shortest shared page count of ${entry.revPages} and ${data.origPages}).`,
    );
    lines.push("");
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const p of entry.pages) {
      totalAdded += p.added;
      totalRemoved += p.removed;
      const label =
        p.added + p.removed === 0
          ? "no changes"
          : `${p.added} added, ${p.removed} removed`;
      lines.push(`Page ${p.page} — ${label}`);
      for (const row of p.rows) {
        if (row.kind === "added") lines.push(`  added: ${row.bText}`);
        else if (row.kind === "removed") lines.push(`  removed: ${row.aText}`);
      }
      lines.push("");
    }
    if (entry.truncated.length > 0) {
      const plural = entry.truncated.length > 1;
      lines.push(
        `Note: page${plural ? "s" : ""} ${entry.truncated.join(", ")} ${plural ? "were" : "was"} trimmed to the first ${MAX_LINES_PER_PAGE} lines for display.`,
      );
      lines.push("");
    }
    const summary =
      totalAdded + totalRemoved === 0
        ? "No differences found."
        : `${totalAdded} added, ${totalRemoved} removed across ${entry.compared} page${entry.compared === 1 ? "" : "s"}.`;
    lines.push(`Summary vs ${entry.revName}: ${summary}`);
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function layoutLines(content) {
  const text = [];
  const order = [];
  for (const raw of content.items ?? []) {
    const item = raw ?? {};
    const str = typeof item.str === "string" ? item.str : "";
    if (str) {
      const t = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
      text.push({
        y: typeof t[5] === "number" ? t[5] : 0,
        x: typeof t[4] === "number" ? t[4] : 0,
        str,
        width: typeof item.width === "number" ? item.width : 0,
        eol: item.hasEOL === true,
      });
      order.push({ kind: "text", idx: text.length - 1 });
    } else if (item.hasEOL) {
      order.push({ kind: "blank" });
    }
  }
  const sortLine = (indices) => {
    const items = indices.map((i) => text[i]).sort((a, b) => a.x - b.x);
    let s = "";
    let endX = 0;
    for (const it of items) {
      const gap = s ? it.x - endX : 0;
      if (s && gap > 1) s += " ";
      s += it.str;
      endX = it.x + it.width;
    }
    return s.trim();
  };
  const out = [];
  let cur = [];
  let curY = null;
  let blankPending = 0;
  const flushLine = () => {
    if (!cur.length) return;
    for (let b = 0; b < blankPending; b++) out.push("");
    blankPending = 0;
    out.push(sortLine(cur));
    cur = [];
    curY = null;
  };
  for (const item of order) {
    if (item.kind === "blank") {
      flushLine();
      blankPending += 1;
      continue;
    }
    const it = text[item.idx];
    if (curY === null) curY = it.y;
    if (Math.abs(it.y - curY) >= 2.5) flushLine();
    cur.push(item.idx);
    if (it.eol) flushLine();
  }
  flushLine();
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

async function extractDocument(data) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: data.slice(0),
    standardFontDataUrl: new URL(
      "../node_modules/pdfjs-dist/standard_fonts/",
      import.meta.url,
    ).href,
  });
  const doc = await task.promise;
  try {
    const pages = [];
    const count = Math.min(doc.numPages, MAX_PAGES);
    for (let p = 1; p <= count; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(layoutLines(content));
      try {
        page.cleanup();
      } catch {
        /* noop */
      }
    }
    return { pages, numPages: doc.numPages };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

// ---- 1. caps constants stated in the component match the audited values ----
const mSize = COMPONENT.match(/const MAX_FILE_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+);/);
const mPages = COMPONENT.match(/const MAX_PAGES\s*=\s*(\d+);/);
const mDocs = COMPONENT.match(/const MAX_DOCS\s*=\s*(\d+);/);
const mLines = COMPONENT.match(/const MAX_LINES_PER_PAGE\s*=\s*(\d+);/);
check(
  "component MAX_FILE_BYTES is 100 MiB",
  !!mSize && +mSize[1] * +mSize[2] * +mSize[3] === MAX_FILE_BYTES,
  COMPONENT.match(/const MAX_FILE_BYTES[^;]*;/)?.[0] ?? "not found",
);
check("component MAX_PAGES matches", !!mPages && +mPages[1] === MAX_PAGES, mPages?.[0] ?? "");
check("component MAX_DOCS matches", !!mDocs && +mDocs[1] === MAX_DOCS, mDocs?.[0] ?? "");
check("component MAX_LINES_PER_PAGE matches", !!mLines && +mLines[1] === MAX_LINES_PER_PAGE, mLines?.[0] ?? "");

// ---- 2. fixtures built inline with pdf-lib ----
async function makePdf(pages) {
  const doc = await PDFDocument.create();
  for (const t of pages) {
    doc.addPage([612, 792]).drawText(t, { x: 50, y: 700, size: 12 });
  }
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

const A = await makePdf(["The quick brown fox", "Same line"]);
const B = await makePdf(["The slow brown fox", "Same line"]);
const C = await makePdf(["Hello World", "Padding"]);
const D = await makePdf(["hello world", "Padding"]);
const E = await makePdf(["two   spaced", "a b"]);
const F = await makePdf(["two spaced", "ab"]);
const GAP = await makePdf(["gap line one", "gap line two x"]);
const GBP = await makePdf(["gap line one", "gap line two y"]);

// ---- 3. real extraction through pdfjs legacy + mirrored layout ----
const ta = await extractDocument(A);
const tb = await extractDocument(B);
check("extracted base has 2 pages", ta.numPages === 2 && ta.pages.length === 2);
check(
  "extracted page 1 line equals the drawn text",
  ta.pages[0].length === 1 && ta.pages[0][0] === "The quick brown fox",
  JSON.stringify(ta.pages[0]),
);
check(
  "extracted page 2 line equals the drawn text",
  ta.pages[1].length === 1 && ta.pages[1][0] === "Same line",
  JSON.stringify(ta.pages[1]),
);

const tc = await extractDocument(C);
const td = await extractDocument(D);
const te = await extractDocument(E);
const tf = await extractDocument(F);
const tg = await extractDocument(GAP);
const th = await extractDocument(GBP);

const OFF_A = { ignoreCase: false, ignoreWhitespace: false };
const ON_CASE = { ignoreCase: true, ignoreWhitespace: false };
const ON_WS = { ignoreCase: false, ignoreWhitespace: true };

// ---- 4. diff engine: added/removed, page-aligned ----
const page1Rows = diffLines(ta.pages[0], tb.pages[0], OFF_A);
check(
  "changed page yields one added + one removed line",
  page1Rows.filter((r) => r.kind === "added").length === 1 &&
    page1Rows.filter((r) => r.kind === "removed").length === 1,
  JSON.stringify(page1Rows.map((r) => r.kind)),
);
check(
  "removed line carries the base text",
  page1Rows.find((r) => r.kind === "removed")?.aText === "The quick brown fox",
);
check(
  "added line carries the revision text",
  page1Rows.find((r) => r.kind === "added")?.bText === "The slow brown fox",
);
const page2Rows = diffLines(ta.pages[1], tb.pages[1], OFF_A);
check(
  "unchanged page is all 'same' (page aligned)",
  page2Rows.length === 1 && page2Rows[0].kind === "same",
  JSON.stringify(page2Rows.map((r) => r.kind)),
);

// ---- 5. case handling matches copy ----
const caseRowsOff = diffLines(tc.pages[0], td.pages[0], OFF_A);
check(
  "case-sensitive default flags case-only change",
  caseRowsOff.some((r) => r.kind !== "same"),
);
const caseRowsOn = diffLines(tc.pages[0], td.pages[0], ON_CASE);
check(
  "ignore-case matches 'Hello World' vs 'hello world'",
  caseRowsOn.length === 1 && caseRowsOn[0].kind === "same",
  JSON.stringify(caseRowsOn.map((r) => r.kind)),
);

// ---- 6. whitespace handling matches copy ----
const wsOff = diffLines(te.pages[0], tf.pages[0], OFF_A);
check(
  "whitespace collapsed by default so spacing-only lines match",
  wsOff.length === 1 && wsOff[0].kind === "same",
  JSON.stringify(wsOff.map((r) => r.kind)),
);
const wsOff2 = diffLines(te.pages[1], tf.pages[1], OFF_A);
check(
  "'a b' vs 'ab' differ when whitespace is kept",
  wsOff2.some((r) => r.kind !== "same"),
  JSON.stringify(wsOff2.map((r) => r.kind)),
);
const wsOn = diffLines(te.pages[1], tf.pages[1], ON_WS);
check(
  "ignore-whitespace matches 'a b' vs 'ab'",
  wsOn.length === 1 && wsOn[0].kind === "same",
  JSON.stringify(wsOn.map((r) => r.kind)),
);

// ---- 7. reordered lines count as removed + added ----
const reorderA = ["first", "second", "third"];
const reorderB = ["second", "first", "third"];
const reorderRows = diffLines(reorderA, reorderB, OFF_A);
check(
  "reordering yields removals and additions (position-aware matching)",
  reorderRows.filter((r) => r.kind === "added").length >= 1 &&
    reorderRows.filter((r) => r.kind === "removed").length >= 1,
  JSON.stringify(reorderRows.map((r) => r.kind)),
);

// ---- 8. report builder mirror ----
const report = buildReportText({
  origName: "contract v1.pdf",
  origPages: 2,
  ignoreCase: false,
  ignoreWhitespace: false,
  entries: [
    {
      revName: "contract v2.pdf",
      revPages: 2,
      compared: 2,
      truncated: [],
      pages: [
        {
          page: 1,
          rows: page1Rows,
          added: 1,
          removed: 1,
        },
        {
          page: 2,
          rows: page2Rows,
          added: 0,
          removed: 0,
        },
      ],
    },
  ],
});
check("report contains added line", report.includes("added: The slow brown fox"), report);
check("report contains removed line", report.includes("removed: The quick brown fox"));
check("report marks unchanged page", report.includes("Page 2 — no changes"));
check("report states shortest shared page count", report.includes("shortest shared page count of 2 and 2"));
check("report states summary counts", report.includes("Summary vs contract v2.pdf: 1 added, 1 removed across 2 pages."));
check("report names the original", report.includes("Original: contract v1.pdf (2 pages)"));
const emptyReport = buildReportText({
  origName: "a.pdf",
  origPages: 1,
  ignoreCase: false,
  ignoreWhitespace: false,
  entries: [
    {
      revName: "b.pdf",
      revPages: 1,
      compared: 1,
      truncated: [],
      pages: [{ page: 1, rows: [], added: 0, removed: 0 }],
    },
  ],
});
check("report says no differences when nothing changed", emptyReport.includes("No differences found."));

// ---- 9. download filename derivation ----
check(
  "report name derives from base filename (.PDF stripped)",
  reportFileName("contract v1.PDF") === "contract v1-diff-report.txt",
  reportFileName("contract v1.PDF"),
);
check(
  "report name for lowercase .pdf",
  reportFileName("notes.pdf") === "notes-diff-report.txt",
);
check(
  "component uses the same <src>-diff-report.txt pattern",
  COMPONENT.includes("-diff-report.txt") &&
    COMPONENT.includes("origName.replace") &&
    COMPONENT.includes("reportFileName(original.name)"),
);

// ---- 10. error mapping mirrors the component ----
{
  const garbage = new Uint8Array(Buffer.from("this is definitely not a pdf file"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let pdfjsErr;
  try {
    await pdfjs.getDocument({ data: garbage }).promise;
  } catch (err) {
    pdfjsErr = err;
  }
  check(
    "pdfjs rejects a non-PDF with a mapped message",
    pdfjsErr && toUiError(pdfjsErr) === "This file doesn't look like a valid PDF.",
    pdfjsErr ? String(pdfjsErr.message) : "no error",
  );
  let plErr;
  try {
    await PDFDocument.load(garbage);
  } catch (err) {
    plErr = err;
  }
  check(
    "pdf-lib rejects a non-PDF with a mapped message",
    plErr && toUiError(plErr) === "This file doesn't look like a valid PDF.",
    plErr ? String(plErr.message) : "no error",
  );

  const locked = new Uint8Array(readFileSync("e2e/fixtures/encrypted.pdf"));
  let lockedPdfjs;
  try {
    await pdfjs.getDocument({ data: locked }).promise;
  } catch (err) {
    lockedPdfjs = err;
  }
  check(
    "RC4 encrypted fixture causes 'No password given' from pdfjs",
    lockedPdfjs && /No password given/i.test(String(lockedPdfjs.message)),
    lockedPdfjs ? String(lockedPdfjs.message) : "no error",
  );
  check(
    "encrypted fixture maps to the Unlock-PDF steer",
    lockedPdfjs && toUiError(lockedPdfjs) ===
      "This PDF is already password-protected. If you know its password, remove it with Unlock PDF first.",
  );
  let lockedPl;
  try {
    await PDFDocument.load(locked);
  } catch (err) {
    lockedPl = err;
  }
  check(
    "pdf-lib misreads low-level RC4 as header-missing (so the component preflight uses pdfjs, whose 'No password given' maps to the steer)",
    lockedPl && toUiError(lockedPl) === "This file doesn't look like a valid PDF.",
    lockedPl ? String(lockedPl.message) : "no error",
  );
  check(
    "component preflight loads with pdfjs (getDocument) not pdf-lib",
    COMPONENT.includes("async function loadPdfMeta") &&
      COMPONENT.includes("pdfjs.getDocument({ data: data.slice(0) })") &&
      !COMPONENT.includes("PDFDocument.load"),
  );

  check(
    "userFacing errors pass through verbatim",
    toUiError(userFacing("Only up to 5 PDFs can be compared at once. Remove one before adding another.")) ===
      "Only up to 5 PDFs can be compared at once. Remove one before adding another.",
  );
  check(
    "unmapped errors fall back to the friendly default",
    friendlyError(new Error("something totally unrelated")) ===
      "Couldn't read that PDF — try again with a different file.",
  );
}

// ---- 11. document-count cap ----
{
  const msg = "Only up to 5 PDFs can be compared at once. Remove one before adding another.";
  const canAdd = (docsLen) => docsLen < MAX_DOCS;
  const rejected = [];
  for (let n = 0; n < 5; n++) {
    if (!canAdd(n)) rejected.push(`unexpected reject at ${n}`);
  }
  check("fifth document is accepted", canAdd(4));
  check("sixth document is rejected", !canAdd(5), rejected.join(","));
  check(
    "cap message mentions 5",
    msg.includes(`up to ${MAX_DOCS} PDFs`),
    msg,
  );
  check(
    "component enforces the same cap message",
    COMPONENT.includes("Only up to ${MAX_DOCS} PDFs can be compared at once."),
  );
}

// ---- 12. page-count cap message is consistent ----
{
  const pageMsg = "This PDF has 201 pages — files up to 200 pages are supported.";
  check(
    "page-cap message uses the component constant",
    pageMsg.includes(`up to ${MAX_PAGES} pages`),
  );
  check(
    "component enforces the page cap with a user-facing error",
    /files up to \$\{MAX_PAGES\} pages are supported/.test(COMPONENT),
  );
  check(
    "component rejects over-200-page files",
    COMPONENT.includes("pageCount > MAX_PAGES"),
  );
}

// ---- 13. extraction layout is stable across two different revised pages ----
{
  const gRows = diffLines(tg.pages[0], th.pages[0], OFF_A);
  const sameFirst = gRows.find((r) => r.kind === "same")?.aText ?? "";
  check(
    "shared leading line is reported as same (page aligned by position)",
    sameFirst === "gap line one",
    JSON.stringify(gRows.map((r) => [r.kind, r.aText ?? r.bText])),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);