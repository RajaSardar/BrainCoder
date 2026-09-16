"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, X } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";

const MAX_INPUT_LENGTH = 2 * 1024 * 1024;

type Direction = "encode" | "decode";

interface EncodeResult {
  output: string;
  error: string | null;
}

export default function UrlEncoder() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Direction>("encode");
  const [component, setComponent] = useState(true);
  const [overLimit, setOverLimit] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const result = useMemo<EncodeResult>(() => {
    try {
      if (mode === "encode") {
        return {
          output: component ? encodeURIComponent(input) : encodeURI(input),
          error: null,
        };
      }
      return { output: decodeURIComponent(input), error: null };
    } catch {
      return {
        output: "",
        error:
          mode === "encode"
            ? "Invalid input — could not encode."
            : "Invalid input — could not decode.",
      };
    }
  }, [input, mode, component]);

  const output = result.output;
  const error = result.error !== null && !errorDismissed ? result.error : null;
  const canUseResult = output.length > 0;
  const wholeUrlHint =
    mode === "encode" && component && /^[a-z][a-z0-9+.-]*:\/\//i.test(input);

  const resetDismissed = () => setErrorDismissed(false);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-2">
          <legend id="url-mode-legend" className="sr-only">
            Encode or decode mode
          </legend>
          <div
            role="radiogroup"
            aria-labelledby="url-mode-legend"
            className="flex rounded-xl border border-slate-200 bg-white p-1"
          >
            {(["encode", "decode"] as Direction[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => {
                  setMode(m);
                  resetDismissed();
                }}
                className={`min-h-11 px-4 rounded-lg text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  mode === m ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m === "encode" ? "Encode" : "Decode"}
              </button>
            ))}
          </div>
        </fieldset>

        {mode === "encode" && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={component}
              onChange={(e) => {
                setComponent(e.target.checked);
                resetDismissed();
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            {component ? "Component-level (encodeURIComponent)" : "Whole-URL structure (encodeURI)"}
          </label>
        )}
      </div>

      {wholeUrlHint && (
        <p role="status" className="text-sm text-slate-600">
          Component mode percent-encodes the whole URL. Uncheck the box to keep
          the URL structure intact.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorDismissed(true)}
            className="rounded p-1 text-red-700 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="url-encoder-input" className="mb-2 block text-sm font-medium text-slate-700">
            Input
          </label>
          <StyledTextarea
            id="url-encoder-input"
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
            placeholder={mode === "encode" ? "Paste text to encode…" : "Paste encoded text…"}
          />
          {overLimit && (
            <p role="status" className="mt-2 text-sm text-slate-600">
              Input is limited to 2 MB.
            </p>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Output</span>
            <span className="text-xs text-slate-600">
              {output.length.toLocaleString()} chars
            </span>
          </div>
          <StyledTextarea
            rows={8}
            value={output}
            readOnly
            tabIndex={-1}
            aria-label="Output"
            className="bg-slate-100"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setInput("");
            setOverLimit(false);
            resetDismissed();
          }}
          disabled={!input}
          className="min-h-11"
        >
          Clear input
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!canUseResult) return;
            setInput(output);
            setMode(mode === "encode" ? "decode" : "encode");
            resetDismissed();
          }}
          disabled={!canUseResult}
          className="min-h-11"
        >
          <ArrowUpDown className="mr-1 inline h-4 w-4" aria-hidden="true" /> Use result as input
        </Button>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {error ? "Invalid input." : `Output updated — ${output.length} characters.`}
      </p>
    </div>
  );
}