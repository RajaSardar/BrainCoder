import { PDFDocument, PDFName } from "pdf-lib";
import { encryptPDF, encodePasswordAES256 } from "@pdfsmaller/pdf-encrypt";
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

async function buildFixture() {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 3; i++) doc.addPage([612, 792]);
  return await doc.save({ updateFieldAppearances: false, addDefaultPage: false });
}

const plain = await buildFixture();
{
  const back = await PDFDocument.load(plain);
  ok("fixture loads with 3 pages", back.getPageCount() === 3);
}

// 1) AES-256 default encryption is real
const enc = await encryptPDF(plain, "CorrectHorseBatteryStaple");
{
  const info = await isEncrypted(enc);
  ok("AES-256 output detected as encrypted", info.encrypted === true);
  ok("algorithm is AES-256", info.algorithm === "AES-256", String(info.algorithm));
  ok("version/revision 5/6", info.version === 5 && info.revision === 6, `V${info.version} R${info.revision}`);
}
{
  let threw = false;
  let msg = "";
  try {
    await PDFDocument.load(enc);
  } catch (e) {
    threw = true;
    msg = e.message;
  }
  ok("encrypted output throws on a plain load (proves the component's encryption check fires)", threw);
  ok("message mentions encryption", /encrypt/i.test(msg), msg);
}

// 2) Round-trips with @pdfsmaller/pdf-decrypt using the same password
{
  const dec = await decryptPDF(enc, "CorrectHorseBatteryStaple");
  const d = await PDFDocument.load(dec);
  ok("decrypt round-trip keeps all 3 pages", d.getPageCount() === 3);
}
{
  let threw = false;
  let msg = "";
  try {
    await decryptPDF(enc, "DefinitelyWrongPassword");
  } catch (e) {
    threw = true;
    msg = e.message;
  }
  ok("wrong password rejected", threw && /Incorrect password/i.test(msg), msg);
}

// 3) Re-encrypting an already protected PDF is refused loudly
{
  const fixture = readFileSync("e2e/fixtures/encrypted.pdf");
  let threw = false;
  let msg = "";
  try {
    await encryptPDF(new Uint8Array(fixture), "anotherPass123");
  } catch (e) {
    threw = true;
    msg = e.message;
    ok("AlreadyEncryptedError class surfaced", e.name === "AlreadyEncryptedError", e.name);
  }
  ok("already-encrypted input throws", threw, msg);
}

// 4) Permission flags materialize in the RC4 encrypt dict P field
async function readP(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const ref = doc.context.trailerInfo.Encrypt;
  const dict = doc.context.lookup(ref);
  if (!dict || typeof dict.get !== "function") return null;
  const v = dict.get(PDFName.of("P"));
  return v ? v.asNumber() : null;
}
{
  const rc4PrintOff = await encryptPDF(plain, "pw12345", { algorithm: "RC4", allowPrinting: false });
  const rc4AllOn = await encryptPDF(plain, "pw12345", { algorithm: "RC4" });
  const pOff = await readP(rc4PrintOff);
  const pOn = await readP(rc4AllOn);
  ok("RC4 encrypt dict exposes /P", typeof pOff === "number", String(pOff));
  ok("printing bit cleared when allowPrinting=false", pOff !== null && (pOff & 4) === 0, String(pOff));
  ok("printing bit set by default", pOn !== null && (pOn & 4) !== 0, String(pOn));
  const decOff = await decryptPDF(rc4PrintOff, "pw12345");
  ok("RC4 output decrypts back", (await PDFDocument.load(decOff)).getPageCount() === 3);
}

// 5) AES-256 password encoding boundary matches the component cap
{
  const t = encodePasswordAES256("x".repeat(130));
  ok("SASLprep/UTF-8 path truncates long passwords to 127 bytes", t.length === 127, `got ${t.length}`);
  ok("short password passes through", encodePasswordAES256("abcde").length === 5);
}

console.log(`\nPASS ${pass} FAIL ${fail}`);
process.exit(fail ? 1 : 0);