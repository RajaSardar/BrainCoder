// Node-side unit checks for Image Resizer shared logic (src/lib/format.ts).
// Run: node --experimental-strip-types --test e2e/image-resizer.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBytes } from "../src/lib/format.ts";

test("formatBytes handles tiny sizes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1), "1.0 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
});

test("formatBytes handles large sizes", () => {
  assert.equal(formatBytes(1024 * 1024), "1.0 MB");
  assert.equal(formatBytes(1024 * 1024 * 1024), "1.0 GB");
});

test("formatBytes clamps beyond the GB unit instead of emitting 'undefined'", () => {
  const t = formatBytes(1024 ** 4);
  assert.ok(!t.includes("undefined"), `got: ${t}`);
  assert.equal(t, "1024.0 GB");
});