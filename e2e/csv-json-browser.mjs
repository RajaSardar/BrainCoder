// Production-Chrome e2e for the "CSV to JSON Converter".
//
// Mirrors e2e/image-editor-browser.mjs: real Chrome through playwright-core, the
// real /use/csv-json route, CSV fixtures written to a temp dir as real bytes, and
// every downloaded .json re-parsed from its own file — so the promises the tool
// makes about RFC 4180, about JSON types and about its caps are checked against
// the bytes that came out rather than against a line of UI text.
//
// The cap numbers are read out of src/features/csv-json/csv-parse.ts at run
// time and the labels are derived from them exactly the way csv-format.ts
// derives them, so a future cap change makes this harness assert the new number
// instead of quietly passing against a stale literal. The honesty assertions are
// lifted from the sentences the component actually renders (CsvJson.tsx), and are
// read from the component's own root element so they cannot match another tool's
// copy in the page furniture.
//
//   node e2e/csv-json-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/csv-json-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/csv-json`;
const DL = "/tmp/csv-json-e2e";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// --------------------------------------------------------------------------
// The caps, read out of the shipped parser rather than guessed here
// --------------------------------------------------------------------------
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PARSE_SRC = readFileSync(join(REPO, "src/features/csv-json/csv-parse.ts"), "utf8");

function capConstant(name) {
  const m = new RegExp(`export const ${name} = ([0-9_]+);`).exec(PARSE_SRC);
  if (!m) throw new Error(`${name} is not declared in csv-parse.ts, so this harness cannot assert it`);
  return Number(m[1].replace(/_/g, ""));
}

const MAX_INPUT_CHARS = capConstant("MAX_INPUT_CHARS");
const MAX_FILE_BYTES = capConstant("MAX_FILE_BYTES");
const MAX_ROWS = capConstant("MAX_ROWS");
const MAX_COLUMNS = capConstant("MAX_COLUMNS");
const MAX_FIELD_CHARS = capConstant("MAX_FIELD_CHARS");

// The five label strings, built the way csv-format.ts builds them.
const n = (value) => value.toLocaleString("en-US");
const MAX_INPUT_LABEL = `${n(MAX_INPUT_CHARS)} characters`;
const MAX_FILE_LABEL = `5 MB (${n(MAX_FILE_BYTES)} bytes)`;
const MAX_ROWS_LABEL = `${n(MAX_ROWS)} rows`;
const MAX_COLUMNS_LABEL = `${n(MAX_COLUMNS)} columns per row`;
const MAX_FIELD_LABEL = `${n(MAX_FIELD_CHARS)} characters per cell`;
const EM_DASH = "\u2014";

// Sentences the component ships, copied from CsvJson.tsx with its line numbers,
// so a regex here is written against the copy that renders rather than against
// marketing copy from a different tool.
const SAYS_STRINGS = "Every value stays a string."; // 191
const SAYS_NO_GUESS = "This converter does not guess types"; // 191
const SAYS_NEVER_UPLOADED_BANNER =
  "It is a re-serialisation of your text, not a spreadsheet: your CSV is read in this tab and is never uploaded."; // 196
const SAYS_FOOTER =
  "Converted in this tab \u2014 your CSV is never uploaded, and no request is made with it."; // 576
const SAYS_NOT_LOSSLESS = "This conversion is not lossless, and here is exactly where it changes your data."; // 582
const SAYS_ALL_STRING_VALUES = "no type is inferred \u2014 all values are JSON strings."; // 590
const SAYS_BOTH_PREVIEWS =
  "Both panels above are previews, and the copy and download buttons give you the whole document."; // 617
const EMPTY_STATE =
  `Rows ${EM_DASH} columns ${EM_DASH} JSON size ${EM_DASH} no sample CSV is pre-filled`; // 358
const PLACEHOLDER = "Paste CSV here, or open a file above \u2014 no sample data is loaded"; // 218
const NOT_PREFILLED = "Nothing is pre-filled."; // 229

// Values that exist in no fixture's copy and no page furniture, so finding one in
// a request URL would mean the CSV had been sent somewhere.
const MARKER = "Zaphodqube";

// --------------------------------------------------------------------------
// Fixtures, written as real bytes so CRLF, a bare CR and a BOM survive the disk
// --------------------------------------------------------------------------
const write = (name, data) => writeFileSync(`${DL}/${name}`, Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"));
const utf8 = (text) => Buffer.from(text, "utf8");
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

write("plain.csv", "name,age\nAlex,29\nPriya,34\n");
write("types.csv", "id,zip,amount,ok,when\n00123,01234,1.50,TRUE,3/4/26\n");
write("quoted-comma.csv", 'name,place\n1,"Austin, TX"\n');
write("quoted-newline.csv", 'name,note\n1,"line one\nline two"\n');
write("doubled-quote.csv", 'name,note\n1,"he said ""hi"""\n');
write("crlf.csv", "name,age\r\nAlex,29\r\nPriya,34\r\n");
write("bare-cr.csv", "name,age\rAlex,29\rPriya,34\r");
write("bom.csv", Buffer.concat([BOM, utf8("name,age\nAlex,29\n")]));
write("trailing-newline.csv", "name,age\nAlex,29\n");
write("ragged.csv", "a,b,c\n1,2\n1,2,3,4\n1,2,3\n");
write("duplicates.csv", "name,name,name\nAlex,Priya,Sam\n");
write("semicolon.csv", "name;age\nAlex;29\n");
write("tab.csv", "name\tage\nAlex\t29\n");
write("pipe.csv", "name|age\nAlex|29\n");
write("mixed.csv", "a,b;c\n1,2;3\n");
write("single-column.csv", `${MARKER}\nsecond\n`);
write("anomaly.csv", 'a,b\nx"y,2\n');
write("header-only.csv", "name,age\n");
// A lone 0xE9 is not valid UTF-8, so the browser's decode produces a U+FFFD.
write("latin1.csv", Buffer.concat([utf8("name,note\n1,caf"), Buffer.from([0xe9]), utf8("\n")]));
// One byte over the opened-file cap, refused on size before it is read.
write("oversize.csv", Buffer.alloc(MAX_FILE_BYTES + 1, 0x61));

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
    console.error(`NOT OK  ${label}${extra ? ` \u2014 ${String(extra).slice(0, 300)}` : ""}`);
  }
}
const section = (title) => console.log(`\n--- ${title}`);

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

const consoleIssues = [];
const pageErrors = [];
const offOrigin = [];
const nonGet = [];
const allUrls = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("request", (r) => {
  const url = r.url();
  allUrls.push(url);
  if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) offOrigin.push(url);
  if (r.method() !== "GET") nonGet.push(`${r.method()} ${url}`);
});

// --------------------------------------------------------------------------
// Locators, all bound to things the component actually renders
// --------------------------------------------------------------------------
const tool = () => page.locator("div[aria-busy]").first();
const textarea = () => page.locator("textarea").first();
const fileInput = () => page.locator("input[type='file']");
const headerToggle = () => page.getByLabel("First row is the header");
const delimiterSelect = () => page.getByLabel("Delimiter");
const indentSelect = () => page.getByLabel("JSON indentation");
const jsonPane = () => page.locator("pre[aria-label='JSON output preview']");
const decided = () => page.locator("[role='region'][aria-label='What was decided']");
const anomalyPanel = () => page.locator("[role='region'][aria-label^='Quoting anomalies']");
const tablePanel = () => page.locator("[role='region'][aria-label^='Data preview']");
const copyJson = () => page.locator("button[aria-label='Copy the JSON output']");
const downloadButton = () => page.locator("button", { hasText: /^Download / });
const clearButton = () => page.getByRole("button", { name: "Clear", exact: true });
const emptyState = () => page.locator("div.border-dashed");
const refusalAlert = (t) => page.locator("[role='alert']", { hasText: t });
// Each stat is a card holding a dt and its dd, so the value is read from the
// dd inside the dt's own card rather than through a sibling combinator.
const statValue = (term) => page.locator("dt", { hasText: term }).locator("xpath=..").locator("dd").first();
const statusLine = () => page.locator("[role='status']").filter({ hasText: /converted|Converted|records read/ }).first();
const bodyText = () => page.locator("body").textContent().then((t) => t || "");

/** The component's own copy, so a sweep cannot match another tool in the chrome. */
const toolText = () => tool().textContent().then((t) => t || "");

async function settle(ms = 140) {
  await page.waitForTimeout(ms);
}

/** A file read is async, so wait for aria-busy to clear before reading anything. */
async function waitIdle(timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const busy = await page.evaluate(() => document.querySelector("[aria-busy='true']") !== null);
    if (!busy) break;
    await page.waitForTimeout(50);
  }
  await settle();
}

async function openFixture(name) {
  await fileInput().setInputFiles(`${DL}/${name}`);
  await waitIdle();
}

/**
 * Put text in the box the way a person does, and wait for the result. Values
 * past a few thousand characters are written through the native value setter:
 * Playwright's fill() waits for the textarea to be editable again, and a
 * deliberate refusal re-renders the panel, so a large fill never resolves even
 * though the value lands. The native setter fires the same input event, so
 * React still sees a real change.
 */
async function setCsv(text) {
  if (text.length > 4000) {
    await textarea().evaluate((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, text);
    await settle(400);
    return;
  }
  await textarea().fill(text);
  await settle();
}

/**
 * The 5 MB over-cap case: the string is built inside the page so a megabyte-scale
 * value never has to cross the CDP wire, and React still sees a real change
 * because the value is written through the native setter.
 */
async function setCsvInPage(length) {
  await textarea().evaluate((el, len) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, "h\n" + "x".repeat(len - 2));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, length);
  await settle(400);
}

async function shownJson() {
  await jsonPane().waitFor({ timeout: 30000 });
  return (await jsonPane().textContent()) || "";
}

async function parsedJson() {
  return JSON.parse(await shownJson());
}

/** A refusal that carries the real numbers, found by waiting for the alert. */
async function readRefusal(marker) {
  const box = refusalAlert(marker);
  await box.first().waitFor({ timeout: 30000 });
  return (await box.first().textContent()) || "";
}

async function downloadJson(saveAs, timeout = 60000) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), downloadButton().click()]);
  await dl.saveAs(`${DL}/${saveAs}`);
  await settle();
  return { name: dl.suggestedFilename(), text: readFileSync(`${DL}/${saveAs}`, "utf8") };
}

try {
  // ============================================================== the idle ===
  section("the empty boot state");
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await settle(400);

  check((await textarea().count()) === 1, "there is exactly one CSV input");
  check((await textarea().inputValue()) === "", "the CSV input boots empty, with no sample pre-filled");
  check((await textarea().getAttribute("placeholder")) === PLACEHOLDER, "the placeholder says no sample data is loaded", await textarea().getAttribute("placeholder"));
  check((await jsonPane().count()) === 0, "there is no JSON pane before anything is converted");
  check((await downloadButton().count()) === 0, "there is no download control before anything is converted");
  check((await copyJson().count()) === 0, "there is no copy control before anything is converted");
  check((await page.locator("table").count()) === 0, "there is no data preview table before anything is converted");
  const boot = (await emptyState().first().textContent()) || "";
  check(boot.includes(EMPTY_STATE), "the empty state shows em dash placeholders and says no sample CSV is pre-filled", boot);
  check(/nothing on this page can be mistaken for your data/.test(boot), "and says nothing here can be mistaken for the user's data", boot);
  check((await statusLine().textContent())?.includes("Nothing converted yet.") === true, "the status line reports that nothing has been converted yet", await statusLine().textContent());
  const hint = (await page.locator("textarea").first().evaluate((el) => document.getElementById(el.getAttribute("aria-describedby")).textContent)) || "";
  check(hint.includes(NOT_PREFILLED), "the input's hint says nothing is pre-filled", hint);
  check(hint.includes(MAX_INPUT_LABEL) && hint.includes(MAX_FILE_LABEL), "the hint quotes the pasted-text and opened-file caps", hint);
  check(hint.includes(MAX_ROWS_LABEL) && hint.includes(MAX_COLUMNS_LABEL) && hint.includes(MAX_FIELD_LABEL), "the hint quotes the row, column and cell caps", hint);
  check(/refused with its real numbers/.test(hint), "the hint says each cap is refused with its real numbers", hint);
  check((await fileInput().getAttribute("accept")) === ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain", "the file input accepts the extensions the tool reads");

  // ============================================================ a plain CSV ===
  section("a plain CSV pasted into the box");
  await textarea().click();
  await textarea().fill("");
  await page.keyboard.insertText("name,age\nAlex,29\nPriya,34\n");
  await settle(300);
  const shown = await shownJson();
  let plain = null;
  let plainOk = true;
  try {
    plain = JSON.parse(shown);
  } catch {
    plainOk = false;
  }
  check(plainOk, "the JSON on screen is exactly JSON.parse-able", shown.slice(0, 200));
  check(shown === JSON.stringify(plain, null, 2), "the JSON on screen is the 2-space document, character for character", shown.slice(0, 200));
  check(plain !== null && plain.length === 2, "both data rows are in the output", JSON.stringify(plain));
  check(plain !== null && plain[0].name === "Alex" && plain[0].age === "29", "the first row's cells are the CSV's own text", JSON.stringify(plain && plain[0]));
  check((await statValue("Rows converted").textContent()) === "2", "the rows stat counts data rows, not records");
  check((await statValue("Columns").textContent()) === "2", "the columns stat counts the keys");
  check((await statValue("Records read").textContent()) === "3", "the records-read stat counts the header row as well");
  check(/of JSON\. Every value is a JSON string\./.test((await statusLine().textContent()) || ""), "the status line announces the row count and the string promise");
  check(/Every value is a JSON string/.test((await bodyText()) || ""), "the string promise is on screen while converting");
  const keys = await page.locator("table thead th").allTextContents();
  check(keys.join("|") === "#|name|age", "the preview table's column headers are the keys the JSON uses", keys.join("|"));
  const firstCells = await page.locator("table tbody tr").nth(0).locator("td").allTextContents();
  check(firstCells.join("|") === "1|Alex|29", "the first preview row is the first data row", firstCells.join("|"));
  const delimiterLine = (await decided().textContent()) || "";
  check(delimiterLine.includes(`Delimiter: a comma (confident, auto-detected) ${EM_DASH} the header above shows you the keys this produced.`), "the delimiter line names the delimiter and its confidence", delimiterLine.slice(-200));
  check(/Detected a comma: it appears \d+ times in every one of the first 3 records and no other candidate delimiter appears at all\./.test(delimiterLine), "the detection says why it chose a comma", delimiterLine.slice(-320));
  check(/Line endings: LF\. CRLF, LF and a bare CR all end a record/.test(delimiterLine), "the line endings actually found are reported");

  // ========================================================= no type coercion ===
  section("no type inference");
  await openFixture("types.csv");
  const typed = (await parsedJson())[0];
  check(typed.id === "00123" && typeof typed.id === "string", "a zero-padded id stays the string \"00123\"", JSON.stringify(typed));
  check(typed.zip === "01234" && typeof typed.zip === "string", "a zip code keeps its leading zero", JSON.stringify(typed));
  check(typed.amount === "1.50" && typeof typed.amount === "string", "a decimal stays text, not a number", JSON.stringify(typed));
  check(typed.ok === "TRUE" && typeof typed.ok === "string", "TRUE stays the string \"TRUE\", not a boolean", JSON.stringify(typed));
  check(typed.when === "3/4/26" && typeof typed.when === "string", "an ambiguous date stays in the export's own format", JSON.stringify(typed));
  check(Object.values(typed).every((v) => typeof v === "string"), "no value in the row is anything but a JSON string", JSON.stringify(Object.values(typed).map((v) => typeof v)));
  const banner = (await tool().locator("p", { hasText: SAYS_STRINGS }).first().textContent()) || "";
  check(banner.includes(SAYS_STRINGS) && banner.includes(SAYS_NO_GUESS), "the banner leads with the all-strings decision and says types are not guessed", banner);
  check(banner.includes('"00123"') && banner.includes('"TRUE"') && banner.includes('"3/4/26"'), "the banner quotes the three values the copy promises, as JSON strings", banner);

  // ========================================================== the hard parses ===
  section("the awkward RFC 4180 cases, from real files");
  await openFixture("quoted-comma.csv");
  let row = (await parsedJson())[0];
  check(row.name === "1" && row.place === "Austin, TX", "a quoted cell keeps its embedded comma", JSON.stringify(row));
  check((await page.locator("table tbody tr").nth(0).locator("td").nth(2).textContent()) === "Austin, TX", "and the comma is still there in the preview cell");

  await openFixture("quoted-newline.csv");
  row = (await parsedJson())[0];
  check(row.note === "line one\nline two", "a quoted cell keeps an embedded newline", JSON.stringify(row));
  check(/Line endings: LF\./.test((await decided().textContent()) || ""), "an embedded newline is not counted as a record ending of its own");
  check((await statValue("Rows converted").textContent()) === "1", "an embedded newline does not split the record into two rows");

  await openFixture("doubled-quote.csv");
  row = (await parsedJson())[0];
  check(row.note === 'he said "hi"', "a doubled quote inside a quoted cell becomes one literal quote", JSON.stringify(row));
  check((await anomalyPanel().count()) === 0, "a conformant doubled quote raises no anomaly");

  await openFixture("crlf.csv");
  const crlfRows = await parsedJson();
  check(crlfRows.length === 2 && crlfRows[1].name === "Priya", "CRLF line endings end records", JSON.stringify(crlfRows));
  check(/Line endings: CRLF\./.test((await decided().textContent()) || ""), "the page reports CRLF, not LF");
  check((await page.locator("table tbody tr").count()) === 2, "no phantom row is produced by CRLF");
  // file.text() applies the platform newline convention, so CR is not expected to
  // survive into the textarea; what matters is that the record set and the
  // disclosed line ending both match the file.
  check((await textarea().inputValue()) === "name,age\nAlex,29\nPriya,34\n", "the opened file's content is in the input box", JSON.stringify(await textarea().inputValue()));

  await openFixture("bare-cr.csv");
  const crRows = await parsedJson();
  check(crRows.length === 2 && crRows[0].age === "29" && crRows[1].age === "34", "a bare CR ends a record", JSON.stringify(crRows));
  check(/Line endings: CR\./.test((await decided().textContent()) || ""), "the page reports a bare CR as a line ending");

  await openFixture("bom.csv");
  const bomKeys = await page.locator("table thead th").allTextContents();
  check(bomKeys.join("|") === "#|name|age", "a UTF-8 BOM never becomes part of the first key", bomKeys.join("|"));
  check(/A UTF-8 byte order mark at the start of the input was skipped\./.test((await decided().textContent()) || ""), "the skipped BOM is disclosed on screen");
  check((await parsedJson())[0].name === "Alex", "the row after a BOM parses normally");

  await openFixture("trailing-newline.csv");
  const trailing = await parsedJson();
  check(trailing.length === 1, "a trailing newline does not create a phantom final row", JSON.stringify(trailing));
  check((await statValue("Rows converted").textContent()) === "1", "the row count is not inflated by a trailing newline");
  check((await statValue("Records read").textContent()) === "2", "records read counts the header, not the empty tail");

  // ================================================================ ragged rows ===
  section("ragged rows");
  await openFixture("ragged.csv");
  const ragged = await parsedJson();
  check(ragged[0].c === null && "c" in ragged[0], "a short row's missing cell is JSON null, and the key is present", JSON.stringify(ragged[0]));
  check(ragged[0].a === "1" && ragged[0].b === "2", "the cells the short row does have are its own text", JSON.stringify(ragged[0]));
  check(Array.isArray(ragged[1]._surplus) && ragged[1]._surplus[0] === "4", "a long row's surplus value is kept in the _surplus array", JSON.stringify(ragged[1]));
  check(Object.keys(ragged[1]).length === 4, "a long row keeps every one of its values", JSON.stringify(Object.keys(ragged[1])));
  check(!("_surplus" in ragged[2]), "a row with no surplus does not grow an empty array", JSON.stringify(ragged[2]));
  const raggedLine = (await decided().textContent()) || "";
  check(raggedLine.includes("2 ragged rows: 1 short (1 cell padded as JSON null) and 1 long (1 surplus value in _surplus)."), "the ragged counts are reported on screen with the real figures", raggedLine.slice(-260));
  check(/1 row has fewer fields than the 3 keys, so 1 missing cell is JSON null/.test(raggedLine), "the short-row note names the key count and the padding", raggedLine);
  check(/1 row has more fields than the 3 keys, so 1 surplus value is kept in a _surplus array rather than dropped/.test(raggedLine), "the long-row note says the values were kept, not dropped", raggedLine);
  const shortRow = await page.locator("table tbody tr").nth(0).locator("td").allTextContents();
  check(shortRow[3] === EM_DASH, "a null cell previews as an em dash rather than a blank", shortRow.join("|"));

  // ======================================================= duplicate header keys ===
  section("duplicate header names");
  await openFixture("duplicates.csv");
  const dupKeys = await page.locator("table thead th").allTextContents();
  check(dupKeys.join("|") === "#|name|name (2)|name (3)", "duplicate header names are renamed deterministically", dupKeys.join("|"));
  const dupRow = (await parsedJson())[0];
  check(dupRow.name === "Alex" && dupRow["name (2)"] === "Priya" && dupRow["name (3)"] === "Sam", "each duplicate keeps its own row value instead of overwriting another", JSON.stringify(dupRow));
  check(new Set(Object.keys(dupRow)).size === 3, "no key silently overwrites another", Object.keys(dupRow).join("|"));
  // Two of the three "name" columns had to be renamed; the first kept its key.
  check(/2 duplicate header names were renamed so no key could silently overwrite another: Name \u2192 name \(2\) \(column 2\); Name \u2192 name \(3\) \(column 3\)\./.test((await decided().textContent()) || ""), "every rename is listed on screen with its column");

  // ========================================================= delimiter detection ===
  section("delimiter auto-detection");
  await delimiterSelect().selectOption("auto");
  await openFixture("semicolon.csv");
  let line = (await decided().textContent()) || "";
  check(line.includes(`Delimiter: a semicolon (confident, auto-detected) ${EM_DASH}`), "a semicolon file is detected as a semicolon", line.slice(-220));
  check(/Detected a semicolon: it appears \d+ times in every one of the first 2 records and no other candidate delimiter appears at all\./.test(line), "the semicolon detection says why");
  check((await page.locator("table thead th").allTextContents()).join("|") === "#|name|age", "the semicolon file splits into the right keys");

  await delimiterSelect().selectOption("auto");
  await openFixture("tab.csv");
  line = (await decided().textContent()) || "";
  check(line.includes(`Delimiter: a tab (confident, auto-detected) ${EM_DASH}`), "a tab file is detected as a tab, not as a backslash-t", line.slice(-220));
  check((await page.locator("table thead th").allTextContents()).join("|") === "#|name|age", "the tab file splits into the right keys");
  check((await delimiterSelect().locator("option").nth(3).textContent()) === "Tab (U+0009)", "the tab option is offered as a real U+0009", await delimiterSelect().locator("option").nth(3).textContent());

  await delimiterSelect().selectOption("auto");
  await openFixture("pipe.csv");
  line = (await decided().textContent()) || "";
  check(line.includes(`Delimiter: a pipe (confident, auto-detected) ${EM_DASH}`), "a pipe file is detected as a pipe", line.slice(-220));
  check((await page.locator("table thead th").allTextContents()).join("|") === "#|name|age", "the pipe file splits into the right keys");

  await delimiterSelect().selectOption("auto");
  await openFixture("mixed.csv");
  line = (await decided().textContent()) || "";
  check(line.includes(`Delimiter: a comma (not confident, auto-detected) ${EM_DASH}`), "two competing delimiters are reported as low confidence", line.slice(-220));
  check(/Not confident/.test(line), "low confidence says so in words");
  check(/pick the delimiter yourself/.test(line), "and tells the reader to choose the delimiter");

  await delimiterSelect().selectOption("auto");
  await openFixture("single-column.csv");
  line = (await decided().textContent()) || "";
  check(/Delimiter: a comma \(no delimiter needed\)/.test(line), "a single-column file is not given a delimiter guess", line.slice(-220));
  check(/single-column file/.test(line), "and the page explains that the delimiter does not change the result");

  // The manual override has to be real, or the confidence report is decoration.
  await openFixture("semicolon.csv");
  await delimiterSelect().selectOption(",");
  await settle();
  line = (await decided().textContent()) || "";
  check(/Delimiter: a comma/.test(line), "a hand-picked delimiter is named on the line", line.slice(-220));
  check(!/, auto-detected\)/.test(line), "a hand-picked delimiter is never described as auto-detected", line.slice(-220));
  check(/Delimiter: a comma \(set by hand\)/.test(line), "a hand-picked delimiter says it was set by hand, not that none was needed", line.slice(-220));
  check(!/no delimiter needed/.test(line), "a hand-picked comma is never called an unnecessary delimiter", line.slice(-220));
  check((await statValue("Columns").textContent()) === "1", "a wrong delimiter collapses the file to one column, so the override really reaches the parser");
  await delimiterSelect().selectOption("auto");
  await settle();
  check((await statValue("Columns").textContent()) === "2", "going back to auto-detect restores the right column count");

  // ============================================================ the header toggle ===
  section("the header-row toggle");
  await openFixture("ragged.csv");
  await headerToggle().setChecked(false);
  await settle();
  const positional = await parsedJson();
// ragged.csv's widest record has four fields, so four positional keys are correct.
  check((await page.locator("table thead th").allTextContents()).join("|") === "#|column1|column2|column3|column4", "switching the header off produces positional keys", (await page.locator("table thead th").allTextContents()).join("|"));
  check(positional[0].column1 === "a" && positional[0].column2 === "b" && positional[0].column3 === "c", "the header row becomes the first data row, not the keys", JSON.stringify(positional[0]));
  check(positional.length === 4, "every record is data once the header row is not the keys");
  check(/The first row is treated as data, not as keys, so every key is generated: column1 through column4\./.test((await decided().textContent()) || ""), "the generated keys are disclosed on screen");
  check(/Keys are generated as column1, column2, … and the header row, if there is one, becomes the first data row\./.test((await tool().locator("p").filter({ hasText: /Keys are generated as column1/ }).first().textContent()) || ""), "the toggle's own hint explains what it does");
  check(positional[1].column3 === null && positional[1].column4 === null, "generated keys are padded with null on a short row too", JSON.stringify(positional[1]));
  check(positional[2].column4 === "4" && positional[2]._surplus === undefined, "the widest record fills every generated key, so nothing is surplus", JSON.stringify(positional[2]));
  check(positional[3].column4 === null, "a later short row is padded against the widest record", JSON.stringify(positional[3]));
  await headerToggle().setChecked(true);
  await settle();
  check((await page.locator("table thead th").allTextContents()).join("|") === "#|a|b|c", "switching the header back on restores the header keys");

  // ================================================================ the anomaly ===
  section("a quote in the middle of an unquoted field");
  await openFixture("anomaly.csv");
  const anomaly = (await anomalyPanel().textContent()) || "";
  check(anomaly.includes("Quoting anomalies (1)"), "the anomaly panel names how many were found", anomaly.slice(0, 120));
  check(/Quote inside an unquoted field/.test(anomaly), "the anomaly is named in words, not as a code");
  check(/at record 2, field 1, character 6\./.test(anomaly), "the anomaly carries its record, field and character position", anomaly.slice(0, 400));
  check(/RFC 4180 allows a double quote only as the opening and closing quote/.test(anomaly), "the anomaly explains itself against RFC 4180");
  check(/Nothing was thrown away/.test(anomaly), "the panel says the cell text was kept");
  check(/1 quoting anomaly was found and are listed below/.test((await decided().textContent()) || ""), "the anomaly is counted in the decisions list too");
  check((await parsedJson())[0].a === 'x"y', "the offending quote is kept as data rather than dropped", JSON.stringify((await parsedJson())[0]));

  // =================================================================== download ===
  section("download and re-parse");
  await openFixture("plain.csv");
  const onScreen = await shownJson();
  const file = await downloadJson("plain.json");
  check(file.name === "plain-to-json-2r-2c.json", "the download is named for its source, its rows and its columns", file.name);
  check(file.text === onScreen, "the downloaded file is the exact text on screen");
  let reparsed = null;
  let reparseOk = true;
  try {
    reparsed = JSON.parse(file.text);
  } catch {
    reparseOk = false;
  }
  check(reparseOk, "the downloaded file re-parses as JSON in the harness, not just in the tab");
  check(JSON.stringify(reparsed) === JSON.stringify(JSON.parse(onScreen)), "re-parsing the downloaded file gives back the same document");
  check(Array.isArray(reparsed) && reparsed.length === 2 && reparsed[0].age === "29", "the downloaded file holds the rows, as strings", JSON.stringify(reparsed));

  await indentSelect().selectOption("4");
  await settle();
  const wide = await shownJson();
  check(wide === JSON.stringify(JSON.parse(wide), null, 4), "4-space indentation re-indents the whole document");
  check(wide !== onScreen, "the indentation choice really changes the document");
  const wideFile = await downloadJson("wide.json");
  check(wideFile.text === wide, "the 4-space download matches what is on screen");
  check(JSON.stringify(JSON.parse(wideFile.text)) === JSON.stringify(reparsed), "and holds the same rows at the new indentation");
  await indentSelect().selectOption("2");
  await settle();

  // ================================================================== clipboard ===
  section("the clipboard");
  await copyJson().click();
  await settle(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `ERR:${e.name}`));
  check(clip === (await shownJson()), "Copy puts exactly the displayed document on the clipboard", clip.slice(0, 80));
  check((await copyJson().locator("[role='status']").textContent()) === "Copied to clipboard", "the copy button announces the result to a screen reader");
  check((await page.locator("button[aria-label*='CSV']").count()) === 0, "there is no copy control for the CSV itself: the input box is the CSV, and Copy is the JSON");

  // ============================================== degenerate but legal inputs ===
  section("degenerate inputs");
  await openFixture("header-only.csv");
  check((await shownJson()) === "[]", "a file with only a header row produces an empty array");
  check((await statValue("Rows converted").textContent()) === EM_DASH, "and no rows are claimed");
  check(/The header row is the only record in this input, so the JSON output is an empty array with 2 keys that no row uses\./.test((await decided().textContent()) || ""), "the header-only case is explained on screen");
  check((await statValue("Columns").textContent()) === "2", "the columns are still reported for a header-only file");

  await openFixture("latin1.csv");
  check(/U\+FFFD replacement character/.test((await toolText()) || ""), "a non-UTF-8 file's replacement characters are surfaced");
  check(/Windows-1252 and Latin-1 exports look like this/.test(await toolText()), "the page says what the replacement characters usually mean");
  check(/Re-save the file as UTF-8, or paste the text\./.test(await toolText()), "and what to do about it");
  check((await parsedJson())[0].note === "caf\uFFFD", "the replacement character is carried into the output rather than silently dropped", JSON.stringify((await parsedJson())[0]));

  // ===================================================================== clear ===
  section("Clear");
  await clearButton().click();
  await settle();
  check((await textarea().inputValue()) === "", "Clear empties the input box");
  check((await jsonPane().count()) === 0, "Clear drops the JSON pane");
  check((await page.locator("table").count()) === 0, "Clear drops the preview table");
  check(/no sample CSV is pre-filled/.test((await emptyState().first().textContent()) || ""), "Clear returns the page to the empty state");
  check((await statValue("Rows converted").count()) === 0, "Clear drops the stats");

  // =================================================================== refusals ===
  section("the refusals, each with its real numbers");
  await setCsv(`h\n${"a\n".repeat(MAX_ROWS)}`);
  let refusal = await readRefusal("Not converted.");
  check(refusal.includes(`This CSV holds more than ${n(MAX_ROWS)} records`), `the row refusal quotes the row cap it broke (${n(MAX_ROWS)})`, refusal);
  check(refusal.includes(`at least ${n(MAX_ROWS + 1)} were found`), `and the record count it actually found (${n(MAX_ROWS + 1)})`, refusal);
  check(refusal.includes("blank lines excluded"), "and states that blank lines are not counted against the cap", refusal);
  check(refusal.includes("Nothing was converted."), "and that nothing was converted", refusal);
  check((await jsonPane().count()) === 0, "a refused row count leaves no JSON behind");

  await setCsv(`${Array(MAX_COLUMNS + 1).fill("x").join(",")}\n`);
  refusal = await readRefusal("Not converted.");
  check(refusal.includes(`A record in this CSV holds more than ${n(MAX_COLUMNS)} fields`), `the column refusal quotes the column cap it broke (${n(MAX_COLUMNS)})`, refusal);
  check(refusal.includes(`at least ${n(MAX_COLUMNS + 1)} were found`), `and the field count it actually found (${n(MAX_COLUMNS + 1)})`, refusal);
  check(/usually unquoted JSON or TSV read with the wrong delimiter/.test(refusal), "and says what a file that wide usually is", refusal);

  await setCsv(`h\n${"x".repeat(MAX_FIELD_CHARS + 1)}\n`);
  refusal = await readRefusal("Not converted.");
  check(refusal.includes(`A single field is longer than ${n(MAX_FIELD_CHARS)} characters`), `the cell refusal quotes the cell cap it broke (${n(MAX_FIELD_CHARS)})`, refusal);
  check(refusal.includes(`at least ${n(MAX_FIELD_CHARS + 1)} characters`), `and the length it actually found (${n(MAX_FIELD_CHARS + 1)})`, refusal);
  check(/a base64 blob, or an exported log line/.test(refusal), "and says what a cell that big usually is", refusal);

  await setCsvInPage(MAX_INPUT_CHARS + 1);
  refusal = await readRefusal("Not converted.");
  check(refusal.includes(`This input is ${n(MAX_INPUT_CHARS + 1)} characters.`), `the pasted-text refusal quotes the real length (${n(MAX_INPUT_CHARS + 1)})`, refusal);
  check(refusal.includes(`The cap is ${MAX_INPUT_LABEL}`), `and the cap it broke (${MAX_INPUT_LABEL})`, refusal);
  check(refusal.includes("nothing was parsed"), "and that nothing was parsed", refusal);
  check((await textarea().getAttribute("aria-invalid")) === "true", "the over-cap input is marked invalid for a screen reader");
  const overHint = (await textarea().evaluate((el) => document.getElementById(el.getAttribute("aria-describedby")).textContent)) || "";
  check(overHint.includes(`${n(MAX_INPUT_CHARS + 1)} characters \u2014 over the ${MAX_INPUT_LABEL} cap`), "the input's own hint carries the over-cap reading with the real numbers", overHint.slice(0, 200));

  await setCsv("");
  await openFixture("oversize.csv");
  refusal = await readRefusal("was not read");
  check(refusal.includes(`That file is ${n(MAX_FILE_BYTES + 1)} bytes`), `the file refusal quotes the file's real size (${n(MAX_FILE_BYTES + 1)})`, refusal);
  check(refusal.includes(`The cap for an opened file is ${MAX_FILE_LABEL}`), `and the opened-file cap it broke (${MAX_FILE_LABEL})`, refusal);
  check(/Paste the text instead, or split the file\./.test(refusal), "and offers the way forward", refusal);
  check((await textarea().inputValue()) === "", "an oversize file is refused before its bytes are read into the page");
  check((await jsonPane().count()) === 0, "an oversize file leaves no JSON behind");

  // ==================================================================== honesty ===
  section("the honesty the copy promises");
  await delimiterSelect().selectOption("auto");
  await openFixture("plain.csv");
  const copy = await toolText();
  check(copy.length > 0, "the component's own text is what this sweep reads");
  check(copy.includes(SAYS_STRINGS), "the page says every value stays a string");
  check(copy.includes(SAYS_NO_GUESS), "the page says explicitly that it does not guess types");
  check(copy.includes(SAYS_NEVER_UPLOADED_BANNER), "the banner says the CSV is never uploaded", copy.slice(0, 600));
  check(copy.includes(SAYS_FOOTER), "the footer says no request is made with the CSV");
  check(copy.includes(SAYS_NOT_LOSSLESS), "the page says the conversion is not lossless");
  check(copy.includes(SAYS_ALL_STRING_VALUES), "the 'changed on purpose' list states that no type is inferred");
  check(copy.includes(SAYS_BOTH_PREVIEWS), "the page says both panels are previews and the buttons give the whole document");
  check(/Preserved:/.test(copy) && /Changed on purpose:/.test(copy), "the change list has both a preserved and a changed half");
  check(/Not done, though a spreadsheet does it:/.test(copy), "and a list of what a spreadsheet does and this does not");
  check(/no formula evaluation/.test(copy), "including that formulas are not evaluated");
  check(/no encoding sniffing/.test(copy), "and that there is no encoding sniffing");
  check(/Dialect: RFC 4180 with a configurable delimiter, plus three disclosed extensions/.test(copy), "the dialect and its three extensions are named");
  check(copy.includes(MAX_INPUT_LABEL) && copy.includes(MAX_FILE_LABEL), "the dialect paragraph quotes the text and file caps");
  check(copy.includes(`${n(MAX_ROWS)} rows`) && copy.includes(`${n(MAX_COLUMNS)} columns per row`) && copy.includes(MAX_FIELD_LABEL), "and the row, column and cell caps");
  check(/A quote in the middle of an unquoted field is reported as an anomaly rather than accepted/.test(copy), "the anomaly policy is stated in the dialect paragraph");
  const previewLabel = (await tablePanel().getAttribute("aria-label")) || "";
  check(previewLabel.startsWith("Data preview \u2014 first 2 of 2 rows"), "the data preview is labelled with how much of the data it shows", previewLabel);
  check(/The JSON output above holds every character of every row\./.test((await tablePanel().textContent()) || ""), "and says the JSON above is complete even though the table is bounded");

  const toolPage = await context.newPage();
  const toolResp = await toolPage.goto(`${BASE_URL}/tools/csv-json`, { waitUntil: "domcontentloaded" });
  const toolBody = toolResp && toolResp.ok() ? await toolPage.textContent("body") : "";
  check(!!toolResp && toolResp.status() === 200, "the tool page renders");
  check(/Every value stays a string/.test(toolBody), "the tool page leads with the all-strings decision");
  check(/RFC 4180/.test(toolBody), "the tool page names the dialect");
  check(/Check the delimiter and the header row/.test(toolBody), "the how-to steps render, including reading the delimiter confidence");
  check(/Is the conversion lossless\?/.test(toolBody), "the losslessness FAQ is on the page");
  check(/Why are all my numbers strings\?/.test(toolBody), "the all-strings FAQ is on the page");
  check(/Can it convert JSON back to CSV\?/.test(toolBody) && /This tool converts CSV to JSON only\./.test(toolBody), "the removed direction is disclosed rather than left implied");
  check(toolBody.includes("5,242,880 characters") && toolBody.includes("100,000 characters in a single cell"), "the tool page quotes the real caps");
  await toolPage.close();

  const guide = await context.newPage();
  const guideResp = await guide.goto(`${BASE_URL}/guides/how-to-convert-csv-to-json`, { waitUntil: "domcontentloaded" });
  const guideBody = guideResp && guideResp.ok() ? await guide.textContent("body") : "";
  check(!!guideResp && guideResp.status() === 200, "the guide renders");
  check(/No type is inferred\./.test(guideBody), "the guide explains the all-strings decision");
  check(/[Tt]here are three more extensions, all disclosed on the page/.test(guideBody), "the guide discloses the parser's extensions");
  check(/One case is refused rather than guessed/.test(guideBody), "the guide explains the quote-anomaly policy");
  check(/the second becomes amount \(2\), the third amount \(3\)/.test(guideBody), "the guide gives the de-duplication rule");
  check(/It also does not convert JSON back to CSV/.test(guideBody), "the guide discloses the removed direction");
  check(/renders every cell as escaped text/.test(guideBody), "the guide states that cells are rendered as escaped text");
  check(/No request is made with your data, and nothing is uploaded/.test(guideBody), "the guide states the privacy position");
  check(guideBody.includes("20,000 rows") && guideBody.includes("512 columns in a single row"), "the guide quotes the real row and column caps");
  await guide.close();

  const sitemapResponse = await page.request.get(`${BASE_URL}/sitemap.xml`);
  const sitemap = sitemapResponse.ok() ? await sitemapResponse.text() : "";
  check(sitemap.includes("/tools/csv-json"), "the sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-convert-csv-to-json"), "the sitemap lists the csv guide");

  // ==================================================================== 375px ====
  section("a 375px viewport");
  await openFixture("ragged.csv");
  await page.setViewportSize({ width: 375, height: 720 });
  await settle(300);
  const overflow = await page.evaluate(() => {
    const m = document.querySelector("main#main");
    return m ? m.scrollWidth - m.clientWidth : document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  check(overflow <= 1, "the tool fits a 375px viewport without horizontal overflow", String(overflow));
  check((await jsonPane().count()) === 1, "and the JSON pane is still there at that width");
  await page.setViewportSize({ width: 1280, height: 900 });
  await settle();

  // =================================================================== hygiene ===
  section("hygiene");
  check(offOrigin.length === 0, "no off-origin request: the CSV never leaves the device", offOrigin.slice(0, 3).join(" "));
  check(nonGet.length === 0, "the tool made no non-GET request", nonGet.slice(0, 3).join(" "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 2).join(" | "));
  check(consoleIssues.length === 0, "no hydration or server/client mismatch warnings", consoleIssues.slice(0, 2).join(" | "));
  check(!allUrls.some((u) => u.includes(MARKER)), "no request URL carries any of the CSV data", allUrls.filter((u) => u.includes(MARKER)).slice(0, 2).join(" "));
  check(!allUrls.some((u) => u.length > 2000), "no request URL is long enough to be carrying a document", allUrls.filter((u) => u.length > 2000).slice(0, 2).join(" "));
} catch (e) {
  check(false, `harness exception: ${String(e).slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) console.log(`failing: ${failures.join(" | ")}`);
process.exit(failed === 0 ? 0 : 1);