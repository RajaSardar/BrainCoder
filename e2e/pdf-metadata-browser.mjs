import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-metadata`;
const DL = "/tmp/pdfmetadata";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

{
  const doc = await PDFDocument.create();
  doc.setTitle("Quarterly Report");
  doc.setAuthor("Jane Tester");
  doc.setSubject("Q3 results");
  doc.setKeywords(["revenue", "gross margin"]);
  doc.setCreator("CheckScript");
  doc.setProducer("FixtureWriter 9.0");
  doc.setCreationDate(new Date("2024-01-15T14:00:00+05:30"));
  doc.setModificationDate(new Date("2024-02-20T09:15:00Z"));
  for (let i = 0; i < 2; i++) doc.addPage([595.28, 841.89]);
  writeFileSync(`${DL}/meta.pdf`, await doc.save());
}
// minimal PDF with no Info dictionary at all — pdf.js tolerates this loose layout
{
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xs = Buffer.byteLength(out);
  out += `xref\n0 4\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Root 1 0 R /Size 4 >>\nstartxref\n${xs}\n%%EOF`;
  writeFileSync(`${DL}/bare.pdf`, out);
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

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  check((await fileInput().getAttribute("aria-label")) === "Choose a PDF to inspect", "file input carries an accessible name");
  check((await page.locator("[role='status']", { hasText: /Inspect the metadata a PDF actually stores/ }).first().textContent()).includes("nothing is uploaded"), "idle state explains processing is local");
  check((await page.locator("dl").count()) === 0, "no metadata list before a document is loaded");
  check((await page.locator("h1, h2", { hasText: /Metadata/ }).count()) >= 1, "metadata heading structure present");

  // --- populated document ---
  await fileInput().setInputFiles(`${DL}/meta.pdf`);
  await page.locator("[role='status']", { hasText: /meta\.pdf — \d+.* KB/ }).waitFor({ timeout: 60000 });
  await page.locator("dt", { hasText: /Pages/ }).waitFor({ timeout: 60000 });

async function rowEntries() {
  const dts = await page.locator("dt").allTextContents();
  const out = {};
  for (let i = 0; i < dts.length; i++) {
    out[(await page.locator("dt").nth(i).textContent()).trim()] = (await page.locator("dd").nth(i).textContent()).trim();
  }
  return out;
}

  {
    const rows = await rowEntries();
    const keys = Object.keys(rows);
    check(keys.length >= 8, `row set looks complete (${keys.length} keys)`, keys.join(","));
    check(rows["Pages"] === "2", "Pages row is first and exact");
    check(rows["Title"] === "Quarterly Report", "Title read from the Info dictionary");
    check(rows["Author"] === "Jane Tester", "Author read from the Info dictionary");
    check(rows["Created"] === "2024-01-15 08:30:00 Z", `Created formatted honestly from the raw D: value (${rows["Created"]})`);
    check(keys.filter((k) => k === "Created").length === 1, "exactly one Created row");
    check(keys.includes("Modified"), "Modified row present");
    check(keys.includes("Producer"), "Producer row present");
    check(!keys.includes("CreationDate") && !keys.includes("ModDate"), "raw CreationDate/ModDate keys never leak");
    check(!Object.values(rows).some((v) => v.includes("[object Map]")), "no '[object Map]' value");
    check((rows["Keywords"] ?? "").includes("revenue"), "Keywords listed");
  }

  // --- second upload replaces the list (runId path) ---
  await fileInput().setInputFiles(`${DL}/bare.pdf`);
  await page.locator("[role='status']", { hasText: /No title, author or date metadata was found/ }).waitFor({ timeout: 60000 });
  const bareDts = (await page.locator("dt").allTextContents()).map((t) => t.trim());
  check(bareDts.join(",") === "Pages,Format", "bare document shows only Pages and Format (nothing invented)", bareDts.join(","));

  // --- error + steering paths ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert("password-protected").waitFor({ timeout: 60000 });
  check((await alert("password-protected").count()) === 1, "encrypted PDF steers to Unlock PDF");
  check((await page.locator("body").textContent()).includes("Unlock PDF"), "steering message names Unlock PDF");

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert("doesn't look like a valid PDF").waitFor({ timeout: 60000 });
  check((await alert("doesn't look like a valid PDF").count()) === 1, "non-PDF upload shows a friendly invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const html = await (await page.request.get(`${BASE_URL}/tools/pdf-metadata`)).text();
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/’/g, "'").replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("read-only viewer"), "copy states the tool is read-only");
  check(body.includes("page count"), "copy mentions the page count explicitly");
  check(body.includes("Nothing is invented"), "copy says missing fields are skipped, not shown empty");
  check(body.includes("Unlock PDF"), "copy routes protected files to Unlock PDF");
  check(body.includes("files up to 100 MB"), "copy states the real size limit");
  check(!/Drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/supports metadata editing|metadata editing capability/i.test(lower), "no phantom editing promise");
  check(!/(export|download).*metadata report/i.test(lower), "no export/download-report promise");
  check(!/encryption status/i.test(lower), "no fabricated encryption-status feature");
  check(!/instantly displays/i.test(lower), "no hype wording");

  const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(titleTag.includes("View PDF Metadata online") && !/conversion/i.test(titleTag), `tool page title is honest: "${titleTag}"`);

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-view-pdf-metadata`);
  check(guide.status() === 200, "pdf-metadata guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-metadata"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-view-pdf-metadata"), "sitemap lists the pdf-metadata guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);