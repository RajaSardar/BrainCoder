import { formatBytes } from "@/lib/format";
import type {
  ImageCompressionData,
  QualityPreset,
  OutputFormat,
  ConcreteFormat,
} from "./compress-image";

export type { QualityPreset, OutputFormat };

export interface ImageCompressionResult extends ImageCompressionData {
  blob: Blob;
  url: string;
}

type WorkerResponseData = {
  type: "compress";
  id: number;
  success: boolean;
  result?: ImageCompressionData;
  error?: string;
};

let imageWorker: Worker | null = null;
let nextRequestId = 0;

function getImageWorker(): Worker {
  if (!imageWorker) {
    imageWorker = new Worker(new URL("./imageCompression.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return imageWorker;
}

export function terminateImageWorker(): void {
  if (imageWorker) {
    imageWorker.terminate();
    imageWorker = null;
  }
}

export function resolveAutoFormat(): "webp" | "jpeg" | "avif" {
  const probe = document.createElement("canvas");
  if (probe.toDataURL("image/avif").startsWith("data:image/avif")) return "avif";
  if (probe.toDataURL("image/webp").startsWith("data:image/webp")) return "webp";
  return "jpeg";
}

export async function compressImageFile(
  file: File,
  options: {
    preset: QualityPreset;
    format: OutputFormat;
    maxWidth?: number | null;
    maxHeight?: number | null;
  }
): Promise<ImageCompressionResult> {
  const originalSize = file.size;
  const buffer = await file.arrayBuffer();
  const resolvedFormat: ConcreteFormat = options.format === "auto" ? resolveAutoFormat() : options.format;

  const w = getImageWorker();
  const id = nextRequestId++;

  const data = await new Promise<WorkerResponseData>((resolve, reject) => {
    let settled = false;

    const onMessage = (e: MessageEvent<WorkerResponseData>) => {
      if (settled || e.data.id !== id) return;
      settled = true;
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      if (e.data.success && e.data.result) {
        resolve(e.data);
      } else {
        reject(new Error(e.data.error || "Image compression failed"));
      }
    };
    const onError = (e: ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      terminateImageWorker();
      reject(new Error(e.message || "Image compression worker error"));
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      terminateImageWorker();
      reject(new Error("Compression timed out. Try a smaller image."));
    }, 120_000);

    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage(
      {
        type: "compress",
        id,
        buffer,
        preset: options.preset,
        format: resolvedFormat,
        maxWidth: options.maxWidth ?? null,
        maxHeight: options.maxHeight ?? null,
      },
      [buffer]
    );
  });

  const result = data.result!;
  const bytes = new Uint8Array(
    result.bytes.buffer as ArrayBuffer,
    result.bytes.byteOffset,
    result.bytes.byteLength
  );
  const blob = new Blob([bytes], { type: result.mimeType });
  const url = URL.createObjectURL(blob);

  return {
    bytes,
    blob,
    url,
    mimeType: result.mimeType,
    extension: result.extension,
    originalSize,
    compressedSize: result.compressedSize,
    reductionPct: result.reductionPct,
    originalWidth: result.originalWidth,
    originalHeight: result.originalHeight,
    outputWidth: result.outputWidth,
    outputHeight: result.outputHeight,
    format: result.format,
    resized: result.resized,
    skipped: result.skipped,
  };
}

export { formatBytes };