"use client";

import { useState } from "react";
import { Loader2, Plus, X, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui";
import { parseXlsx, buildXlsx, type SheetData } from "@/lib/spreadsheet";
import { downloadBlob } from "@/lib/download";

interface Loaded {
  original: string;
  sheets: SheetData[];
}

export default function ExcelMerge() {
  const [files, setFiles] = useState<Loaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const addFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setDone(false);
    try {
      const data = await file.arrayBuffer();
      const sheets = await parseXlsx(data);
      if (sheets.length === 0) {
        setError(`${file.name} could not be read.`);
        return;
      }
      setFiles((prev) => [
        ...prev,
        { original: file.name, sheets },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read workbook.");
    }
  };

  const merge = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const names = new Set<string>();
      const out: SheetData[] = files.flatMap((f) =>
        f.sheets.map((s) => {
          let name = s.name;
          let i = 1;
          while (names.has(name)) {
            name = `${s.name} (${i})`;
            i++;
          }
          names.add(name);
          return { name, rows: s.rows };
        }),
      );
      const bytes = buildXlsx(out);
      downloadBlob(
        bytes,
        "merged.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not merge workbooks.");
    } finally {
      setBusy(false);
    }
  };

  const totalSheets = files.reduce((m, f) => m + f.sheets.length, 0);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="xm-file"
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
          onClick={() => document.getElementById("xm-file")?.click()}
        >
          <Plus className="w-4 h-4 mr-1.5 inline" /> Add workbook(s)
        </Button>
        {files.length > 0 && (
          <Button type="button" variant="secondary" disabled={busy} onClick={merge}>
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" />
            )}
            Merge into one .xlsx
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
                <p className="font-semibold text-slate-800 truncate">{f.original}</p>
                <p className="text-xs text-slate-500">
                  {f.sheets.map((s) => s.name).join(", ") || f.sheets.length + " sheets"}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${f.original}`}
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
          Add two or more Excel workbooks and combine every sheet into one
          workbook. Duplicate sheet names get a suffix. No uploads.
        </div>
      )}

      {done && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-medium">
          merged.xlsx downloaded with {totalSheets} {totalSheets === 1 ? "sheet" : "sheets"}.
        </div>
      )}
    </div>
  );
}