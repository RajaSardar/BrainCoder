/**
 * Node mirror audit for the Markdown to HTML tool. No browser, no DOM: the
 * three real TypeScript modules are transpiled with the repo's own TypeScript
 * compiler and imported, so these checks exercise the shipped code rather than
 * a hand-written copy of it.
 *
 *   node audit/check-md-to-html.mjs
 */
import ts from "typescript";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = "src/features/md-to-html";
const OUT = "audit/.md-mirror";
const MODULES = ["highlight", "sanitize", "convert"];

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const name of MODULES) {
  const source = readFileSync(`${SRC}/${name}.ts`, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
  }).outputText.replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(`${OUT}/${name}.mjs`, js);
}

const CONVERT_URL = pathToFileURL(`${OUT}/convert.mjs`).href;
const {
  convertMarkdown,
  convertStats,
  downloadFileName,
  paneHtml,
  wrapDocument,
  MAX_INPUT_CHARS,
  MAX_PANE_HIGHLIGHT_CHARS,
  DEFAULT_DOWNLOAD_STEM,
  HIGHLIGHT_LANGUAGES,
  isHighlightable,
} = await import(CONVERT_URL);
const { sanitizeHtml, isSafeUrl } = await import(
  pathToFileURL(`${OUT}/sanitize.mjs`).href
);
const { highlightCode, highlightHtmlSource, escapeDisplay } = await import(
  pathToFileURL(`${OUT}/highlight.mjs`).href
);

const SAMPLE_CODE = {
  javascript: "const a = 1;",
  typescript: "const a: number = 1;",
  json: '{"a": 1}',
  html: '<a href="x">y</a>',
  css: "a { color: #fff; }",
  python: "def f(): pass",
  shell: "echo hi",
  sql: "select 1",
  yaml: "a: 1",
  markdown: "# h",
};

const COMPONENT = readFileSync(`${SRC}/MdToHtml.tsx`, "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");

// ---- fixtures (no files on disk: markdown and HTML are strings) ----

const RICH_MD = [
  "# Title",
  "",
  'Some *emphasis*, **strong**, `code` and a [link](https://example.com "T").',
  "",
  "- one",
  "- two",
  "",
  "1. first",
  "2. second",
  "",
  "> quoted line",
  "",
  "| Col A | Col B |",
  "| ----- | ----- |",
  "| 1     | 2     |",
  "",
  "- [x] done",
  "- [ ] todo",
  "",
  "~~struck~~",
  "",
  "![alt text](img.png)",
  "",
  "---",
  "",
  "```js",
  'const greeting = "hi";',
  "```",
  "",
  '<div class="x" onclick="evil()">raw <b>html</b></div>',
  "",
].join("\n");

const RICH_HTML = [
  '<h1>Title</h1>',
  '<p>Some <em>emphasis</em>, <strong>strong</strong>, <code>code</code> and a <a href="https://example.com" title="T">link</a>.</p>',
  "<ul>",
  "<li>one</li>",
  "<li>two</li>",
  "</ul>",
  "<ol>",
  "<li>first</li>",
  "<li>second</li>",
  "</ol>",
  "<blockquote>",
  "<p>quoted line</p>",
  "</blockquote>",
  "<table>",
  "<thead>",
  "<tr>",
  "<th>Col A</th>",
  "<th>Col B</th>",
  "</tr>",
  "</thead>",
  "<tbody><tr>",
  "<td>1</td>",
  "<td>2</td>",
  "</tr>",
  "</tbody></table>",
  "<ul>",
  '<li><input checked="" disabled="" type="checkbox"> done</li>',
  '<li><input disabled="" type="checkbox"> todo</li>',
  "</ul>",
  "<p><del>struck</del></p>",
  '<p><img src="img.png" alt="alt text"></p>',
  "<hr>",
  '<pre><code class="language-js">const greeting = "hi";</code></pre>',
  '<div class="x">raw <b>html</b></div>',
  "",
].join("\n");

const rich = convertMarkdown(RICH_MD);
const richHtml = rich.html;

// ---- 1. CommonMark/GFM rendering, exact bytes ----
check("rich fixture converts without an error", rich.error === null, String(rich.error));
check(
  "rich fixture produces the exact expected HTML string",
  richHtml === RICH_HTML,
  `\n--- got ---\n${richHtml}\n--- want ---\n${RICH_HTML}`,
);
check("heading h1 rendered", /^<h1>Title<\/h1>/.test(richHtml));
check("h1 and h2 both render", convertMarkdown("## Two").html === "<h2>Two</h2>\n");
check("unordered list renders as ul/li", richHtml.includes("<ul>\n<li>one</li>"));
check("ordered list renders as ol/li", richHtml.includes("<ol>\n<li>first</li>"));
check("table renders thead/th and tbody/td", richHtml.includes("<thead>") && richHtml.includes("<td>1</td>"));
check("blockquote renders", richHtml.includes("<blockquote>\n<p>quoted line</p>\n</blockquote>"));
check("fenced code renders as pre/code with a language class", richHtml.includes('<pre><code class="language-js">'));
check("link keeps href and title", richHtml.includes('<a href="https://example.com" title="T">'));
check("image keeps src and alt", richHtml.includes('<img src="img.png" alt="alt text">'));
check("emphasis and strong render as em/strong", richHtml.includes("<em>emphasis</em>") && richHtml.includes("<strong>strong</strong>"));
check("inline code renders as code", richHtml.includes("<code>code</code>"));
check("task list renders two checkboxes", (richHtml.match(/<input[^>]*type="checkbox">/g) ?? []).length === 2);
check("task list marks the checked item", richHtml.includes('<input checked="" disabled="" type="checkbox"> done'));
check("strikethrough renders as del", richHtml.includes("<del>struck</del>"));
check("thematic break renders as hr", richHtml.includes("\n<hr>\n"));
check("autolinked bare url becomes a link", convertMarkdown("see https://example.com/x").html === '<p>see <a href="https://example.com/x">https://example.com/x</a></p>\n');
check("hard break renders as br", convertMarkdown("a  \nb").html === "<p>a<br>b</p>\n");
check("text with < & > is escaped", convertMarkdown("a < b & c > d").html === "<p>a &lt; b &amp; c &gt; d</p>\n");
check("raw inline html is kept (and sanitized)", richHtml.endsWith('<div class="x">raw <b>html</b></div>\n'));
check("nested emphasis inside a link renders", convertMarkdown("[*x*](u)").html === '<p><a href="u"><em>x</em></a></p>\n');
check("setext heading renders as h1", convertMarkdown("Title\n=====").html === "<h1>Title</h1>\n");
check("fenced code with no language has no class attribute", convertMarkdown("```\nplain\n```\n").html === "<pre><code>plain</code></pre>\n");

// ---- 2. empty / whitespace / determinism ----
check("empty input yields empty output and no error", (() => { const r = convertMarkdown(""); return r.html === "" && r.error === null; })());
check("whitespace-only input is treated as empty", (() => { const r = convertMarkdown("   \n\n\t "); return r.html === "" && r.error === null; })());
check("markdown is forgiving: unbalanced fences still convert", (() => { const r = convertMarkdown("```js\nconst a = 1;"); return r.error === null && r.html.includes("const a = 1;"); })());
check("unbalanced brackets do not throw", (() => { const r = convertMarkdown("[oops](  and *bold"); return typeof r.html === "string" && r.error === null; })());
check("converting twice yields identical bytes", convertMarkdown(RICH_MD).html === richHtml);
check("deeply nested inline html does not throw", (() => { const r = convertMarkdown("<b>".repeat(50) + "deep" + "</b>".repeat(50)); return r.error === null; })());
check("a lone < is escaped rather than dropped", convertMarkdown("5 < 6").html.includes("&lt;"));

// ---- 3. sanitization: scripts, handlers, unsafe URLs ----
const xss = convertMarkdown(
  [
    "Before",
    "",
    "<script>alert(1)</script>",
    "",
    '<img src="x" onerror="alert(1)" alt="a">',
    "",
    '<a href="javascript:alert(1)">click</a>',
    "",
    '<div onmouseover="alert(1)" style="color:red" data-x="1" id="z">hover</div>',
    "",
    "<iframe src=\"//evil\"></iframe><style>body{display:none}</style>",
    "",
    "<!-- a comment -->",
    "",
    "<svg><script>alert(2)</script></svg>",
    "",
  ].join("\n"),
).html;
check("script tag and its body are removed", !/script/i.test(xss) && !/alert\(1\)/.test(xss), xss);
check("no script element survives anywhere", !/<script/i.test(xss));
check("onerror handler is stripped but alt/src survive", xss.includes('<img src="x" alt="a">'), xss);
check("onmouseover is stripped", !/onmouseover/i.test(xss));
check("style attribute is stripped", !/style=/i.test(xss));
check("data-* attribute is stripped", !/data-x/i.test(xss));
check("id attribute is stripped", !/id="z"/.test(xss));
check("javascript: href is stripped, link text stays", xss.includes("<a>click</a>"), xss);
check("iframe is removed with its content", !/iframe/i.test(xss));
check("style element is removed with its content", !/display:none/.test(xss));
check("html comment is dropped", !/a comment/.test(xss));
check("embedded svg is removed with its content", !/svg|alert\(2\)/i.test(xss));
check("text around a stripped script survives", xss.includes("Before") && xss.includes("hover"), xss);

const obfuscated = sanitizeHtml(
  '<a href="java&#115;cript:alert(1)">a</a><a href="jav&colon;ascript:alert(1)">b</a><a href="jav&#x09;ascript:alert(1)">c</a><a href=" javascript:alert(1)">d</a>',
);
check("entity-encoded javascript: is stripped", !/href/i.test(obfuscated), obfuscated);
check("entity-encoded javascript: links keep their text", (obfuscated.match(/<a>/g) ?? []).length === 4, obfuscated);
check("isSafeUrl rejects javascript:", isSafeUrl("javascript:alert(1)", false) === false);
check("isSafeUrl rejects vbscript:", isSafeUrl("vbscript:msgbox", false) === false);
check("isSafeUrl rejects data: for href", isSafeUrl("data:text/html,<script>", false) === false);
check("isSafeUrl allows https, mailto, tel and fragments", ["https://a.b", "mailto:a@b.c", "tel:+1", "#top"].every((u) => isSafeUrl(u, false)));
check("isSafeUrl allows relative paths with a colon in a segment", isSafeUrl("docs/a:b.html", false) === true);
check("isSafeUrl allows inline raster images only", isSafeUrl("data:image/png;base64,AA", true) === true && isSafeUrl("data:image/svg+xml;base64,AA", true) === false);

/** Quote-aware attribute scanner, so `" onclick="` inside a value is not a hit. */
function liveTags(html) {
  const found = [];
  const tagRe = /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const attrRe = /([^\s"'<>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|([^\s"'<>`]*)))?/g;
  let t;
  while ((t = tagRe.exec(html)) !== null) {
    if (t[1] === "/") continue;
    let a;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(t[3])) !== null) found.push([t[2].toLowerCase(), a[1].toLowerCase()]);
    found.push([t[2].toLowerCase(), null]);
  }
  return found;
}

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "cite", "code", "dd", "del", "div", "dl", "dt",
  "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
  "input", "kbd", "li", "mark", "ol", "p", "pre", "s", "samp", "small", "span",
  "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u",
  "ul", "var",
]);

check("unterminated script tag swallows the remainder instead of leaking text", (() => {
  const out = sanitizeHtml("<p>ok</p><script>alert(1) no closing tag");
  return out === "<p>ok</p>";
})());
check("an unterminated quote cannot smuggle a live event handler", (() => {
  const out = sanitizeHtml('<a href="x onclick="alert(1)>text</a>');
  return liveTags(out).every(([, name]) => name === null || !name.startsWith("on"));
})());
check("a lone < that opens no well-formed tag is escaped", (() => {
  const out = sanitizeHtml("text < not a tag > more");
  return out === "text &lt; not a tag > more" && liveTags(out).length === 0;
})());
check("an unquoted > inside an attribute value cannot break out", (() => {
  const out = sanitizeHtml('<a title="a>b" href="https://x.y">t</a>');
  return out === '<a title="a>b" href="https://x.y">t</a>';
})());
check("every surviving < opens an allowlisted tag", liveTags(xss + obfuscated).every(([tag]) => ALLOWED_TAGS.has(tag)));
check("no event-handler attribute survives the whole adversarial pass", liveTags(xss + obfuscated).every(([, name]) => name === null || !name.startsWith("on")));
check("the surviving attribute set is inside the allowlist", liveTags(xss).every(([, name]) => name === null || ["alt", "checked", "class", "colspan", "disabled", "height", "href", "rowspan", "src", "start", "title", "type", "width"].includes(name)));
check("a form is unwrapped and its label text survives", (() => {
  const out = convertMarkdown('<form action="/x"><button onclick="e()">Label</button></form>').html;
  return out.includes("Label") && !/form|button/i.test(out);
})());
check("allowlisted presentational tags survive", (() => {
  const out = convertMarkdown("<mark>keep</mark> <kbd>Ctrl</kbd> <sub>2</sub> <sup>3</sup>").html;
  return out === "<p><mark>keep</mark> <kbd>Ctrl</kbd> <sub>2</sub> <sup>3</sup></p>\n";
})());
check("a paragraph stripped bare of content is dropped", !/<p><\/p>/.test(convertMarkdown("<script>alert(1)</script>").html));
check("sanitizing clean output is a no-op (byte identical)", sanitizeHtml(RICH_HTML) === RICH_HTML);

// ---- 4. syntax-highlight tokens ----
const hl = convertMarkdown('```js\nconst greeting = "hi"; // hey\n```\n', { highlightCode: true }).html;
check("highlighted fence keeps the language class", hl.includes('<code class="language-js">'));
check("highlighted fence contains keyword token spans", hl.includes('<span class="tok tok-keyword">const</span>'));
check("highlighted fence contains string token spans", hl.includes('<span class="tok tok-string">&quot;hi&quot;</span>') || hl.includes('<span class="tok tok-string">"hi"</span>'));
check("highlighted fence contains comment token spans", hl.includes('<span class="tok tok-comment">// hey</span>'));
check("plain mode emits no token markup at all", !convertMarkdown('```js\nconst a = 1;\n```\n').html.includes("tok "));
check("every advertised language is really tokenizable", HIGHLIGHT_LANGUAGES.every((lang) => isHighlightable(lang)));
check("each advertised language emits a token span for real input", HIGHLIGHT_LANGUAGES.every((lang) => highlightCode(SAMPLE_CODE[lang] ?? "x", lang).includes("tok-")));
check("json tokenizes keys and values", highlightCode('{"a": 1}', "json").includes('tok-attr') && highlightCode('{"a": 1}', "json").includes('tok-number'));
check("html tokenizes tags and attributes", highlightCode('<a href="x">y</a>', "html").includes("tok-tag"));
check("css tokenizes properties and numbers", highlightCode("a { color: #fff; margin: 0 2px; }", "css").includes("tok-property"));
check("python tokenizes decorators and comments", highlightCode("@app\ndef f():  # hi", "python").includes("tok-keyword"));
check("shell tokenizes keywords", highlightCode("for f in *; do echo $f; done", "sh").includes("tok-keyword"));
check("sql tokenizes keywords case-insensitively", highlightCode("select id from t", "sql").includes("tok-keyword"));
check("yaml tokenizes keys", highlightCode("title: hi", "yml").includes("tok-attr"));
check("markdown tokenizes headings and links", highlightCode("# H\n[x](y)", "md").includes("tok-heading"));
check("a plain fence label is escaped but not tokenized", highlightCode("const a = 1;", "text") === "const a = 1;");
check("isHighlightable is honest about unknown languages", isHighlightable("brainfuck") === false && isHighlightable("ts") === true);
check("fence code content is escaped, so a script inside code stays text", !/<script/i.test(convertMarkdown("```html\n<script>alert(1)</script>\n```\n").html));
check("a hostile fence label cannot inject an attribute", (() => {
  const out = convertMarkdown('```js" onmouseover="alert(1)\nconst a = 1;\n```\n', { highlightCode: true }).html;
  return !/onmouseover/i.test(out) && !/class="language-[^"]*"/.test(out);
})());
check("tokenizer output keeps the original text intact", (() => {
  const src = 'const a = "<b>&"; // note';
  return highlightCode(src, "js").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">") === src;
})());
check("escapeDisplay escapes only angle brackets", escapeDisplay("&amp; <b>") === "&amp; &lt;b&gt;");

const pane = paneHtml(richHtml);
check("output pane contains tag tokens", pane.includes('<span class="tok tok-tag">'));
check("output pane contains attribute tokens", pane.includes('<span class="tok tok-attr">href</span>'));
check("output pane keeps the source text readable", (() => {
  const text = pane.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return text === richHtml;
})());
check("output pane never emits a live tag from the document", !/<\/?(h1|p|div|img|a)[\s>]/.test(pane));
check("output pane is escaped beyond the size cap", (() => {
  const big = "<p>" + "x".repeat(MAX_PANE_HIGHLIGHT_CHARS) + "</p>";
  return !paneHtml(big).includes("tok ");
})());
check("highlightHtmlSource leaves a script-looking string inert", !/<script/.test(highlightHtmlSource("<script>")));

// ---- 5. caps, counters, filenames, document wrapper ----
check("input cap is 200,000 characters", MAX_INPUT_CHARS === 200_000);
check("a 200,000-character document converts without error", (() => {
  const big = "# H\n\n" + "word ".repeat(39_000);
  const r = convertMarkdown(big.slice(0, MAX_INPUT_CHARS));
  return r.error === null && r.html.length > 0;
})());
check("counters count input characters, words, output and headings", (() => {
  const s = convertStats(RICH_MD, richHtml);
  return s.inputChars === RICH_MD.length && s.words > 0 && s.outputChars === richHtml.length && s.outputBytes === Buffer.byteLength(richHtml) && s.blocks === 1;
})());
check("counters are zero-safe for empty input", (() => {
  const s = convertStats("", "");
  return s.inputChars === 0 && s.words === 0 && s.outputChars === 0 && s.blocks === 0;
})());
check("a .md source name becomes <src>.html", downloadFileName("notes") === "notes.html" && downloadFileName("notes.md") === "notes.html");
check("other source extensions are stripped too", downloadFileName("My Doc.markdown") === "My Doc.html" && downloadFileName("a.txt") === "a.html");
check("an empty stem falls back to the disclosed placeholder", downloadFileName("") === `${DEFAULT_DOWNLOAD_STEM}.html`);
check("a path-traversal stem cannot escape the name", downloadFileName("../../etc/passwd") === "-..-etc-passwd.html");
check("a long stem is truncated", downloadFileName("a".repeat(500)).length <= 65);
check("the wrapper is a standalone document with no scripts", (() => {
  const doc = wrapDocument(richHtml, "notes.html");
  return doc.startsWith("<!DOCTYPE html>") && doc.includes('<meta charset="utf-8">') && doc.includes('name="viewport"') && !/<script/i.test(doc) && doc.includes(richHtml);
})());
check("the wrapper title is escaped", wrapDocument("<p>x</p>", "a<b>").includes("<title>a&lt;b&gt;</title>"));
check("the wrapper ships token css only when tokens are on", (() => {
  const plain = wrapDocument("<p>x</p>", "t", { highlightCode: false });
  const marked = wrapDocument("<p>x</p>", "t", { highlightCode: true });
  return !plain.includes(".tok-keyword") && marked.includes(".tok-keyword");
})());

// ---- 6. the component keeps its promises (source-level) ----
check("component caps the textarea", COMPONENT.includes("maxLength={MAX_INPUT_CHARS}") && COMPONENT.includes("capped at"));
check("component discloses the placeholder download name", COMPONENT.includes("placeholder, this is a paste tool with no file"));
check("component admits the highlighter is regex-based, not a parser", COMPONENT.includes("regex-based, not a full"));
check("component states the output is sanitized", COMPONENT.includes("then the whole result is sanitized"));
check("component states the download is a scriptless standalone page", COMPONENT.includes("standalone page") && COMPONENT.includes("no scripts"));
check("component states nothing is uploaded", COMPONENT.includes("never uploaded"));
check("component guards async file reads with a runId", COMPONENT.includes("runIdRef") && /if \(runId !== runIdRef\.current\) return;/.test(COMPONENT));
check("component exposes errors and status to assistive tech", COMPONENT.includes('role="alert"') && COMPONENT.includes('role="status"') && COMPONENT.includes("aria-busy={busy}"));
check("component labels its inputs with useId", COMPONENT.includes("htmlFor={mdId}") && COMPONENT.includes("htmlFor={stemId}") && COMPONENT.includes("htmlFor={fileId}"));
check("component gives the copy button a distinct accessible name", COMPONENT.includes('ariaLabel="Copy the generated HTML"'));
check("both injected panes are fed the sanitized pipeline", (() => {
  const injections = [...COMPONENT.matchAll(/dangerouslySetInnerHTML=\{\{ __html: (\w+) \}\}/g)].map((m) => m[1]);
  return injections.length === 2 && injections.every((v) => v === "pane" || v === "html");
})());
check("component does not claim a highlighting engine it does not ship", !/shiki|highlight\.js|prism/i.test(COMPONENT));
check("token classes are contrast-checked in the stylesheet", (() => {
  const light = [".tok-comment", ".tok-string", ".tok-number", ".tok-keyword", ".tok-tag", ".tok-attr"];
  const dark = [".md-preview pre .tok-comment", ".md-preview pre .tok-string", ".md-preview pre .tok-keyword"];
  return light.every((c) => CSS.includes(`${c} {`)) && dark.every((c) => CSS.includes(`${c} {`));
})());
check("preview pane creates a containing block for pasted classes", CSS.includes("[data-md-preview]") && COMPONENT.includes("data-md-preview"));

rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
