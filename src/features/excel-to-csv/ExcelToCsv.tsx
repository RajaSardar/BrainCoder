"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { parseXlsx, toCsv, type SheetData } from "@/lib/spreadsheet";
import { downloadBlob } from "@/lib/download";

export default function ExcelToCsv() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [workbook, setWorkbook] = useState<SheetData[]>([]);
  const [name, setName] = useState("");

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
        setError("Could not read the workbook.");
        return;
      }
      setWorkbook(sheets);
      setName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read workbook.");
    } finally {
      setBusy(false);
    }
  };

  const base = name?.replace(/\.xlsx?$/i, "") ?? "workbook";
  const download = (sheet: SheetData) => {
    const csv = toCsv(sheet.rows);
    downloadBlob(new TextEncoder().encode(csv), `${base}-${sheet.name}.csv`, "text/csv");
  };
  const downloadAll = () => {
    workbook.forEach((s) => download(s));
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="e2c-file"
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
          onClick={() => document.getElementById("e2c-file")?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" />
          )}
          Open workbook
        </Button>
        {workbook.length > 0 && (
          <Button type="button" variant="secondary" onClick={downloadAll}>
            Download all sheets (.csv)
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && workbook.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Open an Excel workbook and each sheet becomes a downloadable CSV.
          Values keep their formatting — no uploads.
        </div>
      )}

      {workbook.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {workbook.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.rows.length.toLocaleString()} rows
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => download(s)}>
                Download .csv
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}