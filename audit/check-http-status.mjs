/**
 * Node mirror audit for the HTTP Status Codes reference. No browser, no DOM.
 *
 * The shipped pure module (`src/features/http-status/status-codes.ts`) is
 * transpiled with the repo's own TypeScript compiler and required, so every check
 * runs the data and grouping the tab runs.
 *
 * The findings that mattered: several registered codes were tagged "unofficial"
 * (207/423/425/507 from RFC 4918/8470), the WebDAV 424 and the informative 226,
 * 305 and 421 were missing entirely, 422's description was ungrammatical, and the
 * copy sold cacheability, common causes and a copy button that never existed.
 * Section 2 asserts the registry flags, section 3 asserts the missing codes and
 * the 422 wording, and section 6 asserts the copy no longer claims what the tool
 * does not do.
 *
 *   node audit/check-http-status.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SRC = "src/features/http-status";
const OUT = "audit/.http-status-mirror";

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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: `${name}.ts`,
    }).outputText,
  );
  return require(`${process.cwd()}/${OUT}/${name}.cjs`);
}

const M = transpile(`${SRC}/status-codes.ts`, "status-codes");
const REPO_CONTENT = transpile("src/lib/tool-content.ts", "repo-content");
const COMPONENT_SRC = readFileSync(`${SRC}/HttpStatus.tsx`, "utf8");
const CONTENT = REPO_CONTENT.TOOL_CONTENT["http-status"];

const byCode = (c) => M.STATUSES.find((s) => s.code === c);

// --- 1. the dataset shape -----------------------------------------------------
{
  const codes = M.STATUSES.map((s) => s.code);
  check(new Set(codes).size === codes.length, "no duplicate status codes");
  check(codes.every((c) => c >= 100 && c <= 599), "every code is a valid three-digit status");
  check(M.STATUS_CLASS_ORDER.join(",") === "1xx,2xx,3xx,4xx,5xx", "the five classes are defined in order");
  for (const key of M.STATUS_CLASS_ORDER) {
    check(M.STATUSES.some((s) => M.classKeyOf(s.code) === key), `the ${key} class has at least one code`);
  }
}

// --- 2. registry flags are correct --------------------------------------------
{
  check(byCode(599).official === false, "599 is the only unofficial code");
  for (const c of [102, 207, 208, 226, 305, 306, 421, 423, 424, 425, 507]) {
    check(byCode(c).official === true, `${c} is a registered (official) code`);
  }
  check(M.STATUSES.filter((s) => !s.official).length === 1, "exactly one code is marked unofficial");
}

// --- 3. the missing codes and the 422 wording ---------------------------------
{
  for (const c of [226, 305, 306, 421, 424, 208]) {
    check(!!byCode(c), `the previously missing code ${c} is present`);
  }
  check(byCode(422).name === "Unprocessable Content", "422 uses the RFC 9110 name", byCode(422).name);
  check(!/instructions/i.test(byCode(422).description), "422's description is no longer garbled");
  check(byCode(413).name === "Content Too Large", "413 uses the RFC 9110 name", byCode(413).name);
}

// --- 4. class mapping ---------------------------------------------------------
{
  check(M.classKeyOf(100) === "1xx" && M.classKeyOf(199) === "1xx", "1xx maps correctly");
  check(M.classKeyOf(200) === "2xx" && M.classKeyOf(299) === "2xx", "2xx maps correctly");
  check(M.classKeyOf(308) === "3xx", "308 maps to 3xx");
  check(M.classKeyOf(404) === "4xx" && M.classKeyOf(451) === "4xx", "4xx maps correctly");
  check(M.classKeyOf(599) === "5xx", "599 maps to 5xx");
}

// --- 5. search and grouping ---------------------------------------------------
{
  check(M.filterStatuses("429").length === 1 && M.filterStatuses("429")[0].code === 429, "searching a code finds it");
  const redir = M.filterStatuses("redirect");
  check(redir.length >= 2 && redir.every((s) => M.classKeyOf(s.code) === "3xx"), "searching 'redirect' returns only 3xx", JSON.stringify(redir.map((s) => s.code)));
  const timeout = M.filterStatuses("timeout").map((s) => s.code);
  check(timeout.includes(408) && timeout.includes(504), "searching 'timeout' finds 408 and 504", JSON.stringify(timeout));
  check(M.filterStatuses("zzz").length === 0, "a nonsense query returns nothing");
  check(M.filterStatuses("   ").length === M.STATUSES.length, "a blank query returns everything");

  const all = M.queryStatuses("", "all");
  check(all.total === M.STATUSES.length, "the all-filter total is the full dataset", String(all.total));
  check(all.groups.length === 5, "the all-filter renders five class groups", String(all.groups.length));
  const fourxx = M.queryStatuses("", "4xx");
  check(fourxx.groups.length === 1 && fourxx.groups[0].key === "4xx", "a 4xx filter renders one group");
  check(fourxx.total === M.STATUSES.filter((s) => M.classKeyOf(s.code) === "4xx").length, "the 4xx filter count is correct");
  const one = M.queryStatuses("IM Used", "all");
  check(one.total === 1 && one.groups[0].items[0].code === 226, "a single-result query returns one item", JSON.stringify(one.groups.map((g) => g.items.map((s) => s.code))));
  check(M.queryStatuses("zzz", "all").total === 0 && M.queryStatuses("zzz", "all").groups.length === 0, "an empty result has no groups");
}

// --- 6. the component and the copy --------------------------------------------
{
  check(/htmlFor=\{searchId\}/.test(COMPONENT_SRC), "the search box has a real label");
  check(/aria-pressed=\{active\}/.test(COMPONENT_SRC), "the class chips expose aria-pressed");
  check(/role="group"/.test(COMPONENT_SRC), "the chip set is a labelled group");
  check(/role="status"/.test(COMPONENT_SRC), "a role=status live region exists");
  check(/status\{cls\.length === 1 \? "" : "es"\}/.test(COMPONENT_SRC), "the class count is pluralized");

  const prose = JSON.stringify(CONTENT);
  check(/unofficial/i.test(prose), "the copy explains the unofficial tag");
  check(/IANA/.test(prose), "the copy names the IANA registry");
  check(!/cacheab/i.test(prose), "the copy makes no cacheability claim");
  check(!/common causes/i.test(prose), "the copy makes no common-causes claim");
  check(!/copy button/i.test(prose), "the copy promises no copy button");
  check(!/click any status/i.test(prose), "the copy no longer says statuses are clickable");
  check(!/full WebDAV/i.test(prose), "the copy no longer claims every WebDAV code");
  check(!/every HTTP response status code/i.test(prose), "the copy no longer claims completeness");
  const howTo = CONTENT.howTo.map((s) => s.description).join(" | ");
  check(!/click a category header/i.test(howTo), "the how-to no longer describes a dead click", howTo);
  check(!/copy button/i.test(howTo), "the how-to no longer points at a nonexistent copy button", howTo);
}

// --- 7. the module is the authority -------------------------------------------
for (const name of ["classKeyOf", "filterStatuses", "queryStatuses"]) {
  check(
    new RegExp(`export function ${name}\\b`).test(readFileSync(`${SRC}/status-codes.ts`, "utf8")),
    `${name} is exported from the shipped module`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
