/**
 * Node mirror audit for the HTML to Image tool. No browser, no DOM: the two
 * real TypeScript modules are transpiled with the repo's own TypeScript compiler
 * and imported, so the behavioural checks exercise the shipped code rather than a
 * hand-written copy of it. The rest of the file is source-level truth: every cap,
 * label, accessibility and honesty claim in the component, the marketing copy,
 * the SEO entry and the guide is checked against the code that enforces it.
 *
 *   node audit/check-html-to-image.mjs
 */
import ts from "typescript";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = "src/features/html-to-image";
const OUT = "audit/.html-mirror";
const MODULES = ["capture-format", "sanitize"];

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

/** Counts a substring, for "this claim appears N times" checks. */
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const name of MODULES) {
  const source = readFileSync(`${SRC}/${name}.ts`, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
  }).outputText.replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(`${OUT}/${name}.mjs`, js);
}

const F = await import(pathToFileURL(`${OUT}/capture-format.mjs`).href);
const S = await import(pathToFileURL(`${OUT}/sanitize.mjs`).href);

const {
  MAX_INPUT_BYTES,
  MIN_SCALE,
  MAX_SCALE,
  SCALE_STEP,
  DEFAULT_SCALE,
  MIN_CAPTURE_WIDTH,
  MAX_CAPTURE_WIDTH,
  DEFAULT_CAPTURE_WIDTH,
  MAX_SIDE_PX,
  MAX_OUTPUT_PX,
  CAPTURE_BACKGROUND,
  JPEG_QUALITY,
  IMAGE_TIMEOUT_MS,
  DEFAULT_STEM,
  PIXEL_BUDGET_LABEL,
  SIDE_LIMIT_LABEL,
  CAPTURE_FORMATS,
  formatSpec,
  mimeFor,
  extensionFor,
  formatForMime,
  outputNameFor,
  outputNameForMime,
  clampScale,
  clampCaptureWidth,
  scaleLabel,
  planOutput,
  captureIsOnScreen,
  formatBytes,
  classifyCaptureError,
  captureErrorMessage,
} = F;
const { sanitizeCaptureHtml, sanitizeSummary, isSafeUrl } = S;

/* ------------------------------------------------------------------ caps -- */

check("input cap is 200 KB", MAX_INPUT_BYTES === 200 * 1024);
check("scale range is 1–4 in half steps", MIN_SCALE === 1 && MAX_SCALE === 4 && SCALE_STEP === 0.5);
check("capture width range is 240–1200, defaulting to 480", MIN_CAPTURE_WIDTH === 240 && MAX_CAPTURE_WIDTH === 1200 && DEFAULT_CAPTURE_WIDTH === 480);
check("pixel budget is 16 MP and the side limit 8192 px", MAX_OUTPUT_PX === 16_000_000 && MAX_SIDE_PX === 8192);
check("composite is white", CAPTURE_BACKGROUND === "#ffffff");
check("lossy quality is 0.92", JPEG_QUALITY === 0.92);
check("image timeout is 5 s", IMAGE_TIMEOUT_MS === 5000);
check("the UI labels are derived, not retyped", PIXEL_BUDGET_LABEL === "16 MP" && SIDE_LIMIT_LABEL === "8192 px");
check("the three formats and their real MIME types are declared", (() => {
  const map = Object.fromEntries(CAPTURE_FORMATS.map((f) => [f.id, f]));
  return map.png.mime === "image/png" && map.png.extension === "png" && map.png.lossless === true &&
    map.jpeg.mime === "image/jpeg" && map.jpeg.extension === "jpg" && map.jpeg.lossless === false &&
    map.webp.mime === "image/webp" && map.webp.extension === "webp" && map.webp.lossless === false;
})());
check("PNG is documented as ignoring the quality argument", (() => {
  const note = formatSpec("png").note;
  return /lossless/i.test(note) && !/quality/i.test(note);
})());
check("lossy formats state the quality they use", /0\.92/.test(formatSpec("jpeg").note) && /0\.92/.test(formatSpec("webp").note));
check("the WebP note admits the encoder may be missing", /fall/i.test(formatSpec("webp").note));
check("JPEG's note admits it has no transparency", /transparency/i.test(formatSpec("jpeg").note));
check("formatSpec falls back to PNG for an unknown format", formatSpec("gif").id === "png");
check("mime and extension come from the spec, not a second table", mimeFor("jpeg") === "image/jpeg" && extensionFor("jpeg") === "jpg" && mimeFor("png") === "image/png" && extensionFor("webp") === "webp");

/* -------------------------------------------------------------- clamping -- */

check("scale clamps to the range", clampScale(0.2) === 1 && clampScale(99) === 4 && clampScale(1) === 1 && clampScale(4) === 4);
check("scale snaps to the 0.5 step", clampScale(2.3) === 2.5 && clampScale(2.24) === 2 && clampScale(3.76) === 4);
check("a non-numeric scale falls back to the default", clampScale(Number.NaN) === DEFAULT_SCALE && clampScale(Number.POSITIVE_INFINITY) === DEFAULT_SCALE);
check("capture width clamps and rounds", clampCaptureWidth(10) === MIN_CAPTURE_WIDTH && clampCaptureWidth(99999) === MAX_CAPTURE_WIDTH && clampCaptureWidth(480.6) === 481);
check("a non-numeric width falls back to the default", clampCaptureWidth(Number.NaN) === DEFAULT_CAPTURE_WIDTH);
check("scaleLabel renders whole and half steps the short way", scaleLabel(1) === "1x" && scaleLabel(2) === "2x" && scaleLabel(1.5) === "1.5x" && scaleLabel(3.5) === "3.5x");
check("scaleLabel reports a budget-reduced scale exactly, not the one asked for", (() => {
  const plan = planOutput(480, 3000, 4);
  return plan.scale === 2.73 && scaleLabel(plan.scale) === "2.73x" && scaleLabel(plan.requestedScale) === "4x";
})());
check("scaleLabel survives a non-numeric scale", scaleLabel(Number.NaN) === `${DEFAULT_SCALE}x`);

/* ----------------------------------------------------------------- names -- */

check("an opened file keeps its own base name", outputNameFor("Invoice.html", 2, "png") === "Invoice-2x.png");
check("extensions are replaced, not appended", outputNameFor("deck.HTML", 4, "webp") === "deck-4x.webp" && outputNameFor("notes.md", 2, "jpeg") === "notes-2x.jpg");
check("a paste gets the default stem", outputNameFor("", 2, "png") === `${DEFAULT_STEM}-2x.png` && outputNameFor("   ", 1, "png") === `${DEFAULT_STEM}-1x.png`);
check("reserved characters and control codes cannot reach a filename", (() => {
  const hostile = `a:b*c?d"e<f>g|h${String.fromCharCode(0)}${String.fromCharCode(27)}i.html`;
  const name = outputNameFor(hostile, 2, "png");
  return /^[-a-z0-9]+[-.][0-9.]+x\.png$/i.test(name) && !/[\u0000-\u001f\u007f]/.test(name) && !name.includes("..") && name.startsWith("a-b-c-d-e-f-g-h--i");
})());
check("a name of nothing but dots or dashes falls back to the default stem", (() => {
  for (const source of ["....", "-", "...", "-.-", String.fromCharCode(46).repeat(9)]) {
    if (outputNameFor(source, 2, "png") !== `${DEFAULT_STEM}-2x.png`) return false;
  }
  return true;
})());
check("a name keeps its own leading dot out of the way but its shape", (() => {
  const name = outputNameFor(".hidden.html", 2, "png");
  return name === "hidden-2x.png" && outputNameFor("Q3 report (final).html", 1, "png") === "Q3 report (final)-1x.png";
})());
check("the effective scale is in the filename", outputNameFor("a.html", 2.73, "png") === "a-2.73x.png");
check("the filename follows the bytes the canvas really produced", (() => {
  return outputNameForMime("a.html", 2, "image/png") === "a-2x.png" &&
    outputNameForMime("a.html", 2, "image/jpeg") === "a-2x.jpg" &&
    outputNameForMime("a.html", 2, "image/webp") === "a-2x.webp" &&
    outputNameForMime("a.html", 2, "image/bmp") === null;
})());
check("the fallback MIME is recognised case-insensitively and with padding", formatForMime(" IMAGE/PNG ") === "png" && formatForMime("image/jpeg") === "jpeg" && formatForMime("image/webp") === "webp" && formatForMime("") === null);
check("a WebP request saved as PNG keeps the PNG extension", outputNameForMime("card.html", 2, mimeFor("png")) === "card-2x.png");

/* ------------------------------------------------------------------ plan -- */

check("a small capture is projected exactly", (() => {
  const p = planOutput(480, 300, 2);
  return p.width === 960 && p.height === 600 && p.pixels === 576000 && p.scale === 2 && p.reduced === false && p.overBudget === false;
})());
check("the projection is html2canvas's own floor() rule", (() => {
  let ok = true;
  for (const w of [240, 333, 480, 719, 977, 1200]) {
    for (const h of [12, 137, 260, 480]) {
      for (const s of [1, 1.5, 2, 2.5, 3, 3.5, 4]) {
        const p = planOutput(w, h, s);
        ok = ok && p.width === Math.floor(w * p.scale) && p.height === Math.floor(h * p.scale);
      }
    }
  }
  return ok;
})());
check("no planned capture ever exceeds the budget or the side limit", (() => {
  for (let w = 240; w <= 1200; w += 13) {
    for (const h of [1, 40, 137, 480, 1200, 5000, 20000]) {
      for (const s of [1, 1.5, 2, 2.5, 3, 3.5, 4]) {
        const p = planOutput(w, h, s);
        if (p.overBudget) continue;
        if (p.pixels > MAX_OUTPUT_PX) return false;
        if (p.width > MAX_SIDE_PX || p.height > MAX_SIDE_PX) return false;
        if (p.scale < MIN_SCALE || p.scale > s) return false;
        if (p.reduced !== (p.scale < clampScale(s))) return false;
      }
    }
  }
  return true;
})());
check("a tall document is clamped by the side limit, not refused", (() => {
  const p = planOutput(480, 3000, 4);
  return p.limit === "side" && p.reduced === true && p.overBudget === false && p.scale < 4 && p.scale >= 1 && p.height <= MAX_SIDE_PX && p.pixels <= MAX_OUTPUT_PX;
})());
check("a large document is clamped by the pixel budget, not refused", (() => {
  const p = planOutput(2400, 2400, 4);
  return p.limit === "area" && p.reduced === true && p.overBudget === false && p.pixels <= MAX_OUTPUT_PX;
})());
check("something that cannot fit even at 1x is refused outright", (() => {
  const p = planOutput(5000, 5000, 1);
  return p.overBudget === true && p.scale === MIN_SCALE && p.reduced === true && p.width === 5000 && p.height === 5000;
})());
check("a zero-size box is refused with no limit blamed", (() => {
  const p = planOutput(0, 0, 2);
  return p.overBudget === true && p.limit === null && p.width === 0 && p.height === 0 && p.pixels === 0;
})());
check("planning is total: junk in, a usable plan out", (() => {
  const p = planOutput(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN);
  return p.overBudget === true && p.width === 0 && p.requestedScale === DEFAULT_SCALE;
})());
check("planning is deterministic", (() => {
  for (const [w, h, s] of [[480, 300, 2], [480, 3000, 4], [1200, 1200, 3.5], [333, 137, 1.5]]) {
    if (JSON.stringify(planOutput(w, h, s)) !== JSON.stringify(planOutput(w, h, s))) return false;
  }
  return true;
})());
check("an off-screen box is detected on both edges", (() => {
  return captureIsOnScreen(10, 500, 900) && captureIsOnScreen(0, 900, 900) &&
    !captureIsOnScreen(-5, 500, 900) && !captureIsOnScreen(0, 1000, 900);
})());

/* --------------------------------------------------------------- errors -- */

check("a zero-pixel canvas is reported as empty content", classifyCaptureError(new Error("IndexSizeError: source image width is 0")) === "empty" && classifyCaptureError({ name: "IndexSizeError" }) === "empty" && classifyCaptureError(new Error("width is 0")) === "empty");
check("an allocation failure is reported as too large", classifyCaptureError(new Error("data size exceeds the maximum")) === "too-large" && classifyCaptureError(new Error("Out of memory")) === "too-large");
check("an image or taint failure is reported as an encoding problem", classifyCaptureError(new Error("Unable to load image")) === "encode" && classifyCaptureError({ name: "SecurityError", message: "" }) === "encode");
check("anything unrecognised is reported as unknown, not invented", classifyCaptureError(new Error("boom")) === "unknown" && classifyCaptureError(null) === "unknown" && classifyCaptureError(undefined) === "unknown");
check("every error kind has a message that quotes the real caps", (() => {
  for (const kind of ["empty", "too-large", "encode", "unknown"]) {
    const m = captureErrorMessage(kind);
    if (!m || m.length < 20 || /undefined|NaN|\[object/.test(m)) return false;
  }
  return captureErrorMessage("too-large").includes(PIXEL_BUDGET_LABEL) && captureErrorMessage("too-large").includes(SIDE_LIMIT_LABEL);
})());
check("no raw engine text leaks into the UI", (() => {
  const raw = ["IndexSizeError", "source image width is 0", "SecurityError"];
  for (const kind of ["empty", "too-large", "encode", "unknown"]) {
    for (const r of raw) if (captureErrorMessage(kind).includes(r)) return false;
  }
  return true;
})());
check("byte formatting matches the repo's formatter", formatBytes(0) === "0 B" && formatBytes(1024) === "1.0 KB" && formatBytes(MAX_INPUT_BYTES) === "200.0 KB");

/* ------------------------------------------------------------- sanitizer -- */

const clean = sanitizeCaptureHtml('<p class="lead">Hello <strong>world</strong></p>');
check("safe HTML is left alone", clean.html === '<p class="lead">Hello <strong>world</strong></p>' && clean.removedTags.length === 0 && clean.removedAttributes === 0);
check("presentational attributes survive", (() => {
  const r = sanitizeCaptureHtml('<td colspan="2" style="color:#333" class="c" width="10">x</td>');
  return r.html.includes('colspan="2"') && r.html.includes('style="color:#333"') && r.html.includes('class="c"') && r.html.includes('width="10"');
})());
check("data- and aria- attributes survive", (() => {
  const r = sanitizeCaptureHtml('<div data-x="1" aria-hidden="true">x</div>');
  return r.html.includes('data-x="1"') && r.html.includes('aria-hidden="true"');
})());
check("ids are stripped so pasted markup cannot fight the page", !sanitizeCaptureHtml('<div id="app">x</div>').html.includes("id="));
check("scripts are dropped with their contents and the page continues", (() => {
  const r = sanitizeCaptureHtml('<script>alert(1)</script><p>after</p>');
  return r.html === "<p>after</p>" && r.html.includes("after") && r.removedTags.includes("SCRIPT");
})());
check("an unterminated script cannot smuggle a live tag back in", (() => {
  const r = sanitizeCaptureHtml('<script>var a = "</p>"; <img src=x onerror=alert(1)>');
  return !r.html.includes("onerror") && !r.html.includes("<img") && r.removedTags.includes("SCRIPT");
})());
check("frames, plugins and foreign content are dropped whole", (() => {
  for (const tag of ["iframe", "object", "svg", "canvas", "video", "math", "template", "noscript", "button", "select", "textarea", "title", "xmp", "plaintext"]) {
    const r = sanitizeCaptureHtml(`<${tag}>inner</${tag}>`);
    if (r.html.includes("inner")) return false;
  }
  return sanitizeCaptureHtml("<iframe>inner</iframe>").removedTags.includes("IFRAME");
})());
check("a dropped void element takes no content with it", (() => {
  for (const tag of ["embed", "input", "source", "track", "param", "frame", "base", "keygen"]) {
    const r = sanitizeCaptureHtml(`<${tag} src=x>after</${tag}>`);
    if (!r.html.includes("after") || r.html.includes("<" + tag)) return false;
  }
  return true;
})());
check("a void element cannot swallow the rest of the page", (() => {
  for (const [open, expect] of [["<link rel=stylesheet href=a.css>", "kept"], ["<meta charset=utf-8>", "kept"], ["<base href='http://x/'>", "kept"], ["<input value=x>", "kept"], ["<img src=x>", "kept"]]) {
    const r = sanitizeCaptureHtml(`${open}<p>${expect}</p>`);
    if (!r.html.includes(`<p>${expect}</p>`)) return false;
  }
  return true;
})());
check("unclosed style is closed rather than left to break the page", (() => {
  const r = sanitizeCaptureHtml("<style>.a{color:red}");
  return r.html === "<style>.a{color:red}</style>" && r.styleBlocks === 1;
})());
check("a style block is kept so class rules still apply", (() => {
  const r = sanitizeCaptureHtml("<style>.hero{color:red}</style><div class=hero>x</div>");
  return r.html.includes("<style>.hero{color:red}</style>") && r.styleBlocks === 1;
})());
check("comments and doctypes are dropped without eating text", (() => {
  return sanitizeCaptureHtml("<!-- c --><p>kept</p>").html === "<p>kept</p>" &&
    sanitizeCaptureHtml("<!DOCTYPE html><p>kept</p>").html === "<p>kept</p>";
})());
check("an unknown element is unwrapped and its text kept", sanitizeCaptureHtml("<my-widget>inner</my-widget>").html === "inner");
check("every event handler is removed and counted", (() => {
  const r = sanitizeCaptureHtml('<div onclick="a()" onmouseover="b()" ONFOCUS="c()">x</div>');
  return r.eventHandlers === 3 && !/on[a-z]+=/i.test(r.html) && r.removedAttributes === 3;
})());
check("javascript: URLs are removed from every URL attribute", (() => {
  for (const attr of ["href", "src", "cite"]) {
    const r = sanitizeCaptureHtml(`<a ${attr}="javascript:alert(1)">t</a>`);
    if (r.html.toLowerCase().includes("javascript") || r.unsafeUrls !== 1) return false;
  }
  return true;
})());
check("a kept style attribute cannot carry executable CSS", (() => {
  const css = sanitizeCaptureHtml('<div style="color:red;background:url(javascript:alert(1));width:10px">x</div>');
  return css.html.includes("color:red") && css.html.includes("width:10px") && !css.html.toLowerCase().includes("javascript");
})());
check("a kept style block cannot carry an import or an expression", (() => {
  const block = sanitizeCaptureHtml('<style>@import url("http://evil/x.css");.a{color:red}</style>');
  if (block.html.includes("@import") || !block.html.includes(".a{color:red}")) return false;
  return !sanitizeCaptureHtml("<style>a{width:expression(alert(1))}</style>").html.toLowerCase().includes("expression(");
})());
check("an entity-encoded javascript: URL is still removed", (() => {
  const r = sanitizeCaptureHtml('<a href="java&#115;cript:alert(1)">t</a>');
  return !r.html.toLowerCase().includes("javascript") && r.unsafeUrls === 1;
})());
check("whitespace and control codes cannot hide a javascript: URL", (() => {
  return !isSafeUrl("  java\tscript:alert(1)", false) && !isSafeUrl(`java${String.fromCharCode(1)}script:x`, false) && !isSafeUrl("JaVaScRiPt:x", false);
})());
check("data: URLs are allowed only for raster images", (() => {
  return isSafeUrl("data:image/png;base64,AAA", true) && isSafeUrl("data:image/jpeg;base64,AAA", true) &&
    !isSafeUrl("data:image/svg+xml;base64,AAA", true) && !isSafeUrl("data:text/html,<script>", true) &&
    !isSafeUrl("data:image/png;base64,AAA", false);
})());
check("ordinary URLs survive, including mailto, tel and fragments", (() => {
  return isSafeUrl("https://example.com/a?b=1#c", false) && isSafeUrl("//cdn.example.com/x.png", false) &&
    isSafeUrl("mailto:a@b.co", false) && isSafeUrl("tel:+15551234", false) && isSafeUrl("#top", false) &&
    !isSafeUrl("vbscript:x", false) && !isSafeUrl("file:///etc/passwd", false);
})());
check("a bare > in an attribute value cannot break out of the tag", sanitizeCaptureHtml('<a title=">" href="x">q</a>').html === '<a title=">" href="x">q</a>');
check("a lone < is escaped rather than treated as a tag", sanitizeCaptureHtml("a < b").html === "a &lt; b");
check("a duplicate attribute is emitted once", sanitizeCaptureHtml('<div class="a" class="b">x</div>').html === '<div class="a">x</div>');
check("no live tag or handler can survive a fuzz pass", (() => {
  // `style` is a deliberate keep (the tool is useless without it) and is asserted separately.
  const live = /<\s*\/?\s*(script|iframe|object|embed|svg|math|form|input|button|link|meta|base|video|audio|canvas|frame|applet|template|noscript)\b/i;
  const seeds = [
    "<scr<script>ipt>alert(1)</script>",
    '<<SCRIPT>alert(1);//<</SCRIPT>',
    '<img src=x onerror=alert(1)>',
    '<img src=x onerror\n=\nalert(1)>',
    '<div style="background:url(javascript:alert(1))">x</div>',
    '<a href=" \n javascript:alert(1)">x</a>',
    '<style>@import "javascript:alert(1)";</style>',
    '<svg><animate onbegin=alert(1)></svg>',
    '<div id=x><div id=x>',
    '<p>' + "<b>".repeat(500) + "</b>".repeat(500) + "</p>",
    "<div style=\"color:red\" style=\"background:url(http://x)\">y</div>",
    "<p title='a\\' onmouseover=alert(1) //'>x</p>",
    '<iframe srcdoc="<script>alert(1)</script>">x</iframe>',
    "<a href=javascript:alert(1)>x</a>",
    "<a href=jav&#x09;ascript:alert(1)>x</a>",
  ];
  for (const seed of seeds) {
    const r = sanitizeCaptureHtml(seed);
    if (live.test(r.html)) return false;
    // Handlers are only live inside a real tag; the same characters sitting in
    // escaped text are inert and are not a finding.
    const tags = r.html.match(/<[^>]*>/g) ?? [];
    if (tags.some((t) => /on[a-z]+\s*=/i.test(t))) return false;
    if (tags.some((t) => /javascript:/i.test(t))) return false;
    if ((r.html.match(/<style[^>]*>/gi) ?? []).length > (r.html.match(/javascript:|@import|expression\s*\(/gi) ?? []).length + 1) return false;
  }
  return true;
})());
check("sanitizing is deterministic", (() => {
  const src = '<div class=a onclick=x()><script>y</script><a href="javascript:z">t</a><style>b{c:d}</style></div>';
  return sanitizeCaptureHtml(src).html === sanitizeCaptureHtml(src).html;
})());
check("sanitizing is idempotent", (() => {
  const src = '<style>b{c:d}</style><div class=a onclick=x()><script>y</script><a href="javascript:z">t</a>a < b</div>';
  const once = sanitizeCaptureHtml(src).html;
  return sanitizeCaptureHtml(once).html === once;
})());
check("deep nesting is handled iteratively and quickly", (() => {
  const deep = "<div>".repeat(6000) + "x" + "</div>".repeat(6000);
  const t0 = process.hrtime.bigint();
  const r = sanitizeCaptureHtml(deep);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return r.html.length > 6000 && ms < 500;
})());
check("a full 200 KB document sanitizes inside the frame budget", (() => {
  const unit = '<p class="lead">Some <b>copy</b> with an <a href="https://example.com">anchor</a>.</p>';
  const big = unit.repeat(Math.ceil(MAX_INPUT_BYTES / unit.length)).slice(0, MAX_INPUT_BYTES);
  const t0 = process.hrtime.bigint();
  const r = sanitizeCaptureHtml(big);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return r.html.length > 0 && ms < 1000;
})());
check("the summary reports the real counts, or says nothing was removed", (() => {
  const r = sanitizeCaptureHtml('<script>a</script><img src=x onerror=y()><a href="javascript:z" id="q">t</a>');
  const text = sanitizeSummary(r);
  return text.includes("removed <script>") && text.includes("1 event handler") && text.includes("1 unsafe URL") && text.includes("1 other attribute");
})());
check("the summary is grammatical for a clean document and a style-only one", (() => {
  return sanitizeSummary(sanitizeCaptureHtml("<p>x</p>")).startsWith("Nothing was removed") &&
    sanitizeSummary(sanitizeCaptureHtml("<style>a{b:c}</style>")).startsWith("Nothing was removed") &&
    !/—\s*\./.test(sanitizeSummary(sanitizeCaptureHtml("<style>a{b:c}</style><script>x</script>"))) &&
    /<style> block/.test(sanitizeSummary(sanitizeCaptureHtml("<style>a{b:c}</style><script>x</script>")));
})());
check("the summary says the preview and the capture share one markup", (() => {
  return sanitizeSummary(sanitizeCaptureHtml("<script>x</script>")).includes("exactly this markup");
})());
check("the pure modules touch no browser API", (() => {
  for (const name of MODULES) {
    const src = readFileSync(`${SRC}/${name}.ts`, "utf8");
    if (/\bdocument\.|window\.|navigator\.|localStorage/.test(src)) return false;
  }
  return true;
})());

/* ------------------------------------------------- source truth: component -- */

const COMPONENT = readFileSync(`${SRC}/HtmlToImage.tsx`, "utf8");
const FORMAT = readFileSync(`${SRC}/capture-format.ts`, "utf8");

check("the component imports the caps instead of declaring its own", (() => {
  const declared = /^\s*(?:const|let)\s+(?:MAX|MIN|DEFAULT|SCALE|JPEG|IMAGE)[A-Z_]*\s*=/gm.test(COMPONENT);
  return !declared && /from "\.\/capture-format"/.test(COMPONENT) && /from "\.\/sanitize"/.test(COMPONENT);
})());
check("the component renders the sanitized markup, and only that", (() => {
  const injections = [...COMPONENT.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([\w.]+)/g)].map((m) => m[1]);
  return injections.length === 1 && injections[0] === "sanitized.html";
})());
check("the capture root is the element that is measured and painted", (() => {
  return count(COMPONENT, "ref={rootRef}") === 1 && COMPONENT.includes("width: captureWidth") && COMPONENT.includes("background: CAPTURE_BACKGROUND");
})());
check("the tool boots empty with no invented content", (() => {
  return /useState\(""\)/.test(COMPONENT) && !/useState\(`<div/.test(COMPONENT);
})());
check("the sample is only ever loaded by its own button", COMPONENT.includes("Load sample") && count(COMPONENT, "setHtml(SAMPLE)") === 1);
check("html2canvas is imported lazily so the page does not pay for it on load", /await import\("html2canvas"\)/.test(COMPONENT) && !/^import .*html2canvas/m.test(COMPONENT));
check("the capture options are the ones the copy describes", (() => {
  return COMPONENT.includes("backgroundColor: CAPTURE_BACKGROUND") && COMPONENT.includes("scale: planned.scale") &&
    COMPONENT.includes("useCORS: true") && COMPONENT.includes("logging: false") &&
    COMPONENT.includes("imageTimeout: IMAGE_TIMEOUT_MS") && COMPONENT.includes("removeContainer: true");
})());
check("the tool does not claim to render SVG foreignObject markup", !/foreignObjectRendering/.test(COMPONENT));
check("the canvas is released after the blob is taken", /canvas\.width = 0;\s*canvas\.height = 0;/.test(COMPONENT));
check("the file is encoded from the canvas, not from a data URL", COMPONENT.includes("canvas.toBlob(") && !/toDataURL/.test(COMPONENT));
check("the download is offered with the real bytes and the real name", (() => {
  return COMPONENT.includes("outputNameForMime(sourceName, planned.scale, blob.type)") &&
    COMPONENT.includes("downloadBlob(out, filename, blob.type)") &&
    COMPONENT.includes("downloadBlob(result.bytes, result.filename, result.mime)");
})());
check("an encoder fallback is disclosed and cannot keep the wrong extension", (() => {
  return COMPONENT.includes("fellBack") && COMPONENT.includes("saved as ${filename} so the extension matches the bytes");
})());
check("the same bytes are offered again, not re-rendered", COMPONENT.includes("This is the file you downloaded, shown from the same bytes"));
check("every async step is guarded by a runId", (() => {
  const guards = count(COMPONENT, "if (run !== runIdRef.current) return;");
  // A capture is claimed with ++, an edit cancels it, and the busy flag is only
  // cleared by the run that still owns the turn.
  return guards >= 6 && count(COMPONENT, "runIdRef.current++") === 1 &&
    COMPONENT.includes("const run = ++runIdRef.current;") &&
    COMPONENT.includes("if (run === runIdRef.current) setBusy(false);");
})());
check("editing the markup cancels a capture that is still in flight", (() => {
  const i = COMPONENT.indexOf("const invalidate = () => {");
  return i > 0 && COMPONENT.slice(i, i + 200).includes("runIdRef.current++");
})());
check("a second capture cannot start while one is in flight", COMPONENT.includes("disabled={busy}") && COMPONENT.includes("disabled={busy || empty}"));
check("editing the markup or a control invalidates the previous result", (() => {
  const invalidations = count(COMPONENT, "invalidate();");
  return invalidations >= 4 && /const invalidate = \(\) => \{/.test(COMPONENT);
})());
check("the empty, over-cap, unrenderable, unmeasured, overflow and over-budget cases all refuse with a reason", (() => {
  return ['if (empty) {', 'if (overCap) {', 'sanitized.html.trim().length === 0', 'measured.cssWidth === 0', 'measured.overflow > 0', 'planned.overBudget'].every((c) => COMPONENT.includes(c)) &&
    COMPONENT.includes("nothing to capture yet") && COMPONENT.includes("larger than the ${CAP_KB} KB limit") &&
    COMPONENT.includes("Nothing renderable is left after sanitizing") && COMPONENT.includes('captureErrorMessage("empty")') &&
    COMPONENT.includes("cropped to the box rather than reflowed") && COMPONENT.includes("refused until the box is widened");
})());
check("every refusal tells the user what to change", (() => {
  const refusals = COMPONENT.split("setError(")
    .slice(1)
    .map((r) => r.slice(0, 600))
    // `setError(toUiError(err))` is the catch-all, and `setError("")` clears.
    .filter((r) => !/^\s*toUiError\(/.test(r) && !/^\s*""[,)]/.test(r) && !/^\s*captureErrorMessage\(/.test(r));
  const action = /widen|smaller|narrower|trim|sections|try again|give the html|lower the scale|make the content|nothing to capture|nothing renderable|zero pixels/i;
  return refusals.length >= 5 && refusals.every((r) => action.test(r));
})());
check("the reduced scale is disclosed next to the scale that was asked for", (() => {
  return COMPONENT.includes("You asked for ${scaleLabel(planned.requestedScale)}") && COMPONENT.includes("never taken below 1x");
})());
check("an empty preview is refused before the browser allocates a canvas", COMPONENT.indexOf("measured.cssWidth === 0") < COMPONENT.indexOf('await import("html2canvas")'));
check("the refusal names the limit that was actually hit, not a generic one", (() => {
  const i = COMPONENT.indexOf("planned.overBudget");
  const block = COMPONENT.slice(i, i + 700);
  return block.includes('planned.limit === "side"') && block.includes("SIDE_LIMIT_LABEL") && block.includes("PIXEL_BUDGET_LABEL");
})());
check("status, alerts and busy state reach assistive tech", (() => {
  return COMPONENT.includes('aria-busy={busy}') && count(COMPONENT, 'role="status"') >= 4 &&
    COMPONENT.includes('role="alert"') && COMPONENT.includes('role="region"') &&
    COMPONENT.includes('aria-label="Captured image result"');
})());
check("every control is labelled and grouped", (() => {
  return COMPONENT.includes("useId()") && count(COMPONENT, "htmlFor=") >= 4 && count(COMPONENT, "<legend") === 2 &&
    COMPONENT.includes("aria-describedby={scaleHintId}") && COMPONENT.includes("aria-describedby={formatHintId}") &&
    COMPONENT.includes("aria-pressed={scale === s}");
})());
check("the numeric inputs carry their own range and commit on Enter", (() => {
  return COMPONENT.includes("min={MIN_SCALE}") && COMPONENT.includes("max={MAX_SCALE}") && COMPONENT.includes("step={SCALE_STEP}") &&
    COMPONENT.includes("min={MIN_CAPTURE_WIDTH}") && COMPONENT.includes("max={MAX_CAPTURE_WIDTH}") &&
    COMPONENT.includes('e.key !== "Enter"') && count(COMPONENT, "onBlur=") === 2;
})());
check("the result image has a description of the image it is", /alt=\{`The captured image: /.test(COMPONENT));
check("the preview label is tied to the preview it names", COMPONENT.includes("aria-labelledby={previewId}") && COMPONENT.includes("id={previewId}"));
check("the tool states it re-draws rather than photographs the screen", COMPONENT.includes("It is a re-draw, not a screen grab") && COMPONENT.includes("does not use an SVG foreignObject"));
check("the tool lists what the rasterizer cannot paint", (() => {
  const box = COMPONENT.slice(COMPONENT.indexOf("What this capture is"));
  for (const claim of ["filter", "backdrop-filter", "mix-blend-mode", "conic-gradient", "repeating-linear-gradient", "object-fit", "flexbox and grid", "text-shadow", "::before"]) {
    if (!box.includes(claim)) return false;
  }
  return true;
})());
check("the tool says what is stripped before rendering, and that style blocks stay", (() => {
  const box = COMPONENT.slice(COMPONENT.indexOf("What this capture is"));
  return box.includes("<code>&lt;script&gt;</code>") && box.includes("<code>javascript:</code>") && box.includes("<code>&lt;style&gt;</code> block is kept");
})());
check("the tool admits the CORS and fetch behaviour", COMPONENT.includes("without CORS headers is left out of the capture") && COMPONENT.includes("is fetched"));
check("the tool admits the viewport units and clipping behaviour", COMPONENT.includes("resolve against the") && COMPONENT.includes("position: fixed") && COMPONENT.includes("is refused rather than silently cropped"));
check("the tool says nothing is uploaded", count(COMPONENT, "no request is made for your markup") >= 2);
check("the tool quotes the caps from the shared labels, never as literals", (() => {
  if (!COMPONENT.includes("${CAP_KB} KB")) return false;
  if (!COMPONENT.includes("${PIXEL_BUDGET_LABEL}") || !COMPONENT.includes("${SIDE_LIMIT_LABEL}")) return false;
  const m = COMPONENT.match(/const CAP_KB = Math\.round\((\w+) \/ 1024\)/);
  if (!m || m[1] !== "MAX_INPUT_BYTES") return false;
  // Any bare "200 KB" / "16 MP" / "8192 px" in the copy would be a second source of truth.
  const jsx = COMPONENT.slice(COMPONENT.indexOf("return ("));
  return !/\b(200|16|8192|1200|240|120|480)\s?(KB|MP|px)\b/.test(jsx);
})());
check("the pixel planner and the label come from the same constant", PIXEL_BUDGET_LABEL === `${MAX_OUTPUT_PX / 1_000_000} MP` && FORMAT.includes("export const MAX_OUTPUT_PX = 16_000_000;"));
check("the plan and the message about it use the same projection", COMPONENT.includes("const planned = planOutput(") && COMPONENT.includes("${planned.cssWidth} × ${planned.cssHeight} CSS px"));
check("the tool offers a copy and a re-download of the identical file", COMPONENT.includes("Copy image") && COMPONENT.includes("navigator.clipboard.write") && COMPONENT.includes("Download {result.filename} again"));

/* ------------------------------------------------ source truth: page copy -- */

const CONTENT = readFileSync("src/lib/tool-content.ts", "utf8");
const SEO = readFileSync("src/lib/seo.ts", "utf8");
const TOOLS = readFileSync("src/lib/tools.ts", "utf8");
const GUIDES = readFileSync("src/lib/guides.ts", "utf8");

function section(source, start, end) {
  const i = source.indexOf(start);
  if (i < 0) return "";
  const j = end ? source.indexOf(end, i) : source.length;
  return source.slice(i, j < 0 ? source.length : j);
}

const TOOL_COPY = section(CONTENT, '"html-to-image":', '"box-shadow-generator":');
check("the tool copy slice is this tool's own block, not its neighbour's", TOOL_COPY.includes("PNG, JPEG and WebP") && !TOOL_COPY.includes("box-shadow"));
check("the tool has a long description", TOOL_COPY.length > 400);
check("the tool copy states the caps it enforces", (() => {
  return TOOL_COPY.includes(`${MAX_INPUT_BYTES / 1024} KB`) &&
    TOOL_COPY.includes(`${MAX_OUTPUT_PX / 1_000_000} MP`) &&
    TOOL_COPY.includes(`${MAX_SIDE_PX} px`) &&
    TOOL_COPY.includes(`${MIN_CAPTURE_WIDTH} and ${MAX_CAPTURE_WIDTH} px`) &&
    TOOL_COPY.includes(`${MIN_SCALE}x to ${MAX_SCALE}x`);
})());
check("the tool copy does not promise CSS the rasterizer cannot paint", (() => {
  const banned = [/pixel[- ]perfect/i, /every CSS property/i, /exact(?:ly)? as (?:it )?(?:appears|shown|seen)/i, /WYSIWYG/i, /like a screenshot/i, /screenshot/i];
  return !banned.some((re) => re.test(TOOL_COPY));
})());
check("the tool copy explains the scale in CSS-pixel terms", /CSS pixel/i.test(TOOL_COPY) && /scale/i.test(TOOL_COPY));
check("the tool copy says the markup stays in the browser", /never (?:leaves|uploaded|upload)/i.test(TOOL_COPY) || /nothing is uploaded/i.test(TOOL_COPY));
check("the tool copy names the real limitations", (() => {
  const text = TOOL_COPY.toLowerCase();
  const named = ["foreignobject", "filter", "cors", "white"].filter((w) => text.includes(w));
  return named.length >= 3;
})());
check("the tool copy states the automatic save", /download/i.test(TOOL_COPY) && /png|webp|jpe?g/i.test(TOOL_COPY));
check("the SEO keywords are long-tail and not a single stub", (() => {
  const m = SEO.match(/"html-to-image":\s*\[([^\]]*)\]/);
  if (!m) return false;
  const list = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  return list.length >= 6 && list.some((k) => k.includes("html to image")) && list.some((k) => k.length > 18);
})());
check("the tool has its own meta title", /"html-to-image":\s*"[^"]{20,120}"/.test(section(SEO, "CUSTOM_TITLES", "};")));
check("the registry entry describes the tool honestly", (() => {
  const entry = section(TOOLS, 'slug: "html-to-image"', "},");
  return entry.length > 100 && !/screenshot|full CSS|every CSS/i.test(entry);
})());
check("the JSON-LD feature list names this tool's real behaviour", (() => {
  const i = SEO.indexOf('"html-to-image":\n      "A live capture-box preview');
  if (i < 0) return false;
  const entry = SEO.slice(i, i + 2400);
  return entry.includes("16 MP") && entry.includes("8192 px") && entry.includes("PNG, JPEG and WebP") &&
    /filter|backdrop-filter/.test(entry) && /re-draw/.test(entry) && /200 KB/.test(entry);
})());
check("no other tool's feature list borrows this tool's numbers", (() => {
  const block = SEO.slice(SEO.indexOf("TOOL_FEATURE_LIST"), SEO.indexOf("};", SEO.indexOf("TOOL_FEATURE_LIST")));
  const others = block.replace(/"html-to-image":[\s\S]*?,\n/, "");
  return !/16 MP/.test(others) || others.split("16 MP").length - 1 <= 1;
})());
check("the guide exists, is reachable and agrees with the code", (() => {
  const i = GUIDES.indexOf('"how-to-convert-html-to-image"');
  if (i < 0) return false;
  // One guide runs to the next `slug:`, not to an arbitrary byte count.
  const rest = GUIDES.slice(i);
  const next = rest.indexOf('slug: "', 10);
  const guide = next < 0 ? rest : rest.slice(0, next);
  return guide.includes('toolSlug: "html-to-image"') &&
    guide.includes(`${MAX_INPUT_BYTES / 1024} KB`) &&
    guide.includes(`${MAX_OUTPUT_PX / 1_000_000} megapixels`) &&
    guide.includes(`${MAX_SIDE_PX} pixels`) &&
    guide.length > 2000;
})());
check("the guide and the tool state the same floor() rule for the projection", (() => {
  const i = GUIDES.indexOf('"how-to-convert-html-to-image"');
  const rest = GUIDES.slice(i);
  const next = rest.indexOf('slug: "', 10);
  const guide = next < 0 ? rest : rest.slice(0, next);
  return /floor\(css size x scale\)/.test(guide) && /never go below 1x/.test(guide);
})());
check("the guide does not promise unsupported rendering", !/foreignobject renders|full CSS support/i.test(GUIDES));

rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
