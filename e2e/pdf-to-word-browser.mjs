// Production-Chrome e2e for "PDF to Word".
//
//   node e2e/pdf-to-word-browser.mjs          # expects a server on :3801

import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-to-word`;
const TOOL_PAGE = `${BASE_URL}/tools/pdf-to-word`;

let passed = 0;
let failed = 0;
const failures = [];
function check(ok, label, extra = "") {
  if (ok) {
    passed += 1;
    console.log(`ok  ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.error(`NOT OK  ${label}${extra ? ` \u2014 ${String(extra).slice(0, 400)}` : ""}`);
  }
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
const fileInput = () => page.locator('input[type="file"]');
const chooseBtn = () => tool().getByRole("button", { name: /Choose PDF/ });

async function settle(ms = 200) {
  await page.waitForTimeout(ms);
}

try {
  section("load");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(300);
  check(page.url().includes("/use/pdf-to-word"), "renders use route", page.url());
  check((await fileInput().count()) === 1, "has file input");
  check((await chooseBtn().count()) === 1, "has choose button");
  check((await tool().getByText(/quality scale|Quality/i).count()) >= 1, "shows quality scale control");

  section("empty state");
  check((await tool().getByText(/Drop your PDF here/).count()) >= 1, "shows drop zone");

  section("network");
  check(offOrigin.length === 0, "no off-origin requests", offOrigin.join(","));
  check(nonGet.length === 0, "no non-GET requests", nonGet.join(","));
  check(pageErrors.length === 0, "no page errors", pageErrors.slice(0,2).join(";"));
} catch (e) {
  failed++;
  console.error(e);
} finally {
  await context.close();
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
