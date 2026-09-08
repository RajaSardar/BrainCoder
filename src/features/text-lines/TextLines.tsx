"use client";

import { useMemo, useState } from "react";
import { Rows3, SortAsc, SortDesc, Shuffle, Delete, AlignLeft } from "lucide-react";
import { StyledTextarea, Button, CopyButton } from "@/components/ui";

function uniqueLines(text: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out.join("\n");
}

function sort(text: string, numeric: boolean, desc: boolean): string {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const sorted = [...lines].sort((a, b) => {
    if (numeric) {
      const na = Number(a.replace(/[, ]/g, ""));
      const nb = Number(b.replace(/[, ]/g, ""));
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
  if (desc) sorted.reverse();
  return sorted.join("\n");
}

const PRESET = `banana
apple
42
banana
cherry
7
100
apple`;

export default function TextLines() {
  const [input, setInput] = useState(PRESET);
  const [result, setResult] = useState("");
  const [lastOp, setLastOp] = useState("");

  const stats = useMemo(() => {
    const lines = input.length ? input.split("\n") : [];
    const chars = input.length;
    const words = input ? input.trim().split(/\s+/).length : 0;
    return { lines: lines.length, empty: lines.filter((l) => l.trim() === "").length, chars, words };
  }, [input]);

  const run = (op: string, text: string) => {
    setResult(text);
    setLastOp(op);
  };

  return (
    <div className="space-y-5 w-full">
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Input</p>
          <StyledTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={12}
            className="min-h-[300px]"
            placeholder="Paste lines of text…"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" onClick={() => run("sort a→z", sort(input, false, false))}>
              <SortAsc className="w-4 h-4" /> Sort A→Z
            </Button>
            <Button type="button" onClick={() => run("sort z→a", sort(input, false, true))}>
              <SortDesc className="w-4 h-4" /> Sort Z→A
            </Button>
            <Button type="button" onClick={() => run("sort numeric", sort(input, true, false))}>
              Sort numeric
            </Button>
            <Button type="button" variant="secondary" onClick={() => run("dedupe", uniqueLines(input))}>
              Remove duplicates
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                run(
                  "shuffle",
                  input.split("\n").filter((l) => l.length > 0).sort(() => Math.random() - 0.5).join("\n")
                )
              }
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => run("trim", input.split("\n").map((l) => l.trim()).join("\n"))}
            >
              <AlignLeft className="w-4 h-4" /> Trim whitespace
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => run("remove empty", input.split("\n").filter((l) => l.trim() !== "").join("\n"))}
            >
              Remove empty lines
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => run("reverse", input.split("\n").reverse().join("\n"))}
            >
              Reverse
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const lines = input.split("\n");
                let n = 1;
                run("add line numbers", lines.map((l) => (l.length ? `${n++}\t${l}` : "")).join("\n"));
              }}
            >
              Number lines
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => run("clear output", "")}
            >
              <Delete className="w-4 h-4" /> Clear
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <Rows3 className="w-3.5 h-3.5" /> Output {lastOp && <span className="text-indigo-500">· {lastOp}</span>}
          </p>
          <div className="min-h-[300px] rounded-xl border border-slate-200 bg-white p-4 text-sm font-mono text-slate-700 whitespace-pre overflow-auto">
            {result || <span className="text-slate-300">Result appears here after running an operation…</span>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CopyButton text={result} />
            <span className="text-xs text-slate-400">Copy output</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="rounded-full bg-white border border-slate-200 px-3 py-1">{stats.lines} lines</span>
        <span className="rounded-full bg-white border border-slate-200 px-3 py-1">{stats.empty} empty</span>
        <span className="rounded-full bg-white border border-slate-200 px-3 py-1">{stats.words} words</span>
        <span className="rounded-full bg-white border border-slate-200 px-3 py-1">{stats.chars} chars</span>
      </div>
    </div>
  );
}