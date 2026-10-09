// Production-Chrome e2e for "HTTP Status Codes".
//
// The promises this tool makes: the list covers the IANA-registered codes 1xx–5xx
// (plus 599 marked unofficial), search filters by number/name/description, the
// 1xx–5xx chips filter by class with the real per-class counts, WebDAV and newer
// codes carry the correct registered status, the 422/413 wording is the current
// RFC name, a role=status region announces the count (singular handled), and the
// copy claims only a reference — no cacheability, no common causes, no copy
// buttons, no clickable entries. Nothing leaves the tab.
//
//   node e2e/http-status-browser.mjs          # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/http-status-browser.mjs
//
// The orchestrator runs this twice against the same production build.

import { chromium } from "playwright-core";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/http-status`;
const TOOL_PAGE = `${BASE_URL}/tools/http-status`;
const GUIDE_PAGE = `${BASE_URL}/guides/http-status-codes-explained`;

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

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
const search = () => tool().getByLabel("Search HTTP status codes");
const chip = (name) => tool().getByRole("button", { name, exact: true });
const statusRegion = () => tool().locator('[role="status"]');
const emptyState = () => tool().getByText(/No HTTP status codes match/);
const cards = () => tool().locator("div.rounded-xl.border.border-slate-200.bg-white.p-4.flex.gap-3");
const unofficialBadges = () => tool().getByText("unofficial", { exact: true });

const cardCodes = async () =>
  (await cards().evaluateAll((els) => els.map((el) => (el.firstElementChild?.textContent || "").trim()))).filter(Boolean);

async function settle(ms = 200) {
  await page.waitForTimeout(ms);
}

try {
  // ===================================================== the boot state & labels ===
  section("the boot state and the controls");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(500);
  check(page.url().includes("/use/http-status"), "the tool route renders", page.url());
  check((await search().count()) === 1, "the search box has a real (sr-only) label");
  for (const name of ["1xx", "2xx", "3xx", "4xx", "5xx"]) {
    check((await chip(name).count()) === 1, `the ${name} chip is present`);
    check((await chip(name).getAttribute("aria-pressed")) === "false", `${name} starts unpressed`);
  }
  check((await chip("All").count()) === 1, "the All chip is present");
  check((await chip("All").getAttribute("aria-pressed")) === "true", "All starts pressed");
  check((await statusRegion().count()) >= 1, "a role=status live region exists");

  // ========================================================== the full reference ===
  section("the full reference renders five classes");
  const codes = await cardCodes();
  check(codes.length === 64, "64 status codes are listed", JSON.stringify(codes.length));
  for (const c of ["226", "305", "306", "421", "424", "208", "599", "418"]) {
    check(codes.includes(c), `code ${c} is present`);
  }
  for (const title of ["Informational", "Success", "Redirection", "Client error", "Server error"]) {
    check((await tool().getByText(title, { exact: true }).count()) >= 1, `the ${title} class header is shown`);
  }
  check((await unofficialBadges().count()) === 1, "exactly one code is tagged unofficial", String(await unofficialBadges().count()));
  check((await tool().getByText("Multi-Status", { exact: true }).count()) === 1, "207 Multi-Status is present and not tagged");
  check((await tool().getByText("Unprocessable Content", { exact: true }).count()) === 1, "422 shows its RFC 9110 name");
  check((await tool().getByText(/The request was well-formed but contained semantic errors/).count()) === 1, "the 422 description is fixed");
  check((await tool().getByText("Content Too Large", { exact: true }).count()) === 1, "413 shows its RFC 9110 name");

  // ================================================================== the chips ===
  section("the class chips filter, the search filters");
  await chip("4xx").click();
  await settle();
  const fourxx = await cardCodes();
  check(fourxx.length > 0 && fourxx.every((c) => c.startsWith("4")), "the 4xx chip shows only 4xx codes", JSON.stringify(fourxx.slice(0, 5)));
  check((await chip("4xx").getAttribute("aria-pressed")) === "true", "the 4xx chip reports pressed");
  check((await statusRegion().textContent()) === "29 status codes shown.", "the live region states the 4xx count", String(await statusRegion().textContent()));

  await chip("2xx").click();
  await settle();
  const twoxx = await cardCodes();
  check(twoxx.length === 10 && twoxx.every((c) => c.startsWith("2")), "the 2xx chip shows 10 codes", JSON.stringify(twoxx));

  await chip("All").click();
  await settle();
  check((await cardCodes()).length === 64, "All restores the full list");

  // ================================================================== the search ===
  section("search by number, name and description word");
  await search().fill("429");
  await settle();
  const s429 = await cardCodes();
  check(s429.length === 1 && s429[0] === "429", "searching 429 finds only 429", JSON.stringify(s429));
  check((await statusRegion().textContent()) === "1 status code shown.", "the live region handles the singular", String(await statusRegion().textContent()));
  check((await tool().getByText("Too Many Requests", { exact: true }).count()) === 1, "the 429 entry is named");

  await search().fill("redirect");
  await settle();
  const redir = await cardCodes();
  check(redir.length >= 2 && redir.every((c) => c.startsWith("3")), "searching 'redirect' finds only 3xx codes", JSON.stringify(redir));
  check(redir.includes("307") && redir.includes("308"), "Temporary and Permanent Redirect both match", JSON.stringify(redir));

  await search().fill("IM Used");
  await settle();
  const imUsed = await cardCodes();
  check(imUsed.length === 1 && imUsed[0] === "226", "searching the reason phrase finds IM Used", JSON.stringify(imUsed));
  check((await tool().getByText(/^1 status$/).count()) === 1, "a one-item class reads '1 status'");

  await search().fill("zzz");
  await settle();
  check((await cardCodes()).length === 0, "a nonsense query returns no cards");
  check((await emptyState().count()) === 1, "the empty state is shown");
  check((await statusRegion().textContent()) === "No status codes match.", "the live region announces the empty result", String(await statusRegion().textContent()));

  await search().fill("  ");
  await settle();
  check((await cardCodes()).length === 64, "clearing the search restores every code");

  // ========================================================================== privacy ===
  section("nothing leaves the browser");
  check(offOrigin.length === 0, "no request went off-origin", offOrigin.join(", "));
  check(nonGet.length === 0, "no non-GET request was made", nonGet.join(", "));

  // ===================================================================== the wider page ===
  section("the registry page, the guide and the sitemap");
  await page.goto(TOOL_PAGE, { waitUntil: "networkidle" });
  await settle(400);
  const toolPageText = (await page.textContent("body")) || "";
  check(/HTTP Status Code Lookup|HTTP Status Codes/i.test(toolPageText), "the registry page names the tool");
  check(/IANA/i.test(toolPageText), "the registry page names the IANA registry");
  check(/unofficial/i.test(toolPageText), "the registry page explains the unofficial tag");
  check(/RFC 4918/.test(toolPageText), "the registry page names RFC 4918 for WebDAV");
  check(!/cacheab/i.test(toolPageText), "the registry page makes no cacheability claim");
  check(!/Common causes/i.test(toolPageText), "the registry page makes no common-causes claim");
  check(!/copy button/i.test(toolPageText), "the registry page promises no copy button");
  check(!/click any status/i.test(toolPageText), "the registry page no longer says statuses are clickable");
  await page.goto(GUIDE_PAGE, { waitUntil: "networkidle" });
  await settle(300);
  const guideText = (await page.textContent("body")) || "";
  check(page.url().includes("/guides/http-status-codes-explained"), "the status-codes guide route renders");
  check(/4xx vs 5xx|Client or server/.test(guideText), "the guide explains the 4xx vs 5xx distinction");
  check(/499[^ ]|vendor/.test(guideText) || /not in the registry/.test(guideText), "the guide discloses vendor-specific codes");
  const sm = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check(sm.ok(), "the sitemap responds", String(sm.status()));
  const smText = await sm.text();
  check(smText.includes("/tools/http-status"), "the registry page is in the sitemap");
  check(smText.includes("/guides/http-status-codes-explained"), "the guide is in the sitemap");

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