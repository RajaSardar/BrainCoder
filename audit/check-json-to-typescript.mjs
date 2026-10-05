/**
 * Node mirror audit for the JSON to TypeScript converter. No browser, no DOM.
 *
 * The two shipped pure modules are transpiled with the repo's own TypeScript
 * compiler and imported, so every behavioural check below runs the code the tab
 * runs rather than a hand-written copy of its rules: the one-traversal shape
 * inference, the structural equality used for every duplicate check, the caps,
 * the error classification and the emitter are all the real functions.
 *
 * Section 10 is the one that matters most. The previous version of this tool
 * shipped `export type User = User;` under a green "Generated" badge, which is
 * TS2300 and does not compile, so every generated document in a generated sweep
 * is handed to the real TypeScript compiler here, in one in-memory program built
 * with this repo's own tsconfig options. A claim about output that nobody
 * compiles is a claim, not a fact.
 *
 * Section 12 is the one that matters most for the copy. A converter that
 * overstates what it did is the defect that matters most here, so the claims are
 * asserted against the shipped data — the registry entry, the long description,
 * the features, the FAQs, the SEO entry and the guide — rather than read and
 * approved. A claim about what the code *does* is asserted against the source
 * with its comments stripped, because these modules document at length which
 * constructs they no longer use, and a ban measured against that commentary
 * would ban the explanation.
 *
 *   node audit/check-json-to-typescript.mjs
 */
import ts from "typescript";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = "src/features/json-to-typescript";
const OUT = "audit/.json-to-typescript-mirror";
const MODULES = ["json-infer", "json-to-typescript"];

let pass = 0;
let fail = 0;

/**
 * The condition comes first and the name second, so a check reads left to right
 * as the claim it is making: `check(conv(...).kind === "generated", "a plain
 * object generates")`. A truthy name is never enough to pass — only the condition
 * can pass or fail a check.
 */
function check(cond, name, extra = "") {
  if (cond === true) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const n = (value) => value.toLocaleString("en-US");

/**
 * The shipped modules and the component explain, at length, which constructs they
 * no longer use — and they have to, because a reader who has seen the old version
 * deserves to know what changed. Those explanations name `JSON.stringify`, `new
 * Set`, `document.write` and a bare `.map(infer)` in prose.
 *
 * So a claim about what the code *does* is asserted against `codeOf` (comments
 * removed) and a claim about what it *says* against `proseOf` (comments removed,
 * whitespace collapsed, so a sentence wrapped over three lines is still one
 * sentence). Testing the raw source for a banned token measures the commentary.
 */
const codeOf = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
/**
 * For a claim that is made IN a comment — these modules document the defects they
 * close at length, and part of the audit is that the documentation still matches
 * the code. The `*` gutter is removed so a sentence wrapped across three lines
 * reads as the one sentence it is.
 */
const wrapped = (source) => source.replace(/\n[ \t]*\*/g, "\n").replace(/\s+/g, " ");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const name of MODULES) {
  const source = readFileSync(`${SRC}/${name}.ts`, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
  }).outputText.replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(`${OUT}/${name}.mjs`, js);
}
const A = await import(pathToFileURL(`${OUT}/json-to-typescript.mjs`).href);
const I = await import(pathToFileURL(`${OUT}/json-infer.mjs`).href);

const {
  MAX_INPUT_CHARS,
  MAX_JSON_DEPTH,
  MAX_NODES,
  MAX_OUTPUT_CHARS,
  emitTypeScript,
  jsonToTypeScript,
  parseJsonShape,
  typeNameFor,
} = A;
const { inferJsonShape, mergeElementShapes, sameShape } = I;

const COMPONENT = readFileSync(`${SRC}/JsonToTypeScript.tsx`, "utf8");
const INFER_SRC = readFileSync(`${SRC}/json-infer.ts`, "utf8");
const CONVERT_SRC = readFileSync(`${SRC}/json-to-typescript.ts`, "utf8");
const TOOLS_SRC = readFileSync("src/lib/tools.ts", "utf8");
const SEO_SRC = readFileSync("src/lib/seo.ts", "utf8");

const COMPONENT_CODE = codeOf(COMPONENT);
const INFER_CODE = codeOf(INFER_SRC);
const CONVERT_CODE = codeOf(CONVERT_SRC);

// The site's own content tables, transpiled the same way, so "the copy says what
// the code does" is a comparison against the shipped data and not a regex guess.
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
const CONTENT = REPO_CONTENT.TOOL_CONTENT["json-to-typescript"];
const GUIDE = REPO_GUIDES.GUIDES.find((g) => g.toolSlug === "json-to-typescript");
const GUIDE_TEXT = JSON.stringify(GUIDE);
const CONTENT_TEXT = JSON.stringify(CONTENT);

/** A convenience wrapper with the shipped defaults. */
const gen = (raw, rootName = "User") => jsonToTypeScript(raw, rootName);

/** The names every output declares, in the order they are declared. */
function declaredNames(code) {
  return [...code.matchAll(/^(?:export interface|export type) ([A-Za-z_$][A-Za-z0-9_$]*)/gm)].map(
    (m) => m[1],
  );
}

const LIMITS = { maxDepth: MAX_JSON_DEPTH, maxNodes: MAX_NODES };

// ---------------------------------------------------------------------------
// 1. the public contract
// ---------------------------------------------------------------------------
{
  check(typeof jsonToTypeScript === "function", "jsonToTypeScript is exported");
  check(typeof parseJsonShape === "function", "parseJsonShape is exported");
  check(typeof emitTypeScript === "function", "emitTypeScript is exported");
  check(typeof typeNameFor === "function", "typeNameFor is exported");
  check(typeof inferJsonShape === "function", "inferJsonShape is exported");
  check(typeof sameShape === "function", "sameShape is exported");
  check(typeof mergeElementShapes === "function", "mergeElementShapes is exported");

  check(MAX_INPUT_CHARS === 200000, "the pasted-text cap is 200,000 characters", String(MAX_INPUT_CHARS));
  check(MAX_JSON_DEPTH === 64, "the nesting cap is 64 levels", String(MAX_JSON_DEPTH));
  check(MAX_NODES === 200000, "the value cap is 200,000", String(MAX_NODES));
  check(MAX_OUTPUT_CHARS === 400000, "the emitted-code cap is 400,000 characters", String(MAX_OUTPUT_CHARS));

  check(gen("").kind === "empty", "an empty input is the empty state, not a refusal");
  check(gen("   \n\t ").kind === "empty", "whitespace alone is the empty state");
  check(gen("{}").kind === "generated", "an empty object still generates a type");
  check(gen("null").kind === "generated", "a bare null generates a type");
  check(gen("0").kind === "generated", "a bare zero generates a type");
  check(gen('"x"').kind === "generated", "a bare string generates a type");

  const split = parseJsonShape('{"a":1}');
  check(split.kind === "parsed" && split.shape.kind === "object", "parseJsonShape returns a shape, not code");
  const emitted = emitTypeScript(split.shape, "User");
  check(emitted.kind === "generated" && emitted.code === gen('{"a":1}').code, "parse then emit is the whole conversion");
  check(
    emitTypeScript(parseJsonShape("[1,2]").shape, "User").code === gen("[1,2]").code,
    "the split entry points agree with the combined one",
  );
}

// ---------------------------------------------------------------------------
// 2. the root object: one interface, and never an alias of itself
// ---------------------------------------------------------------------------
{
  const r = gen('{"id":1,"name":"a"}');
  check(
    r.code === "export interface User {\n  id: number;\n  name: string;\n}",
    "a flat object becomes exactly one export interface",
    JSON.stringify(r.code),
  );
  check(r.interfaceCount === 1, "one interface is reported", String(r.interfaceCount));
  check(r.fieldCount === 2, "two fields are reported", String(r.fieldCount));
  check(r.problem === null, "the self-check finds nothing to report");
  check(!/export type User = User;/.test(r.code), "no self-alias is emitted, which was TS2300");
  check(!/^export type User = User;$/m.test(r.code), "no self-alias at the start of a line either");
  check(declaredNames(r.code).length === 1, "exactly one name is declared", declaredNames(r.code).join("|"));
  check(gen('{"id":1,"name":"a"}').code === r.code, "the same input emits byte-identical code");
  check(
    gen('{"name":"a","id":1}').code === "export interface User {\n  name: string;\n  id: number;\n}",
    "members keep the key order of the document",
  );
  check(
    gen('{"a":{"b":1}}').code ===
      "export interface User {\n  a: UserA;\n}\n\nexport interface UserA {\n  b: number;\n}",
    "a nested object becomes its own interface, not an inline type",
    JSON.stringify(gen('{"a":{"b":1}}').code),
  );
  check(gen('{"a":{"b":{"c":1}}}').interfaceCount === 3, "each level of nesting is counted", String(gen('{"a":{"b":{"c":1}}}').interfaceCount));
  check(
    declaredNames(gen('{"a":{"b":{"c":1}}}').code).join("|") === "User|UserA|UserAB",
    "nested names are the PascalCase path to the object",
    declaredNames(gen('{"a":{"b":{"c":1}}}').code).join("|"),
  );
  check(
    declaredNames(gen('{"profile":{"address":{"city":"x"}}}').code).join("|") === "User|UserProfile|UserProfileAddress",
    "a multi-word path reads as words, not as Profileaddress",
    declaredNames(gen('{"profile":{"address":{"city":"x"}}}').code).join("|"),
  );
  const deep = gen('{"a":{"b":1}}');
  check(!/: \{/.test(deep.code), "no member type is an inline object literal", deep.code);
  check(
    gen('{"a":{"b":1}}', "OrderItem").code.includes("export interface OrderItemA {"),
    "a multi-word root name prefixes the nested names",
    gen('{"a":{"b":1}}', "OrderItem").code,
  );
}

// ---------------------------------------------------------------------------
// 3. arrays, unions and null
// ---------------------------------------------------------------------------
{
  const rows = gen('[{"a":1}]');
  check(
    rows.code === "export type User = UserItem[];\n\nexport interface UserItem {\n  a: number;\n}",
    "an array of objects is a named element type, not a generic",
    JSON.stringify(rows.code),
  );
  check(rows.interfaceCount === 1 && rows.fieldCount === 1, "the element interface and its field are counted");
  check(gen('["a"]').code === "export type User = string[];", "a homogeneous string array is string[]", gen('["a"]').code);
  check(gen("[1,2]").code === "export type User = number[];", "a number array is number[]");
  check(gen("[true,false]").code === "export type User = boolean[];", "a boolean array is boolean[]");
  check(gen("[1,null]").code === "export type User = (number | null)[];", "a union inside an array is parenthesized", gen("[1,null]").code);
  check(gen('["a",1]').code === "export type User = (string | number)[];", "mixed scalars become a union, never any", gen('["a",1]').code);
  check(gen("[]").code === "export type User = unknown[];", "an empty array is unknown[], not any[]", gen("[]").code);
  check(gen("[{},[]]").code === "export type User = (Record<string, never> | unknown[])[];", "an empty object and an empty array can share one union", gen("[{},[]]").code);
  check(gen("{}").code === "export type User = Record<string, never>;", "an empty object is Record<string, never>", gen("{}").code);
  check(!/export interface User \{\s*\}/.test(gen("{}").code), "a member-less interface is never emitted");
  check(gen("5").code === "export type User = number;", "a scalar root is an alias to the scalar");
  check(gen("null").code === "export type User = null;", "a null root is the null type, not any");
  check(gen('"x"').code === "export type User = string;", "a string root is string");

  const required = gen('{"a":null}');
  check(required.code === "export interface User {\n  a: null;\n}", "a JSON null is a required null", JSON.stringify(required.code));
  check(!/a\?:/.test(required.code), "a null value is never made optional");
  check(!/\bany\b/.test(required.code), "a null value is never any");
  // Both elements are objects, so they merge into ONE element shape whose `a` is
  // the union of what each element held. The alternative — refusing to merge
  // merely because one of them is null — would lose the merge that makes
  // `[{"a":1},{"a":2}]` an array of one interface rather than an array of two.
  check(
    gen('[{"a":null},{"a":1}]').code ===
      "export type User = UserItem[];\n\nexport interface UserItem {\n  a: null | number;\n}",
    "null merges into the element shape's field union, required",
    JSON.stringify(gen('[{"a":null},{"a":1}]').code),
  );
  check(
    !/\?\s*:/.test(gen('[{"a":null},{"a":1}]').code),
    "a key present in every element is required even when one value is null",
  );
  check(
    gen('[{"a":null},{"a":null}]').code ===
      "export type User = UserItem[];\n\nexport interface UserItem {\n  a: null;\n}",
    "null in every element stays a required null",
    gen('[{"a":null},{"a":null}]').code,
  );
  const nestedArrays = gen("[[{\"a\":1}],[{\"b\":2}]]");
  check(
    declaredNames(nestedArrays.code).join("|") === "User|UserItemVariantItem|UserItemVariantItem_2",
    "two different element shapes get two names, neither reused",
    declaredNames(nestedArrays.code).join("|"),
  );
  check(
    /\(.*\)\[\];$/.test(nestedArrays.code.split("\n")[0]),
    "a union of array types is parenthesized",
    nestedArrays.code.split("\n")[0],
  );
}

// ---------------------------------------------------------------------------
// 4. merging the elements of an array
// ---------------------------------------------------------------------------
{
  const merged = gen('[{"a":1},{"b":2}]');
  check(
    merged.code === "export type User = UserItem[];\n\nexport interface UserItem {\n  a?: number;\n  b?: number;\n}",
    "a key missing from one element is the only thing that is optional",
    JSON.stringify(merged.code),
  );
  check(gen('[{"a":1},{"a":1}]').code === "export type User = UserItem[];\n\nexport interface UserItem {\n  a: number;\n}", "identical elements produce no optional marker", gen('[{"a":1},{"a":1}]').code);
  check(
    gen('[{"a":1},{"a":"x"}]').code === "export type User = UserItem[];\n\nexport interface UserItem {\n  a: number | string;\n}",
    "a key whose shapes disagree becomes a union of what was seen",
    gen('[{"a":1},{"a":"x"}]').code,
  );
  check(
    gen('[{"a":1},{"a":"x"},{"a":true}]').code === "export type User = UserItem[];\n\nexport interface UserItem {\n  a: number | string | boolean;\n}",
    "three shapes become a three-member union",
    gen('[{"a":1},{"a":"x"},{"a":true}]').code,
  );
  check(gen('[{"b":1},{"a":1}]').code.indexOf("b?: number;\n  a?: number;") > -1, "merged members keep first-seen order", gen('[{"b":1},{"a":1}]').code);
  // The merge is of the array's ELEMENTS. A key whose own values disagree is a
  // union of those values, not a flattened object: merging `{x}` and `{y}` into
  // `{x?, y?}` would claim a key may be missing, which neither element says.
  const disagreeing = gen('[{"a":{"x":1}},{"a":{"y":2}}]');
  check(
    disagreeing.code ===
      "export type User = UserItem[];\n\nexport interface UserItem {\n  a: UserItemAVariant | UserItemAVariant_2;\n}\n\nexport interface UserItemAVariant {\n  x: number;\n}\n\nexport interface UserItemAVariant_2 {\n  y: number;\n}",
    "a key whose own values disagree is a union of them, not a flattened object",
    JSON.stringify(disagreeing.code),
  );
  check(!/x\?|y\?/.test(disagreeing.code), "a disagreeing value is not flattened into optional members");
  const mixedKey = gen('[{"a":{"x":1}},{"a":1}]');
  check(
    mixedKey.code ===
      "export type User = UserItem[];\n\nexport interface UserItem {\n  a: UserItemAVariant | number;\n}\n\nexport interface UserItemAVariant {\n  x: number;\n}",
    "an object and a scalar in the same key union, and the object keeps its interface",
    JSON.stringify(mixedKey.code),
  );
  check(!/a\?:/.test(mixedKey.code), "a key present in every element stays required when its values disagree");
  check(
    /export interface UserItemAVariant \{/.test(mixedKey.code),
    "the object half of a mixed union is a declared interface, not an inline type",
  );
  check(
    gen('[{"a":1},{"b":2}]').fieldCount === 2,
    "the field count counts merged members once each",
    String(gen('[{"a":1},{"b":2}]').fieldCount),
  );

  // mergeElementShapes and sameShape are the two exported primitives the emitter
  // and the merger are built on, so they are checked directly rather than only
  // through the output.
  check(sameShape({ kind: "string" }, { kind: "string" }) === true, "two scalar shapes of a kind are the same shape");
  check(sameShape({ kind: "string" }, { kind: "number" }) === false, "two different kinds are not the same shape");
  check(
    sameShape(
      { kind: "object", fields: [{ key: "a", shape: { kind: "null" }, optional: false }], allKeysPresent: true },
      { kind: "object", fields: [{ key: "a", shape: { kind: "null" }, optional: false }], allKeysPresent: true },
    ) === true,
    "two identical one-field objects are the same shape",
  );
  check(
    sameShape(
      { kind: "object", fields: [{ key: "a", shape: { kind: "null" }, optional: false }], allKeysPresent: true },
      { kind: "object", fields: [{ key: "a", shape: { kind: "null" }, optional: true }], allKeysPresent: false },
    ) === false,
    "an optional member is a different shape from a required one",
  );
  check(
    sameShape(
      { kind: "object", fields: [{ key: "a", shape: { kind: "null" }, optional: false }], allKeysPresent: true },
      { kind: "object", fields: [{ key: "b", shape: { kind: "null" }, optional: false }], allKeysPresent: true },
    ) === false,
    "a different key is a different shape",
  );
  check(sameShape({ kind: "array", of: { kind: "null" } }, { kind: "array", of: { kind: "null" } }) === true, "two arrays of null are the same shape");
  check(
    sameShape({ kind: "union", of: [{ kind: "null" }, { kind: "string" }] }, { kind: "union", of: [{ kind: "string" }, { kind: "null" }] }) === false,
    "a union compares in order, which is fine because unions are built in first-seen order",
  );
  check(mergeElementShapes([]).kind === "unknown", "no elements at all merges to unknown");
  check(mergeElementShapes([{ kind: "string" }]).kind === "string", "one distinct element is that element");
  check(
    eq(mergeElementShapes([{ kind: "string" }, { kind: "string" }, { kind: "number" }]), {
      kind: "union",
      of: [{ kind: "string" }, { kind: "number" }],
    }),
    "duplicate element shapes are collapsed, not repeated",
  );
  check(
    mergeElementShapes([{ kind: "string" }, { kind: "number" }]).kind === "union" &&
      mergeElementShapes([{ kind: "string" }, { kind: "number" }]).kind !== "unknown",
    "mixed elements are a union, never unknown",
  );
  const obj = (fields) => ({ kind: "object", fields, allKeysPresent: true });
  const f = (key, shape) => ({ key, shape, optional: false });
  const mergedShape = mergeElementShapes([obj([f("a", { kind: "null" })]), obj([f("b", { kind: "string" })])]);
  check(mergedShape.kind === "object" && mergedShape.fields.every((m) => m.optional === true), "mergeElementShapes marks both sides of a merge optional", JSON.stringify(mergedShape));
}

// ---------------------------------------------------------------------------
// 5. inference on its own
// ---------------------------------------------------------------------------
{
  check(eq(inferJsonShape(null, LIMITS), { kind: "null" }), "null infers to null", eq(inferJsonShape(null, LIMITS)));
  check(eq(inferJsonShape("s", LIMITS), { kind: "string" }), "a string infers to string");
  check(eq(inferJsonShape(1, LIMITS), { kind: "number" }), "a number infers to number");
  check(eq(inferJsonShape(true, LIMITS), { kind: "boolean" }), "a boolean infers to boolean");
  check(
    eq(inferJsonShape([], LIMITS), { kind: "array", of: { kind: "unknown" } }),
    "an empty array infers to an array of unknown",
    eq(inferJsonShape([], LIMITS)),
  );
  const object = inferJsonShape({ a: 1, b: null }, LIMITS);
  check(object.kind === "object" && object.fields.length === 2, "an object infers to its own fields", JSON.stringify(object));
  check(object.fields.every((m) => m.optional === false), "no field of a plain object is optional");
  check(object.allKeysPresent === true, "a plain object has all its keys present");
  check(
    inferJsonShape([{ a: 1 }, { b: 2 }], LIMITS).kind === "array" &&
      inferJsonShape([{ a: 1 }, { b: 2 }], LIMITS).of.fields.every((m) => m.optional === true),
    "inference itself marks a missing key optional, not the emitter",
  );
  check(inferJsonShape(1, { maxDepth: 1, maxNodes: 10 }).kind === "number", "a depth limit of 1 accepts a scalar");
  let depthError = null;
  try {
    inferJsonShape([1], { maxDepth: 1, maxNodes: 10 });
  } catch (error) {
    depthError = error;
  }
  check(depthError instanceof RangeError, "a depth overrun throws a RangeError, so it can be told from bad JSON", String(depthError));
  check(/deeper than 1 levels/.test(String(depthError && depthError.message)), "the depth message names the limit", String(depthError && depthError.message));
  let nodeError = null;
  try {
    inferJsonShape([1, 2, 3], { maxDepth: 64, maxNodes: 3 });
  } catch (error) {
    nodeError = error;
  }
  check(nodeError instanceof RangeError, "a value overrun throws a RangeError too");
  check(/more than 3 values/.test(String(nodeError && nodeError.message)), "the value message names the limit", String(nodeError && nodeError.message));
  check(/nothing was converted/.test(String(nodeError && nodeError.message)), "the value message says nothing was converted");
  check(inferJsonShape([1, 2, 3], { maxDepth: 64, maxNodes: 4 }).kind === "array", "one value under the limit is accepted");

  // The exponential-array defect: the old code inferred every array element twice,
  // so a 55-byte payload at depth 26 cost 2^26 infer calls and froze the tab.
  const exponential = `${"[".repeat(26)}"1"${"]".repeat(26)}`;
  check(exponential.length === 55, "the exponential fixture really is 55 characters", String(exponential.length));
  const started = Date.now();
  const exponentialResult = gen(exponential);
  const elapsed = Date.now() - started;
  check(exponentialResult.kind === "generated", "26 nested arrays still generate", exponentialResult.kind);
  // The innermost value is the STRING "1", so 26 nested arrays of a string are
  // 26 array types over `string`. `unknown` appears only for an array with no
  // element to look at, and this fixture has one.
  check(
    exponentialResult.code === `export type User = string${"[]".repeat(26)};`,
    "26 nested arrays become 26 array types",
    exponentialResult.code,
  );
  check(elapsed < 2000, `the 26-deep fixture finishes in well under two seconds (${elapsed}ms) where the old double inference did not`, String(elapsed));
  check(!/JSON\.stringify/.test(INFER_CODE), "structural equality never serializes a subtree with JSON.stringify");
  check(
    !/JSON\.stringify/.test(INFER_CODE) && /JSON\.stringify/.test(INFER_SRC),
    "and the module still says in prose that it no longer does",
  );
  check(/const shapes = items\.map\(\(item\) => infer\(item, depth \+ 1, ctx\)\);/.test(INFER_CODE), "an array infers its elements exactly once");
  check(!/new Set\(/.test(INFER_CODE), "no Set-of-serialized-shapes remains in the inference");
  check((INFER_CODE.match(/\.map\(infer\)/g) || []).length === 0, "no bare re-map of infer remains");
}

// ---------------------------------------------------------------------------
// 6. member names
// ---------------------------------------------------------------------------
{
  check(gen('{"a":1,"$":2,"_x":3}').code === "export interface User {\n  a: number;\n  $: number;\n  _x: number;\n}", "keys that are already identifiers are used as they are", JSON.stringify(gen('{"a":1,"$":2,"_x":3}').code));
  check(gen('{"a b":1}').code === 'export interface User {\n  "a_b": number;\n}', "a key with a space is sanitized and quoted", JSON.stringify(gen('{"a b":1}').code));
  check(gen('{"1x":1}').code === 'export interface User {\n  "_1x": number;\n}', "a key starting with a digit gains an underscore", JSON.stringify(gen('{"1x":1}').code));
  check(
    gen('[{"a b":1,"a-b":2}]').code ===
      'export type User = UserItem[];\n\nexport interface UserItem {\n  "a_b": number;\n  "a_b_2": number;\n}',
    "two keys that sanitize alike are separated, not merged",
    JSON.stringify(gen('[{"a b":1,"a-b":2}]').code),
  );
  check(
    gen('[{"a b":1,"a-b":2,"a.b":3}]').code ===
      'export type User = UserItem[];\n\nexport interface UserItem {\n  "a_b": number;\n  "a_b_2": number;\n  "a_b_3": number;\n}',
    "a third colliding key keeps counting rather than colliding",
    JSON.stringify(gen('[{"a b":1,"a-b":2,"a.b":3}]').code),
  );
  check(gen('{"":1,"_":2}').code === 'export interface User {\n  "_": number;\n  __2: number;\n}', "an empty key and an underscore key both resolve to a member", JSON.stringify(gen('{"":1,"_":2}').code));
  check(gen('{"constructor":1}').code === "export interface User {\n  constructor: number;\n}", "constructor is a legal member name and is left alone", JSON.stringify(gen('{"constructor":1}').code));
  check(gen('{"toString":1,"valueOf":2}').code === "export interface User {\n  toString: number;\n  valueOf: number;\n}", "inherited-looking keys are left alone too");
  const proto = gen('{"__proto__":{"x":1},"ok":2}');
  check(
    proto.code === "export interface User {\n  __proto__: UserProto;\n  ok: number;\n}\n\nexport interface UserProto {\n  x: number;\n}",
    "a __proto__ key from the document is data, and is named like any other",
    JSON.stringify(proto.code),
  );
  check(/export interface User \{[^}]*__proto__/.test(proto.code), "__proto__ is not dropped from the output");
}

// ---------------------------------------------------------------------------
// 7. the root name
// ---------------------------------------------------------------------------
{
  check(eq(typeNameFor(""), { name: "Root", warning: "No name was typed, so the root type is called Root." }), "an empty root name falls back to Root and says so", JSON.stringify(typeNameFor("")));
  check(typeNameFor("User").name === "User" && typeNameFor("User").warning === null, "a legal name is used as typed", JSON.stringify(typeNameFor("User")));
  check(typeNameFor("api_response").name === "ApiResponse", "snake_case becomes PascalCase", typeNameFor("api_response").name);
  check(typeNameFor("Order Item").name === "OrderItem", "spaces inside a name are removed", typeNameFor("Order Item").name);
  check(typeNameFor("  User  ").name === "User", "surrounding whitespace is trimmed", typeNameFor("  User  ").name);
  check(typeNameFor("9 x").name === "_9X" && typeNameFor("9 x").warning === null, "a leading digit gains an underscore without a warning", JSON.stringify(typeNameFor("9 x")));
  check(typeNameFor("!!!").name === "Root" && /no letters or digits/.test(typeNameFor("!!!").warning), "a name with nothing usable in it falls back with a reason", JSON.stringify(typeNameFor("!!!")));
  for (const keyword of ["class", "Class", "CLASS", "interface", "type", "const", "function", "return", "extends", "implements", "namespace", "declare", "readonly", "enum", "this", "null", "never", "object", "symbol", "bigint", "while", "debugger", "yield", "await", "package", "module", "instanceof", "typeof", "keyof"]) {
    const named = typeNameFor(keyword);
    check(named.name === "Root" && named.warning !== null, `${keyword} cannot name a type, so it falls back to Root`);
  }
  check(/TypeScript keyword “class”/.test(typeNameFor("Class").warning), "the warning names the keyword it collided with, in lower case", typeNameFor("Class").warning);
  for (const builtin of ["Record", "Readonly", "Partial", "Required", "Array", "Pick", "Omit", "Exclude", "Extract", "ReturnType", "Parameters"]) {
    check(typeNameFor(builtin).name === "Root", `${builtin} would be shadowed by an interface, so it falls back to Root`);
  }
  check(/built-in TypeScript type name/.test(typeNameFor("Record").warning), "the built-in substitution says why", typeNameFor("Record").warning);
  // `globalThis` is a global VALUE, not a type name. The emitted name is
  // `GlobalThis`, which shadows nothing and compiles, so refusing it would be a
  // false warning — and the module's list deliberately carries no lowercase entry
  // it could never match, because the check runs on the PascalCase candidate.
  check(
    typeNameFor("globalThis").name === "GlobalThis" && typeNameFor("globalThis").warning === null,
    "a name that is a global value but not a type name is not refused",
    JSON.stringify(typeNameFor("globalThis")),
  );
  check(
    gen('{"a":1}', "globalThis").code === "export interface GlobalThis {\n  a: number;\n}",
    "and it generates a declaration that compiles",
    JSON.stringify(gen('{"a":1}', "globalThis").code),
  );
  check(typeNameFor("records").name === "Records", "a name that merely contains a builtin word is not refused", typeNameFor("records").name);
  check(typeNameFor("Classy").name === "Classy", "a name that merely starts with a keyword is not refused", typeNameFor("Classy").name);
  check(gen('{"a":1}', "class").code === "export interface Root {\n  a: number;\n}", "a refused root name is reflected in the output", JSON.stringify(gen('{"a":1}', "class").code));
  check(gen('{"a":1}', "").code === "export interface Root {\n  a: number;\n}", "an empty root name is reflected in the output");
  const shape = parseJsonShape('{"a":{"b":1}}').shape;
  check(
    emitTypeScript(shape, "OrderItem").code === emitTypeScript(shape, "OrderItem").code &&
      emitTypeScript(shape, "OrderItem").code !== emitTypeScript(shape, "Cart").code,
    "renaming changes the declarations without re-reading the document",
  );
  check(emitTypeScript(shape, "Cart").fieldCount === emitTypeScript(shape, "OrderItem").fieldCount, "renaming does not change the field count");
}

// ---------------------------------------------------------------------------
// 8. the caps and the error classification
// ---------------------------------------------------------------------------
{
  const atCap = `{"a":"${"x".repeat(MAX_INPUT_CHARS - 8)}"}`;
  check(atCap.length === MAX_INPUT_CHARS, "the at-the-cap fixture is exactly the cap long", String(atCap.length));
  check(gen(atCap).kind === "generated", `exactly ${n(MAX_INPUT_CHARS)} characters converts`);
  const overCap = `{"a":"${"x".repeat(MAX_INPUT_CHARS - 7)}"}`;
  const over = gen(overCap);
  check(overCap.length === MAX_INPUT_CHARS + 1, "the over-cap fixture is one character over", String(overCap.length));
  check(over.kind === "refused" && over.reason === "too-large", "one character over the cap is refused", over.kind);
  check(over.message.includes(`${n(MAX_INPUT_CHARS + 1)} characters`), "the refusal quotes the length it found", over.message);
  check(over.message.includes(`the cap is ${n(MAX_INPUT_CHARS)}`), "the refusal quotes the cap", over.message);
  check(/nothing was converted/.test(over.message), "the refusal says nothing was converted", over.message);

  // The character cap binds before the value cap for pasted text: the densest
  // document there is carries about two characters per value. This is asserted
  // rather than assumed, because the alternative is a cap that can never fire.
  const dense = `[${new Array(99999).fill("0").join(",")}] `;
  check(dense.trim().length + 1 === MAX_INPUT_CHARS, "the densest fixture is exactly the cap long", String(dense.length));
  const denseResult = gen(dense);
  check(denseResult.kind === "generated", "the densest document at the cap still converts", denseResult.kind);
  check(denseResult.code === "export type User = number[];", "and it emits one array type", JSON.stringify(denseResult.code));
  check(MAX_INPUT_CHARS / 2 < MAX_NODES, "the character cap is reached before the value cap, as the source comment says");
  check(
    /the character cap above binds first/.test(wrapped(CONVERT_SRC)),
    "the source says which cap binds first for pasted text",
  );

  const atDepth = `${"[".repeat(MAX_JSON_DEPTH)}${"]".repeat(MAX_JSON_DEPTH)}`;
  check(gen(atDepth).kind === "generated", `${MAX_JSON_DEPTH} levels of nesting convert`);
  const overDepth = gen(`${"[".repeat(MAX_JSON_DEPTH + 1)}${"]".repeat(MAX_JSON_DEPTH + 1)}`);
  check(overDepth.kind === "refused" && overDepth.reason === "too-deep", "one level over the nesting cap is refused", overDepth.kind);
  check(overDepth.message.includes(`deeper than ${MAX_JSON_DEPTH} levels`), "the depth refusal quotes the cap", overDepth.message);
  check(/nothing was converted/.test(overDepth.message), "the depth refusal says nothing was converted");

  const bad = [
    ["{", "a truncated object"],
    ["[1,2", "a truncated array"],
    ['{"a":1,', "an object with a dangling comma"],
    ["nope", "a bare word"],
    ['{"a":1}}', "a document with trailing text"],
    ["[1,2,", "a truncated element list"],
    ["{'a':1}", "a single-quoted key"],
  ];
  for (const [text, what] of bad) {
    const result = gen(text);
    check(result.kind === "invalid-json", `${what} is reported as invalid JSON, not as a crash`, `${JSON.stringify(text)} -> ${result.kind}`);
    check(!/ at position \d+/.test(result.message), `${what}: the position clause is stripped from the message`, result.message);
    check(result.message.length > 0, `${what}: there is a message to show`, result.message);
  }
  const positioned = gen('{"a":1,');
  check(positioned.line === 1 && positioned.column === 8, "a position V8 reports is carried through", `${positioned.line}:${positioned.column}`);
  const endOfInput = gen("[1,2,");
  check(endOfInput.line === 1 && endOfInput.column === 6, "an unexpected end of input is positioned too", `${endOfInput.line}:${endOfInput.column}`);
  const multiLine = gen('{\n  "a": 1,\n  "b" 1\n}');
  check(multiLine.line === 3, "a position on a later line is reported as that line", String(multiLine.line));
  const noPosition = gen('{"a":1,,"b":2}');
  check(noPosition.kind === "invalid-json", "a doubled comma is still invalid JSON", noPosition.kind);
  // V8 does report a position for this one, so the contract to assert is the shape
  // of the answer rather than its absence: a position is either wholly present or
  // wholly absent — never a line without a column — and when present it points
  // inside the document. The component relies on exactly that to decide whether it
  // may print one, and an invented or half-populated position is what section 11
  // checks the UI against.
  for (const [what, raw, result] of [
    ["a doubled comma", '{"a":1,,"b":2}', noPosition],
    ["a dangling comma", '{"a":1,', positioned],
    ["a truncated array", "[1,2", gen("[1,2")],
    ["a trailing brace", '{"a":1}}', gen('{"a":1}}')],
  ]) {
    const whole = result.line === null ? result.column === null : result.line >= 1 && result.column >= 1;
    check(whole, `${what}: a position is reported wholly or not at all`, `${result.line}:${result.column}`);
    if (result.line !== null) {
      // A 1-based column may sit one past the last character: "unexpected end of
      // JSON input" points at the position the parser wanted, which is the
      // character after the final one.
      check(
        result.line <= raw.split("\n").length && result.column <= raw.length + 1,
        `${what}: the reported position is inside the document or just past its end`,
        `${result.line}:${result.column} of ${raw.length}`,
      );
    }
  }
  check(
    /the fault is in the tool, not in what you pasted/i.test(wrapped(CONVERT_SRC)),
    "an internal failure is worded so it cannot be read as the reader's JSON being wrong",
  );
  check(
    !/\bdocument\s*\.\s*\w|\bwindow\s*\.\s*\w|\bnavigator\s*\.\s*\w/.test(INFER_CODE + CONVERT_CODE),
    "the pure modules touch no DOM global",
  );
  check(
    !/\bdocument\s*\.\s*\w|\bwindow\s*\.\s*\w/.test(INFER_CODE),
    "the inference module reaches for no global object at all",
  );
}

// ---------------------------------------------------------------------------
// 9. the emitted-code cap
// ---------------------------------------------------------------------------
{
  // A merged array of objects can name far more fields than the input has
  // characters, so the cap is on the output rather than on the input. Reached
  // through emitTypeScript with a shape built here, because no document inside
  // the character cap can produce this much code.
  const fields = 12000;
  const wide = {
    kind: "object",
    allKeysPresent: true,
    fields: Array.from({ length: fields }, (_, i) => ({
      key: `field${i}`,
      shape: {
        kind: "object",
        allKeysPresent: true,
        fields: [
          { key: "a", shape: { kind: "number" }, optional: false },
          { key: "b", shape: { kind: "string" }, optional: false },
        ],
      },
      optional: false,
    })),
  };
  const huge = emitTypeScript(wide, "User");
  check(huge.kind === "refused" && huge.reason === "too-large", "an output over the code cap is refused", huge.kind);
  check(huge.message.includes(n(MAX_OUTPUT_CHARS)), "the code-cap refusal quotes the cap", huge.message);
  check(/would be [\d,]+ characters/.test(huge.message), "the code-cap refusal quotes the length it would have produced", huge.message);
  check(/nothing was converted/.test(huge.message), "the code-cap refusal says nothing was converted", huge.message);
  check(/A shorter sample/.test(huge.message), "the code-cap refusal offers a way forward", huge.message);
  const small = emitTypeScript({ kind: "object", allKeysPresent: true, fields: [{ key: "a", shape: { kind: "number" }, optional: false }] }, "User");
  check(small.kind === "generated" && small.code.length < MAX_OUTPUT_CHARS, "a small shape is well under the code cap");
  const exactly = emitTypeScript(
    {
      kind: "object",
      allKeysPresent: true,
      fields: Array.from({ length: 5000 }, (_, i) => ({ key: `f${i}`, shape: { kind: "number" }, optional: false })),
    },
    "User",
  );
  check(exactly.kind === "generated" && exactly.code.length > 0, "5,000 fields still generate, well under the cap", exactly.kind);
}

// ---------------------------------------------------------------------------
// 10. the sweep: every generated document is compiled by TypeScript
// ---------------------------------------------------------------------------
{
  let seed = 20261005;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const keys = [
    "a", "b", "c", "id", "name", "nested", "items", "userId", "a b", "a-b", "1x", "", "$",
    "class", "User", "constructor", "Record", "toString", "valueOf", "__proto__", "a.b", "a b",
  ];
  const scalars = [1, -2.5, 0, "s", "", "2024-01-01", true, false, null];
  const build = (depth) => {
    const roll = rnd();
    if (depth <= 0 || roll < 0.45) return pick(scalars);
    if (roll < 0.72) {
      const out = {};
      const count = Math.floor(rnd() * 4);
      for (let i = 0; i < count; i += 1) {
        const key = pick(keys);
        // Assigned through defineProperty so a "__proto__" key is a real own key
        // of the sample, which is what a document from a network can carry.
        Object.defineProperty(out, key, {
          value: build(depth - 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return out;
    }
    const list = [];
    const count = Math.floor(rnd() * 4);
    for (let i = 0; i < count; i += 1) list.push(build(depth - 1));
    return list;
  };
  const rootNames = ["User", "class", "", "9 x", "Record", "api_response", "Order Item", "a-b"];
  const files = new Map();
  const compiled = [];
  let notGenerated = 0;
  let withProblem = 0;
  let bareToken = 0;
  let selfAlias = 0;
  let duplicateName = 0;

  for (let i = 0; i < 200; i += 1) {
    const raw = JSON.stringify(build(3));
    for (const rootName of rootNames) {
      const result = gen(raw, rootName);
      if (result.kind !== "generated") {
        notGenerated += 1;
        continue;
      }
      if (result.problem !== null) withProblem += 1;
      if (/\b(?:any|object|array)\b/.test(result.code)) bareToken += 1;
      if (/^export type ([A-Za-z_$][A-Za-z0-9_$]*) = \1;$/m.test(result.code)) selfAlias += 1;
      const names = declaredNames(result.code);
      if (new Set(names).size !== names.length) duplicateName += 1;
      const file = `sweep${files.size}.ts`;
      files.set(file, result.code);
      compiled.push({ file, result });
    }
  }
  check(notGenerated === 0, `every one of ${200 * rootNames.length} sweep documents generated`, String(notGenerated));
  check(compiled.length >= 1500, "at least 1,500 documents reached the compiler", String(compiled.length));
  check(withProblem === 0, "no sweep output carried a self-check problem", String(withProblem));
  check(bareToken === 0, "no sweep output contained a bare any, object or array", String(bareToken));
  check(selfAlias === 0, "no sweep output contained a self-alias", String(selfAlias));
  check(duplicateName === 0, "no sweep output declared a name twice", String(duplicateName));

  // One in-memory program, this repo's own compiler options, every generated
  // document as its own virtual file.
  const repoOptions = ts.parseJsonConfigFileContent(
    JSON.parse(readFileSync("tsconfig.json", "utf8")),
    ts.sys,
    ".",
  ).options;
  const compileOptions = { ...repoOptions, noEmit: true, incremental: false, types: [] };
  check(repoOptions.strict === true, "the compile uses the repo's strict setting", String(repoOptions.strict));
  const libNames = new Set((repoOptions.lib ?? []).map((l) => `lib.${l}.d.ts`));
  const host = ts.createCompilerHost(compileOptions, true);
  const originalGet = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) => {
    if (files.has(name)) return ts.createSourceFile(name, files.get(name), languageVersion, true, ts.ScriptKind.TS);
    const bare = name.split("/").pop();
    if (name.includes("node_modules/typescript") || libNames.has(bare)) {
      return originalGet(name, languageVersion, onError, shouldCreate);
    }
    return undefined;
  };
  host.fileExists = (name) => files.has(name) || ts.sys.fileExists(name);
  host.readFile = (name) => files.get(name) ?? ts.sys.readFile(name);
  const program = ts.createProgram([...files.keys()], compileOptions, host);
  const diagnostics = new Map();
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    if (!diagnostic.file) continue;
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    const line = `${diagnostic.file.fileName}: TS${diagnostic.code} line ${position.line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    diagnostics.set(line, (diagnostics.get(line) ?? 0) + 1);
  }
  check(
    diagnostics.size === 0,
    `all ${compiled.length} generated documents compile under the repo's own TypeScript options`,
    [...diagnostics.keys()].slice(0, 3).join(" | "),
  );

  // And the strongest property of all: the generated root type really describes
  // the sample it came from. Assignability is asserted on documents whose keys are
  // already legal identifiers, because a key that had to be sanitized cannot
  // structurally match the original object — `"a b": number` does not accept
  // `{ "a b": 1 }` under excess-property checking, and that is correct behaviour
  // rather than a defect, so probing it would only assert something false.
  const assignable = [];
  const assignableFiles = new Map();
  const documents = [
    '{"id":1,"name":"Alex","isAdmin":true}',
    '{"profile":{"age":29,"address":{"city":"Mumbai"}}}',
    '{"roles":["admin","user"],"lastLogin":null}',
    '[{"id":1,"tags":["a"]},{"id":2,"note":null}]',
    '[{"a":1,"b":2},{"a":3,"c":4}]',
    '{"nested":{"deep":{"deeper":{"value":[1,2,3]}}}}',
  ];
  for (const document of documents) {
    for (const rootName of ["User", "Order", "Payload"]) {
      const result = gen(document, rootName);
      const file = `assign${assignableFiles.size}.ts`;
      assignableFiles.set(file, `${result.code}\nconst _sample: ${rootName} = ${document};\n`);
      assignable.push({ file, result, document, rootName });
    }
  }
  const assignHost = ts.createCompilerHost(compileOptions, true);
  const assignOriginal = assignHost.getSourceFile.bind(assignHost);
  assignHost.getSourceFile = (name, languageVersion, onError, shouldCreate) => {
    if (assignableFiles.has(name)) {
      return ts.createSourceFile(name, assignableFiles.get(name), languageVersion, true, ts.ScriptKind.TS);
    }
    const bare = name.split("/").pop();
    if (name.includes("node_modules/typescript") || libNames.has(bare)) {
      return assignOriginal(name, languageVersion, onError, shouldCreate);
    }
    return undefined;
  };
  assignHost.fileExists = (name) => assignableFiles.has(name) || ts.sys.fileExists(name);
  assignHost.readFile = (name) => assignableFiles.get(name) ?? ts.sys.readFile(name);
  const assignProgram = ts.createProgram([...assignableFiles.keys()], compileOptions, assignHost);
  const assignDiagnostics = new Map();
  for (const diagnostic of ts.getPreEmitDiagnostics(assignProgram)) {
    if (!diagnostic.file) continue;
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    const line = `${diagnostic.file.fileName}: TS${diagnostic.code} line ${position.line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    assignDiagnostics.set(line, (assignDiagnostics.get(line) ?? 0) + 1);
  }
  check(
    assignDiagnostics.size === 0,
    `the generated root type accepts the sample it came from (${assignable.length} documents)`,
    [...assignDiagnostics.keys()].slice(0, 3).join(" | "),
  );
  check(assignable.every((a) => a.result.kind === "generated"), "every assignability fixture generated");
  check(assignable.length === 18, "the assignability set is the size it claims to be", String(assignable.length));
}

// ---------------------------------------------------------------------------
// 11. the component: safety, accessibility, and no false claims on screen
// ---------------------------------------------------------------------------
{
  check(!/dangerouslySetInnerHTML/.test(COMPONENT_CODE), "no dangerouslySetInnerHTML in the component");
  check(!/\.innerHTML/.test(COMPONENT_CODE), "no innerHTML in the component");
  check(!/\bdocument\.write\b/.test(COMPONENT_CODE), "no document.write in the component");
  check(!/\bfetch\s*\(/.test(COMPONENT_CODE), "no fetch call in the component");
  check(!/XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(COMPONENT_CODE), "no other transport in the component");
  check(!/https?:\/\//.test(COMPONENT_CODE), "no absolute URL in the component, so no third-party asset and no upload endpoint");
  check(!/eval\s*\(|new Function/.test(COMPONENT_CODE), "no eval and no dynamic code in the component");
  check(!/dangerouslySetInnerHTML|\beval\b|new Function/.test(INFER_CODE + CONVERT_CODE), "no HTML sink and no dynamic code in the pure modules");
  check(!/localStorage|sessionStorage|indexedDB|crypto\./.test(COMPONENT_CODE), "nothing is stored and no crypto is used");
  check(!/require\(|from "node:/.test(INFER_CODE + CONVERT_CODE), "the pure modules import no Node API");
  check(!/import\(/.test(INFER_CODE + CONVERT_CODE), "the pure modules use no dynamic import");

  check(/useDeferredValue\(input\)/.test(COMPONENT_CODE), "the expensive half runs against a deferred input");
  check(
    /useMemo\(\(\) => parseJsonShape\(deferredInput\), \[deferredInput\]\)/.test(COMPONENT_CODE),
    "inference is memoized on the deferred input alone",
  );
  check(
    /useMemo\(\s*\(\) => \(parsed\.kind === "parsed" \? emitTypeScript\(parsed\.shape, named\.name\) : parsed\),\s*\[parsed, named\.name\],\s*\)/.test(COMPONENT_CODE),
    "emission is a second memo, so renaming does not re-walk the document",
  );
  check((COMPONENT_CODE.match(/useMemo\(/g) || []).length >= 3, "there are the two memos plus the name memo", String((COMPONENT_CODE.match(/useMemo\(/g) || []).length));
  check(/useId\(\)/.test(COMPONENT_CODE), "the generated ids come from useId, so they are unique per instance");

  check(/useState\(""\)/.test(COMPONENT_CODE), "the input boots empty");
  check(/useState\("User"\)/.test(COMPONENT_CODE), "the root name has a sensible default");
  check(/Load sample/.test(COMPONENT), "there is a Load sample button");
  check(/>\s*Clear\s*</.test(COMPONENT_CODE), "there is a Clear button");
  // The status badge legitimately reads "Generated" and the live region says
  // "Generated N interfaces", so the claim under test is that no BUTTON offers to
  // convert on demand — the conversion is continuous, and a button implying a
  // pending step would be a lie about how the page works.
  check(
    !/>\s*(?:Generate|Convert)\b\s*</.test(COMPONENT_CODE),
    "there is no convert button to click, because there is nothing to convert on demand",
  );
  check(/const SAMPLE = /.test(COMPONENT_CODE), "the sample is a named constant, not pre-filled state");
  check(/placeholder=\{EM_DASH\}/.test(COMPONENT_CODE), "the empty output shows an em dash, not a blank");
  check(/EM_DASH = "\\u2014"/.test(COMPONENT_CODE), "the em dash is written as an escape, not as a stray character");
  check(/readOnly/.test(COMPONENT_CODE), "the generated pane is read-only");
  check(/tabIndex=\{-1\}/.test(COMPONENT_CODE), "the generated pane is out of the tab order");
  check(/rows=\{16\}/.test(COMPONENT_CODE), "both textareas have a real height");

  check(/<label htmlFor=\{nameId\}/.test(COMPONENT_CODE), "the root-name input has a real label element");
  check(
    (COMPONENT_CODE.match(/<label /g) || []).length === 1,
    "the shared Field component, which renders a <p>, is not used for an input",
    String((COMPONENT_CODE.match(/<label /g) || []).length),
  );
  check(!/\bField\b/.test(COMPONENT_CODE), "and the shared Field component is not imported at all");
  check(/aria-label="JSON input"/.test(COMPONENT_CODE), "the JSON textarea is named for a screen reader");
  check(/aria-label="Generated TypeScript types"/.test(COMPONENT_CODE), "the generated textarea is named for a screen reader");
  check(/aria-describedby=\{hintId\}/.test(COMPONENT_CODE), "the JSON textarea is described by its hint");
  check(/id=\{hintId\}/.test(COMPONENT_CODE), "that hint is a real element with the id the textarea points at");
  check(/aria-invalid=\{invalid\}/.test(COMPONENT_CODE), "the JSON textarea is marked invalid when the input is not convertible");
  check(/spellCheck=\{false\}/.test(COMPONENT_CODE), "the input does not invite spellcheck on data");
  check(/autoComplete="off"/.test(COMPONENT_CODE), "the input does not invite autofill on data");
  check(/focus:ring-2/.test(COMPONENT_CODE), "the root-name input has a visible focus ring");
  check((COMPONENT_CODE.match(/min-h-11/g) || []).length >= 4, "every control is a 44px touch target", String((COMPONENT_CODE.match(/min-h-11/g) || []).length));
  check(/aria-busy=\{false\}/.test(COMPONENT_CODE), "the root carries aria-busy, honestly false, because nothing is pending");

  check(/className="sr-only" role="status" aria-live="polite" aria-atomic="true"/.test(COMPONENT_CODE), "there is one polite live region");
  check((COMPONENT_CODE.match(/role="alert"/g) || []).length === 0, "there is no role=alert, so a parse message is never spoken over the reader");
  check(/\{announcement\(result\)\}/.test(COMPONENT_CODE), "the live region carries the counts-only announcement");
  const liveRegion = /className="sr-only" role="status"[\s\S]*?<\/div>/.exec(COMPONENT);
  check(liveRegion !== null && !/result\.message|message\}/.test(liveRegion[0]), "the live region never carries a message that quotes the reader's own payload", liveRegion && liveRegion[0]);
  check(/function announcement\(/.test(COMPONENT_CODE), "the announcement is a named function, so what is spoken is in one place");
  const announcementBody = /function announcement\([\s\S]*?\n\}/.exec(COMPONENT);
  check(
    announcementBody !== null && /interfaceCount/.test(announcementBody[0]) && !/message/.test(announcementBody[0]),
    "the announcement is counts only",
  );
  check(/withPosition\(result\.message, result\.line, result\.column\)/.test(COMPONENT_CODE), "a parse position the engine gave is shown on screen");
  check(/line === null \|\| column === null\) return message;/.test(COMPONENT_CODE), "and an absent position is left absent rather than invented");

  check(/A first draft from one sample\./.test(COMPONENT), "the page leads with what the output is: a first draft from one sample");
  check(/not\s+marked optional/.test(COMPONENT), "it says a key the sample does not show is not marked optional");
  check(/Every number is/.test(COMPONENT) && /UUID/.test(COMPONENT), "it says every number is number and that a date or UUID reads as string");
  check(/union of what was actually seen/.test(COMPONENT), "it says a disagreeing array becomes a union of what was seen");
  check(/starting point to edit, not a schema you can rely on unchecked/.test(COMPONENT), "it says plainly that this is a draft to edit");
  check(!/production-ready|production ready|JSDoc|jsdoc/i.test(COMPONENT_CODE), "the component makes no production-ready or JSDoc claim");
  check(!/generics?\b/i.test(COMPONENT_CODE), "the component makes no generics claim");
  check(/One sample only/.test(COMPONENT), "the hint repeats the one-sample limit under the input");

  check(/MAX_INPUT_CHARS/.test(COMPONENT_CODE) && /MAX_JSON_DEPTH/.test(COMPONENT_CODE) && /MAX_NODES/.test(COMPONENT_CODE) && /MAX_OUTPUT_CHARS/.test(COMPONENT_CODE), "the hint quotes all four caps from the module's own constants");
  check(!/200,000|400,000|200000|400000/.test(COMPONENT_CODE), "the component hard-codes no cap number");
  check(/refused with their real numbers/.test(COMPONENT), "the hint says each cap is refused with its real numbers");
  check(/downloadBlob/.test(COMPONENT_CODE), "the download goes through the shared helper");
  check(/new TextEncoder\(\)\.encode\(code\)/.test(COMPONENT_CODE), "the downloaded bytes are the encoder's own");
  check(/`\$\{named\.name\}\.ts`/.test(COMPONENT_CODE), "the download is named for the root type");
  check(/CopyButton/.test(COMPONENT_CODE), "copy goes through the shared clipboard helper");
  check(/disabled=\{result\.kind !== "generated"\}/.test(COMPONENT_CODE), "copy and download are disabled unless something was generated");
  check((COMPONENT_CODE.match(/disabled=\{result\.kind !== "generated"\}/g) || []).length === 2, "both of them are", String((COMPONENT_CODE.match(/disabled=\{result\.kind !== "generated"\}/g) || []).length));
}

// ---------------------------------------------------------------------------
// 12. the registry, the copy, the SEO entry and the guide
// ---------------------------------------------------------------------------
{
  // Claims the copy must not make. The last two are the ones that need care: the
  // shipped copy says "no JSDoc" and "no generics" on purpose, because telling a
  // reader that a comment is not produced is the honest move. Banning the word
  // would ban the disclosure. So the ban is on the AFFIRMATIVE claim, and a
  // separate check below requires every mention to be a negation.
  const FORBIDDEN = [
    /production[- ]ready/i,
    /ready[- ]to[- ]use/i,
    /\b(?:with|full|auto[- ]generated)\s+JSDoc\b/i,
    /JSDoc[- ](?:ready|annotated|generated|comments on every)/i,
    /click convert/i,
    /intelligent/i,
    /ensuring your generated types are correct/i,
    /correct on the first pass/i,
    /Drop in any JSON/i,
    /eliminat(?:es|ing) hours/i,
  ];

  /**
   * Every mention of `JSDoc` in the shipped copy must be a denial. The copy is
   * allowed — and expected — to say "there is no JSDoc on each field"; a reader
   * who used the old page deserves to know the comment is gone. What it must never
   * do is claim the comments exist.
   */
  const mentionsWithoutDenial = (text, term) =>
    [...text.matchAll(new RegExp(term, "gi"))].some(
      (m) => !/\b(?:no|not|never|without|nothing|neither)\b[^.]{0,40}$/i.test(text.slice(Math.max(0, m.index - 60), m.index)),
    );

  /**
   * `enum` and `generic` are ordinary English in this copy: "a date, UUID or enum
   * that arrives as a string reads as string" describes the INPUT, and the reader
   * is being told the tool cannot tell them apart. So the banned shape is not the
   * word but a claim that the OUTPUT is one of those things.
   */
  const CLAIMS_ENUM_OR_GENERIC =
    /\b(?:emits?|emitted|outputs?|generates?|generated|produces?|renders?|writes?|types?)\b[^.]{0,40}\b(?:enums?|generics?)\b/i;

  /**
   * A FAQ question asks; only an answer asserts. "Can it output type aliases,
   * enums or generics?" followed by "No." is the copy being straight with the
   * reader, so question fields are removed before a claim is looked for.
   */
  const statementsOnly = (text) => text.replace(/"question":"(?:[^"\\]|\\.)*"/g, '"question":""');

  const registry = /slug: "json-to-typescript",\s*\n\s*name: "([^"]+)",\s*\n\s*tagline: "([^"]+)",\s*\n\s*description:\s*\n?\s*"([^"]*)"/.exec(TOOLS_SRC);
  check(!!registry, "the registry entry for json-to-typescript exists");
  if (registry) {
    check(/first draft/i.test(registry[2]), "the tagline says it is a first draft", registry[2]);
    check(/nothing is uploaded/i.test(registry[2] + " " + registry[3]), "the registry states the privacy position", registry[2]);
    check(/export interface/.test(registry[3]), "the description says what the output is", registry[3]);
    check(/null/.test(registry[3]), "the description says what happens to a JSON null", registry[3]);
    check(/checked/.test(registry[3]), "the description says the names are checked", registry[3]);
    check(!FORBIDDEN.some((re) => re.test(registry[3])), "the registry description makes no false claim", registry[3]);
  }

  check(/"json-to-typescript": \["json to typescript"/.test(SEO_SRC), "the SEO keyword entry still exists");
  check(/"json to typescript without uploading"/.test(SEO_SRC), "the keywords include the honest privacy term");
  check(
    /"json-to-typescript":\s*\n?\s*"JSON to TypeScript types online/.test(SEO_SRC),
    "a custom meta title exists for the tool",
  );
  check(/a first draft from one sample/.test(SEO_SRC), "the meta title says the output is a first draft from one sample");
  check(/"json-to-typescript":\s*\n\s+"JSON to TypeScript type generator/.test(SEO_SRC), "the JSON-LD feature list has an entry for the tool");
  for (const claim of [
    "export interface for the root",
    "Record<string, never>",
    "unknown[]",
    "required null",
    "reserved",
    "checked for duplicates and for resolution",
    "200,000 characters of input",
    "64 nesting levels",
    "400,000 characters of generated code",
    "no network request of any kind",
  ]) {
    check(SEO_SRC.includes(claim), `the JSON-LD feature list states: ${claim}`);
  }
  check(!FORBIDDEN.some((re) => re.test(SEO_SRC.match(/"json-to-typescript":\s*\n\s+"JSON to TypeScript type generator[^"]*/)[0])), "the JSON-LD entry makes no false claim");

  check(/first draft/i.test(CONTENT_TEXT), "the long description leads with the draft framing");
  check(CONTENT.longDescription.includes(`${n(MAX_INPUT_CHARS)} characters`), "the long description quotes the real text cap", CONTENT.longDescription.slice(0, 80));
  check(CONTENT.longDescription.includes(`${n(MAX_JSON_DEPTH)} nesting levels`), "the long description quotes the real depth cap");
  check(CONTENT.longDescription.includes(`${n(MAX_NODES)} values`), "the long description quotes the real value cap");
  check(CONTENT.longDescription.includes(`${n(MAX_OUTPUT_CHARS)} characters of generated code`), "the long description quotes the real output cap");
  check(/nothing is uploaded|never uploaded/i.test(CONTENT.longDescription), "the long description states the privacy position", CONTENT.longDescription.slice(-90));
  check(/TS2300/.test(CONTENT.longDescription), "the long description names the compile error it no longer emits");
  check(/optional, and keys whose shapes disagree become a union/.test(CONTENT.longDescription), "the long description explains what makes a field optional", CONTENT.longDescription.includes("optional, and keys whose shapes disagree become a union") ? "" : "text differs");
  check(!FORBIDDEN.some((re) => re.test(CONTENT_TEXT)), "the shipped copy makes no false claim");
  check(!mentionsWithoutDenial(CONTENT_TEXT, "JSDoc"), "every mention of JSDoc in the shipped copy denies it rather than claiming it");
  check(!CLAIMS_ENUM_OR_GENERIC.test(statementsOnly(CONTENT_TEXT)), "the shipped copy never claims the output is an enum or a generic");

  check(CONTENT.features.length >= 10, "at least ten features", String(CONTENT.features.length));
  check(CONTENT.features.some((f) => /checked before it is called Generated/.test(f)), "a feature describes the self-check");
  check(CONTENT.features.some((f) => /Record<string, never>/.test(f) && /unknown\[\]/.test(f)), "a feature describes the empty-object and empty-array rules");
  check(CONTENT.features.some((f) => /stays required and renders as null/.test(f)), "a feature describes the null rule");
  check(CONTENT.features.some((f) => /marked optional/.test(f)), "a feature describes what makes a field optional");
  check(CONTENT.features.some((f) => /keyword/.test(f) && /Record/.test(f)), "a feature describes the root-name substitution");
  check(CONTENT.features.some((f) => /200,000 characters of input/.test(f)), "a feature quotes the real caps");
  check(CONTENT.features.some((f) => /never uploaded/.test(f)), "a feature states the privacy position");
  check(CONTENT.features.some((f) => /No JSDoc comments, no enums, no generics/.test(f)), "a feature says plainly what is not produced");
  check(!CONTENT.features.some((f) => /\bJSDoc-ready\b|generic syntax|interfaces vs types/.test(f)), "no feature claims a JSDoc, a generic or a type-alias mode");

  check(CONTENT.howTo.length === 4, "four how-to steps", String(CONTENT.howTo.length));
  check(CONTENT.howTo.some((s) => /Paste one JSON sample/.test(s.step)), "the first step is pasting a sample", JSON.stringify(CONTENT.howTo.map((s) => s.step)));
  check(CONTENT.howTo.some((s) => /Name the root type/.test(s.step)), "a step covers naming the root", JSON.stringify(CONTENT.howTo.map((s) => s.step)));
  check(CONTENT.howTo.some((s) => /optional markers mean a key was missing/.test(s.description)), "a step explains what an optional marker means");
  check(!CONTENT.howTo.some((s) => /Click convert|click convert/i.test(s.description)), "no step tells the reader to click a convert button");
  check(!CONTENT.howTo.some((s) => /Toggle options/.test(s.description)), "no step describes options that do not exist");

  check(CONTENT.faq.length >= 7, "at least seven FAQs", String(CONTENT.faq.length));
  check(CONTENT.faq.some((f) => /Are these the right types for my API\?/.test(f.question)), "the are-these-right question is asked");
  check(CONTENT.faq.some((f) => /Why is a null field required rather than optional\?/.test(f.question)), "the null question is asked");
  check(CONTENT.faq.some((f) => /Why did my root type get called Root\?/.test(f.question)), "the Root substitution is asked about");
  check(CONTENT.faq.some((f) => /Why is there no comment above each field\?/.test(f.question)), "the missing-JSDoc question is asked and answered");
  check(CONTENT.faq.some((f) => /Is my JSON uploaded anywhere\?/.test(f.question) && /^No\./.test(f.answer)), "the upload question is answered with a plain No");
  check(CONTENT.faq.some((f) => /Is there a size limit\?/.test(f.question) && f.answer.includes(n(MAX_INPUT_CHARS))), "the size question quotes the real cap", JSON.stringify(CONTENT.faq.find((f) => /size limit/.test(f.question))?.answer.slice(0, 60)));
  check(CONTENT.faq.some((f) => /type aliases, enums or generics/.test(f.question) && /^No\./.test(f.answer)), "the removed options are disclosed rather than left implied");
  check(!CONTENT.faq.some((f) => /Yes\. There's an option|there's an option to output type aliases/i.test(f.answer)), "no FAQ offers a type-alias mode again");

  check(CONTENT.relatedSlugs.includes("javascript-formatter"), "the tool links to the JavaScript formatter");
  check(CONTENT.relatedSlugs.includes("csv-json"), "the tool links to CSV to JSON");
  check(CONTENT.relatedSlugs.includes("json-formatter") && CONTENT.relatedSlugs.includes("json-viewer"), "the JSON-family links are kept");
  check(new Set(CONTENT.relatedSlugs).size === CONTENT.relatedSlugs.length, "no related tool is listed twice");
  check(
    REPO_CONTENT.TOOL_CONTENT["javascript-formatter"].relatedSlugs.includes("json-to-typescript"),
    "the JavaScript formatter links back, so the link is reciprocal",
    JSON.stringify(REPO_CONTENT.TOOL_CONTENT["javascript-formatter"].relatedSlugs),
  );
  check(
    REPO_CONTENT.TOOL_CONTENT["csv-json"].relatedSlugs.includes("json-to-typescript"),
    "CSV to JSON links back, so the link is reciprocal",
    JSON.stringify(REPO_CONTENT.TOOL_CONTENT["csv-json"].relatedSlugs),
  );
  check(
    REPO_CONTENT.TOOL_CONTENT["json-to-typescript"].relatedSlugs.length === CONTENT.relatedSlugs.length,
    "the shipped related list is the one that was checked",
  );

  check(!!GUIDE, "a guide exists for the tool");
  check(GUIDE.slug === "how-to-convert-json-to-typescript-types", "the guide slug says what it is", GUIDE.slug);
  check(GUIDE.toolSlug === "json-to-typescript", "the guide is attached to the json-to-typescript tool");
  check(GUIDE.readMinutes === 3, "the guide declares a reading time", String(GUIDE.readMinutes));
  check(GUIDE.sections.length === 4, "the guide has four sections", String(GUIDE.sections.length));
  check(GUIDE.sections.every((s) => s.paragraphs.length >= 2), "every section has at least two paragraphs", JSON.stringify(GUIDE.sections.map((s) => s.paragraphs.length)));
  check(/first draft/.test(GUIDE_TEXT), "the guide says the output is a first draft");
  check(GUIDE_TEXT.includes(`${n(MAX_INPUT_CHARS)} characters of pasted text`), "the guide quotes the real text cap", GUIDE_TEXT.includes("200,000 characters of pasted text") ? "" : "text differs");
  check(GUIDE_TEXT.includes(`${n(MAX_JSON_DEPTH)} nesting levels`), "the guide quotes the real depth cap");
  check(GUIDE_TEXT.includes(`${n(MAX_NODES)} values in the document`), "the guide quotes the real value cap");
  check(GUIDE_TEXT.includes(`${n(MAX_OUTPUT_CHARS)} characters of generated code`), "the guide quotes the real output cap");
  check(/the only thing that becomes optional/.test(GUIDE_TEXT), "the guide explains the optional rule");
  check(/JSON null is a value rather than a hole/.test(GUIDE_TEXT), "the guide explains the null rule");
  check(/Record<string, never>/.test(GUIDE_TEXT) && /unknown\[\]/.test(GUIDE_TEXT), "the guide explains the empty-object and empty-array rules");
  check(/no JSDoc, because a comment guessed from one value/.test(GUIDE_TEXT), "the guide says why there is no JSDoc");
  check(/no enums, no generics, no converters, and no type-alias mode/.test(GUIDE_TEXT), "the guide lists what is not produced");
  check(/nothing is uploaded/.test(GUIDE_TEXT), "the guide states the privacy position");
  check(GUIDE.keywords.length >= 5, "the guide carries its own keywords", String(GUIDE.keywords.length));
  check(!FORBIDDEN.some((re) => re.test(GUIDE_TEXT)), "the guide makes no false claim");
  check(!mentionsWithoutDenial(GUIDE_TEXT, "JSDoc"), "every mention of JSDoc in the guide denies it rather than claiming it");
  check(!CLAIMS_ENUM_OR_GENERIC.test(statementsOnly(GUIDE_TEXT)), "the guide never claims the output is an enum or a generic");
  check(REPO_GUIDES.getGuide("how-to-convert-json-to-typescript-types") !== undefined, "the guide resolves by slug");
  check(REPO_GUIDES.getGuidesByTool("json-to-typescript").length === 1, "exactly one guide resolves from the tool page", String(REPO_GUIDES.getGuidesByTool("json-to-typescript").length));

  // The copy, the guide and the code must agree about the caps, or one of them
  // is stale. The numbers are compared, not the sentences.
  const quoted = new Set();
  for (const text of [CONTENT.longDescription, CONTENT_TEXT, GUIDE_TEXT]) {
    for (const match of text.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g)) quoted.add(match[0]);
  }
  check(
    quoted.has(n(MAX_INPUT_CHARS)) && quoted.has(n(MAX_NODES)) && quoted.has(n(MAX_OUTPUT_CHARS)),
    "the shipped copy quotes the caps the module enforces, in the same grouping",
    [...quoted].join(" "),
  );
}

rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
