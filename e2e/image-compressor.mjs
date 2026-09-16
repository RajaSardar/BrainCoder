// Regression harness for Image Compressor pure logic (engine-level, node only).
// Canvas/browser paths are covered separately by e2e/image-compressor-browser.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { sniffImageMime, FORMATS, PRESETS } from "../src/features/image-compressor/compress-image.ts";

const u8 = (hex) => new Uint8Array(Buffer.from(hex, "hex"));

test("sniffImageMime detects each supported format from magic bytes", () => {
  const cases = [
    ["png", "89504e470d0a1a0a001122334455667788", "image/png"],
    ["jpeg", "ffd8ffe000104a4649460001", "image/jpeg"],
    ["webp", "52494646123456785745425020", "image/webp"],
    ["gif", "47494638396101000200", "image/gif"],
    ["bmp", "424d361000000000000000000000", "image/bmp"],
    ["avif", "000000206674797061766966", "image/avif"],
  ];
  for (const [ext, hex, mime] of cases) {
    const expected = ext === "jpeg" ? "jpg" : ext;
    const res = sniffImageMime(u8(hex));
    assert.equal(res.ext, expected, `${ext} ext`);
    assert.equal(res.mime, mime, `${ext} mime`);
  }
});

test("sniffImageMime falls back safely for unknown/corrupt/empty bytes", () => {
  assert.deepEqual(sniffImageMime(u8("00112233445566")), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(sniffImageMime(new Uint8Array(0)), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(sniffImageMime(u8("89504e47")), { mime: "image/png", ext: "png" });
});

test("sniffImageMime rejects short/truncated signatures", () => {
  assert.deepEqual(sniffImageMime(u8("89504e")), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(sniffImageMime(u8("ffd8")), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(sniffImageMime(u8("52494646")), { mime: "image/jpeg", ext: "jpg" });
});

test("FORMATS maps every concrete output format to a correct mime/ext", () => {
  assert.deepEqual(FORMATS.webp, { mime: "image/webp", ext: "webp" });
  assert.deepEqual(FORMATS.jpeg, { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(FORMATS.png, { mime: "image/png", ext: "png" });
  assert.deepEqual(FORMATS.avif, { mime: "image/avif", ext: "avif" });
});

test("PRESETS are quality-only and ordered light > balanced > strong", () => {
  assert.ok(PRESETS.light.quality > PRESETS.balanced.quality);
  assert.ok(PRESETS.balanced.quality > PRESETS.strong.quality);
  for (const preset of ["light", "balanced", "strong"]) {
    assert.equal(typeof PRESETS[preset].quality, "number");
    assert.ok(PRESETS[preset].quality > 0 && PRESETS[preset].quality <= 1);
  }
});