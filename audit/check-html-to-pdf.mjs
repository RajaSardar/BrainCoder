import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

if (!process.env.H2P_STRIPPED) {
  const res = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", fileURLToPath(import.meta.url)],
    { stdio: "inherit", env: { ...process.env, H2P_STRIPPED: "1" } },
  );
  process.exit(res.status ?? 1);
}

const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
const {
  MAX_INPUT_BYTES,
  MAX_PAGES,
  SAVE_OPTS,
  A4_WIDTH,
  A4_HEIGHT,
  DEFAULT_MARGINS,
  HEADING_STYLES,
  PARAGRAPH_STYLE,
  TABLE_STYLE,
  RULE_STYLE,
  parseHtmlToModel,
  droppedSummary,
  pdfFileName,
  wrapSpans,
  layoutModel,
  paintLayout,
  firstPageText,
  sanitizeText,
  decodeEntities,
} = await import("../src/features/html-to-pdf/html-converter.ts");

const COMPONENT = readFileSync("src/features/html-to-pdf/HtmlToPdf.tsx", "utf8");
const TOOLS = readFileSync("src/lib/tools.ts", "utf8");
const CONTENT = readFileSync("src/lib/tool-content.ts", "utf8");
const SEO = readFileSync("src/lib/seo.ts", "utf8");
const GUIDES = readFileSync("src/lib/guides.ts", "utf8");

const STANDARD_FONTS = "node_modules/pdfjs-dist/standard_fonts/";
const LEFT = DEFAULT_MARGINS.left;
const RIGHT = A4_WIDTH - DEFAULT_MARGINS.right;
const CONTENT_W = RIGHT - LEFT;

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

const PALETTE = {
  text: rgb(0.07, 0.09, 0.16),
  muted: rgb(0.45, 0.5, 0.58),
  rule: rgb(0.82, 0.85, 0.9),
  band: rgb(0.94, 0.95, 0.97),
};

async function embedFonts(doc) {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
}

function measurerFor(fonts) {
  return {
    width: (text, style, size) => fonts[style].widthOfTextAtSize(text, size),
  };
}

async function buildPdf(html, { title = "", maxPages } = {}) {
  const model = parseHtmlToModel(html, { defaultTitle: title });
  const doc = await PDFDocument.create();
  doc.setTitle(title || "Document");
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  const fonts = await embedFonts(doc);
  const layout = layoutModel(model, measurerFor(fonts), maxPages ? { maxPages } : {});
  paintLayout(doc, layout.pages, fonts, PALETTE);
  const bytes = new Uint8Array(await doc.save(SAVE_OPTS));
  return { model, layout, bytes, doc };
}

async function pdfText(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(0), standardFontDataUrl: STANDARD_FONTS });
  const doc = await task.promise;
  try {
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      out.push(content.items.map((it) => it.str).join("").replace(/[ \t]+/g, " "));
    }
    return out;
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

function allRuns(layout) {
  return layout.pages.flatMap((p) => p.items.filter((i) => i.kind === "text").flatMap((i) => i.runs));
}

const DOC = `<!doctype html><html><head><title>Ignored</title><style>body{color:red}</style></head>
<body>
<h1>Quarterly Report</h1>
<p>Revenue grew by <b>18%</b> in <i>Q3</i>, and churn fell to 2.1%.</p>
<h2>Line items</h2>
<table>
  <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
  <tr><td>Developer tools subscription</td><td style="text-align:right">$29.00</td></tr>
  <tr><td>Hosting add-on</td><td style="text-align:right">$5.00</td></tr>
</table>
<ul><li>First bullet item</li><li>Second bullet item</li></ul>
<ol><li>Step one</li><li>Step two</li></ol>
<p>Terms &amp; conditions apply<br>Second line after a break</p>
<hr>
<script>window.secretToken = 'do-not-render';</script>
<img src="chart.png" alt="Revenue chart">
</body></html>`;

const model = parseHtmlToModel(DOC, { defaultTitle: "" });
const built = await buildPdf(DOC, { title: "Quarterly Report" });
const pages = await pdfText(built.bytes);
const allText = pages.join(" ");
const stream1 = decodedContents((await PDFDocument.load(built.bytes)).getPage(0));

// ---------------------------------------------------------------- 1. caps
check("input cap is 200 KiB", MAX_INPUT_BYTES === 204800, String(MAX_INPUT_BYTES));
check("page cap is 200", MAX_PAGES === 200, String(MAX_PAGES));
check("save opts disable field appearances and default page", SAVE_OPTS.updateFieldAppearances === false && SAVE_OPTS.addDefaultPage === false);
check(
  "component enforces the 200 KB cap before converting",
  /MAX_INPUT_BYTES/.test(COMPONENT) &&
    /const CAP_KB = Math\.round\(MAX_INPUT_BYTES \/ 1024\)/.test(COMPONENT) &&
    new RegExp("larger than the \\$\\{CAP_KB\\} KB limit").test(COMPONENT),
  "cap copy or guard missing",
);
check(
  "component discloses the 200-page cap",
  /MAX_PAGES/.test(COMPONENT) && /\$\{MAX_PAGES\} pages/.test(COMPONENT),
  "no 200-page copy in component",
);
check("component uses the shared save options", /SAVE_OPTS/.test(COMPONENT));

// ---------------------------------------------------------------- 2. component wiring
check("component imports the pure converter core", /from "\.\/html-converter"/.test(COMPONENT));
check("component drives parse -> layout -> paint", /parseHtmlToModel/.test(COMPONENT) && /layoutModel/.test(COMPONENT) && /paintLayout/.test(COMPONENT));
check("component downloads through downloadBlob", /downloadBlob/.test(COMPONENT));
check("component never injects the HTML into the DOM", !/dangerouslySetInnerHTML/.test(COMPONENT) && !/srcdoc/.test(COMPONENT) && !/<iframe/.test(COMPONENT));
check("component pins creation + modification dates for byte-stable output", /setCreationDate/.test(COMPONENT) && /setModificationDate/.test(COMPONENT));
check("component has an empty-input guard", /Paste some HTML|empty/i.test(COMPONENT));
check("component guards re-entrancy with a runId", /runIdRef/.test(COMPONENT));
check("component marks the root aria-busy", /aria-busy=\{busy\}/.test(COMPONENT));
check("component exposes role=alert and role=status live regions", /role="alert"/.test(COMPONENT) && /role="status"/.test(COMPONENT));
check("component labels its controls with useId", (COMPONENT.match(/useId\(\)/g) ?? []).length >= 2);
check("component surfaces the dropped-element count", /droppedCount/.test(COMPONENT) && /droppedSummary/.test(COMPONENT));

// ---------------------------------------------------------------- 3. parser
check("h1 becomes a level-1 heading block", model.blocks[0]?.kind === "heading" && model.blocks[0].level === 1, JSON.stringify(model.blocks[0]?.kind));
check("h2 becomes a level-2 heading block", model.blocks.some((b) => b.kind === "heading" && b.level === 2));
check("paragraph text is captured", model.blocks.some((b) => b.kind === "paragraph" && b.spans[0].text.includes("Revenue grew by")));
check("bold runs get the bold style", model.blocks.some((b) => b.kind === "paragraph" && b.spans.some((s) => s.style === "bold" && s.text.includes("18%"))));
check("italic runs get the italic style", model.blocks.some((b) => b.kind === "paragraph" && b.spans.some((s) => s.style === "italic" && s.text.includes("Q3"))));
check("entities are decoded (&amp; -> &)", model.blocks.some((b) => b.kind === "paragraph" && b.spans.some((s) => s.text.includes("Terms & conditions"))));
check("decodeEntities leaves unknown entities alone", decodeEntities("&nope; &amp;") === "&nope; &");
check("table becomes a table block with 3 rows and 1 header row", (() => {
  const t = model.blocks.find((b) => b.kind === "table");
  return !!t && t.rows.length === 3 && t.headerRows === 1 && t.rows[0].length === 2;
})(), JSON.stringify(model.blocks.find((b) => b.kind === "table")?.headerRows));
check("th cells become bold spans", (() => {
  const t = model.blocks.find((b) => b.kind === "table");
  return !!t && t.rows[0][0].spans[0].style === "bold" && t.rows[1][0].spans[0].style === "regular";
})());
check("right alignment is read from text-align", (() => {
  const t = model.blocks.find((b) => b.kind === "table");
  return !!t && t.rows[0][1].align === "right" && t.rows[1][1].align === "right" && t.rows[0][0].align === "left";
})());
check("ul items keep bullet semantics", (() => {
  const items = model.blocks.filter((b) => b.kind === "listItem" && !b.ordered);
  return items.length === 2 && items[0].spans[0].text.includes("First bullet item");
})());
check("ol items are numbered from 1", (() => {
  const items = model.blocks.filter((b) => b.kind === "listItem" && b.ordered);
  return items.length === 2 && items[0].index === 1 && items[1].index === 2;
})());
check("<br> keeps a hard break inside the paragraph", (() => {
  const p = model.blocks.find((b) => b.kind === "paragraph" && b.spans.some((s) => s.text.includes("Terms")));
  return !!p && p.spans.some((s) => s.text.includes("\n"));
})(), "no \\n span found");
check("<hr> becomes a rule block", model.blocks.some((b) => b.kind === "rule"));
check(
  "script, style, head title and img are dropped and counted",
  model.droppedCount === 4 &&
    model.dropped.some((d) => d.tag === "script") &&
    model.dropped.some((d) => d.tag === "style") &&
    model.dropped.some((d) => d.tag === "title") &&
    model.dropped.some((d) => d.tag === "img"),
  JSON.stringify(model.dropped),
);
check("script body never reaches the model", !JSON.stringify(model).includes("do-not-render"));
check("title/head content is dropped, not rendered as body text", !JSON.stringify(model).includes("Ignored"));
check("img is dropped and its alt becomes a note", (() => {
  const note = model.blocks.find((b) => b.kind === "note");
  return model.dropped.some((d) => d.tag === "img" && d.count === 1) && !!note && note.spans[0].text.includes("[image omitted: Revenue chart]") && note.spans[0].muted === true;
})(), JSON.stringify(model.blocks.find((b) => b.kind === "note")));
check("dropped summary names the dropped tags", /Dropped 4 unsupported elements \(/.test(droppedSummary(model.dropped)) && droppedSummary(model.dropped).includes("script"), droppedSummary(model.dropped));
check("stats count blocks, headings, tables and list items", model.stats.headings === 2 && model.stats.tables === 1 && model.stats.listItems === 4 && model.stats.blocks === model.blocks.length, JSON.stringify(model.stats));

// whitespace, comments, malformed input
{
  const messy = parseHtmlToModel(`<!-- note --><!doctype html><p>a   b\n\tc</p><h2>Loose`);
  const p = messy.blocks.find((b) => b.kind === "paragraph");
  check("whitespace inside text collapses to single spaces", !!p && p.spans[0].text === "a b c", JSON.stringify(p?.spans[0]?.text));
  check("comments and doctype never become text", !JSON.stringify(messy).includes("note"));
  check("unclosed heading still becomes a heading block", messy.blocks.some((b) => b.kind === "heading" && b.spans[0].text === "Loose"));
}
{
  const unclosed = parseHtmlToModel("<p><b>bold <i>and italic</p><ul><li>one<li>two</ul>");
  const p = unclosed.blocks.find((b) => b.kind === "paragraph");
  check(
    "unclosed inline tags still yield styled text",
    !!p && p.spans.some((s) => s.style === "bold") && p.spans.map((s) => s.text).join("").includes("bold and italic"),
    JSON.stringify(p?.spans),
  );
  check("unclosed <li> still yields list items", unclosed.blocks.filter((b) => b.kind === "listItem").length === 2);
  const italicOnly = parseHtmlToModel("<p><i>only italic</i></p>");
  check("a lone <i> resolves to the italic style", italicOnly.blocks[0].spans[0].style === "italic");
}
{
  const cjk = parseHtmlToModel("<p>ok 日本語 ✓ done</p>");
  check("characters outside the PDF standard font are replaced", cjk.blocks[0].spans[0].text === "ok ??? ? done", JSON.stringify(cjk.blocks[0].spans[0].text));
  check("replaced characters are counted for disclosure", cjk.stats.replacedChars === 4, String(cjk.stats.replacedChars));
  check("sanitizeText keeps typographic punctuation", sanitizeText("a–b “c” • 20°").text === "a–b “c” • 20°");
}
{
  const linked = parseHtmlToModel('<p>See <a href="https://example.com/docs">the docs</a> now</p>');
  check("link text is kept and the URL is appended muted", (() => {
    const spans = linked.blocks[0].spans;
    return spans.some((s) => s.text.includes("the docs")) && spans.some((s) => s.muted && s.text.includes("https://example.com/docs"));
  })(), JSON.stringify(linked.blocks[0].spans));
}
{
  const pre = parseHtmlToModel("<pre>line one\n  line two</pre>");
  const code = pre.blocks.find((b) => b.kind === "code");
  check("<pre> keeps its line structure in monospace", !!code && code.lines.length === 2 && code.lines[1] === "  line two");
}
{
  const titled = parseHtmlToModel("<h1>Has title</h1><p>x</p>", { defaultTitle: "Doc title" });
  check("default title is not duplicated when an h1 exists", titled.blocks.filter((b) => b.kind === "heading" && b.level === 1).length === 1);
  const untitled = parseHtmlToModel("<p>only a paragraph</p>", { defaultTitle: "Doc title" });
  check("default title becomes the h1 when the HTML has none", untitled.blocks[0].kind === "heading" && untitled.blocks[0].spans[0].text === "Doc title");
}
check("file names come from the source file, then the title", pdfFileName("invoice.html", "") === "invoice.pdf" && pdfFileName("My Q3 Report.htm", "") === "my-q3-report.pdf" && pdfFileName("", "Sales Report") === "sales-report.pdf" && pdfFileName("", "") === "document.pdf");

// ---------------------------------------------------------------- 4. layout
{
  const runs = allRuns(built.layout);
  const headingRun = runs.find((r) => r.text === "Quarterly Report");
  const paraRun = runs.find((r) => r.text.startsWith("Revenue grew by"));
  check("headings are set in a larger size than body text", !!headingRun && !!paraRun && headingRun.size > paraRun.size, `${headingRun?.size} vs ${paraRun?.size}`);
  check("heading 1 is 21pt and body text 10.5pt", HEADING_STYLES[1].size === 21 && PARAGRAPH_STYLE.size === 10.5);
  check("headings carry more space before them than paragraphs carry after", HEADING_STYLES[2].spaceBefore > PARAGRAPH_STYLE.spaceAfter);
  check("headings are painted in the bold font", headingRun.style === "bold" && paraRun.style === "regular");
  check("no item is drawn outside the left/right margins", runs.every((r) => r.x >= LEFT - 0.01 && r.x + r.width <= RIGHT + 0.01), "margin overflow");
  check(
    "no baseline sits below the bottom margin",
    built.layout.pages.every((p) => p.items.every((i) => i.kind !== "text" || i.y >= DEFAULT_MARGINS.bottom - 1.5)),
    "below bottom margin",
  );
  check("no line is wider than the content width", allRuns(built.layout).every((r) => r.width <= CONTENT_W + 0.01));
  check("bullets are painted as text items", built.layout.pages[0].items.some((i) => i.kind === "text" && i.runs.some((r) => r.text === "\u2022")));
  check("ordered list markers are painted as text items", built.layout.pages[0].items.some((i) => i.kind === "text" && i.runs.some((r) => r.text === "1.")));
  check("the <hr> is painted as a rule item", built.layout.pages.flatMap((p) => p.items).some((i) => i.kind === "rule" && i.thickness === RULE_STYLE.thickness));
  check("the table header is painted on a shaded band", built.layout.pages.flatMap((p) => p.items).some((i) => i.kind === "band" && i.height > TABLE_STYLE.cellPadY));
  check("the first-page preview text starts with the heading", firstPageText(built.layout.pages).startsWith("Quarterly Report"), firstPageText(built.layout.pages).slice(0, 60));
  check("the <br> produced two text lines for one paragraph", (() => {
    const para = built.layout.pages[0].items.filter((i) => i.kind === "text");
    return para.filter((i) => i.runs.some((r) => r.text.includes("Terms & conditions"))).length === 1 && para.some((i) => i.runs.some((r) => r.text.includes("Second line after a break")));
  })());
}
{
  const measure = measurerFor(await embedFonts(await PDFDocument.create()));
  const long = "word ".repeat(400);
  const lines = wrapSpans([{ text: long, style: "regular" }], measure, 10.5, CONTENT_W);
  check("long text wraps into multiple lines", lines.length > 1, `${lines.length} lines`);
  check("every wrapped line fits the measured width", lines.every((l) => l.reduce((w, s) => w + measure.width(s.text, s.style, 10.5), 0) <= CONTENT_W + 0.01));
  const url = { text: "https://example.com/" + "a".repeat(400), style: "regular" };
  const split = wrapSpans([url], measure, 10.5, CONTENT_W);
  check("an unbreakable long string is split instead of overflowing", split.length > 1 && split.every((l) => l.reduce((w, s) => w + measure.width(s.text, s.style, 10.5), 0) <= CONTENT_W + 0.01));
}
{
  const many = parseHtmlToModel(Array.from({ length: 1400 }, (_, i) => `<p>Paragraph number ${i} with a little text in it.</p>`).join(""));
  const longLayout = layoutModel(many, measurerFor(await embedFonts(await PDFDocument.create())));
  check("a long document paginates onto multiple pages", longLayout.pages.length > 3, `${longLayout.pages.length} pages`);
  const capped = layoutModel(many, measurerFor(await embedFonts(await PDFDocument.create())), { maxPages: 3 });
  check("layout stops at the page cap and reports truncation", capped.pages.length === 3 && capped.truncated === true, `${capped.pages.length} pages truncated=${capped.truncated}`);
  const wide = parseHtmlToModel("<table><tr><th>A</th><th>B</th></tr>" + Array.from({ length: 120 }, (_, i) => `<tr><td>row ${i} label</td><td>${"9".repeat(40)}</td></tr>`).join("") + "</table>");
  const wideLayout = layoutModel(wide, measurerFor(await embedFonts(await PDFDocument.create())));
  check("a table taller than a page splits and repeats its header row", wideLayout.pages.length > 1 && wideLayout.pages.slice(1).every((p) => p.items.some((i) => i.kind === "text" && i.runs.some((r) => r.text === "A"))));
}

// ---------------------------------------------------------------- 5. real PDF
{
  const reloaded = await PDFDocument.load(built.bytes);
  check("PDF page count matches the layout", reloaded.getPageCount() === built.layout.pages.length, `${reloaded.getPageCount()} vs ${built.layout.pages.length}`);
  const box = reloaded.getPage(0).getMediaBox();
  check("the page is A4 (595.28 x 841.89)", Math.abs(box.width - A4_WIDTH) < 0.01 && Math.abs(box.height - A4_HEIGHT) < 0.01, `${box.width}x${box.height}`);
}
check("the heading is in the pdfjs text layer", allText.includes("Quarterly Report"), allText.slice(0, 80));
check("the paragraph is in the pdfjs text layer", allText.includes("Revenue grew by 18% in Q3"), allText.slice(0, 160));
check("table header and cell text are in the text layer", allText.includes("Item") && allText.includes("Developer tools subscription") && allText.includes("$29.00"));
check("list bullets and items are in the text layer", allText.includes("\u2022") && allText.includes("First bullet item") && allText.includes("Step two") && allText.includes("1."), allText);
check("the decoded ampersand is in the text layer", allText.includes("Terms & conditions"));
check("the line after <br> is in the text layer", allText.includes("Second line after a break"));
check("the dropped script body is absent from the PDF", !allText.includes("do-not-render") && !allText.includes("secretToken"));
check("the image alt placeholder is in the text layer", allText.includes("[image omitted: Revenue chart]"));
check("the document title is written to the PDF metadata", (await PDFDocument.load(built.bytes)).getTitle() === "Quarterly Report");
check("text is real text, not drawn paths", /TJ|Tj/.test(stream1) && /BT/.test(stream1));
check(
  "the heading is painted with the bold font at 21pt and body text with Helvetica at 10.5pt",
  /\/Helvetica-Bold-\d+ 21 Tf/.test(stream1) && /\/Helvetica-\d+ 10\.5 Tf/.test(stream1),
  (stream1.match(/\/[A-Za-z-]+-\d+ [\d.]+ Tf/g) ?? []).join(" | "),
);
check(
  "no space is inserted before closing punctuation",
  !/Q3 ,/.test(allText) && allText.includes("Q3, and churn fell to 2.1%"),
  allText.slice(0, 200),
);
check(
  "no image XObject is embedded (the output is not rasterized)",
  !/\/Subtype\s*\/Image/.test(Buffer.from(built.bytes).toString("latin1")),
);
{
  const a = await buildPdf(DOC, { title: "Quarterly Report" });
  const b = await buildPdf(DOC, { title: "Quarterly Report" });
  check("the same HTML produces byte-identical PDFs", Buffer.compare(Buffer.from(a.bytes), Buffer.from(b.bytes)) === 0, `${a.bytes.length} vs ${b.bytes.length}`);
  const other = await buildPdf("<h1>Different</h1><p>content</p>", { title: "Other" });
  check("different HTML produces different PDFs", Buffer.compare(Buffer.from(a.bytes), Buffer.from(other.bytes)) !== 0);
}
{
  const tiny = await buildPdf("<p>Only text</p>", { title: "Tiny" });
  check("a one-line document still produces a single page", (await PDFDocument.load(tiny.bytes)).getPageCount() === 1);
  const relayout = layoutModel(tiny.model, measurerFor(await embedFonts(await PDFDocument.create())));
  check("an empty model still lays out one page", layoutModel(parseHtmlToModel(""), measurerFor(await embedFonts(await PDFDocument.create()))).pages.length === 1);
  check("layoutModel reports the cap it was given", relayout.maxPages === MAX_PAGES);
}

// ---------------------------------------------------------------- 6. copy honesty
{
  const toolsEntry = TOOLS.slice(TOOLS.indexOf('slug: "html-to-pdf"') - 60, TOOLS.indexOf('slug: "html-to-pdf"') + 700);
  const lowerTools = toolsEntry.toLowerCase();
  check("tools.ts no longer claims CSS/layout preservation", !/preserves the layout|professional-quality|applies normal css/i.test(lowerTools), toolsEntry.slice(0, 200));
  check("tools.ts describes the text-based output", /text-based|selectable/i.test(toolsEntry));
  const contentEntry = CONTENT.slice(CONTENT.indexOf('"html-to-pdf": {'), CONTENT.indexOf('"html-to-image": {'));
  const lowerContent = contentEntry.toLowerCase();
  check("tool content admits the text-based simplification", /advanced css|simplified|css is ignored|not reproduced/i.test(lowerContent));
  check("tool content no longer claims images and CSS are preserved", !/preserves css styling, images/i.test(lowerContent) && !/handles complex layouts including tables, images, custom css/i.test(lowerContent));
  check("tool content states the 200 KB input cap", /200 ?kb/i.test(lowerContent));
  check("tool content states the 200 page cap", /200 pages/i.test(lowerContent));
  check("tool content states nothing is uploaded", /never leave/i.test(lowerContent) || /not uploaded/i.test(lowerContent));
  check("tool content lists no false feature", !/preview html before converting/i.test(lowerContent));
  const keywords = SEO.slice(SEO.indexOf('"html-to-pdf": ['), SEO.indexOf('"html-to-pdf": [') + 400);
  check("seo keywords include 'html to pdf'", /"html to pdf"/.test(keywords), keywords.slice(0, 160));
  check("seo keywords include 'convert html to pdf online'", /"convert html to pdf online"/.test(keywords), keywords.slice(0, 160));
  check("seo has a custom title for the tool", /"html-to-pdf":\s*"[^"]*html[^"]*pdf/i.test(SEO));
  check("seo feature list has an honest html-to-pdf entry", /"html-to-pdf":\s*\n?\s*"[^"]*selectable/i.test(SEO) && !/"html-to-pdf":\s*"[^"]*preserves css/i.test(SEO));
  const guide = GUIDES.slice(GUIDES.indexOf('slug: "how-to-convert-html-to-pdf"'), GUIDES.indexOf('slug: "how-to-convert-html-to-pdf"') + 2600);
  check("the guide exists and is linked to the tool", guide.includes('toolSlug: "html-to-pdf"'));
  check("the guide describes the text-based conversion", /text-based|selectable/i.test(guide));
  check("the guide drops the false fidelity claim", !/applies normal css|what lands in the final pdf/i.test(guide));
  check("the guide states the caps", /200 ?kb/i.test(guide) && /200 pages/i.test(guide));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
