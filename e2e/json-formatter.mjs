// Node-side unit checks for JSON Formatter shared logic (src/lib/json-format.ts).
// Run: node --experimental-strip-types --test e2e/json-formatter.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatJson } from "../src/lib/json-format.ts";

test("2-space format is exact", () => {
  const r = formatJson('{"hello":"world","nested":[1,2,3]}', 2);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(
      r.formatted,
      '{\n  "hello": "world",\n  "nested": [\n    1,\n    2,\n    3\n  ]\n}'
    );
    assert.equal(r.minified, '{"hello":"world","nested":[1,2,3]}');
  }
});

test("4-space format switches indentation, minified unchanged", () => {
  const r = formatJson('{"a":1}', 4);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.formatted, '{\n    "a": 1\n}');
    assert.equal(r.minified, '{"a":1}');
  }
});

test("scalar JSON round-trips", () => {
  const r = formatJson('[true, null, "x", 2.5]', 2);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.minified, '[true,null,"x",2.5]');
  }
});

test("trailing comma reports line/column and strips the location clause", () => {
  const r = formatJson('{"a":1,}', 2);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.error.length > 0, `error: ${r.error}`);
    assert.ok(!r.error.includes("position"), `unexpected position clause: ${r.error}`);
    assert.equal(r.line, 1);
    assert.ok((r.column ?? 0) >= 8, `column: ${r.column}`);
  }
});

test("unquoted key reports line/column and strips location clause", () => {
  const r = formatJson("{a:1}", 2);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error, "Expected property name or '}' in JSON");
    assert.equal(r.line, 1);
    assert.equal(r.column, 2);
  }
});

test("truncated input points at the end of the document", () => {
  const r = formatJson('{"a":', 2);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.error.includes("Unexpected end of JSON input"));
    assert.equal(r.line, 1);
    assert.equal(r.column, 6);
  }
});

test("multi-line error position maps to the true line and column", () => {
  const input = '{\n  "a": 1,\n  "b": 2';
  const r = formatJson(input, 2);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.error.length > 0, `error: ${r.error}`);
    assert.ok(!r.error.includes("position"), `unexpected position clause: ${r.error}`);
    assert.equal(r.line, 3);
    assert.equal(r.column, 9);
  }
});

test("deeply nested JSON gets a friendly error, not a raw stack message", () => {
  const deep = "[".repeat(100000) + "0" + "]".repeat(100000);
  const r = formatJson(deep, 2);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.error.includes("nested too deeply"), `error: ${r.error}`);
    assert.equal(r.line, null);
    assert.equal(r.column, null);
  }
});

test("duplicate keys keep the last value and numbers normalize", () => {
  const r = formatJson('{"a":1,"a":2,"n":1e2,"big":9007199254740993}', 2);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.formatted, '{\n  "a": 2,\n  "n": 100,\n  "big": 9007199254740992\n}');
    assert.equal(r.minified, '{"a":2,"n":100,"big":9007199254740992}');
  }
});

test("whitespace-only input is treated as invalid JSON", () => {
  const r = formatJson("   ", 2);
  assert.equal(r.ok, false);
});