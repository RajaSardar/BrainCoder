"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button, StyledTextarea, SliderField } from "@/components/ui";
import { buildTextPdf } from "@/features/pdf-office/support";

const SAMPLE = `BrainCoder — Text to PDF

This page turns plain text into a clean, paginated PDF entirely in your browser.

Type a long paragraph and the text wraps automatically to fit the page width.

  • Bullets and basic punctuation are preserved.
  • Every newline starts a fresh paragraph.
  • Pages split automatically when the text reaches the bottom margin.

Try pasting several paragraphs to see the multi-page output.`;

const MAX_CHARS = 500_000;

export default function TextToPdf() {
  const [text, setText] = useState(SAMPLE);
  const [fontSize, setFontSize] = useState(13);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const atLimit = text.length >= MAX_CHARS;

  const buildPdf = async () => {
    setBusy(true);
    setError("");
    try {
      const bytes = await buildTextPdf(text, { fontSize });
      const blob = new Blob(
        [(bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)],
        { type: "application/pdf" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "text.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not load the PDF engine — check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const status = busy
    ? "Building your PDF…"
    : text.trim()
      ? `${text.length.toLocaleString()} chars — wrapped & paginated at A4${atLimit ? ` (this tool caps input at ${MAX_CHARS.toLocaleString()} characters)` : ""}.`
      : "Nothing to build yet.";

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <label htmlFor="text-to-pdf-input" className="sr-only">
        Text to convert to PDF
      </label>
      <StyledTextarea
        id="text-to-pdf-input"
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_CHARS}
        placeholder="Paste your text here — notes, letters, reports, or code."
        className="font-mono text-sm"
      />
      <SliderField
        label="Font size"
        value={fontSize}
        min={10}
        max={24}
        step={1}
        unit=" pt"
        onChange={setFontSize}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => void buildPdf()}
          disabled={busy || text.trim() === ""}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          {busy ? "Building…" : "Download PDF"}
        </Button>
        <p className="text-xs text-slate-600" role="status">
          {status}
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}
    </div>
  );
}