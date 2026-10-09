export const MIN_BASE = 8;
export const MAX_BASE = 24;
export const DEFAULT_BASE = 16;
export const MAX_ABS_VALUE = 1_000_000;
export const DASH = "—";

export const REFERENCE_PX = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64];

export function clampBase(base: number): number {
  if (!Number.isFinite(base)) return DEFAULT_BASE;
  return Math.min(MAX_BASE, Math.max(MIN_BASE, Math.round(base)));
}

export function parseUnitValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > MAX_ABS_VALUE) return null;
  return n;
}

export function formatNumber(n: number, decimals = 6): string {
  if (!Number.isFinite(n)) return DASH;
  const rounded = Number(n.toFixed(decimals));
  return String(rounded);
}

export function pxToRem(px: number, base: number): number {
  return px / base;
}

export function remToPx(rem: number, base: number): number {
  return rem * base;
}

export interface ReferenceRow {
  px: number;
  rem: string;
}

export function referenceTable(base: number): ReferenceRow[] {
  return REFERENCE_PX.map((px) => ({ px, rem: formatNumber(px / base) }));
}
