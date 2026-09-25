"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import type Tesseract from "tesseract.js";
import { ScanText, Loader2, FileText, Copy, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;

const OCR_WORKER_PATH = "/ocr/worker.min.js";
const OCR_CORE_PATH = "/ocr/";
const OCR_LANG_PATH = "/ocr/traineddata/";

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

let pdfjsReady = false;

function friendlyError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/password|encrypted/i.test(m))
    return "This PDF is password-protected. Remove the password with PDF Unlock, then run OCR again.";
  if (/Invalid PDF|Failed to parse|No PDF header|encryption/i.test(m))
    return "This file doesn't look like a valid PDF.";
  if (/language|traineddata|Failed to load/i.test(m))
    return "The language model failed to load — check your connection and try again.";
  return "OCR didn't finish — try again, or pick a cleaner scan.";
}

function userFacing(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing)
    return err.message;
  return friendlyError(err);
}

export default function PdfOcr() {
  const [name, setName] = useState("");
  const [lang, setLang] = useState("eng");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [hasTextLayer, setHasTextLayer] = useState(false);
  const [copied, setCopied] = useState(false);
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const langId = useId();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setText("");
    setProgress("");
    setHasTextLayer(false);
    let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null =
      null;
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `This PDF is ${Math.round(file.size / 1048576)} MB — files up to 100 MB are supported.`,
        );
      }
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const pdfjs = await import("pdfjs-dist");
      if (!pdfjsReady) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        pdfjsReady = true;
      }
      const task = pdfjs.getDocument({ data });
      let doc;
      try {
        doc = await task.promise;
        if (doc.numPages > MAX_PAGES) {
          throw userFacing(
            `This PDF has ${doc.numPages} pages — files up to 200 pages are supported. Use PDF Split first.`,
          );
        }
        setName(file.name);

        setProgress("Loading the OCR engine…");
        const Tesseract = await import("tesseract.js");
        const ocr = await Tesseract.createWorker(lang, 1, {
          workerPath: OCR_WORKER_PATH,
          corePath: OCR_CORE_PATH,
          langPath: OCR_LANG_PATH,
          logger: (m: { status: string; progress: number }) => {
            if (runId !== runIdRef.current) return;
            if (m.status) {
              const pct = Number.isFinite(m.progress)
                ? Math.round(m.progress * 100)
                : 0;
              const label =
                m.status === "recognizing text" ? "Recognizing" : m.status;
              setProgress(`${label}… ${pct}%`);
            }
          },
        });
        worker = ocr;

        const chunks: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          if (runId !== runIdRef.current) return;
          setProgress(`Rendering page ${p} of ${doc.numPages}…`);
          const page = await doc.getPage(p);
          try {
            const content = await page.getTextContent();
            const count = (content.items ?? []).reduce(
              (n, it) => n + ((it as { str?: string }).str ?? "").length,
              0,
            );
            if (p === 1 && count > 80) setHasTextLayer(true);

            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement("canvas");
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            await page.render({ canvas, viewport }).promise;
            if (runId !== runIdRef.current) return;

            setProgress(`Recognizing page ${p} of ${doc.numPages}…`);
            const { data } = await ocr.recognize(canvas);
            chunks.push(
              data.text.trim()
                ? `--- Page ${p} ---\n${data.text.trim()}`
                : `--- Page ${p} ---\n(no text detected)`,
            );
          } finally {
            await page.cleanup();
          }
        }

        if (runId !== runIdRef.current) return;
        await worker.terminate();
        worker = null;
        setText(chunks.join("\n\n"));
        setProgress("");
      } finally {
        await task.destroy().catch(() => {});
      }
    } catch (err) {
      if (runId === runIdRef.current) {
        setName("");
        setError(toUiError(err));
      }
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      if (runId === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF to run OCR on"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
      <span className="sr-only" role="status">
        {busy ? progress || "Reading the PDF…" : ""}
      </span>
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
          {busy ? (progress || "Working…") : name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <label
          htmlFor={langId}
          className="text-sm font-medium text-slate-700"
        >
          Language
          <select
            id={langId}
            value={lang}
            disabled={busy}
            onChange={(e) => setLang(e.target.value)}
            className="block mt-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500">
        The first use of each language downloads its model (~1.5–3 MB) into
        your browser from this site — your file is never uploaded. The model
        is cached afterward.
      </p>

      {error && (
        <div
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
          {/password/i.test(error) && (
            <Link
              href="/use/pdf-unlock"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 underline ml-1"
            >
              Open PDF Unlock <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}
      <div
        className="text-sm text-slate-500"
        role="status"
        aria-live="polite"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin text-indigo-500 inline-block mr-2" />}
        {progress}
      </div>

      {hasTextLayer && !busy && text && (
        <div
          className="rounded-xl bg-slate-50 border border-slate-200 text-slate-600 px-4 py-3 text-sm"
          role="status"
        >
          This PDF already has selectable text — OCR was still run, but{" "}
          <Link
            href="/use/pdf-to-text"
            className="font-semibold text-indigo-600 underline"
          >
            PDF to Text
          </Link>{" "}
          is faster and usually more accurate for it.
        </div>
      )}

      {text && !busy && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500" role="status">
            <span className="font-semibold text-slate-700">
              {text.length.toLocaleString()}
            </span>{" "}
            characters recognized from {name}. OCR isn&apos;t perfect —
            skim the result before relying on it.
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
          <div
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
            role="region"
            aria-label="OCR result"
          >
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