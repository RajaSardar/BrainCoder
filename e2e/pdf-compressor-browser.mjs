// Run against an existing production server: BASE_URL=http://localhost:3788 node e2e/pdf-compressor-browser.mjs
// Fixtures/downloads stay in memory; Playwright's temporary downloads are deleted.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { createCanvas, ImageData, loadImage, DOMMatrix, Path2D } from "@napi-rs/canvas";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";
const marker = "PDF_BROWSER_PRIVATE_7b13c8";
const longName = `${marker}_${"long-filename-without-spaces_".repeat(7)}.pdf`;
const texts = [`${marker} selectable text`, "Second page stays searchable"];
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const canvas = createCanvas(2400, 1000);
const pixels = new Uint8ClampedArray(2400 * 1000 * 4);
let seed = 123456;
for (let i = 0; i < pixels.length; i++) {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  pixels[i] = i % 4 === 3 ? 255 : seed & 255;
}
canvas.getContext("2d").putImageData(new ImageData(pixels, 2400, 1000), 0, 0);
const encoded = await canvas.encode("jpeg", 98);
// Native Skia adds ICC APP2 metadata, intentionally unsupported by the compressor.
// Strip APP2 to generate an explicitly unprofiled DeviceRGB JPEG, not a mock encoder.
const parts = [encoded.subarray(0, 2)];
for (let offset = 2; offset < encoded.length;) {
  const segment = encoded[offset + 1];
  if (segment === 0xda) { parts.push(encoded.subarray(offset)); break; }
  const length = encoded.readUInt16BE(offset + 2);
  assert.ok(length >= 2 && offset + length + 2 <= encoded.length);
  if (segment !== 0xe2) parts.push(encoded.subarray(offset, offset + length + 2));
  offset += length + 2;
}
const jpeg = Buffer.concat(parts);
canvas.width = canvas.height = 1;

async function fixture(withImage) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(marker);
  pdf.setCreationDate(new Date("2026-01-01T00:00:00Z"));
  pdf.setModificationDate(new Date("2026-01-01T00:00:00Z"));
  pdf.addPage([612, 792]).drawText(texts[0], { x: 25, y: 750, size: 15 });
  pdf.addPage([300, 400]).drawText(texts[1], { x: 15, y: 350, size: 12 });
  if (withImage) {
    const image = await pdf.embedJpg(jpeg);
    pdf.getPage(0).drawImage(image, { x: 25, y: 400, width: 560, height: 234 });
  }
  return Buffer.from(await pdf.save());
}
const imagePdf = await fixture(true);
const textPdf = await fixture(false);
const corruptPdf = Buffer.from(`Not a PDF: ${marker}`);
const encryptedPdfs = [];
for (const algorithm of ["AES-256", "RC4"]) {
  for (const password of ["browser-secret", ""]) {
    encryptedPdfs.push({
      label: `${algorithm} ${password ? "user-password" : "owner-only"}`,
      buffer: Buffer.from(await encryptPDF(textPdf, password, { algorithm, ownerPassword: "owner-secret" })),
    });
  }
}
const fixtures = [imagePdf, textPdf, corruptPdf, ...encryptedPdfs.map((item) => item.buffer)];
const probes = [Buffer.from(marker), Buffer.from(marker).toString("base64"), "%PDF-"].map((v) => Buffer.from(v));
for (const bytes of fixtures) {
  // Detect raw and base64 document bytes, including encrypted content, on any endpoint.
  const sample = bytes.subarray(Math.floor(bytes.length / 2), Math.floor(bytes.length / 2) + 96);
  probes.push(sample, Buffer.from(sample.toString("base64").slice(0, 80)));
}

let phase = "setup";
const results = [];
const requests = [];
const pageErrors = [];
const consoleErrors = [];
const workerUrls = new Set();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
context.setDefaultTimeout(15_000);
context.on("request", (request) => {
  const url = request.url();
  if (!/^https?:/.test(url)) return;
  const body = request.postDataBuffer();
  const headers = request.headers();
  const searchable = Buffer.concat([Buffer.from(`${decodeURI(url)}\n${JSON.stringify(headers)}\n`), body || Buffer.alloc(0)]);
  const leak = probes.some((probe) => searchable.includes(probe));
  const pathname = new URL(url).pathname;
  const category = /\/(?:_vercel|_next)\/(?:insights|analytics)|google-analytics\.com|googletagmanager\.com/.test(url)
    ? "analytics"
    : request.method() === "GET" && (pathname.startsWith("/_next/static/") || ["/icon.svg", "/manifest.webmanifest", "/sw.js"].includes(pathname) || ["stylesheet", "image", "font", "script", "manifest"].includes(request.resourceType()))
      ? "asset"
      : request.method() === "GET" && (request.isNavigationRequest() || headers.rsc === "1")
        ? "navigation"
        : request.method() === "GET" && request.serviceWorker() && new URL(url).origin === new URL(BASE_URL).origin &&
          ["/", "/use/pdf-compressor", "/tools/pdf-compressor", "/guides/how-to-compress-pdf-online"].includes(pathname) && !new URL(url).search
          ? "service-worker shell/navigation" : "tool/other";
  requests.push({ phase, url, method: request.method(), type: request.resourceType(), category, bodyBytes: body?.length || 0, leak,
    fileContentType: /application\/pdf|multipart\/form-data|application\/octet-stream/i.test(headers["content-type"] || "") });
});
context.on("page", (page) => {
  page.on("pageerror", (error) => pageErrors.push({ phase, url: page.url(), message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({ phase, text: message.text() });
  });
  page.on("worker", (worker) => { const url = new URL(worker.url()); url.hash = ""; workerUrls.add(url.href); });
});

async function step(name, fn, viewport = { width: 1440, height: 1000 }) {
  phase = name;
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  try {
    const details = await fn(page);
    results.push({ name, status: "PASS", details });
    console.log("PASS", name, details ? JSON.stringify(details) : "");
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
    console.error("FAIL", name, error.stack);
  } finally { await page.close(); }
}

async function openTool(page) {
  const response = await page.goto(new URL("/use/pdf-compressor", BASE_URL).href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.getByLabel("Choose PDF", { exact: true }).waitFor({ state: "visible" });
  return page.locator("form").filter({ has: page.locator('input[type="file"]') });
}

async function select(page, buffer, name = longName) {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/pdf", buffer });
  await page.getByRole("button", { name: "Compress PDF", exact: true }).waitFor({ state: "visible" });
  assert.equal(await page.locator('input[type="file"]').evaluate((input) => input.files[0].name), name);
}

async function downloadPdf(page, name = longName) {
  const link = page.getByRole("link", { name: "Download", exact: true });
  await link.waitFor({ state: "visible", timeout: 65_000 });
  assert.match(await link.getAttribute("href"), /^blob:/);
  const pending = page.waitForEvent("download");
  await link.focus();
  await page.keyboard.press("Enter");
  const download = await pending;
  try {
    assert.equal(download.suggestedFilename(), `compressed-${name}`);
    const stream = await download.createReadStream();
    assert.ok(stream, "real browser download has a readable stream");
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(await download.failure(), null);
    return Buffer.concat(chunks);
  } finally { await download.delete(); }
}

async function verifyPdf(bytes, source, maxImageDimension) {
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length <= source.length, "download must not grow");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(pdf.getTitle(), marker);
  assert.deepEqual(pdf.getPages().map((page) => page.getSize()), [{ width: 612, height: 792 }, { width: 300, height: 400 }]);
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const parsed = await task.promise;
    assert.equal(parsed.numPages, 2);
    for (let i = 0; i < texts.length; i++) {
      const content = await (await parsed.getPage(i + 1)).getTextContent();
      assert.ok(content.items.map((item) => item.str || "").join(" ").includes(texts[i]), `page ${i + 1} selectable text preserved`);
    }
  } finally { await task.destroy(); }
  if (maxImageDimension) {
    assert.ok(bytes.length < source.length * 0.7, "noise image fixture must materially shrink (not structural-only)");
    const images = pdf.context.enumerateIndirectObjects().map(([, object]) => object)
      .filter((object) => object instanceof PDFRawStream && object.dict.lookup(PDFName.of("Subtype")) === PDFName.of("Image"));
    assert.equal(images.length, 1);
    const image = images[0];
    assert.equal(image.dict.lookup(PDFName.of("Filter")), PDFName.of("DCTDecode"));
    const decoded = await loadImage(Buffer.from(image.contents));
    assert.equal(decoded.width, maxImageDimension);
    assert.equal(decoded.height, Math.round(1000 * maxImageDimension / 2400));
    assert.equal(image.dict.lookup(PDFName.of("Width")).asNumber(), decoded.width);
    assert.equal(image.dict.lookup(PDFName.of("Height")).asNumber(), decoded.height);
    assert.ok(image.contents.length < jpeg.length);
  }
  return { inputBytes: source.length, downloadBytes: bytes.length, pages: 2, textPages: 2, imageWidth: maxImageDimension || null };
}

async function noOverflow(form, state) {
  const geometry = await form.evaluate((root) => {
    const box = root.getBoundingClientRect();
    const offenders = [root, ...root.querySelectorAll("*")].filter((element) => {
      if (!element.getClientRects().length || getComputedStyle(element).display === "none") return false;
      const rect = element.getBoundingClientRect();
      return rect.left < box.left - 1 || rect.right > box.right + 1 ||
        (!(element instanceof HTMLInputElement) && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1);
    }).map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 100), width: element.clientWidth, scroll: element.scrollWidth }));
    return { left: box.left, right: box.right, viewport: innerWidth, width: root.clientWidth, scroll: root.scrollWidth, offenders };
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewport + 1, `${state}: tool outside viewport ${JSON.stringify(geometry)}`);
  assert.deepEqual(geometry.offenders, [], `${state}: horizontal overflow ${JSON.stringify(geometry)}`);
  return { state, width: geometry.width, scrollWidth: geometry.scroll };
}

try {
  console.log(JSON.stringify({ baseUrl: BASE_URL, chrome: browser.version(), node: process.version, fixtures: { image: imagePdf.length, text: textPdf.length }, artifacts: "none retained" }));
  for (const [preset, dimension] of [["Light", 2000], ["Balanced", 1600], ["Strong", 1200]]) {
    await step(`${preset}: real compression, download, pages/text/image`, async (page) => {
      const form = await openTool(page);
      await select(page, imagePdf);
      await noOverflow(form, "desktop selected long filename");
      await page.getByRole("radio", { name: new RegExp(`^${preset}`) }).check();
      await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
      const bytes = await downloadPdf(page);
      assert.match(await page.getByRole("status").innerText(), /Compression complete\. 2 pages\. 1 images optimized; 0 images left unchanged/);
      await noOverflow(form, "desktop result");
      return verifyPdf(bytes, imagePdf, dimension);
    });
  }

  await step("Native keyboard file picker, radios, submit, adjust and reset; text-only no growth", async (page) => {
    await openTool(page);
    const input = page.getByLabel("Choose PDF", { exact: true });
    assert.equal(await input.getAttribute("type"), "file");
    await input.focus();
    const chooserPending = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    const chooser = await chooserPending;
    assert.equal(chooser.isMultiple(), false);
    await chooser.setFiles({ name: longName, mimeType: "application/pdf", buffer: textPdf });
    const balanced = page.getByRole("radio", { name: /^Balanced/ });
    assert.equal(await balanced.isChecked(), true);
    await balanced.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("radio", { name: /^Strong/ }).isChecked(), true);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await balanced.isChecked(), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("button", { name: "Compress PDF", exact: true }).evaluate((button) => button === document.activeElement), true);
    await page.keyboard.press("Enter");
    const bytes = await downloadPdf(page);
    const details = await verifyPdf(bytes, textPdf);
    assert.deepEqual(bytes, textPdf, "compact text input returns byte-exact original");
    await page.getByRole("heading", { name: "Original PDF kept" }).waitFor();
    assert.match(await page.getByRole("status").innerText(), /Original PDF unchanged\. 2 pages\. 0 images optimized/);
    await page.getByRole("button", { name: "Adjust compression" }).press("Enter");
    assert.equal(await page.locator('input[type="file"]').evaluate((element) => element.files[0].name), longName);
    assert.equal(await page.getByRole("link", { name: "Download", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Remove file" }).press("Space");
    assert.equal(await page.locator('input[type="file"]').evaluate((element) => element.files.length), 0);
    assert.equal(await page.getByRole("radio").count(), 0);
    return details;
  });

  await step("Corrupt PDF: selected-file role alert, dismissal and valid replacement recovery", async (page) => {
    const form = await openTool(page);
    await select(page, corruptPdf, `${marker}-corrupt.pdf`);
    await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
    const alert = form.getByRole("alert");
    await alert.waitFor({ state: "visible" });
    const message = await alert.innerText();
    assert.match(message, /PDF|parse|invalid|failed/i);
    assert.equal(await page.locator('input[type="file"]').evaluate((input) => input.files[0].name), `${marker}-corrupt.pdf`);
    assert.equal(await page.getByRole("button", { name: "Compress PDF", exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole("link", { name: "Download", exact: true }).count(), 0);
    await noOverflow(form, "corrupt alert");
    await page.getByRole("button", { name: "Dismiss error" }).press("Enter");
    assert.equal(await alert.count(), 0);
    await select(page, textPdf);
    await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
    await verifyPdf(await downloadPdf(page), textPdf);
    return { message };
  });

  for (const encrypted of encryptedPdfs) {
    await step(`Encrypted rejection: ${encrypted.label}`, async (page) => {
      const form = await openTool(page);
      await select(page, encrypted.buffer);
      await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
      await form.getByRole("alert").waitFor({ state: "visible" });
      const message = await form.getByRole("alert").innerText();
      assert.match(message, /encrypted|password-protected/i);
      assert.equal(await page.locator('input[type="file"]').evaluate((input) => input.files[0].name), longName);
      assert.equal(await page.getByRole("link", { name: "Download", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Compress PDF", exact: true }).isEnabled(), true);
      console.log("OBSERVED", encrypted.label, "rejected with selected source retained, no download, retry enabled");
      assert.match(message, /unencrypted copy/i, "encrypted rejection must offer user-facing recovery guidance, not a library bypass suggestion");
      assert.doesNotMatch(message, /ignoreEncryption/);
      return { message };
    });
  }

  await step("Deterministic busy lock, cancel and real retry (worker script temporarily held)", async (page) => {
    assert.ok(workerUrls.size > 0, "a real worker URL must have been observed first");
    const form = await openTool(page);
    // Only this controlled timing case bypasses the service-worker cache.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await select(page, imagePdf);
    let release;
    let held;
    const gate = new Promise((resolve) => { release = resolve; });
    const arrived = new Promise((resolve) => { held = resolve; });
    let didHold = false;
    const matches = (url) => workerUrls.has(url.href);
    const handler = async (route) => {
      if (!didHold) { didHold = true; held(); await gate; }
      try { await route.continue(); } catch (error) {
        if (!/closed|cancel|abort|Invalid InterceptionId/i.test(error.message)) throw error;
      }
    };
    await context.route(matches, handler);
    let deadline;
    try {
      await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
      await Promise.race([arrived, new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Worker script was not intercepted; busy coverage not established")), 10_000); })]);
      clearTimeout(deadline);
      const cancel = page.getByRole("button", { name: "Cancel compression" });
      await cancel.waitFor({ state: "visible" });
      assert.equal(await page.locator('input[type="file"]').isDisabled(), true);
      assert.equal(await page.getByRole("button", { name: "Remove file" }).isDisabled(), true);
      assert.equal(await page.getByRole("button", { name: "Compressing...", exact: true }).isDisabled(), true);
      const radios = page.getByRole("radio");
      assert.equal(await radios.count(), 3);
      for (const radio of await radios.all()) assert.equal(await radio.isDisabled(), true);
      assert.match(await page.getByRole("status").innerText(), /You can cancel at any time/);
      await cancel.press("Enter");
      await form.getByRole("alert").waitFor({ state: "visible" });
      assert.match(await form.getByRole("alert").innerText(), /Compression cancelled.*source PDF is still selected/);
      assert.equal(await page.getByRole("link", { name: "Download", exact: true }).count(), 0);
      assert.equal(await page.locator('input[type="file"]').isEnabled(), true);
      for (const radio of await radios.all()) assert.equal(await radio.isEnabled(), true);
      assert.equal(await page.locator('input[type="file"]').evaluate((input) => input.files[0].name), longName);
    } finally {
      clearTimeout(deadline);
      release();
      await context.unrouteAll({ behavior: "wait" });
      await cdp.send("Network.setBypassServiceWorker", { bypass: false });
      await cdp.detach();
    }
    await page.getByRole("radio", { name: /^Strong/ }).check();
    await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
    const details = await verifyPdf(await downloadPdf(page), imagePdf, 1200);
    assert.equal(await form.getByRole("alert").count(), 0);
    return { ...details, timingControl: "real worker script fetch held until cancellation; retry unmodified" };
  });

  for (const width of [375, 320]) {
    await step(`${width}px mobile: tool overflow, long filename, compression/download, reset and error`, async (page) => {
      const form = await openTool(page);
      const geometry = [await noOverflow(form, "empty")];
      await select(page, imagePdf);
      geometry.push(await noOverflow(form, "selected long filename"));
      await page.getByRole("radio", { name: /^Strong/ }).check();
      await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
      const details = await verifyPdf(await downloadPdf(page), imagePdf, 1200);
      geometry.push(await noOverflow(form, "result"));
      await page.getByRole("button", { name: "New file", exact: true }).click();
      assert.equal(await page.locator('input[type="file"]').evaluate((input) => input.files.length), 0);
      await select(page, corruptPdf);
      await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
      await form.getByRole("alert").waitFor({ state: "visible" });
      assert.match(await form.getByRole("alert").innerText(), /No PDF header found/);
      geometry.push(await noOverflow(form, "selected corrupt alert"));
      return { ...details, geometry };
    }, { width, height: 812 });
  }

  await step("Landing corrected copy, illustrative preview, FAQ ARIA and keyboard", async (page) => {
    const response = await page.goto(new URL("/tools/pdf-compressor", BASE_URL).href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    const about = await page.locator("#about").innerText();
    for (const pattern of [/one PDF up to 100 MiB/, /JavaScript worker/, /without.*using WebAssembly/, /lossy JPEG/, /metadata are preserved/, /original PDF unchanged/, /populated digital signatures are rejected/, /not.*sanitization/]) assert.match(about, pattern);
    const visible = await page.locator("body").innerText();
    assert.match(visible, /illustrative/i);
    assert.doesNotMatch(visible, /no hidden limits|without losing quality|Three straightforward steps|download ready/i);
    const faq = page.locator("#faq button[aria-controls]");
    assert.equal(await faq.count(), 7);
    const answers = [];
    const ids = new Set();
    for (const button of await faq.all()) {
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      const id = await button.getAttribute("aria-controls");
      assert.ok(id && !ids.has(id));
      ids.add(id);
      const panel = page.locator(`[id=${JSON.stringify(id)}]`);
      assert.equal(await panel.count(), 1);
      assert.equal(await panel.isVisible(), false);
      await button.focus();
      await page.keyboard.press("Enter");
      assert.equal(await button.getAttribute("aria-expanded"), "true");
      assert.equal(await panel.isVisible(), true);
      answers.push({ question: await button.innerText(), answer: await panel.innerText() });
      await page.keyboard.press("Space");
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      assert.equal(await panel.isVisible(), false);
    }
    const allAnswers = answers.map((item) => item.answer).join(" ");
    for (const pattern of [/60 seconds/, /not WebAssembly/, /one PDF at a time/, /byte for byte/, /not.*OCR/, /Empty signature fields/, /metadata is preserved/]) assert.match(allAnswers, pattern);
    const jsonLd = [];
    for (const raw of await page.locator('script[type="application/ld+json"]').allTextContents()) {
      try { jsonLd.push(JSON.parse(raw)); } catch (error) { throw new Error("Invalid landing JSON-LD", { cause: error }); }
    }
    const structuredFaq = jsonLd.find((item) => item["@type"] === "FAQPage");
    assert.deepEqual(structuredFaq.mainEntity.map((item) => ({ question: item.name, answer: item.acceptedAnswer.text })), answers);
    assert.equal(jsonLd.find((item) => item["@type"] === "HowTo").step.length, 4);
    return { faqPanels: answers.length, keyboard: "Enter expands, Space collapses", structuredFaqMatches: true };
  });

  await step("Guide corrected copy and Open PDF Compressor CTA navigates to /use", async (page) => {
    const response = await page.goto(new URL("/guides/how-to-compress-pdf-online", BASE_URL).href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    const article = await page.locator("article").innerText();
    for (const pattern of [/100 MiB/, /not WebAssembly/, /All three presets are lossy/, /60 seconds/, /byte for byte/, /Empty signature fields/]) assert.match(article, pattern);
    const cta = page.getByRole("link", { name: "Open PDF Compressor", exact: true });
    assert.equal(await cta.getAttribute("href"), "/use/pdf-compressor");
    await cta.press("Enter");
    await page.waitForURL("**/use/pdf-compressor");
    await page.getByLabel("Choose PDF", { exact: true }).waitFor({ state: "visible" });
    return { destination: new URL(page.url()).pathname };
  });

  await step("Observed HTTP traffic: no user-file outbound requests; no page errors", async () => {
    assert.ok(requests.length > 0, "network observer must see actual requests");
    assert.ok(workerUrls.size > 0, "production browser worker must have started");
    assert.deepEqual(requests.filter((request) => request.leak || request.fileContentType), [], "file bytes/markers or file upload MIME type observed outbound");
    assert.deepEqual(requests.filter((request) => request.category === "tool/other"), [], "unclassified tool traffic requires investigation, not a blanket zero-network assertion");
    assert.deepEqual(pageErrors, [], "uncaught browser/hydration/worker-facing page errors");
    return { requestCounts: Object.fromEntries(["asset", "navigation", "service-worker shell/navigation", "analytics", "tool/other"].map((category) => [category, requests.filter((request) => request.category === category).length])), workerUrls: [...workerUrls], pageErrors, consoleErrorCount: consoleErrors.length };
  });
} finally {
  await context.close();
  await browser.close();
}
const failed = results.filter((result) => result.status === "FAIL");
console.log(JSON.stringify({ summary: { passed: results.length - failed.length, failed: failed.length }, failures: failed, pageErrors, consoleErrorCount: consoleErrors.length, consoleErrorMessages: [...new Set(consoleErrors.map((error) => error.text))],
  toolRequests: requests.filter((request) => request.category === "tool/other" || request.leak || request.fileContentType) }, null, 2));
if (failed.length) process.exitCode = 1;
