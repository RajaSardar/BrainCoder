/**
 * The pixel maths of the image editor, with no browser API in sight: the
 * brightness / contrast / saturation chain, the filter matrices, and the vector
 * geometry of the annotation tools. `data` is a plain `Uint8ClampedArray` in
 * RGBA order, so the Node audit can run the real functions over synthetic
 * pixels and check what the tool promises about them.
 *
 * Canvas work stays in the component; this file is the part that decides what
 * every pixel becomes.
 */

/* -------------------------------------------------------------------------- */
/* Adjustments                                                                 */
/* -------------------------------------------------------------------------- */

export const ADJUST_MIN = -100;
export const ADJUST_MAX = 100;

export interface Adjustments {
  /** Percent. 0 is unchanged, +20 is a 1.2× multiply, matching `brightness(1.2)`. */
  brightness: number;
  /** Percent. 0 is unchanged, matching `contrast(1)`. */
  contrast: number;
  /** Percent. 0 is unchanged, matching `saturate(1)`. */
  saturation: number;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0 };

export function clampAdjust(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(ADJUST_MIN, Math.min(ADJUST_MAX, Math.round(value)));
}

export function clampAdjustments(value: Adjustments): Adjustments {
  return {
    brightness: clampAdjust(value.brightness),
    contrast: clampAdjust(value.contrast),
    saturation: clampAdjust(value.saturation),
  };
}

export function adjustmentsAreNeutral(value: Adjustments): boolean {
  return value.brightness === 0 && value.contrast === 0 && value.saturation === 0;
}

/** A one-line description of what is actually applied, for the UI and the name. */
export function adjustmentSummary(value: Adjustments): string {
  // Clamped, not trusted: a NaN that reached here would print "brightness NaN%"
  // into the status line and into a file name.
  const parts: string[] = [];
  const push = (label: string, amount: number) => {
    const v = clampAdjust(amount);
    if (v !== 0) parts.push(`${label} ${v > 0 ? "+" : ""}${v}%`);
  };
  push("brightness", value.brightness);
  push("contrast", value.contrast);
  push("saturation", value.saturation);
  return parts.length ? parts.join(", ") : "none";
}

/* -------------------------------------------------------------------------- */
/* Per-pixel maths                                                             */
/* -------------------------------------------------------------------------- */

export type RGB = [number, number, number];

/** The luminance coefficients CSS `grayscale(1)` uses. */
export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function withBrightness(v: number, amount: number): number {
  return v * (1 + amount / 100);
}

/** The slope/intercept pair CSS `contrast()` uses, computed once per value. */
export function contrastSlope(amount: number): { slope: number; intercept: number } {
  const c = 1 + amount / 100;
  const slope = (259 * (c * 255 + 255)) / (255 * (259 - c));
  return { slope, intercept: 128 - slope * 128 };
}

export function withContrast(v: number, amount: number): number {
  const { slope, intercept } = contrastSlope(amount);
  return v * slope + intercept;
}

/** The three-row matrix CSS `saturate()` uses, at strength `amount` percent. */
export function withSaturation(rgb: RGB, amount: number): RGB {
  const s = 1 + amount / 100;
  const [r, g, b] = rgb;
  return [
    (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
  ];
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                     */
/* -------------------------------------------------------------------------- */

export type FilterId = "none" | "grayscale" | "sepia" | "invert" | "cool" | "warm";

export interface FilterSpec {
  id: FilterId;
  label: string;
  note: string;
  apply: (rgb: RGB) => RGB;
}

export const FILTERS: FilterSpec[] = [
  { id: "none", label: "Original", note: "No filter at all: every pixel keeps the value the decoder produced.", apply: (rgb) => [rgb[0], rgb[1], rgb[2]] },
  {
    id: "grayscale",
    label: "Grayscale",
    note: "Every pixel becomes its Rec. 601 luma: 0.2126·R + 0.7152·G + 0.0722·B.",
    apply: ([r, g, b]) => {
      const y = luma(r, g, b);
      return [y, y, y];
    },
  },
  {
    id: "sepia",
    label: "Sepia",
    note: "The standard sepia colour matrix — a warm tone, not a desaturated photo.",
    apply: ([r, g, b]) => [
      0.393 * r + 0.769 * g + 0.189 * b,
      0.349 * r + 0.686 * g + 0.168 * b,
      0.272 * r + 0.534 * g + 0.131 * b,
    ],
  },
  {
    id: "invert",
    label: "Invert",
    note: "Each channel becomes 255 − channel. Its own inverse.",
    apply: ([r, g, b]) => [255 - r, 255 - g, 255 - b],
  },
  {
    id: "cool",
    label: "Cool",
    note: "Red down 7%, blue up 9%. A channel scaling, not a white-balance measurement.",
    apply: ([r, g, b]) => [r * 0.93, g, b * 1.09],
  },
  {
    id: "warm",
    label: "Warm",
    note: "Red up 9%, blue down 9%. A channel scaling, not a white-balance measurement.",
    apply: ([r, g, b]) => [r * 1.09, g, b * 0.91],
  },
];

export const DEFAULT_FILTER: FilterId = "none";

export function filterSpec(id: FilterId): FilterSpec {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

export function isFilterId(value: string): value is FilterId {
  return FILTERS.some((f) => f.id === value);
}

/**
 * One pixel through the whole chain, in the order the tool applies it: the
 * adjustments first, then the filter. Alpha is carried by the caller and never
 * touched here.
 */
export function transformPixel(
  rgb: RGB,
  adjust: Adjustments,
  filter: FilterId,
): RGB {
  let out: RGB = [rgb[0], rgb[1], rgb[2]];
  if (adjust.brightness !== 0) {
    out = [withBrightness(out[0], adjust.brightness), withBrightness(out[1], adjust.brightness), withBrightness(out[2], adjust.brightness)];
  }
  if (adjust.contrast !== 0) {
    const { slope, intercept } = contrastSlope(adjust.contrast);
    out = [out[0] * slope + intercept, out[1] * slope + intercept, out[2] * slope + intercept];
  }
  if (adjust.saturation !== 0) out = withSaturation(out, adjust.saturation);
  return filterSpec(filter).apply(out);
}

/**
 * Bakes the chain into an RGBA buffer in place. The clamp happens in the
 * `Uint8ClampedArray` store, which is what a canvas pixel buffer does, so this
 * function and the browser agree on the rounding.
 */
export function applyAdjustments(
  data: Uint8ClampedArray,
  adjust: Adjustments,
  filter: FilterId = DEFAULT_FILTER,
): void {
  if (adjustmentsAreNeutral(adjust) && filter === DEFAULT_FILTER) return;
  for (let i = 0; i + 2 < data.length; i += 4) {
    const [r, g, b] = transformPixel([data[i], data[i + 1], data[i + 2]], adjust, filter);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/* -------------------------------------------------------------------------- */
/* Annotation geometry                                                         */
/* -------------------------------------------------------------------------- */

export type AnnotationKind = "brush" | "line" | "rect" | "arrow" | "text";

export interface Point {
  x: number;
  y: number;
}

/**
 * An annotation in the image's own coordinate space, which is also the space a
 * crop lives in — so a crop, a rotation, a mirror or a scale all carry it
 * through the same matrix. `width` is in output pixels and is deliberately not
 * scaled: a stroke keeps the thickness it was drawn with.
 */
export interface Annotation {
  kind: AnnotationKind;
  points: Point[];
  color: string;
  width: number;
  text?: string;
  fontSize?: number;
}

export const MIN_BRUSH_PX = 1;
export const MAX_BRUSH_PX = 64;
export const DEFAULT_BRUSH_PX = 6;
export const MIN_FONT_PX = 8;
export const MAX_FONT_PX = 200;
export const DEFAULT_FONT_PX = 48;
export const MAX_TEXT_CHARS = 120;
export const MAX_STROKE_POINTS = 400;
/** Freehand tolerance as a fraction of the image diagonal, before scaling up. */
export const FREEFHAND_TOLERANCE = 0.0015;

export function clampBrush(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BRUSH_PX;
  return Math.max(MIN_BRUSH_PX, Math.min(MAX_BRUSH_PX, Math.round(value)));
}

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_PX;
  return Math.max(MIN_FONT_PX, Math.min(MAX_FONT_PX, Math.round(value)));
}

/** A stroke drawn at `width` screen pixels, recorded in output pixels. */
export function outputBrushWidth(screenWidth: number, previewScale: number): number {
  if (!Number.isFinite(screenWidth) || screenWidth <= 0) return DEFAULT_BRUSH_PX;
  if (!Number.isFinite(previewScale) || previewScale <= 0) return Math.round(screenWidth);
  return Math.max(MIN_BRUSH_PX, Math.min(MAX_BRUSH_PX, Math.round(screenWidth / previewScale)));
}

/**
 * The reverse, and the honest direction: a stroke is stored in output pixels, so
 * drawing it on a canvas that is smaller than the export divides it by the
 * reduction factor. `canvasPerOutput` is how many canvas pixels one output pixel
 * covers — exactly 1 when the canvas *is* the export.
 */
export function widthOnCanvas(outputWidth: number, canvasPerOutput: number): number {
  if (!Number.isFinite(outputWidth) || outputWidth <= 0) return 1;
  if (!Number.isFinite(canvasPerOutput) || canvasPerOutput <= 0) return outputWidth;
  return Math.max(0.5, outputWidth * canvasPerOutput);
}


export function clampAnnotationText(raw: string): string {
  return raw.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

/**
 * Ramer–Douglas–Peucker, iteratively: a 5,000-event scribble must not recurse
 * its way out of the stack while the pointer is still down.
 */
export function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const tol = Math.max(0, tolerance);
  const tolSq = tol * tol;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = -1;
    let index = -1;
    const a = points[first];
    const b = points[last];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i += 1) {
      const p = points[i];
      let dist: number;
      if (lenSq === 0) {
        dist = (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
      } else {
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        dist = (p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2;
      }
      if (dist > worst) {
        worst = dist;
        index = i;
      }
    }
    if (index >= 0 && worst > tolSq) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += 1) if (keep[i]) out.push(points[i]);
  return out;
}

/**
 * Simplifies a freehand path and guarantees the stored-point cap by widening
 * the tolerance until it fits. The cap is a real limit, so it is reported in
 * the UI rather than silently truncating a scribble.
 */
export function simplifyFreehand(
  points: Point[],
  tolerance: number,
  maxPoints = MAX_STROKE_POINTS,
): Point[] {
  if (points.length <= maxPoints) return points.slice();
  let tol = Math.max(tolerance, 1e-6);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const out = simplifyPath(points, tol);
    if (out.length <= maxPoints) return out;
    tol *= 2;
  }
  return simplifyPath(points, Number.POSITIVE_INFINITY).slice(0, maxPoints);
}

/** The two head points of an arrow, in output pixels. */
export function arrowHead(tip: Point, from: Point, headLength: number): [Point, Point] {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const spread = Math.PI / 7;
  const length = Math.max(1, headLength);
  return [
    { x: tip.x - length * Math.cos(angle - spread), y: tip.y - length * Math.sin(angle - spread) },
    { x: tip.x - length * Math.cos(angle + spread), y: tip.y - length * Math.sin(angle + spread) },
  ];
}

/** The rectangle an annotation covers, used for the "clear annotations" summary. */
export function annotationBounds(a: Annotation): { minX: number; minY: number; maxX: number; maxY: number } {
  if (a.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = a.points[0].x;
  let minY = a.points[0].y;
  let maxX = a.points[0].x;
  let maxY = a.points[0].y;
  for (const p of a.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function annotationCountLabel(count: number): string {
  if (count === 0) return "no annotations";
  if (count === 1) return "1 annotation";
  return `${count} annotations`;
}
