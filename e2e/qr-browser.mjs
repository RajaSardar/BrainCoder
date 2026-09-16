// Production-browser E2E for QR Code Generator.
// Run against an existing production server: BASE_URL=http://localhost:3788 node e2e/qr-browser.mjs
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

const tool = () => page.locator("#qr-code-generator");
const textarea = () => tool().locator("#qr-text-input");
const qrImg = () => tool().locator("img");
const alertBox = () => tool().locator('[role="alert"]:not(#__next-route-announcer__)');
const live = () => tool().locator('p[role="status"][aria-live="polite"]');
const clearBtn = () => tool().locator('button:has-text("Clear input")');
const downloadPng = () => tool().locator('button:has-text("Download PNG")');
const downloadSvg = () => tool().locator('button:has-text("Download SVG")');
const placeholder = () => tool().locator(".border-dashed");

const TOO_LONG = "That text is too long for a QR code. Try shortening it or using a URL shortener.";

async function setInput(value) {
  await textarea().fill(value);
}

async function inputValue() {
  return textarea().inputValue();
}

try {
  await page.goto(`${BASE_URL}/use/qr-code-generator`, { waitUntil: "networkidle" });
  await check("tool page loads", () => assert.ok(page.url().includes("/use/qr-code-generator")));

  await check("default state: textarea has URL, QR present, label visible", async () => {
    assert.equal(await inputValue(), "https://braincoder.sardar.dev");
    assert.equal(await qrImg().count(), 1);
    assert.match(await qrImg().getAttribute("src"), /^data:image\/png;base64,/);
    assert.equal(await qrImg().getAttribute("alt"), "QR code preview");
    assert.equal(await clearBtn().isDisabled(), false);
  });

  await check("alt text does NOT leak encoded content", async () => {
    assert.equal(await qrImg().getAttribute("alt"), "QR code preview");
  });

  await setInput("hello world");
  await check("changing text updates QR (src changes)", async () => {
    await page.waitForFunction(
      () => document.querySelector("#qr-code-generator img")?.alt === "QR code preview"
    );
    assert.match(await qrImg().getAttribute("src"), /^data:image\/png;base64,/);
  });

  await setInput("");
  await check("empty text shows placeholder, QR and downloads gone", async () => {
    assert.ok((await placeholder().textContent()).includes("Enter some text"));
    assert.equal(await qrImg().count(), 0);
    assert.equal(await downloadPng().count(), 0);
    assert.equal(await downloadSvg().count(), 0);
    assert.equal(await clearBtn().isDisabled(), true);
  });

  await setInput("  ");
  await check("whitespace-only shows placeholder", async () => {
    assert.equal(await qrImg().count(), 0);
    assert.ok((await placeholder().textContent()).includes("Enter some text"));
  });

  await setInput("https://braincoder.sardar.dev");
  await check("recover to valid restores QR and downloads", async () => {
    await page.waitForFunction(() => {
      const img = document.querySelector("#qr-code-generator img");
      return img && img.src.startsWith("data:image/png;base64,");
    });
    assert.equal(await qrImg().count(), 1);
    assert.equal(await downloadPng().count(), 1);
    assert.equal(await downloadSvg().count(), 1);
  });

  await setInput("A".repeat(4296));
  await check("EC M: 3391 uppercase A succeeds", async () => {
    await setInput("A".repeat(3391));
    await page.waitForFunction(() => {
      const img = document.querySelector("#qr-code-generator img");
      return img && img.src.startsWith("data:image/png;base64,");
    });
    assert.equal(await qrImg().count(), 1);
    assert.equal(await alertBox().count(), 0);
  });

  await setInput("A".repeat(3392));
  await check("EC M: 3392 uppercase A fails with exact error", async () => {
    assert.equal(await alertBox().count(), 1);
    assert.equal(await alertBox().textContent(), TOO_LONG);
    assert.equal(await qrImg().count(), 0);
    assert.equal(await downloadPng().count(), 0);
    assert.equal(await downloadSvg().count(), 0);
  });

  await check("sr-only status announces text too long", async () => {
    assert.match(await live().textContent(), /Text is too long for a QR code/);
  });

  await check("error is red role=alert with dismiss button", async () => {
    assert.equal(await alertBox().getAttribute("role"), "alert");
    assert.ok((await alertBox().getAttribute("class")).includes("bg-red-50"));
    assert.equal(await alertBox().locator('button[aria-label="Dismiss error"]').count(), 1);
  });

  await check("dismiss hides error", async () => {
    await alertBox().locator('button[aria-label="Dismiss error"]').click();
    assert.equal(await alertBox().count(), 0);
  });

  await setInput("recovery works");
  await check("recover from error: error gone, QR restored", async () => {
    await page.waitForFunction(() => {
      const img = document.querySelector("#qr-code-generator img");
      return img && img.src.startsWith("data:image/png;base64,");
    });
    assert.equal(await alertBox().count(), 0);
    assert.equal(await qrImg().count(), 1);
    assert.match(await live().textContent(), /QR code ready/);
  });

  await check("clear button empties input and resets", async () => {
    await clearBtn().click();
    assert.equal(await inputValue(), "");
    assert.equal(await qrImg().count(), 0);
    assert.equal(await clearBtn().isDisabled(), true);
  });

  await setInput("test download");
  await check("low contrast warning when fg == bg", async () => {
    const fgInput = tool().locator('input[aria-label="Foreground color"]');
    const bgInput = tool().locator('input[aria-label="Background color"]');
    await fgInput.fill("#000000");
    await bgInput.fill("#000000");
    assert.ok(await tool().locator("text=Low contrast between the foreground").count());
  });

  await check("clear contrast warning by changing bg", async () => {
    const bgInput = tool().locator('input[aria-label="Background color"]');
    await bgInput.fill("#ffffff");
    assert.equal(await tool().locator("text=Low contrast between the foreground").count(), 0);
  });

  await check("privacy: secret NOT in img alt", async () => {
    await setInput("WIFI:T:WPA;S:test;P:supersecret123;;");
    await page.waitForFunction(() => {
      const img = document.querySelector("#qr-code-generator img");
      return img && img.src.startsWith("data:image/png;base64,");
    });
    const alt = await qrImg().getAttribute("alt");
    assert.equal(alt, "QR code preview");
    assert.ok(!alt.includes("supersecret"));
  });

  await check("label shows download size", async () => {
    assert.match(await tool().locator("p:has-text('Download size')").textContent(), /Download size: 320px/);
  });

  await setInput("https://braincoder.sardar.dev");
  await page.waitForFunction(() => {
    const img = document.querySelector("#qr-code-generator img");
    return img && img.src.startsWith("data:image/png;base64,");
  });
  await check("Download PNG triggers a .png file", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadPng().click(),
    ]);
    assert.match(download.suggestedFilename(), /qrcode\.png$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  });

  await check("Download SVG triggers a .svg file", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadSvg().click(),
    ]);
    assert.match(download.suggestedFilename(), /qrcode\.svg$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.match(Buffer.concat(chunks).toString("utf8"), /^<svg/);
  });

  await check("downloaded PNG honors the selected size (500px)", async () => {
    await tool().locator('input[type="range"]').fill("500");
    assert.match(await tool().locator("p:has-text('Download size')").textContent(), /Download size: 500px/);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadPng().click(),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    assert.equal(buf.readUInt32BE(16), 500);
    assert.equal(buf.readUInt32BE(20), 500);
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await check("mobile 375px: tool subtree has no horizontal overflow", async () => {
    const { maxRight, vw } = await page.evaluate(() => {
      const root = document.querySelector("#qr-code-generator");
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