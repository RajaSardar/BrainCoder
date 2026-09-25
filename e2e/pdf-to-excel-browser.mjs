import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-to-excel`;
const DL = "/tmp/pdfexcel";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// Deterministic 2-page fixture: page 1 a 3-column grid with a formula-looking
// cell, page 2 a trailing note (row split by an empty row between pages).
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([612, 792]);
  const row = (y, c1, c2, c3) => {
    p1.drawText(c1, { x: 40, y, size: 12, font });
    p1.drawText(c2, { x: 170, y, size: 12, font });
    p1.drawText(c3, { x: 300, y, size: 12, font });
  };
  row(760, "Item", "Price", "Qty");
  row(720, "Widget", "=SUM(A1)", "2");
  row(680, "Gadget", "9.99", "1");
  const p2 = doc.addPage([612, 792]);
  p2.drawText("Note page two", { x: 40, y: 760, size: 12, font });
  writeFileSync(`${DL}/grid.pdf`, await doc.save());
}
writeFileSync(`${DL}/blank.pdf`, await (await (async () => {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.save();
})()));
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "definitely not a pdf\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) {
    passed++;
    console.log(`ok  ${label}`);
  } else {
    failed++;
    console.error(`NOT OK  ${label}`);
  }
}

const consoleIssues = [];
const pageErrors = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t))
    consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const alert = (t) => page.locator("[role='alert']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");

async function captureDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  check(
    (await fileInput().getAttribute("aria-label")) ===
      "Choose a PDF to convert to a spreadsheet",
    "file input carries an accessible name",
  );
  check(
    (await page
      .locator("[role='status']", { hasText: /Turn a PDF's text and tables into/ })
      .first().textContent()
    ).includes(".xlsx or .csv"),
    "idle status explains the .xlsx / .csv output",
  );

  // --- happy path: grid fixture ---
  await fileInput().setInputFiles(`${DL}/grid.pdf`);
  await page
    .locator("[role='status']", { hasText: /grid\.pdf loaded/ })
    .waitFor({ timeout: 60000 });
  check(
    (await page
      .locator("[role='status']", { hasText: /grid\.pdf loaded/ })
      .first().textContent()
    ).includes("5 text rows, 10 cells"),
    "status reports the real row/cell count",
  );
  check(
    (await page
      .locator("[role='status']", { hasText: /Extracted 5 text rows \(10 cells\)/ })
      .first().textContent()
    ).includes("Cells are exported as text"),
    "success message says cells are exported as text (no formulas)",
  );
  const previewCells = await page.locator("table td").allTextContents();
  for (const expected of ["Item", "Price", "Qty", "Widget", "=SUM(A1)", "Gadget", "9.99", "Note page two"])
    check(previewCells.includes(expected), `preview contains "${expected}"`);
  check(
    (await page.locator("tbody tr").count()) === 5,
    "preview shows 5 rows (grid + inter-page blank + trailing note)",
  );

  // --- .xlsx download: valid package, cells exported as text ---
  const x = await captureDownload(
    page.locator("button", { hasText: /Download \.xlsx/ }),
    "grid.xlsx",
  );
  check(x.name === "grid.xlsx", ".xlsx download named <source>.xlsx");
  const sheetXml = strFromU8(
    unzipSync(new Uint8Array(x.bytes))["xl/worksheets/sheet1.xml"],
  );
  check(sheetXml.includes('<c r="A1"'), ".xlsx sheet opens with expected cell refs");
  check(
    sheetXml.includes('c r="B2" t="inlineStr"') && sheetXml.includes("=SUM(A1)"),
    "formula-looking cell stored as inline text (no Excel formula)",
  );

  // --- .csv download: BOM + formula-injection neutralization ---
  const c = await captureDownload(page.locator("button", { hasText: /Download \.csv/ }), "grid.csv");
  check(c.name === "grid.csv", ".csv download named <source>.csv");
  check(
    c.bytes[0] === 0xef && c.bytes[1] === 0xbb && c.bytes[2] === 0xbf,
    ".csv starts with a UTF-8 BOM",
  );
  const csv = c.bytes.toString("utf8").replace(/^\ufeff/, "");
  check(csv.includes("Item,Price,Qty"), ".csv keeps column headers");
  check(csv.includes("'=SUM(A1)"), ".csv neutralizes a formula cell with a leading apostrophe");
  check(csv.includes("Widget") && csv.includes("Gadget"), ".csv contains the data rows");

  // --- blank text: OCR steer ---
  await fileInput().setInputFiles(`${DL}/blank.pdf`);
  await alert(/No text found/).waitFor({ timeout: 60000 });
  check(
    (await page.locator("a", { hasText: /Open PDF OCR/ }).getAttribute("href")) === "/use/pdf-ocr",
    "no-text error links to PDF OCR",
  );
  check((await alert(/scanned PDF has no text layer/).count()) === 1, "no-text message explains the lack of a text layer");

  // --- encrypted: friendly unlock steer ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert(/password-protected/).waitFor({ timeout: 60000 });
  check(
    (await alert(/This PDF is password-protected/).count()) === 1,
    "encrypted file gets a password message",
  );
  check((await page.locator("a", { hasText: /Open PDF OCR/ }).count()) === 0, "no OCR link for the encrypted case");

  // --- error paths ---
  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert(/doesn't look like a valid PDF/).waitFor({ timeout: 60000 });
  check((await alert(/doesn't look like a valid PDF/).count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const html = await (await page.request.get(`${BASE_URL}/tools/pdf-to-excel`)).text();
  const body = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/’/g, "'")
    .replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("text layer"), "copy says the conversion reads the text layer");
  check(body.includes("100 MB") && body.includes("200 pages"), "copy states the real limits");
  check(/cells are exported as text/i.test(body), "copy discloses cells are exported as text");
  check(!/intelligent table detection|smart table/i.test(lower), "no 'intelligent table detection' claim");
  check(!/drag and drop/i.test(lower), "no drag-and-drop promise");
  check(
    !/handles? merged cells|supports merged cells/i.test(lower) &&
      /Merged cells and spanning rows are not reproduced/i.test(body),
    "copy discloses merged cells are NOT reproduced (no overclaim)",
  );
  check(!/instant/i.test(lower), "no 'instant' hype");

  const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(titleTag.includes("PDF to Excel") && !/conversion/i.test(titleTag), `tool page title is honest: "${titleTag}"`);

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-convert-pdf-to-excel`);
  check(guide.status() === 200, "pdf-to-excel guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-to-excel"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-convert-pdf-to-excel"), "sitemap lists the pdf-to-excel guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);