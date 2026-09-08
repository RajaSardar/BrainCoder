"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const SAMPLE = "repeat me ";

export default function TextRepeater() {
  const [input, setInput] = useState(SAMPLE);
  const [count, setCount] = useState(100);
  const [separator, setSeparator] = useState<"none" | "newline" | "space">("none");

  const output = Array.from({ length: Math.min(Math.max(count, 0), 1000000) }, () => input).join(
    separator === "newline" ? "\n" : separator === "space" ? " " : ""
  );

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Repeat className="w-4 h-4 text-rose-600" />
        <h2 className="text-sm font-semibold text-slate-700">Text Repeater</h2>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="Text to repeat…" />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">Times to repeat</label>
          <input
            type="number"
            min={0}
            max={1000000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-36 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">Separator</label>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {(["none", "space", "newline"] as const).map((sep) => (
              <button
                key={sep}
                type="button"
                onClick={() => setSeparator(sep)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition capitalize ${separator === sep ? "bg-rose-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {sep}
              </button>
            ))}
          </div>
        </div>
        <Button type="button" onClick={() => setCount(100)}>Reset to 100</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton text={output} />
      </div>

      <StyledTextarea readOnly value={output} rows={10} placeholder={`Result (${count.toLocaleString()} copies)…`} />
      <p className="text-xs text-slate-400">
        {output.length.toLocaleString()} characters · {new Blob([output]).size.toLocaleString()} bytes in the output.
      </p>
    </div>
  );
}