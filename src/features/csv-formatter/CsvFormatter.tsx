"use client";

import { useMemo, useState } from "react";
import { Table2, FileDown } from "lucide-react";
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

function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: [string, number][] = [
    [",", (header.match(/,/g) ?? []).length],
    [";", (header.match(/;/g) ?? []).length],
    ["\t", (header.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

const SAMPLE = `Name,Role,Team,Location
Ada Lovelace,Analyst,Data,"Austin, TX"
Grace Hopper,Engineer,Platform,New York
Alan Turing,Cryptanalyst,Research,London
Edsger Dijkstra,Professor,CS,Amsterdam`;

export default function CsvFormatter() {
  const [input, setInput] = useState(SAMPLE);

  const { rows, delimiter } = useMemo(() => {
    const delim = detectDelimiter(input);
    const parsed = parseCsv(input, delim);
    return { rows: parsed, delimiter: delim === "\t" ? "\\t" : delim };
  }, [input]);

  const normalized = useMemo(
    () => rows.map((r) => r.map((c) => c.trim()).join(",")).join("\n"),
    [rows]
  );

  const download = () => {
    const blob = new Blob([normalized], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "formatted.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Table2 className="w-4 h-4 text-emerald-600" />
          {rows.length} rows &times; {header.length} columns
        </span>
        {delimiter !== "," && (
          <span className="text-xs rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1">
            Detected delimiter: {delimiter}
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">CSV input</p>
          <StyledTextarea rows={14} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Normalized table</p>
            <div className="flex gap-2">
              <CopyButton text={normalized} />
              <Button type="button" variant="secondary" onClick={download}>
                <FileDown className="w-4 h-4" /> .csv
              </Button>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No rows yet.</div>
          ) : (
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="bg-emerald-50 text-left sticky top-0">
                  <tr>
                    {header.map((h, i) => (
                      <th key={i} className="px-3 py-2 font-medium text-emerald-700 whitespace-nowrap border-b border-emerald-100">
                        {h.trim() || `col${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r, ri) => (
                    <tr key={ri} className="odd:bg-slate-50/50">
                      {header.map((_, ci) => (
                        <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100 max-w-[260px] truncate">
                          {r[ci] ?? ""}
                        </td>
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
  );
}