import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-watermark`;
const DL = "/tmp/p2w";
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
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to watermark", "file input carries an accessible name");
  check((await page.locator("fieldset").count()) === 0, "settings hidden until a document is loaded");
  check(/(Nothing is uploaded)/.test((await status(/Open a PDF to stamp the same text watermark/).first().textContent()) ?? ""), "idle state explains watermarking is local");

  // --- upload ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded 3 pages/).count()) === 1, "load status reports the page count");
  check(/(sample3\.pdf — 3 pages)/.test((await status(/sample3\.pdf/).first().textContent()) ?? ""), "info line shows source name and page count");
  check((await page.locator("fieldset > legend").first().textContent()) === "Watermark settings", "settings group has a fieldset legend");

  // --- labels: text input id<->label, sliders labelled ---
  const textInput = page.locator("fieldset input[type='text']");
  const textId = await textInput.getAttribute("id");
  check(await page.locator(`fieldset label[for="${textId}"]`).first().textContent() === "Watermark text", "text input is associated with its label");
  const ranges = page.locator("fieldset input[type='range']");
  check((await ranges.count()) === 3, "three sliders (size, opacity, angle)");
  const sliderLabels = await page.locator("fieldset label").allTextContents();
  check(["Font size", "Opacity", "Angle"].every((l) => sliderLabels.includes(l)), "size/opacity/angle sliders each carry a label");

  // --- stamp defaults, verify filename + page preservation ---
  let d = await captureDownload(page.locator("fieldset button", { hasText: /Add watermark/ }), "w1.pdf");
  check(d.name === "sample3-watermarked.pdf", "download named <source>-watermarked.pdf");
  check((await pageCount(d.bytes)) === 3, "watermarked output keeps all pages");
  const rotations = (await PDFDocument.load(d.bytes)).getPages().map((p) => p.getRotation().angle);
  check(rotations.every((r) => r === 0), "page rotations preserved unchanged");
  check(/(stamped “CONFIDENTIAL” across 3 pages)/.test((await status(/sample3-watermarked\.pdf/).first().textContent()) ?? ""), "status names the watermark text and page count");

  // --- adjust text + opacity + angle then stamp again ---
  await textInput.fill("DRAFT");
  const opacity = ranges.nth(1);
  await opacity.fill("80");
  const angle = ranges.nth(2);
  await angle.fill("-45");
  d = await captureDownload(page.locator("fieldset button", { hasText: /Add watermark/ }), "w2.pdf");
  check(d.name === "sample3-watermarked.pdf", "second stamp reuses the same filename");
  check((await pageCount(d.bytes)) === 3, "custom settings output keeps all pages");
  check(/(stamped “DRAFT” across 3 pages at 80% opacity)/.test((await status(/Downloaded sample3-watermarked\.pdf/).first().textContent()) ?? ""), "status reflects the applied opacity");

  // --- non-WinAnsi characters produce a friendly error, bytes retained ---
  await textInput.fill("🔥 DRAFT");
  await page.locator("fieldset button", { hasText: /Add watermark/ }).click();
  await alert(/can't be encoded/).waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/can't be encoded/).count()) === 1, "unsupported characters are rejected with guidance, not stamped");

  // --- encrypted, invalid, oversized ---
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
  await page.goto(`${BASE_URL}/tools/pdf-watermark`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/12–120 pt/.test(body) && /1–100%/.test(body), "copy documents the real control ranges");
  check(/fixed bold Helvetica/.test(body), "copy states the fixed font");
  check(/PDF Redact/.test(body), "copy routes redaction needs to PDF Redact");
  check(/PDF Unlock/.test(body), "copy routes protected files to PDF Unlock");
  check(/PDF Editor/.test(body), "copy routes color/placement needs to PDF Editor");
  check(!/corner positioning|diagonal/i.test(body), "no corner/diagonal placement overclaim");
  check(!/pixel-perfect/i.test(body), "no pixel-perfect puffery");
  check(!/Drag and drop your PDF/i.test(body), "no drag-and-drop promise");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-add-a-text-watermark-to-a-pdf`);
  check(guide.status() === 200, "watermark guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-watermark"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-add-a-text-watermark-to-a-pdf"), "sitemap lists the watermark guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);