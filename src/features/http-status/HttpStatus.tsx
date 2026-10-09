"use client";

import { useId, useMemo, useState } from "react";
import { Server, Search } from "lucide-react";
import {
  STATUS_CLASS_ORDER,
  queryStatuses,
  type StatusClassKey,
} from "./status-codes";

type Filter = StatusClassKey | "all";

export default function HttpStatus() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const searchId = useId();

  const { groups, total } = useMemo(() => queryStatuses(query, filter), [query, filter]);

  const chips: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    ...STATUS_CLASS_ORDER.map((key) => ({ value: key as Filter, label: key })),
  ];

  return (
    <div className="space-y-5 w-full">
      <div className="space-y-3">
        <div className="relative max-w-md">
          <label htmlFor={searchId} className="sr-only">
            Search HTTP status codes
          </label>
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id={searchId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, name or description…"
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div role="group" aria-label="Filter by status class" className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const active = filter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(chip.value)}
                className={`min-h-9 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  active
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <p className="sr-only" role="status">
          {total === 0 ? "No status codes match." : `${total} status code${total === 1 ? "" : "s"} shown.`}
        </p>
      </div>

      {groups.map(({ key, meta, items: cls }) => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-3 mt-4">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.text} border ${meta.border}`}>
              {key}
            </span>
            <p className="text-sm font-semibold text-slate-700">{meta.name}</p>
            <span className="text-xs text-slate-500">
              {cls.length} status{cls.length === 1 ? "" : "es"}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {cls.map((s) => (
              <div key={s.code} className="rounded-xl border border-slate-200 bg-white p-4 flex gap-3">
                <span
                  className="shrink-0 font-mono text-sm font-bold px-2.5 py-1 rounded-lg h-fit"
                  style={{ color: meta.color, background: `${meta.color}1a` }}
                >
                  {s.code}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {s.name}
                    {!s.official && (
                      <span className="ml-2 text-[11px] font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                        unofficial
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {total === 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 text-slate-600 px-4 py-6 text-sm text-center">
          <Server className="w-6 h-6 mx-auto mb-2 text-slate-400" aria-hidden="true" />
          No HTTP status codes match your search.
        </div>
      )}
    </div>
  );
}
