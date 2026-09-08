"use client";

import { useMemo, useState } from "react";
import { marked } from "marked";
import { Button, CopyButton } from "@/components/ui";

const SAMPLE = `# Hello, Markdown!

**BrainCoder** brings you a live Markdown editor and previewer.

## Features
- Edit on the left
- Preview on the right
- Copy rendered **HTML** anytime

## Code
\`\`\`js
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

> Everything runs locally in your browser.
`;

export default function MarkdownPreview() {
  const [md, setMd] = useState(SAMPLE);

  const html = useMemo(() => {
    try {
      return marked.parse(md, { async: false });
    } catch {
      return "";
    }
  }, [md]);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Live Markdown — preview updates as you type.</p>
        <CopyButton text={typeof html === "string" ? html : ""} label="Copy HTML" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Markdown</p>
          <textarea
            value={md}
            onChange={(e) => setMd(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition resize-y"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Preview</p>
          <div
            className="rounded-xl border border-slate-200 bg-white px-5 py-4 overflow-auto md-preview"
            style={{ minHeight: 380, maxHeight: 520 }}
            dangerouslySetInnerHTML={{ __html: typeof html === "string" ? html : "" }}
          />
        </div>
      </div>

      <Button type="button" onClick={() => setMd("")} variant="secondary">
        Clear
      </Button>
    </div>
  );
}