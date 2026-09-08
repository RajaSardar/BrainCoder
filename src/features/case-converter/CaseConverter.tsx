"use client";

import { useMemo, useState } from "react";
import { StyledTextarea, CopyButton } from "@/components/ui";

function words(text: string): string[] {
  const cleaned = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-\s.]+/g, " ")
    .trim();
  return cleaned ? cleaned.split(" ") : [];
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const CONVERTERS: { id: string; label: string; convert: (t: string) => string }[] = [
  {
    id: "camel",
    label: "camelCase",
    convert: (t) => words(t).map((w, i) => (i === 0 ? w.toLowerCase() : cap(w.toLowerCase()))).join(""),
  },
  {
    id: "pascal",
    label: "PascalCase",
    convert: (t) => words(t).map((w) => cap(w.toLowerCase())).join(""),
  },
  {
    id: "snake",
    label: "snake_case",
    convert: (t) => words(t).map((w) => w.toLowerCase()).join("_"),
  },
  {
    id: "kebab",
    label: "kebab-case",
    convert: (t) => words(t).map((w) => w.toLowerCase()).join("-"),
  },
  {
    id: "constant",
    label: "CONSTANT_CASE",
    convert: (t) => words(t).map((w) => w.toUpperCase()).join("_"),
  },
  {
    id: "dot",
    label: "dot.case",
    convert: (t) => words(t).map((w) => w.toLowerCase()).join("."),
  },
  {
    id: "title",
    label: "Title Case",
    convert: (t) => words(t).map((w) => cap(w.toLowerCase())).join(" "),
  },
  {
    id: "sentence",
    label: "Sentence case",
    convert: (t) => {
      const w = words(t);
      return w.length ? cap(w.join(" ").toLowerCase()) : "";
    },
  },
  {
    id: "upper",
    label: "UPPERCASE",
    convert: (t) => t.toUpperCase(),
  },
  {
    id: "lower",
    label: "lowercase",
    convert: (t) => t.toLowerCase(),
  },
  {
    id: "capitalize",
    label: "Capitalize Words",
    convert: (t) => t.split(/\s+/).map((w) => cap(w.toLowerCase())).join(" "),
  },
];

export default function CaseConverter() {
  const [input, setInput] = useState("Hello World, This is BrainCoder!");

  const results = useMemo(
    () => CONVERTERS.map((c) => ({ ...c, output: c.convert(input) })),
    [input]
  );

  return (
    <div className="space-y-5 w-full">
      <StyledTextarea
        rows={4}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type or paste text…"
      />

      <div className="grid sm:grid-cols-2 gap-3">
        {results.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-slate-500">{r.label}</p>
              <CopyButton text={r.output} />
            </div>
            <p className="font-mono text-sm text-lime-700 break-all">{r.output}</p>
          </div>
        ))}
      </div>
    </div>
  );
}