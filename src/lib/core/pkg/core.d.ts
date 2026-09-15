/* tslint:disable */
/* eslint-disable */

export class WordBatch {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    data(): Float64Array;
    texts(): string[];
}

export function add(a: number, b: number): number;

export function extract_pdfs(bytes: Uint8Array, groups: Array<any>): any;

export function find_matches(xs: Float64Array, ys: Float64Array, ws: Float64Array, hs: Float64Array, fonts: Float64Array, texts: string[], page_w: number, page_h: number, query: string): Float64Array;

export function merge_pdfs(files: any[]): Uint8Array;

/**
 * True-redact page content: excises text/image/path operators intersecting any
 * given rect, then paints an opaque black box over each region.
 *
 * `page_rects` is an outer `Array` (one element per page, page index 0-based)
 * whose entries are `Array`s of `Rect`s; each `Rect` is a 4-element
 * `Array` `[x0, y0, x1, y1]` in PDF user space (y-up points).
 */
export function redact_pdfs(bytes: Uint8Array, page_rects: Array<any>): Uint8Array;

export function split_words(xs: Float64Array, ys: Float64Array, ws: Float64Array, hs: Float64Array, fs: Float64Array, bs: Float64Array, texts: string[]): WordBatch;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wordbatch_free: (a: number, b: number) => void;
    readonly add: (a: number, b: number) => number;
    readonly extract_pdfs: (a: number, b: number, c: number, d: number) => void;
    readonly find_matches: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number) => void;
    readonly merge_pdfs: (a: number, b: number, c: number) => void;
    readonly redact_pdfs: (a: number, b: number, c: number, d: number) => void;
    readonly split_words: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => number;
    readonly wordbatch_data: (a: number, b: number) => void;
    readonly wordbatch_texts: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
