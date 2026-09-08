"use client";

import { useMemo, useState } from "react";
import { Binary } from "lucide-react";
import { Field, Button, CopyButton } from "@/components/ui";

const BASES = [2, 8, 10, 16] as const;

function parseToBig(base: number, s: string): bigint | null {
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, base);
  let value = BigInt(0);
  let i = 0;
  let negative = false;
  const input = s.trim().toLowerCase();
  if (input[0] === "-" || input[0] === "+") {
    negative = input[0] === "-";
    i = 1;
  }
  for (; i < input.length; i++) {
    const d = digits.indexOf(input[i]);
    if (d < 0) return null;
    value = value * BigInt(base) + BigInt(d);
  }
  return negative ? -value : value;
}

function stripPrefix(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.startsWith("0x")) return t.slice(2);
  if (t.startsWith("0b")) return t.slice(2);
  if (t.startsWith("0o")) return t.slice(2);
  return t;
}

export default function NumberBase() {
  const [input, setInput] = useState("255");
  const [base, setBase] = useState<number>(10);

  const result = useMemo(() => {
    const cleaned = input.trim() === "" ? "0" : stripPrefix(input);
    const value = parseToBig(base, cleaned);
    if (value === null) {
      return {
        ok: false as const,
        error: `Invalid digit for base ${base}.`,
        rows: [] as { label: string; value: string }[],
      };
    }
    const neg = value < BigInt(0);
    const abs = neg ? -value : value;
    return {
      ok: true as const,
      error: "",
      rows: [
        { label: "Binary (2)", value: (neg ? "-" : "") + "0b" + abs.toString(2) },
        { label: "Octal (8)", value: (neg ? "-" : "") + "0o" + abs.toString(8) },
        { label: "Decimal (10)", value: (neg ? "-" : "") + abs.toString(10) },
        { label: "Hexadecimal (16)", value: (neg ? "-" : "") + "0x" + abs.toString(16).toUpperCase() },
        {
          label: "ASCII/Unicode",
          value: value >= BigInt(0) && value <= BigInt(0x10ffff) ? `U+${value.toString(16).toUpperCase().padStart(4, "0")}` : "—",
        },
      ],
    };
  }, [input, base]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </Field>
        <Field label="Input base">
          <select
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {BASES.map((b) => (
              <option key={b} value={b}>
                Base {b}
              </option>
            ))}
            {[32, 36].map((b) => (
              <option key={b} value={b}>
                Base {b}
              </option>
            ))}
          </select>
        </Field>
        <Button type="button" variant="secondary" onClick={() => setInput("255")}>
          Reset
        </Button>
      </div>

      {result.ok ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {result.rows.map((r) => (
            <div key={r.label} className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">{r.label}</p>
                <CopyButton text={r.value} />
              </div>
              <p className="font-mono text-sm text-indigo-700 break-all">{r.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
          <Binary className="w-4 h-4" /> {result.error}
        </div>
      )}

      {!result.ok && result.error.includes("Invalid") && (
        <p className="text-xs text-slate-400">Prefixes like 0x, 0b and 0o are auto-detected and stripped.</p>
      )}
      <p className="text-xs text-slate-400">Arbitrary-precision BigInt — supports numbers beyond 64-bit.</p>
    </div>
  );
}