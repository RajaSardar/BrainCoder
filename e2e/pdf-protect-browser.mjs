import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { isEncrypted, decryptPDF } from "@pdfsmaller/pdf-decrypt";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-protect`;
const DL = "/tmp/pdfprotect";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

{
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 3; i++) doc.addPage([595.28, 841.89]);
  writeFileSync(`${DL}/plain3.pdf`, await doc.save());
}
{
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 201; i++) doc.addPage([595.28, 841.89]);
  writeFileSync(`${DL}/manypages.pdf`, await doc.save());
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

  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to protect", "file input carries an accessible name");
  check((await page.locator("[role='status']", { hasText: /nothing is uploaded/ }).first().textContent()).includes("Lock a PDF with a password"), "idle state explains processing is local");
  check((await page.locator("fieldset").count()) === 0, "password controls hidden until a document is loaded");

  // --- upload + validation gates ---
  await fileInput().setInputFiles(`${DL}/plain3.pdf`);
  await page.locator("[role='status']", { hasText: /plain3\.pdf — 3 pages/ }).waitFor({ timeout: 60000 });
  check((await page.locator("fieldset > legend").allTextContents()).join("|") === "Set a password|Restrict what recipients can do (optional)", "both fieldsets render");
  check((await page.locator("label", { hasText: /Block printing/ }).count()) === 1, "printing restriction toggle present");
  check((await page.locator("label", { hasText: /Block annotating/ }).count()) === 1, "annotating restriction toggle present");

  const pw = page.locator("input[type='password']");
  await pw.first().fill("1234");
  await pw.nth(1).fill("1234");
  await page.locator("button", { hasText: /Protect PDF → download/ }).click();
  await alert("Password must be at least 5 characters.").waitFor({ timeout: 15000 });
  check((await alert("Password must be at least 5 characters.").count()) === 1, "short password rejected");

  await pw.first().fill("Secret123");
  await pw.nth(1).fill("Different123");
  await page.locator("button", { hasText: /Protect PDF → download/ }).click();
  await alert("The passwords do not match.").waitFor({ timeout: 15000 });
  check((await alert("The passwords do not match.").count()) === 1, "mismatched passwords rejected");

  // --- real AES-256 encryption, printing blocked ---
  await page.locator("label", { hasText: /Block printing/ }).locator("input[type='checkbox']").check();
  await pw.first().fill("Secret123");
  await pw.nth(1).fill("Secret123");
  let d = await captureDownload(page.locator("button", { hasText: /Protect PDF → download/ }), "p1.pdf");
  check(d.name === "plain3-protected.pdf", "download named <source>-protected.pdf");
  let outIsEnc = await isEncrypted(new Uint8Array(d.bytes));
  check(outIsEnc.encrypted === true && outIsEnc.algorithm === "AES-256", "output is genuinely AES-256 encrypted");
  check(outIsEnc.version === 5 && outIsEnc.revision === 6, "AES-256 revision 6 (Acrobat-compatible)");
  let plainLoadThrew = false;
  try {
    await PDFDocument.load(new Uint8Array(d.bytes));
  } catch {
    plainLoadThrew = true;
  }
  check(plainLoadThrew, "encrypted copy cannot be opened without a password (plain load throws)");
  const dec = await decryptPDF(new Uint8Array(d.bytes), "Secret123");
  const opened = await PDFDocument.load(dec);
  check(opened.getPageCount() === 3, "decrypted with the password and all 3 pages intact");
  check((await pw.first().inputValue()) === "" && (await pw.nth(1).inputValue()) === "", "password fields cleared after a successful protect");
  check((await page.locator("[role='status']", { hasText: /Protected 3 pages/ }).first().textContent()).includes("opens only with your password"), "success status explains the outcome");

  // --- limit / error paths (a re-protect of a fresh plain file is a *valid*
  // successful protect, so encryption-only paths are covered by locked.pdf) ---
  await fileInput().setInputFiles(`${DL}/manypages.pdf`);
  await alert("up to 200 pages").waitFor({ timeout: 60000 });
  check((await alert("up to 200 pages").count()) === 1, "over 200 pages rejected with guidance");

  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("already password-protected").waitFor({ timeout: 60000 });
  check((await alert("already password-protected").count()) === 1, "encrypted PDF upload shows the friendly guard");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty (server-rendered /tools page) ---
  const html = await (await page.request.get(`${BASE_URL}/tools/pdf-protect`)).text();
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/’/g, "'").replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("AES-256"), "copy states the real encryption standard");
  check(body.includes("files up to 100 MB"), "copy states the real size limit");
  check(body.includes("at least 5 characters"), "copy states the password minimum");
  check(body.includes("Unlock PDF"), "copy routes removal to Unlock PDF");
  check(body.includes("never leave your device"), "copy states the privacy model");
  check(body.includes("honored by Adobe Acrobat and most desktop readers"), "copy admits viewer caveats for restrictions");
  check(!/Drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/owner and user passwords/i.test(lower), "no owner+user two-password promise (single password only)");
  check(!/no file size limits|no limits/i.test(lower), "no unbounded-limits claim");
  check(!/virtually unbreakable/i.test(lower), "no hype wording");

  const toolTitle = (await page.request.get(`${BASE_URL}/tools/pdf-protect`)).text();
  const titleTag = String(await page.request.get(`${BASE_URL}/tools/pdf-protect`).then((r) => r.text())).match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  void toolTitle;
  check(titleTag.includes("Password Protect PDF online") && !/conversion/i.test(titleTag), `tool page title is honest: "${titleTag}"`);

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-password-protect-a-pdf`);
  check(guide.status() === 200, "pdf-protect guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-protect"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-password-protect-a-pdf"), "sitemap lists the pdf-protect guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);