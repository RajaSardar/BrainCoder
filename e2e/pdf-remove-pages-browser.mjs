import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-remove-pages`;
const DL = "/tmp/p2rp";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// fixtures
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`PAGE NUMBER ${i}`, { x: 200, y: 700, size: 18, font });
  }
  writeFileSync(`${DL}/sample3.pdf`, await doc.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
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
const pageBtn = (n) => page.locator(`button[aria-label^="Page ${n}"]`);

async function captureDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

const pageCount = async (bytes) => (await PDFDocument.load(bytes)).getPageCount();

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Open PDF" }).waitFor({ state: "visible", timeout: 15000 });

  // --- idle state ---
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to delete pages from", "file input carries an accessible name");
  check((await page.locator("fieldset").count()) === 0, "controls hidden until a document is loaded");
  check(/(Nothing is uploaded)/.test((await status(/Open a PDF, tap the pages to delete/).first().textContent()) ?? ""), "idle state explains pages are tapped");

  // --- upload ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded 3 pages/).count()) === 1, "load status reports the page count");
  check((await page.locator("fieldset > legend").first().textContent()) === "Pages to delete", "selection group has a legend");
  check((await page.locator('button[aria-label^="Page "]').count()) === 3, "three page thumbnails rendered");

  // --- no-op guard: zero selected means disabled ---
  const del0 = () => page.locator("fieldset button", { hasText: "Delete 0 pages" });
  check((await del0().isDisabled()) === true, "Delete is disabled with zero pages marked");
  check((await pageBtn(2).getAttribute("aria-pressed")) === "false", "no pages are preselected by default");

  // --- mark a page, delete, verify kept page count ---
  await pageBtn(2).click();
  check((await pageBtn(2).getAttribute("aria-pressed")) === "true", "tapping a thumbnail marks it (aria-pressed)");
  check((await page.locator("fieldset button", { hasText: "Delete 1 page" }).count()) === 1, "Delete label reflects one marked page");
  let d = await captureDownload(page.locator("fieldset button", { hasText: /Delete 1 page/ }), "r1.pdf");
  check(d.name === "sample3-kept-pages.pdf", "download named <source>-kept-pages.pdf");
  check((await pageCount(d.bytes)) === 2, "output contains only the kept pages");
  check(/(removed 1 page, 2 remaining)/.test((await status(/sample3-kept-pages\.pdf/).first().textContent()) ?? ""), "success status reports removed and remaining counts");

  // --- all-selected guard ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  await page.locator("fieldset button", { hasText: "Select all 3" }).click();
  await page.locator("fieldset button", { hasText: /Delete 3 pages/ }).click();
  await alert(/nothing would be left/).waitFor({ state: "visible", timeout: 15000 });
  check((await alert(/nothing would be left/).count()) === 1, "deleting every page is blocked");
  await page.locator("fieldset button", { hasText: "Clear" }).click();
  check((await page.locator("fieldset button", { hasText: "Delete 0 pages" }).isDisabled()) === true, "Clear empties the selection and disables Delete");

  // --- re-picking the same file resets state ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  check((await pageBtn(2).getAttribute("aria-pressed")) === "false", "reloading a file resets the selection");

  // --- invalid, locked and oversized files ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "encrypted PDF shows a friendly unlock message");
  check((await page.locator("body").textContent()).includes("PDF Unlock"), "friendly error points at PDF Unlock");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/larger than 100 MB/).waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/larger than 100 MB/).count()) === 1, "oversized file is rejected with guidance to PDF Split");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  await page.goto(`${BASE_URL}/tools/pdf-remove-pages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/100 MB/.test(body) && /200 pages/.test(body), "copy documents file/limit caps");
  check(!/enter specific page numbers/i.test(body), "no fake page-range input how-to");
  check(!/Confirm the deletion/i.test(body), "no phantom confirm step");
  check(!/Drag and drop your PDF/i.test(body), "no drag-and-drop promise");
  check(!/any size and page count/i.test(body), "no unlimited-size overclaim");
  check(/Remove Blank Pages/.test(body), "copy cross-links to Remove Blank Pages for auto-detection");

  // --- reciprocity: blank-pages page links back to PDF Delete Pages ---
  await page.goto(`${BASE_URL}/tools/pdf-remove-blank-pages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check(((await page.locator("body").textContent()) ?? "").includes("PDF Delete Pages"), "blank-pages page cross-links to PDF Delete Pages");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-remove-pages-from-a-pdf`);
  check(guide.status() === 200, "remove-pages guide renders");
  const guideText = await guide.text();
  check(!/page ranges/i.test(guideText), "guide no longer promises page ranges");
  check(/rebuilds the PDF from the pages you kept/.test(guideText), "guide describes the rebuild-from-kept mechanism");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-remove-pages"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-remove-pages-from-a-pdf"), "sitemap lists the remove-pages guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);