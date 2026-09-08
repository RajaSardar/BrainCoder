"use client";

import { useState } from "react";
import { Blend } from "lucide-react";
import { CopyButton, SliderField } from "@/components/ui";

interface Stop {
  id: number;
  color: string;
  position: number;
}

let nextId = 1;

function makeStop(color: string, position: number): Stop {
  nextId = (nextId + 1) % 100000;
  return { id: nextId, color, position };
}

const DIRECTIONS = [
  "to right",
  "to bottom",
  "to bottom right",
  "135deg",
  "180deg",
  "to left",
];

export default function GradientGenerator() {
  const [type, setType] = useState<"linear" | "radial">("linear");
  const [direction, setDirection] = useState("to right");
  const [stops, setStops] = useState<Stop[]>([makeStop("#8b5cf6", 0), makeStop("#38bdf8", 100)]);

  const css = `background: ${type}(${type === "linear" ? `${direction}, ` : "circle at center, "}${stops
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ")});`;

  const bgStyle = type === "linear" ? `linear-gradient(${direction}, ${stops.map((s) => `${s.color} ${s.position}%`).join(", ")})` : `radial-gradient(circle at center, ${stops.map((s) => `${s.color} ${s.position}%`).join(", ")})`;

  const updateStop = (id: number, patch: Partial<Stop>) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-2">
        <Blend className="w-4 h-4 text-cyan-600" />
        <h2 className="text-sm font-semibold text-slate-700">Gradient Generator</h2>
      </div>
      <div className="rounded-2xl border border-slate-200 h-48" style={{ background: bgStyle }} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["linear", "radial"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition capitalize ${type === t ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {t}
            </button>
          ))}
          {type === "linear" && (
            <div className="flex flex-wrap gap-1.5 ml-2">
              {DIRECTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${direction === d ? "bg-indigo-100 text-indigo-700" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {stops.map((s) => (
            <div key={s.id} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center rounded-xl border border-slate-100 p-3">
              <input type="color" value={s.color} onChange={(e) => updateStop(s.id, { color: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer" />
              <SliderField label={s.color} value={s.position} min={0} max={100} onChange={(v) => updateStop(s.id, { position: v })} unit="%" />
              <button
                type="button"
                onClick={() => setStops((prev) => (prev.length > 2 ? prev.filter((x) => x.id !== s.id) : prev))}
                disabled={stops.length <= 2}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStops((prev) => (prev.length < 6 ? [...prev, makeStop("#10b981", 100)] : prev))}
            disabled={stops.length >= 6}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-40"
          >
            + Add color stop
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-mono">gradient.css</span>
          <CopyButton text={css} />
        </div>
        <pre className="text-sm text-emerald-300 font-mono overflow-x-auto">{css}</pre>
      </div>
    </div>
  );
}