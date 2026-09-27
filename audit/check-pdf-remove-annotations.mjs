import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);
const lib = require("pdf-lib");
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef, StandardFonts } = lib;
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const COMPONENT = readFileSync(
  join(ROOT, "src/features/pdf-remove-annotations/PdfRemoveAnnotations.tsx"),
  "utf8",
);
const TOOL_CONTENT = readFileSync(join(ROOT, "src/lib/tool-content.ts"), "utf8");
const SEO = readFileSync(join(ROOT, "src/lib/seo.ts"), "utf8");
const GUIDES = readFileSync(join(ROOT, "src/lib/guides.ts"), "utf8");
const TOOLS = readFileSync(join(ROOT, "src/lib/tools.ts"), "utf8");
// JSX wraps prose across lines; match against a whitespace-collapsed copy.
const COMPONENT_TEXT = COMPONENT.replace(/\s+/g, " ");

const STANDARD_FONTS = join(ROOT, "node_modules/pdfjs-dist/standard_fonts/") + "/";
const A4_W = 595.28;
const A4_H = 841.89;

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_PAGE_CHIPS = 24;
const PAINT_EVERY = 10;
const MAX_STEM = 96;
// One backslash, spelled this way so the sanitizer literal below needs no escaping.
const BS = String.fromCharCode(92);
const LOAD_OPTS = { updateMetadata: false };
const SAVE_OPTS = {
  useObjectStreams: false,
  updateFieldAppearances: false,
  addDefaultPage: false,
};

let passed = 0;
let failed = 0;
function check(condition, label, extra = "") {
  // Some call sites were written check("label", cond); normalise both orders and
  // hard-fail if a non-boolean ever reaches the assertion, so a swapped call can
  // never be mistaken for a pass.
  let ok = condition;
  if (typeof condition === "string" && typeof label === "boolean") {
    ok = label;
    label = condition;
  }
  if (typeof ok !== "boolean") {
    throw new Error(`check() needs a boolean condition, got ${typeof ok} for "${label}"`);
  }
  if (ok) {
    passed++;
    console.log("PASS", label);
  } else {
    failed++;
    console.log("FAIL", label, extra ? `— ${extra}` : "");
  }
}

// ---------------------------------------------------------------------------
// mirrors of the component's pure logic
// ---------------------------------------------------------------------------

const MARKUP_SUBTYPES = new Set([
  "Text",
  "Highlight",
  "Underline",
  "Squiggly",
  "StrikeOut",
  "FreeText",
  "Ink",
  "Popup",
  "Caret",
  "FileAttachment",
  "Sound",
  "Movie",
  "Screen",
  "Polygon",
  "PolyLine",
  "Redact",
  "Projection",
]);

const KIND_LABEL = {
  markup: { one: "comment, highlight or note", many: "comments, highlights and notes" },
  link: { one: "link", many: "links" },
  stamp: { one: "stamp", many: "stamps" },
  widget: { one: "form field", many: "form fields" },
  other: { one: "other annotation", many: "other annotations" },
};

function emptyCounts() {
  return { markup: 0, link: 0, stamp: 0, widget: 0, other: 0 };
}

function classify(subtype) {
  if (subtype === "Widget") return "widget";
  if (subtype === "Link") return "link";
  if (subtype === "Stamp") return "stamp";
  if (MARKUP_SUBTYPES.has(subtype)) return "markup";
  return "other";
}

function hasPdfHeader(data) {
  const limit = Math.min(data.length, 1024);
  for (let i = 0; i + 5 <= limit; i++) {
    if (
      data[i] === 0x25 &&
      data[i + 1] === 0x50 &&
      data[i + 2] === 0x44 &&
      data[i + 3] === 0x46 &&
      data[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

function annotEntries(doc, index) {
  const array = doc.getPage(index).node.Annots();
  if (!(array instanceof PDFArray)) return [];
  return array.asArray().map((ref) => {
    const obj = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
    const sub = obj instanceof PDFDict ? obj.get(PDFName.of("Subtype")) : undefined;
    const subtype =
      sub instanceof PDFName ? sub.asString().replace(/^\//, "") : "Unknown";
    return { ref, kind: classify(subtype) };
  });
}

function scanDocument(doc, onPage) {
  const pages = [];
  const kinds = emptyCounts();
  let total = 0;
  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    onPage?.(i + 1, pageCount);
    const entries = annotEntries(doc, i);
    let pageTotal = 0;
    for (const entry of entries) {
      kinds[entry.kind] += 1;
      pageTotal += 1;
    }
    total += pageTotal;
    pages.push({ page: i + 1, total: pageTotal });
  }
  return { pages, total, kinds };
}

function collectRefs(obj, out) {
  if (!obj) return;
  if (obj instanceof PDFRef) {
    out.push(obj);
    return;
  }
  if (obj instanceof PDFDict) {
    for (const key of obj.keys()) collectRefs(obj.get(key), out);
    return;
  }
  if (obj instanceof PDFArray) {
    for (const child of obj.asArray()) collectRefs(child, out);
  }
}

function reachableRefs(doc) {
  const roots = [];
  const trailer = doc.context.trailerInfo;
  collectRefs(trailer.Root, roots);
  collectRefs(trailer.Info, roots);
  collectRefs(trailer.Encrypt, roots);
  const live = new Set();
  const stack = roots.slice();
  while (stack.length) {
    const ref = stack.pop();
    const key = ref.toString();
    if (live.has(key)) continue;
    live.add(key);
    const children = [];
    collectRefs(doc.context.lookup(ref), children);
    for (const child of children) {
      if (!live.has(child.toString())) stack.push(child);
    }
  }
  return live;
}

function formFieldRefs(doc) {
  const acro = doc.context.lookup(doc.catalog.get(PDFName.of("AcroForm")));
  if (!(acro instanceof PDFDict)) return [];
  const fields = doc.context.lookup(acro.get(PDFName.of("Fields")));
  if (!(fields instanceof PDFArray)) return [];
  const out = [];
  const seen = new Set();
  const stack = fields.asArray().slice();
  while (stack.length) {
    const ref = stack.pop();
    if (!(ref instanceof PDFRef)) continue;
    const key = ref.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const dict = doc.context.lookup(ref);
    if (!(dict instanceof PDFDict)) continue;
    out.push(ref);
    for (const name of ["Kids", "Parent"]) {
      const related = doc.context.lookup(dict.get(PDFName.of(name)));
      if (related instanceof PDFArray) {
        for (const child of related.asArray()) stack.push(child);
      } else if (related instanceof PDFRef) {
        stack.push(related);
      }
    }
  }
  return out;
}

const OWNED_KEYS = ["IRT", "OC", "Popup", "QuadPoints", "R", "Vertices", "InkList"];
const APPEARANCE_STATES = ["N", "D"];

function ownedRefs(doc, start, out) {
  if (!start) return;
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const obj = stack.pop();
    if (obj instanceof PDFRef) {
      const key = obj.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(obj);
      const resolved = doc.context.lookup(obj);
      if (resolved instanceof PDFDict) stack.push(resolved);
      continue;
    }
    if (obj instanceof PDFArray) {
      for (const child of obj.asArray()) stack.push(child);
      continue;
    }
    if (!(obj instanceof PDFDict)) continue;
    for (const key of OWNED_KEYS) {
      const value = obj.get(PDFName.of(key));
      if (value) stack.push(value);
    }
    const appearance = obj.get(PDFName.of("AP"));
    if (!appearance) continue;
    const resolved = appearance instanceof PDFRef ? doc.context.lookup(appearance) : appearance;
    if (resolved instanceof PDFArray) {
      for (const child of resolved.asArray()) stack.push(child);
    } else if (resolved instanceof PDFDict) {
      for (const state of APPEARANCE_STATES) {
        const value = resolved.get(PDFName.of(state));
        if (value) stack.push(value);
      }
    } else if (resolved) {
      stack.push(resolved);
    }
  }
}

async function stripAnnotations(doc, keepFormFields, onProgress) {
  const removedRefs = [];
  const childRefs = [];
  const seen = new Set();
  const pageTotal = doc.getPageCount();
  let removed = 0;
  let keptWidgets = 0;
  const take = (list, ref) => {
    const key = ref.toString();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(ref);
  };
  for (let i = 0; i < pageTotal; i++) {
    const page = doc.getPage(i);
    const entries = annotEntries(doc, i);
    if (entries.length === 0) {
      page.node.delete(PDFName.of("Annots"));
    } else {
      const kept = [];
      for (const entry of entries) {
        if (keepFormFields && entry.kind === "widget") {
          kept.push(entry.ref);
          keptWidgets += 1;
          continue;
        }
        removed += 1;
        if (entry.ref instanceof PDFRef) {
          take(removedRefs, entry.ref);
          ownedRefs(doc, doc.context.lookup(entry.ref), childRefs);
        }
      }
      if (kept.length === 0) page.node.delete(PDFName.of("Annots"));
      else page.node.set(PDFName.of("Annots", PDFArray), doc.context.obj(kept));
    }
    const done = i + 1;
    if (done === 1 || done % PAINT_EVERY === 0 || done === pageTotal) {
      await onProgress?.({ phase: "pages", page: done, total: pageTotal });
    }
  }
  if (!keepFormFields || keptWidgets === 0) {
    for (const ref of formFieldRefs(doc)) take(removedRefs, ref);
    doc.catalog.delete(PDFName.of("AcroForm"));
  }
  let pruned = 0;
  let candidates = 0;
  let pruneFailed = false;
  try {
    await onProgress?.({ phase: "prune", page: 0, total: pageTotal });
    const live = reachableRefs(doc);
    const doomed = [];
    const doomedSeen = new Set();
    for (const ref of [...removedRefs, ...childRefs]) {
      const key = ref.toString();
      if (doomedSeen.has(key)) continue;
      doomedSeen.add(key);
      if (live.has(key)) continue;
      doomed.push(ref);
    }
    candidates = doomed.length;
    for (const ref of doomed) {
      if (doc.context.delete(ref)) pruned += 1;
    }
  } catch {
    pruneFailed = true;
  }
  return { removed, keptWidgets, pruned, candidates, pruneFailed };
}

function friendlyError(err) {
  const m = err instanceof Error ? err.message : String(err);
  if (/encrypted|password/i.test(m)) {
    return "This PDF is password-protected. Remove the password with PDF Unlock, then strip its annotations.";
  }
  if (/No PDF header|Failed to parse|Invalid PDF|not a PDF/i.test(m)) {
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  }
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

function removableCountFor(total, widgets, keepFormFields) {
  return keepFormFields ? Math.max(0, total - widgets) : total;
}

function outputNameFor(source) {
  const base = source
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim()
    .slice(0, MAX_STEM)
    .replace(/[. ]+$/, "");
  return `${base || "document"}-no-annotations.pdf`;
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

function sizeLabel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sizeDelta(from, to) {
  if (from <= 0) return "—";
  const pct = Math.round(((to - from) / from) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function describeKinds(kinds) {
  const parts = [];
  for (const kind of Object.keys(KIND_LABEL)) {
    const n = kinds[kind];
    if (n > 0) parts.push(`${n} ${n === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many}`);
  }
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// pdfjs helpers
// ---------------------------------------------------------------------------

async function pdfjsReport(bytes) {
  const task = pdfjs.getDocument({
    data: bytes.slice(0),
    standardFontDataUrl: STANDARD_FONTS,
  });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const annots = await page.getAnnotations({ intent: "any" });
      const content = await page.getTextContent();
      pages.push({
        page: p,
        subtypes: annots.map((a) => a.subtype),
        text: content.items.map((i) => i.str ?? "").join("|"),
      });
    }
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
  return pages;
}

function annotCount(pdfLibDoc) {
  let n = 0;
  for (let i = 0; i < pdfLibDoc.getPageCount(); i++) {
    n += annotEntries(pdfLibDoc, i).length;
  }
  return n;
}

function pageHasAnnots(pdfLibDoc, index) {
  return pdfLibDoc.getPage(index).node.has(PDFName.of("Annots"));
}

// ---------------------------------------------------------------------------
// fixtures in a temp dir
// ---------------------------------------------------------------------------

const DIR = mkdtempSync(join(tmpdir(), "bc-annot-"));
const FILES = {};

function saveFixture(name, bytes) {
  const path = join(DIR, name);
  writeFileSync(path, bytes);
  FILES[name] = path;
  return path;
}

async function buildAnnotated() {
  const doc = await PDFDocument.create();
  doc.setProducer("bc-audit-fixture");
  doc.setCreator("bc-audit");
  doc.setCreationDate(new Date("2024-03-04T05:06:07Z"));
  doc.setModificationDate(new Date("2024-03-04T05:06:08Z"));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([A4_W, A4_H]);
  p1.drawText("Page one body text stays exactly the same.", {
    x: 60,
    y: 700,
    size: 12,
    font,
  });
  const p2 = doc.addPage([A4_W, A4_H]);
  p2.drawText("Page two body text stays exactly the same.", {
    x: 60,
    y: 700,
    size: 12,
    font,
  });

  const ctx = doc.context;
  const annots1 = [];
  const register = (dict) => {
    const ref = ctx.register(ctx.obj(dict));
    annots1.push(ref);
    return ref;
  };
  register({
    Type: "Annot",
    Subtype: "Link",
    Rect: [60, 640, 260, 660],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: "https://example.com/audit-link" },
  });
  const comment = register({
    Type: "Annot",
    Subtype: "Text",
    Rect: [300, 640, 324, 664],
    Name: "Comment",
    Contents: "AUDIT COMMENT PAYLOAD",
    T: "Reviewer",
  });
  register({
    Type: "Annot",
    Subtype: "Popup",
    Rect: [324, 600, 560, 664],
    Parent: comment,
    Contents: "AUDIT POPUP PAYLOAD",
  });
  register({
    Type: "Annot",
    Subtype: "Highlight",
    Rect: [60, 694, 300, 712],
    QuadPoints: [60, 712, 300, 712, 60, 694, 300, 694],
    C: [1, 1, 0],
    Contents: "AUDIT HIGHLIGHT PAYLOAD",
  });
  const p2annots = [
    ctx.register(
      ctx.obj({
        Type: "Annot",
        Subtype: "Stamp",
        Rect: [60, 500, 200, 560],
        Name: "Draft",
        Contents: "AUDIT STAMP PAYLOAD",
      }),
    ),
  ];
  p1.node.set(PDFName.of("Annots"), ctx.obj(annots1));
  p2.node.set(PDFName.of("Annots"), ctx.obj(p2annots));

  const form = doc.getForm();
  const field = form.createTextField("audit_notes");
  field.addToPage(p2, { x: 60, y: 400, width: 240, height: 24 });
  field.setText("AUDIT FIELD VALUE");
  return new Uint8Array(await doc.save({ updateFieldAppearances: true, useObjectStreams: false }));
}

async function buildOrphanPopup() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([A4_W, A4_H]);
  page.drawText("This page keeps its text after the comment is stripped.", {
    x: 50,
    y: 700,
    size: 12,
    font,
  });
  const ctx = doc.context;
  const popup = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Popup",
      Rect: [300, 600, 560, 660],
      Contents: "ORPHAN POPUP PAYLOAD",
    }),
  );
  // The comment points at the popup, but the popup is NOT listed in the page
  // /Annots array — exactly the shape Acrobat writes for many comments, and
  // the reason pruning the /Annots array alone is not enough.
  const comment = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [60, 640, 84, 664],
      Name: "Comment",
      Contents: "ORPHAN TEXT PAYLOAD",
      T: "Reviewer",
      Popup: popup,
    }),
  );
  page.node.set(PDFName.of("Annots"), ctx.obj([comment]));
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

async function buildClean() {
  const doc = await PDFDocument.create();
  doc.setProducer("bc-audit-clean");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([A4_W, A4_H]);
  page.drawText("Nothing annotated on this page at all.", {
    x: 50,
    y: 700,
    size: 12,
    font,
  });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

async function buildOddities() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([A4_W, A4_H]);
  p1.drawText("Odd annotation shapes live on this page.", {
    x: 50,
    y: 700,
    size: 12,
    font,
  });
  const ctx = doc.context;
  const shared = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Highlight",
      Rect: [50, 690, 300, 712],
      QuadPoints: [50, 712, 300, 712, 50, 690, 300, 690],
      Contents: "AUDIT SHARED PAYLOAD",
    }),
  );
  const weird = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "VendorSpecific",
      Rect: [320, 690, 340, 712],
      Contents: "AUDIT UNKNOWN PAYLOAD",
    }),
  );
  const direct = ctx.obj({
    Type: "Annot",
    Subtype: "Ink",
    Rect: [360, 690, 380, 712],
    Contents: "AUDIT DIRECT PAYLOAD",
  });
  p1.node.set(PDFName.of("Annots"), ctx.obj([shared, shared, weird, direct]));
  const p2 = doc.addPage([A4_W, A4_H]);
  p2.drawText("This page has no annotation array at all.", {
    x: 50,
    y: 700,
    size: 12,
    font,
  });
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

async function buildManyPages() {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 201; i++) doc.addPage([A4_W, A4_H]);
  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

const annotatedBytes = await buildAnnotated();
const orphanBytes = await buildOrphanPopup();
const cleanBytes = await buildClean();
const oddBytes = await buildOddities();
const manyBytes = await buildManyPages();
const lockedBytes = new Uint8Array(readFileSync(join(ROOT, "e2e/fixtures/encrypted.pdf")));
const junkBytes = new Uint8Array(Buffer.from("this is definitely not a pdf file, just text\nsecond line"));
const emptyBytes = new Uint8Array(0);

saveFixture("annotated.pdf", annotatedBytes);
saveFixture("orphan-popup.pdf", orphanBytes);
saveFixture("clean.pdf", cleanBytes);
saveFixture("oddities.pdf", oddBytes);
saveFixture("manypages.pdf", manyBytes);
saveFixture("locked.pdf", lockedBytes);
saveFixture("notapdf.pdf", junkBytes);
saveFixture("empty.pdf", emptyBytes);

const beforePdfjs = await pdfjsReport(annotatedBytes);
const beforeLib = await PDFDocument.load(annotatedBytes, LOAD_OPTS);
const beforeScan = scanDocument(beforeLib);

// ---------------------------------------------------------------------------
// 1. component source: caps, options, guards, a11y, honest copy
// ---------------------------------------------------------------------------

const mSize = COMPONENT.match(/const MAX_FILE_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+);/);
const mPages = COMPONENT.match(/const MAX_PAGES\s*=\s*(\d+);/);
check(
  "component MAX_FILE_BYTES is 100 MiB",
  !!mSize && +mSize[1] * +mSize[2] * +mSize[3] === MAX_FILE_BYTES,
  COMPONENT.match(/const MAX_FILE_BYTES[^;]*;/)?.[0] ?? "not found",
);
check("component MAX_PAGES is 200", !!mPages && +mPages[1] === MAX_PAGES, mPages?.[0] ?? "");
check(
  "component saves with useObjectStreams: false",
  /SAVE_OPTS\s*=\s*\{[^}]*useObjectStreams:\s*false/s.test(COMPONENT),
);
check(
  "component saves with updateFieldAppearances: false and addDefaultPage: false",
  /updateFieldAppearances:\s*false/.test(COMPONENT) && /addDefaultPage:\s*false/.test(COMPONENT),
);
check(
  "component loads with updateMetadata: false (metadata preserved)",
  /LOAD_OPTS\s*=\s*\{\s*updateMetadata:\s*false\s*\}/.test(COMPONENT),
);
check(
  "component never passes ignoreEncryption (encrypted files are steered, not mangled)",
  !COMPONENT.includes("ignoreEncryption"),
);
check(
  "component guards every await with a runId comparison",
  (COMPONENT.match(/run !== runIdRef\.current/g) ?? []).length >= 8,
  String((COMPONENT.match(/run !== runIdRef\.current/g) ?? []).length),
);
check("component root sets aria-busy", /aria-busy=\{busy\}/.test(COMPONENT));
check("component exposes an sr-only role=status live region", /className="sr-only" role="status"/.test(COMPONENT));
check("component renders errors in role=alert", /role="alert"/.test(COMPONENT));
check("component renders success in role=status", /role="status"[\s\S]{0,200}emerald/.test(COMPONENT));
check("component uses useId for label pairing", (COMPONENT.match(/useId\(\)/g) ?? []).length >= 2);
check("component opens files from a real <label htmlFor>", /<label[\s\S]{0,200}htmlFor=\{openId\}/.test(COMPONENT));
check("component groups the report in a fieldset/legend", /<fieldset[\s\S]{0,200}<legend/.test(COMPONENT));
check("component preflights the %PDF- magic bytes", /hasPdfHeader/.test(COMPONENT) && /0x25/.test(COMPONENT));
check(
  "component offers a real checkbox for keeping form fields",
  /type="checkbox"[\s\S]{0,200}keepFormFields/.test(COMPONENT),
);
check(
  "component links encrypted failures to PDF Unlock",
  /\/use\/pdf-unlock/.test(COMPONENT) && /\/Unlock\/i\.test\(error\)/.test(COMPONENT),
);
check(
  "component names the output <source>-no-annotations.pdf",
  /-no-annotations\.pdf/.test(COMPONENT) &&
    COMPONENT.includes("outputNameFor(name)") &&
    COMPONENT.includes("downloadBlob(out, filename)"),
);
check(
  "component copy discloses the form-field trade-off",
  COMPONENT_TEXT.includes("filled form field keeps its value only if that value was already drawn into the page"),
);
check(
  "component copy discloses the unreferenced-bytes residual",
  COMPONENT_TEXT.includes("unreferenced bytes") &&
    COMPONENT_TEXT.includes("a little unreferenced data can survive in the bytes"),
);
check(
  "component does not claim a perfect scrub",
  !/dropped from the file, not merely hidden/.test(COMPONENT_TEXT),
);
check(
  "component copy admits there is no undo",
  COMPONENT_TEXT.includes("no undo after the download"),
);
check(
  "component copy claims page content is preserved exactly",
  COMPONENT_TEXT.includes("text, images and layout are preserved exactly as they were"),
);
check(
  "component copy promises nothing is uploaded",
  COMPONENT_TEXT.includes("nothing is uploaded"),
);
check(
  "component copy discloses that changing annotations invalidates a digital signature",
  COMPONENT_TEXT.includes("invalidates a digital signature"),
);
check(
  "component copy discloses what the count actually counts",
  COMPONENT_TEXT.includes("annotation objects sitting in the pages") &&
    COMPONENT_TEXT.includes("is not included in that number"),
);
check(
  "component copy discloses that a comment's popup is not counted separately",
  COMPONENT_TEXT.includes("popup is not counted separately"),
);
check(
  "component copy explains why the caps exist (the file lives in tab memory)",
  COMPONENT_TEXT.includes("held in this tab") && COMPONENT_TEXT.includes("caps are there for"),
);
check(
  "component copy explains the markup-display settings consequence",
  COMPONENT_TEXT.includes("show comments") && COMPONENT_TEXT.includes("print markup"),
);
check(
  "the component wires a focus ring from the hidden input to the opener label",
  /className="sr-only peer"/.test(COMPONENT) && /peer-focus-visible:outline-indigo-600/.test(COMPONENT),
);
check(
  "the component no longer relies on focus-visible on the label itself (labels never take focus)",
  !/<label[\s\S]{0,400}focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600/.test(COMPONENT),
);
check(
  "the file input is disabled while a run is in flight, so Tab cannot reopen the picker",
  /<input[\s\S]{0,400}type="file"[\s\S]{0,400}disabled=\{busy\}/.test(COMPONENT),
);
check(
  "the component distinguishes an empty file from a wrong file type",
  COMPONENT.includes("That file is empty. Choose a PDF that has at least one page."),
);
check(
  "the owned walk never follows structural back-references",
  COMPONENT.includes("const OWNED_KEYS = [") &&
    !/OWNED_KEYS = \[[^\]]*"Parent"/.test(COMPONENT) &&
    !/OWNED_KEYS = \[[^\]]*"AF"/.test(COMPONENT) &&
    !/OWNED_KEYS = \[[^\]]*"StructParent"/.test(COMPONENT),
);
check(
  "the owned walk covers the keys a comment actually owns",
  ["IRT", "OC", "Popup", "QuadPoints", "R", "Vertices", "InkList"].every((k) =>
    COMPONENT.includes(`"${k}"`),
  ),
);
check(
  "the owned walk also collects /AP appearance streams",
  COMPONENT.includes('PDFName.of("AP")') && COMPONENT.includes("APPEARANCE_STATES"),
);
check(
  "the doomed list is deduplicated before deletion (a cyclic /IRT must not double-count)",
  COMPONENT.includes("doomedSeen") && COMPONENT.includes("if (doomedSeen.has(key)) continue;"),
);

// ---------------------------------------------------------------------------
// 2. pure mirrors
// ---------------------------------------------------------------------------

check("classify maps /Widget to the widget bucket", classify("Widget") === "widget");
check("classify maps /Link to the link bucket", classify("Link") === "link");
check("classify maps /Stamp to the stamp bucket", classify("Stamp") === "stamp");
check("classify maps a comment to the markup bucket", classify("Text") === "markup");
check("classify maps a highlight to the markup bucket", classify("Highlight") === "markup");
check("classify maps a popup to the markup bucket", classify("Popup") === "markup");
check("classify maps an unknown subtype to other", classify("VendorSpecific") === "other");
check("classify maps a missing subtype to other", classify("Unknown") === "other");
check(
  "every markup subtype in the mirror is also in the component",
  [...MARKUP_SUBTYPES].every((s) => COMPONENT.includes(`"${s}"`)),
);
check(
  "component and mirror agree on the five annotation buckets",
  Object.keys(KIND_LABEL).every((k) => COMPONENT.includes(`${k}:`)),
);

check("hasPdfHeader accepts a %PDF- header at offset 0", hasPdfHeader(annotatedBytes));
check(
  "hasPdfHeader accepts a %PDF- header inside the 1 KB prologue window",
  hasPdfHeader(new Uint8Array(Buffer.concat([Buffer.alloc(200, 0x20), Buffer.from("%PDF-1.7")]))),
);
check(
  "hasPdfHeader rejects a header beyond the 1 KB window",
  !hasPdfHeader(new Uint8Array(Buffer.concat([Buffer.alloc(2000, 0x20), Buffer.from("%PDF-1.7")]))),
);
check("hasPdfHeader rejects plain text", !hasPdfHeader(junkBytes));
check("hasPdfHeader rejects an empty file", !hasPdfHeader(emptyBytes));

check(
  "outputNameFor strips a lower-case extension",
  outputNameFor("contract.pdf") === "contract-no-annotations.pdf",
);
check(
  "outputNameFor strips an upper-case extension and keeps the stem",
  outputNameFor("Contract V1.PDF") === "Contract V1-no-annotations.pdf",
);
check("outputNameFor leaves a name with no extension alone", outputNameFor("scan") === "scan-no-annotations.pdf");
check(
  "outputNameFor strips directory separators from a path-like name",
  !outputNameFor("../../etc/passwd.pdf").includes("/") &&
    outputNameFor("../../etc/passwd.pdf") === "..-..-etc-passwd-no-annotations.pdf",
  outputNameFor("../../etc/passwd.pdf"),
);
check(
  "outputNameFor strips characters no filesystem accepts",
  outputNameFor('a:b*c?"d<e>|f.pdf') === "a-b-c--d-e--f-no-annotations.pdf",
  outputNameFor('a:b*c?"d<e>|f.pdf'),
);
check(
  "outputNameFor strips control characters from the stem",
  (() => {
    const dirty = "bad" + String.fromCharCode(0) + "name" + String.fromCharCode(1) + ".pdf";
    const out = outputNameFor(dirty);
    return out === "bad-name--no-annotations.pdf" && !/[\u0000-\u001f]/.test(out);
  })(),
  outputNameFor("bad\u0000name\u0001.pdf"),
);
check(
  "outputNameFor falls back to document when nothing usable is left",
  outputNameFor(".pdf") === "document-no-annotations.pdf" &&
    outputNameFor("   .pdf") === "document-no-annotations.pdf",
);
check(
  "the component carries the same sanitizer as the mirror",
  COMPONENT.includes("function outputNameFor(source: string)") &&
    COMPONENT.includes(`replace(/[${BS}${BS}/:*?"<>|${BS}u0000-${BS}u001f]/g, "-"`) &&
    COMPONENT.includes('base || "document"'),
);

check("plural switches on exactly one", plural(1, "page", "pages") === "page" && plural(0, "page", "pages") === "pages");
check("sizeLabel reports bytes, KB and MB", sizeLabel(512) === "512 B" && sizeLabel(2048) === "2 KB" && sizeLabel(5 * 1024 * 1024) === "5.0 MB");

check(
  "describeKinds lists only non-zero buckets in a stable order",
  describeKinds({ ...emptyCounts(), markup: 3, link: 1, widget: 1 }) ===
    "3 comments, highlights and notes, 1 link, 1 form field",
);
check(
  "REGRESSION GUARD: a single annotation in a bucket reads in the singular",
  describeKinds({ ...emptyCounts(), markup: 1, stamp: 2, other: 1 }) ===
    "1 comment, highlight or note, 2 stamps, 1 other annotation",
  describeKinds({ ...emptyCounts(), markup: 1, stamp: 2, other: 1 }),
);
check(
  "the component and mirror carry the same singular/plural wording",
  ["comment, highlight or note", "comments, highlights and notes", "other annotation", "other annotations"].every(
    (w) => COMPONENT.includes(w),
  ),
);
check("describeKinds is empty for a file with no annotations", describeKinds(emptyCounts()) === "");

check(
  "oversized-file message passes through verbatim",
  toUiError(userFacing("This file is 100.4 MB — files up to 100 MB are supported.")) ===
    "This file is 100.4 MB — files up to 100 MB are supported.",
);
check(
  "over-page message passes through verbatim",
  toUiError(userFacing("This PDF has 201 pages — files up to 200 pages are supported. Use PDF Split first.")) ===
    "This PDF has 201 pages — files up to 200 pages are supported. Use PDF Split first.",
);
check(
  "the component states the same page-cap message",
  COMPONENT.includes("`This PDF has ${pages} pages — files up to 200 pages are supported. Use PDF Split first.`"),
);
check(
  "the component states the same size-cap message",
  COMPONENT.includes("files up to 100 MB are supported."),
);

// ---------------------------------------------------------------------------
// 3. the fixture really carries the annotation mix we claim to strip
// ---------------------------------------------------------------------------

check("the annotated fixture is 2 pages", beforeLib.getPageCount() === 2);
check("the annotated fixture holds 6 annotations per pdf-lib", annotCount(beforeLib) === 6);
check("pdfjs also reports 6 annotations", beforePdfjs.reduce((n, p) => n + p.subtypes.length, 0) === 6);
check(
  "pdfjs sees the mix the tool claims: Link, Text, Popup, Highlight, Stamp, Widget",
  beforePdfjs[0].subtypes.join(",") === "Link,Text,Highlight,Popup" &&
    beforePdfjs[1].subtypes.join(",") === "Stamp,Widget",
  JSON.stringify(beforePdfjs.map((p) => p.subtypes)),
);
check(
  "the scan counts 3 markup, 1 link, 1 stamp, 1 widget",
  beforeScan.total === 6 &&
    beforeScan.kinds.markup === 3 &&
    beforeScan.kinds.link === 1 &&
    beforeScan.kinds.stamp === 1 &&
    beforeScan.kinds.widget === 1 &&
    beforeScan.kinds.other === 0,
  JSON.stringify(beforeScan.kinds),
);
check(
  "per-page counts match the fixture layout",
  beforeScan.pages.map((p) => p.total).join(",") === "4,2",
);
check(
  "the scan announces progress once per page",
  (() => {
    const seen = [];
    scanDocument(beforeLib, (page, total) => seen.push(`${page}/${total}`));
    return seen.join(" ") === "1/2 2/2";
  })(),
);
check(
  "the annotated fixture has a filled text form field",
  (() => {
    const form = beforeLib.getForm();
    return form.getFields().length === 1 && form.getTextField("audit_notes").getText() === "AUDIT FIELD VALUE";
  })(),
);
check("the fixture's AcroForm is present before removal", beforeLib.catalog.has(PDFName.of("AcroForm")));
// pdf-lib encodes a JS string as a name (/A#20B) when it can and as a UTF-16BE hex
// string (<FEFF0041...>) otherwise, so probe both forms using pdf-lib's own writer.
const ENCODER = (await PDFDocument.create()).context;
const encodingsOf = (text) => [String(ENCODER.obj(text)), String(lib.PDFHexString.fromText(text))];
const presentIn = (raw, text) => encodingsOf(text).some((e) => raw.includes(e));
const absentFrom = (raw, text) => !presentIn(raw, text);
const rawAnnotated = Buffer.from(annotatedBytes).toString("latin1");
check(
  "the source file really stores the comment text (as UTF-16BE hex)",
  presentIn(rawAnnotated, "AUDIT COMMENT PAYLOAD"),
);
check(
  "the source file really stores the stamp, popup and highlight payloads too",
  presentIn(rawAnnotated, "AUDIT STAMP PAYLOAD") &&
    presentIn(rawAnnotated, "AUDIT POPUP PAYLOAD") &&
    presentIn(rawAnnotated, "AUDIT HIGHLIGHT PAYLOAD"),
);
check(
  "the source file really stores the filled field value",
  presentIn(rawAnnotated, "AUDIT FIELD VALUE"),
);

// ---------------------------------------------------------------------------
// 4. default removal: annotations gone, content identical
// ---------------------------------------------------------------------------

const stripDoc = await PDFDocument.load(annotatedBytes, LOAD_OPTS);
const stripResult = await stripAnnotations(stripDoc, false);
const stripped = new Uint8Array(await stripDoc.save(SAVE_OPTS));
saveFixture("stripped.pdf", stripped);
const stripReloaded = await PDFDocument.load(stripped, LOAD_OPTS);
const stripPdfjs = await pdfjsReport(stripped);
const stripRaw = Buffer.from(stripped).toString("latin1");

check("the default pass reports 6 removed annotations", stripResult.removed === 6, JSON.stringify(stripResult));
check("the default pass keeps no widgets", stripResult.keptWidgets === 0);
check(
  "every page loses its /Annots entry entirely",
  !pageHasAnnots(stripReloaded, 0) && !pageHasAnnots(stripReloaded, 1),
);
check("no annotation survives per pdf-lib", annotCount(stripReloaded) === 0);
check(
  "pdfjs reports zero annotation objects on every page",
  stripPdfjs.every((p) => p.subtypes.length === 0),
  JSON.stringify(stripPdfjs.map((p) => p.subtypes)),
);
check(
  "the extracted page text is identical before and after removal",
  stripPdfjs.every((p, i) => p.text === beforePdfjs[i].text) &&
    stripPdfjs[0].text.includes("Page one body text") &&
    stripPdfjs[1].text.includes("Page two body text"),
);
check("the page count is unchanged", stripReloaded.getPageCount() === 2);
check("the AcroForm entry is deleted", !stripReloaded.catalog.has(PDFName.of("AcroForm")));
check(
  "the annotation objects are pruned from the context, not just unreferenced",
  stripResult.pruned === stripResult.candidates && stripResult.candidates === 8,
  JSON.stringify(stripResult),
);
check(
  "the extra pruned object beyond the 7 annotations is the widget's /AP appearance stream",
  (() => {
    // 6 page annotations + 1 AcroForm field + 1 appearance stream that hung off
    // the removed widget and was only reachable from it.
    return stripResult.candidates - 7 === 1;
  })(),
  String(stripResult.candidates),
);
check(
  "comment, popup, highlight and stamp payloads are physically gone from the file",
  absentFrom(stripRaw, "AUDIT COMMENT PAYLOAD") &&
    absentFrom(stripRaw, "AUDIT POPUP PAYLOAD") &&
    absentFrom(stripRaw, "AUDIT HIGHLIGHT PAYLOAD") &&
    absentFrom(stripRaw, "AUDIT STAMP PAYLOAD"),
);
check(
  "no annotation subtype dict survives in the output bytes",
  !stripRaw.includes("/Subtype /Widget") &&
    !stripRaw.includes("/Subtype /Text") &&
    !stripRaw.includes("/Subtype /Link") &&
    !stripRaw.includes("/Subtype /Stamp") &&
    !stripRaw.includes("/Subtype /Highlight"),
);
check(
  "the filled field value is gone from the file too",
  absentFrom(stripRaw, "AUDIT FIELD VALUE") && !stripRaw.includes("/audit_notes"),
);
check("the output is a valid PDF that pdfjs still opens", stripPdfjs.length === 2);
check("the output is smaller than the annotated source", stripped.length < annotatedBytes.length, `${stripped.length} vs ${annotatedBytes.length}`);
check(
  "the output uses no object streams (stable, stream-free xref)",
  !stripRaw.includes("/ObjStm") && !stripRaw.includes("/XRef"),
);
const infoText = (doc, key) => {
  const v = doc.getInfoDict().get(PDFName.of(key));
  return typeof v?.decodeText === "function" ? v.decodeText() : String(v);
};
check(
  "the source Producer survives the round trip (updateMetadata: false)",
  infoText(stripReloaded, "Producer") === "bc-audit-fixture",
  infoText(stripReloaded, "Producer"),
);
check(
  "the source Creator survives the round trip",
  infoText(stripReloaded, "Creator") === "bc-audit",
  infoText(stripReloaded, "Creator"),
);
check(
  "the source CreationDate survives the round trip",
  infoText(stripReloaded, "CreationDate") === "D:20240304050607Z",
  infoText(stripReloaded, "CreationDate"),
);

// the user's own bytes are never rewritten by a run
{
  const sourcePath = FILES["annotated.pdf"];
  const onDiskBefore = readFileSync(sourcePath);
  const inputCopy = new Uint8Array(annotatedBytes);
  const doc = await PDFDocument.load(new Uint8Array(annotatedBytes), LOAD_OPTS);
  await stripAnnotations(doc, false);
  await doc.save(SAVE_OPTS);
  const inputUnchanged =
    inputCopy.length === annotatedBytes.length && inputCopy.every((b, i) => b === annotatedBytes[i]);
  const onDiskUnchanged = onDiskBefore.equals(readFileSync(sourcePath));
  check("a run never writes back to the bytes the user handed over", inputUnchanged);
  check("a run never rewrites the source file on disk", onDiskUnchanged);
}

// idempotence: a second pass finds nothing left to do
{
  const again = await PDFDocument.load(stripped, LOAD_OPTS);
  const second = await stripAnnotations(again, false);
  const out2 = new Uint8Array(await again.save(SAVE_OPTS));
  check("a second pass finds zero annotations", second.removed === 0);
  check("a second pass still produces a readable PDF", (await pdfjsReport(out2)).length === 2);
}

// ---------------------------------------------------------------------------
// 4b. a comment whose popup is not in the page /Annots array
// ---------------------------------------------------------------------------

const orphanRawSrc = Buffer.from(orphanBytes).toString("latin1");
{
  const orphanDoc = await PDFDocument.load(orphanBytes, LOAD_OPTS);
  const orphanScan = scanDocument(orphanDoc);
  const orphanRes = await stripAnnotations(orphanDoc, false);
  const orphanOut = new Uint8Array(await orphanDoc.save(SAVE_OPTS));
  saveFixture("orphan-stripped.pdf", orphanOut);
  const orphanReload = await PDFDocument.load(orphanOut, LOAD_OPTS);
  const orphanPdfjs = await pdfjsReport(orphanOut);
  const orphanRaw = Buffer.from(orphanOut).toString("latin1");
  const orphanBefore = await pdfjsReport(orphanBytes);

  check("the orphan-popup fixture really stores both payloads", presentIn(orphanRawSrc, "ORPHAN TEXT PAYLOAD") && presentIn(orphanRawSrc, "ORPHAN POPUP PAYLOAD"));
  check("the orphan-popup fixture holds 1 annotation in its /Annots array", orphanScan.total === 1 && orphanScan.kinds.markup === 1, JSON.stringify(orphanScan.kinds));
  check("the removal pass reports 1 removed annotation", orphanRes.removed === 1, JSON.stringify(orphanRes));
  check(
    "the /Popup child is queued for pruning alongside the comment",
    orphanRes.candidates === 2 && orphanRes.pruned === 2,
    JSON.stringify(orphanRes),
  );
  check("the stripped orphan file has no annotation objects left", annotCount(orphanReload) === 0 && orphanPdfjs.every((p) => p.subtypes.length === 0));
  check(
    "the comment payload is physically gone from the orphan file",
    absentFrom(orphanRaw, "ORPHAN TEXT PAYLOAD"),
  );
  check(
    "REGRESSION GUARD: the unlisted popup payload is gone too, not left in the bytes",
    absentFrom(orphanRaw, "ORPHAN POPUP PAYLOAD"),
    "the /Popup object survived removal — a reader may not show it, but the text is still in the file",
  );
  check("the orphan fixture's page text is untouched", orphanPdfjs[0].text === orphanBefore[0].text && orphanPdfjs[0].text.includes("keeps its text"));
  check("no /Subtype /Popup dict survives in the orphan output", !orphanRaw.includes("/Subtype /Popup") && !orphanRaw.includes("/Subtype /Text"));
}

// a self-referential /IRT reply thread must not hang the owned walk
{
  const d = await PDFDocument.create();
  const p = d.addPage([A4_W, A4_H]);
  const ctx = d.context;
  const annot = ctx.obj({ Type: "Annot", Subtype: "Text", Rect: [10, 10, 30, 30], Contents: "THREAD PAYLOAD" });
  const ref = ctx.register(annot);
  annot.set(PDFName.of("IRT"), ref);
  annot.set(PDFName.of("R"), ref);
  p.node.set(PDFName.of("Annots"), ctx.obj([ref]));
  const bytes = new Uint8Array(await d.save({ useObjectStreams: false }));
  const d2 = await PDFDocument.load(bytes, LOAD_OPTS);
  let cycle = null;
  try {
    cycle = await stripAnnotations(d2, false);
  } catch (err) {
    cycle = { error: String(err) };
  }
  const out = new Uint8Array(await d2.save(SAVE_OPTS));
  const raw = Buffer.from(out).toString("latin1");
  check("a self-referential /IRT reply thread does not hang the owned walk", !!cycle && !cycle.error, JSON.stringify(cycle));
  check("a cyclic reply thread is still removed exactly once", !!cycle && cycle.removed === 1 && cycle.candidates === 1, JSON.stringify(cycle));
  check("a cyclic reply thread's payload is gone from the output", absentFrom(raw, "THREAD PAYLOAD"));
}

// the owned walk must not sweep up shared, still-live structure
{
  const d = await PDFDocument.create();
  const font = await d.embedFont(StandardFonts.Helvetica);
  const p = d.addPage([A4_W, A4_H]);
  p.drawText("Live page content must not be collected as a candidate.", { x: 50, y: 700, size: 12, font });
  const ctx = d.context;
  const annot = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Text", Rect: [60, 640, 84, 664], Contents: "KEEP THE PAGE" }));
  p.node.set(PDFName.of("Annots"), ctx.obj([annot]));
  const bytes = new Uint8Array(await d.save({ useObjectStreams: false }));
  const d2 = await PDFDocument.load(bytes, LOAD_OPTS);
  const res = await stripAnnotations(d2, false);
  const out = new Uint8Array(await d2.save(SAVE_OPTS));
  const reload = await PDFDocument.load(out, LOAD_OPTS);
  check(
    "the owned walk never queues the page tree or the font",
    res.candidates === 1,
    JSON.stringify(res),
  );
  check("the page and its content stream survive the strip", reload.getPageCount() === 1);
  const pj = await pdfjsReport(out);
  check("the page text is still readable after the strip", pj[0].text.includes("Live page content"), pj[0].text);
}

// ---------------------------------------------------------------------------
// 5. keep-form-fields mode
// ---------------------------------------------------------------------------

const keepDoc = await PDFDocument.load(annotatedBytes, LOAD_OPTS);
const keepResult = await stripAnnotations(keepDoc, true);
const kept = new Uint8Array(await keepDoc.save(SAVE_OPTS));
saveFixture("kept-fields.pdf", kept);
const keepReloaded = await PDFDocument.load(kept, LOAD_OPTS);
const keepPdfjs = await pdfjsReport(kept);
const keepRaw = Buffer.from(kept).toString("latin1");

check("keep-form-fields removes the 5 markup/link/stamp annotations", keepResult.removed === 5, JSON.stringify(keepResult));
check("keep-form-fields keeps exactly 1 widget", keepResult.keptWidgets === 1);
check("the page /Annots array survives when widgets are kept", pageHasAnnots(keepReloaded, 0) || pageHasAnnots(keepReloaded, 1));
check("page 1 ends up with no /Annots at all", !pageHasAnnots(keepReloaded, 0));
check(
  "pdfjs sees only the widget left",
  keepPdfjs[0].subtypes.length === 0 && keepPdfjs[1].subtypes.join(",") === "Widget",
  JSON.stringify(keepPdfjs.map((p) => p.subtypes)),
);
check("the form is still fillable after keep-form-fields", keepReloaded.getForm().getTextField("audit_notes").getText() === "AUDIT FIELD VALUE");
check("the AcroForm entry survives when widgets are kept", keepReloaded.catalog.has(PDFName.of("AcroForm")));
check(
  "the markup payloads are still physically gone in keep mode",
  absentFrom(keepRaw, "AUDIT COMMENT PAYLOAD") && absentFrom(keepRaw, "AUDIT STAMP PAYLOAD"),
);
check("the kept widget's value survives in keep mode", presentIn(keepRaw, "AUDIT FIELD VALUE"));
check("the widget dict survives in keep mode", keepRaw.includes("/Subtype /Widget"));
check("the text layer is still identical in keep mode", keepPdfjs.every((p, i) => p.text === beforePdfjs[i].text));

// keep-form-fields on a file with no widgets still clears the AcroForm
{
  const formOnly = await (async () => {
    const d = await PDFDocument.create();
    const p = d.addPage([A4_W, A4_H]);
    const f = d.getForm();
    const fld = f.createTextField("only_field");
    fld.addToPage(p, { x: 40, y: 40, width: 200, height: 20 });
    fld.setText("ONLY");
    return new Uint8Array(await d.save({ useObjectStreams: false }));
  })();
  const d2 = await PDFDocument.load(formOnly, LOAD_OPTS);
  const r2 = await stripAnnotations(d2, true);
  const out = new Uint8Array(await d2.save(SAVE_OPTS));
  const re = await PDFDocument.load(out, LOAD_OPTS);
  const pj = await pdfjsReport(out);
  check("keep mode on a widget-only file keeps the widget and removes nothing", r2.removed === 0 && r2.keptWidgets === 1);
  check("keep mode on a widget-only file keeps the AcroForm", re.catalog.has(PDFName.of("AcroForm")));
  check("keep mode on a widget-only file still leaves exactly one annotation", pj.every((p) => p.subtypes.length === 0) || pj[0].subtypes.join(",") === "Widget", JSON.stringify(pj.map((x) => x.subtypes)));
  check("the widget-only file therefore has nothing removable to offer", removableCountFor(1, 1, true) === 0);
  check("unchecking the box makes the same file fully removable", removableCountFor(1, 1, false) === 1);
}

// ---------------------------------------------------------------------------
// 6. odd annotation shapes
// ---------------------------------------------------------------------------

{
  const oddDoc = await PDFDocument.load(oddBytes, LOAD_OPTS);
  const oddScan = scanDocument(oddDoc);
  const oddRes = await stripAnnotations(oddDoc, false);
  const oddOut = new Uint8Array(await oddDoc.save(SAVE_OPTS));
  const oddReload = await PDFDocument.load(oddOut, LOAD_OPTS);
  const oddPdfjs = await pdfjsReport(oddOut);
  const oddRaw = Buffer.from(oddOut).toString("latin1");
  check(
    "a duplicated /Annots entry counts twice and Ink counts as markup",
    oddScan.total === 4 && oddScan.kinds.markup === 3 && oddScan.kinds.other === 1,
    JSON.stringify(oddScan.kinds),
  );
  check("an unknown subtype is counted in the other bucket", oddScan.kinds.other === 1);
  check("removal reports 4 removals for the odd fixture", oddRes.removed === 4, JSON.stringify(oddRes));
  check(
    "duplicate refs are pruned once and direct dicts are never candidates",
    oddRes.candidates === 2 && oddRes.pruned === 2,
    JSON.stringify(oddRes),
  );
  check("the odd fixture ends with zero annotations", annotCount(oddReload) === 0 && oddPdfjs.every((p) => p.subtypes.length === 0));
  check("a direct (non-reference) annotation dict is removed without crashing", !oddRaw.includes("AUDIT DIRECT PAYLOAD"));
  check("the unknown-subtype payload is dropped too", !oddRaw.includes("AUDIT UNKNOWN PAYLOAD"));
  check("a page with no /Annots does not gain an empty array", !pageHasAnnots(oddReload, 1));
  check(
    "the odd fixture keeps its text on both pages",
    oddPdfjs[0].text.includes("Odd annotation shapes") && oddPdfjs[1].text.includes("no annotation array"),
    JSON.stringify(oddPdfjs.map((p) => p.text)),
  );
  check(
    "the odd fixture's second page keeps its own text",
    oddPdfjs[1].text.includes("no annotation array"),
    oddPdfjs[1].text,
  );
}

// ---------------------------------------------------------------------------
// 7. a clean file is a no-op
// ---------------------------------------------------------------------------

{
  const cleanDoc = await PDFDocument.load(cleanBytes, LOAD_OPTS);
  const cleanScan = scanDocument(cleanDoc);
  const cleanRes = await stripAnnotations(cleanDoc, false);
  const cleanOut = new Uint8Array(await cleanDoc.save(SAVE_OPTS));
  const cleanBefore = await pdfjsReport(cleanBytes);
  const cleanAfter = await pdfjsReport(cleanOut);
  check("a clean file reports 0 annotations", cleanScan.total === 0);
  check("describeKinds has nothing to say about a clean file", describeKinds(cleanScan.kinds) === "");
  check("a clean file is not modified by the strip pass", cleanRes.removed === 0 && cleanRes.pruned === 0);
  check("the clean file's text is preserved", cleanAfter[0].text === cleanBefore[0].text);
  check("the clean file stays a single page", cleanAfter.length === 1);
}

// ---------------------------------------------------------------------------
// 8. error mapping against real fixtures
// ---------------------------------------------------------------------------

{
  let lockedErr;
  try {
    await PDFDocument.load(lockedBytes, LOAD_OPTS);
  } catch (err) {
    lockedErr = err;
  }
  check("the encrypted fixture is rejected by pdf-lib without ignoreEncryption", !!lockedErr);
  check(
    "the encrypted fixture steers to PDF Unlock",
    !!lockedErr && toUiError(lockedErr) === "This PDF is password-protected. Remove the password with PDF Unlock, then strip its annotations.",
    lockedErr ? String(lockedErr.message) : "no error",
  );
  check("the unlock steer trips the Unlock-link test in the UI", /Unlock/i.test(toUiError(lockedErr ?? new Error("x"))));

  let junkErr;
  try {
    await PDFDocument.load(junkBytes, LOAD_OPTS);
  } catch (err) {
    junkErr = err;
  }
  check("the text-file fixture is rejected by pdf-lib", !!junkErr);
  check(
    "junk maps to the invalid-PDF steer",
    !!junkErr && toUiError(junkErr) === "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.",
  );
  check("the magic-byte preflight catches junk before pdf-lib sees it", !hasPdfHeader(junkBytes));

  let emptyErr;
  try {
    await PDFDocument.load(emptyBytes, LOAD_OPTS);
  } catch (err) {
    emptyErr = err;
  }
  check("an empty file is rejected", !!emptyErr && toUiError(emptyErr).includes("doesn't look like a valid PDF"));
  check("an empty file fails the preflight too", !hasPdfHeader(emptyBytes));
  check(
    "an unmapped failure falls back to a friendly default",
    friendlyError(new Error("something totally unrelated")) === "Could not read that PDF. It may be corrupt or unsupported.",
  );

  const manyDoc = await PDFDocument.load(manyBytes, LOAD_OPTS);
  check("the 201-page fixture really has 201 pages", manyDoc.getPageCount() === 201);
  check("201 pages is over the 200-page cap", manyDoc.getPageCount() > MAX_PAGES);
  check("100 MiB + 1 byte is over the file cap", MAX_FILE_BYTES + 1 > MAX_FILE_BYTES);
  check("sizeLabel renders the over-cap message the UI would show", sizeLabel(100 * 1024 * 1024 + 420 * 1024) === "100.4 MB");
}

// ---------------------------------------------------------------------------
// 9. scan/UI consistency
// ---------------------------------------------------------------------------

check("the UI caps its per-page chips at 24", /MAX_PAGE_CHIPS = 24/.test(COMPONENT) && MAX_PAGE_CHIPS === 24);
check(
  "the component reports the real removal count from the strip result",
  /result\.removed !== willRemove/.test(COMPONENT),
);
check(
  "the component refuses to hand over a file whose removal count disagrees with the scan",
  COMPONENT.includes("The file was not changed"),
);
check(
  "a 200-page file with annotations on every page still lists a bounded chip row",
  (() => {
    const many = [];
    for (let i = 0; i < 200; i++) many.push({ page: i + 1, total: 1 });
    const annotated = many.filter((p) => p.total > 0);
    return annotated.slice(0, MAX_PAGE_CHIPS).length === 24 && annotated.length - 24 === 176;
  })(),
);
check(
  "the confirm button states the exact count it will remove",
  /Remove \$\{removableCount\} \$\{plural\(removableCount, "annotation", "annotations"\)\} → download/.test(
    COMPONENT_TEXT,
  ),
);
check(
  "the button refuses to offer a download when keeping fields removes nothing",
  /removableCount === 0\s*\?\s*"Nothing left to remove"/.test(COMPONENT_TEXT) &&
    /removableCount > 0 && !busy/.test(COMPONENT),
);
check(
  "the UI explains the nothing-left-to-remove state",
  /Every annotation in this file is a form field/.test(COMPONENT_TEXT),
);
check("the remove button is disabled when nothing was found", /disabled=\{!canRemove\}/.test(COMPONENT));
check("the component offers a Start over reset", /onClick=\{resetState\}/.test(COMPONENT));

// ---------------------------------------------------------------------------
// 9b. this round: progressive strip, honest prune reporting, result panel
// ---------------------------------------------------------------------------

check(
  "the component repaints progress every PAINT_EVERY pages",
  /const PAINT_EVERY = 10;/.test(COMPONENT) && PAINT_EVERY === 10,
);
check(
  "the component waits on that progress callback instead of ignoring it",
  /await onProgress\?\.\(\{ phase: "pages", page: done, total: pageTotal \}\)/.test(COMPONENT),
);
check(
  "progress is reported on the first page, every batch, and the last page",
  /const done = i \+ 1;/.test(COMPONENT) &&
    /done === 1 \|\| done % PAINT_EVERY === 0 \|\| done === pageTotal/.test(COMPONENT),
);
check("the strip pass is async and the component awaits it", /const result = await stripAnnotations\(/.test(COMPONENT));
check(
  "the busy line names all three real phases",
  COMPONENT_TEXT.includes("Removing annotations — page") &&
    COMPONENT_TEXT.includes("Pruning orphaned annotation data…") &&
    COMPONENT_TEXT.includes("Writing the new file…"),
);
check(
  "a failed reachability walk is recorded, not swallowed as a no-op",
  /pruneFailed = true;/.test(COMPONENT) && /pruneFailed: boolean/.test(COMPONENT),
);
check(
  "an unknown prune outcome is disclosed exactly like a partial prune",
  /result\.pruneFailed \|\| result\.pruned < result\.candidates/.test(COMPONENT_TEXT),
);
check(
  "the success panel keeps the output bytes and offers the same file again",
  /setResult\(\{/.test(COMPONENT) &&
    /bytes: out,/.test(COMPONENT) &&
    /Download \{result\.name\} again/.test(COMPONENT_TEXT) &&
    COMPONENT.includes("downloadBlob(result.bytes, result.name)"),
);
check(
  "the success panel is announced, headed and itemised",
  /Clean copy ready/.test(COMPONENT_TEXT) &&
    /Found \/ removed/.test(COMPONENT) &&
    /vs\. original/.test(COMPONENT) &&
    /Form fields kept/.test(COMPONENT),
);
check(
  "the success panel says what was pruned, and hedges when it cannot prove it",
  COMPONENT_TEXT.includes("were pruned from the file, not just unlinked") &&
    COMPONENT_TEXT.includes("unreferenced bytes that no reader will show"),
);
check(
  "a stale result is dropped when the keep-fields setting changes",
  /onChange=\{\(e\) => \{[\s\S]{0,320}setKeepFormFields\(e\.target\.checked\);[\s\S]{0,120}setResult\(null\);/.test(
    COMPONENT,
  ),
);
check(
  "a stale result is dropped when a new file loads and on Start over",
  (COMPONENT.match(/setResult\(null\);/g) ?? []).length >= 4,
  String((COMPONENT.match(/setResult\(null\);/g) ?? []).length),
);
check(
  "the source bytes live in a ref rather than in React state",
  COMPONENT.includes("const bytesRef = useRef<Uint8Array | null>(null);") &&
    !/useState<Uint8Array/.test(COMPONENT),
);
check(
  "the component opens no network channel of any kind",
  !/\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource|import\(["']https?:/.test(COMPONENT),
);
check(
  "the download stem is capped and never ends in a dot or space",
  COMPONENT.includes("const MAX_STEM = 96;") &&
    COMPONENT.includes(".slice(0, MAX_STEM)") &&
    COMPONENT.includes('replace(/[. ]+$/, "")'),
);
check(
  "the copy discloses the XFA / AcroForm consequence",
  COMPONENT_TEXT.includes("XFA / JavaScript form") && COMPONENT_TEXT.includes("AcroForm"),
);
check(
  "the copy says this is not a redaction tool and points at the right one",
  COMPONENT_TEXT.includes("This tool is also not a redaction tool") &&
    COMPONENT_TEXT.includes("use PDF Redact for that"),
);
check(
  "the component reports the change in size against the original",
  /sizeDelta\(bytes\.length, out\.length\)/.test(COMPONENT) &&
    /sizeDelta\(result\.sourceSize, result\.bytes\.length\)/.test(COMPONENT),
);
check(
  "the file status line shows the loaded size next to the page count",
  /\$\{pageCount\} \$\{plural\(pageCount, "page", "pages"\)\}, \$\{sizeLabel\(sourceSize\)\}/.test(
    COMPONENT,
  ),
);

// sizeDelta mirror
check("sizeDelta reports a negative change with a minus sign", sizeDelta(1000, 600) === "-40%");
check("sizeDelta reports a positive change with a plus sign", sizeDelta(1000, 1250) === "+25%");
check("sizeDelta reports no change as 0%", sizeDelta(1000, 1000) === "0%");
check("sizeDelta never divides by zero", sizeDelta(0, 10) === "—");
check("the component and mirror agree on the stem cap", MAX_STEM === 96);

// the progress cadence, over a real multi-page document at the page cap
{
  const capDoc = await PDFDocument.create();
  const capCtx = capDoc.context;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = capDoc.addPage([A4_W, A4_H]);
    page.node.set(
      PDFName.of("Annots"),
      capCtx.obj([
        capCtx.register(
          capCtx.obj({
            Type: "Annot",
            Subtype: "Highlight",
            Rect: [40, 40, 120, 60],
            QuadPoints: [40, 60, 120, 60, 40, 40, 120, 40],
            Contents: "CAP PAGE PAYLOAD",
          }),
        ),
      ]),
    );
  }
  const capBytes = new Uint8Array(await capDoc.save({ useObjectStreams: false }));
  saveFixture("capped.pdf", capBytes);
  const capLoad = await PDFDocument.load(capBytes, LOAD_OPTS);
  const capScan = scanDocument(capLoad);
  const events = [];
  const capResult = await stripAnnotations(capLoad, false, (info) => {
    events.push(`${info.phase}:${info.page}`);
  });
  const capOut = new Uint8Array(await capLoad.save(SAVE_OPTS));
  saveFixture("capped-stripped.pdf", capOut);
  const capPdfjs = await pdfjsReport(capOut);
  check("a 200-page capped fixture is scanned as 200 annotations", capScan.total === MAX_PAGES, String(capScan.total));
  check("a 200-page capped fixture removes all 200 annotations", capResult.removed === MAX_PAGES, String(capResult.removed));
  check(
    "progress is announced for page 1, every 10th page, the last page, then the prune phase",
    events.join(" ") === `pages:1 ${Array.from({ length: 19 }, (_, i) => `pages:${(i + 1) * 10}`).join(" ")} pages:200 prune:0`,
    events.slice(0, 4).join(" ") + ` … (${events.length} events)`,
  );
  check(
    "a capped run still ends with a clean document",
    capPdfjs.length === MAX_PAGES && capPdfjs.every((p) => p.subtypes.length === 0),
  );
  check(
    "every per-page highlight payload is gone from a capped run",
    !Buffer.from(capOut).toString("latin1").includes("CAP PAGE PAYLOAD"),
  );
}

// a prune-phase failure must be reported, not silently downgraded to "clean"
{
  const failDoc = await PDFDocument.load(annotatedBytes, LOAD_OPTS);
  const failRes = await stripAnnotations(failDoc, false, (info) => {
    if (info.phase === "prune") throw new Error("simulated reachability failure");
  });
  check(
    "a prune-phase failure sets pruneFailed while the removal itself is still counted",
    failRes.pruneFailed === true && failRes.removed === 6,
    JSON.stringify(failRes),
  );
  check(
    "a failed prune reports no candidates, so only the pruneFailed flag can drive the disclosure",
    failRes.candidates === 0 && failRes.pruned === 0,
    JSON.stringify(failRes),
  );
}

// outputNameFor hardening, mirror and component parity
check(
  "a very long stem is capped so the -no-annotations.pdf suffix always survives",
  outputNameFor(`${"a".repeat(200)}.pdf`) === `${"a".repeat(MAX_STEM)}-no-annotations.pdf`,
  outputNameFor(`${"a".repeat(200)}.pdf`).slice(-30),
);
check(
  "a truncated stem never ends in a dot or a space",
  (() => {
    const suffix = "-no-annotations.pdf";
    const out = outputNameFor(`${"b".repeat(95)}...${"c".repeat(40)}.pdf`);
    const stem = out.slice(0, out.length - suffix.length);
    return out.endsWith(suffix) && stem === "b".repeat(MAX_STEM - 1) && !/[. ]$/.test(stem);
  })(),
  outputNameFor(`${"b".repeat(95)}...${"c".repeat(40)}.pdf`).slice(-40),
);
check(
  "a trailing-dot stem keeps a usable name",
  outputNameFor("report..pdf") === "report-no-annotations.pdf",
  outputNameFor("report..pdf"),
);
check("the mirror keeps its name for the ordinary cases", outputNameFor("contract.pdf") === "contract-no-annotations.pdf");

// ---------------------------------------------------------------------------
// 10. content honesty across the lib files
// ---------------------------------------------------------------------------

const block = TOOL_CONTENT.slice(
  TOOL_CONTENT.indexOf('"pdf-remove-annotations": {'),
  TOOL_CONTENT.indexOf('"pdf-scale-pages": {'),
);
check("tool-content has a substantive pdf-remove-annotations block", block.length > 800, String(block.length));
check(
  "the long description says only the annotation layer goes",
  /annotation layer is removed/.test(block),
);
check(
  "the copy says links are removed too",
  /[Ll]inks are (implemented as )?annotations/.test(block) || /hyperlinks are removed/.test(block),
);
check(
  "the copy explains the form-field consequence honestly",
  /form/i.test(block) && /value/i.test(block),
);
check(
  "the copy states the page content is preserved",
  /text, images, and layout are preserved/.test(block) || /page content/i.test(block),
);
check("the copy states the real 100 MB cap", /100 ?MB/.test(block) || /100 ?MiB/.test(block));
check("the copy states the real 200 page cap", /200 pages/.test(block));
check(
  "the copy states the on-device model",
  /100% client-side|nothing is uploaded|never leave/i.test(block),
);
check(
  "the FAQ has at least four entries",
  (block.match(/"question":/g) ?? []).length >= 4,
  String((block.match(/"question":/g) ?? []).length),
);
check(
  "the FAQ answers links, form fields, content and undo",
  /links/i.test(block) && /form field/i.test(block) && /undo/i.test(block),
);
check(
  "no overclaims in the tool copy",
  !/lossless|instant|no limits|unlimited|perfect|permanently removes|impossible to|irreversible/i.test(block),
);
check("the tool copy names the output", /-no-annotations\.pdf/.test(block));
check("the tool copy offers the keep-form-fields option", /keep/i.test(block) && /fillable|editable/i.test(block));

const toolsBlock = TOOLS.slice(
  TOOLS.indexOf('slug: "pdf-remove-annotations"'),
  TOOLS.indexOf('slug: "pdf-scale-pages"'),
);
check("tools.ts keeps the entry intact", toolsBlock.includes('slug: "pdf-remove-annotations"') && toolsBlock.includes("icon: StickyNote"));
check(
  "the tools.ts description names comments, highlights, stamps, links and form fields",
  /comments/.test(toolsBlock) &&
    /highlights/.test(toolsBlock) &&
    /stamps/.test(toolsBlock) &&
    /links/.test(toolsBlock) &&
    /form field/i.test(toolsBlock),
  toolsBlock.replace(/\s+/g, " ").slice(0, 400),
);
check(
  "the tools.ts description still promises untouched page content",
  /page content/.test(toolsBlock) && /untouched/.test(toolsBlock),
);

const kwStart = SEO.indexOf('"pdf-remove-annotations": [');
check("seo.ts declares keywords for pdf-remove-annotations", kwStart > -1);
// slice the real map bodies instead of matching loose patterns across the file
const kwBlock = SEO.slice(kwStart, SEO.indexOf("]", kwStart) + 1);
check(
  "keywords include 'remove highlights from pdf', 'remove annotations from pdf' and 'delete pdf comments'",
  kwBlock.includes('"remove highlights from pdf"') &&
    kwBlock.includes('"remove annotations from pdf"') &&
    kwBlock.includes('"delete pdf comments"'),
  kwBlock.slice(0, 300),
);
check(
  "keywords cover the form-field and link cases too",
  kwBlock.includes('"remove pdf form fields"') && /link/i.test(kwBlock),
);
const titlesBlock = SEO.slice(SEO.indexOf("CUSTOM_TITLES"), SEO.indexOf("TOOL_FEATURE_LIST"));
const titleEntry = titlesBlock.slice(titlesBlock.indexOf('"pdf-remove-annotations"'));
const titleValue = titleEntry.match(/"pdf-remove-annotations":\s*"([^"]+)"/)?.[1] ?? "";
check("CUSTOM_TITLES has a custom title for the tool", titleValue.length >= 20 && titleValue.length <= 120, titleValue);
check("the custom title names the tool and its job", /remove/i.test(titleValue) && /annotation/i.test(titleValue), titleValue);
const featuresBlock = SEO.slice(SEO.indexOf("TOOL_FEATURE_LIST"));
const featureEntry = featuresBlock.slice(featuresBlock.indexOf('"pdf-remove-annotations"'));
const featureValue = featureEntry.match(/"pdf-remove-annotations":\s*"([^"]+)"/)?.[1] ?? "";
check("TOOL_FEATURE_LIST has a feature list for the tool", featureValue.length >= 80, String(featureValue.length));
check("the feature list reports the per-page breakdown", /per-page/i.test(featureValue));
check("the feature list claims nothing is uploaded", /nothing uploaded/i.test(featureValue));
check(
  "the feature list discloses the form-field behaviour",
  /form field/i.test(featureValue) && /keep/i.test(featureValue),
);
check(
  "the feature list states the caps",
  /100 MB/.test(featureValue) && /200 page/.test(featureValue),
);
check(
  "the feature list does not overclaim a forensic scrub",
  !/permanently|irreversible|unrecoverable|zero trace/i.test(featureValue),
);

check(
  "guides.ts has the how-to-remove-annotations-from-a-pdf guide",
  GUIDES.includes('slug: "how-to-remove-annotations-from-a-pdf"'),
);
const guideStart = GUIDES.indexOf('slug: "how-to-remove-annotations-from-a-pdf"');
const guideObjectEnd = GUIDES.indexOf("\n  },\n", guideStart);
const guideBlock = GUIDES.slice(guideStart, guideObjectEnd);
check("the guide is wired to this tool", /toolSlug: "pdf-remove-annotations"/.test(guideBlock));
check("the guide has a title and description", /title:/.test(guideBlock) && /description:/.test(guideBlock));
check("the guide lists keywords", (guideBlock.match(/^\s{6}"[a-z ]+",?$/gm) ?? []).length >= 4);
check(
  "the guide has at least four sections",
  (guideBlock.match(/heading: /g) ?? []).length >= 4,
  String((guideBlock.match(/heading: /g) ?? []).length),
);
check("every guide section has paragraphs", (guideBlock.match(/heading: /g) ?? []).length === (guideBlock.match(/paragraphs: \[/g) ?? []).length);
check("the guide has a read time and dates", /readMinutes: \d/.test(guideBlock) && /published: "2026-/.test(guideBlock) && /updated: "2026-/.test(guideBlock));
check(
  "the guide discloses what happens to form fields",
  /form field/i.test(guideBlock) && /value/i.test(guideBlock),
);
check("the guide discloses that links go too", /link/i.test(guideBlock));
check("the guide states the output name", /-no-annotations\.pdf/.test(guideBlock));
check("the guide states the caps", /100 ?MB/.test(guideBlock) && /200 pages/.test(guideBlock));
check(
  "the guide states the on-device model",
  /browser/i.test(guideBlock) &&
    /never leave|not uploaded|stays on|nothing is uploaded/i.test(guideBlock),
);
check(
  "the guide has no overclaims",
  !/permanently|irreversible|guarantee|unlimited|perfectly/i.test(guideBlock),
);
check(
  "REGRESSION GUARD: the guide's worked example adds up (40 total, 3 of them fields, 40 removed)",
  /removes all 40 of them/.test(guideBlock) && !/43 objects/.test(guideBlock),
  guideBlock.match(/If the tool reports[^"]*/)?.[0]?.slice(0, 120) ?? "",
);
check(
  "the guide names the result panel's re-download",
  /fetched again from that panel/.test(guideBlock),
);
check(
  "the guide has a dedicated what-this-does-not-do section",
  /heading: "What this tool does not do"/.test(guideBlock) &&
    /not a redaction tool/i.test(guideBlock) &&
    /no longer signed/.test(guideBlock) &&
    /XFA or JavaScript/i.test(guideBlock),
);
check(
  "the FAQ now covers the redaction boundary, signatures and XFA forms",
  /not a redaction tool/i.test(block) &&
    /pdf redact/i.test(block) &&
    /no longer signed/.test(block) &&
    /XFA or JavaScript-driven form/i.test(block),
);
check(
  "the FAQ explains that a popup / reply thread / appearance stream is pruned too",
  /pruned from the file as well/.test(block),
);
check(
  "the how-to no longer quotes a checkbox label the UI does not render",
  !/Tick \\"Keep the interactive form fields\\"/.test(block) && /keep-form-fields box/.test(block),
);
check(
  "the feature list advertises the pruning, not just the unlinking",
  /pruned from the file, not just unlinked/.test(block),
);

// ---------------------------------------------------------------------------

check(
  "every fixture was written to the temp dir",
  Object.keys(FILES).length === 13 && Object.values(FILES).every(existsSync),
  Object.keys(FILES).join(","),
);
rmSync(DIR, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
