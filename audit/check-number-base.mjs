/**
 * Node mirror audit for the Number Base Converter. No browser, no DOM.
 *
 * The shipped pure module (`src/features/number-base/convert.ts`) is transpiled with
 * the repo's own TypeScript compiler and required, so every check runs the code the
 * tab runs.
 *
 * The finding that mattered: the old parser stripped 0x/0b/0o *before* reading the
 * sign, so "-0xff" in base 10 silently became the digits "ff" and auto-detected as
 * hexadecimal, and "0b11" in base 16 was reinterpreted as binary. Section 2 asserts
 * the sign is read first and a prefix is stripped only when it belongs to the chosen
 * base. Section 5 asserts the copy no longer sells bases 2-64, fractions, two's
 * complement, bit-length or grouping.
 *
 *   node audit/check-number-base.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SRC = "src/features/number-base";
const OUT = "audit/.number-base-mirror";

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

const M = transpile(`${SRC}/convert.ts`, "convert");
const REPO_CONTENT = transpile("src/lib/tool-content.ts", "repo-content");
const COMPONENT_SRC = readFileSync(`${SRC}/NumberBase.tsx`, "utf8");
const CONTENT = REPO_CONTENT.TOOL_CONTENT["number-base"];

const safe = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? `${x}n` : x));
const conv = (input, base) => M.convert(input, base);
const row = (r, label) => r.rows.find((x) => x.label.startsWith(label));

// --- 1. the ordinary path ------------------------------------------------------
{
  const r = conv("255", 10);
  check(r.kind === "converted", "a decimal number converts", r.kind);
  check(row(r, "Binary").value === "0b11111111", "255 is 0b11111111", row(r, "Binary").value);
  check(row(r, "Octal").value === "0o377", "255 is 0o377", row(r, "Octal").value);
  check(row(r, "Decimal").value === "255", "255 is 255", row(r, "Decimal").value);
  check(row(r, "Hexadecimal").value === "0xFF", "255 is 0xFF", row(r, "Hexadecimal").value);
  check(row(r, "Unicode").value === "U+00FF", "255 is U+00FF", row(r, "Unicode").value);
  check(row(r, "Unicode").note === "ÿ", "the code point shows the character", row(r, "Unicode").note);
}
{
  const r = conv("ff", 16);
  check(r.kind === "converted" && row(r, "Decimal").value === "255", "hex ff is 255", safe(r));
}
{
  const r = conv("777", 8);
  check(r.kind === "converted" && row(r, "Decimal").value === "511", "octal 777 is 511", safe(r));
}

// --- 2. the prefix / sign rule -------------------------------------------------
{
  const r = conv("-0xff", 16);
  check(r.kind === "converted", "-0xff in base 16 converts", r.kind);
  check(row(r, "Decimal").value === "-255", "the sign is carried through the prefix", row(r, "Decimal").value);
  check(row(r, "Hexadecimal").value === "-0xFF", "the negative hex keeps its sign", row(r, "Hexadecimal").value);
}
{
  const r = conv("-0xff", 10);
  check(r.kind === "invalid", "-0xff in base 10 is refused, not auto-detected", r.kind);
  check(/x/.test(r.error), "the offending digit is named", r.error);
}
{
  const r = conv("0b11", 2);
  check(r.kind === "converted" && row(r, "Decimal").value === "3", "0b11 in base 2 is 3", safe(r));
}
{
  const r = conv("0b11", 16);
  check(r.kind === "converted", "0b11 in base 16 is accepted as hex digits", r.kind);
  check(row(r, "Decimal").value === "2833", "0b11 in base 16 is 0xB11 = 2833", row(r, "Decimal").value);
}
{
  const r = conv("+0x10", 16);
  check(r.kind === "converted" && row(r, "Decimal").value === "16", "+0x10 in base 16 is 16", safe(r));
}
{
  const r = conv("0o17", 8);
  check(r.kind === "converted" && row(r, "Decimal").value === "15", "0o17 in base 8 is 15", safe(r));
}
{
  check(conv("0x", 16).kind === "invalid", "a bare 0x is refused", safe(conv("0x", 16)));
  check(conv("-", 10).kind === "invalid", "a bare sign is refused", safe(conv("-", 10)));
  check(conv("", 10).kind === "empty", "empty input is empty", conv("", 10).kind);
  check(conv("   ", 10).kind === "empty", "whitespace-only input is empty", conv("   ", 10).kind);
}
{
  const r = conv("2", 2);
  check(r.kind === "invalid", "2 is not a base-2 digit", r.kind);
  check(/"2"|“2”/.test(r.error), "the invalid digit is quoted in the message", r.error);
}

// --- 3. bases 2..36 ------------------------------------------------------------
{
  check(Array.isArray(M.INPUT_BASES), "the input-base list is exported");
  check(M.INPUT_BASES.length === 35, "the base list runs 2..36 (35 entries)", String(M.INPUT_BASES.length));
  check(M.INPUT_BASES[0] === 2 && M.INPUT_BASES[M.INPUT_BASES.length - 1] === 36, "the base list starts at 2 and ends at 36");
  const r = conv("z", 36);
  check(r.kind === "converted" && row(r, "Decimal").value === "35", "base 36 accepts z = 35", safe(r));
  check(conv("g", 16).kind === "invalid", "base 16 refuses g", conv("g", 16).kind);
}

// --- 4. arbitrary precision and the code point ---------------------------------
{
  const big = conv("18446744073709551616", 10); // 2^64
  check(big.kind === "converted", "2^64 converts", big.kind);
  check(row(big, "Hex").value === "0x10000000000000000", "2^64 is 0x1 followed by 16 zeros", row(big, "Hex").value);
  check(conv("0", 10).rows.find((x) => x.label.startsWith("Unicode")).value === "U+0000", "0 is U+0000");
  check(conv("0x110000", 16).rows.find((x) => x.label.startsWith("Unicode")).value === "—", "a value above U+10FFFF shows a dash");
  const surrogate = conv("0xd800", 16).rows.find((x) => x.label.startsWith("Unicode"));
  check(/surrogate/.test(surrogate.note || ""), "a surrogate code point is disclosed as such", surrogate.note);
}

// --- 5. the copy matches the code ---------------------------------------------
{
  const prose = JSON.stringify(CONTENT);
  for (const [label, re] of [
    ["2-64 range", /2\s*(to|-|–|—)\s*64|2\s*à\s*64/],
    ["custom base to 64", /custom base[^"]*64/i],
    ["fractional conversion", /fractional (number )?conversion|handles fractional|see how it'?s represented in binary/i],
    ["two's complement display", /two'?s complement\) display|signed integer \(two'?s complement\)|show signed representations/i],
    ["bit-length pairing", /bit[- ]length and grouping/i],
    ["grouping feature", /grouping (options|information)/i],
    ["auto-detect", /auto-?detect/i],
  ]) {
    check(!re.test(prose), `the copy no longer makes the ${label} claim`, prose.match(re)?.[0]);
  }
  check(/2 to 36|2 through 36|base 2 .*36/i.test(prose), "the copy states the real 2..36 range");
  check(/BigInt|arbitrary-precision|arbitrary precision/i.test(prose), "the copy states arbitrary precision");
  check(!/auto-?detect/i.test(COMPONENT_SRC), "the component makes no auto-detect statement");
  check(/stripped only when they match/i.test(COMPONENT_SRC) || /only when they match the selected base/i.test(COMPONENT_SRC), "the component documents the match-the-base prefix rule");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
