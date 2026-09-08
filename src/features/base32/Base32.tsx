"use client";

import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { StyledTextarea, CopyButton } from "@/components/ui";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(bytes: Uint8Array<ArrayBuffer>, pad: boolean): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31];
  if (pad) out += "=".repeat((8 - (out.length % 8)) % 8);
  return out;
}

function fromBase32(input: string): string {
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = ALPHA.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid Base32 character: "${ch}".`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

export default function Base32() {
  const [input, setInput] = useState("Hello World");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [pad, setPad] = useState(true);

  const result = useMemo(() => {
    try {
      if (mode === "encode") return { value: toBase32(new TextEncoder().encode(input), pad), error: "" };
      return { value: fromBase32(input), error: "" };
    } catch (e) {
      return { value: "", error: e instanceof Error ? e.message : "Conversion failed." };
    }
  }, [input, mode, pad]);

  const output = result.value;
  const error = result.error;

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Boxes className="w-4 h-4 text-indigo-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["encode", "decode"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "encode" ? "Encode" : "Decode"}
            </button>
          ))}
        </div>
        {mode === "encode" && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={pad} onChange={(e) => setPad(e.target.checked)} className="accent-indigo-600" />
            add padding
          </label>
        )}
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} placeholder="Text to encode / Base32 to decode…" />
      <CopyButton text={output} />
      <textarea
        readOnly
        value={output}
        rows={6}
        placeholder="Result appears here…"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono break-all focus:outline-none resize-y"
      />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <p className="text-xs text-slate-400">RFC 4648 Base32 (A–Z, 2–7). UTF-8 / Unicode input supported.</p>
    </div>
  );
}