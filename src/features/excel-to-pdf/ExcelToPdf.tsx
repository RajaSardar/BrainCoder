"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { parseXlsx, type SheetData } from "@/lib/spreadsheet";
import { downloadBlob } from "@/lib/download";

const MAX_ROWS = 300;
const MAX_COLS = 20;

export default function ExcelToPdf() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [workbook, setWorkbook] = useState<SheetData[]>([]);
  const [active, setActive] = useState(0);
  const [pages, setPages] = useState(0);
  const [done, setDone] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setDone(false);
    setWorkbook([]);
    setName("");
    setPages(0);
    try {
      const data = await file.arrayBuffer();
      const sheets = await parseXlsx(data);
      if (sheets.length === 0) {
        setError("Could not read the workbook.");
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
  const rowsInView = sheet ? Math.min(sheet.rows.length, MAX_ROWS) : 0;

  const toPdf = async () => {
    if (!sheet) return;
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const table = document.createElement("table");
      const style = document.createElement("style");
      style.textContent = `
        .x2p-table { border-collapse: collapse; font-family: Arial, sans-serif; }
        .x2p-table td, .x2p-table th { border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 10px; color: #0f172a; }
        .x2p-table tr:first-child td { font-weight: bold; background: #eef2ff; }
      `;
      table.className = "x2p-table";
      const shown = sheet.rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS));
      const body = shown
        .map(
          (r) =>
            `<tr>${r
              .map((c) => `<td>${String(c).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      table.innerHTML = body;
      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.style.width = "1600px";
      holder.appendChild(style);
      holder.appendChild(table);
      document.body.appendChild(holder);

      try {
        const { default: html2canvas } = await import("html2canvas");
        const { PDFDocument, PageSizes } = await import("pdf-lib");
        const canvas = await html2canvas(table, {
          backgroundColor: "#ffffff",
          scale: 2,
          logging: false,
        });
        const doc = await PDFDocument.create();
        const [pwPt, phPt] = PageSizes.A4;
        const pxPerPt = canvas.width / pwPt;
        const pagePxH = Math.ceil(phPt * pxPerPt);

        let y = 0;
        while (y < canvas.height) {
          const sliceH = Math.min(pagePxH, canvas.height - y);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d");
          if (!ctx) break;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const png = slice.toDataURL("image/png");
          const img = await doc.embedPng(await (await fetch(png)).arrayBuffer());
          const page = doc.addPage([pwPt, phPt]);
          page.drawImage(img, { x: 0, y: 0, width: pwPt, height: phPt });
          y += sliceH;
        }
        setPages(doc.getPageCount());
        const bytes = await doc.save();
        downloadBlob(
          bytes,
          `${name?.replace(/\.xlsx?$/i, "") ?? "workbook"}-${sheet.name}.pdf`,
          "application/pdf",
        );
        setDone(true);
      } finally {
        holder.remove();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="e2p-file"
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
          onClick={() => document.getElementById("e2p-file")?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" />
          )}
          Open workbook
        </Button>
        {sheet && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void toPdf()}
          >
            Convert &quot;{sheet.name}&quot; to PDF
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && workbook.length === 0 && !done && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Turn an Excel sheet into a readable PDF. The selected sheet is
          rendered to print-ready paginated pages — entirely in your browser.
        </div>
      )}

      {sheet && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {workbook.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setActive(i);
                  setDone(false);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  i === active
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Converting the first {rowsInView} rows (up to {MAX_COLS} columns).
            The active sheet is printed.
          </p>
          {done && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">PDF saved</p>
                <p className="text-emerald-700">
                  {pages} page{pages === 1 ? "" : "s"} rendered from {sheet.name}.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}