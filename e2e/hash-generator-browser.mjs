import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/hash-generator`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
const notes = [];
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
const alerts = [];
page.on("console", (m) => {
  const text = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(text)) consoleIssues.push(text);
  if (/alert|error/i.test(text) && !/favicon|_verify|/i.test(text)) alerts.push(text);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const input = page.locator("textarea[aria-label='Input text']");
const resultBox = page.locator("div[role='status'].space-y-2");

const SHA1 = "a9993e364706816aba3e25717850c26c9cd0d89d";
const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const SHA256_ABCD = "88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589";
const SHA384 = "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7";
const SHA512 = "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f";

async function cellValue(algo) {
  const cards = resultBox.locator("div.rounded-xl.bg-white.p-3");
  for (let i = 0; i < (await cards.count()); i++) {
    const card = cards.nth(i);
    const label = await card.locator("p.text-xs.font-medium").textContent();
    if ((label || "").trim() === algo) {
      return (await card.locator("p.font-mono").textContent()) || "";
    }
  }
  return null;
}
async function copyIn(algo) {
  const cards = resultBox.locator("div.rounded-xl.bg-white.p-3");
  for (let i = 0; i < (await cards.count()); i++) {
    const card = cards.nth(i);
    const label = await card.locator("p.text-xs.font-medium").textContent();
    if ((label || "").trim() === algo) {
      await card.locator("button").click();
      return;
    }
  }
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });

  // --- empty boot state (no sample noise) ---
  check((await input.inputValue()) === "", "boots empty (no default sample text)");
  check((await cellValue("SHA-256")) === "—", "empty input shows em-dash placeholder");
  const copyBtnsCount = await resultBox.locator("button").count();
  check(copyBtnsCount === 4, "4 per-algorithm copy buttons");
  const disabledCount = await resultBox.locator("button:disabled").count();
  check(disabledCount === 4, "all copy buttons disabled while empty");

  // --- known digests ---
  await input.fill("abc");
  await page.waitForTimeout(300);
  check((await cellValue("SHA-1")) === SHA1, "SHA-1(\"abc\") correct");
  check((await cellValue("SHA-256")) === SHA256_ABC, "SHA-256(\"abc\") correct");
  check((await cellValue("SHA-384")) === SHA384, "SHA-384(\"abc\") correct");
  check((await cellValue("SHA-512")) === SHA512, "SHA-512(\"abc\") correct");
  check((await resultBox.locator("button:disabled").count()) === 0, "copy buttons enabled after input");

  // --- debounce/cancel: fast retype yields final digest ---
  await input.fill("abc");
  await input.press("d");
  await page.waitForTimeout(300);
  check((await cellValue("SHA-256")) === SHA256_ABCD, "rapid retype resolves to latest input (SHA-256(\"abcd\"))");

  // --- copy-all ---
  await input.fill("abc");
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "Copy all" }).click();
  await page.waitForTimeout(250);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));
  check(
    clip.split("\n").length === 4 && clip.includes(`SHA-256: ${SHA256_ABC}`) && clip.includes(`SHA-1: ${SHA1}`),
    "Copy all writes SHA-256 and SHA-1 lines to clipboard",
  );

  // --- per-algo copy ---
  await copyIn("SHA-384");
  await page.waitForTimeout(250);
  const clip2 = await page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR:" + e.name));
  check(clip2 === SHA384, "Copy under SHA-384 writes its hex to clipboard");

  // --- clear returns to placeholder + disabled ---
  await page.locator("button", { hasText: "Clear" }).click();
  await page.waitForTimeout(200);
  check((await input.inputValue()) === "", "Clear empties the input");
  check((await cellValue("SHA-256")) === "—", "Clear resets results to placeholder");
  check((await resultBox.locator("button:disabled").count()) === 4, "Clear re-disables copy buttons");

  // --- caps & guards ---
  check((await input.getAttribute("maxlength")) === "1000000", "input capped at 1,000,000 chars");
  const unsupported = page.locator("[role='alert']", { hasText: "Web Crypto" });
  check((await unsupported.count()) === 0, "no Web Crypto unsupported alert in Chrome");

  // --- a11y scaffolding ---
  check((await input.getAttribute("aria-label")) === "Input text", "textarea has aria-label");
  check((await resultBox.getAttribute("aria-live")) === "polite", "results region has aria-live");
  check(["true", "false"].includes(await resultBox.getAttribute("aria-busy")), "results region exposes aria-busy");
  const copyAllLabel = await page.locator("button[aria-label='Copy all hashes']").count();
  check(copyAllLabel === 1, "copy-all has distinct accessible name");
  const algoCopy = await page.locator("button[aria-label^='Copy SHA-']").count();
  check(algoCopy === 4, "per-algorithm copy buttons have distinct accessible names");

  // --- routing ---
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/use/hash-generator`)) === 200, "/use/hash-generator 200");
  check((await page.evaluate((u) => fetch(u).then((r) => r.status), `${BASE_URL}/tools/hash-generator`)) === 200, "/tools/hash-generator 200");

  await page.goto(`${BASE_URL}/tools/hash-generator`, { waitUntil: "networkidle" });
  const body = await page.locator("body").textContent();
  check(body.includes("SHA-384"), "marketing copy mentions SHA-384");
  check(/md5/i.test(body), "marketing copy points MD5 users elsewhere");
  check(/checksum-calculator|Checksum Calculator/i.test(body), "MD5 guidance references the Checksum Calculator tool");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 300)}`);
  notes.push(String(e));
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (notes.length) console.log(notes.join("\n"));
process.exit(failed === 0 ? 0 : 1);