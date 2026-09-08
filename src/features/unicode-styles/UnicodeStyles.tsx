"use client";

import { useState } from "react";
import { Type } from "lucide-react";
import { StyledTextarea, CopyButton } from "@/components/ui";

function mapFromRange(start: number, chars: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (let i = 0; i < chars.length; i++) m[chars[i]] = String.fromCodePoint(start + i);
  return m;
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

const bold = { ...mapFromRange(0x1d400, UPPER), ...mapFromRange(0x1d41a, LOWER), ...mapFromRange(0x1d7ce, DIGITS) };
const italic = { ...mapFromRange(0x1d434, UPPER), ...mapFromRange(0x1d44e, LOWER) };
const boldItalic = { ...mapFromRange(0x1d468, UPPER), ...mapFromRange(0x1d482, LOWER) };

const scriptUpper = mapFromRange(0x1d49c, UPPER);
Object.assign(scriptUpper, { B: "\u212c", E: "\u2130", F: "\u2131", H: "\u210b", I: "\u2110", L: "\u2112", M: "\u2133", R: "\u211b" });
const script = { ...scriptUpper, ...mapFromRange(0x1d4b6, LOWER) };

const frakturUpper = mapFromRange(0x1d504, UPPER);
Object.assign(frakturUpper, { C: "\u212d", H: "\u210c", I: "\u2111", R: "\u211c", Z: "\u2128" });
const fraktur = { ...frakturUpper, ...mapFromRange(0x1d51e, LOWER) };

const dsUpper = mapFromRange(0x1d538, UPPER);
Object.assign(dsUpper, { C: "\u2102", H: "\u210d", N: "\u2115", P: "\u2119", Q: "\u211a", R: "\u211d", Z: "\u2124" });
const doubleStruck = { ...dsUpper, ...mapFromRange(0x1d552, LOWER), ...mapFromRange(0x1d7d8, DIGITS) };

const sansSerif = { ...mapFromRange(0x1d5a0, UPPER), ...mapFromRange(0x1d5ba, LOWER), ...mapFromRange(0x1d7e2, DIGITS) };
const sansSerifBold = { ...mapFromRange(0x1d5d4, UPPER), ...mapFromRange(0x1d5ee, LOWER), ...mapFromRange(0x1d7ec, DIGITS) };
const sansSerifItalic = { ...mapFromRange(0x1d608, UPPER), ...mapFromRange(0x1d622, LOWER) };
const monospace = { ...mapFromRange(0x1d670, UPPER), ...mapFromRange(0x1d68a, LOWER), ...mapFromRange(0x1d7f6, DIGITS) };

const smallCaps: Record<string, string> = {
  A: "ᴀ", B: "ʙ", C: "ᴄ", D: "ᴅ", E: "ᴇ", F: "ꜰ", G: "ɢ", H: "ʜ", I: "ɪ", J: "ᴊ", K: "ᴋ", L: "ʟ",
  M: "ᴍ", N: "ɴ", O: "ᴏ", P: "ᴘ", Q: "Q", R: "ʀ", S: "ꜱ", T: "ᴛ", U: "ᴜ", V: "ᴠ", W: "ᴡ", X: "X", Y: "ʏ", Z: "ᴢ",
};

const STYLES: { name: string; map: Record<string, string> }[] = [
  { name: "Bold", map: bold },
  { name: "Italic", map: italic },
  { name: "Bold Italic", map: boldItalic },
  { name: "Script", map: script },
  { name: "Fraktur", map: fraktur },
  { name: "Double-struck", map: doubleStruck },
  { name: "Sans-serif", map: sansSerif },
  { name: "Sans-serif Bold", map: sansSerifBold },
  { name: "Sans-serif Italic", map: sansSerifItalic },
  { name: "Monospace", map: monospace },
  { name: "Small Caps", map: smallCaps },
];

const SAMPLE = "Convert this fancy text!";

export default function UnicodeStyles() {
  const [input, setInput] = useState(SAMPLE);

  const outputs = STYLES.map((s) => {
    let out = "";
    for (const ch of input) out += s.map[ch] ?? ch;
    return { name: s.name, text: out };
  });

  const activeCount = outputs.filter((o) => o.text !== input).length;

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-fuchsia-600" />
        <h2 className="text-sm font-semibold text-slate-700">Fancy Unicode Text</h2>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Type text to style…" />
      <p className="text-xs text-slate-400">
        {input.length === 0 ? "Start typing to see styles…" : `${activeCount} of ${STYLES.length} styles currently differ from your input.`}
      </p>

      <div className="space-y-3">
        {outputs.map((o) => (
          <div key={o.name} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 mb-1">{o.name}{o.text === input ? " (no change)" : ""}</p>
              <p className="text-lg break-words whitespace-pre-wrap">{o.text}</p>
            </div>
            <CopyButton text={o.text} />
          </div>
        ))}
      </div>
    </div>
  );
}