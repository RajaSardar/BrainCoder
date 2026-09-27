import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, PDFName, rgb } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-overlay`;
const DL = "/tmp/pdfoverlay";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const STANDARD_FONTS = new URL(
  "../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).href;
const A4_W = 595.28;
const A4_H = 841.89;
const STAMP_W = 400;
const STAMP_H = 100;

// fixtures: a 3-page base and a 2-page stamp, so cycle mode is observable
// (base 1 <- stamp 1, base 2 <- stamp 2, base 3 <- stamp 1)
{
  const base = await PDFDocument.create();
  const font = await base.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const p = base.addPage([A4_W, A4_H]);
    p.drawText(`BASE PAGE ${i + 1} BODY COPY`, { x: 60, y: 700, size: 18, font });
  }
  writeFileSync(`${DL}/base3.pdf`, await base.save());

  const stamp = await PDFDocument.create();
  const sfont = await stamp.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) {
    const p = stamp.addPage([STAMP_W, STAMP_H]);
    p.drawText(`STAMP MARK ${i + 1}`, {
      x: 20,
      y: 45,
      size: 24,
      font: sfont,
      color: rgb(0.1, 0.2, 0.7),
    });
  }
  writeFileSync(`${DL}/stamp2.pdf`, await stamp.save());

  const many = await PDFDocument.create();
  for (let i = 0; i < 201; i++) many.addPage([A4_W, A4_H]);
  writeFileSync(`${DL}/manypages.pdf`, await many.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

// mirror of the component's fit + anchor math, so the harness can predict the
// cm translate without re-implementing the UI
function expectedPlacement(preset, baseW, baseH, ox, oy) {
  if (preset === "stretch") return { x: 0, y: 0, width: baseW, height: baseH };
  const s = Math.min(baseW / STAMP_W, baseH / STAMP_H);
  const width = STAMP_W * s;
  const height = STAMP_H * s;
  let x = (baseW - width) / 2;
  let y = (baseH - height) / 2;
  if (preset.endsWith("-left")) x = 0;
  else if (preset.endsWith("-right")) x = baseW - width;
  if (preset.startsWith("top")) y = baseH - height;
  else if (preset.startsWith("bottom")) y = 0;
  return { x: x + ox, y: y + oy, width, height };
}

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

async function openPdfjs(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs.getDocument({ data: bytes.slice(0), standardFontDataUrl: STANDARD_FONTS });
}

async function extractText(bytes, pageNum) {
  const task = await openPdfjs(bytes);
  const doc = await task.promise;
  try {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    return content.items.map((it) => it.str ?? "").join("");
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

function xObjectFormSubtypes(doc, pageIndex) {
  const res = doc.getPage(pageIndex).node.Resources();
  const ref = res.get(PDFName.of("XObject"));
  if (!ref) return [];
  const dict = doc.context.lookup(ref);
  if (!dict) return [];
  const out = [];
  for (const key of dict.keys()) {
    const xo = doc.context.lookup(dict.get(key));
    const sub = xo?.dict?.get(PDFName.of("Subtype"));
    out.push(sub ? sub.toString() : null);
  }
  return out;
}

function pageAlpha(doc, pageIndex) {
  const res = doc.getPage(pageIndex).node.Resources();
  const ref = res.get(PDFName.of("ExtGState"));
  if (!ref) return null;
  const dict = doc.context.lookup(ref);
  if (!dict) return null;
  for (const key of dict.keys()) {
    const gs = doc.context.lookup(dict.get(key));
    const ca = gs?.dict?.get(PDFName.of("ca"));
    if (ca) return Number.parseFloat(ca.toString());
  }
  return null;
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

const alert = (t) => page.locator("[role='alert']").filter({ hasText: t });
const status = (t) => page.locator("[role='status']").filter({ hasText: t });
const visibleAlerts = () => page.locator("[role='alert']").filter({ hasText: /\S/ });
const fileInput = () => page.locator("input[type='file']");
const baseInput = () => fileInput().nth(0);
const stampInput = () => fileInput().nth(1);
const overlayBtn = () => page.getByRole("button", { name: /^Overlay \d+ pages? → PDF$/ });
const previewImg = () => page.getByRole("img", { name: /Page 1 of the base PDF with the stamp drawn on top/ });

async function captureDownload(saveAs, timeout = 120000) {
  await page.evaluate(() => {
    window.__progSeen = false;
    const mo = new MutationObserver(() => {
      const text = document.body.textContent || "";
      if (window.__progSeen !== true && /Overlaying…|Compositing…|Stamping page/.test(text)) window.__progSeen = true;
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__busyMo = mo;
  });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    overlayBtn().click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  const busyObserved = await page.evaluate(() => !!window.__progSeen);
  await page.evaluate(() => window.__busyMo?.disconnect());
  return {
    name: dl.suggestedFilename(),
    bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)),
    busyObserved,
  };
}

const almost = (a, b, tol = 0.3) => Math.abs(a - b) < tol;

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("label", { hasText: /Open base PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  // --- idle state ---
  check((await fileInput().count()) === 2, "two file inputs (base and stamp)");
  check(
    (await baseInput().getAttribute("aria-label")) === "Choose the base PDF that receives the stamp" &&
      (await stampInput().getAttribute("aria-label")) === "Choose the stamp PDF to place on top",
    "both file inputs carry distinct accessible names",
  );
  check((await page.locator("fieldset").count()) === 0, "placement controls hidden until both PDFs are open");
  check(
    (await status(/neither is uploaded/).first().textContent()).includes("neither is uploaded"),
    "idle state explains both files stay in the browser",
  );

  // --- load both files ---
  await baseInput().setInputFiles(`${DL}/base3.pdf`);
  await status(/Loaded the base PDF base3\.pdf — 3 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded the base PDF/).count()) === 1, "base load status names the file and its page count");
  check((await page.locator("fieldset").count()) === 0, "controls still hidden with only one file open");

  await stampInput().setInputFiles(`${DL}/stamp2.pdf`);
  await status(/Loaded the stamp PDF stamp2\.pdf — 2 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded the stamp PDF/).count()) === 1, "stamp load status names the file and its page count");
  check((await visibleAlerts().count()) === 0, "no error surfaced for two valid PDFs");

  // --- preview + placement readout ---
  await previewImg().waitFor({ state: "visible", timeout: 60000 });
  check(
    /positioned at x [\d.]+, y [\d.]+ in PDF points/.test(
      (await previewImg().getAttribute("aria-label")) ?? "",
    ),
    "preview is exposed to assistive tech with its exact PDF-point position",
  );
  {
    const c = expectedPlacement("center", A4_W, A4_H, 0, 0);
    const note = (await status(/Stamp [\d.]+ × [\d.]+ pt at x/).first().textContent()) ?? "";
    check(
      note.includes(`at x ${c.x.toFixed(0)}, y ${c.y.toFixed(0)}`),
      `placement readout reports the real fitted geometry (${note.slice(0, 80)})`,
    );
  }

  // --- legends, presets, labelled controls ---
  const legends = await page.locator("fieldset > legend").allTextContents();
  check(
    legends.length === 3 &&
      legends[0].includes("Where the stamp lands") &&
      legends[1].includes("Which pages get the stamp"),
    "all three fieldsets have legends",
  );
  check((await page.getByRole("button", { name: "Center (fit)", exact: true }).getAttribute("aria-pressed")) === "true", "the default preset is marked pressed");
  check((await page.locator("[role='group'][aria-label='Stamp position preset'] button").count()) === 8, "all eight position presets are offered");
  check(
    (await page.locator("input[type='range']").count()) === 3 &&
      (await page.locator("input[type='number']").count()) === 3,
    "X, Y and opacity each have a slider and a typed value",
  );
  {
    const ids = await page.locator("input[type='range']").evaluateAll((els) => els.map((el) => el.id));
    const fors = await page
      .locator("label", { hasText: /^(Horizontal|Vertical) offset \(pt\)$|^Opacity \(%\)$/ })
      .evaluateAll((els) => els.map((el) => el.getAttribute("for")));
    check(
      fors.length === 3 && fors.every((f) => f && ids.includes(f)),
      "every slider is bound to a visible <label for>",
    );
  }

  // --- preset: top left ---
  await page.getByRole("button", { name: "Top left", exact: true }).click();
  {
    const c = expectedPlacement("top-left", A4_W, A4_H, 0, 0);
    const note = (await status(/Stamp [\d.]+ × [\d.]+ pt at x/).first().textContent()) ?? "";
    check(
      note.includes(`at x ${c.x.toFixed(0)}, y ${c.y.toFixed(0)}`),
      `selecting the top-left preset moves the readout to the page's top-left corner (x ${c.x.toFixed(0)}, y ${c.y.toFixed(0)})`,
    );
  }

  // --- offsets + opacity ---
  await page.getByLabel("Horizontal offset in points").fill("40");
  await page.getByLabel("Vertical offset in points").fill("-25");
  await page.getByLabel("Stamp opacity as a percentage").fill("35");
  {
    const c = expectedPlacement("top-left", A4_W, A4_H, 40, -25);
    const note = (await status(/Stamp [\d.]+ × [\d.]+ pt at x/).first().textContent()) ?? "";
    check(
      note.includes(`at x ${c.x.toFixed(0)}, y ${c.y.toFixed(0)}`) && note.includes("at 35% opacity"),
      "typed offsets and opacity are reflected in the live placement readout",
    );
  }

  // --- page range ---
  await page.getByLabel("Only a page range").check();
  await page.getByLabel("Pages to stamp").fill("1-2");
  await page.getByText("2 pages selected: 1, 2.").waitFor({ timeout: 15000 });
  check((await overlayBtn().textContent()).includes("Overlay 2 pages"), "submit button follows the selected page count");
  await page.getByLabel("Pages to stamp").fill("4");
  await page.getByText(/past the last page/).waitFor({ timeout: 15000 });
  check((await overlayBtn().isDisabled()) === true, "an out-of-range page selection disables the submit button");
  await page.getByLabel("Pages to stamp").fill("1,1,x");
  await page.getByText(/numbers separated by commas/).waitFor({ timeout: 15000 });
  check(
    (await overlayBtn().isDisabled()) === true && (await visibleAlerts().count()) === 0,
    "a malformed range is reported inline without a red error banner",
  );
  await page.getByLabel("Pages to stamp").fill("1-2");

  // --- run: cycle mode, two pages, 35% opacity ---
  const d1 = await captureDownload("d1.pdf");
  check(d1.name === "base3-overlaid.pdf", "download named <base>-overlaid.pdf");
  check(d1.busyObserved, "busy announced via role=status while compositing");
  await status(/Stamped 2 of 3 pages at 35% opacity — downloaded base3-overlaid\.pdf/).first().waitFor({ timeout: 60000 });

  const out1 = await PDFDocument.load(d1.bytes);
  check(out1.getPageCount() === 3, "overlaid output keeps the base page count (3)");
  {
    const c = expectedPlacement("top-left", A4_W, A4_H, 40, -25);
    const cm1 = decodedContents(out1.getPage(0)).match(/(^|\n)1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm(\n|$)/);
    check(
      !!cm1 && almost(parseFloat(cm1[2]), c.x) && almost(parseFloat(cm1[3]), c.y),
      `the download carries the preset+offset translate (${cm1?.[2]},${cm1?.[3]} vs ${c.x},${c.y})`,
    );
  }
  check(/\/\w*EmbeddedPdfPage-\d+\s+Do/.test(decodedContents(out1.getPage(0))), "the stamped page draws a real embedded stamp XObject");
  check(
    JSON.stringify(xObjectFormSubtypes(out1, 0)) === JSON.stringify(["/Form"]),
    "the embedded stamp is a /Form stream (the regression this tool had before)",
  );
  check(almost(pageAlpha(out1, 0), 0.35, 0.01), `35% opacity is written to the page ExtGState /ca (got ${pageAlpha(out1, 0)})`);
  check(pageAlpha(out1, 2) === null, "the un-stamped page carries no stamp alpha state");
  check(!(/\/\w*EmbeddedPdfPage-\d+\s+Do/.test(decodedContents(out1.getPage(2)))), "page 3 was left untouched by the 1-2 range");
  check((await extractText(d1.bytes, 1)).includes("BASE PAGE 1 BODY COPY"), "base page text survives the overlay");
  check((await extractText(d1.bytes, 1)).includes("STAMP MARK 1"), "stamp text is readable on page 1 of the download");
  check((await extractText(d1.bytes, 2)).includes("STAMP MARK 2"), "cycle mode gives page 2 the stamp's second page");
  check(!(await extractText(d1.bytes, 3)).includes("STAMP MARK"), "page 3 carries no stamp text in its layer");

  // --- first-page mode, all pages ---
  await page.getByLabel("All 3 pages").check();
  await page.getByLabel("Use only the stamp's first page everywhere").check();
  const d2 = await captureDownload("d2.pdf");
  const out2 = await PDFDocument.load(d2.bytes);
  check(out2.getPageCount() === 3, "second run keeps the base page count (3)");
  check(/\/\w*EmbeddedPdfPage-\d+\s+Do/.test(decodedContents(out2.getPage(2))), "every page carries a stamp in first-page mode");
  check((await extractText(d2.bytes, 3)).includes("STAMP MARK 1"), "first-page mode puts the stamp's page 1 on page 3");

  // --- partial off-page is allowed and disclosed ---
  await page.getByLabel("Horizontal offset in points").fill("-40");
  {
    const note = (await status(/Stamp [\d.]+ × [\d.]+ pt at x/).first().textContent()) ?? "";
    check(/hangs off the page edge and will be cropped/.test(note), "a partly off-page stamp is disclosed before exporting");
  }
  const dPartial = await captureDownload("dpartial.pdf");
  check(dPartial.name === "base3-overlaid.pdf", "a partly off-page stamp still exports");
  await page.getByLabel("Horizontal offset in points").fill("0");

  // --- fully off-page is refused, by page number, before any output ---
  await page.getByLabel("Horizontal offset in points").fill("600");
  await page.getByLabel("Vertical offset in points").fill("600");
  let refused = false;
  try {
    await Promise.all([
      page.waitForEvent("download", { timeout: 4000 }),
      overlayBtn().click(),
    ]);
  } catch {
    refused = true;
  }
  await alert(/falls completely off page 1/).first().waitFor({ timeout: 30000 });
  check(refused === true, "a stamp pushed fully off the page produces no download at all");
  check((await alert(/falls completely off page 1/).count()) === 1, "the refusal names the page the stamp fell off");
  await page.getByLabel("Horizontal offset in points").fill("0");
  await page.getByLabel("Vertical offset in points").fill("0");

  // --- stretch preset covers the whole page ---
  await page.getByRole("button", { name: "Stretch to page", exact: true }).click();
  {
    const note = (await status(/Stamp [\d.]+ × [\d.]+ pt at x/).first().textContent()) ?? "";
    check(
      note.includes(`at x 0, y 0`) && note.includes(`${A4_W.toFixed(2)} × ${A4_H.toFixed(2)} pt`),
      "the stretch preset reports a full-page stamp anchored at the origin",
    );
  }
  const d3 = await captureDownload("d3.pdf");
  {
    const stretch = await PDFDocument.load(d3.bytes);
    const s = A4_W / STAMP_W;
    const t = A4_H / STAMP_H;
    const stream = decodedContents(stretch.getPage(0));
    check(
      new RegExp(`(^|\\n)${s.toFixed(4)} 0 0 ${t.toFixed(4)} 0 0 cm(\\n|$)`).test(stream),
      `stretch writes a non-uniform scale matrix (${s.toFixed(4)} 0 0 ${t.toFixed(4)})`,
    );
  }
  await page.getByRole("button", { name: "Top left", exact: true }).click();

  // --- encrypted, invalid, oversized, overlong ---
  await baseInput().setInputFiles(`${DL}/locked.pdf`);
  await alert(/password-protected/).first().waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/password-protected/).count()) === 1, "encrypted PDF shows a friendly unlock message");
  check(
    (await page.locator("[role='alert'] a[href='/use/pdf-unlock']").count()) === 1,
    "the friendly error links to the Unlock PDF tool",
  );

  await baseInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert(/doesn't look like a valid PDF/).first().waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/doesn't look like a valid PDF/).count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await baseInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/files up to 100 MB are supported/).first().waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/files up to 100 MB are supported/).count()) === 1, "oversized base is rejected with the size cap");

  await baseInput().setInputFiles(`${DL}/manypages.pdf`);
  await alert(/files up to 200 pages are supported/).first().waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/files up to 200 pages are supported/).count()) === 1, "over-200-page base is rejected with the page cap");
  check(
    (await page.locator("fieldset").count()) === 0,
    "a failed base load clears the base document (no half-loaded state)",
  );

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const copyRes = await page.request.get(`${BASE_URL}/tools/pdf-overlay`);
  const html = copyRes.ok() ? await copyRes.text() : "";
  const body = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(/page range|range of pages/i.test(body), "copy advertises the page-range control");
  check(/visible, extractable and searchable/i.test(body), "copy states the honest searchable-text semantics");
  check(/not a way to hide content/i.test(body), "copy refuses the 'hides content' overclaim");
  check(/not a merge/i.test(body), "copy states the base keeps its page count and text");
  check(!/permanently (hides|removes)/i.test(lower), "no deleted-forever overclaim in copy");
  check(!/drag and drop/i.test(lower), "no drag-and-drop promise");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-overlay-pdfs-online`);
  const guideText = guide.status() === 200 ? await guide.text() : "";
  check(guide.status() === 200, "pdf-overlay guide renders");
  check(/extractable and searchable/i.test(guideText), "guide keeps the honest extractable-text disclosure");
  check(
    body.includes("/guides/how-to-overlay-pdfs-online"),
    "the marketing page links to the overlay guide (Related guides, via toolSlug)",
  );

  const sitemapRes = await page.request.get(`${BASE_URL}/sitemap.xml`);
  const sitemap = sitemapRes.ok() ? await sitemapRes.text() : "";
  check(sitemap.includes("/tools/pdf-overlay"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-overlay-pdfs-online"), "sitemap lists the pdf-overlay guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
