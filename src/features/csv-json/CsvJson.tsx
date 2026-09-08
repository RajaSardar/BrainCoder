"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

function parseCsv(input: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      if (row.some((f) => f.trim() !== "") || rows.length === 0) rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // skip — paired with \n above
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function toCsv(rows: (string | number | boolean | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = cell === null ? "" : String(cell);
          if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    )
    .join("\r\n");
}

export default function CsvJson() {
  const [mode, setMode] = useState<"csv-to-json" | "json-to-csv">("csv-to-json");
  const [input, setInput] = useState("name,age,city\nAlex,29,Mumbai\nPriya,34,Pune\nRahul,41,Delhi");
  const [delim, setDelim] = useState(",");

  const result = useMemo(() => {
    try {
      if (mode === "csv-to-json") {
        const rows = parseCsv(input, delim);
        if (rows.length === 0) return { ok: true, value: "[]" };
        const headers = rows[0].map((h) => h.trim());
        const data = rows.slice(1).map((r) =>
          Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))
        );
        return { ok: true, value: JSON.stringify(data, null, 2) };
      }
      const parsed = JSON.parse(input);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
      let rows: (string | number | boolean | null)[][];
      if (parsed.length === 0) {
        rows = [];
      } else if (
        parsed.every(
          (item) => item !== null && typeof item === "object" && !Array.isArray(item)
        )
      ) {
        const keys = Array.from(
          new Set(parsed.flatMap((o: Record<string, unknown>) => Object.keys(o)))
        );
        rows = [keys, ...parsed.map((o: Record<string, unknown>) => keys.map((k) => (o[k] ?? "") as string | number | boolean | null))];
      } else {
        rows = parsed.map((item) => (Array.isArray(item) ? item : [item]) as (string | number | boolean | null)[]);
      }
      return { ok: true, value: toCsv(rows) };
    } catch (err) {
      return { ok: false, value: err instanceof Error ? err.message : "Conversion failed" };
    }
  }, [mode, input, delim]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["csv-to-json", "json-to-csv"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                mode === m ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4" />
                {m === "csv-to-json" ? "CSV → JSON" : "JSON → CSV"}
              </span>
            </button>
          ))}
        </div>
        {mode === "csv-to-json" && (
          <select
            value={delim}
            onChange={(e) => setDelim(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value=",">Comma</option>
            <option value=";">Semicolon</option>
            <option value="\t">Tab</option>
            <option value="|">Pipe</option>
          </select>
        )}
        <CopyButton text={result.value} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            {mode === "csv-to-json" ? "CSV " + (delim === "\t" ? "(tab)" : `(${delim} delimiter)`) : "JSON"}
          </p>
          <StyledTextarea rows={14} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            {mode === "csv-to-json" ? "JSON" : "CSV"}
          </p>
          <StyledTextarea rows={14} value={result.value} readOnly className="bg-slate-100" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Button type="button" variant="secondary" onClick={() => setInput("")}>
          Clear
        </Button>
        {!result.ok ? (
          <span className="flex items-center gap-1.5 text-red-600">
            <XCircle className="w-4 h-4" /> {result.value}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="w-4 h-4" /> Conversion ready
          </span>
        )}
        {mode === "csv-to-json" && (
          <span className="text-xs text-slate-400 ml-auto">Copies quoted values, keeps the header row as keys.</span>
        )}
      </div>
    </div>
  );
}