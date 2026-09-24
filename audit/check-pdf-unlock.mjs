import { PDFDocument } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { decryptPDF, isEncrypted } from "@pdfsmaller/pdf-decrypt";
import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;

function ok(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

// Real RC4 (V=1, R=2) 40-bit encrypted PDF, user password "pw", owner "owner"
const fixture = new Uint8Array(readFileSync("e2e/fixtures/encrypted.pdf"));

// 1) isEncrypted detects the RC4 fixture
{
  const info = await isEncrypted(fixture);
  ok("fixture detected as encrypted", info.encrypted === true);
  ok("algorithm reports RC4", info.algorithm === "RC4", String(info.algorithm));
  ok("RC4 standard revision (V2 R3 from pdf-encrypt)", info.version === 2 && info.revision === 3, `V${info.version} R${info.revision}`);
}

// 2) Either the user or the owner password unlocks it
for (const [label, pw] of [["user password", "pw"], ["owner password", "owner"]]) {
  const dec = await decryptPDF(fixture, pw);
  const doc = await PDFDocument.load(dec);
  ok(`${label} decrypts to a plain-loadable PDF (${doc.getPageCount()} page)`, doc.getPageCount() === 1);
}

// 3) Wrong password rejected
{
  let msg = "";
  try {
    await decryptPDF(fixture, "nope-nope");
    ok("wrong password rejected", false);
  } catch (e) {
    msg = e.message;
    ok("wrong password rejected", /Incorrect password/i.test(msg), msg);
  }
}

// 4) Unencrypted input is refused (not encrypt): the "not protected" path
{
  const plain = await PDFDocument.create();
  plain.addPage([612, 792]);
  const bytes = await plain.save({ addDefaultPage: false });
  let msg = "";
  try {
    await decryptPDF(bytes, "whatever");
    ok("unencrypted input refused", false);
  } catch (e) {
    msg = e.message;
    ok("unencrypted input refused with clear message", /not encrypted/i.test(msg), msg);
  }
}

// 5) AES-256 via @pdfsmaller/pdf-encrypt unlocks through @pdfsmaller/pdf-decrypt
{
  const plain = await PDFDocument.create();
  plain.addPage([612, 792]);
  const bytes = await plain.save({ addDefaultPage: false });
  const enc = await encryptPDF(bytes, "Str0ng!Passw0rd#2026");
  const info = await isEncrypted(enc);
  ok("AES-256 file detected", info.algorithm === "AES-256");
  const dec = await decryptPDF(enc, "Str0ng!Passw0rd#2026");
  ok("AES-256 decrypts back", (await PDFDocument.load(dec)).getPageCount() === 1);
}

// 6) AES-128 (V=4/R=4) is honestly refused as unsupported, not silently corrupted.
// Flip the fixture's encrypt params to R6-style /V 4 /R 4.
function toFakeAES128(bytes) {
  const s = Buffer.from(bytes).toString("latin1");
  const t = String(s).replace(/\/V[ \t]+2/g, "/V 4").replace(/\/R[ \t]+3/g, "/R 4");
  if (t === s) throw new Error("fixture /V 2 /R 3 pattern not found");
  return Buffer.from(t, "latin1");
}
{
  const fake = toFakeAES128(fixture);
  let isMsg = "";
  let wasUnsupportedIs = false;
  try {
    await isEncrypted(fake);
  } catch (e) {
    isMsg = e.message;
    wasUnsupportedIs = true;
  }
  ok("isEncrypted refuses AES-128 loudly", wasUnsupportedIs, isMsg);
  ok("mentions Unsupported encryption V=4", /Unsupported encryption: V=4/i.test(isMsg), isMsg);

  let decMsg = "";
  let wasUnsupportedDec = false;
  try {
    await decryptPDF(fake, "pw");
  } catch (e) {
    decMsg = e.message;
    wasUnsupportedDec = true;
  }
  ok("decryptPDF refuses AES-128 loudly", wasUnsupportedDec, decMsg);
  ok("decrypt unsupported message preserved", /Unsupported encryption: V=4/i.test(decMsg), decMsg);
}

// 7) The component's output-validation rule: an unlocked PDF must be a
// valid plain-loadable %PDF, so garbage can never be offered as a download.
{
  const dec = await decryptPDF(fixture, "pw");
  ok("unlocked bytes start with %PDF", dec[0] === 0x25 && dec[1] === 0x50 && dec[2] === 0x44 && dec[3] === 0x46);
  ok("unlocked bytes plain-load via pdf-lib", (await PDFDocument.load(dec)).getPageCount() === 1);
}

console.log(`\nPASS ${pass} FAIL ${fail}`);
process.exit(fail ? 1 : 0);