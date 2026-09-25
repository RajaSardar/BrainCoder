import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-compare`;
const DL = "/tmp/pdfcompare";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

async function makePdf(pages) {
  const doc = await PDFDocument.create();
  for (const t of pages) {
    doc.addPage([612, 792]).drawText(t, { x: 50, y: 700, size: 12 });
  }
  return await doc.save({ useObjectStreams: false });
}

const v1 = await makePdf([
  "The quick brown fox",
  ...Array.from({ length: 59 }, () => "Same line"),
]);
const v2 = await makePdf([
  "The slow brown fox",
  ...Array.from({ length: 59 }, () => "Same line"),
]);
const v3 = await makePdf([
  "The slow brown fox",
  ...Array.from({ length: 59 }, () => "Same line"),
]);
const cap = await makePdf(["cap row"]);
writeFileSync(`${DL}/v1.pdf`, v1);
writeFileSync(`${DL}/v2.pdf`, v2);
writeFileSync(`${DL}/v3.pdf`, v3);
for (let i = 1; i <= 6; i++) writeFileSync(`${DL}/cap${i}.pdf`, cap);
{
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 201; i++) doc.addPage([612, 792]);
  writeFileSync(`${DL}/manypages.pdf`, await doc.save());
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) {
    passed++;
    console.log(`ok  ${label}`);
  } else {
    failed++;
    console.error(`NOT OK  ${label}`);
  }
}

const hydrationErrors = [];
const pageErrors = [];
const allRequests = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) hydrationErrors.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("request", (r) => allRequests.push({ url: r.url(), method: r.method() }));

const alert = (t) => page.locator("[role='alert']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");
const addButton = () => page.locator("button", { hasText: /Add PDF/ });
const compareButton = () => page.locator("button", { hasText: /Compare PDFs/ });

async function captureDownload(buttonLocator, saveAs, timeout = 60000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: readFileSync(`${DL}/${saveAs}`) };
}

async function addFile(path) {
  await fileInput().setInputFiles(path);
}

function docRow(name) {
  return page.locator("fieldset", { hasText: "PDFs to compare" }).locator("li", { hasText: new RegExp(name) });
}

function gotoPage() {
  return page.goto(PAGE, { waitUntil: "networkidle" });
}

try {
  await gotoPage();
  await page.waitForTimeout(400);
  await addButton().waitFor({ state: "visible", timeout: 15000 });

  check((await fileInput().getAttribute("aria-label")) === "Add a PDF to compare", "file input carries an accessible name");
  check(
    (await page.locator("[role='status']", { hasText: /Nothing is uploaded/ }).first().textContent()).includes("Add 2–5 PDFs"),
    "idle state explains the tool and local processing",
  );
  check((await page.locator("h1").last().textContent()).includes("PDF Compare"), "tool page heading renders");
  check((await page.locator("input[type='radio']").count()) === 0, "no original radios before any file is added");

  // --- happy path: two 60-page PDFs differing only on page 1 ---
  await addFile(`${DL}/v1.pdf`);
  await docRow("v1\\.pdf").waitFor({ timeout: 60000 });
  check((await docRow("v1\\.pdf").textContent()).includes("60 pages"), "v1 added with page count shown");
  await addFile(`${DL}/v2.pdf`);
  await docRow("v2\\.pdf").waitFor({ timeout: 60000 });
  check((await page.locator("fieldset legend").allTextContents()).join("|") === "PDFs to compare|Compare options", "fieldsets render with legends");
  check((await page.locator("input[type='radio']").count()) === 2, "one original radio per PDF");
  check((await compareButton().isEnabled()), "compare button enabled with two files");

  await compareButton().click();
  await page.locator("[role='status']", { hasText: /Reading v1\.pdf/ }).last().waitFor({ timeout: 60000 });
  await page.locator("h2", { hasText: /Diff against v1\.pdf/ }).waitFor({ timeout: 120000 });
  check((await page.locator("h2", { hasText: /Diff against v1\.pdf/ }).count()) === 1, "diff results render for the first original");
  check((await page.locator("[role='alert']").filter({ hasText: /\S/ }).count()) === 0, "no error during a normal comparison");
  check((await page.locator("[aria-busy='true']").count()) === 0, "busy clears after the comparison finishes");

  check((await page.locator("td", { hasText: "The quick brown fox" }).count()) === 1, "removed line shown for the changed line");
  check((await page.locator("td", { hasText: "The slow brown fox" }).count()) === 1, "added line shown for the changed line");
  check((await page.locator("td.bg-red-50", { hasText: "The quick brown fox" }).count()) === 1, "removed line styled red");
  check((await page.locator("td.bg-green-50", { hasText: "The slow brown fox" }).count()) === 1, "added line styled green");
  check((await page.locator("span", { hasText: /Page 1 of 60/ }).count()) === 1, "page navigation shows page 1 of 60");

  await page.locator("button[aria-label='Next page']").click();
  await page.locator("span", { hasText: "Page 2 of 60" }).waitFor({ timeout: 15000 });
  check((await page.locator("td.bg-red-50").count()) === 0 && (await page.locator("td.bg-green-50").count()) === 0, "page 2 shows no changed lines");
  check((await page.locator("p", { hasText: /No changes/ }).count()) >= 1, "page 2 reports no changes");
  check((await page.locator("td", { hasText: "Same line" }).count()) >= 2, "unchanged line shown on both sides");

  await page.locator("label", { hasText: "Only show changed lines" }).locator("input[type='checkbox']").check();
  check((await page.locator("td", { hasText: "Same line" }).count()) === 0, "only-changes filter hides unchanged lines on page 2");
  check((await page.locator("text=No changed lines on this page.").count()) === 1, "only-changes filter explains an untouched page");

  await page.locator("button[aria-label='Previous page']").click();
  await page.locator("span", { hasText: "Page 1 of 60" }).waitFor({ timeout: 15000 });
  check((await page.locator("td.bg-red-50", { hasText: "The quick brown fox" }).count()) === 1, "back to page 1 shows the removed line again");

  // --- download the report, named from the original file ---
  const d = await captureDownload(page.locator("button", { hasText: /Download diff report/ }), "report.txt");
  check(d.name === "v1-diff-report.txt", `report named from the original file (got "${d.name}")`);
  const report = d.bytes.toString("utf8");
  check(report.includes("added: The slow brown fox"), "report records the added line");
  check(report.includes("removed: The quick brown fox"), "report records the removed line");
  check(report.includes("Page 1 — 1 added, 1 removed"), "report states the per-page counts");
  check(report.includes("Original: v1.pdf (60 pages)"), "report names the original file");
  check(report.includes("Text-Layer Diff Report"), "report states it is a text-layer diff");

  // --- switching the original recomputes against the new base ---
  await addFile(`${DL}/v3.pdf`);
  await docRow("v3\\.pdf").waitFor({ timeout: 60000 });
  check((await page.locator("h2", { hasText: /Diff against v1\.pdf/ }).count()) === 0, "results clear when a new file is added");
  await page.locator("input[type='radio']").last().check();
  check((await page.locator("h2", { hasText: /Diff against v1\.pdf/ }).count()) === 0, "results clear when the original changes");
  await compareButton().click();
  await page.locator("h2", { hasText: /Diff against v3\.pdf/ }).waitFor({ timeout: 120000 });
  check((await page.locator("h2", { hasText: /Diff against v3\.pdf/ }).count()) === 1, "comparison re-runs against the new original");
  check((await page.locator("p", { hasText: "v1.pdf vs v3.pdf" }).count()) === 1, "first card compares v1 against the new original");
  check((await page.locator("p", { hasText: "v2.pdf vs v3.pdf" }).count()) === 1, "second card compares v2 against the new original");

  // --- error paths on a fresh page ---
  await gotoPage();
  await addButton().waitFor({ state: "visible", timeout: 15000 });
  await addFile(`${DL}/manypages.pdf`);
  await alert(/up to 200 pages/).waitFor({ timeout: 60000 });
  check((await alert(/up to 200 pages/).count()) === 1, "over-200-page PDF rejected with guidance");

  await addFile(`${DL}/locked.pdf`);
  await alert(/already password-protected/).waitFor({ timeout: 60000 });
  check((await alert(/already password-protected/).count()) === 1, "encrypted PDF shows the friendly unlock steer");

  await addFile(`${DL}/notapdf.pdf`);
  await alert(/doesn't look like a valid PDF/).waitFor({ timeout: 60000 });
  check((await alert(/doesn't look like a valid PDF/).count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await addFile(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  await gotoPage();
  await addButton().waitFor({ state: "visible", timeout: 15000 });
  for (let i = 1; i <= 5; i++) {
    await addFile(`${DL}/cap${i}.pdf`);
    await page.locator("li", { hasText: new RegExp(`cap${i}\\.pdf`) }).waitFor({ timeout: 60000 });
  }
  await page.locator("li", { hasText: "cap5.pdf" }).waitFor({ timeout: 60000 });
  await addFile(`${DL}/cap6.pdf`);
  await alert(/Only up to 5 PDFs/).waitFor({ timeout: 60000 });
  check((await alert(/Only up to 5 PDFs/).count()) === 1, "a sixth PDF is rejected by the document cap");

  check(hydrationErrors.length === 0, `no hydration errors (got ${hydrationErrors.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);
  const posts = allRequests.filter((r) => r.method === "POST");
  check(posts.length === 0, "no POST requests during any tool scenarios (nothing uploaded)");

  // --- marketing copy honesty (server-rendered /tools page) ---
  const html = await (await page.request.get(`${BASE_URL}/tools/pdf-compare`)).text();
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/’/g, "'").replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 1000, "tool marketing page renders");
  check(body.includes("compare the embedded text layers") || lower.includes("text layer"), "copy states it is a text-layer comparison");
  check(body.includes("not a visual or pixel diff") || lower.includes("not a visual"), "copy admits it is not a visual/pixel diff");
  check(body.includes("100 MB"), "copy states the real size limit");
  check(body.includes("200 pages"), "copy states the real page limit");
  check(body.includes("Unlock PDF"), "copy routes encrypted files to Unlock PDF");
  check(body.includes("removed") && body.includes("added"), "copy explains highlighted lines");
  check(!/drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/100% accurate/i.test(lower), "no accuracy guarantee claim");
  check(!/no file size limits|no limits|unlimited/i.test(lower), "no unbounded-limits claim");
  check(!/overlay comparison|visual layout comparison/i.test(lower), "no pixel-diff/overlay feature claim");

  const toolHtml = await (await page.request.get(`${BASE_URL}/tools/pdf-compare`)).text();
  const titleTag = toolHtml.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(titleTag.includes("Compare PDFs online") && !/conversion/i.test(titleTag), `tool page title is honest: "${titleTag}"`);

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-compare-pdfs-online`);
  check(guide.status() === 200, "pdf-compare guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-compare"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-compare-pdfs-online"), "sitemap lists the pdf-compare guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);