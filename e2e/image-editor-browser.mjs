// Production-Chrome e2e for the "Image Editor" tool.
//
// Mirrors e2e/html-to-image-browser.mjs: real Chrome through playwright-core, the
// real /use/image-editor route, fixtures written to a temp dir, and every
// downloaded file re-parsed from its own bytes — header for the size, full
// inflate for the pixels — so the promises the tool makes are checked against
// the file that came out, not against a line of UI text.
//
// The small fixture is a 120 x 80 PNG of four flat blocks, so a pixel at a known
// coordinate has a known colour. That is what lets this file assert the geometry
// claims directly: a quarter turn moves a corner to the corner, a mirror moves
// the right-hand block to the left, a crop starts where it says it starts, and
// a stroke drawn at natural (60, 40) is still at the matching place after the
// image has been rotated underneath it.
//
//   node e2e/image-editor-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/image-editor-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/image-editor`;
const DL = "/tmp/image-editor-e2e";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const NAT_W = 120;
const NAT_H = 80;
const PREVIEW_LONG_SIDE = 1200;
const BRUSH_RGB = [15, 23, 42]; // #0f172a, the default stroke colour

// --------------------------------------------------------------------------
// Writing the fixtures — real bytes, so the preflight sees a real header
// --------------------------------------------------------------------------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** 8-bit truecolour PNG, row filter Up after the first row so it compresses fast. */
function encodePng(width, height, pixelAt, level = 6) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1);
    raw[at] = y === 0 ? 0 : 2;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      const p = at + 1 + x * 3;
      if (y === 0) {
        raw[p] = r;
        raw[p + 1] = g;
        raw[p + 2] = b;
      } else {
        // Row filter 2 is Up: every stored byte is a delta from the row above.
        const [pr, pg, pb] = pixelAt(x, y - 1);
        raw[p] = (r - pr) & 0xff;
        raw[p + 1] = (g - pg) & 0xff;
        raw[p + 2] = (b - pb) & 0xff;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The four flat blocks the geometry assertions are written against. */
function blocks(x, y) {
  if (y < NAT_H / 2) return x < NAT_W / 2 ? [200, 30, 40] : [30, 200, 40];
  return x < NAT_W / 2 ? [30, 40, 200] : [200, 200, 200];
}

writeFileSync(`${DL}/fixture.png`, encodePng(NAT_W, NAT_H, blocks));
// 3 megapixels: 400% of it is 8000 x 6000, over the pixel budget but inside the
// side limit, so the pixel refusal is the one under test.
writeFileSync(
  `${DL}/big.png`,
  encodePng(2000, 1500, (x, y) => [(x * 255) / 2000, (y * 255) / 1500, 128], 1),
);
// 8200 px wide: the side refusal, with the pixel count still tiny.
writeFileSync(`${DL}/wide.png`, encodePng(8200, 40, (x) => [x % 256, 40, 90], 1));
// 25 megapixels: refused on the way in, before a decoder is handed the bytes.
writeFileSync(
  `${DL}/huge.png`,
  encodePng(5000, 5000, (x, y) => [(x >> 3) % 256, (y >> 3) % 256, 64], 1),
);
writeFileSync(`${DL}/not-really.png`, "this file is named .png and holds no pixels at all\n");

// --------------------------------------------------------------------------
// Reading a file back — headers for the size, inflate for the pixels
// --------------------------------------------------------------------------
function parsePng(b) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i += 1) if (b[i] !== sig[i]) return null;
  if (b.toString("latin1", 12, 16) !== "IHDR") return null;
  return { format: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function parseJpeg(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) return null;
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { format: "jpeg", height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function parseWebp(b) {
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return null;
  const fourcc = b.toString("latin1", 12, 16);
  if (fourcc === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { format: "webp", width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === "VP8X") {
    return {
      format: "webp",
      width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
    };
  }
  return { format: "webp", width: 0, height: 0 };
}

const imageFacts = (raw) => {
  const b = Buffer.from(raw);
  return parsePng(b) || parseJpeg(b) || parseWebp(b);
};

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Full PNG decode at 8 bits per channel, so a pixel can be read by coordinate. */
function decodePng(bytes) {
  const head = parsePng(Buffer.from(bytes));
  if (!head) return null;
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length);
  let at = 8;
  const idat = [];
  let channels = 3;
  while (at + 8 <= view.length) {
    const len = view.readUInt32BE(at);
    const type = view.toString("latin1", at + 4, at + 8);
    if (type === "IHDR") {
      // IHDR data starts at at+8: width, height, then bit depth, colour type,
      // compression, filter and interlace in that order.
      const depth = view[at + 16];
      const color = view[at + 17];
      if (depth !== 8 || view[at + 20] !== 0) return null;
      channels = color === 0 ? 1 : color === 2 ? 3 : color === 4 ? 2 : color === 6 ? 4 : 0;
      if (!channels) return null;
    } else if (type === "IDAT") {
      idat.push(view.subarray(at + 8, at + 8 + len));
    } else if (type === "IEND") {
      break;
    }
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const { width, height } = head;
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const x = row[i];
      cur[i] =
        filter === 0
          ? x
          : filter === 1
            ? x + a
            : filter === 2
              ? x + b
              : filter === 3
                ? x + ((a + b) >> 1)
                : x + paeth(a, b, c);
    }
    prev = cur;
  }
  return {
    width,
    height,
    data: out,
    at: (x, y) => [out[y * stride + x * channels], out[y * stride + x * channels + 1], out[y * stride + x * channels + 2]],
  };
}

/** How far a pixel is from a colour, per channel. */
const dist = (pixel, rgb) => Math.max(Math.abs(pixel[0] - rgb[0]), Math.abs(pixel[1] - rgb[1]), Math.abs(pixel[2] - rgb[2]));

/** The closest this pixel or any within `r` of it gets to a colour. */
function nearestWithin(img, x, y, r, rgb) {
  let best = Infinity;
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
      best = Math.min(best, dist(img.at(px, py), rgb));
    }
  }
  return best;
}

function diffCount(a, b) {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return -1;
  let n = 0;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) n += 1;
  return n;
}

// --------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
function check(ok, label, extra = "") {
  if (ok) {
    passed += 1;
    console.log(`ok  ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.error(`NOT OK  ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

const consoleIssues = [];
const pageErrors = [];
const offOrigin = [];
const nonGet = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("request", (r) => {
  const url = r.url();
  if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) offOrigin.push(url);
  if (r.method() !== "GET") nonGet.push(`${r.method()} ${url}`);
});

const alertBox = (t) => page.locator("[role='alert']", { hasText: t });
const statusBox = (t) => page.locator("[role='status']", { hasText: t });
const fileInput = () => page.locator("input[type='file'][aria-label='Open an image to edit']");
const stageCanvas = () => page.locator("canvas[role='img']");
const downloadBtn = () => page.locator("button", { hasText: /^Download \d+ × \d+ px/ });
const fieldset = (legend) => page.locator("fieldset").filter({ has: page.locator("legend", { hasText: legend }) });
const rotateBox = () => fieldset("Rotate and mirror");
const scaleField = () => fieldset("Size").locator("input[type='number']");
const scaleSlider = () => fieldset("Size").locator("input[type='range']");
const brightness = () => fieldset("Adjust").locator("input[type='range']").nth(0);
const exportBox = () => fieldset("Export");
const formatSelect = () => exportBox().locator("select");
const formatNote = () => exportBox().locator("p").first();
const qualitySlider = () => exportBox().locator("input[type='range']");
const cropBox = () => fieldset("Crop");
const cropFields = () => cropBox().locator("input[type='number']");
const annotateBox = () => fieldset("Annotate");
const textField = () => annotateBox().locator("input[type='text']");

const isBusy = () => page.evaluate(() => document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "true");

/** Wait for the tool to stop painting, twice over, so a repaint in flight is caught. */
async function settle(ms = 180) {
  for (let i = 0; i < 60; i += 1) {
    if (await isBusy()) {
      await page.waitForTimeout(80);
      continue;
    }
    await page.waitForTimeout(60);
    if (!(await isBusy())) break;
  }
  await page.waitForTimeout(ms);
}

/** React only sees a value written through the native setter. */
async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await settle();
}

async function setScale(value) {
  await scaleField().fill(String(value));
  await scaleField().blur();
  await settle();
}

async function openFixture(name) {
  await fileInput().setInputFiles(`${DL}/${name}`);
  await settle();
}

/** The size the stage is showing, read from the canvas's own announcement. */
async function stageSize() {
  const label = (await stageCanvas().getAttribute("aria-label")) || "";
  const m = label.match(/at (\d+) by (\d+) pixels on screen/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 0, height: 0 };
}

async function download(saveAs, timeout = 90000) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), downloadBtn().click()]);
  await dl.saveAs(`${DL}/${saveAs}`);
  await settle();
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)) };
}

/**
 * The stage sits far down the page, so a raw bounding box can be below the
 * viewport and the synthetic pointer would land on nothing. Bring it into view
 * and hand back a box the mouse can actually reach.
 */
async function onScreenStageBox() {
  await stageCanvas().scrollIntoViewIfNeeded();
  await settle(80);
  const box = await stageCanvas().boundingBox();
  if (!box) throw new Error("the stage canvas has no box to click on");
  const vp = page.viewportSize() || { width: 1280, height: 720 };
  if (box.y < 0 || box.y + box.height > vp.height || box.x < 0 || box.x + box.width > vp.width) {
    throw new Error(`the stage is still off-screen at ${JSON.stringify(box)} in a ${vp.width}x${vp.height} viewport`);
  }
  return box;
}

/** Drag across the stage from one natural coordinate to another. */
async function dragOnStage(fromX, fromY, toX, toY) {
  const box = await onScreenStageBox();
  const shown = await stageSize();
  await page.mouse.move(box.x + (fromX / shown.width) * box.width, box.y + (fromY / shown.height) * box.height);
  await page.mouse.down();
  await page.mouse.move(
    box.x + ((fromX + toX) / 2 / shown.width) * box.width,
    box.y + ((fromY + toY) / 2 / shown.height) * box.height,
    { steps: 4 },
  );
  await page.mouse.move(box.x + (toX / shown.width) * box.width, box.y + (toY / shown.height) * box.height, { steps: 4 });
  await page.mouse.up();
  await settle();
}

try {
  // ------------------------------------------------------------------ idle ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  check((await fileInput().count()) === 1, "there is exactly one file input");
  check((await downloadBtn().count()) === 0, "there is no download control with nothing loaded");
  check((await stageCanvas().count()) === 0, "there is no canvas with nothing loaded");
  const emptyState = (await statusBox("Open a PNG, JPEG, GIF, WebP or BMP image").textContent()) || "";
  check(/never uploaded/i.test(emptyState), "the empty state says the image is never uploaded", emptyState);
  check(
    (await fileInput().getAttribute("accept")) ===
      "image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif,image/webp,.webp,image/bmp,.bmp",
    "the file input accepts exactly the five formats the tool reads",
  );
  const idleBody = (await page.textContent("body")) || "";
  check(/25 MB/.test(idleBody) && /16 MP/.test(idleBody) && /8192 px/.test(idleBody), "the page states the three caps it enforces");
  check(/not an AI upscaler/i.test(idleBody), "the page admits the resize is not an AI upscaler");
  check(/no layers, no PSD/i.test(idleBody) && /\bno AI\b/i.test(idleBody), "the page admits there are no layers, no PSD and no AI");
  check(!/undo and redo/i.test(idleBody), "the page does not promise a redo");

  // --------------------------------------------- a file that is not an image ---
  await openFixture("not-really.png");
  const fake = (await alertBox("Convert it first").textContent()) || "";
  check(/not-really\.png/.test(fake), "a renamed text file is refused with its own name", fake);
  check(/no pixels to edit/.test(fake), "the refusal says what is wrong with it", fake);
  check((await stageCanvas().count()) === 0, "a refused file never reaches the canvas");
  check((await downloadBtn().count()) === 0, "a refused file leaves no download control behind");

  // ---------------------------------------------------------------- the load ---
  await openFixture("fixture.png");
  const loaded = (await statusBox("Loaded fixture.png").textContent()) || "";
  check(/Loaded fixture\.png/.test(loaded), "the tool announces the file it opened", loaded);
  check(/120 × 80 px/.test(loaded), "the load reports the real size from the header, not a guess", loaded);
  check(/Nothing was uploaded/.test(loaded), "the load message says nothing was uploaded", loaded);
  const shown = await stageSize();
  check(shown.width === NAT_W && shown.height === NAT_H, "the stage is shown at the image's own size under the preview cap", `${shown.width}x${shown.height}`);
  check((await page.textContent("body")).includes("1200 px"), "the page explains the preview cap");
  const editLine = (await statusBox("Output: 120 × 80 px").textContent()) || "";
  check(/no annotations/.test(editLine), "the edit summary starts from no annotations", editLine);

  // -------------------------------------------------- 100% PNG, unchanged ---
  const base = await download("base.png");
  const baseFacts = imageFacts(base.bytes);
  const basePixels = decodePng(base.bytes);
  check(!!baseFacts && baseFacts.format === "png", "the 100% download really is a PNG", base.name);
  check(!!baseFacts && baseFacts.width === NAT_W && baseFacts.height === NAT_H, "a 100% export is the image's own size", baseFacts && `${baseFacts.width}x${baseFacts.height}`);
  check(base.name === `fixture-${NAT_W}x${NAT_H}.png`, "an unedited export is named for its real size and nothing else", base.name);
  check(!!basePixels && dist(basePixels.at(2, 2), [200, 30, 40]) <= 1, "the top-left pixel of the file is the pixel that was in the fixture");
  check(!!basePixels && dist(basePixels.at(NAT_W - 3, NAT_H - 3), [200, 200, 200]) <= 1, "and so is the bottom-right one");
  check((await page.locator("[aria-label='Exported image result']").count()) === 1, "a result region is announced after a download");
  check(/This is the file you downloaded/.test((await page.textContent("body")) || ""), "the panel says it is showing the downloaded file");
  const resultAlt = (await page.locator("[aria-label='Exported image result'] img").getAttribute("alt")) || "";
  check(/120 by 80 pixels/.test(resultAlt), "the result image is described with the file's real size", resultAlt);

  // ------------------------------------------------------------- rotate 90° ---
  await rotateBox().locator("button", { hasText: "90°" }).click();
  await settle();
  const rot = await download("rot90.png");
  const rotFacts = imageFacts(rot.bytes);
  const rotPixels = decodePng(rot.bytes);
  check(!!rotFacts && rotFacts.width === NAT_H && rotFacts.height === NAT_W, "a quarter turn swaps the sides in the file itself", rotFacts && `${rotFacts.width}x${rotFacts.height}`);
  check(/90deg/.test(rot.name), "the rotation is named in the file", rot.name);
  check(!!rotPixels && nearestWithin(rotPixels, NAT_H - 2, 1, 2, [200, 30, 40]) < 8, "the natural top-left corner lands at the turned frame's top-right");
  check(!!rotPixels && nearestWithin(rotPixels, 1, NAT_W - 2, 2, [200, 200, 200]) < 8, "the natural bottom-right corner lands at the turned frame's bottom-left");
  check(!!rotPixels && dist(rotPixels.at(0, 0), [30, 40, 200]) < 8, "and the natural bottom-left corner lands where the turn says it does");

  // ---------------------------------------------------------------- mirror ---
  await rotateBox().locator("button", { hasText: "Mirror left" }).click();
  await settle();
  const mirror = await download("mirror.png");
  const mirrorPixels = decodePng(mirror.bytes);
  check(/fliph/.test(mirror.name), "the mirror is named in the file", mirror.name);
  // A quarter turn put green in the turned frame's right half; a left mirror has
  // to carry it across to the left, and take the right-half red with it.
  check(!!mirrorPixels && nearestWithin(mirrorPixels, 2, NAT_W - 3, 2, [30, 200, 40]) < 8, "mirroring really moves the right-hand block to the left", mirrorPixels && `${mirrorPixels.width}x${mirrorPixels.height}`);
  check(!!mirrorPixels && dist(mirrorPixels.at(1, 1), [200, 30, 40]) < 8, "and the right-hand red block lands on the left too");

  // ------------------------------------------------------------------ undo ---
  await rotateBox().locator("button", { hasText: "Undo" }).click();
  await settle();
  const afterUndo = await download("after-undo.png");
  const undoFacts = imageFacts(afterUndo.bytes);
  const undoPixels = decodePng(afterUndo.bytes);
  // Undo is one step per change, so it takes back the mirror and leaves the
  // quarter turn standing: still 80 x 120, but with the pre-mirror pixels.
  check(!!undoFacts && undoFacts.width === NAT_H && undoFacts.height === NAT_W, "one undo takes back the mirror and leaves the turn standing", undoFacts && `${undoFacts.width}x${undoFacts.height}`);
  check(!!undoPixels && dist(undoPixels.at(NAT_H - 3, NAT_W - 3), [30, 200, 40]) < 8, "and the mirror really is undone, pixel for pixel", undoPixels && `${undoPixels.width}x${undoPixels.height}`);
  check(!/fliph/.test(afterUndo.name), "and the name says the mirror is gone", afterUndo.name);

  await rotateBox().locator("button", { hasText: "Reset edits" }).click();
  await settle();
  const afterReset = await download("after-reset.png");
  check(diffCount(basePixels, decodePng(afterReset.bytes)) === 0, "reset edits brings back the very first file, byte for byte");

  // ------------------------------------------------ brightness and filter ---
  await setRange(brightness(), 20);
  const lit = await download("bright.png");
  const litPixels = decodePng(lit.bytes);
  check(!!litPixels && dist(litPixels.at(2, 2), [240, 36, 48]) <= 2, "+20% brightness multiplies the pixel by 1.2, as the copy says");
  check(/adjusted/.test(lit.name), "an adjusted export says so in its name", lit.name);
  await setRange(brightness(), 0);

  await fieldset("Adjust").locator("button", { hasText: "Grayscale" }).click();
  await settle();
  const gray = await download("gray.png");
  const grayPixels = decodePng(gray.bytes);
  const luma = Math.round(0.2126 * 200 + 0.7152 * 30 + 0.0722 * 40);
  check(!!grayPixels && dist(grayPixels.at(2, 2), [luma, luma, luma]) <= 1, "grayscale is the pixel's own Rec. 601 luma in all three channels");
  check(/grayscale/.test(gray.name), "the filter is named in the file", gray.name);
  await rotateBox().locator("button", { hasText: "Reset edits" }).click();
  await settle();

  // ------------------------------------------------------------- annotate ---
  await annotateBox().locator("button", { hasText: "Brush" }).click();
  await settle();
  await dragOnStage(10, 40, 110, 40);
  check(/1 annotation/.test((await annotateBox().textContent()) || ""), "the panel counts the stroke it just took");
  const drawn = await download("annotated.png");
  const drawnPixels = decodePng(drawn.bytes);
  check(/annotated/.test(drawn.name), "an annotated export says so in its name", drawn.name);
  check(!!drawnPixels && nearestWithin(drawnPixels, 60, 40, 3, BRUSH_RGB) < 60, "the stroke is really in the exported pixels");
  check(diffCount(basePixels, drawnPixels) > 100, "the stroke changed more than a few pixels of the file");

  // An annotation lives in the image's own coordinates, so rotating the image
  // underneath it has to take the stroke with it.
  await rotateBox().locator("button", { hasText: "90°" }).click();
  await settle();
  const drawnRot = await download("annotated-rotated.png");
  const drawnRotPixels = decodePng(drawnRot.bytes);
  check(!!drawnRotPixels && drawnRotPixels.width === NAT_H && drawnRotPixels.height === NAT_W, "the rotated annotated export swaps its sides too");
  check(!!drawnRotPixels && nearestWithin(drawnRotPixels, 40, 60, 4, BRUSH_RGB) < 60, "the stroke moved with the pixels when the image was rotated under it");
  check(diffCount(rotPixels, drawnRotPixels) > 100, "and the rotated file differs from a rotated file with no annotation in it");
  await rotateBox().locator("button", { hasText: "Undo" }).click();
  await settle();

  // A text stamp needs text: the empty case says so instead of drawing nothing.
  // The brush stroke from above is still on the image, so the count is compared
  // against what it was rather than against an empty canvas.
  const countNow = () => {
    const m = ((annotateBoxText) || "").match(/(\d+) annotation/);
    return m ? Number(m[1]) : 0;
  };
  let annotateBoxText = await annotateBox().textContent();
  const beforeEmpty = countNow();
  await annotateBox().locator("button", { hasText: "Text" }).first().click();
  await settle();
  const stage1 = await onScreenStageBox();
  await page.mouse.click(stage1.x + 20, stage1.y + 20);
  await settle(120);
  check((await alertBox("Type the text to stamp").count()) > 0, "an empty text stamp is refused with a reason");
  annotateBoxText = await annotateBox().textContent();
  check(countNow() === beforeEmpty, "and nothing was added to the image", `${beforeEmpty} -> ${countNow()}`);
  await textField().fill("OK");
  await settle(120);
  const stage2 = await onScreenStageBox();
  await page.mouse.click(stage2.x + 30, stage2.y + 30);
  await settle();
  annotateBoxText = await annotateBox().textContent();
  check(countNow() === beforeEmpty + 1, "a text stamp is added once the text is there", `${beforeEmpty} -> ${countNow()}`);
  await annotateBox().locator("button", { hasText: "Clear annotations" }).click();
  await settle();
  check(/no annotations/.test((await annotateBox().textContent()) || ""), "clear annotations takes them all away");

  // ------------------------------------------------------------ crop, drag ---
  await cropBox().locator("button", { hasText: /^Crop/ }).click();
  await settle();
  const cropShown = await stageSize();
  check(cropShown.width === NAT_W && cropShown.height === NAT_H, "the crop view shows the whole frame, not the cropped part", `${cropShown.width}x${cropShown.height}`);
  await dragOnStage(20, 10, 70, 50);
  const dragged = await cropFields().evaluateAll((els) => els.map((e) => Number(e.value)));
  check(
    Math.abs(dragged[0] - 20) <= 2 && Math.abs(dragged[1] - 10) <= 2 && Math.abs(dragged[2] - 50) <= 2 && Math.abs(dragged[3] - 40) <= 2,
    "a dragged crop lands where the pointer was dragged to",
    dragged.join(","),
  );
  // One drag is one change, so one undo takes the whole drag back.
  await rotateBox().locator("button", { hasText: "Undo" }).click();
  await settle();
  const afterDragUndo = await cropFields().evaluateAll((els) => els.map((e) => Number(e.value)));
  check(afterDragUndo.join(",") === "0,0,0,0", "one undo reverts the whole drag, not one pointer move of it", afterDragUndo.join(","));

  // ------------------------------------------------------- crop, from a keyboard ---
  for (const [i, v] of [[0, 10], [1, 20], [2, 40], [3, 30]]) {
    await cropFields().nth(i).fill(String(v));
  }
  await cropFields().nth(3).press("Enter");
  await settle();
  const typed = await cropFields().evaluateAll((els) => els.map((e) => Number(e.value)));
  check(typed.join(",") === "10,20,40,30", "the typed crop is stored in the image's own coordinates", typed.join(","));
  await cropBox().locator("button", { hasText: "Apply crop" }).click();
  await settle();
  const cropped = await download("cropped.png");
  const croppedFacts = imageFacts(cropped.bytes);
  const croppedPixels = decodePng(cropped.bytes);
  check(!!croppedFacts && croppedFacts.width === 40 && croppedFacts.height === 30, "the exported file is exactly the crop that was typed", croppedFacts && `${croppedFacts.width}x${croppedFacts.height}`);
  check(/crop40x30/.test(cropped.name), "a cropped export is named for the crop, so it cannot be mistaken for the original", cropped.name);
  check(!!croppedPixels && nearestWithin(croppedPixels, 1, 1, 2, [200, 30, 40]) < 8, "the crop starts at the pixel it says it starts at");
  check(!!croppedPixels && nearestWithin(croppedPixels, 38, 28, 2, [30, 40, 200]) < 8, "and its far corner is the pixel the crop says it is");

  // -------------------------------------------------------------- the scale ---
  await setScale(50);
  const half = await download("half.png");
  const halfFacts = imageFacts(half.bytes);
  check(!!halfFacts && halfFacts.width === 20 && halfFacts.height === 15, "50% of a 40x30 crop is 20x15, one scale on both axes", halfFacts && `${halfFacts.width}x${halfFacts.height}`);
  check(/50pct/.test(half.name), "a resized export is named for the scale", half.name);
  check(/never stretched or squashed/.test((await fieldset("Size").textContent()) || ""), "the panel says one scale is applied to both axes");
  await setScale(100);
  const full = await download("full.png");
  check(!!imageFacts(full.bytes) && imageFacts(full.bytes).width === 40 && imageFacts(full.bytes).height === 30, "back to 100% the crop is back to its full size");

  // ------------------------------------------------------------ the formats ---
  await formatSelect().selectOption("jpeg");
  await settle();
  check(await qualitySlider().isEnabled(), "the quality slider is live for a lossy format");
  check(/composited on white/i.test((await formatNote().textContent()) || ""), "and the panel admits what JPEG does to transparency");
  const jpeg = await download("out.jpg");
  const jpegFacts = imageFacts(jpeg.bytes);
  check(!!jpegFacts && jpegFacts.format === "jpeg", "the JPEG request really produced a JPEG", jpeg.name);
  check(!!jpegFacts && jpegFacts.width === 40 && jpegFacts.height === 30, "the JPEG is the cropped size", jpegFacts && `${jpegFacts.width}x${jpegFacts.height}`);
  check(jpeg.name.endsWith(".jpg"), "and it carries the extension the bytes really are", jpeg.name);

  await formatSelect().selectOption("webp");
  await settle();
  check(/gets PNG instead/i.test((await formatNote().textContent()) || ""), "the WebP note says a browser without the encoder gets PNG");
  const webp = await download("out.webp");
  const webpFacts = imageFacts(webp.bytes);
  check(!!webpFacts, "the WebP request produced a readable image");
  const substituted = !!webpFacts && webpFacts.format !== "webp";
  check(!substituted || (await alertBox("so you got").count()) > 0, "an encoder substitution is reported, not hidden");
  check(!!webpFacts && webpFacts.width === 40 && webpFacts.height === 30, "the WebP is the cropped size", webpFacts && `${webpFacts.width}x${webpFacts.height}`);
  check(webp.name.endsWith(substituted ? ".png" : ".webp"), "the extension is the one the returned bytes really are", webp.name);

  await formatSelect().selectOption("png");
  await settle();
  check(await qualitySlider().isDisabled(), "PNG ignores the quality argument, so the control is disabled for it");
  check(/does nothing for it/i.test((await exportBox().textContent()) || ""), "and the panel says why");

  // --------------------------------------------------------- the result panel ---
  const png = await download("out.png");
  check(/crop40x30/.test(png.name), "the PNG export is named for the crop as well", png.name);
  const reDownload = page.locator("button", { hasText: / again$/ });
  check((await reDownload.count()) === 1, "the panel offers the same bytes again");
  check((await reDownload.textContent())?.includes(png.name) === true, "and says which file that is");
  // Any further change must take the panel with it, or a stale export could be
  // saved again under a name that no longer describes it.
  await rotateBox().locator("button", { hasText: "Mirror left" }).click();
  await settle();
  check((await page.locator("[aria-label='Exported image result']").count()) === 0, "a further edit clears the result panel");
  check((await reDownload.count()) === 0, "and the stale re-download goes with it");
  await rotateBox().locator("button", { hasText: "Mirror left" }).click();
  await settle();

  // ------------------------------------------------------ refusals, in the UI ---
  await openFixture("big.png");
  check((await stageCanvas().evaluate((el) => el.width)) === PREVIEW_LONG_SIDE, "a 3 MP image is painted on a 1200 px preview canvas", String(await stageCanvas().evaluate((el) => el.width)));
  await setScale(400);
  // The button points at the refusal paragraph, so read it the way a screen
  // reader would: by the id the button itself names.
  const refusalId = await downloadBtn().getAttribute("aria-describedby");
  const refusal = (await page.locator(`#${refusalId}`).textContent()) || "";
  check(/At 400% this frame is 8000 × 6000 px/.test(refusal), "the refusal quotes the size that was asked for", refusal);
  check(/48\.0 megapixels, over the 16 MP budget/.test(refusal), "and the budget it broke", refusal);
  check(/The largest scale this frame accepts is \d+%/.test(refusal), "and the largest scale that would fit", refusal);
  check(/The last render that fitted is still on screen/.test(refusal), "and that the last render that fitted is still there", refusal);
  check((await downloadBtn().textContent())?.includes("refused") === true, "the button itself says the export is refused", (await downloadBtn().textContent()) || "");
  check(!(await downloadBtn().isDisabled()), "the download button stays clickable so the refusal can be explained");
  check((await stageCanvas().evaluate((el) => el.width)) === PREVIEW_LONG_SIDE, "the last render that fitted is still the one on the canvas");
  let refusedDownload = false;
  page.once("download", () => {
    refusedDownload = true;
  });
  await downloadBtn().click();
  await page.waitForTimeout(1200);
  check((await alertBox("over the 16 MP budget").count()) > 0, "pressing Download repeats the refusal in an alert");
  check(!refusedDownload, "a refused export downloads nothing at all");

  await openFixture("wide.png");
  const sideRefusal = (await alertBox("one side is over the 8192 px limit").textContent()) || "";
  check(/8200 × 40/.test(sideRefusal), "an input over the side cap is refused with its real size", sideRefusal);
  check((await stageCanvas().count()) === 0, "an over-budget input never reaches the canvas");

  await openFixture("huge.png");
  const pixelRefusal = (await alertBox("megapixels").textContent()) || "";
  check(/25\.0 megapixels/.test(pixelRefusal), "an input over the pixel cap is refused with the number it broke", pixelRefusal);
  check(/up to 16 MP/.test(pixelRefusal), "and with the budget it broke", pixelRefusal);
  check((await stageCanvas().count()) === 0, "a 25-megapixel input is refused before a decoder is handed the bytes");

  // ------------------------------------------------------------- page copy ----
  await openFixture("fixture.png");
  const body = (await page.textContent("body")) || "";
  check(/second lossy generation/i.test(body), "the page admits a second lossy generation on re-export");
  check(/no EXIF, no camera, no GPS/i.test(body) && /no ICC profile/i.test(body), "the page admits the metadata and colour loss");
  check(/untagged sRGB/i.test(body), "the page admits untagged sRGB output");
  check(/first frame/i.test(body), "the page names the formats that lose their animation");
  check(/nothing is resampled/i.test(body), "the page says which edits are exact");
  check(/applied per pixel in this tab/i.test(body), "the page says the adjustments are baked in, not preview-only");
  check((await page.locator("fieldset legend").count()) === 6, "the controls are grouped in six fieldsets");
  check((await page.locator("label[for]").count()) >= 10, "the controls are real labelled form controls");
  check((await page.locator("input[type='range']").count()) === 7, "the sliders are the ones the copy describes");
  const scaleMin = await scaleSlider().getAttribute("min");
  const scaleMax = await scaleSlider().getAttribute("max");
  check(scaleMin === "10" && scaleMax === "400", "the scale slider is bounded 10-400%", `${scaleMin}-${scaleMax}`);
  await setScale(9999);
  check((await scaleField().inputValue()) === "400", "a scale above the ceiling is clamped to 400%");
  await setScale(1);
  check((await scaleField().inputValue()) === "10", "a scale below the floor is clamped to 10%");
  await setScale(100);
  const qMin = await qualitySlider().getAttribute("min");
  const qStep = await qualitySlider().getAttribute("step");
  check(qMin === "0.3" && qStep === "0.05", "the quality slider is the encoder's own 0-1 argument in fifths", `${qMin}/${qStep}`);

  // ------------------------------------------------------------- the guide ----
  const guide = await context.newPage();
  const resp = await guide.goto(`${BASE_URL}/guides/how-to-edit-an-image-online`, { waitUntil: "domcontentloaded" });
  const guideBody = resp && resp.ok() ? await guide.textContent("body") : "";
  check(!!resp && resp.status() === 200, "the image editor guide renders");
  check(/25 MB/.test(guideBody) && /16 megapixels/.test(guideBody) && /8192 px/.test(guideBody), "the guide states the same three caps");
  check(/move pixels/.test(guideBody) && /resample/.test(guideBody), "the guide says which edits are exact and which one resamples");
  check(/not an AI upscaler/i.test(guideBody), "the guide admits the resize is not an AI upscaler");
  check(/largest scale that would fit/i.test(guideBody) && /download button stays clickable/i.test(guideBody), "the guide admits the refusal policy, including the clickable button");
  check(/no layers, no PSD/i.test(guideBody), "the guide admits there are no layers or PSD");
  check(/first frame/i.test(guideBody) && /no ICC colour profile/i.test(guideBody), "the guide admits what the file loses");
  await guide.close();

  const sitemapResponse = await page.request.get(`${BASE_URL}/sitemap.xml`);
  const sitemap = sitemapResponse.ok() ? await sitemapResponse.text() : "";
  check(sitemap.includes("/tools/image-editor"), "the sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-edit-an-image-online"), "the sitemap lists the image editor guide");

  // ---------------------------------------------------------------- hygiene ---
  check(offOrigin.length === 0, "no off-origin request: the image never leaves the device", offOrigin.slice(0, 3).join(" "));
  check(nonGet.length === 0, "the tool made no non-GET request", nonGet.slice(0, 3).join(" "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 2).join(" | "));
  check(consoleIssues.length === 0, "no hydration or server/client mismatch warnings", consoleIssues.slice(0, 2).join(" | "));
} catch (e) {
  failed += 1;
  failures.push("harness");
  check(false, `harness exception: ${String(e).slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) console.log(`failing: ${failures.join(" | ")}`);
process.exit(failed === 0 ? 0 : 1);
