import { chromium } from "/Users/rajasardar/repos/BrainCoder/node_modules/playwright-core/index.mjs";
import { unzipSync } from "/Users/rajasardar/repos/BrainCoder/node_modules/fflate/esm/browser.js";
import { DOMParser } from "/Users/rajasardar/repos/BrainCoder/node_modules/@xmldom/xmldom/lib/dom-parser.js";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3777/use/";
const F = new URL("./fixtures", import.meta.url).pathname;
const O = new URL("./out", import.meta.url).pathname;
const dec = new TextDecoder();

let passed = 0;
let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.log("FAIL", name, "-", e?.message ?? e);
  }
}

function ooxmlText(buffer) {
  if (!buffer) return "";
  const doc = new DOMParser().parseFromString(dec.decode(buffer), "text/xml");
  const ts = doc.getElementsByTagName("t");
  let s = "";
  for (let i = 0; i < ts.length; i++) s += ts[i].textContent;
  const vs = doc.getElementsByTagName("v");
  for (let i = 0; i < vs.length; i++) s += " " + vs[i].textContent;
  return s;
}

async function save(download, name) {
  const file = await download.createReadStream();
  const target = path.join(O, name);
  const chunks = [];
  for await (const c of file) chunks.push(c);
  fs.writeFileSync(target, Buffer.concat(chunks));
  return target;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

// ---------- 1. word-creator ----------
await step("word-creator: build+download docx", async () => {
  await page.goto(BASE + "word-creator", { waitUntil: "domcontentloaded" });
  const ta = page.locator("textarea").first();
  const draft = `# My E2E Doc\n\n## Section A\n\nHello BrainCoder **bold five**.\n\n- bullet alpha\n- bullet beta`;
  await ta.click();
  await ta.press("ControlOrMeta+A");
  await ta.pressSequentially(draft);
  await page.waitForTimeout(200);
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Generate .docx" }).click(),
  ]);
  const f = await save(dl, "1-word-creator.docx");
  const xml = dec.decode(unzipSync(fs.readFileSync(f))["word/document.xml"]);
  const ts = new DOMParser().parseFromString(xml, "text/xml").getElementsByTagName("w:t");
  let joined = "";
  for (let i = 0; i < ts.length; i++) joined += ts[i].textContent;
  if (!joined.includes("My E2E Doc")) throw new Error("title missing");
  if (!joined.includes("bold five")) throw new Error("bold text missing");
  if (!joined.includes("bullet alpha")) throw new Error("bullet missing");
});

// ---------- 2. word-to-text ----------
await step("word-to-text: extract text + download", async () => {
  await page.goto(BASE + "word-to-text", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#w2t-file", `${F}/sample.docx`);
  await page.getByRole("button", { name: "Download .txt" }).first().waitFor({ state: "visible", timeout: 20000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Download .txt" }).click(),
  ]);
  const f = await save(dl, "2-word-to-text.txt");
  const txt = fs.readFileSync(f, "utf8");
  if (!txt.includes("Hello BrainCoder")) throw new Error("text missing: " + txt.slice(0, 80));
  if (!txt.includes("bold five")) throw new Error("bold not stripped");
});

// ---------- 3. word-to-markdown ----------
await step("word-to-markdown: extract + download", async () => {
  await page.goto(BASE + "word-to-markdown", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#w2md-file", `${F}/sample.docx`);
  await page.getByRole("button", { name: "Download .md" }).waitFor({ state: "visible", timeout: 25000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Download .md" }).click(),
  ]);
  const f = await save(dl, "3-word-to-markdown.md");
  const txt = fs.readFileSync(f, "utf8");
  if (!txt.includes("E2E Title One")) throw new Error("heading not preserved");
  if (!txt.includes("bullet alpha")) throw new Error("bullet not preserved");
});

// ---------- 4. word-viewer ----------
await step("word-viewer: renders docx content", async () => {
  await page.goto(BASE + "word-viewer", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#wv-file", `${F}/sample.docx`);
  await page.getByText("Hello BrainCoder").first().waitFor({ state: "visible", timeout: 25000 });
});

// ---------- 5. csv-to-excel ----------
await step("csv-to-excel: convert + download xlsx", async () => {
  await page.goto(BASE + "csv-to-excel", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#c2x-file", `${F}/sample.csv`);
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Convert to .xlsx" }).click(),
  ]);
  const f = await save(dl, "5-csv-to-excel.xlsx");
  const files = unzipSync(fs.readFileSync(f));
  const sheet = Object.keys(files).find((k) => /worksheets\/sheet1\.xml/.test(k));
  if (!sheet) throw new Error("no sheet1");
  const txt = ooxmlText(files[sheet]);
  if (!txt.includes("Ada")) throw new Error("Ada missing: " + txt.slice(0, 100));
  if (!txt.includes("98")) throw new Error("score missing");
});

// ---------- 6. excel-viewer ----------
await step("excel-viewer: renders grid with sheet data", async () => {
  await page.goto(BASE + "excel-viewer", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#ev-file", `${F}/sample.xlsx`);
  await page.getByText("Ada", { exact: false }).first().waitFor({ state: "visible", timeout: 25000 });
  await page.getByText("Berlin", { exact: false }).first().waitFor({ state: "visible", timeout: 10000 });
});

// ---------- 7. excel-to-json ----------
await step("excel-to-json: typed grid -> json download", async () => {
  await page.goto(BASE + "excel-to-json", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#e2j-file", `${F}/sample.xlsx`);
  await page.getByRole("button", { name: "Download .json" }).waitFor({ state: "visible", timeout: 25000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Download .json" }).click(),
  ]);
  const f = await save(dl, "7-excel-to-json.json");
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  const str = JSON.stringify(data);
  if (!str.includes("Ada")) throw new Error("row missing");
  if (!str.includes("42")) throw new Error("numeric 42 missing (typed?)");
});

// ---------- 8. excel-to-csv ----------
await step("excel-to-csv: download sheets csv", async () => {
  await page.goto(BASE + "excel-to-csv", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#e2c-file", `${F}/sample.xlsx`);
  await page.getByRole("button", { name: "Download all sheets (.csv)" }).waitFor({ state: "visible", timeout: 25000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Download all sheets (.csv)" }).click(),
  ]);
  const f = await save(dl, "8-excel-to-csv" + path.extname(dl.suggestedFilename() || ".csv"));
  const buf = fs.readFileSync(f);
  let txt;
  if (/\.zip$/i.test(f)) {
    const files = unzipSync(buf);
    txt = Object.values(files).map((b) => dec.decode(b)).join("\n");
  } else {
    txt = dec.decode(buf);
  }
  if (!txt.includes("Ada, Lovelace")) throw new Error("CSV quoted name missing: " + txt.slice(0, 120));
  if (!txt.includes("Berlin")) throw new Error("Berlin missing");
});

// ---------- 9. excel-merge ----------
await step("excel-merge: merge two workbooks", async () => {
  await page.goto(BASE + "excel-merge", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#xm-file", [`${F}/sample.xlsx`, `${F}/sample2.xlsx`]);
  await page.getByRole("button", { name: "Merge into one .xlsx" }).waitFor({ state: "visible", timeout: 20000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Merge into one .xlsx" }).click(),
  ]);
  const f = await save(dl, "9-excel-merge.xlsx");
  const files = unzipSync(fs.readFileSync(f));
  const sheets = Object.keys(files).filter((k) => /worksheets\/sheet\d+\.xml/.test(k));
  if (sheets.length < 3) throw new Error("expected >=3 sheets, got " + sheets.length);
  const all = sheets.map((s) => ooxmlText(files[s])).join("|");
  if (!all.includes("Ada") || !all.includes("banana")) throw new Error("merged data missing");
});

// ---------- 10. excel-to-pdf ----------
await step("excel-to-pdf: sheet -> valid pdf", async () => {
  await page.goto(BASE + "excel-to-pdf", { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#e2p-file", `${F}/sample.xlsx`);
  await page.getByRole("button", { name: /Convert "People" to PDF/ }).waitFor({ state: "visible", timeout: 25000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: /Convert "People" to PDF/ }).click(),
  ]);
  const f = await save(dl, "10-excel-to-pdf.pdf");
  const buf = fs.readFileSync(f);
  const head = buf.subarray(0, 5).toString("latin1");
  if (head !== "%PDF-") throw new Error("not a PDF: " + head);
  if (buf.length < 400) throw new Error("suspiciously small pdf: " + buf.length);
});

// ---------- 11. pptx-creator ----------
await step("pptx-creator: build slides + download", async () => {
  await page.goto(BASE + "pptx-creator", { waitUntil: "domcontentloaded" });
  const title = page.getByPlaceholder("Slide title");
  const body = page.getByPlaceholder("One bullet per line\nSecond point");
  await title.first().fill("First Deck Slide");
  await body.first().fill("**Key point**\nSecondary line");
  await page.getByRole("button", { name: "Add slide" }).click();
  await title.first().waitFor(); // re-resolve after state change
  await title.nth(1).fill("Slide Number Two");
  await body.nth(1).fill("second slide bullet");
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "Generate .pptx" }).click(),
  ]);
  const f = await save(dl, "11-pptx-creator" + path.extname(dl.suggestedFilename() || ".pptx"));
  const files = unzipSync(fs.readFileSync(f));
  const slides = Object.keys(files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort();
  if (slides.length < 2) throw new Error("expected 2 slides, got " + slides.length);
  const s1 = dec.decode(files[slides[0]]);
  const s2 = dec.decode(files[slides[1]]);
  if (!s1.includes("First Deck Slide") || !s1.includes("Key point")) throw new Error("slide1 content missing");
  if (!s2.includes("Slide Number Two")) throw new Error("slide2 title missing");
});

await browser.close();
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);