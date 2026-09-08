"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, XCircle } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function esc(v: string): string {
  return v.replace(/'/g, "''");
}

function csvToSql(csv: string, table: string, batch: boolean): string {
  const rows = parseCsv(csv, ",");
  if (rows.length === 0) return "-- empty input";
  const header = rows[0].map((h) => h.trim() || "col");
  const body = rows.slice(1);
  const create = `CREATE TABLE ${table} (\n  ${header.map((h) => `  ${h} TEXT`).join(",\n")}\n);`;
  const values = body.map(
    (r) => `  (${header.map((_, i) => `'${esc(r[i] ?? "")}'`).join(", ")})`
  );
  if (values.length === 0) return `${create}\n\n-- no data rows`;
  const columns = `(${header.join(", ")})`;
  if (batch) {
    return `${create}\n\nINSERT INTO ${table} ${columns}\nVALUES\n${values.join(",\n")};`;
  }
  return `${create}\n\n${values.map((v) => `INSERT INTO ${table} ${columns}\nVALUES ${v};`).join("\n")}`;
}

function splitTuple(tuple: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let quotes = false;
  for (let i = 0; i < tuple.length; i++) {
    const c = tuple[i];
    if (quotes) {
      if (c === "'") {
        if (tuple[i + 1] === "'") {
          cur += "'";
          i++;
        } else quotes = false;
      } else cur += c;
    } else if (c === "'") {
      quotes = true;
    } else if (c === ",") {
      parts.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  parts.push(cur.trim());
  return parts.map((p) => {
    if (p.startsWith("'") && p.endsWith("'")) return p.slice(1, -1).replace(/''/g, "'");
    return p === "NULL" ? "" : p;
  });
}

function sqlToCsv(sql: string): string {
  const m = sql.match(/INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]*)\)/i);
  if (!m) return "-- no INSERT INTO ... (...) found";
  const header = m[2].split(",").map((h) => h.trim()).filter(Boolean);
  const rows: string[][] = [];
  const re = /VALUES\s*(\([^)]*\))(?:\s*,|\s*;)?/gi;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(sql)) !== null) {
    rows.push(splitTuple(mm[1]));
  }
  const toCsv = (row: string[]) => row.map((v) => (/([",\n\r])/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",");
  return [header.join(","), ...rows.map(toCsv)].join("\n");
}

const CSV_SAMPLE = `name,age,email
Alice,30,alice@example.com
Bob,25,"bob, the builder <bob@example.com>"
Carol,35,carol@example.com`;

const SQL_SAMPLE = `CREATE TABLE people (name TEXT, age TEXT, email TEXT);
INSERT INTO people (name, age, email) VALUES ('Alice', '30', 'alice@example.com');
INSERT INTO people (name, age, email) VALUES ('Bob', '25', 'bob@example.com');
INSERT INTO people (name, age, email) VALUES ('Carol', '35', 'carol@example.com');`;

export default function CsvToSql() {
  const [mode, setMode] = useState<"csv" | "sql">("csv");
  const [input, setInput] = useState(CSV_SAMPLE);
  const [table, setTable] = useState("my_table");
  const [batch, setBatch] = useState(true);

  const result = useMemo(() => {
    try {
      const value = mode === "csv" ? csvToSql(input, table.trim() || "my_table", batch) : sqlToCsv(input);
      return { ok: true, value };
    } catch (err) {
      return { ok: false, value: err instanceof Error ? err.message : "Conversion failed" };
    }
  }, [mode, input, table, batch]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => { setMode("csv"); setInput(CSV_SAMPLE); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition ${mode === "csv" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
          >
            CSV → SQL
          </button>
          <button
            type="button"
            onClick={() => { setMode("sql"); setInput(SQL_SAMPLE); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition ${mode === "sql" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
          >
            SQL → CSV
          </button>
        </div>
        <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
        {mode === "csv" && (
          <>
            <label className="text-sm">
              <span className="block text-xs font-medium text-slate-500 mb-1">Table name</span>
              <input
                type="text"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="flex items-center gap-2 pt-5 text-sm text-slate-600">
              <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
              Single multi-row INSERT
            </label>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">{mode === "csv" ? "CSV" : "SQL"}</p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              {mode === "csv" ? "SQL output" : "CSV output"}
              {result.ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            </p>
            {result.ok && <CopyButton text={result.value} />}
          </div>
          <StyledTextarea rows={16} value={result.value} readOnly className="bg-slate-100 font-mono text-xs" />
          {!result.ok && <p className="text-xs text-red-600 mt-2">{result.value}</p>}
        </div>
      </div>

      <Button type="button" variant="secondary" onClick={() => setInput("")}>Clear</Button>
    </div>
  );
}