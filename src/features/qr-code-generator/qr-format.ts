/**
 * Everything about the QR generator that is presentation, arithmetic or advice,
 * kept out of the component and out of `qr-encode.ts` so the Node audit can
 * transpile both files and assert them side by side.
 *
 * Nothing here touches the DOM. The component owns the two things that must be
 * browser-side: the live raster preview and the download clicks.
 *
 * What this file is careful about is honesty. It refuses to round a module
 * count into a pixel count that a scanner cannot read, it reports the module
 * size a printer will actually get, and it never implies that a code with, say,
 * a light-on-dark colour scheme will scan on the first try.
 */

import { dataBitCapacity, maxCharCount, maxCountFor, type EccLevel, type QrSymbol } from "./qr-encode";

/* -------------------------------------------------------------------------- */
/* Constants                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * ISO/IEC 18004 §9.1: a code needs a quiet zone of at least four light modules
 * on every side. This tool never lets you download or preview without it.
 */
export const QUIET_ZONE_MODULES = 4;

/**
 * No QR code of any version stays readable with modules under three pixels
 * across, so that is the floor for the rendered preview and for a PNG.
 */
export const MIN_MODULE_PX = 3;

/** Past this the raster is bigger than any screen or printer needs. */
export const MAX_OUTPUT_PX = 2048;

/**
 * The largest number of characters any error-correction level can carry, which
 * is numeric data in a version 40 symbol at level L. Nothing longer than this
 * can be encoded at all, so the textarea stops here rather than after a failed
 * attempt.
 */
export const MAX_INPUT_CHARACTERS = maxCountFor("numeric", "L");

/** WCAG AA for large text, and the level below which scanners start to suffer. */
export const MIN_CONTRAST_RATIO = 4;

/** A module smaller than this on paper is below what most phone cameras resolve. */
export const PRINT_SAFE_MODULE_MM = 0.5;

export interface EccOption {
  value: EccLevel;
  label: string;
  /** Roughly the share of codewords the level can rebuild after damage. */
  recovery: string;
  blurb: string;
}

/** The four levels, in the order ISO/IEC 18004 lists them. */
export const ECC_OPTIONS: readonly EccOption[] = [
  {
    value: "L",
    label: "L — about 7%",
    recovery: "7%",
    blurb: "Smallest code, densest modules. Best for long content on a screen.",
  },
  {
    value: "M",
    label: "M — about 15%",
    recovery: "15%",
    blurb: "The usual default. Recovers from a little smudging or a small logo.",
  },
  {
    value: "Q",
    label: "Q — about 25%",
    recovery: "25%",
    blurb: "Recovers from a quarter of the symbol. Better for print and stickers.",
  },
  {
    value: "H",
    label: "H — about 30%",
    recovery: "30%",
    blurb: "Hardest to damage and to scan. Best for codes that get scuffed.",
  },
];

export interface CapacityRow {
  mode: string;
  /** The character count that mode holds at version 40 for a level. */
  count: number;
  example: string;
}

/** What each mode can carry at version 40 for the chosen level, honestly. */
export function capacityRows(level: EccLevel): CapacityRow[] {
  return [
    { mode: "Digits only", count: maxCountFor("numeric", level), example: "4417984" },
    { mode: "Uppercase and symbols", count: maxCountFor("alphanumeric", level), example: "HTTPS://EXAMPLE.COM/A1" },
    { mode: "Any text", count: maxCountFor("byte", level), example: "https://example.com/p/42" },
  ];
}

/* -------------------------------------------------------------------------- */
/* Colour contrast                                                              */
/* -------------------------------------------------------------------------- */

export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(value)) return [0, 0, 0];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG relative-contrast ratio between the module colour and the background. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.5;
}

/**
 * A scanner reads light modules as zero and dark as one. A code whose majority
 * of modules are light is the inverted, error-prone case, so it is worth saying
 * out loud rather than letting it fail at a till.
 */
export function inversionWarning(dark: string, light: string): string | null {
  if (contrastRatio(dark, light) < MIN_CONTRAST_RATIO) {
    return `These two colours only reach a contrast ratio of ${contrastRatio(dark, light).toFixed(1)}:1. Scanners need at least ${MIN_CONTRAST_RATIO}:1, so this code may read as a smudge rather than a QR code.`;
  }
  if (isDark(dark) && isDark(light)) {
    return "Both colours are dark, so there is very little contrast between the modules and the background.";
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                     */
/* -------------------------------------------------------------------------- */

export interface Geometry {
  /** Modules on one side, quiet zone excluded. */
  modules: number;
  /** Quiet-zone modules on each side. */
  quiet: number;
  /** Modules across the finished image, quiet zone included. */
  totalModules: number;
  /** Whole pixels per module — never a fraction, or the modules blur. */
  scale: number;
  /** Finished PNG edge length in pixels. */
  pixels: number;
  /** Pixels the quiet zone takes on each side. */
  quietPx: number;
  /** True when the request was clamped to MAX_OUTPUT_PX. */
  clamped: boolean;
}

/**
 * Snap a requested pixel width to a whole number of pixels per module. Asking
 * for 320px on a 21-module code with a four-module quiet zone would be 11.02
 * pixels per module, which draws a ragged edge; 11 is the honest answer.
 */
export function geometry(modules: number, requestedPx: number, quiet = QUIET_ZONE_MODULES): Geometry {
  const totalModules = modules + quiet * 2;
  const wanted = Math.max(64, Math.round(requestedPx));
  const capped = Math.min(wanted, MAX_OUTPUT_PX);
  const scale = Math.max(1, Math.floor(capped / totalModules));
  const usable = scale * totalModules;
  return {
    modules,
    quiet,
    totalModules,
    scale,
    pixels: usable,
    quietPx: quiet * scale,
    clamped: usable < wanted,
  };
}

/**
 * What one module measures when the code is printed at `widthMm` wide. Print is
 * where dense versions quietly stop working: a version 20 code printed 40 mm
 * wide has modules a scanner cannot resolve.
 */
export function printedModuleMm(modules: number, widthMm: number, quiet = QUIET_ZONE_MODULES): number {
  return widthMm / (modules + quiet * 2);
}

export function printWarning(modules: number, widthMm: number, quiet = QUIET_ZONE_MODULES): string | null {
  const mm = printedModuleMm(modules, widthMm, quiet);
  if (mm < PRINT_SAFE_MODULE_MM) {
    return `At ${widthMm} mm wide that is ${mm.toFixed(2)} mm per module, under the ${PRINT_SAFE_MODULE_MM} mm most phone cameras need. Print it larger, or shorten the content to get a coarser version.`;
  }
  return null;
}

/**
 * Versions above about 10 put modules close enough together that screen
 * rescaling, camera autofocus and cheap printers start to lose them.
 */
export function densityWarning(version: number): string | null {
  if (version <= 10) return null;
  if (version <= 20) {
    return `This is version ${version}, with modules tight enough that screen scaling and cheap printers can lose them. Keep it on screen or on good paper.`;
  }
  return `This is version ${version} — ${version * 4 + 17} modules across. Shorten the content: at this density only a good camera on good paper will read it.`;
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                                 */
/* -------------------------------------------------------------------------- */

/** Thousands separators, so "7089" reads as "7,089" next to a capacity table. */
export function groupDigits(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** One line describing exactly what was encoded, for the status region. */
export function describeSymbol(symbol: QrSymbol): string {
  const unit = symbol.mode === "byte" ? "bytes" : symbol.charCount === 1 ? "character" : "characters";
  return [
    `version ${symbol.version}`,
    `${symbol.size}×${symbol.size} modules`,
    `${symbol.mode} mode`,
    `${groupDigits(symbol.charCount)} ${unit}`,
    `error correction ${symbol.level}`,
    `data mask ${symbol.mask}`,
  ].join(" · ");
}

/* -------------------------------------------------------------------------- */
/* Refusals                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The one refusal the UI needs beyond capacity: nothing is generated, and no
 * button is enabled, once the string is past what any level could hold.
 */
export function lengthRefusal(characters: number): string {
  return `That is ${groupDigits(characters)} characters. The largest QR code, version 40 at error correction L, holds ${groupDigits(MAX_INPUT_CHARACTERS)} digits — and mixed text uses far fewer. Shorten it, or encode a link to the long content instead.`;
}

/* -------------------------------------------------------------------------- */
/* Vector output                                                                */
/* -------------------------------------------------------------------------- */

export interface SvgOptions {
  size: number;
  quiet?: number;
  dark: string;
  light: string;
  /** Accessible name for the file, since an SVG is often used in a document. */
  title: string;
  pixels?: number;
}

/**
 * Real vector output: one `<rect>` background and a single `<path>` of merged
 * module runs, in a viewBox measured in modules. It scales to any size without
 * resampling, and `shape-rendering="crispEdges"` keeps the module edges square
 * when a browser does rasterise it.
 */
export function svgMarkup(modules: Uint8Array, options: SvgOptions): string {
  const size = options.size;
  const quiet = options.quiet ?? QUIET_ZONE_MODULES;
  const totalModules = size + quiet * 2;
  const scale = options.pixels ? Math.max(1, Math.floor(options.pixels / totalModules)) : 8;
  const runs: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!modules[row * size + col]) {
        col += 1;
        continue;
      }
      let end = col;
      while (end < size && modules[row * size + end]) end += 1;
      runs.push(`M${col + quiet} ${row + quiet}h${end - col}v1h-${end - col}z`);
      col = end;
    }
  }
  const pixels = totalModules * scale;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}"`,
    ` viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges" role="img">`,
    `<title>${escapeXml(options.title)}</title>`,
    `<rect width="${totalModules}" height="${totalModules}" fill="${options.light}"/>`,
    `<path fill="${options.dark}" d="${runs.join("")}"/>`,
    `</svg>`,
  ].join("");
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) =>
    char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === "&" ? "&amp;" : char === '"' ? "&quot;" : "&apos;",
  );
}

/* -------------------------------------------------------------------------- */
/* Self-check used by the audit                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Re-derive the capacity limit straight from the bit arithmetic, so the table
 * the UI shows cannot drift away from what the encoder will actually accept.
 */
export function version40Limit(level: EccLevel): { numeric: number; alphanumeric: number; byte: number } {
  const bits = dataBitCapacity(40, level);
  return {
    numeric: maxCharCount("numeric", bits, 40),
    alphanumeric: maxCharCount("alphanumeric", bits, 40),
    byte: maxCharCount("byte", bits, 40),
  };
}