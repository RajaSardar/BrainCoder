"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error("Enter a whole number from 1 to 3999.");
  let out = "";
  let v = n;
  for (const [value, sym] of ROMAN) {
    while (v >= value) {
      out += sym;
      v -= value;
    }
  }
  return out;
}

function fromRoman(s: string): number {
  const clean = s.trim().toUpperCase();
  if (!clean) throw new Error("Enter a Roman numeral.");
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < clean.length; i++) {
    const cur = values[clean[i]];
    if (cur === undefined) throw new Error(`“${clean[i]}” is not a valid Roman numeral character.`);
    const next = values[clean[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  if (toRoman(total) !== clean) throw new Error("Not a valid (reduced-form) Roman numeral.");
  return total;
}

export default function RomanNumerals() {
  const [tab, setTab] = useState<"toRoman" | "toDecimal">("toRoman");
  const [input, setInput] = useState("2026");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const convert = () => {
    setError("");
    try {
      setOutput(tab === "toRoman" ? toRoman(Number(input)) : String(fromRoman(input)));
    } catch (e) {
      setOutput("");
      setError(e instanceof Error ? e.message : "Conversion failed.");
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Landmark className="w-4 h-4 text-amber-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["toRoman", "toDecimal"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${tab === t ? "bg-amber-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {t === "toRoman" ? "Decimal → Roman" : "Roman → Decimal"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">{tab === "toRoman" ? "Decimal number" : "Roman numeral"}</label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tab === "toRoman" ? "e.g. 2026" : "e.g. MMXXVI"}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={convert}>Convert</Button>
          <CopyButton text={output} />
        </div>
        <div className={`rounded-xl px-4 py-3 text-lg font-mono ${output ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-slate-50 border border-slate-200 text-slate-300"}`}>
          {output || "Result…"}
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      </div>
      <p className="text-xs text-slate-400">
        Classic subtractive notation with strict validation — “IIII” and “IIX” are rejected, “IV”/“IX” accepted.
      </p>
    </div>
  );
}