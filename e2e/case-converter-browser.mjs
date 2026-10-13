// Production-Chrome e2e for "Case Converter".
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/case-converter`;

let passed = 0;
let failed = 0;
function check(ok, label, extra = "") {
  if (ok) { passed++; console.log(`ok  ${label}`); }
  else { failed++; console.error(`NOT OK  ${label}${extra ? ` \u2014 ${String(extra).slice(0, 400)}` : ""}`); }
}
const section = (title) => console.log(`\n--- ${title}`);

const browser = await chromium.launch({ channel: "chrome", executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

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

const tool = () => page.locator("div.space-y-5.w-full").first();
const input = () => tool().getByLabel("Text to convert");

async function settle(ms = 200) { await page.waitForTimeout(ms); }

try {
  section("load");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(300);
  check(page.url().includes("/use/case-converter"), "renders use route", page.url());
  check((await input().count()) === 1, "input has label");
  check((await input().inputValue()).length > 0, "has default value");

  section("conversions");
  await input().fill("Hello World");
  await settle();
  
  const cards = tool().locator("div.rounded-xl.border");
  await cards.first().waitFor({ state: "visible", timeout: 5000 });
  
  // Find camelCase card
  let found = false;
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const label = await card.locator("p.text-xs.font-medium.text-slate-500").textContent();
    if (label?.includes("camelCase")) {
      const val = await card.locator("p.font-mono").textContent();
      check(val === "helloWorld", "camelCase helloWorld", String(val));
      found = true; break;
    }
  }
  if (!found) check(false, "camelCase found");
  
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const label = await card.locator("p.text-xs.font-medium.text-slate-500").textContent();
    if (label?.includes("snake_case")) {
      const val = await card.locator("p.font-mono").textContent();
      check(val === "hello_world", "snake_case hello_world", String(val)); break;
    }
  }
  
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const label = await card.locator("p.text-xs.font-medium.text-slate-500").textContent();
    if (label?.includes("kebab-case")) {
      const val = await card.locator("p.font-mono").textContent();
      check(val === "hello-world", "kebab-case hello-world", String(val)); break;
    }
  }
  
  section("network");
  check(offOrigin.length === 0, "no off-origin requests", offOrigin.join(","));
  check(nonGet.length === 0, "no non-GET requests", nonGet.join(","));
  check(pageErrors.length === 0, "no page errors", pageErrors.slice(0,2).join(";"));
} catch (e) {
  failed++; console.error(e);
} finally {
  await context.close();
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
