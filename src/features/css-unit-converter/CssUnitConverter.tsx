"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CopyButton } from "@/components/ui";

type Unit = "px" | "em" | "rem" | "pt" | "%" | "vw" | "vh";
type BaseKey = "browser" | "custom";

const toPx: Record<Unit, (v: number, base: number, root: number, viewport: number) => number> = {
  px: (v) => v,
  em: (v, base) => v * base,
  rem: (v, _b, root) => v * root,
  pt: (v) => (v * 96) / 72,
  "%": (v, base) => (v / 100) * base,
  vw: (v, _b, _r, viewport) => (v / 100) * viewport,
  vh: (v, _b, _r, viewport) => (v / 100) * viewport,
};

function convert(value: number, from: Unit, to: Unit, base: number, root: number, viewport: number): number {
  const px = toPx[from](value, base, root, viewport);
  switch (to) {
    case "px":
      return px;
    case "em":
      return px / base;
    case "rem":
      return px / root;
    case "pt":
      return (px * 72) / 96;
    case "%":
      return (px / base) * 100;
    case "vw":
      return (px / viewport) * 100;
    case "vh":
      return (px / viewport) * 100;
  }
}

const UNITS: Unit[] = ["px", "em", "rem", "pt", "%", "vw", "vh"];

export default function CssUnitConverter() {
  const [value, setValue] = useState(16);
  const [from, setFrom] = useState<Unit>("px");
  const [to, setTo] = useState<Unit>("rem");
  const [baseKey, setBaseKey] = useState<BaseKey>("browser");
  const [customBase, setCustomBase] = useState(20);
  const [customRoot, setCustomRoot] = useState(18);
  const [customViewport, setCustomViewport] = useState(1440);

  const base = baseKey === "browser" ? 16 : customBase;
  const root = baseKey === "browser" ? 16 : customRoot;
  const viewport = baseKey === "browser" ? 1440 : customViewport;

  const rows = UNITS.filter((u) => u !== from).map((u) => {
    const result = convert(value, from, u, base, root, viewport);
    const fixed = Math.abs(result) >= 1000 || Math.abs(result) < 0.001 && result !== 0 ? result.toPrecision(4) : Math.round(result * 1000) / 1000;
    return { unit: u, text: `${fixed}${u}` };
  });

  const direct = rows.find((r) => r.unit === to);

  const css = `font-size: 16px; /* base → ${value}${from} = ${direct?.text ?? ""} */`;

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4 text-teal-600" />
        <h2 className="text-sm font-semibold text-slate-700">CSS Unit Converter</h2>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">From</label>
              <select value={from} onChange={(e) => setFrom(e.target.value as Unit)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">To</label>
              <select value={to} onChange={(e) => setTo(e.target.value as Unit)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-slate-500">Context</span>
            {(["browser", "custom"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBaseKey(k)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition ${baseKey === k ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {k === "browser" ? "Browser default (16px / 1440px)" : "Custom"}
              </button>
            ))}
          </div>
          {baseKey === "custom" && (
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ["Base font-size", customBase, setCustomBase],
                  ["Root font-size", customRoot, setCustomRoot],
                  ["Viewport width", customViewport, setCustomViewport],
                ] as [string, number, (v: number) => void][]
              ).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">{label}</label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-700">
          {value}
          {from} <span className="text-slate-400">=</span> <span className="font-semibold text-indigo-600">{direct?.text}</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-slate-100">
          {rows.map((r) => (
            <div key={r.unit} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-400">{from} → {r.unit}</span>
              <span className="text-sm font-mono text-slate-700">{r.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-mono">css-units.css</span>
          <CopyButton text={css} />
        </div>
        <pre className="text-sm text-emerald-300 font-mono overflow-x-auto">{css}</pre>
      </div>
    </div>
  );
}