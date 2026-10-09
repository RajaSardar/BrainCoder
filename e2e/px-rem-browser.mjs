// Production-Chrome e2e for "PX ↔ REM Converter".
//
// The promises this tool makes: px and rem convert against a base font-size the
// user sets (8–24px), blank or out-of-range input shows a dash with copy disabled
// instead of silently implying 0, fractional values stay exact (14.5px is
// 0.90625rem at 16px), the reference table follows the base, a role=status region
// announces the conversions, and nothing leaves the tab. The copy claims only
// px↔rem — no em, no vw/vh, no batch mode.
//
//   node e2e/px-rem-browser.mjs          # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/px-rem-browser.mjs
//
// The orchestrator runs this twice against the same production build. The base
// range and table size are read out of the shipped module source so a change to
// either makes the harness assert the live values instead of stale literals.

import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/px-rem`;
const TOOL_PAGE = `${BASE_URL}/tools/px-rem`;
const GUIDE_PAGE = `${BASE_URL}/guides/how-to-convert-px-to-rem`;

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_SRC = readFileSync(join(REPO, "src/features/px-rem/units.ts"), "utf8");

const MIN_BASE = Number(/MIN_BASE = (\d+)/.exec(MODULE_SRC)?.[1] ?? 0);
const MAX_BASE = Number(/MAX_BASE = (\d+)/.exec(MODULE_SRC)?.[1] ?? 0);
const TABLE_SIZE = (MODULE_SRC.match(/REFERENCE_PX = \[([^\]]+)\]/)?.[1].split(",") || []).length;

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
const baseSlider = () => tool().getByLabel(/Base font size/);
const pxInput = () => tool().getByLabel("Pixels → rem");
const remInput = () => tool().getByLabel("rem → pixels");
const pxCard = () => tool().locator("div.rounded-2xl").nth(0);
const remCard = () => tool().locator("div.rounded-2xl").nth(1);
const pxResult = () => pxCard().locator("span.font-mono.text-lg");
const remResult = () => remCard().locator("span.font-mono.text-lg");
const pxCopy = () => tool().getByRole("button", { name: "Copy rem result" });
const remCopy = () => tool().getByRole("button", { name: "Copy pixel result" });
const statusRegion = () => tool().locator('[role="status"]');
const alertBox = () => tool().locator('[role="alert"]');
const tableRows = () => tool().locator("tbody tr");

async function settle(ms = 200) {
  await page.waitForTimeout(ms);
}
async function setRange(page, el, value) {
  await el.evaluate((elNode, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(elNode, String(v));
    elNode.dispatchEvent(new Event("input", { bubbles: true }));
    elNode.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
async function clipboard() {
  return page.evaluate(() => navigator.clipboard.readText());
}

try {
  // ===================================================== the empty boot & labels ===
  section("the boot state and the labels");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(500);
  check(page.url().includes("/use/px-rem"), "the tool route renders", page.url());
  check((await baseSlider().count()) === 1, "the base slider is labelled and findable");
  check(Number((await baseSlider().getAttribute("min"))) === MIN_BASE, "the slider min matches the shipped module", String(await baseSlider().getAttribute("min")));
  check(Number((await baseSlider().getAttribute("max"))) === MAX_BASE, "the slider max matches the shipped module", String(await baseSlider().getAttribute("max")));
  check((await pxInput().inputValue()) === "24", "the px box boots with 24");
  check((await remInput().inputValue()) === "1.5", "the rem box boots with 1.5");
  check((await tool().getByText("16px = 1rem").count()) === 1, "the 1rem readout shows 16px = 1rem");
  check((await statusRegion().count()) >= 1, "a role=status live region exists");

  // ============================================================= default conversion ===
  section("the default conversions");
  check((await pxResult().textContent()) === "1.5rem", "24px is 1.5rem at a 16px base", String(await pxResult().textContent()));
  check((await remResult().textContent()) === "24px", "1.5rem is 24px at a 16px base", String(await remResult().textContent()));

  // ================================================================== precision ===
  section("fractional precision");
  await pxInput().fill("14.5");
  await settle();
  check((await pxResult().textContent()) === "0.90625rem", "14.5px is exactly 0.90625rem", String(await pxResult().textContent()));
  await remInput().fill("0.90625");
  await settle();
  check((await remResult().textContent()) === "14.5px", "0.90625rem round-trips to 14.5px", String(await remResult().textContent()));

  // =============================================================== a new base ===
  section("changing the base");
  await setRange(page, baseSlider(), 10);
  await settle();
  check((await tool().getByText("10px = 1rem").count()) === 1, "the 1rem readout follows the slider to 10px");
  check((await pxInput().inputValue()) === "14.5", "the typed px value survives a base change");
  await pxInput().fill("20");
  await settle();
  check((await pxResult().textContent()) === "2rem", "20px is 2rem at a 10px base", String(await pxResult().textContent()));
  await remInput().fill("2");
  await settle();
  check((await remResult().textContent()) === "20px", "2rem is 20px at a 10px base", String(await remResult().textContent()));
  check((await statusRegion().last().textContent()).includes("10px base"), "the live region names the current base", String(await statusRegion().last().textContent()));

  // ========================================================== blank and invalid ===
  section("blank and out-of-range input");
  await pxInput().fill("");
  await settle();
  check((await pxResult().textContent()) === "—", "an empty px field shows a dash", String(await pxResult().textContent()));
  check(await pxCopy().isDisabled(), "the px copy button is disabled while the result is a dash");
  await pxInput().fill("1500000");
  await settle();
  check((await pxResult().textContent()) === "—", "a value over the cap shows a dash", String(await pxResult().textContent()));
  check((await alertBox().count()) === 1, "an out-of-range value raises a role=alert");
  check(/1,000,000/.test((await alertBox().textContent()) || ""), "the alert names the cap", String(await alertBox().textContent()));
  check(await pxCopy().isDisabled(), "the px copy button stays disabled for an out-of-range value");
  await pxInput().fill("24");
  await settle();
  check((await alertBox().count()) === 0, "a valid value clears the alert");
  check((await pxResult().textContent()) === "2.4rem", "24px is 2.4rem at a 10px base", String(await pxResult().textContent()));
  check(!(await pxCopy().isDisabled()), "the px copy button re-enables for a valid value");

  // ========================================================================= copy ===
  section("copy");
  await setRange(page, baseSlider(), 16);
  await pxInput().fill("24");
  await settle();
  await pxCopy().click();
  await settle(150);
  check((await clipboard()) === "1.5rem", "the copy button writes the rem result", await clipboard());

  // ============================================================= reference table ===
  section("the reference table follows the base");
  check((await tableRows().count()) === TABLE_SIZE, "the table has the shipped row count", String(await tableRows().count()));
  const rowTextAt16 = (await tableRows().filter({ hasText: "16px" }).first().textContent()) || "";
  check(/1rem/.test(rowTextAt16), "the 16px row reads 1rem at a 16px base", rowTextAt16);
  check((await tool().getByText("Ag").count()) === TABLE_SIZE, "every row has a preview");
  await setRange(page, baseSlider(), 10);
  await settle();
  const rowTextAt10 = (await tableRows().filter({ hasText: "16px" }).first().textContent()) || "";
  check(/1\.6rem/.test(rowTextAt10), "the 16px row reads 1.6rem at a 10px base", rowTextAt10);

  // ========================================================================== privacy ===
  section("nothing leaves the browser");
  check(offOrigin.length === 0, "no request went off-origin", offOrigin.join(", "));
  check(nonGet.length === 0, "no non-GET request was made", nonGet.join(", "));

  // ===================================================================== the wider page ===
  section("the registry page, the guide and the sitemap");
  await page.goto(TOOL_PAGE, { waitUntil: "networkidle" });
  await settle(400);
  const toolPageText = (await page.textContent("body")) || "";
  check(/PX ↔ REM Converter|PX to REM/i.test(toolPageText), "the registry page names the tool");
  check(/0\.90625/.test(toolPageText), "the registry page shows the exact fractional example");
  check(/8px to 24px|8px–24px|8.–24/.test(toolPageText), "the registry page states the real base range");
  check(/px ↔ rem only/.test(toolPageText), "the registry page states the only supported units");
  check(!/batch/i.test(toolPageText), "the registry page makes no batch-mode claim");
  check(!/converts between pixels and viewport-relative/i.test(toolPageText), "the registry page no longer sells viewport conversion");
  check(!/supports em units/i.test(toolPageText), "the registry page no longer sells em conversion");
  check(!/vw, vh, vmin, vmax/i.test(toolPageText), "the registry FAQ no longer promises vw/vh/vmin/vmax");
  await page.goto(GUIDE_PAGE, { waitUntil: "networkidle" });
  await settle(300);
  check(page.url().includes("/guides/how-to-convert-px-to-rem"), "the px→rem guide route renders");
  check(/defined relative to the root element/.test((await page.textContent("body")) || ""), "the guide explains the rem dependency");
  const sm = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check(sm.ok(), "the sitemap responds", String(sm.status()));
  const smText = await sm.text();
  check(smText.includes("/tools/px-rem"), "the registry page is in the sitemap");
  check(smText.includes("/guides/how-to-convert-px-to-rem"), "the guide is in the sitemap");

  // ============================================================================= hygiene ===
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