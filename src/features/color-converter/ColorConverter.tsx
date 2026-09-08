"use client";

import { useMemo, useState } from "react";
import { Field, CopyButton } from "@/components/ui";

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: RGB): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

function rgbToHsl(rgb: RGB): { h: number; s: number; l: number } {
  const r = rgb.r / 255,
    g = rgb.g / 255,
    b = rgb.b / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
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
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export default function ColorConverter() {
  const [hex, setHex] = useState("#7C3AED");

  const rgb = useMemo(() => hexToRgb(hex), [hex]);
  const valid = rgb !== null;
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb) : null), [rgb]);
  const cssText = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "";

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-4">
        <input
          type="color"
          value={valid ? rgbToHex(rgb!) : "#000000"}
          onChange={(e) => setHex(e.target.value)}
          className="w-16 h-16 rounded-xl border border-slate-200 cursor-pointer"
          aria-label="Color picker"
        />
        <Field label="HEX">
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#RRGGBB"
            spellCheck={false}
            className="w-40 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </Field>
      </div>

      {!valid && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-mono">
          Enter a valid hex color, e.g. #7C3AED or #f00
        </div>
      )}

      {valid && rgb && hsl && (
        <>
          <div
            className="rounded-2xl h-24 border border-slate-200"
            style={{ background: rgbToHex(rgb) }}
          />
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">HEX</p>
                <CopyButton text={rgbToHex(rgb)} />
              </div>
              <p className="font-mono text-sm font-medium text-slate-800 break-all">{rgbToHex(rgb)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">RGB</p>
                <CopyButton text={cssText} />
              </div>
              <p className="font-mono text-sm font-medium text-slate-800 break-all">{cssText}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">HSL</p>
                <CopyButton text={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} />
              </div>
              <p className="font-mono text-sm font-medium text-slate-800 break-all">
                hsl({hsl.h}, {hsl.s}%, {hsl.l}%)
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}