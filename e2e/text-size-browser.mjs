import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3790";
const PAGE = `${BASE_URL}/use/text-size-calculator`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
  viewport: { width: 1280, height: 900 },
});
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

const input = page.locator("textarea[aria-label='Text to measure']");
const jsonArea = page.locator("textarea[aria-label='Beautified JSON output']");
const minarea = page.locator("textarea[aria-label='Minified JSON output']");

async function card(label) {
  return await page
    .locator("div.rounded-xl.bg-white")
    .filter({ has: page.locator(`text=${label}`) })
    .first()
    .textContent();
}

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

try {
  // 1: empty state — 0 bytes, no transforms shown
  const empty = await card("Bytes (UTF-8)");
  check(empty.includes("0 B"), "empty input shows 0 B bytes");
  check((await jsonArea.count()) === 0, "no JSON output when empty");
  check((await minarea.count()) === 0, "no minified output when empty");

  // 2: ASCII size — "hello" is 5 bytes UTF-8 and UTF-16
  await input.fill("hello");
  await page.waitForTimeout(300);
  let c = await card("Bytes (UTF-8)");
  check(c.includes("5.0 B"), "ASCII 'hello' measures 5 bytes UTF-8");
  check(c.includes("5 raw"), "'hello' shows raw byte count");
  c = await card("Characters");
  check(c.includes("5"), "'hello' counts 5 characters");

  // 3: emoji — 😀 is 4 bytes UTF-8, 1 code point, 2 UTF-16 units
  await input.fill("😀");
  await page.waitForTimeout(300);
  c = await card("Bytes (UTF-8)");
  check(c.includes("4.0 B"), "emoji measures 4 bytes UTF-8");
  c = await card("Characters");
  check(c.includes("1"), "emoji counts as 1 code point");
  c = await card("Bytes (UTF-16)");
  check(c.includes("4.0 B"), "emoji measures 4 bytes UTF-16");

  // 4: whitespace exclusion — "a b c" → 3 chars, 3 bytes without spaces
  await input.fill("a b c");
  await page.waitForTimeout(300);
  const excl = page.locator("input[aria-label='Exclude whitespace from size']");
  await excl.check();
  await page.waitForTimeout(300);
  c = await card("Bytes (UTF-8)");
  check(c.includes("3.0 B"), "exclude whitespace: 'a b c' → 3 bytes");
  c = await card("Characters");
  check(c.includes("3"), "exclude whitespace: 'a b c' → 3 chars");
  await excl.uncheck();

  // 5: JSON detection → valid, beautify + minify right
  await input.fill('{"a": 1, "b": [1, 2, 3]}');
  await page.waitForTimeout(400);
  check(
    (await page.locator("text=Valid JSON").count()) >= 1,
    "valid JSON detected"
  );
  check(
    (await jsonArea.inputValue()).includes('"a": 1'),
    "beautified output shows pretty structure"
  );
  const min = await minarea.inputValue();
  check(min === '{"a":1,"b":[1,2,3]}', "minified output strips whitespace exactly");
  check(
    (await page.locator("text=/smaller/").count()) >= 1,
    "size reduction shown"
  );

  // 6: invalid JSON that looks like JSON → error banner
  await input.fill('{"a": ');
  await page.waitForTimeout(400);
  check((await page.locator("text=Invalid JSON").count()) >= 1, "malformed JSON flagged");
  check((await page.locator('[role="alert"]').count()) >= 1, "error banner announced");

  // 7: non-JSON text → honest note + whitespace-collapse preview
  await input.fill("hello\n  world\n");
  await page.waitForTimeout(400);
  check(
    (await page.locator("text=Approx. minify").count()) === 1,
    "non-JSON shows explicit approx-minify section"
  );
  check(
    (await page.locator("text=No whitespace to collapse").count()) === 0,
    "collapsible whitespace detected"
  );

  // 8: sample + clear buttons.
  await page.click("button:has-text('Sample')");
  await page.waitForTimeout(400);
  check(
    (await page.locator("text=Valid JSON").count()) >= 1,
    "sample text is valid JSON"
  );
  await page.click("button:has-text('Clear')");
  await page.waitForTimeout(300);
  check((await input.inputValue()) === "", "Clear empties the input");

  // 9: CRLF note via file upload (browsers normalize CRLF→LF in a pasted textarea)
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const tmp = path.join(os.tmpdir(), `bc-textsize-${Date.now()}.txt`);
  fs.writeFileSync(tmp, "a\r\nb"); // 4 bytes on disk
  await page.setInputFiles('input[aria-label="Open a text file"]', tmp);
  await page.waitForTimeout(500);
  check(
    (await page.locator("text=CRLF line endings detected").count()) === 1,
    "CRLF hint shown for CRLF file"
  );
  check(
    (await page.locator("text=/on disk/").count()) === 1,
    "file on-disk size chip shown"
  );
  c = await card("Bytes (UTF-8)");
  check(c.includes("4.0 B"), "CRLF file counts its 4 UTF-8 bytes (CR not stripped)");
  fs.rmSync(tmp, { force: true });
} catch (err) {
  failed++;
  console.error("HARNESS ERROR:", err.message);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);