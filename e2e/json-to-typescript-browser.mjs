// Production-Chrome e2e for "JSON to TypeScript".
//
// The promises this tool makes are all about TEXT: that a pasted object becomes
// one export interface per object, that a key missing from an array element is
// the only thing marked optional, that a JSON null stays required, that nothing
// it emits is a self-alias, and that a refusal quotes the real cap. So every
// assertion here is made against the exact characters in the output pane and in
// the downloaded .ts file, and the two are compared to each other rather than to
// a UI label.
//
// The caps are read out of src/features/json-to-typescript/json-to-typescript.ts
// at run time, so a future cap change makes this harness assert the new number
// instead of quietly passing against a stale literal. The expected declarations
// are literals below, written to be read: if one of them has to change, that is
// the point — it means the tool's behaviour changed.
//
//   node e2e/json-to-typescript-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/json-to-typescript-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/json-to-typescript`;
const TOOL_PAGE = `${BASE_URL}/tools/json-to-typescript`;
const GUIDE_PAGE = `${BASE_URL}/guides/how-to-convert-json-to-typescript-types`;
const DL = "/tmp/json-to-typescript-e2e";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(REPO, "src/features/json-to-typescript");
const CONVERT_SRC = readFileSync(join(SRC_DIR, "json-to-typescript.ts"), "utf8");
const COMPONENT_SRC = readFileSync(join(SRC_DIR, "JsonToTypeScript.tsx"), "utf8");

/** The caps, read out of the shipped module rather than guessed here. */
function capConstant(name) {
  const m = new RegExp(`export const ${name} = ([0-9_]+);`).exec(CONVERT_SRC);
  if (!m) throw new Error(`${name} is not declared in json-to-typescript.ts, so this harness cannot assert it`);
  return Number(m[1].replace(/_/g, ""));
}
const MAX_INPUT_CHARS = capConstant("MAX_INPUT_CHARS");
const MAX_JSON_DEPTH = capConstant("MAX_JSON_DEPTH");
const MAX_NODES = capConstant("MAX_NODES");
const MAX_OUTPUT_CHARS = capConstant("MAX_OUTPUT_CHARS");

const n = (value) => value.toLocaleString("en-US");
const EM_DASH = "\u2014";

/** The Load sample payload, lifted from the component so the two cannot drift. */
const SAMPLE = /const SAMPLE = `([\s\S]*?)`;/.exec(COMPONENT_SRC);
if (!SAMPLE) throw new Error("JsonToTypeScript.tsx no longer declares a SAMPLE constant");
const SAMPLE_JSON = SAMPLE[1];
const SAMPLE_CODE = [
  "export interface User {",
  "  id: number;",
  "  name: string;",
  "  isAdmin: boolean;",
  "  email: string;",
  "  roles: string[];",
  "  profile: UserProfile;",
  "  lastLogin: null;",
  "}",
  "",
  "export interface UserProfile {",
  "  age: number;",
  "  address: UserProfileAddress;",
  "}",
  "",
  "export interface UserProfileAddress {",
  "  city: string;",
  "  zip: string;",
  "}",
].join("\n");

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
// Locators, all bound to what the component actually renders and all scoped to
// the component's own root, so no assertion can be satisfied by page furniture
// or by another tool's copy.
// --------------------------------------------------------------------------
const tool = () => page.locator("div[aria-busy]").first();
const jsonInput = () => tool().locator('textarea[aria-label="JSON input"]');
const outPane = () => tool().locator('textarea[aria-label="Generated TypeScript types"]');
const rootNameInput = () => tool().getByLabel("Root type name", { exact: true });
const loadSample = () => tool().getByRole("button", { name: "Load sample" });
const clearButton = () => tool().getByRole("button", { name: "Clear", exact: true });
const copyButton = () => tool().locator('button[aria-label="Copy TypeScript"]');
const downloadButton = () => tool().locator("button", { hasText: /^Download / });
/**
 * The status word beside the TypeScript heading. It carries no role, on purpose:
 * it quotes the V8 parse message, and a live region would read the reader's own
 * payload aloud on every keystroke. The text lives in the only `break-words` span
 * inside the heading's row, so it is found there rather than by its wording.
 */
const statusWord = () =>
  tool().locator('p:text-is("TypeScript")').locator("xpath=..").locator("span.min-w-0.break-words");
/** The one polite live region in the tool: counts only, never the parse message. */
const liveRegion = () => tool().locator('[role="status"][aria-live="polite"]');
/** The counts line under the output, which names the exact text copied. */
const countsLine = () => tool().locator("p", { hasText: /fields,/ });
/** The root-name warning, shown when a typed name could not be used as written. */
const nameWarning = () => tool().locator("p.text-amber-700");

/** The component's own copy, so no assertion can match another tool in the chrome. */
const toolText = () => tool().textContent().then((t) => t || "");

async function settle(ms = 160) {
  await page.waitForTimeout(ms);
}

/** Paste `raw` and wait for the output pane to settle on something. */
async function paste(raw) {
  await jsonInput().fill(raw);
  await settle();
}

/** Wait for the output pane to hold exactly `expected`. */
async function expectOutput(expected, timeout = 20000) {
  await page.waitForFunction(
    (want) => {
      const el = document.querySelector('textarea[aria-label="Generated TypeScript types"]');
      return !!el && el.value === want;
    },
    expected,
    { timeout },
  );
  return outPane().inputValue();
}

async function shownCode() {
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

  check(page.url().includes("/use/json-to-typescript"), "the tool route renders", page.url());
  check((await jsonInput().count()) === 1, "there is exactly one JSON input");
  check((await jsonInput().inputValue()) === "", "the JSON input boots empty, with no sample pre-filled");
  check((await outPane().inputValue()) === "", "the output pane is empty before anything is pasted");
  check((await outPane().getAttribute("placeholder")) === EM_DASH, "the empty output shows an em dash, not a blank", await outPane().getAttribute("placeholder"));
  check(await clearButton().isDisabled(), "Clear is disabled while there is nothing to clear");
  check(await copyButton().isDisabled(), "Copy is disabled before anything is generated");
  check((await downloadButton().count()) === 1 && (await downloadButton().isDisabled()), "Download is present and disabled before anything is generated");
  check((await statusWord().count()) === 0, "no status word is shown for an empty box");
  check((await liveRegion().textContent()) === "", "the live region says nothing for an empty box");
  check((await tool().getAttribute("aria-busy")) === "false", "the root reports aria-busy false, because nothing is pending");
  check((await page.getByRole("button", { name: /^(Generate|Convert)$/ }).count()) === 0, "there is no button to click, because there is nothing to convert on demand");
  check(
    !/production[- ]ready|\bwith JSDoc\b|ready[- ]to[- ]use/i.test(await toolText()),
    "the panel makes no production-ready or JSDoc claim",
  );
  check((await rootNameInput().inputValue()) === "User", "the root name has a sensible default");

  section("what the panel says before anything is pasted");
  const boot = await toolText();
  check(/A first draft from one sample\./.test(boot), "the panel leads with what the output is: a first draft from one sample");
  check(/not\s+marked optional/.test(boot), "it says a key the sample does not show is not marked optional");
  check(/Every number is/.test(boot) && /UUID/.test(boot), "it says every number is number, and a date or UUID reads as string");
  check(/union of what was actually seen/.test(boot), "it says a disagreeing array becomes a union of what was actually seen");
  check(/starting point to edit, not a schema you can rely on unchecked/.test(boot), "it says plainly that this is a draft to edit");
  check(/One sample only/.test(boot), "the hint under the input repeats the one-sample limit");
  check(boot.includes(`${n(MAX_JSON_DEPTH)} nesting levels`), "the hint quotes the depth cap from the module's own constant", boot.slice(0, 200));
  check(boot.includes(`${n(MAX_NODES)} values`), "the hint quotes the value cap");
  check(boot.includes(`${n(MAX_OUTPUT_CHARS)} characters of generated code`), "the hint quotes the output cap");
  check(/refused with their real numbers/.test(boot), "the hint says each cap is refused with its real numbers");

  section("accessibility, before anything is pasted");
  check((await rootNameInput().count()) === 1, "the root-name input is reachable by its visible label");
  check((await rootNameInput().getAttribute("id")) !== null, "and that label points at a real element");
  const describedBy = await jsonInput().getAttribute("aria-describedby");
  check(!!describedBy && (await page.locator(`#${describedBy}`).count()) === 1, "the JSON input is described by a hint element that exists", String(describedBy));
  check((await jsonInput().getAttribute("aria-invalid")) === "false", "the JSON input is not marked invalid while the box is empty");
  check((await outPane().getAttribute("readonly")) !== null, "the generated pane is read-only, so it cannot be typed into");
  check((await outPane().getAttribute("tabindex")) === "-1", "and it is out of the tab order, since it is output rather than input");
  check((await jsonInput().getAttribute("spellcheck")) === "false", "the input does not invite spellcheck on data");
  // Scoped to the tool, like every other locator in this file. An unscoped
  // page-level count found Next.js's route announcer, which lives in a shadow
  // root and always carries role="alert"; this assertion is about the tool's
  // own markup, so page furniture must not be able to decide it.
  check((await tool().locator('[role="alert"]').count()) === 0, "there is no role=alert inside the tool, so a parse message is never spoken over the reader");

  // ================================================================ generate ===
  section("Load sample: the exact declarations");
  await loadSample().click();
  await expectOutput(SAMPLE_CODE);
  check((await jsonInput().inputValue()) === SAMPLE_JSON, "Load sample puts the sample in the box, and it is not a trimmed variant");
  const counts = (await countsLine().textContent()) || "";
  check(/3 interfaces/.test(counts), "the panel reports three interfaces for the sample", counts);
  check(/11 fields/.test(counts), "the panel reports eleven fields for the sample", counts);
  check(counts.includes(`${n(SAMPLE_CODE.length)} characters`), "the character count is the exact text Copy and Download hand over", counts);
  check((await statusWord().textContent()) === "Generated", "the status word is Generated", await statusWord().textContent());
  check((await liveRegion().textContent()) === "Generated 3 interfaces and 11 fields.", "the live region announces counts only", await liveRegion().textContent());
  check(!(await liveRegion().textContent()).includes("Alex"), "and never quotes the reader's own payload");
  check((await loadSample().isDisabled()), "Load sample is disabled once that exact sample is loaded");
  check(!(await copyButton().isDisabled()), "Copy is enabled once something is generated");
  check(!(await downloadButton().isDisabled()), "Download is enabled once something is generated");
  const shown = await shownCode();
  check(!/export type User = User;/.test(shown), "the old self-alias is nowhere in the output — it was TS2300 and did not compile");
  check(!/\bany\b/.test(shown), "no bare any anywhere in the output");
  check(/\n  lastLogin: null;/.test(shown), "a JSON null is a required null, never an optional marker");
  check(!/lastLogin\?/.test(shown), "and it is not made optional");
  check(/roles: string\[\];/.test(shown), "a homogeneous array is an array type, not a generic");
  check(/profile: UserProfile;/.test(shown) && /export interface UserProfile \{/.test(shown), "a nested object is its own named interface, not an inline type");
  check(/address: UserProfileAddress;/.test(shown), "and the name is the path that reached it");
  check(!/: \{/.test(shown), "no member type is an inline object literal");
  check((shown.match(/^export /gm) || []).length === 3, "exactly three declarations are emitted for the sample");

  section("copy");
  await copyButton().click();
  await settle(250);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip === shown, "the clipboard holds the exact text on screen", `${clip.slice(0, 80)} vs ${shown.slice(0, 80)}`);
  check(clip === SAMPLE_CODE, "and that text is the declarations asserted above");

  section("download");
  const file = await download("sample.ts");
  check(file.name === "User.ts", "the download is named for the root type", file.name);
  check(file.text === shown, "the downloaded file is the exact text on screen");
  check(file.text === SAMPLE_CODE, "and it is the same declarations the pane shows");

  // ================================================================ renaming ===
  section("renaming re-emits without touching the document");
  await rootNameInput().fill("Order");
  await expectOutput(SAMPLE_CODE.split("User").join("Order"));
  check((await jsonInput().inputValue()) === SAMPLE_JSON, "the pasted JSON is untouched by a rename");
  check((await shownCode()).startsWith("export interface Order {"), "the root declaration takes the new name", (await shownCode()).split("\n")[0]);
  check((await downloadButton().textContent())?.includes("Download Order.ts"), "the download button is named for the new root too", await downloadButton().textContent());
  const renamed = await download("renamed.ts");
  check(renamed.name === "Order.ts", "the downloaded file is named for the new root", renamed.name);
  check(renamed.text === (await shownCode()), "and is still the exact text on screen");

  section("a reserved root name is refused out loud");
  await rootNameInput().fill("class");
  await expectOutput(SAMPLE_CODE.split("User").join("Root"));
  const warning = (await nameWarning().textContent()) || "";
  check(/TypeScript keyword/.test(warning), "the substitution is stated, not silent", warning);
  check(warning.includes("Root"), "and it names the name it used");
  check(/\bclass\b/.test(warning), "and the keyword it collided with");
  check((await statusWord().textContent()) === "Generated", "the output is still honestly reported as Generated, because Root does resolve");
  check((await countsLine().textContent())?.includes("3 interfaces"), "renaming does not change the interface count");

  section("a built-in that an interface would shadow is refused too");
  await rootNameInput().fill("Record");
  await settle(200);
  const builtinWarning = (await nameWarning().textContent()) || "";
  check(/built-in TypeScript type name/.test(builtinWarning), "typing Record is refused with the reason", builtinWarning);
  check(/export interface Root \{/.test(await shownCode()), "and the output is called Root");

  await rootNameInput().fill("User");
  await expectOutput(SAMPLE_CODE);

  // ================================================== the inference decisions ===
  section("array elements merge; a missing key is the only optional");
  await paste('[{"a":1},{"a":2}]');
  await expectOutput("export type User = UserItem[];\n\nexport interface UserItem {\n  a: number;\n}");
  check(true, "identical elements produce no optional marker");
  await paste('[{"a":1},{"b":2}]');
  await expectOutput("export type User = UserItem[];\n\nexport interface UserItem {\n  a?: number;\n  b?: number;\n}");
  check(true, "a key missing from one element is the only thing marked optional");
  await paste('[{"a":1},{"a":"x"}]');
  await expectOutput("export type User = UserItem[];\n\nexport interface UserItem {\n  a: number | string;\n}");
  check(true, "a key whose shapes disagree becomes a union of what was actually seen, never any");
  await paste('[{"a":{"x":1}},{"a":1}]');
  await settle(200);
  check(/export interface UserItemAVariant \{/.test(await shownCode()), "the object half of a mixed union keeps a real interface", await shownCode());
  check(/a: UserItemAVariant \| number;/.test(await shownCode()), "and the union names it rather than inlining it");

  section("empty object, empty array, scalar root");
  await paste("{}");
  await expectOutput("export type User = Record<string, never>;");
  check(true, "an empty object is Record<string, never>, not a member-less interface");
  await paste("[]");
  await expectOutput("export type User = unknown[];");
  check(true, "an empty array is unknown[], not any[]");
  await paste('{"a":1}');
  await expectOutput("export interface User {\n  a: number;\n}");
  await paste("null");
  await expectOutput("export type User = null;");
  check(true, "a bare null is the null type, not any");

  section("keys that are not legal identifiers");
  await paste('{"a b":1,"a-b":2}');
  await expectOutput('export interface User {\n  "a_b": number;\n  "a_b_2": number;\n}');
  check(true, "two keys that sanitize alike are separated deterministically, not merged");
  await paste('{"1x":1,"constructor":2}');
  await settle(200);
  const odd = await shownCode();
  check(/"_1x": number;/.test(odd), "a key starting with a digit gains an underscore", odd);
  check(/constructor: number;/.test(odd), "constructor is a legal member name and is left alone", odd);

  // ============================================================= the failures ===
  section("invalid JSON is reported with a position, not a crash");
  await paste('{"a":1,');
  await settle(250);
  const bad = (await statusWord().textContent()) || "";
  check(bad.includes("Could not be parsed"), "the status word says it could not be parsed", bad);
  check(/line 1, column 8/.test(bad), "the position V8 reported is shown on screen", bad);
  check(!/at position/.test(bad), "and the raw position clause is not duplicated into the message", bad);
  check((await shownCode()) === "", "no output is shown for input that did not convert");
  check((await jsonInput().getAttribute("aria-invalid")) === "true", "the JSON input is marked invalid, so a screen reader hears it from the field");
  check(await copyButton().isDisabled(), "Copy stays disabled");
  check(await downloadButton().isDisabled(), "Download stays disabled");
  check((await liveRegion().textContent()) === "That JSON could not be parsed.", "the live region says the parse failed, without quoting the payload", await liveRegion().textContent());

  section("a position on a later line is that line");
  await paste('{\n  "a": 1,\n  "b" 1\n}');
  await settle(250);
  const multiline = (await statusWord().textContent()) || "";
  check(/line 3/.test(multiline), "the reported line is the line the parser stopped on", multiline);

  section("recovery");
  await paste('{"ok":true}');
  await expectOutput("export interface User {\n  ok: boolean;\n}");
  check((await statusWord().textContent()) === "Generated", "fixing the input restores a Generated status");
  check((await jsonInput().getAttribute("aria-invalid")) === "false", "and clears the invalid marking");

  section(`the ${n(MAX_INPUT_CHARS)}-character cap`);
  await paste(`{"a":"${"x".repeat(MAX_INPUT_CHARS - 8)}"}`);
  await settle(400);
  check((await statusWord().textContent())?.includes("Generated"), "a document exactly at the cap still converts", await statusWord().textContent());
  await paste(`{"a":"${"x".repeat(MAX_INPUT_CHARS - 7)}"}`);
  await settle(400);
  const tooLarge = (await statusWord().textContent()) || "";
  check(tooLarge.includes("Not converted"), "one character over the cap is refused, not truncated", tooLarge);
  check(tooLarge.includes(`${n(MAX_INPUT_CHARS + 1)} characters`), "the refusal quotes the length it found", tooLarge);
  check(tooLarge.includes(`the cap is ${n(MAX_INPUT_CHARS)}`), "and quotes the real cap", tooLarge);
  check(/nothing was converted/.test(tooLarge), "and says nothing was converted", tooLarge);
  check((await shownCode()) === "", "no output is emitted past the cap");
  check((await jsonInput().getAttribute("aria-invalid")) === "true", "a refusal marks the field invalid too, because the box holds something this page will not convert");
  check((await liveRegion().textContent()) === "Nothing was converted.", "the live region reports the refusal without quoting the message", await liveRegion().textContent());

  section(`the ${MAX_JSON_DEPTH}-level nesting cap`);
  await paste(`${"[".repeat(MAX_JSON_DEPTH + 1)}${"]".repeat(MAX_JSON_DEPTH + 1)}`);
  await settle(400);
  const tooDeep = (await statusWord().textContent()) || "";
  check(tooDeep.includes("Not converted"), "nesting one level over the cap is refused", tooDeep);
  check(tooDeep.includes(`deeper than ${MAX_JSON_DEPTH} levels`), "the refusal quotes the real depth cap", tooDeep);
  check(/nothing was converted/.test(tooDeep), "and says nothing was converted", tooDeep);

  section("Clear");
  await paste('{"a":1}');
  await expectOutput("export interface User {\n  a: number;\n}");
  await clearButton().click();
  await settle(250);
  check((await jsonInput().inputValue()) === "", "Clear empties the box");
  check((await shownCode()) === "", "and empties the output");
  check((await statusWord().count()) === 0, "and removes the status word");
  check(await clearButton().isDisabled(), "and disables itself again");
  check(await copyButton().isDisabled(), "and disables Copy");
  check(!(await liveRegion().textContent()), "and silences the live region");

  // ============================================================ copy/download ===
  section("copy and download agree with each other on a different document");
  await paste('{"id":1,"tags":["a"],"meta":{"ok":true}}');
  await expectOutput(
    "export interface User {\n  id: number;\n  tags: string[];\n  meta: UserMeta;\n}\n\nexport interface UserMeta {\n  ok: boolean;\n}",
  );
  const second = await download("second.ts");
  check(second.name === "User.ts", "the download is named for the root type");
  check(second.text === (await shownCode()), "the downloaded bytes are the pane's text");
  await copyButton().click();
  await settle(250);
  check((await page.evaluate(() => navigator.clipboard.readText())) === second.text, "the clipboard and the download hold the same text");

  // ============================================================== the prose ====
  section("the tool page");
  const toolPage = await context.newPage();
  const toolResp = await toolPage.goto(TOOL_PAGE, { waitUntil: "domcontentloaded" });
  const toolBody = toolResp && toolResp.ok() ? await toolPage.textContent("body") : "";
  check(!!toolResp && toolResp.status() === 200, "the tool page renders");
  check(/export type User = User;/.test(toolBody), "the tool page names the compile error the old version emitted, which is TS2300");
  check(/TS2300/.test(toolBody), "and gives its code");
  check(/Nothing is uploaded/.test(toolBody), "the tool page states the privacy position");
  check(toolBody.includes(`${n(MAX_INPUT_CHARS)} characters of pasted text`), "the tool page quotes the real text cap");
  check(toolBody.includes(`${n(MAX_JSON_DEPTH)} nesting levels`), "the tool page quotes the real depth cap");
  check(toolBody.includes(`${n(MAX_NODES)} values in the document`), "the tool page quotes the real value cap");
  check(toolBody.includes(`${n(MAX_OUTPUT_CHARS)} characters of generated code`), "the tool page quotes the real output cap");
  check(/Paste one JSON sample/.test(toolBody), "the how-to steps render, including pasting a sample");
  check(/optional markers mean a key was missing/.test(toolBody), "a step explains what an optional marker means");
  check(/Are these the right types for my API\?/.test(toolBody), "the are-these-right FAQ is on the page");
  check(/Why is a null field required rather than optional\?/.test(toolBody), "the null FAQ is on the page");
  check(/Why is there no comment above each field\?/.test(toolBody), "the missing-comment FAQ is on the page rather than left implied");
  check(/Why did my root type get called Root\?/.test(toolBody), "the Root substitution is on the page");
  check(/Is there a size limit\?/.test(toolBody), "the size-limit FAQ is on the page");
  check(/Can it output type aliases, enums or generics\?/.test(toolBody), "the removed options are disclosed by a question of their own");
  await toolPage.close();

  section("the guide");
  const guide = await context.newPage();
  const guideResp = await guide.goto(GUIDE_PAGE, { waitUntil: "domcontentloaded" });
  const guideBody = guideResp && guideResp.ok() ? await guide.textContent("body") : "";
  check(!!guideResp && guideResp.status() === 200, "the guide renders");
  check(/first draft/.test(guideBody), "the guide says the output is a first draft");
  check(guideBody.includes(`${n(MAX_INPUT_CHARS)} characters of pasted text`), "the guide quotes the real text cap");
  check(guideBody.includes(`${n(MAX_JSON_DEPTH)} nesting levels`), "the guide quotes the real depth cap");
  check(guideBody.includes(`${n(MAX_NODES)} values in the document`), "the guide quotes the real value cap");
  check(guideBody.includes(`${n(MAX_OUTPUT_CHARS)} characters of generated code`), "the guide quotes the real output cap");
  check(/the only thing that becomes optional/.test(guideBody), "the guide explains the optional rule");
  check(/JSON null is a value rather than a hole/.test(guideBody), "the guide explains the null rule");
  check(/Record<string, never>/.test(guideBody) && /unknown\[\]/.test(guideBody), "the guide explains the empty-object and empty-array rules");
  check(/no JSDoc, because a comment guessed from one value/.test(guideBody), "the guide says why there is no JSDoc");
  check(/no enums, no generics, no converters, and no type-alias mode/.test(guideBody), "the guide lists what is not produced");
  check(/nothing is uploaded/.test(guideBody), "the guide states the privacy position");
  await guide.close();

  const sitemapResponse = await page.request.get(`${BASE_URL}/sitemap.xml`);
  const sitemap = sitemapResponse.ok() ? await sitemapResponse.text() : "";
  check(sitemap.includes("/tools/json-to-typescript"), "the sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-convert-json-to-typescript-types"), "the sitemap lists the guide");

  // ================================================================ 375px ======
  section("a 375px viewport");
  await loadSample().click();
  await expectOutput(SAMPLE_CODE);
  await page.setViewportSize({ width: 375, height: 720 });
  await settle(400);
  const overflow = await page.evaluate(() => {
    const m = document.querySelector("main#main");
    return m ? m.scrollWidth - m.clientWidth : document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  check(overflow <= 1, "the tool fits a 375px viewport without horizontal overflow", String(overflow));
  check((await outPane().count()) === 1, "and the output pane is still there at that width");
  check(!(await outPane().inputValue()).includes("\n\n\n"), "and the declarations survive the resize");
  await page.setViewportSize({ width: 1280, height: 900 });
  await settle();

  // =============================================================== hygiene =====
  section("hygiene");
  check(offOrigin.length === 0, "no off-origin request: the JSON never leaves the device", offOrigin.slice(0, 3).join(" "));
  check(nonGet.length === 0, "the tool made no non-GET request", nonGet.slice(0, 3).join(" "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 2).join(" | "));
  check(consoleIssues.length === 0, "no hydration or server/client mismatch warnings", consoleIssues.slice(0, 2).join(" | "));
  check(!allUrls.some((u) => u.includes("alex@example.com")), "no request URL carries any of the sample data");
  check(!allUrls.some((u) => u.includes("Mumbai")), "no request URL carries any of the sample's values");
  check(!allUrls.some((u) => u.length > 2000), "no request URL is long enough to be carrying a document", allUrls.filter((u) => u.length > 2000).slice(0, 2).join(" "));
} catch (e) {
  check(false, `harness exception: ${String(e).slice(0, 500)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) console.log(`failing: ${failures.join(" | ")}`);
process.exit(failed === 0 ? 0 : 1);
