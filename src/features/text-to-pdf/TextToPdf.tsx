"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";
import { buildTextPdf } from "@/features/pdf-office/support";

const SAMPLE = `BrainCoder — Text to PDF

This page turns plain text into a clean, paginated PDF entirely in your browser.

Type a long paragraph and the text wraps automatically to fit the page width.

  • Bullets and basic punctuation are preserved.
  • Every newline starts a fresh paragraph.
  • Pages split automatically when the text reaches the bottom margin.

Try pasting several paragraphs to see the multi-page output.`;

export default function TextToPdf() {
  const [text, setText] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const buildPdf = async () => {
    setBusy(true);
    setError("");
    try {
      const bytes = await buildTextPdf(text);
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "text.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <StyledTextarea
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="font-mono text-sm"
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
        <p className="text-xs text-slate-400">
          {text.trim()
            ? `${text.length.toLocaleString()} chars — wrapped & paginated at A4.`
            : "Nothing to build yet."}
        </p>
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
