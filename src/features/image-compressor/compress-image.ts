export type QualityPreset = "light" | "balanced" | "strong";
export type OutputFormat = "auto" | "webp" | "jpeg" | "png" | "avif";

export const PRESETS: Record<QualityPreset, { quality: number; maxEdge: number }> = {
  light: { quality: 0.85, maxEdge: 2400 },
  balanced: { quality: 0.7, maxEdge: 1920 },
  strong: { quality: 0.45, maxEdge: 1280 },
};

export const FORMAT_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/png": "png",
  "image/avif": "avif",
};

type CanvasType = HTMLCanvasElement | OffscreenCanvas;

function pickOutputMime(format: OutputFormat): string {
  if (format !== "auto") {
    const map: Record<string, string> = {
      webp: "image/webp",
      jpeg: "image/jpeg",
      png: "image/png",
      avif: "image/avif",
    };
    return map[format];
  }

  const canvas = document.createElement("canvas");
  if (canvas.toDataURL("image/avif").startsWith("data:image/avif")) return "image/avif";
  if (canvas.toDataURL("image/webp").startsWith("data:image/webp")) return "image/webp";
  return "image/jpeg";
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
    const blob = new Blob([new Uint8Array(bytes) as unknown as BlobPart]);
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }

  const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes) as unknown as BlobPart]));
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

  let curW = srcW;
  let curH = srcH;
  let canvas: CanvasType = useOffscreen
    ? new OffscreenCanvas(srcW, srcH)
    : document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  let ctx = get2dContext(canvas);
  if (ctx) ctx.drawImage(source as CanvasImageSource, 0, 0);

  while (curW > targetW * 2 || curH > targetH * 2) {
    const nextW = Math.max(targetW, Math.floor(curW / 2));
    const nextH = Math.max(targetH, Math.floor(curH / 2));
    const next: CanvasType = useOffscreen
      ? new OffscreenCanvas(nextW, nextH)
      : document.createElement("canvas");
    next.width = nextW;
    next.height = nextH;
    const nextCtx = get2dContext(next);
    if (!nextCtx) break;
    nextCtx.drawImage(canvas as CanvasImageSource, 0, 0, curW, curH, 0, 0, nextW, nextH);
    canvas = next;
    ctx = nextCtx;
    curW = nextW;
    curH = nextH;
  }

  if (curW !== targetW || curH !== targetH) {
    const final: CanvasType = useOffscreen
      ? new OffscreenCanvas(targetW, targetH)
      : document.createElement("canvas");
    final.width = targetW;
    final.height = targetH;
    const finalCtx = get2dContext(final);
    if (finalCtx)
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

export interface ImageCompressionResult {
  bytes: Uint8Array;
  blob: Blob;
  url: string;
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
  format: OutputFormat;
  maxWidth?: number | null;
  maxHeight?: number | null;
}

export async function compressImageClient(
  bytes: Uint8Array,
  options: ImageCompressOptions
): Promise<ImageCompressionResult> {
  const originalSize = bytes.byteLength;
  const data = await decodeImage(bytes);
  const origW = data.width;
  const origH = data.height;

  const { quality, maxEdge } = PRESETS[options.preset] ?? PRESETS.balanced;
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
  } else if (Math.max(origW, origH) > maxEdge) {
    const scale = maxEdge / Math.max(origW, origH);
    targetW = Math.max(1, Math.round(origW * scale));
    targetH = Math.max(1, Math.round(origH * scale));
  }

  const resized = targetW !== origW || targetH !== origH;
  const canvas = drawWithStepDown(data.source, origW, origH, targetW, targetH);

  if (outMime === "image/jpeg") {
    const bg = get2dContext(canvas);
    if (bg) {
      bg.globalCompositeOperation = "destination-over";
      bg.fillStyle = "#ffffff";
      bg.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  const blob = await canvasToBlob(canvas, outMime, quality);
  if (data.source instanceof ImageBitmap) data.source.close();

  const compressedBytes = new Uint8Array(await blob.arrayBuffer());
  const compressedSize = compressedBytes.byteLength;

  const shouldFallback = !resized && compressedSize >= originalSize;
  const extension = FORMAT_EXT[outMime] ?? "jpg";
  const effectiveBytes = shouldFallback ? bytes : compressedBytes;
  const effectiveMime = shouldFallback ? "image/jpeg" : outMime;
  const effectiveSize = effectiveBytes.byteLength;

  return {
    bytes: effectiveBytes,
    blob: new Blob([new Uint8Array(effectiveBytes) as unknown as BlobPart], {
      type: effectiveMime,
    }),
    url: "",
    mimeType: effectiveMime,
    extension: shouldFallback ? "jpg" : extension,
    originalSize,
    compressedSize: effectiveSize,
    reductionPct:
      originalSize > 0 ? Math.round((1 - effectiveSize / originalSize) * 100) : 0,
    originalWidth: origW,
    originalHeight: origH,
    outputWidth: targetW,
    outputHeight: targetH,
    format: outMime.replace("image/", ""),
    resized,
    skipped: shouldFallback,
  };
}