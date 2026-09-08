import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFBool,
} from "pdf-lib";

export interface CompressionResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  reductionPct: number;
  method: "in-place" | "rasterized" | "structural" | "none";
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

type CanvasType = HTMLCanvasElement | OffscreenCanvas;

function get2dContext(canvas: CanvasType): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  return canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
}

// Helper to build a Blob from a plain Uint8Array (portable typing)
function toUint8Array(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy as Uint8Array<ArrayBuffer>;
}

function toBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([toUint8Array(bytes)], { type });
}

// ---- JPEG decoding via createImageBitmap ----
async function jpegToCanvas(bytes: Uint8Array): Promise<CanvasType | null> {
  try {
    const bitmap = await createImageBitmap(toBlob(bytes, "image/jpeg"));
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(bitmap.width, bitmap.height)
        : document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = get2dContext(canvas);
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  } catch {
    return null;
  }
}

// ---- zlib inflate using native DecompressionStream ----
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = toBlob(bytes, "application/octet-stream")
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---- PNG predictor reversal (filters 0..4) ----
function unfilter(
  raw: Uint8Array,
  bytesPerRow: number,
  _colors: number,
  bpp: number
): Uint8Array {
  const height = raw.length / bytesPerRow;
  const out = new Uint8Array(raw.length);
  let offset = 0;
  for (let row = 0; row < height; row++) {
    const filter = raw[offset];
    const rowStart = offset + 1;
    const rowEnd = offset + bytesPerRow;
    const bytesPerImageRow = bytesPerRow - 1;

    for (let i = rowStart; i < rowEnd; i++) {
      const rawByte = raw[i];
      const left = i - rowStart >= bpp ? out[i - bpp] : 0;
      const up = row > 0 ? out[i - bytesPerRow] : 0;
      const upLeft = row > 0 && i - rowStart >= bpp ? out[i - bytesPerRow - bpp] : 0;

      let val: number;
      switch (filter) {
        case 0:
          val = rawByte;
          break;
        case 1:
          val = rawByte + left;
          break;
        case 2:
          val = rawByte + up;
          break;
        case 3:
          val = rawByte + Math.floor((left + up) / 2);
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          val = rawByte + predictor;
          break;
        }
        default:
          val = rawByte;
      }
      out[i] = val & 0xff;
      void bytesPerImageRow;
    }
    offset = rowEnd;
  }
  return out;
}

interface FlateImage {
  width: number;
  height: number;
  imageData: ImageData;
}

async function flateToImageData(
  stream: PDFRawStream,
  dict: PDFDict
): Promise<FlateImage | null> {
  try {
    const width = (dict.get(PDFName.of("Width")) as PDFNumber | undefined)?.asNumber();
    const height = (dict.get(PDFName.of("Height")) as PDFNumber | undefined)?.asNumber();
    if (!width || !height) return null;

    const colorspace = String(dict.get(PDFName.of("ColorSpace"))?.toString() ?? "").replace(
      /[\[\]]/g,
      ""
    );
    const bpc = (dict.get(PDFName.of("BitsPerComponent")) as PDFNumber | undefined)?.asNumber() ?? 8;
    if (bpc !== 8) return null;

    let colors = 3;
    if (colorspace.includes("DeviceGray")) {
      colors = 1;
    } else if (colorspace.includes("ICCBased")) {
      const iccEntry = dict.get(PDFName.of("ColorSpace"));
      if (iccEntry instanceof PDFArray && iccEntry.size() > 1) {
        const n = iccEntry.get(1) as PDFNumber | undefined;
        colors = n ? n.asNumber() : 3;
      }
    }

    const predictor = (dict.get(PDFName.of("Predictor")) as PDFNumber | undefined)?.asNumber() ?? 1;
    const columns = (dict.get(PDFName.of("Columns")) as PDFNumber | undefined)?.asNumber() ?? width;

    const decoded = await inflate(stream.contents);

    const bpp = Math.max(1, Math.round((colors * bpc) / 8));
    const bytesPerRow = Math.ceil((columns * colors * bpc) / 8) + (predictor >= 10 ? 1 : 0);

    let rawPixels: Uint8Array;
    if (predictor >= 2) {
      rawPixels = unfilter(decoded, bytesPerRow, colors, bpp);
    } else {
      rawPixels = decoded;
    }

    // Build RGBA ImageData
    const rgba = new Uint8ClampedArray(width * height * 4);
    let src = 0;
    for (let i = 0; i < width * height; i++) {
      if (colors === 1) {
        const v = rawPixels[src];
        rgba[i * 4] = v;
        rgba[i * 4 + 1] = v;
        rgba[i * 4 + 2] = v;
        rgba[i * 4 + 3] = 255;
        src += 1;
      } else {
        rgba[i * 4] = rawPixels[src];
        rgba[i * 4 + 1] = rawPixels[src + 1];
        rgba[i * 4 + 2] = rawPixels[src + 2];
        rgba[i * 4 + 3] = 255;
        src += colors;
      }
    }

    return {
      width,
      height,
      imageData: new ImageData(rgba, width, height),
    };
  } catch {
    return null;
  }
}

// ---- Re-encode an image to JPEG at target quality/max dimension ----
async function reencodeToJpeg(
  canvas: CanvasType,
  quality: number,
  maxDimension: number
): Promise<Uint8Array | null> {
  let target = canvas;
  let w = canvas.width;
  let h = canvas.height;

  if (Math.max(w, h) > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);
    if (typeof OffscreenCanvas !== "undefined") {
      const scaled = new OffscreenCanvas(targetW, targetH);
      const ctx = get2dContext(scaled);
      if (!ctx) return null;
      ctx.drawImage(canvas, 0, 0, targetW, targetH);
      target = scaled;
      w = targetW;
      h = targetH;
    }
  }

  const blob =
    typeof OffscreenCanvas !== "undefined" && "convertToBlob" in target
      ? await (target as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality })
      : await new Promise<Blob>((resolve, reject) => {
          (target as HTMLCanvasElement).toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/jpeg",
            quality
          );
        });

  return new Uint8Array(await blob.arrayBuffer());
}

function stripMetadata(pdf: PDFDocument) {
  try {
    pdf.setTitle("");
  } catch {}
  try {
    pdf.setAuthor("");
  } catch {}
  try {
    pdf.setSubject("");
  } catch {}
  try {
    pdf.setKeywords([]);
  } catch {}
  try {
    pdf.setProducer("");
  } catch {}
  try {
    pdf.setCreator("");
  } catch {}
}

// ---- Stage 1: in-place image recompression (preserves text) ----
export async function compressInPlace(
  inputBuffer: ArrayBuffer,
  preset: QualityPreset
): Promise<CompressionResult> {
  const originalSize = inputBuffer.byteLength;
  const jpegQuality = PRESET_JPEG_QUALITY[preset];
  const maxDimension = PRESET_MAX_DIMENSION[preset];

  const pdf = await PDFDocument.load(new Uint8Array(inputBuffer), {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  let imagesRecompressed = 0;
  let skippedImages = 0;
  const imageTask: Promise<void>[] = [];

  for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict as PDFDict;
    if (dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;

    // Safety skips: alpha soft masks, color-key/Decode, explicit Mask, stencils
    if (dict.has(PDFName.of("SMask"))) {
      skippedImages++;
      continue;
    }
    if (dict.has(PDFName.of("Decode"))) {
      skippedImages++;
      continue;
    }
    if (dict.has(PDFName.of("Mask"))) {
      skippedImages++;
      continue;
    }
    const isImageMask = (dict.get(PDFName.of("ImageMask")) as PDFBool | undefined)?.asBoolean();
    if (isImageMask) {
      skippedImages++;
      continue;
    }

    const filterValue = String(dict.get(PDFName.of("Filter"))?.toString() ?? "");
    const isJpeg = filterValue.includes("DCTDecode");
    const isFlate = filterValue.includes("FlateDecode");
    if (!isJpeg && !isFlate) {
      skippedImages++;
      continue;
    }

    imageTask.push(
      (async () => {
        try {
          let canvas: CanvasType | null = null;
          if (isJpeg) {
            canvas = await jpegToCanvas(obj.contents);
          } else {
            const fi = await flateToImageData(obj, dict);
            if (fi) {
              const c =
                typeof OffscreenCanvas !== "undefined"
                  ? new OffscreenCanvas(fi.width, fi.height)
                  : document.createElement("canvas");
              c.width = fi.width;
              c.height = fi.height;
              const ctx = get2dContext(c);
              if (ctx) ctx.putImageData(fi.imageData, 0, 0);
              canvas = c;
            }
          }
          if (!canvas) {
            skippedImages++;
            return;
          }

          const jpegBytes = await reencodeToJpeg(canvas, jpegQuality, maxDimension);
          if (canvas instanceof OffscreenCanvas) canvas.width = canvas.height = 0;
          if (!jpegBytes) {
            skippedImages++;
            return;
          }

          const originalStreamLength = obj.contents.length;
          if (jpegBytes.length >= originalStreamLength) {
            skippedImages++;
            return;
          }

          const w = (dict.get(PDFName.of("Width")) as PDFNumber | undefined)?.asNumber() ?? 1;
          const h = (dict.get(PDFName.of("Height")) as PDFNumber | undefined)?.asNumber() ?? 1;

          const newDict = pdf.context.obj({
            Type: "XObject",
            Subtype: "Image",
            Width: w,
            Height: h,
            ColorSpace: "DeviceRGB",
            BitsPerComponent: 8,
            Filter: "DCTDecode",
          }) as PDFDict;

          pdf.context.assign(ref, PDFRawStream.of(newDict, jpegBytes as Uint8Array));
          imagesRecompressed++;
        } catch {
          skippedImages++;
        }
      })()
    );
  }

  await Promise.all(imageTask);

  stripMetadata(pdf);

  const outputBytes = await pdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  const compressedSize = outputBytes.length;

  const result: CompressionResult = {
    bytes: outputBytes,
    originalSize,
    compressedSize,
    reductionPct:
      originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0,
    method: "in-place",
    pagesProcessed: pdf.getPageCount(),
    imagesRecompressed,
    skippedImages,
  };

  return result;
}

// ---- Structural / metadata-only re-save (never returns bigger file) ----
export async function compressStructural(inputBuffer: ArrayBuffer): Promise<CompressionResult> {
  const originalSize = inputBuffer.byteLength;
  const input = new Uint8Array(inputBuffer);

  const pdf = await PDFDocument.load(input, { ignoreEncryption: true, updateMetadata: false });
  stripMetadata(pdf);

  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });

  if (bytes.length >= originalSize) {
    return {
      bytes: input,
      originalSize,
      compressedSize: originalSize,
      reductionPct: 0,
      method: "none",
      pagesProcessed: 0,
      imagesRecompressed: 0,
      skippedImages: 0,
      message:
        "This PDF is already well optimized. No size reduction was possible without losing quality.",
    };
  }

  return {
    bytes,
    originalSize,
    compressedSize: bytes.length,
    reductionPct: Math.round((1 - bytes.length / originalSize) * 100),
    method: "structural",
    pagesProcessed: pdf.getPageCount(),
    imagesRecompressed: 0,
    skippedImages: 0,
  };
}
