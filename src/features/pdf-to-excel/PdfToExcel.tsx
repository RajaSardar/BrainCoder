"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { zipSync, type Zippable } from "fflate";

const GAP_THRESHOLD = 24;

async function extractGrids(
  data: ArrayBuffer,
): Promise<{ page: number; rows: string[][] }[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const grids: { page: number; rows: string[][] }[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    type Item = {
      str?: string;
      transform?: number[];
      hasEOL?: boolean;
      width?: number;
    };
    const items = (content.items ?? []) as Item[];

    interface Word {
      x: number;
      y: number;
      w: number;
      text: string;
    }
    const words: Word[] = [];
    for (const it of items) {
      if (typeof it.str !== "string" || !it.str) continue;
      const t = it.transform ?? [];
      const x = t[4] ?? 0;
      const y = t[5] ?? 0;
      words.push({ x, y, w: it.width ?? 4, text: it.str });
    }
    if (words.length === 0) continue;

    words.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));

    const rows: Word[][] = [];
    let line: Word[] = [words[0]];
    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1];
      const cur = words[i];
      const sameLine = Math.abs(prev.y - cur.y) <= 2.5 && prev.x <= cur.x;
      if (sameLine) {
        line.push(cur);
      } else {
        rows.push(line);
        line = [cur];
      }
    }
    rows.push(line);

    const normRows: string[][] = rows.map((wordsInLine) => {
      const sorted = [...wordsInLine].sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let cur = sorted[0].text;
      let prevEnd = sorted[0].x + sorted[0].w;
      for (let i = 1; i < sorted.length; i++) {
        const w = sorted[i];
        if (w.x - prevEnd > GAP_THRESHOLD) {
          cells.push(cur.trim());
          cur = w.text;
        } else {
          cur += w.text;
        }
        prevEnd = Math.max(prevEnd, w.x + w.w);
      }
      cells.push(cur.trim());
      return cells;
    });

    grids.push({ page: p, rows: normRows });
  }
  return grids;
}

function colLetter(n: number): string {
  let s = "";
  let v = n;
  while (v >= 0) {
    s = String.fromCharCode(65 + (v % 26)) + s;
    v = Math.floor(v / 26) - 1;
  }
  return s;
}

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildXlsx(allRows: string[][]): Uint8Array {
  const sheetRows = allRows.length;
  const sheetCols = allRows.reduce((m, r) => Math.max(m, r.length), 0);
  const rowsXml = allRows
    .map((r, ri) => {
      const cells = r
        .map((c, ci) => {
          const ref = `${colLetter(ci)}${ri + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(c)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    "</Types>";

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>';

  const wbRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    "</Relationships>";

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac"><dimension ref="A1:${colLetter(Math.max(sheetCols, 1) - 1)}${Math.max(sheetRows, 1)}"/>` +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<sheetData>${rowsXml}</sheetData></worksheet>`;

  const parts: Zippable = {
    "[Content_Types].xml": new TextEncoder().encode(contentTypes),
    "_rels/.rels": new TextEncoder().encode(rels),
    "xl/workbook.xml": new TextEncoder().encode(workbook),
    "xl/_rels/workbook.xml.rels": new TextEncoder().encode(wbRels),
    "xl/worksheets/sheet1.xml": new TextEncoder().encode(sheet),
  };
  return zipSync(parts, { level: 6 });
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function PdfToExcel() {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setRows([]);
    try {
      const data = await file.arrayBuffer();
      const grids = await extractGrids(data);
      const all: string[][] = [];
      grids.forEach((g) => all.push(...g.rows));
      if (all.length === 0) {
        setError(
          "No text found. This PDF may be a scanned image — try the OCR PDF tool instead.",
        );
      } else {
        setRows(all);
        setName(file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const cellCount = rows.reduce((m, r) => m + r.length, 0);

  const downloadCsv = () => {
    if (!name) return;
    const text = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    downloadBlob(
      new TextEncoder().encode(text),
      `${name.replace(/\.pdf$/i, "")}.csv`,
      "text/csv",
    );
  };

  const downloadXlsx = () => {
    if (!name) return;
    downloadBlob(
      buildXlsx(rows),
      `${name.replace(/\.pdf$/i, "")}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  };

  return (
    <div className="space-y-5 w-full">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500">
          {name
            ? `${name} loaded`
            : "Convert the tables in a PDF to a spreadsheet."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <p className="text-sm text-slate-500">
            Extracted{" "}
            <span className="font-semibold text-slate-700">{rows.length}</span>{" "}
            text rows ({cellCount} cells). Review the preview, then download.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {r.map((c, j) => (
                      <td
                        key={j}
                        className="px-3 py-2 align-top border-r border-slate-50 min-w-24"
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={downloadXlsx}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5 inline" /> Download
              .xlsx
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={downloadCsv}
            >
              Download .csv
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
