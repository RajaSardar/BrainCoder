import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/lorem-ipsum`;

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

const output = page.locator("textarea[aria-label='Generated output']");
const status = page.locator("p[role='status'][aria-live='polite']");
const slider = page.locator("input[type='range']");
const modeBtn = (m) => page.locator("button", { hasText: m });
const clip = () => page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));

function countAdjDupes(text) {
  const m = text.match(/\b([\p{L}']+)[\s.,!?]+\1(?:[\s.,!?]|$)/giu) ?? [];
  return m.length;
}

async function setCount(v) {
  await slider.evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(v));
  await page.waitForTimeout(400);
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  let value = await output.inputValue();
  check(value.length > 0, "client mount generates output (no SSR lorem, no hydration throw)");
  const paragraphs = value.split("\n\n");
  check(paragraphs.length === 3, "defaults to 3 paragraphs");
  check(/^Lorem ipsum dolor sit amet/.test(value), "first paragraph opens with classic 'Lorem ipsum dolor sit amet'");
  check(/[.!?]\s*$/.test(value), "paragraph text ends with sentence punctuation");

  const maxAttr = await slider.getAttribute("max");
  const minAttr = await slider.getAttribute("min");
  check(maxAttr === "50" && minAttr === "1", "slider spans the documented 1–50 range");
  const sliderId = await slider.getAttribute("id");
  check(sliderId !== null && (await page.locator(`label[for="${sliderId}"]`).count()) === 1, "slider has a programmatic label");
  check((await status.textContent()).includes("3 paragraphs"), "status announces '3 paragraphs'");

  // mode toggle changes shape + triggers auto-regeneration
  await modeBtn("sentences").click();
  await page.waitForTimeout(600);
  value = await output.inputValue();
  check(!value.includes("\n\n"), "sentences mode output has no blank-line paragraph breaks");
  const sentencesCount = (value.match(/[.!?]\s/g) ?? []).length + (value.endsWith(".") ? 1 : 0);
  check(sentencesCount === 3, `sentences mode regenerated 3 sentences (got ${sentencesCount})`);
  check(await modeBtn("sentences").getAttribute("aria-pressed") === "true", "mode buttons carry aria-pressed state");
  check((await status.textContent()).includes("3 sentences"), "status reflects sentences mode");
  check((await page.locator("div[role='group'][aria-label='Type']").count()) === 1, "mode buttons live in an aria-labelled group");

  // words mode + count change auto-regenerate (stale-output trap gone)
  await modeBtn("words").click();
  await page.waitForTimeout(600);
  value = await output.inputValue();
  check(/^lorem ipsum /.test(value), "words mode prefixes 'lorem ipsum'");
  check((await status.textContent()).includes("3 words"), "status reflects words mode");
  await setCount(50);
  value = await output.inputValue();
  check((await value.trim().split(/\s+/).length) === 50, "words count change regenerates 50 words live");
  check(countAdjDupes(value) === 0, "no adjacent duplicate tokens across 50 words");
  await modeBtn("paragraphs").click();
  await setCount(5);
  await page.waitForTimeout(400);
  value = await output.inputValue();
  check(value.split("\n\n").length === 5, "paragraphs mode at 5 yields 5 paragraphs after count change");
  check((await status.textContent()).includes("5 paragraphs"), "status updates with the regenerated batch");
  check((await output.getAttribute("readonly")) !== null || (await output.getAttribute("read-only")) !== null, "output textarea is read-only");

  // Generate re-rolls a different batch of the same size
  await modeBtn("sentences").click();
  await setCount(3);
  const before = await output.inputValue();
  await page.locator("button", { hasText: "Generate" }).click();
  await page.waitForTimeout(400);
  const after = await output.inputValue();
  check(after !== before && after.length > 0, "Generate re-rolls a different batch");

  // copy writes the on-screen output
  check((await page.locator("button[aria-label='Copy generated text']").count()) === 1, "copy button has distinct aria-label");
  await page.locator("button[aria-label='Copy generated text']").click();
  await page.waitForTimeout(200);
  check((await clip()) === (await output.inputValue()), "copy button writes the exact on-screen output");

  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/lorem-ipsum`)) === 200, "/use/lorem-ipsum 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/lorem-ipsum`)) === 200, "/tools/lorem-ipsum 200");

  await page.goto(`${BASE_URL}/tools/lorem-ipsum`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(/1 to 50/.test(body), "marketing copy documents the real 1–50 range");
  check(/Lorem ipsum dolor sit amet/.test(body), "marketing copy documents the classic opener");
  check(!/shuffle|pure random|type specimen book/i.test(body), "fabricated shuffle/random claims removed from marketing copy");
  check(!/slider or input/.test(body), "phantom slider-or-input control not claimed");

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