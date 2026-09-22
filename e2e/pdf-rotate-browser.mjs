import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-rotate`;
const DL = "/tmp/p2r";
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
const rotBtn = (t) => page.locator("fieldset button", { hasText: t });

async function captureDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

const rotAngle = async (bytes) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => p.getRotation().angle);

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Open PDF" }).waitFor({ state: "visible", timeout: 15000 });

  // --- idle state ---
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF file to rotate", "file input carries an accessible name");
  check((await rotBtn("90° clockwise").count()) === 0, "rotate controls hidden until a document is loaded");
  check(/(Select a PDF to rotate)/.test((await status(/Select a PDF to rotate/).first().textContent()) ?? ""), "idle state explains every page is rotated together");

  // --- upload 3-page doc ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded 3 pages/).count()) === 1, "load status reports the page count");
  check(/(now at 0°)/.test((await status(/sample3\.pdf/).first().textContent()) ?? ""), "info line shows source name, page count, and original orientation");
  check((await rotBtn("90° clockwise").count()) === 1, "rotate controls appear after loading");
  check((await rotBtn("90° counter-clockwise").count()) === 1, "counter-clockwise control appears");
  check((await rotBtn("180°").count()) === 1, "180° control appears");

  // --- rotate 90° CW: every page, instant download, valid /Rotate ---
  let d = await captureDownload(rotBtn("90° clockwise"), "r1.pdf");
  check(d.name === "sample3-rotated.pdf", "first download uses <source>-rotated.pdf");
  let ang = await rotAngle(d.bytes);
  check(ang.length === 3 && ang.every((a) => a === 90), "all three pages rotate to 90°");
  check((await status(/Downloaded sample3-rotated\.pdf/).count()) === 1, "success status names the downloaded file");

  // --- accumulate: second 90° CW reaches 180° from the SAME doc ---
  d = await captureDownload(rotBtn("90° clockwise"), "r2.pdf");
  check(d.name === "sample3-rotated-2.pdf", "second download gets a distinct filename");
  ang = await rotAngle(d.bytes);
  check(ang.every((a) => a === 180), "repeated rotate accumulates to 180°, not a re-issue of 90°");
  check(/(now rotated to 180°)/.test((await status(/Downloaded sample3-rotated-2\.pdf/).first().textContent()) ?? ""), "status states the cumulative orientation");

  // --- counter-clockwise chains and full circle ---
  d = await captureDownload(rotBtn("90° counter-clockwise"), "r3.pdf");
  ang = await rotAngle(d.bytes);
  check(ang.every((a) => a === 90), "counter-clockwise continues from current orientation (180° → 90°)");
  d = await captureDownload(rotBtn("90° counter-clockwise"), "r4.pdf");
  ang = await rotAngle(d.bytes);
  check(ang.every((a) => a === 0), "four 90° steps complete a full circle back to 0°");
  check(/(back to the original orientation)/.test((await status(/Downloaded sample3-rotated-4\.pdf/).first().textContent()) ?? ""), "full circle is acknowledged in the status");
  d = await captureDownload(rotBtn("180°"), "r5.pdf");
  ang = await rotAngle(d.bytes);
  check(ang.every((a) => a === 180), "180° rotates the whole set to 180°");

  // --- re-picking the same file resets rotation state ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  d = await captureDownload(rotBtn("90° clockwise"), "r6.pdf");
  check(d.name === "sample3-rotated.pdf", "reloading a file resets the download counter and rotation");
  ang = await rotAngle(d.bytes);
  check(ang.every((a) => a === 90), "fresh load starts from the original orientation");

  // --- invalid and locked files ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "encrypted PDF shows a friendly unlock message");
  check((await page.locator("body").textContent()).includes("PDF Unlock"), "friendly error points at the PDF Unlock tool");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  // --- 100 MB cap ---
  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/larger than 100 MB/).waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/larger than 100 MB/).count()) === 1, "oversized file is rejected with guidance to PDF Split");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty + reciprocal + sitemap ---
  await page.goto(`${BASE_URL}/tools/pdf-rotate`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/rotated together/.test(body), "marketing copy says the whole document is rotated together");
  check(/270°/.test(body), "marketing copy documents how 270° is reached");
  check(/100 MB/.test(body), "marketing copy documents the file-size limit");
  check(/PDF Editor/.test(body), "marketing copy routes per-page needs to PDF Editor");
  check(!/individual pages or entire/.test(body), "no 'individual pages or entire document' overclaim");
  check(!/Click on individual pages/.test(body), "no click-on-pages how-to step");
  check(!/per-page basis/.test(body), "no per-page rotation overclaim");
  check(!/Preview the corrected orientation/.test(body), "no preview overclaim");
  check(!/Drag and drop your PDF/i.test(body), "no drag-and-drop promise");

  await page.goto(`${BASE_URL}/tools/pdf-to-image`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const p2i = (await page.locator("body").textContent()) ?? "";
  check(/PDF Rotator/.test(p2i), "pdf-to-image page cross-links to PDF Rotator");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-rotate-a-pdf`);
  check(guide.status() === 200, "how-to-rotate-a-pdf guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-rotate"), "sitemap lists the pdf-rotate tool page");
  check(sitemap.includes("/guides/how-to-rotate-a-pdf"), "sitemap lists the rotate guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);