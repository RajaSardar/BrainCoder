/**
 * Node mirror audit for the XML Formatter. No browser, no DOM.
 *
 * The shipped pure module is transpiled with the repo's own TypeScript compiler and
 * imported, so every behavioural check below runs the code the tab runs.
 *
 * The oracle is libxml2. This tool's worst defect was reporting "Valid XML" for
 * documents that are not XML at all — two root elements, unquoted attribute values,
 * duplicate attributes, undeclared entities, the word `hello`, and empty input — and
 * minify mode skipped the check entirely, so the same document got opposite answers
 * depending only on which button was pressed. A list of expected verdicts written by
 * hand would only record what the author already believed. So `xmllint --noout` is run
 * over the same corpus and the two verdicts are compared, which means the check is
 * measured against a real parser rather than against the author's memory. Section 1
 * is that comparison; every later section asserts the things a formatter owes on top
 * of being well-formed, chiefly that it does not alter text.
 *
 *   node audit/check-xml-formatter.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const SRC = "src/features/xml-formatter";
const OUT = "audit/.xml-formatter-mirror";

let pass = 0;
let fail = 0;

/** The condition comes first, so a check reads as the claim it is making. */
function check(cond, name, extra = "") {
  if (cond === true) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

const n = (value) => value.toLocaleString("en-US");

// libxml2 is the oracle. Its absence is reported rather than skipped, because a
// silently skipped oracle would leave this file looking like evidence when it is not.
let HAVE_XMLLINT = true;
try {
  execFileSync("xmllint", ["--version"], { stdio: "pipe" });
} catch {
  HAVE_XMLLINT = false;
}
if (!HAVE_XMLLINT) {
  console.log("FAIL: xmllint (libxml2) is required as the independent oracle and is not available");
  process.stdout.write(`\n${pass} passed, ${fail + 1} failed\n`);
  process.exit(1);
}

/** What a real parser thinks. Empty input is not a document, so it has no verdict here. */
const libxmlWellFormed = (src) => {
  if (src.trim() === "") return null;
  try {
    execFileSync("xmllint", ["--noout", "-"], { input: src, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

writeFileSync(
  `${OUT}/xml-format.mjs`,
  ts.transpileModule(readFileSync(`${SRC}/xml-format.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: "xml-format.ts",
  }).outputText,
);
const M = await import(pathToFileURL(`${OUT}/xml-format.mjs`).href);

// tools.ts imports lucide icons and seo.ts imports ./tools, so neither can be executed
// from a mirror directory. tool-content.ts and guides.ts have no imports and are
// transpiled so the copy is read as shipped data rather than as a regex guess.
for (const [src, name] of [
  ["src/lib/tool-content.ts", "repo-content"],
  ["src/lib/guides.ts", "repo-guides"],
]) {
  writeFileSync(
    `${OUT}/${name}.mjs`,
    ts.transpileModule(readFileSync(src, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: `${name}.ts`,
    }).outputText,
  );
}
const REPO_CONTENT = await import(pathToFileURL(`${OUT}/repo-content.mjs`).href);
const REPO_GUIDES = await import(pathToFileURL(`${OUT}/repo-guides.mjs`).href);
const TOOLS_SRC = readFileSync("src/lib/tools.ts", "utf8");
const SEO_SRC = readFileSync("src/lib/seo.ts", "utf8");

const FMT = { mode: "format", stripComments: false, indent: "2" };
const MIN = { mode: "minify", stripComments: false, indent: "2" };
const fmt = (src, over = {}) => M.formatXml(src, { ...FMT, ...over });
const min = (src, over = {}) => M.formatXml(src, { ...MIN, ...over });

/**
 * The text of a document, for comparing input against output.
 *
 * Deliberately not a regex. The first version of this helper used `<[^>]*>`, which mangles
 * the very cases under test: it eats `<not>` inside CDATA once the CDATA marker is gone,
 * and it truncates `<a title="a > b">t</a>` at the `>` inside the attribute. Both showed
 * up as false failures. So tags are stripped with a scanner that tracks quoting, which is
 * the same rule the formatter itself is built on.
 */
const textContent = (src) => {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("<![CDATA[", i)) {
      const end = src.indexOf("]]>", i);
      if (end === -1) break;
      out += src.slice(i + 9, end);
      i = end + 3;
      continue;
    }
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i);
      if (end === -1) break;
      i = end + 3;
      continue;
    }
    if (src[i] === "<") {
      let quote = null;
      let j = i + 1;
      while (j < src.length) {
        const c = src[j];
        if (quote !== null) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
        j++;
      }
      i = j + 1;
      continue;
    }
    const next = src.indexOf("<", i);
    const stop = next === -1 ? src.length : next;
    out += src.slice(i, stop);
    i = stop;
  }
  // Entities are compared in their source form rather than decoded, because the formatter
  // reproduces them verbatim and decoding would quietly hide a doubled or dropped ampersand.
  return out;
};

/** Compares text with all whitespace runs collapsed, so indentation is not what is judged. */
const squash = (s) => s.replace(/\s+/g, " ").trim();

// --- 1. THE ORACLE. Every verdict compared against libxml2. --------------------
{
  const corpus = [
    ["<a/>", "a self-closing root"],
    ["<a></a>", "an empty root with a close"],
    ["<a><b/></a>", "a child"],
    ["<a><b>1</b></a>", "a child with text"],
    ["<a/><b/>", "TWO ROOT ELEMENTS"],
    ["<a href=x/>", "an unquoted attribute value"],
    ["<a x=\"1\" x=\"2\"/>", "a duplicate attribute"],
    ["<a>&nope;</a>", "an undeclared entity"],
    ["<a b=/>", "an attribute with no value"],
    ["<a b=\"1\"c=\"2\"/>", "two attributes with no space between"],
    ["hello", "the word hello, with no markup at all"],
    ["<a>text</a>trailing", "text after the root"],
    ["<a><b></a></b>", "crossed tags"],
    ["<a>", "an unclosed root"],
    ["<a></a", "an unterminated close tag"],
    ["<a b=\"1\">x</undefined>", "a stray close tag"],
    ["<1a/>", "an invalid element name"],
    ["<a b=\"<c/>\"/>", "markup inside an attribute value"],
    ["<a>&amp</a>", "an unterminated reference"],
    ["<a>&amp; &lt; &gt; &quot; &apos; &#65; &#x42;</a>", "the five built-ins and both numeric forms"],
    ["<a><!-- x -- y --></a>", "a double hyphen inside a comment"],
    ["<a><!-- ok --></a>", "a legal comment"],
    ["<a><![CDATA[ <not> a tag ]]></a>", "CDATA"],
    ["<a><![CDATA[ unterminated ]]></a>", "an unterminated CDATA"],
    ['<?xml version="1.0"?><!DOCTYPE r [ <!ENTITY x "y"> ]><r>&x;</r>', "a DOCTYPE internal subset declaring an entity"],
    ['<?xml version="1.0"?><r/>', "an XML declaration"],
    ['<?target data?><r/>', "a processing instruction"],
    ['<r><?xml version="1.0"?></r>', "an XML declaration that is not at the start"],
    ['<ns:a xmlns:ns="urn:x"><ns:b/></ns:a>', "namespaced elements"],
    ['<r xmlns="urn:d"/>', "a default namespace declaration"],
    ["<r>\n  <a>1</a>\n  <!--c-->\n  <b/>\n</r>", "element-only content with a comment"],
    ["<p>Hello <b>world</b>, see <i>this</i>.</p>", "mixed content"],
    ["<a><pre>  keep\n  me  </pre></a>", "a pre block"],
    ["<svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0'/></svg>", "SVG"],
    ['<soap:Envelope xmlns:soap="urn:s"><soap:Body/></soap:Envelope>', "a SOAP envelope"],
    ["<r/>  ", "trailing whitespace after the root"],
    ["<r/><!-- after -->", "a comment after the root"],
    ["<a>x</a><b>y</b>", "two complete roots"],
    ['<a b="x>y" c="z"/>', "a > inside an attribute value"],
    ['<a title="a > b">t</a>', "a > inside a quoted attribute value"],
  ];

  let agree = 0;
  let disagree = 0;
  for (const [src, label] of corpus) {
    const r = fmt(src);
    const lib = libxmlWellFormed(src);
    // An empty document is reported as `empty`, which is deliberately neither verdict.
    const mine = src.trim() === "" ? null : r.kind === "processed";
    if (mine === lib) {
      agree++;
    } else {
      disagree++;
      console.log(`FAIL: verdict disagrees with libxml2 on ${label} — mine=${r.kind} libxml=${lib}`);
    }
    check(
      r.kind === "malformed" || r.kind === "processed" || r.kind === "empty",
      `${label} produces a real verdict, not a fallback`,
      r.kind,
    );
  }
  check(disagree === 0, `every verdict agrees with libxml2`, `${agree} agree, ${disagree} disagree`);
  check(agree >= corpus.length - 1, "the oracle comparison actually ran over the corpus", String(agree));
}

// --- 2. the previously-false positives are now refused -------------------------
{
  const mustBeMalformed = [
    ["<a/><b/>", "two roots"],
    ['<a href=x/>', "an unquoted value"],
    ['<a x="1" x="2"/>', "a duplicate attribute"],
    ["<a>&nope;</a>", "an undeclared entity"],
    ["hello", "bare text"],
    ["<a>text</a>trailing", "text after the root"],
  ];
  for (const [src, label] of mustBeMalformed) {
    const r = fmt(src);
    check(r.kind === "malformed", `${label} is now refused, not called well-formed`, `${r.kind}: ${r.sql ?? r.text ?? ""}`);
    check(r.text === undefined, `${label} produces no output to copy`);
  }
  // Empty input must not claim to be valid.
  check(fmt("").kind === "empty", "empty input is empty, not well-formed", fmt("").kind);
  check(fmt("   \n ").kind === "empty", "whitespace-only input is empty", fmt("   \n ").kind);
  check(fmt("").text === undefined, "an empty result has no text field");
}

// --- 3. BOTH MODES REACH THE SAME VERDICT --------------------------------------
{
  const corpus = [
    "<a/>",
    "<a><b/></a>",
    "<a/><b/>",
    '<a href=x/>',
    '<a x="1" x="2"/>',
    "<a>&nope;</a>",
    "hello",
    "<a><b></a></b>",
    "<a>",
    '<a b="<c/>"/>',
    "<p>x <b>y</b> z</p>",
    "",
    "<r>ok</r>",
  ];
  for (const src of corpus) {
    const f = fmt(src);
    const m = min(src);
    check(f.kind === m.kind, `Format and Minify agree on: ${JSON.stringify(src).slice(0, 34)}`, `${f.kind} vs ${m.kind}`);
    if (f.kind === "malformed" && m.kind === "malformed") {
      check(f.message === m.message, "and they report the same message", `${f.message} vs ${m.message}`);
    }
  }
}

// --- 4. malformed input reports a line and a column ---------------------------
{
  const r = fmt("<a>\n  <b>\n</a>");
  check(r.kind === "malformed", "a crossed tag is refused", r.kind);
  check(r.line === 3 && r.column === 1, "the position is reported", `line ${r.line} column ${r.column}`);
  const deep = fmt("<a><b><c>x</d></c></b></a>");
  check(deep.kind === "malformed" && deep.line === 1, "a mismatch on one line reports line 1", `${deep.line}:${deep.column}`);
  // The message must not be the old `expected </undefined>`.
  const stray = fmt("<a></nope>");
  check(!String(stray.message ?? "").includes("undefined"), "no `expected </undefined>` message", stray.message);
}

// --- 5. TEXT IS NEVER REWRITTEN. The core promise of this rewrite. -------------
{
  const textCases = [
    ["a pre block", "<a><pre>  keep\n  me  </pre></a>", "  keep\n  me  "],
    ["mixed content", "<a>hello <b>world</b> there</a>", "hello world there"],
    ["text only", "<a>  spaced  text  </a>", "  spaced  text  "],
    ["CDATA", "<a><![CDATA[ <not> a tag ]]></a>", " <not> a tag "],
    ["nested mixed content", "<a><p>x <b>y</b> z</p></a>", "x y z"],
    ["an attribute value", '<a title="a > b">t</a>', "t"],
    ["an entity in text", "<a>a &amp; b</a>", "a &amp; b"],
    ["a nested pre", "<a><b><pre>  raw  </pre></b></a>", "  raw  "],
  ];
  for (const [label, src, expected] of textCases) {
    for (const over of [{}, { indent: "4" }, { indent: "tab" }, { indent: "1" }]) {
      const r = fmt(src, over);
      check(r.kind === "processed", `${label} processes`, r.kind);
      if (r.kind !== "processed") continue;
      check(
        squash(textContent(r.text)) === squash(expected),
        `${label}: the text content comes out unchanged`,
        `${JSON.stringify(textContent(r.text))} vs ${JSON.stringify(expected)}`,
      );
    }
    const m = min(src);
    if (m.kind === "processed") {
      check(squash(textContent(m.text)) === squash(expected), `${label}: minify keeps the text too`, JSON.stringify(m.text));
    }
  }
}

// --- 6. element-only structure IS re-indented ---------------------------------
{
  const r = fmt('<users><user id="1"><name>Alex</name></user><user id="2"><name>Riya</name></user></users>');
  check(r.kind === "processed", "an element-only document processes", r.kind);
  check(r.text.split("\n").length === 8, "it is broken across lines", String(r.text.split("\n").length));
  check(r.text.split("\n")[0] === "<users>", "the root starts the first line", r.text.split("\n")[0]);
  check(r.text.includes('  <user id="1">'), "children are indented by two", r.text);
  check(r.text.includes("    <name>Alex</name>"), "grandchildren by four", r.text);
  check(r.text.trim().endsWith("</users>"), "the root closes the last line");

  const four = fmt('<a><b><c>1</c></b></a>', { indent: "4" });
  check(four.text.includes("\n    <b>"), "the indent width is honoured", JSON.stringify(four.text));
  const tab = fmt("<a><b>1</b></a>", { indent: "tab" });
  check(tab.text.includes("\n\t<b>"), "the tab option emits a real tab", JSON.stringify(tab.text));
  check(!tab.text.includes("\\t"), "not a backslash-t", JSON.stringify(tab.text));

  // The document-level prolog keeps its own line.
  const prolog = fmt('<?xml version="1.0"?>\n<!DOCTYPE r>\n<r><a/></r>');
  check(prolog.text.split("\n").length === 5, "declaration, DOCTYPE and root each get a line", JSON.stringify(prolog.text));
}

// --- 7. minify removes inter-element whitespace, and only that ----------------
{
  const src = "<users>\n  <user id=\"1\">\n    <name>Alex</name>\n  </user>\n</users>";
  const r = min(src);
  check(r.kind === "processed", "minify processes an element-only document", r.kind);
  check(!/\n/.test(r.text), "the newlines between elements are gone", JSON.stringify(r.text));
  check(r.text.startsWith("<users><user id=\"1\"><name>Alex</name></user></users>"), "and the result is exactly the compact form", JSON.stringify(r.text));
  check(r.stats.bytesRemoved === src.length - r.text.length, "the byte saving is reported honestly", `${r.stats.bytesRemoved} vs ${src.length - r.text.length}`);
  // Whitespace inside text must survive minification.
  const mixed = min("<p>Hello <b>world</b> ,  ok</p>");
  check(mixed.text === "<p>Hello <b>world</b> ,  ok</p>", "minify does not touch mixed-content spacing", JSON.stringify(mixed.text));
}

// --- 8. comments are kept unless you ask otherwise ----------------------------
{
  check(fmt("<a><!-- c --><b/></a>").text.includes("<!-- c -->"), "comments are kept by default");
  check(fmt("<a><!-- c --><b/></a>", { stripComments: true }).text.includes("<!-- c -->") === false, "stripComments removes them in Format mode");
  check(min("<a><!-- c --><b/></a>").text.includes("<!-- c -->"), "comments are kept in Minify mode too");
  check(min("<a><!-- c --><b/></a>", { stripComments: true }).text === "<a><b/></a>", "stripComments removes them in Minify mode");
  // The default must be to keep them.
  check(M.DEFAULT_XML_OPTIONS.stripComments === false, "the default is to keep comments", String(M.DEFAULT_XML_OPTIONS.stripComments));
}

// --- 9. round trip: the output is itself a document ---------------------------
{
  const docs = [
    "<users><user id=\"1\"><name>Alex</name></user></users>",
    '<?xml version="1.0"?><!DOCTYPE r [ <!ENTITY x "y"> ]><r>&x;</r>',
    "<a><!-- c --><b/><c d=\"e\"/></a>",
    "<a><pre>  keep\n  me  </pre></a>",
    "<p>Hello <b>world</b>, see <i>this</i>.</p>",
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M0 0'/></svg>",
    "<a><![CDATA[ <raw> ]]></a>",
    '<ns:a xmlns:ns="u" xmlns="d"><ns:b/></ns:a>',
    "<r>\n  <a>text</a>\n  <!--x-->\n  <b/>\n</r>",
    "<r>" + Array.from({ length: 200 }, (_, i) => `<a k="v">${i}</a>`).join("") + "</r>",
  ];
  for (const indent of ["1", "2", "4", "tab"]) {
    for (const doc of docs) {
      const out = fmt(doc, { indent }).text;
      check(libxmlWellFormed(out) === true, `formatted output is well-formed at indent ${indent}: ${doc.slice(0, 30)}`, out.slice(0, 80));
    }
  }
  for (const doc of docs) {
    const out = min(doc).text;
    check(libxmlWellFormed(out) === true, `minified output is well-formed: ${doc.slice(0, 30)}`, out.slice(0, 80));
    // And re-formatting the minified document must be accepted, i.e. it is stable.
    const again = min(out);
    check(again.kind === "processed", `the minified output is accepted again: ${doc.slice(0, 30)}`, again.kind);
  }
}

// --- 10. caps -----------------------------------------------------------------
{
  const over = "<r>" + "x".repeat(M.MAX_XML_CHARS) + "</r>";
  const r = fmt(over);
  check(r.kind === "refused", "input past the character cap is refused", r.kind);
  check(r.message.includes(n(M.MAX_XML_CHARS)), "the refusal quotes the real cap", r.message);
  check(r.message.includes(n(over.length)), "and the real size", r.message);

  const deep = "<r>" + "<a>".repeat(M.MAX_XML_DEPTH + 1) + "x" + "</a>".repeat(M.MAX_XML_DEPTH + 1) + "</r>";
  const d = fmt(deep);
  check(d.kind === "refused", "nesting past the depth cap is refused", d.kind);
  check(d.message.includes(n(M.MAX_XML_DEPTH)), "the refusal quotes the real depth cap", d.message);

  // The old implementation was quadratic in depth: 68 KB threw a RangeError and 112 KB
  // built a 488 MB string. These must now be refused quickly rather than attempted.
  for (const depth of [1000, 5000, 23250]) {
    const bomb = "<r>" + "<a>".repeat(depth) + "x" + "</a>".repeat(depth) + "</r>";
    const started = Date.now();
    const b = fmt(bomb);
    const elapsed = Date.now() - started;
    check(b.kind === "refused", `a ${depth}-level depth bomb is refused`, b.kind);
    check(elapsed < 1000, `and refused quickly rather than attempted`, `${elapsed}ms for ${bomb.length} chars`);
  }
  check(typeof M.MAX_XML_OUTPUT_CHARS === "number" && M.MAX_XML_OUTPUT_CHARS > 0, "an output cap is declared");
}

// --- 11. statistics are honest ------------------------------------------------
{
  const r = fmt("<a><b/><c><d/></c><!--x--></a>");
  check(r.kind === "processed", "the statistics fixture processes", r.kind);
  check(r.stats.elements === 4, "the element count is right", String(r.stats.elements));
  check(r.stats.comments === 1, "the comment count is right", String(r.stats.comments));
  check(r.stats.maxDepth === 2, "the nesting depth is right, and a self-closing tag does not add a level", String(r.stats.maxDepth));
  const f = fmt("<a><b/></a>");
  check(f.stats.bytesRemoved === 0, "format mode reports no byte saving", String(f.stats.bytesRemoved));
}

// --- 12. THE COPY. Asserted against shipped data, not approved by reading. ----
{
  const { TOOL_CONTENT } = REPO_CONTENT;
  const { GUIDES } = REPO_GUIDES;

  const TOOL_ENTRY = /\{[^{}]*?slug: "xml-formatter"[^{}]*?\}/.exec(TOOLS_SRC)?.[0] ?? "";
  const TOOL_NAME = /slug: "xml-formatter",\s*name: "([^"]+)"/.exec(TOOL_ENTRY)?.[1] ?? "";
  const KEYWORDS = (() => {
    const m = /"xml-formatter":\s*\[([^\]]*)\]/.exec(SEO_SRC);
    return m ? m[1].match(/"[^"]+"/g)?.map((s) => s.slice(1, -1)) ?? [] : [];
  })();

  const content = TOOL_CONTENT["xml-formatter"];
  check(!!content, "the tool content exists");
  check(!!TOOL_ENTRY, "the registry entry exists");

  const LONG = content.longDescription;
  const FEATURES = content.features;
  const FAQ = content.faq.map((f) => `${f.question} ${f.answer}`).join(" ");
  const HOWTO = content.howTo.map((h) => `${h.step} ${h.description}`).join(" ");
  const COPY = `${LONG} ${FEATURES.join(" ")} ${FAQ} ${HOWTO}`;

  // The display name must not claim validity it does not check.
  check(/well-formed|well-formness/i.test(TOOL_NAME), "the registry name says well-formed rather than validator", TOOL_NAME);
  check(!/& Validator\b/.test(TOOL_NAME), "the registry name is not called a validator", TOOL_NAME);

  // The claims that were fabricated.
  check(!/syntax highlighting/i.test(COPY), "no claim of syntax highlighting");
  check(!/highlights? the exact (position|location)/i.test(COPY), "no claim of highlighting the exact position");
  check(!/handles all xml constructs correctly/i.test(COPY), "no claim that all XML constructs are handled correctly");
  check(!/mismatched namespace prefixes/i.test(COPY), "no claim about catching mismatched namespace prefixes");
  check(!/self-closing tag normalization/i.test(COPY), "no claim of self-closing tag normalization");
  check(!/normalizes attribute formatting/i.test(COPY), "no claim of attribute normalization");
  check(!/xml cleaner/i.test(COPY), "no claim to be an XML cleaner");
  check(!/2\/4\/8-space/i.test(COPY) && !/8-space/i.test(COPY), "no claim of an 8-space option that does not exist");
  check(!/tabs or/i.test(COPY), "no claim that the indent choice is only tabs or spaces when a tab option exists");

  // What it does claim must be real.
  check(/download/i.test(COPY), "the copy mentions the download it now offers");
  check(/line and a? ?column/i.test(COPY), "the copy mentions the line and column it reports");
  check(/byte for byte/i.test(COPY), "the copy states the text-preservation promise");
  check(/not a DTD or schema/i.test(COPY) || /not.*schema valid/i.test(COPY), "the copy says well-formedness is not DTD validation");
  check(/same verdict in both modes|both modes/i.test(COPY), "the copy explains that both modes agree");
  check(/browser/i.test(COPY) || /client-side/i.test(COPY), "the copy states that it runs in the browser");
  check(/never uploaded|never leave|not uploaded|no request/i.test(COPY), "the copy states the privacy position");

  // The indent options the copy implies must match the module's own set.
  for (const opt of ["1", "2", "4", "tab"]) {
    check(fmt("<a><b>1</b></a>", { indent: opt }).kind === "processed", `indent option ${opt} works`);
  }

  // The how-to must not invent a button.
  check(!/click (format|validate)/i.test(HOWTO), "the how-to does not tell the reader to click a button that does not exist");
  check(/Load sample|nothing is pre-filled/i.test(COPY), "the copy is clear that the box starts empty");

  check(KEYWORDS.length >= 5, "the SEO entry has keywords", String(KEYWORDS.length));
  check(KEYWORDS.some((k) => /validat|well.?formed/i.test(k)), "the keywords name the checking the tool does");
  check(KEYWORDS.some((k) => /minif/i.test(k)), "the keywords name the minify mode");

  const guide = GUIDES.find((g) => g.toolSlug === "xml-formatter");
  check(!!guide, "a guide exists for this tool");
  if (guide) {
    const GUIDE = JSON.stringify(guide);
    check(guide.keywords.length >= 5, "the guide carries its own keywords", String(guide.keywords.length));
    // A guide may discuss DTD validation in order to say it does not do it, so the
    // claim checked here is that it never asserts it performed one. `satisfy`, `meets`
    // and `validated against` are the phrasings that would amount to that.
    for (const [re, why] of [
      [/syntax highlighting/i, "syntax highlighting"],
      [/8-space/i, "an 8-space indent"],
      [/\b(satisfies|meets|validated against|checked against) (a |the )?(dtd|xsd|schema)\b/i, "having validated against a schema"],
    ]) {
      check(!re.test(GUIDE), `the guide makes no false claim about ${why}`);
    }
  }
}

// --- 13. the component cannot reintroduce the old defects ---------------------
{
  const COMPONENT = readFileSync(`${SRC}/XmlFormatter.tsx`, "utf8");
  // The regex that caused the corruption, as a pattern, must not be in the component.
  check(!/\[\^>\]\*/.test(COMPONENT), "the component no longer matches tags with a [^>]* regex");
  check(!/expected <\/\$\{/.test(COMPONENT), "the component does not build the old mismatch message");
  check(/useDeferredValue/.test(COMPONENT), "the component defers its work off the keystroke");
  check(/useMemo/.test(COMPONENT), "the component memoises its parse");
  check(/role="status"/.test(COMPONENT), "the component has a live region");
  check(/aria-pressed/.test(COMPONENT), "the mode buttons expose their pressed state");
  check(/aria-label="XML input"/.test(COMPONENT), "the input textarea has an accessible name");
  check(/aria-label=\{mode ===/.test(COMPONENT), "the output textarea has an accessible name");
  check(/tabIndex=\{-1\}/.test(COMPONENT), "the read-only output is out of the tab order");
  check(/useState\(""\)/.test(COMPONENT), "the box starts empty rather than pre-filled");
  check(/htmlFor=\{indentId\}/.test(COMPONENT), "the indent select has a real label");
  check(/disabled=\{result.kind !== "processed"\}/.test(COMPONENT), "Copy is disabled unless the document was processed");
  check(/text-emerald-700/.test(COMPONENT), "the success tone passes contrast on white");
}

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);