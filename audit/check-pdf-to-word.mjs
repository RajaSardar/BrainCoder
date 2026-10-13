/**
 * Node mirror audit for PDF to Word. No browser, no DOM.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SRC_COMPONENT = "src/features/pdf-to-word/PdfToWord.tsx";
const SRC_SUPPORT = "src/features/pdf-office/support.ts";
const OUT = "audit/.pdf-to-word-mirror";

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
  const out = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: `${name}.ts`,
  }).outputText;
  writeFileSync(`${OUT}/${name}.cjs`, out);
  return require(`${process.cwd()}/${OUT}/${name}.cjs`);
}

transpile("src/lib/tool-content.ts", "repo-content");
const COMPONENT_SRC = readFileSync(SRC_COMPONENT, "utf8");
const SUPPORT_SRC = readFileSync(SRC_SUPPORT, "utf8");
const contentModule = require(`${process.cwd()}/${OUT}/repo-content.cjs`);
const CONTENT = contentModule.TOOL_CONTENT["pdf-to-word"];

// --- 1. buildDocx structure
{
  check(/OPC package|zipSync|\[Content_Types\]\.xml/.test(SUPPORT_SRC), "builds an OPC package");
  check(/word\/document\.xml/.test(SUPPORT_SRC), "includes word/document.xml");
  check(/image\/png/.test(SUPPORT_SRC), "references PNG images");
}

// --- 2. component behavior
{
  check(/role="status"/.test(COMPONENT_SRC), "has role=status live regions");
  check(/role="alert"/.test(COMPONENT_SRC), "has role=alert for errors");
  check(/accept="application\/pdf"/.test(COMPONENT_SRC), "accepts pdf files");
  check(/Quality scale/.test(COMPONENT_SRC) || /scale/i.test(COMPONENT_SRC), "scale exposed");
}

// --- 3. copy honesty
{
  const prose = JSON.stringify(CONTENT);
  check(/docx|Word/.test(prose), "copy mentions .docx/Word");
  check(/client-side|browser/.test(prose), "copy mentions client-side");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
