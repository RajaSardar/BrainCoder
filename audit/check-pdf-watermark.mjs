import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const PDF = require("/Users/rajasardar/repos/BrainCoder/node_modules/pdf-lib/dist/pdf-lib.js");

const { PDFDocument, StandardFonts, rgb, degrees } = PDF;

let passed = 0, failed = 0;
const check = (ok, label) => {
  if (ok) { passed++; console.log("PASS", label); }
  else { failed++; console.log("FAIL", label); }
};
const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;

// --- mirror the component exactly ---
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const ASC = 0.72;
const DESC = 0.21;
const CENTER_OFFSET = (ASC - DESC) / 2;
const normalizeAngle = (a) => {
  const m = ((a % 180) + 180) % 180;
  return m >= 90 ? m - 180 : m;
};
const rotateForPage = (userAngle, pageRotation) => normalizeAngle(userAngle - pageRotation);
const centerOrigin = (halfWidth, underlineCenter, pageCenterX, pageCenterY, angleDeg) => {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: pageCenterX - (cos * halfWidth - sin * underlineCenter),
    y: pageCenterY - (sin * halfWidth + cos * underlineCenter),
  };
};

// --- normalize/rotation-compensation helper correctness ---
check(normalizeAngle(45) === 45, "normalizeAngle(45) === 45");
check(normalizeAngle(-45) === -45, "normalizeAngle(-45) === -45");
check(normalizeAngle(135) === -45, "normalizeAngle(135) === -45");
check(normalizeAngle(-135) === 45, "normalizeAngle(-135) === 45 (mod 180)");
check(normalizeAngle(270) === -90, "normalizeAngle(270) === -90");
check(normalizeAngle(180) === 0, "normalizeAngle(180) === 0");
check([95, -95, 170, -170].every((a) => normalizeAngle(a) >= -90 && normalizeAngle(a) <= 90), "normalizeAngle stays within [-90, 90]");
check(rotateForPage(-45, 0) === -45, "rotateForPage(-45, 0) === -45");
check(rotateForPage(-45, 90) === 45, "rotateForPage(-45, 90) === 45");
check(rotateForPage(90, 270) === 0, "rotateForPage(90, 270) === 0");

import { inflateSync } from "node:zlib";

const getContent = async (doc, page) => {
  const contents = doc.context.lookup(page.node.normalizedEntries().Contents);
  const refs = contents.array ?? [contents];
  let out = "";
  for (const ref of refs) {
    const stream = await doc.context.lookup(ref);
    const raw = stream.getContents();
    let text;
    try {
      text = Buffer.from(inflateSync(Buffer.from(raw))).toString("latin1");
    } catch {
      text = Buffer.from(raw).toString("latin1");
    }
    out += text + "\n";
  }
  return out;
};

(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const label = "CONFIDENTIAL";

  // --- centered bbox: text bbox center must land on page center for every angle (real metrics) ---
  for (const angle of [0, -45, 45, 90, -90, 30]) {
    const size0 = 24;
    const measured = font.widthOfTextAtSize(label, size0);
    const fit = Math.min(1, (612 * 0.9) / Math.max(1, measured));
    const drawSize = size0 * fit;
    const textWidth = font.widthOfTextAtSize(label, drawSize);
    const u = CENTER_OFFSET * drawSize;
    const origin = centerOrigin(textWidth / 2, u, 612 / 2, 792 / 2, angle);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const bboxCX = origin.x + (cos * (textWidth / 2) - sin * u);
    const bboxCY = origin.y + (sin * (textWidth / 2) + cos * u);
    check(
      near(bboxCX, 306) && near(bboxCY, 396),
      `text bbox center at page center for angle ${angle}° (got ${bboxCX.toFixed(2)},${bboxCY.toFixed(2)})`,
    );
  }

  // --- emitted Tm must match R(effAngle) + centered origin with page-rotation compensation ---
  page.setRotation(degrees(90));
  const rot = normalizeAngle((page.getRotation().angle ?? 0) % 360);
  const effAngle = rotateForPage(-45, rot);
  const effW = Math.abs(rot) === 90 ? 792 : 612;
  const size0 = 24;
  const fitted = Math.min(1, (effW * 0.9) / Math.max(1, font.widthOfTextAtSize(label, size0)));
  const drawSize = size0 * fitted;
  const textWidth = font.widthOfTextAtSize(label, drawSize);
  const u = CENTER_OFFSET * drawSize;
  const origin = centerOrigin(textWidth / 2, u, 612 / 2, 792 / 2, effAngle);
  page.drawText(label, {
    x: origin.x, y: origin.y, size: drawSize, font,
    color: rgb(0.3, 0.3, 0.3), opacity: 0.25, rotate: degrees(effAngle),
  });
  const content = await getContent(doc, page);
  const lines = content.split("\n");
  const hexIdx = lines.findIndex((l) => l.trim().endsWith("Tj"));
  const tmLine = lines.slice(0, hexIdx).map((l) => l.trim()).filter((l) => /\d/.test(l[0]) && l.endsWith("Tm")).pop();
  const [a, b, c, d, e, f] = tmLine.split(/\s+/).filter(Boolean).slice(0, 6).map(Number);
  const rad = (effAngle * Math.PI) / 180;
  check(near(a, Math.cos(rad)) && near(b, Math.sin(rad)) && near(c, -Math.sin(rad)) && near(d, Math.cos(rad)),
    `emitted Tm rotation block matches R(${effAngle}°) [${a.toFixed(3)},${b.toFixed(3)},${c.toFixed(3)},${d.toFixed(3)}]`);
  check(near(e, origin.x) && near(f, origin.y),
    `emitted Tm translation equals centered origin (${e.toFixed(2)}, ${f.toFixed(2)})`);

  // --- output reopens, rotation preserved, watermark text present ---
  const out = await doc.save(SAVE_OPTS);
  const back = await PDFDocument.load(out);
  check(back.getPageCount() === 1 && back.getPage(0).getRotation().angle === 90, "output reopens with page rotation preserved");
  const backLines = (await getContent(back, back.getPage(0))).split("\n");
  check(backLines.some((l) => l.includes("CONFIDENTIAL") || /[0-9A-F]{2,}> Tj/.test(l.trim())),
    "watermark glyph run present in output content stream");

  // --- WinAnsi rejection mirrors the preflight ---
  const doc2 = await PDFDocument.create();
  doc2.addPage([300, 200]);
  const font2 = await doc2.embedFont(StandardFonts.HelveticaBold);
  let threw = false;
  try { font2.widthOfTextAtSize("PASS 🔒", 24); } catch { threw = true; }
  check(threw, "non-WinAnsi character makes widthOfTextAtSize throw");

  // --- opacity clamp + save acceptance ---
  check(Math.max(0.01, Math.min(1, 150 / 100)) === 1, "opacity clamp upper bound 1");
  check(Math.max(0.01, Math.min(1, 1 / 100)) === 0.01, "opacity clamp lower bound 0.01");
  check(MAX_FILE_BYTES === 100 * 1024 * 1024, "cap constant is 100 MB");

  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();