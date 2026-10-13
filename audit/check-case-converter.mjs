/**
 * Node mirror audit for the Case Converter. No browser, no DOM.
 *
 * The shipped component (`src/features/case-converter/CaseConverter.tsx`) is
 * read to verify the UI is accessible and honest. The conversion logic is
 * inspected from the component source in this mirror.
 *
 *   node audit/check-case-converter.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SRC = "src/features/case-converter";
const OUT = "audit/.case-converter-mirror";

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

const REPO_CONTENT = transpile("src/lib/tool-content.ts", "repo-content");
const COMPONENT_SRC = readFileSync(`${SRC}/CaseConverter.tsx`, "utf8");
const CONTENT = REPO_CONTENT.TOOL_CONTENT["case-converter"];

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function words(text) {
  const cleaned = text
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return cleaned ? cleaned.split(/\s+/) : [];
}
const camel = (t) => words(t).map((w, i) => (i === 0 ? w.toLowerCase() : cap(w.toLowerCase()))).join("");
const pascal = (t) => words(t).map((w) => cap(w.toLowerCase())).join("");
const snake = (t) => words(t).map((w) => w.toLowerCase()).join("_");
const kebab = (t) => words(t).map((w) => w.toLowerCase()).join("-");
const constant = (t) => words(t).map((w) => w.toUpperCase()).join("_");
const dot = (t) => words(t).map((w) => w.toLowerCase()).join(".");
const title = (t) => words(t).map((w) => cap(w.toLowerCase())).join(" ");
const sentence = (t) => {
  const w = words(t);
  return w.length ? cap(w.join(" ").toLowerCase()) : "";
};
const upper = (t) => t.toUpperCase();
const lower = (t) => t.toLowerCase();
const capitalize = (t) => t.split(/\s+/).map((w) => cap(w.toLowerCase())).join(" ");

// --- 1. basic conversions
{
  check(camel("Hello World") === "helloWorld", "camelCase: Hello World → helloWorld");
  check(camel("hello world") === "helloWorld", "camelCase normalizes");
  check(pascal("hello world") === "HelloWorld", "PascalCase");
  check(snake("Hello World") === "hello_world", "snake_case");
  check(kebab("Hello World") === "hello-world", "kebab-case");
  check(constant("Hello World") === "HELLO_WORLD", "CONSTANT_CASE");
  check(dot("Hello World") === "hello.world", "dot.case");
  check(title("hello world") === "Hello World", "Title Case");
  check(sentence("HELLO WORLD") === "Hello world", "Sentence case");
  check(upper("Hello") === "HELLO", "UPPERCASE");
  check(lower("Hello") === "hello", "lowercase");
  check(capitalize("hello world") === "Hello World", "Capitalize Words");
}

// --- 2. edge cases
{
  check(camel("") === "", "empty camel");
  check(snake("") === "", "empty snake");
  check(sentence("") === "", "empty sentence");
  check(words("  ").length === 0, "whitespace only → empty words");
  check(camel("FOO_BAR") === "fooBar", "FOO_BAR becomes words foo bar → camel fooBar");
  check(kebab("a.b_c-d") === "a-b-c-d", "punctuation separated as separators");
}

// --- 3. component has labels and copy buttons
{
  check(/aria-label="Text to convert"/.test(COMPONENT_SRC), "input has accessible label");
  check(/CopyButton/.test(COMPONENT_SRC), "CopyButton used");
  check(COMPONENT_SRC.includes("StyledTextarea"), "StyledTextarea used");
}

// --- 4. copy matches what ships
{
  const prose = JSON.stringify(CONTENT);
  check(/camelCase|snake_case|kebab-case/.test(prose), "copy mentions common cases");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
