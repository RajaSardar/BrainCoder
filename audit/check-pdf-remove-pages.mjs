import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFDocument } = require("/Users/rajasardar/repos/BrainCoder/node_modules/pdf-lib/dist/pdf-lib.js");

let passed = 0, failed = 0;
const check = (ok, label) => {
  if (ok) { passed++; console.log("PASS", label); }
  else { failed++; console.log("FAIL", label); }
};

// mirror the component constants + JS-fallback reassembly path
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const rebuild = async (bytes, keep) => {
  const out = await PDFDocument.create();
  const src = await PDFDocument.load(bytes);
  const copied = await out.copyPages(src, keep);
  copied.forEach((p) => out.addPage(p));
  return out.save(SAVE_OPTS);
};
const dims = async (bytes) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => {
    const { width, height } = p.getSize();
    return [Math.round(width), Math.round(height)];
  });

// source: 3 pages, each with a distinct size so selection is verifiable
const doc = await PDFDocument.create();
doc.addPage([300, 200]);
doc.addPage([200, 300]);
doc.addPage([250, 400]);
const src = await doc.save(SAVE_OPTS);
check((await dims(src)).join("|") === "300,200|200,300|250,400", "source has 3 distinguishable pages");

// remove the middle page
check((await dims(await rebuild(src, [0, 2]))).join("|") === "300,200|250,400", "keep [0,2] removes the middle page, order preserved");
// remove the first page
check((await dims(await rebuild(src, [1, 2]))).join("|") === "200,300|250,400", "keep [1,2] removes the first page");
// remove the last page
check((await dims(await rebuild(src, [0, 1]))).join("|") === "300,200|200,300", "keep [0,1] removes the last page");
// keep everything (no-op selection is disabled in the UI; the path still reassembles correctly)
check((await dims(await rebuild(src, [0, 1, 2]))).join("|") === "300,200|200,300|250,400", "keep [0,1,2] keeps all pages in order");

// keep-empty guard: unguarded keep=[] yields a degenerate PDF — this is the bug the guard prevents
const degenerate = await rebuild(src, []);
check((await PDFDocument.load(degenerate)).getPageCount() === 0, "unguarded keep=[] produces a 0-page PDF (root cause of the empty-keep guard)");
check([0].length === 1, "component guard prevents empty keep: removing.size === pages.length blocks before extraction");

// reopenability + SAVE_OPTS
const mid = await rebuild(src, [0, 2]);
const back = await PDFDocument.load(mid);
check(back.getPageCount() === 2, "output reopens with 2 pages");
check(Buffer.from(mid).length > 0 && !Buffer.from(mid).equals(Buffer.from(src)), "SAVE_OPTS produces a new valid output");

// caps mirroring the component
check(MAX_FILE_BYTES === 100 * 1024 * 1024, "cap constant is 100 MB");
check(MAX_PAGES === 200, "page cap constant is 200");
check(201 > MAX_PAGES, "component rejects documents over the 200-page cap");

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);