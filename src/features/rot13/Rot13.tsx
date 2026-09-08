"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { StyledTextarea, CopyButton } from "@/components/ui";

function rotShift(text: string, charShift: number, mode: "encode" | "decode"): string {
  const delta = mode === "encode" ? charShift : -charShift;
  return Array.from(text, (ch) => {
    const c = ch.codePointAt(0)!;
    let base = -1;
    if (c >= 65 && c <= 90) base = 65;
    else if (c >= 97 && c <= 122) base = 97;
    else return ch;
    return String.fromCodePoint(base + (((c - base + delta) % 26) + 26) % 26);
  }).join("");
}

function rot47(text: string, mode: "encode" | "decode"): string {
  const delta = mode === "encode" ? 47 : -47;
  return Array.from(text, (ch) => {
    const c = ch.codePointAt(0)!;
    if (c < 33 || c > 126) return ch;
    return String.fromCodePoint(33 + (((c - 33 + delta) % 94) + 94) % 94);
  }).join("");
}

export default function Rot13() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog.");
  const [shift, setShift] = useState(13);
  const [use47, setUse47] = useState(false);
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const output = useMemo(
    () => (use47 ? rot47(input, mode) : rotShift(input, shift, mode)),
    [input, shift, use47, mode]
  );

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <RotateCcw className="w-4 h-4 text-teal-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["encode", "decode"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "encode" ? "Encode" : "Decode"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Shift:
          <input
            type="range"
            min={1}
            max={25}
            value={shift}
            disabled={use47}
            onChange={(e) => setShift(Number(e.target.value))}
            className="w-28 accent-teal-600"
          />
          <span className="font-mono w-6 text-slate-700">{shift}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={use47} onChange={(e) => setUse47(e.target.checked)} className="accent-teal-600" />
          ROT47 (ASCII)
        </label>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} placeholder="Type text to rotate…" />
      <div className="flex items-center gap-2">
        <CopyButton text={output} />
        <p className="text-xs text-slate-400">
          {use47 ? "ROT47" : `ROT${shift}`} {mode === "encode" ? "encoding" : "decoding"} — applies to letters only
        </p>
      </div>
      <textarea
        readOnly
        value={output}
        rows={6}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono focus:outline-none resize-y"
      />
    </div>
  );
}