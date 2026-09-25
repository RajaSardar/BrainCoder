import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-ocr`;
const DL = "/tmp/pdfocr";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// 1-page fixture whose text uses an EMBEDDED TrueType font so pdf.js can
// rasterize it without any external standard-font fetch.
{
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    new Uint8Array(
      readFileSync("node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"),
    ),
  );
  const p1 = doc.addPage([612, 792]);
  p1.drawText("Hello OCR", { x: 40, y: 700, size: 48, font });
  writeFileSync(`${DL}/scan.pdf`, await doc.save());
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

// Track every request. The OCR tool must only ever hit same-origin assets,
// and must actually fetch the self-hosted /ocr/ engine + model.
const allRequests = [];
context.on("request", (req) => allRequests.push(req.url()));

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

function externalUrls() {
  const baseHost = new URL(BASE_URL).host;
  return allRequests.filter((u) => {
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false; // blob:/data: are same-origin by construction
      return parsed.host !== baseHost;
    } catch {
      return true;
    }
  });
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /Open PDF/ }).waitFor({ state: "visible", timeout: 15000 });

  check(
    (await fileInput().getAttribute("aria-label")) === "Choose a PDF to run OCR on",
    "file input carries an accessible name",
  );
  check(
    (await page.locator("label", { hasText: /^Language/ }).count()) === 1,
    "language selector exists",
  );
  check(
    (await page.locator("option").allTextContents()).length === 12,
    "12 languages listed (matches self-hosted models)",
  );
  check(
    (await page.locator("p", { hasText: /model \(~1\.5–3 MB\)/ }).count()) === 1,
    "model-download disclosure is shown up front",
  );

  // --- real OCR run: engine loads from /ocr/, output lands ---
  const preRunExternal = externalUrls().length;
  await fileInput().setInputFiles(`${DL}/scan.pdf`);
  await page.getByText(/characters recognized from scan\.pdf/).waitFor({ timeout: 180000 });
  check(
    externalUrls().length === 0,
    `OCR made no external requests (${externalUrls().slice(0, 4).join(", ") || "none"})`,
  );
  const ocrFetches = allRequests.filter((u) => new URL(u).pathname.startsWith("/ocr/"));
  check(
    ocrFetches.length >= 2,
    `self-hosted /ocr/ assets were fetched (${ocrFetches.length} requests)`,
  );
  check(
    ocrFetches.some((u) => /worker\.min\.js/.test(u)),
    "OCR worker script loaded from /ocr/",
  );
  check(
    ocrFetches.some((u) => /traineddata\/eng\.traineddata\.gz/.test(u)),
    "English model loaded from /ocr/traineddata/",
  );
  const resultText = (await page.locator('[role="region"][aria-label="OCR result"] pre').first().textContent()) || "";
  check(
    resultText.includes("--- Page 1 ---"),
    "result carries the --- Page 1 --- marker",
  );
  check(
    /Hello OCR/i.test(resultText),
    `OCR actually read the rendered text (got: "${resultText.trim().slice(0, 120)}")`,
  );
  check(
    (await page.locator('[role="region"][aria-label="OCR result"]').count()) === 1,
    "result is exposed as a labelled region",
  );
  const busySpinner = page.locator("[role='status']", { hasText: /Rendering page 1 of 1|Recognizing page 1 of 1/ }).first();
  check((await busySpinner.count()) === 0, "progress status cleared after the run");

  // --- .txt download contains the OCR result + markers ---
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.locator("button", { hasText: /Download \.txt/ }).click(),
  ]);
  await dl.saveAs(`${DL}/result.txt`);
  check(dl.suggestedFilename() === "scan-ocr.txt", "download named <source>-ocr.txt");
  const txt = readFileSync(`${DL}/result.txt`, "utf8");
  check(
    txt.includes("--- Page 1 ---") && /Hello/i.test(txt),
    "downloaded .txt contains the OCR content",
  );

  // --- encrypted: honest steer to PDF Unlock ---
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert(/password-protected/).waitFor({ timeout: 60000 });
  check(
    (await page.locator("a", { hasText: /Open PDF Unlock/ }).getAttribute("href")) === "/use/pdf-unlock",
    "encrypted file links to PDF Unlock",
  );

  // --- error paths ---
  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert(/doesn't look like a valid PDF/).waitFor({ timeout: 60000 });
  check((await alert(/doesn't look like a valid PDF/).count()) === 1, "non-PDF upload shows an invalid-file message");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 60000 });
  check((await alert(/up to 100 MB/).count()) === 1, "oversized file is rejected");

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---
  const html = await (await page.request.get(`${BASE_URL}/tools/pdf-ocr`)).text();
  const body = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/’/g, "'")
    .replace(/“|”/g, '"');
  const lower = html.toLowerCase();
  check(html.length > 100, "tool marketing page renders");
  check(body.includes("on-device") || body.includes("on your device"), "copy says OCR runs on-device");
  check(
    !/searchable text layer|ocr-processed pdf|adds? a text layer/i.test(body) &&
      /\.txt|text file/i.test(body),
    "copy doesn't promise a searchable-text-layer PDF (output is .txt)",
  );
  check(!/drag and drop/i.test(lower), "no drag-and-drop promise");
  check(!/95-99%|99% accurate/i.test(lower), "no accuracy-number hype");

  const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(titleTag.includes("OCR") && !/convert/i.test(titleTag), `tool page title is honest: "${titleTag}"`);

  const guide = await page.request.get(`${BASE_URL}/guides/how-to-ocr-a-pdf`);
  check(guide.status() === 200, "how-to-ocr-a-pdf guide renders");

  const sitemap = (await page.request.get(`${BASE_URL}/sitemap.xml`)).ok()
    ? await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text()
    : "";
  check(sitemap.includes("/tools/pdf-ocr"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-ocr-a-pdf"), "sitemap lists the how-to-ocr-a-pdf guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 500)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);