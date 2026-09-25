import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-auto-redact`;
const TOOL_PAGE = `${BASE_URL}/tools/pdf-auto-redact`;
const GUIDE_URL = "/guides/how-to-auto-redact-pdf-online";
const DL = "/tmp/pdfautoredact";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([595.28, 841.89]);
  p.drawText("Invoice No: 48102 John Smith", { x: 50, y: 700, size: 12, font });
  writeFileSync(`${DL}/redact.pdf`, await doc.save({ useObjectStreams: false }));
}
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([612, 792]);
  p.drawText("48102 appears on the first page only.", { x: 50, y: 700, size: 12, font });
  for (let i = 2; i <= 60; i++) doc.addPage([612, 792]);
  writeFileSync(`${DL}/busy.pdf`, await doc.save({ useObjectStreams: false }));
}
{
  const doc = await PDFDocument.create();
  for (let i = 0; i < 201; i++) doc.addPage([612, 792]);
  writeFileSync(`${DL}/many.pdf`, await doc.save({ useObjectStreams: false }));
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

async function hasBlackBox(pdfBytes) {
  const doc = await PDFDocument.load(new Uint8Array(pdfBytes));
  let content = "";
  for (const page of doc.getPages()) {
    const contents = doc.context.lookup(page.node.normalizedEntries().Contents);
    const refs = contents.array ?? [contents];
    for (const ref of refs) {
      const stream = await doc.context.lookup(ref);
      const raw = stream.getContents();
      let text;
      try {
        text = Buffer.from(inflateSync(Buffer.from(raw))).toString("latin1");
      } catch {
        text = Buffer.from(raw).toString("latin1");
      }
      content += text + "\n";
    }
  }
  return content.includes("0 0 0 rg") && /(^|\n)h\nf(\n|$)/.test(content) && content.includes("1 0 0 1 50 ");
}

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
const termsInput = () => page.locator("textarea").first();

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

  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to auto-redact", "file input carries an accessible name");
  check((await page.locator("[role='status']", { hasText: /Find every occurrence of a name, number or phrase/ }).first().textContent()).includes("entirely in your browser"), "idle state describes the tool honestly");

  // --- happy path: match, review, confirm, download ---
  await fileInput().setInputFiles(`${DL}/redact.pdf`);
  await page.locator("[role='status']", { hasText: /redact\.pdf loaded — 1 page/ }).waitFor({ timeout: 60000 });
  check((await page.locator("fieldset").count()) >= 1, "search form appears after the file loads");
  check((await page.locator("button", { hasText: /^1$/ }).count()) >= 1, "page strip lists page 1");

  await termsInput().fill("48102");
  await page.locator("button", { hasText: /Find matches/ }).click();
  await page.locator("[role='status']", { hasText: /Found 1 match across 1 page/ }).waitFor({ timeout: 60000 });
  check((await page.locator("button", { hasText: `Redact these 1 match` }).count()) === 1, "confirm step offers to redact the single found match");
  check((await page.locator("button", { hasText: `Redact these 1 match` }).getAttribute("disabled")) === null, "confirm button is enabled for review");
  check((await page.locator("li", { hasText: /Page 1 — 1 match/ }).count()) === 1, "per-page match count is listed");
  check((await page.locator("button[aria-label='Page 1 — 1 match']").count()) === 1, "page-strip button reports its match count");
  await page.locator("img[alt^='Page 1 preview']").waitFor({ timeout: 60000 });
  check((await page.locator("img[alt^='Page 1 preview']").count()) === 1, "page preview renders with redaction annotations");

  await page.locator("button", { hasText: `Redact these 1 match` }).click();
  await page.locator("h3", { hasText: /Redacted copy ready/ }).waitFor({ timeout: 60000 });
  const dl = await captureDownload(page.locator("button", { hasText: /Download redact-redacted\.pdf/ }), "out.pdf");
  check(dl.name === "redact-redacted.pdf", "output is named <source>-redacted.pdf");
  check((await hasBlackBox(dl.bytes)), "downloaded PDF contains a solid black rectangle over the match");
  const outDoc = await PDFDocument.load(new Uint8Array(dl.bytes));
  check(outDoc.getPageCount() === 1, "downloaded PDF reloads with its page");
  check((await page.locator("[role='status']", { hasText: /Redactions drawn into a new PDF/ }).first().textContent()).includes("still exist below the boxes"), "success copy admits the cover is not an erasure");

  // --- no-match path: honest status, nothing to confirm or download ---
  await termsInput().fill("qqzznotthere");
  await page.locator("button", { hasText: /Find matches/ }).click();
  await page.locator("[role='status']", { hasText: /No matches found for "qqzznotthere"/ }).waitFor({ timeout: 60000 });
  check((await page.locator("button", { hasText: /Redact these/ }).count()) === 0, "no confirm step when nothing matches");
  check((await page.locator("button", { hasText: /Download .*redacted\.pdf/ }).count()) === 0, "no download offered when nothing matches");

  // --- invalid regex: friendly error, nothing is drawn ---
  await page.locator("label", { hasText: "Use regex" }).locator("input").check();
  await page.getByPlaceholder("\\b\\d{5}\\b").fill("(");
  await page.locator("button", { hasText: /Find matches/ }).click();
  await alert(/That regular expression is invalid/).waitFor({ timeout: 60000 });
  check((await alert(/That regular expression is invalid/).count()) === 1, "invalid regex surfaces a friendly alert");
  check((await page.locator("button", { hasText: /Redact these/ }).count()) === 0, "invalid regex never reaches the confirm step");

  // --- busy state: progress is announced while a longer search runs ---
  await fileInput().setInputFiles(`${DL}/busy.pdf`);
  await page.locator("[role='status']", { hasText: /busy\.pdf loaded — 60 pages/ }).waitFor({ timeout: 60000 });
  await page.locator("label", { hasText: "Use regex" }).locator("input").uncheck();
  await termsInput().fill("48102");
  await page.evaluate(() => {
    window.__busyProg = false;
    const mo = new MutationObserver(() => {
      if (window.__busyProg !== true) {
        const b = document.body.querySelector("button");
        if (b && /Searching page \d+ of 60/.test(b.textContent || "")) window.__busyProg = true;
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__progMo = mo;
  });
  await page.locator("button", { hasText: /Find matches/ }).click();
  await page.locator("[role='status']", { hasText: /Found 1 match across 1 page/ }).waitFor({ timeout: 120000 });
  check((await page.evaluate(() => !!window.__busyProg)), "busy state announces page-by-page progress during a search");
  await page.evaluate(() => window.__progMo?.disconnect());
  check((await page.locator("[aria-busy='true']").count()) === 0, "busy attribute clears after the search finishes");

  // --- error paths ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert(/password-protected/).waitFor({ timeout: 60000 });
  check((await alert(/password-protected/).count()) === 1, "encrypted PDF steers to unlocking");
  check((await page.locator("a", { hasText: /PDF Unlock/ }).count()) === 1, "encrypted error links to PDF Unlock");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  await fileInput().setInputFiles(`${DL}/many.pdf`);
  await alert(/up to 200 pages/).waitFor({ timeout: 60000 });
  check((await alert(/up to 200 pages/).count()) === 1, "over-long document is rejected");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const html = await (await page.request.get(TOOL_PAGE)).text();
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/’/g, "'").replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("covered words still exist below the boxes"), "copy states that boxes cover rather than erase the text");
  check(body.includes("case-insensitive by default"), "copy discloses case-insensitive matching by default");
  check(body.includes("up to 100 MB and 200 pages"), "copy states the real size and page limits");
  check(body.includes("confirm") && body.includes("preview"), "copy describes the review-then-confirm workflow");
  check(body.includes("text layer"), "copy grounds matching in the PDF's text layer");
  check(!/permanently blackens|permanently erases|permanently removes/i.test(lower), "no permanent-erasure hype");
  check(!/exclude pages/i.test(lower), "no exclude-pages feature promise");
  check(!/Drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/instant/i.test(lower), "no 'instant' hype");
  check(!/no file size limits|no limits/i.test(lower), "no unbounded-limits claim");

  const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(titleTag.includes("Auto-Redact PDF online") && !/conversion/i.test(titleTag), `tool page title is honest: "${titleTag}"`);

  const guide = await page.request.get(`${BASE_URL}${GUIDE_URL}`);
  check(guide.status() === 200, "auto-redact guide renders");
  const guideBody = (await guide.text()).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/’/g, "'");
  check(guideBody.includes("still exist below them below the boxes") || guideBody.includes("still exist"), "guide admits the cover is not an erasure");
  check(guideBody.includes("case-insensitive by default"), "guide states the default matching behavior");
  check(guideBody.includes("100 matches"), "guide discloses the match cap");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-auto-redact"), "sitemap lists the tool page");
  check(sitemap.includes(GUIDE_URL), "sitemap lists the auto-redact guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);