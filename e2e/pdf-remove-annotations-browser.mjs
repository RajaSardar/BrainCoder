// Production-Chrome harness for the Remove Annotations PDF tool.
//
//   BASE_URL=http://localhost:3801 node e2e/pdf-remove-annotations-browser.mjs
//
// The UI is never trusted about what it removed: the captured download is
// re-parsed here with pdfjs and pdf-lib and must come back with zero
// annotation objects and a byte-identical text layer.
import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { PDFDocument, PDFHexString, PDFName, StandardFonts } from "pdf-lib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/pdf-remove-annotations`;
const TOOL_PAGE = `${BASE_URL}/tools/pdf-remove-annotations`;
const GUIDE_URL = "/guides/how-to-remove-annotations-from-a-pdf";
const DL = "/tmp/pdfremoveannotations";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const STANDARD_FONTS = new URL(
  "../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).href;
const A4_W = 595.28;
const A4_H = 841.89;
const MAX_PAGES = 200;

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

// marked.pdf — the mix the tool claims to strip: a link, a highlight, a comment
// whose popup is NOT listed in the page /Annots array (the shape Acrobat
// writes), a stamp, and a filled text form field. That is 5 objects the UI can
// count, plus one orphan popup the count cannot see.
{
  const doc = await PDFDocument.create();
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
  const popup = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Popup",
      Rect: [324, 600, 560, 664],
      Contents: "E2E POPUP PAYLOAD",
    }),
  );
  const p1annots = [
    ctx.register(
      ctx.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [60, 640, 260, 660],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: "https://example.com/e2e-link" },
      }),
    ),
    ctx.register(
      ctx.obj({
        Type: "Annot",
        Subtype: "Text",
        Rect: [300, 640, 324, 664],
        Name: "Comment",
        Contents: "E2E COMMENT PAYLOAD",
        T: "Reviewer",
        Popup: popup,
      }),
    ),
    ctx.register(
      ctx.obj({
        Type: "Annot",
        Subtype: "Highlight",
        Rect: [60, 694, 300, 712],
        QuadPoints: [60, 712, 300, 712, 60, 694, 300, 694],
        C: [1, 1, 0],
        Contents: "E2E HIGHLIGHT PAYLOAD",
      }),
    ),
  ];
  const p2annots = [
    ctx.register(
      ctx.obj({
        Type: "Annot",
        Subtype: "Stamp",
        Rect: [60, 500, 200, 560],
        Name: "Draft",
        Contents: "E2E STAMP PAYLOAD",
      }),
    ),
  ];
  p1.node.set(PDFName.of("Annots"), ctx.obj(p1annots));
  p2.node.set(PDFName.of("Annots"), ctx.obj(p2annots));

  const field = doc.getForm().createTextField("e2e_notes");
  field.addToPage(p2, { x: 60, y: 400, width: 240, height: 24 });
  field.setText("E2E FIELD VALUE");
  writeFileSync(
    `${DL}/marked.pdf`,
    await doc.save({ updateFieldAppearances: true, useObjectStreams: false }),
  );
}

// busy.pdf — 25 annotated pages, so the per-batch progress has something to say
{
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  for (let i = 0; i < 25; i++) {
    const page = doc.addPage([A4_W, A4_H]);
    page.node.set(
      PDFName.of("Annots"),
      ctx.obj([
        ctx.register(
          ctx.obj({
            Type: "Annot",
            Subtype: "Highlight",
            Rect: [40, 40, 200, 60],
            QuadPoints: [40, 60, 200, 60, 40, 40, 200, 40],
            Contents: `E2E BUSY PAYLOAD ${i + 1}`,
          }),
        ),
      ]),
    );
  }
  writeFileSync(`${DL}/busy.pdf`, await doc.save({ useObjectStreams: false }));
}

// clean.pdf — nothing annotated at all
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([A4_W, A4_H]);
  page.drawText("Nothing annotated on this page at all.", {
    x: 50,
    y: 700,
    size: 12,
    font,
  });
  writeFileSync(`${DL}/clean.pdf`, await doc.save({ useObjectStreams: false }));
}
{
  const doc = await PDFDocument.create();
  for (let i = 0; i < MAX_PAGES + 1; i++) doc.addPage([A4_W, A4_H]);
  writeFileSync(`${DL}/manypages.pdf`, await doc.save({ useObjectStreams: false }));
}
writeFileSync(`${DL}/locked.pdf`, readFileSync("e2e/fixtures/encrypted.pdf"));
writeFileSync(`${DL}/notapdf.pdf`, "this is definitely not a pdf file, just some text\nline two");
writeFileSync(`${DL}/huge.pdf`, Buffer.alloc(100 * 1024 * 1024 + 1000));

// ---------------------------------------------------------------------------
// pdfjs / pdf-lib verification of a captured download
// ---------------------------------------------------------------------------

async function inspect(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs rejects Node Buffers outright, so hand it a plain Uint8Array copy.
  const data = new Uint8Array(bytes);
  const task = pdfjs.getDocument({ data, standardFontDataUrl: STANDARD_FONTS });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const annots = await page.getAnnotations({ intent: "any" });
      const content = await page.getTextContent();
      pages.push({
        subtypes: annots.map((a) => a.subtype),
        fieldValues: annots
          .filter((a) => a.subtype === "Widget")
          .map((a) => a.fieldValue ?? "")
          .join(""),
        text: content.items.map((it) => it.str ?? "").join(""),
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

async function annotsArrayCount(bytes) {
  const lib = await import("pdf-lib");
  const doc = await lib.PDFDocument.load(new Uint8Array(bytes));
  let n = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (annots && typeof annots.size === "function") n += annots.size();
  }
  return { count: n, hasAcroForm: !!doc.catalog.get(lib.PDFName.of("AcroForm")) };
}

const rawText = (bytes) => Buffer.from(bytes).toString("latin1");
/**
 * pdf-lib writes a JS string either as a literal (...) or as a UTF-16BE hex
 * string (<FEFF0041...>). A plain substring search would pass vacuously on
 * whichever form the writer did not choose, so probe both.
 */
const ENCODER = (await PDFDocument.create()).context;
const encodingsOf = (text) => [String(ENCODER.obj(text)), String(PDFHexString.fromText(text))];
const presentIn = (raw, text) => encodingsOf(text).some((e) => raw.includes(e));
const absentFrom = (raw, text) => !presentIn(raw, text);

// ---------------------------------------------------------------------------
// browser
// ---------------------------------------------------------------------------

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) {
    passed++;
    console.log(`ok  ${label}`);
  } else {
    failed++;
    console.error(`NOT OK  ${label}`);
  }
}

const consoleIssues = [];
const pageErrors = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

// Next.js injects an empty route-announcer alert, so every alert/status locator
// is filtered on non-blank text.
const alert = (t) => page.locator("[role='alert']").filter({ hasText: t });
const visibleAlerts = () => page.locator("[role='alert']").filter({ hasText: /\S/ });
const status = (t) => page.locator("[role='status']").filter({ hasText: t });
const fileInput = () => page.locator("input[type='file']");
const opener = () => page.locator("label", { hasText: /Open PDF|Choose another PDF/ }).first();
const removeButton = (t) => page.locator("button", { hasText: t });

async function captureDownload(buttonLocator, saveAs, timeout = 90000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    buttonLocator.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)) };
}

try {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await opener().waitFor({ state: "visible", timeout: 15000 });

  // --- a11y baseline -------------------------------------------------------
  check(
    (await fileInput().getAttribute("aria-label")) === "Choose a PDF to remove annotations from",
    "file input carries an accessible name",
  );
  check((await fileInput().getAttribute("disabled")) === null, "the file input starts enabled");
  check((await page.locator("label[for]").count()) >= 1, "the opener is a real <label htmlFor>");
  check(
    (await status(/nothing is uploaded/).first().textContent()).includes("200 pages and 100 MB"),
    "the idle status states the caps and the on-device promise",
  );
  check((await page.locator("fieldset").count()) === 0, "no report before a file is open");
  check((await visibleAlerts().count()) === 0, "no error surfaced before a file is open");

  // --- happy path: count first, confirm, then download ---------------------
  await fileInput().setInputFiles(`${DL}/marked.pdf`);
  await status(/Found 5 annotations in marked\.pdf/).waitFor({ timeout: 90000 });
  check(
    (await page.locator("fieldset legend", { hasText: /Annotations found in marked\.pdf/ }).count()) === 1,
    "the report is grouped in a fieldset/legend named after the file",
  );
  check(
    (await page.locator("li", { hasText: /^page 1: 3$/ }).count()) === 1 &&
      (await page.locator("li", { hasText: /^page 2: 2$/ }).count()) === 1,
    "per-page annotation counts are listed",
  );
  const breakdown = await page.locator("fieldset p", { hasText: /comments, highlights/ }).first().textContent();
  check(
    /2 comments, highlights and notes/.test(breakdown) &&
      /1 link\b/.test(breakdown) &&
      /1 stamp\b/.test(breakdown) &&
      /1 form field\b/.test(breakdown),
    `the kind breakdown is correct and grammatically pluralised: ${breakdown}`,
  );
  check(
    (await removeButton(/Remove 5 annotations/).count()) === 1,
    "the confirm button states the exact count it will remove",
  );
  check(
    (await removeButton(/Remove 5 annotations/).getAttribute("disabled")) === null,
    "the confirm button is enabled for review",
  );
  check(
    (await page.locator("input[type='checkbox']").count()) === 1,
    "the keep-form-fields switch is offered when the file has widgets",
  );
  check(
    (await page.locator("label", { hasText: /Keep the 1 interactive form field in place/ }).count()) === 1,
    "the keep switch has a real label with the real count in it",
  );
  check((await visibleAlerts().count()) === 0, "a valid PDF raises no alert");

  // busy phases are announced while the layer is stripped
  await page.evaluate(() => {
    window.__phases = { strip: false, prune: false, write: false };
    const mo = new MutationObserver(() => {
      const t = document.body.textContent || "";
      if (/Removing annotations — page \d+ of \d+/.test(t)) window.__phases.strip = true;
      if (/Pruning orphaned annotation data/.test(t)) window.__phases.prune = true;
      if (/Writing the new file/.test(t)) window.__phases.write = true;
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__phaseMo = mo;
  });
  const first = await captureDownload(removeButton(/Remove 5 annotations/), "out-default.pdf");
  await page.evaluate(() => window.__phaseMo?.disconnect());
  const phases = await page.evaluate(() => window.__phases);
  check(phases.strip, "busy state announces the page-by-page removal progress");
  check(phases.prune, "busy state announces the pruning phase");
  check(phases.write, "busy state announces the writing phase");
  check((await page.locator("[aria-busy='true']").count()) === 0, "aria-busy clears after the run");

  // the download is the authority
  check(first.name === "marked-no-annotations.pdf", "output is named <source>-no-annotations.pdf");
  const before = await inspect(new Uint8Array(readFileSync(`${DL}/marked.pdf`)));
  const after = await inspect(first.bytes);
  const raw = rawText(first.bytes);
  const sourceRaw = rawText(new Uint8Array(readFileSync(`${DL}/marked.pdf`)));
  check(
    before.flatMap((p) => p.subtypes).join(",") === "Link,Text,Highlight,Stamp,Widget",
    "the fixture really carries a link, comment, highlight, stamp and widget",
  );
  // Guard against vacuous "payload is gone" assertions below: prove the bytes
  // really carried these strings to begin with.
  check(
    [
      "E2E COMMENT PAYLOAD",
      "E2E STAMP PAYLOAD",
      "E2E HIGHLIGHT PAYLOAD",
      "E2E POPUP PAYLOAD",
    ].every((t) => presentIn(sourceRaw, t)),
    "the source file really stores every payload string the removal asserts on",
  );
  check(
    (await annotsArrayCount(new Uint8Array(readFileSync(`${DL}/marked.pdf`)))).count === 5,
    "the source file lists exactly five annotations in its page /Annots arrays",
  );
  check(
    before.map((p) => p.fieldValues).join("") === "E2E FIELD VALUE",
    "the source widget really carries the filled value",
  );
  check(
    presentIn(sourceRaw, "e2e_notes") && sourceRaw.includes("/AcroForm"),
    "the source bytes really carry the field name and the AcroForm dictionary",
  );
  check(
    after.every((p) => p.subtypes.length === 0),
    `the downloaded PDF has zero annotation objects on every page (${JSON.stringify(after.map((p) => p.subtypes))})`,
  );
  check(
    after.every((p, i) => p.text === before[i].text) &&
      after[0].text.includes("Page one body text") &&
      after[1].text.includes("Page two body text"),
    "the downloaded PDF's text layer is identical to the source",
  );
  check(after.length === 2, "the downloaded PDF keeps both pages");
  const struct = await annotsArrayCount(first.bytes);
  check(struct.count === 0, "no /Annots entry survives in the downloaded PDF");
  check(!struct.hasAcroForm, "the AcroForm entry is gone from the downloaded PDF");
  const leftover = ["E2E COMMENT PAYLOAD", "E2E STAMP PAYLOAD", "E2E HIGHLIGHT PAYLOAD"].filter(
    (t) => presentIn(raw, t),
  );
  check(
    leftover.length === 0,
    `comment, stamp and highlight payloads are physically gone from the download (left: ${JSON.stringify(leftover)})`,
  );
  check(
    absentFrom(raw, "E2E POPUP PAYLOAD"),
    "the unlisted comment popup is pruned too, not left in the bytes",
  );
  check(
    !presentIn(raw, "e2e_notes") && !raw.includes("/AcroForm"),
    `the field name and the AcroForm dictionary are gone from the download (name still present: ${presentIn(raw, "e2e_notes")}, /AcroForm: ${raw.includes("/AcroForm")})`,
  );
  check(
    after.map((p) => p.fieldValues).join("") === "",
    "no widget carries the filled value in the download",
  );
  check(
    !/Subtype\s*\/(Widget|Text|Link|Stamp|Highlight)/.test(raw),
    "no annotation subtype dict survives",
  );

  // the result panel
  await page.locator("h3", { hasText: /Clean copy ready/ }).waitFor({ timeout: 30000 });
  check(
    (await page.locator("dl dd", { hasText: "5 / 5" }).count()) === 1,
    "the result panel reports what was found and what was removed",
  );
  check(
    (await page.locator("dt", { hasText: /Form fields kept/ }).count()) === 1 &&
      (await page.locator("dt", { hasText: /vs\. original/ }).count()) === 1,
    "the result panel itemises kept fields and the size change",
  );
  const successText = await status(/Removed 5 annotations and downloaded/).first().textContent();
  check(/Page text, images and layout are unchanged/.test(successText), "the success line restates the untouched-content claim");
  check(
    (await page.locator("button", { hasText: /Download marked-no-annotations\.pdf again/ }).count()) === 1,
    "the lost-download case has a re-download button",
  );
  const again = await captureDownload(
    page.locator("button", { hasText: /Download marked-no-annotations\.pdf again/ }),
    "out-again.pdf",
  );
  check(again.name === first.name, "the re-download reuses the same name");
  check(
    Buffer.compare(first.bytes, again.bytes) === 0,
    "the re-download is byte-identical to the automatic download",
  );

  // --- keep the form fields ------------------------------------------------
  await fileInput().setInputFiles(`${DL}/marked.pdf`);
  await status(/Found 5 annotations in marked\.pdf/).waitFor({ timeout: 90000 });
  check(
    (await page.locator("h3", { hasText: /Clean copy ready/ }).count()) === 0,
    "opening a new file drops the previous result panel",
  );
  await page.locator("input[type='checkbox']").check();
  check(
    (await removeButton(/Remove 4 annotations/).count()) === 1,
    "keeping the fields lowers the count on the confirm button",
  );
  check(
    (await page.locator("h3", { hasText: /Clean copy ready/ }).count()) === 0,
    "changing the keep setting drops the stale result",
  );
  const keepDl = await captureDownload(removeButton(/Remove 4 annotations/), "out-keep.pdf");
  const keepAfter = await inspect(keepDl.bytes);
  check(
    keepAfter[0].subtypes.length === 0 && keepAfter[1].subtypes.join(",") === "Widget",
    `keep mode leaves exactly the widget (${JSON.stringify(keepAfter.map((p) => p.subtypes))})`,
  );
  const keepStruct = await annotsArrayCount(keepDl.bytes);
  check(keepStruct.hasAcroForm, "keep mode keeps the AcroForm entry");
  const keptValue = keepAfter.map((p) => p.fieldValues).join("");
  check(
    keptValue === "E2E FIELD VALUE",
    `keep mode keeps the filled value (got ${JSON.stringify(keptValue)})`,
  );
  check(
    keepAfter.every((p, i) => p.text === before[i].text),
    "keep mode leaves the text layer identical too",
  );
  check(
    /stayed in place and is still fillable/.test(
      await status(/Removed 4 annotations and downloaded/).first().textContent(),
    ),
    "the success line says the kept fields are still fillable",
  );
  await page.locator("input[type='checkbox']").uncheck();

  // --- a longer run announces real progress and really removes -------------
  await fileInput().setInputFiles(`${DL}/busy.pdf`);
  await status(/Found 25 annotations in busy\.pdf/).waitFor({ timeout: 90000 });
  const busyDl = await captureDownload(removeButton(/Remove 25 annotations/), "out-busy.pdf", 120000);
  check(busyDl.name === "busy-no-annotations.pdf", "the 25-page run names its output correctly");
  const busyAfter = await inspect(busyDl.bytes);
  check(busyAfter.length === 25, "the 25-page output keeps all 25 pages");
  check(
    busyAfter.every((p) => p.subtypes.length === 0) &&
      absentFrom(rawText(busyDl.bytes), "E2E BUSY PAYLOAD 1") &&
      absentFrom(rawText(busyDl.bytes), "E2E BUSY PAYLOAD 25"),
    "all 25 pages come back with zero annotations and no payloads left",
  );

  // --- a file with nothing to remove --------------------------------------
  await fileInput().setInputFiles(`${DL}/clean.pdf`);
  await status(/no annotations were found, so there is nothing to remove/).waitFor({ timeout: 90000 });
  check(
    (await page.locator("fieldset p", { hasText: /No comments, highlights, stamps, links or form fields/ }).count()) === 1,
    "a clean file is reported as having nothing to remove",
  );
  check(
    (await removeButton(/Nothing to remove/).getAttribute("disabled")) !== null,
    "the remove button is disabled when there is nothing to remove",
  );
  check(
    (await page.locator("input[type='checkbox']").count()) === 0,
    "the keep-fields switch is hidden when there are no fields",
  );
  check((await visibleAlerts().count()) === 0, "a clean file is not treated as an error");

  // --- error paths ---------------------------------------------------------
  await fileInput().setInputFiles(`${DL}/locked.pdf`);
  await alert(/password-protected/).waitFor({ timeout: 90000 });
  check((await alert(/password-protected/).count()) === 1, "an encrypted PDF steers to unlocking");
  check(
    (await page.locator("[role='alert'] a[href='/use/pdf-unlock']").count()) === 1,
    "the encrypted steer links to PDF Unlock",
  );

  await fileInput().setInputFiles(`${DL}/notapdf.pdf`);
  await alert(/doesn't look like a valid PDF/).waitFor({ timeout: 90000 });
  check((await alert(/doesn't look like a valid PDF/).count()) === 1, "a non-PDF upload is refused by name");

  await fileInput().setInputFiles(`${DL}/huge.pdf`);
  await alert(/up to 100 MB/).waitFor({ timeout: 90000 });
  check((await alert(/up to 100 MB/).count()) === 1, "an oversized file is rejected before it is parsed");

  await fileInput().setInputFiles(`${DL}/manypages.pdf`);
  await alert(/up to 200 pages/).waitFor({ timeout: 120000 });
  check((await alert(/up to 200 pages/).count()) === 1, "a 201-page document is rejected at the page cap");
  check((await page.locator("fieldset").count()) === 0, "a rejected file leaves no half-loaded report");
  check(
    (await page.locator("button", { hasText: /Download .*again/ }).count()) === 0,
    "a rejected file offers no download",
  );

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // --- marketing copy honesty ---------------------------------------------
  const html = await (await page.request.get(TOOL_PAGE)).text();
  const body = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/’/g, "'")
    .replace(/“|”/g, '"');
  // The page also renders "Related tools" cards and the site chrome, whose copy
  // legitimately mentions drag-and-drop, "instantly" and "guarantee". Scope the
  // negative copy checks to this tool's own region: h1 up to the related list.
  const ownStart = html.indexOf("<h1");
  const ownEnd = html.indexOf("Related tools");
  const ownHtml = ownStart >= 0 ? html.slice(ownStart, ownEnd > ownStart ? ownEnd : undefined) : html;
  const ownLower = ownHtml.toLowerCase();
  check(ownEnd > ownStart, "the tool copy region is locatable on the page");
  check(html.length > 100, "the tool marketing page renders");
  check(body.includes("Only the annotation layer is removed"), "copy says only the annotation layer goes");
  check(
    body.includes("Links are implemented as annotations"),
    "copy says hyperlinks go too, without pretending otherwise",
  );
  check(
    /if the value was already flattened into the page content, it stays visible/i.test(body),
    "copy explains the filled-field-value catch",
  );
  check(
    body.includes("no longer signed") && /even when only a single comment was deleted/i.test(body),
    "copy discloses that a signed PDF comes out unsigned",
  );
  check(
    body.includes("not a redaction tool") && body.includes("PDF Redact"),
    "copy draws the line against redaction and points at the right tool",
  );
  check(
    body.includes("pruned from the file as well"),
    "copy says the owned objects are pruned, not only unlinked",
  );
  check(body.includes("100 MB and 200 pages"), "copy states the real size and page limits");
  check(/nothing is uploaded|never leave/i.test(body), "copy states the on-device model");
  check(
    !/permanently|irreversible|forensic|unlimited|no limits|guarantee/i.test(ownLower),
    "no overclaiming language in the marketing copy",
  );
  check(!/drag and drop/i.test(ownLower), "no drag-and-drop promise");
  check(!/instant/i.test(ownLower), "no 'instant' hype");
  check(
    !/keeps? your (comments|annotations)/i.test(ownLower),
    "no promise that anything is kept that the tool actually removes",
  );

  const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(
    /remove pdf annotations/i.test(titleTag) && titleTag.length < 90,
    `the tool page title names the job: "${titleTag}"`,
  );

  // --- guide ---------------------------------------------------------------
  const guide = await page.request.get(`${BASE_URL}${GUIDE_URL}`);
  check(guide.status() === 200, "the remove-annotations guide renders");
  const guideBody = (await guide.text())
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/’/g, "'")
    .replace(/“|”/g, '"');
  check(
    guideBody.includes("removes all 40 of them") && !guideBody.includes("43 objects"),
    "the guide's worked example adds up",
  );
  check(guideBody.includes("not a redaction tool"), "the guide says this is not a redaction tool");
  check(guideBody.includes("no longer signed"), "the guide discloses the signature consequence");
  check(guideBody.includes("-no-annotations.pdf"), "the guide names the output file");
  check(guideBody.includes("100 MB and 200 pages"), "the guide states the real caps");
  check(/nothing is uploaded|stays on your machine/i.test(guideBody), "the guide states the on-device model");
  check(
    /popups, reply threads,? appearance streams/.test(guideBody) &&
      guideBody.includes("pruned from the file"),
    "the guide explains what gets pruned",
  );

  const sitemapRes = await page.request.get(`${BASE_URL}/sitemap.xml`);
  const sitemap = sitemapRes.ok() ? await sitemapRes.text() : "";
  check(sitemap.includes("/tools/pdf-remove-annotations"), "the sitemap lists the tool page");
  check(sitemap.includes(GUIDE_URL), "the sitemap lists the remove-annotations guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e)?.slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
