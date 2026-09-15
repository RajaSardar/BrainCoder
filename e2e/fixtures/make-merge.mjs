import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile, writeFile } from "node:fs/promises";

const ttf = await readFile(
  new URL("../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf", import.meta.url),
);

async function makePdf(lines) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(ttf));
  const page = doc.addPage([500, 700]);
  lines.forEach((ln, i) => page.drawText(ln, { x: 60, y: 640 - i * 26, fontSize: 12, font }));
  return doc.save();
}

async function makeMultiPagePdf(pages) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(ttf));
  for (const lines of pages) {
    const page = doc.addPage([500, 700]);
    lines.forEach((ln, i) => page.drawText(ln, { x: 60, y: 640 - i * 26, fontSize: 12, font }));
  }
  return doc.save();
}

const [a, b] = await Promise.all([makePdf(["Merge file A content"]), makePdf(["Merge file B content"])]);
const split = await makeMultiPagePdf([["Page one content"], ["Page two content"]]);

async function makeBlankFixture() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(ttf));
  const fillPage = (p) => {
    for (let i = 0; i < 14; i++) {
      p.drawText(`This is content line number ${i + 1} of the blank-page fixture.`, {
        x: 60,
        y: 650 - i * 24,
        fontSize: 14,
        font,
      });
    }
  };
  fillPage(doc.addPage([500, 700]));
  doc.addPage([500, 700]);
  fillPage(doc.addPage([500, 700]));
  return doc.save();
}
const blanks = await makeBlankFixture();

await Promise.all([
  writeFile(new URL("./merge-a.pdf", import.meta.url), a),
  writeFile(new URL("./merge-b.pdf", import.meta.url), b),
  writeFile(new URL("./split-src.pdf", import.meta.url), split),
  writeFile(new URL("./blank-pages.pdf", import.meta.url), blanks),
]);
console.log(
  `wrote merge-a.pdf (${a.length} B), merge-b.pdf (${b.length} B), split-src.pdf (${split.length} B), blank-pages.pdf (${blanks.length} B)`,
);