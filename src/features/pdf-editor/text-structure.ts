import { OPS } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { createId } from "./annotations";

export interface TextRun {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  baseline: number;
  text: string;
}

export interface ImageRun {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContentRuns {
  text: TextRun[];
  images: ImageRun[];
}

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  dir: string;
}

const MIN_TEXT_FONT = 3;
const MIN_IMAGE_SIZE = 4;
const H_MATRIX = [1, 0, 0, 1, 0, 0];
const UNIT_SQUARE: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function mul(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  m: number[]
): number[] {
  return [
    a * m[0] + b * m[2],
    a * m[1] + b * m[3],
    c * m[0] + d * m[2],
    c * m[1] + d * m[3],
    e * m[0] + f * m[2] + m[4],
    e * m[1] + f * m[3] + m[5],
  ];
}

function apply(m: number[], px: number, py: number): [number, number] {
  return [m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]];
}

function boundsOf(ctm: number[], pts: ReadonlyArray<ReadonlyArray<number>>): [number, number, number, number] {
  const mapped = pts.map(([x, y]) => apply(ctm, x, y));
  const xs = mapped.map((p) => p[0]);
  const ys = mapped.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

export async function extractContentRuns(
  doc: PDFDocumentProxy,
  pageIndex: number
): Promise<ContentRuns> {
  const page = await doc.getPage(pageIndex + 1);
  const height = page.getViewport({ scale: 1 }).height;

  const text: TextRun[] = [];
  const content = await page.getTextContent();
  for (const item of content.items as Array<TextItemLike | { str?: never }>) {
    const str = typeof (item as { str?: unknown }).str === "string" ? (item as TextItemLike).str : "";
    if (!str) continue;
    const tr = (item as TextItemLike).transform;
    if (!tr || tr.length < 6) continue;
    if ((item as TextItemLike).dir === "rtl") continue;
    const a = tr[0];
    const b = tr[1];
    const c = tr[2];
    const d = tr[3];
    if (Math.abs(b) > Math.abs(a) * 0.05 || Math.abs(c) > Math.abs(d) * 0.05) continue;
    const fontSize = Math.hypot(a, b);
    if (fontSize < MIN_TEXT_FONT) continue;
    const ascent = fontSize * 0.85;
    const descent = fontSize * 0.25;
    const x = tr[4];
    const baseY = tr[5];
    const width = Math.max(fontSize * str.length * 0.5, (item as TextItemLike).width || 0);
    const y = height - (baseY + ascent);
    text.push({
      id: createId(),
      x,
      y,
      width,
      height: ascent + descent,
      baseline: y + ascent,
      fontSize,
      text: str,
    });
  }

  const images: ImageRun[] = [];
  const ops = await page.getOperatorList();
  let ctm = H_MATRIX.slice() as number[];
  const stack: number[][] = [];
  const fns = ops.fnArray as number[];
  const args = ops.argsArray as unknown[][];
  const recordImageRect = (pts: ReadonlyArray<ReadonlyArray<number>>) => {
    const [x0, x1, y0, y1] = boundsOf(ctm, pts);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < MIN_IMAGE_SIZE || h < MIN_IMAGE_SIZE) return;
    images.push({ id: createId(), x: x0, y: height - y1, width: w, height: h });
  };
  for (let k = 0; k < fns.length; k++) {
    const fn = fns[k];
    const arg = args[k];
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.length ? stack.pop()! : H_MATRIX.slice() as number[];
    } else if (fn === OPS.transform) {
      const [a, b, c, d, e, f] = arg as number[];
      ctm = mul(a, b, c, d, e, f, ctm);
    } else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageMaskXObject
    ) {
      recordImageRect(UNIT_SQUARE);
    } else if (fn === OPS.paintImageXObjectRepeat || fn === OPS.paintImageMaskXObjectRepeat) {
      const [, rx, ry, rw, rh] = arg as Array<number | string>;
      recordImageRect([
        [rx as number, ry as number],
        [(rx as number) + (rw as number), ry as number],
        [(rx as number) + (rw as number), (ry as number) + (rh as number)],
        [rx as number, (ry as number) + (rh as number)],
      ]);
    }
  }

  return { text, images };
}