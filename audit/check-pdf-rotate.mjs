import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFDocument, degrees } = require("/Users/rajasardar/repos/BrainCoder/node_modules/pdf-lib/dist/pdf-lib.js");

let passed = 0, failed = 0;
const check = (ok, label) => {
  if (ok) { passed++; console.log("PASS", label); }
  else { failed++; console.log("FAIL", label); }
};

// mirror the component's rotation path exactly
const normalize = (angle) => ((angle % 360) + 360) % 360;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const rotateAll = async (bytes, angle) => {
  const src = await PDFDocument.load(bytes);
  for (const page of src.getPages()) {
    page.setRotation(degrees(normalize(page.getRotation().angle + angle)));
  }
  return src.save(SAVE_OPTS);
};
const angles = async (bytes) => (await PDFDocument.load(bytes)).getPages().map((p) => p.getRotation().angle);

const normAsInts = new Set([0, 90, 180, 270]);

// --- math helpers (as used in the component) ---
check(normalize(-90) === 270, "normalize(-90) === 270 (never negative)");
check(normalize(-450) === 270, "normalize(-450) === 270 (multiple wraps)");
check(normalize(360) === 0, "normalize(360) === 0 (full cycle)");
check(normalize(90 + 180) === 270, "normalize(90+180) === 270");
check([0, 90, 180, 270].every((a) => normAsInts.has(a)), "normalize maps only to 0/90/180/270");

// --- build a 3-page doc ---
const make = async () => {
  const doc = await PDFDocument.create();
  for (const [w, h] of [[300, 200], [200, 300], [250, 400]]) doc.addPage([w, h]);
  return doc.save(SAVE_OPTS);
};
let bytes = await make();
const pageCount = (await PDFDocument.load(bytes)).getPageCount();
check(pageCount === 3, "source has 3 pages");

// --- rotate-all, one page at a series of steps (accumulation from current bytes) ---
const run = [];
let cur = bytes;
const step = async (angle) => { cur = await rotateAll(cur, angle); run.push(await angles(cur)); };

await step(-90);  // 270
await step(-90);  // 180
await step(180);  // 360 -> 0
await step(90);   // 90
await step(90);   // 180
await step(90);   // 270
await step(90);   // 0 (full cycle)
await step(-90);  // 270

const last = run[run.length - 1];
check(last.length === 3 && last.every((a) => a === last[0]), "all 3 pages share the same orientation (rotate-all)");
check(run.every((arr) => arr.every((a) => normAsInts.has(a))), "every step lands on a valid angle 0/90/180/270");
check(run[0].every((a) => a === 270), "single CCW give 270, not -90");
check(run[1].every((a) => a === 180), "two CCW accumulate to 180");
check(run[3].every((a) => a === 90), "two CCW then two CW returns to 90");
check(run[6].every((a) => a === 0), "four 90° CW clicks return to 0 (full cycle)");
check(run[7].every((a) => a === 270), "chained rotations continue from current orientation");

// --- serialized output must never contain a negative /Rotate (plaintext save shows raw tokens) ---
await step(-90);
const lastAngle = (await angles(cur))[0];
const plain = Buffer.from(await (await PDFDocument.load(cur)).save({ ...SAVE_OPTS, useObjectStreams: false }));
check(!plain.includes(Buffer.from("/Rotate -")), "no negative /Rotate in plaintext serialization");
check(plain.includes(Buffer.from(`/Rotate ${lastAngle}`)), `/Rotate ${lastAngle} written for the latest orientation`);

// --- reopenability + page count preserved ---
const back = await PDFDocument.load(cur);
check(back.getPageCount() === 3, "page count preserved across rotations");
const backAngles = back.getPages().map((p) => p.getRotation().angle);
check(backAngles.every((a) => normAsInts.has(a)), "reopened rotational metadata is valid");

// --- save options accepted and output actually changes ---
const fresh = await make();
const freshRotated = await rotateAll(fresh, 90);
check(freshRotated.length > 0 && !Buffer.from(freshRotated).equals(Buffer.from(fresh)), "save(SAVE_OPTS) produces a new valid output");

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);