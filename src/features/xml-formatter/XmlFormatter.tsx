"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Download, Info, Trash2 } from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  MAX_XML_CHARS,
  MAX_XML_DEPTH,
  MAX_XML_OUTPUT_CHARS,
  formatXml,
  type XmlFormatOptions,
  type XmlIndent,
  type XmlResult,
} from "./xml-format";

const EM_DASH = "\u2014";
const n = (value: number): string => value.toLocaleString("en-US");

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<users>
<user id="1"><name>Alex</name><active>true</active></user>
<user id="2"><name>Riya</name><enabled><feature flag="dark-mode"/></enabled></user>
</users>`;

/**
 * Counts and the verdict only. Error messages quote the reader's own document back, so
 * they are shown on screen and never put in a live region, which would speak a slice of
 * somebody's XML on every keystroke.
 */
function announcement(result: XmlResult, chars: number, mode: "format" | "minify"): string {
  switch (result.kind) {
    case "processed":
      return `${mode === "minify" ? "Minified" : "Formatted"}. Well-formed, ${n(result.stats.elements)} elements, ${n(result.stats.maxDepth)} levels deep.`;
    case "empty":
      return `Nothing to check. ${n(chars)} characters.`;
    case "malformed":
      return `Not well-formed, at line ${n(result.line)}, column ${n(result.column)}. Nothing was changed.`;
    case "refused":
    case "internal":
      return "Nothing was changed.";
    default:
      return "";
  }
}

function statusOf(result: XmlResult): { tone: "ok" | "warn" | "bad"; text: string } {
  switch (result.kind) {
    case "processed":
      return { tone: "ok", text: "Well-formed" };
    case "empty":
      return { tone: "warn", text: "Nothing to check" };
    case "refused":
      return { tone: "warn", text: "Not changed" };
    case "malformed":
    case "internal":
      return { tone: "bad", text: "Not well-formed" };
    default:
      return { tone: "warn", text: "" };
  }
}

const TONE_CLASS: Record<"ok" | "warn" | "bad", string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
};

export default function XmlFormatter() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [stripComments, setStripComments] = useState(false);
  const [indent, setIndent] = useState<XmlIndent>("2");

  const modeId = useId();
  const indentId = useId();
  const inputId = useId();
  const inputHintId = useId();

  const deferredInput = useDeferredValue(input);
  const busy = deferredInput !== input;

  const options: XmlFormatOptions = useMemo(
    () => ({ mode, stripComments, indent }),
    [mode, stripComments, indent],
  );

  const result = useMemo(() => formatXml(deferredInput, options), [deferredInput, options]);
  const text = result.kind === "processed" ? result.text : "";

  const malformed = result.kind === "malformed";
  const status = statusOf(result);
  const message = result.kind === "malformed" ? result.message : result.kind === "refused" || result.kind === "internal" ? result.message : "";
  const overCap = input.length > MAX_XML_CHARS;

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Re-indents structure, never rewrites text.</strong>{" "}
            Elements with only element children are indented. Anything holding text is
            reproduced byte for byte, so <code className="font-mono">pre</code> blocks, mixed
            content and attribute values come out unchanged. This checks well-formedness, which
            is not the same as validity: there is no DTD or schema check here, and the two modes
            always reach the same verdict about the same document.
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span id={modeId} className="block text-sm font-medium text-slate-700 mb-2">
            Mode
          </span>
          <div
            role="group"
            aria-labelledby={modeId}
            className="flex rounded-xl border border-slate-200 bg-white p-1"
          >
            {(["format", "minify"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                  mode === m ? "bg-amber-600 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m === "format" ? "Format" : "Minify"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={indentId} className="block text-sm font-medium text-slate-700 mb-2">
            Indent
          </label>
          <select
            id={indentId}
            value={indent}
            onChange={(e) => setIndent(e.target.value as XmlIndent)}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-300"
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="1">1 space</option>
            <option value="tab">Tab character</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-3 min-h-11">
          <input
            type="checkbox"
            checked={stripComments}
            onChange={(e) => setStripComments(e.target.checked)}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          Strip comments
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="min-h-11" onClick={() => setInput(SAMPLE)} disabled={input === SAMPLE}>
          Load sample
        </Button>
        <Button type="button" variant="secondary" className="min-h-11" onClick={() => setInput("")} disabled={input === ""}>
          <Trash2 className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          Clear
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CopyButton text={text} label="Copy XML" disabled={result.kind !== "processed"} className="min-h-11" />
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={result.kind !== "processed"}
            onClick={() => downloadBlob(new TextEncoder().encode(text), "formatted.xml", "application/xml")}
          >
            <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Download .xml
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="min-w-0">
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-2">
            XML
          </label>
          <StyledTextarea
            id={inputId}
            rows={16}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="XML input"
            aria-invalid={malformed || overCap}
            aria-describedby={inputHintId}
            placeholder="Paste XML here \u2014 nothing is pre-filled."
            className={`text-xs ${malformed || overCap ? "border-red-300" : ""}`}
          />
          <p id={inputHintId} className="mt-2 text-xs text-slate-500 break-words">
            {n(input.length)} of {n(MAX_XML_CHARS)} characters. Refused with their real numbers
            above the limit, past {n(MAX_XML_DEPTH)} levels of nesting, and past{" "}
            {n(MAX_XML_OUTPUT_CHARS)} characters of output.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap min-w-0 items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-slate-700">{mode === "format" ? "Formatted" : "Minified"}</p>
            {status.text !== "" && (
              <span className={`flex min-w-0 items-center gap-1.5 text-xs ${TONE_CLASS[status.tone]}`}>
                {status.tone === "bad" ? (
                  <CircleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                {/* No live region: this text can quote the reader's own XML back. */}
                <span className="min-w-0 break-words">
                  {message === "" ? status.text : `${status.text}: ${message}`}
                </span>
              </span>
            )}
          </div>
          <StyledTextarea
            rows={16}
            value={text}
            readOnly
            tabIndex={-1}
            placeholder={EM_DASH}
            aria-label={mode === "format" ? "Formatted XML" : "Minified XML"}
            className="bg-slate-50/50 text-xs break-words"
          />
          {result.kind === "processed" && (
            <p className="mt-2 text-xs text-slate-500 break-words">
              {n(result.stats.elements)} elements, {n(result.stats.comments)} comments, nesting{" "}
              {n(result.stats.maxDepth)}.
              {mode === "minify" && result.stats.bytesRemoved > 0 && (
                <>
                  {" "}
                  {n(result.stats.bytesRemoved)} characters removed.
                </>
              )}
            </p>
          )}
          {malformed && (
            <p className="mt-2 text-xs text-red-700">
              Line {n(result.line)}, column {n(result.column)}.
            </p>
          )}
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement(result, deferredInput.length, mode)}
      </div>
    </div>
  );
}