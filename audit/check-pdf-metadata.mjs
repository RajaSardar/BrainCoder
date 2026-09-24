import { PDFDocument, PDFName } from "pdf-lib";
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

// ---- pdf.js (legacy build — the Node-compatible bundle the audit uses) ----
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

async function loadMeta(u8) {
  const task = pdfjs.getDocument({ data: u8 });
  const doc = await task.promise;
  const meta = await doc.getMetadata();
  await task.destroy();
  return { numPages: doc.numPages, info: meta.info ?? {}, metadata: meta.metadata };
}

// ---- Mirrors of the component's pure logic (kept byte-for-byte in sync) ----
function mirrorFormatDate(input) {
  const s = input.trim();
  const pdf = s.match(
    /^D:(\d{4})(?:(\d{2})(?:(\d{2})(?:(\d{2})(?:(\d{2})(?:(\d{2}))?)?)?)?)?(Z|[+-]\d{2}(?:'\d{2}')?)?$/i,
  );
  const iso = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?)?/i,
  );
  const m = pdf ?? iso;
  if (!m) return s;
  const [, y, mo, da, h, mi, se, tz] = m;
  let out = y;
  if (mo) out += `-${mo}`;
  if (da) out += `-${da}`;
  if (h) {
    out += ` ${h}`;
    if (mi) out += `:${mi}`;
    if (se) out += `:${se}`;
  }
  if (tz) {
    const cleaned = tz
      .replace(/'/g, "")
      .replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")
      .replace(/^([+-]\d{2})$/, "$1:00");
    out += ` ${cleaned.toUpperCase()}`;
  }
  return out;
}

function mirrorBuildRows(numPages, info, metadata) {
  const lower = {};
  for (const [k, v] of Object.entries(info)) lower[k.toLowerCase()] = v;
  const out = [];
  const seen = new Set();
  const push = (key, value) => {
    if (value === undefined || value === null || `${value}` === "") return;
    const lk = key.toLowerCase();
    if (seen.has(lk)) return;
    seen.add(lk);
    out.push({ key, value: String(value).length > 2000 ? String(value).slice(0, 2000) + "…" : String(value) });
  };
  push("Pages", numPages);
  for (const key of ["Title", "Author", "Subject", "Keywords", "Creator", "Producer"]) {
    const v = lower[key.toLowerCase()];
    if (v !== undefined && v !== null && `${v}` !== "") push(key, v);
  }
  if (lower["pdfformatversion"] != null && `${lower["pdfformatversion"]}` !== "")
    push("Format", lower["pdfformatversion"]);
  const xmp = {};
  if (metadata && typeof metadata[Symbol.iterator] === "function") {
    for (const [k, v] of metadata) {
      if (v === undefined || v === null) continue;
      const key = String(k).toLowerCase();
      const value = Array.isArray(v) ? v.map((x) => String(x)).join(", ") : String(v);
      if (!xmp[key]) xmp[key] = value;
    }
  }
  for (const [xkey, outKey] of Object.entries({
    "dc:title": "Title",
    "dc:creator": "Author",
    "dc:subject": "Keywords",
    "dc:description": "Subject",
    "xmp:creatortool": "Creator",
    "pdf:producer": "Producer",
  })) {
    if (xmp[xkey] && !seen.has(outKey.toLowerCase())) push(outKey, xmp[xkey]);
  }
  const created =
    lower["creationdate"] != null ? mirrorFormatDate(String(lower["creationdate"])) : xmp["xmp:createdate"] ? mirrorFormatDate(xmp["xmp:createdate"]) : null;
  const modified =
    lower["moddate"] != null ? mirrorFormatDate(String(lower["moddate"])) : xmp["xmp:modifydate"] ? mirrorFormatDate(xmp["xmp:modifydate"]) : null;
  if (created) push("Created", created);
  if (modified) push("Modified", modified);
  const extras = [];
  const skip = new Set([
    "title", "author", "subject", "keywords", "creator", "producer",
    "creationdate", "moddate", "custom", "pdfformatversion",
    "islinearized", "isacroformpresent", "isxfapresent", "issignaturespresent",
    "iscollectionpresent", "pdfjsversion", "pdfjsrenderer",
  ]);
  for (const [k, v] of Object.entries(info)) {
    const lk = k.toLowerCase();
    if (v === undefined || v === null) continue;
    if (lk === "custom") {
      if (typeof v === "object" && v !== null) {
        const entries = v instanceof Map ? Array.from(v.entries()) : Object.entries(v);
        for (const [ck, cv] of entries) {
          if (cv !== undefined && cv !== null && `${cv}` !== "")
            extras.push({ key: String(ck), value: String(cv).length > 2000 ? String(cv).slice(0, 2000) + "…" : String(cv) });
        }
      }
      continue;
    }
    if (skip.has(lk)) continue;
    const value = Array.isArray(v) ? v.join(", ") : String(v);
    if (value === "") continue;
    extras.push({ key: k, value: String(value).length > 2000 ? String(value).slice(0, 2000) + "…" : String(value) });
  }
  extras.sort((a, b) => a.key.localeCompare(b.key));
  for (const e of extras) push(e.key, e.value);
  return out.slice(0, 80);
}

// ---- 1) pdf-lib writes a real Info dictionary that pdf.js reads back ----
{
  const doc = await PDFDocument.create();
  doc.setTitle("Fixture Report");
  doc.setAuthor("Jane Tester");
  doc.setSubject("Q3 results");
  doc.setKeywords(["revenue", "gross margin"]);
  doc.setCreator("CheckScript");
  doc.setProducer("FixtureWriter 9.0");
  doc.setCreationDate(new Date("2024-01-15T14:00:00+05:30"));
  doc.setModificationDate(new Date("2024-02-20T09:15:00Z"));
  for (let i = 0; i < 2; i++) doc.addPage([612, 792]);
  const bytes = await doc.save({ addDefaultPage: false });

  const { numPages, info, metadata } = await loadMeta(new Uint8Array(bytes));
  ok("numPages read back as 2", numPages === 2, String(numPages));
  ok("Title read back", info.Title === "Fixture Report", String(info.Title));
  ok("Author read back", info.Author === "Jane Tester", String(info.Author));
  ok("Producer read back", /FixtureWriter/.test(String(info.Producer ?? "")), String(info.Producer));
  ok("CreationDate present as PDF date string", /^D:/i.test(String(info.CreationDate ?? "")), String(info.CreationDate));

  const rows = mirrorBuildRows(numPages, info, metadata);
  const keys = rows.map((r) => r.key);
  ok("Pages row first", rows[0].key === "Pages" && rows[0].value === "2");
  ok("Title/Author/Subject/Keywords/Creator/Producer all listed once", ["Title", "Author", "Subject", "Keywords", "Creator", "Producer"].every((k) => keys.filter((x) => x === k).length === 1));
  ok("Created appears exactly once (no raw CreationDate dup)", keys.filter((k) => k === "Created").length === 1);
  ok("Modified appears exactly once (no raw ModDate dup)", keys.filter((k) => k === "Modified").length === 1);
  ok("no raw CreationDate/ModDate rows leaked", !keys.includes("CreationDate") && !keys.includes("ModDate"));
  const created = rows.find((r) => r.key === "Created").value;
  ok("Created formatted with time and offset (pdf-lib normalizes to UTC)", created === "2024-01-15 08:30:00 Z", created);
}

// ---- 2) Hand-crafted XMP Metadata stream: pdf.js lowercases keys, mirror reads it ----
const XMP = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">XmpOnlyTitle</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>Jane Doe</rdf:li></rdf:Seq></dc:creator>
   <xmp:CreateDate>2020-01-02T03:04:05Z</xmp:CreateDate>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

{
  // pdf-lib cannot write XMP, so inject an XMP metadata stream into the
  // catalog directly — the resulting file parses cleanly in both pdf-lib and pdf.js.
  const doc = await PDFDocument.create();
  doc.setTitle("InfoTitle");
  doc.setCreator("XmpFixture");
  doc.addPage([200, 200]);
  const xmpBytes = new TextEncoder().encode(XMP);
  const stream = doc.context.flateStream(xmpBytes, { Type: "Metadata", Subtype: "XML" });
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(stream));
  const bytes = await doc.save({ addDefaultPage: false });

  const { numPages, info, metadata } = await loadMeta(new Uint8Array(bytes));
  ok("XMP fixture: pages 1", numPages === 1);
  ok("XMP fixture: Info Title read", info.Title === "InfoTitle", String(info.Title));
  ok("pdf.js exposes XMP entries through a Metadata object", metadata !== null && metadata !== undefined);
  ok("pdf.js lowercases XMP keys (xmp:createdate readable)", metadata?.get("xmp:createdate") === "2020-01-02T03:04:05Z", String(metadata?.get("xmp:createdate")));
  ok("dc:title accessible as dc:title", metadata?.get("dc:title") === "XmpOnlyTitle", String(metadata?.get("dc:title")));

  const rows = mirrorBuildRows(numPages, info, metadata);
  const created = rows.find((r) => r.key === "Created");
  ok("Created row uses Info CreationDate (Info wins over XMP by design)", created && created.value === mirrorFormatDate(String(info.CreationDate)), `${created?.value} vs mirror(${String(info.CreationDate)})`);
  ok("exactly one Created row despite XMP also having a date", rows.filter((r) => r.key === "Created").length === 1);
  const author = rows.find((r) => r.key === "Author");
  ok("Author from dc:creator", author && author.value === "Jane Doe", author?.value);
  const title = rows.find((r) => r.key === "Title");
  ok("Title row is single (Info), dc:title never leaks a duplicate", title && title.value === "InfoTitle", title?.value);
}

// ---- 3') Mirror-level: Info CreationDate wins over XMP date, still one row ----
{
  const fakeMetadata = new Map([["xmp:createdate", "2020-01-02T03:04:05Z"]]);
  const rows = mirrorBuildRows(1, { Title: "T2", CreationDate: "D:20200101" }, fakeMetadata);
  const keys = rows.map((r) => r.key);
  ok("Info date wins over XMP and is formatted", rows.find((r) => r.key === "Created")?.value === "2020-01-01");
  ok("still exactly one Created row", keys.filter((k) => k === "Created").length === 1);

  // Info LACKS any date → XMP is the fallback source (pdf-lib always writes
  // an Info date, so this branch can only be proven at the mirror level)
  const rowsNoInfoDate = mirrorBuildRows(1, { Title: "T3" }, fakeMetadata);
  ok("Created falls back to XMP and formats with time+timezone", rowsNoInfoDate.find((r) => r.key === "Created")?.value === "2020-01-02 03:04:05 Z", rowsNoInfoDate.find((r) => r.key === "Created")?.value);
}

// ---- formatDate honesty: never invents month/day/time ----
{
  const cases = [
    ["D:20240115140000+05'30'", "2024-01-15 14:00:00 +05:30"],
    ["D:2024", "2024"],
    ["D:202405", "2024-05"],
    ["D:20240501", "2024-05-01"],
    ["2024-03-05T09:30:00Z", "2024-03-05 09:30:00 Z"],
    ["2024-03-05T09:30:00+02:00", "2024-03-05 09:30:00 +02:00"],
    ["garbage-date", "garbage-date"],
  ];
  for (const [inp, want] of cases) {
    const got = mirrorFormatDate(inp);
    ok(`formatDate "${inp}" → "${want}"`, got === want, got);
  }
}

// ---- 4) buildRows: Custom map, case-insensitivity, internal-flag skip ----
{
  const info = {
    Title: "T",
    CreationDate: "D:2024",
    Custom: new Map([
      ["OriginalFileName", "scan-01.pdf"],
      ["Version", "3"],
    ]),
    IsAcroFormPresent: true,
    IsXFAPresent: false,
    IsSignaturesPresent: false,
    IsLinearized: true,
    PDFFormatVersion: "1.7",
    PDFJSVersion: "6.x",
  };
  const rows = mirrorBuildRows(3, info, {});
  const keys = rows.map((r) => r.key);
  ok("Pages first", rows[0].key === "Pages");
  ok("no '[object Map]' value anywhere", !rows.some((r) => r.value.includes("[object Map]")));
  ok("Custom entries surfaced as their own keys", keys.includes("OriginalFileName") && keys.includes("Version"));
  ok("no literal 'Custom' row", !keys.includes("Custom"));
  ok("pdf.js internal flags skipped (IsAcroFormPresent/IsXFAPresent/IsSignaturesPresent/IsLinearized)", !keys.includes("IsAcroFormPresent") && !keys.includes("IsXFAPresent") && !keys.includes("IsSignaturesPresent") && !keys.includes("IsLinearized"));
  ok("PDFJSVersion not surfaced in extras", !keys.includes("PDFJSVersion"));
  ok("Created single row from CreationDate", keys.filter((k) => k === "Created").length === 1);
}

console.log(`\nPASS ${pass} FAIL ${fail}`);
process.exit(fail ? 1 : 0);