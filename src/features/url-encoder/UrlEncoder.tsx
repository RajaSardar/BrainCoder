"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

export default function UrlEncoder() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [component, setComponent] = useState(true);

  const output = useMemo(() => {
    try {
      if (mode === "encode") {
        return component ? encodeURIComponent(input) : encodeURI(input);
      }
      return component ? decodeURIComponent(input) : decodeURI(input);
    } catch {
      return "Invalid input — could not decode.";
    }
  }, [input, mode, component]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode("encode")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === "encode" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Encode
          </button>
          <button
            type="button"
            onClick={() => setMode("decode")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === "decode" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Decode
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 ml-1">
          <input
            type="checkbox"
            checked={component}
            onChange={(e) => setComponent(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Component-level (encodeURIComponent)
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Input</p>
          <StyledTextarea
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Paste text to encode…" : "Paste encoded text…"}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Output</p>
            <CopyButton text={output} />
          </div>
          <StyledTextarea rows={8} value={output} readOnly className="bg-slate-100" />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" onClick={() => setInput("")} variant="secondary">
          Clear input
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setInput(output);
            setMode(mode === "encode" ? "decode" : "encode");
          }}
        >
          <ArrowUpDown className="w-4 h-4 mr-1 inline" /> Use result as input
        </Button>
      </div>
    </div>
  );
}