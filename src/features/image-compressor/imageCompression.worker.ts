import { compressImageClient } from "./compress-image";
import type { ImageCompressionData, QualityPreset, ConcreteFormat } from "./compress-image";

type WorkerRequest = {
  type: "compress";
  id: number;
  buffer: ArrayBuffer;
  preset: QualityPreset;
  format: ConcreteFormat;
  maxWidth?: number | null;
  maxHeight?: number | null;
};

type WorkerResponse = {
  type: "compress";
  id: number;
  success: boolean;
  result?: ImageCompressionData;
  error?: string;
};

function post(msg: WorkerResponse, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type !== "compress") return;
  const { id, buffer, preset, format, maxWidth, maxHeight } = e.data;
  try {
    const result = await compressImageClient(new Uint8Array(buffer), {
      preset,
      format,
      maxWidth,
      maxHeight,
    });
    post(
      {
        type: "compress",
        id,
        success: true,
        result,
      },
      [result.bytes.buffer as ArrayBuffer]
    );
  } catch (err) {
    post({
      type: "compress",
      id,
      success: false,
      error: err instanceof Error ? err.message : "Image compression failed",
    });
  }
};