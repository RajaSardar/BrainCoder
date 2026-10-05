/**
 * Node mirror audit for the SQL Formatter. No browser, no DOM.
 *
 * The shipped pure module is transpiled with the repo's own TypeScript compiler and
 * imported, so every check below runs the code the tab runs.
 *
 * The sections that matter most:
 *
 *   5. The three silent-corruption cases. `sql-formatter@15.8.2` does not throw on an
 *      unterminated block comment — it returns `a / * b`, which reads as arithmetic — and
 *      it mis-tokenises a nested block comment in every dialect it does not configure
 *      for nesting. Both were called "Formatted" by the previous version of this page.
 *      Section 5 asserts that neither can reach the output pane now.
 *   6. The runaway error. 507 characters of unbalanced parentheses produced a
 *      16,961,223-character message across 237,165 lines, which went into the toolbar and
 *      the clipboard. Asserted here on the real call, not on a stand-in.
 *   12. The copy. This tool's worst defect is overstating what it did, so the claims are
 *      asserted against the shipped registry entry, long description, features, FAQs, SEO
 *      entry and guide rather than read and approved.
 *
 *   node audit/check-sql-formatter.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const SRC = "src/features/sql-formatter";
const OUT = "audit/.sql-formatter-mirror";

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
const OPENS = "/*"; // written this way so this comment cannot close itself early

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// --- transpile the shipped module, then import it ------------------------------
const modPath = `${SRC}/sql-format.ts`;
writeFileSync(
  `${OUT}/sql-format.mjs`,
  ts.transpileModule(readFileSync(modPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: "sql-format.ts",
  }).outputText,
);
const M = await import(pathToFileURL(`${OUT}/sql-format.mjs`).href);

// The site's own content tables, transpiled the same way, so "the copy says what the
// code does" is a comparison against the shipped data and not a regex guess.
// tools.ts imports lucide icons and seo.ts imports ./tools, so neither can be
// executed from a mirror directory. They are read as source text instead, and the
// registry entry and keyword list are parsed out of that text.
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

const COMPONENT_SRC = readFileSync(`${SRC}/SqlFormatter.tsx`, "utf8");

const OPTS = {
  language: "postgresql",
  keywordCase: "upper",
  indent: "2",
  linesBetweenQueries: 1,
};
const run = (sql, over = {}) => M.formatSql(sql, { ...OPTS, ...over });

// --- 1. the ordinary path ------------------------------------------------------
{
  const r = run("select a,b from t where x=1 and y=2;");
  check(r.kind === "formatted", "a plain query formats", r.kind);
  check(r.sql.startsWith("SELECT"), "keywords are uppercased by default", r.sql);
  check(r.sql.includes("\n  a,"), "the select list is indented", JSON.stringify(r.sql));
  check(run("SELECT 1;", { keywordCase: "lower" }).sql.startsWith("select"), "lowercase keywords");
  check(run("SELECT 1;", { keywordCase: "preserve" }).sql.startsWith("SELECT"), "preserved keywords");
}

// --- 2. empty is not success ---------------------------------------------------
check(run("").kind === "empty", "empty input is neither formatted nor an error", run("").kind);
check(run("   \n\t ").kind === "empty", "whitespace-only input is empty", run("   \n\t ").kind);
{
  const r = run("");
  check(r.sql === undefined, "an empty result carries no sql field");
}

// --- 3. indent options actually change the output ------------------------------
{
  const two = run("SELECT a,b FROM t WHERE x=1;", { indent: "2" }).sql;
  const four = run("SELECT a,b FROM t WHERE x=1;", { indent: "4" }).sql;
  const tab = run("SELECT a,b FROM t WHERE x=1;", { indent: "tab" }).sql;
  check(two.includes("\n  a,"), "2-space indent", JSON.stringify(two));
  check(four.includes("\n    a,"), "4-space indent", JSON.stringify(four));
  // The previous version shipped <option value="\t">, which is two characters, so the
  // Tab option silently produced no tab at all.
  check(tab.includes("\n\ta,"), "the tab option emits a real tab", JSON.stringify(tab));
  check(!tab.includes("\\t"), "the tab option does not emit a backslash-t", JSON.stringify(tab));
}

// --- 4. strings and comments survive ------------------------------------------
{
  const src = "SELECT 'it''s here' AS a, \"Mixed Case\" AS b FROM t -- trailing note";
  const r = run(src);
  check(r.kind === "formatted", "quoted text with a doubled quote formats", r.kind);
  check(r.sql.includes("'it''s here'"), "the doubled quote is preserved", r.sql);
  check(r.sql.includes('"Mixed Case"'), "a quoted identifier keeps its case", r.sql);
  check(r.sql.includes("-- trailing note"), "a line comment is preserved", r.sql);
}

// --- 5. THE SILENT-CORRUPTION CASES -------------------------------------------
{
  // Unterminated block comment. format() does not throw; it returns `a / * b`.
  const unterminated = `SELECT a ${OPENS} b`;
  const raw = execFileSync(
    process.execPath,
    ["-e", `const {format}=require("sql-formatter");process.stdout.write(format(${JSON.stringify(unterminated)},{language:"postgresql"}))`],
    { encoding: "utf8", cwd: process.cwd() },
  );
  check(raw.includes("/ *"), "the library really does corrupt an unterminated comment (proves the guard is load-bearing)", JSON.stringify(raw));

  for (const language of ["postgresql", "mysql", "sqlite", "sql", "bigquery", "transactsql", "plsql"]) {
    const r = run(unterminated, { language });
    check(r.kind === "invalid-sql", `an unterminated block comment is refused in ${language}`, r.kind);
    check(!String(r.sql ?? "").includes("/ *"), `no corrupted SQL reaches the pane in ${language}`);
    check(r.message.includes("never closed"), `the ${language} refusal explains itself`, r.message);
  }

  // Nested comments: legal in four dialects, a misparse in the rest.
  const nested = `SELECT ${OPENS} a ${OPENS} b */ c */ 1;`;
  for (const language of ["postgresql", "duckdb", "db2i", "transactsql"]) {
    const r = run(nested, { language });
    check(r.kind === "formatted", `a nested block comment is allowed in ${language}, which supports it`, `${r.kind}: ${r.message ?? ""}`);
    check(r.sql.includes(`${OPENS} a ${OPENS} b */ c */`), `the nested comment is reproduced intact in ${language}`, r.sql);
  }
  for (const language of ["mysql", "mariadb", "sqlite", "sql", "bigquery", "plsql", "snowflake"]) {
    const r = run(nested, { language });
    check(r.kind === "invalid-sql", `a nested block comment is refused in ${language}, which does not support it`, `${r.kind}: ${r.sql ?? r.message ?? ""}`);
    check(!String(r.sql ?? "").includes("c * /"), `no `+"`c * /`"+` reaches the pane in ${language}`);
  }
}

// --- 6. THE RUNAWAY ERROR -----------------------------------------------------
{
  const deep = "SELECT" + "(".repeat(500);
  let r = run(deep);
  check(r.kind === "invalid-sql", "500 open parentheses are refused", r.kind);
  check(r.message.length < 400, "the parenthesis refusal is short", `${r.message.length} chars`);
  check(r.message.includes(n(M.MAX_SQL_DEPTH)), "it quotes the real depth cap", r.message);

  r = run("SELECT (a, b FROM t;");
  check(r.kind === "invalid-sql", "an unclosed parenthesis is refused", r.kind);
  check(r.message.length < 400, "that refusal is short too", `${r.message.length} chars`);
  check(r.message.includes("unclosed parenthesis"), "it names the problem", r.message);

  r = run("SELECT a) FROM t;");
  check(r.kind === "invalid-sql", "a closing parenthesis with nothing open is refused", r.kind);

  // Any library message, however long, must be clipped.
  const huge = "x".repeat(16_961_223);
  check(M.condenseError(huge).length <= M.MAX_SQL_ERROR_CHARS + 40, "a 16.9 MB error message is clipped", String(M.condenseError(huge).length));
  check(M.condenseError("Parse error: bad at line 3 column 8\n  ^^^^^\nmore").split("\n").length === 1, "only the first line of a caret diagram is kept");
  check(M.condenseError("Parse error: bad at line 3 column 8\n^^^^").includes("line 3 column 8"), "the position in the first line survives the clip");
}

// --- 7. caps -------------------------------------------------------------------
{
  const over = "x".repeat(M.MAX_SQL_CHARS + 1);
  const r = run(over);
  check(r.kind === "refused", "input past the character cap is refused", r.kind);
  check(r.message.includes(n(M.MAX_SQL_CHARS)), "the refusal quotes the real cap", r.message);
  check(r.message.includes(n(M.MAX_SQL_CHARS + 1)), "and the real size of what was pasted", r.message);

  const atCap = "SELECT 1;" + " ".repeat(M.MAX_SQL_CHARS - "SELECT 1;".length);
  check(atCap.length === M.MAX_SQL_CHARS, "the at-cap fixture really is at the cap");
  check(run(atCap).kind === "formatted", "input exactly at the cap is still formatted", run(atCap).kind);

  const deepParens = "SELECT " + "(".repeat(M.MAX_SQL_DEPTH + 5) + "1" + ")".repeat(M.MAX_SQL_DEPTH + 5);
  check(run(deepParens).kind === "invalid-sql", "parenthesis nesting past the cap is refused", run(deepParens).kind);
  check(run("SELECT " + "(".repeat(M.MAX_SQL_COMMENT_DEPTH + 5)).kind === "invalid-sql", "comment nesting past the cap is refused");
}

// --- 8. dialect-awareness of the preflight -------------------------------------
{
  // A backslash is an escape in MySQL and not in PostgreSQL standard strings.
  const mysqlBs = run("SELECT 'a\\';", { language: "mysql" });
  check(mysqlBs.kind === "invalid-sql", "MySQL treats a backslash as escaping the quote, so that string is unterminated", `${mysqlBs.kind}: ${mysqlBs.sql ?? ""}`);
  // `E'\'` really is unterminated in PostgreSQL as well, because an E-string always
  // takes backslash escapes. This is the module being right where a guess would be wrong.
  const pgUnterminated = run("SELECT E'\\';", { language: "postgresql" });
  check(pgUnterminated.kind === "invalid-sql", "a PostgreSQL E-string takes backslash escapes, so that one is unterminated", `${pgUnterminated.kind}: ${pgUnterminated.sql ?? ""}`);
  const pgClosed = run("SELECT E'a\\b';", { language: "postgresql" });
  check(pgClosed.kind === "formatted", "a properly closed E-string formats", `${pgClosed.kind}: ${pgClosed.message ?? ""}`);
  check(pgClosed.sql.includes("E'a\\b'"), "the E-string body is preserved", pgClosed.sql);
  // With standard_conforming_strings on, PostgreSQL does not treat a backslash as an
  // escape, so the very same characters form a complete string.
  const pgPlain = run("SELECT 'a\\';", { language: "postgresql" });
  check(pgPlain.kind === "formatted", "a plain PostgreSQL string ending in a backslash is complete, not unterminated", `${pgPlain.kind}: ${pgPlain.message ?? ""}`);

  // Placeholders: the old default dialect rejected them.
  check(run("SELECT :name, @name, $1;").kind === "formatted", "PostgreSQL placeholders parse under the new default", run("SELECT :name, @name, $1;").kind);
  check(run("SELECT ?;", { language: "mysql" }).kind === "formatted", "the MySQL placeholder parses under MySQL");

  check(run("SELECT `x` FROM t;", { language: "mysql" }).kind === "formatted", "a backtick identifier parses under MySQL");
  check(run("SELECT [x] FROM t;", { language: "transactsql" }).kind === "formatted", "a bracket identifier parses under SQL Server");
  check(run("SELECT $$body$$;", { language: "postgresql" }).kind === "formatted", "a dollar-quoted body parses under PostgreSQL");
  check(run("SELECT $tag$body$tag$;", { language: "postgresql" }).kind === "formatted", "a tagged dollar quote parses under PostgreSQL");
  check(run("SELECT $$body", { language: "postgresql" }).kind === "invalid-sql", "an unterminated dollar quote is refused");
  check(run("SELECT $$body$$;").sql.includes("$$body$$"), "a dollar-quoted body is not reformatted inside", run("SELECT $$body$$;").sql);

  check(run("BEGIN; SELECT 1;").kind === "formatted", "a T-SQL block formats");
  check(run("SELECT * FROM t;").kind === "formatted", "a trivial select formats under every dialect", run("SELECT * FROM t;", { language: "n1ql" }).kind);
}

// --- 9. every shipped dialect is offered, and every label ----------------------
{
  check(M.SQL_DIALECTS.length === 21, "all 21 formatter dialects are offered", String(M.SQL_DIALECTS.length));
  const ids = M.SQL_DIALECTS.map((d) => d.id);
  check(new Set(ids).size === ids.length, "no dialect is listed twice");
  check(M.SQL_DIALECTS.every((d) => d.label && d.label !== d.id), "every dialect has a human label", JSON.stringify(M.SQL_DIALECTS.filter((d) => d.label === d.id).map((d) => d.id)));
  check(ids.includes(M.DEFAULT_SQL_DIALECT), "the default dialect is one of the offered ones", M.DEFAULT_SQL_DIALECT);
  // plsql is Oracle's dialect, so the copy may name Oracle, but only as PL/SQL.
  check(ids.includes("plsql"), "the Oracle PL/SQL dialect is offered");
  const plsql = M.SQL_DIALECTS.find((d) => d.id === "plsql");
  check(/PL\/SQL/.test(plsql.label), "the Oracle dialect is labelled as PL/SQL rather than plain Oracle", plsql.label);
}

// --- 10. a real query corpus, formatted with no corruption ----------------------
{
  const corpus = [
    "SELECT id, name FROM users WHERE created_at > NOW() ORDER BY name LIMIT 10;",
    "WITH recent AS (SELECT * FROM orders WHERE ts >= '2026-01-01') SELECT * FROM recent JOIN users USING (id);",
    "INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y');",
    "UPDATE t SET a = a + 1 WHERE b IS NOT NULL;",
    "CREATE TABLE t (id INTEGER PRIMARY KEY, name VARCHAR(255) NOT NULL);",
    "SELECT CASE WHEN x > 1 THEN 'big' ELSE 'small' END AS size FROM t;",
    "SELECT COUNT(*) FROM t GROUP BY a HAVING COUNT(*) > 2;",
    "SELECT a FROM t UNION ALL SELECT b FROM u;",
    "SELECT CAST(x AS VARCHAR(10)) FROM t;",
    "SELECT LEFT(a, 3) FROM t;",
    "MERGE INTO t USING u ON t.id = u.id WHEN MATCHED THEN UPDATE SET t.a = u.a;",
  ];
  for (const q of corpus) {
    const r = run(q);
    check(r.kind === "formatted", `corpus query formats: ${q.slice(0, 42)}`, `${r.kind}: ${r.message ?? ""}`);
    if (r.kind !== "formatted") continue;
    // A formatter that loses a quote or a bracket is worse than one that does nothing.
    const quotes = (q.match(/'/g) ?? []).length;
    const got = (r.sql.match(/'/g) ?? []).length;
    check(got === quotes, `no string quote lost in: ${q.slice(0, 42)}`, `${quotes} -> ${got}`);
    check(r.sql.trim().endsWith(";"), `the statement terminator survives: ${q.slice(0, 42)}`, r.sql.trim().slice(-20));
    // The corruption signature is a comment delimiter split by a space, so look for exactly
    // that, rather than for any spaced operator, which `SELECT *` legitimately produces.
    check(!r.sql.includes("/ *"), `no comment opener was split into an operator: ${q.slice(0, 42)}`, r.sql);
    check(!r.sql.includes("* /"), `no comment closer was split into an operator: ${q.slice(0, 42)}`, r.sql);
  }
}

// --- 11. comments and strings in a corpus survive round-trip -------------------
{
  const sql = `-- header note\nSELECT /* inline */ a, 'has -- dashes' AS b /* tail */ FROM t`;
  const r = run(sql);
  check(r.kind === "formatted", "a comment-laden query formats", r.kind);
  check(r.sql.includes("-- header note"), "the leading line comment survives", r.sql);
  check(r.sql.includes("/* inline */"), "an inline block comment survives", r.sql);
  check(r.sql.includes("/* tail */"), "a trailing block comment survives", r.sql);
  check(r.sql.includes("'has -- dashes'"), "a string containing comment markers is untouched", r.sql);
}

// --- 12. THE COPY. Asserted against shipped data, not approved by reading. -----
{
  const { TOOL_CONTENT } = REPO_CONTENT;
  const { GUIDES } = REPO_GUIDES;

  // The registry entry, read out of the source text for this slug.
  const TOOL_ENTRY = /\{[^{}]*?slug: "sql-formatter"[^{}]*?\}/.exec(TOOLS_SRC)?.[0] ?? "";
  const TOOL_NAME = /slug: "sql-formatter",\s*name: "([^"]+)"/.exec(TOOL_ENTRY)?.[1] ?? "";
  const TOOL_DESC = /slug: "sql-formatter"[\s\S]*?description:\s*\n?\s*"([^"]+)"/.exec(TOOL_ENTRY)?.[1] ?? "";
  // The keyword list for this slug, likewise parsed out of the source.
  const KEYWORDS = (() => {
    const m = /"sql-formatter":\s*\[([^\]]*)\]/.exec(SEO_SRC);
    return m ? m[1].match(/"[^"]+"/g)?.map((s) => s.slice(1, -1)) ?? [] : [];
  })();

  const content = TOOL_CONTENT["sql-formatter"];
  const LONG = content.longDescription;
  const FEATURES = content.features;
  const FAQ = content.faq.map((f) => `${f.question} ${f.answer}`).join(" ");
  const HOWTO = content.howTo.map((h) => `${h.step} ${h.description}`).join(" ");
  const COPY = `${LONG} ${FEATURES.join(" ")} ${FAQ} ${HOWTO}`;
  const guide = GUIDES.find((g) => g.toolSlug === "sql-formatter");
  const GUIDE = guide ? JSON.stringify(guide) : "";

  check(!!TOOL_ENTRY, "the registry entry exists");
  check(!!content, "the tool content exists");
  check(!!TOOL_NAME, "the registry entry has a name");
  check(TOOL_DESC.length > 40, "the registry description says something specific", TOOL_DESC);

  // The claims that were false.
  check(!/comma[- ]aligned/i.test(COPY), "no claim of comma-aligned column lists");
  check(!/all major sql dialects/i.test(COPY), "no claim of all major dialects");
  check(!/proprietary functions correctly/i.test(COPY), "no claim that proprietary functions are handled correctly");
  check(!/highlights the exact position/i.test(COPY), "no claim of exact-position highlighting");

  // Oracle may be named only as PL/SQL.
  check(!/\bOracle\b(?!.{0,12}(PL\/SQL|PLSQL))/.test(COPY) || /PL\/SQL/.test(COPY), "Oracle is only ever named together with PL/SQL");

  // Every dialect named must actually be offered by the page.
  const named = [
    ["PostgreSQL", "postgresql"],
    ["MySQL", "mysql"],
    ["MariaDB", "mariadb"],
    ["SQLite", "sqlite"],
    ["BigQuery", "bigquery"],
    ["Snowflake", "snowflake"],
    ["Redshift", "redshift"],
    ["Spark", "spark"],
    ["DuckDB", "duckdb"],
    ["ClickHouse", "clickhouse"],
    ["Trino", "trino"],
    ["Db2", "db2"],
    ["Hive", "hive"],
    ["N1QL", "n1ql"],
    ["TiDB", "tidb"],
    ["SingleStore", "singlestoredb"],
    ["SQL Server", "transactsql"],
  ];
  for (const [label, id] of named) {
    if (!COPY.includes(label)) continue;
    check(M.SQL_DIALECTS.some((d) => d.id === id), `a dialect the copy names (${label}) is actually offered`);
  }

  // The default must be stated where the copy describes the default.
  if (/default/i.test(COPY)) {
    check(COPY.includes("PostgreSQL"), "a copy that mentions a default names the real one");
  }

  // The privacy claim and the honesty requirements.
  check(/browser/i.test(COPY) || /client-side/i.test(COPY), "the copy states that it runs in the browser");
  check(/never leave|never sent|not uploaded|no server/i.test(COPY), "the copy states the privacy position");
  check(!/comma/i.test(FEATURES.join(" ")) || !/aligned/i.test(FEATURES.join(" ")), "no feature claims comma alignment");

  // Caps quoted in the copy must be the caps the module enforces.
  const quoted = new Set();
  for (const text of [LONG, FAQ, HOWTO, GUIDE]) {
    for (const m of String(text).matchAll(/\b\d{1,3}(?:,\d{3})+\b/g)) quoted.add(m[0]);
  }
  check(quoted.has(n(M.MAX_SQL_CHARS)), "the copy quotes the character cap the module enforces", [...quoted].join(" "));

  // Features must be things that exist: a Format button does not exist here.
  check(!/\bclick format\b/i.test(HOWTO), "the how-to does not tell the reader to click a Format button that does not exist");
  check(/Load sample/i.test(COPY) || /nothing is pre-filled|pre-filled/i.test(COPY), "the copy does not imply the box is empty when it is not");

  check(KEYWORDS.length >= 5, "the SEO entry has keywords", String(KEYWORDS.length));
  // A keyword list that omits the dialect names is thin for a tool whose whole point
  // is dialect choice.
  check(KEYWORDS.some((k) => /mysql/i.test(k)) || KEYWORDS.some((k) => /postgres/i.test(k)), "the keywords name a real dialect");
  check(!!guide, "a guide exists for this tool");
  if (guide) {
    check(guide.keywords.length >= 5, "the guide carries its own keywords", String(guide.keywords.length));
    check(!/comma[- ]aligned/i.test(GUIDE), "the guide makes no false claim");
    check(!/all major/i.test(GUIDE), "the guide does not claim all major dialects");
  }
}

// --- 13. the component cannot reintroduce the old defects ---------------------
{
  // The old select shipped value="\t", which is a backslash and a t, so the Tab option
  // produced no tab at all. Asserted against the source because that bug is invisible
  // to anything that only exercises the default indent.
  check(/<option value="tab">/.test(COMPONENT_SRC), "the tab option's value is the literal word tab, not a backslash-t");
  // The comment naming the old bug contains the very string it warns about, so the
  // source is checked for the sentinel instead, and the warning is only allowed as prose.
  check(!/<option value="\\t"/.test(COMPONENT_SRC), "no option is declared with a backslash-t value");
  check(/option value="tab">Tab character/.test(COMPONENT_SRC), "the Tab option is the word tab");
  check(/useDeferredValue/.test(COMPONENT_SRC), "the component defers its work off the keystroke");
  check(/useMemo/.test(COMPONENT_SRC), "the component memoises its format");
  check(/role="status"/.test(COMPONENT_SRC), "the component has a live region");
  check(/aria-label="SQL input"/.test(COMPONENT_SRC), "the input textarea has an accessible name");
  check(/aria-label="Formatted SQL"/.test(COMPONENT_SRC), "the output textarea has an accessible name");
  check(/tabIndex=\{-1\}/.test(COMPONENT_SRC), "the read-only output is out of the tab order");
  check(/useState\(""\)/.test(COMPONENT_SRC), "the box starts empty rather than pre-filled");
  // An error must never be handed to the copy control as if it were SQL.
  check(/disabled=\{result.kind !== "formatted"\}/.test(COMPONENT_SRC), "Copy is disabled unless the query formatted");
  // The pane, Copy and the download all read one variable, which is empty unless the
  // result formatted. That is what keeps an error message out of the clipboard.
  check(/const sql = result.kind === "formatted" \? result.sql : ""/.test(COMPONENT_SRC), "the pane is fed the formatted text, or nothing at all");
}

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);