/**
 * Node mirror audit for the Cron Expression Parser. No browser, no DOM.
 *
 * The shipped pure module (`src/features/cron-parser/cron.ts`) is transpiled with
 * the repo's own TypeScript compiler and required, so every check below runs the
 * code the tab runs. cron-parser is CommonJS with `__esModule`, so the module is
 * emitted as CommonJS (esModuleInterop) and required rather than imported as ESM.
 *
 * The finding that matters: cron-parser accepts one to six fields and silently
 * fills the missing ones with wildcards, so "* * * *" and even "*" parsed as if
 * they were five-field expressions. Section 3 asserts the real 5-or-6-fields rule
 * (macros excepted) is enforced before the library is asked.
 *
 *   node audit/check-cron-parser.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SRC = "src/features/cron-parser";
const OUT = "audit/.cron-mirror";

let pass = 0;
let fail = 0;

function check(cond, name, extra = "") {
  if (cond === true) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

function transpile(file, name) {
  writeFileSync(
    `${OUT}/${name}.cjs`,
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: `${name}.ts`,
    }).outputText,
  );
  return require(`${process.cwd()}/${OUT}/${name}.cjs`);
}

const M = transpile(`${SRC}/cron.ts`, "cron");
const REPO_CONTENT = transpile("src/lib/tool-content.ts", "repo-content");
const COMPONENT_SRC = readFileSync(`${SRC}/CronParser.tsx`, "utf8");
const CONTENT = REPO_CONTENT.TOOL_CONTENT["cron-parser"];

const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const run = (expr, count = 5) => M.parseCron(expr, count, NOW);

// --- 1. the ordinary path ------------------------------------------------------
{
  const r = run("*/5 * * * *", 5);
  check(r.kind === "parsed", "a five-field expression parses", r.kind);
  check(r.next.length === 5, "the requested number of runs is returned", String(r.next?.length));
  check(r.next.every((d, i) => i === 0 || d > r.next[i - 1]), "the runs are strictly increasing");
  check(run("*/5 * * * *", 1).next.length === 1, "the slider floor of 1 run is honoured");
  check(run("*/5 * * * *", 20).next.length === 20, "the slider ceiling of 20 runs is honoured");
}
{
  const r = run("30 8 * * 1");
  check(r.kind === "parsed", "a named-day expression parses", r.kind);
  const dow = M.describeFields("30 8 * * 1");
  check(/day of week: Mon/.test(dow), "day-of-week 1 is shown as Mon", JSON.stringify(dow));
}

// --- 2. six fields and macros --------------------------------------------------
{
  const r = run("*/15 * * * * *");
  check(r.kind === "parsed", "a six-field expression parses", r.kind);
  const fields = M.describeFields("*/15 * * * * *");
  check(/^second:/m.test(fields), "the seconds field is listed for a six-field expression", JSON.stringify(fields));
  check(/second: 0, 15, 30, 45/.test(fields), "the seconds values are correct", fields);
}
{
  const five = M.describeFields("*/5 * * * *");
  check(!/second:/.test(five), "no seconds field is invented for a five-field expression", five);
}
for (const macro of ["@yearly", "@annually", "@monthly", "@weekly", "@daily", "@hourly"]) {
  check(run(macro).kind === "parsed", `the macro ${macro} parses`, run(macro).kind);
}
for (const bad of ["@reboot", "@midnight", "@every"]) {
  check(run(bad).kind === "invalid", `the macro ${bad} is refused`, run(bad).kind);
}

// --- 3. the real field-count rule ---------------------------------------------
{
  check(run("").kind === "empty", "empty input is empty, not an error", run("").kind);
  check(run("   ").kind === "empty", "whitespace-only input is empty", run("   ").kind);
  for (const n of [1, 2, 3, 4]) {
    const expr = Array.from({ length: n }, () => "*").join(" ");
    check(run(expr).kind === "invalid", `a ${n}-field expression is refused`, run(expr).kind);
    check(M.describeFields(expr) === "", `no fields are described for a ${n}-field expression`, M.describeFields(expr));
  }
  check(run("* * * * *").kind === "parsed", "five fields are accepted");
  check(run("* * * * * *").kind === "parsed", "six fields are accepted");
  check(run("* * * * * * *").kind === "invalid", "seven fields are refused by the parser", run("* * * * * * *").kind);
  const err = run("* * * *").error;
  check(/5 fields/.test(err) && /6/.test(err), "the field-count error names both valid counts", err);
  check(/\byou typed 4\b/.test(err), "the field-count error states what was typed", err);
}

// --- 4. impossible dates are refused, not skipped ------------------------------
{
  const r = run("0 0 30 2 *");
  check(r.kind === "invalid", "February 30 is refused", r.kind);
  check(/February 30/.test(r.error), "the February 30 message is plain English", r.error);
  check(run("0 0 31 4 *").kind === "invalid", "April 31 is refused", run("0 0 31 4 *").kind);
  check(run("0 0 29 2 *").kind === "parsed", "February 29 is still accepted (leap years exist)");
}

// --- 5. weekday names and the 0/7 duplicate ------------------------------------
{
  const dow07 = M.describeFields("0 0 * * 0,7");
  check((dow07.match(/Sun/g) || []).length === 1, "day-of-week 0 and 7 collapse to one Sunday", dow07);
  check(/day of week: Mon,\s*Fri/.test(M.describeFields("0 0 * * MON,FRI")), "names are preserved", M.describeFields("0 0 * * MON,FRI"));
  check(/month: .*\bJan\b|\bjan\b/i.test(M.describeFields("0 0 1 1 *")) || /month: 1/.test(M.describeFields("0 0 1 1 *")), "month resolves", M.describeFields("0 0 1 1 *"));
}

// --- 6. the component makes the error an alert and names its inputs -------------
{
  check(/role="alert"/.test(COMPONENT_SRC), "the invalid-expression panel is a role=alert");
  check(/aria-invalid=/.test(COMPONENT_SRC), "the expression input exposes aria-invalid");
  check(/htmlFor=\{exprId\}/.test(COMPONENT_SRC), "the expression label is bound with htmlFor");
  check(/htmlFor=\{countId\}/.test(COMPONENT_SRC), "the run-count label is bound with htmlFor");
  check(!/aria-label="Cron expression"/.test(COMPONENT_SRC), "the input relies on its real label, not a duplicated aria-label");
}

// --- 7. the copy matches the code ---------------------------------------------
{
  const prose = JSON.stringify(CONTENT);
  check(/@midnight/.test(prose), "the copy discusses @midnight (to say it is not a macro)");
  check(/@midnight[^.]*not|not[^.]*@midnight/.test(prose), "the copy states @midnight is not accepted");
  check(/@reboot[^.]*not|not[^.]*@reboot/.test(prose), "the copy states @reboot is not accepted");
  check(!/auto-?detect/i.test(prose), "the copy makes no auto-detect claim");
  check(/seconds/.test(prose), "the copy mentions seconds");
  const features = CONTENT.features.join(" | ");
  check(!/production.ready/i.test(features), "no production-ready phrasing in the features");
}
for (const name of ["parseCron", "describeFields", "fieldCountError"]) {
  check(new RegExp(`export function ${name}\\b`).test(readFileSync(`${SRC}/cron.ts`, "utf8")), `${name} is exported from the shipped module`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
