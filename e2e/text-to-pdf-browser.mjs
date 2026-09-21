import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const DL = "/tmp/t2p";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const pdfjsMod = await import("../node_modules/pdfjs-dist/legacy/build/pdf.mjs");
const pdfjs = pdfjsMod.default ?? pdfjsMod;
const SFD = new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).pathname;
const toBytes = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
const extractText = async (buf) => {
  const task = pdfjs.getDocument({ data: toBytes(buf), standardFontDataUrl: SFD });
  const doc = await task.promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it) => it.str).join(" "));
  }
  await task.destroy();
  return pages;
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();

let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log(`ok  ${label}`); }
  else { failed++; console.error(`NOT OK  ${label}`); }
}

const consoleIssues = [];
const pageErrors = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const sample = `BrainCoder — Text to PDF\n\nThis page turns plain text into a clean, paginated PDF entirely in your browser.\n\nType a long paragraph and the text wraps automatically to fit the page width.\n\n  • Bullets and basic punctuation are preserved.\n  • Every newline starts a fresh paragraph.\n  • Pages split automatically when the text reaches the bottom margin.\n\nTry pasting several paragraphs to see the multi-page output.`;

async function downloadPdf(label) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  const path = `${DL}/${label}.pdf`;
  await download.saveAs(path);
  return path;
}

try {
  await page.goto(`${BASE_URL}/use/text-to-pdf`, { waitUntil: "networkidle" });
  const ta = page.locator("#text-to-pdf-input");
  await ta.waitFor({ state: "visible", timeout: 15000 });

  check((await ta.getAttribute("aria-labelledby") !== null) || (await ta.getAttribute("aria-label") !== null) || (await page.locator("label").count()) > 0, "textarea has an accessible name association");
  check((await ta.inputValue()) === sample, "pre-filled sample renders server-side");
  check(await page.getByRole("button", { name: "Download PDF" }).isVisible(), "Download PDF button visible");
  check((await ta.getAttribute("maxlength")) === "500000", "input capped at 500,000 characters (maxlength)");
  check((await page.getByRole("status").count()) >= 1, "role=status live region present");
  check(await page.locator("input[type=range]").evaluate((el) => el.labels?.length === 1), "font-size slider has an associated label");
  check((await page.getByText("13 pt", { exact: false }).count()) >= 1, "slider shows default 13 pt");

  await ta.fill("");
  check(await page.getByRole("button", { name: "Download PDF" }).isDisabled(), "empty text disables Download PDF");
  check((await page.getByRole("status").innerText()).includes("Nothing to build yet"), "empty state announced");

  const longWord = "x".repeat(1200);
  const manyParagraphs = "The brown dog leaps over the lazy cat. Line two of this paragraph keeps the page fuller. ".repeat(60);
  await ta.fill(`alpha beta gamma\n${longWord}\n${manyParagraphs}\nfinal line`);
  await page.waitForTimeout(150);
  const statusText = await page.getByRole("status").innerText();
  check(/chars — wrapped & paginated at A4/.test(statusText), "status shows live character count (A4)");

  await page.getByRole("slider").fill("16");
  check((await page.getByText("16 pt", { exact: false }).count()) >= 1, "slider updates to 16 pt");

  const p1 = await downloadPdf("longword");
  const p1buf = (await import("node:fs")).readFileSync(p1);
  check(Buffer.from(p1buf).subarray(0, 5).toString() === "%PDF-", "downloaded file is a PDF (magic bytes)");
  const doc1 = await PDFDocument.load(toBytes(p1buf));
  check(doc1.getPageCount() >= 2, "long input paginates to multiple pages");

  const pages1 = await extractText(p1buf);
  const flat1 = pages1.join(" ");
  const xCount = (flat1.match(/x+/g) || []).reduce((s, m) => s + m.length, 0);
  check(flat1.includes("alpha beta gamma"), "extraction keeps paragraph words");
  check(xCount === 1200, "1,200-char unbroken word survives (chunking fix)");
  check(flat1.includes("final line"), "last line present");

  const firstOverwidth = "A".repeat(1500);
  await ta.fill(`${firstOverwidth} tail`);
  const p2 = await downloadPdf("firstover");
  const p2buf = (await import("node:fs")).readFileSync(p2);
  const pages2 = await extractText(p2buf);
  const flat2 = pages2.join("");
  const aCount = (flat2.match(/A+/g) || []).reduce((s, m) => s + m.length, 0);
  check(aCount === 1500, "first-word over-width token fully chunked (no clipping)");
  check((await PDFDocument.load(toBytes(p2buf))).getPageCount() >= 1, "first-overwidth PDF valid");

  await ta.fill("你好 world");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const a1 = page.getByRole("alert").filter({ hasText: "basic Latin" });
  await a1.waitFor({ state: "visible", timeout: 15000 });
  const a1text = await a1.innerText();
  check(a1text.includes("basic Latin") && a1text.includes("你"), "CJK input surfaces a friendly role=alert error listing the character");
  check(await page.getByRole("button", { name: "Download PDF" }).isEnabled(), "button re-enabled after error");

  await ta.fill("emoji 😀 test");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const a2 = page.getByRole("alert").filter({ hasText: "basic Latin" });
  await a2.waitFor({ state: "visible", timeout: 15000 });
  check((await a2.innerText()).includes("😀"), "emoji input surfaced in friendly error");

  check((await page.getByRole("alert").filter({ hasText: "basic Latin" }).count()) === 1, "single friendly error at a time");

  const plain = "hello café — bullet • town";
  await ta.fill(plain);
  const p3 = await downloadPdf("plain");
  const p3buf = (await import("node:fs")).readFileSync(p3);
  const pages3 = await extractText(p3buf);
  const flat3 = pages3.join(" ");
  check(flat3.includes("café") && flat3.includes("—") && flat3.includes("•"), "WinAnsi-safe accented Latin, em-dash and bullet preserved");

  // cap note + aria-busy during a large build
  await ta.fill("");
  await ta.focus();
  await page.keyboard.insertText("z".repeat(560000));
  const cappedVal = await ta.inputValue();
  check(cappedVal.length === 500000, "typing beyond the cap is truncated at 500,000");
  await page.getByRole("status").filter({ hasText: "caps input at 500,000" }).waitFor({ state: "visible", timeout: 15000 });
  check(true, "cap disclosed in the status region");
  const p4 = await downloadPdf("big");
  const p4buf = (await import("node:fs")).readFileSync(p4);
  check(Buffer.from(p4buf).subarray(0, 5).toString() === "%PDF-", "500k-char input still produces a valid PDF");

  await page.goto(`${BASE_URL}/tools/text-to-pdf`, { waitUntil: "networkidle" });
  const body = await page.locator("body").innerText();
  check(body.includes("font size") && /10–24 pt|10-24 pt/.test(body), "landing copy truthfully describes the 10–24 pt font-size control");
  check(!/margins, and line spacing/.test(body), "landing copy no longer claims margin/line-spacing customization");
  check(!/A4 or Letter/.test(body), "landing FAQ no longer claims Letter support");
  check(body.includes("Download PDF"), "howTo references the real Download PDF button");
  check(body.includes("basic Latin"), "landing discloses the basic-Latin (WinAnsi) limitation");
  check(/500,000|500k/.test(body), "landing discloses the character cap");

  await page.goto(`${BASE_URL}/guides/how-to-convert-text-to-pdf`, { waitUntil: "networkidle" });
  check((await page.locator("h1").innerText()).toLowerCase().includes("text to pdf"), "new text-to-pdf guide renders");

  check(consoleIssues.length === 0, `no hydration errors (${consoleIssues.join(" | ")})`);
  check(pageErrors.length === 0, `no page errors (${pageErrors.join(" | ")})`);
} catch (err) {
  console.error("HARNESS ERROR", err);
  failed++;
} finally {
  await browser.close();
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);