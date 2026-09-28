"use client";

import { useId, useRef, useState } from "react";
import { FileUp, Loader2, Printer, RotateCcw } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  A4_HEIGHT,
  A4_WIDTH,
  MAX_INPUT_BYTES,
  MAX_PAGES,
  SAVE_OPTS,
  droppedSummary,
  firstPageText,
  layoutModel,
  parseHtmlToModel,
  pdfFileName,
  paintLayout,
  type SpanStyle,
} from "./html-converter";

const SAMPLE = `<h1>Invoice</h1>
<p>Order #1024 &middot; 12 Jun 2026</p>
<table>
  <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
  <tr><td>Developer tools subscription</td><td style="text-align:right">$29.00</td></tr>
  <tr><td>Hosting add-on</td><td style="text-align:right">$5.00</td></tr>
  <tr><td><b>Total</b></td><td style="text-align:right"><b>$34.00</b></td></tr>
</table>
<h2>Notes</h2>
<ul>
  <li>All amounts are shown in USD</li>
  <li>Payment due within 14 days</li>
</ul>
<p>Thanks for your business.<br>— The BrainCoder team</p>`;

const CAP_KB = Math.round(MAX_INPUT_BYTES / 1024);

interface Result {
  filename: string;
  pages: number;
  preview: string;
  droppedCount: number;
  replacedChars: number;
  truncated: boolean;
  bytes: Uint8Array;
}

function userFacing(message: string): Error {
  const err = new Error(message);
  (err as Error & { userFacing?: boolean }).userFacing = true;
  return err;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing) return err.message;
  return "Could not build that PDF. Try a smaller document, or reload the page and try again.";
}

export default function HtmlToPdf() {
  const [title, setTitle] = useState("Invoice");
  const [html, setHtml] = useState(SAMPLE);
  const [sourceName, setSourceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const runIdRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const titleId = useId();
  const htmlId = useId();
  const fileId = useId();

  const bytes = new TextEncoder().encode(html).length;
  const overCap = bytes > MAX_INPUT_BYTES;
  const empty = html.trim().length === 0;

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const run = ++runIdRef.current;
    setError("");
    setMessage("");
    setWarning("");
    try {
      if (file.size > MAX_INPUT_BYTES) {
        throw userFacing(
          `That file is ${Math.round(file.size / 1024)} KB, larger than the ${CAP_KB} KB limit. Trim the HTML or convert it in smaller pieces.`,
        );
      }
      const text = await file.text();
      if (run !== runIdRef.current) return;
      setHtml(text);
      setSourceName(file.name);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "));
      }
      setResult(null);
      setMessage(`Loaded ${file.name} (${Math.round(file.size / 1024)} KB). Nothing was uploaded.`);
    } catch (err) {
      if (run !== runIdRef.current) return;
      setError(toUiError(err));
    }
  };

  const onFilePick = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    void loadFile(file);
  };

  const convert = async () => {
    if (busy) return;
    const run = ++runIdRef.current;
    setError("");
    setMessage("");
    setWarning("");
    if (empty) {
      setError("Paste some HTML or open a .html file first — there is nothing to convert yet.");
      return;
    }
    if (overCap) {
      setError(
        `That HTML is ${Math.round(bytes / 1024)} KB, larger than the ${CAP_KB} KB limit this tool accepts. Trim it down or split it into smaller documents.`,
      );
      return;
    }
    setBusy(true);
    try {
      const model = parseHtmlToModel(html, { defaultTitle: title });
      if (model.blocks.length === 0 || model.stats.textChars === 0) {
        throw userFacing(
          "No text content was found in that HTML. The converter reads headings, paragraphs, lists, tables, quotes, code and rules — scripts, styles and images alone produce an empty document.",
        );
      }
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      if (run !== runIdRef.current) return;
      const doc = await PDFDocument.create();
      doc.setTitle(title.trim() || "HTML to PDF");
      doc.setProducer("BrainCoder — HTML to PDF");
      doc.setCreator("BrainCoder");
      doc.setCreationDate(new Date(0));
      doc.setModificationDate(new Date(0));

      const helvetica = await doc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const helveticaOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
      const courier = await doc.embedFont(StandardFonts.Courier);
      const fontMap = {
        regular: helvetica,
        bold: helveticaBold,
        italic: helveticaOblique,
        mono: courier,
      };

      const layout = layoutModel(model, {
        width: (text: string, style: SpanStyle, size: number) =>
          fontMap[style].widthOfTextAtSize(text, size),
      });
      if (run !== runIdRef.current) return;

      paintLayout(
        doc,
        layout.pages,
        fontMap,
        {
          text: rgb(0.07, 0.09, 0.16),
          muted: rgb(0.45, 0.5, 0.58),
          rule: rgb(0.82, 0.85, 0.9),
          band: rgb(0.94, 0.95, 0.97),
        },
        { pageWidth: A4_WIDTH, pageHeight: A4_HEIGHT },
      );

      const out = new Uint8Array(await doc.save(SAVE_OPTS));
      if (run !== runIdRef.current) return;
      const filename = pdfFileName(sourceName, title);
      downloadBlob(out, filename);
      setResult({
        filename,
        pages: layout.pages.length,
        preview: firstPageText(layout.pages),
        droppedCount: model.droppedCount,
        replacedChars: model.stats.replacedChars,
        truncated: layout.truncated,
        bytes: out,
      });
      setMessage(
        `Built ${layout.pages.length} page${layout.pages.length === 1 ? "" : "s"} of A4 text and downloaded ${filename}.`,
      );
      if (model.droppedCount > 0) {
        setWarning(
          `${droppedSummary(model.dropped)} Everything inside them was left out of the PDF — no scripts ran, and their text was not rendered.`,
        );
      }
      if (model.stats.replacedChars > 0) {
        setWarning((prev) =>
          `${prev ? `${prev} ` : ""}${model.stats.replacedChars} character${
            model.stats.replacedChars === 1 ? "" : "s"
          } outside the PDF standard font${model.stats.replacedChars === 1 ? " was" : "s were"} replaced with "?".`,
        );
      }
      if (layout.truncated) {
        setWarning((prev) =>
          `${prev ? `${prev} ` : ""}Output stopped at the ${MAX_PAGES}-page cap, so the rest of the document was not converted.`,
        );
      }
    } catch (err) {
      if (run !== runIdRef.current) return;
      setResult(null);
      setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) setBusy(false);
    }
  };

  const reset = () => {
    runIdRef.current++;
    setHtml(SAMPLE);
    setTitle("Invoice");
    setSourceName("");
    setResult(null);
    setError("");
    setMessage("");
    setWarning("");
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={fileRef}
        id={fileId}
        type="file"
        accept="text/html,.html,.htm"
        className="sr-only"
        aria-label="Open an HTML file to convert"
        onChange={(e) => void onFilePick(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? "Converting your HTML to PDF…" : ""}
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label htmlFor={titleId} className="block text-sm font-medium text-slate-700 mb-1.5">
            Document title
          </label>
          <input
            id={titleId}
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Invoice, report, spec…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label
            htmlFor={fileId}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 inline-flex items-center gap-2 cursor-pointer ${
              busy
                ? "opacity-60 pointer-events-none"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
            }`}
          >
            <FileUp className="w-4 h-4" aria-hidden="true" />
            Open .html file
          </label>
          <Button type="button" variant="secondary" disabled={busy} onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
            Reset to sample
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <label htmlFor={htmlId} className="block text-sm font-medium text-slate-700">
            HTML source
          </label>
          <p className="text-xs text-slate-600" role="status">
            {Math.round(bytes / 1024)} KB of {CAP_KB} KB
            {overCap ? " — over the limit" : ""}
            {sourceName ? ` · ${sourceName}` : ""}
          </p>
        </div>
        <StyledTextarea
          id={htmlId}
          rows={12}
          value={html}
          onChange={(e) => {
            setHtml(e.target.value);
            setResult(null);
          }}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void convert()} disabled={busy || empty}>
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
          ) : (
            <Printer className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          )}
          {busy ? "Converting…" : "Convert to PDF"}
        </Button>
        <p className="text-xs text-slate-600" role="status">
          {empty
            ? "Paste HTML or open a .html file to get started."
            : `Headings, paragraphs, lists, tables, quotes, code and rules are converted to A4 pages up to ${MAX_PAGES} pages. Your HTML is read as text — it is never rendered or executed in the page, and nothing is uploaded.`}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}
      {warning && (
        <div
          role="status"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm"
        >
          {warning}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
        >
          {message}
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-800" role="status">
              {result.pages} A4 page{result.pages === 1 ? "" : "s"} · {result.filename}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => downloadBlob(result.bytes, result.filename)}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
              Download again
            </Button>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              First page, as laid out in the PDF
            </p>
            <p className="mt-1.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap">
              {result.preview || "(no text on the first page)"}
            </p>
          </div>
          <p className="text-xs text-slate-600">
            The PDF holds real, selectable text in the standard PDF fonts — it is not a
            screenshot, so it can be searched, copied and read aloud. What it does not
            reproduce: CSS colours, fonts, borders, background images, floats, grids,
            flexbox, positioning, inline styling, and images (an <code>&lt;img&gt;</code>{" "}
            with alt text is replaced by an <code>[image omitted: …]</code> line). Script
            and style blocks are removed entirely, so the PDF never contains them.
            {result.droppedCount > 0
              ? ` ${result.droppedCount} unsupported element${
                  result.droppedCount === 1 ? " was" : "s were"
                } skipped in this run.`
              : ""}
          </p>
        </div>
      )}

      <p className="text-xs text-slate-600">
        A clean, text-based PDF built from your HTML — advanced CSS and layout are
        simplified, not reproduced pixel for pixel. Maximum input {CAP_KB} KB and{" "}
        {MAX_PAGES} pages per conversion, computed entirely in your browser.
      </p>
    </div>
  );
}
