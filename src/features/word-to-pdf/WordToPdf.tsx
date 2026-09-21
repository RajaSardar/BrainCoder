"use client";

import { useRef, useState } from "react";
import { Download, Loader2, FileType2 } from "lucide-react";
import { Button } from "@/components/ui";
import { docxToHtml } from "@/features/pdf-office/support";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_CANVAS_HEIGHT = 300_000;
const MAX_PAGES = 300;

function isLegacyDoc(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

function sanitizeMammothHtml(html: string): string {
  return html
    .replace(/\s(href|src)="(?:javascript|vbscript)\s*:[^"]*"/gi, ' $1=""')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

export default function WordToPdf() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState("document");
  const [html, setHtml] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const htmlRef = useRef("");
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setError("");
    if (file.size > MAX_FILE_BYTES) {
      setError("Documents larger than 25 MB aren't supported here.");
      return;
    }
    const looksDocx =
      /\.docx$/i.test(file.name) ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!looksDocx) {
      setError("Please choose a .docx file (an Office Open XML Word document); legacy .doc isn't supported — save it as .docx first.");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const data = await file.arrayBuffer();
      const bytes = new Uint8Array(data);
      if (isLegacyDoc(bytes)) {
        throw new Error("That's a legacy .doc file — save it as .docx (File → Save As) first. Only Office Open XML documents are supported.");
      }
      const value = await docxToHtml(data);
      if (!value.trim()) throw new Error("No content found in this .docx file.");
      const clean = sanitizeMammothHtml(value);
      if (runIdRef.current !== runId) return;
      htmlRef.current = clean;
      setHtml(clean);
      setBase(file.name.replace(/\.docx?$/i, ""));
      setPdfBytes(null);
      setReady(false);
      setParsed(true);
      setProgress(null);
      setBusy(false);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(err instanceof Error ? err.message : "Could not read that document.");
      setParsed(false);
      setProgress(null);
      setBusy(false);
    }
  };

  const convertToPdf = async () => {
    const htmlText = htmlRef.current;
    if (!htmlText) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setProgress({ done: 0, total: 1 });
    const holder = document.createElement("div");
    holder.className = "md-preview";
    holder.style.cssText =
      "position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;padding:48px 48px 0;box-sizing:border-box;font-size:16px;line-height:1.5;";
    holder.innerHTML = htmlText;
    document.body.appendChild(holder);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { PDFDocument, PageSizes } = await import("pdf-lib");
      const canvas = await html2canvas(holder, {
        backgroundColor: "#ffffff",
        scale: 1,
        useCORS: true,
        logging: false,
      });
      if (runIdRef.current !== runId) return;
      if (canvas.height > MAX_CANVAS_HEIGHT) {
        throw new Error("This document is too long to render here — split it into smaller files first.");
      }
      const doc = await PDFDocument.create();
      const [pwPt, phPt] = PageSizes.A4;
      const pxPerPt = canvas.width / pwPt;
      const pagePxH = Math.ceil(phPt * pxPerPt);
      const pagesTotal = Math.ceil(canvas.height / pagePxH);
      if (pagesTotal > MAX_PAGES) {
        throw new Error(`This document would create ${pagesTotal} pages (limit ${MAX_PAGES}) — split it into smaller files first.`);
      }
      let y = 0;
      let pageNo = 0;
      while (y < canvas.height) {
        if (runIdRef.current !== runId) return;
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
        const drawH = sliceH >= pagePxH ? phPt : phPt * (sliceH / pagePxH);
        page.drawImage(img, { x: 0, y: 0, width: pwPt, height: drawH });
        y += sliceH;
        pageNo += 1;
        setProgress({ done: pageNo, total: pagesTotal });
        await new Promise((r) => setTimeout(r, 0));
      }
      if (runIdRef.current !== runId) return;
      const bytes = await doc.save();
      if (runIdRef.current !== runId) return;
      setPageCount(doc.getPageCount());
      setPdfBytes(bytes);
      setReady(true);
      setProgress(null);
      setBusy(false);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(err instanceof Error ? err.message : "Failed to convert the document.");
      setProgress(null);
      setBusy(false);
    } finally {
      holder.remove();
    }
  };

  const downloadPdf = () => {
    if (!pdfBytes) return;
    downloadBlob(pdfBytes, `${base}.pdf`, "application/pdf");
  };

  const reset = () => {
    setParsed(false);
    setReady(false);
    setError("");
    setHtml("");
    setPdfBytes(null);
    htmlRef.current = "";
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };
  const interceptLinks = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest("a");
    if (el) e.preventDefault();
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <div className="flex flex-wrap items-end gap-4">
        <input
          ref={inputRef}
          id="docx-file"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          aria-label="Choose a .docx Word document"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          <FileType2 className="w-4 h-4 mr-1.5 inline" /> Choose Word document
        </Button>
        {ready && (
          <Button type="button" onClick={downloadPdf}>
            <Download className="w-4 h-4 mr-1.5 inline" /> Download PDF
          </Button>
        )}
        {parsed && !busy && !ready && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void convertToPdf()}>
            Convert to PDF
          </Button>
        )}
        {(parsed || ready) && !busy && (
          <Button type="button" variant="secondary" onClick={reset}>
            Start over
          </Button>
        )}
      </div>

      {busy && progress && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          {progress.total === 1 && progress.done === 0
            ? "Reading the document…"
            : `Rendering page ${progress.done} of ${progress.total}…`}
        </div>
      )}
      {ready && !busy && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          PDF ready — {pageCount} page{pageCount === 1 ? "" : "s"}, converted entirely in your browser. Download it above.
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {!parsed && !busy && !error && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a .docx Word document by clicking or dropping it here"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-600 cursor-pointer hover:border-slate-300 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <p className="font-medium text-slate-700 mb-1">Drag and drop a .docx here, or click to browse</p>
          <p>The document is rendered to pages in your browser — preview the parsed content, then convert and download the PDF. No uploads.</p>
        </div>
      )}

      {parsed && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500 mb-2">
            Parsed content — this is what gets rendered ({html.length.toLocaleString()} chars). The PDF is a visual snapshot, so the text inside it isn&apos;t selectable, and headers, footers and page numbers aren&apos;t carried over.
          </p>
          <div
            onClick={interceptLinks}
            className="md-preview max-h-64 overflow-auto p-2 rounded-lg bg-white text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}