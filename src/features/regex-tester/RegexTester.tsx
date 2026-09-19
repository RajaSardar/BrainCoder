"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { HelpCircle, TerminalSquare } from "lucide-react";
import { Field, StyledTextarea } from "@/components/ui";
import {
  captureGroupNames,
  DEFAULT_MAX_MATCHES,
  DEFAULT_TIMEOUT_MS,
  FLAG_OPTIONS,
  isSuspiciousPattern,
  parseRegexInput,
  runRegexJob,
} from "./regex-engine";

const MAX_TEXT_CHARS = 2_000_000;
const FLAG_HELP = "Token reference for common regex patterns.";

const EMPTY_RESULT = { valid: true, error: "", matches: [], truncated: false, timedOut: false };

const TOKEN_REFERENCE: { token: string; meaning: string }[] = [
  { token: ".", meaning: "Any character (except newline)" },
  { token: "\\d", meaning: "Digit (\\D non-digit)" },
  { token: "\\w", meaning: "Word character (\\W non-word)" },
  { token: "\\s", meaning: "Whitespace (\\S non-space)" },
  { token: "\\b", meaning: "Word boundary" },
  { token: "^ $", meaning: "Start / end of string (or line with m)" },
  { token: "* + ?", meaning: "Zero or more / one or more / optional" },
  { token: "{n,m}", meaning: "Exactly n to m repetitions" },
  { token: "[…]", meaning: "Character class, e.g. [a-z0-9]" },
  { token: "(…)", meaning: "Capturing group" },
  { token: "(?:…)", meaning: "Non-capturing group" },
  { token: "(?<name>…)", meaning: "Named capturing group" },
  { token: "(?=…) (?!…)", meaning: "Lookahead (positive / negative)" },
  { token: "(?<=…) (?<!…)", meaning: "Lookbehind (positive / negative)" },
  { token: "a|b", meaning: "Alternation (a or b)" },
  { token: "\\1 … \\9", meaning: "Backreference to capture group" },
  { token: "\\p{L}", meaning: "Unicode property (requires u flag)" },
  { token: "\\x{…}", meaning: "Unicode code point (requires u flag)" },
];

export default function RegexTester() {
  const [patternInput, setPatternInput] = useState("");
  const [selectedFlags, setSelectedFlags] = useState<Record<string, boolean>>({ g: true });
  const [text, setText] = useState("");
  const [overLimit, setOverLimit] = useState(false);
  const [overrideKey, setOverrideKey] = useState("");

  const flags = useMemo(
    () => FLAG_OPTIONS.filter((o) => selectedFlags[o.flag]).map((o) => o.flag).join(""),
    [selectedFlags]
  );
  const parsed = useMemo(() => parseRegexInput(patternInput, flags), [patternInput, flags]);
  const groupNames = useMemo(() => captureGroupNames(parsed.pattern), [parsed.pattern]);

  const hasPattern = patternInput.trim().length > 0;
  const suspicious = hasPattern && isSuspiciousPattern(parsed.pattern);
  const evalKey = `${parsed.pattern}\uFFFF${parsed.flags}`;
  const allowEval = !suspicious || overrideKey === evalKey;

  const result = useMemo(() => {
    if (!hasPattern || !allowEval) return EMPTY_RESULT;
    return runRegexJob({
      pattern: parsed.pattern,
      flags: parsed.flags,
      text,
      maxMatches: DEFAULT_MAX_MATCHES,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  }, [hasPattern, allowEval, parsed.pattern, parsed.flags, text]);

  const deferredResult = useDeferredValue(result);
  const needsU = parsed.pattern.includes("\\p{") && !parsed.flags.includes("u");
  const anyGroups = deferredResult.matches.some((m) => m.groups.length > 0);

  const highlight = useMemo(() => {
    if (!deferredResult.valid || deferredResult.matches.length === 0) return null;
    const parts: { start: number; end: number; match: boolean }[] = [];
    let cursor = 0;
    for (const m of deferredResult.matches) {
      if (m.index > cursor) parts.push({ start: cursor, end: m.index, match: false });
      parts.push({ start: m.index, end: m.index + m.text.length, match: true });
      cursor = m.index + m.text.length;
    }
    if (cursor < text.length) parts.push({ start: cursor, end: text.length, match: false });
    return parts;
  }, [deferredResult, text]);

  const handleTextChange = (value: string) => {
    if (value.length > MAX_TEXT_CHARS) {
      setText(value.slice(0, MAX_TEXT_CHARS));
      setOverLimit(true);
    } else {
      setText(value);
      if (overLimit) setOverLimit(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Field label="Pattern">
            <input
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              placeholder="e.g. \b\w+@\w+\.\w{2,}\b — slashes are optional"
              aria-label="Regex pattern"
              spellCheck={false}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent focus-visible:outline-none"
            />
          </Field>
          {parsed.wrapped && (
            <p className="mt-1.5 text-xs text-slate-500">
              Pattern wrapped in /…/ detected — slashes are optional, so this is treated purely as a
              convenience.
            </p>
          )}
          {needsU && (
            <p className="mt-1.5 text-xs text-amber-600">
              {"Patterns with \\p{…} or \\x{…} require the unicode (u) flag to work."}
            </p>
          )}
        </div>
        <fieldset>
          <legend className="sr-only">Flags</legend>
          <Field label="Flags">
            <div className="flex flex-wrap gap-2">
              {FLAG_OPTIONS.map((o) => (
                <label
                  key={o.flag}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 cursor-pointer select-none has-[:checked]:border-fuchsia-300 has-[:checked]:bg-fuchsia-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedFlags[o.flag] ?? false}
                    onChange={(e) =>
                      setSelectedFlags((prev) => ({ ...prev, [o.flag]: e.target.checked }))
                    }
                    aria-label={`${o.flag} flag`}
                    className="accent-fuchsia-600 w-4 h-4"
                  />
                  <span className="font-mono text-sm text-slate-700">{o.flag}</span>
                  <span className="text-xs text-slate-400 hidden md:inline">{o.hint}</span>
                </label>
              ))}
            </div>
          </Field>
        </fieldset>
      </div>

      {!deferredResult.valid && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-mono" role="alert">
          {deferredResult.error}
        </div>
      )}
      {deferredResult.timedOut && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm" role="alert">
          Evaluation timed out — the pattern matched too aggressively or too slowly. Match results are
          partial; consider shortening the test text.
        </div>
      )}
      {suspicious && !allowEval && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm space-y-2" role="alert">
          <p>
            This pattern uses nested or repeated quantifiers (for example (a+)+ or (a|b)*), a classic
            source of catastrophic backtracking that can freeze the page on longer input. Evaluation is
            paused; keep the test text short, or run it anyway.
          </p>
          <button
            type="button"
            onClick={() => setOverrideKey(evalKey)}
            className="inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            Run anyway
          </button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <p className="text-sm font-medium text-slate-700">Test text</p>
          {hasPattern && allowEval && (
            <span className="text-xs text-slate-600" role="status" aria-live="polite">
              {deferredResult.matches.length} match{deferredResult.matches.length === 1 ? "" : "es"}
            </span>
          )}
        </div>
        <StyledTextarea
          rows={8}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste text to search…"
          aria-label="Test text"
        />
        {overLimit && (
          <p className="mt-1 text-xs text-amber-600" role="status">
            Test text truncated to 2,000,000 characters for performance.
          </p>
        )}
      </div>

      {deferredResult.truncated && allowEval && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm" role="status">
          Showing the first {DEFAULT_MAX_MATCHES.toLocaleString()} matches — the rest are not evaluated.
        </div>
      )}

      {highlight && allowEval && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
          <p className="text-sm font-medium text-slate-700 mb-2">Matches</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
            {highlight.map((p, i) =>
              p.match && p.end > p.start ? (
                <mark key={i} className="bg-fuchsia-200 text-fuchsia-900 rounded px-0.5">
                  {text.slice(p.start, p.end)}
                </mark>
              ) : (
                <span key={i}>{text.slice(p.start, p.end)}</span>
              )
            )}
          </p>
        </div>
      )}

      {deferredResult.valid &&
        !deferredResult.timedOut &&
        allowEval &&
        deferredResult.matches.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <caption className="sr-only">Match results</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2">#</th>
                  <th scope="col" className="px-4 py-2">Match</th>
                  <th scope="col" className="px-4 py-2">Index</th>
                  {anyGroups && <th scope="col" className="px-4 py-2">Groups</th>}
                </tr>
              </thead>
              <tbody>
                {deferredResult.matches.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100 font-mono">
                    <td className="px-4 py-2 text-slate-600">{i + 1}</td>
                    <td className="px-4 py-2 text-fuchsia-700 break-all">
                      {m.text.length === 0 ? "∅ (empty match)" : m.text}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{m.index}</td>
                    {anyGroups && (
                      <td className="px-4 py-2 text-slate-600">
                        {m.groups.length === 0
                          ? "—"
                          : m.groups
                              .map((g, gi) => {
                                const name = groupNames[gi] ?? `$${gi + 1}`;
                                return `${name} = ${g ?? "∅"}`;
                              })
                              .join(", ")}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 list-none [&::-webkit-details-marker]:hidden">
          <HelpCircle className="w-4 h-4 text-fuchsia-600" />
          Regex token quick reference
          <span className="sr-only">{FLAG_HELP}</span>
        </summary>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
          {TOKEN_REFERENCE.map((t) => (
            <div key={t.token} className="flex items-baseline gap-3">
              <dt className="font-mono text-xs text-fuchsia-700 whitespace-nowrap min-w-16">{t.token}</dt>
              <dd className="text-xs text-slate-600">{t.meaning}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <TerminalSquare className="w-3.5 h-3.5" /> Uses JavaScript regular expressions.
      </div>
    </div>
  );
}