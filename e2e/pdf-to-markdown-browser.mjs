import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-to-markdown`;
const DL = "/tmp/pdf-md";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// 2-page fixture: page 1 blank (no text layer), page 2 heading + paragraph.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([612, 792]); // blank page -> no selectable text
  const p2 = doc.addPage([612, 792]);
  p2.drawText("Meeting Notes", { x: 40, y: 700, size: 18, font });
  p2.drawText("The report was printed in March.", { x: 40, y: 660, size: 12, font });
  p2.drawText("Follow up next week.", { x: 40, y: 640, size: 12, font });
  writeFileSync(`${DL}/notes.pdf`, await doc.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "definitely not a pdf\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
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
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t))
    consoleIssues.push(t);
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
  await page
    .locator("button", { hasText: /Open PDF/ })
    .waitFor({ state: "visible", timeout: 15000 });

  check(
    (await fileInput().getAttribute("aria-label")) ===
      "Choose a PDF to convert to Markdown",
    "file input carries an accessible name",
  );
  check(
    (await page
      .locator("[role='status']", { hasText: /Extracts a PDF's text layer into Markdown/ })
      .first().textContent()
    ).includes("headings and lists are best-effort guesses"),
    "idle status discloses best-effort headings/lists",
  );

  // --- happy path: heading + paragraph + blank page ---
  await fileInput().setInputFiles(`${DL}/notes.pdf`);
  await page
    .locator("[role='status']", { hasText: /notes\.pdf — 2 pages/ })
    .waitFor({ timeout: 60000 });
  check(
    (await page.locator("[role='status']", { hasText: /notes\.pdf — 2 pages/ }).first().textContent())
      .includes("chars"),
    "status reports page and char counts",
  );
  check(
    (await page.locator("[role='status']", { hasText: /Pages 1 have no selectable text/ }).count()) === 1,
    "blank page is called out honestly",
  );
  check(
    (await page.locator("[role='status']", { hasText: /Pages 1 have no selectable text/ }).locator("a").getAttribute("href")) === "/use/pdf-ocr",
    "blank-page note links to PDF OCR",
  );
  check(
    (await page.locator("pre, [class*='whitespace-pre-wrap']").first().textContent()).includes("# Meeting Notes\n"),
    "markdown preview starts with the # title",
  );
  check(
    (await page.locator("[role='status']", { hasText: /The \.html is a rendering/ }).count()) === 1,
    "copy says the .html is only a rendering of the markdown",
  );

  // --- .md download: honest structure, no HTML comments, page separator ---
  const m = await captureDownload(page.locator("button", { hasText: /Download \.md/ }), "notes.md");
  check(m.name === "notes.md", ".md download named <source>.md");
  const md = m.bytes.toString("utf8");
  check(md.includes("# Meeting Notes"), ".md contains the H1 title");
  check(md.includes("The report was printed in March."), ".md keeps the paragraph text");
  check(md.includes("\n---\n"), ".md separates pages with ---");
  check(!md.includes("<!--"), ".md contains no HTML comments");
  check(!/^\s*[-*•]/.test(md), ".md doesn't falsely start with a bullet");

  // --- .html download: valid rendering of the markdown ---
  const h = await captureDownload(page.locator("button", { hasText: /Download \.html/ }), "notes.html");
  check(h.name === "notes.html", ".html download named <source>.html");
  const html = h.bytes.toString("utf8");
  check(html.includes("<!DOCTYPE html>") && html.includes("<h2>Meeting Notes</h2>") && html.includes("</html>"), ".html is a real rendered document");
  check(html.includes("</html>") && html.includes("Meeting Notes") && !html.includes("<table"), ".html contains no fake tables");

  // --- error paths ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert(/password-protected/).waitFor({ timeout: 60000 });
  check((await alert(/This PDF is password-protected/).count()) === 1, "encrypted file gets a friendly password message");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert(/doesn't look like a valid PDF/).waitFor({ timeout: 60000 });
  check((await alert(/doesn't look like a valid PDF/).count()) === 1, "non-PDF upload shows an invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const h2 = await (await page.request.get(`${BASE_URL}/tools/pdf-to-markdown`)).text();
  const body = h2
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/’/g, "'")
    .replace(/“|”/g, '"');
  const lower = h2.toLowerCase();
  check(h2.length > 100, "tool marketing page renders");
  check(body.includes("best-effort"), "copy says headings/lists are best-effort");
  check(body.includes("text layer"), "copy says it reads the text layer");
  check(body.includes("100 MB") && body.includes("200 pages"), "copy states the real limits");
  check(!/preserves (tables|formatting)|maintains tables|keeps tables/i.test(lower), "no claim of preserved tables/formatting");
  check(/does not reproduce tables, bold\/italic/i.test(body), "copy actually states formatting is NOT reproduced");
  check(!/drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/accurate|perfect|copies your pdf/i.test(lower), "no accuracy hype");

  const titleTag = h2.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(
    titleTag.includes("PDF to Markdown") &&
      /extract|convert/i.test(titleTag) &&
      !/accurately|100%/i.test(titleTag),
    `tool page title is honest: "${titleTag}"`,
  );

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-convert-pdf-to-markdown`);
  check(guide.status() === 200, "pdf-to-markdown guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-to-markdown"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-convert-pdf-to-markdown"), "sitemap lists the pdf-to-markdown guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);