"use client";

import { useMemo, useState } from "react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const SAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>  Example   page  </title>
    <!-- this is a comment -->
    <style>
        .box {  color: red;  }
    </style>
</head>
<body>
    <div class="box">
        <p>  Hello&nbsp; world  </p>
    </div>
    <script>
        console.log( 'hi' );
    </script>
</body>
</html>`;

function removeComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function minify(html: string): string {
  let out = removeComments(html);
  out = out.replace(/>\s+</g, "><");
  out = out.replace(/\s{2,}/g, " ");
  return out.trim();
}

function beautify(html: string): string {
  const cleaned = removeComments(html).trim();
  const tokens = cleaned.replace(/></g, ">\n<").split("\n");
  let depth = 0;
  const SPACE = "  ";
  const lines: string[] = [];
  for (const tok of tokens) {
    const isClosing = /^<\//.test(tok.trim());
    const isSelfClosing = /\/>$/.test(tok.trim()) || /^<[^>]+ \/>$/.test(tok.trim());
    if (isClosing) depth = Math.max(0, depth - 1);
    lines.push(SPACE.repeat(depth) + tok.trim());
    if (!isClosing && !isSelfClosing && !/^<!/.test(tok.trim())) {
      if (!/^<(style|script|textarea)/.test(tok.trim())) depth++;
    }
  }
  return lines.join("\n");
}

export default function HtmlMinifier() {
  const [input, setInput] = useState(SAMPLE);
  const [mode, setMode] = useState<"minify" | "beautify">("minify");

  const output = useMemo(() => {
    const out = mode === "minify" ? minify(input) : beautify(input);
    return out;
  }, [input, mode]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {mode === "minify" ? (
            <>
              Removes comments and collapses whitespace. Size {input.length} →{" "}
              <span className="font-medium text-slate-700">{output.length}</span> chars
              {input.length > 0 && output.length < input.length && (
                <span className="text-red-500 font-medium">
                  {" "}(−{Math.round((1 - output.length / input.length) * 100)}%)
                </span>
              )}
            </>
          ) : (
            <>Reformats messy HTML into indented, readable structure.</>
          )}
        </p>
        <CopyButton text={output} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">HTML</p>
          <StyledTextarea rows={14} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">
              {mode === "minify" ? "Minified" : "Pretty"}
            </p>
          </div>
          <StyledTextarea rows={14} value={output} readOnly className="bg-slate-100" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["minify", "beautify"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                mode === m ? "bg-red-500 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "minify" ? "Minify" : "Pretty-print"}
            </button>
          ))}
        </div>
        <Button type="button" onClick={() => setInput("")} variant="secondary">
          Clear
        </Button>
      </div>
    </div>
  );
}