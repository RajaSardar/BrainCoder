"use client";

import { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";
import { Field, Button, CopyButton } from "@/components/ui";

const MAX_DATE_MS = 8.64e15;

const DT_RE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;

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

function parseDateTimeLocal(val: string): number | null {
  const m = DT_RE.exec(val.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = m[4] ? Number(m[4]) : 0;
  const mm = m[5] ? Number(m[5]) : 0;
  const ss = m[6] ? Number(m[6]) : 0;
  if (
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31 ||
    hh > 23 ||
    mm > 59 ||
    ss > 59
  ) {
    return null;
  }
  const dt = new Date(0);
  dt.setFullYear(y, mo - 1, d);
  dt.setHours(hh, mm, ss, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt.getTime();
}

function tzOffsetLabel(ts: number, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(new Date(ts));
    const v = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return v.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

export default function TimestampConverter() {
  const [input, setInput] = useState("");
  const [isMs, setIsMs] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [dateError, setDateError] = useState("");
  const [nowSec, setNowSec] = useState(0);
  const [tzName, setTzName] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    const bootId = setTimeout(() => {
      const s = Math.floor(Date.now() / 1000);
      setInput((prev) => (prev === "" ? String(s) : prev));
      setDateDraft((prev) => (prev === "" ? formatLocal(s * 1000) : prev));
      setNowSec(s);
    }, 0);
    const tzId = setTimeout(() => {
      try {
        setTzName(Intl.DateTimeFormat().resolvedOptions().timeZone);
      } catch {
        setTzName("");
      }
    }, 0);
    return () => {
      clearInterval(id);
      clearTimeout(bootId);
      clearTimeout(tzId);
    };
  }, []);

  const inputTrim = input.trim();
  const numericOk = /^-?\d+(\.\d+)?$/.test(inputTrim);
  const n = numericOk ? Number(inputTrim) : NaN;
  const detectedMs = numericOk && n >= 1e12;
  const effectiveMs = isMs || detectedMs;

  const ts = useMemo(() => {
    if (inputTrim === "" || !numericOk) return null;
    const ms = effectiveMs ? n : n * 1000;
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) return null;
    return ms;
  }, [inputTrim, numericOk, n, effectiveMs]);

  const tsInvalid = inputTrim !== "" && ts === null;

  const setNow = () => {
    const s = Math.floor(Date.now() / 1000);
    setInput(String(s));
    setIsMs(false);
    setDateDraft(formatLocal(s * 1000));
    setDateError("");
  };

  const onMsToggle = (checked: boolean) => {
    setIsMs(checked);
    if (numericOk) {
      const ms = checked ? n : n * 1000;
      if (Number.isFinite(ms) && Math.abs(ms) <= MAX_DATE_MS) {
        setDateDraft(formatLocal(ms));
      }
    }
  };

  const onDateChange = (val: string) => {
    setDateDraft(val);
    if (val.trim() === "") {
      setDateError("");
      return;
    }
    const ms = parseDateTimeLocal(val);
    if (ms !== null) {
      setInput(String(Math.floor(ms / 1000)));
      setIsMs(false);
      setDateError("");
    } else {
      setDateError("Enter a complete local date and time, e.g. 2024-01-05 14:30:00");
    }
  };

  const onDateBlur = () => {
    if (dateError !== "" || ts === null) return;
    setDateDraft(formatLocal(ts));
  };

  const cards =
    ts === null
      ? []
      : [
          {
            label: "Local time",
            sub: tzName ? `${tzName} · ${tzOffsetLabel(ts, tzName)}` : "",
            value: formatLocal(ts),
          },
          { label: "UTC time", sub: "", value: formatUTC(ts) },
          { label: "ISO 8601", sub: "", value: new Date(ts).toISOString() },
          { label: "HTTP date", sub: "RFC 2822", value: new Date(ts).toUTCString() },
        ];

  return (
    <div className="space-y-6 w-full">
      <div className="grid gap-3">
        <Field label="Unix timestamp">
          <div className="flex flex-wrap gap-2 items-stretch">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              inputMode="numeric"
              aria-label="Unix timestamp value"
              aria-invalid={tsInvalid}
              aria-describedby={tsInvalid ? "ts-error" : undefined}
              placeholder="e.g. 1725000000000"
              className="flex-1 min-w-[180px] rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              style={{ borderColor: tsInvalid ? "#dc2626" : undefined }}
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 whitespace-nowrap">
              <input
                type="checkbox"
                checked={isMs}
                onChange={(e) => onMsToggle(e.target.checked)}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              milliseconds
            </label>
          </div>
          {tsInvalid && (
            <p
              id="ts-error"
              role="alert"
              className="text-xs text-red-600 mt-2 font-medium"
            >
              Not a valid timestamp — enter integer seconds (10 digits) or
              milliseconds (13 digits) within the representable date range.
            </p>
          )}
          {detectedMs && !isMs && (
            <p
              role="status"
              className="text-xs text-slate-500 mt-2 font-medium"
            >
              13-digit value detected — treated as milliseconds.
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={setNow}
            >
              <Timer className="w-4 h-4 mr-1.5 inline" /> Now
            </Button>
            {nowSec > 0 && (
              <p className="text-xs text-slate-500 font-mono" aria-hidden="true">
                Current Unix time: {nowSec}
              </p>
            )}
          </div>
        </Field>

        {cards.length > 0 && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map((row) => (
              <div key={row.label} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs text-slate-500 mb-1">
                  {row.label}
                  {row.sub && <span className="block text-[11px] text-slate-400 mt-0.5">{row.sub}</span>}
                </p>
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
          value={dateDraft}
          onChange={(e) => onDateChange(e.target.value)}
          onBlur={onDateBlur}
          spellCheck={false}
          autoComplete="off"
          aria-label="Date and time in local timezone"
          aria-invalid={dateError !== ""}
          aria-describedby={dateError !== "" ? "date-error" : undefined}
          placeholder="YYYY-MM-DD HH:MM:SS — converts as you type"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          style={{ borderColor: dateError !== "" ? "#dc2626" : undefined }}
        />
        {dateError !== "" && (
          <p id="date-error" role="alert" className="text-xs text-red-600 mt-2 font-medium">
            {dateError}
          </p>
        )}
      </Field>
    </div>
  );
}