"use client";

import { useState } from "react";
import { Copy, Download, Loader2, FileDigit } from "lucide-react";
import { Button } from "@/components/ui";
import { extractPdfText } from "@/features/pdf-office/support";

function downloadBlob(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PdfToText() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setText("");
    try {
      const data = await file.arrayBuffer();
      const text = await extractPdfText(data);
      setText(text);
      setFileName(file.name.replace(/\.pdf$/i, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract text");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => void navigator.clipboard?.writeText(text);

  const download = () => {
    const bytes = new TextEncoder().encode(text);
    downloadBlob(
      bytes,
      `${fileName || "document"}.txt`,
      "text/plain;charset=utf-8",
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
        <Button
          type="button"
          onClick={() => document.getElementById("pdf-file")?.click()}
        >
          <FileDigit className="w-4 h-4 mr-1.5 inline" /> Choose PDF
        </Button>
        {text && (
          <>
            <Button type="button" variant="secondary" onClick={copy}>
              <Copy className="w-4 h-4 mr-1.5 inline" /> Copy
            </Button>
            <Button type="button" variant="secondary" onClick={download}>
              <Download className="w-4 h-4 mr-1.5 inline" /> Download .txt
            </Button>
          </>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Extracting text…
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && !text && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Pick a text-based PDF and its content is extracted to a plain .txt
          file. 100% local.
        </div>
      )}

      {text && (
        <div>
          <textarea
            value={text}
            readOnly
            rows={14}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y"
          />
          <p className="text-xs text-slate-400 mt-1">
            {text.length.toLocaleString()} characters extracted from {fileName}.
          </p>
        </div>
      )}
    </div>
  );
}
