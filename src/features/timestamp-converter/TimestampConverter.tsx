"use client";

import { useMemo, useState } from "react";
import { Timer } from "lucide-react";
import { Field, Button, CopyButton } from "@/components/ui";

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function formatLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatUTC(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

const DEFAULT_TIMESTAMP = String(Math.floor(Date.now() / 1000));

export default function TimestampConverter() {
  const [input, setInput] = useState(DEFAULT_TIMESTAMP);
  const [isMs, setIsMs] = useState(false);

  const ts = useMemo(() => {
    const n = Number(input.trim());
    if (Number.isNaN(n)) return null;
    return isMs ? n : n * 1000;
  }, [input, isMs]);

  const dateInput = ts === null ? "" : formatLocal(ts);

  const parseDate = (val: string) => {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) {
      setInput(String(Math.floor(parsed / 1000)));
      setIsMs(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="grid gap-3">
        <Field label="Unix timestamp">
          <div className="flex gap-2 items-stretch">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              placeholder="e.g. 1725000000"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 whitespace-nowrap">
              <input
                type="checkbox"
                checked={isMs}
                onChange={(e) => setIsMs(e.target.checked)}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              milliseconds
            </label>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              setInput(String(Math.floor(Date.now() / 1000)));
              setIsMs(false);
            }}
          >
            <Timer className="w-4 h-4 mr-1.5 inline" /> Now
          </Button>
        </Field>

        {ts !== null && (
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: "Local time", value: formatLocal(ts) },
              { label: "UTC time", value: formatUTC(ts) },
              { label: "ISO 8601", value: new Date(ts).toISOString() },
            ].map((row) => (
              <div key={row.label} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs text-slate-500 mb-1">{row.label}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-mono font-medium text-slate-800 break-all">{row.value}</p>
                  <CopyButton text={row.value} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Date & time (local) → timestamp">
        <input
          value={dateInput}
          onChange={(e) => parseDate(e.target.value)}
          placeholder="YYYY-MM-DD HH:MM:SS — converts as you type"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </Field>
    </div>
  );
}