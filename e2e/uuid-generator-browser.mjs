import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/uuid-generator`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
const notes = [];

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

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const slider = page.locator("input[type='range']");
const status = page.locator("p[role='status'][aria-live='polite']");
const rowCodes = () => page.locator("code.font-mono.text-blue-700");
const rowValues = async () => (await rowCodes().allTextContents()).map((t) => t.trim());
const clip = () => page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));

async function setCount(v) {
  await slider.evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(v));
  await page.waitForTimeout(300);
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // root elements exist after the client-only mount froze no SSR sample
  check((await rowCodes().count()) === 5, "boots to 5 generated UUIDs (client mount, no SSR sample)");
  check((await status.textContent()).includes("5 UUIDs generated"), "status announces the initial batch");
  for (const value of await rowValues()) {
    check(V4.test(value), `row is valid lowercase v4: ${value.slice(0, 23)}…`);
  }

  // slider drives count live (stale-config trap gone)
  const maxAttr = await slider.getAttribute("max");
  const minAttr = await slider.getAttribute("min");
  check(maxAttr === "100", "slider caps at 100");
  check(minAttr === "1", "slider floor at 1");
  await setCount(1);
  check((await rowCodes().count()) === 1, "slider to 1 re-renders a single row immediately");
  check((await status.textContent()).includes("1 UUID generated"), "singular status wording at 1");
  await setCount(100);
  check((await rowCodes().count()) === 100, "slider to 100 re-renders 100 rows immediately");
  const batch100 = new Set(await rowValues());
  check(batch100.size === 100, "100-row batch has no duplicates");

  // variants re-render the current batch live
  await page.locator("label", { hasText: "Uppercase" }).locator("input").check();
  await page.waitForTimeout(300);
  let vals = await rowValues();
  check(vals.every((v) => /^[A-F0-9-]{36}$/.test(v)), "uppercase reformats every row to 36 upper chars");
  await page.locator("label", { hasText: "No hyphens" }).locator("input").check();
  await page.waitForTimeout(300);
  vals = await rowValues();
  check(vals.every((v) => /^[A-F0-9]{32}$/.test(v)), "no-hyphens + uppercase yields 32 upper hex chars");
  for (const v of vals.slice(0, 10)) {
    check(v[12] === "4", `version nibble survives stripping (${v[12]})`);
    check("[89AB]".includes(v[16]), `variant nibble survives stripping (${v[16]})`);
  }
  check((await status.textContent()).includes("100 UUIDs generated (no hyphens) (uppercase)"), "status reflects active variants");
  await page.locator("label", { hasText: "No hyphens" }).locator("input").uncheck();
  await page.locator("label", { hasText: "Uppercase" }).locator("input").uncheck();
  await page.waitForTimeout(300);
  await setCount(5);

  // Generate re-rolls a fresh batch of the same size
  const before = await rowValues();
  await page.locator("button", { hasText: "Generate" }).click();
  await page.waitForTimeout(200);
  const after = await rowValues();
  check(after.length === 5 && after.join() !== before.join(), "Generate re-rolls a different 5-batch");

  // copy all => newline-joined batch, equals on screen
  await page.locator("button[aria-label='Copy all UUIDs']").click();
  await page.waitForTimeout(200);
  const clipAll = await clip();
  const screen = await rowValues();
  check(clipAll === screen.join("\n"), "Copy all writes the exact on-screen batch, one per line");
  check((await clipAll.split("\n")).length === screen.length, "Copy all line count matches rows");

  // per-row copy => single value, distinct accessible names
  await page.locator("button[aria-label='Copy UUID 1']").click();
  await page.waitForTimeout(200);
  check((await clip()) === screen[0], "row 1 copy writes that row's value");
  check((await page.locator("button[aria-label^='Copy UUID ']").count()) === 5, "per-row copy labels are distinct");

  // Clear empties; Generate refills from current config
  await page.locator("button", { hasText: "Clear" }).click();
  await page.waitForTimeout(200);
  check((await rowCodes().count()) === 0, "Clear empties the list");
  check((await page.locator("button[aria-label='Copy all UUIDs']").isDisabled()) === true, "Copy all disabled when empty");
  check((await page.locator("button", { hasText: "Clear" }).isDisabled()) === true, "Clear disabled when empty");
  check((await status.textContent()).includes("No UUIDs yet"), "empty state has a helpful status");
  await page.locator("button", { hasText: "Generate" }).click();
  await page.waitForTimeout(200);
  check((await rowCodes().count()) === 5, "Generate refills 5 after Clear");

  // a11y scaffolding
  const sliderId = await slider.getAttribute("id");
  check(sliderId !== null && (await page.locator(`label[for="${sliderId}"]`).count()) === 1, "slider has a programmatic label");
  check((await status.count()) === 1 && (await status.getAttribute("aria-live")) === "polite", "live status region present");
  check((await page.locator("[role='alert']", { hasText: "Web Crypto" }).count()) === 0, "no crypto-unavailable alert in Chrome");

  // routing + marketing integrity
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/uuid-generator`)) === 200, "/use/uuid-generator 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/uuid-generator`)) === 200, "/tools/uuid-generator 200");

  await page.goto(`${BASE_URL}/tools/uuid-generator`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(/1 to 100/.test(body), "marketing copy documents the real 1–100 range");
  check(!/Generate Batch/i.test(body), "phantom 'Generate Batch' button not in copy");
  check(!/struck by lightning/i.test(body), "lightning simile removed");
  check(/122 random bits/.test(body), "FAQ states the accurate 122-bit entropy");
  check(/No hyphens/.test(body), "No hyphens variant is documented");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 300)}`);
  notes.push(String(e));
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (notes.length) console.log(notes.join("\n"));
process.exit(failed === 0 ? 0 : 1);