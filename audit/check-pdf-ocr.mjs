// Node check: PDF OCR — self-hosted assets, no CDN egress, honest limits
// Run: node audit/check-pdf-ocr.mjs
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const pdfOcrSrc = readFileSync(
  join(ROOT, "src/features/pdf-ocr/PdfOcr.tsx"),
  "utf8",
);
const imageOcrSrc = readFileSync(
  join(ROOT, "src/features/image-ocr/ImageOcr.tsx"),
  "utf8",
);

let pass = 0;
let fail = 0;
function ok(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

// ---- 1. Self-hosted asset presence + health ----
const ocrDir = join(ROOT, "public/ocr");
ok("ocr: public/ocr exists", existsSync(ocrDir));

const worker = join(ocrDir, "worker.min.js");
ok("ocr: worker.min.js present", existsSync(worker), worker);
ok("ocr: worker.min.js is JS", existsSync(worker) && readFileSync(worker).length > 100000);

const LANGS = [
  "eng", "spa", "fra", "deu", "ita", "por",
  "rus", "hin", "ara", "chi_sim", "jpn", "kor",
];
const trainedDir = join(ocrDir, "traineddata");
for (const id of LANGS) {
  const f = join(trainedDir, `${id}.traineddata.gz`);
  ok(`ocr: traineddata ${id}.traineddata.gz present`, existsSync(f));
  ok(`ocr: ${id} is a real gzip (1f 8b)`, existsSync(f) && readFileSync(f)[0] === 0x1f && readFileSync(f)[1] === 0x8b);
}
const shipped = readdirSync(trainedDir).filter((f) => f.endsWith(".traineddata.gz"));
ok(
  "ocr: shipped traineddata set exactly matches LANGS",
  shipped.length === LANGS.length &&
    LANGS.every((id) => shipped.includes(`${id}.traineddata.gz`)),
  shipped.join(","),
);

const cores = [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
];
for (const c of cores) {
  ok(`ocr: core ${c} present`, existsSync(join(ocrDir, c)));
}
// getCore.js also requests the listed core as `<corePath>/tesseract-core-{simd,relaxedsimd,lstm}-lstm.wasm.js` (lstmOnly=true)
const getCore = readFileSync(join(ROOT, "node_modules/tesseract.js/src/worker-script/browser/getCore.js"), "utf8");
ok(
  "ocr: getCore asks exactly for the cores we ship",
  getCore.includes("tesseract-core-relaxedsimd-lstm.wasm.js") &&
    getCore.includes("tesseract-core-simd-lstm.wasm.js") &&
    getCore.includes("tesseract-core-lstm.wasm.js"),
);

// ---- 2. No CDN egress anywhere in the OCR feature ----
const components = [
  "src/features/pdf-ocr/PdfOcr.tsx",
  "src/features/image-ocr/ImageOcr.tsx",
];
for (const rel of components) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  ok(`no-cdn: ${rel} has no jsdelivr/unpkg`, !/jsdelivr|unpkg\.com|unpkg/i.test(src));
}
ok(
  "self-host: PdfOcr defines /ocr/ asset constants",
  pdfOcrSrc.includes('const OCR_WORKER_PATH = "/ocr/worker.min.js";') &&
    pdfOcrSrc.includes('const OCR_CORE_PATH = "/ocr/";') &&
    pdfOcrSrc.includes('const OCR_LANG_PATH = "/ocr/traineddata/";'),
);
ok(
  "self-host: PdfOcr passes the constants to createWorker",
  pdfOcrSrc.includes("workerPath: OCR_WORKER_PATH") &&
    pdfOcrSrc.includes("corePath: OCR_CORE_PATH") &&
    pdfOcrSrc.includes("langPath: OCR_LANG_PATH"),
);
ok(
  "self-host: ImageOcr uses /ocr/ asset paths",
  /workerPath: "\/ocr\/worker\.min\.js"/.test(imageOcrSrc) &&
    /corePath: "\/ocr\/"/.test(imageOcrSrc) &&
    /langPath: "\/ocr\/traineddata\/"/.test(imageOcrSrc),
);

// ---- 3. Honest limits + messages (PdfOcr.tsx land) ----
ok("ocr: 100 MB cap", pdfOcrSrc.includes("files up to 100 MB are supported"));
ok("ocr: 200 page cap", pdfOcrSrc.includes("files up to 200 pages are supported"));
ok("ocr: render scale is 2", /getViewport\(\{ scale: 2 \}\)/.test(pdfOcrSrc));
ok("ocr: text-layer precheck threshold", pdfOcrSrc.includes("count > 80"));
ok(
  "ocr: model-download disclosure present",
  pdfOcrSrc.includes("downloads its model (~1.5–3 MB)"),
);
ok(
  "ocr: no searchable-text-layer claim",
  !/searchable text layer/i.test(pdfOcrSrc),
);
ok("ocr: output is .txt", pdfOcrSrc.includes("-ocr.txt"));
ok("ocr: page markers", pdfOcrSrc.includes("--- Page ${p} ---"));
ok("ocr: empty-page marker", pdfOcrSrc.includes("(no text detected)"));
ok(
  "ocr: worker terminated on error path too",
  pdfOcrSrc.includes("if (worker) await worker.terminate().catch"),
);
ok("ocr: language options match LANGS", (pdfOcrSrc.match(/LANGS\.map/g) || []).length >= 1);

// ---- 4. friendlyError mapping mirror ----
function friendlyError(err) {
  const m = err instanceof Error ? err.message : String(err);
  if (/password|encrypted/i.test(m))
    return "This PDF is password-protected. Remove the password with PDF Unlock, then run OCR again.";
  if (/Invalid PDF|Failed to parse|No PDF header|encryption/i.test(m))
    return "This file doesn't look like a valid PDF.";
  if (/language|traineddata|Failed to load/i.test(m))
    return "The language model failed to load — check your connection and try again.";
  return "OCR didn't finish — try again, or pick a cleaner scan.";
}
ok("err: password -> unlock steer", friendlyError(new Error("Enter a password to open this encrypted PDF")) === "This PDF is password-protected. Remove the password with PDF Unlock, then run OCR again.");
ok("err: invalid -> valid-PDF info", friendlyError(new Error("Invalid PDF structure")) === "This file doesn't look like a valid PDF.");
ok("err: language -> model fail", friendlyError(new Error("Failed to load language 'eng' from traineddata")) === "The language model failed to load — check your connection and try again.");
ok("err: generic -> retry", friendlyError(new Error("boom")) === "OCR didn't finish — try again, or pick a cleaner scan.");

console.log(`\npassed ${pass}, failed ${fail}`);
process.exit(fail ? 1 : 0);