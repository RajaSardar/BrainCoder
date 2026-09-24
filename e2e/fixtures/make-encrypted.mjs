import { PDFDocument } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { writeFileSync } from "node:fs";

const FIXTURE = new URL("./encrypted.pdf", import.meta.url);

const doc = await PDFDocument.create();
doc.setProducer("make-encrypted fixture");
doc.setCreationDate(new Date("2024-01-15T00:00:00Z"));
doc.addPage([200, 200]);
const plain = await doc.save({ addDefaultPage: false });

const encrypted = await encryptPDF(plain, "pw", {
  algorithm: "RC4",
  ownerPassword: "owner",
});

writeFileSync(FIXTURE, encrypted);
console.log(
  `wrote ${FIXTURE.pathname} (${encrypted.length} bytes) RC4 V=1 R=2, user "pw", owner "owner"`,
);