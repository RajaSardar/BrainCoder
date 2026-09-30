// Production-Chrome e2e for the "Image OCR" tool.
//
// Mirrors e2e/pdf-ocr-browser.mjs and e2e/pdf-scale-pages-browser.mjs: real
// Chrome via playwright-core, the real /use/image-ocr route, and every promise
// the tool makes checked against the network log, the downloaded bytes and the
// DOM rather than trusted from the UI.
//
// The fixture is a PNG built here from real glyph outlines, so the run under
// test is a genuine OCR pass: the English model is fetched from this origin,
// the worker boots, and the recognizer has to return the words that were drawn.
//
//   node e2e/image-ocr-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/image-ocr-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/image-ocr`;
const DL = "/tmp/imageocr";
const require = createRequire(import.meta.url);
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const OCR_TIMEOUT = 240000;

// The shipped byte cap. Asserted against the number the UI actually prints, so
// this literal is checked by the run rather than trusted: if ocr-format.ts ever
// changes MAX_BYTES, the byte-refusal check below fails instead of passing on a
// stale copy of the number.
const MAX_BYTES = 25 * 1024 * 1024;

// --------------------------------------------------------------------------
// fixtures
// --------------------------------------------------------------------------
// receipt.png    — two lines of real rendered text, ~300 DPI-ish
// square.png     — a tiny but perfectly valid 40x40 PNG
// notapng.txt    — plain text with an .png name
// truncated.png  — a PNG signature and nothing else
// widelimit.png  — a valid header declaring 9000x100 (over the side cap)
// pixelcap.png   — a valid header declaring 5000x5000 (over the pixel cap)
// huge.png       — a genuinely valid 600x600 PNG, padded past the byte cap

// --- a real PNG encoder, so the fixture under test is a genuine image ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, gray) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) raw[y * (width + 1) + 1 + x] = gray[y * width + x];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Rasterizes real glyph outlines from the Liberation Sans that ships with
 * pdfjs-dist, by flattening each outline and scanline-filling it. A hand-drawn
 * 5x7 bitmap was tried first and the recognizer returned nonsense for it, so
 * the fixture uses a typeface the engine has actually seen.
 */
function renderText(lines, sizePx, gap = Math.round(sizePx * 0.45)) {
  const fontkit = require("@pdf-lib/fontkit");
  const font = fontkit.create(readFileSync("node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"));
  const scale = sizePx / font.unitsPerEm;

  const trace = (path) => {
    const pts = [];
    let cx = 0, cy = 0, sx = 0, sy = 0;
    const line = (x, y) => pts.push([x, y]);
    for (const c of path.commands) {
      const a = c.args;
      if (c.command === "moveTo") { cx = sx = a[0]; cy = sy = a[1]; line(cx, cy); }
      else if (c.command === "lineTo") { cx = a[0]; cy = a[1]; line(cx, cy); }
      else if (c.command === "quadraticCurveTo") {
        const x0 = cx, y0 = cy;
        for (let i = 1; i <= 16; i += 1) { const t = i / 16, m = 1 - t; line(m * m * x0 + 2 * m * t * a[0] + t * t * a[2], m * m * y0 + 2 * m * t * a[1] + t * t * a[3]); }
        cx = a[2]; cy = a[3];
      } else if (c.command === "bezierCurveTo") {
        const x0 = cx, y0 = cy;
        for (let i = 1; i <= 16; i += 1) { const t = i / 16, m = 1 - t; line(m ** 3 * x0 + 3 * m * m * t * a[0] + 3 * m * t * t * a[2] + t ** 3 * a[4], m ** 3 * y0 + 3 * m * m * t * a[1] + 3 * m * t * t * a[3] + t ** 3 * a[5]); }
        cx = a[4]; cy = a[5];
      } else if (c.command === "closePath") { line(sx, sy); cx = sx; cy = sy; }
    }
    return pts;
  };

  const rows = lines.map((text) => {
    const run = font.layout(text);
    const polys = [];
    let pen = 0;
    for (let i = 0; i < run.glyphs.length; i += 1) {
      const g = run.glyphs[i];
      const pos = run.positions[i] ?? {};
      const dx = pen + (pos.xOffset ?? 0);
      const dy = pos.yOffset ?? 0;
      pen += pos.xAdvance ?? 0;
      if (!g.path) continue;
      polys.push(trace(g.path).map(([x, y]) => [(x + dx) * scale, -(y + dy) * scale]));
    }
    return polys;
  });

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const linePolys of rows) for (const p of linePolys) for (const [x, y] of p) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pad = Math.round(sizePx * 0.6);
  const lineH = maxY - minY;
  const w = Math.ceil(maxX - minX) + pad * 2;
  const h = Math.ceil(lineH * rows.length + gap * (rows.length - 1)) + pad * 2;
  const gray = new Uint8Array(w * h).fill(255);
  const edges = [];
  rows.forEach((polys, r) => {
    const yShift = minY - r * (lineH + gap);
    for (const p of polys) for (let i = 0; i < p.length; i += 1) {
      const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
      const ay = y1 - yShift + pad, by = y2 - yShift + pad;
      if (ay !== by) edges.push([x1 - minX + pad, ay, x2 - minX + pad, by]);
    }
  });
  for (let y = 0; y < h; y += 1) {
    const sy = y + 0.5;
    const xs = [];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil(xs[i] - 0.5));
      const to = Math.min(w - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = from; x <= to; x += 1) gray[y * w + x] = 0;
    }
  }
  return { w, h, gray };
}

const WORD = "INVOICE";
const SECOND = "TOTAL 42";
const fixture = renderText([WORD, SECOND], 84);
const fixturePng = encodePng(fixture.w, fixture.h, fixture.gray);
writeFileSync(`${DL}/receipt.png`, fixturePng);

const square = encodePng(40, 40, new Uint8Array(40 * 40).fill(255));
writeFileSync(`${DL}/square.png`, square);

writeFileSync(`${DL}/notapng.txt`, "this is plain text wearing a .png name\nand a second line\n");
writeFileSync(`${DL}/truncated.png`, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

/** A file that is only a header: enough for the tool to measure it, not to decode it. */
function headerOnlyPng(width, height) {
  const b = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
writeFileSync(`${DL}/widelimit.png`, headerOnlyPng(9000, 100));
writeFileSync(`${DL}/pixelcap.png`, headerOnlyPng(5000, 5000));
// A real PNG (real signature, real IHDR, real IDAT) carried past the cap, so
// the byte refusal is proven to fire before any header parse or decode rather
// than because the file is also an invalid image.
const hugePng = encodePng(600, 600, new Uint8Array(600 * 600).fill(255));
const HUGE_BYTES = hugePng.length + 26 * 1024 * 1024;
writeFileSync(`${DL}/huge.png`, Buffer.concat([hugePng, Buffer.alloc(HUGE_BYTES - hugePng.length)]));

// --------------------------------------------------------------------------
// browser
// --------------------------------------------------------------------------
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
function check(ok, label, extra = "") {
  if (ok) {
    passed++;
    console.log(`ok  ${label}`);
  } else {
    failed++;
    console.error(`NOT OK  ${label}${extra ? " — " + String(extra).slice(0, 300) : ""}`);
  }
}

const consoleIssues = [];
const pageErrors = [];
const offOrigin = [];
const nonGet = [];
const engineRequests = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("request", (r) => {
  const url = r.url();
  if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) offOrigin.push(url);
  if (r.method() !== "GET") nonGet.push(`${r.method()} ${url}`);
  if (/\/ocr\//.test(url)) engineRequests.push(url);
});

// Next.js injects an empty [role=alert] route announcer — filter on real text.
const alert = (t) => page.locator("[role='alert']").filter({ hasText: t });
const status = (t) => page.locator("[role='status']").filter({ hasText: t });
const fileInput = () => page.locator("input[type='file']");
const languageSelect = () => page.locator("select");
const extractBtn = () => page.locator("button", { hasText: /^Extract text/ });
const resultRegion = () => page.locator("[role='region']", { hasText: /Text read|Nothing read/ });
const clip = () => page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));

/** Watch aria-busy and the engine's progress lines across a whole run. */
async function watchRun() {
  await page.evaluate(() => {
    window.__ocr = { busy: false, progress: [] };
    const root = document.querySelector("[aria-busy]");
    const mo = new MutationObserver(() => {
      if (root && root.getAttribute("aria-busy") === "true") window.__ocr.busy = true;
      const text = document.body.textContent || "";
      for (const re of [
        /Loading the OCR engine from this site/,
        /Starting the OCR engine/,
        /Loading the English model/,
        /Preparing the English recognizer/,
        /Reading the text/,
      ]) {
        if (re.test(text) && !window.__ocr.progress.some((s) => re.test(s))) window.__ocr.progress.push(text.match(re)[0]);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    window.__ocrMo = mo;
  });
}
const readWatch = () =>
  page.evaluate(() => {
    window.__ocrMo?.disconnect();
    return window.__ocr;
  });

try {
  // ---------------------------------------------------------------- idle ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("label", { hasText: /Open image/ }).waitFor({ state: "visible", timeout: 15000 });

  check(
    (await fileInput().getAttribute("aria-label")) === "Choose an image to read text from",
    "file input carries an accessible name",
  );
  check((await fileInput().getAttribute("accept")) === "image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif,image/webp,.webp,image/bmp,.bmp", "the accept attribute names all five formats");
  check((await page.locator("[aria-busy]").first().getAttribute("aria-busy")) === "false", "root is not busy at rest");
  check((await extractBtn().count()) === 0, "there is no Extract button before an image is chosen");
  check((await languageSelect().count()) === 0, "there is no language picker before an image is chosen");
  check((await resultRegion().count()) === 0, "there is no result region before a run");
  const idle = (await status(/never uploaded/).first().textContent()) || "";
  check(
    idle.includes("never uploaded") && idle.includes("PNG, JPEG, GIF, WebP or BMP"),
    "the idle line names the accepted formats and says the image is not uploaded",
    idle,
  );
  check(
    (await page.locator("label", { hasText: /Open image/ }).first().getAttribute("for")) === (await fileInput().getAttribute("id")),
    "the visible opener is a real label bound to the file input",
  );
  check((await page.getAttribute("html", "lang")) === "en", "the document declares a language");
  check(engineRequests.length === 0, "nothing under /ocr/ is fetched before the user asks for a run");

  // -------------------------------------------------------------- upload ---
  await watchRun();
  await fileInput().setInputFiles(`${DL}/receipt.png`);
  await status(/receipt\.png — PNG/).first().waitFor({ timeout: 60000 });
  const loaded = (await status(/receipt\.png — PNG/).first().textContent()) || "";
  check(
    new RegExp(`${fixture.w.toLocaleString("en-US")} × ${fixture.h.toLocaleString("en-US")}`).test(loaded),
    "the info line reports the image's real header dimensions",
    loaded,
  );
  check(/PNG/.test(loaded) && /\d+(\.\d+)? (B|KB)/.test(loaded), "the info line names the format and the real file size", loaded);
  check((await alert(/\S/).count()) === 0, "no error surfaced for a valid PNG");
  check((await extractBtn().count()) === 1, "the Extract button appears once an image is loaded");
  check((await languageSelect().count()) === 1, "the language picker appears with the image");

  // ------------------------------------------------------------ controls ---
  const langOptions = await languageSelect().locator("option").allTextContents();
  check(langOptions.length === 12, `all twelve languages are offered (found ${langOptions.length})`);
  check(
    ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Russian", "Hindi", "Arabic", "Chinese (simplified)", "Japanese", "Korean"].every((l) =>
      langOptions.some((o) => o.startsWith(l)),
    ),
    "the twelve languages are the ones the copy advertises",
    langOptions.join(" | "),
  );
  check((await languageSelect().inputValue()) === "eng", "English is the default");
  const langLabel = await page.locator(`label[for="${await languageSelect().getAttribute("id")}"]`).textContent();
  check(/Language/.test(langLabel || ""), "the language select has a real bound label");
  const noteId = await languageSelect().getAttribute("aria-describedby");
  // React's useId() emits colons (":r3:"), which are not valid in a bare CSS id
  // selector, so target the id by attribute instead.
  const noteEl = noteId ? page.locator(`[id="${noteId}"]`) : null;
  const note = noteEl ? ((await noteEl.textContent()) || "") : "";
  check(/12 languages/.test(note || ""), "the language note says how many models there are", note);
  check(/2\.8 MB/.test(note || ""), "the language note shows the English model's real download size", note);
  check(/own origin|from this site/i.test(note || ""), "the language note says the model comes from this origin", note);
  check(/never uploaded/.test((await page.getByText(/Read on this device/).textContent()) || ""), "the panel states the image is never uploaded");
  const limits = (await page.locator("p", { hasText: /What this is:/ }).textContent()) || "";
  check(/25 MB/.test(limits) && /16 MP/.test(limits) && /8192 px/.test(limits), "the limits box quotes the three real caps", limits.slice(0, 200));
  check(/refused with its real numbers/.test(limits), "the limits box says the caps are refusals, not adjustments");
  check(/handwriting/.test(limits) && /downsampled by the engine/.test(limits) && /EXIF rotation is not applied/.test(limits), "the limits box names the three real failure modes");
  check(/Nothing here is a measurement of how much of your text is right/.test(limits), "the limits box refuses to call the output accurate");
  check((await page.locator("img[alt^='Preview of']").count()) === 1, "the preview has a descriptive alt that names the file and its size");

  // keyboard: the select is reachable and changes the run's language
  await languageSelect().focus();
  await languageSelect().selectOption("deu");
  check((await languageSelect().inputValue()) === "deu", "the language can be changed by keyboard");
  const deuNote = (await noteEl.textContent()) || "";
  check(/1\.3 MB/.test(deuNote || ""), "the note updates to the German model's real size", deuNote);
  await languageSelect().selectOption("eng");
  check((await extractBtn().textContent()).includes("Extract text — English"), "the action button names the language it will use");

  // ------------------------------------------------------ refusals first ---
  // Done before the happy path so a refused file cannot leave a stale worker.
  await fileInput().setInputFiles(`${DL}/notapng.txt`);
  await alert(/not a PNG, JPEG, GIF, WebP or BMP image/).first().waitFor({ timeout: 60000 });
  const fakeMsg = (await alert(/not a PNG, JPEG, GIF, WebP or BMP image/).first().textContent()) || "";
  check(/notapng\.txt/.test(fakeMsg), "the format refusal names the file that was refused", fakeMsg);
  check(/Convert it first/.test(fakeMsg), "the format refusal says what to do next", fakeMsg);
  const convertHref = await alert(/Convert it first/).first().locator("a").getAttribute("href").catch(() => null);
  check(convertHref === "/use/image-format-converter", "the format refusal routes to Image Format Converter", String(convertHref));
  check((await extractBtn().count()) === 0, "a refused file leaves no Extract button behind");

  await fileInput().setInputFiles(`${DL}/truncated.png`);
  await alert(/does not declare a readable size/).first().waitFor({ timeout: 60000 });
  check((await alert(/does not declare a readable size/).count()) === 1, "a PNG with no readable header is refused by name");

  await fileInput().setInputFiles(`${DL}/widelimit.png`);
  await alert(/9000 × 100/).first().waitFor({ timeout: 60000 });
  const sideMsg = (await alert(/9000 × 100/).first().textContent()) || "";
  check(/8192 px/.test(sideMsg), "the long-side refusal quotes the real limit", sideMsg);
  check(/9000 × 100/.test(sideMsg) && /Resize it to 8192 px/.test(sideMsg), "the long-side refusal quotes the file's real dimensions and the fix", sideMsg);

  await fileInput().setInputFiles(`${DL}/pixelcap.png`);
  await alert(/25\.0 megapixels/).first().waitFor({ timeout: 60000 });
  const pxMsg = (await alert(/25\.0 megapixels/).first().textContent()) || "";
  check(/16 MP/.test(pxMsg) && /Resize it down/.test(pxMsg), "the pixel refusal quotes the real budget and the fix", pxMsg);
  check((await page.locator("p", { hasText: /refused with its real numbers/ }).count()) === 0, "a refused file leaves no stale limits box behind");

  await fileInput().setInputFiles(`${DL}/huge.png`);
  await alert(/supported here/).first().waitFor({ timeout: 120000 });
  const sizeMsg = (await alert(/supported here/).first().textContent()) || "";
  check(/25 MB/.test(sizeMsg) && sizeMsg.includes(HUGE_BYTES.toLocaleString("en-US")), "the byte refusal quotes the file's exact byte count and the real cap", sizeMsg);
  check(sizeMsg.includes(MAX_BYTES.toLocaleString("en-US")), "the byte refusal prints the cap in bytes too, so 25.0 MB is explainable", sizeMsg);

  check(engineRequests.length === 0, "no engine, worker or model was fetched for any refused file");

  // ------------------------------------------------------------- happy path ---
  await fileInput().setInputFiles(`${DL}/receipt.png`);
  await status(/receipt\.png — PNG/).first().waitFor({ timeout: 60000 });
  const t0 = Date.now();
  const [dl1] = await Promise.all([page.waitForEvent("download", { timeout: OCR_TIMEOUT }), extractBtn().click()]);
  await dl1.saveAs(`${DL}/result.txt`);
  const watch1 = await readWatch();
  await resultRegion().waitFor({ timeout: 60000 });

  check(watch1.busy, "aria-busy flipped to true while the engine ran");
  check(
    watch1.progress.length >= 3,
    `the engine's own stages were announced (saw ${watch1.progress.length})`,
    watch1.progress.join(" | "),
  );
  check(
    watch1.progress.some((s) => /Loading the English model/.test(s)) && watch1.progress.some((s) => /Reading the text/.test(s)),
    "the model-loading and recognizing stages both reached the screen",
    watch1.progress.join(" | "),
  );

  check(dl1.suggestedFilename() === "receipt-ocr-eng.txt", "the download is named <source>-ocr-<lang>.txt", dl1.suggestedFilename());
  const ocrText = readFileSync(`${DL}/result.txt`, "utf8");
  check(
    new RegExp(WORD, "i").test(ocrText),
    "the recognizer really read the first line out of the fixture",
    JSON.stringify(ocrText.slice(0, 80)),
  );
  check(/TOTAL\s*42/i.test(ocrText), "the recognizer really read the second line too", JSON.stringify(ocrText.slice(0, 80)));
  check(!/\f/.test(ocrText), "no form feed survives into the downloaded text");
  check(!/[ \t]+$/m.test(ocrText), "no line ends in trailing whitespace");
  check(Buffer.compare(Buffer.from(ocrText), Buffer.from((await resultRegion().locator("pre").textContent()) || "")) === 0, "the downloaded bytes are the text on screen");

  const regionText = (await resultRegion().textContent()) || "";
  check(/Text read/.test(regionText), "the result region is labelled");
  check(/Characters/.test(regionText) && /Words/.test(regionText) && /Lines/.test(regionText) && /Time/.test(regionText), "the result region reports counts and the elapsed time");
  check(/The engine reported \d+% confidence/.test(regionText), "the result region reports the engine's own confidence");
  check(/not a measurement of how much of the text is correct/.test(regionText), "the confidence is explicitly not a correctness claim");
  check(
    ["high", "fair", "low"].some((b) => regionText.includes(`${b} (`)),
    "the confidence arrives with a plain-language band",
    regionText.slice(0, 300),
  );

  // the same engine that produced the download is the one the UI shows
  const shown = await resultRegion().locator("pre").textContent();
  check(shown.trim() === ocrText.trim(), "the text pane and the downloaded file are the same text");

  // ---------------------------------------------------------------- copy ---
  await resultRegion().locator("button[aria-label='Copy the extracted text']").click();
  const copied = await clip();
  check(copied === shown, "Copy puts exactly the displayed text on the clipboard", JSON.stringify(copied.slice(0, 60)));

  // -------------------------------------------------------- re-download ---
  const [dl2] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    resultRegion().locator("button", { hasText: /Download receipt-ocr-eng\.txt again/ }).click(),
  ]);
  await dl2.saveAs(`${DL}/again.txt`);
  check(dl2.suggestedFilename() === "receipt-ocr-eng.txt", "the re-download keeps the same name", dl2.suggestedFilename());
  check(
    Buffer.compare(readFileSync(`${DL}/result.txt`), readFileSync(`${DL}/again.txt`)) === 0,
    "the re-download is byte-identical to the first one",
  );

  // ------------------------------------------------------------ clear ---
  await page.locator("button", { hasText: /^Clear$/ }).click();
  check((await resultRegion().count()) === 0, "Clear drops the result");
  check((await extractBtn().count()) === 0, "Clear drops the image and its Extract button");
  check((await page.locator("img[alt^='Preview of']").count()) === 0, "Clear releases the preview");
  check((await page.locator("label", { hasText: /Open image/ }).count()) === 1, "the opener goes back to Open image");

  // ------------------------------------------------- second language run ---
  // Uses the same fixture, so it is the same reading, filed under a new name.
  await fileInput().setInputFiles(`${DL}/receipt.png`);
  await status(/receipt\.png — PNG/).first().waitFor({ timeout: 60000 });
  await languageSelect().selectOption("spa");
  const [dl3] = await Promise.all([page.waitForEvent("download", { timeout: OCR_TIMEOUT }), extractBtn().click()]);
  await dl3.saveAs(`${DL}/result-es.txt`);
  check(dl3.suggestedFilename() === "receipt-ocr-spa.txt", "a second run in another language is filed under its own name", dl3.suggestedFilename());
  const esStatus = (await status(/Read .* characters/).first().textContent()) || "";
  check(/Spanish model/.test(esStatus), "the success line names the model that actually ran", esStatus);
  check(/receipt-ocr-spa\.txt/.test(esStatus), "the success line names the file that was written", esStatus);

  // ------------------------------------------------- a blank image is a result ---
  await fileInput().setInputFiles(`${DL}/square.png`);
  await status(/square\.png — PNG/).first().waitFor({ timeout: 60000 });
  await extractBtn().click();
  const blankRegion = page.locator("[role='region']", { hasText: /Text read|Nothing read/ });
  await blankRegion.waitFor({ timeout: OCR_TIMEOUT });
  check(/Nothing read/.test((await blankRegion.textContent()) || ""), "a blank image is reported as a result, not as a failure");
  check(/No text was recognized/.test((await blankRegion.textContent()) || ""), "the empty result explains itself");
  check(/straighter/.test((await blankRegion.textContent()) || ""), "the empty result says what to try");
  check((await blankRegion.locator("pre").count()) === 0, "an empty result shows no text pane to copy");

  // -------------------------------------------------------------- 375px ----
  await page.setViewportSize({ width: 375, height: 720 });
  await fileInput().setInputFiles(`${DL}/receipt.png`);
  await status(/receipt\.png — PNG/).first().waitFor({ timeout: 60000 });
  const overflow = await page.evaluate(() => {
    const m = document.querySelector("main#main");
    return m ? m.scrollWidth - m.clientWidth : document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  check(overflow <= 1, "the tool fits a 375px viewport without horizontal overflow", String(overflow));
  await page.setViewportSize({ width: 1280, height: 900 });

  // ------------------------------------------------ engine, on this origin ---
  check(
    engineRequests.some((u) => /\/ocr\/worker\.min\.js$/.test(u)),
    "the OCR worker was fetched from this origin",
    engineRequests.slice(0, 3).join(" "),
  );
  check(
    engineRequests.some((u) => /\/ocr\/tesseract-core[^/]*\.js$/.test(u)),
    "the WebAssembly core was fetched from this origin",
  );
  check(
    engineRequests.some((u) => /\/ocr\/traineddata\/eng\.traineddata(\.gz)?$/.test(u)),
    "the English model was fetched from this origin",
  );
  check(
    engineRequests.every((u) => u.startsWith(BASE_URL)),
    "every engine asset came from this origin",
    engineRequests.filter((u) => !u.startsWith(BASE_URL)).slice(0, 3).join(" "),
  );
  check(!/jsdelivr|unpkg|cdnjs|tessdata/.test(engineRequests.join(" ")), "no CDN host appears in the engine's requests");

  // ----------------------------------------------------- honest page copy ---
  const toolPage = await page.request.get(`${BASE_URL}/tools/image-ocr`);
  const rawToolBody = toolPage.ok() ? (await toolPage.text()) : "";
  const toolBody = rawToolBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // The tool page also carries the shared nav rail and the RSC flight payload,
  // which quote OTHER tools' taglines ("Resize images pixel-perfect"). The
  // accuracy sweep must judge this tool's own copy, so it runs on the slice
  // from this tool's heading to the related-tools rail, with the escaped
  // script payload dropped.
  const railAt = toolBody.indexOf("Related");
  const headingAt = toolBody.lastIndexOf("Image OCR", railAt > 0 ? railAt : undefined);
  const ownCopy = toolBody.slice(headingAt > 0 ? headingAt : 0, railAt > 0 ? railAt : undefined);
  check(toolPage.status() === 200, "the image-ocr tool page renders");
  check(/25 MB/.test(toolBody) && /16 (MP|megapixel)/.test(toolBody) && /8192 px/.test(toolBody), "tool page copy states the three real caps");
  check(/12 languages/.test(toolBody) || /12 models/.test(toolBody), "tool page copy states the language count");
  check(!/no upload limits/i.test(toolBody), "the old 'no upload limits' promise is gone from the page");
  check(!/identify and extract all readable text/i.test(toolBody), "the old 'all readable text' claim is gone from the page");
  check(!/provides fast, private, and accurate/i.test(toolBody), "the old accuracy claim is gone from the page");
  check(/EXIF rotation is not applied/i.test(toolBody), "the page discloses that EXIF rotation is not applied");
  check(/downsampl/i.test(toolBody), "the page discloses engine downsampling");
  // The only accuracy words allowed to survive are a negation or the FAQ's own
  // question ("How accurate is this?"), which asks rather than claims.
  const accuracyClaims = ownCopy.match(/(?<!how )(?<!not )(?<!isn')(?<!never )(?<!t )\b(accurate|flawless|perfect|all text|every text)\b/gi) || [];
  check(accuracyClaims.length === 0, "no leftover claim of accuracy anywhere on the page", accuracyClaims.join(" | "));

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-ocr-an-image`);
  const guideBody = guide.ok()
    ? (await guide.text()).replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ")
    : "";
  check(guide.status() === 200, "the image-ocr guide renders");
  check(/What OCR is/.test(guideBody), "guide opens on what OCR actually does");
  check(/25 MB/.test(guideBody) && /16[- ]megapixel/.test(guideBody) && /8192 px/.test(guideBody), "guide states all three caps");
  check(/EXIF rotation is not applied/.test(guideBody), "guide discloses the EXIF limitation");
  check(/downsampl/i.test(guideBody), "guide explains the engine downsampling large photos");
  check(/does not do handwriting|do handwriting/i.test(guideBody), "guide says handwriting is out of scope");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/image-ocr"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-ocr-an-image"), "sitemap lists the image-ocr guide");

  // ------------------------------------------------------------- hygiene ---
  check(offOrigin.length === 0, "no off-origin request: the image and the engine both stay local", offOrigin.slice(0, 3).join(" "));
  check(nonGet.length === 0, "no non-GET request was made by the tool", nonGet.slice(0, 3).join(" "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 2).join(" | "));
  check(consoleIssues.length === 0, "no hydration or server/client mismatch warnings", consoleIssues.slice(0, 2).join(" | "));
  console.log(`\n(run took ${Math.round((Date.now() - t0) / 1000)}s of engine time)`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e?.message ?? e)?.slice(0, 500)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
