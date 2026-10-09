"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";
import { describeFields, parseCron } from "./cron";

const EXAMPLES = [
  { label: "Every 5 minutes", expr: "*/5 * * * *" },
  { label: "Hourly", expr: "0 * * * *" },
  { label: "Daily at 9am", expr: "0 9 * * *" },
  { label: "Midnight", expr: "0 0 * * *" },
  { label: "Every Monday 8:30am", expr: "30 8 * * 1" },
  { label: "Weekdays 6pm", expr: "0 18 * * 1-5" },
  { label: "1st of month", expr: "0 0 1 * *" },
  { label: "Every 15 s (6 fields)", expr: "*/15 * * * * *" },
  { label: "@daily macro", expr: "@daily" },
];

export default function CronParser() {
  const [expr, setExpr] = useState("*/5 * * * *");
  const [count, setCount] = useState(5);
  const [utc, setUtc] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const exprId = useId();
  const countId = useId();

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => parseCron(expr, count, nowMs), [expr, count, nowMs]);
  const fieldInfo = useMemo(() => describeFields(expr), [expr]);

  const fmt = (d: Date) =>
    d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium", timeZone: utc ? "UTC" : undefined });

  const status =
    result.kind === "empty"
      ? "Type a cron expression."
      : result.kind === "invalid"
        ? "Invalid expression — nothing to list."
        : `${result.next.length} upcoming run(s) listed.`;

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={exprId} className="block text-sm font-medium text-slate-700 mb-2">
            Cron expression
          </label>
          <input
            id={exprId}
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            spellCheck={false}
            aria-invalid={result.kind === "invalid" ? true : undefined}
            placeholder="* * * * *"
            className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor={countId} className="block text-sm font-medium text-slate-700 mb-2">
            Next: {count}
          </label>
          <input
            id={countId}
            type="range"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-36 accent-blue-600"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <input
            type="checkbox"
            checked={utc}
            onChange={(e) => setUtc(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          UTC
        </label>
      </div>

      <p className="text-xs text-slate-400">
        Five fields (minute hour day-of-month month day-of-week), or six with seconds first — or a macro such as
        @daily, @weekly, @monthly, @yearly. Names like mon and mar work in the day and month fields.
      </p>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.expr}
            type="button"
            onClick={() => setExpr(ex.expr)}
            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      {result.kind === "empty" ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Type a cron expression above — five fields, six with seconds first, or a macro such as @daily.
        </div>
      ) : result.kind === "invalid" ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Next {count} run(s)
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {result.next.map((d, i) => (
                <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 font-mono text-sm text-slate-700">
                  {fmt(d)}
                </div>
              ))}
            </div>
          </div>
          {fieldInfo && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Parsed fields
              </p>
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">{fieldInfo}</pre>
              <div className="mt-3">
                <CopyButton text={result.next.map(fmt).join("\n")} ariaLabel="Copy the listed run times" />
              </div>
            </div>
          )}
        </>
      )}

      <Button type="button" variant="secondary" onClick={() => setExpr("*/5 * * * *")}>
        Reset
      </Button>
    </div>
  );
}
