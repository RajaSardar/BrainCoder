import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { unzipSync } from "/Users/rajasardar/repos/BrainCoder/node_modules/fflate/esm/browser.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-to-ppt`;
const DL = "/tmp/p2p";
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
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 15; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`PAGE ${i}`, { x: 200, y: 700, size: 18, font });
  }
  writeFileSync(`${DL}/many15.pdf`, await doc.save());
}
{
  const doc = await PDFDocument.create();
  for (let i = 0; i < 210; i++) doc.addPage([595.28, 841.89]);
  writeFileSync(`${DL}/big210.pdf`, await doc.save());
}
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([4200, 3000]);
  page.drawText("BIG POSTER", { x: 200, y: 2600, size: 48 });
  writeFileSync(`${DL}/poster.pdf`, await doc.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");

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
const pagesInput = () => page.locator("input[placeholder^='e.g. 1-3,5']");
const previewImg = (n) => page.locator(`img[alt='Slide ${n} preview']`);

async function saveDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

const pptxSlides = (bytes) => {
  const unz = unzipSync(bytes);
  const files = Object.keys(unz);
  const slides = [...files].filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  const images = [...files].filter((f) => /^ppt\/media\/image\d+\.png$/.test(f));
  const presentations = slides.map((f) => new TextDecoder().decode(unz[f]));
  return { files, slides, images, presentations, unz };
};

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose PDF" }).waitFor({ state: "visible", timeout: 15000 });

  check((await page.locator("[role='button'][aria-label^='Upload a PDF']").count()) === 1, "idle state shows a clickable drop zone");
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF file", "file input carries an accessible name");
  check((await page.locator("input[type='range']").count()) === 1, "image-quality slider present");
  check((await page.locator("label", { hasText: "Slide image quality" }).count()) === 1, "slider has a visible label");
  check((await pagesInput().count()) === 1, "page-range input is present");
  check((await page.locator("button", { hasText: "Download .pptx" }).count()) === 0, "download button hidden until a document is rendered");

  // --- upload 3-page doc, auto-render ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await previewImg(1).waitFor({ state: "visible", timeout: 90000 });
  check((await page.locator("img[alt$='preview']").count()) === 3, "all three pages become previews");
  check(/3 slides ready/.test((await page.locator("div", { hasText: /3 slides ready/ }).first().textContent()) ?? ""), "render summary reports 3 slides ready");
  check((await page.locator("button", { hasText: "Download .pptx" }).count()) === 1, "download button appears after render");

  // --- download full deck ---
  const full = await saveDownload(page.locator("button", { hasText: "Download .pptx" }), "full.pptx");
  check(full.name === "sample3.pptx", "download uses the source filename base");
  let st = pptxSlides(full.bytes);
  check(st.slides.length === 3 && st.images.length === 3, "full deck has 3 slides and 3 images");
  check(st.presentations.every((x) => /r:embed="rId2"/.test(x)), "every slide embeds its snapshot image");
  check(st.presentations.every((x) => !/NaN|Infinity/.test(x)), "no NaN/Infinity in slide XML");
  check(/Downloaded sample3\.pptx — 3 slides/.test((await status(/Downloaded sample3/).first().textContent()) ?? ""), "success status states the filename and slide count");

  // --- page range ---
  await pagesInput().fill("2");
  await page.locator("button", { hasText: "Re-render" }).waitFor({ state: "visible", timeout: 10000 });
  await page.locator("button", { hasText: "Re-render" }).click();
  await previewImg(2).waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(250);
  check((await page.locator("img[alt$='preview']").count()) === 1, "entering a page range re-renders just those pages");
  check((await page.locator("img[alt='Slide 1 preview']").count()) === 0, "unselected pages drop out of the preview");
  const partial = await saveDownload(page.locator("button", { hasText: "Download .pptx" }), "partial.pptx");
  st = pptxSlides(partial.bytes);
  check(st.slides.length === 1, "downloaded deck contains exactly the selected page(s)");

  // --- invalid and locked ---
  await pagesInput().fill("2-1");
  check((await alert(/run upward/).count()) === 1, "descending page range is rejected");
  await pagesInput().fill("abc");
  check((await alert(/Enter pages like 1-3,5/).count()) === 1, "garbage page range is rejected inline");
  await pagesInput().fill("");
  check((await alert(/Enter pages like 1-3,5/).count()) === 0, "clearing the range clears the error");

  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "encrypted PDF shows a friendly unlock message");
  check((await page.locator("body").textContent()).includes("PDF Unlock"), "friendly error points at the PDF Unlock tool");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  // --- page-count cap ---
  await fileInput().setInputFiles(`${DL}/big210.pdf`);
  await alert(/limit 200 per run/).waitFor({ state: "visible", timeout: 90000 });
  check((await alert(/limit 200 per run/).count()) === 1, "210-page document triggers the per-run page cap with guidance");

  // --- busy/progress + preview cap ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("input[type='range']").evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "3");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await fileInput().setInputFiles(`${DL}/many15.pdf`);
  await status(/Rendering slide/).first().waitFor({ timeout: 90000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll("img[alt$='preview']").length === 12, null, { timeout: 120000 });
  check((await page.locator("img[alt$='preview']").count()) === 12, "previews limited to the first 12 slides");
  check(/15 slides ready/.test((await page.locator("div", { hasText: /15 slides ready/ }).first().textContent()) ?? ""), "15-page document reports 15 slides ready");
  check((await status(/Rendering slide/).count()) === 0, "progress status clears when rendering finishes");

  // --- huge-page area cap note ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await fileInput().setInputFiles(`${DL}/poster.pdf`);
  await page.waitForFunction(() => document.querySelectorAll("img[alt$='preview']").length === 1, null, { timeout: 90000 });
  await page.waitForTimeout(300);
  check((await page.locator("div", { hasText: /Reduced the image scale/ }).count()) >= 1, "oversized page renders with a scale-reduction notice");

  // --- drag-and-drop ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose PDF" }).waitFor({ state: "visible", timeout: 15000 });
  await page.evaluate(
    ([b64]) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "dropped.pdf", { type: "application/pdf" }));
      const el = document.querySelector("[role='button'][aria-label^='Upload a PDF']");
      el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    [readFileSync(`${DL}/sample3.pdf`).toString("base64")],
  );
  await previewImg(1).waitFor({ state: "visible", timeout: 90000 });
  const drop = await saveDownload(page.locator("button", { hasText: "Download .pptx" }), "drop.pptx");
  check(drop.name === "dropped.pptx", "dropped file converts under its own base name");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty + reciprocal + sitemap ---
  await page.goto(`${BASE_URL}/tools/pdf-to-ppt`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/snapshot image/.test(body), "marketing copy describes snapshot-image slides");
  check(/isn't editable|not editable|can't be edited/.test(body), "marketing copy admits slides aren't editable text");
  check(!/editable PowerPoint slides/.test(body), "no 'editable slides' overclaim");
  check(!/editable text boxes/.test(body), "no 'editable text boxes' overclaim");
  check(!/set your preferred slide dimensions/.test(body), "no false 'slide dimensions' claim");
  check(/page range/.test(body), "page-range behavior documented");

  await page.goto(`${BASE_URL}/tools/pdf-to-image`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const p2i = (await page.locator("body").textContent()) ?? "";
  check(/PDF to PowerPoint/.test(p2i), "pdf-to-image page cross-links to PDF to PowerPoint");

  const sitemap = (await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text());
  check(sitemap.includes("/tools/pdf-to-ppt"), "sitemap lists the pdf-to-ppt tool page");
  check(sitemap.includes("/guides/how-to-convert-pdf-to-powerpoint"), "sitemap lists the pdf-to-ppt guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);