// Production-browser E2E for JSON Formatter.
// Run against an existing production server: BASE_URL=http://localhost:3788 node e2e/json-formatter-browser.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";

const INPUT = '{"hello":"world","nested":[1,2,3]}';
const FORMATTED_2 = '{\n  "hello": "world",\n  "nested": [\n    1,\n    2,\n    3\n  ]\n}';
const FORMATTED_4 = '{\n    "hello": "world",\n    "nested": [\n        1,\n        2,\n        3\n    ]\n}';
const MINIFIED = '{"hello":"world","nested":[1,2,3]}';

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

async function setInput(value) {
  await page.locator('textarea[aria-label="JSON input"]').fill(value);
}

async function inputValue() {
  return page.locator('textarea[aria-label="JSON input"]').inputValue();
}

async function outputValue(ariaLabel) {
  return page.locator(`textarea[aria-label="${ariaLabel}"]`).inputValue();
}

function badge() {
  return page.locator('span[role="status"]', { hasText: /Valid JSON|Invalid JSON/ });
}

function alertBox() {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

try {
  await page.goto(`${BASE_URL}/use/json-formatter`, { waitUntil: "networkidle" });
  await check("tool page loads", () => assert.ok(page.url().includes("/use/json-formatter")));

  await check("initial state: 2 spaces checked, Clear disabled, no badge/results", async () => {
    assert.equal(
      await page.locator('fieldset:has(legend:text-is("Indent")) button[role="radio"][aria-checked="true"]').textContent(),
      "2 spaces"
    );
    assert.equal(await badge().count(), 0);
    assert.equal(await page.locator('button:has-text("Clear")').isDisabled(), true);
    assert.equal(await page.locator('textarea[aria-label="Formatted JSON output"]').count(), 0);
    assert.equal(await page.locator('textarea[aria-label="Minified JSON output"]').count(), 0);
  });

  await check("copy buttons present (neither is 'Copy (nothing)')", async () => {
    assert.equal(await page.locator('button:has-text("Copy formatted")').count(), 1);
    assert.equal(await page.locator('button:has-text("Copy formatted")').isDisabled(), true);
    assert.equal(await page.locator('button:has-text("Copy minified")').count(), 0);
  });

  await setInput(INPUT);
  await check("valid JSON shows green badge + exact 2-space output", async () => {
    await page.locator('span[role="status"]', { hasText: "Valid JSON" }).waitFor();
    assert.equal(await outputValue("Formatted JSON output"), FORMATTED_2);
    assert.equal(await outputValue("Minified JSON output"), MINIFIED);
  });
  await check("copy buttons enable for valid output", async () => {
    assert.equal(await page.locator('button:has-text("Copy formatted")').isDisabled(), false);
    assert.equal(await page.locator('button:has-text("Copy minified")').isDisabled(), false);
  });

  await page.locator('fieldset:has(legend:text-is("Indent")) button[role="radio"]:has-text("4 spaces")').click();
  await check("4-space switch re-indents output, minified unchanged", async () => {
    await page.waitForFunction(
      (expected) => {
        const el = document.querySelector('textarea[aria-label="Formatted JSON output"]');
        return el && el.value === expected;
      },
      FORMATTED_4
    );
    assert.equal(await outputValue("Formatted JSON output"), FORMATTED_4);
    assert.equal(await outputValue("Minified JSON output"), MINIFIED);
  });
  await page.locator('fieldset:has(legend:text-is("Indent")) button[role="radio"]:has-text("2 spaces")').click();

  await check("error path: trailing comma flips badge + role=alert with line/column", async () => {
    await setInput('{"a":1,}');
    await page.locator('span[role="status"]', { hasText: "Invalid JSON" }).waitFor();
    const box = await alertBox();
    await box.waitFor();
    const text = await box.textContent();
    assert.ok(text.length > 0 && /[A-Za-z]/.test(text), `alert text: ${text}`);
    assert.ok(text.includes("line 1, column"), `alert: ${text}`);
    assert.ok(!text.includes("position"), `alert should not duplicate location clause: ${text}`);
  });

  await check("unquoted key error keeps message + line/column", async () => {
    await setInput("{a:1}");
    const box = await alertBox();
    await box.waitFor();
    const text = await box.textContent();
    assert.ok(/[A-Za-z]/.test(text), `alert text: ${text}`);
    assert.ok(text.includes("line 1, column 2"), `alert: ${text}`);
  });

  await check("multi-line truncated input reports the true line/column", async () => {
    await setInput('{\n  "a": 1,\n  "b": 2');
    const box = await alertBox();
    await box.waitFor();
    const text = await box.textContent();
    assert.ok(/[A-Za-z]/.test(text), `alert text: ${text}`);
    assert.ok(text.includes("line 3, column 9"), `alert: ${text}`);
    assert.ok(!text.includes("position"), `alert should not duplicate location clause: ${text}`);
  });

  await check("recovery: fixing input restores valid results", async () => {
    await setInput('{"a":1,"b":2}');
    await page.locator('span[role="status"]', { hasText: "Valid JSON" }).waitFor();
    assert.equal(await outputValue("Minified JSON output"), '{"a":1,"b":2}');
    assert.equal(await alertBox().count(), 0);
  });

  await check("deep nesting shows friendly error", async () => {
    await page.evaluate(() => {
      const el = document.querySelector('textarea[aria-label="JSON input"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, "[" .repeat(100000) + "0" + "]".repeat(100000));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const box = await alertBox();
    await box.waitFor({ timeout: 10000 });
    assert.ok((await box.textContent()).includes("nested too deeply"));
  });

  await check("over-2MB input is refused with a visible notice", async () => {
    await setInput('{"keep":1}');
    await page.evaluate(() => {
      const el = document.querySelector('textarea[aria-label="JSON input"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, " ".repeat(2 * 1024 * 1024 + 1));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator('p[role="status"]', { hasText: "limited to 2 MB" }).waitFor();
    assert.equal(await inputValue(), '{"keep":1}');
  });
  await check("notice clears once back under the cap", async () => {
    await setInput('{"ok":true}');
    await page.waitForFunction(() => !document.querySelector('p[role="status"]'));
    assert.equal(await page.locator('p[role="status"]').count(), 0);
  });

  await check("clear empties input, hides results and disables Clear", async () => {
    await setInput(INPUT);
    await page.locator('span[role="status"]', { hasText: "Valid JSON" }).waitFor();
    await page.locator('button:has-text("Clear")').click();
    assert.equal(await inputValue(), "");
    await page.waitForFunction(
      () => !document.querySelector('textarea[aria-label="Formatted JSON output"]')
    );
    assert.equal(await page.locator('textarea[aria-label="Formatted JSON output"]').count(), 0);
    assert.equal(await badge().count(), 0);
    assert.equal(await page.locator('button:has-text("Clear")').isDisabled(), true);
  });

  await setInput(INPUT);
  await page.locator('span[role="status"]', { hasText: "Valid JSON" }).waitFor();
  await page.setViewportSize({ width: 375, height: 667 });
  await check("mobile 375px: tool subtree has no horizontal overflow", async () => {
    const [maxRight, minLeft, vw] = await page.evaluate(() => {
      const root = document
        .querySelector('textarea[aria-label="JSON input"]')
        ?.closest('div.space-y-5');
      if (!root) return [0, 0, 375];
      let maxRight = 0;
      let minLeft = 375;
      for (const el of root.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) {
          maxRight = Math.max(maxRight, r.right);
          minLeft = Math.min(minLeft, r.left);
        }
      }
      return [maxRight, minLeft, document.documentElement.clientWidth];
    });
    assert.ok(maxRight <= vw + 1, `maxRight ${maxRight} vs vw ${vw}`);
    assert.ok(minLeft >= -1, `minLeft ${minLeft}`);
  });
} catch (err) {
  failures.push({ name: "harness", err });
  console.log(`NOT harness\n    ${String(err.message).split("\n").join("\n    ")}`);
} finally {
  await browser.close();
}

console.log(
  failures.length === 0
    ? `\n${passed} passed, 0 failed`
    : `\n${passed} passed, ${failures.length} failed\nFAILED: ${failures
        .map((f) => f.name)
        .join(", ")}`
);
process.exit(failures.length === 0 ? 0 : 1);