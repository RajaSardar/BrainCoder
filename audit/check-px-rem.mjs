/**
 * Node mirror audit for the PX ↔ REM Converter. No browser, no DOM.
 *
 * The shipped pure module (`src/features/px-rem/units.ts`) is transpiled with the
 * repo's own TypeScript compiler and required, so every check below runs the code
 * the tab runs.
 *
 * The finding that mattered: the old component used `toFixed(4)` for px→rem, so
 * 14.5px / 16 = 0.90625 was rounded to 0.9063 even though the features list sold
 * that exact value, and empty input parsed as Number("") === 0 and rendered
 * "0rem". Section 1 asserts a blank/invalid value is null, section 3 asserts the
 * exact fractional value the copy claims, and section 5 asserts the copy no longer
 * sells em, vw/vh or batch mode.
 *
 *   node audit/check-px-rem.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SRC = "src/features/px-rem";
const OUT = "audit/.px-rem-mirror";

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

const M = transpile(`${SRC}/units.ts`, "units");
const REPO_CONTENT = transpile("src/lib/tool-content.ts", "repo-content");
const COMPONENT_SRC = readFileSync(`${SRC}/PxRem.tsx`, "utf8");
const CONTENT = REPO_CONTENT.TOOL_CONTENT["px-rem"];

// --- 1. blank and invalid input is null, never zero ---------------------------
{
  check(M.parseUnitValue("") === null, "empty input is null, not 0");
  check(M.parseUnitValue("   ") === null, "whitespace-only input is null");
  check(M.parseUnitValue("abc") === null, "non-numeric text is null");
  check(M.parseUnitValue("0x10") === null, "a hex literal is refused");
  check(M.parseUnitValue("Infinity") === null, "Infinity is refused");
  check(M.parseUnitValue("1e9") === null, "a value over the cap is refused");
  check(M.parseUnitValue("1000001") === null, "one over the 1,000,000 cap is refused");
  check(M.parseUnitValue("1000000") === 1000000, "the 1,000,000 boundary is allowed");
  check(M.parseUnitValue("12.5") === 12.5, "a decimal parses");
  check(M.parseUnitValue(" 12.5 ") === 12.5, "surrounding whitespace is tolerated");
  check(M.parseUnitValue("1e3") === 1000, "scientific notation parses");
  check(M.parseUnitValue("0") === 0, "a literal zero is a real value");
  check(M.parseUnitValue("-4") === -4, "a negative value is kept");
  check(M.parseUnitValue(".5") === 0.5, "a leading-dot decimal parses");
}

// --- 2. the conversion math ---------------------------------------------------
{
  check(M.pxToRem(24, 16) === 1.5, "24px is 1.5rem at a 16px base");
  check(M.remToPx(1.5, 16) === 24, "1.5rem is 24px at a 16px base");
  check(M.pxToRem(20, 10) === 2, "20px is 2rem at a 10px base");
  check(M.remToPx(2, 10) === 20, "2rem is 20px at a 10px base");
  check(M.clampBase(16) === 16 && M.clampBase(1) === 8 && M.clampBase(99) === 24 && M.clampBase(NaN) === 16,
    "the base clamps to 8–24 with a 16 default");
}

// --- 3. formatter preserves the exact claimed fraction ------------------------
{
  check(M.formatNumber(M.pxToRem(14.5, 16)) === "0.90625", "14.5px is exactly 0.90625rem", M.formatNumber(M.pxToRem(14.5, 16)));
  check(M.formatNumber(M.pxToRem(24, 16)) === "1.5", "trailing zeros are trimmed");
  check(M.formatNumber(M.remToPx(1.5, 16)) === "24", "an integer result has no decimals");
  check(M.formatNumber(M.pxToRem(1, 16)) === "0.0625", "1px is 0.0625rem");
  check(M.formatNumber(M.pxToRem(1, 24)) === "0.041667", "a repeating value rounds at six decimals");
  check(M.formatNumber(M.pxToRem(0, 16)) === "0", "zero formats as 0");
  check(M.formatNumber(M.pxToRem(-8, 16)) === "-0.5", "a negative value keeps its sign");
}

// --- 4. reference table -------------------------------------------------------
{
  const t16 = M.referenceTable(16);
  check(t16.length === 20, "the table has 20 rows", String(t16.length));
  const row = (rows, px) => rows.find((r) => r.px === px);
  check(row(t16, 16).rem === "1", "16px is 1rem at a 16px base");
  check(row(t16, 12).rem === "0.75", "12px is 0.75rem at a 16px base");
  check(row(t16, 14).rem === "0.875", "14px is 0.875rem at a 16px base");
  check(row(M.referenceTable(10), 16).rem === "1.6", "16px is 1.6rem at a 10px base");
}

// --- 5. the component is labelled and gates the copy button -------------------
{
  check(/htmlFor=\{baseId\}/.test(COMPONENT_SRC), "the base slider has a real label");
  check(/htmlFor=\{pxId\}/.test(COMPONENT_SRC), "the px input has a real label");
  check(/htmlFor=\{remId\}/.test(COMPONENT_SRC), "the rem input has a real label");
  check(/disabled=\{pxValue === null\}/.test(COMPONENT_SRC), "the px copy button is disabled for an invalid value");
  check(/disabled=\{remValue === null\}/.test(COMPONENT_SRC), "the rem copy button is disabled for an invalid value");
  check(/role="status"/.test(COMPONENT_SRC), "a role=status live region exists");
  check(/role="alert"/.test(COMPONENT_SRC), "an out-of-range value uses role=alert");
  check(!/monoCheck|useEffect/.test(COMPONENT_SRC), "no client effect is used (deterministic SSR)");
}

// --- 6. the copy matches the code ---------------------------------------------
{
  const prose = JSON.stringify(CONTENT);
  check(/0\.90625/.test(prose), "the copy states the exact 14.5px → 0.90625rem value");
  check(/8.{0,3}24/.test(prose), "the copy states the 8–24px range", prose);
  check(/px ↔ rem only/.test(prose), "the copy answers the em/vw question with an explicit no");
  check(/viewport units depend on the viewport/.test(prose), "the copy explains why viewport units are excluded");
  check(!/batch/i.test(prose), "the copy makes no batch-mode claim");
  const features = CONTENT.features.join(" | ");
  check(!/\bem\b|\bvw\b|\bvh\b/i.test(features), "the feature list no longer sells em/vw/vh", features);
  const howTo = CONTENT.howTo.map((s) => s.description).join(" | ");
  check(!/batch/i.test(howTo), "the how-to no longer describes a batch mode", howTo);
}

// --- 7. the module is the authority -------------------------------------------
for (const name of ["parseUnitValue", "formatNumber", "pxToRem", "remToPx", "referenceTable"]) {
  check(
    new RegExp(`export function ${name}\\b`).test(readFileSync(`${SRC}/units.ts`, "utf8")),
    `${name} is exported from the shipped module`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
