"use client";

import { useRef, useState } from "react";
import { Hash, Loader2, FileText } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const POSITIONS = [
  { id: "bottom-center", label: "Bottom center", y: 28 },
  { id: "bottom-right", label: "Bottom right", y: 28 },
  { id: "bottom-left", label: "Bottom left", y: 28 },
  { id: "top-center", label: "Top center", y: -1 },
  { id: "top-right", label: "Top right", y: -1 },
  { id: "top-left", label: "Top left", y: -1 },
] as const;

export default function PdfPageNumbers() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [position, setPosition] =
    useState<(typeof POSITIONS)[number]["id"]>("bottom-center");
  const [size, setSize] = useState(11);
  const [withTotal, setWithTotal] = useState(true);
  const [startAt, setStartAt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await file.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;
      setName(file.name);
      setBytes(new Uint8Array(data.slice(0)));
      setPageCount(doc.numPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read PDF.");
    } finally {
      setBusy(false);
    }
  };

  const applyNumbers = async () => {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await src.embedFont(StandardFonts.Helvetica);
      const pos = POSITIONS.find((p) => p.id === position)!;
      for (let i = 0; i < src.getPageCount(); i++) {
        const page = src.getPage(i);
        const { width, height } = page.getSize();
        const n = startAt + i;
        const label = withTotal
          ? `${n} / ${startAt + src.getPageCount() - 1}`
          : `${n}`;
        const textWidth = font.widthOfTextAtSize(label, size);
        let x: number;
        if (pos.id === "bottom-center" || pos.id === "top-center")
          x = (width - textWidth) / 2;
        else if (pos.id.endsWith("-right")) x = width - textWidth - 48;
        else x = 48;
        const y = pos.id.startsWith("top") ? height - 40 : 28;
        page.drawText(label, {
          x,
          y,
          size,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
      const out = await src.save();
      downloadBlob(out, `${name.replace(/\.pdf$/i, "")}-numbered.pdf`);
      setMessage(`Added page numbers to all ${src.getPageCount()} pages.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Numbering failed");
    } finally {
      setBusy(false);
    }
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
            ? `${name} — ${pageCount} pages`
            : "Select a PDF to add page numbers."}
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

      {bytes && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
          <Field label="Position">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPosition(p.id)}
                  className={`rounded-xl border-2 px-3 py-2 text-sm text-left transition ${
                    position === p.id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <Field label={`Font size — ${size} pt`}>
              <input
                type="range"
                min={8}
                max={24}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </Field>
            <Field label="Start numbering at">
              <input
                type="number"
                min={0}
                max={9999}
                value={startAt}
                onChange={(e) => setStartAt(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
              <input
                type="checkbox"
                checked={withTotal}
                onChange={(e) => setWithTotal(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              Show “n / total”
            </label>
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void applyNumbers()}
          >
            <Hash className="w-4 h-4 mr-1.5 inline" />
            {busy ? "Numbering…" : "Add page numbers → download"}
          </Button>
        </div>
      )}
    </div>
  );
}
