"use client";

import { useMemo, useState } from "react";
import { marked } from "marked";
import { StyledTextarea, CopyButton } from "@/components/ui";

const SAMPLE = `# Hello, BrainCoder!

This is **Markdown** rendered to **HTML**.

## Features
- Live HTML output
- Copy the generated markup
- Switch to a rendered preview

> Note: everything runs locally in your browser.`;

export default function MdToHtml() {
  const [input, setInput] = useState(SAMPLE);
  const [showPreview, setShowPreview] = useState(false);

  const html = useMemo(() => {
    try {
      return marked.parse(input, { async: false });
    } catch {
      return "";
    }
  }, [input]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
        >
          {showPreview ? "Show HTML code" : "Show rendered preview"}
        </button>
        <CopyButton text={html} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Markdown</p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            {showPreview ? "Preview" : "HTML"}
          </p>
          {showPreview ? (
            <div
              className="rounded-2xl border border-slate-200 bg-white px-5 py-4 min-h-[360px] overflow-auto md-preview"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <StyledTextarea rows={16} value={html} readOnly className="bg-slate-100" />
          )}
        </div>
      </div>
    </div>
  );
}