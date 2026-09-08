"use client";

import { useState } from "react";
import { ScanText, Loader2, ImagePlus } from "lucide-react";
import { Button, Field, CopyButton } from "@/components/ui";

const LANGS = [
  { id: "eng", label: "English" },
  { id: "spa", label: "Spanish" },
  { id: "fra", label: "French" },
  { id: "deu", label: "German" },
  { id: "por", label: "Portuguese" },
  { id: "ita", label: "Italian" },
  { id: "rus", label: "Russian" },
  { id: "hin", label: "Hindi" },
  { id: "ara", label: "Arabic" },
  { id: "chi_sim", label: "Chinese (simplified)" },
  { id: "jpn", label: "Japanese" },
  { id: "kor", label: "Korean" },
];

export default function ImageOcr() {
  const [lang, setLang] = useState("eng");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const runOcr = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setText("");
    setProgress("Loading OCR engine…");
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status) setProgress(`${m.status}… ${m.progress ? Math.round(m.progress * 100) : 0}%`);
        },
      });
      setProgress("Recognizing text…");
      const { data } = await worker.recognize(file);
      setText(data.text.trim());
      await worker.terminate();
      setProgress("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OCR failed. Make sure the image is clear and the language pack is available."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="ocr-file"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void runOcr(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" onClick={() => document.getElementById("ocr-file")?.click()} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5 inline" />}
          {busy ? "Working…" : "Choose image"}
        </Button>
        <Field label="Language">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <ScanText className="w-3.5 h-3.5" /> Extracts text with OCR. Language packs load on first use.
        </p>
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> {progress || "Processing…"}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {(previewUrl || text) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {previewUrl && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Image</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Uploaded" className="max-h-80 rounded-2xl border border-slate-200 w-auto" />
            </div>
          )}
          {text && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Extracted text</p>
                <CopyButton text={text} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 min-h-40 whitespace-pre-wrap text-sm leading-relaxed overflow-auto">
                {text}
              </div>
            </div>
          )}
        </div>
      )}

      {!previewUrl && !busy && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Upload a scan or photo and the text inside it is extracted — no uploads to any server.
        </div>
      )}
    </div>
  );
}