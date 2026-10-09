// Production-Chrome e2e for "Cron Expression Parser".
//
// The promises this tool makes: a five- or six-field expression (or a macro)
// reports what each field means and when the next runs happen; anything else —
// including a four-field expression that cron-parser would otherwise silently
// accept — is refused with the field-count rule restated; one-keystroke accuracy
// with a live clock; nothing leaves the tab.
//
//   node e2e/cron-parser-browser.mjs            # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/cron-parser-browser.mjs
//
// The orchestrator runs this twice against the same production build. The run
// slider's ceiling is read out of the shipped component source so a change to the
// cap makes the harness assert the new number instead of a stale literal.

import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/cron-parser`;
const TOOL_PAGE = `${BASE_URL}/tools/cron-parser`;

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENT_SRC = readFileSync(join(REPO, "src/features/cron-parser/CronParser.tsx"), "utf8");

const SLIDER_MAX = Number(/max=\{(\d+)\}/.exec(COMPONENT_SRC)?.[1] ?? 0);

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

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
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
const exprInput = () => tool().getByLabel("Cron expression");
const countSlider = () => tool().getByLabel(/^Next: \d+$/);
const runCards = () => tool().locator("div.rounded-lg.bg-slate-50");
const parsedPre = () => tool().locator("pre");
const alertBox = () => tool().locator('[role="alert"]');
const statusRegion = () => tool().locator('[role="status"]');
const resetButton = () => tool().getByRole("button", { name: "Reset", exact: true });
const utcToggle = () => tool().getByText("UTC", { exact: true });
const exampleChip = (label) => tool().getByRole("button", { name: label, exact: true });

async function settle(ms = 220) {
  await page.waitForTimeout(ms);
}

try {
  // =========================================================== the empty boot ===
  section("the empty boot and the labels");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(600);
  check(page.url().includes("/use/cron-parser"), "the tool route renders", page.url());
  check((await exprInput().count()) === 1, "the expression input is labelled and findable");
  check((await countSlider().count()) === 1, "the run-count slider is labelled and findable");
  check((await exprInput().inputValue()) === "*/5 * * * *", "the box boots with the every-5-minutes example");
  check(SLIDER_MAX === 20, "the shipped slider ceiling is 20", String(SLIDER_MAX));
  check((await countSlider().getAttribute("max")) === String(SLIDER_MAX), "the rendered slider ceiling matches the shipped source");
  check((await utcToggle().count()) === 1, "the UTC toggle is present");
  check((await statusRegion().count()) >= 1, "a role=status live region exists");

  // =========================================================== a five-field parse ===
  section("five fields parse and describe");
  await exprInput().fill("*/5 * * * *");
  await settle();
  check((await tool().getByText(/Next 5 run\(s\)/).count()) === 1, "the next-runs heading counts 5 runs");
  check((await runCards().count()) === 5, "five run cards are listed", String(await runCards().count()));
  check((await tool().getByText("Parsed fields").count()) === 1, "the parsed-fields panel is shown");
  const fields = await parsedPre().textContent();
  check(/minute: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55/.test(fields || ""), "the minute step is explained", fields || "");
  check(/hour: \*/.test(fields || "") && /day of month: \*/.test(fields || "") && /day of week: \*/.test(fields || ""), "the other fields are listed", fields || "");
  check(!/second:/.test(fields || ""), "no seconds line for a five-field expression", fields || "");
  check((await tool().getByText(/upcoming run\(s\) listed/).count()) >= 1, "the live region reports the count");

  // =========================================================== six fields ===
  section("six fields with seconds");
  await exprInput().fill("*/15 * * * * *");
  await settle();
  const six = await parsedPre().textContent();
  check(/second: 0, 15, 30, 45/.test(six || ""), "the seconds field is shown for six fields", six || "");
  check(!(await alertBox().count()), "a valid six-field expression shows no alert");

  // examples
  await exampleChip("Every 15 s (6 fields)").click();
  await settle();
  check(/second: 0, 15, 30, 45/.test((await parsedPre().textContent()) || ""), "the 6-field example chip loads and describes seconds");
  await exampleChip("@daily macro").click();
  await settle();
  check(/minute: 0\nhour: 0/.test((await parsedPre().textContent()) || ""), "the @daily macro chip describes midnight");

  // =========================================================== the field-count rule ===
  section("anything but 5/6 fields is refused");
  for (const [expr, count] of [
    ["*", 1],
    ["* * * *", 4],
    ["* * * * * * *", 7],
  ]) {
    await exprInput().fill(expr);
    await settle();
    check((await alertBox().count()) === 1, `${count}-field "${expr}" raises an alert`);
    const text = await alertBox().textContent();
    check(/5 fields/.test(text || "") && /6/.test(text || "") && new RegExp(`you typed ${count}\\b`).test(text || ""), `the ${count}-field alert restates the rule and the count`, text || "");
    check((await runCards().count()) === 0, `no runs are listed for the ${count}-field input`);
  }
  await exprInput().fill("@midnight");
  await settle();
  check((await alertBox().count()) === 1, "@midnight is refused (it is not a resolved macro)");
  await exprInput().fill("0 0 30 2 *");
  await settle();
  const feb = await alertBox().textContent();
  check(/February 30/.test(feb || ""), "February 30 refuses with a plain-English reason", feb || "");
  check((await tool().getByText(/Invalid expression/).count()) >= 1, "the live region names the invalid state");

  // =========================================================== the reset ===
  section("reset and the slider");
  await exprInput().fill("0 0 30 2 *");
  await resetButton().click();
  await settle();
  check((await exprInput().inputValue()) === "*/5 * * * *", "Reset restores the boot expression");
  check((await alertBox().count()) === 0, "Reset clears the alert");
  await exprInput().fill("30 8 * * 1");
  await settle();
  check(/day of week: Mon/.test((await parsedPre().textContent()) || ""), "a named weekday shows as a name");
  const slider = countSlider();
  await slider.evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, SLIDER_MAX);
  await settle();
  check((await tool().getByText(new RegExp(`Next ${SLIDER_MAX} run\\(s\\)`)).count()) === 1, "the heading follows the slider");
  check((await runCards().count()) === SLIDER_MAX, "the run cards follow the slider max", String(await runCards().count()));

  // =========================================================== privacy ===
  section("nothing leaves the browser");
  check(offOrigin.length === 0, "no request went off-origin", offOrigin.join(", "));
  check(nonGet.length === 0, "no non-GET request was made", nonGet.join(", "));

  // =========================================================== the wider page ===
  section("the registry page and the sitemap");
  await page.goto(TOOL_PAGE, { waitUntil: "networkidle" });
  await settle(400);
  const toolPageText = (await page.textContent("body")) || "";
  check(/Cron Expression Parser|Cron Expression/i.test(toolPageText), "the registry page names the tool");
  check(/@yearly, @annually, @monthly, @weekly, @daily and @hourly/.test(toolPageText), "the registry page lists the real macros");
  check(/@midnight/.test(toolPageText), "the registry page discloses that @midnight is not accepted");
  check(!/auto-?detect/i.test(toolPageText), "the registry page makes no auto-detect claim");
  check(!/production[- ]ready/i.test(toolPageText), "the registry page avoids production-ready phrasing");
  const sm = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check(sm.ok(), "the sitemap responds", String(sm.status()));
  const smText = await sm.text();
  check(smText.includes("/tools/cron-parser"), "the registry page is in the sitemap");

  // =========================================================== hygiene ===
  section("no hydration or runtime errors");
  check(consoleIssues.length === 0, "no hydration warnings", consoleIssues.slice(0, 3).join(" | "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 3).join(" | "));
} catch (err) {
  failed += 1;
  failures.push(`harness threw: ${err.message}`);
  console.error(`\nHARNESS ERROR: ${err.stack}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed ? 1 : 0);