"use client";

import { useRef, useState } from "react";
import { ScanText, Loader2, FileText, Copy, Download } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const LANGS = [
  { id: "eng", label: "English" },
  { id: "spa", label: "Spanish" },
  { id: "fra", label: "French" },
  { id: "deu", label: "German" },
  { id: "ita", label: "Italian" },
  { id: "por", label: "Portuguese" },
  { id: "rus", label: "Russian" },
  { id: "hin", label: "Hindi" },
  { id: "ara", label: "Arabic" },
  { id: "chi_sim", label: "Chinese (simplified)" },
  { id: "jpn", label: "Japanese" },
  { id: "kor", label: "Korean" },
];

export default function PdfOcr() {
  const [name, setName] = useState("");
  const [lang, setLang] = useState("eng");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setText("");
    setProgress("Reading PDF…");
    try {
      const data = await file.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;
      setName(file.name);

      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status) {
            setProgress(
              `${m.status}… ${m.progress ? Math.round(m.progress * 100) : 0}%`,
            );
          }
        },
      });

      const chunks: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        setProgress(`Rendering page ${p} of ${doc.numPages}…`);
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 3 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvas, viewport }).promise;

        setProgress(`Recognizing page ${p} of ${doc.numPages}…`);
        const { data } = await worker.recognize(canvas);
        chunks.push(
          data.text.trim()
            ? `--- Page ${p} ---\n${data.text.trim()}`
            : `--- Page ${p} ---\n(no text detected)`,
        );
      }

      await worker.terminate();
      setText(chunks.join("\n\n"));
      setProgress("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OCR failed. Make sure the PDF is legible and the language pack is available.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      <div className="flex flex-wrap items-end gap-4">
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          {busy ? "Working…" : name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <Field label="Language">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {progress && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          {progress}
        </div>
      )}

      {text && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">
              {text.length.toLocaleString()}
            </span>{" "}
            characters recognized from {name}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                downloadBlob(
                  new TextEncoder().encode(text),
                  `${name.replace(/\.pdf$/i, "")}-ocr.txt`,
                  "text/plain",
                )
              }
            >
              <Download className="w-4 h-4 mr-1.5 inline" /> Download .txt
            </Button>
            <Button type="button" variant="secondary" onClick={onCopy}>
              <Copy className="w-4 h-4 mr-1.5 inline" />{" "}
              {copied ? "Copied!" : "Copy text"}
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <ScanText className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                OCR result
              </span>
            </div>
            <pre className="px-5 py-4 text-sm text-slate-700 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
              {text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
