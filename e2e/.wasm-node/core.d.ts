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

export function split_words(xs: Float64Array, ys: Float64Array, ws: Float64Array, hs: Float64Array, fs: Float64Array, bs: Float64Array, texts: string[]): WordBatch;
