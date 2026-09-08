"use client";

import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { StyledTextarea, CopyButton } from "@/components/ui";

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....",
  "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};

const REVERSE = new Map(Object.entries(MORSE).map(([k, v]) => [v, k]));

function toMorse(text: string, wordSeparator: string): string {
  return text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      Array.from(word, (ch) => MORSE[ch] ?? "").filter(Boolean).join(" ")
    )
    .join(wordSeparator);
}

function fromMorse(code: string, wordSeparator: string): string {
  return code
    .split(wordSeparator)
    .map((word) => word.trim().split(/\s+/).filter(Boolean).map((sym) => REVERSE.get(sym) ?? "?").join(""))
    .join(" ");
}

export default function MorseCode() {
  const [input, setInput] = useState("SOS");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [wordSep, setWordSep] = useState<"/" | "   ">("/");

  const output = useMemo(
    () => (mode === "encode" ? toMorse(input, wordSep) : fromMorse(input, wordSep)),
    [input, mode, wordSep]
  );

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Radio className="w-4 h-4 text-fuchsia-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["encode", "decode"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-fuchsia-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "encode" ? "Text → Morse" : "Morse → Text"}
            </button>
          ))}
        </div>
        {mode === "encode" && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Word separator:
            <select value={wordSep} onChange={(e) => setWordSep(e.target.value as "/" | "   ")} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
              <option value="/">slash (/)</option>
              <option value="   ">3 spaces</option>
            </select>
          </label>
        )}
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} placeholder="Enter text or Morse code…" />
      <CopyButton text={output} />
      <textarea
        readOnly
        value={output}
        rows={6}
        placeholder="Result appears here…"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono focus:outline-none resize-y"
      />
      <p className="text-xs text-slate-400">
        Supports A–Z, 0–9 and common punctuation. Unsupported characters are skipped when encoding.
      </p>
    </div>
  );
}