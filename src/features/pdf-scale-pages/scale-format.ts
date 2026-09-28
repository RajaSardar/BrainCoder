/**
 * Pure formatting/clamping helpers for PDF Scale Pages.
 *
 * Kept free of any pdf-lib import so the tool's first paint never pulls the
 * PDF engine into the initial bundle: the component imports this module
 * statically and the pdf-lib work is loaded on demand instead.
 */

export const MIN_PERCENT = 10;
export const MAX_PERCENT = 400;
export const DEFAULT_PERCENT = 100;

export const PRESETS: readonly number[] = [50, 75, 100, 150, 200];

/** Caps live here rather than in the engine so the component can enforce the
 *  same limits before it ever loads pdf-lib: the load path refuses with
 *  pdfjs, the engine refuses again, and the two can never disagree. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_PAGES = 200;

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PERCENT;
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value)));
}

/** `<source>-scaled-<pct>pct.pdf` — the factor is in the name so a folder of
 *  scaled copies stays unambiguous. */
export function outputNameFor(source: string, percent: number): string {
  const base = source
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim();
  return `${base || "document"}-scaled-${clampPercent(percent)}pct.pdf`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function trimNumber(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function formatPoints(points: number): string {
  return `${trimNumber(points)} pt`;
}

export function formatInches(points: number): string {
  return `${(points / 72).toFixed(2)} in`;
}

/** Real paper sizes in PDF points (1/72 in), tolerance 1.5% — printers and
 *  exporters are never exactly on the nominal millimetre value. */
const STANDARD_SIZES: ReadonlyArray<readonly [string, number, number]> = [
  ["A0", 2384, 3370],
  ["A1", 1684, 2384],
  ["A2", 1191, 1684],
  ["A3", 842, 1191],
  ["A4", 595, 842],
  ["A5", 420, 595],
  ["B5", 499, 709],
  ["Letter", 612, 792],
  ["Legal", 612, 1008],
  ["Tabloid", 792, 1224],
];

export function standardNameFor(widthPt: number, heightPt: number): string | null {
  for (const [label, long, short] of STANDARD_SIZES) {
    if (Math.abs(widthPt - long) <= long * 0.015 && Math.abs(heightPt - short) <= short * 0.015) {
      return label;
    }
    if (Math.abs(widthPt - short) <= short * 0.015 && Math.abs(heightPt - long) <= long * 0.015) {
      return `${label} landscape`;
    }
  }
  return null;
}

/** e.g. "A4 — 595 × 842 pt" */
export function describeBox(widthPt: number, heightPt: number): string {
  const dims = `${trimNumber(widthPt)} × ${trimNumber(heightPt)} pt`;
  const name = standardNameFor(widthPt, heightPt);
  return name ? `${name} — ${dims}` : dims;
}
