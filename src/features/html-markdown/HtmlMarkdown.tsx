"use client";

import { useState } from "react";
import { BookMarked } from "lucide-react";
import TurndownService from "turndown";
import { marked } from "marked";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const MD_SAMPLE = `# Hello Markdown

**Bold** and _italic_, plus \`inline code\`.

- First item
- Second item

> A quote here.

[BrainCoder](https://github.com/RajaSardar/BrainCoder)
`;

const HTML_SAMPLE = `<h1>Hello HTML</h1>
<p><strong>Bold</strong> and <em>italic</em>, plus <code>inline code</code>.</p>
<ul>
  <li>First item</li>
  <li>Second item</li>
</ul>
<blockquote><p>A quote here.</p></blockquote>
<p><a href="https://github.com/RajaSardar/BrainCoder">BrainCoder</a></p>
`;

export default function HtmlMarkdown() {
  const [mode, setMode] = useState<"toHtml" | "toMd">("toHtml");
  const [input, setInput] = useState(MD_SAMPLE);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const convert = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "toHtml") {
        setOutput(await marked.parse(input));
      } else {
        setOutput(new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" }).turndown(input));
      }
    } catch (e) {
      setOutput("");
      setError(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <BookMarked className="w-4 h-4 text-emerald-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["toHtml", "toMd"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "toHtml" ? "Markdown → HTML" : "HTML → Markdown"}
            </button>
          ))}
        </div>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={12} placeholder={mode === "toHtml" ? "Paste Markdown…" : "Paste HTML…"} />
      {mode === "toMd" && (
        <p className="text-xs text-slate-400">
          Tip: set the input textarea to <button type="button" onClick={() => setInput(HTML_SAMPLE)} className="text-emerald-600 underline">this HTML sample</button>.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void convert()}>{busy ? "Working…" : "Convert"}</Button>
        <CopyButton text={output} />
      </div>

      <StyledTextarea readOnly value={output} rows={12} placeholder="Converted output…" />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <p className="text-xs text-slate-400">Markdown rendering via marked, HTML-to-Markdown conversion via Turndown.</p>
    </div>
  );
}