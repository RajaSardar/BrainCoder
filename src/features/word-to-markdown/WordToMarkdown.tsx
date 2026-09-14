"use client";

import { useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { docxToMarkdown } from "@/lib/docx";
import { downloadBlob } from "@/lib/download";
import { marked } from "marked";

export default function WordToMarkdown() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [md, setMd] = useState("");
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"md" | "preview">("md");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setName("");
    setMd("");
    try {
      const data = await file.arrayBuffer();
      const value = await docxToMarkdown(data);
      if (!value) setError("No text found in this document.");
      else {
        setMd(value);
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
      <div className="flex flex-wrap items-end gap-4">
        <input
          id="w2md-file"
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
          onClick={() => document.getElementById("w2md-file")?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          Choose Word document
        </Button>
        {md && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              downloadBlob(
                new TextEncoder().encode(md),
                `${name?.replace(/\.docx?$/i, "") ?? "document"}.md`,
                "text/markdown",
              )
            }
          >
            Download .md
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!busy && !error && !md && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          Convert a .docx document to clean Markdown — headings, lists, and
          tables preserved. 100% in your browser.
        </div>
      )}

      {md && (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">{name} → Markdown</p>
              <p className="text-emerald-700">
                {md.length.toLocaleString()} characters of Markdown generated.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {(["md", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  tab === t
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "md" ? "Markdown" : "Preview"}
              </button>
            ))}
          </div>
          {tab === "md" ? (
            <textarea
              value={md}
              onChange={(e) => setMd(e.target.value)}
              className="w-full h-96 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <div
              className="prose-sm max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: marked.parse(md, { async: false }) as string,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}