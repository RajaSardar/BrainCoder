"use client";

import { useRef, useState } from "react";
import { RotateCw, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };
const normalize = (angle: number) => ((angle % 360) + 360) % 360;

interface RotateError {
  friendly: string;
}

function rotLabel(angle: number): string {
  if (angle === 90) return "90° clockwise";
  if (angle === -90) return "90° counter-clockwise";
  return "180°";
}

function friendlyLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes("is encrypted")) {
    return "That PDF is password-protected. Unlock it with PDF Unlock first, then load the unlocked file here.";
  }
  if (raw.includes("Failed to parse") || raw.includes("No PDF header")) {
    return "That file doesn't look like a valid PDF.";
  }
  return "Could not read that PDF. It may be corrupt or unsupported.";
}

function friendlyGenericError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes("is encrypted")) {
    return "That PDF is password-protected. Unlock it with PDF Unlock first, then load the unlocked file here.";
  }
  return "Could not rotate that PDF. It may be corrupt or unsupported.";
}

export default function PdfRotate() {
  const [sourceName, setSourceName] = useState("");
  const [baseName, setBaseName] = useState("");
  const [pages, setPages] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<RotateError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const runIdRef = useRef(0);
  const dlCountRef = useRef(1);

  const loadFile = async (file: File) => {
    const runId = ++runIdRef.current;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        if (runId === runIdRef.current) {
          setError({
            friendly: "That file is larger than 100 MB, which this tool doesn't support. Split it with PDF Split first.",
          });
        }
        return;
      }
      const data = await file.arrayBuffer();
      const { PDFDocument } = await import("pdf-lib");
      const src = await PDFDocument.load(new Uint8Array(data));
      if (runId !== runIdRef.current) return;
      bytesRef.current = new Uint8Array(data);
      setSourceName(file.name);
      setBaseName(file.name.replace(/\.pdf$/i, ""));
      const count = src.getPageCount();
      setPages(count);
      setRotation(0);
      dlCountRef.current = 1;
      setMessage(
        count === 1
          ? "Loaded 1 page. Pick a rotation direction below."
          : `Loaded ${count} pages. The whole document will be rotated together — pick a direction below.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError({ friendly: friendlyLoadError(err) });
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    void loadFile(file);
  };

  const rotate = async (angle: number) => {
    const current = bytesRef.current;
    if (!current || busy) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError(null);
    setMessage(`Rotating all ${pages} pages ${rotLabel(angle)}…`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const src = await PDFDocument.load(current);
      for (const page of src.getPages()) {
        page.setRotation(degrees(normalize(page.getRotation().angle + angle)));
      }
      const out = await src.save(SAVE_OPTS);
      if (runId !== runIdRef.current) return;
      bytesRef.current = out;
      const next = normalize(rotation + angle);
      setRotation(next);
      const suffix = dlCountRef.current === 1 ? "" : `-${dlCountRef.current}`;
      const filename = `${baseName}-rotated${suffix}.pdf`;
      dlCountRef.current += 1;
      downloadBlob(out, filename);
      setMessage(
        `Downloaded ${filename}. Every page is now rotated to ${next}°${next === 0 ? " (back to the original orientation)" : ""}.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError({ friendly: friendlyGenericError(err) });
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
        aria-label="Choose a PDF file to rotate"
        onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
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
          {sourceName ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500" role="status">
          {sourceName
            ? `${sourceName} — ${pages} page${pages === 1 ? "" : "s"}, now at ${rotation}°`
            : "Select a PDF to rotate. Every page is rotated together, so reorienting a whole sideways scan takes one click."}
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

      {sourceName && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <fieldset disabled={busy}>
            <legend className="text-sm font-medium text-slate-700 mb-3">
              Rotate direction
            </legend>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void rotate(90)}
              >
                <RotateCw className="w-4 h-4 mr-1.5 inline" /> 90° clockwise
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void rotate(-90)}
              >
                <RotateCw className="w-4 h-4 mr-1.5 inline -scale-x-100" /> 90°
                counter-clockwise
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void rotate(180)}
              >
                <RotateCw className="w-4 h-4 mr-1.5 inline rotate-90" /> 180°
              </Button>
            </div>
          </fieldset>
          <p className="mt-3 text-xs text-slate-500">
            Every page is rotated at once and each result downloads instantly.
            Rotating again continues from the current orientation, so three 90°
            clockwise turns reach 270°.
          </p>
        </div>
      )}
    </div>
  );
}