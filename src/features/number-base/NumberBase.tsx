"use client";

import { useMemo, useState } from "react";
import { Binary } from "lucide-react";
import { Field, Button, CopyButton } from "@/components/ui";
import { INPUT_BASES, convert } from "./convert";

export default function NumberBase() {
  const [input, setInput] = useState("");
  const [base, setBase] = useState<number>(10);

  const result = useMemo(() => convert(input, base), [input, base]);

  const status =
    result.kind === "empty"
      ? "Type a number to convert."
      : result.kind === "invalid"
        ? result.error
        : `Converted ${result.rows.length} representations in base ${base}.`;

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            aria-label="Number to convert"
            placeholder="255"
            className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </Field>
        <Field label="Input base">
          <select
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            aria-label="Base of the number you typed"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {INPUT_BASES.map((b) => (
              <option key={b} value={b}>
                Base {b}
              </option>
            ))}
          </select>
        </Field>
        <Button type="button" variant="secondary" onClick={() => setInput("")}>
          Clear
        </Button>
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      {result.kind === "invalid" && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
          <Binary className="w-4 h-4" /> {result.error}
        </div>
      )}

      {result.kind === "empty" && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Type a number above — binary, octal, decimal or hex — to see it in every base at once.
        </div>
      )}

      {result.kind === "converted" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {result.rows.map((r) => (
            <div key={r.label} className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">{r.label}</p>
                <CopyButton text={r.value} ariaLabel={`Copy ${r.label} value`} />
              </div>
              <p className="font-mono text-sm text-indigo-700 break-all">{r.value}</p>
              {r.note && (
                <p className="mt-1 font-mono text-xs text-slate-500 break-all">
                  {r.note.length === 1 ? `“${r.note}”` : r.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Prefixes are stripped only when they match the selected base: 0b in base 2, 0o in base 8, 0x in base 16.
        Arbitrary-precision BigInt, so values well beyond 64 bits are exact.
      </p>
    </div>
  );
}
