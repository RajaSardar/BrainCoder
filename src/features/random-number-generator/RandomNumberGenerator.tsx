"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

function rand(min: number, max: number, decimals: boolean): number {
  const v = min + Math.random() * (max - min);
  return decimals ? Math.round(v * 1000) / 1000 : Math.round(v);
}

export default function RandomNumberGenerator() {
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [count, setCount] = useState(5);
  const [decimals, setDecimals] = useState(false);
  const [unique, setUnique] = useState(false);
  const [results, setResults] = useState<number[]>([]);

  const generate = () => {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const n = Math.max(0, Math.min(count, 10000));
    const out: number[] = [];
    const seen = new Set<string>();
    let guard = 0;
    while (out.length < n && guard++ < 100000) {
      const v = rand(lo, hi, decimals);
      if (unique) {
        const key = String(v);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(v);
    }
    setResults(out);
  };

  const sum = results.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Dices className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-slate-700">Random Number Generator</h2>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 grid sm:grid-cols-2 gap-4">
        {(
          [
            ["Minimum", min, setMin],
            ["Maximum", max, setMax],
            ["How many", count, setCount],
          ] as [string, number, (v: number) => void][]
        ).map(([label, val, setter]) => (
          <div key={label}>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">{label}</label>
            <input
              type="number"
              value={val}
              onChange={(e) => setter(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        ))}
        <div className="sm:col-span-2 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={decimals} onChange={(e) => setDecimals(e.target.checked)} className="accent-amber-500 w-4 h-4" />
            Allow decimals
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} className="accent-amber-500 w-4 h-4" />
            Unique values
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={generate}>Generate</Button>
        <CopyButton text={results.join(", ")} />
      </div>

      {results.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {results.map((r, i) => (
              <span key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-mono text-amber-800">
                {r}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            {results.length} results · min {Math.min(...results)} · max {Math.max(...results)} · sum {sum} · avg {Math.round((sum / results.length) * 1000) / 1000}
          </p>
        </>
      )}
    </div>
  );
}