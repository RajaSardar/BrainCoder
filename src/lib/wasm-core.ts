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

export type MatchRect = { x: number; y: number; w: number; h: number };

let wasmModule: Promise<CoreFindMatches | null> | null = null;

export function loadCore(
  wasmUrl = "/wasm/core_bg.wasm",
): Promise<CoreFindMatches | null> {
  if (!wasmModule) {
    wasmModule = (async () => {
      try {
        if (typeof WebAssembly !== "object") return null;
        const mod = await import("@/lib/core/pkg/core");
        if (typeof mod.default !== "function") return null;
        await mod.default(wasmUrl);
        if (typeof mod.find_matches !== "function") return null;
        return mod.find_matches as CoreFindMatches;
      } catch (err) {
        console.warn("[wasm-core] falling back to JS core:", err);
        return null;
      }
    })();
  }
  return wasmModule;
}

export async function findMatchRects(
  words: { x: number; y: number; width: number; height: number; fontSize: number; text: string }[],
  pageW: number,
  pageH: number,
  query: string,
): Promise<{ rects: MatchRect[]; engine: "wasm" | "js" }> {
  if (words.length === 0) return { rects: [], engine: "js" };
  const find = await loadCore();
  if (!find) {
    return { rects: matchRectsJs(words, pageW, pageH, query), engine: "js" };
  }
  const flat = find(
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