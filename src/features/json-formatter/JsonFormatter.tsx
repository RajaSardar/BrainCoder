"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

interface JsonResult {
  output: string;
  error: string | null;
}

function formatJson(input: string, indent: number | string, minify: boolean): JsonResult {
  try {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    const output = minify
      ? JSON.stringify(parsed)
      : JSON.stringify(parsed, null, indent);
    return { output: output ?? "", error: null };
  } catch (err) {
    return { output: "", error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<number>(2);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    return formatJson(input, indent, false);
  }, [input, indent]);

  const minified = useMemo(() => {
    if (!input.trim()) return "";
    return formatJson(input, 0, true).output;
  }, [input]);

  const valid = result !== null && result.error === null;

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Indent:</span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {[2, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIndent(n)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  indent === n ? "bg-amber-500 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {n} spaces
              </button>
            ))}
          </div>
          {input.trim() && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                valid
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {valid ? "Valid JSON" : "Invalid JSON"}
            </span>
          )}
        </div>
        <CopyButton text={result?.output ?? ""} label={result?.error ? "Copy (nothing)" : "Copy formatted"} disabled={!valid} />
      </div>

      <StyledTextarea
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='{"hello": "world", "nested": [1, 2, 3]}'
      />

      {result?.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-mono">
          {result.error}
        </div>
      )}

      {valid && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Formatted</p>
            <span className="text-xs text-slate-400">
              {result.output.length.toLocaleString()} chars
            </span>
          </div>
          <StyledTextarea rows={10} value={result.output} readOnly className="bg-slate-100" />

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Minified</p>
            <span className="text-xs text-slate-400">{minified.length.toLocaleString()} chars</span>
          </div>
          <StyledTextarea rows={3} value={minified} readOnly className="bg-slate-100" />
        </>
      )}

      <Button type="button" onClick={() => setInput("")} variant="secondary">
        Clear
      </Button>
    </div>
  );
}