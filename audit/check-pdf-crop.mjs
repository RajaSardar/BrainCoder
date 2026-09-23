import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { readFileSync } from "node:fs";

const M = 48;
let pass = 0;
let fail = 0;

function ok(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

// Media -> displayed-CSS-CSS mapping, probe-verified against pdf.js
// viewport.convertToViewportPoint (the exact renderer the preview uses).
function toDisplay(rot, { x: x0, y: y0, width: mw, height: mh }, px, py) {
  const X = px - x0;
  const Y = py - y0;
  if (rot === 90) return [Y, X];
  if (rot === 180) return [mw - X, Y];
  if (rot === 270) return [mh - Y, mw - X];
  return [X, mh - Y];
}

// Mirror of the component's cropBoxFor
function cropBoxFor(rot, media, { top, right, bottom, left }) {
  const { x: x0, y: y0, width: W, height: H } = media;
  const quarter = rot === 90 || rot === 270;
  const Wv = quarter ? H : W;
  const Hv = quarter ? W : H;
  const dl = (Wv * left) / 100;
  const dr = (Wv * right) / 100;
  const dt = (Hv * top) / 100;
  const db = (Hv * bottom) / 100;
  let X0, Y0, X1, Y1;
  if (rot === 90) {
    X0 = x0 + dt; Y0 = y0 + dl; X1 = x0 + W - db; Y1 = y0 + H - dr;
  } else if (rot === 180) {
    X0 = x0 + dr; Y0 = y0 + dt; X1 = x0 + W - dl; Y1 = y0 + H - db;
  } else if (rot === 270) {
    X0 = x0 + db; Y0 = y0 + dr; X1 = x0 + W - dt; Y1 = y0 + H - dl;
  } else {
    X0 = x0 + dl; Y0 = y0 + db; X1 = x0 + W - dr; Y1 = y0 + H - dt;
  }
  return { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 };
}

function checkRotation(page, insets, label) {
  const rot = (((page.getRotation().angle ?? 0) % 360) + 360) % 360;
  const media = page.getMediaBox();
  const quarter = rot === 90 || rot === 270;
  const Wd = quarter ? media.height : media.width;
  const Hd = quarter ? media.width : media.height;
  const box = cropBoxFor(rot, media, insets);
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ].map(([px, py]) => toDisplay(rot, media, px, py));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const L = Math.min(...xs);
  const R = Math.max(...xs);
  const T = Math.min(...ys);
  const B = Math.max(...ys);
  const tol = 1e-6;
  ok(`${label} L`, Math.abs(L - (Wd * insets.left) / 100) < tol, `expect ${(Wd * insets.left) / 100} got ${L}`);
  ok(`${label} R`, Math.abs(R - (Wd * (100 - insets.right)) / 100) < tol, `expect ${(Wd * (100 - insets.right)) / 100} got ${R}`);
  ok(`${label} T`, Math.abs(T - (Hd * insets.top) / 100) < tol, `expect ${(Hd * insets.top) / 100} got ${T}`);
  ok(`${label} B`, Math.abs(B - (Hd * (100 - insets.bottom)) / 100) < tol, `expect ${(Hd * (100 - insets.bottom)) / 100} got ${B}`);
  return box;
}

async function buildFixture({ origin = [0, 0] } = {}, rotations) {
  const [ox, oy] = origin;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const rot of rotations) {
    const page = pdf.addPage([ox + 612, oy + 792]);
    page.setMediaBox(ox, oy, 612, 792);
    page.setRotation(degrees(rot));
    page.drawText("ABCDEF", { x: ox + 20, y: oy + 20, size: M, font });
  }
  return pdf;
}

const insets = { top: 12, right: 8, bottom: 15, left: 20 };

// 1) Every rotation: kept rect in displayed space == the percentage overlay
for (const rot of [0, 90, 180, 270]) {
  const pdf = await buildFixture({}, [rot]);
  const page = pdf.getPage(0);
  const box = cropBoxFor(rot, page.getMediaBox(), insets);
  page.setCropBox(box.x, box.y, box.width, box.height);
  if (page.getTrimBox()) page.setTrimBox(box.x, box.y, box.width, box.height);
  if (page.getBleedBox()) page.setBleedBox(box.x, box.y, box.width, box.height);
  if (page.getArtBox()) page.setArtBox(box.x, box.y, box.width, box.height);
  const out = await pdf.save({ updateFieldAppearances: false, addDefaultPage: false });
  const back = await PDFDocument.load(out);
  const p = back.getPage(0);
  checkRotation(p, insets, `rot${rot} media[0 0 612 792]`);
  const cb = p.getCropBox();
  const tr = p.getTrimBox();
  const bl = p.getBleedBox();
  const ab = p.getArtBox();
  ok(`rot${rot} cropbox persisted`, Math.abs(cb.x - box.x) < 1e-9 && Math.abs(cb.width - box.width) < 1e-9 && Math.abs(cb.height - box.height) < 1e-9);
  ok(`rot${rot} mediabox untouched`, p.getMediaBox().x === 0 && p.getMediaBox().width === 612 && p.getMediaBox().height === 792);
  ok(`rot${rot} trimbox mirrors crop`, tr && Math.abs(tr.width - box.width) < 1e-9 && Math.abs(tr.y - box.y) < 1e-9);
  ok(`rot${rot} bleedbox mirrors crop`, bl && Math.abs(bl.width - box.width) < 1e-9);
  ok(`rot${rot} artbox mirrors crop`, ab && Math.abs(ab.width - box.width) < 1e-9);
}

// 2) Offset MediaBox origin stays intact (CropBox-only, origin preserved)
for (const rot of [0, 90, 180, 270]) {
  const pdf = await buildFixture({ origin: [100, 100] }, [rot]);
  const page = pdf.getPage(0);
  const box = cropBoxFor(rot, page.getMediaBox(), insets);
  page.setCropBox(box.x, box.y, box.width, box.height);
  const out = await pdf.save({ updateFieldAppearances: false, addDefaultPage: false });
  const back = await PDFDocument.load(out);
  const mb = back.getPage(0).getMediaBox();
  const cb = back.getPage(0).getCropBox();
  ok(`offset rot${rot} media origin kept`, mb.x === 100 && mb.y === 100, `got ${mb.x},${mb.y}`);
  ok(`offset rot${rot} crop equals math`, Math.abs(cb.x - box.x) < 1e-9 && Math.abs(cb.y - box.y) < 1e-9 && Math.abs(cb.width - box.width) < 1e-9 && Math.abs(cb.height - box.height) < 1e-9);
  ok(`offset rot${rot} crop inside media`, cb.x >= mb.x && cb.y >= mb.y && cb.x + cb.width <= mb.x + mb.width && cb.y + cb.height <= mb.y + mb.height);
}

// 3) Mixed 2-page document: page1 rot90, page2 rot270
{
  const pdf = await buildFixture({}, [90, 270]);
  for (let i = 0; i < 2; i++) {
    const page = pdf.getPage(i);
    const box = cropBoxFor(i === 0 ? 90 : 270, page.getMediaBox(), insets);
    page.setCropBox(box.x, box.y, box.width, box.height);
  }
  const out = await pdf.save({ updateFieldAppearances: false, addDefaultPage: false });
  const back = await PDFDocument.load(out);
  checkRotation(back.getPage(0), insets, "mixed p1 rot90");
  checkRotation(back.getPage(1), insets, "mixed p2 rot270");
  ok("mixed rots preserved", back.getPage(0).getRotation().angle === 90 && back.getPage(1).getRotation().angle === 270);
}

// 4) Real encrypted fixture must throw on plain load() (no ignoreEncryption)
{
  const bytes = readFileSync("e2e/fixtures/encrypted.pdf");
  let threw = false;
  let msg = "";
  try {
    await PDFDocument.load(new Uint8Array(bytes));
  } catch (e) {
    threw = true;
    msg = e.message;
  }
  ok("real encrypted fixture throws on plain load", threw);
  ok("message mentions encryption", /encrypt/i.test(msg), msg);
}

// 5) Rotation normalization
{
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]).setRotation(degrees(360));
  pdf.addPage([612, 792]);
  pdf.addPage([612, 792]).setRotation(degrees(-270));
  const out = await pdf.save({ updateFieldAppearances: false, addDefaultPage: false });
  const b = await PDFDocument.load(out);
  const r0 = (((b.getPage(0).getRotation().angle ?? 0) % 360) + 360) % 360;
  const r2 = (((b.getPage(2).getRotation().angle ?? 0) % 360) + 360) % 360;
  ok("360 -> 0", r0 === 0, `got ${r0}`);
  ok("-270 -> 90", r2 === 90, `got ${r2}`);
}

console.log(`\nPASS ${pass} FAIL ${fail}`);
process.exit(fail ? 1 : 0);