"use client";

import { useEffect, useMemo, useState } from "react";
import CronExpressionParser, { type CronFieldCollection } from "cron-parser";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { Field, Button, CopyButton } from "@/components/ui";

const EXAMPLES = [
  { label: "Every 5 minutes", expr: "*/5 * * * *" },
  { label: "Hourly", expr: "0 * * * *" },
  { label: "Daily at 9am", expr: "0 9 * * *" },
  { label: "Midnight", expr: "0 0 * * *" },
  { label: "Every Monday 8:30am", expr: "30 8 * * 1" },
  { label: "Weekdays 6pm", expr: "0 18 * * 1-5" },
  { label: "1st of month", expr: "0 0 1 * *" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fieldsDesc(f: CronFieldCollection): string {
  const fmt = (field: { values: ArrayLike<number | string>; isWildcard: boolean }) =>
    field.isWildcard ? "*" : Array.from(field.values).join(", ");
  const dow = (field: { values: ArrayLike<number | string>; isWildcard: boolean }) =>
    field.isWildcard ? "*" : Array.from(field.values)
      .map((v) => (typeof v === "number" ? WEEKDAYS[v % 7] ?? String(v) : v))
      .join(", ");
  return [
    `minute: ${fmt(f.minute)}`,
    `hour: ${fmt(f.hour)}`,
    `day of month: ${fmt(f.dayOfMonth)}`,
    `month: ${fmt(f.month)}`,
    `day of week: ${dow(f.dayOfWeek)}`,
  ].join("\n");
}

export default function CronParser() {
  const [expr, setExpr] = useState("*/5 * * * *");
  const [count, setCount] = useState(5);
  const [utc, setUtc] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => {
    if (!expr.trim()) return { ok: false as const, next: [] as Date[], error: "Type a cron expression." };
    try {
      const interval = CronExpressionParser.parse(expr, nowMs ? { currentDate: new Date(nowMs) } : undefined);
      const next: Date[] = [];
      for (let i = 0; i < count; i++) next.push(interval.next().toDate());
      return { ok: true as const, next, error: "" };
    } catch (err) {
      return { ok: false as const, next: [], error: err instanceof Error ? err.message : "Invalid cron expression." };
    }
  }, [expr, count, nowMs]);

  const fieldInfo = useMemo(() => {
    try {
      return fieldsDesc(CronExpressionParser.parse(expr).fields);
    } catch {
      return "";
    }
  }, [expr]);

  const fmt = (d: Date) =>
    d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium", timeZone: utc ? "UTC" : undefined });

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Cron expression (5 fields)">
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="* * * * *"
            spellCheck={false}
            className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
        <Field label={`Next: ${count}`}>
          <input
            type="range"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-36 accent-blue-600"
          />
        </Field>
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

      {!result.ok ? (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          <XCircle className="w-4 h-4" /> {result.error}
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
                <CopyButton text={result.next.map(fmt).join("\n")} />
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