"use client";

import { useMemo, useState } from "react";
import { TerminalSquare } from "lucide-react";
import { Field, StyledTextarea } from "@/components/ui";

export default function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("");

  const result = useMemo(() => {
    if (!pattern) return { valid: true, matches: [], error: "", count: 0 };
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch (err) {
      return {
        valid: false,
        matches: [],
        error: err instanceof Error ? err.message : "Invalid regex",
        count: 0,
      };
    }

    const matches: { index: number; text: string; groups: string[] }[] = [];
    const clone = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = clone.exec(text)) !== null && guard < 5000) {
      matches.push({
        index: m.index,
        text: m[0],
        groups: m.slice(1).filter((g): g is string => typeof g === "string"),
      });
      if (m[0].length === 0) clone.lastIndex++;
      guard++;
    }
    return { valid: true, matches, error: "", count: matches.length };
  }, [pattern, flags, text]);

  const highlight = useMemo(() => {
    if (!result.valid || result.matches.length === 0) return null;
    const parts: { start: number; end: number; match: boolean }[] = [];
    let cursor = 0;
    for (const m of result.matches) {
      if (m.index > cursor) parts.push({ start: cursor, end: m.index, match: false });
      parts.push({ start: m.index, end: m.index + m.text.length, match: true });
      cursor = m.index + m.text.length;
    }
    if (cursor < text.length) parts.push({ start: cursor, end: text.length, match: false });
    return parts;
  }, [result, text]);

  return (
    <div className="space-y-5 w-full">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Field label="Pattern">
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. \b\w+@\w+\.\w{2,}\b"
              spellCheck={false}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
            />
          </Field>
        </div>
        <Field label="Flags">
          <input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="gim"
            spellCheck={false}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
          />
        </Field>
      </div>

      {!result.valid && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-mono">
          {result.error}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Test text</p>
          {result.valid && (
            <span className="text-xs text-slate-400">
              {result.count} match{result.count === 1 ? "" : "es"}
            </span>
          )}
        </div>
        <StyledTextarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text to search…"
        />
      </div>

      {highlight && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Matches</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
            {highlight.map((p, i) =>
              p.match ? (
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

      {result.valid && result.matches.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Match</th>
                <th className="px-4 py-2">Index</th>
                {result.matches.some((m) => m.groups.length > 0) && (
                  <th className="px-4 py-2">Groups</th>
                )}
              </tr>
            </thead>
            <tbody>
              {result.matches.map((m, i) => (
                <tr key={i} className="border-t border-slate-100 font-mono">
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2 text-fuchsia-700">{m.text}</td>
                  <td className="px-4 py-2 text-slate-500">{m.index}</td>
                  {result.matches.some((g) => g.groups.length > 0) && (
                    <td className="px-4 py-2 text-slate-500">{m.groups.join(", ")}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <TerminalSquare className="w-3.5 h-3.5" /> Uses JavaScript regular expressions.
      </div>
    </div>
  );
}