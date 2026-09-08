export type QualityPreset = "light" | "balanced" | "strong";

export interface CompressResult {
  bytes: Uint8Array;
  blob: Blob;
  url: string;
  originalSize: number;
  compressedSize: number;
  reductionPct: number;
  method: string;
  pagesProcessed: number;
  imagesRecompressed: number;
  skippedImages: number;
  message?: string;
}

type WorkerResponseData = {
  success: boolean;
  result?: {
    bytes: Uint8Array;
    originalSize: number;
    compressedSize: number;
    reductionPct: number;
    method: string;
    pagesProcessed: number;
    imagesRecompressed: number;
    skippedImages: number;
    message?: string;
  };
  error?: string;
};

function normalizeBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy as Uint8Array<ArrayBuffer>;
}

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./compression.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

export async function compressPdfClient(
  file: File,
  preset: QualityPreset
): Promise<CompressResult> {
  const originalSize = file.size;
  const buffer = await file.arrayBuffer();

  const w = getWorker();

  const result = await new Promise<WorkerResponseData>((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerResponseData>) => {
      w.removeEventListener("message", handler);
      w.removeEventListener("error", errHandler);
      if (e.data.success) {
        resolve(e.data);
      } else {
        reject(new Error(e.data.error || "Compression failed"));
      }
    };
    const errHandler = (e: ErrorEvent) => {
      w.removeEventListener("message", handler);
      w.removeEventListener("error", errHandler);
      reject(new Error(e.message || "Compression worker error"));
    };
    w.addEventListener("message", handler);
    w.addEventListener("error", errHandler);
    w.postMessage({ type: "compress", buffer, preset }, [buffer]);
  });

  const data = result.result!;
  const blob = new Blob([normalizeBytes(data.bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  return {
    bytes: data.bytes,
    blob,
    url,
    originalSize,
    compressedSize: data.compressedSize,
    reductionPct: data.reductionPct,
    method: data.method,
    pagesProcessed: data.pagesProcessed,
    imagesRecompressed: data.imagesRecompressed,
    skippedImages: data.skippedImages,
    message: data.message,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}
