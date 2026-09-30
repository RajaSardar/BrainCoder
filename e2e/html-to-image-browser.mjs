// Production-Chrome e2e for the "HTML to Image" tool.
//
// Mirrors e2e/pdf-scale-pages-browser.mjs: real Chrome via playwright-core, the
// real /use/html-to-image route, fixtures written to a temp dir, and every
// downloaded file re-parsed from its own header bytes to prove the promise —
// that the image really is the width the projection claimed, in the format that
// was requested — rather than trusting a line of UI text.
//
//   node e2e/html-to-image-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/html-to-image-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/html-to-image`;
const DL = "/tmp/htmltoimage";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const MAX_INPUT_BYTES = 200 * 1024;
const MAX_SIDE_PX = 8192;
const MAX_OUTPUT_PX = 16_000_000;
const DEFAULT_WIDTH = 480;

// --------------------------------------------------------------------------
// fixtures
// --------------------------------------------------------------------------
// card.html      — a small deterministic card, ~480 px wide
// wide.html      — 2000 px wide content, wider than any allowed capture box
// hostile.html   — script, inline SVG, handlers, javascript: URLs
// huge.html      — one byte over the input cap
{
  writeFileSync(
    `${DL}/card.html`,
    `<!DOCTYPE html><html><head><style>
       .card { border: 2px solid #1e293b; border-radius: 12px; padding: 16px;
               background: linear-gradient(180deg,#ffffff,#e2e8f0); font-family: sans-serif; }
       h1 { font-size: 20px; margin: 0 0 8px; }
       .pill { display: inline-block; background: #4f46e5; color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
     </style></head><body>
       <div class="card" style="width:440px">
         <h1>Invoice 4821</h1>
         <p>Quarterly subscription — 3 seats.</p>
         <span class="pill">PAID</span>
       </div>
     </body></html>`,
  );

  writeFileSync(
    `${DL}/wide.html`,
    `<div style="width:2000px;height:120px;background:#e2e8f0">This box is 2000 CSS pixels wide.</div>`,
  );

  writeFileSync(
    `${DL}/hostile.html`,
    `<div id="root" style="width:300px">
       <p onclick="alert(1)">handler goes</p>
       <a href="javascript:alert(2)">link text stays</a>
       <img src="x" onerror="alert(3)" alt="a">
       <script>alert(4)</script>
       <svg><animate onbegin="alert(5)"/></svg>
       <iframe src="http://elsewhere.test/"></iframe>
       <form><input name="x"><button>go</button></form>
       <p style="width:expression(alert(6))">styled</p>
       <span data-keep="1" aria-label="kept">survivor</span>
     </div>`,
  );

  const unit = "<p>line of body copy to reach the cap</p>\n";
  writeFileSync(`${DL}/huge.html`, unit.repeat(Math.ceil((MAX_INPUT_BYTES + 64) / unit.length)));
}

// --------------------------------------------------------------------------
// image header parsers — the file is the proof, not the UI
// --------------------------------------------------------------------------
function parsePng(b) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) if (b[i] !== sig[i]) return null;
  if (b.toString("latin1", 12, 16) !== "IHDR") return null;
  return { format: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function parseJpeg(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null;
    const len = b.readUInt16BE(i + 2);
    // SOF0..SOF15, excluding the DHT/JPG/DAC markers that share the range.
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
    const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { format: "webp", width: w, height: h };
  }
  return { format: "webp", width: 0, height: 0 };
}

function imageFacts(bytes) {
  const b = Buffer.from(bytes);
  return parsePng(b) || parseJpeg(b) || parseWebp(b);
}

// --------------------------------------------------------------------------
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

// Next.js injects an empty [role=alert] route announcer — filter on real text.
const alert = (t) => page.locator("[role='alert']", { hasText: t });
const status = (t) => page.locator("[role='status']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");
const source = () => page.locator("textarea");
const widthField = () => page.locator("input[type='number']").first();
const scaleField = () => page.locator("input[type='number']").nth(1);
const formatSelect = () => page.locator("select");
const captureBtn = () => page.locator("button", { hasText: /Capture \d+ × \d+ CSS px at/ });

async function setSource(text) {
  await source().fill(text);
  await page.waitForTimeout(120);
}

async function setWidth(value) {
  await widthField().fill(String(value));
  await widthField().blur();
  await page.waitForTimeout(150);
}

async function setScale(value) {
  await scaleField().fill(String(value));
  await scaleField().blur();
  await page.waitForTimeout(150);
}

async function openFixture(name) {
  await fileInput().setInputFiles(`${DL}/${name}`);
  await page.waitForTimeout(300);
}

/** Click capture, save the auto-download, and record the busy window we saw. */
async function captureDownload(saveAs, timeout = 120000) {
  await page.evaluate(() => {
    window.__busySeen = false;
    const root = document.querySelector("[aria-busy]");
    const mo = new MutationObserver(() => {
      if (root && root.getAttribute("aria-busy") === "true") window.__busySeen = true;
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.__busyMo = mo;
  });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), captureBtn().click()]);
  await dl.saveAs(`${DL}/${saveAs}`);
  const busySeen = await page.evaluate(() => !!window.__busySeen);
  await page.evaluate(() => window.__busyMo?.disconnect());
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)), busySeen };
}

try {
  // ---------------------------------------------------------------- idle ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  check((await source().inputValue()) === "", "the tool boots empty: no markup is invented");
  check((await source().count()) === 1, "there is exactly one source editor");
  check((await captureBtn().isDisabled()), "capture is disabled with nothing to capture");
  check(
    /Paste HTML or open a \.html file to get started/.test(await status("Paste HTML or open").textContent()),
    "the empty state explains how to start",
  );
  check(
    (await page.locator("[aria-busy]").first().getAttribute("aria-busy")) === "false",
    "root is not busy at rest",
  );
  check(
    /no request is made for your markup/i.test(await page.locator("body").textContent()),
    "the page states the markup is never uploaded",
  );

  // ------------------------------------------------------------- preview ---
  await openFixture("card.html");
  const measured = await status("Measured").textContent();
  const box = /Measured (\d+) × (\d+) CSS px/.exec(measured || "");
  check(!!box, "the preview reports a measured CSS box", measured || "");
  const cssWidth = box ? Number(box[1]) : 0;
  const cssHeight = box ? Number(box[2]) : 0;
  check(cssWidth > 0 && cssHeight > 0, "the measured box has real dimensions", measured || "");
  check(
    /It is a re-draw, not a screen grab/.test(await page.locator("body").textContent()),
    "the page says it re-draws rather than photographs the screen",
  );
  check(
    /does not use an SVG foreignObject/.test(await page.locator("body").textContent()),
    "the page does not claim foreignObject rendering",
  );
  for (const gap of ["filter", "backdrop-filter", "mix-blend-mode", "conic-gradient", "object-fit"]) {
    check((await page.locator("body").textContent()).includes(gap), `the page names the ${gap} gap`);
  }

  // ------------------------------------------------- 1x / 2x / 4x widths ---
  await setScale(1);
  const one = await captureDownload("card-1x.png");
  const f1 = imageFacts(one.bytes);
  check(!!f1, "the 1x file is a real image", `${one.name} ${one.bytes.length}B`);
  check(f1 && f1.width === cssWidth, `1x output is exactly the measured CSS width (${cssWidth})`, f1 && `${f1.width}x${f1.height}`);
  check(one.name === `card-1x.png`, "the file is named from the opened file, the scale and the format", one.name);
  check(one.busySeen, "the capture announced itself through aria-busy");

  await setScale(2);
  const two = await captureDownload("card-2x.png");
  const f2 = imageFacts(two.bytes);
  check(!!f2 && f2.format === "png", "the 2x file is a PNG", two.name);
  check(f2 && f2.width === cssWidth * 2, `2x output is exactly double the CSS width (${cssWidth * 2})`, f2 && `${f2.width}x${f2.height}`);
  check(f2 && f2.height === cssHeight * 2, "2x output is exactly double the CSS height", f2 && `${f2.height}`);

  await setScale(4);
  const four = await captureDownload("card-4x.png");
  const f4 = imageFacts(four.bytes);
  check(!!f4 && f4.width === cssWidth * 4, `4x output is exactly quadruple the CSS width (${cssWidth * 4})`, f4 && `${f4.width}x${f4.height}`);
  check(f4 && f4.pixels === undefined && f4.width * f4.height <= MAX_OUTPUT_PX, "the 4x capture stays inside the pixel budget");
  check(f4 && f4.width <= MAX_SIDE_PX && f4.height <= MAX_SIDE_PX, "the 4x capture stays inside the side limit");

  // --------------------------------------------------------- determinism ---
  await setScale(2);
  const again = await captureDownload("card-2x-again.png");
  const fa = imageFacts(again.bytes);
  check(!!fa && fa.width === f2.width && fa.height === f2.height, "an independent re-capture has the same dimensions");

  // ------------------------------------------------------- the same bytes ---
  const reDl = page.waitForEvent("download", { timeout: 30000 });
  await page.locator("button", { hasText: /Download .* again/ }).click();
  const re = await reDl;
  const rePath = `${DL}/card-redownload.png`;
  await re.saveAs(rePath);
  const reBytes = new Uint8Array(readFileSync(rePath));
  check(re.suggestedFilename() === two.name, "the re-download uses the same name", re.suggestedFilename());
  check(
    reBytes.length === two.bytes.length && reBytes.every((b, i) => b === two.bytes[i]),
    "the re-download is byte-identical to the captured file",
  );

  // -------------------------------------------------------------- formats ---
  for (const [value, expect, ext] of [
    ["jpeg", "jpeg", "jpg"],
    ["webp", "webp", "webp"],
    ["png", "png", "png"],
  ]) {
    await formatSelect().selectOption(value);
    const shot = await captureDownload(`card-2x.${ext}`);
    const facts = imageFacts(shot.bytes);
    check(!!facts && facts.format === expect, `the ${value.toUpperCase()} download really is ${expect.toUpperCase()}`, shot.name);
    check(shot.name.endsWith(`.${ext}`), `the ${value.toUpperCase()} file carries the ${ext} extension`, shot.name);
    check(!!facts && facts.width === cssWidth * 2, `the ${value.toUpperCase()} file is the projected width`, facts && `${facts.width}`);
  }
  await formatSelect().selectOption("png");

  // --------------------------------------------------------- sanitization ---
  await openFixture("hostile.html");
  await page.waitForTimeout(200);
  // Read the capture root itself, not the whole page: this is the exact node
  // that html2canvas is handed, so a sanitizer regression cannot hide in chrome.
  const captureRootHtml = () =>
    page.evaluate(() => {
      const root = [...document.querySelectorAll("div")].find((d) => d.style.width && d.innerHTML.includes("survivor"));
      return root ? root.innerHTML : "";
    });
  const rendered = await captureRootHtml();
  check(!/onclick=/.test(rendered), "no onclick handler survives into the page");
  check(!/onerror=/.test(rendered), "no onerror handler survives into the page");
  check(!/alert\(4\)/.test(rendered), "the script body never reaches the page");
  check(!/<svg/i.test(rendered), "inline SVG never reaches the page");
  check(!/expression\(/.test(rendered), "executable CSS never reaches the page");
  check(/link text stays/.test(rendered), "the text of a rejected link is kept");
  check(/survivor/.test(rendered), "ordinary content is still rendered");
  check(
    /Sanitized for this page/.test((await page.locator("body").textContent()) || ""),
    "the tool discloses what the sanitizer removed",
  );
  check(/data-keep="1"/.test(rendered), "data- attributes are kept");
  check(!/id="root"/.test(rendered), "ids are stripped so pasted markup cannot fight the page");

  // The capture of the sanitized markup is the proof it was not just displayed.
  const safe = await captureDownload("hostile-2x.png");
  const sf = imageFacts(safe.bytes);
  check(!!sf, "the sanitized markup still captures to a real image", safe.name);
  check(!/\.svg/i.test(safe.name) && !/hostile\.html/i.test(safe.name), "the sanitized capture is named for the file, not the stripped part", safe.name);

  // ------------------------------------------------------------ refusals ---
  await openFixture("wide.html");
  await page.waitForTimeout(250);
  const wide = await status("Measured").textContent();
  check(
    /until the box is widened/.test(wide || ""),
    "content wider than the box is reported before capture",
    wide || "",
  );
  check(await captureBtn().isDisabled() === false, "the capture control is still reachable so the refusal can be explained");
  let refused = false;
  try {
    await captureBtn().click({ timeout: 3000 });
    await page.waitForTimeout(400);
    refused = (await alert("cropped to the box rather than reflowed").count()) > 0;
  } catch {
    refused = (await alert("cropped to the box rather than reflowed").count()) > 0;
  }
  check(refused, "an overflowing capture is refused with the width it needs");
  check(
    /widen the capture width to at least \d+ px/.test((await alert("cropped to the box").textContent()) || ""),
    "the refusal names the width that would work",
  );

  await openFixture("huge.html");
  await page.waitForTimeout(400);
  // The cap fires on open, so the refusal is read before any capture click
  // could replace the alert with a different message.
  check(
    (await alert("larger than the 200 KB limit").count()) === 1,
    "an input over the 200 KB cap is refused on open, not truncated",
  );
  check(
    /Trim the HTML or capture it in smaller pieces/.test((await alert("200 KB limit").textContent()) || ""),
    "the cap refusal says what to do instead",
  );

  // A sanitized-to-nothing input is refused before a canvas is allocated. The
  // textarea is not empty, so the control stays clickable and the capture
  // itself is what reports the reason.
  await setSource("<script>alert(1)</script><svg><animate/></svg>");
  await page.waitForTimeout(250);
  let sanitizedAway = false;
  try {
    await captureBtn().click({ timeout: 3000 });
    await page.waitForTimeout(300);
    sanitizedAway = (await alert("Nothing renderable is left after sanitizing").count()) > 0;
  } catch {
    sanitizedAway = (await alert("Nothing renderable is left after sanitizing").count()) > 0;
  }
  check(sanitizedAway, "input that sanitizes to nothing is refused by the capture");

  // ------------------------------------------------------- result hygiene ---
  await openFixture("card.html");
  await captureDownload("hygiene.png");
  check((await page.locator("[aria-label='Captured image result']").count()) === 1, "a result region is announced");
  check(
    /This is the file you downloaded, shown from the same bytes/.test((await page.locator("body").textContent()) || ""),
    "the panel says the preview is the downloaded file",
  );
  const imgAlt = await page.locator("[aria-label='Captured image result'] img").getAttribute("alt");
  check(!!imgAlt && imgAlt.includes("by"), "the result image carries a description", imgAlt || "");

  // Editing the markup must clear the result, so stale bytes cannot be re-saved.
  await setSource("<p>changed</p>");
  await page.waitForTimeout(200);
  check((await page.locator("[aria-label='Captured image result']").count()) === 0, "editing the markup clears the result panel");
  check(
    (await page.locator("button", { hasText: /Download .* again/ }).count()) === 0,
    "the stale re-download is gone with it",
  );

  // Invalidation on a control change, too.
  await openFixture("card.html");
  await captureDownload("invalidate.png");
  await setScale(1);
  await page.waitForTimeout(200);
  check((await page.locator("[aria-label='Captured image result']").count()) === 0, "changing the scale clears the result panel");

  // ------------------------------------------------------------- controls ---
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await setSource('<div style="width:300px;height:120px;background:#4f46e5"></div>');
  await page.waitForTimeout(250);

  check((await widthField().getAttribute("min")) === "240" && (await widthField().getAttribute("max")) === "1200", "the capture width is bounded 240–1200");
  check((await scaleField().getAttribute("min")) === "1" && (await scaleField().getAttribute("max")) === "4" && (await scaleField().getAttribute("step")) === "0.5", "the scale is bounded 1–4 in half steps");
  check((await widthField().getAttribute("inputmode")) === "numeric", "the width field asks for a numeric keyboard");

  const wLabel = await page.locator("label[for]").filter({ hasText: /Capture width/ }).count();
  check(wLabel === 1, "the capture width has a real bound label");
  check(await page.locator("fieldset legend").count() === 2, "the output controls are grouped in fieldsets");
  check(await page.locator("input[type='range']").count() === 1, "there is one range slider");
  check(
    (await page.locator("button[aria-pressed='true']").count()) === 1,
    "the current scale is pressed on the preset buttons",
  );

  await setWidth(100);
  check((await widthField().inputValue()) === "240", "a width below the floor is clamped to 240");
  await setWidth(5000);
  check((await widthField().inputValue()) === "1200", "a width above the ceiling is clamped to 1200");
  await setScale(9);
  check((await scaleField().inputValue()) === "4", "a scale above the ceiling is clamped to 4");
  await setScale(0.2);
  check((await scaleField().inputValue()) === "1", "a scale below the floor is clamped to 1");
  await scaleField().fill("2.5");
  await scaleField().press("Enter");
  await page.waitForTimeout(200);
  check((await scaleField().inputValue()) === "2.5", "Enter commits the typed scale");

  // The projection printed in the hint must match what the file becomes.
  const hint = await page.locator("p", { hasText: /Scale multiplies every CSS pixel/ }).textContent();
  const proj = /box is a (\d+) × (\d+) px image/.exec(hint || "");
  check(!!proj, "the scale hint projects an exact output size", hint || "");
  await setScale(1);
  await setWidth(DEFAULT_WIDTH);
  await setSource(`<div style="width:${DEFAULT_WIDTH - 40}px;height:100px;background:#0ea5e9"></div>`);
  await page.waitForTimeout(250);
  const projNow = /box is a (\d+) × (\d+) px image/.exec(
    (await page.locator("p", { hasText: /Scale multiplies every CSS pixel/ }).textContent()) || "",
  );
  const predicted = await captureDownload("predicted.png");
  const pf = imageFacts(predicted.bytes);
  check(!!projNow && !!pf && Number(projNow[1]) === pf.width && Number(projNow[2]) === pf.height, "the file is exactly the size the UI projected", `hint ${projNow && `${projNow[1]}x${projNow[2]}`} vs file ${pf && `${pf.width}x${pf.height}`}`);

  // --------------------------------------------------------- page copy ----
  const body = (await page.locator("body").textContent()) || "";
  check(/200 KB/.test(body) && /16 MP/.test(body) && /8192 px/.test(body), "the tool page states the caps it enforces");
  check(!/pixel-perfect|WYSIWYG/i.test(body), "the page makes no claim the renderer cannot back");

  const guide = await context.newPage();
  const resp = await guide.goto(`${BASE_URL}/guides/how-to-convert-html-to-image`, { waitUntil: "domcontentloaded" });
  const guideBody = resp && resp.ok() ? await guide.textContent("body") : "";
  check(resp && resp.status() === 200, "the html-to-image guide renders");
  check(/16 megapixels/.test(guideBody || "") && /8192 pixels/.test(guideBody || ""), "guide states the pixel and side caps");
  check(/never go below 1x/.test(guideBody || ""), "guide states the 1x floor");
  check(/re-draw, not a photograph/i.test(guideBody || ""), "guide states it is a re-draw, not a photograph");
  check(/Nothing is uploaded/.test(guideBody || ""), "guide states the privacy position");
  await guide.close();

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/html-to-image"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-convert-html-to-image"), "sitemap lists the html-to-image guide");

  // ------------------------------------------------------------ hygiene ---
  check(offOrigin.length === 0, "no off-origin request: the markup never leaves the device", offOrigin.slice(0, 3).join(" "));
  check(nonGet.length === 0, "no non-GET request was made by the tool", nonGet.slice(0, 3).join(" "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 2).join(" | "));
  check(consoleIssues.length === 0, "no hydration or server/client mismatch warnings", consoleIssues.slice(0, 2).join(" | "));
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 500)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
