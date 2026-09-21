import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const DL = "/tmp/p2t";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595.28, 841.89]);
  page.drawText("ALPHA PARAGRAPH ONE", { x: 50, y: 720, size: 14, font });
  page.drawText("ALPHA PARAGRAPH TWO", { x: 50, y: 680, size: 14, font });
  // deliberately written right-before-left on the same baseline:
  page.drawText("RIGHT SIDE", { x: 200, y: 640, size: 14, font });
  page.drawText("LEFT SIDE", { x: 50, y: 640, size: 14, font });
  page = doc.addPage([595.28, 841.89]);
  page.drawText("BETA PAGE TWO", { x: 50, y: 700, size: 14, font });
  writeFileSync(`${DL}/text2.pdf`, await doc.save());
}
{
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  writeFileSync(`${DL}/scanned.pdf`, await doc.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
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
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const alert = (t) => page.locator("[role='alert']", { hasText: t });
const status = (t) => page.locator("[role='status']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");
const pagesInput = () => page.locator("input[placeholder^='e.g. 1-3 ']");
const textareaValue = async () => page.locator("textarea[aria-label='Extracted text']").inputValue();

async function extractAndReturn(path, timeout = 60000) {
  await fileInput().setInputFiles(path);
  await page.waitForSelector("textarea[aria-label='Extracted text']", { timeout });
  return textareaValue();
}

try {
  await page.goto(`${BASE_URL}/use/pdf-to-text`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose PDF" }).waitFor({ state: "visible", timeout: 15000 });

  check((await page.locator("[role='button'][aria-label^='Upload a PDF']").count()) === 1, "idle state shows a clickable drop zone");
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF file", "file input carries an accessible name");
  check((await pagesInput().count()) === 1, "page-range input is present");
  check(await pagesInput().evaluate((el) => el.labels?.length === 1), "page-range input has an associated <label for>");

  const value = await extractAndReturn(`${DL}/text2.pdf`);
  check(value.includes("ALPHA PARAGRAPH ONE"), "extracts the first paragraph");
  check(value.includes("ALPHA PARAGRAPH TWO"), "extracts the second paragraph");
  const lines = value.split("\n");
  check(
    lines.findIndex((l) => l.includes("ALPHA PARAGRAPH ONE")) !== lines.findIndex((l) => l.includes("ALPHA PARAGRAPH TWO")),
    "paragraphs land on separate lines",
  );
  check(lines.some((l) => l.includes("LEFT SIDE RIGHT SIDE")), "same-line tokens are reordered left-to-right by reading order");
  check(value.includes("BETA PAGE TWO"), "extracts text from later pages");

  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.locator("button", { hasText: "Download .txt" }).click(),
  ]);
  check(dl.suggestedFilename() === "text2.txt", "download uses the document name with a .txt extension");
  await dl.saveAs(`${DL}/out.txt`);
  const txt = readFileSync(`${DL}/out.txt`);
  check(txt[0] === 0xef && txt[1] === 0xbb && txt[2] === 0xbf, "download starts with a UTF-8 BOM");
  check(txt.toString("utf8").includes("ALPHA PARAGRAPH ONE"), "download contains the extracted text");

  await page.locator("button[aria-label='Copy extracted text']").click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip.includes("BETA PAGE TWO"), "copy button puts the text on the clipboard");

  check(await page.locator("textarea[aria-label='Extracted text']").getAttribute("aria-label"), "extracted text is labelled for assistive tech");

  await pagesInput().fill("1");
  const page1Only = await extractAndReturn(`${DL}/text2.pdf`);
  check(page1Only.includes("ALPHA PARAGRAPH ONE"), "page-range extraction keeps page 1 content");
  check(!page1Only.includes("BETA PAGE TWO"), "page-range extraction excludes page 2");

  await page.goto(`${BASE_URL}/use/pdf-to-text`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose PDF" }).waitFor({ state: "visible", timeout: 15000 });
  await pagesInput().fill("zz");
  check((await alert(/Enter pages like 1-3,5/).count()) === 1, "invalid page range is rejected up front");
  await pagesInput().fill("");

  await fileInput().setInputFiles(`${DL}/scanned.pdf`);
  await status("No selectable text was found").waitFor({ state: "visible", timeout: 60000 });
  check((await status("No selectable text was found").count()) === 1, "image-only PDF is flagged as needing OCR");
  check((await page.locator("a", { hasText: "Open PDF OCR" }).count()) === 1, "OCR tool is linked from the flag");

  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "encrypted PDF shows a friendly unlock message");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  await page.goto(`${BASE_URL}/tools/pdf-to-text`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/page range/.test(body), "page-range behavior documented in marketing copy");
  check(/scanned/i.test(body), "scanned-PDF limitation documented in marketing copy");
  check(!/any PDF document/.test(body) && !/from any PDF/.test(body), "no 'any PDF' overclaim in marketing copy");
  check(!/paste, extract/.test(body) && !/Just paste/.test(body), "no paste flow claimed in marketing copy");
} catch (e) {
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);