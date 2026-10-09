// Production-Chrome e2e for "chmod Calculator".
//
// The promises this tool makes: the symbolic output spells execute as x (the old
// version used the first id letter and produced "rwe"); the chmod-style output
// joins the actual permission symbols (u=rwx,g=rx,o=rx) rather than the words
// "readwriteexecute"; Reset returns to the boot state of 755; and the octal box
// classifies a draft instead of applying it mid-keystroke. The preset chips and
// the reset value are read out of the shipped modules at run time.
//
//   node e2e/chmod-calculator-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/chmod-calculator-browser.mjs
//
// The orchestrator runs this twice against the same production build.

import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/chmod-calculator`;
const TOOL_PAGE = `${BASE_URL}/tools/chmod-calculator`;

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PERM_SRC = readFileSync(join(REPO, "src/features/chmod-calculator/permissions.ts"), "utf8");
const COMPONENT_SRC = readFileSync(join(REPO, "src/features/chmod-calculator/ChmodCalculator.tsx"), "utf8");

const TOTAL_PRESETS = (/PRESETS = \[([^\]]*)\]/.exec(PERM_SRC)?.[1]?.match(/"/g) || []).length / 2;
const RESET_MODE = /applyPreset\("(\d+)"\)/.exec(COMPONENT_SRC)?.[1] ?? "";

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
const octalInput = () => tool().getByLabel("Octal mode, three digits such as 644");
const presetChips = () => tool().getByRole("button", { name: /^[0-7]{3}$/ });
const resetButton = () => tool().getByRole("button", { name: "Reset", exact: true });
const alertBox = () => tool().locator('[role="alert"]');
const statusRegion = () => tool().locator('[role="status"]');

const card = (heading) => tool().locator("div.rounded-xl.bg-white.border", { hasText: heading }).first();
const octValue = async () => (await card("Numeric / stat mode").locator("p.font-mono.text-2xl").textContent()) || "";
const symValue = async () => (await card("Symbolic").locator("p.font-mono.text-xl").textContent()) || "";
const chmodValue = async () => (await card("chmod style").locator("p.font-mono.text-sm").textContent()) || "";

async function settle(ms = 220) {
  await page.waitForTimeout(ms);
}

try {
  // =========================================================== the boot state ===
  section("the boot state is 755");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(500);
  check(page.url().includes("/use/chmod-calculator"), "the tool route renders", page.url());
  check(RESET_MODE === "755", "the shipped Reset target is 755", RESET_MODE);
  check(await octValue() === "755", "the octal card boots at 755", await octValue());
  check(await symValue() === "rwxr-xr-x", "the symbolic card boots at rwxr-xr-x", await symValue());
  check(await chmodValue() === "u=rwx,g=rx,o=rx", "the chmod style boots at u=rwx,g=rx,o=rx", await chmodValue());
  check((await octalInput().inputValue()) === "755", "the octal box agrees with the cards");
  check(TOTAL_PRESETS === 7, "the preset chip list has 7 entries", String(TOTAL_PRESETS));
  check((await presetChips().count()) === TOTAL_PRESETS, "all preset chips render", String(await presetChips().count()));
  check((await statusRegion().count()) >= 1, "a role=status live region exists");

  // =========================================================== toggling ===
  section("toggling updates all three outputs");
  const userExecute = tool().getByRole("checkbox").nth(2); // user r, w, x
  await userExecute.uncheck();
  await settle();
  check(await octValue() === "754", "removing owner execute makes 754", await octValue());
  check(await symValue() === "rw-r-xr-x", "the symbolic follows to rw-r-xr-x", await symValue());
  check(await chmodValue() === "u=rw,g=rx,o=rx", "the chmod style joins the symbols, no dashes", await chmodValue());
  check(!/(readwriteexecute|e)/.test(await chmodValue()), "chmod style spells r/w/x, never the id words", await chmodValue());
  await userExecute.check();
  await settle();
  check(await octValue() === "755", "re-checking restores 755");

  // =========================================================== a four-digit mode ===
  section("a valid octal keeps the bits");
  await octalInput().fill("644");
  await settle();
  check(await octValue() === "644", "typing 644 drives the octal card", await octValue());
  check(await symValue() === "rw-r--r--", "644 is rw-r--r--", await symValue());
  check(await chmodValue() === "u=rw,g=r,o=r", "644 chmod style is u=rw,g=r,o=r", await chmodValue());

  // =========================================================== the draft rule ===
  section("a draft is classified, not applied");
  await octalInput().fill("6");
  await settle();
  check((await tool().getByText(/1 of 3 digits/).count()) === 1, "one digit shows the draft hint");
  check(await octValue() === "644", "the cards still show the last complete value", await octValue());
  await octalInput().fill("648");
  await settle();
  check((await alertBox().count()) === 1, "648 is refused");
  check((await alertBox().textContent()).includes("8 and 9 do not exist"), "the refusal explains octal digits", (await alertBox().textContent()) || "");
  await octalInput().fill("755");
  await settle();
  check((await alertBox().count()) === 0, "the refusal clears on a valid value");
  check((await tool().getByText(/3 of 3 digits/).count()) === 0, "no draft hint once complete");

  // =========================================================== presets and reset ===
  section("presets and Reset");
  await tool().getByRole("button", { name: "777", exact: true }).click();
  await settle();
  check(await octValue() === "777", "the 777 preset applies", await octValue());
  check(await symValue() === "rwxrwxrwx", "the 777 preset shows rwxrwxrwx", await symValue());
  await resetButton().click();
  await settle();
  check(await octValue() === "755", "Reset returns to 755", await octValue());
  check(await symValue() === "rwxr-xr-x", "Reset restores the symbolic string");
  check((await octalInput().inputValue()) === "755", "the octal box returns to 755");

  // =========================================================== privacy ===
  section("nothing leaves the browser");
  check(offOrigin.length === 0, "no request went off-origin", offOrigin.join(", "));
  check(nonGet.length === 0, "no non-GET request was made", nonGet.join(", "));

  // =========================================================== the wider page ===
  section("the registry page and the sitemap");
  await page.goto(TOOL_PAGE, { waitUntil: "networkidle" });
  await settle(400);
  const toolPageText = (await page.textContent("body")) || "";
  check(/chmod Calculator|Permission/i.test(toolPageText), "the registry page names the tool");
  check(/rwxr-xr-x/.test(toolPageText), "the registry page shows the real symbolic form");
  check(!/setuid, setgid, and sticky bit support|handles special modes like setuid/i.test(toolPageText), "the registry page no longer claims special-bit support");
  check(!/warns? you|dangerous combinations/i.test(toolPageText), "the registry page no longer claims warnings");
  check(/setuid, setgid or the sticky bit/i.test(toolPageText), "the registry page discusses the special bits honestly (to rule them out)");
  const sm = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check(sm.ok(), "the sitemap responds", String(sm.status()));
  const smText = await sm.text();
  check(smText.includes("/tools/chmod-calculator"), "the registry page is in the sitemap");

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