/**
 * JSON -> TypeScript types, as one pure call.
 *
 * No React and no DOM: the component renders whatever this returns and nothing
 * else. The shape inference lives in ./json-infer; this module owns the caps,
 * the error classification and the emission rules.
 *
 * The defect this file exists to close: the old emitter finished every
 * object-rooted document with `export type User = User;`, which is TS2300
 * "Duplicate identifier 'User'" and does not compile at all. Every output here is
 * checked before it is reported as a success — see `auditGeneratedNames`.
 */

import { inferJsonShape, type JsonShape } from "./json-infer";

/**
 * Pasted-input cap, checked before anything is parsed.
 *
 * At 200,000 characters the worst keystroke — re-inferring and re-emitting the
 * whole document — measures 8.96 ms, inside one 16.7 ms frame. The 2 MB cap the
 * JSON formatter uses costs 63-132 ms per character here, because inference is a
 * recursive walk rather than a re-serialisation.
 */
export const MAX_INPUT_CHARS = 200_000;

/**
 * Nesting cap. Depth 64 infers in 0.07 ms; the first non-branching overflow
 * boundary measured across engines is around 1400-2000. 64 is far below every one
 * of those and far above any JSON a person actually pastes.
 */
export const MAX_JSON_DEPTH = 64;

/**
 * Total-value cap for inference. A flat array of JSON zeros is the densest input
 * there is at roughly two characters per value, so for pasted text the character
 * cap above binds first; this is the structural guard that keeps the work bounded
 * whatever the input looks like, and it is what an array-of-objects merge is
 * measured against.
 */
export const MAX_NODES = 200_000;

/** Emitted-code cap. A merged array of objects can name far more fields than the input has characters. */
export const MAX_OUTPUT_CHARS = 400_000;

/**
 * TypeScript keywords, which cannot name a type at all. Checked against the
 * *typed* name in lower case rather than against the emitted name: `class` and
 * `Class` both want to say the same thing here, and the reader who typed either
 * one needs to hear why their name was not used.
 */
const RESERVED_KEYWORDS = new Set([
  "class", "interface", "type", "string", "number", "boolean", "any", "null",
  "undefined", "void", "enum", "const", "let", "var", "function", "return", "new",
  "delete", "default", "export", "import", "from", "as", "in", "instanceof",
  "typeof", "keyof", "readonly", "public", "private", "protected", "static",
  "declare", "abstract", "namespace", "module", "require", "yield", "await",
  "try", "catch", "finally", "throw", "with", "debugger", "this", "super",
  "extends", "implements", "package", "never", "object", "symbol", "bigint",
  "true", "false", "case", "switch", "break", "continue", "do", "else", "for",
  "if", "while",
]);

/**
 * Built-in type names an interface declaration would shadow. These are ordinary
 * legal identifiers, so the check is case-sensitive — but `Record` matters here
 * because this emitter itself writes `Record<string, never>`, and a local
 * interface of that name would stop the output compiling.
 *
 * Every entry is spelled as it appears in a type position AND as this emitter
 * emits it, because the check below runs on the PascalCase candidate, not on the
 * text the reader typed. A lowercase entry here could never match and would only
 * make the list look broader than it is: `globalThis` is a global *value*, and
 * typing it produces `export interface GlobalThis`, which shadows nothing and
 * compiles, so it is deliberately not refused.
 */
const SHADOWED_BUILTINS = new Set([
  "Record", "Readonly", "Partial", "Required", "ReadonlyArray", "Pick", "Omit",
  "Exclude", "Extract", "NonNullable", "ReturnType", "InstanceType", "Parameters",
  "ConstructorParameters", "Array",
]);

const FALLBACK_ROOT_NAME = "Root";

/** A bare member name needs no quotes; anything else is emitted as a string literal. */
const BARE_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Every identifier the emitter is allowed to put in a type position. */
const BUILTIN_TYPE_TOKENS = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "unknown",
  "never",
  "Record",
]);

export type JsonToTypeScriptResult =
  | { kind: "empty" }
  | { kind: "refused"; reason: "too-large" | "too-deep"; message: string }
  | { kind: "invalid-json"; message: string; line: number | null; column: number | null }
  | { kind: "internal"; message: string }
  | {
      kind: "generated";
      code: string;
      interfaceCount: number;
      fieldCount: number;
      problem: string | null;
    };

/**
 * `parseJsonShape` returns this union too: the component memoizes the inference
 * on the deferred input alone and re-emits on a rename, so the two halves are
 * separately callable.
 */
export type ParsedJsonShapeResult = JsonToTypeScriptResult | { kind: "parsed"; shape: JsonShape };

const n = (value: number): string => value.toLocaleString("en-US");

// ---------------------------------------------------------------------------
// names
// ---------------------------------------------------------------------------

/** `items` -> `Items`, `address-line` -> `AddressLine`, `""` -> `""`. */
function pascal(segment: string): string {
  const parts = segment.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let out = "";
  for (const part of parts) {
    out += part[0].toUpperCase() + part.slice(1);
  }
  return out;
}

/**
 * A legal PascalCase TypeScript identifier for a user-supplied root name, plus an
 * honest warning when the typed name could not be used as written.
 *
 * The warning is the point: silently substituting `Root` for a name the reader
 * typed would make the output look intentional when it is not.
 */
export function typeNameFor(raw: string): { name: string; warning: string | null } {
  const typed = raw.trim();
  if (typed === "") {
    return {
      name: FALLBACK_ROOT_NAME,
      warning: "No name was typed, so the root type is called Root.",
    };
  }
  const parts = typed.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const candidate = parts.map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  if (candidate === "") {
    return {
      name: FALLBACK_ROOT_NAME,
      warning: `“${typed}” has no letters or digits in it, so the root type is called Root.`,
    };
  }
  const keyword = typed.toLowerCase();
  if (RESERVED_KEYWORDS.has(keyword)) {
    return {
      name: FALLBACK_ROOT_NAME,
      warning: `“${typed}” is the TypeScript keyword “${keyword}”, so the root type is called Root. Rename it if you meant something else.`,
    };
  }
  const legal = /^[0-9]/.test(candidate) ? `_${candidate}` : candidate;
  if (SHADOWED_BUILTINS.has(legal)) {
    return {
      name: FALLBACK_ROOT_NAME,
      warning: `“${legal}” is a built-in TypeScript type name that an interface would shadow, so the root type is called Root. Rename it if you meant something else.`,
    };
  }
  return { name: legal, warning: null };
}

function typeNameForRoot(raw: string): string {
  return typeNameFor(raw).name;
}

// ---------------------------------------------------------------------------
// emission
// ---------------------------------------------------------------------------

interface Emitted {
  code: string;
  interfaceCount: number;
  fieldCount: number;
  problem: string | null;
}

/**
 * Turns one shape into declarations. Every nested object gets its own
 * `export interface`; the root name is reserved before anything else is named,
 * so a key that happens to equal the root name cannot steal it.
 */
class Emitter {
  private readonly used = new Set<string>();
  private readonly blocks: string[] = [];
  private readonly declared: string[] = [];
  private readonly referenced: string[] = [];
  private fieldCount = 0;

  constructor(rootName: string) {
    this.used.add(rootName);
  }

  emitRoot(shape: JsonShape, rootName: string): Emitted {
    const code = this.renderRoot(shape, rootName);
    return {
      code,
      interfaceCount: this.declared.length,
      fieldCount: this.fieldCount,
      problem: auditGeneratedNames(code, this.declared, this.referenced),
    };
  }

  private renderRoot(shape: JsonShape, rootName: string): string {
    if (shape.kind === "object" && shape.fields.length > 0) {
      // The root interface IS the declaration. The old code additionally emitted
      // `export type User = User;`, which is TS2300 and does not compile.
      this.declared.push(rootName);
      this.interfaceFor(rootName, shape);
      return this.blocks.join("\n\n");
    }
    if (shape.kind === "array") {
      return [
        `export type ${rootName} = ${this.wrapArrayElement(shape.of, rootName)}[];`,
        ...this.blocks,
      ].join("\n\n");
    }
    // A scalar root — and an empty object root, which is `Record<string, never>`.
    return [`export type ${rootName} = ${this.typeOf(shape, rootName)};`, ...this.blocks].join("\n\n");
  }

  /** A type expression for `shape`, synthesising an interface for each object. */
  private typeOf(shape: JsonShape, hint: string): string {
    switch (shape.kind) {
      case "null":
      case "string":
      case "number":
      case "boolean":
      case "unknown":
        return shape.kind;
      case "array":
        return `${this.wrapArrayElement(shape.of, hint)}[]`;
      case "object":
        // An object with no fields is not a member-less interface: an interface
        // with no members accepts every object, which is the opposite of `{}`.
        if (shape.fields.length === 0) return "Record<string, never>";
        return this.interfaceNamed(hint, shape);
      case "union":
        // A union member that is an object gets a real interface name. Joining
        // internal node-kind tags here is what used to emit a bare `array` and
        // produce TS2304 "Cannot find name 'array'".
        return shape.of.map((member) => this.typeOf(member, `${hint}Variant`)).join(" | ");
    }
  }

  /**
   * `(A | B)[]` needs the parentheses; everything else in an array type position
   * binds tightly enough without them.
   */
  private wrapArrayElement(of: JsonShape, hint: string): string {
    const rendered = this.typeOf(of, itemHint(hint));
    return of.kind === "union" ? `(${rendered})` : rendered;
  }

  /** Allocate a name for an object shape, emit its interface, and return the name. */
  private interfaceNamed(hint: string, shape: Extract<JsonShape, { kind: "object" }>): string {
    const name = this.allocate(hint === "" ? "Type" : hint);
    this.declared.push(name);
    this.referenced.push(name);
    this.interfaceFor(name, shape);
    return name;
  }

  private allocate(base: string): string {
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let i = 2;
    while (this.used.has(`${base}_${i}`)) i += 1;
    const name = `${base}_${i}`;
    this.used.add(name);
    return name;
  }

  /** One `export interface` block. Children are registered after their parent. */
  private interfaceFor(name: string, shape: Extract<JsonShape, { kind: "object" }>): string {
    const index = this.blocks.length;
    this.blocks.push("");
    const usedMembers = new Set<string>();
    const lines: string[] = [];
    for (const field of shape.fields) {
      const member = this.memberName(field.key, usedMembers);
      const type = this.typeOf(field.shape, fieldHint(name, field.key));
      this.fieldCount += 1;
      lines.push(`  ${member}${field.optional ? "?" : ""}: ${type};`);
    }
    this.blocks[index] = `export interface ${name} {\n${lines.join("\n")}\n}`;
    return this.blocks[index];
  }

  /**
   * A member name: the JSON key verbatim when it is already a legal identifier,
   * otherwise the sanitized key as a string literal. Two keys that sanitize alike
   * (`"a b"` and `"a-b"` both give `a_b`) are disambiguated deterministically as
   * `a_b` and `a_b_2` rather than becoming a duplicate member.
   */
  private memberName(key: string, used: Set<string>): string {
    const bare = BARE_IDENTIFIER.test(key);
    const candidate = bare ? key : sanitizeMember(key);
    let name = candidate;
    let i = 2;
    while (used.has(name)) {
      name = `${candidate}_${i}`;
      i += 1;
    }
    used.add(name);
    return bare ? name : `"${name}"`;
  }
}

function itemHint(hint: string): string {
  return hint.endsWith("Item") ? `${hint}Element` : `${hint}Item`;
}

function fieldHint(parentName: string, key: string): string {
  const segment = pascal(key);
  return segment === "" ? `${parentName}Field` : parentName + segment;
}

function sanitizeMember(key: string): string {
  const cleaned = key.replace(/[^A-Za-z0-9_$]+/g, "_");
  if (cleaned === "") return "_";
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

/**
 * The self-check. Success is only reported for code that resolves: every declared
 * interface appears exactly once, and every identifier in a type position is
 * either a declaration or a TypeScript builtin.
 *
 * This exists because the old UI showed a green "Generated" badge on output that
 * contained an unresolvable `array` type, which nobody could compile.
 */
function auditGeneratedNames(
  code: string,
  declared: string[],
  referenced: string[],
): string | null {
  const duplicates = declared.filter((name, i) => declared.indexOf(name) !== i);
  if (duplicates.length > 0) {
    return `the emitted names are not unique (${[...new Set(duplicates)].join(", ")}) — rename the root type`;
  }
  const declaredSet = new Set(declared);
  const missing = [...new Set(referenced.filter((name) => !declaredSet.has(name)))];
  if (missing.length > 0) {
    return `the output refers to ${missing.join(", ")}, which is not declared — rename the root type`;
  }

  // A lexical sweep over the produced text, so a mistake in the emitter itself —
  // a bare node-kind tag, a typo — cannot reach the page as a "Generated" result.
  const lines = code.split("\n");
  const declaredInCode: string[] = [];
  for (const line of lines) {
    const declaration = /^(?:export interface|export type) ([A-Za-z_$][A-Za-z0-9_$]*)/.exec(line);
    if (declaration) declaredInCode.push(declaration[1]);
  }
  const known = new Set([...declaredInCode, ...BUILTIN_TYPE_TOKENS]);
  const stray: string[] = [];
  for (const line of lines) {
    let rest: string | null = null;
    const declaration = /^(?:export interface|export type) ([A-Za-z_$][A-Za-z0-9_$]*)/.exec(line);
    if (declaration) {
      rest = line.slice(declaration[0].length);
    } else if (/^ {2}\S/.test(line)) {
      rest = line.replace(/^ {2}(?:"[^"]*"|[A-Za-z_$][A-Za-z0-9_$]*)\??: /, "");
    }
    if (rest === null) continue;
    for (const token of rest.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
      if (known.has(token) || stray.includes(token)) continue;
      stray.push(token);
    }
  }
  if (stray.length > 0) {
    return `${stray.join(", ")} ${stray.length === 1 ? "is not a type this page can produce" : "are not types this page can produce"} — the root name is probably a reserved word`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// error classification
// ---------------------------------------------------------------------------

const SYNTAX_POSITION = /at position (\d+)/;
const SYNTAX_LINE_COLUMN = /\(line (\d+) column (\d+)\)/;

/**
 * V8 puts the failure somewhere in the message and nowhere else, so both shapes
 * are read: `at position N (line L column C)` on a single line and
 * `(line L column C)` after a multi-line document.
 */
function classifySyntaxError(raw: string, message: string): JsonToTypeScriptResult {
  const lineColumn = SYNTAX_LINE_COLUMN.exec(message);
  const position = SYNTAX_POSITION.exec(message);
  let line = lineColumn ? Number(lineColumn[1]) : null;
  let column = lineColumn ? Number(lineColumn[2]) : null;

  if (line === null) {
    let offset = position ? Number(position[1]) : null;
    if (offset === null && /Unexpected end of JSON input/.test(message)) offset = raw.length;
    if (offset !== null) {
      const before = raw.slice(0, offset);
      line = before.split("\n").length;
      column = offset - before.lastIndexOf("\n");
    }
  }

  return { kind: "invalid-json", message: tidySyntaxMessage(message), line, column };
}

/** Drop the position clause V8 appends; the line and column travel separately. */
function tidySyntaxMessage(message: string): string {
  const cleaned = message
    .replace(/ at position \d+ \(line \d+ column \d+\)$/, "")
    .replace(/ \(line \d+ column \d+\)$/, "")
    .replace(/ at position \d+$/, "")
    .trim();
  return cleaned === "" ? "This is not valid JSON." : cleaned;
}

/**
 * An unexpected failure inside this page. The wording deliberately never blames
 * the reader's JSON: an internal `RangeError: Maximum call stack size exceeded`
 * used to be rendered as if the pasted JSON were malformed, which sent people
 * looking for a typo they had not made.
 */
function internalMessage(error: unknown): string {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return `This page hit an unexpected internal error while generating types (${detail}), so nothing was converted. The fault is in the tool, not in what you pasted — your JSON is still in the box.`;
}

// ---------------------------------------------------------------------------
// entry points
// ---------------------------------------------------------------------------

/**
 * Cap, then parse, then infer. Split from the emission so the component can memoize
 * the expensive half against the deferred input alone: renaming the root type must
 * not re-walk the whole document.
 */
export function parseJsonShape(raw: string): ParsedJsonShapeResult {
  // The cap is checked before a single byte is parsed.
  if (raw.length > MAX_INPUT_CHARS) {
    return {
      kind: "refused",
      reason: "too-large",
      message: `This input is ${n(raw.length)} characters — the cap is ${n(MAX_INPUT_CHARS)}, and nothing was converted.`,
    };
  }
  if (raw.trim() === "") return { kind: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return classifySyntaxError(raw, error.message);
    }
    if (error instanceof RangeError) {
      return {
        kind: "refused",
        reason: "too-deep",
        message: `This JSON is nested too deeply for the browser's own parser to read (${error.message}), and nothing was converted.`,
      };
    }
    return { kind: "internal", message: internalMessage(error) };
  }

  try {
    return { kind: "parsed", shape: inferJsonShape(parsed, { maxDepth: MAX_JSON_DEPTH, maxNodes: MAX_NODES }) };
  } catch (error) {
    if (error instanceof RangeError) {
      return { kind: "refused", reason: "too-deep", message: error.message };
    }
    return { kind: "internal", message: internalMessage(error) };
  }
}

/** Emit declarations for an already-inferred shape, then check they resolve. */
export function emitTypeScript(shape: JsonShape, rootName: string): JsonToTypeScriptResult {
  const name = typeNameForRoot(rootName);
  try {
    const emitter = new Emitter(name);
    const emitted = emitter.emitRoot(shape, name);
    if (emitted.code.length > MAX_OUTPUT_CHARS) {
      return {
        kind: "refused",
        reason: "too-large",
        message: `The types this JSON implies would be ${n(emitted.code.length)} characters — the cap is ${n(MAX_OUTPUT_CHARS)}, and nothing was converted. A shorter sample, or one whose array elements share their keys, stays under it.`,
      };
    }
    return {
      kind: "generated",
      code: emitted.code,
      interfaceCount: emitted.interfaceCount,
      fieldCount: emitted.fieldCount,
      problem: emitted.problem,
    };
  } catch (error) {
    if (error instanceof RangeError) {
      return { kind: "refused", reason: "too-deep", message: error.message };
    }
    return { kind: "internal", message: internalMessage(error) };
  }
}

/** The whole conversion in one call: cap, parse, infer, emit, verify. */
export function jsonToTypeScript(raw: string, rootName: string): JsonToTypeScriptResult {
  const parsed = parseJsonShape(raw);
  if (parsed.kind !== "parsed") return parsed;
  return emitTypeScript(parsed.shape, rootName);
}
