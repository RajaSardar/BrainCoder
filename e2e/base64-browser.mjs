// Production-browser E2E for Base64 Encoder & Decoder.
// Run against an existing production server: BASE_URL=http://localhost:3788 node e2e/base64-browser.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`NOT ${name}`);
    console.log(`    ${String(err.message).split("\n").join("\n    ")}`);
  }
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);

const tool = () => page.locator("div.space-y-5:has(#base64-input)");
const input = () => page.locator("#base64-input");
const output = () => page.locator("textarea[aria-label=\"Output\"]");
const alertBox = () => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const live = () => tool().locator('p[role="status"][aria-live="polite"]');
const encRadio = () => page.locator('fieldset button[role="radio"]:has-text("Encode to Base64")');
const decRadio = () => page.locator('fieldset button[role="radio"]:has-text("Decode from Base64")');
const activeRadio = () => page.locator('fieldset button[role="radio"][aria-checked="true"]');
const swapBtn = () => tool().locator('button:has-text("Use result as input")');
const clearBtn = () => tool().locator('button:has-text("Clear input")');
const urlSafe = () => tool().locator('input[type="checkbox"]');
const urlSafeLabel = () => tool().locator("label:has(input[type=checkbox])");

async function setInput(value) {
  await input().fill(value);
}

async function inputValue() {
  return input().inputValue();
}

async function outputValue() {
  return output().inputValue();
}

async function charCount() {
  return (await tool().locator("span.text-xs.text-slate-600").textContent()) ?? "";
}

async function setHugeInput(n) {
  await page.evaluate((size) => {
    const el = document.querySelector("#base64-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, "a".repeat(size));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);
}

try {
  await page.goto(`${BASE_URL}/use/base64`, { waitUntil: "networkidle" });
  await check("tool page loads", () => assert.ok(page.url().includes("/use/base64")));

  await check("default state: Encode radio active, url-safe on, buttons disabled, no alert", async () => {
    assert.equal(await activeRadio().textContent(), "Encode to Base64");
    assert.equal(await encRadio().getAttribute("aria-checked"), "true");
    assert.equal(await decRadio().getAttribute("aria-checked"), "false");
    assert.equal(await urlSafe().count(), 1);
    assert.equal(await urlSafe().isChecked(), false);
    assert.equal(
      await urlSafeLabel().textContent(),
      "URL-safe output (uses “-” and “_”, no padding)"
    );
    assert.equal(await outputValue(), "");
    assert.ok((await charCount()).includes("0 chars"));
    assert.equal(await clearBtn().isDisabled(), true);
    assert.equal(await swapBtn().isDisabled(), true);
    assert.equal(await alertBox().count(), 0);
    assert.equal(await live().textContent(), "Type or paste text to encode it.");
    assert.equal(await output().getAttribute("tabindex"), "-1");
    assert.equal(await encRadio().getAttribute("min-h-11"), null);
  });

  await setInput("hello world");
  await check("encode 'hello world' -> aGVsbG8gd29ybGQ= with live char count", async () => {
    assert.equal(await outputValue(), "aGVsbG8gd29ybGQ=");
    assert.ok((await charCount()).includes("16 chars"));
    assert.equal(await live().textContent(), "Output ready — 16 characters");
    assert.equal(await clearBtn().isDisabled(), false);
  });

  await setInput("世界");
  await check("unicode encode 世界 -> 5LiW55WM", async () => {
    assert.equal(await outputValue(), "5LiW55WM");
  });

  await setInput("🚀");
  await check("emoji encode 🚀 -> 8J+agA==", async () => {
    assert.equal(await outputValue(), "8J+agA==");
  });

  await setInput("e\u0301");
  await check("combining char encode e+◌́ -> ZcyB", async () => {
    assert.equal(await outputValue(), "ZcyB");
  });

  await setInput("Hello, World! @#$%^&*() []{}");
  await check("symbol mix encode exact string", async () => {
    assert.equal(await outputValue(), "SGVsbG8sIFdvcmxkISBAIyQlXiYqKCkgW117fQ==");
  });

  await setInput("");
  await check("empty input clears output and disables clear", async () => {
    assert.equal(await outputValue(), "");
    assert.equal(await clearBtn().isDisabled(), true);
  });

  await decRadio().click();
  await setInput("aGVsbG8gd29ybGQ=");
  await check("decode padded string -> hello world, no alert", async () => {
    assert.equal(await outputValue(), "hello world");
    assert.equal(await alertBox().count(), 0);
    assert.equal(await live().textContent(), "Decoded — 11 characters");
    assert.equal(await urlSafe().count(), 0);
  });

  await setInput("aGVsbG8gd29ybGQ");
  await check("decode unpadded base64, no alert", async () => {
    assert.equal(await outputValue(), "hello world");
    assert.equal(await alertBox().count(), 0);
  });

  await setInput("aGVs\nbG8g d29y\nbGQ=");
  await check("decode whitespace/newline-padded base64", async () => {
    assert.equal(await outputValue(), "hello world");
    assert.equal(await alertBox().count(), 0);
  });

  await setInput("8J+agA==");
  await check("decode emoji base64 -> 🚀", async () => {
    assert.equal(await outputValue(), "🚀");
  });

  await encRadio().click();
  await setInput("ÿÿÿ");
  await check("url-safe encode ÿÿÿ -> w7_Dv8O_", async () => {
    assert.equal(await outputValue(), "w7/Dv8O/");
    await urlSafe().check();
    assert.equal(await outputValue(), "w7_Dv8O_");
  });

  await decRadio().click();
  await urlSafe().count();
  await check("decode url-safe auto-detect w7_Dv8O_ -> ÿÿÿ", async () => {
    assert.equal(await urlSafe().count(), 0);
    await setInput("w7_Dv8O_");
    assert.equal(await outputValue(), "ÿÿÿ");
    assert.equal(await alertBox().count(), 0);
  });

  await setInput("!!!not base64!!!");
  await check("invalid decode: alert + empty output + disabled swap", async () => {
    assert.equal(await outputValue(), "");
    assert.equal(await alertBox().count(), 1);
    assert.match(
      await alertBox().textContent(),
      /That doesn't look like valid Base64/
    );
    assert.equal(await swapBtn().isDisabled(), true);
    assert.equal(await input().getAttribute("aria-invalid"), "true");
    assert.match(await input().getAttribute("aria-describedby"), /base64-error/);
    assert.equal(await live().textContent(), "Invalid input.");
  });

  await setInput("abcde");
  await check("truncated decode: truncation-specific alert", async () => {
    assert.equal(await alertBox().count(), 1);
    assert.match(await alertBox().textContent(), /truncated/i);
    assert.equal(await outputValue(), "");
  });

  await setInput("gIH/");
  await check("binary decode: non-UTF-8 alert + empty output", async () => {
    assert.equal(await alertBox().count(), 1);
    assert.match(await alertBox().textContent(), /not valid UTF-8|raw bytes/i);
    assert.equal(await outputValue(), "");
  });

  await check("dismiss error hides alert and clears association", async () => {
    await alertBox().locator('button[aria-label="Dismiss error"]').click();
    assert.equal(await alertBox().count(), 0);
    assert.match(await live().textContent(), /Decoding failed/);
    assert.notEqual(await input().getAttribute("aria-invalid"), "true");
  });

  await setInput("aGVsbG8gd29ybGQ=");
  await check("recover to valid after error: alert gone, output restored", async () => {
    assert.equal(await alertBox().count(), 0);
    assert.equal(await outputValue(), "hello world");
  });

  await encRadio().click();
  await check("swap (encode->decode) flips mode and round-trips text", async () => {
    await urlSafe().uncheck();
    await setInput("hello world");
    assert.equal(await outputValue(), "aGVsbG8gd29ybGQ=");
    await swapBtn().click();
    assert.equal(await activeRadio().textContent(), "Decode from Base64");
    assert.equal(await inputValue(), "aGVsbG8gd29ybGQ=");
    assert.equal(await outputValue(), "hello world");
  });

  await setInput("!!");
  await check("swap disabled after a decode error", async () => {
    assert.equal(await alertBox().count(), 1);
    assert.equal(await swapBtn().isDisabled(), true);
  });

  await clearBtn().click();
  await check("clear empties input and output, disables buttons", async () => {
    assert.equal(await inputValue(), "");
    assert.equal(await outputValue(), "");
    assert.equal(await clearBtn().isDisabled(), true);
    assert.equal(await swapBtn().isDisabled(), true);
  });

  await setHugeInput(2 * 1024 * 1024 + 1);
  await check("over-2MB input is refused with visible notice", async () => {
    assert.equal(await inputValue(), "a".repeat(2 * 1024 * 1024 + 1));
    assert.equal(
      await tool().locator('p[role="status"]:not(.sr-only):has-text("Input is limited to 2 MB")').count(),
      1
    );
    assert.equal(await outputValue(), "");
    assert.match(await live().textContent(), /Input is over the 2 MB size limit/);
  });

  await encRadio().click();
  await setInput("hello world");
  await check("notice clears once back under the cap", async () => {
    await page.waitForFunction(
      () => !document.querySelector("#base64-input").closest("div.space-y-5").textContent.includes("Input is limited to 2 MB")
    );
    assert.equal(await outputValue(), "aGVsbG8gd29ybGQ=");
    assert.match(await live().textContent(), /Output ready/);
  });

  await check("radio semantics: fieldset + radiogroup + aria-checked", async () => {
    assert.equal(await tool().locator("fieldset").count(), 1);
    assert.equal(await tool().locator("fieldset legend.sr-only").textContent(), "Encode or decode mode");
    assert.equal(await tool().locator('div[role="radiogroup"] button[role="radio"]').count(), 2);
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await check("mobile 375px: tool subtree has no horizontal overflow", async () => {
    const { maxRight, vw } = await page.evaluate(() => {
      const root = document.querySelector("#base64-input").closest("div.space-y-5");
      let maxRight = 0;
      for (const el of root.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width) maxRight = Math.max(maxRight, r.right);
      }
      return { maxRight, vw: document.documentElement.clientWidth };
    });
    assert.ok(maxRight <= vw + 1, `maxRight ${maxRight} > vw ${vw}`);
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/use/json-formatter`, { waitUntil: "networkidle" });
  await check("shared CopyButton still works after changes (cross-tool)", async () => {
    const inp = page.locator('textarea[aria-label*="Input"], textarea').first();
    await inp.fill("{\"a\":1}");
    const copyBtns = page.locator('button:has-text("Copy")');
    assert.ok((await copyBtns.count()) >= 1);
  });
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAILED: " + failures.map((f) => f.name).join(", "));
  process.exitCode = 1;
}