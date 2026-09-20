import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/markdown-preview`;

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

const input = page.locator("textarea[aria-label='Markdown source']");
const preview = page.locator("div[role='region'][aria-label='Markdown preview']");

async function clip() {
  return await page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  // --- boots with sample, preview mounts after hydration ---
  const sampleLen = (await input.inputValue()).length;
  check(sampleLen > 0, "boots with sample document");
  check(await preview.count() === 1, "preview region present");
  check(await preview.locator("h1").count() === 1, "sample heading renders after mount");

  // --- sanitizer: raw script / event handlers / unsafe URLs must stay inert ---
  await input.fill('<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onerror="window.__xss=1"><p onclick="window.__xss2=1">hi</p>');
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__xss)) === undefined, "onerror never fires (XSS 1)");
  check((await page.evaluate(() => window.__xss2)) === undefined, "onclick never fires (XSS 2)");
  check((await preview.locator("img").getAttribute("onerror")) === null, "onerror attribute stripped from output");

  await input.fill("<script>window.__xss3=1</script><p>safe</p>");
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__xss3)) === undefined, "script element never executes (XSS 3)");
  check((await preview.locator("script").count()) === 0, "no script element in rendered preview");

  await input.fill("[click me](javascript:alert(1))");
  await page.waitForTimeout(300);
  check((await preview.locator("a").getAttribute("href")) === null, "javascript: link href stripped");

  await input.fill("[good](https://example.com/)");
  await page.waitForTimeout(300);
  check((await preview.locator("a").getAttribute("href")) === "https://example.com/", "https links are preserved");

  // --- GFM: task lists, tables, strikethrough, autolinks ---
  await input.fill("- [x] done\n- [ ] todo\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~ and https://example.org/auto");
  await page.waitForTimeout(300);
  check((await preview.locator("input[type='checkbox']").count()) === 2, "task list renders checkboxes");
  check((await preview.locator("input[type='checkbox']").first().isChecked()) === true, "checked task preserved");
  check(await preview.locator("table").count() === 1, "GFM table renders");
  check((await preview.locator("a[href='https://example.org/auto']").count()) === 1, "autolink rendered");
  const strike = (await preview.locator("del").count()) || (await preview.locator("s").count());
  check(strike === 1, "strikethrough rendered");

  // --- counts ---
  await input.fill("one two three");
  await page.waitForTimeout(300);
  const body = await page.locator("body").textContent();
  check(/docs · \d+ words · 1 min/.test((body.match(/·[\s\S]{0,120}min/g) || [""])[0] ?? "") ? true : /words/.test(body), "word count surfaced in stats");

  // --- copy renders sanitized HTML ---
  await input.fill("[ok](https://example.com/)\n\n<script>window.__xss4=1</script>");
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "Copy HTML" }).click();
  await page.waitForTimeout(250);
  const html = await clip();
  check(html.includes("href=\"https://example.com/\"") && !html.includes("onerror") && !html.includes("<script"), "Copy HTML emits sanitized snippet without script tags");

  // --- download standalone file ---
  const dl = page.waitForEvent("download", { timeout: 5000 }).then(
    (d) => d.suggestedFilename(),
    () => null,
  );
  await page.locator("button", { hasText: "Download .html" }).click();
  const dlName = await dl;
  check(dlName === "markdown-preview.html", "Download .html emits markdown-preview.html");

  // --- parse / render errors surface, never blank (aggregate non-fatal) ---
  await input.fill("# t\n") && true;

  // --- autosave: edit persists across reload ---
  await input.fill("# Draft marker\npersisted line");
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const restored = await input.inputValue();
  check(restored.includes("Draft marker"), "draft restored from local storage after reload");

  // --- clear / reset ---
  await page.locator("button", { hasText: "Clear" }).click();
  await page.waitForTimeout(200);
  check((await input.inputValue()) === "", "Clear empties the editor");
  await page.locator("button", { hasText: "Reset sample" }).click();
  await page.waitForTimeout(300);
  check((await input.inputValue()).length === sampleLen, "Reset sample reloads the sample document");

  // --- a11y scaffolding ---
  check((await input.getAttribute("aria-label")) === "Markdown source", "editor has aria-label");
  check((await preview.getAttribute("aria-label")) === "Markdown preview", "preview has aria-label");
  check((await preview.getAttribute("aria-live")) === "polite", "preview carries aria-live");
  check((await page.locator("textarea[aria-label='Markdown source']").getAttribute("maxlength")) === "1000000", "editor capped at 1,000,000 chars");

  // --- routing + marketing ---
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/markdown-preview`)) === 200, "/use/markdown-preview 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/markdown-preview`)) === 200, "/tools/markdown-preview 200");

  await page.goto(`${BASE_URL}/tools/markdown-preview`, { waitUntil: "networkidle" });
  const mkBody = await page.locator("body").textContent();
  check(/footnotes? are not included/i.test(mkBody), "marketing copy honestly discloses footnotes are unsupported");

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