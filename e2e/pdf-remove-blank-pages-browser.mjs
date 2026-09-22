import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-remove-blank-pages`;
const DL = "/tmp/p2rb";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// fixtures: blank-pages.pdf has page 2 blank (verified via text extraction)
{
  const src = readFileSync("e2e/fixtures/blank-pages.pdf");
  writeFileSync(`${DL}/blank-pages.pdf`, src);
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

// a 3-page doc with distinct content where the middle page is blank
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  page.drawText("KEEP PAGE ONE", { x: 200, y: 700, size: 18 });
  doc.addPage([595.28, 841.89]);
  const last = doc.addPage([595.28, 841.89]);
  last.drawText("KEEP PAGE THREE", { x: 200, y: 700, size: 18 });
  writeFileSync(`${DL}/keep3.pdf`, await doc.save());
}

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
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to clean up blank pages", "file input carries an accessible name");
  check((await page.locator("fieldset").count()) === 0, "controls hidden until a document is loaded");
  check(/(Nothing is uploaded)/.test((await status(/Open a PDF to detect near-empty pages/).first().textContent()) ?? ""), "idle state explains detection runs locally");

  // --- upload the 3-page fixture (middle page blank) ---
  await fileInput().setInputFiles(`${DL}/blank-pages.pdf`);
  await status(/Detected 1 page/).first().waitFor({ timeout: 60000 });
  check((await status(/Detected 1 page/).count()) === 1, "detection status reports exactly one blank page");
  check(/(blank-pages\.pdf — 3 pages)/.test((await status(/blank-pages\.pdf/).first().textContent()) ?? ""), "info line shows source name and page count");
  check((await page.locator("fieldset > legend").first().textContent()) === "Blank page selection", "selection group has a fieldset legend");
  check((await page.locator('button[aria-label^="Page "]').count()) === 3, "three page thumbnails rendered");
  check((await pageBtn(2).getAttribute("aria-pressed")) === "true", "blank page 2 is preselected (aria-pressed)");
  check((await pageBtn(1).getAttribute("aria-pressed")) === "false", "content page 1 is not preselected");
  check((await page.locator('button[aria-label*="detected blank"]').count()) === 1, "only the blank page carries the detected-blank label");
  check((await page.locator("fieldset button", { hasText: "Select 1 blank page" }).count()) === 1, "reselect control uses singular grammar");

  // --- empty-selection guard: Clear disables Delete ---
  await page.locator("fieldset button", { hasText: "Select all 3" }).click();
  check((await page.locator("fieldset button", { hasText: "Clear" }).count()) === 1, "toggle swaps to Clear once every page is selected");
  check((await page.locator("fieldset button", { hasText: "Delete 3 pages" }).isDisabled()) === false, "Delete is enabled with all pages marked");
  await page.locator("fieldset button", { hasText: "Clear" }).click();
  const deleteBtn = () => page.locator("fieldset button", { hasText: "Delete 0 pages" });
  check((await deleteBtn().first().isDisabled()) === true, "Delete is disabled when zero pages are selected");

  // --- all-selected guard: selection cleared above, reselect all and attempt delete ---
  await page.locator("fieldset button", { hasText: "Select all 3" }).click();
  await page.locator("fieldset button", { hasText: /Delete 3 pages/ }).click();
  await alert(/nothing would be left/).waitFor({ state: "visible", timeout: 15000 });
  check((await alert(/nothing would be left/).count()) === 1, "deleting every page is blocked with a clear message");

  // --- manual selection deletes only the marked page ---
  await page.locator("fieldset button", { hasText: "Select 1 blank page" }).click();
  await pageBtn(1).click();
  check((await pageBtn(1).getAttribute("aria-pressed")) === "true", "manually marking a content page toggles it on");
  let d = await captureDownload(page.locator("fieldset button", { hasText: /Delete 2 pages/ }), "b1.pdf");
  check(d.name === "blank-pages-edited.pdf", "download named <source>-edited.pdf");
  check((await pageCount(d.bytes)) === 1, "output contains only the unmarked page");
  check(/(removed 2 pages, 1 remaining)/.test((await status(/blank-pages-edited\.pdf/).first().textContent()) ?? ""), "success status reports removed and remaining counts");

  // --- re-picking the same file resets the selection ---
  await fileInput().setInputFiles(`${DL}/blank-pages.pdf`);
  await status(/Detected 1 page/).first().waitFor({ timeout: 60000 });
  check((await pageBtn(2).getAttribute("aria-pressed")) === "true", "reloading a file resets selection back to detected blanks");

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
  await page.goto(`${BASE_URL}/tools/pdf-remove-blank-pages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/heuristic/.test(body), "copy discloses the heuristic nature of detection");
  check(/never removed without your click/.test(body), "copy says detection never removes without a click");
  check(/100 MB/.test(body) && /200 pages/.test(body), "copy documents file/limit caps");
  check(/PDF Unlock/.test(body), "copy routes protected files to PDF Unlock");
  check(!/just about any PDF source/.test(body), "no 'just about any PDF source' overclaim");
  check(!/exactly as they were/.test(body), "no lossless 'exactly as they were' overclaim");
  check(!/Drag and drop/i.test(body), "no drag-and-drop promise");

  // --- reciprocity: merge/split link back to Remove Blank Pages ---
  await page.goto(`${BASE_URL}/tools/pdf-merge`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check(((await page.locator("body").textContent()) ?? "").includes("Remove Blank Pages"), "pdf-merge page cross-links to Remove Blank Pages");
  await page.goto(`${BASE_URL}/tools/pdf-split`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check(((await page.locator("body").textContent()) ?? "").includes("Remove Blank Pages"), "pdf-split page cross-links to Remove Blank Pages");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-remove-blank-pages-from-pdf`);
  check(guide.status() === 200, "blank-pages guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-remove-blank-pages"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-remove-blank-pages-from-pdf"), "sitemap lists the blank-pages guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);