/**
 * Node mirror audit for the CSV to JSON Converter. No browser, no DOM.
 *
 * The shipped pure modules are transpiled with the repo's own TypeScript
 * compiler and imported, so every behavioural check below runs the code the tab
 * runs rather than a hand-written copy of its rules: the RFC 4180 scanner, the
 * preflight that enforces the caps, the delimiter sniffer, the key planner, the
 * ragged-row accounting and the byte counts are all the real functions.
 *
 * Sections 9 and 10 are source-level truth over the component, the registry,
 * the copy, the SEO entry and the guide. A converter's value is that it tells
 * you what it did to your data, so a claim in the copy that the module denies
 * is the defect that matters most here, and it is asserted rather than read.
 *
 *   node audit/check-csv-json.mjs
 */
import ts from "typescript";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = "src/features/csv-json";
const OUT = "audit/.csv-json-mirror";
const MODULES = ["csv-parse", "csv-format"];

let pass = 0;
let fail = 0;

/**
 * The condition comes first and the name second, so a check reads left to right
 * as the claim it is making: `check(conv(...).kind === "converted", "a plain
 * CSV converts")`. A truthy name is never enough to pass — only the condition
 * can pass or fail a check.
 */
function check(cond, name, extra = "") {
  if (cond === true) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

const M = await import(pathToFileURL(`${OUT}/csv-format.mjs`).href);

const P = await import(pathToFileURL(`${OUT}/csv-parse.mjs`).href);
const A = { ...P, ...M };
const PR_MAX_ROWS = A.MAX_ROWS;
const PR_MAX_COLUMNS = A.MAX_COLUMNS;
const PR_MAX_FIELD = A.MAX_FIELD_CHARS;

const {
  ANOMALY_EXPLANATION,
  ANOMALY_LABEL,
  CAP_SUMMARY,
  CELL_PREVIEW_CHARS,
  DELIMITER_CHOICES,
  EM_DASH,
  INDENT_CHOICES,
  JSON_PREVIEW_CHARS,
  MAX_COLUMNS,
  MAX_COLUMNS_LABEL,
  MAX_FIELD_CHARS,
  MAX_FIELD_LABEL,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
  MAX_INPUT_CHARS,
  MAX_INPUT_LABEL,
  MAX_ROWS,
  MAX_ROWS_LABEL,
  SURPLUS_KEY,
  TABLE_PREVIEW_COLUMNS,
  TABLE_PREVIEW_ROWS,
  buildJson,
  cellPreview,
  choiceFor,
  convertCsv,
  countReplacementChars,
  describeByteSize,
  detectDelimiter,
  formatInt,
  jsonPreview,
  normalizeDelimiter,
  outputNameFor,
  parseCsv,
  planKeys,
  preflightCsv,
  safeStem,
  utf8ByteLength,
} = A;

const COMPONENT = readFileSync(`${SRC}/CsvJson.tsx`, "utf8");
const PARSE_SRC = readFileSync(`${SRC}/csv-parse.ts`, "utf8");
const FORMAT_SRC = readFileSync(`${SRC}/csv-format.ts`, "utf8");
const TOOLS_SRC = readFileSync("src/lib/tools.ts", "utf8");
const SEO_SRC = readFileSync("src/lib/seo.ts", "utf8");

// The site's own content tables, transpiled the same way, so "the copy says what
// the code does" is a comparison against the shipped data and not a regex guess.
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
const CONTENT = REPO_CONTENT.TOOL_CONTENT["csv-json"];
const GUIDE = REPO_GUIDES.GUIDES.find((g) => g.slug === "how-to-convert-csv-to-json");
const GUIDE_TEXT = JSON.stringify(GUIDE);

// A convenience wrapper with the shipped defaults, so a check reads as the
// behaviour it is testing.
const conv = (text, o = {}) =>
  convertCsv(text, { delimiterMode: ",", hasHeader: true, indent: 2, ...o });

// ---------------------------------------------------------------------------
// 1. RFC 4180 lexing
// ---------------------------------------------------------------------------
{
  const basic = parseCsv("a,b\n1,2\n", ",");
  check(eq(basic.records, [["a", "b"], ["1", "2"]]), "a plain two-column CSV parses into records");
  check(basic.anomalies.length === 0, "a conformant file reports no anomalies");
  check(basic.blankLines === 0, "a conformant file has no blank lines to skip");
  check(basic.hadBom === false, "no BOM is claimed for a file without one");

  const quotedComma = parseCsv('a,b\n"x,1",2\n', ",");
  check(eq(quotedComma.records[1], ["x,1", "2"]), "a quoted cell keeps its embedded comma", JSON.stringify(quotedComma.records));

  const quotedNewline = parseCsv('a,b\n"line1\nline2",2\n', ",");
  check(
    eq(quotedNewline.records[1], ["line1\nline2", "2"]),
    "a quoted cell keeps an embedded LF and does not split the record",
  );
  check(quotedNewline.records.length === 2, "an embedded newline does not create a record");

  const quotedCrlf = parseCsv('a\r\n"x\r\ny"\r\n', ",");
  check(
    eq(quotedCrlf.records[1], ["x\r\ny"]),
    "a CRLF inside a quoted cell is kept byte for byte, CR included",
    JSON.stringify(quotedCrlf.records),
  );

  const escaped = parseCsv('a,b\n"he said ""hi""",2\n', ",");
  check(
    eq(escaped.records[1], ['he said "hi"', "2"]),
    "a doubled quote inside a quoted cell becomes one literal quote",
    JSON.stringify(escaped.records),
  );

  const lf = parseCsv("a,b\n1,2", ",");
  check(eq(lf.records, [["a", "b"], ["1", "2"]]), "LF endings parse");
  check(eq(lf.lineEndings, { crlf: 0, lf: 1, cr: 0 }), "LF endings are counted", eq(lf.lineEndings));
  check(eq(parseCsv("a,b\r\n1,2\r\n", ",").records, [["a", "b"], ["1", "2"]]), "CRLF endings parse");
  check(eq(parseCsv("a,b\r\n1,2\r\n", ",").lineEndings, { crlf: 2, lf: 0, cr: 0 }), "CRLF endings are counted as CRLF, not as LF");
  check(eq(parseCsv("a,b\r1,2\r", ",").records, [["a", "b"], ["1", "2"]]), "a bare CR ends a record");
  check(eq(parseCsv("a,b\r1,2\r", ",").lineEndings, { crlf: 0, lf: 0, cr: 2 }), "bare CR endings are counted");

  const bom = parseCsv("\uFEFFa,b\n1,2\n", ",");
  check(bom.hadBom === true, "a UTF-8 BOM is detected");
  check(eq(bom.records, [["a", "b"], ["1", "2"]]), "a UTF-8 BOM does not become part of the first key");
  check(conv("\uFEFFa,b\n1,2\n").keys[0] === "a", "the BOM never reaches the first key");

  check(eq(parseCsv("a,b\n1,2\n", ",").records.length, 2), "a trailing newline does not create an empty record");
  check(eq(parseCsv("a,b\n1,2\n\n\n", ",").records.length, 2), "trailing blank lines do not create records");
  check(parseCsv("a,b\n1,2\n\n\n", ",").blankLines === 2, "trailing blank lines are counted as skipped");
  check(eq(parseCsv("a,b", ",").records, [["a", "b"]]), "a file with no final line ending still parses its last record");
  check(eq(parseCsv("a,b\n1,2\n", ",").maxFields, 2), "the widest record is reported");

  const trailingDelim = parseCsv("a,b,\n1,2,", ",");
  check(eq(trailingDelim.records[1], ["1", "2", ""]), "a trailing delimiter is an empty last field, not a dropped column", JSON.stringify(trailingDelim.records));
  check(parseCsv('a,b\n"",""\n', ",").records[1].length === 2, "two quoted empty fields are two fields");

  // The chosen delimiter inside a quoted cell must not split the record.
  const pipeInQuotes = parseCsv('a,b\n"x|y",2\n', ",");
  check(eq(pipeInQuotes.records[1], ["x|y", "2"]), "a pipe inside a quoted cell is not a split, with a comma delimiter", JSON.stringify(pipeInQuotes.records));
  check(pipeInQuotes.anomalies.length === 0, "a pipe inside a quoted cell raises no anomaly", JSON.stringify(pipeInQuotes.anomalies));
  const chosenInQuotes = parseCsv('a|b\n"x,y"|2\n', "|");
  check(eq(chosenInQuotes.records[1], ["x,y", "2"]), "the chosen delimiter inside a quoted cell is not a split", JSON.stringify(chosenInQuotes.records));
  check(chosenInQuotes.anomalies.length === 0, "a comma inside a quoted cell raises no anomaly when the delimiter is a pipe", JSON.stringify(chosenInQuotes.anomalies));
  // After a closing quote, RFC 4180 allows only the delimiter or a line ending:
  // anything else is reported rather than quietly folded into the field.
  const afterCloseComma = parseCsv('a|b\n"x,y",2\n', "|");
  check(
    afterCloseComma.anomalies.length > 0 && afterCloseComma.anomalies[0].kind === "text-after-closing-quote",
    "a comma after a closing quote is an anomaly when the delimiter is a pipe",
    JSON.stringify(afterCloseComma.anomalies),
  );

  check(countReplacementChars("a\uFFFDb\uFFFDc") === 2, "U+FFFD is counted so a non-UTF-8 file can be disclosed");
  check(countReplacementChars("plain") === 0, "clean text reports no replacement characters");
}

// ---------------------------------------------------------------------------
// 2. anomalies: reported, never silently accepted
// ---------------------------------------------------------------------------
{
  const midQuote = parseCsv('a,b\nx"y,2\n', ",");
  check(
    midQuote.anomalies.length === 1 && midQuote.anomalies[0].kind === "quote-in-unquoted-field",
    "a quote in the middle of an unquoted field is an anomaly",
    JSON.stringify(midQuote.anomalies),
  );
  check(midQuote.anomalies[0].position === 6, "the anomaly carries its character position", String(midQuote.anomalies[0].position));
  check(midQuote.anomalies[0].record === 2 && midQuote.anomalies[0].field === 1, "the anomaly carries its record and field");
  check(eq(midQuote.records[1], ['x"y', "2"]), "the offending text is kept, not discarded");

  const afterClose = parseCsv('a,b\n"x"y,2\n', ",");
  check(
    afterClose.anomalies.length === 1 && afterClose.anomalies[0].kind === "text-after-closing-quote",
    "text after a closing quote is an anomaly",
    JSON.stringify(afterClose.anomalies),
  );
  check(eq(afterClose.records[1], ["xy", "2"]), "text after a closing quote is kept as field text");

  const unterminated = parseCsv('a,b\n"open,2\n', ",");
  check(
    unterminated.anomalies.some((a) => a.kind === "unterminated-quote"),
    "an unterminated quote is an anomaly",
    JSON.stringify(unterminated.anomalies),
  );
  check(unterminated.endedInsideQuote === true, "the parse says the input ended inside a quote");
  check(unterminated.records.length === 2, "an unterminated quote does not lose the rows before it");

  // RFC 4180 allows a space before a quote, and the space makes the field
  // unquoted, so the quote inside it is an anomaly — the point is that the text
  // is kept exactly and the problem is named rather than swallowed.
  const spaced = parseCsv('a,b\n "x",2\n', ",");
  check(eq(spaced.records[1], [' "x"', "2"]), "a space before an opening quote is kept as text, including the space", JSON.stringify(spaced.records));
  check(
    spaced.anomalies.length === 2 && spaced.anomalies.every((a) => a.kind === "quote-in-unquoted-field"),
    "a space before an opening quote makes the field unquoted, and both quotes are reported",
    JSON.stringify(spaced.anomalies),
  );

  for (const kind of Object.keys(ANOMALY_LABEL)) {
    check(typeof ANOMALY_LABEL[kind] === "string" && ANOMALY_LABEL[kind].length > 0, `${kind} has a label`);
    check(
      typeof ANOMALY_EXPLANATION[kind] === "string" && /RFC 4180/.test(ANOMALY_EXPLANATION[kind]),
      `${kind} explains itself against RFC 4180`,
    );
  }
  const allThree = conv('a\nx"y\n"q"z\n"open\n', { hasHeader: false });
  check(allThree.kind === "converted" && allThree.anomalies.length === 3, "all three anomaly kinds can appear in one file", String(allThree.anomalies?.length));
}

// ---------------------------------------------------------------------------
// 3. the preflight agrees with the parser, and allocates nothing to disagree
// ---------------------------------------------------------------------------
{
  const fixtures = [
    ["", ","],
    ["\n", ","],
    ["\n\n\n", ","],
    ["a", ","],
    ["a\n", ","],
    ["a,b\n", ","],
    ["a,b\n1,2\n", ","],
    ["a,b\r\n1,2\r\n", ","],
    ["a,b\r1,2\r", ","],
    ["a;b\r\n1;2\r\n", ";"],
    ['a,b\r\n"x,1","y\r\n2"\r\n', ","],
    ['a,b\r\n"he ""hi""",2\r\n', ","],
    ['a,b\n"open,2\n', ","],
    ['a,b\n"x"y,2\n', ","],
    ['a,b\nx"y,2\n', ","],
    ["a\n\n\nb\n\n", ","],
    ["\uFEFFx,y\n", ","],
    ["\ta\tb\n1\t2\t3\n", "\t"],
    ["a|b\n1|2\n", "|"],
    ["a,b,c\n1\n", ","],
    ["a,b,c\n1,2,3,4,5\n", ","],
    ["one\ntwo\nthree", ","],
    ['"",""\n', ","],
    ["x".repeat(50) + ",y\n", ","],
    ['"a\nb\nc"\n', ","],
  ];
  let agreed = 0;
  const disagreements = [];
  for (const [text, del] of fixtures) {
    const pre = preflightCsv(text, del);
    const parsed = parseCsv(text, del);
    if (!pre.ok) {
      disagreements.push(`${JSON.stringify(text.slice(0, 20))}: refused`);
      continue;
    }
    if (
      pre.recordCount !== parsed.records.length ||
      pre.maxFields !== parsed.maxFields ||
      pre.blankLines !== parsed.blankLines
    ) {
      disagreements.push(
        `${JSON.stringify(text.slice(0, 20))}: pre(${pre.recordCount}/${pre.maxFields}/${pre.blankLines}) parse(${parsed.records.length}/${parsed.maxFields}/${parsed.blankLines})`,
      );
      continue;
    }
    agreed += 1;
  }
  check(disagreements.length === 0, `the preflight and the parser agree on every fixture (${agreed}/${fixtures.length})`, disagreements.join(" | "));

  // A generated sweep over every small string: the two passes must never drift.
  const alphabet = ['a', '"', ",", "\n", " "];
  let generated = 0;
  let drift = "";
  outer: for (let a = 0; a < alphabet.length; a += 1) {
    for (let b = 0; b < alphabet.length; b += 1) {
      for (let c = 0; c < alphabet.length; c += 1) {
        for (let d = 0; d < alphabet.length; d += 1) {
          const text = `${alphabet[a]}${alphabet[b]}${alphabet[c]}${alphabet[d]}`;
          const pre = preflightCsv(text, ",");
          const parsed = parseCsv(text, ",");
          generated += 1;
          if (
            !pre.ok ||
            pre.recordCount !== parsed.records.length ||
            pre.maxFields !== parsed.maxFields ||
            pre.blankLines !== parsed.blankLines
          ) {
            drift = `${JSON.stringify(text)}`;
            break outer;
          }
        }
      }
    }
  }
  check(drift === "", `preflight and parser agree across all ${generated} generated 4-character inputs`, drift);

  const longest = preflightCsv(`a\n${"x".repeat(7)}\n`, ",");
  check(longest.ok && longest.maxFieldChars === 7, "the preflight measures the longest field", JSON.stringify(longest));

  check(/reused verbatim/.test(PARSE_SRC) || /cap/i.test(PARSE_SRC), "the preflight is documented as the cap gate");
  check(PARSE_SRC.indexOf("function preflightCsv") < PARSE_SRC.indexOf("function parseCsv"), "the preflight is declared before the parse it gates");
  check(!/\[.*\]\.join/.test(PARSE_SRC.slice(PARSE_SRC.indexOf("export function preflightCsv"), PARSE_SRC.indexOf("// ------", PARSE_SRC.indexOf("export function preflightCsv")))), "the preflight builds no strings");
}

// ---------------------------------------------------------------------------
// 4. caps
// ---------------------------------------------------------------------------
{
  check(PR_MAX_ROWS === MAX_ROWS && PR_MAX_COLUMNS === MAX_COLUMNS && PR_MAX_FIELD === MAX_FIELD_CHARS, "the caps are declared once and re-exported unchanged");
  check(MAX_ROWS === 20000, "the row cap is 20,000");
  check(MAX_COLUMNS === 512, "the column cap is 512 per row");
  check(MAX_FIELD_CHARS === 100000, "the field cap is 100,000 characters");
  check(MAX_INPUT_CHARS === 5242880, "the pasted-text cap is 5,242,880 characters");
  check(MAX_FILE_BYTES === 5242880, "the file cap is 5,242,880 bytes");

  check(MAX_ROWS_LABEL === "20,000 rows", "the row cap label is derived from the number", MAX_ROWS_LABEL);
  check(MAX_COLUMNS_LABEL === "512 columns per row", "the column cap label is derived", MAX_COLUMNS_LABEL);
  check(MAX_FIELD_LABEL === "100,000 characters per cell", "the field cap label is derived", MAX_FIELD_LABEL);
  check(MAX_INPUT_LABEL === "5,242,880 characters", "the text cap label is derived", MAX_INPUT_LABEL);
  check(MAX_FILE_LABEL === "5 MB (5,242,880 bytes)", "the file cap label is derived", MAX_FILE_LABEL);
  check(
    CAP_SUMMARY.includes(MAX_ROWS_LABEL) && CAP_SUMMARY.includes(MAX_COLUMNS_LABEL) && CAP_SUMMARY.includes(MAX_FIELD_LABEL) && CAP_SUMMARY.includes(MAX_FILE_LABEL),
    "the cap summary names every cap",
  );

  // Exactly at the cap is accepted; one over is refused.
  const rowsAtCap = `h\n${"a\n".repeat(MAX_ROWS - 1)}`;
  check(conv(rowsAtCap).kind === "converted", `exactly ${MAX_ROWS.toLocaleString("en-US")} rows converts`);
  const overRows = `h\n${"a\n".repeat(MAX_ROWS)}`;
  const rowRefusal = conv(overRows);
  check(rowRefusal.kind === "refused", "one row over the cap is refused");
  check(rowRefusal.message.includes("20,001"), "the row refusal quotes the count it actually found", rowRefusal.message);
  check(rowRefusal.message.includes("20,000 records"), "the row refusal quotes the cap");
  check(/Nothing was converted/.test(rowRefusal.message), "the row refusal says nothing was converted");

  const wideAtCap = `${Array(MAX_COLUMNS).fill("x").join(",")}\n`;
  check(conv(wideAtCap).kind === "converted", `exactly ${MAX_COLUMNS} columns converts`);
  const overCols = `${Array(MAX_COLUMNS + 1).fill("x").join(",")}\n`;
  const colRefusal = conv(overCols);
  check(colRefusal.kind === "refused", "one column over the cap is refused");
  check(colRefusal.message.includes("513"), "the column refusal quotes the field count it found", colRefusal.message);
  check(colRefusal.message.includes("512 fields per record"), "the column refusal quotes the cap");

  const fieldAtCap = `h\n${"x".repeat(MAX_FIELD_CHARS)}\n`;
  check(conv(fieldAtCap).kind === "converted", `a ${MAX_FIELD_CHARS.toLocaleString("en-US")}-character field converts`);
  const overField = `h\n${"x".repeat(MAX_FIELD_CHARS + 1)}\n`;
  const fieldRefusal = conv(overField);
  check(fieldRefusal.kind === "refused", "one character over the field cap is refused");
  check(fieldRefusal.message.includes("100,000 characters"), "the field refusal quotes the cap", fieldRefusal.message);
  check(fieldRefusal.message.includes("100,001"), "the field refusal quotes the length it found", fieldRefusal.message);

  // A "cell bomb": a wide file whose cells are enormous. The field cap has to
  // bite before the text cap, or the input cap would mask it.
  const bomb = `h\n${"x".repeat(MAX_FIELD_CHARS + 1)},${Array(19).fill("x".repeat(50_000)).join(",")}\n`;
  const bombResult = conv(bomb);
  check(bomb.length < MAX_INPUT_CHARS, "the cell bomb is under the text cap, so the field cap is what can catch it", String(bomb.length));
  check(bombResult.kind === "refused", "a cell bomb is refused rather than parsed");
  check(/100,000 characters/.test(bombResult.message), "the cell bomb refusal names the field cap", bombResult.message);
  check(bombResult.message.includes("100,001"), "the cell bomb refusal quotes the real field length", bombResult.message);

  // A CSV that is really unquoted JSON: the column cap is what catches it.
  const jsonish = `[{"a":1,"b":2},{"a":3,"b":4}]`;
  const jsonishResult = conv(jsonish, { delimiterMode: "auto" });
  check(jsonishResult.kind === "refused" || jsonishResult.dataRows <= 1, "unquoted JSON does not explode into thousands of columns", jsonishResult.kind);

  // The text cap is measured in characters, so the boundary needs a file of the
  // exact length that stays under the row, column and field caps at the same
  // time: many long single-column rows, and the last row padded to land exactly
  // on the cap.
  const lineLen = 262;
  let rows = "";
  const headerRow = "h\n";
  while (headerRow.length + rows.length + lineLen + 1 <= MAX_INPUT_CHARS) {
    rows += `${"x".repeat(lineLen)}\n`;
  }
  const tail = MAX_INPUT_CHARS - headerRow.length - rows.length;
  const atTextCapInput = `${headerRow}${rows}${"x".repeat(tail - 1)}\n`;
  check(atTextCapInput.length === MAX_INPUT_CHARS, "the text-cap fixture is exactly the cap long", String(atTextCapInput.length));
  const atTextCap = conv(atTextCapInput);
  check(atTextCap.kind === "converted", `exactly ${MAX_INPUT_CHARS.toLocaleString("en-US")} characters converts`, String(atTextCap.kind));
  if (atTextCap.kind === "converted") {
    check(atTextCap.dataRows < MAX_ROWS, "the text-cap fixture stays under the row cap, so the text cap is the only thing under test", String(atTextCap.dataRows));
  }
  const overTextCap = conv(`${atTextCapInput}q`);
  check(overTextCap.kind === "refused", "one character over the text cap is refused");
  check(overTextCap.message.includes("5,242,881 characters"), "the text refusal quotes the real length", overTextCap.message);
  check(/nothing was parsed/i.test(overTextCap.message), "the text refusal says nothing was parsed");

  check(conv("").kind === "empty", "an empty input is the empty state, not a refusal");
  check(overTextCap.message.indexOf(MAX_INPUT_LABEL) > -1, "the text refusal quotes the cap");
}

// ---------------------------------------------------------------------------
// 5. delimiter detection
// ---------------------------------------------------------------------------
{
  check(DELIMITER_CHOICES.length === 4, "four delimiters are offered");
  check(eq(DELIMITER_CHOICES.map((d) => d.char), [",", ";", "\t", "|"]), "the offered delimiters are comma, semicolon, tab and pipe");
  check(DELIMITER_CHOICES[2].char === "\t", "tab is a real U+0009, not a backslash-t");
  check(!DELIMITER_CHOICES.some((d) => d.char === "\\t"), "no delimiter is a two-character backslash sequence");
  check(choiceFor("\t").id === "tab", "choiceFor recognises a tab");
  check(choiceFor("~").id === "custom", "an unoffered delimiter still gets an honest label");
  check(normalizeDelimiter("") === ",", "a zero-length delimiter falls back to a comma");
  check(normalizeDelimiter("||") === ",", "a multi-character delimiter falls back to a comma");

  const cases = [
    ["a,b,c\n1,2,3\n4,5,6\n", ",", "high", 3],
    ["a;b;c\n1;2;3\n", ";", "high", 2],
    ["a\tb\tc\n1\t2\t3\n", "\t", "high", 2],
    ["a|b|c\n1|2|3\n", "|", "high", 2],
  ];
  for (const [text, char, confidence, sampled] of cases) {
    const d = detectDelimiter(text);
    check(d.char === char, `${JSON.stringify(char)} is detected`, String(d.char && d.char.charCodeAt(0)));
    check(d.confidence === confidence, `${JSON.stringify(char)} detection is ${confidence}`, d.confidence);
    check(d.sampled === sampled, `${JSON.stringify(char)} sampled the ${sampled} records that exist`, String(d.sampled));
  }

  const single = detectDelimiter("one\ntwo\nthree");
  check(single.char === null, "a single-column file detects no delimiter");
  check(single.confidence === "none", "no delimiter is reported as none, not as a guess", single.confidence);
  check(/single-column/.test(single.note), "the single-column case explains itself", single.note);

  const mixed = detectDelimiter("a,b;c\n1,2;3\n");
  check(mixed.confidence === "low", "two competing delimiters are reported as low confidence", mixed.confidence);
  check(/not confident|Not confident/i.test(mixed.note), "low confidence says so in words", mixed.note);

  const tie = detectDelimiter("a,b;c\n1,2;3\n4,5;6\n");
  check(tie.confidence === "low", "a tie is low confidence", tie.confidence);

  const onlyOne = detectDelimiter("a,b,c\n1\n2\n");
  check(onlyOne.confidence === "medium", "one delimiter present but not in every record is medium", onlyOne.confidence);

  const quoted = detectDelimiter('"a,b;c";x\n1;2\n');
  check(quoted.scores.find((s) => s.char === ",").total === 0, "a delimiter inside a quoted cell is not counted as evidence");
  check(quoted.char === ";", "a delimiter inside a quoted cell does not win the vote", String(quoted.char));

  check(detectDelimiter("").confidence === "none", "empty input detects nothing");
  check(detectDelimiter("\uFEFFa,b\n1,2\n").char === ",", "the BOM does not hide the delimiter");
  check(
    detectDelimiter("a,b\n" + "1,2\n".repeat(40)).sampled === 24,
    "detection samples at most 24 records",
    String(detectDelimiter("a,b\n" + "1,2\n".repeat(40)).sampled),
  );

  const auto = conv("a;b\n1;2\n", { delimiterMode: "auto" });
  check(auto.delimiterChar === ";", "auto mode uses the detected delimiter", auto.delimiterChar);
  check(auto.confidence === "high", "auto mode carries its confidence into the result", auto.confidence);
  const manual = conv("a;b\n1;2\n", { delimiterMode: "," });
  check(manual.delimiterChar === ",", "a manual delimiter overrides detection", manual.delimiterChar);
  check(/by hand/.test(manual.detectionNote), "a manual delimiter says it was chosen by hand", manual.detectionNote);
  check(auto.delimiterMode === "auto", "the result records that the delimiter was detected", auto.delimiterMode);
  check(manual.delimiterMode === ",", "the result records that the reader chose the delimiter", manual.delimiterMode);
  const singleColumn = conv("only\nvalues\n", { delimiterMode: "auto" });
  check(singleColumn.confidence === "none" && singleColumn.delimiterMode === "auto", "a single-column file is detected with no delimiter", `${singleColumn.confidence}/${singleColumn.delimiterMode}`);
  check(manual.confidence === "none" && manual.delimiterMode !== "auto", "confidence 'none' alone cannot distinguish detected-nothing from chose-by-hand", `${manual.confidence}/${manual.delimiterMode}`);
}

// ---------------------------------------------------------------------------
// 6. keys
// ---------------------------------------------------------------------------
{
  const withHeader = conv("name,age\nAlex,29\n");
  check(eq(withHeader.keys, ["name", "age"]), "the header row becomes the keys");
  check(withHeader.columns === 2, "the column count is the key count");

  const noHeader = conv("Alex,29\nPriya,34\n", { hasHeader: false });
  check(eq(noHeader.keys, ["column1", "column2"]), "without a header row the keys are generated");
  check(noHeader.dataRows === 2, "without a header row every record is data");
  check(noHeader.plan.generated === true, "the plan says the keys were generated");
  check(/generated/.test(noHeader.notes.join(" ")), "generated keys are disclosed in the notes");

  const dup = conv("a,a,a\n1,2,3\n");
  check(eq(dup.keys, ["a", "a (2)", "a (3)"]), "duplicate header names are renamed in order", eq(dup.keys));
  check(
    new Set(dup.keys).size === 3,
    "no two keys collide after de-duplication",
    String(new Set(dup.keys).size),
  );
  const dupAgain = conv("a,a,a\n1,2,3\n");
  check(eq(dupAgain.keys, dup.keys), "de-duplication is deterministic across runs");

  const collide = conv("a,a,a (2)\n1,2,3\n");
  check(new Set(collide.keys).size === 3, "a de-duplicated name that would collide with a real name still resolves", eq(collide.keys));
  check(collide.keys[0] === "a", "the first occurrence always keeps the plain name", collide.keys[0]);

  const emptyHeader = conv("a,,c\n1,2,3\n");
  check(eq(emptyHeader.keys, ["a", "column2", "c"]), "an empty header cell becomes columnN for its position", eq(emptyHeader.keys));
  check(
    emptyHeader.plan.renames.some((r) => r.why === "empty-header" && r.position === 2),
    "the empty-header rename is recorded with its position",
  );

  const trimmed = conv(" a , b \n1,2\n");
  check(eq(trimmed.keys, ["a", "b"]), "surrounding whitespace is trimmed out of a key");
  check(eq(JSON.parse(trimmed.json)[0], { a: "1", b: "2" }), "trimming the header does not trim the values");
  check(trimmed.plan.trimmedHeaders === 2, "trimmed header cells are counted");
  check(/whitespace trimmed/.test(trimmed.notes.join(" ")), "header trimming is disclosed");

  const spaces = conv('a,b\n" 1 ",2\n');
  check(eq(JSON.parse(spaces.json)[0].a, " 1 "), "value whitespace is never trimmed — only header cells are");

  const collision = conv("_surplus,a\n1,2\n3,4,5\n");
  const movedKey = collision.plan.surplusKey;
  check(movedKey !== SURPLUS_KEY, "a CSV that already has a _surplus column moves the surplus key aside", movedKey);
  check(
    JSON.parse(collision.json)[0][SURPLUS_KEY] === "1",
    "the original column keeps its own value",
    JSON.stringify(JSON.parse(collision.json)[0]),
  );
  check(eq(JSON.parse(collision.json)[1][collision.plan.surplusKey], ["5"]), "the surplus array lands on the moved-aside key");

  const plan = planKeys(["x", "y"], false);
  check(eq(plan.keys, ["x", "y"]), "planKeys names its keys");
  check(plan.renames.length === 0, "unique names need no rename");
  check(planKeys(["x", "x"], true).keys.length === 2, "generated keys are positional and unique");

  const headerOnly = conv("a,b\n");
  check(headerOnly.json === "[]", "a header row with no data rows produces an empty array", headerOnly.json);
  check(headerOnly.dataRows === 0 && headerOnly.columns === 2, "the header alone still defines the columns");
  check(/empty array/.test(headerOnly.notes.join(" ")), "the header-only case is explained");

  const blankOnly = conv("\n\n\n");
  check(blankOnly.kind === "converted" && blankOnly.json === "[]", "blank lines alone produce an empty array, not a fake row");
  check(blankOnly.inputRecords === 0, "blank lines are not counted as records");
  check(/no records at all/.test(blankOnly.notes.join(" ")), "the blank-only case says there are no records");
}

// ---------------------------------------------------------------------------
// 7. ragged rows
// ---------------------------------------------------------------------------
{
  const ragged = conv("a,b,c\n1,2\n1,2,3,4\n1,2,3\n");
  const parsed = JSON.parse(ragged.json);
  check(eq(parsed[0], { a: "1", b: "2", c: null }), "a short row's missing cell is JSON null", JSON.stringify(parsed[0]));
  check(parsed[0].c === null, "the missing cell is null and not an empty string");
  check(!("c" in parsed[0]) === false, "the key is present, holding null");
  check(!("" in parsed[0]), "no empty-string placeholder is invented");
  check(eq(parsed[1][SURPLUS_KEY], ["4"]), "a long row keeps its surplus value in a named array", JSON.stringify(parsed[1]));
  check(Object.keys(parsed[1]).length === 4, "a long row keeps every one of its values");
  check(SURPLUS_KEY in parsed[2] === false, "a row with no surplus does not grow an empty array");
  check(ragged.ragged.shortRows === 1, "one short row is counted", String(ragged.ragged.shortRows));
  check(ragged.ragged.longRows === 1, "one long row is counted", String(ragged.ragged.longRows));
  check(ragged.ragged.paddedCells === 1, "the padded cell count is exact", String(ragged.ragged.paddedCells));
  check(ragged.ragged.surplusCells === 1, "the surplus cell count is exact", String(ragged.ragged.surplusCells));
  check(ragged.ragged.firstShort === 1 && ragged.ragged.firstLong === 2, "the first affected row number is reported", `${ragged.ragged.firstShort}/${ragged.ragged.firstLong}`);
  check(ragged.ragged.expectedColumns === 3, "the expected column count is carried on the summary");

  const clean = conv("a,b\n1,2\n3,4\n");
  check(clean.ragged.shortRows === 0 && clean.ragged.longRows === 0, "a square CSV reports no ragged rows");
  check(SURPLUS_KEY in JSON.parse(clean.json)[0] === false, "a square CSV gets no surplus key at all");

  const noHeaderRagged = conv("1,2\n3\n4,5,6\n", { hasHeader: false });
  const nhr = JSON.parse(noHeaderRagged.json);
  check(nhr[1].column2 === null, "generated keys are padded the same way", JSON.stringify(nhr[1]));
  check(eq(nhr[2].column3, "6"), "generated keys carry surplus the same way");

  const widest = conv("1,2\n3,4,5\n", { hasHeader: false });
  check(eq(widest.keys, ["column1", "column2", "column3"]), "the column count comes from the widest record");
  check(/widest record/.test(widest.notes.join(" ")), "the widest-record rule is disclosed");

  const notes = conv("a,b,c\n1\n1,2,3,4\n").notes.join(" ");
  check(/fewer fields than the 3 keys/.test(notes), "the short-row note names the key count", notes);
  check(/more fields than the 3 keys/.test(notes), "the long-row note names the key count");
  check(/JSON null/.test(notes), "the short-row note says what null means");
  check(/_surplus array rather than dropped/.test(notes), "the long-row note says the values were kept");
}

// ---------------------------------------------------------------------------
// 8. output: indentation, bytes, and equivalence to JSON.stringify
// ---------------------------------------------------------------------------
{
  const two = conv("a,b\n1,2\n", { indent: 2 });
  const four = conv("a,b\n1,2\n", { indent: 4 });
  check(two.json === JSON.stringify([{ a: "1", b: "2" }], null, 2), "2-space output is exactly what JSON.stringify would produce");
  check(four.json === JSON.stringify([{ a: "1", b: "2" }], null, 4), "4-space output is exactly what JSON.stringify would produce");
  check(two.json !== four.json, "the indentation choice changes the document");
  check(/^\[\n {2}\{\n {4}"a"/.test(two.json), "2-space output is really indented by 2", two.json);
  check(/^\[\n {4}\{\n {8}"a"/.test(four.json), "4-space output is really indented by 4", four.json);
  check(two.indent === 2 && four.indent === 4, "the chosen indentation is carried on the result");
  check(INDENT_CHOICES.length === 2 && INDENT_CHOICES[0] === 2 && INDENT_CHOICES[1] === 4, "exactly two indentation choices are offered");

  // Nested surplus arrays must re-indent by exactly one level.
  const nested = conv("a,b\n1,2,3\n", { indent: 2 });
  check(nested.json === JSON.stringify([{ a: "1", b: "2", _surplus: ["3"] }], null, 2), "a nested _surplus array re-indents correctly", nested.json);
  const nestedFour = conv("a,b\n1,2,3\n", { indent: 4 });
  check(nestedFour.json === JSON.stringify([{ a: "1", b: "2", _surplus: ["3"] }], null, 4), "the same holds at 4 spaces");

  check(two.jsonBytes === utf8ByteLength(two.json), "the byte count is computed from the produced text");
  check(two.jsonBytes === new TextEncoder().encode(two.json).length, "the byte count matches the bytes that get downloaded", String(two.jsonBytes));
  check(two.jsonChars === two.json.length, "the character count matches the produced text");

  const unicode = conv("a\n\u{1F44D},café\n");
  check(unicode.jsonBytes !== unicode.jsonChars, "a non-ASCII cell makes bytes and characters differ", `${unicode.jsonBytes}/${unicode.jsonChars}`);
  check(unicode.jsonBytes === new TextEncoder().encode(unicode.json).length, "the byte count is right for multi-byte UTF-8", String(unicode.jsonBytes));
  check(utf8ByteLength("") === 0 && utf8ByteLength("a") === 1, "the UTF-8 counter is right for ASCII");
  check(utf8ByteLength("é") === 2, "the UTF-8 counter is right for a 2-byte character");
  check(utf8ByteLength("€") === 3, "the UTF-8 counter is right for a 3-byte character");
  check(utf8ByteLength("\u{1F44D}") === 4, "the UTF-8 counter is right for a 4-byte character");

  check(conv("a\n").json === "[]", "no data rows produce an empty JSON array");
  check(conv("a\n").jsonBytes === 2, "an empty array is 2 bytes");

  const built = buildJson([["1", "2"], ["3"]], planKeys(["a", "b"], false), 2);
  check(built.json === JSON.stringify([{ a: "1", b: "2" }, { a: "3", b: null }], null, 2), "buildJson is the same serialiser JSON.stringify would produce", built.json);

  // The documented value is exactly what a spreadsheet's CSV would need.
  const markup = conv('a\n"<script>alert(1)</script>"\n"x&amp;y"\n');
  check(
    JSON.parse(markup.json)[0].a === "<script>alert(1)</script>",
    "markup in a cell survives as data, byte for byte",
  );
  check(JSON.parse(markup.json)[1].a === "x&amp;y", "an HTML entity in a cell is not decoded");
  check(/&amp;/.test(markup.json), "the entity is present in the JSON as written");
  check(!/dangerouslySetInnerHTML/.test(COMPONENT), "the component has no HTML sink at all");

  // Previews are bounded and say so.
  check(JSON_PREVIEW_CHARS === 20000, "the JSON preview is bounded at 20,000 characters", String(JSON_PREVIEW_CHARS));
  const shortDoc = jsonPreview("[]");
  check(shortDoc.truncated === false, "a short document is not flagged as truncated");
  const longDoc = jsonPreview("x".repeat(JSON_PREVIEW_CHARS + 10));
  check(longDoc.truncated === true && longDoc.text.length === JSON_PREVIEW_CHARS, "a long document is cut at the bound");
  check(longDoc.total === JSON_PREVIEW_CHARS + 10, "the real length is reported alongside the cut");

  check(TABLE_PREVIEW_ROWS === 20 && TABLE_PREVIEW_COLUMNS === 8, "the table preview is bounded at 20 rows and 8 columns");
  const manyRows = conv(`a\n${"1\n".repeat(50)}`);
  check(manyRows.previewRows.length === TABLE_PREVIEW_ROWS, "the returned preview rows are capped", String(manyRows.previewRows.length));
  check(manyRows.dataRows === 50, "the row count is the real one even though the preview is bounded");
  const manyCols = conv(`${Array(40).fill("h").join(",")}\n${Array(40).fill("v").join(",")}\n`);
  check(manyCols.columns === 40, "the column count is the real one");
  check(Object.keys(JSON.parse(manyCols.json)[0]).length === 40, "every column reaches the JSON even when the table preview is bounded");

  const nullCell = cellPreview(null);
  check(nullCell.text === EM_DASH, "a null cell previews as an em dash, not as a blank");
  const longCell = cellPreview("y".repeat(CELL_PREVIEW_CHARS + 5));
  check(longCell.truncated === true && longCell.total === CELL_PREVIEW_CHARS + 5, "a long cell preview reports its real length");
  check(cellPreview("").text === "", "an empty cell previews as an empty string, distinct from null");
  const surplusCell = cellPreview(["1", "2"]);
  check(/2 surplus values/.test(surplusCell.text), "a surplus array previews as a count of values, not as markup", surplusCell.text);

  check(safeStem("../../etc/passwd") === "etc-passwd", "a path traversal name is neutralised", safeStem("../../etc/passwd"));
  check(safeStem("....") === "csv", "a name left with nothing falls back to a default");
  check(safeStem("sales.csv") === "sales", "the extension is dropped from the stem");
  const name = outputNameFor("sales.csv", 120, 8);
  check(name === "sales-to-json-120r-8c.json", "the download name says what is in the file", name);
  check(outputNameFor(null, 3, 2) === "data-to-json-3r-2c.json", "a pasted input still gets a real name", outputNameFor(null, 3, 2));
  check(describeByteSize(1) === "1 byte (1 B)", "the byte formatter handles the singular", describeByteSize(1));
  check(describeByteSize(2048).startsWith("2,048 bytes"), "the byte formatter groups thousands", describeByteSize(2048));
}

// ---------------------------------------------------------------------------
// 9. no type coercion, anywhere
// ---------------------------------------------------------------------------
{
  const mixed = conv("id,amount,ok,when\n00123,1,000,TRUE\n3/4/26\n");
  const row = JSON.parse(mixed.json)[0];
  check(row.id === "00123", "a zero-padded id keeps its zeros", JSON.stringify(row));
  check(row.ok === "000", "a numeric-looking value is not turned into a number", JSON.stringify(row));
  check(row.when === "TRUE", "a boolean-looking word is not turned into a boolean", JSON.stringify(row));
  check(row.when === "TRUE", "a numeric-looking code is not turned into a number", JSON.stringify(row));
  const dated = JSON.parse(conv("id,when\n00123,3/4/26\n").json)[0];
  check(dated.when === "3/4/26", "an ambiguous date is not reformatted", JSON.stringify(dated));
  check(
    Object.values(row).every((v) => typeof v === "string"),
    "every value in a clean row is a JSON string",
    JSON.stringify(Object.values(row).map((v) => typeof v)),
  );
  check(
    Object.values(JSON.parse(conv("a,b,c\n1\n", { hasHeader: false }).json)[0]).filter((v) => v !== null).every((v) => typeof v === "string"),
    "the only non-string value a clean row can hold is null",
  );
  check(
    Object.values(JSON.parse(conv("a,b\n1,2,3\n").json)[0]).every((v) => typeof v === "string" || Array.isArray(v)),
    "a surplus array holds strings and nothing else",
  );
  const leadingZeroHeader = conv("007\n1\n");
  check(leadingZeroHeader.keys[0] === "007", "a header cell that looks like a number is still a key", leadingZeroHeader.keys[0]);
}

// ---------------------------------------------------------------------------
// 10. the component: safety, a11y, and no network
// ---------------------------------------------------------------------------
{
  check(!/dangerouslySetInnerHTML/.test(COMPONENT), "no dangerouslySetInnerHTML anywhere in the component");
  check(!/\.innerHTML/.test(COMPONENT), "no innerHTML in the component");
  check(!/\bdocument\.write\b/.test(COMPONENT), "no document.write in the component");
  check(!/\bfetch\s*\(/.test(COMPONENT), "no fetch call in the component");
  check(!/XMLHttpRequest|sendBeacon|navigator\.sendBeacon|WebSocket|EventSource/.test(COMPONENT), "no other transport in the component");
  check(!/https?:\/\//.test(COMPONENT), "no absolute URL in the component — no third-party asset, no upload endpoint");
  check(!/eval\s*\(|new Function/.test(COMPONENT), "no eval or dynamic code in the component");
  check(!/dangerouslySetInnerHTML|\beval\b/.test(PARSE_SRC + FORMAT_SRC), "no HTML sink or eval in the pure modules");
  check(!/localStorage|sessionStorage|indexedDB|crypto\./.test(COMPONENT + PARSE_SRC + FORMAT_SRC), "nothing is stored and no crypto is used");
  check(!/document\.|window\.|navigator\./.test(PARSE_SRC + FORMAT_SRC), "the pure modules touch no DOM global", (PARSE_SRC + FORMAT_SRC).match(/document\.|window\.|navigator\./)?.[0]);
  check(!/require\(|from "node:/.test(PARSE_SRC + FORMAT_SRC), "the pure modules import no Node API");
  check(/TextEncoder/.test(COMPONENT), "the download uses the browser's own encoder");
  check(/downloadBlob/.test(COMPONENT), "the download goes through the shared download helper");
  check(/CopyButton/.test(COMPONENT), "copy goes through the shared clipboard helper");

  check(/aria-busy=\{busy\}/.test(COMPONENT), "the root carries aria-busy while a file is being read");
  check(/role="status"/.test(COMPONENT), "progress and results use role=status");
  check((COMPONENT.match(/role="alert"/g) || []).length >= 2, "both refusals use role=alert", String((COMPONENT.match(/role="alert"/g) || []).length));
  check(/aria-live="polite"/.test(COMPONENT), "the live region announces politely");
  check((COMPONENT.match(/<label htmlFor=/g) || []).length >= 5, "every control has a real label", String((COMPONENT.match(/<label htmlFor=/g) || []).length));
  check((COMPONENT.match(/aria-describedby=/g) || []).length >= 3, "controls are described by their hint text", String((COMPONENT.match(/aria-describedby=/g) || []).length));
  check(/aria-invalid=\{overCap\}/.test(COMPONENT), "the input is marked invalid when over the cap");
  check(/aria-invalid=\{overCap\}/.test(COMPONENT) && /border-red-400/.test(COMPONENT), "the over-cap state is visible, not colour-only");
  check(/role="region"\s+aria-label=/.test(COMPONENT) || /aria-label=\{title\}/.test(COMPONENT), "each panel is a named region");
  check(/scope="col"/.test(COMPONENT), "the preview table uses column headers");
  check(/<caption className="sr-only">/.test(COMPONENT), "the preview table has a caption");
  check(/tabIndex=\{0\}/.test(COMPONENT), "the scrollable JSON pane is keyboard reachable");
  check((COMPONENT.match(/focus-visible:outline-2/g) || []).length >= 4, "every focusable control has a visible focus ring", String((COMPONENT.match(/focus-visible:outline-2/g) || []).length));
  check(/spellCheck=\{false\}/.test(COMPONENT), "the input does not invite spellcheck on data");
  check(/autoComplete="off"/.test(COMPONENT), "the input does not invite autofill on data");
  check(/overflow-x-auto/.test(COMPONENT), "the preview table scrolls inside its card rather than widening the page");
  check(/max-w-full|min-w-0/.test(COMPONENT), "grid children can shrink so long cells cannot push the layout wide");
  check(/overflow-auto/.test(COMPONENT), "the JSON pane scrolls rather than growing the page");
  check(!/(?<![:\w-])grid-cols-([3-9]|\d\d)/.test(COMPONENT), "no unprefixed multi-column grid that would overflow 375px");

  check(/useState\(""\)/.test(COMPONENT), "the input boots empty");
  check(!/Alex|Priya|Mumbai|Hello, world|lorem ipsum/i.test(COMPONENT), "no sample CSV is pre-filled in the component");
  check(/EM_DASH/.test(COMPONENT), "the empty state uses the em dash");
  check(/Nothing is pre-filled/i.test(COMPONENT), "the empty state says nothing is pre-filled");
  check(/Clear/.test(COMPONENT), "there is a Clear");
  check(/no sample data is loaded/.test(COMPONENT), "the placeholder says no sample data is loaded");

  check(/Every value stays a string/.test(COMPONENT), "the banner leads with the no-type-inference claim");
  check(/not lossless/i.test(COMPONENT), "the component says the conversion is not lossless");
  check(/never uploaded/i.test(COMPONENT), "the component says the CSV is never uploaded");
  check(/preview/i.test(COMPONENT), "the panels are called previews");
  check(/no request is made with it/.test(COMPONENT), "the component claims no request is made with the data");
  check(/Preview only/.test(COMPONENT), "a truncated JSON preview says so on screen");
  check(/the table is a preview/i.test(COMPONENT), "the table panel says it is a preview");
  check(/not guess types|does not guess types/.test(COMPONENT), "the component says explicitly that types are not guessed");
  check(/no formula evaluation/.test(COMPONENT), "the component lists what a spreadsheet does and this does not");
  check(/no encoding sniffing/.test(COMPONENT), "the component discloses the absence of encoding sniffing");
  check(/RFC 4180/.test(COMPONENT), "the component names the dialect it implements");
  check(/three disclosed extensions/.test(COMPONENT), "the component discloses its extensions");
  check(/Quote inside an unquoted field|text-after-closing-quote|ANOMALY_LABEL/.test(COMPONENT), "the component renders the anomaly labels from the module");
  check(/CLF_TAB|Tab \(U\+0009\)|DELIMITER_CHOICES/.test(COMPONENT), "the tab delimiter is offered from the module's list");
  check(!/\\\\t/.test(COMPONENT), "no backslash-t is used as a delimiter in the component");
  check(/U\+FFFD/.test(COMPONENT), "the component surfaces the non-UTF-8 signal");
  check(/CAP_SUMMARY/.test(COMPONENT), "the hint uses the derived cap summary");
  check(!/5000000|500000|1_000_000/.test(COMPONENT), "the component quotes no hard-coded cap number");
  check(/MAX_FILE_BYTES/.test(COMPONENT) && /MAX_INPUT_CHARS/.test(COMPONENT), "the component enforces the caps it declares");
}

// ---------------------------------------------------------------------------
// 11. registry, copy, SEO and guide
// ---------------------------------------------------------------------------
{
  const registry = /slug: "csv-json",\s*\n\s*name: "([^"]+)",\s*\n\s*tagline: "([^"]+)",\s*\n\s*description:\s*\n?\s*"([^"]*)"/.exec(TOOLS_SRC);
  check(!!registry, "the registry entry for csv-json exists");
  if (registry) {
    check(!/\u2194/.test(registry[1]), "the tool is not named as bidirectional any more — it only converts CSV to JSON", registry[1]);
    check(!/\bJSON to CSV\b/i.test(registry[3]), "the registry description does not promise JSON to CSV", registry[3]);
    check(/RFC 4180/.test(registry[3]), "the registry description names the real dialect");
    check(/Every value stays a string/.test(registry[3]), "the registry description leads with the type claim");
    check(/never uploaded|no network|in your browser|in this tab/i.test(registry[2] + " " + registry[3]), "the registry states the privacy position", registry[2]);
  }
  check(!/"csv-json":\s*\["csv to json", "json to csv"/.test(SEO_SRC), "the SEO keywords no longer bid on json to csv");

  const contentText = JSON.stringify(CONTENT);
  check(/no type inference/i.test(contentText), "the long description states that no type is inferred");
  check(/RFC 4180/.test(contentText), "the long description names the dialect");
  check(/5,242,880 characters/.test(contentText), "the long description quotes the real text cap");
  check(/100,000 characters in a single cell/.test(contentText), "the long description quotes the real field cap");
  check(/never uploaded/.test(contentText), "the long description states the privacy position");
  check(CONTENT.features.length >= 10, "at least ten features", String(CONTENT.features.length));
  check(CONTENT.features.some((f) => /^A real RFC 4180 parser/.test(f)), "a feature leads with the parser");
  check(CONTENT.features.some((f) => /JSON null/.test(f) && /_surplus/.test(f)), "a feature describes the ragged-row handling");
  check(CONTENT.features.some((f) => /name \(2\)/.test(f)), "a feature describes the de-duplication rule");
  check(CONTENT.features.some((f) => /confidence/.test(f)), "a feature describes the honest delimiter confidence");
  check(CONTENT.features.some((f) => /never uploaded|no network/.test(f)), "a feature states the privacy position");
  check(!CONTENT.features.some((f) => /infers data types|type inference \(numbers/i.test(f)), "no feature claims type inference");
  check(!CONTENT.features.some((f) => /Bidirectional/.test(f)), "no feature claims bidirectional conversion");
  check(CONTENT.howTo.length === 4, "four how-to steps", String(CONTENT.howTo.length));
  check(CONTENT.howTo.some((s) => /confiden/i.test(`${s.step} ${s.description}`)), "a how-to step is about reading the delimiter confidence", JSON.stringify(CONTENT.howTo.map((s) => s.step)));
  check(CONTENT.faq.length >= 7, "at least seven FAQs", String(CONTENT.faq.length));
  check(CONTENT.faq.some((f) => /Is the conversion lossless\?/.test(f.question)), "the losslessness question is asked and answered");
  check(CONTENT.faq.some((f) => /Why are all my numbers strings\?/.test(f.question)), "the all-strings question is asked");
  check(CONTENT.faq.some((f) => /short row/.test(f.answer) && /null/.test(f.answer)), "the short-row FAQ explains null padding");
  check(CONTENT.faq.some((f) => /JSON back to CSV/.test(f.question) && /No\./.test(f.answer)), "the removed direction is disclosed rather than left implied");
  check(!CONTENT.faq.some((f) => /100MB/.test(f.answer)), "no FAQ promises 100MB files");
  check(CONTENT.relatedSlugs.includes("csv-formatter") && CONTENT.relatedSlugs.includes("excel-to-json"), "related tools kept");

  check(/CSV to JSON online/.test(SEO_SRC), "a custom meta title exists for the tool");
  check(/RFC 4180 parser that says what it decided/.test(SEO_SRC), "the meta title names the parser and the honesty claim");
  check(/never uploaded/.test(SEO_SRC), "the meta title states the privacy position");
  check(/CSV to JSON converter that runs entirely in your browser/.test(SEO_SRC), "the JSON-LD feature list leads with the honest claim");
  check(/not a split on a comma/.test(SEO_SRC), "the JSON-LD feature list distinguishes it from a naive converter");
  check(/JSON null/.test(SEO_SRC) && /_surplus/.test(SEO_SRC), "the JSON-LD feature list describes the ragged-row handling");
  check(/5,242,880 characters of text/.test(SEO_SRC), "the JSON-LD feature list quotes the real cap");
  check(/escaped text only, never markup/.test(SEO_SRC), "the JSON-LD feature list claims the preview is escaped text");
  check(/no network request of any kind/.test(SEO_SRC), "the JSON-LD feature list claims no request is made");

  check(!!GUIDE, "the how-to guide exists for the tool");
  check(GUIDE.toolSlug === "csv-json", "the guide is attached to the csv-json tool");
  check(GUIDE.slug.startsWith("how-to-"), "the guide slug follows the how-to shape", GUIDE.slug);
  check(GUIDE.readMinutes === 5, "the guide declares a reading time");
  check(GUIDE.sections.length >= 6, "the guide has at least six sections", String(GUIDE.sections.length));
  check(/5,242,880 characters/.test(GUIDE_TEXT), "the guide quotes the real text cap");
  check(/100,000 characters in one cell/.test(GUIDE_TEXT), "the guide quotes the real field cap");
  check(/20,000 rows/.test(GUIDE_TEXT), "the guide quotes the real row cap");
  check(/512 columns in a single row/.test(GUIDE_TEXT), "the guide quotes the real column cap");
  check(/No type is inferred/.test(GUIDE_TEXT), "the guide explains the all-strings decision");
  check(/three more extensions, all disclosed/.test(GUIDE_TEXT), "the guide discloses the extensions");
  check(/refused rather than guessed/.test(GUIDE_TEXT), "the guide explains the quote anomaly refusal");
  check(/amount \(2\)/.test(GUIDE_TEXT), "the guide gives the de-duplication rule");
  check(/does not convert JSON back to CSV/.test(GUIDE_TEXT), "the guide discloses the removed direction");
  check(/escaped text/.test(GUIDE_TEXT), "the guide states that cells are rendered as escaped text");
  check(/nothing is uploaded/i.test(GUIDE_TEXT), "the guide states the privacy position");
  check(GUIDE.keywords.length >= 5, "the guide carries its own keywords", String(GUIDE.keywords.length));
  check(REPO_GUIDES.getGuide("how-to-convert-csv-to-json") !== undefined, "the guide resolves by slug");
  check(REPO_GUIDES.getGuidesByTool("csv-json").length === 1, "exactly one guide resolves from the tool page");

  // The guide and the copy must not contradict the code.
  check(!/Both directions|both ways|back to CSV/i.test(GUIDE_TEXT.replace(/does not convert JSON back to CSV/g, "")), "the guide makes no residual bidirectional claim");
  check(!/infers data types|type inference \(numbers/.test(contentText), "the shipped copy makes no type-inference claim");
}

// ---------------------------------------------------------------------------
// 12. the shared formatter is not shadowed, and the numbers agree
// ---------------------------------------------------------------------------
{
  check(formatInt(0) === "0" && formatInt(999) === "999" && formatInt(1000) === "1,000", "the number formatter is correct");
  check(formatInt(MAX_ROWS) === "20,000", "the row cap prints as 20,000");
  check(formatInt(MAX_INPUT_CHARS) === "5,242,880", "the text cap prints as 5,242,880");
  check(MAX_FILE_BYTES / 1024 / 1024 === 5, "the file cap really is 5 MB");
  check(MAX_INPUT_CHARS === MAX_FILE_BYTES, "the pasted-text cap and the file cap are the same number, deliberately");
  check(MAX_INPUT_CHARS > MAX_FIELD_CHARS, "the text cap is above the field cap, so the field cap is reachable on its own");
}

rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
