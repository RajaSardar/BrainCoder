"use client";

import { useMemo, useState } from "react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(str: string): string {
  const binary = atob(str.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Tool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const output = useMemo(() => {
    try {
      return mode === "encode" ? toBase64(input) : fromBase64(input);
    } catch {
      return "Invalid Base64 string.";
    }
  }, [input, mode]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode("encode")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            mode === "encode" ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Encode to Base64
        </button>
        <button
          type="button"
          onClick={() => setMode("decode")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            mode === "decode" ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Decode from Base64
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Input</p>
          <StyledTextarea
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Paste text/JSON to encode…" : "Paste Base64 to decode…"}
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

      <Button type="button" onClick={() => setInput("")} variant="secondary">
        Clear input
      </Button>
    </div>
  );
}