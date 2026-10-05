// Production-Chrome e2e for "XML Formatter".
//
// The tool's promises are about not corrupting a document: that text, pre blocks,
// CDATA and attribute values come out byte for byte, that both modes reach the same
// verdict, and that the previously-false "Valid XML" badge is gone. So the assertions
// here are made against the exact characters in the output pane and the downloaded
// file, and the two are compared to each other rather than to a UI label.
//
// The caps are read out of src/features/xml-formatter/xml-format.ts at run time, so a
// future cap change makes this harness assert the new number instead of quietly passing
// against a stale literal.
//
//   node e2e/xml-formatter-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/xml-formatter-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and runs this.

import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/xml-formatter`;
const TOOL_PAGE = `${BASE_URL}/tools/xml-formatter`;
const GUIDE_PAGE = `${BASE_URL}/guides/how-to-format-xml-online`;
const DL = "/tmp/xml-formatter-e2e";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(REPO, "src/features/xml-formatter");
const FORMAT_SRC = readFileSync(join(SRC_DIR, "xml-format.ts"), "utf8");
const COMPONENT_SRC = readFileSync(join(SRC_DIR, "XmlFormatter.tsx"), "utf8");

/** The caps, read out of the shipped module rather than guessed here. */
function capConstant(name) {
  const m = new RegExp(`export const ${name} = ([0-9_]+);`).exec(FORMAT_SRC);
  if (!m) throw new Error(`${name} is not declared in xml-format.ts, so this harness cannot assert it`);
  return Number(m[1].replace(/_/g, ""));
}
const MAX_XML_CHARS = capConstant("MAX_XML_CHARS");
const MAX_XML_DEPTH = capConstant("MAX_XML_DEPTH");
const MAX_XML_OUTPUT_CHARS = capConstant("MAX_XML_OUTPUT_CHARS");

const n = (value) => value.toLocaleString("en-US");

/** The Load sample payload, lifted from the component so the two cannot drift. */
const SAMPLE = /const SAMPLE = `([\s\S]*?)`;/.exec(COMPONENT_SRC);
if (!SAMPLE) throw new Error("XmlFormatter.tsx no longer declares a SAMPLE constant");
const SAMPLE_XML = SAMPLE[1];
const SAMPLE_FORMATTED = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  "<users>",
  '  <user id="1">',
  "    <name>Alex</name>",
  "    <active>true</active>",
  "  </user>",
  '  <user id="2">',
  "    <name>Riya</name>",
  "    <enabled>",
  '      <feature flag="dark-mode"/>',
  "    </enabled>",
  "  </user>",
  "</users>",
].join("\n");

// The document whose structure gets re-indented and whose text must not move.
const STRUCTURED = '<users><user id="1"><name>Alex</name></user><user id="2"><name>Riya</name></user></users>';
const STRUCTURED_OUT = [
  "<users>",
  '  <user id="1">',
  "    <name>Alex</name>",
  "  </user>",
  '  <user id="2">',
  "    <name>Riya</name>",
  "  </user>",
  "</users>",
].join("\n");
const STRUCTURED_MIN = '<users><user id="1"><name>Alex</name></user><user id="2"><name>Riya</name></user></users>';

// --------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
function check(ok, label, extra = "") {
  if (ok) {
    passed += 1;
    console.log(`ok  ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.error(`NOT OK  ${label}${extra ? ` \u2014 ${String(extra).slice(0, 400)}` : ""}`);
  }
}
const section = (title) => console.log(`\n--- ${title}`);

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

const consoleIssues = [];
const pageErrors = [];
const offOrigin = [];
const nonGet = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("request", (r) => {
  const url = r.url();
  if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) offOrigin.push(url);
  if (r.method() !== "GET") nonGet.push(`${r.method()} ${url}`);
});

// --------------------------------------------------------------------------
// Locators, all bound to what the component actually renders and all scoped to the
// component's own root, so no assertion can be satisfied by page furniture or by
// another tool's copy.
// --------------------------------------------------------------------------
const tool = () => page.locator("div[aria-busy]").first();
const xmlInput = () => tool().locator('textarea[aria-label="XML input"]');
const outPane = () => tool().locator('textarea[aria-label^="Formatted XML"], textarea[aria-label^="Minified XML"]');
const modeButton = (name) => tool().getByRole("button", { name, exact: true });
const indentSelect = () => tool().getByLabel("Indent", { exact: true });
const stripCheckbox = () => tool().getByLabel("Strip comments", { exact: true });
const loadSample = () => tool().getByRole("button", { name: "Load sample" });
const clearButton = () => tool().getByRole("button", { name: "Clear", exact: true });
const copyButton = () => tool().locator('button[aria-label="Copy XML"]');
const downloadButton = () => tool().locator("button", { hasText: /^Download / });
/** The status badge sits in the row above the OUTPUT textarea, not the input's label. */
const badgeRow = () => tool().locator('p:text-is("Formatted"), p:text-is("Minified")').locator("xpath=..");
const badge = () => badgeRow().locator("span").first();
const liveRegion = () => tool().locator('[role="status"][aria-live="polite"]');
const errorLine = () => tool().locator("p.text-red-700");
const statsLine = () => tool().locator("p", { hasText: /elements, .*comments, nesting/ });
const toolText = () => tool().textContent().then((t) => t || "");

async function settle(ms = 160) {
  await page.waitForTimeout(ms);
}

/** Paste `raw` and wait for the output pane to settle. */
async function paste(raw) {
  await xmlInput().fill(raw);
  await settle();
}

/** Wait for the output pane to hold exactly `expected`, or throw on timeout. */
async function expectOutput(expected, timeout = 20000) {
  await page.waitForFunction(
    (want) => {
      const el = ["Formatted XML", "Minified XML"]
        .map((l) => document.querySelector(`textarea[aria-label="${l}"]`))
        .find(Boolean);
      return !!el && el.value === want;
    },
    expected,
    { timeout },
  );
  return outPane().inputValue();
}

async function shown() {
  return outPane().inputValue();
}

async function download(saveAs, timeout = 60000) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), downloadButton().click()]);
  await dl.saveAs(`${DL}/${saveAs}`);
  await settle();
  return { name: dl.suggestedFilename(), text: readFileSync(`${DL}/${saveAs}`, "utf8") };
}

try {
  // =========================================================== the empty boot ===
  section("the empty boot state");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(400);

  check(page.url().includes("/use/xml-formatter"), "the tool route renders", page.url());
  check((await xmlInput().count()) === 1, "there is exactly one XML input");
  check((await xmlInput().inputValue()) === "", "the XML input boots empty, with no sample pre-filled");
  check((await outPane().inputValue()) === "", "the output pane is empty before anything is pasted");
  check(await clearButton().isDisabled(), "Clear is disabled while there is nothing to clear");
  check(await copyButton().isDisabled(), "Copy is disabled before anything is produced");
  check((await downloadButton().count()) === 1 && (await downloadButton().isDisabled()), "Download is present and disabled before anything is produced");
  check((await tool().getAttribute("aria-busy")) === "false", "the root reports aria-busy false, because nothing is pending");
  check(
    /Nothing to check/.test((await badge().textContent()) || ""),
    "an empty box says Nothing to check rather than claiming well-formedness",
    await badge().textContent(),
  );

  section("the empty box makes no claim about validity");
  const boot = await toolText();
  check(!/\bValid XML\b/.test(boot), "the panel never says Valid XML, which the old code asserted for an empty box");
  check(!/syntax highlighting|highlight/i.test(boot), "the panel makes no syntax-highlighting claim");
  check(!/self-closing tag normalization|normaliz/i.test(boot), "the panel makes no normalization claim");
  check(/well-formed/i.test(boot), "the panel uses the word well-formed");
  check(boot.includes(`${n(MAX_XML_CHARS)} characters`), "the hint quotes the input cap from the module's own constant");
  check(boot.includes(`${n(MAX_XML_DEPTH)} levels`), "the hint quotes the nesting cap");
  check(boot.includes(`${n(MAX_XML_OUTPUT_CHARS)} characters of output`), "the hint quotes the output cap");
  check(/nothing is pre-filled/i.test(await xmlInput().getAttribute("placeholder") || ""), "the placeholder says nothing is pre-filled");
  check(/Nothing to check/.test((await liveRegion().textContent()) || ""), "the live region says there is nothing to check", await liveRegion().textContent());

  section("the live region announces counts only, never the document");
  await paste("<secret><token>abc123</token></secret>");
  await settle(300);
  const announced = (await liveRegion().textContent()) || "";
  check(announced.length > 0, "the live region speaks once there is a result", announced);
  check(!/abc123|<token>|secret/i.test(announced), "and it does not read the reader's own XML back", announced);
  check(/\d+ elements/.test(announced) && /levels deep/.test(announced), "it reports element and depth counts", announced);
  await paste("<a><b></a>");
  await settle(300);
  const badAnnounced = (await liveRegion().textContent()) || "";
  check(/Not well-formed/.test(badAnnounced), "a refusal is announced as such", badAnnounced);
  check(/Nothing was changed/.test(badAnnounced), "and it says nothing was changed", badAnnounced);
  check(!/abc123|<token>/i.test(badAnnounced), "without quoting the document back", badAnnounced);

  section("accessibility, before anything is pasted");
  check((await indentSelect().count()) === 1, "the indent select is reachable by its visible label");
  check((await stripCheckbox().count()) === 1, "the strip-comments checkbox is reachable by its visible label");
  for (const name of ["Format", "Minify"]) {
    const b = modeButton(name);
    check((await b.count()) === 1, `the ${name} mode button exists`);
    check((await b.getAttribute("aria-pressed")) !== null, `the ${name} button exposes aria-pressed`);
  }
  check((await modeButton("Format").getAttribute("aria-pressed")) === "true", "Format is the pressed mode at boot");
  check((await modeButton("Minify").getAttribute("aria-pressed")) === "false", "Minify is not pressed at boot");
  check((await outPane().getAttribute("readonly")) !== null, "the output pane is read-only");
  check((await outPane().getAttribute("tabindex")) === "-1", "the output pane is out of the tab order");
  check((await xmlInput().getAttribute("spellcheck")) === "false", "the input does not invite spellcheck on data");

  // =========================================================== load sample ===
  section("Load sample");
  await loadSample().click();
  await settle(300);
  check((await xmlInput().inputValue()).length > 0, "Load sample fills the input");
  check((await xmlInput().inputValue()) === SAMPLE_XML, "and it matches the sample the component declares");
  check(!(await clearButton().isDisabled()), "Clear becomes enabled");
  const sampleOut = await expectOutput(SAMPLE_FORMATTED);
  check(sampleOut === SAMPLE_FORMATTED, "the sample is re-indented to the exact expected layout", JSON.stringify(sampleOut));
  check(/Well-formed/.test(await badge().textContent() || ""), "the badge says Well-formed", await badge().textContent());
  check(!/\bValid XML\b/.test(boot + (await toolText())), "the badge never claims schema validity");

  section("the statistics under the output are real");
  const stats = await statsLine().textContent();
  const elements = Number(/(\d[\d,]*) elements/.exec(stats || "")?.[1].replace(/,/g, "") ?? "0");
  check(elements > 0, "the element count is reported", String(elements));
  check(/\d[\d,]* comments/.test(stats || ""), "the comment count is reported", String(stats));
  check(/nesting [\d,]+/.test(stats || ""), "the nesting depth is reported", String(stats));

  // =========================================================== formatting ===
  section("Format re-indents element-only structure");
  await paste(STRUCTURED);
  const formatted = await expectOutput(STRUCTURED_OUT);
  check(formatted === STRUCTURED_OUT, "a minified element-only document comes out indented two spaces", JSON.stringify(formatted));
  check(formatted.split("\n").length === 8, "across eight lines", String(formatted.split("\n").length));

  section("the indent choices are real");
  await indentSelect().selectOption("4");
  await settle();
  const four = await shown();
  check(four.includes("\n    <user id=\"1\">"), "four spaces is honoured", JSON.stringify(four));
  await indentSelect().selectOption("1");
  await settle();
  check((await shown()).includes("\n <user id=\"1\">"), "one space is honoured", JSON.stringify(await shown()));
  await indentSelect().selectOption("tab");
  await settle();
  const tabbed = await shown();
  check(tabbed.includes("\n\t<user id=\"1\">"), "the tab option emits a real tab", JSON.stringify(tabbed));
  check(!tabbed.includes("\\t"), "and not a backslash-t", JSON.stringify(tabbed));
  await indentSelect().selectOption("2");
  await settle();
  check((await shown()) === STRUCTURED_OUT, "going back to two spaces restores the expected output");

  // =========================================================== text is sacred ===
  section("text, pre blocks and CDATA are never rewritten");
  /**
   * The promise is about text, not about the whole document. An element whose children
   * are all elements still gets re-indented, so `<a><pre>...</pre></a>` legitimately
   * comes back across three lines — what must survive byte for byte is the text inside
   * the element that holds it. Each case therefore names the exact expected output, so a
   * formatter that quietly re-wrapped a pre block would fail on the string, not pass on
   * a looser substring test.
   */
  const TEXT_CASES = [
    ["a pre block", "<a><pre>  keep\n  me  </pre></a>", "<a>\n  <pre>  keep\n  me  </pre>\n</a>", "  keep\n  me  "],
    ["mixed content", "<a>hello <b>world</b> there</a>", "<a>hello <b>world</b> there</a>", "hello <b>world</b> there"],
    ["a spaced paragraph", "<p>Hello <b>world</b> ,  ok</p>", "<p>Hello <b>world</b> ,  ok</p>", "Hello <b>world</b> ,  ok"],
    ["text only", "<a>  spaced  text  </a>", "<a>  spaced  text  </a>", "  spaced  text  "],
    ["CDATA", "<a><![CDATA[ <not> a tag ]]></a>", "<a><![CDATA[ <not> a tag ]]></a>", "<![CDATA[ <not> a tag ]]>"],
    ["nested mixed content", "<a><p>x <b>y</b> z</p></a>", "<a>\n  <p>x <b>y</b> z</p>\n</a>", "x <b>y</b> z"],
    ["an entity in text", "<a>a &amp; b</a>", "<a>a &amp; b</a>", "a &amp; b"],
    ["an attribute value with a >", '<a title="a > b">t</a>', '<a title="a > b">t</a>', 'title="a > b"'],
    ["text beside an element child", "<a>before<pre>  raw  </pre>after</a>", "<a>before<pre>  raw  </pre>after</a>", "before<pre>  raw  </pre>after"],
  ];
  for (const [label, src, want, needle] of TEXT_CASES) {
    await paste(src);
    const out = await expectOutput(want);
    check(out === want, `${label} formats exactly as promised`, JSON.stringify(out));
    check(out.includes(needle), `${label} keeps its text exactly`, JSON.stringify(out));
  }
  // And the same in Minify, where whitespace between elements *should* go.
  await modeButton("Minify").click();
  await settle(250);
  for (const [label, src, , needle] of TEXT_CASES) {
    await paste(src);
    await settle();
    const out = await shown();
    check(out.includes(needle), `${label} keeps its text in Minify too`, JSON.stringify(out));
    check(!/\n\s{2,}</.test(out), `${label} has no inter-element indentation left in Minify`, JSON.stringify(out));
  }
  await paste('<a><pre>  keep\n  me  </pre></a>');
  await settle(250);
  check((await shown()) === "<a><pre>  keep\n  me  </pre></a>", "Minify compacts around a pre block but keeps the pre text", JSON.stringify(await shown()));
  await modeButton("Format").click();
  await settle(250);

  // =========================================================== minify works ===
  section("Minify removes whitespace between elements");
  // The same document in both shapes, so the only difference between the two outputs is
  // the whitespace. That is the mode doing something, rather than the input differing.
  await modeButton("Minify").click();
  await settle(200);
  await paste(STRUCTURED_OUT);
  const minified = await expectOutput(STRUCTURED_MIN);
  check(minified === STRUCTURED_MIN, "a pretty-printed document compacts to the single-line form", JSON.stringify(minified));
  check(minified.length < STRUCTURED_OUT.length, "and is shorter than what went in", `${minified.length} vs ${STRUCTURED_OUT.length}`);
  check(/\n/.test(STRUCTURED_OUT) && !/\n/.test(minified), "the newlines are what went away");
  check(await page.locator('textarea[aria-label="Minified XML"]').count() === 1, "the output pane is relabelled for Minify");
  check((await modeButton("Minify").getAttribute("aria-pressed")) === "true", "Minify is the pressed mode while it is selected");

  // =========================================================== the refusals ===
  section("the previously-false positives");
  const MUST_REFUSE = [
    ["two root elements", "<a/><b/>"],
    ["an unquoted attribute value", "<a href=x/>"],
    ["a duplicate attribute", '<a x="1" x="2"/>'],
    ["an undeclared entity", "<a>&nope;</a>"],
    ["bare text with no markup", "hello"],
    ["text after the root", "<a>text</a>trailing"],
    ["crossed tags", "<a><b></a></b>"],
    ["an unclosed root", "<a>"],
    ["an invalid element name", "<1a/>"],
    ["a declaration that is not at the start", '<r><?xml version="1.0"?></r>'],
    ["markup inside an attribute value", '<a b="<c/>"/>'],
  ];
  for (const [label, src] of MUST_REFUSE) {
    await modeButton("Format").click();
    await settle(150);
    await paste(src);
    await settle(250);
    const text = await toolText();
    check(/not well-formed|well-formed/i.test(text), `${label} is judged rather than ignored`, text.slice(0, 160));
    check(!/\bValid XML\b/.test(text), `${label} is never reported as valid`);
    check((await shown()) === "", `${label} produces no output to copy`, JSON.stringify(await shown()));
    check(await copyButton().isDisabled(), `Copy stays disabled for ${label}`);
    check(await downloadButton().isDisabled(), `Download stays disabled for ${label}`);
    check((await errorLine().count()) === 1, `${label} reports an error line`, String(await errorLine().count()));
    check(
      /Line [\d,]+, column [\d,]+\./.test(text),
      `${label} reports a line and a column`,
      text.slice(0, 220),
    );
    check(!/expected <\/undefined>/.test(text), `${label} avoids the old malformed message`);
  }

  section("Minify reaches the same verdict as Format");
  for (const [, src] of MUST_REFUSE) {
    for (const mode of ["Format", "Minify"]) {
      await modeButton(mode).click();
      await settle(150);
      await paste(src);
      await settle(220);
      const text = await toolText();
      check(/not well-formed/i.test(text), `${mode} refuses ${JSON.stringify(src).slice(0, 26)}`, text.slice(0, 140));
      check((await shown()) === "", `${mode} produces nothing for ${JSON.stringify(src).slice(0, 26)}`);
    }
  }

  // =========================================================== comments ===
  section("comments are kept unless you ask otherwise");
  const COMMENTED = "<a>\n  <!-- c -->\n  <b/>\n</a>";
  const COMMENTED_STRIPPED = "<a>\n  <b/>\n</a>";
  const COMMENTED_MIN = "<a><!-- c --><b/></a>";
  await modeButton("Format").click();
  await settle(150);
  await paste("<a><!-- c --><b/></a>");
  const kept = await expectOutput(COMMENTED);
  check(kept.includes("<!-- c -->"), "comments are kept by default", JSON.stringify(kept));
  check(kept === COMMENTED, "and re-indented onto their own line", JSON.stringify(kept));
  await stripCheckbox().check();
  await settle(300);
  check((await shown()) === COMMENTED_STRIPPED, "ticking Strip comments removes them", JSON.stringify(await shown()));
  await stripCheckbox().uncheck();
  await settle(250);
  check((await shown()) === COMMENTED, "and unticking restores them", JSON.stringify(await shown()));

  section("Strip comments also applies in Minify");
  await modeButton("Minify").click();
  await settle(150);
  await paste(COMMENTED);
  const minKept = await expectOutput(COMMENTED_MIN);
  check(minKept.includes("<!-- c -->"), "Minify keeps comments by default", JSON.stringify(minKept));
  await stripCheckbox().check();
  await settle(300);
  check((await shown()) === "<a><b/></a>", "and removes them when asked", JSON.stringify(await shown()));
  await stripCheckbox().uncheck();
  await modeButton("Format").click();
  await settle(150);

  // =========================================================== clipboard & download ===
  section("Copy puts the exact output on the clipboard");
  await paste(STRUCTURED);
  await expectOutput(STRUCTURED_OUT);
  await copyButton().click();
  await settle(250);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip === STRUCTURED_OUT, "the clipboard holds the same characters as the pane", JSON.stringify(clip));

  section("Download writes the same characters as a .xml file");
  const dl = await download("formatted.xml");
  check(dl.name === "formatted.xml", "the suggested filename is .xml", dl.name);
  check(dl.text === STRUCTURED_OUT, "the downloaded file matches the pane byte for byte", JSON.stringify(dl.text.slice(0, 120)));
  await modeButton("Minify").click();
  await settle(200);
  await paste(STRUCTURED_OUT);
  const minDl = await download("minified.xml");
  check(minDl.text === STRUCTURED_MIN, "the minified download is the compact form", JSON.stringify(minDl.text.slice(0, 120)));
  await modeButton("Format").click();
  await settle(200);

  // =========================================================== caps ===
  section("the caps are refused with their real numbers");
  const huge = "<r>" + "x".repeat(MAX_XML_CHARS + 10) + "</r>";
  await xmlInput().fill(huge);
  await settle(600);
  const hugeText = await toolText();
  check(/limit|refus/i.test(hugeText), "an over-long document is refused", hugeText.slice(0, 200));
  check(hugeText.includes(n(huge.length)), "the refusal quotes the real size", hugeText.slice(0, 240));
  check(hugeText.includes(n(MAX_XML_CHARS)), "and the real cap", hugeText.slice(0, 240));
  check((await shown()) === "", "nothing is produced for an over-long document");
  check(await copyButton().isDisabled(), "Copy stays disabled for an over-long document");

  const deep = "<r>" + "<a>".repeat(MAX_XML_DEPTH + 5) + "x" + "</a>".repeat(MAX_XML_DEPTH + 5) + "</r>";
  await xmlInput().fill(deep);
  await settle(600);
  const deepText = await toolText();
  check(/nest|refus|limit/i.test(deepText), "a too-deep document is refused", deepText.slice(0, 200));
  check(deepText.includes(n(MAX_XML_DEPTH)), "and the refusal quotes the real depth cap", deepText.slice(0, 240));
  check((await shown()) === "", "nothing is produced for a too-deep document");

  section("a large document just under the cap still works");
  const bigInner = Array.from({ length: 1200 }, (_, i) => `<item id="${i}"><name>n${i}</name></item>`).join("");
  const big = `<catalog>${bigInner}</catalog>`;
  check(big.length < MAX_XML_CHARS, "the fixture is under the cap", String(big.length));
  const started = Date.now();
  await xmlInput().fill(big);
  await page.waitForFunction(
    (want) => {
      const el = document.querySelector('textarea[aria-label="Formatted XML"]');
      return !!el && el.value.length > want;
    },
    big.length,
    { timeout: 30000 },
  );
  const elapsed = Date.now() - started;
  const bigOut = await shown();
  check(bigOut.length > big.length, "the large document produced output");
  check(bigOut.includes("\n  <item id=\"0\">"), "and it is indented", JSON.stringify(bigOut.slice(0, 80)));
  check(elapsed < 15000, "within a reasonable time", `${elapsed}ms for ${big.length} chars`);

  // =========================================================== privacy ===
  section("the document never leaves the browser");
  check(offOrigin.length === 0, "no request went off-origin", offOrigin.join(", "));
  check(nonGet.length === 0, "no non-GET request was made", nonGet.join(", "));

  // =========================================================== the wider page ===
  section("the tool page and the guide");
  await page.goto(TOOL_PAGE, { waitUntil: "networkidle" });
  await settle(300);
  const toolPageText = (await page.textContent("body")) || "";
  check(/well-formed/i.test(toolPageText), "the tool page uses the word well-formed");
  check(/Validator/i.test(toolPageText) === false || /Well-Formness/.test(toolPageText), "the tool page is not named Validator");
  check(/syntax highlighting/i.test(toolPageText) === false, "the tool page makes no highlighting claim");
  check(/handles all xml constructs correctly/i.test(toolPageText) === false, "the tool page drops the all-constructs claim");
  check(/self-closing tag normalization/i.test(toolPageText) === false, "the tool page drops the normalization claim");
  check(/browser|client-side/i.test(toolPageText), "the tool page states the processing location");
  check(/DTD|schema/i.test(toolPageText), "the tool page addresses DTD validation rather than ignoring it");

  await page.goto(GUIDE_PAGE, { waitUntil: "networkidle" });
  await settle(300);
  const guideText = (await page.textContent("body")) || "";
  check(/well-formed/i.test(guideText), "the guide is about well-formedness");
  check(/byte for byte|byte-for-byte/i.test(guideText), "the guide states the text-preservation promise");
  check(guideText.includes("200,000 characters"), "the guide quotes the input cap");
  check(!/syntax highlighting/i.test(guideText), "the guide makes no highlighting claim");
  check(/does not fetch|not fetched|no schema/i.test(guideText) || /does not do it/i.test(guideText), "the guide says schema validation is not done");
  check(await page.getByRole("link", { name: /XML Formatter/i }).count() > 0, "the guide links to the tool");

  // =========================================================== the rail and sitemap ===
  section("the tool is reachable from the site");
  // The tools index paginates, so the registry page is checked directly rather than
  // depending on which page the tool happens to land on.
  await page.goto(`${BASE_URL}/tools/xml-formatter`, { waitUntil: "networkidle" });
  await settle(300);
  const registryText = (await page.textContent("body")) || "";
  check(/XML Formatter/.test(registryText), "the registry page names the tool");
  check(/byte for byte|byte-for-byte/i.test(registryText), "the registry page states the text-preservation promise");
  check(/well-formed/i.test(registryText), "the registry page uses the word well-formed");

  const sm = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check(sm.ok(), "the sitemap responds", String(sm.status()));
  const smText = await sm.text();
  check(smText.includes("/tools/xml-formatter"), "the registry page is in the sitemap");
  check(smText.includes("/guides/how-to-format-xml-online"), "the guide is in the sitemap");

  // =========================================================== hygiene ===
  section("no hydration or runtime errors anywhere in that session");
  check(consoleIssues.length === 0, "no hydration warnings", consoleIssues.slice(0, 3).join(" | "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 3).join(" | "));
} catch (err) {
  failed += 1;
  failures.push(`harness threw: ${err.message}`);
  console.error(`\nHARNESS ERROR: ${err.stack}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed ? 1 : 0);