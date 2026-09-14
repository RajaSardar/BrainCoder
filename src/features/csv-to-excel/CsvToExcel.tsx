"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { buildXlsx, parseCsv } from "@/lib/spreadsheet";
import { downloadBlob } from "@/lib/download";

interface CsvFile {
  name: string;
  rows: (string | number)[][];
}

export default function CsvToExcel() {
  const [files, setFiles] = useState<CsvFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const addFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setDone(false);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setError(`${file.name} is empty.`);
        return;
      }
      const numeric = rows.map((r) =>
        r.map((c) => {
          if (c === "") return c;
          const n = Number(c.replace(/[,€\$£]/g, ""));
          return c.trim() !== "" && !Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(c.trim()) ? n : c;
        }),
      );
      setFiles((prev) => [
        ...prev,
        {
          name: file.name.replace(/\.csv$/i, "") || `sheet${prev.length + 1}`,
          rows: numeric,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read CSV.");
    }
  };

  const convert = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const sheets = files.map((f) => ({ name: f.name, rows: f.rows }));
      const bytes = buildXlsx(sheets);
      const label = sheets.length === 1 ? sheets[0].name : "combined";
      downloadBlob(
        bytes,
        `${label}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build workbook.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="c2x-file"
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            list.forEach((f) => void addFile(f));
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => document.getElementById("c2x-file")?.click()}
        >
          <Plus className="w-4 h-4 mr-1.5 inline" /> Add CSV file(s)
        </Button>
        {files.length > 0 && (
          <Button type="button" variant="secondary" disabled={busy} onClick={convert}>
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" />
            )}
            Convert to .xlsx
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{f.name}</p>
                <p className="text-xs text-slate-500">
                  {f.rows.length.toLocaleString()} rows ×{" "}
                  {Math.max(...f.rows.map((r) => r.length), 0)} columns
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                disabled={busy}
                onClick={() => {
                  setFiles((prev) => prev.filter((_, j) => j !== i));
                  setDone(false);
                }}
                className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!busy && !error && files.length === 0 && !done && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Add one or more CSV files — each becomes a named sheet in a single
          Excel workbook. All in your browser, no uploads.
        </div>
      )}

      {done && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-medium">
          Workbook downloaded — {files.length} sheet{files.length === 1 ? "" : "s"} created.
        </div>
      )}
    </div>
  );
}