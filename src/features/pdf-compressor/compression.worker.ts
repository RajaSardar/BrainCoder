import { compressInPlace } from "./compressor";

function workerPost(msg: unknown, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

export type WorkerRequest =
  | { type: "compress"; buffer: ArrayBuffer; preset: "light" | "balanced" | "strong" }
  | { type: "progress"; message: string };

export type WorkerResponse = {
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

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type } = e.data;
  if (type === "compress") {
    const { buffer, preset } = e.data;
    try {
      const result = await compressInPlace(buffer, preset);
      const response: WorkerResponse = {
        success: true,
        result: {
          bytes: result.bytes,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          reductionPct: result.reductionPct,
          method: result.method,
          pagesProcessed: result.pagesProcessed,
          imagesRecompressed: result.imagesRecompressed,
          skippedImages: result.skippedImages,
          message: result.message,
        },
      };
      workerPost(response, [result.bytes.buffer as ArrayBuffer]);
    } catch (err) {
      const response: WorkerResponse = {
        success: false,
        error: err instanceof Error ? err.message : "Compression failed",
      };
      workerPost(response);
    }
  }
};
