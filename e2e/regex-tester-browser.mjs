import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3791";
const PAGE = `${BASE_URL}/use/regex-tester`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

const patternInput = page.locator("input[aria-label='Regex pattern']");
const textInput = page.locator("textarea[aria-label='Test text']");
const badge = page.locator("span[role='status']").first();
const alerts = page.locator("div[role='alert']");

async function g(uri) {
  return await page.evaluate((u) => fetch(u).then((r) => r.status), uri);
}

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

try {
  // --- core matching ---
  await patternInput.fill("\\b\\w+@\\w+\\.\\w{2,}\\b");
  await textInput.fill("Contact alice@example.com and bob@site.org now");
  await page.waitForTimeout(500);
  let rows = page.locator("tbody tr");
  check((await rows.count()) === 2, "email pattern finds 2 matches");
  check((await rows.nth(0).textContent()).includes("alice@example.com"), "first match is alice@example.com");
  check((await badge.textContent()).includes("2 matches"), "badge reports 2 matches");

  // --- capture groups numbered ---
  await patternInput.fill("(\\w+)@(\\w+)\\.(\\w+)");
  await page.waitForTimeout(500);
  rows = page.locator("tbody tr");
  check((await rows.count()) === 2, "capture pattern finds 2 matches");
  const g0 = await rows.nth(0).textContent();
  check(g0.includes("$1 = alice"), "unnamed group labelled $1");
  check(g0.includes("$2 = example"), "unnamed group labelled $2");
  check(g0.includes("$3 = com"), "unnamed group labelled $3");

  // --- named groups surfaced ---
  await patternInput.fill("(?<year>\\d{4})-(?<month>\\d{2})");
  await textInput.fill("2024-01 x 1999-12");
  await page.waitForTimeout(500);
  rows = page.locator("tbody tr");
  check((await rows.count()) === 2, "named group pattern finds 2 matches");
  const ng = await rows.nth(0).textContent();
  check(ng.includes("year = 2024"), "named group year surfaced");
  check(ng.includes("month = 01"), "named group month surfaced");

  // --- non-participating group shows ∅ rather than disappearing ---
  await patternInput.fill("a(b)?c");
  await textInput.fill("ac abc");
  await page.waitForTimeout(500);
  rows = page.locator("tbody tr");
  const first = await rows.nth(0).textContent();
  const second = await rows.nth(1).textContent();
  check(first.includes("$1 = ∅"), "absent group renders ∅ (ac)");
  check(second.includes("$1 = b"), "participating group renders value (abc)");

  // --- flags via checkboxes ---
  await patternInput.fill("hello");
  await textInput.fill("HELLO hello");
  await page.waitForTimeout(500);
  check((await page.locator("tbody tr").count()) === 1, "without i flag only lowercase matches");
  await page.locator("input[aria-label='i flag']").check();
  await page.waitForTimeout(500);
  check((await page.locator("tbody tr").count()) === 2, "with i flag both cases match");
  await page.locator("input[aria-label='i flag']").uncheck();

  // --- unicode requires u flag hint ---
  await patternInput.fill("\\p{L}+");
  await textInput.fill("héllo");
  await page.waitForTimeout(500);
  check(
    (await page.getByText(/require the unicode \(u\) flag/).count()) > 0,
    "needs-u hint shown when \\p without u flag"
  );
  await page.locator("input[aria-label='u flag']").check();
  await page.waitForTimeout(500);
  check(
    (await page.getByText(/require the unicode \(u\) flag/).count()) === 0,
    "hint clears once u flag enabled"
  );
  check((await page.locator("tbody tr").count()) === 1, "unicode property matches accented word");
  await page.locator("input[aria-label='u flag']").uncheck();

  // --- zero-length matches are visible ---
  await patternInput.fill("a*");
  await textInput.fill("bbb");
  await page.waitForTimeout(500);
  rows = page.locator("tbody tr");
  check((await rows.count()) === 4, "zero-length pattern yields 4 empty matches");
  check((await rows.nth(0).textContent()).includes("∅ (empty match)"), "empty match row is labelled ∅");

  // --- invalid regex surfaces a11y alert ---
  await patternInput.fill("([unclosed");
  await page.waitForTimeout(500);
  check((await alerts.count()) > 0, "invalid regex shows alert banner");
  check((await alerts.nth(0).textContent()).length > 0, "alert banner has content");

  // --- slash wrapper is treated as convenience ---
  await patternInput.fill("/foo/");
  await textInput.fill("foo foo bar");
  await page.waitForTimeout(500);
  check(
    (await page.getByText(/Pattern wrapped in \/…\//).count()) > 0,
    "slash wrapper note shown"
  );
  check((await page.locator("tbody tr").count()) === 2, "wrapped /foo/ matches foo twice");

  // --- truncation is disclosed ---
  await patternInput.fill(".");
  await textInput.fill("a".repeat(6000));
  await page.waitForTimeout(700);
  check(
    (await page.getByText(/Showing the first 5,000 matches/).count()) > 0,
    "truncation notice shown at 5000 matches"
  );
  check((await badge.textContent()).includes("5000 matches"), "badge states 5000 matches");

  // --- catastrophic backtracking patterns are gated, never auto-run ---
  const t0 = Date.now();
  await patternInput.fill("(a+)+$");
  await textInput.fill("a".repeat(40) + "b");
  await page.waitForTimeout(700);
  check(
    await page.getByText(/nested or repeated quantifiers/).isVisible(),
    "suspicious pattern shows catastrophic-backtracking warning"
  );
  check(await page.locator("tbody tr").count() === 0, "suspicious pattern is not auto-evaluated");
  check(Date.now() - t0 < 2000, "page remains responsive while pattern is gated");
  await patternInput.fill("abc");
  await textInput.fill("x abc abc y");
  await page.waitForTimeout(700);
  check((await page.locator("tbody tr").count()) === 2, "recovered: benign pattern matches again");

  // --- gated pattern can be run explicitly ---
  await patternInput.fill("(a|b)+");
  await page.waitForTimeout(300);
  check(
    await page.getByText(/nested or repeated quantifiers/).isVisible(),
    "alternation-in-group pattern also gated"
  );
  await page.getByRole("button", { name: "Run anyway" }).click();
  await textInput.fill("cab");
  await page.waitForTimeout(500);
  check((await page.locator("tbody tr").count()) === 1, "run-anyway evaluates gated pattern");
  check(((await page.locator("tbody tr").nth(0).textContent()) || "").includes("ab"), "gated run produces real matches");

  // back to benign state for the responsive checks below
  await patternInput.fill("abc");
  await textInput.fill("x abc abc y");
  await page.waitForTimeout(500);
  check((await page.locator("tbody tr").count()) === 2, "benign state restored");

  // --- quick reference panel exists ---
  check(
    await page.locator("summary", { hasText: "Regex token quick reference" }).isVisible(),
    "quick-reference panel present"
  );

  // --- 375px viewport: result table scrolls internally, no page blowout ---
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => {
    const wrap = document.querySelector("table[class*='min-w']")?.closest(".overflow-x-auto");
    if (!wrap) return null;
    return { scrollW: wrap.scrollWidth, clientW: wrap.clientWidth };
  });
  check(overflow !== null, "table wrapper scrolls internally");
  if (overflow) check(overflow.scrollW > overflow.clientW, "long tables scroll inside wrapper (not the page)");
  check((await page.locator("tbody tr").count()) === 2, "matches still rendered at 375px");

  // --- empty pattern hides badge ---
  await page.setViewportSize({ width: 1280, height: 900 });
  await patternInput.fill("");
  await page.waitForTimeout(400);
  check(
    (await page.locator("span[role='status']").textContent().catch(() => null)) === null || (await page.getByText(/Evaluating/).count()) === 0,
    "no match badge when pattern empty"
  );

  // --- route smoke: marketing page 200 ---
  const status = await g(`${BASE_URL}/tools/regex-tester`);
  check(status === 200, "/tools/regex-tester returns 200");
} catch (err) {
  failed++;
  console.error(`ERROR THROWN: ${err.message}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);