"use client";

import { useCallback, useRef, useState } from "react";
import { Database, Table2, FileDown, Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import initSqlJs, { type Database as SqlDatabase } from "sql.js";

interface TableInfo {
  name: string;
  columns: string[];
  rows: unknown[][];
  count: number;
}

function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const arr = new Uint8Array(bytes);
  const blob = new Blob([arr], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SqliteViewer() {
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [active, setActive] = useState("");
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: unknown[][] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setQueryResult(null);
    try {
      const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
      const instance = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
      setDb(instance);
      setFileName(file.name.replace(/\.sqlite3?$/i, ".db"));
      const names = instance
        .exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values
        ?.map((r) => String(r[0])) ?? [];
      if (names.length === 0) {
        setMessage("No user tables found in this database.");
        setTables([]);
        setActive("");
        return;
      }
      const infos: TableInfo[] = [];
      for (const name of names) {
        const res = instance.exec(`SELECT * FROM "${name}" LIMIT 100`)[0];
        if (!res) {
          infos.push({ name, columns: [], rows: [], count: 0 });
          continue;
        }
        const count = Number(instance.exec(`SELECT COUNT(*) FROM "${name}"`)[0]?.values[0][0] ?? 0);
        infos.push({ name, columns: res.columns, rows: res.values, count });
      }
      setTables(infos);
      setActive(infos[0]?.name ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open SQLite file. Is it a valid .db file?");
      setDb(null);
    } finally {
      setBusy(false);
    }
  };

  const runQuery = useCallback(() => {
    if (!db) return;
    setError("");
    try {
      const res = db.exec(query.trim())[0];
      setQueryResult(res ? { columns: res.columns, rows: res.values } : { columns: [], rows: [] });
      setMessage(`Query executed (${res?.values.length ?? 0} rows).`);
    } catch (err) {
      setQueryResult(null);
      setError(err instanceof Error ? err.message : "Query failed");
    }
  }, [db, query]);

  const exportTable = () => {
    const info = tables.find((t) => t.name === active);
    if (!info) return;
    const csv = [
      info.columns.join(","),
      ...info.rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    downloadBytes(new TextEncoder().encode(csv), `${info.name}.csv`, "text/csv");
  };

  const activeTable = tables.find((t) => t.name === active);

  return (
    <div className="space-y-5 w-full">
      <input
        ref={inputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,.db3"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          {db ? "Open another .db" : "Open SQLite file"}
        </Button>
        {db && (
          <Button type="button" variant="secondary" onClick={() => { setDb(null); setTables([]); setQueryResult(null); setActive(""); }}>
            <RotateCcw className="w-4 h-4" /> Close
          </Button>
        )}
        <span className="text-sm text-slate-500">
          {db ? `${fileName} — ${tables.length} table${tables.length === 1 ? "" : "s"}` : "Fire-and-forget: the file is read in your browser only."}
        </span>
      </div>

      {error && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">{error}</div>}
      {message && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message}</div>}

      {db && (
        <div className="grid lg:grid-cols-[16rem_1fr] gap-5">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden self-start">
            <p className="px-4 py-2.5 text-xs font-medium text-slate-500 border-b border-slate-200 bg-slate-50">Tables</p>
            <ul className="max-h-[420px] overflow-auto">
              {tables.map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    onClick={() => { setActive(t.name); setQueryResult(null); setError(""); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition ${active === t.name ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700"}`}
                  >
                    <Table2 className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1">{t.name}</span>
                    <span className="text-xs text-slate-400">{t.count.toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 min-w-0">
            {activeTable && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-200 bg-slate-50">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-emerald-600" />
                    {activeTable.name}
                    <span className="text-xs font-normal text-slate-400">
                      {activeTable.count} rows · first {activeTable.rows.length} shown
                    </span>
                  </p>
                  <Button type="button" variant="secondary" onClick={exportTable}>
                    <FileDown className="w-4 h-4" /> Export CSV
                  </Button>
                </div>
                <div className="overflow-auto max-h-[360px]">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left sticky top-0">
                      <tr>
                        {activeTable.columns.map((c) => (
                          <th key={c} className="px-3 py-2 font-medium text-slate-600 whitespace-nowrap border-b border-slate-200">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTable.rows.map((r, ri) => (
                        <tr key={ri} className="odd:bg-slate-50/50">
                          {activeTable.columns.map((_, ci) => (
                            <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100 max-w-[240px] truncate">
                              {String(r[ci] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Run SQL</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runQuery(); }}
                  placeholder="e.g. SELECT * FROM users WHERE id > 10"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Button type="button" onClick={runQuery} disabled={!query.trim()}>
                  <Play className="w-4 h-4" /> Run
                </Button>
              </div>
              {queryResult && (
                <div className="overflow-auto mt-3 rounded-lg border border-slate-200 max-h-[240px]">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left sticky top-0">
                      <tr>
                        {queryResult.columns.map((c) => (
                          <th key={c} className="px-3 py-1.5 font-medium text-slate-600 whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((r, ri) => (
                        <tr key={ri} className="odd:bg-slate-50/50">
                          {queryResult.columns.map((_, ci) => (
                            <td key={ci} className="px-3 py-1 text-slate-700 whitespace-nowrap border-b border-slate-100">{String(r[ci] ?? "NULL")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}