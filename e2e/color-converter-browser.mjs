import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/color-converter`;

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

const input = page.locator("input[type='text']");
const picker = page.locator("input[type='color']");
const vals = page.locator("p.font-mono.text-sm.font-medium");
const err = page.locator("[role='alert']", { hasText: "Enter a valid color" });
const clip = () => page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));

async function setVal(v) {
  await input.fill(v);
  await page.waitForTimeout(250);
}
const results = async () => (await vals.allTextContents()).map((t) => t.trim());

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  const inputId = await input.getAttribute("id");
  check((await input.getAttribute("placeholder")) !== null, "hex input has a placeholder");
  check(inputId !== null && (await page.locator(`label[for="${inputId}"]`).count()) === 1, "hex input has a <label for> name");

  let r = await results();
  check(r.length === 3 && r[0] === "#7C3AED" && r[1] === "rgb(124, 58, 237)" && r[2] === "hsl(262, 83%, 58%)", `default #7C3AED → RGB+HSL (${r.join(" | ")})`);
  check((await picker.inputValue()) === "#7c3aed", "picker shows the default color");

  await setVal("#f00");
  r = await results();
  check(r[0] === "#FF0000" && r[1] === "rgb(255, 0, 0)" && r[2] === "hsl(0, 100%, 50%)", "short hex #f00 expands to full RGB + HSL");
  check((await picker.inputValue()) === "#ff0000", "picker tracks short-hex input");

  await setVal("rgb(124, 58, 237)");
  r = await results();
  check(r[0] === "#7C3AED", "rgb(124, 58, 237) → hex #7C3AED");
  check((await picker.inputValue()) === "#7c3aed", "picker tracks rgb() input");

  await setVal("hsl(0, 100%, 50%)");
  r = await results();
  check(r[0] === "#FF0000" && r[1] === "rgb(255, 0, 0)", "hsl(0, 100%, 50%) → #FF0000 + rgb");

  await setVal("rgba(255, 0, 0, 0.5)");
  r = await results();
  check(r[0] === "#FF000080" && r[1] === "rgba(255, 0, 0, 0.5)" && r[2] === "hsla(0, 100%, 50%, 0.5)", "rgba alpha flows to hex/rgb/hsl outputs");

  await setVal("#00FF0080");
  r = await results();
  check(r[0] === "#00FF0080" && r[1].startsWith("rgba(0, 255, 0, 0.5"), "8-digit hex alpha round-trips to rgba");

  await setVal("rgb(300, 0, 0)");
  r = await results();
  check(r[0] === "#FF0000" && r[1] === "rgb(255, 0, 0)", "out-of-range channel clamps (300 → 255)");

  check((await page.locator("button[aria-label='Copy HEX value']").count()) === 1, "HEX copy button has distinct aria-label");
  check((await page.locator("button[aria-label='Copy RGB value']").count()) === 1, "RGB copy button has distinct aria-label");
  check((await page.locator("button[aria-label='Copy HSL value']").count()) === 1, "HSL copy button has distinct aria-label");
  await page.locator("button[aria-label='Copy HEX value']").click();
  await page.waitForTimeout(200);
  check((await clip()) === "#FF0000", "HEX copy writes the exact hex value");

  await setVal("red");
  check((await err.count()) === 1 && /Enter a valid color/.test(await err.textContent()), "invalid 'red' shows role=alert error");
  check((await vals.count()) === 0, "results hidden on invalid input");
  check((await input.getAttribute("aria-invalid")) === "true", "input marked aria-invalid on error");
  check((await picker.inputValue()) === "#ff0000", "picker keeps last valid color on invalid input");

  await setVal("");
  check((await err.count()) === 0, "empty input stays error-free");
  check((await vals.count()) === 0, "empty input hides results (no stale results)");

  await setVal("#7C");
  check((await err.count()) === 0, "partial hex '#7C' shows no error");

  await setVal("hsl(2");
  check((await err.count()) === 0, "partial hsl( shows no error");

  await setVal("#ggg");
  check((await err.count()) === 1, "invalid '#ggg' shows error");
  check((await picker.inputValue()) === "#ff0000", "picker keeps last valid after garbage hex");

  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/color-converter`)) === 200, "/use/color-converter 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/color-converter`)) === 200, "/tools/color-converter 200");

  await page.goto(`${BASE_URL}/tools/color-converter`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(/8-digit/.test(body), "marketing copy documents 8-digit hex alpha");
  check(/clamp/i.test(body), "marketing copy documents auto-clamping");
  check(!/Choose Output Format/.test(body), "phantom 'Choose Output Format' step removed");

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