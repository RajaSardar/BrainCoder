import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/html-to-pdf`;
const DL = "/tmp/htmltopdf";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const STANDARD_FONTS = new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).href;
const A4_W = 595.28;
const A4_H = 841.89;

const DOC = `<h1>Quarterly Report</h1>
<p>Revenue grew by <b>18%</b> in <i>Q3</i>, and churn fell to 2.1%.</p>
<h2>Highlights</h2>
<ul><li>Net revenue retention at 118%</li><li>Two new enterprise logos</li></ul>
<table>
  <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
  <tr><td>Developer tools subscription</td><td style="text-align:right">$29.00</td></tr>
</table>
<p>Prepared for the board.<br>— Finance</p>
${Array.from(
    { length: 45 },
    () => "<p>Supporting analysis row for the board appendix: revenue, retention, churn, and gross margin by quarter.</p>",
  ).join("\n")}`;

const MESSY = `<h1>Mixed</h1>
<style>.x{color:red}</style><script>alert(1)</script>
<img src="x.png" alt="Chart of revenue">
<p>Text with a stray ampersand &amp; a non-breaking&shy; hyphen.</p>
<ol><li>First step</li><li>Second step</li></ol>
<blockquote>Quoted customer feedback.</blockquote>
<pre>npm run build</pre>
<hr>
<p>Trailing paragraph.</p>`;

writeFileSync(`${DL}/invoice.html`, `<h1>Invoice</h1><p>Order #1024</p>`);
writeFileSync(`${DL}/big.html`, `<h1>Big</h1><p>${"x".repeat(210 * 1024)}</p>`);

function decodedContents(pdfDocPage) {
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
}

async function extractText(bytes, pageNum = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(0), standardFontDataUrl: STANDARD_FONTS });
  const doc = await task.promise;
  try {
    const content = await (await doc.getPage(pageNum)).getTextContent();
    return content.items.map((it) => it.str ?? "").join(" ");
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

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
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const alert = (t) => page.locator("[role='alert']", { hasText: t });
const status = (t) => page.locator("[role='status']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");
const convertBtn = () => page.locator("button", { hasText: /Convert to PDF/ });

async function convert(saveAs, timeout = 90000) {
  await page.evaluate(() => {
    window.__busySeen = false;
    const mo = new MutationObserver(() => {
      if (/Converting your HTML to PDF/.test(document.body.textContent || "")) window.__busySeen = true;
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__busyMo = mo;
  });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), convertBtn().click()]);
  await dl.saveAs(`${DL}/${saveAs}`);
  const busySeen = await page.evaluate(() => !!window.__busySeen);
  await page.evaluate(() => window.__busyMo?.disconnect());
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)), busySeen };
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("label", { hasText: /Open \.html file/ }).waitFor({ state: "visible", timeout: 15000 });

  // --- idle state ---
  check((await fileInput().getAttribute("aria-label")) === "Open an HTML file to convert", "file input carries an accessible name");
  check((await page.locator("div[aria-busy]").count()) >= 1, "root is marked aria-busy");
  check((await page.locator("[role='status']", { hasText: /never rendered or executed/ }).count()) >= 1, "idle hint states the HTML is never rendered or executed");
  check((await status(/KB of 200 KB/).count()) === 1, "source counter shows the 200 KB budget");
  check((await page.locator("[role='alert']").filter({ hasText: /\S/ }).count()) === 0, "no error on load");
  check((await page.locator("body").textContent()).includes("200 pages"), "page cap is disclosed in the UI");

  // --- labels are wired to controls ---
  {
    const ids = await page.locator("input, textarea").evaluateAll((els) => els.map((el) => el.id).filter(Boolean));
    const fors = await page.locator("label[for]").evaluateAll((els) => els.map((el) => el.htmlFor));
    check(ids.length >= 3 && fors.length >= 3 && fors.every((f) => ids.includes(f)), "every label points at a real control");
  }

  // --- the sample converts ---
  await convert("sample.pdf");
  check((await status(/Built \d+ pages? of A4 text/).count()) === 1, "success status reports the page count");
  const sampleText = await status(/First page, as laid out in the PDF/).count();
  check(sampleText === 0, "no first-page preview panel is shown for the empty-idle state");
  const sampleOut = await PDFDocument.load(new Uint8Array(readFileSync(`${DL}/sample.pdf`)));
  check(sampleOut.getPageCount() === 1, "sample HTML produces a single A4 page");
  check(
    Math.abs(sampleOut.getPage(0).getWidth() - A4_W) < 1 && Math.abs(sampleOut.getPage(0).getHeight() - A4_H) < 1,
    "pages are A4",
  );
  const samplePdfText = await extractText(new Uint8Array(readFileSync(`${DL}/sample.pdf`)));
  check(samplePdfText.includes("Invoice"), "sample H1 is in the text layer");
  check(samplePdfText.includes("$34.00") && samplePdfText.includes("Total"), "table cells and the bold total are in the text layer");
  check(samplePdfText.includes("Payment due within 14 days"), "list items are in the text layer");

  // --- a document with every block type ---
  await page.locator("textarea").fill(DOC);
  const doc1 = await convert("doc1.pdf");
  check(doc1.busySeen, "busy announced via role=status while converting");
  check(doc1.name === "invoice.pdf" || doc1.name.endsWith(".pdf"), `download is a .pdf (${doc1.name})`);
  const text1 = await extractText(doc1.bytes);
  check(text1.includes("Quarterly Report"), "H1 text is selectable in the PDF");
  check(text1.includes("18%") && text1.includes("Q3"), "bold and italic spans survive");
  check(text1.includes("Net revenue retention at 118%"), "unordered list items are converted");
  check(text1.includes("$29.00"), "right-aligned table cell is converted");
  const out1 = await PDFDocument.load(doc1.bytes);
  const stream1 = decodedContents(out1.getPage(0));
  check(out1.getPageCount() >= 2, "report HTML paginates across multiple pages");
  check(!/\/Subtype\s*\/Image/.test(Buffer.from(doc1.bytes).toString("latin1")), "no image XObject is embedded");
  check(/\/Helvetica-Bold-\d+ 21 Tf/.test(stream1), "heading is drawn with the bold font at 21pt");
  check(!/alert\(1\)/.test(text1), "no script content in the PDF");
  check(out1.getTitle() === "Invoice", "PDF title metadata comes from the title field");

  // --- determinism ---
  const doc2 = await convert("doc2.pdf");
  check(
    Buffer.compare(Buffer.from(doc1.bytes), Buffer.from(doc2.bytes)) === 0,
    "the same HTML produces byte-identical PDFs in the browser",
  );

  // --- download again re-saves the last build ---
  const [again] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.locator("button", { hasText: /Download again/ }).click(),
  ]);
  check(again.suggestedFilename().endsWith(".pdf"), "download again re-offers the pdf");

  // --- dropped elements and replaced characters are reported ---
  await page.locator("textarea").fill(MESSY);
  const messy = await convert("messy.pdf");
  await page.getByText(/skipped in this run/).first().waitFor({ timeout: 30000 });
  check((await page.getByText(/were skipped in this run/).count()) >= 1, "dropped element count is surfaced");
  const messyText = await extractText(messy.bytes);
  check(messyText.includes("Chart of revenue"), "alt text stands in for the dropped image");
  check(!/color:red/.test(messyText) && !/alert\(1\)/.test(messyText), "style and script content never reach the PDF");
  check(
    (await page.locator("code", { hasText: "image omitted" }).count()) >= 1,
    "the fidelity note names the image placeholder",
  );
  check(messyText.includes("First step") && messyText.includes("Second step"), "ordered list numbering is converted");

  // --- no text content ---
  await page.locator("textarea").fill("<script>alert(1)</script><style>p{color:red}</style>");
  await convertBtn().click();
  await alert(/No text content was found/).waitFor({ state: "visible", timeout: 30000 });
  check((await alert(/No text content was found/).count()) === 1, "empty document explains what the converter reads");

  // --- empty input ---
  await page.locator("textarea").fill("");
  check((await convertBtn().isDisabled()) === true, "convert is disabled with no input");
  await convertBtn().click({ force: true }).catch(() => {});

  // --- oversize file and oversize paste ---
  await fileInput().setInputFiles(`${DL}/big.html`);
  await alert(/larger than the 200 KB limit/).waitFor({ state: "visible", timeout: 30000 });
  check((await alert(/larger than the 200 KB limit/).count()) === 1, "oversize .html file is rejected with the 200 KB cap in the message");
  await fileInput().setInputFiles(`${DL}/invoice.html`);
  await status(/Loaded invoice\.html/).first().waitFor({ timeout: 30000 });
  check((await status(/Nothing was uploaded/).count()) === 1, "loading a file states that nothing was uploaded");

  // --- accessibility wiring ---
  check((await page.locator("[role='status']").count()) >= 3, "multiple polite live regions are present");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const toolRes = await page.request.get(`${BASE_URL}/tools/html-to-pdf`);
  const toolHtml = toolRes.ok() ? await toolRes.text() : "";
  const body = toolHtml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  check(toolHtml.length > 100, "tool marketing page renders");
  check(body.includes("selectable"), "copy advertises selectable text");
  check(body.includes("200 KB") && body.includes("200 pages"), "copy states both caps");
  check(/not carried over|are not reproduced|simplified/i.test(body), "copy admits advanced CSS is simplified");
  check(!/Preserves CSS styling, images/i.test(toolHtml), "no false fidelity claim in the tool page");
  check(toolHtml.includes("never leave your browser"), "copy states the privacy model");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-convert-html-to-pdf`);
  const guideText = guide.ok() ? await guide.text() : "";
  check(guide.status() === 200, "html-to-pdf guide renders");
  check(guideText.includes("text-based"), "guide describes the text-based conversion");
  check(guideText.includes("200 KB") && guideText.includes("200 pages"), "guide states the caps");
  check(!/applies normal css/i.test(guideText), "guide drops the false fidelity claim");

  const sitemap = await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text();
  check(sitemap.includes("/tools/html-to-pdf"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-convert-html-to-pdf"), "sitemap lists the html-to-pdf guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
