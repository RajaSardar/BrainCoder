"use client";

import { useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";
import { docxToHtml } from "@/lib/docx";

export default function WordViewer() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [html, setHtml] = useState("");
  const [name, setName] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setName("");
    setHtml("");
    try {
      const data = await file.arrayBuffer();
      const value = await docxToHtml(data);
      if (!value.trim()) setError("No content found in this document.");
      else {
        setHtml(value);
        setName(file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read document.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-3">
        <input
          id="wv-file"
          type="file"
          accept=".docx,.doc"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => document.getElementById("wv-file")?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          Open Word document
        </Button>
        {html && name && (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => document.getElementById("wv-file")?.click()}
            >
              Open another
            </Button>
            <CopyButton text={html} label="Copy HTML" />
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && !html && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Open a .docx file to preview it as rendered content — headings,
          lists, and tables included. Your document never leaves your browser.
        </div>
      )}

      {html && (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">{name} rendered</p>
              <p className="text-emerald-700">
                {html.length.toLocaleString()} characters of HTML — the raw
                source is available via the Copy HTML button.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-8 max-h-[36rem] overflow-y-auto bg-[repeating-linear-gradient(to_bottom,#fff,#fff_23px,#f1f5f9_23px,#f1f5f9_24px)]">
            <div
              className="prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </>
      )}
    </div>
  );
}