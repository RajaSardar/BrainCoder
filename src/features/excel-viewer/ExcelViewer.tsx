"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { parseXlsx, type SheetData } from "@/lib/spreadsheet";

export default function ExcelViewer() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [workbook, setWorkbook] = useState<SheetData[]>([]);
  const [name, setName] = useState("");
  const [active, setActive] = useState(0);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setWorkbook([]);
    setName("");
    try {
      const data = await file.arrayBuffer();
      const sheets = await parseXlsx(data);
      if (sheets.length === 0) {
        setError("Could not read the workbook. Make sure it is a valid .xlsx file.");
        return;
      }
      setWorkbook(sheets);
      setActive(0);
      setName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read workbook.");
    } finally {
      setBusy(false);
    }
  };

  const sheet = workbook[active];
  const preview = sheet?.rows.slice(0, 300) ?? [];

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="ev-file"
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => document.getElementById("ev-file")?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" />
          )}
          {name ? "Open another workbook" : "Open .xlsx"}
        </Button>
        {name && (
          <span className="text-sm text-slate-500">{name} loaded</span>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && workbook.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Open an Excel workbook to browse its sheets as a grid. Everything is
          parsed in your browser — no uploads.
        </div>
      )}

      {workbook.length > 0 && sheet && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {workbook.map((s, i) => {
              const total = s.rows.length;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    i === active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s.name}
                  <span className="ml-1.5 opacity-70">{total.toLocaleString()}</span>
                </button>
              );
            })}
          </div>

          {preview.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-auto max-h-[32rem]">
              <table className="w-full text-sm text-left">
                <tbody>
                  {preview.map((r, ri) => (
                    <tr key={ri} className="border-b border-slate-100">
                      {Array.from({ length: Math.max(r.length, 1) }).map(
                        (_, ci) => (
                          <td
                            key={ci}
                            className="px-3 py-1.5 align-top border-r border-slate-50 text-slate-700 whitespace-pre"
                          >
                            {ri === 0 ? (
                              <span className="font-semibold text-slate-900">
                                {r[ci] ?? ""}
                              </span>
                            ) : (
                              (r[ci] ?? "")
                            )}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">This sheet is empty.</p>
          )}
          <p className="text-xs text-slate-400">
            Showing up to 300 rows of {sheet.rows.length.toLocaleString()}.
          </p>
        </>
      )}
    </div>
  );
}