// Production-Chrome e2e for the "Scale Pages" tool.
//
// Mirrors e2e/pdf-flatten-browser.mjs: real Chrome via playwright-core, the
// real /use/pdf-scale-pages route, fixtures built in a temp dir, and every
// downloaded file re-parsed with pdfjs + pdf-lib to prove the promise (the
// page box really halved, the text is still selectable, no image XObject was
// baked in, form values survived) rather than trusting the UI.
//
//   node e2e/pdf-scale-pages-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/pdf-scale-pages-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts, degrees, PDFName } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-scale-pages`;
const DL = "/tmp/pdfscalepages";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const LETTER_W = 612;
const LETTER_H = 792;

// --------------------------------------------------------------------------
// fixtures
// --------------------------------------------------------------------------
// sample.pdf    — 2 pages of real selectable text, 612x792
// rotated.pdf   — one page carrying /Rotate 90
// offset.pdf    — MediaBox [20,30,620,810] + CropBox + TrimBox + a link annot
// mixed.pdf     — three pages of different sizes
// form.pdf      — a filled text field
// manypages.pdf — 201 pages (one over the 200-page cap)
// locked.pdf    — copy of e2e/fixtures/encrypted.pdf
// notapdf.pdf   — plain text, no %PDF- header
// huge.pdf      — 100 MB + 1000 bytes (over the size cap)
{
  const context = await (async () => {
    const d = await PDFDocument.create();
    d.addPage([10, 10]);
    return d.context;
  })();

  const sample = await PDFDocument.create();
  const font = await sample.embedFont(StandardFonts.Helvetica);
  const p1 = sample.addPage([LETTER_W, LETTER_H]);
  p1.drawText("SCALABLE BODY TEXT", { x: 60, y: 700, size: 18, font });
  p1.drawText("Second line of real text.", { x: 60, y: 660, size: 12, font });
  const p2 = sample.addPage([LETTER_W, LETTER_H]);
  p2.drawText("PAGE TWO BODY", { x: 60, y: 700, size: 18, font });
  writeFileSync(`${DL}/sample.pdf`, await sample.save());

  const rot = await PDFDocument.create();
  const rotFont = await rot.embedFont(StandardFonts.Helvetica);
  const rp = rot.addPage([LETTER_W, LETTER_H]);
  rp.setRotation(degrees(90));
  rp.drawText("ROTATED BODY", { x: 60, y: 700, size: 14, font: rotFont });
  writeFileSync(`${DL}/rotated.pdf`, await rot.save());

  const off = await PDFDocument.create();
  const offFont = await off.embedFont(StandardFonts.Helvetica);
  const op = off.addPage([600, 780]);
  op.node.set(PDFName.of("MediaBox"), context.obj([20, 30, 620, 810]));
  op.node.set(PDFName.of("CropBox"), context.obj([20, 30, 600, 780]));
  op.node.set(PDFName.of("TrimBox"), context.obj([25, 35, 595, 775]));
  op.drawText("OFFSET PAGE TEXT", { x: 100, y: 700, size: 12, font: offFont });
  op.node.set(
    PDFName.of("Annots"),
    context.obj([
      context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: context.obj([100, 690, 300, 715]),
      }),
    ]),
  );
  writeFileSync(`${DL}/offset.pdf`, await off.save());

  const mixed = await PDFDocument.create();
  mixed.addPage([LETTER_W, LETTER_H]);
  mixed.addPage([842, 595]);
  mixed.addPage([300, 300]);
  writeFileSync(`${DL}/mixed.pdf`, await mixed.save());

  const form = await PDFDocument.create();
  const formFont = await form.embedFont(StandardFonts.Helvetica);
  const fp = form.addPage([LETTER_W, LETTER_H]);
  fp.drawText("FORM PAGE", { x: 60, y: 700, size: 14, font: formFont });
  const field = form.getForm().createTextField("fullname");
  field.addToPage(fp, { x: 72, y: 600, width: 201, height: 25, font });
  field.setText("Ada Lovelace");
  writeFileSync(`${DL}/form.pdf`, await form.save());

  const many = await PDFDocument.create();
  for (let i = 0; i < 201; i += 1) many.addPage([200, 200]);
  writeFileSync(`${DL}/manypages.pdf`, await many.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

// --------------------------------------------------------------------------
// pdfjs / pdf-lib helpers — the output is inspected, never the UI's word
// --------------------------------------------------------------------------
async function pageFacts(bytes, pageNum = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(0) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(pageNum);
    const text = await page.getTextContent();
    const view = page.getViewport({ scale: 1 });
    return {
      numPages: doc.numPages,
      text: (text.items ?? []).map((i) => i.str ?? "").join(""),
      textItems: (text.items ?? []).length,
      firstItem: (text.items ?? [])[0]
        ? {
            transform: Array.from(text.items[0].transform),
            width: text.items[0].width,
            height: text.items[0].height,
          }
        : null,
      viewBox: Array.from(view.viewBox),
      width: view.width,
      height: view.height,
    };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

function countImages(pdfBytes) {
  return PDFDocument.load(pdfBytes).then((doc) => {
    let n = 0;
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      const dict = obj?.dict;
      if (!dict || typeof dict.entries !== "function") continue;
      const entries = Object.fromEntries([...dict.entries()].map(([k, v]) => [String(k), v]));
      if (entries["/Subtype"]?.toString() === "/Image") n += 1;
    }
    return n;
  });
}

// --------------------------------------------------------------------------
// browser
// --------------------------------------------------------------------------
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
const offOrigin = [];
const nonGet = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("request", (r) => {
  const url = r.url();
  if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) offOrigin.push(url);
  if (r.method() !== "GET") nonGet.push(`${r.method()} ${url}`);
});

// Next.js injects an empty [role=alert] route announcer — filter on real text.
const alert = (t) => page.locator("[role='alert']", { hasText: t });
const status = (t) => page.locator("[role='status']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");
const numberField = () => page.locator("fieldset input[type='number']");
const slider = () => page.locator("fieldset input[type='range']");
const scaleBtn = () => page.locator("button", { hasText: /Scale \d+ pages? by \d+%/ });

/** Click a control, capture the auto-download, and watch the busy window. */
async function captureDownload(locator, saveAs, timeout = 120000) {
  await page.evaluate(() => {
    window.__progSeen = false;
    window.__busySeen = false;
    const root = document.querySelector("[aria-busy]");
    const mo = new MutationObserver(() => {
      const text = document.body.textContent || "";
      if (!window.__progSeen && /Scaling page \d+ of \d+/.test(text)) window.__progSeen = true;
      if (root && root.getAttribute("aria-busy") === "true") window.__busySeen = true;
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    window.__busyMo = mo;
  });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), locator.click()]);
  await dl.saveAs(`${DL}/${saveAs}`);
  const seen = await page.evaluate(() => ({ prog: !!window.__progSeen, busy: !!window.__busySeen }));
  await page.evaluate(() => window.__busyMo?.disconnect());
  return {
    name: dl.suggestedFilename(),
    bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)),
    progSeen: seen.prog,
    busySeen: seen.busy,
  };
}

try {
  // ---------------------------------------------------------------- idle ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("label", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  check(
    (await fileInput().getAttribute("aria-label")) === "Choose a PDF to scale",
    "file input carries an accessible name",
  );
  check((await page.locator("[aria-busy]").first().getAttribute("aria-busy")) === "false", "root is not busy at rest");
  check((await page.locator("fieldset").count()) === 0, "scale controls hidden until a document is loaded");
  const idle = (await status(/nothing is uploaded/).first().textContent()) || "";
  check(
    idle.includes("nothing is uploaded") && idle.includes("stays selectable"),
    "idle line states the text stays selectable and the work stays on-device",
  );
  check(
    (await page.getAttribute("html", "lang")) === "en",
    "the document declares a language",
  );

  // -------------------------------------------------------------- upload ---
  await fileInput().setInputFiles(`${DL}/sample.pdf`);
  await status(/sample\.pdf — 2 pages/).first().waitFor({ timeout: 60000 });
  check(
    (await status(/sample\.pdf — 2 pages/).first().textContent()).includes("sample.pdf — 2 pages"),
    "info line shows the source name, page count and size",
  );
  check(
    (await page.locator("[role='alert']").filter({ hasText: /\S/ }).count()) === 0,
    "no error surfaced for a valid PDF",
  );

  // ------------------------------------------------------------ controls ---
  const legends = await page.locator("fieldset > legend").allTextContents();
  check(
    legends.length === 1 && /Scale factor/.test(legends[0]),
    "the scale control sits in a fieldset with a legend",
  );
  check((await numberField().count()) === 1, "there is a numeric percentage field");
  check((await slider().count()) === 1, "there is a range slider");
  const numberLabel = await page
    .locator(`label[for="${await numberField().getAttribute("id")}"]`)
    .textContent();
  check(/Scale \(%\)/.test(numberLabel || ""), "the numeric field has a real bound label");
  const sliderLabel = await page
    .locator(`label[for="${await slider().getAttribute("id")}"]`)
    .textContent();
  check(/Scale percentage slider/.test(sliderLabel || ""), "the slider has a real bound label");
  check((await numberField().getAttribute("min")) === "10" && (await numberField().getAttribute("max")) === "400", "the numeric field is bounded 10–400");
  check((await numberField().getAttribute("inputmode")) === "numeric", "the numeric field asks for a numeric keyboard");
  check((await numberField().inputValue()) === "100", "100% is the starting value");
  const preview = (await page.locator("fieldset dl").first().textContent()) || "";
  check(
    /Letter/.test(preview) && /612 × 792 pt/.test(preview) && /8\.50 in × 11\.00 in/.test(preview),
    "the preview reports page 1 as Letter with real points and inches",
    preview,
  );
  check(
    (await page.locator("p", { hasText: /stays real text — selectable, searchable and copyable/ }).count()) === 1,
    "the honest-limits box states the text stays selectable",
  );
  check(
    (await page.locator("p", { hasText: /not re-rendered as a picture/ }).count()) === 1,
    "the honest-limits box states nothing is rasterized",
  );
  check(
    (await page.locator("p", { hasText: /Proportions are preserved/ }).count()) === 1,
    "the honest-limits box states the aspect ratio is preserved",
  );
  check((await scaleBtn().textContent()).includes("Scale 2 pages by 100%"), "the action button reflects the page count and the factor");

  // keyboard: arrow keys on the slider, Enter on the number field
  await slider().focus();
  await page.keyboard.press("ArrowLeft");
  check((await numberField().inputValue()) === "99", "arrow keys on the slider move the factor and the field follows");
  await numberField().fill("50");
  await numberField().press("Enter");
  check((await numberField().inputValue()) === "50", "Enter commits the typed percentage");
  const halfPreview = (await page.locator("fieldset dl").first().textContent()) || "";
  check(
    /306 × 396 pt/.test(halfPreview) && /4\.25 in × 5\.50 in/.test(halfPreview),
    "the live preview follows the field to the real half-scale size",
    halfPreview,
  );
  await numberField().fill("500");
  await numberField().blur();
  check((await numberField().inputValue()) === "400", "a value above the ceiling is clamped to 400%");
  await numberField().fill("5");
  await numberField().blur();
  check((await numberField().inputValue()) === "10", "a value below the floor is clamped to 10%");

  // ------------------------------------------------------ happy path 50% ---
  const before = await pageFacts(new Uint8Array(readFileSync(`${DL}/sample.pdf`)), 1);
  check(
    before.textItems > 0 && before.text.includes("SCALABLE BODY TEXT"),
    "the source page really does start with selectable text",
  );
  check((await countImages(new Uint8Array(readFileSync(`${DL}/sample.pdf`)))) === 0, "the source page has no image to begin with");

  await numberField().fill("50");
  await numberField().press("Enter");
  const d1 = await captureDownload(scaleBtn(), "scaled-50.pdf");
  check(d1.name === "sample-scaled-50pct.pdf", "download named <source>-scaled-50pct.pdf", d1.name);
  check(d1.busySeen, "aria-busy flipped to true while scaling");
  check(d1.progSeen, "per-page progress was announced");
  await status(/Scaled 2 pages by 50%/).first().waitFor({ timeout: 60000 });
  check(
    (await status(/Scaled 2 pages by 50% — downloaded sample-scaled-50pct\.pdf\./).count()) === 1,
    "the success status reports the page count, the factor and the file name",
  );
  let busyCleared = true;
  try {
    await page.waitForFunction(
      () => document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "false",
      null,
      { timeout: 30000 },
    );
  } catch {
    busyCleared = false;
  }
  check(busyCleared, "aria-busy clears when the run finishes");

  const f1 = await pageFacts(d1.bytes, 1);
  check(f1.numPages === 2, "the scaled download keeps both pages");
  check(
    Math.abs(f1.width - 306) < 0.5 && Math.abs(f1.height - 396) < 0.5,
    "page 1 is 306x396 in a reader after 50%",
    `${f1.width}x${f1.height}`,
  );
  check(
    Math.abs(f1.viewBox[2] - f1.viewBox[0] - 306) < 0.5 && Math.abs(f1.viewBox[3] - f1.viewBox[1] - 396) < 0.5,
    "the visible page box is 306x396 too, not just the stored media box",
    f1.viewBox.join(","),
  );
  check(f1.textItems === before.textItems && f1.text === before.text, "the text is still there, word for word");
  check(
    Math.abs(f1.firstItem.height - before.firstItem.height * 0.5) < 0.1 &&
      Math.abs(f1.firstItem.width - before.firstItem.width * 0.5) < 0.1,
    "the text really is half scale on the page, not just repositioned",
  );
  check(
    Math.abs(f1.firstItem.transform[0] - f1.firstItem.transform[3]) < 0.001,
    "the same factor is on both axes — nothing is sheared",
  );
  check((await countImages(d1.bytes)) === 0, "no image XObject was baked in: the page was scaled, not rasterized");
  const f2 = await pageFacts(d1.bytes, 2);
  check(
    Math.abs(f2.width - 306) < 0.5 && f2.text.includes("PAGE TWO BODY"),
    "page 2 is scaled too",
  );

  // --------------------------------------------------------- result panel ---
  const region = page.locator("[role='region']", { hasText: "Scaled copy ready" });
  check((await region.count()) === 1, "the result is a labelled region");
  const resultText = (await region.textContent()) || "";
  check(
    /Letter/.test(resultText) && /306 × 396 pt/.test(resultText),
    "the result panel reports the real before and after page size",
    resultText.slice(0, 200),
  );
  check(/4\.25 in/.test(resultText), "the result panel reports the new size in inches too");
  const again = await captureDownload(page.locator("button", { hasText: /Download sample-scaled-50pct\.pdf again/ }), "scaled-50-again.pdf");
  check(again.name === "sample-scaled-50pct.pdf", "the re-download keeps the same name");
  check(
    Buffer.compare(Buffer.from(again.bytes), Buffer.from(d1.bytes)) === 0,
    "the re-download is byte-identical to the first one",
  );

  // ------------------------------------------------- crop box / non-zero ---
  await fileInput().setInputFiles(`${DL}/offset.pdf`);
  await status(/offset\.pdf — 1 page/).first().waitFor({ timeout: 60000 });
  await numberField().fill("50");
  await numberField().press("Enter");
  const d2 = await captureDownload(scaleBtn(), "scaled-offset.pdf");
  await status(/Scaled 1 page by 50%/).first().waitFor({ timeout: 60000 });
  const f3 = await pageFacts(d2.bytes, 1);
  check(
    Math.abs(f3.width - 290) < 0.5 && Math.abs(f3.height - 375) < 0.5,
    "a page with a crop box and a non-zero origin scales its visible area to 290x375",
    `${f3.width}x${f3.height}`,
  );
  check(f3.text.includes("OFFSET PAGE TEXT"), "the text on an offset page survives the scale");
  const offDoc = await PDFDocument.load(d2.bytes);
  const offMedia = offDoc.getPages()[0].getMediaBox();
  check(offMedia.x === 0 && offMedia.y === 0, "the scaled offset page is re-based at the origin");

  // ------------------------------------------------------------- rotation ---
  await fileInput().setInputFiles(`${DL}/rotated.pdf`);
  await status(/rotated\.pdf — 1 page/).first().waitFor({ timeout: 60000 });
  await numberField().fill("50");
  await numberField().press("Enter");
  const d3 = await captureDownload(scaleBtn(), "scaled-rotated.pdf");
  await status(/Scaled 1 page by 50%/).first().waitFor({ timeout: 60000 });
  const f4 = await pageFacts(d3.bytes, 1);
  check(
    Math.abs(f4.width - 396) < 0.5 && Math.abs(f4.height - 306) < 0.5,
    "a /Rotate 90 page is reported and scaled in its displayed landscape orientation",
    `${f4.width}x${f4.height}`,
  );
  const rotDoc = await PDFDocument.load(d3.bytes);
  check(rotDoc.getPages()[0].getRotation().angle === 90, "the rotation flag is preserved, not flattened away");

  // ----------------------------------------------------------- mixed sizes ---
  await fileInput().setInputFiles(`${DL}/mixed.pdf`);
  await status(/mixed\.pdf — 3 pages/).first().waitFor({ timeout: 60000 });
  await numberField().fill("50");
  await numberField().press("Enter");
  const d4 = await captureDownload(scaleBtn(), "scaled-mixed.pdf");
  await status(/Scaled 3 pages by 50%/).first().waitFor({ timeout: 60000 });
  check(
    (await page.locator("[role='status']", { hasText: /This file mixes page sizes/ }).count()) === 1,
    "a mixed-size document says so instead of implying one size",
  );
  const f5 = await pageFacts(d4.bytes, 2);
  check(
    Math.abs(f5.width - 421) < 0.5 && Math.abs(f5.height - 297.5) < 0.5,
    "the landscape page in a mixed document is scaled from its own size",
    `${f5.width}x${f5.height}`,
  );

  // ----------------------------------------------------------------- form ---
  await fileInput().setInputFiles(`${DL}/form.pdf`);
  await status(/form\.pdf — 1 page/).first().waitFor({ timeout: 60000 });
  await numberField().fill("50");
  await numberField().press("Enter");
  const d5 = await captureDownload(scaleBtn(), "scaled-form.pdf");
  await status(/Scaled 1 page by 50%/).first().waitFor({ timeout: 60000 });
  const formDoc = await PDFDocument.load(d5.bytes);
  check(
    formDoc.getForm().getTextField("fullname")?.getText() === "Ada Lovelace",
    "a filled form field keeps its value through the scale",
  );

  // ------------------------------------------------------------ 200% path ---
  await fileInput().setInputFiles(`${DL}/sample.pdf`);
  await status(/sample\.pdf — 2 pages/).first().waitFor({ timeout: 60000 });
  await numberField().fill("200");
  await numberField().press("Enter");
  const d6 = await captureDownload(scaleBtn(), "scaled-200.pdf");
  await status(/Scaled 2 pages by 200%/).first().waitFor({ timeout: 60000 });
  check(d6.name === "sample-scaled-200pct.pdf", "a second run names the file with its own factor", d6.name);
  const f6 = await pageFacts(d6.bytes, 1);
  check(
    Math.abs(f6.width - 1224) < 0.5 && Math.abs(f6.height - 1584) < 0.5,
    "200% really doubles the page",
    `${f6.width}x${f6.height}`,
  );
  check(f6.text.includes("SCALABLE BODY TEXT"), "the text survives the enlargement too");

  // ------------------------------------------------------- error handling ---
  await fileInput().setInputFiles(`${DL}/manypages.pdf`);
  await alert(/201 pages/).first().waitFor({ timeout: 60000 });
  check((await alert(/201 pages/).first().textContent()).includes("200 pages"), "the page-cap message quotes the real cap");
  check((await alert(/201 pages/).first().textContent()).includes("PDF Split"), "the page-cap message points at PDF Split");
  check((await page.locator("fieldset").count()) === 0, "a refused file leaves no scale controls behind");

  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert(/password-protected/).first().waitFor({ timeout: 60000 });
  const unlockHref = await page
    .locator("[role='alert'] a", { hasText: /PDF Unlock/ })
    .first()
    .getAttribute("href");
  check(unlockHref === "/use/pdf-unlock", "an encrypted file is routed to PDF Unlock", unlockHref || "no link");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert(/doesn't look like a valid PDF/).first().waitFor({ timeout: 60000 });
  check((await alert(/doesn't look like a valid PDF/).count()) === 1, "a non-PDF is refused with a readable message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/100 MB/).first().waitFor({ timeout: 120000 });
  check((await alert(/100 MB/).first().textContent()).includes("100 MB"), "an oversize file is refused with the real cap");
  check(
    (await page.locator("[role='alert'] a", { hasText: /PDF Unlock/ }).count()) === 0,
    "the oversize error is not dressed up as an encryption problem",
  );

  // ---------------------------------------------------------------- clear ---
  await fileInput().setInputFiles(`${DL}/sample.pdf`);
  await status(/sample\.pdf — 2 pages/).first().waitFor({ timeout: 60000 });
  await page.locator("button", { hasText: /^Clear$/ }).click();
  check((await page.locator("fieldset").count()) === 0, "Clear drops the loaded document and its controls");
  check((await page.locator("label", { hasText: /Open PDF/ }).count()) === 1, "the opener goes back to Open PDF");

  // -------------------------------------------------------------- 375px ----
  await page.setViewportSize({ width: 375, height: 720 });
  await fileInput().setInputFiles(`${DL}/sample.pdf`);
  await status(/sample\.pdf — 2 pages/).first().waitFor({ timeout: 60000 });
  const overflow = await page.evaluate(
    () => {
      const m = document.querySelector("main#main");
      return m ? m.scrollWidth - m.clientWidth : document.documentElement.scrollWidth - document.documentElement.clientWidth;
    },
  );
  check(overflow <= 1, "the tool fits a 375px viewport without horizontal overflow", String(overflow));
  await page.setViewportSize({ width: 1280, height: 900 });

  // ----------------------------------------------------- honest page copy ---
  const toolPage = await page.request.get(`${BASE_URL}/tools/pdf-scale-pages`);
  const toolBody = toolPage.ok() ? (await toolPage.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "";
  check(toolPage.status() === 200, "the pdf-scale-pages tool page renders");
  check(/10% to 400%/.test(toolBody), "tool page copy states the real 10%–400% range");
  check(
    /text stays selectable/.test(toolBody) && /scale together and uniformly/.test(toolBody),
    "tool page copy keeps the uniform-scale and selectable-text claims",
  );
  check(!/25% to 300%/.test(toolBody), "the stale 25%–300% claim is gone from the page");
  const lower = toolBody.toLowerCase();
  check(
    !/rasteriz/.test(lower) || /not rasteriz/.test(lower) || /rather than rasteriz/.test(lower),
    "no copy implies the tool rasterizes the page",
  );

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-scale-pdf-pages`);
  const guideBody = guide.ok()
    ? (await guide.text()).replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ")
    : "";
  check(guide.status() === 200, "the pdf-scale-pages guide renders");
  check(/Uniform means uniform/.test(guideBody), "guide opens on what a uniform scale really is");
  check(
    /<source>-scaled-<percent>pct\.pdf/.test(guideBody) && /10% to 400%/.test(guideBody),
    "guide states the output naming and the real range",
  );
  check(/PDF Unlock/.test(guideBody) && /100 MB and 200 pages/.test(guideBody), "guide states the caps and the unlock steer");
  check(/signature/i.test(guideBody), "guide discloses the signature consequence");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-scale-pages"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-scale-pdf-pages"), "sitemap lists the pdf-scale-pages guide");

  // ------------------------------------------------------------- hygiene ---
  check(offOrigin.length === 0, "no off-origin request: the PDF never leaves the device", offOrigin.slice(0, 3).join(" "));
  check(nonGet.length === 0, "no non-GET request was made by the tool", nonGet.slice(0, 3).join(" "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 2).join(" | "));
  check(consoleIssues.length === 0, "no hydration or server/client mismatch warnings", consoleIssues.slice(0, 2).join(" | "));
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 500)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
