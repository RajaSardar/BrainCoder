"use client";

import { useState } from "react";
import { Repeat2 } from "lucide-react";
import { StyledTextarea, CopyButton } from "@/components/ui";

const UPSIDE_DOWN: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ı", j: "ɾ", k: "ʞ", l: "ʃ",
  m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ", s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  A: "∀", B: "B", C: "Ↄ", D: "ᗡ", E: "Ǝ", F: "Ⅎ", G: "⅁", H: "H", I: "I", J: "ſ", K: "ʞ", L: "˥",
  M: "W", N: "N", O: "O", P: "Ԁ", Q: "Q", R: "ᴚ", S: "S", T: "⊥", U: "∩", V: "Λ", W: "M", X: "X", Y: "⅄", Z: "Z",
  "0": "0", "1": "Ɩ", "2": "ᄅ", "3": "Ɛ", "4": "ㄣ", "5": "ϛ", "6": "9", "7": "ㄥ", "8": "8", "9": "6",
  "!": "¡", "?": "¿", ".": "˙", ",": "'", "'": ",", '"': "„", "(": ")", ")": "(", "[": "]", "]": "[",
  "{": "}", "}": "{", "<": ">", ">": "<", "/": "\\", "\\": "/", "_": "‾", "&": "⅋", "`": ",", "´": "`",
  ":": ":", ";": ";", " ": " ", "\n": "\n",
};

const SAMPLE = "Upside down text! It is super readable.";

function flip(text: string): string {
  let out = "";
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    out += UPSIDE_DOWN[ch] ?? ch;
  }
  return out;
}

export default function UpsideDownText() {
  const [input, setInput] = useState(SAMPLE);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Repeat2 className="w-4 h-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-slate-700">Upside Down Text</h2>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="Text to flip…" />
      <p className="text-xs text-slate-400">Flips characters upside-down and reverses the reading order.</p>

      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 flex items-center justify-center min-h-28">
        <div className="flex items-center justify-center gap-4 text-xl font-medium text-slate-700">
          <span className="select-none">🙂</span>
          <span className="break-words">{flip(input)}</span>
          <span className="rotate-180 select-none">🙃</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton text={flip(input)} label="Copy result" />
      </div>
    </div>
  );
}