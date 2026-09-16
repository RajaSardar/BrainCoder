"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, X } from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";

const MAX_INPUT_LENGTH = 2 * 1024 * 1024;

type Mode = "encode" | "decode";

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const chars = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    chars[i] = String.fromCharCode(bytes[i]);
  }
  return btoa(chars.join(""));
}

function toUrlSafeBase64(str: string): string {
  return toBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function normalizeBase64(input: string): string {
  let s = input.replace(/\s+/g, "");
  if (s.includes("-") || s.includes("_")) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
  }
  const mod = s.length % 4;
  if (mod === 1) throw new Error("TruncatedBase64");
  if (mod === 2) s += "==";
  else if (mod === 3) s += "=";
  return s;
}

function fromBase64(str: string): string {
  const normalized = normalizeBase64(str);
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new Error("InvalidBase64");
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("BinaryData");
  }
}

export default function Base64Tool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const { output, error, status, isOverLimit } = useMemo(() => {
    if (input.length > MAX_INPUT_LENGTH) {
      return {
        output: "",
        error: null,
        status: "Input is limited to 2 MB.",
        isOverLimit: true,
      };
    }
    if (mode === "encode") {
      try {
        const result = urlSafe ? toUrlSafeBase64(input) : toBase64(input);
        return {
          output: result,
          error: null,
          status: input
            ? `Output ready — ${result.length} characters`
            : "Type or paste text to encode it.",
          isOverLimit: false,
        };
      } catch {
        return {
          output: "",
          error: "Could not encode that input.",
          status: "Encoding failed — check the characters and try again.",
          isOverLimit: false,
        };
      }
    }
    if (!input.trim()) {
      return {
        output: "",
        error: null,
        status: "Paste a Base64 string to decode it.",
        isOverLimit: false,
      };
    }
    try {
      const result = fromBase64(input);
      return {
        output: result,
        error: null,
        status: `Decoded — ${result.length} characters`,
        isOverLimit: false,
      };
    } catch (e) {
      const errorMessage =
        e instanceof Error && e.message === "TruncatedBase64"
          ? "That Base64 string looks truncated — its length isn't a multiple of 4 after padding."
          : e instanceof Error && e.message === "BinaryData"
            ? "That decoded to raw bytes that aren't valid UTF-8 text — the source was likely a binary file (image, archive), which can't be shown as text here."
            : "That doesn't look like valid Base64. Only letters, numbers, “+” and “/” (or “-” and “_” for URL-safe) with optional “=” padding are allowed.";
      return {
        output: "",
        error: errorMessage,
        status: "Decoding failed — check the characters and try again.",
        isOverLimit: false,
      };
    }
  }, [input, mode, urlSafe]);

  const resetDismissed = () => setErrorDismissed(false);

  const swap = () => {
    if (error || !output) return;
    setInput(output);
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    resetDismissed();
  };

  const clear = () => {
    setInput("");
    resetDismissed();
  };

  return (
    <div className="space-y-5 w-full p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Encode or decode mode</legend>
          <div
            role="radiogroup"
            aria-label="Encode or decode mode"
            className="flex rounded-xl border border-slate-200 bg-white p-1"
          >
            {(["encode", "decode"] as Mode[]).map((m) => (
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
                  mode === m ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m === "encode" ? "Encode to Base64" : "Decode from Base64"}
              </button>
            ))}
          </div>
        </fieldset>
        {mode === "encode" && (
          <label className="flex items-center gap-2.5 text-sm text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={urlSafe}
              onChange={(e) => {
                setUrlSafe(e.target.checked);
                resetDismissed();
              }}
              className="w-4 h-4 accent-violet-600"
            />
            URL-safe output (uses “-” and “_”, no padding)
          </label>
        )}
      </div>

      {error && !errorDismissed && (
        <div
          id="base64-error"
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
        <div className="flex flex-col">
          <label htmlFor="base64-input" className="text-sm font-medium text-slate-700 mb-2 self-start">
            Input
          </label>
          <StyledTextarea
            id="base64-input"
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[168px]"
            aria-invalid={error && !errorDismissed ? "true" : undefined}
            aria-describedby={error && !errorDismissed ? "base64-error" : undefined}
            placeholder={
              mode === "encode" ? "Paste text, JSON or tokens to encode…" : "Paste Base64 to decode…"
            }
          />
          {isOverLimit && (
            <p className="text-xs text-slate-500" role="status">
              Input is limited to 2 MB.
            </p>
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Output</span>
            <span className="text-xs text-slate-600">{output.length.toLocaleString()} chars</span>
            <CopyButton text={output} label="Copy result" />
          </div>
          <StyledTextarea
            id="base64-output"
            rows={8}
            value={output}
            readOnly
            tabIndex={-1}
            aria-label="Output"
            className="bg-slate-100 min-h-[168px]"
          />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {error && !errorDismissed ? "Invalid input." : isOverLimit ? "Input is over the 2 MB size limit." : status}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={clear} disabled={!input} className="min-h-11">
          Clear input
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={swap}
          disabled={!!error || !output}
          className="min-h-11"
        >
          <span className="inline-flex items-center gap-2">
            <ArrowDownUp className="w-4 h-4" /> Use result as input
          </span>
        </Button>
      </div>
    </div>
  );
}