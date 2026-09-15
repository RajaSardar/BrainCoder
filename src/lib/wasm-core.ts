type CoreFindMatches = (
  xs: Float64Array,
  ys: Float64Array,
  ws: Float64Array,
  hs: Float64Array,
  fonts: Float64Array,
  texts: string[],
  pageW: number,
  pageH: number,
  query: string,
) => Float64Array;

type CoreWordBatch = {
  data(): Float64Array;
  texts(): string[];
};

export interface CoreApi {
  find_matches: CoreFindMatches;
  split_words: (
    xs: Float64Array,
    ys: Float64Array,
    ws: Float64Array,
    hs: Float64Array,
    fonts: Float64Array,
    baselines: Float64Array,
    texts: string[],
  ) => CoreWordBatch;
  merge_pdfs: (files: Uint8Array[]) => Uint8Array;
  extract_pdfs: (bytes: Uint8Array, groups: number[][]) => Uint8Array[];
  redact_pdfs: (bytes: Uint8Array, pageRects: number[][][]) => Uint8Array;
}

export type MatchRect = { x: number; y: number; w: number; h: number };

export type GeometryWord = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  baseline: number;
  text: string;
};

let modulePromise: Promise<CoreApi | null> | null = null;

export function loadCore(
  wasmUrl = "/wasm/core_bg.wasm",
): Promise<CoreApi | null> {
  if (!modulePromise) {
    modulePromise = (async () => {
      try {
        if (typeof WebAssembly !== "object") return null;
        const mod = await import("@/lib/core/pkg/core");
        if (typeof mod.default !== "function") return null;
        await mod.default(wasmUrl);
        if (typeof mod.find_matches !== "function") return null;
        return mod as unknown as CoreApi;
      } catch (err) {
        console.warn("[wasm-core] falling back to JS core:", err);
        return null;
      }
    })();
  }
  return modulePromise;
}

export async function findMatchRects(
  words: { x: number; y: number; width: number; height: number; fontSize: number; text: string }[],
  pageW: number,
  pageH: number,
  query: string,
): Promise<{ rects: MatchRect[]; engine: "wasm" | "js" }> {
  if (words.length === 0) return { rects: [], engine: "js" };
  const core = await loadCore();
  if (!core) {
    return { rects: matchRectsJs(words, pageW, pageH, query), engine: "js" };
  }
  const flat = core.find_matches(
    Float64Array.from(words, (w) => w.x),
    Float64Array.from(words, (w) => w.y),
    Float64Array.from(words, (w) => w.width),
    Float64Array.from(words, (w) => w.height),
    Float64Array.from(words, (w) => w.fontSize),
    words.map((w) => w.text),
    pageW,
    pageH,
    query,
  );
  const rects: MatchRect[] = [];
  for (let i = 0; i < flat.length; i += 4) {
    rects.push({ x: flat[i], y: flat[i + 1], w: flat[i + 2], h: flat[i + 3] });
  }
  return { rects, engine: "wasm" };
}

export async function splitWordsWasm(
  words: GeometryWord[],
): Promise<GeometryWord[] | null> {
  if (words.length === 0) return [];
  const core = await loadCore();
  if (!core) return null;
  try {
    const batch = core.split_words(
      Float64Array.from(words, (w) => w.x),
      Float64Array.from(words, (w) => w.y),
      Float64Array.from(words, (w) => w.width),
      Float64Array.from(words, (w) => w.height),
      Float64Array.from(words, (w) => w.fontSize),
      Float64Array.from(words, (w) => w.baseline),
      words.map((w) => w.text),
    );
    const data = batch.data();
    const texts = batch.texts();
    const out: GeometryWord[] = [];
    for (let i = 0; i < texts.length; i++) {
      out.push({
        x: data[i * 6],
        y: data[i * 6 + 1],
        width: data[i * 6 + 2],
        height: data[i * 6 + 3],
        fontSize: data[i * 6 + 4],
        baseline: data[i * 6 + 5],
        text: texts[i],
      });
    }
    return out;
  } catch (err) {
    console.warn("[wasm-core] split_words failed, using JS fallback:", err);
    return null;
  }
}

export async function mergePdfsWasm(
  files: Uint8Array[],
): Promise<Uint8Array | null> {
  if (files.length < 2) return null;
  const core = await loadCore();
  if (!core) return null;
  try {
    const out = core.merge_pdfs(files.map((f) => f.slice(0)));
    return out.slice(0);
  } catch (err) {
    console.warn("[wasm-core] merge failed, using JS fallback:", err);
    return null;
  }
}

export async function extractPdfsWasm(
  bytes: Uint8Array,
  groups: number[][],
): Promise<Uint8Array[] | null> {
  if (groups.length === 0) return [];
  const core = await loadCore();
  if (!core) return null;
  try {
    const out = core.extract_pdfs(bytes.slice(0), groups);
    return out.map((b) => new Uint8Array(b.slice(0)));
  } catch (err) {
    console.warn("[wasm-core] extract failed, using JS fallback:", err);
    return null;
  }
}

export async function redactPdfsWasm(
  bytes: Uint8Array,
  pageRects: number[][][],
): Promise<{ bytes: Uint8Array; ms: number } | null> {
  if (pageRects.every((g) => g.length === 0)) return null;
  const core = await loadCore();
  if (!core) return null;
  const t0 = performance.now();
  try {
    const out = core.redact_pdfs(bytes.slice(0), pageRects);
    return { bytes: new Uint8Array(out.slice(0)), ms: performance.now() - t0 };
  } catch (err) {
    console.warn("[wasm-core] redact failed, using JS fallback:", err);
    return null;
  }
}

const STRIP = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const normWord = (s: string) => s.replace(STRIP, "").toLowerCase();

function matchRectsJs(
  words: { x: number; y: number; width: number; height: number; fontSize: number; text: string }[],
  pageW: number,
  pageH: number,
  query: string,
): MatchRect[] {
  const q = query.trim().toLowerCase();
  const queryWords = q.split(/\s+/).filter(Boolean);
  const rects: MatchRect[] = [];
  const n = words.length;
  const qn = queryWords.length;
  if (qn === 0) return rects;
  for (let i = 0; i < n; i++) {
    let k = 0;
    let j = i;
    while (k < qn && j < n && normWord(words[j].text) === queryWords[k]) {
      k++;
      j++;
    }
    if (k === qn) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let m = i; m < j; m++) {
        const w = words[m];
        minX = Math.min(minX, w.x);
        minY = Math.min(minY, w.y);
        maxX = Math.max(maxX, w.x + w.width);
        maxY = Math.max(maxY, w.y + w.height);
      }
      const fs = words[i].fontSize;
      const padX = (fs * 0.12) / pageW;
      const padY = (fs * 0.2) / pageH;
      rects.push({
        x: Math.max(0, minX / pageW - padX),
        y: Math.max(0, minY / pageH - padY),
        w: Math.min(1, maxX / pageW - minX / pageW + padX * 2),
        h: Math.min(1, maxY / pageH - minY / pageH + padY * 2),
      });
    }
  }
  return rects;
}