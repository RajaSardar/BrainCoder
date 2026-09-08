"use client";

import { useMemo, useState } from "react";
import { Tags, ArrowRight } from "lucide-react";
import { StyledTextarea, Button, CopyButton } from "@/components/ui";

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "©": "&copy;",
  "®": "&reg;",
  "™": "&trade;",
  "€": "&euro;",
  "£": "&pound;",
  "¥": "&yen;",
  "¢": "&cent;",
  "§": "&sect;",
  "¶": "&para;",
  "†": "&dagger;",
  "‡": "&Dagger;",
  "•": "&bull;",
  "…": "&hellip;",
  "←": "&larr;",
  "→": "&rarr;",
  "↔": "&harr;",
  "≠": "&ne;",
  "≤": "&le;",
  "≥": "&ge;",
  "≈": "&asymp;",
  "±": "&plusmn;",
  "×": "&times;",
  "÷": "&divide;",
  "∞": "&infin;",
  "√": "&radic;",
  "∑": "&sum;",
  "∏": "&prod;",
  "π": "&pi;",
  "α": "&alpha;",
  "β": "&beta;",
  "°": "&deg;",
  "µ": "&micro;",
  "½": "&frac12;",
  "¼": "&frac14;",
  "¾": "&frac34;",
  "à": "&agrave;",
  "á": "&aacute;",
  "â": "&acirc;",
  "ã": "&atilde;",
  "ä": "&auml;",
  "å": "&aring;",
  "ç": "&ccedil;",
  "é": "&eacute;",
  "è": "&egrave;",
  "ê": "&ecirc;",
  "ë": "&euml;",
  "í": "&iacute;",
  "ì": "&igrave;",
  "î": "&icirc;",
  "ï": "&iuml;",
  "ñ": "&ntilde;",
  "ó": "&oacute;",
  "ò": "&ograve;",
  "ô": "&ocirc;",
  "õ": "&otilde;",
  "ö": "&ouml;",
  "ø": "&oslash;",
  "ù": "&ugrave;",
  "ú": "&uacute;",
  "û": "&ucirc;",
  "ü": "&uuml;",
  "ÿ": "&yuml;",
  "æ": "&aelig;",
  "œ": "&oelig;",
  "ß": "&szlig;",
  "—": "&mdash;",
  "–": "&ndash;",
  "“": "&ldquo;",
  "”": "&rdquo;",
  "‘": "&lsquo;",
  "’": "&rsquo;",
  "«": "&laquo;",
  "»": "&raquo;",
  "♠": "&spades;",
  "♣": "&clubs;",
  "♥": "&hearts;",
  "♦": "&diams;",
};

const NAMED = Object.entries(ENTITIES);

function escapeEntities(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

function encodeAllNumeric(text: string): string {
  return Array.from(text)
    .map((ch) => (ch.charCodeAt(0) > 127 ? `&#${ch.charCodeAt(0)};` : ch))
    .join("");
}

function escapeNonAscii(text: string): string {
  const map = new Map(Object.entries(ENTITIES));
  return text.replace(/[^\x00-\x7F]/g, (ch) => {
    const named = map.get(ch);
    if (named) return named;
    const code = ch.codePointAt(0)!;
    return code > 0xffff ? `&#x${code.toString(16)};` : `&#x${code.toString(16)};`;
  });
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : _;
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : _;
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (m, name: string) => {
      const lower = `&${name.toLowerCase()};`;
      for (const [ch, ent] of NAMED) if (ent === lower) return ch;
      return m;
    });
}

const EXAMPLES = `Hello <b>World</b>! Use & at "Home" © 2026`;

export default function HtmlEntities() {
  const [input, setInput] = useState(EXAMPLES);
  const [mode, setMode] = useState<"named" | "numeric" | "all-named">("named");

  const encoded = useMemo(() => {
    if (mode === "numeric") return escapeNonAscii(input);
    if (mode === "all-named") return encodeAllNumeric(input);
    return escapeEntities(input);
  }, [input, mode]);

  const decoded = useMemo(() => decodeEntities(input), [input]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["named", "Named (e.g. &amp;)"],
            ["numeric", "Named + numeric hex (&#x27;)"],
            ["all-named", "All non-ASCII numeric"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`px-3 py-1.5 rounded-full border text-xs transition ${
              mode === id
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Input</p>
          <StyledTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="min-h-[140px]"
            placeholder="Text to encode or decode…"
          />
          <div className="mt-2 flex gap-2 flex-wrap">
            <Button type="button" onClick={() => setInput(encoded)}>
              Encode
            </Button>
            <Button type="button" variant="secondary" onClick={() => setInput(decoded)}>
              Decode
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" /> Encoded preview
          </p>
          <div className="min-h-[140px] rounded-xl border border-slate-200 bg-white p-4 text-sm font-mono text-slate-700 whitespace-pre-wrap break-all">
            {encoded}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CopyButton text={encoded} />
        <span className="text-xs text-slate-400">
          Copy the encoded output above.
        </span>
      </div>

      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2">
          <Tags className="w-4 h-4 text-indigo-500" /> Common entity reference
        </summary>
        <div className="px-4 pb-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {NAMED.slice(0, 48)
            .map(([ch, ent]) => (
            <div key={ent} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
              <span className="font-mono text-slate-500">{ent}</span>
              <span className="font-mono text-slate-800 font-medium">{ch}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}