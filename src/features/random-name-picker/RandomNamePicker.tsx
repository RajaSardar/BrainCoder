"use client";

import { useState } from "react";
import { UserCheck } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const SAMPLE_NAMES = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Ivy", "Jack"];

export default function RandomNamePicker() {
  const [namesText, setNamesText] = useState(SAMPLE_NAMES.join("\n"));
  const [count, setCount] = useState(1);
  const [winners, setWinners] = useState<number[]>([]);
  const [error, setError] = useState("");

  const names = namesText
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);

  const pick = () => {
    setError("");
    const n = Math.max(1, Math.min(count, 100));
    if (names.length === 0) {
      setError("Add at least one name.");
      return;
    }
    if (n > names.length) {
      setError(`Only ${names.length} name(s) available — you asked for ${n}.`);
      return;
    }
    const pool = [...names];
    const picked: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const orig = names.indexOf(pool[idx]);
      picked.push(orig);
      pool.splice(idx, 1);
    }
    setWinners(picked);
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-slate-700">Random Name Picker</h2>
      </div>

      <StyledTextarea value={namesText} onChange={(e) => setNamesText(e.target.value)} rows={8} placeholder="One name per line…" />
      <p className="text-xs text-slate-400">{names.length} name(s) detected.</p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">How many to pick</label>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-32 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={pick}>Pick winner{count > 1 ? "s" : ""}</Button>
          <CopyButton text={winners.map((i) => names[i]).join("\n")} />
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {winners.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-sky-50 p-5">
          <p className="text-xs font-medium text-sky-600 mb-2">✨ {winners.length === 1 ? "Winner" : "Winners"}</p>
          <div className="space-y-2">
            {winners.map((i) => (
              <div key={`${i}-${names[i]}`} className="flex items-center justify-between rounded-xl border border-sky-200 bg-white px-4 py-3">
                <span className="font-medium text-slate-800">{names[i]}</span>
                <span className="text-xl">🏆</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}