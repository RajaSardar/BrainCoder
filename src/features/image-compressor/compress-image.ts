export type QualityPreset = "light" | "balanced" | "strong";
export type ConcreteFormat = "webp" | "jpeg" | "png" | "avif";
export type OutputFormat = "auto" | ConcreteFormat;

export const PRESETS: Record<QualityPreset, { quality: number }> = {
  light: { quality: 0.85 },
  balanced: { quality: 0.7 },
  strong: { quality: 0.45 },
};

export const FORMATS: Record<ConcreteFormat, { mime: string; ext: string }> = {
  webp: { mime: "image/webp", ext: "webp" },
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  avif: { mime: "image/avif", ext: "avif" },
};

export function sniffImageMime(bytes: Uint8Array): { mime: string; ext: string } {
  if (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.byteLength >= 12 &&
    isAscii(bytes, 0, "RIFF") &&
    isAscii(bytes, 8, "WEBP")
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (bytes.byteLength >= 4 && isAscii(bytes, 0, "GIF8")) {
    return { mime: "image/gif", ext: "gif" };
  }
  if (bytes.byteLength >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { mime: "image/bmp", ext: "bmp" };
  }
  if (
    bytes.byteLength >= 12 &&
    isAscii(bytes, 4, "ftyp") &&
    isAscii(bytes, 8, "avif")
  ) {
    return { mime: "image/avif", ext: "avif" };
  }
  return { mime: "image/jpeg", ext: "jpg" };
}

function isAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.byteLength) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function pickOutputMime(format: OutputFormat): string {
  if (format === "auto") {
    throw new Error("Auto format must be resolved on the main thread before dispatch.");
  }
  return FORMATS[format].mime;
}

type CanvasType = HTMLCanvasElement | OffscreenCanvas;

function metaFromActualMime(mime: string): { ext: string; format: string } {
  for (const f of Object.values(FORMATS)) {
    if (f.mime === mime) return { ext: f.ext, format: f.ext };
  }
  const subtype = mime.slice(mime.indexOf("/") + 1) || "img";
  return { ext: subtype, format: subtype };
}

function get2dContext(
  canvas: CanvasType
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  return canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
}

async function decodeImage(bytes: Uint8Array): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
}> {
  if (typeof createImageBitmap !== "undefined") {
    const blob = new Blob([new Uint8Array(bytes)]);
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }

  const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = blobUrl;
  });
  URL.revokeObjectURL(blobUrl);
  return { source: img, width: img.naturalWidth, height: img.naturalHeight };
}

function drawWithStepDown(
  source: ImageBitmap | HTMLImageElement,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number
): CanvasType {
  const isOffscreen = typeof OffscreenCanvas !== "undefined";
  const useOffscreen = isOffscreen && source instanceof ImageBitmap;

  const makeCanvas = (w: number, h: number): CanvasType => {
    if (useOffscreen) return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  const smoothing = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  };

  const canvasError = "Canvas 2D rendering isn't available in this browser.";

  const requireCtx = (
    c: CanvasType
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D => {
    const ctx = get2dContext(c);
    if (!ctx) throw new Error(canvasError);
    return ctx;
  };

  let curW = srcW;
  let curH = srcH;
  let canvas: CanvasType;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  if (curW === targetW && curH === targetH) {
    canvas = makeCanvas(srcW, srcH);
    ctx = requireCtx(canvas);
    ctx.drawImage(source as CanvasImageSource, 0, 0);
    return canvas;
  }

  const firstW = Math.max(targetW, Math.floor(srcW / 2));
  const firstH = Math.max(targetH, Math.floor(srcH / 2));
  canvas = makeCanvas(firstW, firstH);
  ctx = requireCtx(canvas);
  smoothing(ctx);
  ctx.drawImage(source as CanvasImageSource, 0, 0, srcW, srcH, 0, 0, firstW, firstH);
  curW = firstW;
  curH = firstH;

  while (curW > targetW * 2 || curH > targetH * 2) {
    const nextW = Math.max(targetW, Math.floor(curW / 2));
    const nextH = Math.max(targetH, Math.floor(curH / 2));
    const next: CanvasType = makeCanvas(nextW, nextH);
    const nextCtx = requireCtx(next);
    smoothing(nextCtx);
    nextCtx.drawImage(canvas as CanvasImageSource, 0, 0, curW, curH, 0, 0, nextW, nextH);
    canvas = next;
    ctx = nextCtx;
    curW = nextW;
    curH = nextH;
  }

  if (curW !== targetW || curH !== targetH) {
    const final: CanvasType = makeCanvas(targetW, targetH);
    const finalCtx = get2dContext(final);
    if (!finalCtx) throw new Error(canvasError);
    smoothing(finalCtx);
    finalCtx.drawImage(canvas as CanvasImageSource, 0, 0, curW, curH, 0, 0, targetW, targetH);
    canvas = final;
  }

  return canvas;
}

async function canvasToBlob(
  canvas: CanvasType,
  mime: string,
  quality: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined" && "convertToBlob" in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encoding failed"))),
      mime,
      quality
    );
  });
}

async function encodeWithFallback(
  canvas: CanvasType,
  quality: number,
  outMime: string
): Promise<{ blob: Blob; mime: string }> {
  const first = await canvasToBlob(canvas, outMime, quality);
  if (!first.type || first.type === outMime) {
    return { blob: first, mime: first.type || outMime };
  }
  const tried = [outMime];
  for (const mime of [outMime, "image/webp", "image/jpeg"]) {
    if (tried.includes(mime)) continue;
    tried.push(mime);
    const blob = await canvasToBlob(canvas, mime, quality);
    if (blob.type && blob.type === mime) {
      return { blob, mime: blob.type };
    }
  }
  return { blob: first, mime: first.type };
}

export interface ImageCompressionData {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  originalSize: number;
  compressedSize: number;
  reductionPct: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  format: string;
  resized: boolean;
  skipped: boolean;
}

export interface ImageCompressOptions {
  preset: QualityPreset;
  format: ConcreteFormat;
  maxWidth?: number | null;
  maxHeight?: number | null;
}

export async function compressImageClient(
  bytes: Uint8Array,
  options: ImageCompressOptions
): Promise<ImageCompressionData> {
  const originalSize = bytes.byteLength;
  const data = await decodeImage(bytes);
  const origW = data.width;
  const origH = data.height;

  if (!origW || !origH) {
    throw new Error("Couldn't read the image dimensions. Try a standard JPG, PNG or WebP file.");
  }
  if (origW * origH > 40_000_000) {
    throw new Error("Image is too large to process (over 40 megapixels).");
  }

  const { quality } = PRESETS[options.preset];
  const outMime = pickOutputMime(options.format);

  let targetW = origW;
  let targetH = origH;

  if (options.maxWidth && options.maxHeight) {
    const scale = Math.min(1, options.maxWidth / origW, options.maxHeight / origH);
    targetW = Math.max(1, Math.round(origW * scale));
    targetH = Math.max(1, Math.round(origH * scale));
  } else if (options.maxWidth) {
    const scale = Math.min(1, options.maxWidth / origW);
    targetW = Math.max(1, Math.round(origW * scale));
    targetH = Math.max(1, Math.round(origH * scale));
  } else if (options.maxHeight) {
    const scale = Math.min(1, options.maxHeight / origH);
    targetW = Math.max(1, Math.round(origW * scale));
    targetH = Math.max(1, Math.round(origH * scale));
  }

  const resized = targetW !== origW || targetH !== origH;
  const canvas = drawWithStepDown(data.source, origW, origH, targetW, targetH);

  if (outMime === "image/jpeg") {
    const bg = get2dContext(canvas);
    if (!bg) throw new Error("Canvas 2D rendering isn't available in this browser.");
    bg.globalCompositeOperation = "destination-over";
    bg.fillStyle = "#ffffff";
    bg.fillRect(0, 0, canvas.width, canvas.height);
  }

  const { blob, mime: encodedMime } = await encodeWithFallback(canvas, quality, outMime);
  if (data.source instanceof ImageBitmap) data.source.close();

  const compressedBytes = new Uint8Array(await blob.arrayBuffer());
  const compressedSize = compressedBytes.byteLength;

  const shouldFallback = compressedSize >= originalSize;
  const sniffed = sniffImageMime(bytes);

  const effectiveBytes = shouldFallback ? bytes : compressedBytes;
  const effectiveMime = shouldFallback ? sniffed.mime : encodedMime;
  const meta = metaFromActualMime(effectiveMime);
  const effectiveSize = shouldFallback ? originalSize : compressedSize;

  return {
    bytes: effectiveBytes,
    mimeType: effectiveMime,
    extension: shouldFallback ? sniffed.ext : meta.ext,
    originalSize,
    compressedSize: effectiveSize,
    reductionPct:
      originalSize > 0 ? Math.max(0, Math.round((1 - effectiveSize / originalSize) * 100)) : 0,
    originalWidth: origW,
    originalHeight: origH,
    outputWidth: shouldFallback ? origW : targetW,
    outputHeight: shouldFallback ? origH : targetH,
    format: shouldFallback ? sniffed.ext : meta.format,
    resized: shouldFallback ? false : resized,
    skipped: shouldFallback,
  };
}