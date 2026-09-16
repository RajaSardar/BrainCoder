// Run: node --experimental-strip-types e2e/pdf-compressor.mjs
// In-memory engine/client regressions only; no server or browser lifecycle changes.
import assert from "node:assert/strict";
import { setImmediate as tick } from "node:timers/promises";
import { test, after } from "node:test";
import {
  PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFHexString, PDFString,
  PDFBool, PDFNull, decodePDFRawStream,
} from "pdf-lib";
import { zlibSync } from "fflate";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { createCanvas, loadImage, ImageData, DOMMatrix, Path2D } from "@napi-rs/canvas";
import { compressInPlace, compressStructural } from "../src/features/pdf-compressor/compressor.ts";
import { compressPdfClient } from "../src/features/pdf-compressor/client-compressor.ts";

const originalGlobals = new Map(["OffscreenCanvas", "createImageBitmap", "ImageData", "DOMMatrix", "Path2D", "Worker", "document"].map((key) => [key, globalThis[key]]));
const canvases = [];
let liveBitmaps = 0;
let peakBitmaps = 0;
let decodeCalls = 0;
let failContext = false;
let failEncoding = false;
class CanvasAdapter {
  constructor(width, height) {
    this.native = createCanvas(width, height);
    this.w = width;
    this.h = height;
    canvases.push(this);
  }
  get width() { return this.w; }
  set width(value) { this.w = value; this.native.width = Math.max(1, value); }
  get height() { return this.h; }
  set height(value) { this.h = value; this.native.height = Math.max(1, value); }
  getContext() {
    if (failContext) return null;
    const ctx = this.native.getContext("2d");
    return {
      drawImage: (source, ...args) => ctx.drawImage(source.native ?? source, ...args),
      putImageData: (...args) => ctx.putImageData(...args),
    };
  }
  async convertToBlob({ quality }) {
    if (failEncoding) throw new Error("Injected encoder failure");
    return new Blob([await this.native.encode("jpeg", Math.round(quality * 100))], { type: "image/jpeg" });
  }
}
globalThis.OffscreenCanvas = CanvasAdapter;
globalThis.ImageData = ImageData;
globalThis.DOMMatrix = DOMMatrix;
globalThis.Path2D = Path2D;
globalThis.createImageBitmap = async (blob) => {
  decodeCalls++;
  const image = await loadImage(Buffer.from(await blob.arrayBuffer()));
  liveBitmaps++;
  peakBitmaps = Math.max(peakBitmaps, liveBitmaps);
  image.close = () => { liveBitmaps--; };
  return image;
};

const name = PDFName.of;
const buffer = (bytes) => new Uint8Array(bytes).buffer;
function noise(length) {
  const bytes = new Uint8Array(length);
  let seed = 123456;
  for (let i = 0; i < length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    bytes[i] = seed & 255;
  }
  return bytes;
}
const native = createCanvas(2400, 1000);
const rgba = noise(2400 * 1000 * 4);
for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
native.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), 2400, 1000), 0, 0);
const profiledJpeg = new Uint8Array(await native.encode("jpeg", 98));
// Skia adds an sRGB ICC APP2 segment. Build an explicit unprofiled DeviceRGB source.
const jpegParts = [profiledJpeg.subarray(0, 2)];
for (let offset = 2; offset < profiledJpeg.length;) {
  const marker = profiledJpeg[offset + 1];
  if (marker === 0xda) { jpegParts.push(profiledJpeg.subarray(offset)); break; }
  const length = profiledJpeg[offset + 2] * 256 + profiledJpeg[offset + 3];
  if (marker !== 0xe2) jpegParts.push(profiledJpeg.subarray(offset, offset + length + 2));
  offset += length + 2;
}
const largeJpeg = new Uint8Array(Buffer.concat(jpegParts));
native.width = native.height = 1;

async function fixture({ jpeg = false, mutate, compact = false, count = 1 } = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Keep document metadata");
  pdf.addPage([612, 792]).drawText("Selectable PDF regression text");
  pdf.addPage([300, 400]).drawText("Second page preserved");
  const refs = [];
  for (let index = 0; index < count; index++) {
    const dict = pdf.context.obj({
      Type: "XObject", Subtype: "Image", Width: jpeg ? 2400 : 128,
      Height: jpeg ? 1000 : 128, BitsPerComponent: 8, ColorSpace: "DeviceRGB",
      Filter: jpeg ? "DCTDecode" : "FlateDecode", StructParent: 9, Interpolate: true,
      Intent: "RelativeColorimetric",
    });
    dict.set(name("OC"), pdf.context.register(pdf.context.obj({ Type: "OCG", Name: PDFString.of("Photo layer") })));
    const stream = PDFRawStream.of(dict, jpeg ? largeJpeg : zlibSync(noise(128 * 128 * 3)));
    const ref = pdf.context.register(stream);
    refs.push(ref);
    pdf.getPage(0).node.setXObject(name(`Photo${index}`), ref);
    if (mutate) await mutate(pdf, stream, ref);
  }
  const bytes = await pdf.save({ useObjectStreams: compact });
  return { bytes, refs };
}

async function runFixture(options) {
  const source = await fixture(options);
  const before = await PDFDocument.load(source.bytes, { updateMetadata: false });
  const result = await compressInPlace(buffer(source.bytes), "strong");
  assert.ok(result.bytes.length <= source.bytes.length, "output must never grow");
  assert.equal(result.pagesProcessed, 2);
  const after = await PDFDocument.load(result.bytes, { updateMetadata: false });
  assert.equal(after.getPageCount(), 2);
  assert.equal(after.getTitle(), before.getTitle());
  assert.deepEqual(after.getPages().map((page) => page.getSize()), before.getPages().map((page) => page.getSize()));
  for (let index = 0; index < 2; index++) {
    const oldPage = before.getPage(index).node;
    const newPage = after.getPage(index).node;
    const oldContents = oldPage.Contents();
    const newContents = newPage.Contents();
    assert.equal(newContents.size(), oldContents.size());
    for (let item = 0; item < oldContents.size(); item++) {
      assert.deepEqual(decodePDFRawStream(newContents.lookup(item)).decode(), decodePDFRawStream(oldContents.lookup(item)).decode(), "page drawing/text operators unchanged");
    }
    assert.equal(newPage.Resources().lookup(name("Font")).toString(), oldPage.Resources().lookup(name("Font")).toString());
  }
  assert.equal(liveBitmaps, 0, "all decoded bitmaps closed");
  assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0), "all canvases released");
  return { ...source, before, after, result };
}

await test("JPEG downsampling writes actual encoded dimensions and preserves image dictionary semantics", async () => {
  const { after, before, refs, result } = await runFixture({ jpeg: true });
  assert.equal(result.imagesRecompressed, 1);
  const image = after.context.lookup(refs[0]);
  const decoded = await loadImage(Buffer.from(image.contents));
  assert.equal(decoded.width, 1200);
  assert.equal(decoded.height, 500);
  assert.equal(image.dict.lookup(name("Width")).asNumber(), decoded.width);
  assert.equal(image.dict.lookup(name("Height")).asNumber(), decoded.height);
  for (const key of ["OC", "StructParent", "Interpolate", "Intent"]) {
    assert.equal(image.dict.get(name(key)).toString(), before.context.lookup(refs[0]).dict.get(name(key)).toString());
  }
});

await test("multiple images decode sequentially", async () => {
  peakBitmaps = 0;
  const { result } = await runFixture({ jpeg: true, count: 3 });
  assert.equal(result.imagesRecompressed, 3);
  assert.equal(peakBitmaps, 1);
});

for (const colors of ["DeviceRGB", "DeviceGray"]) {
  await test(`resolved ${colors}, single filter array and default Flate params supported`, async () => {
    const { result, after, refs } = await runFixture({ mutate(pdf, stream) {
      stream.dict.set(name("ColorSpace"), pdf.context.register(name(colors)));
      stream.dict.set(name("Filter"), pdf.context.obj(["FlateDecode"]));
      stream.dict.set(name("DecodeParms"), pdf.context.obj([{ Predictor: 1, Colors: 1, BitsPerComponent: 8, Columns: 1 }]));
      if (colors === "DeviceGray") stream.contents = zlibSync(noise(128 * 128));
    } });
    assert.equal(result.imagesRecompressed, 1);
    assert.equal(after.context.lookup(refs[0]).dict.lookup(name("ColorSpace")), name("DeviceRGB"));
    assert.equal(after.context.lookup(refs[0]).dict.has(name("DecodeParms")), false);
  });
}

const unsupported = [
  ["CMYK", (pdf, s) => s.dict.set(name("ColorSpace"), name("DeviceCMYK"))],
  ["ICCBased", (pdf, s) => s.dict.set(name("ColorSpace"), pdf.context.obj(["ICCBased", pdf.context.register(pdf.context.stream(noise(64), { N: 3 }))]))],
  ["Indexed", (pdf, s) => s.dict.set(name("ColorSpace"), pdf.context.obj(["Indexed", "DeviceRGB", 255, PDFHexString.of("00")]))],
  ["named color resource", (pdf, s) => s.dict.set(name("ColorSpace"), name("Cs1"))],
  ["missing color", (pdf, s) => s.dict.delete(name("ColorSpace"))],
  ["array color space", (pdf, s) => s.dict.set(name("ColorSpace"), pdf.context.obj(["DeviceRGB"]))],
  ["default RGB override", (pdf) => pdf.getPage(0).node.Resources().set(name("ColorSpace"), pdf.context.obj({ DefaultRGB: ["CalRGB", {}] }))],
  ["default Gray override", (pdf) => pdf.getPage(0).node.Resources().set(name("ColorSpace"), pdf.context.obj({ DefaultGray: ["CalGray", {}] }))],
  ["16-bit", (pdf, s) => s.dict.set(name("BitsPerComponent"), PDFNumber.of(16))],
  ["missing bit depth", (pdf, s) => s.dict.delete(name("BitsPerComponent"))],
  ["filter chain", (pdf, s) => s.dict.set(name("Filter"), pdf.context.obj(["ASCII85Decode", "FlateDecode"]))],
  ["unknown filter", (pdf, s) => s.dict.set(name("Filter"), name("JPXDecode"))],
  ["Decode", (pdf, s) => s.dict.set(name("Decode"), pdf.context.obj([1, 0, 1, 0, 1, 0]))],
  ["PNG predictor", (pdf, s) => s.dict.set(name("DecodeParms"), pdf.context.obj({ Predictor: 12, Columns: 128, Colors: 3 }))],
  ["TIFF predictor", (pdf, s) => s.dict.set(name("DecodeParms"), pdf.context.obj({ Predictor: 2 }))],
  ["nondefault predictor params", (pdf, s) => s.dict.set(name("DecodeParms"), pdf.context.obj({ Columns: 128 }))],
  ["unknown DecodeParms", (pdf, s) => s.dict.set(name("DecodeParms"), pdf.context.obj({ ColorTransform: 0 }))],
  ["malformed DecodeParms", (pdf, s) => s.dict.set(name("DecodeParms"), name("Invalid"))],
  ["multiple DecodeParms", (pdf, s) => s.dict.set(name("DecodeParms"), pdf.context.obj([{}, {}]))],
  ["misplaced Predictor", (pdf, s) => s.dict.set(name("Predictor"), PDFNumber.of(12))],
  ["image mask parent", (pdf, s) => s.dict.set(name("ImageMask"), PDFBool.True)],
  ["color key mask", (pdf, s) => s.dict.set(name("Mask"), pdf.context.obj([0, 0, 0, 0, 0, 0]))],
  ["zero dimension", (pdf, s) => s.dict.set(name("Width"), PDFNumber.of(0))],
  ["negative dimension", (pdf, s) => s.dict.set(name("Height"), PDFNumber.of(-1))],
  ["fractional dimension", (pdf, s) => s.dict.set(name("Width"), PDFNumber.of(1.5))],
  ["dimension limit", (pdf, s) => s.dict.set(name("Width"), PDFNumber.of(20_000))],
  ["pixel budget", (pdf, s) => { s.dict.set(name("Width"), PDFNumber.of(4000)); s.dict.set(name("Height"), PDFNumber.of(4000)); }],
  ["external stream", (pdf, s) => s.dict.set(name("F"), PDFString.of("external.bin"))],
  ["truncated Flate pixels", (pdf, s) => { s.contents = zlibSync(noise(10)); }],
  ["oversize Flate inflation", (pdf, s) => { s.contents = zlibSync(new Uint8Array(4 * 1024 * 1024)); }],
];
for (const [label, mutate] of unsupported) {
  await test(`${label} is skipped with original stream and dictionary intact`, async () => {
    const calls = decodeCalls;
    const allocations = canvases.length;
    const { before, after, refs, result } = await runFixture({ mutate });
    assert.equal(result.imagesRecompressed, 0);
    assert.equal(result.skippedImages, 1);
    const old = before.context.lookup(refs[0]);
    const current = after.context.lookup(refs[0]);
    assert.deepEqual(current.contents, old.contents);
    assert.equal(current.dict.toString(), old.dict.toString());
    assert.equal(decodeCalls, calls);
    assert.equal(canvases.length, allocations);
  });
}

for (const key of ["SMask", "Mask"]) {
  await test(`precollects referenced /${key} objects before their parents`, async () => {
    const { result, after, before } = await runFixture({ mutate(pdf, mask, maskRef) {
      mask.dict.set(name("ColorSpace"), name("DeviceGray"));
      mask.contents = zlibSync(noise(128 * 128));
      const parent = pdf.context.stream(zlibSync(noise(128 * 128 * 3)), {
        Type: "XObject", Subtype: "Image", Width: 128, Height: 128,
        BitsPerComponent: 8, ColorSpace: "DeviceRGB", Filter: "FlateDecode", [key]: maskRef,
      });
      const parentRef = pdf.context.register(parent);
      pdf.getPage(0).node.setXObject(name("Parent"), parentRef);
    } });
    assert.equal(result.skippedImages, 2);
    assert.equal(result.imagesRecompressed, 0);
    for (const [ref, obj] of before.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream && obj.dict.lookup(name("Subtype")) === name("Image")) {
        assert.deepEqual(after.context.lookup(ref).contents, obj.contents);
        assert.equal(after.context.lookup(ref).dict.toString(), obj.dict.toString());
      }
    }
  });
}

for (const [label, mutate] of [
  ["dimension mismatch", (pdf, s) => s.dict.set(name("Width"), PDFNumber.of(100))],
  ["CMYK declaration", (pdf, s) => s.dict.set(name("ColorSpace"), name("DeviceCMYK"))],
  ["component mismatch", (pdf, s) => s.dict.set(name("ColorSpace"), name("DeviceGray"))],
  ["color transform override", (pdf, s) => s.dict.set(name("DecodeParms"), pdf.context.obj({ ColorTransform: 0 }))],
  ["embedded ICC profile", (pdf, s) => { s.contents = profiledJpeg; }],
  ["EXIF segment", (pdf, s) => { s.contents = new Uint8Array([255, 216, 255, 225, 0, 2, ...largeJpeg.subarray(2, 500)]); }],
]) {
  await test(`JPEG ${label} rejected before browser decoding`, async () => {
    const calls = decodeCalls;
    const { result } = await runFixture({ jpeg: true, mutate });
    assert.equal(result.imagesRecompressed, 0);
    assert.equal(result.skippedImages, 1);
    assert.equal(decodeCalls, calls);
  });
}

await test("Flate reader cancels immediately when output exceeds expected size", async () => {
  const original = globalThis.DecompressionStream;
  let reads = 0;
  let cancelled = false;
  globalThis.DecompressionStream = class {
    constructor() {
      this.writable = new WritableStream();
      this.readable = new ReadableStream({
        pull(controller) { reads++; controller.enqueue(new Uint8Array(60_000)); },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 });
    }
  };
  try {
    const { result } = await runFixture();
    assert.equal(result.skippedImages, 1);
    assert.equal(reads, 1);
    assert.equal(cancelled, true);
  } finally { globalThis.DecompressionStream = original; }
});

for (const failure of ["context", "encoding"]) {
  await test(`bitmap/canvas released on ${failure} failure`, async () => {
    failContext = failure === "context";
    failEncoding = failure === "encoding";
    try {
      const { result } = await runFixture({ jpeg: true });
      assert.equal(result.skippedImages, 1);
    } finally { failContext = failEncoding = false; }
  });
}

await test("HTML canvas fallback also downscales and releases allocations", async () => {
  globalThis.OffscreenCanvas = undefined;
  // A wrapper avoids inheriting the OffscreenCanvas-only method.
  globalThis.document = { createElement: () => {
    const canvas = new CanvasAdapter(1, 1);
    return {
      get width() { return canvas.width; }, set width(v) { canvas.width = v; },
      get height() { return canvas.height; }, set height(v) { canvas.height = v; },
      native: canvas.native,
      getContext: () => canvas.getContext(),
      toBlob: (callback, type, quality) => canvas.convertToBlob({ quality }).then(callback),
    };
  } };
  try {
    const { result, after, refs } = await runFixture({ jpeg: true });
    assert.equal(result.imagesRecompressed, 1);
    assert.equal(after.context.lookup(refs[0]).dict.lookup(name("Width")).asNumber(), 1200);
  } finally { globalThis.OffscreenCanvas = CanvasAdapter; }
});

for (const algorithm of ["AES-256", "RC4"]) {
  for (const password of ["secret", ""]) {
    await test(`${algorithm} encrypted input (${password ? "user" : "owner-only"}) rejected`, async () => {
      const pdf = await PDFDocument.create();
      pdf.addPage().drawText("Encrypted text");
      const encrypted = await encryptPDF(await pdf.save(), password, { algorithm, ownerPassword: "owner-secret" });
      for (const compress of [compressInPlace, compressStructural]) {
        await assert.rejects(compress(buffer(encrypted), "balanced"), /encrypted/i);
      }
    });
  }
}

for (const direct of [true, false]) {
  await test(`${direct ? "direct" : "indirect"} populated signature rejected before image mutation`, async () => {
    const { bytes } = await fixture({ jpeg: true, mutate(pdf) {
      const signature = pdf.context.obj({ Type: "Sig", ByteRange: [0, 100, 200, 100], Contents: PDFHexString.of("30820100") });
      const field = pdf.context.obj({ FT: "Sig", T: PDFString.of("Signature"), V: direct ? signature : pdf.context.register(signature) });
      pdf.catalog.set(name("AcroForm"), pdf.context.obj({ Fields: [pdf.context.register(field)] }));
    } });
    const calls = decodeCalls;
    for (const compress of [compressInPlace, compressStructural]) await assert.rejects(compress(buffer(bytes), "strong"), /signed/i);
    assert.equal(decodeCalls, calls);
  });
}

await test("empty signature field is not treated as a signed document", async () => {
  const { result } = await runFixture({ mutate(pdf) {
    const field = pdf.context.obj({ FT: "Sig", T: PDFString.of("Unsigned"), V: PDFNull });
    pdf.catalog.set(name("AcroForm"), pdf.context.obj({ Fields: [pdf.context.register(field)] }));
  } });
  assert.equal(result.imagesRecompressed, 1);
});

await test("already compact text PDF returns exact original bytes and actual page count", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Text remains selectable");
  pdf.addPage();
  const bytes = await pdf.save();
  for (const compress of [compressInPlace, compressStructural]) {
    const result = await compress(buffer(bytes), "balanced");
    assert.equal(result.method, "none");
    assert.equal(result.pagesProcessed, 2);
    assert.equal(result.imagesRecompressed, 0);
    assert.equal(result.reductionPct, 0);
    assert.deepEqual(result.bytes, bytes);
  }
});

await test("whole-document growth discards otherwise useful image recompression", async () => {
  const { bytes } = await fixture();
  const originalSave = PDFDocument.prototype.save;
  const calls = canvases.length;
  PDFDocument.prototype.save = async function (options) {
    const saved = await originalSave.call(this, options);
    const padded = new Uint8Array(bytes.length + 100);
    padded.set(saved);
    return padded;
  };
  try {
    const result = await compressInPlace(buffer(bytes), "strong");
    assert.ok(canvases.length > calls);
    assert.equal(result.method, "none");
    assert.equal(result.imagesRecompressed, 0);
    assert.equal(result.skippedImages, 1);
    assert.equal(result.pagesProcessed, 2);
    assert.deepEqual(result.bytes, bytes);
  } finally { PDFDocument.prototype.save = originalSave; }
});

await test("image encoding with no stream savings leaves original image intact", async () => {
  const { result, before, after, refs } = await runFixture({ mutate(pdf, stream) {
    stream.contents = zlibSync(new Uint8Array(128 * 128 * 3));
  } });
  assert.equal(result.imagesRecompressed, 0);
  assert.equal(result.skippedImages, 1);
  assert.deepEqual(after.context.lookup(refs[0]).contents, before.context.lookup(refs[0]).contents);
});

await test("useful structural savings preserve metadata, page operators, and fonts", async () => {
  const { result } = await runFixture({ count: 0 });
  assert.equal(result.method, "structural");
  assert.ok(result.bytes.length < result.originalSize);
});

await test("text independently extractable with PDF.js after image compression", async () => {
  const { result } = await runFixture({ jpeg: true });
  assert.equal(result.imagesRecompressed, 1);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(result.bytes), useSystemFonts: true });
  try {
    const doc = await task.promise;
    assert.equal(doc.numPages, 2);
    const text = await (await doc.getPage(1)).getTextContent();
    assert.ok(text.items.some((item) => item.str === "Selectable PDF regression text"));
  } finally { await task.destroy(); }
});

await test("invalid, empty, oversize input and invalid preset rejected", async () => {
  await assert.rejects(compressInPlace(buffer(new TextEncoder().encode("not a PDF")), "light"));
  await assert.rejects(compressInPlace(new ArrayBuffer(0), "light"), /non-empty/i);
  await assert.rejects(compressInPlace(new ArrayBuffer(100 * 1024 * 1024 + 1), "light"), /100 MiB/);
  await assert.rejects(compressInPlace(new ArrayBuffer(1), "invalid"), /preset/);
});

const workers = [];
let workerMode = "normal";
class FakeWorker {
  constructor() {
    if (workerMode === "constructor-error") throw new Error("Constructor failed");
    this.listeners = new Map();
    this.terminated = false;
    workers.push(this);
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
  postMessage(message, transfer) {
    if (workerMode === "post-error") throw new Error("Post failed");
    this.request = message;
    assert.equal(transfer[0], message.buffer);
  }
  terminate() { this.terminated = true; }
  emit(type, data) { this.listeners.get(type)?.(type === "message" ? { data } : data); }
}
globalThis.Worker = FakeWorker;
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
const urls = new Set();
let urlCount = 0;
URL.createObjectURL = () => { const url = `blob:regression-${++urlCount}`; urls.add(url); return url; };
URL.revokeObjectURL = (url) => urls.delete(url);
const file = new File([new Uint8Array([1, 2, 3])], "input.pdf");
const response = (value) => ({ success: true, result: {
  bytes: new Uint8Array([value]), originalSize: 3, compressedSize: 1,
  reductionPct: 67, method: "structural", pagesProcessed: 1,
  imagesRecompressed: 0, skippedImages: 0,
} });
function assertWorkerClean(worker) {
  assert.equal(worker.terminated, true);
  assert.equal(worker.listeners.size, 0);
}

await test("concurrent client calls have isolated workers and out-of-order responses", async () => {
  const start = workers.length;
  const first = compressPdfClient(file, "light");
  const second = compressPdfClient(file, "strong");
  await tick();
  const a = workers[start];
  const b = workers[start + 1];
  assert.notEqual(a, b);
  b.emit("message", response(22));
  a.emit("message", response(11));
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one.bytes[0], 11);
  assert.equal(two.bytes[0], 22);
  assertWorkerClean(a);
  assertWorkerClean(b);
  URL.revokeObjectURL(one.url);
  URL.revokeObjectURL(two.url);
});

await test("abort terminates worker, removes listeners and ignores captured late response", async () => {
  const controller = new AbortController();
  const pending = compressPdfClient(file, "light", { signal: controller.signal });
  const rejection = assert.rejects(pending, { name: "AbortError" });
  await tick();
  const worker = workers.at(-1);
  const late = worker.listeners.get("message");
  controller.abort();
  await rejection;
  assertWorkerClean(worker);
  const count = urlCount;
  late({ data: response(99) });
  assert.equal(urlCount, count);
});

await test("pre-abort and abort during file read never create a worker or URL", async () => {
  const start = workers.length;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(compressPdfClient(file, "light", { signal: controller.signal }), { name: "AbortError" });
  let finishRead;
  const delayed = { size: 3, arrayBuffer: () => new Promise((resolve) => { finishRead = resolve; }) };
  const active = new AbortController();
  const pending = compressPdfClient(delayed, "light", { signal: active.signal });
  const rejection = assert.rejects(pending, { name: "AbortError" });
  await tick();
  active.abort();
  await rejection;
  finishRead(new ArrayBuffer(3));
  await tick();
  assert.equal(workers.length, start);
});

await test("timeout terminates actual worker and ignores late results", async () => {
  const pending = compressPdfClient(file, "balanced", { timeoutMs: 20 });
  const rejection = assert.rejects(pending, /timed out/);
  await tick();
  const worker = workers.at(-1);
  const late = worker.listeners.get("message");
  await rejection;
  assertWorkerClean(worker);
  const count = urlCount;
  late({ data: response(99) });
  assert.equal(urlCount, count);
});

for (const mode of ["error", "messageerror", "failure", "malformed", "post-error", "constructor-error"]) {
  await test(`client cleans up ${mode}`, async () => {
    workerMode = mode;
    const start = workers.length;
    const pending = compressPdfClient(file, "light");
    const rejection = assert.rejects(pending);
    await tick();
    const worker = workers[start];
    if (mode === "error") worker.emit("error", { message: "Crashed" });
    if (mode === "messageerror") worker.emit("messageerror", {});
    if (mode === "failure") worker.emit("message", { success: false, error: "Bad PDF" });
    if (mode === "malformed") worker.emit("message", { success: true });
    await rejection;
    if (worker) assertWorkerClean(worker);
    workerMode = "normal";
  });
}

await test("file read failures reject cleanly", async () => {
  const count = workers.length;
  await assert.rejects(compressPdfClient({ size: 1, arrayBuffer: async () => { throw new Error("Read failed"); } }, "light"), /Read failed/);
  assert.equal(workers.length, count);
});

await test("cancelling one call does not terminate another call", async () => {
  const controller = new AbortController();
  const start = workers.length;
  const cancelled = compressPdfClient(file, "light", { signal: controller.signal });
  const rejection = assert.rejects(cancelled, { name: "AbortError" });
  const surviving = compressPdfClient(file, "strong");
  await tick();
  controller.abort();
  await rejection;
  assertWorkerClean(workers[start]);
  assert.equal(workers[start + 1].terminated, false);
  workers[start + 1].emit("message", response(55));
  const result = await surviving;
  assert.equal(result.bytes[0], 55);
  URL.revokeObjectURL(result.url);
});

await test("URL allocation failure rejects and terminates the worker", async () => {
  const create = URL.createObjectURL;
  URL.createObjectURL = () => { throw new Error("URL allocation failed"); };
  try {
    const pending = compressPdfClient(file, "light");
    const rejection = assert.rejects(pending, /URL allocation failed/);
    await tick();
    const worker = workers.at(-1);
    worker.emit("message", response(1));
    await rejection;
    assertWorkerClean(worker);
  } finally { URL.createObjectURL = create; }
});

await test("successful call clears its 60-second timer and abort listener", async () => {
  const set = globalThis.setTimeout;
  const clear = globalThis.clearTimeout;
  const controller = new AbortController();
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  const timers = new Set();
  const listeners = new Set();
  controller.signal.addEventListener = (type, listener, options) => { listeners.add(listener); add(type, listener, options); };
  controller.signal.removeEventListener = (type, listener) => { listeners.delete(listener); remove(type, listener); };
  globalThis.setTimeout = (callback, ms) => {
    assert.equal(ms, 60_000);
    const timer = set(callback, ms);
    timers.add(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { timers.delete(timer); clear(timer); };
  try {
    const pending = compressPdfClient(file, "balanced", { signal: controller.signal });
    await tick();
    workers.at(-1).emit("message", response(5));
    const result = await pending;
    assert.equal(timers.size, 0);
    assert.equal(listeners.size, 0);
    controller.abort();
    assert.equal(result.bytes[0], 5);
    URL.revokeObjectURL(result.url);
  } finally {
    globalThis.setTimeout = set;
    globalThis.clearTimeout = clear;
    for (const timer of timers) clear(timer);
  }
});

after(() => {
  assert.equal(urls.size, 0, "all successful callers released their URLs");
  for (const worker of workers) assertWorkerClean(worker);
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
  for (const [key, value] of originalGlobals) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});
