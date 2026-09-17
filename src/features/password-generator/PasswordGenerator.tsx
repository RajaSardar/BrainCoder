"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.?/";
const AMBIGUOUS_RE = /[Il1O0o]/g;

interface CharPool {
  upper: string;
  lower: string;
  digits: string;
  symbols: string;
}

function secureRandomIndex(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 256) {
    throw new RangeError("secureRandomIndex: max must be an integer between 1 and 256");
  }
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
  const [password, setPassword] = useState("");
  const [announce, setAnnounce] = useState("");

  const pool = useMemo<CharPool>(() => {
    const strip = (chars: string) =>
      excludeAmbiguous ? chars.replace(AMBIGUOUS_RE, "") : chars;
    return {
      upper: includeUpper ? strip(UPPER) : "",
      lower: includeLower ? strip(LOWER) : "",
      digits: includeDigits ? strip(DIGITS) : "",
      symbols: includeSymbols ? strip(SYMBOLS) : "",
    };
  }, [includeUpper, includeLower, includeDigits, includeSymbols, excludeAmbiguous]);

  const charset = pool.upper + pool.lower + pool.digits + pool.symbols;
  const canGenerate = charset.length > 0;

  const generate = useCallback((len: number, p: CharPool) => {
    const cs = p.upper + p.lower + p.digits + p.symbols;
    const chars: string[] = [];
    for (const set of [p.upper, p.lower, p.digits, p.symbols]) {
      if (set.length > 0 && chars.length < len) {
        chars.push(set[secureRandomIndex(set.length)]);
      }
    }
    while (chars.length < len) {
      chars.push(cs[secureRandomIndex(cs.length)]);
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const j = secureRandomIndex(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!canGenerate) {
        setPassword("");
        return;
      }
      setPassword(generate(length, pool));
    }, 0);
    return () => window.clearTimeout(id);
  }, [length, pool, canGenerate, generate]);

  const bits = length * Math.log2(charset.length || 1);
  const strengthScore = Math.min(100, Math.round(bits));
  const strengthLabel = !canGenerate
    ? "Select at least one character type"
    : bits >= 96
      ? "Strong"
      : bits >= 60
        ? "Good"
        : "Weak";
  const strengthColor = !canGenerate
    ? "bg-slate-200"
    : bits >= 96
      ? "bg-green-500"
      : bits >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  const onRegenerate = () => {
    if (!canGenerate) return;
    const next = generate(length, pool);
    setPassword(next);
    setAnnounce(`New password generated — ${next.length} characters`);
  };

  const strengthMeter = (
    <div
      role="meter"
      aria-label="Password strength"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={strengthScore}
      aria-valuetext={strengthLabel}
      className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"
    >
      <div
        className={`h-full ${strengthColor} transition-[width,background-color]`}
        style={{ width: `${strengthScore}%` }}
      />
    </div>
  );

  const focusRing =
    "min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

  return (
    <div className="space-y-5 w-full">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3">
        <input
          readOnly
          value={password}
          onFocus={(e) => e.target.select()}
          aria-label="Generated password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          className="flex-1 bg-transparent text-lg font-mono tracking-wider text-slate-900 focus:outline-none cursor-text"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={onRegenerate}
          disabled={!canGenerate}
          className={focusRing}
        >
          <RefreshCw className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          Regenerate
        </Button>
        <CopyButton
          text={password}
          disabled={!canGenerate || !password}
          className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold"
        />
      </div>

      <div className="flex items-center gap-3">
        {strengthMeter}
        <span className="text-xs font-medium text-slate-600 w-40 text-right">
          {strengthLabel}
        </span>
        {canGenerate && (
          <span className="text-xs text-slate-400 font-mono w-24 text-right">
            ≈ {Math.round(bits)} bits
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="length-slider"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          Length: <span className="text-slate-900">{length}</span> characters
        </label>
        <input
          id="length-slider"
          type="range"
          min={6}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-indigo-600 min-h-11"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>6</span>
          <span>64</span>
        </div>
      </div>

      <fieldset className="min-w-0 m-0 p-0 border-0">
        <legend className="text-sm font-medium text-slate-700 mb-2">
          Character types
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Uppercase (A-Z)", key: "upper", checked: includeUpper, set: setIncludeUpper },
            { label: "Lowercase (a-z)", key: "lower", checked: includeLower, set: setIncludeLower },
            { label: "Digits (0-9)", key: "digits", checked: includeDigits, set: setIncludeDigits },
            { label: "Symbols (!@#$)", key: "symbols", checked: includeSymbols, set: setIncludeSymbols },
          ].map((opt) => (
            <label
              key={opt.key}
              className="min-h-11 flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={opt.checked}
                onChange={(e) => opt.set(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="min-h-11 py-2 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={excludeAmbiguous}
          onChange={(e) => setExcludeAmbiguous(e.target.checked)}
          className="rounded border-slate-300 text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        />
        Exclude ambiguous characters (Il1O0o)
      </label>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
    </div>
  );
}