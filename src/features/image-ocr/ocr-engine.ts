/**
 * The only module in this tool that touches the OCR engine. It is reached
 * through `await import("./ocr-engine")`, so tesseract.js and its WebAssembly
 * core are fetched when a run starts and never when the page is painted.
 *
 * The engine is loaded, driven and terminated here; the worker handle is handed
 * to the caller so a Cancel can stop a run in flight instead of leaving a
 * WebAssembly thread running behind the UI.
 */

import {
  OCR_CORE_PATH,
  OCR_ERROR_MESSAGES,
  OCR_LANG_PATH,
  OCR_WORKER_PATH,
  classifyOcrError,
  isSupportedLanguage,
  progressLine,
} from "./ocr-format";

export interface OcrResult {
  text: string;
  confidence: number;
  durationMs: number;
}

export interface OcrRunOptions {
  /** The `File` is handed to the engine as-is: re-wrapping the bytes in a Blob
   * would copy up to 25 MB for nothing, and `File` is what the engine reads. */
  image: File;
  lang: string;
  onProgress: (line: string) => void;
  isStale: () => boolean;
  onWorker: (terminate: () => Promise<void>) => void;
}

const OEM_LSTM_ONLY = 1;

function userFacing(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

export async function runOcr({
  image,
  lang,
  onProgress,
  isStale,
  onWorker,
}: OcrRunOptions): Promise<OcrResult | null> {
  const language = isSupportedLanguage(lang) ? lang : "eng";
  const started = Date.now();
  const Tesseract = await import("tesseract.js");
  if (isStale()) return null;
  const worker = await Tesseract.createWorker(language, OEM_LSTM_ONLY, {
    workerPath: OCR_WORKER_PATH,
    corePath: OCR_CORE_PATH,
    langPath: OCR_LANG_PATH,
    logger: (m: { status?: string; progress?: number }) => {
      if (isStale() || !m?.status) return;
      const line = progressLine(m.status, m.progress ?? 0, language);
      if (line) onProgress(line);
    },
  });
  onWorker(async () => {
    await worker.terminate().catch(() => {});
  });
  try {
    if (isStale()) return null;
    const { data } = await worker.recognize(image);
    if (isStale()) return null;
    return {
      text: typeof data.text === "string" ? data.text : "",
      confidence: Number.isFinite(data.confidence) ? data.confidence : 0,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    if (isStale()) return null;
    throw userFacing(OCR_ERROR_MESSAGES[classifyOcrError(err)]);
  } finally {
    await worker.terminate().catch(() => {});
  }
}
