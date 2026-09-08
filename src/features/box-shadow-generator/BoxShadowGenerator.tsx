"use client";

import { useState } from "react";
import { BoxSelect } from "lucide-react";
import { CopyButton, SliderField } from "@/components/ui";

export default function BoxShadowGenerator() {
  const [x, setX] = useState(0);
  const [y, setY] = useState(10);
  const [blur, setBlur] = useState(24);
  const [spread, setSpread] = useState(-4);
  const [opacity, setOpacity] = useState(40);
  const [color, setColor] = useState("#0f172a");
  const [inset, setInset] = useState(false);

  const shadow = `${x}px ${y}px ${blur}px ${spread}px ${hexToRgba(color, opacity / 100)}`;
  const css = `box-shadow: ${inset ? `inset ${shadow}` : shadow};`;

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-2">
        <BoxSelect className="w-4 h-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-slate-700">Box Shadow Generator</h2>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-100 p-8 flex items-center justify-center" style={{ backgroundImage: "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
        <div
          className="w-44 h-44 rounded-2xl bg-white"
          style={{ boxShadow: inset ? `inset ${shadow}` : shadow }}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <SliderField label="Offset X" value={x} min={-60} max={60} onChange={setX} unit="px" />
        <SliderField label="Offset Y" value={y} min={-60} max={60} onChange={setY} unit="px" />
        <SliderField label="Blur" value={blur} min={0} max={120} onChange={setBlur} unit="px" />
        <SliderField label="Spread" value={spread} min={-30} max={80} onChange={setSpread} unit="px" />
        <SliderField label="Color opacity" value={opacity} min={0} max={100} onChange={setOpacity} unit="%" />
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-500">Shadow color</label>
            <span className="text-xs font-mono text-slate-600">{color}</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer" />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer md:col-span-2">
          <input type="checkbox" checked={inset} onChange={(e) => setInset(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
          Inner shadow (inset)
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-mono">box-shadow.css</span>
          <CopyButton text={css} />
        </div>
        <pre className="text-sm text-emerald-300 font-mono overflow-x-auto">{css}</pre>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `${hex} (fallback), alpha ${alpha}`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}