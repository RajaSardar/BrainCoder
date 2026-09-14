"use client";

import { useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { docxToText } from "@/lib/docx";
import { downloadBlob } from "@/lib/download";

export default function WordToText() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setName("");
    setText("");
    try {
      const data = await file.arrayBuffer();
      const value = await docxToText(data);
      const trimmed = value.replace(/\n{3,}/g, "\n\n").trim();
      if (!trimmed) setError("No text found in this document.");
      else {
        setText(trimmed);
        setName(file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read document.");
    } finally {
      setBusy(false);
    }
  };

  const dlName = (ext: string) =>
    `${name?.replace(/\.docx?$/i, "") ?? "document"}.${ext}`;

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="w2t-file"
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
          onClick={() => document.getElementById("w2t-file")?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          Choose Word document
        </Button>
        {text && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              downloadBlob(
                new TextEncoder().encode(text),
                dlName("txt"),
                "text/plain",
              )
            }
          >
            Download .txt
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && !text && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Pick a .docx file and its plain text is extracted instantly — no
          uploads, no formatting clutter.
        </div>
      )}

      {text && (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">{name} → text</p>
              <p className="text-emerald-700">
                {text.length.toLocaleString()} characters extracted. Edit the
                preview below, then download.
              </p>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-80 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </>
      )}
    </div>
  );
}