import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-crop`;
const DL = "/tmp/pdfcrop";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// fixtures — page 2 carries /Rotate 90 to exercise rotation-aware cropping
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    if (i === 2) page.setRotation(degrees(90));
    page.drawText(`CROP PAGE ${i}`, { x: 120, y: 700, size: 18, font });
    page.drawText(`CROP PAGE ${i} RIGHT`, { x: 480, y: 700, size: 18, font });
  }
  writeFileSync(`${DL}/sample3.pdf`, await doc.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

// expected crop rect per page for insets {top,right,bottom,left}, mirroring the component
function cropBoxFor(rot, media, { top, right, bottom, left }) {
  const { x: x0, y: y0, width: W, height: H } = media;
  const quarter = rot === 90 || rot === 270;
  const Wv = quarter ? H : W;
  const Hv = quarter ? W : H;
  const dl = (Wv * left) / 100;
  const dr = (Wv * right) / 100;
  const dt = (Hv * top) / 100;
  const db = (Hv * bottom) / 100;
  let X0, Y0, X1, Y1;
  if (rot === 90) {
    X0 = x0 + dt; Y0 = y0 + dl; X1 = x0 + W - db; Y1 = y0 + H - dr;
  } else if (rot === 180) {
    X0 = x0 + dr; Y0 = y0 + dt; X1 = x0 + W - dl; Y1 = y0 + H - db;
  } else if (rot === 270) {
    X0 = x0 + db; Y0 = y0 + dr; X1 = x0 + W - dt; Y1 = y0 + H - dl;
  } else {
    X0 = x0 + dl; Y0 = y0 + db; X1 = x0 + W - dr; Y1 = y0 + H - dt;
  }
  return { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 };
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

async function captureDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

const almost = (a, b, tol = 1e-4) => Math.abs(a - b) < tol;

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  // --- idle state ---
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to crop", "file input carries an accessible name");
  check((await page.locator("fieldset").count()) === 0, "crop controls hidden until a document is loaded");
  check(/(Processing is local|never leaves)/.test((await status(/Select a PDF to crop/).first().textContent()) ?? ""), "idle state explains processing is local");

  // --- upload ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded 3 pages/).count()) === 1, "load status reports the page count");
  check(/(sample3\.pdf — 3 pages)/.test((await status(/sample3\.pdf/).first().textContent()) ?? ""), "info line shows source name and page count");
  check((await page.locator("fieldset > legend").first().textContent()) === "Crop margins", "settings group has a fieldset legend");

  // --- preview renders (page 1 raster) with a real kept-area overlay ---
  const previewImg = page.locator("img[aria-hidden='true']");
  await previewImg.waitFor({ state: "visible", timeout: 60000 });
  check((await previewImg.count()) === 1, "page-1 preview raster is rendered");
  check((await page.locator("[role='img'][aria-label*='will remain']").count()) === 1, "kept-area overlay is exposed to assistive tech");

  // --- four labelled sliders ---
  const ranges = page.locator("input[type='range']");
  check((await ranges.count()) === 4, "four crop sliders (top/right/bottom/left)");
  for (const t of ["Top", "Right", "Bottom", "Left"]) {
    const label = page.locator("label", { hasText: t });
    const forId = await label.first().getAttribute("for");
    check(forId !== null && (await page.locator(`input[type='range'][id="${forId}"]`).count()) === 1, `“${t}” slider is associated with its label`);
  }

  // --- crop disabled at zero, hint shown ---
  const cropBtn = page.locator("button", { hasText: /Crop all pages/ });
  check((await cropBtn.isDisabled()) === true, "crop button disabled while every margin is 0");
  check((await page.locator("p", { hasText: /Move at least one slider/ }).count()) === 1, "hint explains why cropping is disabled");

  // --- crop page 2 (rot90) + pages 1/3 (rot0) with the default maths ---
  const top = 12, rightv = 8, bottom = 15, leftv = 20;
  await ranges.nth(0).fill(String(top)); // Top
  await ranges.nth(1).fill(String(bottom)); // Bottom
  await ranges.nth(2).fill(String(leftv)); // Left
  await ranges.nth(3).fill(String(rightv)); // Right
  check((await page.locator("p", { hasText: /Move at least one slider/ }).count()) === 0, "hint disappears once a margin is set");
  check((await cropBtn.isDisabled()) === false, "crop button enabled once a margin is set");

  let d = await captureDownload(cropBtn, "c1.pdf");
  check(d.name === "sample3-cropped.pdf", "download named <source>-cropped.pdf");
  const out1 = await PDFDocument.load(d.bytes);
  check(out1.getPageCount() === 3, "cropped output keeps all pages");
  const rot1 = out1.getPages().map((p) => p.getRotation().angle);
  check(rot1.join(",") === "0,90,0", "page rotations preserved unchanged");
  const insets = { top, right: rightv, bottom, left: leftv };
  const expected = [
    cropBoxFor(0, { x: 0, y: 0, width: 595.28, height: 841.89 }, insets),
    cropBoxFor(90, { x: 0, y: 0, width: 595.28, height: 841.89 }, insets),
    cropBoxFor(0, { x: 0, y: 0, width: 595.28, height: 841.89 }, insets),
  ];
  for (let i = 0; i < 3; i++) {
    const cb = out1.getPage(i).getCropBox();
    const mb = out1.getPage(i).getMediaBox();
    check(
      almost(cb.x, expected[i].x) && almost(cb.y, expected[i].y) && almost(cb.width, expected[i].width) && almost(cb.height, expected[i].height),
      `page ${i + 1} crop box equals rotation-aware math`,
    );
    check(almost(mb.width, 595.28) && almost(mb.height, 841.89), `page ${i + 1} MediaBox left untouched`);
    check(cb.width < mb.width && cb.height < mb.height, `page ${i + 1} crop is strictly smaller`);
  }
  check((await status(/Downloaded sample3-cropped\.pdf/).first().textContent()).includes("Cropped all 3 pages"), "status confirms the cropped download");

  // --- second run with different margins still produces valid output ---
  await ranges.nth(0).fill("30"); // Top
  const d2 = await captureDownload(cropBtn, "c2.pdf");
  check(d2.name === "sample3-cropped.pdf", "repeat crop reuses the same filename");
  const out2 = await PDFDocument.load(d2.bytes);
  check(out2.getPageCount() === 3, "repeat crop output keeps all pages");
  const insets2 = { top: 30, right: rightv, bottom, left: leftv };
  const exp2 = cropBoxFor(0, { x: 0, y: 0, width: 595.28, height: 841.89 }, insets2);
  const cb2 = out2.getPage(0).getCropBox();
  check(almost(cb2.y, exp2.y) && almost(cb2.height, exp2.height), "repeat crop uses the new margins");

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
  const html = await (await page.request.get(`${BASE_URL}/tools/pdf-crop`)).text();
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/’/g, "'").replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("0–45%"), "copy documents the real margin range (0–45%)");
  check(body.includes("same percentages are applied to every page"), "copy says margins are uniform across pages");
  check(body.includes("not deleted from the file"), "copy explains cropping is non-destructive (no trim lie)");
  check(body.includes("100% client-side"), "copy states the privacy model");
  check(body.includes("PDF Unlock"), "copy routes protected files to PDF Unlock");
  check(!/Drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/per-page adjustments/i.test(lower) && !/per-page cropping/i.test(lower), "no per-page cropping promise");
  check(!/inches|millimeters|pixels/i.test(lower), "no unit-inches/mm/px claims in copy");
  check(!/trim option/i.test(lower), "no phantom trim option");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-crop-a-pdf`);
  check(guide.status() === 200, "pdf-crop guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-crop"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-crop-a-pdf"), "sitemap lists the pdf-crop guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);