import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";

const COMPONENT = readFileSync(
  "src/features/pdf-redact/PdfRedact.tsx",
  "utf8",
);

const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const RENDER_SCALE = 1.5;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const A4_W = 595.28;
const A4_H = 841.89;

const STANDARD_FONTS = new URL(
  "../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).href;

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

// ---- mirrors of the component's pure logic (no DOM) ----

function rectFromFractions(r, vp) {
  const x0 = r.fx * vp.width;
  const y0 = r.fy * vp.height;
  const x1 = (r.fx + r.fw) * vp.width;
  const y1 = (r.fy + r.fh) * vp.height;
  const u0 = vp.convertToPdfPoint(x0, y0);
  const u1 = vp.convertToPdfPoint(x1, y1);
  return {
    x: Math.min(u0[0], u1[0]),
    y: Math.min(u0[1], u1[1]),
    width: Math.abs(u1[0] - u0[0]),
    height: Math.abs(u1[1] - u0[1]),
  };
}

function friendlyError(err) {
  const m = err instanceof Error ? err.message : String(err);
  if (/encrypted|password/i.test(m))
    return "This PDF is already password-protected. If you know its password, remove it with Unlock PDF first.";
  if (/Failed to parse|No PDF header|Invalid PDF structure/i.test(m))
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  return "Could not read that PDF. It may be corrupt or unsupported.";
}

function userFacing(msg) {
  const e = new Error(msg);
  e.userFacing = true;
  return e;
}

function toUiError(err) {
  if (err instanceof Error && err.userFacing) return err.message;
  return friendlyError(err);
}

function redactedName(origName) {
  return `${origName.replace(/\.pdf$/i, "")}-redacted.pdf`;
}

function removeRegion(pageRegions, id) {
  const list = (pageRegions ?? []).filter((r) => r.id !== id);
  return list.length ? list : null;
}

function clearPage() {
  return null;
}

async function getViewport(data, pageNum = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: data.slice(0),
    standardFontDataUrl: STANDARD_FONTS,
  });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(pageNum);
    return page.getViewport({ scale: 1 });
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

async function loadText(data, pageNum = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: data.slice(0),
    standardFontDataUrl: STANDARD_FONTS,
  });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    return content.items.map((it) => it.str ?? "").join("");
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

function decodedContents(page) {
  const contents = page.node.Contents();
  let streams = [];
  if (!contents) return "";
  if (Array.isArray(contents)) streams = contents;
  else if (contents.array) streams = contents.array;
  else streams = [contents];
  let out = "";
  for (const child of streams) {
    const resolved = page.node.context.lookup(child);
    const raw = resolved?.contents ?? null;
    if (!raw) continue;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    out +=
      bytes.length >= 2 && bytes[0] === 0x78 && bytes[1] === 0x9c
        ? inflateSync(bytes).toString("latin1")
        : Buffer.from(bytes).toString("latin1");
  }
  return out;
}

// ---- 1. caps constants + honest copy present in the component ----
const mSize = COMPONENT.match(/const MAX_FILE_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+);/);
const mPages = COMPONENT.match(/const MAX_PAGES\s*=\s*(\d+);/);
check(
  "component MAX_FILE_BYTES is 100 MiB",
  !!mSize && +mSize[1] * +mSize[2] * +mSize[3] === MAX_FILE_BYTES,
  COMPONENT.match(/const MAX_FILE_BYTES[^;]*;/)?.[0] ?? "not found",
);
check("component MAX_PAGES is 200", !!mPages && +mPages[1] === MAX_PAGES, mPages?.[0] ?? "");
check(
  "copy admits text is not deleted (honest limit)",
  COMPONENT.includes("not removed") && COMPONENT.includes("not a forensic guarantee"),
  "missing honest limit phrase",
);
check(
  "copy tells users to re-check the result before sharing",
  COMPONENT.includes("open the result in a reader and re-check"),
);
check(
  "steer mentions metadata / form values / hidden layers as unremoved",
  COMPONENT.includes("metadata, form values, or hidden layers"),
);

// ---- 2. exact mapping: clean fractions on a real A4 viewport ----
const a4 = new Uint8Array(
  await (async () => {
    const d = await PDFDocument.create();
    d.addPage([A4_W, A4_H]);
    return d.save({ useObjectStreams: false });
  })(),
);
const vpA4 = await getViewport(a4, 1);
const region = { fx: 96 / A4_W, fy: 184 / A4_H, fw: 120 / A4_W, fh: 28 / A4_H };
const mapped = rectFromFractions(region, vpA4);
check(
  "viewport reports expected A4 dims",
  Math.abs(vpA4.width - A4_W) < 1e-6 && Math.abs(vpA4.height - A4_H) < 1e-6,
  `w=${vpA4.width} h=${vpA4.height}`,
);
check(
  "rot-0 y-flip + scale exact: x/y/w/h in PDF units",
  Math.abs(mapped.x - 96) < 1e-6 &&
    Math.abs(mapped.y - (A4_H - 212)) < 1e-6 &&
    Math.abs(mapped.width - 120) < 1e-6 &&
    Math.abs(mapped.height - 28) < 1e-6,
  JSON.stringify(mapped),
);
check(
  "full-page fraction maps onto the whole mediabox",
  (() => {
    const f = rectFromFractions({ fx: 0, fy: 0, fw: 1, fh: 1 }, vpA4);
    return (
      Math.abs(f.x) < 1e-6 &&
      Math.abs(f.y) < 1e-6 &&
      Math.abs(f.width - A4_W) < 1e-6 &&
      Math.abs(f.height - A4_H) < 1e-6
    );
  })(),
);

// ---- 3. numeric-path mirror: floor(scale) display dims, round-trip ±0.25 pt ----
{
  const dW = Math.floor(vpA4.width * RENDER_SCALE) / RENDER_SCALE;
  const dH = Math.floor(vpA4.height * RENDER_SCALE) / RENDER_SCALE;
  const f = {
    fx: 88 / dW,
    fy: 168 / dH,
    fw: 150 / dW,
    fh: 60 / dH,
  };
  const r = rectFromFractions(f, vpA4);
  check(
    "numeric x/y/w/h survive the fraction round-trip within 0.25 pt",
    Math.abs(r.x - 88) < 0.25 &&
      Math.abs(r.y - (A4_H - 228)) < 0.25 &&
      Math.abs(r.width - 150) < 0.25 &&
      Math.abs(r.height - 60) < 0.25,
    JSON.stringify(r),
  );
  check(
    "region-on-page bounds check mirrors component (x+w vs dW+0.75)",
    88 + 150 <= dW + 0.75 && 168 + 60 <= dH + 0.75,
    `dW=${dW} dH=${dH}`,
  );
  check(
    "region sticking off the page is rejected by the mirror",
    !(88 + 600 <= dW + 0.75),
  );
}

// ---- 4. rotation is handled through the viewport ----
{
  const rot = new Uint8Array(
    await (async () => {
      const d = await PDFDocument.create();
      const p1 = d.addPage([A4_W, A4_H]);
      p1.drawText("page one", { x: 50, y: 700, size: 12 });
      const p2 = d.addPage([A4_W, A4_H]);
      p2.setRotation({ type: "degrees", angle: 90 });
      p2.drawText("page two", { x: 50, y: 700, size: 12 });
      return d.save({ useObjectStreams: false });
    })(),
  );
  const vp2 = await getViewport(rot, 2);
  check(
    "90-degree page swaps viewport width/height",
    Math.abs(vp2.width - A4_H) < 1e-6 && Math.abs(vp2.height - A4_W) < 1e-6,
    `w=${vp2.width} h=${vp2.height}`,
  );
  const full = rectFromFractions({ fx: 0, fy: 0, fw: 1, fh: 1 }, vp2);
  check(
    "full-page region stays inside the rotated page's mediabox",
    full.x >= 0 &&
      full.y >= 0 &&
      full.x + full.width <= A4_W + 1e-6 &&
      full.y + full.height <= A4_H + 1e-6,
    JSON.stringify(full),
  );
  const text = await loadText(rot, 2);
  check(
    "rotated page text still extracts through legacy pdfjs",
    text.includes("page two"),
    text,
  );
}

// ---- 5. error mapping mirrors the component, incl. real RC4 fixture ----
{
  const garbage = new Uint8Array(Buffer.from("this is definitely not a pdf file"));
  let plErr;
  try {
    await PDFDocument.load(garbage);
  } catch (err) {
    plErr = err;
  }
  check(
    "pdf-lib rejects a non-PDF with a mapped message",
    plErr && toUiError(plErr) === "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.",
    plErr ? String(plErr.message) : "no error",
  );

  const locked = new Uint8Array(readFileSync("e2e/fixtures/encrypted.pdf"));
  let lockedPl;
  try {
    await PDFDocument.load(locked);
  } catch (err) {
    lockedPl = err;
  }
  check(
    "RC4 encrypted fixture triggers pdf-lib's encrypted error",
    lockedPl && /encrypted|password/i.test(String(lockedPl.message)),
    lockedPl ? String(lockedPl.message) : "no error",
  );
  check(
    "encrypted fixture maps to the Unlock-PDF steer",
    lockedPl && toUiError(lockedPl) ===
      "This PDF is already password-protected. If you know its password, remove it with Unlock PDF first.",
  );
  check(
    "userFacing errors pass through verbatim",
    toUiError(userFacing("That file is larger than 100 MB, which this tool doesn't support. Split it with PDF Split first.")) ===
      "That file is larger than 100 MB, which this tool doesn't support. Split it with PDF Split first.",
  );
  check(
    "unmapped errors fall back to the friendly default",
    friendlyError(new Error("something totally unrelated")) ===
      "Could not read that PDF. It may be corrupt or unsupported.",
  );
}

// ---- 6. region list ops ----
check(
  "removing a region drops it from the page",
  removeRegion(
    [
      { id: 1, fx: 0.1, fy: 0.1, fw: 0.2, fh: 0.2 },
      { id: 2, fx: 0.4, fy: 0.4, fw: 0.2, fh: 0.2 },
    ],
    1,
  )?.length === 1,
);
check(
  "removing the last region clears the page's entry",
  removeRegion([{ id: 9, fx: 0, fy: 0, fw: 0.5, fh: 0.5 }], 9) === null,
);
check("clear page removes the page's regions", clearPage() === null);
check(
  "component derives files with the <src>-redacted.pdf pattern",
  COMPONENT.includes("`${name.replace(/\\.pdf$/i, \"\")}-redacted.pdf`") &&
    COMPONENT.includes("downloadBlob(saved, filename)"),
);
check(
  "mirror derives the same <src>-redacted.pdf name",
  redactedName("contract v1.PDF") === "contract v1-redacted.pdf" &&
    redactedName("notes.pdf") === "notes-redacted.pdf",
);

// ---- 7. strong honest check: text under a stamped black rect ----
{
  const src = new Uint8Array(
    await (async () => {
      const d = await PDFDocument.create();
      const p = d.addPage([A4_W, A4_H]);
      p.drawText("TOP SECRET", { x: 100, y: A4_H - 200, size: 20 });
      return d.save({ useObjectStreams: false });
    })(),
  );

  const dW = Math.floor(vpA4.width * RENDER_SCALE) / RENDER_SCALE;
  const dH = Math.floor(vpA4.height * RENDER_SCALE) / RENDER_SCALE;
  const f = { fx: 88 / dW, fy: 168 / dH, fw: 150 / dW, fh: 60 / dH };
  const rect = rectFromFractions(f, vpA4);

  const outDoc = await PDFDocument.load(src);
  const outPage = outDoc.getPage(0);
  outPage.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(0, 0, 0),
  });
  const redacted = new Uint8Array(await outDoc.save(SAVE_OPTS));

  const reloaded = await PDFDocument.load(redacted);
  check("redacted PDF reloads and keeps 1 page", reloaded.getPageCount() === 1);

  const stream = decodedContents(reloaded.getPage(0));
  check("content stream contains a black fill op", /0 0 0 rg/.test(stream), stream.slice(0, 160));
  check("content stream uses the cm + path pattern, not the re operator", !/(^|\s)re(\s|$)/.test(stream), stream);
  const cm = stream.match(/1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm/);
  check(
    "drawRectangle cm operand matches the mapped rect (±0.3)",
    !!cm &&
      Math.abs(parseFloat(cm[1]) - rect.x) < 0.3 &&
      Math.abs(parseFloat(cm[2]) - rect.y) < 0.3,
    cm ? `cm=${cm[1]},${cm[2]} rect=${rect.x},${rect.y}` : "no cm",
  );
  check(
    "path is built from m/l segments and filled with h/f/Q close",
    /(^|\n)0 0 m(\n|$)/.test(stream) &&
      /(^|\n)-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? l(\n|$)/.test(stream) &&
      /\nh\nf\nQ(\n|$)/.test(stream),
    stream,
  );
  check(
    "region fully covers the text drawing area",
    rect.x <= 100 &&
      rect.y <= A4_H - 200 - 14.5 &&
      rect.x + rect.width >= 200 &&
      rect.y + rect.height >= A4_H - 200 + 14.5,
    JSON.stringify(rect),
  );

  check(
    "text still exists under the box (honest residual — not deleted)",
    /TOP SECRET/.test(await loadText(redacted)),
    "covered text not extractable",
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);