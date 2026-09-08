"use client";

import { useMemo, useState } from "react";
import { Languages } from "lucide-react";
import { StyledTextarea, CopyButton } from "@/components/ui";

type Mode = "utf8-hex" | "hex-utf8" | "esc" | "unesc";

function hex(bytes: Uint8Array<ArrayBuffer>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
}

function textToUtf8Hex(text: string): string {
  return hex(new TextEncoder().encode(text));
}

function utf8HexToText(input: string): string {
  const cleaned = input.replace(/\s+/g, "");
  if (cleaned.length % 2 !== 0) throw new Error("Hex must have an even number of digits.");
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const b = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(b)) throw new Error("Invalid hex character.");
    bytes[i] = b;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function escapeUnicode(text: string): string {
  let out = "";
  for (const ch of text) {
    out += ch <= "\u00ff" ? ch : `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
    if (ch.codePointAt(0)! > 0xffff) out += `\\u${ch.codePointAt(0)!.toString(16).padStart(6, "0")}`;
  }
  return out;
}

function unescapeUnicode(input: string): string {
  return input.replace(/\\u([0-9a-fA-F]{4})|\\u\{([0-9a-fA-F]+)\}/g, (_, a, b) =>
    String.fromCodePoint(parseInt(a || b, 16))
  );
}

const MODES: { id: Mode; label: string }[] = [
  { id: "utf8-hex", label: "Text → UTF-8 hex" },
  { id: "hex-utf8", label: "UTF-8 hex → Text" },
  { id: "esc", label: "Text → \\u escapes" },
  { id: "unesc", label: "\\u escapes → Text" },
];

export default function Utf8Converter() {
  const [mode, setMode] = useState<Mode>("utf8-hex");
  const [input, setInput] = useState("Hello, 世界! 🚀");

  const result = useMemo(() => {
    try {
      switch (mode) {
        case "utf8-hex": return { value: textToUtf8Hex(input), error: "" };
        case "hex-utf8": return { value: utf8HexToText(input), error: "" };
        case "esc": return { value: escapeUnicode(input), error: "" };
        case "unesc": return { value: unescapeUnicode(input), error: "" };
      }
    } catch (e) {
      return { value: "", error: e instanceof Error ? e.message : "Conversion failed." };
    }
  }, [input, mode]);

  const output = result.value;
  const error = result.error;

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Languages className="w-4 h-4 text-sky-600" />
        <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === m.id ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} placeholder="Paste input…" />
      <div className="flex items-center gap-2">
        <CopyButton text={output} />
        <span className="text-xs text-slate-400">Unicode-safe: emoji and multibyte characters included</span>
      </div>
      <textarea
        readOnly
        value={output}
        rows={6}
        placeholder="Result appears here…"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono break-all focus:outline-none resize-y"
      />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
    </div>
  );
}