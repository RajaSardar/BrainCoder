import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-redact`;
const DL = "/tmp/pdfredact";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const STANDARD_FONTS = new URL(
  "../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).href;
const A4_W = 595.28;
const A4_H = 841.89;

// fixtures — page 2 carries /Rotate 90 to exercise rotation-aware redaction
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([A4_W, A4_H]);
  p1.drawText("TOP SECRET", { x: 100, y: 641.89, size: 20, font });
  const p2 = doc.addPage([A4_W, A4_H]);
  p2.setRotation(degrees(90));
  p2.drawText("PAGE TWO SECRET", { x: 100, y: 641.89, size: 20, font });
  writeFileSync(`${DL}/sample2.pdf`, await doc.save());

  const many = await PDFDocument.create();
  for (let i = 0; i < 201; i++) many.addPage([A4_W, A4_H]);
  writeFileSync(`${DL}/manypages.pdf`, await many.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

// mirror of the component's numeric-path mapping for the rot-0 A4 case
function expectedRect(x, y, w, h) {
  const dW = Math.floor(A4_W * 1.5) / 1.5;
  const dH = Math.floor(A4_H * 1.5) / 1.5;
  const fx = x / dW;
  const fy = y / dH;
  const fw = w / dW;
  const fh = h / dH;
  const x0 = fx * A4_W;
  const y0 = fy * A4_H;
  const x1 = (fx + fw) * A4_W;
  const y1 = (fy + fh) * A4_H;
  return {
    x: Math.min(x0, x1),
    y: Math.min(A4_H - y0, A4_H - y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
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

async function extractText(bytes, pageNum) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(0), standardFontDataUrl: STANDARD_FONTS });
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
const numInputs = () => page.locator("input[type='number']");

async function captureDownload(buttonLocator, saveAs, timeout = 60000) {
  await page.evaluate(() => {
    window.__progSeen = false;
    const mo = new MutationObserver(() => {
      if (window.__progSeen !== true && /Working on the PDF/.test(document.body.textContent || "")) window.__progSeen = true;
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__busyMo = mo;
  });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  const busyObserved = await page.evaluate(() => !!window.__progSeen);
  await page.evaluate(() => window.__busyMo?.disconnect());
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)), busyObserved };
}

const almost = (a, b, tol = 0.3) => Math.abs(a - b) < tol;

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("label", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  // --- idle state ---
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to redact", "file input carries an accessible name");
  check((await page.locator("fieldset").count()) === 0, "region controls hidden until a document is loaded");
  check((await status(/nothing is uploaded/).first().textContent()).includes("nothing is uploaded"), "idle state explains processing is local");

  // --- upload ---
  await fileInput().setInputFiles(`${DL}/sample2.pdf`);
  await status(/Loaded 2 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded 2 pages/).count()) === 1, "load status reports the page count");
  check((await status(/sample2\.pdf/).first().textContent()).includes("sample2.pdf — 2 pages"), "info line shows source name and page count");
  check((await status(/Loaded 2 pages/).count()) === 1 && (await page.locator("[role='alert']").filter({ hasText: /\S/ }).count()) === 0, "no error surfaced for a valid PDF");

  // --- preview + page grid render ---
  const previewImg = page.locator("img[aria-hidden='true']");
  await previewImg.first().waitFor({ state: "visible", timeout: 60000 });
  check((await page.locator("button[aria-label^='Edit page']").count()) === 2, "two page thumbnails in the grid");
  check((await page.locator("button[aria-label^='Edit page 1']").getAttribute("aria-pressed")) === "true", "active page is marked pressed");
  check((await page.locator("[role='img'][aria-label*='redaction rectangle']").count()) === 1, "page preview is exposed to assistive tech");

  // --- legends present ---
  const legends = await page.locator("fieldset > legend").allTextContents();
  check(legends.length === 2 && legends[0].includes("Redactions on page 1") && legends[1].includes("Add a region by numbers"), "both fieldsets have legends");

  // --- the five number inputs are labelled ---
  check((await numInputs().count()) === 5, "page/x/y/w/h inputs exist");
  {
    const forAttr = await page.locator("label", { hasText: /^Page$/ }).first().getAttribute("for");
    const ids = await numInputs().evaluateAll((els) => els.map((el) => el.id));
    check(forAttr !== null && ids.includes(forAttr), "Page input is associated with its label");
  }

  // --- export disabled with no regions ---
  const redactBtn = page.locator("button", { hasText: /Redact \d+ region/ });
  check((await redactBtn.isDisabled()) === true, "Redact button disabled with no regions");
  check((await page.locator("p", { hasText: /Add at least one region/ }).count()) === 1, "hint explains why export is disabled");

  // --- add a region by numbers (keyboard-operable fallback) ---
  await numInputs().nth(0).fill("1");
  await numInputs().nth(1).fill("88");
  await numInputs().nth(2).fill("168");
  await numInputs().nth(3).fill("150");
  await numInputs().nth(4).fill("60");
  await page.locator("button", { hasText: /Add region/ }).click();
  check((await page.locator("li", { hasText: /Region 1: x 88, y 168, w 150, h 60 pt/ }).count()) === 1, "numeric region is listed with its point geometry");
  check((await redactBtn.textContent()).includes("Redact 1 region"), "Redact button reflects the region count");
  check((await redactBtn.isDisabled()) === false, "Redact button enabled after adding a region");

  // --- remove and re-add (positioned for reuse) ---
  await page.locator("button[aria-label='Remove region 1 from page 1']").click();
  check((await page.locator("li", { hasText: /Region 1:/ }).count()) === 0, "region can be removed");
  check((await redactBtn.isDisabled()) === true, "Redact button disabled again after removing the region");
  await numInputs().nth(1).fill("88");
  await numInputs().nth(2).fill("168");
  await numInputs().nth(3).fill("150");
  await numInputs().nth(4).fill("60");
  await page.locator("button", { hasText: /Add region/ }).click();
  check((await page.locator("li", { hasText: /Region 1: x 88/ }).count()) === 1, "region re-added for export");

  // --- redact page 1 and verify the stamped geometry ---
  const d1 = await captureDownload(redactBtn, "r1.pdf");
  check(d1.name === "sample2-redacted.pdf", "download named <source>-redacted.pdf");
  check(d1.busyObserved, "busy announced via role=status while redacting");
  await status(/Drew 1 redaction box on 1 page/).first().waitFor({ timeout: 60000 });
  check((await status(/Drew 1 redaction box/).count()) === 1, "success status reports boxes and pages");

  const out1 = await PDFDocument.load(d1.bytes);
  check(out1.getPageCount() === 2, "redacted output keeps all source pages");
  check(out1.getPage(1).getRotation().angle === 90, "page 2 rotation preserved");
  const stream1 = decodedContents(out1.getPage(0));
  const rect = expectedRect(88, 168, 150, 60);
  const cm1 = stream1.match(/(^|\n)1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm(\n|$)/);
  check(
    !!cm1 && almost(parseFloat(cm1[2]), rect.x) && almost(parseFloat(cm1[3]), rect.y),
    `stamped rectangle cm sits at the mirrored position (${cm1?.[2]},${cm1?.[3]} vs ${rect.x},${rect.y})`,
  );
  check(/(^|\n)0 0 m(\n|$)/.test(stream1) && /\nh\nf\nQ(\n|$)/.test(stream1), "redaction path is drawn with m/l/h/f (real path, not an overlay op");
  check(!/(^|\s)re(\s|$)/.test(stream1), "no re-operator shortcut in the stamped content");
  check(!/(^|\n)0 0 m(\n|$)/.test(decodedContents(out1.getPage(1))), "untouched page 2 has no stamped rectangle");
  check(/TOP SECRET/.test(await extractText(d1.bytes, 1)), "covered text remains extractable (honest residual — tool does not delete glyphs)");

  // --- redact page 2 (rot90) ---
  await page.locator("button[aria-label^='Edit page 2']").click();
  check((await page.locator("fieldset > legend").first().textContent()).includes("page 2"), "controls follow the active page");
  await numInputs().nth(0).fill("2");
  await numInputs().nth(1).fill("88");
  await numInputs().nth(2).fill("168");
  await numInputs().nth(3).fill("150");
  await numInputs().nth(4).fill("60");
  await page.locator("button", { hasText: /Add region/ }).click();
  const d2 = await captureDownload(redactBtn, "r2.pdf");
  const out2 = await PDFDocument.load(d2.bytes);
  check(out2.getPageCount() === 2 && out2.getPage(1).getRotation().angle === 90, "second run keeps page 2 rotation");
  check(/(^|\n)0 0 m(\n|$)/.test(decodedContents(out2.getPage(1))), "rotated page 2 now carries a stamped rectangle");

  // --- encrypted, invalid, oversized, overlong ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "encrypted PDF shows a friendly unlock message");
  check((await page.locator("body").textContent()).includes("Unlock PDF"), "friendly error points at Unlock PDF");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/larger than 100 MB/).waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/larger than 100 MB/).count()) === 1, "oversized file is rejected with guidance to PDF Split");

  await fileInput().setInputFiles(`${DL}/manypages.pdf`);
  await alert(/more than 200 pages/).waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/more than 200 pages/).count()) === 1, "over-200-page file is rejected with guidance to PDF Split");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const copyRes = await page.request.get(`${BASE_URL}/tools/pdf-redact`);
  const html = copyRes.ok() ? await copyRes.text() : "";
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/’/g, "'").replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("physically stamping a solid black rectangle"), "copy explains redaction is physically stamped in");
  check(body.includes("not a forensic guarantee"), "copy admits this is not forensic erasure");
  check(body.includes("100% client-side"), "copy states the privacy model");
  check(body.includes("Unlock PDF"), "copy routes protected files to Unlock PDF");
  check(!/permanently removes sensitive/i.test(lower) && !/making it unrecoverable/i.test(lower), "no deleted-forever overclaim in copy");
  check(!/Drag and drop/i.test(lower), "no drag-and-drop promise");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-redact-a-pdf`);
  check(guide.status() === 200, "pdf-redact guide renders");
  check((await guide.text()).includes("not removed"), "guide keeps the honest limits disclosure");

  const sitemapUrl = `${BASE_URL}/sitemap.xml`;
  const sitemap = (await page.request.get(sitemapUrl)).ok()
    ? await (await page.request.get(sitemapUrl)).text()
    : "";
  check(sitemap.includes("/tools/pdf-redact"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-redact-a-pdf"), "sitemap lists the pdf-redact guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);