// Production-browser E2E for Image Compressor.
// Run against an existing production server: BASE_URL=http://localhost:3788 node e2e/image-compressor-browser.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { createCanvas } from "@napi-rs/canvas";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";

function makeCanvas(w, h, noise = false, withAlpha = false) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (noise) {
    const pixels = ctx.createImageData(w, h);
    let seed = 987654321;
    for (let i = 0; i < pixels.data.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      if (i % 4 === 3) pixels.data[i] = withAlpha && i % 8 === 0 ? 0 : 255;
      else pixels.data[i] = seed & 255;
    }
    ctx.putImageData(pixels, 0, 0);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#0ea5e9");
    gradient.addColorStop(0.5, "#8b5cf6");
    gradient.addColorStop(1, "#f43f5e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
  return canvas;
}

const jpegPhoto = await makeCanvas(1600, 1200).encode("jpeg", 90);
const jpegNoise = await makeCanvas(2400, 1000, true).encode("jpeg", 98);
const pngSmall = await makeCanvas(1, 1).encode("png");
const pngGradient = await makeCanvas(800, 600).encode("png");
const pngAlphaBytes = await makeCanvas(400, 300, true, true).encode("png");
const corrupt = Buffer.from(`not really an image ${Date.now()}`);

const SIGNATURES = [
  [[0x89, 0x50, 0x4e, 0x47], "png"],
  [[0xff, 0xd8, 0xff], "jpg"],
  [[0x42, 0x4d], "bmp"],
  [[0x47, 0x49, 0x46], "gif"],
];
function detectedExt(bytes) {
  for (const [sig, ext] of SIGNATURES) {
    if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) return ext;
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return "webp";
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79) {
    return "avif";
  }
  return null;
}

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

async function compress() {
  await page.locator('button:has-text("Compress Image")').click();
  await page.waitForSelector("#image-compressor-result-heading", { timeout: 45000 });
}

async function download() {
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('a[download]').click(),
  ]);
  const filePath = await dl.path();
  const bytes = readFileSync(filePath);
  return { name: dl.suggestedFilename(), bytes };
}

async function resultHeading() {
  return (await page.locator("#image-compressor-result-heading").textContent()) ?? "";
}

async function previewSize() {
  return page.locator('img[alt="Result preview"]').evaluate((img) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
}

async function dismissAlert() {
  const dismiss = page.locator('[role="alert"]:not(#__next-route-announcer__) button[aria-label="Dismiss error"]');
  if (await dismiss.count()) await dismiss.click();
}

async function newImage() {
  await page.locator('button:has-text("New image")').click();
  await page.waitForSelector('[role="button"][aria-label="Upload an image"]');
}

try {
  await page.goto(`${BASE_URL}/use/image-compressor`, { waitUntil: "networkidle" });
  await check("tool page loads", () => assert.ok(page.url().includes("/use/image-compressor")));

  await check("live status region present with idle text", async () => {
    const t = await page.locator('[role="status"]').textContent();
    assert.ok((t ?? "").includes("Ready to compress"));
  });

  await upload("photo.heic", "image/heic", pngSmall);
  await check("HEIC rejected with visible role=alert", async () => {
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ timeout: 5000 });
    assert.ok((await alert.textContent()).includes("HEIC/HEIF"));
  });
  await dismissAlert();

  await upload("notes.txt", "text/plain", Buffer.from("hello"));
  await check("non-image rejected", async () => {
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ timeout: 5000 });
    assert.ok((await alert.textContent()).includes("valid image file"));
  });
  await dismissAlert();

  await page.evaluate(() => {
    const input = document.querySelector('input[type="file"]');
    const dt = new DataTransfer();
    dt.items.add(new File([new ArrayBuffer(51 * 1024 * 1024)], "big.png", { type: "image/png" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await check("over-50MB file rejected with visible alert", async () => {
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ timeout: 5000 });
    assert.ok((await alert.textContent()).includes("under 50MB"));
  });
  await dismissAlert();

  await upload("broken.png", "image/png", corrupt);
  await page.locator('button:has-text("Compress Image")').click();
  await check("corrupt image produces visible role=alert (was silent)", async () => {
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ timeout: 45000 });
    assert.ok((await alert.textContent()).trim().length > 0);
  });
  await dismissAlert();
  await page.locator('button[aria-label="Remove file"]').click();
  await page.waitForSelector('[role="button"][aria-label="Upload an image"]');

  await upload("photo.jpg", "image/jpeg", jpegPhoto);
  await check("three radiogroups (preset/format/resize) after upload", async () => {
    await page.waitForSelector('legend:has-text("Compression level")');
    assert.equal(await page.locator('[role="radiogroup"]').count(), 3);
  });
  await check("default Balanced preset selected via aria-checked", async () => {
    const sel = await page
      .locator('fieldset:has(legend:text-is("Compression level")) button[role="radio"][aria-checked="true"]')
      .textContent();
    assert.ok((sel ?? "").includes("Balanced"));
  });
  await compress();
  await check("default Auto/Balanced/Original compresses (fixed worker auto crash)", async () => {
    assert.ok((await resultHeading()).includes("complete"));
  });
  {
    const { name, bytes } = await download();
    await check("default output never bigger than original", () => {
      assert.ok(bytes.length <= jpegPhoto.length, `${bytes.length} <= ${jpegPhoto.length}`);
    });
    await check("default download extension matches bytes (no mislabel)", () => {
      const ext = detectedExt(bytes);
      assert.ok(ext, "recognized magic bytes");
      assert.ok(name.startsWith("compressed-photo"), name);
      assert.ok(name.endsWith(`.${ext}`), `${name} ends with .${ext}`);
    });
  }
  await newImage();

  await upload("alpha.png", "image/png", pngAlphaBytes);
  await pickRadio("Output format", "JPEG");
  await compress();
  {
    const heading = await resultHeading();
    const { name, bytes } = await download();
    await check("explicit JPEG on transparent PNG: bytes never bigger", () => {
      assert.ok(bytes.length <= pngAlphaBytes.length, `${bytes.length} <= ${pngAlphaBytes.length}`);
    });
    if (heading.includes("complete")) {
      await check("explicit JPEG yields real JPEG bytes (alpha flattened)", () => {
        assert.equal(detectedExt(bytes), "jpg", name);
        assert.ok(name.endsWith(".jpg"));
      });
    } else {
      console.log("    (tiny alpha PNG fell back — skip branch checked elsewhere)");
    }
  }
  await page.locator('button:has-text("Adjust settings")').click();
  await page.waitForSelector('button:has-text("Compress Image")');

  await pickRadio("Output format", "PNG");
  await upload("tiny.png", "image/png", pngSmall);
  await compress();
  const skippedHeading = await resultHeading();
  {
    const { name, bytes } = await download();
    await check("tiny PNG -> PNG: never bigger + magic/ext consistent", () => {
      assert.ok(bytes.length <= pngSmall.length, `${bytes.length} <= ${pngSmall.length}`);
      const ext = detectedExt(bytes);
      assert.ok(name.endsWith(`.${ext}`), `${name} ends with .${ext}`);
    });
  }
  if (skippedHeading.includes("Original kept")) {
    const dd = await download();
    await check("skipped fallback preserves bytes AND labels original format (PNG, not jpeg)", () => {
      assert.ok(dd.bytes.equals(pngSmall), "original bytes returned byte-for-byte");
      assert.equal(detectedExt(dd.bytes), "png");
      assert.ok(dd.name.endsWith(".png"), dd.name);
    });
    await check("skipped banner explains never-larger guarantee", async () => {
      const panel = await page.locator('[role="region"]').textContent();
      assert.ok((panel ?? "").includes("unchanged"));
      assert.ok((panel ?? "").includes("never larger"));
    });
  } else {
    console.log("    (map tiny PNG compressed further — skip branch not triggered this run)");
  }
  await newImage();

  await upload("photo.jpg", "image/jpeg", jpegPhoto);
  await pickRadio("Output format", "WebP");
  await compress();
  {
    const { name, bytes } = await download();
    await check("explicit WebP yields real WebP bytes", () => {
      assert.equal(detectedExt(bytes), "webp");
      assert.ok(name.endsWith(".webp"));
      assert.ok(bytes.length <= jpegPhoto.length);
    });
  }
  await newImage();

  await upload("photo.jpg", "image/jpeg", jpegPhoto);
  await pickRadio("Output format", "AVIF");
  await compress();
  {
    const { name, bytes } = await download();
    await check("explicit AVIF: download extension always matches real bytes", () => {
      const ext = detectedExt(bytes);
      assert.ok(ext, "recognizable image bytes");
      assert.ok(name.endsWith(`.${ext}`), `${name} -> ${ext}`);
      assert.ok(bytes.length <= jpegPhoto.length, `${bytes.length} <= ${jpegPhoto.length}`);
    });
  }
  await newImage();

  await upload("photo.jpg", "image/jpeg", jpegPhoto);
  await pickRadio("Resize (optional)", "Max 1280 px");
  await compress();
  await check("resize 1280 downscales 1600x1200 to 1280x960", async () => {
    const [w, h] = await previewSize();
    assert.equal(w, 1280);
    assert.equal(h, 960);
  });
  {
    const { bytes } = await download();
    await check("resized output never bigger than original", () => {
      assert.ok(bytes.length <= jpegPhoto.length);
    });
  }
  await newImage();

  await upload("small.png", "image/png", pngGradient);
  await pickRadio("Resize (optional)", "Max 1920 px");
  await compress();
  await check("1920 cap never upscales 800x600", async () => {
    const [w, h] = await previewSize();
    assert.equal(w, 800);
    assert.equal(h, 600);
  });
  await newImage();

  await upload("photo.jpg", "image/jpeg", jpegPhoto);
  await compress();
  await check("focus moves to result heading after compression", async () => {
    const active = await page.evaluate(() => document.activeElement?.id ?? "");
    assert.equal(active, "image-compressor-result-heading");
  });

  await page.locator('button:has-text("Adjust settings")').click();
  await page.waitForSelector('button:has-text("Compress Image")');
  await check("Adjust settings keeps file and returns controls", async () => {
    assert.equal(await page.locator('button[aria-label="Remove file"]').count(), 1);
  });
  await pickRadio("Compression level", "Strong");
  await compress();
  await check("retry with Strong after Adjust settings works", async () => {
    assert.ok((await resultHeading()).includes("complete"));
  });

  await page.locator('button:has-text("New image")').click();
  await check("New image returns to empty dropzone", async () => {
    await page.waitForSelector('[role="button"][aria-label="Upload an image"]');
    assert.equal(await page.locator('button[aria-label="Remove file"]').count(), 0);
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await upload("photo.jpg", "image/jpeg", jpegPhoto);
  await compress();
  await check("mobile 375px: tool form/result no horizontal overflow", async () => {
    const [maxRight, minLeft, vw] = await page.evaluate(() => {
      let maxRight = 0;
      let minLeft = 375;
      for (const el of document.querySelectorAll("form *")) {
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
  console.log(err && err.stack ? err.stack : String(err));
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAILED: " + failures.map((f) => f.name).join(", "));
  process.exit(1);
}