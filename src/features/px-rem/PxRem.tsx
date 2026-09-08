"use client";

import { useMemo, useState } from "react";
import { Ruler, ArrowRight } from "lucide-react";
import { Field, CopyButton } from "@/components/ui";

export default function PxRem() {
  const [base, setBase] = useState(16);
  const [px, setPx] = useState("24");
  const [rem, setRem] = useState("1.5");

  const pxToRem = useMemo(() => {
    const n = Number(px);
    return Number.isFinite(n) ? `${(n / base).toFixed(4).replace(/\.?0+$/, "")}rem` : "—";
  }, [px, base]);

  const remToPx = useMemo(() => {
    const n = Number(rem);
    return Number.isFinite(n) ? `${(n * base).toFixed(2).replace(/\.?0+$/, "")}px` : "—";
  }, [rem, base]);

  const table = useMemo(() => {
    const pxValues = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64];
    return pxValues.map((v) => ({ px: v, rem: `${(v / base).toFixed(4).replace(/\.?0+$/, "")}rem` }));
  }, [base]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={`Base font size: ${base}px`}>
          <input
            type="range"
            min={8}
            max={24}
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            className="w-48 accent-emerald-600"
          />
        </Field>
        <label className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono w-40">
          {base}px = 1rem
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">Pixels → rem</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={px}
              onChange={(e) => setPx(e.target.value)}
              className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-slate-400">px</span>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <span className="font-mono text-lg font-semibold text-emerald-600">{pxToRem}</span>
            <CopyButton text={pxToRem} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">rem → pixels</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.125"
              value={rem}
              onChange={(e) => setRem(e.target.value)}
              className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-slate-400">rem</span>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <span className="font-mono text-lg font-semibold text-emerald-600">{remToPx}</span>
            <CopyButton text={remToPx} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Pixels</th>
              <th className="px-4 py-2.5 text-xs font-medium text-slate-500">rem</th>
              <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.map((r) => (
              <tr key={r.px}>
                <td className="px-4 py-2 font-mono text-slate-600">{r.px}px</td>
                <td className="px-4 py-2 font-mono text-slate-600">{r.rem}</td>
                <td className="px-4 py-2">
                  <span className="font-mono text-slate-800" style={{ fontSize: `${r.px}px`, lineHeight: 1 }}>
                    Ag
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Ruler className="w-3.5 h-3.5" /> Common values at fontSize {base}px (the browser default).
      </p>
    </div>
  );
}