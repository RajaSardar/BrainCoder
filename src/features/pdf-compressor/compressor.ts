import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFBool,
  PDFNull,
  PDFString,
  PDFHexString,
  EncryptedPDFError,
  type PDFObject,
} from "pdf-lib";

export interface CompressionResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  reductionPct: number;
  method: "in-place" | "structural" | "none";
  pagesProcessed: number;
  imagesRecompressed: number;
  skippedImages: number;
  message?: string;
}

export type QualityPreset = "light" | "balanced" | "strong";

export const PRESET_JPEG_QUALITY: Record<QualityPreset, number> = {
  light: 0.85,
  balanced: 0.65,
  strong: 0.4,
};

export const PRESET_MAX_DIMENSION: Record<QualityPreset, number> = {
  light: 2000,
  balanced: 1600,
  strong: 1200,
};

// Limits apply before image decoding. PDF parsing itself is still library-managed.
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_IMAGE_DIMENSION = 16_384;
type CanvasType = HTMLCanvasElement | OffscreenCanvas;

function createCanvas(width: number, height: number): CanvasType {
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2dContext(canvas: CanvasType) {
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Image canvas is unavailable");
  return ctx;
}

function toBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

// Inspect SOF before handing untrusted JPEG dimensions to the browser decoder.
function jpegMatches(bytes: Uint8Array, width: number, height: number, colors: number, canvasOutput = false): boolean {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let matched = false;
  for (let offset = 2; offset < bytes.length;) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) return matched;
    if (marker === 0xd9 || marker === undefined) return false;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || !Number.isFinite(length) || offset + length > bytes.length) return false;
    // Profiles, EXIF orientation and non-default Adobe transforms are not handled here.
    if (marker === 0xe1) return false;
    if (!canvasOutput && marker === 0xe2 && String.fromCharCode(...bytes.subarray(offset + 2, offset + 13)) === "ICC_PROFILE") return false;
    if (marker === 0xee && String.fromCharCode(...bytes.subarray(offset + 2, offset + 7)) === "Adobe") {
      if (length < 14 || colors !== 3 || bytes[offset + 13] !== 1) return false;
    }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (matched || ![0xc0, 0xc2].includes(marker) || length < 8 + 3 * colors) return false;
      matched = bytes[offset + 2] === 8
        && bytes[offset + 3] * 256 + bytes[offset + 4] === height
        && bytes[offset + 5] * 256 + bytes[offset + 6] === width
        && bytes[offset + 7] === colors;
      if (!matched) return false;
    }
    offset += length;
  }
  return false;
}

async function inflate(bytes: Uint8Array, expectedLength: number): Promise<Uint8Array> {
  const reader = toBlob(bytes, "application/octet-stream").stream()
    .pipeThrough(new DecompressionStream("deflate")).getReader();
  let offset = 0;
  try {
    const output = new Uint8Array(expectedLength);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > expectedLength - offset) throw new Error("Oversize image data");
      output.set(value, offset);
      offset += value.byteLength;
    }
    if (offset !== expectedLength) throw new Error("Incomplete image data");
    return output;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function reencodeToJpeg(canvas: CanvasType, quality: number, maxDimension: number) {
  let target = canvas;
  try {
    if (Math.max(canvas.width, canvas.height) > maxDimension) {
      const scale = maxDimension / Math.max(canvas.width, canvas.height);
      target = createCanvas(Math.max(1, Math.round(canvas.width * scale)), Math.max(1, Math.round(canvas.height * scale)));
      get2dContext(target).drawImage(canvas, 0, 0, target.width, target.height);
    }
    const blob = "convertToBlob" in target
      ? await target.convertToBlob({ type: "image/jpeg", quality })
      : await new Promise<Blob>((resolve, reject) => (target as HTMLCanvasElement).toBlob(
          (value) => value ? resolve(value) : reject(new Error("JPEG encoding failed")),
          "image/jpeg", quality,
        ));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (blob.type !== "image/jpeg" || !jpegMatches(bytes, target.width, target.height, 3, true)) {
      throw new Error("Unsupported JPEG encoder output");
    }
    return { bytes, width: target.width, height: target.height };
  } finally {
    if (target !== canvas) target.width = target.height = 0;
  }
}

async function loadEditablePdf(inputBuffer: ArrayBuffer) {
  if (!inputBuffer.byteLength || inputBuffer.byteLength > MAX_INPUT_BYTES) {
    throw new Error("Please use a non-empty PDF no larger than 100 MiB.");
  }
  // Do not bypass encryption: pdf-lib must reject even owner-password-only PDFs.
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(new Uint8Array(inputBuffer), { updateMetadata: false });
  } catch (error) {
    // pdf-lib's transpiled Error subclass can lose its prototype in browser builds.
    if (error instanceof EncryptedPDFError || (error instanceof Error
      && error.message === new EncryptedPDFError().message)) {
      throw new Error("Encrypted or password-protected PDFs are not supported. Use an unencrypted copy you are authorized to edit.", { cause: error });
    }
    throw error;
  }
  const maskImages = new Set<PDFObject>();
  const overriddenColors = new Set<PDFName>();
  const visited = new Set<PDFObject>();
  const pending = pdf.context.enumerateIndirectObjects().map(([, object]) => object);
  while (pending.length) {
    const object = pdf.context.lookup(pending.pop());
    if (!object || visited.has(object)) continue;
    visited.add(object);
    const dict = object instanceof PDFRawStream ? object.dict : object;
    if (dict instanceof PDFDict) {
      // Default device color spaces can be overridden by page/form resources.
      if (dict.has(PDFName.of("DefaultRGB"))) overriddenColors.add(PDFName.of("DeviceRGB"));
      if (dict.has(PDFName.of("DefaultGray"))) overriddenColors.add(PDFName.of("DeviceGray"));
      const contents = dict.lookup(PDFName.of("Contents"));
      const type = dict.lookup(PDFName.of("Type"));
      const signature = type === PDFName.of("Sig") || type === PDFName.of("DocTimeStamp")
        || dict.has(PDFName.of("ByteRange"));
      if (signature && (contents instanceof PDFString || contents instanceof PDFHexString)
        && contents.asBytes().some((byte) => byte !== 0)) {
        throw new Error("Digitally signed PDFs cannot be compressed without invalidating their signatures. Use an unsigned copy.");
      }
      for (const key of ["SMask", "Mask"]) {
        const mask = dict.lookup(PDFName.of(key));
        if (mask) maskImages.add(mask);
      }
      for (const value of dict.values()) pending.push(value);
    } else if (object instanceof PDFArray) {
      for (let index = 0; index < object.size(); index++) pending.push(object.get(index));
    }
  }
  return { pdf, maskImages, overriddenColors };
}

function defaultDecodeParams(dict: PDFDict, isFlate: boolean): boolean {
  let params = dict.lookup(PDFName.of("DecodeParms"));
  if (params instanceof PDFArray) {
    if (params.size() !== 1) return false;
    params = params.lookup(0);
  }
  if (params === undefined || params === PDFNull) return true;
  if (!(params instanceof PDFDict)) return false;
  const defaults: Record<string, number> = isFlate
    ? { Predictor: 1, Colors: 1, BitsPerComponent: 8, Columns: 1 }
    : {};
  return params.entries().every(([key]) => {
    const value = params.lookup(key);
    return value instanceof PDFNumber && value.asNumber() === defaults[key.decodeText()];
  });
}

async function saveResult(pdf: PDFDocument, inputBuffer: ArrayBuffer, imagesRecompressed: number, skippedImages: number): Promise<CompressionResult> {
  const originalSize = inputBuffer.byteLength;
  const output = await pdf.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
  const unchanged = output.length >= originalSize;
  const bytes = unchanged ? new Uint8Array(inputBuffer) : output;
  return {
    bytes,
    originalSize,
    compressedSize: bytes.length,
    reductionPct: Math.round((1 - bytes.length / originalSize) * 100),
    method: unchanged ? "none" : imagesRecompressed ? "in-place" : "structural",
    pagesProcessed: pdf.getPageCount(),
    imagesRecompressed: unchanged ? 0 : imagesRecompressed,
    skippedImages: skippedImages + (unchanged ? imagesRecompressed : 0),
    message: unchanged
      ? "No smaller output was produced with the supported optimizations. Your original PDF is unchanged."
      : skippedImages > 0
        ? "Some images were left unchanged: unsupported encoding or masks, safety limits, decoding failure, or no image size savings."
        : undefined,
  };
}

export async function compressInPlace(inputBuffer: ArrayBuffer, preset: QualityPreset): Promise<CompressionResult> {
  if (!Object.hasOwn(PRESET_JPEG_QUALITY, preset)) throw new Error("Invalid compression preset");
  const { pdf, maskImages, overriddenColors } = await loadEditablePdf(inputBuffer);
  let imagesRecompressed = 0;
  let skippedImages = 0;

  // Sequential decoding bounds peak live bitmap/canvas memory to one image.
  for (const [ref, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const dict = object.dict;
    if (dict.lookup(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    let canvas: CanvasType | undefined;
    let bitmap: ImageBitmap | undefined;
    try {
      const width = dict.lookup(PDFName.of("Width"));
      const height = dict.lookup(PDFName.of("Height"));
      const bpc = dict.lookup(PDFName.of("BitsPerComponent"));
      const color = dict.lookup(PDFName.of("ColorSpace"));
      let filter = dict.lookup(PDFName.of("Filter"));
      if (filter instanceof PDFArray && filter.size() === 1) filter = filter.lookup(0);
      const isJpeg = filter === PDFName.of("DCTDecode");
      const isFlate = filter === PDFName.of("FlateDecode");
      const imageMask = dict.lookup(PDFName.of("ImageMask"));
      const colors = color === PDFName.of("DeviceRGB") ? 3 : color === PDFName.of("DeviceGray") ? 1 : 0;
      if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)
        || !(bpc instanceof PDFNumber) || bpc.asNumber() !== 8 || !colors || (!isJpeg && !isFlate)
        || overriddenColors.size > 0
        || maskImages.has(object) || (imageMask !== undefined && imageMask !== PDFBool.False)
        || ["SMask", "Mask", "Decode", "F", "FFilter", "FDecodeParms", "Predictor", "Columns", "Colors", "SMaskInData"].some((key) => dict.has(PDFName.of(key)))
        || !defaultDecodeParams(dict, isFlate)) {
        skippedImages++;
        continue;
      }
      const w = width.asNumber();
      const h = height.asNumber();
      if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w <= 0 || h <= 0
        || w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION || w * h > MAX_IMAGE_PIXELS) {
        skippedImages++;
        continue;
      }
      if (isJpeg) {
        if (!jpegMatches(object.contents, w, h, colors)) {
          skippedImages++;
          continue;
        }
        bitmap = await createImageBitmap(toBlob(object.contents, "image/jpeg"), { colorSpaceConversion: "none" });
        if (bitmap.width !== w || bitmap.height !== h) throw new Error("JPEG dimensions do not match");
        canvas = createCanvas(w, h);
        get2dContext(canvas).drawImage(bitmap, 0, 0);
      } else {
        const pixels = await inflate(object.contents, w * h * colors);
        const rgba = new Uint8ClampedArray(w * h * 4);
        for (let pixel = 0, src = 0; pixel < w * h; pixel++, src += colors) {
          rgba[pixel * 4] = pixels[src];
          rgba[pixel * 4 + 1] = pixels[src + (colors === 1 ? 0 : 1)];
          rgba[pixel * 4 + 2] = pixels[src + (colors === 1 ? 0 : 2)];
          rgba[pixel * 4 + 3] = 255;
        }
        canvas = createCanvas(w, h);
        get2dContext(canvas).putImageData(new ImageData(rgba, w, h), 0, 0);
      }
      const encoded = await reencodeToJpeg(canvas, PRESET_JPEG_QUALITY[preset], PRESET_MAX_DIMENSION[preset]);
      if (encoded.bytes.length >= object.contents.length) {
        skippedImages++;
        continue;
      }
      // Retain optional content, structure tagging, interpolation and other semantics.
      const replacement = dict.clone();
      replacement.set(PDFName.of("Width"), PDFNumber.of(encoded.width));
      replacement.set(PDFName.of("Height"), PDFNumber.of(encoded.height));
      replacement.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
      replacement.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
      replacement.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
      replacement.delete(PDFName.of("DecodeParms"));
      replacement.set(PDFName.of("Length"), PDFNumber.of(encoded.bytes.length));
      pdf.context.assign(ref, PDFRawStream.of(replacement, encoded.bytes));
      imagesRecompressed++;
    } catch {
      skippedImages++;
    } finally {
      bitmap?.close();
      if (canvas) canvas.width = canvas.height = 0;
    }
  }
  return saveResult(pdf, inputBuffer, imagesRecompressed, skippedImages);
}

export async function compressStructural(inputBuffer: ArrayBuffer): Promise<CompressionResult> {
  const { pdf } = await loadEditablePdf(inputBuffer);
  return saveResult(pdf, inputBuffer, 0, 0);
}
