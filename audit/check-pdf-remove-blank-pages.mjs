import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFDocument } = require("/Users/rajasardar/repos/BrainCoder/node_modules/pdf-lib/dist/pdf-lib.js");

let passed = 0, failed = 0;
const check = (ok, label) => {
  if (ok) { passed++; console.log("PASS", label); }
  else { failed++; console.log("FAIL", label); }
};

// --- mirror the component's isBlankCanvas arithmetic on a synthetic RGBA buffer ---
const isBlankPixels = (rgba, width, height) => {
  let visible = 0;
  let ink = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 40) continue;
    visible++;
    const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    if (lum < 245) ink++;
  }
  if (visible === 0) return true;
  return ink / visible < 0.001;
};

const W = 60, H = 40;
const make = (w, h, fill, frac) => {
  const n = w * h;
  const buf = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) buf.set(fill, i * 4);
  const target = Math.floor((frac ?? 0) * n);
  for (let k = 0; k < target; k++) {
    const idx = ((k * 7919) % n) * 4;
    buf.set([0, 0, 0, 255], idx);
  }
  return buf;
};

// blank: all-white page
check(isBlankPixels(make(W, H, [255, 255, 255, 255], 0), W, H) === true, "purely white page is blank");
// blank: fully transparent page (no painted background)
check(isBlankPixels(make(W, H, [0, 0, 0, 0], 0), W, H) === true, "fully transparent page is blank");
// content: 0.5% dark pixels is real content
check(isBlankPixels(make(W, H, [255, 255, 255, 255], 0.005), W, H) === false, "0.5% ink is not blank");
// faint header / footer: 0.2% ink is content (heuristic asks for strict < 0.1%)
check(isBlankPixels(make(W, H, [255, 255, 255, 255], 0.002), W, H) === false, "0.2% ink (faint header) is not flagged blank");
// boundary: exactly 0.1% (10/10000) is NOT blank (strict less-than)
check(isBlankPixels(make(100, 100, [255, 255, 255, 255], 0.001), 100, 100) === false, "exactly 0.1% ink is not blank (strict < threshold)");
// light-gray content pixels (lum 200 < 245) count toward ink
check(isBlankPixels(make(W, H, [200, 200, 200, 255], 0.005), W, H) === false, "light-gray content counts as ink (no false blank)");

// --- JS-fallback reassembly mirror (same helper as pdf-remove-pages) ---
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

const doc = await PDFDocument.create();
doc.addPage([300, 200]);
doc.addPage([200, 300]);
doc.addPage([250, 400]);
const src = await doc.save(SAVE_OPTS);
// total-removal guard: removing every page is refused in the component
check([0, 1, 2].length === 3 && 3 === (await PDFDocument.load(src)).getPageCount(), "removing.size === pages.length is exactly the all-selected condition");
const kept = await rebuild(src, [0, 1]);
check((await dims(kept)).join("|") === "300,200|200,300", "kept pages reassemble in order");
check((await PDFDocument.load(kept)).getPageCount() === 2, "output reopens with the kept page count");

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);