import { compressImageClient, type QualityPreset, type OutputFormat } from "./compress-image";

type WorkerRequest =
  | {
      type: "compress";
      buffer: ArrayBuffer;
      preset: QualityPreset;
      format: OutputFormat;
      maxWidth?: number | null;
      maxHeight?: number | null;
    }
  | { type: "ping" };

type WorkerResponse = {
  success: boolean;
  result?: {
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
  };
  error?: string;
};

function post(msg: WorkerResponse, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type === "ping") {
    post({ success: true });
    return;
  }

  if (e.data.type === "compress") {
    const { buffer, preset, format, maxWidth, maxHeight } = e.data;
    try {
      const result = await compressImageClient(new Uint8Array(buffer), {
        preset,
        format,
        maxWidth,
        maxHeight,
      });
      post(
        {
          success: true,
          result: {
            bytes: result.bytes,
            mimeType: result.mimeType,
            extension: result.extension,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            reductionPct: result.reductionPct,
            originalWidth: result.originalWidth,
            originalHeight: result.originalHeight,
            outputWidth: result.outputWidth,
            outputHeight: result.outputHeight,
            format: result.format,
            resized: result.resized,
            skipped: result.skipped,
          },
        },
        [result.bytes.buffer as ArrayBuffer]
      );
    } catch (err) {
      post({
        success: false,
        error: err instanceof Error ? err.message : "Image compression failed",
      });
    }
  }
};