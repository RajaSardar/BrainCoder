import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/gzip-tool`;
const DL = "/tmp/gzip-dl";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

writeFileSync("/tmp/gzip-src.txt", "The quick brown fox jumps over the lazy dog. ".repeat(40));
const binaryPayload = Buffer.from([0, 0, 0, 1, 2, 3, 0, 0, 0, 255, 9, 8, 0, 0, 1, 4, 5, 0, 0, 0, 6, 7, 8, 9, 0, 0, 0]);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

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

const consoleIssues = [];
const pageErrors = [];
page.on("console", (m) => {
  const text = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(text)) consoleIssues.push(text);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const input = page.locator("#gzip-input");
const output = () => page.locator("div[aria-label='Output']").textContent();
const status = (t) => page.locator("[role='status']", { hasText: t });
const alert = (t) => page.locator("[role='alert']", { hasText: t });
const clip = () => page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));
const pill = (label) => page.locator("div[role='group'][aria-label='Compression format'] button", { hasText: label });

async function fillInput(text) {
  await input.fill(text);
  await page.waitForTimeout(120);
}
async function clickCompressB64(text) {
  await fillInput(text);
  await page.locator("button", { hasText: "Compress → base64" }).click();
  await page.waitForFunction(() => {
    const t = document.querySelector("div[aria-label='Output']")?.textContent?.trim() || "";
    return t.length > 0 && t.startsWith("H4s");
  }, null, { timeout: 15000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll("[role='status']")].some((e) => /Compressed/.test(e.textContent || "")),
    null,
    { timeout: 10000 },
  );
  await page.waitForTimeout(150);
}
async function grabDownload(buttonText, saveAs) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.locator("button", { hasText: new RegExp(`(?:^|\\s)${buttonText}$`) }).click(),
  ]);
  await dl.saveAs(saveAs);
  return readFileSync(saveAs);
}
const H4S = /^H4s[IA]/;

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.waitForSelector("#gzip-input", { timeout: 15000 });

  check((await page.locator('label[for="gzip-input"]').count()) === 1, "input textarea has an associated <label for>");
  check((await page.locator("div[role='group'][aria-label='Compression format'] button").count()) === 3, "three format pills render");
  check((await pill("Gzip (.gz)").getAttribute("aria-pressed")) === "true", "gzip pill selected by default");
  check((await alert("Compression Streams").count()) === 0, "no feature-gate banner on a supporting browser");

  await clickCompressB64("hello gzip world hello gzip world");
  let out = (await output()) || "";
  check(H4S.test(out), "gzip base64 output uses the gzip magic prefix");
  check((await status("Compressed").count()) === 1, "compress shows a role=status message");

  let b64 = out.trim();
  await page.locator("button[aria-label='Copy output']").click();
  await page.waitForTimeout(250);
  check((await clip()) === b64, "copy output writes the exact base64 string");

  let gunzipped = gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
  check(gunzipped === "hello gzip world hello gzip world", "browser gzip base64 decompresses to the original text (node gunzip)");

  await fillInput(b64);
  await page.locator("button", { hasText: "Decompress → formatted text" }).click();
  await page.waitForFunction(() => document.querySelector("div[aria-label='Output']")?.textContent?.includes("hello gzip world"), null, { timeout: 15000 });
  out = (await output()) || "";
  check(out.startsWith("hello gzip world") && !H4S.test(out), "round trip: decompressing the base64 restores the original text");
  check((await status("Decompressed").count()) === 1 && /with gzip/.test(await status("Decompressed").textContent()), "decompress message names the detected format");

  await fillInput("hello gzip world hello gzip world");
  await page.locator("button", { hasText: "Compress → JSON payload" }).click();
  await page.waitForFunction(() => document.querySelector("div[aria-label='Output']")?.textContent?.includes('"data"'), null, { timeout: 15000 });
  out = (await output()) || "";
  const parsed = JSON.parse(out);
  check(parsed.zlib === true && typeof parsed.data === "string" && H4S.test(parsed.data), "JSON payload wraps data under the zlib key");
  check((await status("wrapped as").count()) === 1, "JSON payload message mentions the wrapper key");

  const dlJson = await grabDownload("Download", `${DL}/json.gz`);
  check(dlJson[0] === 0x1f && dlJson[1] === 0x8b && gunzipSync(dlJson).toString("utf8") === "hello gzip world hello gzip world", "JSON-payload Download unwraps to the raw compressed bytes (.gz magic + gunzip)");

  await fillInput(out);
  await page.locator("button", { hasText: "Decompress → formatted text" }).click();
  await page.waitForFunction(() => document.querySelector("div[aria-label='Output']")?.textContent?.includes("hello gzip world"), null, { timeout: 15000 });
  check(/Decompressed “zlib” payload/.test(await status("Decompressed").textContent()), "decompressing the JSON payload reads the data key and reports it");

  await clickCompressB64("hello gzip world hello gzip world");
  const dlB64 = await grabDownload("Download", `${DL}/b64.gz`);
  check(dlB64[0] === 0x1f && dlB64[1] === 0x8b && gunzipSync(dlB64).toString("utf8") === "hello gzip world hello gzip world", "base64 Download stores the raw .gz bytes");

  const binGz = gzipSync(binaryPayload).toString("base64");
  await fillInput(binGz);
  await page.locator("button", { hasText: "Decompress → formatted text" }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => (b.textContent || "").includes("Download original bytes")), null, { timeout: 15000 });
  check((await status("binary").count()) === 1, "binary decompression shows a warning message");
  check(await page.locator("button", { hasText: "Download original bytes" }).isVisible(), "binary result offers a raw-bytes download");
  const dlBin = await grabDownload("Download original bytes", `${DL}/bin.bin`);
  check(Buffer.compare(dlBin, binaryPayload) === 0, "original binary bytes download matches the source exactly");

  await fillInput("This is just some plain english text with no special chars");
  await page.locator("button", { hasText: "Decompress → formatted text" }).click();
  await page.waitForTimeout(400);
  check((await alert("Could not decompress").count()) === 1, "plain text (not base64) does not get mis-detected — clear error shown");

  const big = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(12000);
  await clickCompressB64(big);
  b64 = ((await output()) || "").trim();
  await fillInput(b64);
  await page.locator("button", { hasText: "Decompress → formatted text" }).click();
  await page.waitForFunction(() => document.querySelector("div[aria-label='Output']")?.textContent?.includes("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"), null, { timeout: 20000 });
  check((await page.locator("p", { hasText: /Showing the first \d+\.\d+ KB/ }).count()) === 1, "huge output is display-truncated with a retained note");
  await page.locator("button[aria-label='Copy output']").click();
  await page.waitForTimeout(400);
  const copied = await clip();
  check(copied.length === big.length, "copy still delivers the full decompressed data (no state truncation)");

  await page.locator("input[type='file']").setInputFiles("/tmp/gzip-src.txt");
  const dlFile = await grabDownload("Compress file", `${DL}/src.txt.gz`);
  check(dlFile[0] === 0x1f && dlFile[1] === 0x8b && gunzipSync(dlFile).toString("utf8") === readFileSync("/tmp/gzip-src.txt", "utf8"), "file compress downloads a valid .gz of the file");
  check((await status("and downloaded").count()) === 1, "file compress message confirms the download");

  writeFileSync("/tmp/gzip-file.gz", gzipSync("file based decompression works fine for gzip"));
  await page.locator("input[type='file']").setInputFiles("/tmp/gzip-file.gz");
  await page.locator("button", { hasText: "Decompress file" }).click();
  await page.waitForFunction(() => document.querySelector("div[aria-label='Output']")?.textContent?.includes("file based decompression works fine"), null, { timeout: 15000 });
  check(/with gzip/.test(await status("Decompressed").textContent()), "file decompress auto-detects gzip");

  await fillInput("deflate test payload deflate test payload deflate test payload");
  await pill("Deflate (.deflate)").click();
  check((await pill("Deflate (.deflate)").getAttribute("aria-pressed")) === "true", "selecting the deflate pill updates aria-pressed");
  await page.locator("button", { hasText: "Compress → base64" }).click();
  await page.waitForFunction(() => {
    const t = document.querySelector("div[aria-label='Output']")?.textContent?.trim() || "";
    return t.length > 0 && t !== "Output appears here…" && t.startsWith("eJ");
  }, null, { timeout: 15000 });
  check(/^eJ/.test((await output()) || ""), "deflate compression produces zlib-flavoured base64 output");

  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/gzip-tool`)) === 200, "/use/gzip-tool 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/gzip-tool`)) === 200, "/tools/gzip-tool 200");

  await page.goto(`${BASE_URL}/tools/gzip-tool`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(/deflate-raw/.test(body), "marketing copy documents deflate-raw support");
  check(!/data URI/i.test(body), "removed fabricated 'data URI' claim from marketing copy");
  check(!/raw byte string/i.test(body), "no 'raw bytes' copy claim in marketing copy");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);