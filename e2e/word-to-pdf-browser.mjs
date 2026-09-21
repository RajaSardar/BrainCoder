import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { zipSync } from "/Users/rajasardar/repos/BrainCoder/node_modules/fflate/esm/browser.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/word-to-pdf`;
const DL = "/tmp/w2p";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const enc = (s) => new TextEncoder().encode(s);
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const EMPTY_DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

function buildDocx(passthrough) {
  return zipSync(
    {
      "[Content_Types].xml": enc(CONTENT_TYPES),
      "_rels/.rels": enc(RELS),
      "word/document.xml": enc(passthrough),
      "word/_rels/document.xml.rels": enc(EMPTY_DOC_RELS),
    },
    { level: 6 },
  );
}

function documentXmlWith(paragraphs) {
  const body = [];
  body.push('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>HELLO BRAINCODER</w:t></w:r></w:p>');
  for (const t of paragraphs) {
    body.push(`<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr/></w:body></w:document>`;
}

writeFileSync(
  `${DL}/short.docx`,
  buildDocx(documentXmlWith(["First body paragraph for the harness.", "Second paragraph with an extra sentence to check word wrap across the page width."])),
);
const longBody = Array.from({ length: 70 }, (_, i) => `Paragraph ${i + 1} — the quick brown fox jumps over the lazy dog beside the river bank.`).map((t, i) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`).join("");
writeFileSync(`${DL}/long.docx`, buildDocx(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>HELLO BRAINCODER</w:t></w:r></w:p>${longBody}<w:sectPr/></w:body></w:document>`));
writeFileSync(`${DL}/empty.docx`, buildDocx(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:sectPr/></w:body></w:document>`));
writeFileSync(`${DL}/old.doc`, Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("junk-compound-file")]));
writeFileSync(`${DL}/old-masked.docx`, Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("junk-compound-file")]));
writeFileSync(`${DL}/notadocx.txt`, "definitely not a zip archive");

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
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const alert = (t) => page.locator("[role='alert']", { hasText: t });
const status = (t) => page.locator("[role='status']", { hasText: t });
const fileInput = () => page.locator("input[type='file']");
const previewPanel = () => page.locator("div.md-preview");

async function pickAndConvert(path, timeout = 120000) {
  await fileInput().setInputFiles(path);
  await page.waitForSelector("div.md-preview", { timeout: 60000 });
  await page.locator("button", { hasText: "Convert to PDF" }).click();
  await status("PDF ready").waitFor({ state: "visible", timeout });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 120000 }),
    page.locator("button", { hasText: "Download PDF" }).click(),
  ]);
  return dl;
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose Word document" }).waitFor({ state: "visible", timeout: 15000 });

  check((await page.locator("[role='button'][aria-label^='Upload a .docx']").count()) === 1, "idle state shows a clickable drop zone");
  check((await fileInput().getAttribute("aria-label")) === "Choose a .docx Word document", "file input carries an accessible name");
  const acceptTokens = (await fileInput().getAttribute("accept")).split(",").map((t) => t.trim());
  check(acceptTokens.includes(".docx"), "accept restricts to .docx");
  check(!acceptTokens.includes(".doc"), "accept no longer claims legacy .doc");
  check((await page.locator("button", { hasText: "Convert to PDF" }).count()) === 0, "convert button is hidden until a file is parsed");

  await fileInput().setInputFiles(`${DL}/short.docx`);
  await page.waitForSelector("div.md-preview", { timeout: 60000 });
  check((await previewPanel().getByText("HELLO BRAINCODER").count()) === 1, "parsed content preview shows the document text");
  check((await page.locator("div", { hasText: "Parsed content — this is what gets rendered" }).count()) >= 1, "preview is labelled as the parsed content");
  check((await page.locator("button", { hasText: "Convert to PDF" }).count()) === 1, "convert button appears after parsing");
  check((await status("PDF ready").count()) === 0, "no success claim before converting");

  await page.locator("button", { hasText: "Convert to PDF" }).click();
  await status("PDF ready").waitFor({ state: "visible", timeout: 120000 });
  check((await status("PDF ready").count()) === 1, "conversion ends with a ready status");
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 120000 }),
    page.locator("button", { hasText: "Download PDF" }).click(),
  ]);
  check(dl.suggestedFilename() === "short.pdf", "download uses the document name with a .pdf extension");
  await dl.saveAs(`${DL}/short.pdf`);
  const pdf = readFileSync(`${DL}/short.pdf`);
  check(pdf[0] === 0x25 && pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46, "downloaded PDF starts with %PDF magic");
  check((await PDFDocument.load(pdf)).getPageCount() === 1, "short document renders to a single page");

  await page.goto(`${BASE_URL}/use/word-to-pdf`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose Word document" }).waitFor({ state: "visible", timeout: 15000 });
  const dlLong = await pickAndConvert(`${DL}/long.docx`);
  check(dlLong.suggestedFilename() === "long.pdf", "long document downloads with its own name");
  await dlLong.saveAs(`${DL}/long.pdf`);
  const longPdf = readFileSync(`${DL}/long.pdf`);
  check((await PDFDocument.load(longPdf)).getPageCount() >= 2, "long document renders to multiple pages");

  await page.goto(`${BASE_URL}/use/word-to-pdf`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose Word document" }).waitFor({ state: "visible", timeout: 15000 });
  await fileInput().setInputFiles(`${DL}/empty.docx`);
  await alert("No content found in this .docx file").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("No content found in this .docx file").count()) === 1, "empty document is rejected with a clear message");

  await fileInput().setInputFiles(`${DL}/old.doc`);
  await alert(/choose a \.docx file/).waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/choose a \.docx file/).count()) === 1, "legacy .doc extension is rejected with guidance");

  await fileInput().setInputFiles(`${DL}/old-masked.docx`);
  await alert("That's a legacy .doc file").waitFor({ state: "visible", timeout: 60000 });
  check((await alert("That's a legacy .doc file").count()) === 1, "compound-file content masked as .docx is detected");

  await fileInput().setInputFiles(`${DL}/notadocx.txt`);
  await alert(/choose a \.docx file/).waitFor({ state: "visible", timeout: 60000 });
  check((await alert(/choose a \.docx file/).count()) === 1, "non-docx files are rejected");

  await page.goto(`${BASE_URL}/use/word-to-pdf`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: "Choose Word document" }).waitFor({ state: "visible", timeout: 15000 });
  await page.evaluate(
    ([b64]) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "dropped.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const el = document.querySelector("[role='button'][aria-label^='Upload a .docx']");
      el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    [readFileSync(`${DL}/short.docx`).toString("base64")],
  );
  await page.waitForSelector("div.md-preview", { timeout: 60000 });
  check((await previewPanel().getByText("HELLO BRAINCODER").count()) === 1, "drag-and-drop parses the dropped document");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  await page.goto(`${BASE_URL}/tools/word-to-pdf`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").textContent()) ?? "";
  check(/visual snapshot/.test(body), "marketing copy scopes output as a visual snapshot");
  check(!/identical/i.test(body), "no fabricated 'identical to the original' claim");
  check(!/no file size limits/.test(body), "no fake unlimited-size claim");
  check(/25 MB/.test(body), "size limit is disclosed");
  check(/not selectable|isn.t selectable/.test(body), "selectable-text limitation is disclosed");
  check(/legacy \.doc/.test(body) || /\.doc files\?/.test(body), "legacy .doc limitation is documented");
} catch (e) {
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);