"use client";

import { useState } from "react";
import { Binary, ArrowDown } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

function textToBinary(text: string, group8: boolean): string {
  const bits = Array.from(text, (ch) => ch.codePointAt(0)!.toString(2).padStart(8, "0"));
  return bits.join(group8 ? " " : "");
}

function binaryToText(binary: string): string {
  const cleaned = binary.replace(/\s+/g, "");
  if (!cleaned) return "";
  if (cleaned.length % 8 !== 0) throw new Error("Binary must have a length divisible by 8.");
  let out = "";
  for (let i = 0; i < cleaned.length; i += 8) out += String.fromCodePoint(parseInt(cleaned.slice(i, i + 8), 2));
  return out;
}

export default function BinaryText() {
  const [input, setInput] = useState("Brain Coder");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [group8, setGroup8] = useState(true);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const convert = () => {
    setError("");
    try {
      setOutput(mode === "encode" ? textToBinary(input, group8) : binaryToText(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed.");
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Binary className="w-4 h-4 text-cyan-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode("encode")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === "encode" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Text → Binary
          </button>
          <button
            type="button"
            onClick={() => setMode("decode")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === "decode" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Binary → Text
          </button>
        </div>
        {mode === "encode" && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={group8} onChange={(e) => setGroup8(e.target.checked)} className="accent-cyan-600" />
            group in 8s
          </label>
        )}
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} placeholder="Type text or paste binary…" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={convert}>
          <ArrowDown className="w-4 h-4" /> Convert
        </Button>
        <CopyButton text={output} disabled={!output} />
      </div>
      <textarea
        readOnly
        value={output}
        rows={6}
        placeholder="Result appears here…"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono break-all focus:outline-none resize-y"
      />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <p className="text-xs text-slate-400">Encodes every Unicode code point as its 8-bit (minimum) binary representation.</p>
    </div>
  );
}