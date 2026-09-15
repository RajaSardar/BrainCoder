import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile, writeFile } from "node:fs/promises";

const ttf = await readFile(
  new URL("../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf", import.meta.url),
);

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const font = await doc.embedFont(new Uint8Array(ttf));
const lines = [
  "The patient John A Smith has private insurance details.",
  "This record is CONFIDENTIAL and must not be shared.",
  "John Smith approved the treatment plan today.",
  "Private records for John A. Smith are stored securely.",
  "Insurance policy number marked Confidential.",
];

const page = doc.addPage([500, 700]);
for (let i = 0; i < lines.length; i++) {
  page.drawText(lines[i], { x: 60, y: 640 - i * 26, fontSize: 12, font });
}

const out = await doc.save();
await writeFile(new URL("./redact.pdf", import.meta.url), out);
console.log(`wrote ${new URL("./redact.pdf", import.meta.url).pathname} (${out.length} bytes)`);