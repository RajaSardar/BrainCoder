// Node check: PDF to Markdown — mirrors of PdfToMarkdown.tsx (reading order, headings, html)
// Run: node audit/check-pdf-to-markdown.mjs
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

let pass = 0;
let fail = 0;
function ok(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

// ---- Mirrors (byte-for-byte with PdfToMarkdown.tsx) ----
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function shouldBeHeading(line) {
  if (line.length < 2 || line.length > 60) return false;
  if (/[.!?:;,]$/.test(line)) return false;
  if (/^\s*[-*•·▪◦]/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length > 7) return false;
  if (/\b(the|a|an|and|or|of|to|in|for|this|that|with|from)\b/i.test(line))
    return false;
  if (!/[A-Z0-9]/.test(line)) return false;
  return true;
}
function layoutPageLines(viewport, items) {
  const words = [];
  for (const it of items) {
    if (typeof it.str !== "string" || !it.str.trim()) continue;
    const t = it.transform ?? [1, 0, 0, 1, 0, 0];
    const pt = viewport.convertToViewportPoint(t[4] ?? 0, t[5] ?? 0);
    const x = pt[0] ?? 0;
    const y = pt[1] ?? 0;
    words.push({
      x,
      y,
      w: it.width ?? Math.max(4, it.str.length * 5),
      text: it.str,
    });
  }
  if (words.length === 0) return [];
  words.sort((a, b) => (Math.abs(a.y - b.y) > 2.5 ? a.y - b.y : a.x - b.x));
  const groups = [[words[0]]];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    const sameLine = Math.abs(prev.y - cur.y) <= 2.5 && prev.x <= cur.x;
    if (sameLine) groups[groups.length - 1].push(cur);
    else groups.push([cur]);
  }
  const dys = [];
  for (let i = 1; i < groups.length; i++) {
    const dy = groups[i][0].y - groups[i - 1][0].y;
    if (dy > 0 && dy < 100) dys.push(dy);
  }
  dys.sort((a, b) => a - b);
  const pitch = dys.length ? dys[Math.floor(dys.length / 2)] : 12;
  return groups.map((wordsInLine, i) => {
    const sorted = [...wordsInLine].sort((a, b) => a.x - b.x);
    let text = sorted[0].text;
    let endX = sorted[0].x + sorted[0].w;
    for (let j = 1; j < sorted.length; j++) {
      const w = sorted[j];
      const gap = w.x - endX;
      text += gap > 24 ? "  " : gap > 1 ? " " : "";
      text += w.text;
      endX = Math.max(endX, w.x + w.w);
    }
    const dyPrev = i > 0 ? groups[i][0].y - groups[i - 1][0].y : 0;
    return { text: text.trim(), blank: i > 0 && dyPrev > pitch * 1.7 };
  });
}

// ---- heading heuristic ----
ok("heading: short title", shouldBeHeading("Meeting Notes"));
ok("heading: single capital word", shouldBeHeading("Abstract"));
ok("heading: with digits", shouldBeHeading("2026 Plan"));
ok("heading: false if ends with period", !shouldBeHeading("A sentence here."));
ok("heading: false if common word", !shouldBeHeading("The quick brown fox"));
ok("heading: false if long", !shouldBeHeading("This is a very long sentence that def checks easily"));
ok("heading: false if bullet", !shouldBeHeading("- not a heading"));
ok("heading: false if no caps/digits", !shouldBeHeading("lowercase title"));

const collapseSpaces = (s) => s.replace(/ {2,}/g, " ").trim();

// ---- escapeHtml ----
ok("html: escapes & < > \"", escapeHtml("<a href=\"x\">&</a>") === "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");

// ---- Real fixture through pdfjs legacy build ----
// convertToViewportPoint returns viewport-space y that grows DOWNWARD
// (page top = small y), so reading order is y ASC then x ASC.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

async function buildRotatedFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([480, 640]);
  page.setRotation(degrees(90));
  // For /Rotate 90, viewport maps raw (x, y) -> (y, x).
  // Visual line 1 == raw x 60; words read left->right as raw y asc.
  page.drawText("AAA", { x: 60, y: 200, size: 12, font });
  page.drawText("BBB", { x: 60, y: 260, size: 12, font });
  // Visual line 2 == raw x 120 (below line 1).
  page.drawText("CCC", { x: 120, y: 240, size: 12, font });
  page.drawText("DDD", { x: 120, y: 300, size: 12, font });
  return doc.save();
}

const bytes = await buildRotatedFixture();
const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
const docr = await task.promise;
const rpage = await docr.getPage(1);
const viewport = rpage.getViewport({ scale: 1 });
const rcontent = await rpage.getTextContent();
const rlines = layoutPageLines(viewport, rcontent.items ?? []);
await rpage.cleanup();
await task.destroy();

ok("rotated: line count", rlines.length === 2, JSON.stringify(rlines.map((l) => l.text)));
ok(
  "rotated: line order and joining correct (no two-column interleave)",
  collapseSpaces(rlines[0].text) === "AAA BBB" &&
    collapseSpaces(rlines[1].text) === "CCC DDD",
  JSON.stringify(rlines.map((l) => l.text)),
);

async function buildPitchFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const line = (txt, y) => page.drawText(txt, { x: 50, y, size: 12, font });
  line("First para line a", 640);
  line("First para line b", 600);
  line("First para line c", 560);
  line("Second para line d", 440); // 120px gap vs 40px pitch -> blank
  return doc.save();
}

const pbytes = await buildPitchFixture();
const ptask = pdfjs.getDocument({ data: new Uint8Array(pbytes) });
const pdoc = await ptask.promise;
const ppage = await pdoc.getPage(1);
const pviewport = ppage.getViewport({ scale: 1 });
const pcontent = await ppage.getTextContent();
const plines = layoutPageLines(pviewport, pcontent.items ?? []);
await ppage.cleanup();
await ptask.destroy();

ok("pitch: blank line detected at paragraph break", plines.some((l) => l.blank));
const blanks = plines.map((l) => l.blank);
ok(
  "pitch: exactly one blank (the break before para 2)",
  blanks.filter(Boolean).length === 1,
  JSON.stringify(plines),
);
ok(
  "pitch: top-to-bottom order preserved (y asc)",
  plines[0].text === "First para line a" &&
    plines[1].text === "First para line b" &&
    plines[2].text === "First para line c" &&
    plines[3].text === "Second para line d",
  JSON.stringify(plines),
);

console.log(`\npassed ${pass}, failed ${fail}`);
process.exit(fail ? 1 : 0);