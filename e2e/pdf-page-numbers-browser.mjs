import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-page-numbers`;
const DL = "/tmp/p2n";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// fixtures — one page carries /Rotate 90 to exercise placement compensation
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    if (i === 2) page.setRotation(degrees(90));
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

const CONTENT = async (bytes, idx) => {
  const doc = await PDFDocument.load(bytes);
  const entries = doc.context.lookup(doc.getPage(idx).node.normalizedEntries().Contents);
  const refs = entries.array ?? [entries];
  let out = "";
  for (const ref of refs) {
    const stream = await doc.context.lookup(ref);
    const raw = stream.getContents();
    let text;
    try { text = Buffer.from(inflateSync(Buffer.from(raw))).toString("latin1"); }
    catch { text = Buffer.from(raw).toString("latin1"); }
    out += text + "\n";
  }
  return out;
};
const hexToLatin = (hex) => hex.replace(/\s+/g, "").match(/.{2}/g)?.map((b) => String.fromCharCode(parseInt(b, 16))).join("") ?? "";
const runs = (content) => [...content.matchAll(/<([0-9A-F\s]+)> Tj/g)].map((m) => hexToLatin(m[1]));

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
  await page.locator("button", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  // --- idle state ---
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to add page numbers", "file input carries an accessible name");
  check((await page.locator("fieldset").count()) === 0, "settings hidden until a document is loaded");
  check(/(Processing is local|never leaves)/.test((await status(/Select a PDF to add page numbers/).first().textContent()) ?? ""), "idle state explains numbered placement is local");

  // --- upload ---
  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await status(/Loaded 3 pages/).first().waitFor({ timeout: 60000 });
  check((await status(/Loaded 3 pages/).count()) === 1, "load status reports the page count");
  check(/(sample3\.pdf — 3 pages)/.test((await status(/sample3\.pdf/).first().textContent()) ?? ""), "info line shows source name and page count");
  check((await page.locator("fieldset > legend").first().textContent()) === "Numbering options", "settings group has a fieldset legend");

  // --- position group: fieldset + legend + six aria-pressed buttons ---
  const posLegend = page.locator("fieldset fieldset > legend");
  check((await posLegend.first().textContent()) === "Position", "position group has its own legend");
  const posButtons = page.locator("button[aria-pressed]");
  check((await posButtons.count()) === 6, "six position buttons with aria-pressed");
  check((await posButtons.filter({ hasText: "Bottom center" }).getAttribute("aria-pressed")) === "true", "bottom center selected by default");

  // --- labels: slider + start-number input + checkbox ---
  const ranges = page.locator("input[type='range']");
  check((await ranges.count()) === 1, "one slider (font size)");
  check((await page.locator("label", { hasText: "Font size" }).count()) === 1, "font size slider carries a label");
  const numInput = page.locator("input[type='number']");
  const numId = await numInput.getAttribute("id");
  check(await page.locator(`label[for="${numId}"]`).textContent() === "Start numbering at", "start-number input is associated with its label");
  check((await numInput.getAttribute("min")) === "0" && (await numInput.getAttribute("max")) === "9999", "start-number input is bounded 0–9999");
  const withTotal = page.locator("input[type='checkbox']");
  check((await withTotal.isChecked()) === true, "“n / total” enabled by default");

  // --- default: bottom center, 1 / 3, upright on the rotated page ---
  let d = await captureDownload(page.locator("button", { hasText: /Add page numbers/ }), "n1.pdf");
  check(d.name === "sample3-numbered.pdf", "download named <source>-numbered.pdf");
  check((await pageCount(d.bytes)) === 3, "numbered output keeps all pages");
  const rotations = (await PDFDocument.load(d.bytes)).getPages().map((p) => p.getRotation().angle);
  check(rotations.join(",") === "0,90,0", "page rotations preserved unchanged");
  const p1 = await CONTENT(d.bytes, 0);
  const p2 = await CONTENT(d.bytes, 1);
  check(/31202F2033> Tj/.test(p1), "page 1 draws label “1 / 3”");
  check(/32202F2033> Tj/.test(p2), "rotated page 2 draws label “2 / 3”");
  check(/0\.00000000000000006123233995736767 1 -1 0\.00000000000000006123233995736767/.test(p2), "rotated page 2 draws with rotate=90 (upright)");
  check((await status(/Downloaded sample3-numbered\.pdf/).first().textContent()).includes("Added page numbers to all 3 pages"), "status confirms the numbered download");

  // --- customize: start at 0, top-right, plain numbers ---
  await numInput.fill("0");
  await withTotal.uncheck();
  await page.locator("button[aria-pressed]", { hasText: "Top right" }).click();
  check((await page.locator("button[aria-pressed]", { hasText: "Top right" }).getAttribute("aria-pressed")) === "true", "top-right selected via aria-pressed toggle");
  d = await captureDownload(page.locator("button", { hasText: /Add page numbers/ }), "n2.pdf");
  check(d.name === "sample3-numbered.pdf", "customized run reuses the same filename");
  check((await pageCount(d.bytes)) === 3, "customized output keeps all pages");
  const n1 = await CONTENT(d.bytes, 0);
  const n2 = await CONTENT(d.bytes, 1);
  const n3 = await CONTENT(d.bytes, 2);
  check(runs(n1).includes("0"), "plain numbering starts at 0 on page 1");
  check(!runs(n2).some((r) => r.includes("/")), "no “/ total” run on page 2");
  check(runs(n3).includes("2"), "plain numbering ends at 2 on page 3");

  // --- start offset clamped: NaN/negative/over-range stay sane ---
  await numInput.fill("-5");
  check((await numInput.inputValue()) === "0", "negative start value clamps to 0");
  await numInput.fill("15000");
  check((await numInput.inputValue()) === "9999", "over-range start value clamps to 9999");
  await numInput.fill("1");
  await withTotal.check();

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
  await page.goto(`${BASE_URL}/tools/pdf-page-numbers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/8 and 24 points/.test(body) && /100 MB/.test(body), "copy documents the real ranges and file cap");
  check(/100% client-side/.test(body) && /nothing is uploaded/.test(body), "copy states the local-only privacy model");
  check(/n \/ total/.test(body), "copy names the “n / total” label format");
  check(/PDF Unlock/.test(body), "copy routes protected files to PDF Unlock");
  check(/PDF Cropper/.test(body), "copy routes crowded-page editing to PDF Cropper");
  check(/dark-grey Helvetica in Arabic numerals/.test(body), "copy states the fixed font and Arabic-only format (no Roman/color claims)");
  check(/beyond position and size/.test(body), "copy makes clear “Start numbering at” is the only extra adjustment");
  check(!/Drag and drop your PDF/i.test(body), "no drag-and-drop promise");
  check(!/skip numbering the first page|skip the first page/i.test(body), "no skip-a-page lie — offset is described honestly");

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-add-page-numbers-to-a-pdf`);
  check(guide.status() === 200, "page-numbers guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-page-numbers"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-add-page-numbers-to-a-pdf"), "sitemap lists the page-numbers guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);