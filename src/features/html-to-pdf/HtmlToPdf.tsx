"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";

const SAMPLE = `<div style="font-family: -apple-system, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 0; color: #0f172a; background: #ffffff;">
  <h1 style="font-size: 28px; margin: 0 0 8px; color: #0e7490;">Invoice</h1>
  <p style="margin: 0 0 20px; color: #475569; font-size: 14px;">Order #1024 · 12 Jun 2026</p>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr>
      <th style="text-align: left; padding: 8px; border-bottom: 2px solid #0e7490;">Item</th>
      <th style="text-align: right; padding: 8px; border-bottom: 2px solid #0e7490;">Amount</th>
    </tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Developer tools subscription</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">$29.00</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Hosting add-on</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">$5.00</td></tr>
    <tr>
      <td style="padding: 10px 8px; font-weight: 700;">Total</td>
      <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-size: 18px;">$34.00</td>
    </tr>
  </table>
  <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">Thank you! All amounts are shown in USD.</p>
</div>`;

export default function HtmlToPdf() {
  const [html, setHtml] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.srcdoc = `<html><head><style>html,body{margin:0;padding:0}</style></head><body>${html}</body></html>`;
  }, [html]);

  const buildPdf = async () => {
    if (!previewRef.current) return;
    setBusy(true);
    setError("");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { PDFDocument, PageSizes } = await import("pdf-lib");
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
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

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "document.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <StyledTextarea rows={10} value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs" />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={buildPdf} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" /> : <Printer className="w-4 h-4 mr-1.5 inline" />}
          {busy ? "Building…" : "Download PDF"}
        </Button>
        <p className="text-xs text-slate-400">Rendered at A4 size, auto-splits across pages.</p>
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}
      <iframe ref={frameRef} title="html source" className="hidden" />
      <div ref={previewRef} style={{ width: 620 }} className="mx-auto rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}