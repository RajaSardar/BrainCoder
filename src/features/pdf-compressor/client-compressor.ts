import type { CompressionResult, QualityPreset } from "./compressor";

export type { QualityPreset } from "./compressor";

export interface CompressResult extends CompressionResult {
  blob: Blob;
  /** The successful caller owns this URL and must revoke it when no longer used. */
  url: string;
}

type WorkerResponseData = {
  success: boolean;
  result?: CompressionResult;
  error?: string;
};

export function compressPdfClient(
  file: File,
  preset: QualityPreset,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const { signal, timeoutMs = 60_000 } = options;
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      timer = undefined;
      signal?.removeEventListener("abort", onAbort);
      worker?.removeEventListener("message", onMessage);
      worker?.removeEventListener("error", onError);
      worker?.removeEventListener("messageerror", onMessageError);
      worker?.terminate();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => fail(new DOMException("Compression cancelled.", "AbortError"));
    const onError = (event: ErrorEvent) => fail(new Error(event.message || "Compression worker failed."));
    const onMessageError = () => fail(new Error("Could not read the compression worker response."));
    const onMessage = (event: MessageEvent<WorkerResponseData>) => {
      if (settled) return;
      const data = event.data?.result;
      if (!event.data?.success || !data || !(data.bytes instanceof Uint8Array)) {
        fail(new Error(event.data?.error || "Compression failed."));
        return;
      }
      try {
        const blob = new Blob([new Uint8Array(data.bytes)], { type: "application/pdf" });
        cleanup();
        const url = URL.createObjectURL(blob);
        settled = true;
        resolve({ ...data, blob, url });
      } catch (error) {
        fail(error);
      }
    };

    if (signal?.aborted) return onAbort();
    if (!file.size || file.size > 100 * 1024 * 1024) {
      fail(new Error("Please use a non-empty PDF no larger than 100 MiB."));
      return;
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      fail(new Error("Invalid compression timeout."));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => fail(new Error(`Compression timed out after ${Math.ceil(timeoutMs / 1000)} seconds. Try a smaller PDF.`)), timeoutMs);
    // One worker per call: concurrent requests cannot consume one another's responses.
    // Reading is covered by cancellation too, although File.arrayBuffer itself is not abortable.
    Promise.resolve().then(() => file.arrayBuffer()).then((buffer) => {
      if (settled) return;
      worker = new Worker(new URL("./compression.worker.ts", import.meta.url), { type: "module" });
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);
      worker.postMessage({ type: "compress", buffer, preset }, [buffer]);
    }).catch(fail);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}
