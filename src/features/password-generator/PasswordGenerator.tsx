"use client";

import { useCallback, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.?/";

function secureRandomIndex(max: number): number {
  const buf = new Uint8Array(1);
  const MAX = 256 - (256 % max);
  let v = 0;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= MAX);
  return v % max;
}

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeDigits, setIncludeDigits] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);

  const charset = useMemo(() => {
    let chars = "";
    if (includeLower) chars += LOWER;
    if (includeUpper) chars += UPPER;
    if (includeDigits) chars += DIGITS;
    if (includeSymbols) chars += SYMBOLS;
    if (excludeAmbiguous) chars = chars.replace(/[Il1O0o]/g, "");
    return chars;
  }, [includeLower, includeUpper, includeDigits, includeSymbols, excludeAmbiguous]);

  const canGenerate = charset.length > 0;

  const generate = useCallback(
    (len: number, cs: string) => {
      const chars: string[] = [];
      if (includeUpper) chars.push(UPPER[secureRandomIndex(UPPER.length)]);
      if (includeLower) chars.push(LOWER[secureRandomIndex(LOWER.length)]);
      if (includeDigits) chars.push(DIGITS[secureRandomIndex(DIGITS.length)]);
      if (includeSymbols) chars.push(SYMBOLS[secureRandomIndex(SYMBOLS.length)]);
      while (chars.length < len) {
        chars.push(cs[secureRandomIndex(cs.length)]);
      }
      for (let i = chars.length - 1; i > 0; i--) {
        const j = secureRandomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.slice(0, len).join("");
    },
    [includeUpper, includeLower, includeDigits, includeSymbols]
  );

  const [password, setPassword] = useState<string>(() =>
    generate(16, LOWER + UPPER + DIGITS + SYMBOLS)
  );

  const strength = useMemo(() => {
    if (!canGenerate) return 0;
    let pool = 0;
    if (includeLower) pool += 26;
    if (includeUpper) pool += 26;
    if (includeDigits) pool += 10;
    if (includeSymbols) pool += SYMBOLS.length;
    return Math.round(Math.min(100, (length * Math.log2(pool)) / 2.8));
  }, [length, includeLower, includeUpper, includeDigits, includeSymbols, canGenerate]);

  const strengthColor =
    strength < 40 ? "bg-red-500" : strength < 70 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="space-y-5 w-full">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
        <input
          readOnly
          value={password}
          className="flex-1 bg-transparent text-lg font-mono tracking-wider focus:outline-none text-slate-900"
          spellCheck={false}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => canGenerate && setPassword(generate(length, charset))}
          disabled={!canGenerate}
          aria-label="Regenerate"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <CopyButton text={password} />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${strengthColor} transition-all`} style={{ width: `${strength}%` }} />
        </div>
        <span className="text-xs font-medium text-slate-500 w-24 text-right">
          {strength < 40 ? "Weak" : strength < 70 ? "Good" : "Strong"}
        </span>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">
          Length: <span className="text-slate-900">{length}</span>
        </p>
        <input
          type="range"
          min={6}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>6</span>
          <span>64</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Uppercase (A-Z)", key: "upper", checked: includeUpper, set: setIncludeUpper },
          { label: "Lowercase (a-z)", key: "lower", checked: includeLower, set: setIncludeLower },
          { label: "Digits (0-9)", key: "digits", checked: includeDigits, set: setIncludeDigits },
          { label: "Symbols (!@#$)", key: "symbols", checked: includeSymbols, set: setIncludeSymbols },
        ].map((opt) => (
          <label
            key={opt.key}
            className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5"
          >
            <input
              type="checkbox"
              checked={opt.checked}
              onChange={(e) => opt.set(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            {opt.label}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={excludeAmbiguous}
          onChange={(e) => setExcludeAmbiguous(e.target.checked)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        Exclude ambiguous characters (Il1O0o)
      </label>
    </div>
  );
}