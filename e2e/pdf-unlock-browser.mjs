import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { isEncrypted } from "@pdfsmaller/pdf-decrypt";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-unlock`;
const DL = "/tmp/pdfunlock";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

{
  const doc = await PDFDocument.create();
  doc.setTitle("Already open");
  doc.addPage([595.28, 841.89]);
  writeFileSync(`${DL}/plain.pdf`, await doc.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
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
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const alert = (t) => page.locator("[role='alert']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");

async function captureDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to unlock", "file input carries an accessible name");
  check((await page.locator("[role='status']", { hasText: /Remove the password from a PDF you own/ }).first().textContent()).includes("nothing is uploaded"), "idle state sets honest ownership framing");

  // --- not-protected input: no password form, honest message ---
  await fileInput().setInputFiles(`${DL}/plain.pdf`);
  await page.locator("[role='status']", { hasText: /already opens without one/ }).waitFor({ timeout: 60000 });
  check((await page.locator("fieldset").count()) === 0, "plain PDF shows no password form");
  check((await page.locator("input[type='password']").count()) === 0, "no password field for an unprotected file");
  check((await page.locator("[role='status']", { hasText: /not password-protected — it already opens without one/ }).count()) === 1, "plain PDF gets the 'already opens without one' message");

  // --- restricted-but-open framing (empty password path) ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await page.locator("[role='status']", { hasText: /locked\.pdf loaded — password-protected/ }).waitFor({ timeout: 60000 });
  check((await page.locator("fieldset > legend").first().textContent()) === "Enter the password", "password fieldset appears for a protected file");
  check((await page.locator("p", { hasText: /The open password and the owner password both work/ }).count()) === 1, "copy says user and owner passwords both work");
  check((await page.locator("p", { hasText: /leave the field empty and unlock/ }).count()) === 1, "copy documents the restrictions-only path");

  // --- wrong password ---
  await page.locator("input[type='password']").fill("not-the-password");
  await page.locator("button", { hasText: /Unlock PDF → download/ }).click();
  await alert(/The password is wrong/).waitFor({ timeout: 60000 });
  check((await alert(/The password is wrong/).count()) === 1, "wrong password rejected with a friendly message");

  // --- unlock with the user (open) password ---
  await page.locator("input[type='password']").fill("pw");
  let d = await captureDownload(page.locator("button", { hasText: /Unlock PDF → download/ }), "u1.pdf");
  check(d.name === "locked-unlocked.pdf", "download named <source>-unlocked.pdf");
  const outIsEnc = await isEncrypted(new Uint8Array(d.bytes));
  check(outIsEnc.encrypted === false, "unlocked output is genuinely no longer encrypted");
  const opened = await PDFDocument.load(new Uint8Array(d.bytes));
  check(opened.getPageCount() === 1, "unlocked PDF loads plain with its page");
  check((await page.locator("input[type='password']").inputValue()) === "", "password field cleared after success");
  check((await page.locator("[role='status']", { hasText: /Downloaded locked-unlocked\.pdf/ }).first().textContent()).includes("password was removed"), "success status confirms the password was removed");

  // --- the owner password works too (honest copy promise) ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await page.locator("[role='status']", { hasText: /password-protected/ }).waitFor({ timeout: 60000 });
  await page.locator("input[type='password']").fill("owner");
  const d2 = await captureDownload(page.locator("button", { hasText: /Unlock PDF → download/ }), "u2.pdf");
  check(d2.name === "locked-unlocked.pdf", "owner-password unlock downloads the same name");
  check((await PDFDocument.load(new Uint8Array(d2.bytes))).getPageCount() === 1, "owner password also produces a valid unlocked copy");

  // --- error paths ---
  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const html = await (await page.request.get(`${BASE_URL}/tools/pdf-unlock`)).text();
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/’/g, "'").replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("You must know the password to unlock a PDF"), "copy states the must-know-the-password truth");
  check(body.includes("the owner password both work"), "copy says either password works");
  check(body.includes("AES-256") && body.includes("RC4"), "copy states supported encryption honestly");
  check(body.includes("AES-128 and rare custom schemes aren't supported"), "copy openly declares AES-128 unsupported");
  check(body.includes("files up to 100 MB"), "copy states the real size limit");
  check(!/Drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/instant/i.test(lower), "no 'instant unlocking' hype");
  check(!/no file size limits|no limits/i.test(lower), "no unbounded-limits claim");

  const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(titleTag.includes("Unlock PDF online") && !/conversion/i.test(titleTag), `tool page title is honest: "${titleTag}"`);

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-unlock-a-password-protected-pdf`);
  check(guide.status() === 200, "pdf-unlock guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-unlock"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-unlock-a-password-protected-pdf"), "sitemap lists the pdf-unlock guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);