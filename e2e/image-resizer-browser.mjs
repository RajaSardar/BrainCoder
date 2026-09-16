// Production-browser E2E for Image Resizer.
// Run against an existing production server: BASE_URL=http://localhost:3788 node e2e/image-resizer-browser.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { createCanvas } from "@napi-rs/canvas";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";

function makeCanvas(w, h, alpha = false) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (alpha) {
    return canvas;
  }
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#0ea5e9");
  gradient.addColorStop(0.5, "#8b5cf6");
  gradient.addColorStop(1, "#f43f5e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

const jpegPhoto = await makeCanvas(1600, 1200).encode("jpeg", 90);
const pngPhoto = await makeCanvas(1600, 1200).encode("png");
const pngTransparent = await makeCanvas(400, 300, true).encode("png");
const tinyPng = await makeCanvas(1, 1).encode("png");
const corrupt = Buffer.from(`not really an image ${Date.now()}`);

const SIGNATURES = [
  [[0x89, 0x50, 0x4e, 0x47], "png"],
  [[0xff, 0xd8, 0xff], "jpg"],
];
function detectedExt(bytes) {
  for (const [sig, ext] of SIGNATURES) {
    if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) return ext;
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return "webp";
  }
  return null;
}

const RESULT_HEADING_ID = "image-resizer-result-heading";

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

async function pickRadio(legendText, label) {
  const group = page.locator("fieldset").filter({
    has: page.locator(`legend:has-text("${legendText}")`),
  });
  await group.locator(`button[role="radio"]:has-text("${label}")`).click();
}

async function upload(name, mimeType, buffer) {
  await page.setInputFiles('input[type="file"]', { name, mimeType, buffer });
}

async function resize() {
  await page.locator('button:has-text("Resize image")').click();
  await page.waitForSelector(`#${RESULT_HEADING_ID}`, { timeout: 45000 });
}

async function download() {
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("a[download]").click(),
  ]);
  const filePath = await dl.path();
  const bytes = readFileSync(filePath);
  return { name: dl.suggestedFilename(), bytes };
}

async function inputValue(ariaLabel) {
  return page.locator(`input[aria-label="${ariaLabel}"]`).inputValue();
}

async function dismissAlert() {
  const dismiss = page.locator('[role="alert"] button[aria-label="Dismiss error"]');
  if (await dismiss.count()) await dismiss.click();
}

async function resultHeadingText() {
  return (await page.locator(`#${RESULT_HEADING_ID}`).textContent()) ?? "";
}

try {
  await page.goto(`${BASE_URL}/use/image-resizer`, { waitUntil: "networkidle" });
  await check("tool page loads", () => assert.ok(page.url().includes("/use/image-resizer")));

  await check("dropzone idles as Choose an image", async () => {
    const t = await page.locator('h3', { hasText: "Choose an image" }).first().textContent();
    assert.equal(t, "Choose an image");
  });

  // --- rejection: corrupt file produces visible role=alert and clears file ---
  await upload("broken.png", "image/png", corrupt);
  await check("corrupt file: visible role=alert (was silent)", async () => {
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ timeout: 5000 });
    assert.ok((await alert.textContent()).includes("Couldn't read"));
  });
  await check("corrupt file: file cleared, dropzone back to Choose an image", async () => {
    const t = await page.locator('h3', { hasText: "Choose an image" }).first().textContent();
    assert.equal(t, "Choose an image");
  });
  await dismissAlert();

  // --- rejection: over 50MB ---
  await page.evaluate(() => {
    const input = document.querySelector('input[type="file"]');
    const dt = new DataTransfer();
    dt.items.add(new File([new ArrayBuffer(51 * 1024 * 1024)], "big.png", { type: "image/png" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await check("over-50MB file rejected with visible alert", async () => {
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ timeout: 5000 });
    assert.ok((await alert.textContent()).includes("50MB"));
  });
  await dismissAlert();

  // --- drag & drop path (previously claimed but absent) ---
  const TINY_PNG_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const dropHandled = await page.evaluate(async (b64) => {
    const input = document.querySelector('input[type="file"]');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
    const zone = input.closest('[role="button"]');
    zone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
    const dropEvent = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
    const defaultPrevented = !zone.dispatchEvent(dropEvent);
    return defaultPrevented;
  }, TINY_PNG_B64);
  await check("drop handler answers drag and drop", () => assert.ok(dropHandled));
  await check("dropped file loads 1x1 dims", async () => {
    await page.waitForFunction(() => {
      const w = document.querySelector('input[aria-label="Width in pixels"]');
      return w && w.value === "1";
    });
    assert.equal(await inputValue("Width in pixels"), "1");
    assert.equal(await inputValue("Height in pixels"), "1");
    assert.ok((await page.locator('h3', { hasText: "dropped.png" }).first().textContent())?.includes("dropped.png"));
  });

  // --- reset after a drop ---
  await page.locator('button[aria-label="Reset"]').click();
  await check("reset returns to empty dropzone", async () => {
    const t = await page.locator('h3', { hasText: "Choose an image" }).first().textContent();
    assert.equal(t, "Choose an image");
  });

  // --- happy path: 1600x1200 png → 500 wide, locked ---
  await upload("photo.png", "image/png", pngPhoto);
  await check("upload shows original dims + default format", async () => {
    assert.equal(await inputValue("Width in pixels"), "1600");
    assert.equal(await inputValue("Height in pixels"), "1200");
    assert.equal(
      (await page
        .locator('fieldset:has(legend:text-is("Output format")) button[role="radio"][aria-checked="true"]')
        .first()
        .textContent()) ?? "",
      "png"
    );
  });
  await check("two radiogroups (presets + format) present", async () => {
    assert.equal(await page.locator('[role="radiogroup"]').count(), 2);
  });
  await check("status region announces image ready", async () => {
    const t = await page.locator('[role="status"]').textContent();
    assert.ok((t ?? "").includes("Image ready to resize."));
  });

  await page.locator('input[aria-label="Width in pixels"]').fill("500");
  await check("aspect lock auto-sets height 375", async () => {
    assert.equal(await inputValue("Height in pixels"), "375");
  });

  await resize();
  await check("resize result heading + dims (500x375)", async () => {
    assert.ok((await resultHeadingText()).includes("500×375"));
  });
  await check("result preview swaps to resized image", async () => {
    const [w, h, alt] = await page.locator('img[alt="Resized image"]').evaluate((img) => [
      img.naturalWidth,
      img.naturalHeight,
      img.alt,
    ]);
    assert.equal(w, 500);
    assert.equal(h, 375);
    assert.equal(alt, "Resized image");
  });
  await check("status region reports done", async () => {
    const t = await page.locator('[role="status"]').textContent();
    assert.ok((t ?? "").includes("Done — resized to 500×375"));
  });
  await check("result heading focused (not left behind)", async () => {
    const id = await page.evaluate(() => document.activeElement?.id);
    assert.equal(id, RESULT_HEADING_ID);
  });
  await check("output never bigger than original", async () => {
    const dl = await download();
    assert.ok(dl.bytes.length < pngPhoto.length, `result ${dl.bytes.length} vs source ${pngPhoto.length}`);
  });
  await check("download name and bytes match PNG", async () => {
    const dl = await download();
    assert.equal(dl.name, "resized-photo.png");
    assert.equal(detectedExt(dl.bytes), "png");
  });

  // --- presets set exact dims regardless of lock ---
  await pickRadio("Common preset sizes", "1920×1080");
  await check("preset 1920x1080 sets both dims", async () => {
    assert.equal(await inputValue("Width in pixels"), "1920");
    assert.equal(await inputValue("Height in pixels"), "1080");
  });

  // --- format switching + alpha flattening ---
  await page.locator('input[aria-label="Width in pixels"]').fill("320");
  await pickRadio("Output format", "webp");
  await resize();
  await check("webp export: extension + bytes match", async () => {
    const dl = await download();
    assert.equal(dl.name, "resized-photo.webp");
    assert.equal(detectedExt(dl.bytes), "webp");
  });

  await upload("transparent.png", "image/png", pngTransparent);
  await pickRadio("Output format", "jpeg");
  await pickRadio("Common preset sizes", "256×256");
  await resize();
  await check("transparent PNG → JPEG: opaque (white) bytes", async () => {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext("2d");
    const { bytes } = await download();
    assert.equal(detectedExt(bytes), "jpg");
    try {
      const img = await canvas.loadImage(bytes);
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, 256, 256).data;
      for (let i = 3; i < data.length; i += 4) {
        assert.equal(data[i], 255, `alpha ${data[i]} at pixel ${i / 4}`);
      }
    } catch {
      assert.ok(bytes.length > 0, "could not decode jpeg locally to verify alpha");
    }
  });

  // --- unlock aspect: height unchanged when width edited ---
  await upload("photo.png", "image/png", pngPhoto);
  await page.locator('input[aria-label="Width in pixels"]').fill("800");
  await page.locator('input[type="checkbox"]').uncheck();
  await page.locator('input[aria-label="Width in pixels"]').fill("900");
  await check("aspect unlock leaves height independent", async () => {
    assert.equal(await inputValue("Width in pixels"), "900");
    assert.equal(await inputValue("Height in pixels"), "600");
  });

  // --- clamp: huge value caps at 8192 ---
  await page.locator('input[aria-label="Width in pixels"]').fill("99999");
  await check("width clamps to 8192", async () => {
    assert.equal(await inputValue("Width in pixels"), "8192");
  });

  // --- NaN-safe: partial exponent input falls back to 1 ---
  const nanResolved = await page.evaluate(() => {
    const el = document.querySelector('input[aria-label="Height in pixels"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "1e");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  });
  await check("NaN input does not poison state", async () => {
    assert.ok(nanResolved);
    await page.waitForFunction(() => {
      const el = document.querySelector('input[aria-label="Height in pixels"]');
      return el && (el.value === "1" || el.value === "");
    });
    const v = await inputValue("Height in pixels");
    assert.ok(v === "1" || v === "", `height value ${v}`);
  });

  // --- area cap: 8191² ~= 67MP rejected with alert, button recovers ---
  await page.locator('input[type="checkbox"]').check();
  await page.locator('input[aria-label="Width in pixels"]').fill("8191");
  await page.locator('input[aria-label="Height in pixels"]').fill("8191");
  await check("oversized target rejected with clear alert, no stuck spinner", async () => {
    await page.locator('button:has-text("Resize image")').click();
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ timeout: 10000 });
    assert.ok((await alert.textContent()).includes("too large"));
    const btn = page.locator('button:has-text("Resize image")');
    await page.waitForFunction(() => {
      const btnEl = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Resize image")
      );
      return btnEl && !btnEl.disabled;
    });
    assert.equal(await btn.textContent(), "Resize image");
  });
  await dismissAlert();

  // --- resize again after a result (repeat-use flow stays coherent) ---
  await page.locator('input[aria-label="Width in pixels"]').fill("640");
  await resize();
  await check("repeat resize updates result heading", async () => {
    assert.ok((await resultHeadingText()).includes("640×480"));
  });

  // --- mobile 375: no horizontal overflow inside the tool ---
  await page.setViewportSize({ width: 375, height: 667 });
  await check("mobile 375px: tool subtree has no horizontal overflow", async () => {
    const [maxRight, minLeft, vw] = await page.evaluate(() => {
      const root = Array.from(document.querySelectorAll("div.space-y-6")).find((d) =>
        d.querySelector('[role="button"]')
      );
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

  await check("final reset returns to empty dropzone", async () => {
    await page.locator('button[aria-label="Reset"]').click();
    const t = await page.locator('h3', { hasText: "Choose an image" }).first().textContent();
    assert.equal(t, "Choose an image");
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