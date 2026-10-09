// Production-Chrome e2e for "Number Base Converter".
//
// The promises this tool makes: one integer converts to binary, octal, decimal,
// hexadecimal and a Unicode code point; the input base is explicit (2..36), a
// prefix such as 0x is stripped only when it matches that base, and any other
// prefix or sign-plus-prefix combination is read literally or refused — never
// auto-detected. The base list is read out of the shipped module at run time so
// a change to the range is asserted rather than guessed.
//
//   node e2e/number-base-browser.mjs             # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/number-base-browser.mjs
//
// The orchestrator runs this twice against the same production build.

import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/number-base`;
const TOOL_PAGE = `${BASE_URL}/tools/number-base`;

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONVERT_SRC = readFileSync(join(REPO, "src/features/number-base/convert.ts"), "utf8");

const M = /MIN_BASE = (\d+);/.exec(CONVERT_SRC);
const MAX = /MAX_BASE = (\d+);/.exec(CONVERT_SRC);
const MIN_BASE = parseInt(M?.[1] ?? "2", 10);
const MAX_BASE = parseInt(MAX?.[1] ?? "36", 10);

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
const input = () => tool().getByLabel("Number to convert");
const baseSelect = () => tool().getByLabel("Base of the number you typed");
const errorBox = () => tool().locator("div.bg-red-50");
const row = (label) => tool().locator("div.rounded-xl.bg-white").filter({ hasText: label }).first();
const rowValue = async (label) => (await row(label).locator("p.font-mono.text-sm").first().textContent()) || "";
const note = async (label) => {
  const n = (await row(label).locator("p.font-mono.text-xs").allTextContents()).join(" ").trim();
  return n;
};
const clearButton = () => tool().getByRole("button", { name: "Clear", exact: true });

async function fillTab(value, base) {
  await input().fill(value);
  await baseSelect().selectOption(String(base));
  await page.waitForTimeout(180);
}

try {
  // =========================================================== the empty boot ===
  section("the empty boot and the base range");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(500);
  check(page.url().includes("/use/number-base"), "the tool route renders", page.url());
  check((await input().count()) === 1, "the number input is labelled");
  check((await baseSelect().count()) === 1, "the base selector is labelled");
  check((await tool().getByText(/Type a number above/).count()) === 1, "the box boots empty with a hint, not a sample");
  check((await input().inputValue()) === "", "the number input boots empty");
  check((await errorBox().count()) === 0, "no refusal on boot");
  const baseOptions = await baseSelect().locator("option").evaluateAll((els) => els.map((e) => Number(e.value)));
  check(baseOptions.length === MAX_BASE - MIN_BASE + 1, "the selector offers every base 2..36", baseOptions.join(","));
  check(baseOptions[0] === MIN_BASE && baseOptions[baseOptions.length - 1] === MAX_BASE, "the selector range matches the shipped constants", `${MIN_BASE}..${MAX_BASE}`);

  // =========================================================== the ordinary path ===
  section("a decimal number in every representation");
  await input().fill("255");
  await settle();
  check(await rowValue("Binary (2)") === "0b11111111", "255 is 0b11111111", await rowValue("Binary (2)"));
  check(await rowValue("Octal (8)") === "0o377", "255 is 0o377", await rowValue("Octal (8)"));
  check(await rowValue("Decimal (10)") === "255", "255 stays 255", await rowValue("Decimal (10)"));
  check(await rowValue("Hexadecimal (16)") === "0xFF", "255 is 0xFF", await rowValue("Hexadecimal (16)"));
  check(await rowValue("Unicode code point") === "U+00FF", "255 is U+00FF", await rowValue("Unicode code point"));
  check((await note("Unicode code point")) === "“ÿ”", "the code point shows the character ÿ", await note("Unicode code point"));

  // =========================================================== the prefix / sign rule ===
  section("sign first, prefixes only when they match");
  await fillTab("0xff", 16);
  check(await rowValue("Decimal (10)") === "255", "0xff in base 16 is 255", await rowValue("Decimal (10)"));
  await fillTab("-0xff", 16);
  check(await rowValue("Decimal (10)") === "-255", "the sign survives the hex prefix", await rowValue("Decimal (10)"));
  check(await rowValue("Hexadecimal (16)") === "-0xFF", "the negative hex keeps its sign", await rowValue("Hexadecimal (16)"));
  await fillTab("0b11", 16);
  check(await rowValue("Decimal (10)") === "2833", "0b11 in base 16 is the hex number 0xB11, not binary", await rowValue("Decimal (10)"));
  await fillTab("-0xff", 10);
  check((await errorBox().count()) === 1, "-0xff in base 10 is refused", "");
  check(/x/.test(await errorBox().textContent()), "the refusal names the offending digit", (await errorBox().textContent()) || "");
  check((await tool().locator("div.grid.sm\\:grid-cols-2").count()) === 0, "no representations are shown for a refused input");

  // =========================================================== recovery and wide bases ===
  section("recovery and the extended base list");
  await input().fill("0xff");
  await baseSelect().selectOption("16");
  await settle();
  check((await errorBox().count()) === 0, "a valid input clears the refusal");
  await input().fill("z");
  await baseSelect().selectOption("36");
  await settle();
  check(await rowValue("Decimal (10)") === "35", "base 36 reads z as 35", await rowValue("Decimal (10)"));
  await input().fill("g");
  await baseSelect().selectOption("16");
  await settle();
  check((await errorBox().count()) === 1, "base 16 refuses g");

  // =========================================================== very large values ===
  section("arbitrary precision");
  await input().fill("18446744073709551616");
  await baseSelect().selectOption("10");
  await settle();
  check(await rowValue("Hexadecimal (16)") === "0x10000000000000000", "2^64 is exact in hex", await rowValue("Hexadecimal (16)"));
  check(await rowValue("Unicode code point") === "—", "a value above U+10FFFF shows a dash for the code point");

  // =========================================================== clear ===
  section("clear resets to the hint");
  await clearButton().click();
  await settle();
  check((await input().inputValue()) === "", "Clear empties the input");
  check((await tool().getByText(/Type a number above/).count()) === 1, "Clear returns to the hint state");
  check((await errorBox().count()) === 0, "Clear removes any refusal");

  // =========================================================== privacy ===
  section("nothing leaves the browser");
  check(offOrigin.length === 0, "no request went off-origin", offOrigin.join(", "));
  check(nonGet.length === 0, "no non-GET request was made", nonGet.join(", "));

  // =========================================================== the wider page ===
  section("the registry page and the sitemap");
  await page.goto(TOOL_PAGE, { waitUntil: "networkidle" });
  await settle(400);
  const toolPageText = (await page.textContent("body")) || "";
  check(/Number Base Converter/i.test(toolPageText), "the registry page names the tool");
  check(/2 to 36|2 through 36/.test(toolPageText), "the registry page states the real 2..36 range");
  check(!/2\s*(to|-)\s*64/.test(toolPageText), "the registry page drops the 2-64 claim");
  check(!/fractional/i.test(toolPageText), "the registry page drops the fractional claim");
  check(!/two'?s complement/i.test(toolPageText), "the registry page drops the two's-complement claim");
  check(!/auto-?detect/i.test(toolPageText), "the registry page drops the auto-detect claim");
  check(!/bit[- ]length and grouping|grouping options/i.test(toolPageText), "the registry page drops the bit-length/grouping claim");
  const sm = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check(sm.ok(), "the sitemap responds", String(sm.status()));
  const smText = await sm.text();
  check(smText.includes("/tools/number-base"), "the registry page is in the sitemap");

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

async function settle(ms = 220) {
  await page.waitForTimeout(ms);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed ? 1 : 0);