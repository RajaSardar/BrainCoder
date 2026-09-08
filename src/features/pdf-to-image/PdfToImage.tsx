"use client";

import { useState } from "react";
import { Download, Loader2, FileDigit } from "lucide-react";
import { Button, Field } from "@/components/ui";

interface PageImage {
  page: number;
  url: string;
  width: number;
  height: number;
}

function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export default function PdfToImage() {
  const [pages, setPages] = useState<PageImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [fileName, setFileName] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setPages([]);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const arr: PageImage[] = [];
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvas, viewport }).promise;
        arr.push({
          page: pageNum,
          url: canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 0.92),
          width: canvas.width,
          height: canvas.height,
        });
      }
      setPages(arr);
      setFileName(file.name.replace(/\.pdf$/i, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render PDF");
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = () => {
    pages.forEach((p) =>
      downloadDataUrl(p.url, `${fileName || "page"}-${p.page}.${format === "png" ? "png" : "jpg"}`)
    );
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="pdf-file"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" onClick={() => document.getElementById("pdf-file")?.click()}>
          <FileDigit className="w-4 h-4 mr-1.5 inline" /> Choose PDF
        </Button>
        <Field label={`Quality scale: ${scale}x`}>
          <input
            type="range"
            min={1}
            max={4}
            step={0.5}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-40 accent-rose-600"
          />
        </Field>
        <Field label="Format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "png" | "jpeg")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </Field>
        {pages.length > 0 && (
          <Button type="button" variant="secondary" onClick={downloadAll}>
            <Download className="w-4 h-4 mr-1.5 inline" /> Download all
          </Button>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Rendering pages…
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {pages.length === 0 && !busy && !error && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Pick a PDF and every page is rendered to a PNG or JPEG image. 100% client-side.
        </div>
      )}

      {pages.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((p) => (
            <div key={p.page} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="rounded-lg bg-slate-100 flex items-center justify-center mb-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Page ${p.page}`} className="max-h-56 w-auto" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Page {p.page} · {p.width}×{p.height}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    downloadDataUrl(
                      p.url,
                      `${fileName || "page"}-${p.page}.${format === "png" ? "png" : "jpg"}`
                    )
                  }
                >
                  <Download className="w-3.5 h-3.5 mr-1 inline" /> Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}