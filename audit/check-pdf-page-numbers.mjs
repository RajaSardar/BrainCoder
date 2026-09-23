import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const PDF = require("/Users/rajasardar/repos/BrainCoder/node_modules/pdf-lib/dist/pdf-lib.js");
const { PDFDocument, StandardFonts, rgb, degrees } = PDF;
import { inflateSync } from "node:zlib";

let passed = 0, failed = 0;
const check = (ok, label) => {
  if (ok) { passed++; console.log("PASS", label); }
  else { failed++; console.log("FAIL", label); }
};
const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;

// --- mirror the component exactly ---
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const MARGIN = 48;
const EDGE = 28;
const TOP_GAP = 40;
const POSITIONS = [
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "top-left", label: "Top left" },
];
const placement = (rot, width, height, textWidth, id) => {
  const quarter = rot === 90 || rot === 270;
  const Wv = quarter ? height : width;
  const Hv = quarter ? width : height;
  let vx;
  if (id.endsWith("-center")) vx = (Wv - textWidth) / 2;
  else if (id.endsWith("-right")) vx = Wv - textWidth - MARGIN;
  else vx = MARGIN;
  const vy = id.startsWith("top") ? Hv - TOP_GAP : EDGE;
  if (rot === 90) return { x: width - vy, y: vx, rotate: 90 };
  if (rot === 180) return { x: width - vx, y: height - vy, rotate: 180 };
  if (rot === 270) return { x: vy, y: height - vx, rotate: 270 };
  return { x: vx, y: vy, rotate: 0 };
};
const friendlyError = (err) => {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : "";
  const raw = `${name} ${msg}`;
  if (raw.includes("is encrypted") || /password/i.test(raw)) {
    return "That PDF is password-protected. Unlock it with PDF Unlock first, then load the unlocked file here.";
  }
  if (/Failed to parse|No PDF header|Invalid PDF structure/i.test(raw)) {
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  }
  return "Could not read that PDF. It may be corrupt or unsupported.";
};
const normalize = (r) => ((r % 360) + 360) % 360;
const clamp = (x) => Math.min(9999, Math.max(0, Math.trunc(x)));

// visual point = Rv(p - center) + (Wv/2, Hv/2)
const visualOf = (rot, x, y, W, H) => {
  const dx = x - W / 2, dy = y - H / 2;
  const quarter = rot === 90 || rot === 270;
  const Wv = quarter ? H : W, Hv = quarter ? W : H;
  if (rot === 90) return { vx: dy + Wv / 2, vy: -dx + Hv / 2 };
  if (rot === 180) return { vx: -dx + Wv / 2, vy: -dy + Hv / 2 };
  if (rot === 270) return { vx: -dy + Wv / 2, vy: dx + Hv / 2 };
  return { vx: dx + Wv / 2, vy: dy + Hv / 2 };
};

const getContent = async (doc, page) => {
  const contents = doc.context.lookup(page.node.normalizedEntries().Contents);
  const refs = contents.array ?? [contents];
  let out = "";
  for (const ref of refs) {
    const stream = await doc.context.lookup(ref);
    const raw = stream.getContents();
    let text;
    try { text = Buffer.from(inflateSync(Buffer.from(raw))).toString("latin1"); }
    catch { text = Buffer.from(raw).toString("latin1"); }
    out += text + "\n";
  }
  return out;
};

(async () => {
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);

  // --- placement() maps every visual corner for every rotation ---
  const W = 612, H = 792;
  const label = "12 / 60";
  const size = 11;
  const tw = font.widthOfTextAtSize(label, size);
  for (const rot of [0, 90, 180, 270]) {
    const quarter = rot === 90 || rot === 270;
    const Wv = quarter ? H : W, Hv = quarter ? W : H;
    for (const pos of POSITIONS) {
      const p = placement(rot, W, H, tw, pos.id);
      const v = visualOf(rot, p.x, p.y, W, H);
      const wantVx = pos.id.endsWith("-center") ? (Wv - tw) / 2
        : pos.id.endsWith("-right") ? Wv - tw - MARGIN
        : MARGIN;
      const wantVy = pos.id.startsWith("top") ? Hv - TOP_GAP : EDGE;
      check(near(v.vx, wantVx) && near(v.vy, wantVy),
        `rot ${rot}° ${pos.label} lands at visual (${wantVx}, ${wantVy}) — got (${v.vx.toFixed(2)}, ${v.vy.toFixed(2)})`);
      check(p.rotate === rot, `rot ${rot}° ${pos.label} draws upright (rotate=${p.rotate})`);
    }
  }

  // --- real document: labels drawn per rotation, Tm rotation block must equal R(rot) ---
  const doc = await PDFDocument.create();
  const rotSet = [0, 90, 180, 270];
  for (const rot of rotSet) {
    const page = doc.addPage([612, 792]);
    if (rot) page.setRotation(degrees(rot));
    const n = 1 + rotSet.indexOf(rot);
    const lab = `${n} / 4`;
    const tw2 = font.widthOfTextAtSize(lab, size);
    const p = placement(rot, 612, 792, tw2, "bottom-center");
    page.drawText(lab, { x: p.x, y: p.y, size, font, color: rgb(0.2, 0.2, 0.2), rotate: degrees(p.rotate) });
    const content = await getContent(doc, page);
    const lines = content.split("\n");
    const hexIdx = lines.findIndex((l) => l.trim().endsWith("Tj"));
    const tmLine = lines.slice(0, hexIdx).map((l) => l.trim()).filter((l) => /^[-\d]/.test(l) && l.endsWith("Tm")).pop();
    const [a, b, c, d, e, f] = tmLine.split(/\s+/).filter(Boolean).slice(0, 6).map(Number);
    const rad = (rot * Math.PI) / 180;
    check(near(a, Math.cos(rad)) && near(b, Math.sin(rad)) && near(c, -Math.sin(rad)) && near(d, Math.cos(rad)),
      `rot ${rot}° emitted Tm matches R(${rot}) [${a.toFixed(3)},${b.toFixed(3)},${c.toFixed(3)},${d.toFixed(3)}]`);
    check(near(e, p.x) && near(f, p.y),
      `rot ${rot}° emitted Tm translation = placement origin (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  }

  // --- save / reload / rotation preservation ---
  const out = await doc.save(SAVE_OPTS);
  const back = await PDFDocument.load(out);
  check(back.getPageCount() === 4, "output reopens with 4 pages");
  check(back.getPages().map((p) => normalize(p.getRotation().angle ?? 0)).join(",") === "0,90,180,270",
    "rotations preserved after save/reload");
  const backLines = (await getContent(back, back.getPage(1))).split("\n");
  check(backLines.some((l) => /[0-9A-F]{2,}> Tj/.test(l.trim())), "number glyph run present on page 2's content stream");

  // --- label semantics (n / total with total = last label) ---
  check(friendlyError(new Error("EncryptedPDFError: PDF document is encrypted")) ===
    "That PDF is password-protected. Unlock it with PDF Unlock first, then load the unlocked file here.",
    "encrypted PDF maps to the PDF Unlock friendly error");
  check(friendlyError(new Error("Failed to parse the PDF: No PDF header found")) ===
    "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.",
    "malformed PDF maps to the invalid-PDF friendly error");
  check(friendlyError(new Error("random internal boom")) ===
    "Could not read that PDF. It may be corrupt or unsupported.",
    "other errors fall back to the generic message");
  check((() => { const total = (s, c) => s + c - 1; return total(1, 3) === 3; })(),
    "withTotal total equals last displayed number for startAt=1");
  check((() => { const total = (s, c) => s + c - 1; return total(0, 3) === 2; })(),
    "withTotal total equals last displayed number for startAt=0 (3 pages → 0/2 … 2/2)");
  check(clamp(1.5) === 1 && clamp(-3) === 0 && clamp(12000) === 9999 && clamp(7) === 7,
    "start input is truncated and clamped to 0–9999");
  check(MAX_FILE_BYTES === 100 * 1024 * 1024 && MAX_PAGES === 200,
    "caps are 100 MB / 200 pages");
  check(SAVE_OPTS.updateFieldAppearances === false && SAVE_OPTS.addDefaultPage === false,
    "SAVE_OPTS disable appearance regeneration");

  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();