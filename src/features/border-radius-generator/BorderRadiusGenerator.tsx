"use client";

import { useState } from "react";
import { Squircle } from "lucide-react";
import { CopyButton, SliderField } from "@/components/ui";

const PRESETS = [
  { label: "None", tl: 0, tr: 0, br: 0, bl: 0 },
  { label: "Soft", tl: 12, tr: 12, br: 12, bl: 12 },
  { label: "Pill", tl: 999, tr: 999, br: 999, bl: 999 },
  { label: "Scoop", tl: 24, tr: 24, br: 4, bl: 4 },
  { label: "Asymmetric", tl: 0, tr: 48, br: 0, bl: 48 },
];

export default function BorderRadiusGenerator() {
  const [tl, setTl] = useState(12);
  const [tr, setTr] = useState(12);
  const [br, setBr] = useState(12);
  const [bl, setBl] = useState(12);

  const css = `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`;
  const style = { borderTopLeftRadius: `${tl}px`, borderTopRightRadius: `${tr}px`, borderBottomRightRadius: `${br}px`, borderBottomLeftRadius: `${bl}px` } as const;

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-2">
        <Squircle className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-slate-700">Border Radius Generator</h2>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-100 p-8 flex items-center justify-center">
        <div className="w-56 h-56 bg-gradient-to-br from-violet-500 to-indigo-600" style={style} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <SliderField label="Top-left" value={tl} min={0} max={200} onChange={setTl} unit="px" />
        <SliderField label="Top-right" value={tr} min={0} max={200} onChange={setTr} unit="px" />
        <SliderField label="Bottom-right" value={br} min={0} max={200} onChange={setBr} unit="px" />
        <SliderField label="Bottom-left" value={bl} min={0} max={200} onChange={setBl} unit="px" />
        <div className="md:col-span-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setTl(p.tl);
                setTr(p.tr);
                setBr(p.br);
                setBl(p.bl);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-mono">border-radius.css</span>
          <CopyButton text={css} />
        </div>
        <pre className="text-sm text-emerald-300 font-mono overflow-x-auto">{css}</pre>
      </div>
    </div>
  );
}