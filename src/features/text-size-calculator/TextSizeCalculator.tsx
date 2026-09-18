"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileUp, TerminalSquare, XCircle } from "lucide-react";
import { Button, CopyButton, Field, StyledTextarea } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { formatJson } from "@/lib/json-format";
import {
  collapseWhitespace,
  computeTextMetrics,
  countUtf8Bytes,
} from "@/lib/text-size";

const MAX_INPUT_LENGTH = 2 * 1024 * 1024;
const FILE_BYTE_CAP = 20 * 1024 * 1024;

const SAMPLE = `{
  "name": "BrainCoder",
  "tools": 123,
  "free": true,
  "tags": ["bytes", "utf8", "json"],
  "nested": { "a": [1, 2, 3] }
}`;

function roundSavings(original: number, minified: number): number {
  return Math.round(((original - minified) / original) * 100);
}

export default function TextSizeCalculator() {
  const [text, setText] = useState("");
  const [excludeWhitespace, setExcludeWhitespace] = useState(false);
  const [overLimit, setOverLimit] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [message, setMessage] = useState("");
  const [fileWarning, setFileWarning] = useState<{ name: string; size: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deferredText = useDeferredValue(text);

  const metrics = useMemo(() => computeTextMetrics(deferredText), [deferredText]);

  const jsonResult = useMemo(() => {
    if (!deferredText.trim()) return null;
    return formatJson(deferredText, 2);
  }, [deferredText]);

  const looksLikeJson = /^\{|^\[/.test(deferredText.trim());
  const isJson = jsonResult !== null && jsonResult.ok;
  const jsonError =
    jsonResult !== null && !jsonResult.ok && looksLikeJson ? jsonResult : null;

  const collapsed = useMemo(
    () => (looksLikeJson ? null : collapseWhitespace(deferredText)),
    [looksLikeJson, deferredText],
  );

  const showUtf8 = excludeWhitespace ? metrics.utf8BytesNoWhitespace : metrics.utf8Bytes;
  const showUtf16 = excludeWhitespace ? metrics.utf16BytesNoWhitespace : metrics.utf16Bytes;
  const showChars = excludeWhitespace ? metrics.charsNoWhitespace : metrics.chars;

  const cards = [
    {
      label: "Bytes (UTF-8)",
      value: formatBytes(showUtf8),
      sub: `${showUtf8.toLocaleString("en-US")} raw`,
    },
    {
      label: "Bytes (UTF-16)",
      value: formatBytes(showUtf16),
      sub: `${showUtf16.toLocaleString("en-US")} with BOM +2`,
    },
    {
      label: "Characters",
      value: showChars.toLocaleString("en-US"),
      sub: excludeWhitespace ? "excl. whitespace" : "code points",
    },
    {
      label: "Words",
      value: metrics.words.toLocaleString("en-US"),
      sub: "",
    },
    {
      label: "Lines",
      value: metrics.lines.toLocaleString("en-US"),
      sub: "",
    },
    {
      label: "Whitespace",
      value: metrics.whitespaceCount.toLocaleString("en-US"),
      sub: "spaces, tabs & newlines",
    },
    {
      label: "Min read",
      value: metrics.readingMinutes.toFixed(1),
      sub: "at 200 wpm",
    },
  ];

  const onFileChange = (file: File | undefined) => {
    if (!file) return;
    if (file.size > FILE_BYTE_CAP) {
      setMessage("That file is over 20 MB and can't be measured here.");
      return;
    }
    setFileMeta({ name: file.name, size: file.size });
    setFileWarning(null);
    setMessage("");
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      if (raw.length > MAX_INPUT_LENGTH) {
        setMessage("That file is over 2 MB of text and can't be loaded.");
        setFileMeta(null);
        return;
      }
      setText(raw);
      const placeholders = (raw.match(/\uFFFD/g) ?? []).length;
      if (placeholders > 20) {
        setFileWarning({ name: file.name, size: file.size });
      }
    };
    reader.onerror = () => setMessage("That file couldn't be read.");
    reader.readAsText(file, "utf-8");
  };

  const toggling = (checked: boolean) => {
    setExcludeWhitespace(checked);
    if (checked) {
      setMessage(
        `Whitespace excluded — ${metrics.whitespaceCount.toLocaleString("en-US")} characters removed.`,
      );
    } else {
      setMessage("");
    }
  };

  return (
    <div className="space-y-5 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.text,.json,.csv,.tsv,.log,.md,.js,.ts,.html,.css,.xml,.yaml,.yml,.toml,.ini,.py,.go,.sql,text/*"
        className="hidden"
        aria-label="Open a text file"
        onChange={(e) => {
          onFileChange(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-11"
        >
          <FileUp className="w-4 h-4 mr-1.5 inline" />
          Open file
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setText(SAMPLE);
            setMessage("");
            setFileMeta(null);
            setFileWarning(null);
            setExcludeWhitespace(false);
          }}
          className="min-h-11"
        >
          Sample
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setText("");
            setMessage("");
            setFileMeta(null);
            setFileWarning(null);
            setExcludeWhitespace(false);
            setOverLimit(false);
          }}
          disabled={!text && !fileMeta}
          className="min-h-11"
        >
          Clear
        </Button>
        {fileMeta && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-1 font-mono">
            {fileMeta.name} · {formatBytes(fileMeta.size)} on disk
          </span>
        )}
      </div>

      {fileWarning && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm"
        >
          &quot;{fileWarning.name}&quot; doesn&apos;t look like plain text — some characters
          couldn&apos;t be read as UTF-8.
        </div>
      )}

      {message && (
        <p role="status" className="text-sm text-slate-600">
          {message}
        </p>
      )}

      <Field label="Text to measure">
        <StyledTextarea
          rows={8}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            if (next.length > MAX_INPUT_LENGTH) {
              setOverLimit(true);
              return;
            }
            setOverLimit(false);
            setText(next);
          }}
          placeholder="Paste or type any text — plain text, code, JSON, logs, config…"
          aria-label="Text to measure"
        />
      </Field>

      {overLimit && (
        <p role="status" className="text-sm text-slate-600">
          Input is limited to 2 MB.
        </p>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={excludeWhitespace}
          onChange={(e) => toggling(e.target.checked)}
          className="min-h-11 accent-indigo-600 rounded"
          aria-label="Exclude whitespace from size"
        />
        <span className="text-sm">
          <span className="font-medium text-slate-700">Exclude whitespace from size</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            Counts spaces, tabs and newlines as removed from the UTF-8, UTF-16 and character totals.
          </span>
        </span>
      </label>

      {deferredText.trim() !== "" && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            isJson
              ? "bg-green-50 text-green-700 border border-green-200"
              : looksLikeJson
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {isJson ? (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {isJson
            ? "Valid JSON — minify & beautify ready"
            : looksLikeJson
              ? "Invalid JSON"
              : "Plain text — metrics only"}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-white border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">{c.value}</p>
              <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              {c.sub && <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Size breakdown</p>
        <ul className="text-xs text-slate-500 space-y-1 font-mono">
          <li>
            UTF-8: {countUtf8Bytes(deferredText).toLocaleString("en-US")} B · + 3 B with BOM (
            {formatBytes(countUtf8Bytes(deferredText))})
          </li>
          <li>
            UTF-16: {metrics.utf16Bytes.toLocaleString("en-US")} B · + 2 B with BOM (
            {formatBytes(metrics.utf16Bytes)})
          </li>
          <li>
            Unicode code points: {metrics.chars.toLocaleString("en-US")} · UTF-16 code units:{" "}
            {deferredText.length.toLocaleString("en-US")}
          </li>
          {/\r\n/.test(deferredText) && (
            <li className="text-amber-600">
              CRLF line endings detected — every line counts 1 extra byte vs LF.
            </li>
          )}
          {/\uFEFF/.test(deferredText) && (
            <li className="text-amber-600">UTF-8 BOM detected at the start of the input.</li>
          )}
        </ul>
      </div>

      {jsonError && !isJson && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-mono"
        >
          {jsonError.error}
          {jsonError.line !== null && jsonError.column !== null
            ? ` (line ${jsonError.line}, column ${jsonError.column})`
            : ""}
        </div>
      )}

      {isJson && jsonResult !== null && jsonResult.ok && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Beautified</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">{formatBytes(countUtf8Bytes(jsonResult.formatted))}</span>
                <CopyButton
                  text={jsonResult.formatted}
                  label="Copy beautified"
                  className="min-h-11"
                />
              </div>
            </div>
            <StyledTextarea
              rows={8}
              value={jsonResult.formatted}
              readOnly
              tabIndex={-1}
              aria-label="Beautified JSON output"
              className="bg-slate-100"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Minified</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">
                  {formatBytes(countUtf8Bytes(jsonResult.minified))} ·{" "}
                  {roundSavings(countUtf8Bytes(deferredText), countUtf8Bytes(jsonResult.minified))}%
                  smaller
                </span>
                <CopyButton
                  text={jsonResult.minified}
                  label="Copy minified"
                  className="min-h-11"
                />
              </div>
            </div>
            <StyledTextarea
              rows={3}
              value={jsonResult.minified}
              readOnly
              tabIndex={-1}
              aria-label="Minified JSON output"
              className="bg-slate-100"
            />
          </div>
        </div>
      )}

      {!looksLikeJson && text.trim() !== "" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-700 mb-1">
            Approx. minify (whitespace collapse only)
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Minify and beautify require valid JSON. For plain text, only whitespace can be
            collapsed — comments and syntax are left untouched.
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-600">
              {collapsed !== null && collapsed !== text
                ? `${formatBytes(countUtf8Bytes(deferredText))} → ${formatBytes(countUtf8Bytes(collapsed))} (${
                    roundSavings(countUtf8Bytes(deferredText), countUtf8Bytes(collapsed))
                  }% smaller)`
                : "No whitespace to collapse"}
            </span>
            <CopyButton
              text={collapsed ?? ""}
              label="Copy collapsed"
              className="min-h-11"
              disabled={collapsed === null || collapsed === text}
            />
          </div>
          {collapsed !== null && collapsed !== text && (
            <StyledTextarea
              rows={4}
              value={collapsed}
              readOnly
              tabIndex={-1}
              aria-label="Collapsed whitespace output"
              className="bg-slate-100"
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <TerminalSquare className="w-3.5 h-3.5" /> UTF-8 via the TextEncoder API; UTF-16 via
        JavaScript string code units. Everything stays in your browser.
      </div>
    </div>
  );
}