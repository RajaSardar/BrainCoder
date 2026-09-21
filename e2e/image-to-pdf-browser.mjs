import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/image-to-pdf`;
const DL = "/tmp/it-pdf";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
writeFileSync(`${DL}/img-a.png`, Buffer.from(PNG_1PX, "base64"));
writeFileSync(`${DL}/img-b.png`, Buffer.from(PNG_1PX, "base64"));
writeFileSync(`${DL}/broken.png`, "this is not an image");

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
  const text = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(text)) consoleIssues.push(text);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const addBtn = () => page.locator("button", { hasText: "Add images" });
const cardNames = async () => (await page.locator("p.truncate").allTextContents()).map((t) => t.trim());
const status = (t) => page.locator("[role='status']", { hasText: t });
const alert = (t) => page.locator("[role='alert']", { hasText: t });
const dropTarget = () => page.locator("div.grid.grid-cols-2.gap-3").first();
const queued = () => page.locator("p.text-xs.text-slate-500", { hasText: "queued" }).textContent();

const pageCount = async (pdf) => (await PDFDocument.load(pdf)).getPageCount();

async function buildPdf(saveAs) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.locator("button", { hasText: "Download PDF" }).click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return readFileSync(`${DL}/${saveAs}`);
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.waitForSelector("button", { hasText: "Add images" }, { timeout: 15000 });

  check((await addBtn().count()) === 1, "Add images button renders");
  check((await page.locator('label[for="image-pdf-size"]').count()) === 1, "page-size select has an associated <label for>");
  check((await page.locator("#image-pdf-size option").count()) === 3, "page-size select exposes fit / A4 / letter");
  check((await page.locator("div", { hasText: "Drag and drop images here" }).count()) >= 1, "empty state promises drag-and-drop adding");
  check(!(await page.locator("input[type='range']").isVisible().catch(() => false)), "no margin slider while page size is Fit");

  await page.locator("input[type='file']").setInputFiles([`${DL}/img-a.png`, `${DL}/img-b.png`]);
  await page.waitForTimeout(400);
  check((await cardNames()).join(",") === "img-a.png,img-b.png", "two images added in order");
  check((await status("Added 2 images").count()) === 1, "add shows a role=status message");
  check(/2 images queued/.test((await queued()) || ""), "queued-count summary updates");

  await page.locator("input[type='file']").setInputFiles(`${DL}/img-a.png`);
  await page.waitForTimeout(400);
  check((await alert("No new images to add").count()) === 1, "duplicate file is rejected with a clear message");

  await page.locator("button[aria-label='Move img-b.png up']").click();
  await page.waitForTimeout(200);
  check((await cardNames()).join(",") === "img-b.png,img-a.png", "move-up reorders the images");
  check(await page.locator("button[aria-label='Move img-b.png up']").isDisabled(), "move-up disabled at the first position");

  check((await page.locator("button[aria-label='Remove img-b.png']").getAttribute("aria-label")) === "Remove img-b.png", "remove buttons carry a distinct accessible name");

  let pdf = await buildPdf("fit.pdf");
  check(pdf[0] === 0x25 && pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46, "downloaded PDF starts with %PDF magic");
  check((await pageCount(pdf)) === 2, "fit-mode PDF contains both image pages");
  check((await status("PDF saved — 2 pages").count()) === 1, "build reports a success status with the page count");

  await page.goto(`${BASE_URL}/use/image-to-pdf`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.waitForSelector("button", { hasText: "Add images" }, { timeout: 15000 });
  await page.locator("input[type='file']").setInputFiles([`${DL}/img-a.png`, `${DL}/img-b.png`]);
  await page.waitForTimeout(400);

  const pngB64 = await readFileSync(`${DL}/img-a.png`);
  await page.evaluate(
    ([rawPng]) => {
      const bin = atob(rawPng);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "drop-a.png", { type: "image/png" }));
      const el = document.querySelector("div.grid.grid-cols-2.gap-3");
      el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    [pngB64.toString("base64")],
  );
  await page.waitForTimeout(500);
  check((await cardNames()).includes("drop-a.png"), "drag-and-drop onto the grid adds the image");

  await page.locator("#image-pdf-size").selectOption("a4");
  await page.waitForTimeout(200);
  check(await page.locator("input[type='range']").isVisible(), "margin slider appears when A4 is selected");
  await page.locator("input[type='range']").fill("96");
  await page.waitForTimeout(200);

  pdf = await buildPdf("a4.pdf");
  check((await pageCount(pdf)) === 3, "A4 PDF spans all three images");

  await page.locator("input[type='file']").setInputFiles(`${DL}/broken.png`);
  await page.waitForTimeout(500);
  check((await alert(/Couldn/).count()) === 1, "unloadable image file reports a failure alert");
  check((await cardNames()).length === 3, "failed image is not added to the queue");

  await page.locator("button[aria-label='Remove drop-a.png']").click();
  await page.waitForTimeout(200);
  await page.locator("button[aria-label='Remove img-b.png']").click();
  await page.waitForTimeout(200);
  await page.locator("button[aria-label='Remove img-a.png']").click();
  await page.waitForTimeout(200);
  check((await page.locator("div", { hasText: "Drag and drop images here" }).count()) >= 1, "removing all images restores the drop-friendly empty state");
  check(/0 images queued/.test((await queued()) || ""), "queued count returns to zero");

  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/image-to-pdf`)) === 200, "/use/image-to-pdf 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/image-to-pdf`)) === 200, "/tools/image-to-pdf 200");

  await page.goto(`${BASE_URL}/tools/image-to-pdf`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(/static first frame/.test(body), "marketing copy honestly scopes GIF to a static first frame");
  check(/reorder/.test(body), "marketing copy documents reordering");
  check(!/orientation/i.test(body) && !/landscape/i.test(body), "no fabricated orientation/landscape claim in marketing copy");
  check(!/custom dimensions/i.test(body), "no fabricated custom-dimensions claim in marketing copy");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);