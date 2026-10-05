"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Download, Info, Trash2 } from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  MAX_INPUT_CHARS,
  MAX_JSON_DEPTH,
  MAX_NODES,
  MAX_OUTPUT_CHARS,
  emitTypeScript,
  parseJsonShape,
  typeNameFor,
  type JsonToTypeScriptResult,
} from "./json-to-typescript";

const EM_DASH = "\u2014";

const n = (value: number): string => value.toLocaleString("en-US");

const SAMPLE = `{
  "id": 1,
  "name": "Alex",
  "isAdmin": true,
  "email": "alex@example.com",
  "roles": ["admin", "user"],
  "profile": {
    "age": 29,
    "address": {
      "city": "Mumbai",
      "zip": "400001"
    }
  },
  "lastLogin": null
}`;

/** Counts only — never the parse message, which quotes the reader's own payload. */
function announcement(result: JsonToTypeScriptResult): string {
  switch (result.kind) {
    case "generated":
      return `Generated ${n(result.interfaceCount)} interfaces and ${n(result.fieldCount)} fields.`;
    case "invalid-json":
      return "That JSON could not be parsed.";
    case "refused":
    case "internal":
      return "Nothing was converted.";
    default:
      return "";
  }
}

/**
 * V8 puts the failure position in the message for most syntax errors and in
 * nothing at all for a few, so the position is shown when there is one and left
 * off when there is not. Inventing one would be worse than admitting its absence.
 */
function withPosition(message: string, line: number | null, column: number | null): string {
  if (line === null || column === null) return message;
  return `${message} (line ${n(line)}, column ${n(column)})`;
}

function statusOf(result: JsonToTypeScriptResult): {
  tone: "ok" | "warn" | "bad";
  text: string;
} {
  switch (result.kind) {
    case "generated":
      return result.problem === null
        ? { tone: "ok", text: "Generated" }
        : { tone: "warn", text: `Generated, but ${result.problem}` };
    case "invalid-json":
      return { tone: "bad", text: "Could not be parsed" };
    case "refused":
      return { tone: "warn", text: "Not converted" };
    case "internal":
      return { tone: "bad", text: "Internal error" };
    default:
      return { tone: "warn", text: "" };
  }
}

const TONE_CLASS: Record<"ok" | "warn" | "bad", string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
};

export default function JsonToTypeScript() {
  const [input, setInput] = useState("");
  const [rootName, setRootName] = useState("User");
  const nameId = useId();
  const hintId = useId();

  const deferredInput = useDeferredValue(input);

  // Two memos, not one. Inference is the expensive half and depends only on the
  // deferred input; the old single memo re-walked the whole document on every
  // keystroke of the root-name box.
  const parsed = useMemo(() => parseJsonShape(deferredInput), [deferredInput]);
  const named = useMemo(() => typeNameFor(rootName), [rootName]);
  const result: JsonToTypeScriptResult = useMemo(
    () => (parsed.kind === "parsed" ? emitTypeScript(parsed.shape, named.name) : parsed),
    [parsed, named.name],
  );

  const code = result.kind === "generated" ? result.code : "";
  // A refusal is as much a verdict on the input as a parse failure is: the box
  // holds something this page will not convert, and a screen reader should hear
  // that from the field itself rather than only from the panel beside it.
  const invalid = result.kind === "invalid-json" || result.kind === "refused";
  const status = statusOf(result);
  const message =
    result.kind === "invalid-json"
      ? withPosition(result.message, result.line, result.column)
      : result.kind === "refused" || result.kind === "internal"
        ? result.message
        : result.kind === "generated" && result.problem !== null
          ? result.problem
          : "";

  return (
    // Inference is synchronous and local: there is no pending state to announce,
    // and `aria-busy={false}` says exactly that rather than inventing work.
    <div className="space-y-5 w-full" aria-busy={false}>
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>
            <strong className="font-semibold">A first draft from one sample.</strong> Types come
            from the JSON you pasted and nothing else. A key your sample does not show is not
            marked optional. Every number is <code className="font-mono">number</code>. A date, a
            UUID or an enum reads as <code className="font-mono">string</code>. An array whose
            elements do not agree becomes a union of what was actually seen. Read it, then tighten
            it: this is a starting point to edit, not a schema you can rely on unchecked.
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          {/* A real <label htmlFor>, not the shared `Field`, which renders a <p>
              and leaves the input with no accessible name at all. */}
          <label htmlFor={nameId} className="block text-sm font-medium text-slate-700 mb-2">
            Root type name
          </label>
          <input
            id={nameId}
            type="text"
            value={rootName}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setRootName(e.target.value)}
            className="w-48 min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => setInput(SAMPLE)}
            disabled={input === SAMPLE}
          >
            Load sample
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => setInput("")}
            disabled={input === ""}
          >
            <Trash2 className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Clear
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 pb-0.5">
          <CopyButton
            text={code}
            label="Copy TypeScript"
            disabled={result.kind !== "generated"}
            className="min-h-11"
          />
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={result.kind !== "generated"}
            onClick={() =>
              downloadBlob(
                new TextEncoder().encode(code),
                `${named.name}.ts`,
                "text/plain",
              )
            }
          >
            <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Download {named.name}.ts
          </Button>
        </div>
      </div>

      {named.warning && (
        <p className="text-xs text-amber-700 break-words">{named.warning}</p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 mb-2">JSON</p>
          <StyledTextarea
            rows={16}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label="JSON input"
            aria-invalid={invalid}
            aria-describedby={hintId}
            placeholder="Paste one JSON object, array or value here \u2014 nothing is pre-filled."
            className={invalid ? "border-red-300" : ""}
          />
          <p id={hintId} className="mt-2 text-xs text-slate-500 break-words">
            {n(input.length)} of {n(MAX_INPUT_CHARS)} characters. One sample only: a field missing
            from it is not marked optional, so widen the sample before you trust the output. Caps
            are refused with their real numbers — {n(MAX_JSON_DEPTH)} nesting levels,{" "}
            {n(MAX_NODES)} values, {n(MAX_OUTPUT_CHARS)} characters of generated code.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap min-w-0 items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-slate-700">TypeScript</p>
            {status.text !== "" && (
              <span
                className={`flex min-w-0 items-center gap-1.5 text-xs ${TONE_CLASS[status.tone]}`}
              >
                {status.tone === "bad" ? (
                  <CircleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                {/* No role: this text quotes the V8 parse message, which embeds a slice
                    of the reader's own payload, and a live region would speak it on
                    every keystroke. The sr-only region below announces counts only. */}
                <span className="min-w-0 break-words">{message === "" ? status.text : `${status.text}: ${message}`}</span>
              </span>
            )}
          </div>
          <StyledTextarea
            rows={16}
            value={code}
            readOnly
            tabIndex={-1}
            placeholder={EM_DASH}
            aria-label="Generated TypeScript types"
            className="bg-slate-50/50 text-xs break-words"
          />
          {result.kind === "generated" && (
            <p className="mt-2 text-xs text-slate-500 break-words">
              {n(result.interfaceCount)} interfaces, {n(result.fieldCount)} fields,{" "}
              {n(code.length)} characters.
            </p>
          )}
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement(result)}
      </div>
    </div>
  );
}
