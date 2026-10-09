/**
 * Node mirror audit for the chmod Calculator. No browser, no DOM.
 *
 * The shipped pure module (`src/features/chmod-calculator/permissions.ts`) is
 * transpiled with the repo's own TypeScript compiler and required, so every check
 * runs the code the tab runs.
 *
 * The findings that mattered: the old symbolic string used the first letter of each
 * permission id, so execute rendered as "e" and 755 became "rwer-wer-we"; the old
 * chmod-style output joined the id strings, producing "u=readwriteexecute,..."; and
 * Reset reloaded 644 while the tool boots at 755. Section 1 and 2 assert the x, the
 * symbol joins and the 755 reset. Section 5 asserts the copy no longer claims
 * setuid/setgid/sticky support or a full command.
 *
 *   node audit/check-chmod-calculator.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SRC = "src/features/chmod-calculator";
const OUT = "audit/.chmod-mirror";

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

const M = transpile(`${SRC}/permissions.ts`, "permissions");
const REPO_CONTENT = transpile("src/lib/tool-content.ts", "repo-content");
const COMPONENT_SRC = readFileSync(`${SRC}/ChmodCalculator.tsx`, "utf8");
const CONTENT = REPO_CONTENT.TOOL_CONTENT["chmod-calculator"];

const trio = (u, g, o) => ({ user: u, group: g, other: o });
const R = ["read"];
const W = ["write"];
const X = ["execute"];
const RW = ["read", "write"];
const RX = ["read", "execute"];
const RWX = ["read", "write", "execute"];

// --- 1. symbolic uses x for execute -------------------------------------------
{
  check(M.PERM_LETTER.execute === "x", "execute maps to the letter x", M.PERM_LETTER.execute);
  check(M.PERM_LETTER.read === "r" && M.PERM_LETTER.write === "w", "read and write map to r and w");
  check(M.toSymbolic(trio(RWX, RX, RX)) === "rwxr-xr-x", "755 is rwxr-xr-x", M.toSymbolic(trio(RWX, RX, RX)));
  check(M.toSymbolic(trio([], [], X)) === "--------x", "execute-only on other is --------x", M.toSymbolic(trio([], [], X)));
  check(!/e/.test(M.toSymbolic(trio([], [], X))), "execute never renders as the letter e");
}

// --- 2. chmod style joins symbols, not readwriteexecute ------------------------
{
  check(M.toChmodStyle(trio(RWX, RX, RX)) === "u=rwx,g=rx,o=rx", "755 chmod style is u=rwx,g=rx,o=rx", M.toChmodStyle(trio(RWX, RX, RX)));
  check(!/read|write|execute/.test(M.toChmodStyle(trio(RWX, RX, RX))), "chmod style contains no id words");
  check(M.toChmodStyle(trio([], [], [])) === "u=-,g=-,o=-", "an empty category is written u=-", M.toChmodStyle(trio([], [], [])));
  check(M.toChmodStyle(trio(RW, W, R)) === "u=rw,g=w,o=r", "partial categories join their symbols", M.toChmodStyle(trio(RW, W, R)));
  check(M.toChmodStyle(trio([], [], X)) === "u=-,g=-,o=x", "execute-only chmod style is o=x", M.toChmodStyle(trio([], [], X)));
}

// --- 3. octal digits -----------------------------------------------------------
{
  check(M.octalDigit(RWX) === 7, "rwx is 7", String(M.octalDigit(RWX)));
  check(M.octalDigit(RX) === 5, "r-x is 5", String(M.octalDigit(RX)));
  check(M.octalDigit([]) === 0, "no bits is 0", String(M.octalDigit([])));
  check(M.toOctal(trio(RWX, RX, RX)) === "755", "755 computes to 755", M.toOctal(trio(RWX, RX, RX)));
  const back = M.permsFromDigit(7);
  check(back.includes("read") && back.includes("write") && back.includes("execute"), "7 expands to rwx");
  check(M.toOctal({ user: M.permsFromDigit(4), group: M.permsFromDigit(4), other: M.permsFromDigit(4) }) === "444", "444 round-trips");
}

// --- 4. the octal draft classifier --------------------------------------------
{
  check(M.classifyOctalDraft("").state === "empty", "an empty draft is empty", M.classifyOctalDraft("").state);
  check(M.classifyOctalDraft("64").state === "incomplete", "two digits are incomplete", M.classifyOctalDraft("64").state);
  check(M.classifyOctalDraft("7").state === "incomplete", "one digit is incomplete", M.classifyOctalDraft("7").state);
  check(M.classifyOctalDraft("648").state === "invalid", "648 is invalid octal", M.classifyOctalDraft("648").state);
  check(M.classifyOctalDraft("7555").state === "invalid", "four digits are invalid", M.classifyOctalDraft("7555").state);
  const ok = M.classifyOctalDraft("755");
  check(ok.state === "ok", "755 is accepted", ok.state);
  check(ok.state === "ok" && M.toOctal(ok.trio) === "755", "755 classifies to the right trio");
  const none = M.classifyOctalDraft("000");
  check(none.state === "ok" && M.toOctal(none.trio) === "000", "000 sets no permissions");
}

// --- 5. the reset returns to the boot state -----------------------------------
{
  check(M.DEFAULT_TRIO && M.toOctal(M.DEFAULT_TRIO) === "755", "the default trio is 755", M.DEFAULT_TRIO && M.toOctal(M.DEFAULT_TRIO));
  check(/applyPreset\("755"\)/.test(COMPONENT_SRC), "Reset calls applyPreset(755)");
  check(!/numberInput/.test(COMPONENT_SRC), "the old numberInput handler is gone");
  check(!/p\.id\[0\]/.test(COMPONENT_SRC), "the symbolic string no longer uses the first id letter (the e bug)");
  check(/toSymbolic\(/.test(COMPONENT_SRC) && /toChmodStyle\(/.test(COMPONENT_SRC), "the component derives symbolic and chmod style from the module");
}

// --- 6. the copy matches the code ---------------------------------------------
{
const prose = JSON.stringify(CONTENT);
  for (const [label, re] of [
    ["setuid/setgid/sticky support", /setuid, setgid, and sticky bit support|handles special modes like setuid/i],
    ["warnings for dangerous combinations", /warns? you|contextual warnings|dangerous combinations/i],
    ["recommended permissions for scenarios", /recommended permissions for common|web roots, SSH keys/i],
    ["a full named chmod command", /chmod 755 script\.sh|generate[sd]? the chmod command with your selected/i],
    ["recursive command support", /add -R for recursive/i],
  ]) {
    check(!re.test(prose), `the copy no longer claims ${label}`, prose.match(re)?.[0]);
  }
  check(/rwxr-xr-x/.test(prose) && /755/.test(prose), "the copy uses the real symbolic and octal examples");
  check(/u=rwx,g=rx,o=rx/.test(prose), "the copy shows the real chmod-style output");
  check(/Does it handle setuid, setgid or the sticky bit\?/.test(prose), "the copy answers the special-bits question honestly", "");
  check(/No\./.test(CONTENT.faq.find((f) => /setuid/i.test(f.question))?.answer || "") || /outside this tool'?s scope/.test(CONTENT.faq.find((f) => /setuid/i.test(f.question))?.answer || ""), "the special-bits answer is a refusal, not a claim");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
