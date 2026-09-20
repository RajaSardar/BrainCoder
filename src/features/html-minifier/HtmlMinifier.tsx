"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";
import { minifyHtml, beautifyHtml } from "./html-minify";

const SAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Example page</title>
    <!-- a comment that will be removed -->
    <!--[if lt IE 9]>
        <script src="legacy.js"></script>
    <![endif]-->
    <style>
        .box {  color: red;  }
    </style>
</head>
<body>
    <div class="box">
        <p>  Hello  <b>world</b> &nbsp;  </p>
    </div>
    <pre>  keep    this   spacing  </pre>
    <script>
        // <!\u002d\u002d this string must survive -->
        console.log( 'hi' );
    </script>
</body>
</html>`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function HtmlMinifier() {
  const [input, setInput] = useState(SAMPLE);
  const [mode, setMode] = useState<"minify" | "beautify">("minify");
  const [keepConditional, setKeepConditional] = useState(false);

  const deferredInput = useDeferredValue(input);

  const output = useMemo(() => {
    if (!deferredInput) return "";
    return mode === "minify"
      ? minifyHtml(deferredInput, { preserveConditional: keepConditional })
      : beautifyHtml(deferredInput);
  }, [deferredInput, mode, keepConditional]);

  const stats = useMemo(() => {
    const inBytes = new TextEncoder().encode(deferredInput).length;
    const outBytes = new TextEncoder().encode(output).length;
    const saving =
      inBytes > 0 && outBytes < inBytes ? Math.round((1 - outBytes / inBytes) * 100) : 0;
    return { inBytes, outBytes, saving };
  }, [deferredInput, output]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setInput(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-xs sm:text-sm text-slate-600"
          role="status"
          aria-live="polite"
        >
          {mode === "minify" ? "Minified" : "Pretty"} · {formatBytes(stats.inBytes)} →{" "}
          <span className="font-medium text-slate-700">{formatBytes(stats.outBytes)}</span>
          {stats.saving > 0 && (
            <span className="font-medium text-emerald-600"> (−{stats.saving}%)</span>
          )}
          {" · "}
          {stats.inBytes.toLocaleString()} → {stats.outBytes.toLocaleString()} chars
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <CopyButton
            text={output}
            label={mode === "minify" ? "Copy minified" : "Copy formatted"}
            ariaLabel={mode === "minify" ? "Copy minified HTML" : "Copy formatted HTML"}
            disabled={!output}
          />
          <Button type="button" onClick={() => downloadFile(mode === "minify" ? "minified.html" : "formatted.html", output)} variant="secondary" disabled={!output}>
            Download .html
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">HTML</p>
          <StyledTextarea
            rows={14}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="HTML input"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            {mode === "minify" ? "Minified" : "Pretty"}
          </p>
          <StyledTextarea
            rows={14}
            value={output}
            readOnly
            className="bg-slate-100"
            aria-label={mode === "minify" ? "Minified output" : "Formatted output"}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Output mode">
          {(["minify", "beautify"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
                mode === m
                  ? "bg-red-600 text-white"
                  : "text-slate-600 hover:bg-slate-50 focus-visible:bg-slate-50"
              }`}
            >
              {m === "minify" ? "Minify" : "Pretty-print"}
            </button>
          ))}
        </div>

        {mode === "minify" && (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={keepConditional}
              onChange={(e) => setKeepConditional(e.target.checked)}
              className="accent-red-600 h-4 w-4"
            />
            Keep conditional comments
          </label>
        )}

        <Button type="button" onClick={() => setInput("")} variant="secondary">
          Clear
        </Button>

        <input
          type="file"
          id="html-minifier-file"
          accept=".html,.htm,text/html"
          className="sr-only"
          onChange={handleFile}
        />
        <label
          htmlFor="html-minifier-file"
          className="cursor-pointer min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition inline-flex items-center justify-center"
        >
          Open .html
        </label>
      </div>
    </div>
  );
}