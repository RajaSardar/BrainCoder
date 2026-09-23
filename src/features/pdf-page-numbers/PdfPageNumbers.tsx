"use client";

import { useId, useRef, useState } from "react";
import { Hash, Loader2, FileText } from "lucide-react";
import { Button, SliderField } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const MARGIN = 48;
const EDGE = 28;
const TOP_GAP = 40;

const POSITIONS = [
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "top-left", label: "Top left" },
] as const;

type PositionId = (typeof POSITIONS)[number]["id"];

function friendlyError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : "";
  const raw = `${name} ${msg}`;
  if (raw.includes("is encrypted") || /password/i.test(raw)) {
    return "That PDF is password-protected. Unlock it with PDF Unlock first, then load the unlocked file here.";
  }
  if (/Failed to parse|No PDF header|Invalid PDF structure/i.test(raw)) {
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  }
  return "Could not read that PDF. It may be corrupt or unsupported.";
}

function placement(
  rot: number,
  width: number,
  height: number,
  textWidth: number,
  id: PositionId,
): { x: number; y: number; rotate: number } {
  const quarter = rot === 90 || rot === 270;
  const Wv = quarter ? height : width;
  const Hv = quarter ? width : height;
  let vx: number;
  if (id.endsWith("-center")) vx = (Wv - textWidth) / 2;
  else if (id.endsWith("-right")) vx = Wv - textWidth - MARGIN;
  else vx = MARGIN;
  const vy = id.startsWith("top") ? Hv - TOP_GAP : EDGE;
  if (rot === 90) return { x: width - vy, y: vx, rotate: 90 };
  if (rot === 180) return { x: width - vx, y: height - vy, rotate: 180 };
  if (rot === 270) return { x: vy, y: height - vx, rotate: 270 };
  return { x: vx, y: vy, rotate: 0 };
}

export default function PdfPageNumbers() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [position, setPosition] = useState<PositionId>("bottom-center");
  const [size, setSize] = useState(11);
  const [withTotal, setWithTotal] = useState(true);
  const [startAt, setStartAt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);
  const startId = useId();

  const resetState = () => {
    setBytes(null);
    setName("");
    setPageCount(0);
    setMessage("");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        resetState();
        setError(
          "That file is larger than 100 MB, which this tool doesn't support. Split it with PDF Split first.",
        );
        return;
      }
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const { PDFDocument } = await import("pdf-lib");
      const src = await PDFDocument.load(new Uint8Array(data));
      if (runId !== runIdRef.current) return;
      if (src.getPageCount() > MAX_PAGES) {
        resetState();
        setError(
          "That document has more than 200 pages, which this tool handles at once. Split it with PDF Split first.",
        );
        return;
      }
      setName(file.name);
      setBytes(new Uint8Array(data));
      setPageCount(src.getPageCount());
      setMessage(
        src.getPageCount() === 1
          ? "Loaded 1 page."
          : `Loaded ${src.getPageCount()} pages.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      resetState();
      setError(friendlyError(err));
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    void handleFile(file);
  };

  const applyNumbers = async () => {
    const current = bytes;
    if (!current || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage(`Adding page numbers to all ${pageCount} page${pageCount === 1 ? "" : "s"}…`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const { PDFDocument, StandardFonts, rgb, degrees } = await import(
        "pdf-lib"
      );
      const src = await PDFDocument.load(current);
      const font = await src.embedFont(StandardFonts.Helvetica);
      const total = startAt + src.getPageCount() - 1;
      for (let i = 0; i < src.getPageCount(); i++) {
        if (runId !== runIdRef.current) return;
        const page = src.getPage(i);
        const { width, height } = page.getSize();
        const rot =
          ((page.getRotation().angle ?? 0) % 360 + 360) % 360;
        const n = startAt + i;
        const label = withTotal ? `${n} / ${total}` : `${n}`;
        const textWidth = font.widthOfTextAtSize(label, size);
        const { x, y, rotate } = placement(rot, width, height, textWidth, position);
        page.drawText(label, {
          x,
          y,
          size,
          font,
          color: rgb(0.2, 0.2, 0.2),
          rotate: degrees(rotate),
        });
        if (i % 25 === 24 && i + 1 < src.getPageCount()) {
          setMessage(`Adding page numbers… page ${i + 1} of ${src.getPageCount()}.`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      const out = await src.save(SAVE_OPTS);
      if (runId !== runIdRef.current) return;
      const filename = `${name.replace(/\.pdf$/i, "")}-numbered.pdf`;
      downloadBlob(out, filename);
      setMessage(
        `Downloaded ${filename}. Added page numbers to all ${src.getPageCount()} pages.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(friendlyError(err));
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const handleStartAt = (raw: string) => {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setStartAt(Math.min(9999, Math.max(0, Math.trunc(n))));
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose a PDF to add page numbers"
        onChange={(e) => void handlePicker(e.target.files?.[0] ?? undefined)}
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
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name} — ${pageCount} pages`
            : "Select a PDF to add page numbers. Processing is local — the file never leaves this device."}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
        >
          {error}
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

      {bytes && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            <legend className="text-sm font-medium text-slate-700">
              Numbering options
            </legend>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700 mb-2">
                Position
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {POSITIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={position === p.id}
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
            </fieldset>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <SliderField
                label="Font size"
                value={size}
                min={8}
                max={24}
                onChange={setSize}
                unit=" pts"
              />
              <div>
                <label
                  htmlFor={startId}
                  className="text-xs font-medium text-slate-500"
                >
                  Start numbering at
                </label>
                <input
                  id={startId}
                  type="number"
                  min={0}
                  max={9999}
                  value={startAt}
                  onChange={(e) => void handleStartAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  A number from 0 to 9999. Every page is still numbered — the
                  offset only changes what the labels read.
                </p>
              </div>
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
            <Button type="button" disabled={busy} onClick={() => void applyNumbers()}>
              <Hash className="w-4 h-4 mr-1.5 inline" />
              {busy ? "Numbering…" : "Add page numbers → download"}
            </Button>
            <p className="text-xs text-slate-500">
              Labels are drawn in fixed dark-grey Helvetica at the edges of
              every page, aligned with each page’s rotation. There is no
              preview — review the downloaded file to confirm placement.
            </p>
          </fieldset>
        </div>
      )}
    </div>
  );
}