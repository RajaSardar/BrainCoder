import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/word-counter`;

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
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(text)) consoleIssues.push(text);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const textarea = page.locator("textarea");
const status = page.locator("p[role='status'][aria-live='polite']");
const dd = () => page.locator("dl dd");
const clearBtn = () => page.locator("button", { hasText: "Clear" });

async function fill(v) {
  await textarea.fill(v);
  await page.waitForTimeout(300);
}

async function stats() {
  return (await dd().allTextContents()).map((t) => t.trim());
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  check((await textarea.count()) === 1, "single textarea present");
  check((await textarea.getAttribute("maxlength")) === "1000000", "textarea caps input at 1,000,000 characters");
  check((await status.textContent()).includes("Waiting for text"), "empty boot shows 'Waiting for text' status");
  check(await clearBtn().isDisabled(), "Clear disabled when empty");
  check((await stats()).every((t) => /^0(\.0)?( min)?$/.test(t)), "all nine stat cards show 0 on empty input");
  const taId = await textarea.getAttribute("id");
  check(taId !== null && (await page.locator(`label[for="${taId}"]`).count()) === 1, "textarea has a programmatic <label for>");

  await fill("Mr. Smith went home.");
  check((await stats())[3] === "1", "'Mr. Smith went home.' counts as 1 sentence");
  check((await stats())[0] === "4", "'Mr. Smith went home.' counts 4 words");

  await fill("Wait, 3.14 is pi.");
  check((await stats())[3] === "1", "decimal '3.14' doesn't split a sentence");
  check((await stats())[0] === "4", "'Wait, 3.14 is pi.' counts 4 words");

  await fill("Hi! Mr. Smith went 3.14 miles.");
  check((await stats())[3] === "2", "'Hi! Mr. Smith went 3.14 miles.' → 2 sentences");
  check((await stats())[0] === "6", "same string counts 6 words (decimals + abbreviations intact)");

  await fill("Use e.g. apples. v1.2.3 released.");
  check((await stats())[3] === "2", "'e.g.' and 'v1.2.3' don't fragment sentences");

  await fill("a. B. c");
  check((await stats())[3] === "2", "sentence fragments still count ('a. B. c' → 2)");

  await fill("!.!.");
  check((await stats())[0] === "0", "punctuation-only input counts 0 words");
  check((await stats())[3] === "0", "punctuation-only input counts 0 sentences");

  await fill("Hello - world");
  check((await stats())[0] === "2", "'Hello - world' counts 2 words (hyphen alone ignored)");

  await fill("😀🙂");
  check((await stats())[1] === "2", "emoji count as individual characters (2 code points)");

  await fill("hello Hello HELLO");
  check((await stats())[6] === "1", "case-insensitive unique words collapse 'hello Hello HELLO' → 1");
  await fill("don't don't");
  check((await stats())[6] === "1", "same contraction collapses to 1 unique word");

  await fill("a\nb\nc\nd");
  check((await stats())[5] === "4", "lines = newline segments (4)");
  await fill("a\nb\n\n\nc\n\nd");
  check((await stats())[4] === "3", "paragraphs = blank-line separated blocks (3)");

  await fill("state-of-the-art nation-state foo.bar");
  check((await stats())[0] === "3", "hyphenated + dotted tokens count as one word each");

  const filler = Array.from({ length: 40000 }, (_, i) => `word${i}`).join(" ");
  await textarea.fill(filler);
  await page.waitForTimeout(600);
  check((await stats())[0].replace(/,/g, "") === "40000", "40k-word paste resolves word count accurately");
  check(pageErrors.length === 0, "40k-word paste causes no page errors");

  await fill("hello");
  check((await status.textContent()).includes("1 word, 5 characters"), "status live-region announces '1 word, 5 characters'");
  check((await status.getAttribute("aria-live")) === "polite", "status region is live polite");

  const labels = (await page.locator("dl dt").allTextContents()).map((t) => t.trim());
  check(labels.includes("Reading time") && labels.includes("Speaking time") && labels.includes("Unique words"), "cards cover reading/speaking time and unique words");
  check((await page.locator("dl dd").first().getAttribute("class")).includes("text-indigo-600"), "stat values styled, dt/ORDER keeps label announced first");

  await clearBtn().click();
  await page.waitForTimeout(200);
  check((await textarea.inputValue()) === "", "Clear empties the textarea");
  check(await clearBtn().isDisabled(), "Clear disabled again after empty");

  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/word-counter`)) === 200, "/use/word-counter 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/word-counter`)) === 200, "/tools/word-counter 200");

  await page.goto(`${BASE_URL}/tools/word-counter`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(/1,000,000/.test(body), "marketing copy documents the 1,000,000-character limit");
  check(!/Works with any language|handles Chinese|multi-byte/i.test(body), "CJK word-count overclaim removed");
  check(/space-delimited/.test(body), "marketing copy honestly scopes word counting to spaced scripts");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 300)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);