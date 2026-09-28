import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import type { PDFPage } from "pdf-lib";

import { MAX_PAGES } from "./scale-format";

/**
 * In-place page scaling for PDF Scale Pages.
 *
 * The page content is scaled, never re-rendered: text stays real text, fonts
 * and images keep their data, and the document keeps its bookmarks, links,
 * form fields and metadata. A page is a coordinate system though, not just a
 * picture, so "scale the page" has to move three things together:
 *
 *   1. every page box the page defines (media, crop, bleed, trim, art),
 *   2. the content stream, and
 *   3. the annotation geometry that lives in page space (link rectangles,
 *      comment boxes, ink strokes, form-field widgets).
 *
 * All three are multiplied by the same factor about the same point, so the
 * visible result is a faithful smaller/larger copy of the same page — no
 * cropping, no stretching, no rasterization.
 */

export { MAX_PAGES };

/**
 * Field appearance streams are deliberately NOT regenerated. A widget draws
 * its value in its own /BBox space and the viewer maps that BBox onto /Rect;
 * re-generating it for the shrunken rectangle would keep the glyphs at full
 * size inside a smaller box. Keeping the existing stream and shrinking the
 * rectangle scales the rendered field with the page, which is what a uniform
 * scale should do. `addDefaultPage: false` keeps a document with no pages from
 * silently gaining one.
 */
const SAVE_OPTIONS = { updateFieldAppearances: false, addDefaultPage: false };

/** Boxes that describe the page beyond the media box, in the order a reader
 *  would use them. Only boxes that actually exist are touched. */
const OPTIONAL_BOXES = ["CropBox", "BleedBox", "TrimBox", "ArtBox"] as const;

/** Annotation keys whose numbers are page-space x/y pairs. */
const OFFSET_KEYS = ["Rect", "L", "CL", "QuadPoints", "Vertices"] as const;
const INK_KEY = "InkList";

/** The PDF specification's own default when a page carries no MediaBox. */
const DEFAULT_MEDIA_BOX = { x: 0, y: 0, width: 612, height: 792 };

export interface PageBox {
  width: number;
  height: number;
}

export interface ScaledDocument {
  bytes: Uint8Array;
  pages: number;
  /** Visible box of page 1 before scaling, as a reader displays it. */
  firstBefore: PageBox;
  /** The same page after scaling. */
  firstAfter: PageBox;
  smallestAfter: PageBox;
  largestAfter: PageBox;
  /** True when the pages in this file are not all the same size. */
  mixedSizes: boolean;
  /** Page boxes that were too malformed or degenerate to scale safely. */
  skippedBoxes: number;
}

interface Box extends PageBox {
  x: number;
  y: number;
}

type BoxName = (typeof OPTIONAL_BOXES)[number];

const BOX_SETTERS: Record<BoxName, (page: PDFPage, x: number, y: number, w: number, h: number) => void> = {
  CropBox: (page, x, y, w, h) => page.setCropBox(x, y, w, h),
  BleedBox: (page, x, y, w, h) => page.setBleedBox(x, y, w, h),
  TrimBox: (page, x, y, w, h) => page.setTrimBox(x, y, w, h),
  ArtBox: (page, x, y, w, h) => page.setArtBox(x, y, w, h),
};

/**
 * Reads a page box, following the /Pages inheritance chain: a CropBox defined
 * on the tree node still describes every page below it, so it has to be found
 * here — and written back onto the page when it is scaled, otherwise the page
 * would keep inheriting an unscaled box.
 */
function readBox(page: PDFPage, name: string): Box | null {
  try {
    const raw = page.node.getInheritableAttribute(PDFName.of(name));
    if (raw === undefined) return null;
    const array = raw instanceof PDFArray ? raw : page.doc.context.lookupMaybe(raw, PDFArray);
    if (!array || array.size() < 4) return null;
    const nums: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const value = array.lookup(i);
      if (!(value instanceof PDFNumber)) return null;
      nums.push(value.asNumber());
    }
    const [x1, y1, x2, y2] = nums;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  } catch {
    return null;
  }
}

function isScaledBoxUsable(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/** A dictionary entry that is supposed to be an array. A malformed entry must
 *  not throw its way out of the whole run, so a wrong type is treated as
 *  absent and left untouched. */
function arrayOf(dict: PDFDict, name: string): PDFArray | null {
  try {
    return dict.lookupMaybe(PDFName.of(name), PDFArray) ?? null;
  } catch {
    return null;
  }
}

function dictAt(array: PDFArray, index: number): PDFDict | null {
  try {
    return array.lookupMaybe(index, PDFDict) ?? null;
  } catch {
    return null;
  }
}

function arrayAt(array: PDFArray, index: number): PDFArray | null {
  try {
    return array.lookupMaybe(index, PDFArray) ?? null;
  } catch {
    return null;
  }
}

/** Adds dx/dy to a flat array of x/y pairs — the same parity walk pdf-lib uses
 *  when it scales annotation geometry. */
function offsetPairs(array: PDFArray, dx: number, dy: number): void {
  for (let i = 0; i < array.size(); i += 1) {
    const value = array.lookup(i);
    if (value instanceof PDFNumber) {
      const delta = i % 2 === 0 ? dx : dy;
      array.set(i, PDFNumber.of(value.asNumber() + delta));
    }
  }
}

/**
 * Moves annotation geometry that is expressed in page space. Only used for the
 * rare page whose MediaBox does not start at the origin — a form widget's
 * appearance stream is deliberately left alone, because it is drawn in its own
 * BBox space rather than in page space.
 */
function offsetAnnotationGeometry(page: PDFPage, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  // Ensures /Annots exists even on a page that never had any.
  page.node.normalize();
  const annots = page.node.Annots();
  if (!annots) return;
  for (let i = 0; i < annots.size(); i += 1) {
    const annot = dictAt(annots, i);
    if (!annot) continue;
    for (const key of OFFSET_KEYS) {
      const array = arrayOf(annot, key);
      if (array) offsetPairs(array, dx, dy);
    }
    const ink = arrayOf(annot, INK_KEY);
    if (!ink) continue;
    for (let s = 0; s < ink.size(); s += 1) {
      const stroke = arrayAt(ink, s);
      if (stroke) offsetPairs(stroke, dx, dy);
    }
  }
}

function pageRotation(page: PDFPage): number {
  try {
    const raw = page.node.getInheritableAttribute(PDFName.of("Rotate"));
    if (raw === undefined) return 0;
    const value = raw instanceof PDFNumber ? raw : page.doc.context.lookupMaybe(raw, PDFNumber);
    if (!value) return 0;
    const degrees = ((Math.trunc(value.asNumber()) % 360) + 360) % 360;
    return degrees === 90 || degrees === 270 ? degrees : 0;
  } catch {
    return 0;
  }
}

/**
 * The box a reader actually shows: the crop box clipped to the media box,
 * with /Rotate 90/270 swapped to the displayed orientation. This is the same
 * intersection pdf.js reports, so the preview and the result agree.
 */
export function displayedBoxOf(page: PDFPage): PageBox {
  const media = readBox(page, "MediaBox") ?? DEFAULT_MEDIA_BOX;
  const crop = readBox(page, "CropBox") ?? media;
  const x0 = Math.max(media.x, crop.x);
  const y0 = Math.max(media.y, crop.y);
  const x1 = Math.min(media.x + media.width, crop.x + crop.width);
  const y1 = Math.min(media.y + media.height, crop.y + crop.height);
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  return pageRotation(page) === 0 ? { width, height } : { width: height, height: width };
}

/**
 * Scales one page in place. Returns the number of page boxes that could not be
 * scaled safely, so the caller can disclose it rather than hide it.
 */
function scalePage(page: PDFPage, factor: number): number {
  const media = readBox(page, "MediaBox") ?? DEFAULT_MEDIA_BOX;
  let skipped = 0;
  const originX = media.x;
  const originY = media.y;

  // A page whose media box does not start at the origin only keeps its
  // geometry if the content moves with the box, so translate the content and
  // the annotations by the origin first and then express the page from zero.
  if (originX !== 0 || originY !== 0) {
    page.translateContent(-originX, -originY);
    offsetAnnotationGeometry(page, -originX, -originY);
  }

  if (isScaledBoxUsable(media.width * factor, media.height * factor)) {
    page.setMediaBox(0, 0, media.width * factor, media.height * factor);
  } else {
    skipped += 1;
  }

  for (const name of OPTIONAL_BOXES) {
    const box = readBox(page, name);
    if (!box) continue;
    const next = {
      x: (box.x - originX) * factor,
      y: (box.y - originY) * factor,
      width: box.width * factor,
      height: box.height * factor,
    };
    if (!isScaledBoxUsable(next.width, next.height)) {
      skipped += 1;
      continue;
    }
    BOX_SETTERS[name](page, next.x, next.y, next.width, next.height);
  }

  page.scaleContent(factor, factor);
  page.scaleAnnotations(factor, factor);
  return skipped;
}

function sizeKey(box: PageBox): string {
  return `${box.width.toFixed(1)}x${box.height.toFixed(1)}`;
}

function byArea(a: PageBox, b: PageBox): number {
  return a.width * a.height - b.width * b.height;
}

export interface ScaleRunOptions {
  data: Uint8Array;
  factor: number;
  onProgress?: (page: number, total: number) => void;
  isStale?: () => boolean;
}

export async function scalePdfInPlace({
  data,
  factor,
  onProgress,
  isStale,
}: ScaleRunOptions): Promise<ScaledDocument | null> {
  const stale = isStale ?? (() => false);
  // No ignoreEncryption: a password-protected file must be refused, not
  // written back out with its /Encrypt dictionary pointing at bytes that
  // have moved.
  const doc = await PDFDocument.load(data, { updateMetadata: false });
  const pages = doc.getPages();
  if (pages.length === 0) {
    throw new Error("This PDF has no pages to scale.");
  }
  if (pages.length > MAX_PAGES) {
    throw new Error(`This PDF has ${pages.length} pages — scaling supports up to ${MAX_PAGES} pages per file.`);
  }

  const before: PageBox[] = [];
  let skippedBoxes = 0;
  for (let i = 0; i < pages.length; i += 1) {
    // A newer run has taken over: stop burning CPU on this one.
    if (stale()) return null;
    const page = pages[i];
    before.push(displayedBoxOf(page));
    skippedBoxes += scalePage(page, factor);
    onProgress?.(i + 1, pages.length);
    // The page work above is synchronous pdf-lib, so a plain `await` would
    // keep the whole run inside one microtask drain and the per-page progress
    // would never paint. Hand back to the event loop so React can flush the
    // announced progress before the next page starts.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (stale()) return null;
  }
  if (stale()) return null;

  // Every box was multiplied by the same factor about the same point, so the
  // visible box after scaling is exactly the visible box before times the
  // factor — no re-read needed (and no stale inheritable-attribute cache).
  const after: PageBox[] = before.map((box) => ({
    width: box.width * factor,
    height: box.height * factor,
  }));

  const bytes = new Uint8Array(await doc.save(SAVE_OPTIONS));
  if (stale()) return null;

  return {
    bytes,
    pages: pages.length,
    firstBefore: before[0],
    firstAfter: after[0],
    smallestAfter: after.reduce((min, box) => (byArea(box, min) < 0 ? box : min)),
    largestAfter: after.reduce((max, box) => (byArea(box, max) > 0 ? box : max)),
    mixedSizes: new Set(after.map(sizeKey)).size > 1,
    skippedBoxes,
  };
}
