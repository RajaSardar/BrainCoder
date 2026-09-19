import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/timestamp-converter`;

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
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(text)) {
    consoleIssues.push(text);
  }
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const tsInput = page.locator("input[aria-label='Unix timestamp value']");
const dateInput = page.locator("input[aria-label='Date and time in local timezone']");
const alerts = page.locator("p[role='alert']");
const statuses = page.locator("p[role='status']");
const cards = page.locator("div.rounded-xl.bg-slate-50");

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}
function localOf(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function utcOf(ms) {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

async function fillTimestamp(v) {
  await tsInput.fill(v);
  await page.waitForTimeout(250);
}
async function cardValue(label) {
  await page.waitForTimeout(150);
  for (let i = 0; i < (await cards.count()); i++) {
    const el = cards.nth(i);
    const t = await el.locator("p").first().textContent();
    if ((t || "").startsWith(label)) {
      return el.locator("p.font-mono").textContent();
    }
  }
  return null;
}

async function g(uri) {
  return await page.evaluate((u) => fetch(u).then((r) => r.status), uri);
}

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

try {
  // --- hydration + boot ---
  check(
    await tsInput.evaluate((el) => /^\d+$/.test(el.value) && el.value.length === 10),
    "boot auto-fills current 10-digit seconds after mount"
  );
  check((await cards.count()) === 4, "boot renders 4 result cards");
  check(
    ((await page.locator("p.font-mono").allTextContents()).some((t) => /^Current Unix time: \d{10}$/.test(t.trim()))),
    "live current Unix time line rendered"
  );

  // --- seconds conversion (TZ from machine clock, computed in Node) ---
  await fillTimestamp("1725000000");
  const exp = 1725000000 * 1000;
  check((await cardValue("Local time")) === localOf(exp), "local time card correct");
  check((await cardValue("UTC time")) === "2024-08-30 06:40:00 UTC", "UTC card correct");
  check((await cardValue("ISO 8601")) === "2024-08-30T06:40:00.000Z", "ISO 8601 card correct");
  check((await cardValue("HTTP date")) === "Fri, 30 Aug 2024 06:40:00 GMT", "HTTP date (RFC 2822) card correct");
  check((await cards.count()) === 4 && !(await cards.nth(0).textContent()).includes("does-not-matter"), "cards grid renders");

  // --- 13-digit ms auto-detect (checkbox off) ---
  await fillTimestamp("1725000000000");
  check((await cardValue("ISO 8601")) === "2024-08-30T06:40:00.000Z", "13-digit value auto-detected as ms (same instant)");
  check(
    ((await page.locator("p[role='status']").allTextContents()).some((t) => /13-digit value detected/.test(t))),
    "auto-detect hint shown via role=status"
  );

  // --- explicit milliseconds with seconds-length value (checkbox override) ---
  await page.locator("label").filter({ hasText: "milliseconds" }).locator("input[type='checkbox']").check();
  await fillTimestamp("1725000000");
  check((await cardValue("ISO 8601")) === "1970-01-20T23:10:00.000Z", "explicit ms checkbox overrides seconds reading");
  await page.locator("label").filter({ hasText: "milliseconds" }).locator("input[type='checkbox']").uncheck();
  await fillTimestamp("1725000000");
  check((await cardValue("ISO 8601")) === "2024-08-30T06:40:00.000Z", "unchecking restores seconds reading");

  // --- float and negative (pre-1970) ---
  await fillTimestamp("1725000000.5");
  check((await cardValue("ISO 8601")) === "2024-08-30T06:40:00.500Z", "float seconds accepted");
  await fillTimestamp("-100");
  check((await cardValue("ISO 8601")) === "1969-12-31T23:58:20.000Z", "negative (pre-1970) seconds accepted");

  // --- crash guard: out-of-range + boundary + non-numeric ---
  await fillTimestamp("8640000000000000");
  check((await cardValue("ISO 8601")) === "+275760-09-13T00:00:00.000Z", "boundary value 8.64e15 ms converts (no crash)");
  await fillTimestamp("8640000000000001");
  check((await alerts.count()) >= 1, "one ms over boundary shows invalid alert");
  check((await cards.count()) === 0, "cards hidden on invalid input");
  await fillTimestamp("99999999999999999999999");
  check((await alerts.count()) >= 1, "oversized integer shows invalid alert");
  await fillTimestamp("1e309");
  check((await alerts.count()) >= 1, "exponent input rejected with alert");
  await fillTimestamp("abc");
  check((await alerts.count()) >= 1, "non-numeric input shows alert");
  check((await tsInput.count()) === 1, "tool still mounted after invalid inputs (no crash)");
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- reverse: char-by-char keyboard typing survives ---
  await tsInput.fill("0");
  await page.waitForTimeout(200);
  await dateInput.click();
  await page.evaluate(() => {
    const el = document.querySelector("input[aria-label='Date and time in local timezone']");
    el.focus();
    el.select();
  });
  await page.keyboard.press("Backspace");
  for (const ch of "2024-01-05 10:30:00") {
    await page.keyboard.insertText(ch);
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(150);
  check((await dateInput.inputValue()) === "2024-01-05 10:30:00", "typed date draft not clobbered while typing");
  const wantSecs = String(Math.floor(new Date(2024, 0, 5, 10, 30, 0).getTime() / 1000));
  check((await tsInput.inputValue()) === wantSecs, "forward timestamp commits from typed local datetime");

  // --- reverse: date-only = local midnight ---
  await fillTimestamp("0");
  await dateInput.fill("2024-01-05");
  await page.waitForTimeout(150);
  const midSecs = String(Math.floor(new Date(2024, 0, 5).getTime() / 1000));
  check((await tsInput.inputValue()) === midSecs, "date-only parses as local midnight");

  // --- reverse: invalid dates rejected without clobbering forward ---
  await dateInput.fill("2021-02-29");
  await page.waitForTimeout(150);
  check((await alerts.count()) >= 1, "invalid leap day shows date alert");
  check((await tsInput.inputValue()) === midSecs, "forward timestamp unchanged on invalid date");
  await dateInput.fill("2024-02-29");
  await page.waitForTimeout(150);
  const leapSecs = String(Math.floor(new Date(2024, 1, 29).getTime() / 1000));
  check((await tsInput.inputValue()) === leapSecs, "valid leap day commits");

  // --- reverse: round-trip through local card ---
  await fillTimestamp("1725000000");
  const loc = await cardValue("Local time");
  await dateInput.fill(loc.trim());
  await page.waitForTimeout(150);
  check((await tsInput.inputValue()) === "1725000000", "round-trip local card text returns same timestamp");

  // --- Now button resets to live seconds and clears ms ---
  await page.locator("label").filter({ hasText: "milliseconds" }).locator("input[type='checkbox']").check();
  await fillTimestamp("1725000000");
  await page.locator("button").filter({ hasText: "Now" }).click();
  await page.waitForTimeout(200);
  const nowVal = await tsInput.inputValue();
  const nowSec = Math.floor(Date.now() / 1000);
  check(nowVal.length === 10 && Math.abs(nowSec - Number(nowVal)) < 3, "Now sets near-current seconds");
  const msBox = await page.locator("label").filter({ hasText: "milliseconds" }).locator("input[type='checkbox']").isChecked();
  check(msBox === false, "Now clears the ms checkbox");

  // --- live tick advances ---
  const tickText = async () =>
    (await page.locator("p.font-mono").allTextContents()).find((t) => /^Current Unix time: /.test(t.trim())) || "";
  const t1 = await tickText();
  await page.waitForTimeout(2500);
  const t2 = await tickText();
  check(t1 !== t2 && t1 !== "", "current Unix time ticks forward");

  // --- copy buttons ---
  const copyBtns = page.locator("button").filter({ hasText: "Copy" });
  check((await copyBtns.count()) === 4, "4 copy buttons for 4 cards");
  const expectedLocal = await cardValue("Local time");
  await copyBtns.first().click();
  await page.waitForTimeout(300);
  const clipText = await page.evaluate(() =>
    navigator.clipboard.readText().catch((e) => "ERR:" + e.name)
  );
  check(clipText === expectedLocal.trim(), "clicking copy writes the card value to the clipboard");

  // --- a11y scaffolding ---
  check((await tsInput.getAttribute("aria-label")) === "Unix timestamp value", "timestamp input has aria-label");
  check((await dateInput.getAttribute("aria-label")) === "Date and time in local timezone", "date input has aria-label");
  await fillTimestamp("oops");
  check((await tsInput.getAttribute("aria-invalid")) !== null, "timestamp input exposes aria-invalid");
  check((await alerts.count()) >= 1, "role=alert present for validation");
  await fillTimestamp("1725000000");

  // --- marketing page + routing ---
  check((await g(`${BASE_URL}/use/timestamp-converter`)) === 200, "route /use/timestamp-converter 200");
  check((await g(`${BASE_URL}/tools/timestamp-converter`)) === 200, "route /tools/timestamp-converter 200");

  await page.goto(`${BASE_URL}/tools/timestamp-converter`, { waitUntil: "networkidle" });
  check(
    (await page.locator("body").textContent()).includes("275,760"),
    "marketing page mentions corrected 2038 wording"
  );

  // --- final: no hydration mismatch across entire session ---
  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors final (got ${pageErrors.length})`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);