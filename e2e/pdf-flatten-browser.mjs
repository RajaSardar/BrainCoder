// Production-Chrome e2e for the "Flatten PDF" tool.
//
// Mirrors e2e/pdf-redact-browser.mjs: real Chrome via playwright-core, the
// real /use/pdf-flatten route, fixtures built in a temp dir, and downloaded
// output re-parsed with pdfjs to prove the promise (zero text items, exactly
// one image XObject per page) rather than trusting the UI.
//
//   node e2e/pdf-flatten-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/pdf-flatten-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-flatten`;
const DL = "/tmp/pdfflatten";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const STANDARD_FONTS = new URL(
  "../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).href;
const A4_W = 595.28;
const A4_H = 841.89;

// --------------------------------------------------------------------------
// fixtures
// --------------------------------------------------------------------------
// sample2.pdf   — 2 pages of real selectable text; page 2 carries /Rotate 90
// hugepage.pdf  — one 4000x4000 pt page (over the 16 MP canvas budget at 96 DPI)
// manypages.pdf — 201 pages (one over the 200-page cap)
// locked.pdf    — copy of e2e/fixtures/encrypted.pdf
// notapdf.pdf   — plain text, no %PDF- header
// huge.pdf      — 100 MB + 1000 bytes (over the size cap)
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([A4_W, A4_H]);
  p1.drawText("CONFIDENTIAL LEDGER", { x: 60, y: 760, size: 18, font });
  p1.drawText("Selectable body text that must not survive flattening.", {
    x: 60,
    y: 720,
    size: 11,
    font,
  });
  const p2 = doc.addPage([A4_W, A4_H]);
  p2.setRotation(degrees(90));
  p2.drawText("PAGE TWO BODY TEXT", { x: 60, y: 760, size: 14, font });
  writeFileSync(`${DL}/sample2.pdf`, await doc.save());

  const big = await PDFDocument.create();
  big.addPage([4000, 4000]);
  writeFileSync(`${DL}/hugepage.pdf`, await big.save());

  const many = await PDFDocument.create();
  for (let i = 0; i < 201; i++) many.addPage([A4_W, A4_H]);
  writeFileSync(`${DL}/manypages.pdf`, await many.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

// --------------------------------------------------------------------------
// pdfjs helpers — the output is inspected, never the UI's word for it
// --------------------------------------------------------------------------
async function pageFacts(bytes, pageNum = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(0), standardFontDataUrl: STANDARD_FONTS });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(pageNum);
    const text = await page.getTextContent();
    const ops = await page.getOperatorList();
    const nameOf = (code) =>
      Object.entries(pdfjs.OPS).find(([, v]) => v === code)?.[0] ?? String(code);
    const names = ops.fnArray.map(nameOf);
    return {
      numPages: doc.numPages,
      textItems: (text.items ?? []).length,
      text: (text.items ?? []).map((i) => i.str ?? "").join(""),
      paints: names.filter((n) => n === "paintImageXObject").length,
      showText: names.filter((n) => n === "showText" || n === "showSpacedText").length,
      view: page.getViewport({ scale: 1 }),
    };
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

function imageXObjects(pdfBytes) {
  return PDFDocument.load(pdfBytes).then((doc) => {
    const images = [];
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      const dict = obj?.dict;
      if (!dict || typeof dict.entries !== "function") continue;
      const entries = Object.fromEntries([...dict.entries()].map(([k, v]) => [String(k), v]));
      if (entries["/Subtype"]?.toString() !== "/Image") continue;
      images.push({
        width: Number(entries["/Width"]?.toString()),
        height: Number(entries["/Height"]?.toString()),
        filter: entries["/Filter"]?.toString() ?? "",
      });
    }
    return { images, fonts: countByType(doc, "/Font") };
  });
}

function countByType(doc, type) {
  let n = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj?.dict;
    if (!dict || typeof dict.entries !== "function") continue;
    const entries = Object.fromEntries([...dict.entries()].map(([k, v]) => [String(k), v]));
    if (entries["/Type"]?.toString() === type) n += 1;
  }
  return n;
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
const radios = () => page.locator("fieldset input[type='radio']");
const flattenBtn = () => page.locator("button", { hasText: /Flatten \d+ page/ });

/** Click a control, capture the auto-download, and watch for the busy window. */
async function captureDownload(locator, saveAs, timeout = 120000) {
  await page.evaluate(() => {
    window.__progSeen = false;
    window.__busySeen = false;
    const root = document.querySelector("[aria-busy]");
    const mo = new MutationObserver(() => {
      const text = document.body.textContent || "";
      if (!window.__progSeen && /Rasterizing page|Assembling the new PDF/.test(text)) {
        window.__progSeen = true;
      }
      if (root && root.getAttribute("aria-busy") === "true") window.__busySeen = true;
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    window.__busyMo = mo;
  });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), locator.click()]);
  await dl.saveAs(`${DL}/${saveAs}`);
  const seen = await page.evaluate(() => ({
    prog: !!window.__progSeen,
    busy: !!window.__busySeen,
  }));
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
    (await fileInput().getAttribute("aria-label")) === "Choose a PDF to flatten",
    "file input carries an accessible name",
  );
  check((await page.locator("[aria-busy]").first().getAttribute("aria-busy")) === "false", "root is not busy at rest");
  check((await page.locator("fieldset").count()) === 0, "quality controls hidden until a document is loaded");
  const idle = await status(/nothing is uploaded/).first().textContent();
  check(
    idle.includes("nothing is uploaded") && idle.includes("stops being selectable"),
    "idle line states flattening makes text unselectable and stays on-device",
  );

  // -------------------------------------------------------------- upload ---
  await fileInput().setInputFiles(`${DL}/sample2.pdf`);
  await status(/Loaded sample2\.pdf/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded sample2\.pdf/).count()) === 1, "load status names the file");
  check(
    (await status(/sample2\.pdf/).first().textContent()).includes("sample2.pdf — 2 pages"),
    "info line shows the source name, page count and size",
  );
  check(
    (await page.locator("[role='alert']").filter({ hasText: /\S/ }).count()) === 0,
    "no error surfaced for a valid PDF",
  );
  check(
    (await page.locator("label", { hasText: /Choose another PDF/ }).count()) === 1,
    "the opener relabels once a file is loaded",
  );

  // ------------------------------------------------------- quality picker ---
  const legends = await page.locator("fieldset > legend").allTextContents();
  check(legends.length === 1 && /Raster quality/.test(legends[0]), "the DPI choice sits in a fieldset with a legend");
  check((await radios().count()) === 3, "three raster settings are offered");
  const names = await radios().evaluateAll((els) => els.map((el) => el.name));
  check(new Set(names).size === 1, "the radios share one group name");
  const labels = await page.locator("fieldset label").allTextContents();
  check(
    ["Screen", "Balanced", "Print"].every((l) => labels.some((t) => t.includes(l))),
    "each setting is labelled with its name and DPI",
  );
  const checked = await radios().evaluateAll((els) => els.filter((el) => el.checked).map((el) => el.value));
  check(checked.length === 1 && checked[0] === "balanced", "Balanced is the default selection");
  check(
    (await flattenBtn().textContent()).includes("Flatten 2 pages"),
    "the action button reflects the loaded page count",
  );
  check(
    (await page.locator("p", { hasText: /no longer be selected, searched, copied or edited/ }).count()) === 1,
    "the before/after note states the text loss up front",
  );

  // keyboard-usable quality choice: arrow keys move and select
  await radios().nth(1).focus();
  await page.keyboard.press("ArrowRight");
  const afterArrow = await radios().evaluateAll((els) => els.filter((el) => el.checked).map((el) => el.value));
  check(
    afterArrow.length === 1 && afterArrow[0] === "print",
    "arrow keys move through the raster settings and select them",
  );
  await radios().nth(1).focus();
  await page.keyboard.press("Space");
  const afterSpace = await radios().evaluateAll((els) => els.filter((el) => el.checked).map((el) => el.value));
  check(afterSpace[0] === "balanced", "space re-selects the focused setting (keyboard operable)");

  // ---------------------------------------------------- happy path flatten ---
  const before = await pageFacts(new Uint8Array(readFileSync(`${DL}/sample2.pdf`)), 1);
  check(
    before.textItems > 0 && before.text.includes("CONFIDENTIAL LEDGER") && before.paints === 0,
    "the source page really does start with selectable text and no image",
  );

  const d1 = await captureDownload(flattenBtn(), "flat-balanced.pdf");
  check(d1.name === "sample2-flattened.pdf", "download named <source>-flattened.pdf");
  check(d1.busySeen, "aria-busy flipped to true while flattening");
  check(d1.progSeen, "per-page progress was announced");
  await status(/Flattened 2 pages at 150 DPI/).first().waitFor({ timeout: 60000 });
  check(
    (await status(/Flattened 2 pages at 150 DPI/).count()) === 1,
    "success status reports the page count and the raster DPI",
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
  check(f1.numPages === 2, "the flattened download keeps both pages");
  check(f1.textItems === 0 && f1.text === "", "page 1 has zero text items — nothing is selectable any more");
  check(f1.showText === 0, "the flattened page shows no text operators");
  check(f1.paints === 1, "page 1 is painted with exactly one image XObject");
  check(
    Math.abs(f1.view.width - A4_W) < 0.5 && Math.abs(f1.view.height - A4_H) < 0.5,
    "page 1 keeps its source page size",
    `${f1.view.width}x${f1.view.height}`,
  );
  const f2 = await pageFacts(d1.bytes, 2);
  check(f2.textItems === 0 && f2.paints === 1, "page 2 is image-only as well");
  check(
    Math.abs(f2.view.width - A4_H) < 0.5 && Math.abs(f2.view.height - A4_W) < 0.5,
    "the rotated page comes out in its displayed landscape orientation",
    `${f2.view.width}x${f2.view.height}`,
  );
  const { images, fonts } = await imageXObjects(d1.bytes);
  check(images.length === 2, `the flattened file holds one image per page (${images.length})`);
  check(
    images.every((i) => i.filter === "/DCTDecode"),
    "the JPEG settings really embedded a JPEG (DCTDecode) raster",
    JSON.stringify(images),
  );
  check(
    images.every((i) => i.width > 1000 && i.height > 1000),
    "the 150 DPI raster is around 1240x1754 px on A4",
    JSON.stringify(images),
  );
  check(fonts === 0, "no font objects survive in the flattened file");

  const panel = await page.locator("h3", { hasText: "Flattened copy ready" }).locator("xpath=..").textContent();
  check(/150 DPI · JPEG/.test(panel), "the result panel reports the raster DPI and encoding");
  check(/Output size/.test(panel) && /vs\. original/.test(panel), "the result panel reports size and growth");
  check(
    (await page.locator("[role='alert']").filter({ hasText: /\S/ }).count()) === 0,
    "no reduced-DPI warning for ordinary A4 pages at 150 DPI",
  );

  // ------------------------------------------------- quality change + re-run ---
  await page.locator("fieldset label", { hasText: "Print" }).click();
  const d2 = await captureDownload(flattenBtn(), "flat-print.pdf");
  await status(/Flattened 2 pages at 200 DPI/).first().waitFor({ timeout: 120000 });
  check(
    (await status(/Flattened 2 pages at 200 DPI/).count()) === 1,
    "the Print setting reports 200 DPI in the success line",
  );
  check(d2.name === "sample2-flattened.pdf", "the re-run keeps the same download name");
  const printFacts = await pageFacts(d2.bytes, 1);
  check(printFacts.textItems === 0 && printFacts.paints === 1, "the 200 DPI run is image-only too");
  const printImgs = (await imageXObjects(d2.bytes)).images;
  check(
    printImgs.every((i) => i.filter === "/FlateDecode") && printImgs.every((i) => i.width > images[0].width),
    "the Print setting embeds a larger lossless PNG raster",
    JSON.stringify(printImgs),
  );
  const panel2 = await page.locator("h3", { hasText: "Flattened copy ready" }).locator("xpath=..").textContent();
  check(/200 DPI · PNG/.test(panel2), "the result panel switches to PNG at Print");
  check(
    /bookmarks, link targets, form structure and document metadata are not carried over/.test(
      panel2.replace(/\s+/g, " "),
    ),
    "the result panel discloses what a rebuilt file does not carry over",
  );
  // switching the setting after the fact must not rewrite the reported result
  await page.locator("fieldset label", { hasText: "Screen" }).click();
  const panel3 = await page.locator("h3", { hasText: "Flattened copy ready" }).locator("xpath=..").textContent();
  check(
    /200 DPI · PNG/.test(panel3),
    "changing the setting afterwards does not relabel the result that was produced",
  );
  const again = page.locator("button", { hasText: /Download sample2-flattened\.pdf again/ });
  check((await again.count()) === 1, "a re-download button is offered for the finished run");
  await page.locator("fieldset label", { hasText: "Balanced" }).click();

  // --------------------------------------- canvas-limited page, preset truth ---
  await fileInput().setInputFiles(`${DL}/hugepage.pdf`);
  await status(/Loaded hugepage\.pdf/).first().waitFor({ timeout: 60000 });
  await page.locator("fieldset label", { hasText: "Screen" }).click();
  const d3 = await captureDownload(flattenBtn(), "flat-huge.pdf");
  await alert(/rendered below the 96 DPI Screen setting/).first().waitFor({ timeout: 120000 });
  check(
    (await alert(/rendered below the 96 DPI Screen setting/).count()) === 1,
    "an oversized page is reported as rasterized below the chosen DPI instead of failing",
  );
  await page.locator("fieldset label", { hasText: "Print" }).click();
  check(
    (await alert(/rendered below the 96 DPI Screen setting/).count()) === 1 &&
      (await alert(/below the 200 DPI/).count()) === 0,
    "the reduced-DPI warning quotes the preset the run used, not the current selection",
  );
  const hugeFacts = await pageFacts(d3.bytes, 1);
  check(hugeFacts.textItems === 0 && hugeFacts.paints === 1, "the reduced page is still image-only");
  check(
    (await status(/Flattened 1 page at \d+ DPI/).count()) === 1,
    "a single reduced page reports one effective DPI",
  );

  // --------------------------------------------- encrypted / invalid / caps ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "an encrypted PDF gets a friendly unlock message");
  const unlock = alert("password-protected").locator("a");
  check(
    (await unlock.getAttribute("href")) === "/use/pdf-unlock" && (await unlock.isVisible()),
    "the encrypted error links to the PDF Unlock tool",
  );

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ state: "visible", timeout: 60000 });
  check(
    (await alert("doesn't look like a valid PDF").count()) === 1,
    "a non-PDF upload gets the invalid-file message",
  );
  check(
    (await page.locator("fieldset").count()) === 0,
    "a rejected file leaves no loaded document behind",
  );

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/files up to 100 MB/).waitFor({ state: "visible", timeout: 60000 });
  check(
    (await alert(/files up to 100 MB/).count()) === 1,
    "an oversized file is rejected with the real 100 MB cap",
  );

  await fileInput().setInputFiles(`${DL}/manypages.pdf`);
  await alert(/201 pages/).waitFor({ state: "visible", timeout: 60000 });
  const manyMsg = await alert(/201 pages/).textContent();
  check(
    (await alert(/201 pages/).count()) === 1 &&
      manyMsg.includes("201 pages") &&
      manyMsg.includes("200 pages") &&
      manyMsg.includes("PDF Split"),
    "a 201-page file is rejected with the real count, the 200-page cap and a split steer",
  );

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
  check(offOrigin.length === 0, `no off-origin requests — the file never left the page (${offOrigin[0] ?? ""})`);
  check(nonGet.length === 0, `no non-GET requests, so nothing was uploaded (${nonGet[0] ?? ""})`);

  // ------------------------------------------------------- marketing copy ---
  const copyRes = await page.request.get(`${BASE_URL}/tools/pdf-flatten`);
  const html = copyRes.ok() ? await copyRes.text() : "";
  const body = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "the tool marketing page renders");
  check(body.includes("rasterizes a document"), "copy says flattening rasterizes each page");
  check(
    body.includes("can no longer be selected, searched, copied, edited"),
    "copy states the text is no longer selectable, searchable or copyable",
  );
  check(/96 DPI/.test(body) && /150 DPI/.test(body) && /200 DPI/.test(body), "copy names the three real settings");
  check(body.includes("Screen and Balanced are lossy"), "copy discloses the lossy JPEG settings");
  check(/much larger than the source/.test(body), "copy discloses the size cost");
  check(body.includes("100 MB") && body.includes("200 pages"), "copy states the real caps");
  check(body.includes("100% client-side") || body.includes("never leaves your device"), "copy states the privacy model");
  check(
    body.includes("bookmarks, link targets, form structure or document metadata") ||
      body.includes("bookmarks and its metadata"),
    "copy admits bookmarks and source metadata are dropped",
  );
  check(/no OCR text layer is added back/i.test(body), "copy says no OCR layer is added back");
  check(
    !/draft, normal, or high/i.test(lower) && !/\binstant\b/.test(lower) && !/drag and drop/i.test(lower),
    "no leftover Draft/Normal/High names and no overclaims in the copy",
  );
  check(
    !/removes? (?:hidden layers and )?metadata|removes metadata that could reveal/i.test(lower),
    "copy does not promise metadata scrubbing, which rasterizing does not do",
  );

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-flatten-a-pdf`);
  const guideHtml = guide.ok() ? await guide.text() : "";
  const guideBody = guideHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  check(guide.status() === 200, "the pdf-flatten guide renders");
  check(/Flattening means rasterizing, not hiding/.test(guideBody), "guide opens with what flattening really is");
  check(
    /no longer be selected, searched, copied/.test(guideBody) &&
      /several times the size/.test(guideBody),
    "guide keeps the non-selectable and size disclosures",
  );
  check(/PDF Unlock/.test(guideBody) && /100 MB and 200 pages/.test(guideBody), "guide states the caps and the unlock steer");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-flatten"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-flatten-a-pdf"), "sitemap lists the pdf-flatten guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 500)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
