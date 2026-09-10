"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  Copy,
  GitCompareArrows,
  Upload,
  Trash2,
} from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";
import {
  DiffRow,
  Granularity,
  buildUnifiedText,
  diffLines,
  splitLines,
} from "./diff";

type ViewMode = "split" | "unified";

const SAMPLE_OLD = `function sum(values) {
  let total = 0;
  for (const v of values) {
    total += v;
  }
  return total;
}

console.log(sum([1, 2, 3]));`;

const SAMPLE_NEW = `function sum(values, initial = 0) {
  let total = initial;
  for (const v of values) {
    total += v;
  }
  return total;
}

console.log(sum([1, 2, 3], 10));`;

function Chunked({ chunks, removed }: { chunks?: DiffRow["leftChunks"]; removed: boolean }) {
  if (!chunks) return null;
  return (
    <>
      {chunks.map((c, i) =>
        c.kind === "equal" ? (
          <span key={i}>{c.text}</span>
        ) : (
          <span
            key={i}
            className={
              removed
                ? "rounded bg-red-100 px-0.5 text-red-800"
                : "rounded bg-green-100 px-0.5 text-green-800"
            }
          >
            {c.text}
          </span>
        )
      )}
    </>
  );
}

export default function DiffChecker() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [compared, setCompared] = useState(false);
  const [view, setView] = useState<ViewMode>("split");
  const [granularity, setGranularity] = useState<Granularity>("words");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreAllSpace, setIgnoreAllSpace] = useState(false);
  const [ignoreTrailingSpace, setIgnoreTrailingSpace] = useState(false);
  const [context, setContext] = useState(3);
  const fileRefL = useRef<HTMLInputElement>(null);
  const fileRefR = useRef<HTMLInputElement>(null);

  const opts = useMemo(
    () => ({ ignoreCase, ignoreAllSpace, ignoreTrailingSpace, granularity }),
    [ignoreCase, ignoreAllSpace, ignoreTrailingSpace, granularity]
  );

  const result = useMemo(
    () => diffLines(splitLines(left), splitLines(right), opts, context),
    [left, right, opts, context]
  );

  const unifiedText = useMemo(
    () => buildUnifiedText(splitLines(left), splitLines(right), opts, context),
    [left, right, opts, context]
  );

  const changed = result.added + result.removed + result.changed;

  const onRead = (file: File | undefined, side: "left" | "right") => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (side === "left") setLeft(text);
      else setRight(text);
    };
    reader.readAsText(file);
  };

  const swap = () => {
    setLeft(right);
    setRight(left);
  };

  const clear = () => {
    setLeft("");
    setRight("");
    setCompared(false);
  };

  const loadSample = () => {
    setLeft(SAMPLE_OLD);
    setRight(SAMPLE_NEW);
    setCompared(true);
  };

  const renderSplit = () =>
    result.rows.length === 0 ? (
      <div className="text-center text-sm text-slate-400 py-8">No lines to compare</div>
    ) : (
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm font-mono leading-relaxed">
          <tbody>
            {result.rows.map((row, i) => {
              const leftBg =
                row.kind === "removed" || row.kind === "changed"
                  ? "bg-red-50/70"
                  : row.kind === "same"
                    ? "bg-white"
                    : "";
              const rightBg =
                row.kind === "added" || row.kind === "changed"
                  ? "bg-green-50/70"
                  : row.kind === "same"
                    ? "bg-white"
                    : "";
              const leftText =
                row.kind === "removed"
                  ? "text-red-700"
                  : row.kind === "changed"
                    ? "text-red-800"
                    : "text-slate-700";
              const rightText =
                row.kind === "added"
                  ? "text-green-700"
                  : row.kind === "changed"
                    ? "text-green-800"
                    : "text-slate-700";
              return (
                <tr key={i} className="border-b border-slate-100 last:border-0 align-top">
                  <td className={`w-12 px-2 py-0.5 text-right text-xs text-slate-400 select-none ${leftBg}`}>
                    {row.leftNo ?? ""}
                  </td>
                  <td className={`px-3 py-0.5 whitespace-pre-wrap break-all ${leftBg} ${leftText}`}>
                    {row.kind === "changed" ? (
                      <Chunked chunks={row.leftChunks} removed />
                    ) : (
                      row.left
                    )}
                  </td>
                  <td className={`w-12 px-2 py-0.5 text-right text-xs text-slate-400 select-none ${rightBg}`}>
                    {row.rightNo ?? ""}
                  </td>
                  <td className={`px-3 py-0.5 whitespace-pre-wrap break-all ${rightBg} ${rightText}`}>
                    {row.kind === "changed" ? (
                      <Chunked chunks={row.rightChunks} removed={false} />
                    ) : (
                      row.right
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const renderUnified = () =>
    result.hunks.length === 0 ? (
      <div className="text-center text-sm text-slate-400 py-8">No differences found</div>
    ) : (
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <pre className="text-sm font-mono leading-relaxed p-0 m-0">
          {result.hunks.map((hunk, hi) => (
            <div key={hi}>
              <div className="bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border-b border-indigo-100 select-none">
                @@ -{hunk.aStart},{hunk.aCount} +{hunk.bStart},{hunk.bCount} @@
              </div>
              {hunk.rows.map((row, ri) => {
                const bg =
                  row.kind === "delete"
                    ? "bg-red-50/70 text-red-800"
                    : row.kind === "insert"
                      ? "bg-green-50/70 text-green-800"
                      : "text-slate-700";
                const mark = row.kind === "delete" ? "-" : row.kind === "insert" ? "+" : " ";
                return (
                  <div
                    key={ri}
                    className={`flex px-0.5 border-b border-slate-50 ${bg}`}
                  >
                    <span className="w-12 shrink-0 text-right text-xs text-slate-400 select-none">{row.aNo ?? ""}</span>
                    <span className="w-4 shrink-0 text-slate-400 select-none">{mark}</span>
                    <span className="flex-1 px-2 whitespace-pre-wrap break-all">{row.text}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </pre>
      </div>
    );

  const copyDiff = () => {
    navigator.clipboard.writeText(unifiedText).catch(() => {});
  };

  return (
    <div className="space-y-5 w-full">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Original</p>
            <button
              type="button"
              onClick={() => fileRefL.current?.click()}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition"
            >
              <Upload className="w-3.5 h-3.5" /> Load file
            </button>
            <input
              ref={fileRefL}
              type="file"
              accept=".txt,.md,.text,text/plain,text/*,.json,.csv,.js,.ts"
              className="hidden"
              onChange={(e) => onRead(e.target.files?.[0], "left")}
            />
          </div>
          <StyledTextarea rows={10} value={left} onChange={(e) => { setLeft(e.target.value); setCompared(false); }} placeholder="Paste the original text…" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Changed</p>
            <button
              type="button"
              onClick={() => fileRefR.current?.click()}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition"
            >
              <Upload className="w-3.5 h-3.5" /> Load file
            </button>
            <input
              ref={fileRefR}
              type="file"
              accept=".txt,.md,.text,text/plain,text/*,.json,.csv,.js,.ts"
              className="hidden"
              onChange={(e) => onRead(e.target.files?.[0], "right")}
            />
          </div>
          <StyledTextarea rows={10} value={right} onChange={(e) => { setRight(e.target.value); setCompared(false); }} placeholder="Paste the changed text…" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => setCompared(true)}>
          <GitCompareArrows className="w-4 h-4 mr-1.5 inline" /> Compare
        </Button>
        <Button type="button" variant="secondary" onClick={swap}>
          <ArrowLeftRight className="w-4 h-4 mr-1.5 inline" /> Swap
        </Button>
        <Button type="button" variant="secondary" onClick={loadSample}>
          Try an example
        </Button>
        <Button type="button" variant="secondary" onClick={clear}>
          <Trash2 className="w-4 h-4 mr-1.5 inline" /> Clear
        </Button>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
          <span className="px-2 text-slate-400 select-none">View</span>
          {(["split", "unified"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                view === v ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {v === "split" ? "Split" : "Single file"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" className="accent-cyan-600" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />
          Ignore case
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" className="accent-cyan-600" checked={ignoreAllSpace} onChange={(e) => setIgnoreAllSpace(e.target.checked)} />
          Ignore whitespace (git -w)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" className="accent-cyan-600" checked={ignoreTrailingSpace} onChange={(e) => setIgnoreTrailingSpace(e.target.checked)} />
          Ignore trailing spaces
        </label>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
          <span className="px-2 text-slate-400 select-none">Highlight</span>
          {(["words", "characters"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                granularity === g ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {g === "words" ? "Words" : "Characters"}
            </button>
          ))}
        </div>

        {view === "unified" && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Context
            <select
              value={context}
              onChange={(e) => setContext(Number(e.target.value))}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            >
              {[0, 1, 3, 5, 10].map((c) => (
                <option key={c} value={c}>
                  {c === 0 ? "none" : c}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {compared && (
        <div className="flex flex-wrap items-center gap-3">
          {changed > 0 ? (
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              <span className="font-semibold">{result.same} unchanged</span>
              <span className="text-green-700 font-semibold">+{result.added}</span>
              <span className="text-red-700 font-semibold">−{result.removed}</span>
              {result.changed > 0 && <span className="font-semibold text-amber-700">• {result.changed} modified</span>}
            </div>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs text-green-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> No differences found
            </span>
          )}
          {changed > 0 && (
            <Button type="button" variant="secondary" onClick={copyDiff} className="!px-3 !py-1 text-xs">
              <Copy className="w-3.5 h-3.5 mr-1.5 inline" /> Copy as unified diff
            </Button>
          )}
        </div>
      )}

      {compared && (view === "split" ? renderSplit() : renderUnified())}
    </div>
  );
}