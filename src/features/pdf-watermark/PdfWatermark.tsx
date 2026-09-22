"use client";

import { useRef, useState, useId } from "react";
import { Droplets, Loader2, FileText } from "lucide-react";
import { Button, SliderField } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const DEFAULT_TEXT = "CONFIDENTIAL";
const MAX_TEXT = 80;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const ASC = 0.72;
const DESC = 0.21;
const CENTER_OFFSET = (ASC - DESC) / 2;

interface WatermarkError {
  friendly: string;
}

function normalizeAngle(a: number): number {
  const m = ((a % 180) + 180) % 180;
  return m >= 90 ? m - 180 : m;
}

function friendlyError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : "";
  const raw = `${name} ${msg}`;
  if (raw.includes("is encrypted")) {
    return "That PDF is password-protected. Unlock it with PDF Unlock first, then load the unlocked file here.";
  }
  if (raw.includes("WinAnsi")) {
    return "Some characters in that watermark text can't be encoded in the built-in font. Use basic Latin letters, numbers and common punctuation (no emoji, symbols or non-Latin scripts).";
  }
  if (raw.includes("Failed to parse") || raw.includes("No PDF header")) {
    return "That file doesn't look like a valid PDF.";
  }
  return "Could not watermark that PDF. It may be corrupt or unsupported.";
}

function centerOrigin(
  halfWidth: number,
  underlineCenter: number,
  pageCenterX: number,
  pageCenterY: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const offsetX = cos * halfWidth - sin * underlineCenter;
  const offsetY = sin * halfWidth + cos * underlineCenter;
  return { x: pageCenterX - offsetX, y: pageCenterY - offsetY };
}

export default function PdfWatermark() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [size, setSize] = useState(48);
  const [opacity, setOpacity] = useState(25);
  const [angle, setAngle] = useState(-45);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<WatermarkError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);
  const textId = useId();

  const resetState = () => {
    setBytes(null);
    setName("");
    setBase("");
    setPageCount(0);
    setMessage("");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        resetState();
        setError({
          friendly:
            "That file is larger than 100 MB, which this tool doesn't support. Split it with PDF Split first.",
        });
        return;
      }
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const { PDFDocument } = await import("pdf-lib");
      const src = await PDFDocument.load(new Uint8Array(data));
      if (runId !== runIdRef.current) return;
      setBytes(new Uint8Array(data));
      setName(file.name);
      setBase(file.name.replace(/\.pdf$/i, ""));
      const count = src.getPageCount();
      setPageCount(count);
      setMessage(
        count === 1
          ? "Loaded 1 page. Set the text and look below."
          : `Loaded ${count} pages. The same watermark will be stamped on every page.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      resetState();
      setError({ friendly: friendlyError(err) });
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    void handleFile(file);
  };

  const stamp = async () => {
    const current = bytes;
    if (!current || busy) return;
    const label = text.trim() || DEFAULT_TEXT;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError(null);
    setMessage(`Watermarking ${pageCount} page${pageCount === 1 ? "" : "s"}…`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const { PDFDocument, StandardFonts, rgb, degrees } = await import(
        "pdf-lib"
      );
      const src = await PDFDocument.load(current);
      const stdFont = await src.embedFont(StandardFonts.HelveticaBold);
      const opacityClamped = Math.max(0.01, Math.min(1, opacity / 100));
      for (let i = 0; i < src.getPageCount(); i++) {
        if (runId !== runIdRef.current) return;
        const page = src.getPage(i);
        const { width, height } = page.getSize();
        const rot = normalizeAngle((page.getRotation().angle ?? 0) % 360);
        const effAngle = rotateForPage(angle, rot);
        const isQuarter = Math.abs(rot) === 90;
        const effW = isQuarter ? height : width;
        const measured = stdFont.widthOfTextAtSize(label, size);
        const fit = Math.min(1, (effW * 0.9) / Math.max(1, measured));
        const drawSize = size * fit;
        const textWidth = stdFont.widthOfTextAtSize(label, drawSize);
        const underlineCenter = CENTER_OFFSET * drawSize;
        const { x, y } = centerOrigin(
          textWidth / 2,
          underlineCenter,
          width / 2,
          height / 2,
          effAngle,
        );
        page.drawText(label, {
          x,
          y,
          size: drawSize,
          font: stdFont,
          color: rgb(0.3, 0.3, 0.3),
          opacity: opacityClamped,
          rotate: degrees(effAngle),
        });
        if (i % 25 === 24 && i + 1 < src.getPageCount()) {
          setMessage(`Watermarking… page ${i + 1} of ${src.getPageCount()}.`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      const out = await src.save(SAVE_OPTS);
      if (runId !== runIdRef.current) return;
      const filename = `${base}-watermarked.pdf`;
      downloadBlob(out, filename);
      setMessage(
        `Downloaded ${filename} — stamped “${label}” across ${src.getPageCount()} page${src.getPageCount() === 1 ? "" : "s"} at ${opacity}% opacity.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError({ friendly: friendlyError(err) });
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose a PDF to watermark"
        onChange={(e) => handlePicker(e.target.files?.[0] ?? undefined)}
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
            : "Open a PDF to stamp the same text watermark on every page. Nothing is uploaded."}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
        >
          {error.friendly}
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
              Watermark settings
            </legend>
            <div>
              <label
                htmlFor={textId}
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Watermark text
              </label>
              <input
                id={textId}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_TEXT}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder={DEFAULT_TEXT}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SliderField
                label="Font size"
                value={size}
                min={12}
                max={120}
                onChange={setSize}
                unit=" pt"
              />
              <SliderField
                label="Opacity"
                value={opacity}
                min={1}
                max={100}
                onChange={setOpacity}
                unit="%"
              />
              <SliderField
                label="Angle"
                value={angle}
                min={-90}
                max={90}
                onChange={setAngle}
                unit="°"
              />
            </div>
            <Button type="button" onClick={() => void stamp()}>
              <Droplets className="w-4 h-4 mr-1.5 inline" />
              {busy ? "Stamping…" : "Add watermark → download"}
            </Button>
          </fieldset>
          <p className="text-xs text-slate-500">
            Watermarks use a fixed bold Helvetica in dark grey, centered on
            every page at the size, opacity and angle you choose. The font
            covers Latin letters, numbers and common punctuation — up to{" "}
            {MAX_TEXT} characters, 12–120 pt.
          </p>
        </div>
      )}
    </div>
  );
}

function rotateForPage(userAngle: number, pageRotation: number): number {
  return normalizeAngle(userAngle - pageRotation);
}