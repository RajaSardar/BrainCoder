"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  GitCompareArrows,
  Upload,
  Trash2,
} from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";
import {
  DiffResult,
  DiffRow,
  Granularity,
  buildUnifiedTextFromHunks,
  diffLines,
  splitLines,
} from "./diff";

type ViewMode = "split" | "unified";

const focusRing =
  "min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

interface TabOption<T extends string> {
  value: T;
  label: string;
}

function TabGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: TabOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next !== null) {
      e.preventDefault();
      onChange(options[next].value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs ${className}`}
    >
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`px-2.5 py-1 rounded-md font-medium transition ${
            value === option.value
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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

  const diff = useMemo<DiffResult | null>(() => {
    if (!compared) return null;
    const a = splitLines(left);
    const b = splitLines(right);
    return diffLines(a, b, opts, context);
  }, [left, right, opts, context, compared]);

  const unifiedText = useMemo(
    () => (diff ? buildUnifiedTextFromHunks(diff.hunks) : ""),
    [diff]
  );

  const changed = diff ? diff.added + diff.removed + diff.changed : 0;

  const sizeWarning = useMemo(() => {
    const totalLines = left.length === 0 && right.length === 0 ? 0 : splitLines(left).length + splitLines(right).length;
    if (totalLines > 4000 || left.length + right.length > 1_000_000) {
      return "Large input detected — comparing very large or heavily rewritten files can be slow or freeze the tab. Consider splitting the files before comparing.";
    }
    return null;
  }, [left, right]);

  const onRead = (file: File | undefined, side: "left" | "right") => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (side === "left") setLeft(text);
      else setRight(text);
    };
    reader.onerror = () => {
      setCompared(false);
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

  const renderSplit = () => {
    if (!diff || diff.rows.length === 0) return null;
    return (
      <div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm font-mono leading-relaxed">
            <caption className="sr-only">
              Difference between the Original and Changed text, shown line by line
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th scope="col" className="w-6"></th>
                <th scope="col" className="w-12 px-2 py-1 text-right text-xs text-slate-500 font-semibold">#</th>
                <th scope="col" className="px-2 py-1 text-left text-xs text-slate-500 font-semibold">Original</th>
                <th scope="col" className="w-6"></th>
                <th scope="col" className="w-12 px-2 py-1 text-right text-xs text-slate-500 font-semibold">#</th>
                <th scope="col" className="px-2 py-1 text-left text-xs text-slate-500 font-semibold">Changed</th>
              </tr>
            </thead>
            <tbody>
              {diff.rows.map((row, i) => {
                const leftChanged = row.kind === "removed" || row.kind === "changed";
                const rightChanged = row.kind === "added" || row.kind === "changed";
                const leftBg =
                  leftChanged
                    ? "bg-red-50/70"
                    : row.kind === "same"
                      ? "bg-white"
                      : "";
                const rightBg =
                  rightChanged
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
                    <td className={`w-6 text-center text-xs select-none ${leftBg}`}>
                      {leftChanged ? <span className="text-red-600 font-bold" aria-hidden="true">−</span> : null}
                    </td>
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
                    <td className={`w-6 text-center text-xs select-none ${rightBg}`}>
                      {rightChanged ? <span className="text-green-600 font-bold" aria-hidden="true">+</span> : null}
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
        <p className="text-xs text-slate-500 mt-2">
          <span className="text-red-600 font-semibold">Red</span> = removed or modified lines from the
          Original &nbsp;·&nbsp; <span className="text-green-600 font-semibold">Green</span> = added or modified
          lines in the Changed text
        </p>
      </div>
    );
  }; 

  const renderUnified = () => {
    if (!diff || diff.hunks.length === 0) return null;
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <pre className="text-sm font-mono leading-relaxed p-0 m-0">
          {diff.hunks.map((hunk, hi) => (
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
              className={`flex items-center gap-1 rounded text-xs text-slate-500 hover:text-slate-800 transition px-1 ${focusRing}`}
            >
              <Upload className="w-3.5 h-3.5" /> Load file
            </button>
            <input
              ref={fileRefL}
              type="file"
              accept=".txt,.text,.md,.mdx,.json,.csv,.tsv,.js,.jsx,.ts,.tsx,.html,.css,.scss,.xml,.yaml,.yml,.toml,.ini,.log,.py,.go,.java,.c,.cpp,.h,.cs,.rb,.php,.sql,.sh,.env,text/*,application/json,application/xml,application/x-yaml"
              aria-label="Load original file"
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
              className={`flex items-center gap-1 rounded text-xs text-slate-500 hover:text-slate-800 transition px-1 ${focusRing}`}
            >
              <Upload className="w-3.5 h-3.5" /> Load file
            </button>
            <input
              ref={fileRefR}
              type="file"
              accept=".txt,.text,.md,.mdx,.json,.csv,.tsv,.js,.jsx,.ts,.tsx,.html,.css,.scss,.xml,.yaml,.yml,.toml,.ini,.log,.py,.go,.java,.c,.cpp,.h,.cs,.rb,.php,.sql,.sh,.env,text/*,application/json,application/xml,application/x-yaml"
              aria-label="Load changed file"
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

        <TabGroup
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "split", label: "Split" },
            { value: "unified", label: "Single file" },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer min-h-11">
          <input type="checkbox" className="accent-indigo-600" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />
          Ignore case
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer min-h-11">
          <input type="checkbox" className="accent-indigo-600" checked={ignoreAllSpace} onChange={(e) => setIgnoreAllSpace(e.target.checked)} />
          Ignore whitespace (git -w)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer min-h-11">
          <input type="checkbox" className="accent-indigo-600" checked={ignoreTrailingSpace} onChange={(e) => setIgnoreTrailingSpace(e.target.checked)} />
          Ignore trailing spaces
        </label>

        <TabGroup
          label="Highlight"
          value={granularity}
          onChange={setGranularity}
          options={[
            { value: "words", label: "Words" },
            { value: "characters", label: "Characters" },
          ]}
        />

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

      {sizeWarning && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          {sizeWarning}
        </div>
      )}

      {compared && diff && (
        <div className="flex flex-wrap items-center gap-3">
          <div role="status" aria-live="polite">
            {diff.rows.length === 0 ? (
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 font-semibold">
                No lines to compare
              </span>
            ) : changed > 0 ? (
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                <span className="font-semibold">{diff.same} unchanged</span>
                {diff.added > 0 && <span className="text-green-700 font-semibold">+{diff.added}</span>}
                {diff.removed > 0 && <span className="text-red-700 font-semibold">−{diff.removed}</span>}
                {diff.changed > 0 && <span className="font-semibold text-amber-700">• {diff.changed} modified</span>}
              </div>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs text-green-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> No differences found
              </span>
            )}
          </div>
          {changed > 0 && (
            <CopyButton text={unifiedText} label="Copy as unified diff" />
          )}
        </div>
      )}

      {compared && (view === "split" ? renderSplit() : renderUnified())}
    </div>
  );
}