"use client";

import { useState } from "react";
import { ChartSpline } from "lucide-react";
import { CopyButton, SliderField } from "@/components/ui";

const PRESETS: [string, number, number, number, number][] = [
  ["ease", 0.25, 0.1, 0.25, 1],
  ["ease-in", 0.42, 0, 1, 1],
  ["ease-out", 0, 0, 0.58, 1],
  ["ease-in-out", 0.42, 0, 0.58, 1],
  ["linear", 0, 0, 1, 1],
  ["anticipate", 0.68, -0.6, 0.32, 1.6],
];

export default function CubicBezierEditor() {
  const [x1, setX1] = useState(0.25);
  const [y1, setY1] = useState(0.1);
  const [x2, setX2] = useState(0.25);
  const [y2, setY2] = useState(1);

  const bezier = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  const css = `transition: transform 600ms ${bezier};`;

  const curve = `M 0 100 C ${x1 * 100} ${100 - y1 * 100}, ${x2 * 100} ${100 - y2 * 100}, 100 0`;

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-2">
        <ChartSpline className="w-4 h-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-slate-700">Cubic Bézier Editor</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-4 items-center">
        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-6 flex items-center justify-center overflow-hidden relative" aria-hidden="true">
          <style>{`@keyframes bz-slide { from { transform: translateX(-70px); } to { transform: translateX(70px); } }`}</style>
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600" style={{ animation: `bz-slide 900ms ${bezier} infinite alternate` }} />
        </div>

        <svg viewBox="0 0 100 100" className="w-full max-w-64 mx-auto" aria-hidden="true">
          <line x1="0" y1="100" x2="100" y2="0" stroke="#cbd5e1" strokeWidth="1" />
          <path d={curve} fill="none" stroke="#6366f1" strokeWidth="2.5" />
          <line x1="0" y1="100" x2={x1 * 100} y2={100 - y1 * 100} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="100" y1="0" x2={x2 * 100} y2={100 - y2 * 100} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x1 * 100} cy={100 - y1 * 100} r="3.5" fill="#4338ca" />
          <circle cx={x2 * 100} cy={100 - y2 * 100} r="3.5" fill="#4338ca" />
        </svg>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-4">
          <SliderField label="x1" value={x1} min={0} max={1} step={0.01} onChange={setX1} />
          <SliderField label="y1" value={y1} min={-0.75} max={1.75} step={0.01} onChange={setY1} />
        </div>
        <div className="space-y-4">
          <SliderField label="x2" value={x2} min={0} max={1} step={0.01} onChange={setX2} />
          <SliderField label="y2" value={y2} min={-0.75} max={1.75} step={0.01} onChange={setY2} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {PRESETS.map(([label, a, b, c, d]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setX1(a);
                setY1(b);
                setX2(c);
                setY2(d);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-mono">easing.css</span>
          <CopyButton text={css} />
        </div>
        <pre className="text-sm text-emerald-300 font-mono overflow-x-auto">{bezier}</pre>
      </div>
    </div>
  );
}