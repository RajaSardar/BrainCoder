// Production-browser E2E for URL Encoder.
// Run against an existing production server: BASE_URL=http://localhost:3788 node e2e/url-encoder-browser.mjs
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

const tool = () => page.locator("div.space-y-5:has(#url-encoder-input)");
const input = () => page.locator("#url-encoder-input");
const output = () => page.locator('textarea[aria-label="Output"]');
const alertBox = () => page.locator('[role="alert"]:not(#__next-route-announcer__)');

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

try {
  await page.goto(`${BASE_URL}/use/url-encoder`, { waitUntil: "networkidle" });
  await check("tool page loads", () => assert.ok(page.url().includes("/use/url-encoder")));

  await check("default state: Encode active, checkbox on, Clear disabled, no alert", async () => {
    assert.equal(
      await page.locator('fieldset button[role="radio"][aria-checked="true"]').textContent(),
      "Encode"
    );
    assert.equal(await tool().locator('input[type="checkbox"]').isChecked(), true);
    assert.equal(await tool().locator("label:has(input[type=checkbox])").textContent(), "Component-level (encodeURIComponent)");
    assert.equal(await outputValue(), "");
    assert.ok((await charCount()).includes("0 chars"));
    assert.equal(await tool().locator('button:has-text("Clear input")').isDisabled(), true);
    assert.equal(await tool().locator('button:has-text("Use result as input")').isDisabled(), true);
    assert.equal(await alertBox().count(), 0);
    assert.equal(await tool().locator("textarea").count(), 2);
    assert.equal(await output().getAttribute("readonly"), "");
    assert.ok((await output().getAttribute("class"))?.includes("bg-slate-100"));
    assert.equal(await output().getAttribute("tabindex"), "-1");
  });

  await setInput("a b");
  await check("component encode 'a b' -> a%20b with live char count", async () => {
    assert.equal(await outputValue(), "a%20b");
    assert.ok((await charCount()).includes("5 chars"));
  });

  await tool().locator('input[type="checkbox"]').uncheck();
  await check("unchecking flips label to whole-URL mode", async () => {
    assert.equal(await tool().locator("label:has(input[type=checkbox])").textContent(), "Whole-URL structure (encodeURI)");
  });
  await setInput("https://example.com/a b?c=d&e=f");
  await check("whole-URL encode keeps structure, escapes only unsafe chars", async () => {
    assert.equal(await outputValue(), "https://example.com/a%20b?c=d&e=f");
    assert.ok(!(await outputValue()).includes("%3F"));
    assert.ok(!(await outputValue()).includes("%3D"));
    assert.ok(!(await outputValue()).includes("%26"));
  });

  await tool().locator('input[type="checkbox"]').check();
  await setInput("https://example.com");
  await check("component mode percent-encodes a whole URL (opaque string)", async () => {
    assert.equal(await outputValue(), "https%3A%2F%2Fexample.com");
  });
  await check("whole-URL hint appears in component mode, clears when unchecked", async () => {
    await tool().locator('p[role="status"]', { hasText: "percent-encodes the whole URL" }).waitFor();
    await tool().locator('input[type="checkbox"]').uncheck();
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('p[role="status"]')).every(
          (p) => !p.textContent.includes("percent-encodes the whole URL")
        )
    );
    assert.equal(await tool().locator('p[role="status"]', { hasText: "percent-encodes the whole URL" }).count(), 0);
  });
  await tool().locator('input[type="checkbox"]').check();

  await page.locator('fieldset button[role="radio"]:has-text("Decode")').click();
  await check("decode mode hides the encode-only checkbox", async () => {
    assert.equal(await tool().locator('input[type="checkbox"]').count(), 0);
    assert.equal(
      await page.locator('fieldset button[role="radio"][aria-checked="true"]').textContent(),
      "Decode"
    );
  });
  await setInput("a%20b");
  await check("decode 'a b' via decodeURIComponent", async () => {
    assert.equal(await outputValue(), "a b");
  });
  await setInput("https%3A%2F%2Fexample.com");
  await check("decode reverses a component-encoded URL (strict decoder)", async () => {
    assert.equal(await outputValue(), "https://example.com");
  });

  await setInput("%zz");
  await check("invalid decode: empty output + role=alert, copyable-error gone", async () => {
    const box = await alertBox();
    await box.waitFor();
    assert.ok((await box.textContent()).includes("Invalid input — could not decode."));
    assert.equal(await outputValue(), "");
    assert.equal(await tool().locator('button:has-text("Use result as input")').isDisabled(), true);
  });
  await check("error dismiss button hides the alert", async () => {
    await tool().locator('button[aria-label="Dismiss error"]').click();
    assert.equal(await alertBox().count(), 0);
  });

  await page.locator('fieldset button[role="radio"]:has-text("Encode")').click();
  await setInput("a b");
  await check("encode-mode error wording (lone surrogate) says encode", async () => {
    await page.evaluate(() => {
      const el = document.querySelector("#url-encoder-input");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, "\uD800");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const box = await alertBox();
    await box.waitFor();
    assert.ok((await box.textContent()).includes("could not encode."));
    assert.equal(await outputValue(), "");
  });
  await tool().locator('button[aria-label="Dismiss error"]').click();
  await setInput("a b");

  await check("use result as input flips mode and round-trips", async () => {
    await tool().locator('button:has-text("Use result as input")').click();
    assert.equal(await inputValue(), "a%20b");
    assert.equal(
      await page.locator('fieldset button[role="radio"][aria-checked="true"]').textContent(),
      "Decode"
    );
    assert.equal(await outputValue(), "a b");
    await tool().locator('button:has-text("Use result as input")').click();
    assert.equal(await inputValue(), "a b");
    assert.equal(
      await page.locator('fieldset button[role="radio"][aria-checked="true"]').textContent(),
      "Encode"
    );
    assert.equal(await outputValue(), "a%20b");
  });

  await check("clear input empties input and output", async () => {
    await tool().locator('button:has-text("Clear input")').click();
    assert.equal(await inputValue(), "");
    assert.equal(await outputValue(), "");
    assert.ok((await charCount()).includes("0 chars"));
    assert.equal(await tool().locator('button:has-text("Clear input")').isDisabled(), true);
  });

  await check("over-2MB input is refused with a visible notice", async () => {
    await setInput('{"keep":1}');
    await page.evaluate(() => {
      const el = document.querySelector("#url-encoder-input");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, " ".repeat(2 * 1024 * 1024 + 1));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await tool().locator('p[role="status"]', { hasText: "limited to 2 MB" }).waitFor();
    assert.equal(await inputValue(), '{"keep":1}');
  });
  await setInput("ok");
  await check("notice clears once back under the cap", async () => {
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('p[role="status"]')).every(
          (p) => !p.textContent.includes("2 MB")
        )
    );
    assert.equal(await tool().locator('p[role="status"]', { hasText: "limited to 2 MB" }).count(), 0);
  });

  await check("mobile 375px: tool subtree has no horizontal overflow", async () => {
    await setInput("a b");
    await page.setViewportSize({ width: 375, height: 667 });
    const [maxRight, minLeft, vw] = await page.evaluate(() => {
      const root = document.querySelector("#url-encoder-input")?.closest("div.space-y-5");
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

  await check("shared CopyButton still works after its a11y edit (cross-tool)", async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE_URL}/use/json-formatter`, { waitUntil: "networkidle" });
    await page.locator('textarea[aria-label="JSON input"]').fill('{"a":1}');
    await page.locator('button:has-text("Copy formatted")').waitFor();
    await page.locator('button:has-text("Copy formatted")').click();
    await page.locator('button:has-text("Copied")').waitFor();
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