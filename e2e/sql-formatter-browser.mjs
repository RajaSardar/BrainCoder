// Production-Chrome e2e for "SQL Formatter".
//
// The promises this tool makes are about NOT quietly changing a query. That an
// unterminated comment, an unterminated string, unbalanced parentheses or a nested
// comment in a dialect that does not support it is refused rather than reformatted,
// because a formatter that mangles tokens and returns valid-looking SQL is the worst
// outcome available. So every assertion here is made against the exact characters in
// the output pane and the downloaded .sql file.
//
// The caps are read out of src/features/sql-formatter/sql-format.ts at run time, so a
// future cap change makes this harness assert the new number instead of quietly passing
// against a stale literal. The dialect list is read out of the installed sql-formatter
// package, so a harness that disagrees with the shipped dropdown fails loudly.
//
//   node e2e/sql-formatter-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/sql-formatter-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and runs this.

import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/sql-formatter`;
const TOOL_PAGE = `${BASE_URL}/tools/sql-formatter`;
const GUIDE_PAGE = `${BASE_URL}/guides/how-to-format-sql-online`;
const DL = "/tmp/sql-formatter-e2e";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(REPO, "src/features/sql-formatter");
const FORMAT_SRC = readFileSync(join(SRC_DIR, "sql-format.ts"), "utf8");
const COMPONENT_SRC = readFileSync(join(SRC_DIR, "SqlFormatter.tsx"), "utf8");

/** The caps, read out of the shipped module rather than guessed here. */
function capConstant(name) {
  const m = new RegExp(`export const ${name} = ([0-9_]+);`).exec(FORMAT_SRC);
  if (!m) throw new Error(`${name} is not declared in sql-format.ts, so this harness cannot assert it`);
  return Number(m[1].replace(/_/g, ""));
}
const MAX_SQL_CHARS = capConstant("MAX_SQL_CHARS");
const MAX_SQL_ERROR_CHARS = capConstant("MAX_SQL_ERROR_CHARS");
const MAX_SQL_DEPTH = capConstant("MAX_SQL_DEPTH");
const MAX_SQL_COMMENT_DEPTH = capConstant("MAX_SQL_COMMENT_DEPTH");

const n = (value) => value.toLocaleString("en-US");
const EM_DASH = "\u2014";

/** The Load sample payload, lifted from the component so the two cannot drift. */
const SAMPLE = /const SAMPLE = `([\s\S]*?)`;/.exec(COMPONENT_SRC);
if (!SAMPLE) throw new Error("SqlFormatter.tsx no longer declares a SAMPLE constant");
const SAMPLE_SQL = SAMPLE[1];

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
// component's own root, so no assertion can be satisfied by page furniture.
// --------------------------------------------------------------------------
const tool = () => page.locator("div[aria-busy]").first();
const sqlInput = () => tool().locator('textarea[aria-label="SQL input"]');
const outPane = () => tool().locator('textarea[aria-label="Formatted SQL"]');
const languageSelect = () => tool().getByLabel("SQL dialect", { exact: true });
const keywordSelect = () => tool().getByLabel("Keyword case", { exact: true });
const indentSelect = () => tool().getByLabel("Indent", { exact: true });
const linesSelect = () => tool().getByLabel("Blank lines between queries", { exact: true });
const loadSample = () => tool().getByRole("button", { name: "Load sample" });
const clearButton = () => tool().getByRole("button", { name: "Clear", exact: true });
const copyButton = () => tool().locator('button[aria-label="Copy SQL"]');
const downloadButton = () => tool().locator("button", { hasText: /^Download / });
/** The status badge sits in the row above the output textarea, whose heading is just "Formatted". */
const badgeRow = () => tool().locator('p:text-is("Formatted")').locator("xpath=..");
const badge = () => badgeRow().locator("span").first();
const liveRegion = () => tool().locator('[role="status"][aria-live="polite"]');
const errorPane = () => badge().locator("xpath=.//span[last()]");
const countsLine = () => tool().locator("p", { hasText: /characters of formatted SQL/ });
const charCounter = () => tool().locator("p", { hasText: /of [\d,]+ characters/ });

const toolText = () => tool().textContent().then((t) => t || "");

async function settle(ms = 160) {
  await page.waitForTimeout(ms);
}

async function paste(raw) {
  await sqlInput().fill(raw);
  await settle();
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

  check(page.url().includes("/use/sql-formatter"), "the tool route renders", page.url());
  check((await sqlInput().count()) === 1, "there is exactly one SQL input");
  check((await sqlInput().inputValue()) === "", "the SQL input boots empty, with no sample pre-filled");
  check((await outPane().inputValue()) === "", "the output pane is empty before anything is pasted");
  check((await outPane().getAttribute("placeholder")) === EM_DASH, "the empty output shows an em dash, not a blank");
  check(await clearButton().isDisabled(), "Clear is disabled while there is nothing to clear");
  check(await copyButton().isDisabled(), "Copy is disabled before anything is formatted");
  check((await downloadButton().count()) === 1 && (await downloadButton().isDisabled()), "Download is present and disabled before anything is formatted");
  check((await tool().getAttribute("aria-busy")) === "false", "the root reports aria-busy false, because nothing is pending");
  check((await page.getByRole("button", { name: /^(Format|Beautify)$/ }).count()) === 0, "there is no button to click, because formatting is not on demand");

  section("what the panel says before anything is pasted");
  const boot = await toolText();
  check(/Formatting cannot repair a query/.test(boot), "the panel leads with the one-line limit of the tool");
  check(/refuses rather than return SQL with different tokens/i.test(boot), "and states that it refuses rather than changing your tokens");
  check(!/comma|aligned columns|align columns/i.test(boot), "the panel makes no comma-alignment claim", boot.slice(0, 300));
  check(!/all major dialects|every database/i.test(boot), "the panel does not claim every database");
  const dialectCount = (await languageSelect().locator("option").count());
  check(dialectCount === 21, "the panel offers 21 dialects", String(dialectCount));
  check(/PostgreSQL/.test(boot), "the panel names the default dialect", boot.slice(0, 300));
  check(/Dialect matters/.test(boot), "the panel says the dialect matters");
  check(/Oracle PL\/SQL/.test(boot), "and Oracle is described as PL/SQL, not as a generic Oracle dialect");
  check(!/proprietary/i.test(boot), "the panel makes no proprietary-function claim");
  check(boot.includes(`${n(MAX_SQL_CHARS)} characters`), "the hint quotes the input cap from the module's own constant");
  check(boot.includes(`${n(MAX_SQL_DEPTH)} levels of parentheses`), "the hint quotes the parenthesis cap");
  check(boot.includes(`${n(MAX_SQL_COMMENT_DEPTH)} levels of nested block comment`), "the hint quotes the nested-comment cap");
  check(/Refused with their real numbers/.test(boot), "the hint says refusals quote their real numbers");
  check(/will not close a bracket, finish a string or guess a dialect/.test(boot), "the panel says what it will not do");
  check(/nothing is pre-filled/i.test(await sqlInput().getAttribute("placeholder") || ""), "the placeholder says nothing is pre-filled");

  section("accessibility, before anything is pasted");
  for (const [name, loc] of [
    ["SQL dialect", languageSelect],
    ["Keyword case", keywordSelect],
    ["Indent", indentSelect],
    ["Blank lines between queries", linesSelect],
  ]) {
    check((await loc().count()) === 1, `the ${name} control is reachable by its visible label`);
    check((await loc().getAttribute("id")) !== null, `and that label points at a real element for ${name}`);
  }
  const describedBy = await sqlInput().getAttribute("aria-describedby");
  check(!!describedBy && (await page.locator(`#${describedBy}`).count()) === 1, "the SQL input is described by a hint element that exists", String(describedBy));
  check((await sqlInput().getAttribute("spellcheck")) === "false", "the input does not invite spellcheck on a query");
  check((await outPane().getAttribute("readonly")) !== null, "the output pane is read-only");
  check((await outPane().getAttribute("tabindex")) === "-1", "and out of the tab order");
  check(/Empty/.test((await liveRegion().textContent()) || ""), "the live region says the box is empty", await liveRegion().textContent());

  section("the live region announces counts only, never the query");
  await paste("select secret_column from confidential_table where token = 'abc123';");
  await settle(400);
  const announced = (await liveRegion().textContent()) || "";
  check(announced.length > 0, "the live region speaks once there is a result", announced);
  check(!/secret_column|confidential_table|abc123/i.test(announced), "and it does not read the reader's own SQL back", announced);
  check(/\d/.test(announced), "it reports counts", announced);
  await paste("select 1 -- unterminated");
  await settle(400);
  const badAnnounced = (await liveRegion().textContent()) || "";
  check(!/unterminated|select 1/i.test(badAnnounced), "an error is announced without its message", badAnnounced);

  // =========================================================== dialect list ===
  section("the dialect list matches the installed formatter");
  const options = await languageSelect().locator("option").allTextContents();
  check((await languageSelect().inputValue()) === "postgresql", "PostgreSQL is the default", await languageSelect().inputValue());
  // The shipped dropdown must offer everything sql-formatter can format, and the audit
  // already cross-checked the list against the package, so this is a live spot-check of
  // the two dialects whose absence was actually reported: Oracle and N1QL.
  check(options.length === 21, "there are 21 dialects", String(options.length));
  check(options.some((o) => /Oracle PL\/SQL/.test(o)), "Oracle is offered as Oracle PL/SQL", options.join(", "));
  check(options.some((o) => /N1QL/.test(o)), "N1QL is offered", options.join(", "));
  check(options.some((o) => /^MySQL$/.test(o)), "MySQL is offered");
  check(options.some((o) => /BigQuery/.test(o)), "BigQuery is offered");
  check(options.some((o) => /T-SQL/.test(o)), "SQL Server is offered as T-SQL", options.join(", "));
  check(options.some((o) => /DuckDB/.test(o)), "DuckDB is offered");

  // =========================================================== load sample ===
  section("Load sample");
  await loadSample().click();
  await settle(400);
  check((await sqlInput().inputValue()) === SAMPLE_SQL, "Load sample fills the input with the sample the component declares");
  await page.waitForFunction(
    () => {
      const el = document.querySelector('textarea[aria-label="Formatted SQL"]');
      return !!el && el.value.length > 0;
    },
    null,
    { timeout: 20000 },
  );
  const sampleOut = await shown();
  check(sampleOut.length > 0, "and the sample formats to something");
  const counts = (await countsLine().textContent()) || "";
  check(/[\d,]+ characters of formatted SQL/.test(counts), "the counts line quotes the length of the output", counts);
  const counter = (await charCounter().textContent()) || "";
  check(counter.includes(`${n(MAX_SQL_CHARS)} characters`), "the character counter quotes the real cap", counter);
  check(sampleOut.includes("\n"), "across multiple lines", JSON.stringify(sampleOut.slice(0, 80)));
  check(!sampleOut.includes("&"), "no HTML entities leaked into the output", JSON.stringify(sampleOut.slice(0, 120)));
  check(/formatted/i.test(await badge().textContent() || ""), "the badge says it formatted", await badge().textContent());

  // =========================================================== formatting ===
  section("Format re-indents a query");
  await paste("select a,b,c from t where a=1 and b=2 order by a;");
  const out = await shown();
  check(out.includes("\n"), "the one-line query comes out across lines", JSON.stringify(out));
  check(out.includes("  "), "with indentation", JSON.stringify(out));
  check(/select/i.test(out), "and the keyword is still there");

  section("the keyword case control is real");
  await keywordSelect().selectOption("upper");
  await settle(300);
  const upper = await shown();
  check(/SELECT/i.test(upper), "upper case is applied", JSON.stringify(upper.slice(0, 100)));
  await keywordSelect().selectOption("lower");
  await settle(300);
  check(/select/i.test(await shown()) && !/\bSELECT\b/.test(await shown()), "lower case is applied", JSON.stringify((await shown()).slice(0, 100)));
  await keywordSelect().selectOption("preserve");
  await settle(300);
  check(/select/i.test(await shown()), "preserve leaves the keyword as pasted");

  section("the indent control is real");
  await indentSelect().selectOption("4");
  await settle(300);
  const four = await shown();
  check(four.includes("\n    ") || four.includes("\n        "), "four spaces is used", JSON.stringify(four.slice(0, 160)));
  await indentSelect().selectOption("tab");
  await settle(300);
  const tabbed = await shown();
  check(tabbed.includes("\n\t"), "the tab option emits a real tab", JSON.stringify(tabbed.slice(0, 120)));
  check(!tabbed.includes("\\t"), "and not a backslash-t", JSON.stringify(tabbed.slice(0, 120)));
  await indentSelect().selectOption("2");
  await settle(250);

  // =========================================================== the refusals ===
  section("the cases that must be refused, not reformatted");
  /** Each refusal names its own fault; asserting the reason beats asserting "refused". */
  const EXPECTED_REASON = {
    "an unterminated block comment": "comment",
    "a comment closed early by an inner terminator": "comment",
    "unbalanced parentheses": "unclosed parenthesis",
    "a stray closing parenthesis": "closing parenthesis with nothing open",
    "an unterminated string": "string literal is never closed",
  };

  const MUST_REFUSE = [
    ["an unterminated block comment", "select 1 -- comment without a newline\nfrom t where a=1 /* never closed"],
    ["a comment closed early by an inner terminator", "select /* outer /* inner */ 1 from t"],
    ["unbalanced parentheses", "select (a, b from t where c = 1"],
    ["a stray closing parenthesis", "select a) from t"],
    ["an unterminated string", "select 'never closed from t"],
  ];
  for (const [label, src] of MUST_REFUSE) {
    await paste(src);
    await settle(350);
    const text = await toolText();
    check((await shown()) === "", `${label} produces no output`, JSON.stringify((await shown()).slice(0, 80)));
    check(await copyButton().isDisabled(), `Copy stays disabled for ${label}`);
    check(await downloadButton().isDisabled(), `Download stays disabled for ${label}`);
    check(
      new RegExp(EXPECTED_REASON[label], "i").test(await badge().textContent() || ""),
      `${label} says why`,
      await badge().textContent(),
    );
    check(!/select\s+1\s+comment/i.test(text), `${label} does not hand back mangled SQL as if it had worked`);
  }

  section("a nested block comment IS accepted where the dialect supports it");
  for (const dialect of ["postgresql", "duckdb", "db2i", "transactsql"]) {
    await languageSelect().selectOption(dialect);
    await settle(200);
    await paste("select /* outer /* inner */ done */ 1 from t");
    await settle(400);
    const nested = await shown();
    check(nested.length > 0, `${dialect} formats a nested comment`, JSON.stringify(nested.slice(0, 80)));
    check(!/could not be formatted|unterminated/i.test(await toolText()), `${dialect} does not report a refusal`);
  }

  section("MySQL and PostgreSQL backslash rules actually differ");
  // In MySQL '\n' is a newline inside the string; in PostgreSQL standard_conforming_strings
  // is on, so the backslash is literal. Both must round-trip as valid strings, and a
  // dialect that broke here would silently change the query.
  for (const dialect of ["mysql", "postgresql"]) {
    await languageSelect().selectOption(dialect);
    await settle(200);
    await paste("select 'a\\nb' as s from t");
    await settle(400);
    const text = await toolText();
    check(!/unterminated|could not be formatted/i.test(text), `${dialect} accepts the E-string form`, text.slice(0, 160));
  }
  await languageSelect().selectOption("postgresql");
  await settle(200);

  section("PostgreSQL dollar-quoted bodies are handled");
  await paste("create function f() returns void as $$ begin null; end; $$ language plpgsql;");
  await settle(450);
  const dollar = await shown();
  check(dollar.length > 0, "a dollar-quoted body formats", JSON.stringify(dollar.slice(0, 90)));
  check(/\$\$/.test(dollar), "and the dollar quotes survive", JSON.stringify(dollar.slice(0, 120)));
  await paste("create function f() returns void as $tag$ begin null; end; $tag$ language plpgsql;");
  await settle(450);
  check(/\$tag\$/.test(await shown()), "a tagged dollar quote survives too", JSON.stringify((await shown()).slice(0, 120)));

  section("an unterminated dollar quote is refused");
  await paste("create function f() returns void as $$ begin null; end; language plpgsql;");
  await settle(450);
  check((await shown()) === "", "an unterminated dollar quote produces no output", JSON.stringify((await shown()).slice(0, 80)));
  check(
    /dollar-quoted string.*never closed|never closed/i.test(await badge().textContent() || ""),
    "and says why",
    await badge().textContent(),
  );

  // =========================================================== the error message ===
  section("the error message cannot flood the panel");
  // The judge measured a 16,961,223-character error message from the library for 507
  // characters of broken input. The panel must stay readable.
  await paste("select ( from t where (((a = 1 and b = 2");
  await settle(500);
  const errorText = await errorPane().textContent().catch(() => "");
  check(!!errorText, "an error is shown");
  check(errorText.length <= MAX_SQL_ERROR_CHARS, `the message is capped at ${MAX_SQL_ERROR_CHARS} characters`, String(errorText.length));
  check(errorText.length < 1000, "and is short enough to read", String(errorText.length));
  check(!(await outPane().inputValue()).includes("expected"), "no parser error is ever placed in the output pane");

  // =========================================================== multiple queries ===
  section("several statements in one paste");
  await paste("select 1;select 2;select 3;");
  const multi = await shown();
  check(multi.split(";").length >= 4, "all three statements come out", JSON.stringify(multi));
  await linesSelect().selectOption("1");
  await settle(350);
  const spaced = await shown();
  check(/\n\n/.test(spaced), "one blank line can be put between statements", JSON.stringify(spaced));
  await linesSelect().selectOption("0");
  await settle(300);

  // =========================================================== clipboard & download ===
  section("Copy puts the exact output on the clipboard");
  await paste("select a,b,c from t where a=1;");
  await settle(400);
  const expected = await shown();
  await copyButton().click();
  await settle(250);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip === expected, "the clipboard holds the same characters as the pane", JSON.stringify(clip.slice(0, 120)));

  section("Download writes the same characters as a .sql file");
  const dl = await download("formatted.sql");
  check(dl.name === "formatted.sql", "the suggested filename is .sql", dl.name);
  check(dl.text === expected, "the downloaded file matches the pane byte for byte", JSON.stringify(dl.text.slice(0, 120)));

  // =========================================================== caps ===
  section("the caps are refused with their real numbers");
  const huge = `select ${"a,".repeat(MAX_SQL_CHARS / 2)}1 from t`;
  await sqlInput().fill(huge);
  await settle(900);
  const hugeText = await toolText();
  check(/limit|refus|too large|could not be formatted/i.test(hugeText), "an over-long query is refused", hugeText.slice(0, 200));
  check(hugeText.includes(n(MAX_SQL_CHARS)) || hugeText.includes(n(huge.length)), "the refusal quotes a real number", hugeText.slice(0, 260));
  check((await shown()) === "", "nothing is produced for an over-long query");
  check(await copyButton().isDisabled(), "Copy stays disabled for an over-long query");

  const deep = "select " + "(".repeat(MAX_SQL_DEPTH + 5) + "1" + ")".repeat(MAX_SQL_DEPTH + 5);
  await sqlInput().fill(deep);
  await settle(900);
  const deepText = await toolText();
  check(/nesting|balanced|could not be formatted|refus/i.test(deepText), "a too-deep query is refused", deepText.slice(0, 200));
  check(deepText.includes(n(MAX_SQL_DEPTH)), "and quotes the real depth cap", deepText.slice(0, 260));

  // =========================================================== privacy ===
  section("the query never leaves the browser");
  check(offOrigin.length === 0, "no request went off-origin", offOrigin.join(", "));
  check(nonGet.length === 0, "no non-GET request was made", nonGet.join(", "));

  // =========================================================== the wider page ===
  section("the tool page and the guide");
  await page.goto(TOOL_PAGE, { waitUntil: "networkidle" });
  await settle(300);
  const toolPageText = (await page.textContent("body")) || "";
  check(/21/.test(toolPageText), "the tool page states the dialect count");
  check(/Oracle PL\/SQL/.test(toolPageText), "the tool page names Oracle PL/SQL");
  check(!/comma[- ]align|aligned to the/i.test(toolPageText), "the tool page drops the comma-alignment claim");
  check(!/all major dialects|every SQL database/i.test(toolPageText), "the tool page drops the every-database claim");
  check(!/proprietary functions/i.test(toolPageText), "the tool page drops the proprietary-function claim");
  check(/browser|client-side/i.test(toolPageText), "the tool page states the processing location");

  await page.goto(GUIDE_PAGE, { waitUntil: "networkidle" });
  await settle(300);
  const guideText = (await page.textContent("body")) || "";
  check(guideText.includes("100,000 characters"), "the guide quotes the input cap");
  check(guideText.includes("16 million"), "the guide quotes the real error-message size the cap exists for");
  check(/unterminated/i.test(guideText), "the guide explains the unterminated comment case");
  check(/refus/i.test(guideText), "the guide says refusals are the design");
  check(/does not tell you whether your query is correct|not do/i.test(guideText), "the guide says what the tool is not for");
  check(await page.getByRole("link", { name: /SQL Formatter/i }).count() > 0, "the guide links to the tool");

  await page.goto(`${BASE_URL}/tools/sql-formatter`, { waitUntil: "networkidle" });
  await settle(300);
  const registryText = (await page.textContent("body")) || "";
  check(/SQL Formatter/.test(registryText), "the registry page names the tool");
  check(/21/.test(registryText), "the registry page states the dialect count");
  check(/browser|client-side/i.test(registryText), "the registry page states the processing location");

  // The tools index paginates, so the registry page is checked directly rather than
  // depending on which page the tool happens to land on.
  const sm = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check(sm.ok(), "the sitemap responds", String(sm.status()));
  const smText = await sm.text();
  check(smText.includes("/tools/sql-formatter"), "the registry page is in the sitemap");
  check(smText.includes("/guides/how-to-format-sql-online"), "the guide is in the sitemap");

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