"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";
import { formatJson, type JsonFormatResult } from "@/lib/json-format";

const MAX_INPUT_LENGTH = 2 * 1024 * 1024;

function formatErrorLine(result: JsonFormatResult): string | null {
  if (result.ok) return null;
  if (result.line !== null && result.column !== null) {
    return `line ${result.line}, column ${result.column}`;
  }
  return null;
}

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState(2);
  const [overLimit, setOverLimit] = useState(false);

  const deferredInput = useDeferredValue(input);

  const result = useMemo(() => {
    if (!deferredInput.trim()) return null;
    return formatJson(deferredInput, indent);
  }, [deferredInput, indent]);

  const valid = result !== null && result.ok;
  const lineAndColumn = result !== null && !result.ok ? formatErrorLine(result) : null;

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <fieldset className="flex items-center gap-2">
            <legend id="indent-legend" className="text-sm font-medium text-slate-700">
              Indent
            </legend>
            <div
              role="radiogroup"
              aria-labelledby="indent-legend"
              className="flex rounded-lg border border-slate-200 bg-white p-1"
            >
              {[2, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={indent === n}
                  onClick={() => setIndent(n)}
                  className={`min-h-11 px-3 rounded-md text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                    indent === n ? "bg-amber-700 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n} spaces
                </button>
              ))}
            </div>
          </fieldset>
          {deferredInput.trim() && (
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                valid
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {valid ? (
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {valid ? "Valid JSON" : "Invalid JSON"}
            </span>
          )}
        </div>
        <CopyButton
          text={result !== null && result.ok ? result.formatted : ""}
          label="Copy formatted"
          disabled={result === null || !result.ok}
        />
      </div>

      <StyledTextarea
        rows={8}
        value={input}
        onChange={(e) => {
          const next = e.target.value;
          if (next.length > MAX_INPUT_LENGTH) {
            setOverLimit(true);
            return;
          }
          setOverLimit(false);
          setInput(next);
        }}
        placeholder='{"hello": "world", "nested": [1, 2, 3]}'
        aria-label="JSON input"
      />

      {overLimit && (
        <p role="status" className="text-sm text-slate-600">
          Input is limited to 2 MB.
        </p>
      )}

      {result !== null && !result.ok && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-mono"
        >
          {result.error}
          {lineAndColumn ? ` (${lineAndColumn})` : ""}
        </div>
      )}

      {result !== null && result.ok && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Formatted</p>
            <span className="text-xs text-slate-600">
              {result.formatted.length.toLocaleString()} chars
            </span>
          </div>
          <StyledTextarea
            rows={10}
            value={result.formatted}
            readOnly
            tabIndex={-1}
            aria-label="Formatted JSON output"
            className="bg-slate-100"
          />

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Minified</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">
                {result.minified.length.toLocaleString()} chars
              </span>
              <CopyButton text={result.minified} label="Copy minified" disabled={false} className="min-h-11" />
            </div>
          </div>
          <StyledTextarea
            rows={3}
            value={result.minified}
            readOnly
            tabIndex={-1}
            aria-label="Minified JSON output"
            className="bg-slate-100"
          />
        </>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setInput("");
          setOverLimit(false);
        }}
        disabled={!input.trim()}
        className="min-h-11"
      >
        Clear
      </Button>
    </div>
  );
}