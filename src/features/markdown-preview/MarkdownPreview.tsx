"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { Button, CopyButton } from "@/components/ui";
import { sanitizeHtml } from "./sanitize";

const SAMPLE = `# Hello, Markdown!

**BrainCoder** brings you a live Markdown editor and previewer.

## Features
- Edit on the left
- Preview on the right
- Sanitized, safe **HTML** output

## Checklist
- [x] Write the draft
- [x] Preview it live
- [ ] Export it as HTML

## Table
| Feature       | Status |
| ------------- | ------ |
| Live preview | ✓      |
| Auto-save    | ✓      |

## Code
\`\`\`js
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

> Everything runs locally in your browser.
`;

const STORAGE_KEY = "braincoder:markdown-preview:draft";
const MAX_LENGTH = 1_000_000;

function wrapDocument(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rendered Markdown</title>
<style>
  body{max-width:720px;margin:2rem auto;padding:0 1rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a}
  pre{background:#f1f5f9;padding:1rem;border-radius:8px;overflow:auto}
  code{font-family:ui-monospace,SFMono-Regular,monospace}
  table{border-collapse:collapse}
  th,td{border:1px solid #e2e8f0;padding:.5rem .75rem}
  blockquote{border-left:4px solid #cbd5e1;margin:0 0 1rem;padding-left:1rem;color:#475569}
  img{max-width:100%}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function countStats(md: string): { chars: number; words: number; minutes: number } {
  const text = md
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_~>`\-[\]()!]/g, "");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / 200));
  return { chars: md.length, words, minutes };
}

export default function MarkdownPreview() {
  const [md, setMd] = useState(SAMPLE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setMd(saved);
      } catch {
        setMounted(true);
      }
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, md);
      } catch {
        // storage unavailable — skip autosave
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [md]);

  const deferredMd = useDeferredValue(md);
  const stats = useMemo(() => countStats(deferredMd), [deferredMd]);

  const parsed = useMemo(() => {
    try {
      const out = marked.parse(deferredMd, { async: false });
      return { html: typeof out === "string" ? out : "", error: false };
    } catch {
      return { html: "", error: true };
    }
  }, [deferredMd]);

  const html = useMemo(() => {
    if (!mounted || parsed.error || !parsed.html) return "";
    return sanitizeHtml(parsed.html);
  }, [mounted, parsed]);

  const handleDownload = () => {
    const blob = new Blob([wrapDocument(html)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "markdown-preview.html";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">{stats.chars.toLocaleString()}</span> chars ·{" "}
          <span className="font-medium text-slate-700">{stats.words.toLocaleString()}</span> words ·
          ~{stats.minutes} min read
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <CopyButton text={html} label="Copy HTML" disabled={!html} />
          <Button type="button" onClick={handleDownload} variant="secondary" disabled={!html}>
            Download .html
          </Button>
        </div>
      </div>

      {parsed.error && (
        <p
          role="alert"
          className="text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
        >
          Markdown could not be parsed — check for an unbalanced fenced code block or extremely deep
          nesting.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Markdown</p>
          <textarea
            value={md}
            onChange={(e) => setMd(e.target.value)}
            rows={16}
            maxLength={MAX_LENGTH}
            spellCheck={false}
            aria-label="Markdown source"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition resize-y"
          />
          {md.length >= MAX_LENGTH && (
            <p className="text-xs text-slate-500 mt-1">
              Input capped at {MAX_LENGTH.toLocaleString()} characters.
            </p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Preview</p>
          <div
            role="region"
            aria-label="Markdown preview"
            aria-live="polite"
            className="rounded-xl border border-slate-200 bg-white px-5 py-4 overflow-auto md-preview"
            style={{ minHeight: 260, maxHeight: 480 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" onClick={() => setMd("")} variant="secondary">
          Clear
        </Button>
        <Button type="button" onClick={() => setMd(SAMPLE)} variant="secondary">
          Reset sample
        </Button>
      </div>
    </div>
  );
}