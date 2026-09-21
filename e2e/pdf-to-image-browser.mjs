import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { unzipSync } from "/Users/rajasardar/repos/BrainCoder/node_modules/fflate/esm/browser.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-to-image`;
const DL = "/tmp/p2i";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

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

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
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
const previewImg = (n) => page.locator(`img[alt='Page ${n} preview']`);
const pagesInput = () => page.locator("input[placeholder^='e.g. 1-3,5']");

async function saveDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose PDF" }).waitFor({ state: "visible", timeout: 15000 });

  check((await page.locator("[role='button'][aria-label^='Upload a PDF']").count()) === 1, "idle state shows a clickable drop zone");
  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF file", "file input carries an accessible name");
  check(await page.locator("select").evaluate((el) => el.labels?.length === 1), "format select has an associated <label for>");
  check((await pagesInput().count()) === 1, "page-range input is present");
  check((await page.locator("option", { hasText: "PNG (lossless)" }).count()) === 1, "format select offers lossless PNG");

  await fileInput().setInputFiles(`${DL}/sample3.pdf`);
  await page.waitForSelector("img[alt='Page 1 preview']", { timeout: 60000 });
  check((await page.locator("img[alt$='preview']").count()) === 3, "all three pages become previews");

  let d = await saveDownload(page.locator("button[aria-label='Save page 1 as png image']"), "p1.png");
  check(d.name === "sample3-page-1.png", "single-page save uses a descriptive name");
  check(d.bytes[0] === 0x89 && d.bytes.slice(1, 4).toString("ascii") === "PNG", "saved page starts with PNG magic");

  await page.locator("select").selectOption("jpeg");
  await page.locator("button", { hasText: "Re-render" }).waitFor({ state: "visible", timeout: 10000 });
  check((await page.locator("div", { hasText: "Settings changed" }).count()) >= 1, "changing settings surfaces the re-render hint");
  await page.locator("button", { hasText: "Re-render" }).click();
  await page.waitForFunction(() => document.querySelectorAll("img[alt$='preview']").length === 3, null, { timeout: 60000 });
  d = await saveDownload(page.locator("button[aria-label='Save page 1 as jpg image']"), "p1.jpg");
  check(d.name === "sample3-page-1.jpg", "re-rendered jpeg save uses the .jpg name");
  check(d.bytes[0] === 0xff && d.bytes[1] === 0xd8, "saved jpeg starts with JPEG magic");

  await pagesInput().fill("2");
  await page.locator("button", { hasText: "Re-render" }).waitFor({ state: "visible", timeout: 10000 });
  await page.locator("button", { hasText: "Re-render" }).click();
  await page.waitForFunction(() => document.querySelectorAll("img[alt$='preview']").length === 1, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  check((await page.locator("img[alt$='preview']").count()) === 1, "restricting to page 2 renders only that page");

  const [dlz] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.locator("button", { hasText: "Download ZIP" }).click(),
  ]);
  check(dlz.suggestedFilename() === "sample3-1-pages.zip", "zip is named with the page count");
  const zpath = `${DL}/pages.zip`;
  await dlz.saveAs(zpath);
  const zbuf = readFileSync(zpath);
  check(zbuf[0] === 0x50 && zbuf[1] === 0x4b, "zip container magic detected");
  const entries = unzipSync(zbuf);
  const names = Object.keys(entries);
  check(names.length === 1 && names[0] === "sample3-page-2.jpg", "zip contains exactly the selected page as a jpeg entry");
  check(entries[names[0]][0] === 0xff && entries[names[0]][1] === 0xd8, "zipped image is jpeg");
  check((await page.locator("[role='status']", { hasText: /page.*downloaded/ }).count()) === 1, "zip build announces a success status");

  await pagesInput().fill("2-1");
  check((await alert(/run upward/).count()) === 1, "descending page range is rejected");
  await pagesInput().fill("abc");
  check((await alert(/Enter pages like 1-3,5/).count()) === 1, "garbage page range is rejected");
  await pagesInput().fill("");
  check((await alert(/Enter pages like 1-3,5/).count()) === 0, "clearing the range clears the error");

  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "encrypted PDF shows a friendly unlock message");

  await page.goto(`${BASE_URL}/use/pdf-to-image`, { waitUntil: "networkidle" });
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
  await page.waitForSelector("img[alt='Page 1 preview']", { timeout: 60000 });
  d = await saveDownload(page.locator("button[aria-label='Save page 1 as png image']"), "drop.png");
  check(d.name === "dropped-page-1.png", "dropped file converts under its own name");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  await page.goto(`${BASE_URL}/tools/pdf-to-image`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/288 PPI/.test(body), "marketing copy truthfully scopes resolution (~72-288 PPI)");
  check(!/300 DPI/.test(body), "no fabricated 300 DPI claim in marketing copy");
  check(/ZIP archive/.test(body), "zip output documented in marketing copy");
  check(/page range/.test(body), "page-range behavior documented in marketing copy");
  check(!/select specific pages/.test(body) || /1-3,5/.test(body), "how-to names the page range syntax");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);