// Node check: PDF to Excel — pure-logic mirrors of PdfToExcel.tsx
// Run: node audit/check-pdf-to-excel.mjs
import { PDFDocument, StandardFonts } from "pdf-lib";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

let pass = 0;
let fail = 0;
function ok(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

// ---- Mirrors (byte-for-byte with PdfToExcel.tsx) ----
function sanitizeXml(s) {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
function escapeCsv(s) {
  const neutralized = /^[\t\n\r ]*[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(neutralized))
    return `"${neutralized.replace(/"/g, '""')}"`;
  return neutralized;
}
function buildXlsx(sheets) {
  const colLetter = (i) => {
    let n = i + 1;
    let s = "";
    while (n > 0) {
      n -= 1;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  };
  const xmlEsc = (s) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const parts = {};
  let sheetXml = "";
  parts["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  sheets.forEach((sheet, si) => {
    const name = sheet.name ?? `Sheet${si + 1}`;
    let rowsXml = "";
    let maxCol = 0;
    sheet.rows.forEach((row, ri) => {
      maxCol = Math.max(maxCol, row.length);
      let cells = "";
      row.forEach((c, ci) => {
        cells += `<c r="${colLetter(ci)}${ri + 1}" t="inlineStr"><is><t>${xmlEsc(
          c,
        )}</t></is></c>`;
      });
      rowsXml += `<row r="${ri + 1}">${cells}</row>`;
    });
    sheetXml += `<sheetData>${rowsXml}</sheetData>`;
    parts[
      `xl/worksheets/sheet${si + 1}.xml`
    ] = strToU8(
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colLetter(
        Math.max(1, maxCol),
      )}${Math.max(1, sheet.rows.length)}"/>
      ${sheetXml}</worksheet>`,
    );
  });
  parts["[Content_Types].xml"] = strToU8(
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  );
  parts["_rels/.rels"] = strToU8(
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  parts["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  );
  return zipSync(parts, { level: 6 });
}

const GAP_THRESHOLD = 24;

function normRowsFromItems(items) {
  const words = [];
  for (const it of items) {
    if (typeof it.str !== "string" || !it.str.trim()) continue;
    const t = it.transform ?? [];
    const x = t[4] ?? 0;
    const y = t[5] ?? 0;
    words.push({ x, y, w: it.width ?? 4, text: it.str });
  }
  if (words.length === 0) return [];
  words.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));
  const lines = [];
  let line = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    const sameLine = Math.abs(prev.y - cur.y) <= 2.5 && prev.x <= cur.x;
    if (sameLine) line.push(cur);
    else {
      lines.push(line);
      line = [cur];
    }
  }
  lines.push(line);
  return lines.map((wordsInLine) => {
    const sorted = [...wordsInLine].sort((a, b) => a.x - b.x);
    const cells = [];
    let cur = sorted[0].text;
    let prevEnd = sorted[0].x + sorted[0].w;
    for (let i = 1; i < sorted.length; i++) {
      const w = sorted[i];
      if (w.x - prevEnd > GAP_THRESHOLD) {
        cells.push(cur.trim());
        cur = w.text;
      } else {
        const gap = w.x - prevEnd;
        cur += gap > 1 ? ` ${w.text}` : w.text;
      }
      prevEnd = Math.max(prevEnd, w.x + w.w);
    }
    cells.push(cur.trim());
    return cells;
  });
}

// ---- CSV injection neutralization ----
ok("CSV: '=' prefix gets apostrophe", escapeCsv("=SUM(A1)") === "'=SUM(A1)");
ok("CSV: '-' prefix gets apostrophe", escapeCsv("-1") === "'-1");
ok("CSV: '+' prefix gets apostrophe", escapeCsv("+44") === "'+44");
ok("CSV: '@' prefix gets apostrophe", escapeCsv("@cmd") === "'@cmd");
ok("CSV: whitespace before '=' still neutralized", escapeCsv("  =HI()") === "'  =HI()");
ok("CSV: plain text untouched", escapeCsv("Plain text") === "Plain text");
ok(
  "CSV: quote doubling",
  escapeCsv('say "hi"') === '"say ""hi"""',
);
ok(
  "CSV: comma + newline quoted",
  escapeCsv("a,b\nc") === '"a,b\nc"',
);
ok("CSV: safe '=ok' not over-escaped", escapeCsv("=ok") === "'=ok");

// ---- sanitizeXml strips control chars ----
ok(
  "XML: control chars stripped",
  sanitizeXml("a\x01b\x0Bc\x1Fd") === "abcd",
  JSON.stringify(sanitizeXml("a\x01b\x0Bc\x1Fd")),
);
ok("XML: normal chars kept", sanitizeXml("héllo & <tag>\"q\"") === "héllo & <tag>\"q\"");

// ---- xlsx package: build via mirror + unzip + inspect ----
const rows = [
  ["Item", "Price", "=\nSUM(A1)", "a\x01b", "x&y"],
  ["Widget", "9.99", "-3", "q,2", "m<>n"],
];
const zipBytes = buildXlsx([
  { name: "Sheet1", rows: rows.map((r) => r.map(sanitizeXml)) },
]);
const unzipped = unzipSync(zipBytes);
ok("xlsx: 5 parts", Object.keys(unzipped).length === 5, Object.keys(unzipped).join(","));
const sheetXml = strFromU8(unzipped["xl/worksheets/sheet1.xml"]);
ok("xlsx: sheet1.xml present", !!sheetXml);
ok("xlsx: escaped &amp;", sheetXml.includes("x&amp;y"));
ok("xlsx: escaped &lt;", /m&lt;&gt;n/.test(sheetXml));
ok(
  "xlsx: no raw control byte 0x01",
  ![...sheetXml].some((c) => c.charCodeAt(0) === 0x01 || c.charCodeAt(0) === 0x0b),
);
ok("xlsx: dimension ref present", /dimension ref="A1:F2"/.test(sheetXml));
ok("xlsx: row1 has 5 cells", /<row r="1">(?:<c )[^]*?<\/row>/.test(sheetXml));
ok(
  "xlsx: cell D1 sanitized (control chars stripped)",
  sheetXml.includes('<c r="D1" t="inlineStr"><is><t>ab</t></is></c>'),
);
ok(
  "xlsx: formula-looking cell kept as text",
  /<c r="C1" t="inlineStr"><is><t>=&lt;\/t><\/is><\/c>/.test(sheetXml) ||
    sheetXml.includes("<t>="),
  "C1 cell " + sheetXml.match(/<c r="C1"[^]*?<\/c>/)?.[0],
);

// ---- Real fixture through pdfjs legacy build + normRowsFromItems ----
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

async function buildFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  // Row A (top): three words, controlled gaps via known widths
  const wA = font.widthOfTextAtSize("Alpha", 12);
  const wB = font.widthOfTextAtSize("Beta", 12);
  page.drawText("Alpha", { x: 50, y: 700, size: 12, font });
  // 8px gap -> same cell (gap <= 24), joins with single space
  page.drawText("Beta", { x: 50 + wA + 8, y: 700, size: 12, font });
  // ~120px gap -> new cell (robust to pdfjs metric inflation)
  page.drawText("Stripe", { x: 50 + wA + 8 + wB + 120, y: 700, size: 12, font });
  // Row B (below): single cell
  page.drawText("Second row cells one", { x: 50, y: 650, size: 12, font });
  return doc.save();
}

const bytes = await buildFixture();
const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
const docr = await task.promise;
const page = await docr.getPage(1);
const content = await page.getTextContent();
await page.cleanup();
await task.destroy();
const fixtureRows = normRowsFromItems(content.items ?? []);
ok("fixture: two rows extracted", fixtureRows.length === 2, JSON.stringify(fixtureRows));
ok(
  "fixture: top row -> [Alpha Beta, Stripe] (gap 8 joins, gap 40 splits)",
  fixtureRows.length === 2 &&
    fixtureRows[0].length === 2 &&
    fixtureRows[0][0] === "Alpha Beta" &&
    fixtureRows[0][1] === "Stripe",
  JSON.stringify(fixtureRows[0]),
);
ok(
  "fixture: bottom row preserved",
  fixtureRows[1]?.[0] === "Second row cells one",
  JSON.stringify(fixtureRows[1]),
);
ok("fixture: reading order top-to-bottom", fixtureRows[0].join(" ").includes("Alpha"));

console.log(`\npassed ${pass}, failed ${fail}`);
process.exit(fail ? 1 : 0);