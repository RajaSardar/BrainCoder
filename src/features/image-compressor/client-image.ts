import { formatBytes } from "@/lib/format";
import type { QualityPreset, OutputFormat } from "./compress-image";

export type { QualityPreset, OutputFormat };

export interface ImageCompressClientResult {
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

type WorkerResponseData = {
  success: boolean;
  result?: Omit<ImageCompressClientResult, "blob" | "url">;
  error?: string;
};

let imageWorker: Worker | null = null;

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

function normalizeBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy as Uint8Array<ArrayBuffer>;
}

export async function compressImageFile(
  file: File,
  options: { preset: QualityPreset; format: OutputFormat; maxWidth?: number | null; maxHeight?: number | null }
): Promise<ImageCompressClientResult> {
  const originalSize = file.size;
  const buffer = await file.arrayBuffer();

  const w = getImageWorker();

  const data = await new Promise<WorkerResponseData>((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerResponseData>) => {
      w.removeEventListener("message", handler);
      w.removeEventListener("error", errHandler);
      if (e.data.success) {
        resolve(e.data);
      } else {
        reject(new Error(e.data.error || "Image compression failed"));
      }
    };
    const errHandler = (e: ErrorEvent) => {
      w.removeEventListener("message", handler);
      w.removeEventListener("error", errHandler);
      reject(new Error(e.message || "Image compression worker error"));
    };
    w.addEventListener("message", handler);
    w.addEventListener("error", errHandler);
    w.postMessage(
      {
        type: "compress",
        buffer,
        preset: options.preset,
        format: options.format,
        maxWidth: options.maxWidth ?? null,
        maxHeight: options.maxHeight ?? null,
      },
      [buffer]
    );
  });

  const result = data.result!;
  const bytes = normalizeBytes(result.bytes);
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