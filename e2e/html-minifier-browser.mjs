import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/html-minifier`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
const notes = [];

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

const input = page.locator("textarea[aria-label='HTML input']");
const output = page.locator("textarea[aria-label='Minified output']");
const status = page.locator("p[role='status']");

async function minify(text) {
  await input.fill(text);
  await page.waitForTimeout(250);
  return await output.inputValue();
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });

  // --- sample: pre / script-blocks preserved, comments removed ---
  let html = await output.inputValue();
  check(html.includes("keep    this   spacing"), "pre whitespace preserved through minify");
  check(html.includes("this string must survive"), "script content (with <!-- string) preserved");
  check(!html.includes("a comment that will be removed"), "plain comment removed by default");
  check(!html.includes("[if lt IE 9]"), "conditional comment removed by default");

  // --- toggle keep-conditional ---
  const keepCb = page.locator('input[type="checkbox"][class*="accent"]');
  await keepCb.check();
  await page.waitForTimeout(250);
  html = await output.inputValue();
  check(html.includes("<!--[if lt IE 9]>"), "conditional comment preserved when option on");
  await keepCb.uncheck();
  await page.waitForTimeout(250);

  // --- structural invariants (attr values, gt, inline spacing) ---
  check((await minify('<div  class="a  b" >x</div>')) === '<div class="a  b">x</div>', "tag spacing collapses (attr value kept, spaces around > dropped)");
  check((await minify('<p>a > b</p>')) === '<p>a > b</p>', "greater-than in text preserved");
  check((await minify("<b>$50</b> <i>per unit</i>")) === "<b>$50</b> <i>per unit</i>", "one space kept between inline elements");
  check((await minify("<div>a</div>\n<div>b</div>")) === "<div>a</div><div>b</div>", "inter-block whitespace collapsed");
  check((await minify('<script>const s = "  double  spaces  ";</script>')) === '<script>const s = "  double  spaces  ";</script>', "script content never rewritten");
  check((await minify("<pre>  a   b  </pre>")) === "<pre>  a   b  </pre>", "pre content never rewritten");
  check((await minify("<textarea>  x  </textarea>")) === "<textarea>  x  </textarea>", "textarea content never rewritten");
  check((await minify("<!--[if IE]><p>legacy</p><![endif]-->")) === "", "conditional comment dropped when option off");

  // --- unit cases ported from the Node scanner suite ---
  check((await minify('<img src="a.png" alt="x y">')) === '<img src="a.png" alt="x y">', "self-closing void stays intact");
  check((await minify("<b>a</b> <b>c</b>")) === "<b>a</b> <b>c</b>", "adjacent inline elements keep their separating space");
  check((await minify("<div>\ntext\n</div>")) === "<div>text</div>", "text-only element collapses to its text");
  check((await minify('<p title="&gt; &amp;">x</p>')) === '<p title="&gt; &amp;">x</p>', "entities in attributes preserved");
  check((await minify("<ul>\n<li a>1</li>\n<li a>2</li>\n</ul>")) === "<ul><li a>1</li><li a>2</li></ul>", "option tag collapse preserves attribute-less li structure");

  // --- byte stats (checked in minify mode on the sample, where savings exist) ---
  const statusText = await status.textContent();
  check(/[KM]?B[^S]/.test(statusText || ""), "formatted byte size in status");
  check((statusText || "").includes("−"), "savings shown with minus sign in minify mode");
  check((await status.getAttribute("aria-live")) === "polite", "status region has aria-live");

  // --- beautify mode (fresh input so assertions are isolated) ---
  await input.fill("<div><p>a</p><br>b</div>");
  await page.waitForTimeout(250);
  await page.locator("button", { hasText: "Pretty-print" }).click();
  await page.waitForTimeout(250);
  let pretty = await page.locator("textarea[aria-label='Formatted output']").inputValue();
  check(pretty.includes("\n  <p>") && pretty.includes("</p>\n  <br>"), "block children indented in beautify");
  check(pretty.includes("  <br>\n  b") && !pretty.includes("<br>\n    "), "void br never deep-indents following text");

  // --- download ---
  await page.locator("button", { hasText: "Minify" }).click();
  await page.waitForTimeout(250);
  const dl = page.waitForEvent("download", { timeout: 5000 }).then(
    (d) => d.suggestedFilename(),
    () => null,
  );
  await page.locator("button", { hasText: "Download .html" }).click();
  const dlName = await dl;
  check(dlName === "minified.html", "download uses minified.html filename");
  check((await page.locator("button", { hasText: "Minify" }).getAttribute("aria-pressed")) === "true", "active mode exposes aria-pressed");

  // --- empty output guards buttons ---
  await input.fill("");
  await page.waitForTimeout(250);
  check(await page.locator("button", { hasText: "Copy" }).isDisabled(), "Copy disabled when no output");
  check(await page.locator("button", { hasText: "Download" }).isDisabled(), "Download disabled when no output");

  // --- a11y scaffolding ---
  check((await input.getAttribute("aria-label")) === "HTML input", "input has aria-label");
  check((await page.locator('label[for="html-minifier-file"]').count()) === 1, "Open .html label wired to file input");

  // --- routing ---
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/html-minifier`)) === 200, "/use/html-minifier 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/html-minifier`)) === 200, "/tools/html-minifier 200");

  await page.goto(`${BASE_URL}/tools/html-minifier`, { waitUntil: "networkidle" });
  const mkBody = await page.locator("body").textContent();
  check(mkBody.includes("byte and character sizes"), "marketing copy documents honest byte-level metrics");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 300)}`);
  notes.push(String(e));
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (notes.length) console.log(notes.join("\n"));
process.exit(failed === 0 ? 0 : 1);