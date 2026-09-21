import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/css-cursor`;
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

writeFileSync("/tmp/cursor-test.png", Buffer.from(PNG_1PX, "base64"));
writeFileSync("/tmp/cursor-not-image.txt", "hello");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

const cards = () => page.locator("button[aria-label^='Preview ']");
const snippet = () => page.locator("section[aria-label='Interactive cursor preview'] p.font-mono").textContent();
const previewLabel = () => page.locator("p", { hasText: /^Previewing:/ }).textContent();
const clip = () => page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));
const err = () => page.locator("[role='alert']", { hasText: "Choose a PNG" });

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // Waiting for the client island (dynamic import)
  await page.waitForSelector("button[aria-label^='Preview ']", { timeout: 15000 });

  check((await cards().count()) === 36, "36 cursor keyword cards render");
  check(/cursor: pointer;/.test((await snippet()) || ""), "default preview shows cursor: pointer;");
  check(/Previewing: pointer/.test((await previewLabel()) || ""), "default preview label is pointer");
  check(await page.locator("button[aria-label='Preview pointer cursor']").getAttribute("aria-pressed") === "true", "pointer card is selected by default");

  await page.locator("button[aria-label='Preview grab cursor']").click();
  check(/cursor: grab;/.test((await snippet()) || ""), "clicking grab updates the preview declaration");
  check(/Previewing: grab/.test((await previewLabel()) || ""), "clicking grab updates the preview label");
  check(await page.locator("button[aria-label='Preview grab cursor']").getAttribute("aria-pressed") === "true", "grab card shows aria-pressed");
  check(await page.locator("button[aria-label='Preview pointer cursor']").getAttribute("aria-pressed") === "false", "pointer card deselected");

  check((await page.locator("button[aria-label='Copy']").count()) === 0, "no per-card generic 'Copy' buttons remain");

  await page.locator("button[aria-label='Copy cursor declaration']").click();
  await page.waitForTimeout(250);
  check((await clip()) === "cursor: grab;", "copy writes the exact cursor declaration");

  await page.locator("input[type='file']").setInputFiles("/tmp/cursor-test.png");
  await page.waitForTimeout(300);
  const sn = (await snippet()) || "";
  check(/url\("blob:/.test(sn) && sn.endsWith("2 2, pointer;"), "custom image produces a url(...) 2 2, pointer declaration");
  check(/Previewing: custom cursor \(cursor-test\.png\)/.test((await previewLabel()) || ""), "custom cursor label shows the file name");
  check(await page.locator("button", { hasText: "Clear custom" }).isVisible(), "clear-custom control appears");

  await page.locator("button", { hasText: "Clear custom" }).click();
  check(/^cursor: pointer;$/.test((await snippet()) || ""), "clearing custom restores the pointer declaration");

  await page.locator("input[type='file']").setInputFiles("/tmp/cursor-not-image.txt");
  await page.waitForTimeout(300);
  check((await err().count()) === 1 && /Choose a PNG or CUR/.test((await err().textContent()) || ""), "non-image file shows role=alert guidance");

  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/css-cursor`)) === 200, "/use/css-cursor 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/css-cursor`)) === 200, "/tools/css-cursor 200");

  await page.goto(`${BASE_URL}/tools/css-cursor`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(/PNG or CUR/.test(body), "marketing copy documents local PNG/CUR custom cursor");
  check(!/paste a cursor image URL/i.test(body), "no fabricated paste-a-URL claim in marketing copy");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 300)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);