"use client";

import { useState } from "react";
import { Loader2, FileType2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { docxToHtml } from "@/features/pdf-office/support";

function downloadBlob(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WordToPdf() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState(0);
  const [html, setHtml] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const data = await file.arrayBuffer();
      const html = await docxToHtml(data);
      setHtml(html);

      const holder = document.createElement("div");
      holder.innerHTML = html;
      document.body.appendChild(holder);
      try {
        const { default: html2canvas } = await import("html2canvas");
        const { PDFDocument, PageSizes } = await import("pdf-lib");
        const canvas = await html2canvas(holder, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
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
          ctx.drawImage(
            canvas,
            0,
            y,
            canvas.width,
            sliceH,
            0,
            0,
            canvas.width,
            sliceH,
          );
          const png = slice.toDataURL("image/png");
          const img = await doc.embedPng(
            await (await fetch(png)).arrayBuffer(),
          );
          const page = doc.addPage([pwPt, phPt]);
          page.drawImage(img, { x: 0, y: 0, width: pwPt, height: phPt });
          y += sliceH;
        }
        setPages(doc.getPageCount());

        const bytes = await doc.save();
        const base = file.name.replace(/\.docx?$/i, "");
        downloadBlob(bytes, `${base}.pdf`, "application/pdf");
        setFileName(`${base}.pdf`);
        setDone(true);
      } finally {
        holder.remove();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to convert document",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="docx-file"
          type="file"
          accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          onClick={() => document.getElementById("docx-file")?.click()}
        >
          <FileType2 className="w-4 h-4 mr-1.5 inline" /> Choose Word document
        </Button>
        {done && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => document.getElementById("docx-file")?.click()}
          >
            Convert another
          </Button>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Converting to PDF…
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && !done && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Pick a .docx file and its content is rendered to a paginated PDF —
          tables and headings included. No uploads.
        </div>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">Saved {fileName}</p>
            <p className="text-emerald-700">
              {pages} page{pages === 1 ? "" : "s"} in your new PDF — converted
              entirely in your browser.
            </p>
          </div>
        </div>
      )}

      {html && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-400 mb-2">
            Extracted content preview ({html.length.toLocaleString()} chars)
          </p>
          <div
            className="max-h-64 overflow-auto text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}
