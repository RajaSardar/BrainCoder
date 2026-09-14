"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { parseXlsx, type SheetData } from "@/lib/spreadsheet";
import { downloadBlob } from "@/lib/download";

export default function ExcelToJson() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [workbook, setWorkbook] = useState<SheetData[]>([]);
  const [name, setName] = useState("");
  const [headerRow, setHeaderRow] = useState(true);
  const [tab, setTab] = useState<"json" | "table">("json");

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

  function sheetToJson(s: SheetData): unknown[] {
    const rows = s.rows.filter((r) => r.some((c) => String(c).trim() !== ""));
    if (rows.length === 0) return [];
    if (!headerRow) {
      return rows.map((r) => r.map((c) => String(c)));
    }
    const headers = rows[0].map((h, i) => String(h).trim() || `col${i + 1}`);
    return rows.slice(1).map((r) => {
      const obj: Record<string, string | number> = {};
      headers.forEach((h, i) => {
        const v = (r[i] ?? "") as string | number;
        if (String(v).trim() !== "") obj[h] = v;
      });
      return obj;
    });
  }

  const built = workbook.map((s) => ({
    sheet: s.name,
    data: sheetToJson(s),
  }));

  const previewJson = JSON.stringify(built, null, 2);
  const activeSheet = workbook[0];

  const download = () => {
    downloadBlob(
      new TextEncoder().encode(previewJson),
      `${name?.replace(/\.xlsx?$/i, "") ?? "workbook"}.json`,
      "application/json",
    );
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="e2j-file"
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
          onClick={() => document.getElementById("e2j-file")?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" />
          )}
          Open workbook
        </Button>
        {workbook.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
              <input
                type="checkbox"
                checked={headerRow}
                onChange={(e) => setHeaderRow(e.target.checked)}
                className="accent-indigo-600"
              />
              First row is header
            </label>
            <Button type="button" variant="secondary" onClick={download}>
              Download .json
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && workbook.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Convert an Excel workbook to JSON. Each sheet becomes an object with
          its rows, using the first row as keys when enabled. No uploads.
        </div>
      )}

      {workbook.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm">
            {(["json", "table"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  tab === t
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "json" ? "JSON" : "Grid"}
              </button>
            ))}
          </div>
          {tab === "json" ? (
            <pre className="w-full h-96 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs leading-relaxed">
              {previewJson}
            </pre>
          ) : (
            activeSheet && (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-auto max-h-[28rem]">
                <table className="w-full text-sm text-left">
                  <tbody>
                    {activeSheet.rows.slice(0, 100).map((r, ri) => (
                      <tr key={ri} className="border-b border-slate-100">
                        {Array.from({ length: Math.max(r.length, 1) }).map(
                          (_, ci) => (
                            <td
                              key={ci}
                              className="px-3 py-1.5 align-top border-r border-slate-50 whitespace-pre"
                            >
                              {String(r[ci] ?? "")}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}