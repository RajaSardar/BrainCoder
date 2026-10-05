"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Download, Info, Trash2 } from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  DEFAULT_SQL_DIALECT,
  MAX_SQL_CHARS,
  MAX_SQL_COMMENT_DEPTH,
  MAX_SQL_DEPTH,
  SQL_DIALECTS,
  formatSql,
  type IndentChoice,
  type KeywordCase,
  type SqlFormatOptions,
  type SqlFormatResult,
} from "./sql-format";

const EM_DASH = "\u2014";
const n = (value: number): string => value.toLocaleString("en-US");

const SAMPLE = `SELECT u.id, u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = 1 AND o.created_at >= '2026-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 2
ORDER BY orders DESC
LIMIT 10;`;

/**
 * Counts and verdicts only. The formatter's own parse message quotes the reader's
 * payload back at them, so putting it in a live region would speak a slice of
 * somebody's query on every keystroke. It is shown on screen instead, unannounced.
 */
function announcement(result: SqlFormatResult, chars: number): string {
  switch (result.kind) {
    case "formatted":
      return `Formatted. ${n(result.sql.length)} characters from ${n(chars)}.`;
    case "empty":
      return "Empty. Nothing to format.";
    case "invalid-sql":
    case "refused":
    case "internal":
      return "Nothing was formatted.";
    default:
      return "";
  }
}

function statusOf(result: SqlFormatResult): { tone: "ok" | "warn" | "bad"; text: string } {
  switch (result.kind) {
    case "formatted":
      return { tone: "ok", text: "Formatted" };
    case "empty":
      return { tone: "warn", text: "Nothing to format" };
    case "refused":
      return { tone: "warn", text: "Not formatted" };
    case "invalid-sql":
    case "internal":
      return { tone: "bad", text: result.kind === "internal" ? "Internal error" : "Not formatted" };
    default:
      return { tone: "warn", text: "" };
  }
}

const TONE_CLASS: Record<"ok" | "warn" | "bad", string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
};

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

function SelectField({ id, label, value, onChange, children }: SelectFieldProps) {
  return (
    <div>
      {/* A real <label htmlFor>. The shared `Field` renders a <p>, which leaves the
          select with no accessible name at all. */}
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-300"
      >
        {children}
      </select>
    </div>
  );
}

export default function SqlFormatter() {
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState(DEFAULT_SQL_DIALECT);
  const [keywordCase, setKeywordCase] = useState<KeywordCase>("upper");
  const [indent, setIndent] = useState<IndentChoice>("2");
  const [linesBetweenQueries, setLinesBetweenQueries] = useState(1);

  const languageId = useId();
  const keywordCaseId = useId();
  const indentId = useId();
  const linesId = useId();
  const inputId = useId();
  const inputHintId = useId();

  // Formatting is synchronous and local. Deferring it keeps the caret moving while a
  // large query is being formatted, which is the difference between a usable tab and
  // one that appears to hang on every keypress.
  const deferredInput = useDeferredValue(input);
  const busy = deferredInput !== input;

  const options: SqlFormatOptions = useMemo(
    () => ({ language, keywordCase, indent, linesBetweenQueries }),
    [language, keywordCase, indent, linesBetweenQueries],
  );

  const result = useMemo(() => formatSql(deferredInput, options), [deferredInput, options]);
  const sql = result.kind === "formatted" ? result.sql : "";

  const invalid = result.kind === "invalid-sql";
  const status = statusOf(result);
  const message =
    result.kind === "invalid-sql" || result.kind === "refused" || result.kind === "internal"
      ? result.message
      : "";

  const overCap = input.length > MAX_SQL_CHARS;

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Formatting cannot repair a query.</strong> This
            page re-indents and re-cases what you paste and reports when it cannot read it. It
            will not close a bracket, finish a string or guess a dialect, and it refuses rather
            than return SQL with different tokens than you gave it. Dialect matters: it is set
            to <strong className="font-semibold">PostgreSQL</strong> until you change it.
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SelectField id={languageId} label="SQL dialect" value={language} onChange={(v) => setLanguage(v as SqlFormatOptions["language"])}>
          {SQL_DIALECTS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </SelectField>

        <SelectField id={keywordCaseId} label="Keyword case" value={keywordCase} onChange={(v) => setKeywordCase(v as KeywordCase)}>
          <option value="upper">UPPERCASE</option>
          <option value="lower">lowercase</option>
          <option value="preserve">Preserve as written</option>
        </SelectField>

        <SelectField id={indentId} label="Indent" value={indent} onChange={(v) => setIndent(v as IndentChoice)}>
          {/* A literal tab character cannot be a JSX attribute value: `value="\t"` is
              two characters, a backslash and a t, so the old Tab option silently did
              nothing. These are sentinels and the module turns them into useTabs. */}
          <option value="2">2 spaces</option>
          <option value="4">4 spaces</option>
          <option value="tab">Tab character</option>
        </SelectField>

        <SelectField
          id={linesId}
          label="Blank lines between queries"
          value={String(linesBetweenQueries)}
          onChange={(v) => setLinesBetweenQueries(Number(v))}
        >
          <option value="0">None</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </SelectField>
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
          <CopyButton
            text={sql}
            label="Copy SQL"
            disabled={result.kind !== "formatted"}
            className="min-h-11"
          />
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={result.kind !== "formatted"}
            onClick={() => downloadBlob(new TextEncoder().encode(sql), "formatted.sql", "text/plain")}
          >
            <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Download .sql
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="min-w-0">
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-2">
            SQL
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
            aria-label="SQL input"
            aria-invalid={invalid || overCap}
            aria-describedby={inputHintId}
            placeholder="Paste SQL here \u2014 nothing is pre-filled."
            className={`text-xs ${invalid || overCap ? "border-red-300" : ""}`}
          />
          <p id={inputHintId} className="mt-2 text-xs text-slate-500 break-words">
            {n(input.length)} of {n(MAX_SQL_CHARS)} characters. Refused with their real numbers
            above the limit, past {n(MAX_SQL_DEPTH)} levels of parentheses, and past{" "}
            {n(MAX_SQL_COMMENT_DEPTH)} levels of nested block comment.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap min-w-0 items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-slate-700">Formatted</p>
            {status.text !== "" && (
              <span className={`flex min-w-0 items-center gap-1.5 text-xs ${TONE_CLASS[status.tone]}`}>
                {status.tone === "bad" ? (
                  <CircleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                {/* No live region here: this text can quote the reader's own query back. */}
                <span className="min-w-0 break-words">
                  {message === "" ? status.text : `${status.text}: ${message}`}
                </span>
              </span>
            )}
          </div>
          <StyledTextarea
            rows={16}
            value={sql}
            readOnly
            tabIndex={-1}
            placeholder={EM_DASH}
            aria-label="Formatted SQL"
            className="bg-slate-50/50 text-xs break-words"
          />
          {result.kind === "formatted" && (
            <p className="mt-2 text-xs text-slate-500 break-words">
              {n(sql.length)} characters of formatted SQL.
            </p>
          )}
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement(result, deferredInput.length)}
      </div>
    </div>
  );
}