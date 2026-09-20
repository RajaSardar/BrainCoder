"use client";

import { useMemo, useId, useState } from "react";
import { CopyButton } from "@/components/ui";

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

function parseChannel(v: string): number {
  return v.endsWith("%") ? clamp((parseFloat(v) / 100) * 255, 255) : clamp(parseFloat(v), 255);
}

function parseAlpha(v: string | undefined): number | null {
  if (v == null) return 1;
  const n = v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

function parseColor(input: string): Color | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  if (s.startsWith("#")) {
    const h = s.slice(1);
    if (/^[0-9a-f]{3}$/.test(h)) {
      const [r, g, b] = [...h].map((c) => parseInt(c + c, 16));
      return { r, g, b, a: 1 };
    }
    if (/^[0-9a-f]{4}$/.test(h)) {
      const [r, g, b, a] = [...h].map((c) => parseInt(c + c, 16));
      return { r, g, b, a: a / 255 };
    }
    if (/^[0-9a-f]{6}$/.test(h)) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1,
      };
    }
    if (/^[0-9a-f]{8}$/.test(h)) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    }
    return null;
  }

  const rgbMatch = s.match(/^rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*(?:,\s*([\d.]+%?)\s*)?\)$/);
  if (rgbMatch) {
    const a = parseAlpha(rgbMatch[4]);
    if (a === null) return null;
    return { r: parseChannel(rgbMatch[1]), g: parseChannel(rgbMatch[2]), b: parseChannel(rgbMatch[3]), a };
  }

  const hslMatch = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+%)\s*,\s*([\d.]+%)\s*(?:,\s*([\d.]+%?)\s*)?\)$/);
  if (hslMatch) {
    const a = parseAlpha(hslMatch[4]);
    if (a === null) return null;
    const h = ((parseFloat(hslMatch[1]) % 360) + 360) % 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    return { ...hslToRgb(h, s, l), a };
  }

  return null;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex(rgb: Color): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const base = `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
  if (rgb.a >= 1) return base;
  return `${base}${to(Math.round(rgb.a * 255))}`;
}

function rgbToHsl(rgb: Color): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function isHexPrefix(input: string): boolean {
  return /^#?[0-9a-f]{0,8}$/i.test(input);
}

function isCssPrefix(input: string): boolean {
  if (/^(?:rgba?|hsla?)\(\s*[0-9.,%\s]*\)?\s*$/i.test(input)) return true;
  return /^(?:r|rg|rgb|rgba|h|hs|hsl|hsla)\s*\([0-9.,%\s]*$/i.test(input);
}

export default function ColorConverter() {
  const [hex, setHex] = useState("#7C3AED");
  const [lastValid, setLastValid] = useState("#7c3aed");
  const inputId = useId();
  const errorId = useId();

  const parsed = useMemo(() => parseColor(hex), [hex]);

  const valid = parsed !== null;
  const trimmed = hex.trim();
  const hopeless = trimmed.length > 0 && !valid && !isHexPrefix(trimmed) && !isCssPrefix(trimmed);
  const hexText = valid ? rgbToHex(parsed) : null;
  const cssRgb = valid ? (parsed.a >= 1 ? `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})` : `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${parsed.a})`) : null;
  const hsl = parsed ? rgbToHsl(parsed) : null;
  const cssHsl = valid && hsl ? (parsed.a >= 1 ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${parsed.a})`) : null;

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-4">
        <input
          type="color"
          value={valid && parsed ? rgbToHex(parsed).toLowerCase() : lastValid}
          onChange={(e) => setHex(e.target.value)}
          className="w-16 h-16 rounded-xl border border-slate-200 cursor-pointer"
          aria-label="Color picker"
        />
        <div>
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-2">
            Hex, RGB or HSL
          </label>
          <input
            id={inputId}
            type="text"
            value={hex}
            onChange={(e) => {
              const next = e.target.value;
              const p = parseColor(next);
              if (p) setLastValid(rgbToHex(p).toLowerCase());
              setHex(next);
            }}
            placeholder="#RRGGBB or rgb(255, 0, 0)"
            spellCheck={false}
            aria-invalid={hopeless}
            aria-describedby={hopeless ? errorId : undefined}
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          />
        </div>
      </div>

      {hopeless && (
        <div
          id={errorId}
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-mono"
        >
          Enter a valid color: hex (#7C3AED or #f00), rgb()/rgba() or hsl()/hsla(). CSS color names are not supported.
        </div>
      )}

      {valid && parsed && hexText && cssRgb && cssHsl && (
        <>
          <div className="rounded-2xl h-24 border border-slate-200" style={{ background: hexText }} />
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: "HEX", value: hexText, copyLabel: "Copy HEX value" },
              { label: "RGB", value: cssRgb, copyLabel: "Copy RGB value" },
              { label: "HSL", value: cssHsl, copyLabel: "Copy HSL value" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <CopyButton text={c.value} ariaLabel={c.copyLabel} />
                </div>
                <p className="font-mono text-sm font-medium text-slate-800 break-all">{c.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}