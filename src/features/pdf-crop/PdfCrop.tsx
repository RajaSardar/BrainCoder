"use client";

import { useRef, useState } from "react";
import { Crop as CropIcon, Loader2, FileText } from "lucide-react";
import { Button, SliderField } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const MAX_CROP = 45;

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

// User margins L/R/T/B are percentages of the DISPLAYED page. Each /Rotate
// maps a displayed edge to a different MediaBox edge, so the crop rectangle is
// computed per page and written back into unrotated page space as a CropBox.
function cropBoxFor(
  page: {
    getRotation: () => { angle: number };
    getMediaBox: () => { x: number; y: number; width: number; height: number };
  },
  insets: { top: number; right: number; bottom: number; left: number },
): { x: number; y: number; width: number; height: number } {
  const rot = (((page.getRotation().angle ?? 0) % 360) + 360) % 360;
  const { x: x0, y: y0, width: W, height: H } = page.getMediaBox();
  const quarter = rot === 90 || rot === 270;
  const Wv = quarter ? H : W;
  const Hv = quarter ? W : H;
  const dl = (Wv * insets.left) / 100;
  const dr = (Wv * insets.right) / 100;
  const dt = (Hv * insets.top) / 100;
  const db = (Hv * insets.bottom) / 100;
  let X0: number, Y0: number, X1: number, Y1: number;
  if (rot === 90) {
    X0 = x0 + dt; Y0 = y0 + dl; X1 = x0 + W - db; Y1 = y0 + H - dr;
  } else if (rot === 180) {
    X0 = x0 + dr; Y0 = y0 + dt; X1 = x0 + W - dl; Y1 = y0 + H - db;
  } else if (rot === 270) {
    X0 = x0 + db; Y0 = y0 + dr; X1 = x0 + W - dt; Y1 = y0 + H - dl;
  } else {
    X0 = x0 + dl; Y0 = y0 + db; X1 = x0 + W - dr; Y1 = y0 + H - dt;
  }
  return { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 };
}

export default function PdfCrop() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [ratio, setRatio] = useState(0.75);
  const [top, setTop] = useState(0);
  const [right, setRight] = useState(0);
  const [bottom, setBottom] = useState(0);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);

  const zeroCrop = top + right + bottom + left === 0;

  const resetState = () => {
    setBytes(null);
    setName("");
    setPageCount(0);
    setPreviewUrl("");
    setPreviewFailed(false);
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
      const count = src.getPageCount();
      if (count > MAX_PAGES) {
        resetState();
        setError(
          "That document has more than 200 pages, which this tool handles at once. Split it with PDF Split first.",
        );
        return;
      }
      const media = src.getPage(0).getMediaBox();
      const rot = (((src.getPage(0).getRotation().angle ?? 0) % 360) + 360) % 360;
      const quarter = rot === 90 || rot === 270;
      const Wv = quarter ? media.height : media.width;
      const Hv = quarter ? media.width : media.height;
      setRatio(Hv / Wv);
      setName(file.name);
      setBytes(new Uint8Array(data));
      setPageCount(count);
      setMessage(
        count === 1 ? "Loaded 1 page." : `Loaded ${count} pages.`,
      );
      void renderPreview(data, runId);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      resetState();
      setError(friendlyError(err));
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const renderPreview = async (data: ArrayBuffer, runId: number) => {
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const loadingTask = pdfjs.getDocument({ data: data.slice(0) });
      try {
        const doc = await loadingTask.promise;
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not render the preview in this browser.");
        await page.render({ canvas, viewport: vp }).promise;
        if (runId !== runIdRef.current) return;
        const url = await new Promise<string | null>((resolve) =>
          canvas.toBlob((blob) =>
            resolve(blob ? URL.createObjectURL(blob) : null),
            "image/webp",
            0.85,
          ),
        );
        if (runId !== runIdRef.current) return;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url ?? "";
        });
        setPreviewFailed(url === null);
      } finally {
        void loadingTask.destroy();
      }
    } catch {
      if (runId === runIdRef.current) setPreviewFailed(true);
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    void handleFile(file);
  };

  const applyCrop = async () => {
    const current = bytes;
    if (!current || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage(`Cropping all ${pageCount} page${pageCount === 1 ? "" : "s"}…`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const { PDFDocument } = await import("pdf-lib");
      const src = await PDFDocument.load(current);
      const insets = { top, right, bottom, left };
      for (let i = 0; i < src.getPageCount(); i++) {
        if (runId !== runIdRef.current) return;
        const page = src.getPage(i);
        const box = cropBoxFor(page, insets);
        page.setCropBox(box.x, box.y, box.width, box.height);
        if (page.getTrimBox()) page.setTrimBox(box.x, box.y, box.width, box.height);
        if (page.getBleedBox()) page.setBleedBox(box.x, box.y, box.width, box.height);
        if (page.getArtBox()) page.setArtBox(box.x, box.y, box.width, box.height);
        if (i % 50 === 49 && i + 1 < src.getPageCount()) {
          setMessage(`Cropping… page ${i + 1} of ${src.getPageCount()}.`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      const out = await src.save(SAVE_OPTS);
      if (runId !== runIdRef.current) return;
      const filename = `${name.replace(/\.pdf$/i, "")}-cropped.pdf`;
      downloadBlob(out, filename);
      setMessage(
        `Downloaded ${filename}. Cropped all ${src.getPageCount()} pages.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(friendlyError(err));
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
        aria-label="Choose a PDF to crop"
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
            : "Select a PDF to crop its margins. Processing is local — the file never leaves this device."}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <fieldset disabled={busy} className="space-y-4">
              <legend className="text-sm font-medium text-slate-700">
                Crop margins
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SliderField
                  label="Top"
                  value={top}
                  min={0}
                  max={MAX_CROP}
                  onChange={setTop}
                  unit="%"
                />
                <SliderField
                  label="Bottom"
                  value={bottom}
                  min={0}
                  max={MAX_CROP}
                  onChange={setBottom}
                  unit="%"
                />
                <SliderField
                  label="Left"
                  value={left}
                  min={0}
                  max={MAX_CROP}
                  onChange={setLeft}
                  unit="%"
                />
                <SliderField
                  label="Right"
                  value={right}
                  min={0}
                  max={MAX_CROP}
                  onChange={setRight}
                  unit="%"
                />
              </div>
              <Button
                type="button"
                disabled={busy || zeroCrop}
                onClick={() => void applyCrop()}
              >
                <CropIcon className="w-4 h-4 mr-1.5 inline" />
                {busy ? "Cropping…" : "Crop all pages → download"}
              </Button>
              {zeroCrop && (
                <p className="text-xs text-slate-500">
                  Move at least one slider to enable cropping.
                </p>
              )}
              <p className="text-xs text-slate-500">
                The same percentages are applied to every page, using each
                page&apos;s own rotation so the kept area always matches this
                preview.
              </p>
            </fieldset>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Preview (page 1)
            </p>
            {previewUrl ? (
              <div
                className="relative mx-auto"
                style={{ aspectRatio: `1 / ${ratio}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-contain rounded-xl"
                />
                <div
                  role="img"
                  aria-label="Preview of the area that will remain after cropping"
                  className="absolute inset-0 border-2 border-indigo-500 shadow-[0_0_0_2000px_rgba(255,255,255,0.75)] rounded-lg"
                  style={{
                    top: `${top}%`,
                    right: `${right}%`,
                    bottom: `${bottom}%`,
                    left: `${left}%`,
                  }}
                />
              </div>
            ) : (
              <div
                className="mx-auto rounded-xl bg-slate-100"
                style={{ aspectRatio: `1 / ${ratio}` }}
                role="img"
                aria-label={previewFailed ? "Preview unavailable" : "Loading preview"}
              />
            )}
            <p className="mt-3 text-xs text-slate-500">
              {previewFailed
                ? "No preview could be rendered for this file — the sliders still crop every page."
                : "The highlighted area is what will remain after cropping."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}