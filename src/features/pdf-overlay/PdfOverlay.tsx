"use client";

import { useRef, useState } from "react";
import {
  Loader2,
  FileText,
  Layers,
  Blend,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

type Position =
  | "stretch"
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const POSITIONS: { value: Position; label: string }[] = [
  { value: "stretch", label: "Stretch to full page" },
  { value: "center", label: "Center (fit)" },
  { value: "top-center", label: "Top center" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

export default function PdfOverlay() {
  const [baseName, setBaseName] = useState("");
  const [baseBase, setBaseBase] = useState("");
  const [baseBytes, setBaseBytes] = useState<Uint8Array | null>(null);
  const [basePages, setBasePages] = useState(0);
  const [ovName, setOvName] = useState("");
  const [ovBytes, setOvBytes] = useState<Uint8Array | null>(null);
  const [ovPages, setOvPages] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [position, setPosition] = useState<Position>("stretch");
  const [repeat, setRepeat] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const baseInputRef = useRef<HTMLInputElement>(null);
  const ovInputRef = useRef<HTMLInputElement>(null);

  const readPageCount = async (file: File, pdfjs: typeof import("pdfjs-dist")) => {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer.slice(0));
    const doc = await pdfjs.getDocument({ data }).promise;
    return doc.numPages;
  };

  const handleBase = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0));
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const count = await readPageCount(file, pdfjs);
      setBaseName(file.name);
      setBaseBase(file.name.replace(/\.pdf$/i, ""));
      setBaseBytes(bytes);
      setBasePages(count);
    } catch {
      setError("Could not read the base PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleOverlay = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0));
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const count = await readPageCount(file, pdfjs);
      setOvName(file.name);
      setOvBytes(bytes);
      setOvPages(count);
    } catch {
      setError("Could not read the overlay PDF.");
    } finally {
      setBusy(false);
    }
  };

  const overlay = async () => {
    if (!baseBytes || !ovBytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const base = await PDFDocument.load(baseBytes, { ignoreEncryption: true });
      const ov = await PDFDocument.load(ovBytes, { ignoreEncryption: true });
      const ovCount = ov.getPageCount();
      for (let i = 0; i < base.getPageCount(); i++) {
        const target = base.getPage(i);
        const tSize = target.getSize();
        const ovIndex = repeat ? i % ovCount : Math.min(i, ovCount - 1);
        const ovPage = ov.getPage(ovIndex);
        const oSize = ovPage.getSize();
        const embedded = await ov.embedPage(ovPage);

        let w: number;
        let h: number;
        let x: number;
        let y: number;
        if (position === "stretch") {
          w = tSize.width;
          h = tSize.height;
          x = 0;
          y = 0;
        } else {
          const s = Math.min(tSize.width / oSize.width, tSize.height / oSize.height);
          w = oSize.width * s;
          h = oSize.height * s;
          x = (tSize.width - w) / 2;
          y = (tSize.height - h) / 2;
          if (position.endsWith("-left")) x = 0;
          else if (position.endsWith("-right")) x = tSize.width - w;
          if (position.startsWith("top")) y = tSize.height - h;
          else if (position.startsWith("bottom")) y = 0;
        }
        target.drawPage(embedded, {
          x,
          y,
          width: w,
          height: h,
          opacity: opacity / 100,
        });
      }
      const saved = await base.save();
      downloadBlob(saved, `${baseBase}-overlaid.pdf`);
      const srcCount = basePages;
      const used = repeat ? srcCount : Math.min(srcCount, ovCount);
      setMessage(
        `Overlaid ${used} page${used === 1 ? "" : "s"} at ${opacity}% opacity.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Overlay failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <input
        ref={baseInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleBase(e.target.files?.[0] ?? undefined)}
      />
      <input
        ref={ovInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleOverlay(e.target.files?.[0] ?? undefined)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => baseInputRef.current?.click()}
          className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 text-left hover:border-indigo-400 transition"
        >
          <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">
              Base PDF
            </span>
            <span className="block text-xs text-slate-500 truncate">
              {baseName
                ? `${baseName} (${basePages} page${basePages === 1 ? "" : "s"})`
                : "Tap to choose the PDF that receives the overlay"}
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => ovInputRef.current?.click()}
          className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 text-left hover:border-indigo-400 transition"
        >
          <span className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">
              Overlay PDF
            </span>
            <span className="block text-xs text-slate-500 truncate">
              {ovName
                ? `${ovName} (${ovPages} page${ovPages === 1 ? "" : "s"})`
                : "Tap to choose the PDF stamped on top"}
            </span>
          </span>
        </button>
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

      {!baseBytes && !ovBytes && (
        <p className="text-sm text-slate-500">
          Stamp one PDF on top of another — great for watermarks, letterheads,
          signature pages, or template overlays. Runs entirely in your browser.
        </p>
      )}

      {(baseBytes || ovBytes) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Position
            </p>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPosition(p.value)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition ${
                    position === p.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Opacity
                </p>
                <p className="text-xs text-slate-500">{opacity}%</p>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                  className="accent-indigo-600"
                />
                Repeat overlay pages across the base document
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              disabled={busy || !baseBytes || !ovBytes}
              onClick={() => void overlay()}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
              ) : (
                <Blend className="w-4 h-4 mr-1.5 inline" />
              )}
              {busy ? "Overlaying…" : "Download overlaid PDF"}
            </Button>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Processed locally — files never leave your device.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}