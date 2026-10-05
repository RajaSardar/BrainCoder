"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  CircleAlert,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Table2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { ANOMALY_EXPLANATION, ANOMALY_LABEL } from "./csv-parse";
import type { CsvAnomaly } from "./csv-parse";
import {
  CAP_SUMMARY,
  CELL_PREVIEW_CHARS,
  DELIMITER_CHOICES,
  EM_DASH,
  INDENT_CHOICES,
  MAX_FIELD_LABEL,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
  MAX_INPUT_CHARS,
  MAX_INPUT_LABEL,
  MAX_COLUMNS_LABEL,
  MAX_ROWS_LABEL,
  JsonRow,
  cellPreview,
  convertCsv,
  countReplacementChars,
  describeByteSize,
  formatInt,
  jsonPreview,
  outputNameFor,
} from "./csv-format";
import type { DetectionConfidence, Indent } from "./csv-format";

const CONFIDENCE_TONE: Record<DetectionConfidence, string> = {
  none: "text-slate-600",
  low: "text-amber-700",
  medium: "text-amber-700",
  high: "text-emerald-700",
};

const CONFIDENCE_WORD: Record<DetectionConfidence, string> = {
  // "none" means the sample held no candidate delimiter at all, so nothing was
  // detected and nothing was chosen: a comma is only used as a placeholder.
  none: "no delimiter needed",
  low: "not confident",
  medium: "reasonably confident",
  high: "confident",
};

function Panel({
  title,
  children,
  tone = "plain",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "plain" | "warn";
}) {
  return (
    <section
      role="region"
      aria-label={title}
      className={`rounded-2xl border overflow-hidden ${
        tone === "warn" ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <h3
        className={`border-b px-4 py-2.5 text-sm font-semibold ${
          tone === "warn" ? "border-amber-100 text-amber-900" : "border-slate-100 text-slate-800"
        }`}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{term}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

export default function CsvJson() {
  const [text, setText] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourceBytes, setSourceBytes] = useState<number | null>(null);
  const [delimiterMode, setDelimiterMode] = useState<string>("auto");
  const [hasHeader, setHasHeader] = useState(true);
  const [indent, setIndent] = useState<Indent>(2);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");

  const inputId = useId();
  const hintId = useId();
  const delimiterId = useId();
  const headerId = useId();
  const headerHintId = useId();
  const indentId = useId();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  // The conversion is synchronous and bounded by the caps, so there is no
  // pending state to wait for between a keystroke and a result.
  const result = useMemo(
    () => convertCsv(text, { delimiterMode, hasHeader, indent }),
    [text, delimiterMode, hasHeader, indent],
  );

  const converted = result.kind === "converted" ? result : null;
  const replacementChars = useMemo(
    () => (text.length > 0 ? countReplacementChars(text) : 0),
    [text],
  );
  const overCap = text.length > MAX_INPUT_CHARS;

  const json = converted ? jsonPreview(converted.json) : null;
  const filename = converted
    ? outputNameFor(sourceName, converted.dataRows, converted.columns)
    : "data-to-json.json";
  const shownColumns = converted ? Math.min(converted.columns, 8) : 0;
  const shownRows = converted ? converted.previewRows.length : 0;

  const clearAll = () => {
    if (fileRef.current) fileRef.current.value = "";
    setText("");
    setSourceName(null);
    setSourceBytes(null);
    setFileError("");
    setBusy(false);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError("");
    // The size is read before the bytes are, so an oversize file costs a stat.
    if (file.size > MAX_FILE_BYTES) {
      setFileError(
        `That file is ${describeByteSize(file.size)}. The cap for an opened file is ${MAX_FILE_LABEL}, and it was not read. Paste the text instead, or split the file.`,
      );
      return;
    }
    setBusy(true);
    try {
      // Decode the bytes directly rather than through file.text(), which strips a
      // leading byte order mark and rewrites CRLF. Decoding here keeps the BOM so
      // the parser can report that it skipped one, and keeps a lossy decode
      // visible instead of silently substituting replacement characters.
      const bytes = new Uint8Array(await file.arrayBuffer());
      // ignoreBOM is true so the leading U+FEFF stays in the string: the parser
      // strips it and records that it did, which is what the disclosure reports.
      setText(new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(bytes));
      setSourceName(file.name);
      setSourceBytes(file.size);
    } catch {
      setFileError(`“${file.name}” could not be read from disk. Nothing was converted.`);
    } finally {
      setBusy(false);
    }
  };

  const statusText = !converted
    ? "Nothing converted yet."
    : converted.dataRows === 0
      ? `No rows converted. ${formatInt(converted.inputRecords)} record${converted.inputRecords === 1 ? "" : "s"} read. Every value in the output is a JSON string.`
      : `Converted ${formatInt(converted.dataRows)} row${converted.dataRows === 1 ? "" : "s"} into ${formatInt(
          converted.columns,
        )} column${converted.columns === 1 ? "" : "s"} — ${describeByteSize(converted.jsonBytes)} of JSON. Every value is a JSON string.`;

  const raggedTotal = converted ? converted.ragged.shortRows + converted.ragged.longRows : 0;

  return (
    <div className="w-full space-y-4" aria-busy={busy}>
      <input
        ref={fileRef}
        id={fileId}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
        className="sr-only peer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (fileRef.current) fileRef.current.value = "";
          if (file) void handleFile(file);
        }}
      />

      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm text-amber-900">
          <strong className="font-bold">Every value stays a string.</strong> This converter does
          not guess types, so <code>00123</code> stays <code>&quot;00123&quot;</code>,{" "}
          <code>TRUE</code> stays <code>&quot;TRUE&quot;</code> and <code>3/4/26</code> stays{" "}
          <code>&quot;3/4/26&quot;</code> — a zip code keeps its zeros and a date is not silently
          reformatted. The only <code>null</code> values in the output are the cells a short row never
          had. It is a re-serialisation of your text, not a spreadsheet: your CSV is read in this tab
          and is never uploaded.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          CSV input
        </label>
        <StyledTextarea
          id={inputId}
          rows={12}
          value={text}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setSourceName(null);
            setSourceBytes(null);
          }}
          aria-describedby={hintId}
          aria-invalid={overCap}
          placeholder="Paste CSV here, or open a file above — no sample data is loaded"
          className={`text-xs ${overCap ? "border-red-400" : ""}`}
        />
        <p id={hintId} className="text-xs text-slate-500">
          {sourceName ? (
            <>
              Loaded from <span className="font-medium text-slate-700">{sourceName}</span>
              {sourceBytes !== null ? ` (${describeByteSize(sourceBytes)})` : ""} — decoded as UTF-8.
              Typing below replaces it.
            </>
          ) : (
            "Paste or type CSV, or open a file. Nothing is pre-filled."
          )}{" "}
          {overCap ? (
            <span className="font-medium text-red-700">
              {formatInt(text.length)} characters — over the {MAX_INPUT_LABEL} cap, so nothing is
              parsed.
            </span>
          ) : (
            `Caps: ${CAP_SUMMARY}. Every one is refused with its real numbers before any parsing work starts.`
          )}
        </p>
        {replacementChars > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              This input holds {formatInt(replacementChars)} U+FFFD replacement character
              {replacementChars === 1 ? "" : "s"}, which almost always means the bytes were not valid
              UTF-8 — Windows-1252 and Latin-1 exports look like this. There is no encoding picker,
              so those characters are converted as if they were really in the file. Re-save the file
              as UTF-8, or paste the text.
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={fileId} className="sr-only">
          Open a .csv, .tsv or .txt file
        </label>
        <label
          htmlFor={fileId}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          Open CSV file
        </label>

        <div>
          <label htmlFor={delimiterId} className="mb-1 block text-xs font-medium text-slate-600">
            Delimiter
          </label>
          <select
            id={delimiterId}
            value={delimiterMode}
            aria-describedby={hintId}
            onChange={(e) => setDelimiterMode(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <option value="auto">Auto-detect</option>
            {DELIMITER_CHOICES.map((d) => (
              <option key={d.id} value={d.char}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={indentId} className="mb-1 block text-xs font-medium text-slate-600">
            JSON indentation
          </label>
          <select
            id={indentId}
            value={String(indent)}
            onChange={(e) => setIndent(Number(e.target.value) === 4 ? 4 : 2)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {INDENT_CHOICES.map((n) => (
              <option key={n} value={String(n)}>
                {n} spaces
              </option>
            ))}
          </select>
        </div>

        <div className="pb-1">
          <input
            id={headerId}
            type="checkbox"
            checked={hasHeader}
            aria-describedby={headerHintId}
            onChange={(e) => setHasHeader(e.target.checked)}
            className="mr-2 h-4 w-4 accent-indigo-600 align-middle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          />
          <label htmlFor={headerId} className="text-sm text-slate-700">
            First row is the header
          </label>
          <p id={headerHintId} className="mt-1 max-w-xs text-xs text-slate-500">
            {hasHeader
              ? "Header cells become the keys. Turn this off and the keys are generated as column1, column2, …"
              : "Keys are generated as column1, column2, … and the header row, if there is one, becomes the first data row."}
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={clearAll} className="ml-auto">
          <Trash2 className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Clear
        </Button>
      </div>

      {fileError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fileError}
        </div>
      )}

      {result.kind === "refused" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <strong className="font-semibold">Not converted.</strong> {result.message}
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {statusText}
      </div>

      {result.kind === "empty" && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <Table2 className="mx-auto mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">
            Paste CSV above, or open a file, and the JSON appears here.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Rows {EM_DASH} columns {EM_DASH} JSON size {EM_DASH} no sample CSV is pre-filled, so
            nothing on this page can be mistaken for your data.
          </p>
        </div>
      )}

      {converted && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              term="Rows converted"
              value={
                converted.dataRows === 0 ? (
                  <span className="text-slate-400">{EM_DASH}</span>
                ) : (
                  formatInt(converted.dataRows)
                )
              }
            />
            <Stat
              term="Columns"
              value={
                converted.columns === 0 ? (
                  <span className="text-slate-400">{EM_DASH}</span>
                ) : (
                  formatInt(converted.columns)
                )
              }
            />
            <Stat
              term="JSON size"
              value={converted.jsonBytes === 0 ? <span className="text-slate-400">{EM_DASH}</span> : describeByteSize(converted.jsonBytes)}
            />
            <Stat
              term="Records read"
              value={
                converted.inputRecords === 0 ? (
                  <span className="text-slate-400">{EM_DASH}</span>
                ) : (
                  formatInt(converted.inputRecords)
                )
              }
            />
          </dl>

          <Panel title="What was decided">
            <ul className="space-y-1.5 px-4 py-3 text-xs text-slate-600">
              {converted.notes.map((note) => (
                <li key={note} className="break-words">
                  {note}
                </li>
              ))}
              <li className="break-words">
                Delimiter:{" "}
                <span className={`font-semibold ${CONFIDENCE_TONE[converted.confidence]}`}>
                  {converted.delimiterSpoken} (
                  {converted.delimiterMode === "auto"
                    ? `${CONFIDENCE_WORD[converted.confidence]}${converted.confidence === "none" ? "" : ", auto-detected"}`
                    : "set by hand"}
                  )
                </span>{" "}
                — the header above shows you the keys this produced.
              </li>
              {raggedTotal > 0 && (
                <li className="break-words font-medium text-amber-800">
                  {formatInt(raggedTotal)} ragged row{raggedTotal === 1 ? "" : "s"}:{" "}
                  {formatInt(converted.ragged.shortRows)} short (
                  {formatInt(converted.ragged.paddedCells)} cell
                  {converted.ragged.paddedCells === 1 ? "" : "s"} padded as JSON null) and{" "}
                  {formatInt(converted.ragged.longRows)} long (
                  {formatInt(converted.ragged.surplusCells)} surplus value
                  {converted.ragged.surplusCells === 1 ? "" : "s"} in{" "}
                  <code>{converted.plan.surplusKey}</code>).
                </li>
              )}
            </ul>
          </Panel>

          {converted.anomalies.length > 0 && (
            <Panel title={`Quoting anomalies (${formatInt(converted.anomalies.length)})`} tone="warn">
              <p className="px-4 pt-3 text-xs text-amber-900">
                Nothing was thrown away. Every one of these is a place where RFC 4180 says the file is
                malformed; the cell text was kept and the position is named so you can decide.
              </p>
              <ul className="mt-2 space-y-2 px-4 pb-3 text-xs text-amber-900">
                {converted.anomalies.slice(0, 12).map((a: CsvAnomaly) => (
                  <li key={`${a.kind}-${a.position}`} className="break-words">
                    <span className="font-semibold">{ANOMALY_LABEL[a.kind]}</span> — {a.detail}{" "}
                    <span className="text-amber-700">{ANOMALY_EXPLANATION[a.kind]}</span>
                  </li>
                ))}
              </ul>
              {converted.anomalies.length > 12 && (
                <p className="border-t border-amber-100 px-4 py-2 text-xs text-amber-900">
                  The first 12 of {formatInt(converted.anomalies.length)} are listed. All{" "}
                  {formatInt(converted.anomalies.length)} were found — the count above is the real
                  total, not the number shown.
                </p>
              )}
            </Panel>
          )}

          <Panel title="JSON output">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs text-slate-500">
                {formatInt(converted.jsonChars)} characters, {converted.indent}-space indentation
              </span>
              <span className="ml-auto flex gap-2">
                <CopyButton text={converted.json} ariaLabel="Copy the JSON output" />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    downloadBlob(
                      new TextEncoder().encode(converted.json),
                      filename,
                      "application/json",
                    )
                  }
                >
                  <Download className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                  Download {filename}
                </Button>
              </span>
            </div>
            <pre
              tabIndex={0}
              aria-label="JSON output preview"
              className="max-h-96 overflow-auto whitespace-pre-wrap break-all px-4 py-3 text-xs font-mono text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {json && json.text}
            </pre>
            {json && json.truncated && (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-amber-800">
                Preview only: the first {formatInt(json.text.length)} of{" "}
                {formatInt(json.total)} characters are rendered above. The text above is therefore not
                valid JSON on its own — Copy and Download give you the complete{" "}
                {describeByteSize(converted.jsonBytes)} document.
              </p>
            )}
          </Panel>

          {converted.columns > 0 && (
            <Panel
              title={`Data preview — first ${formatInt(shownRows)} of ${formatInt(
                converted.dataRows,
              )} row${converted.dataRows === 1 ? "" : "s"}, first ${formatInt(shownColumns)} of ${formatInt(
                converted.columns,
              )} column${converted.columns === 1 ? "" : "s"}`}
            >
              <p className="px-4 pt-3 text-xs text-slate-500">
                Cell text is rendered exactly as the CSV spells it, shortened to{" "}
                {formatInt(CELL_PREVIEW_CHARS)} characters for display. The JSON output above holds
                every character of every row.
              </p>
              <div className="overflow-x-auto px-4 pb-4 pt-2">
                <table className="w-full min-w-max border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Preview of the first {formatInt(shownRows)} converted rows and{" "}
                    {formatInt(shownColumns)} columns
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-700">
                        #
                      </th>
                      {converted.keys.slice(0, shownColumns).map((key) => (
                        <th
                          key={key}
                          scope="col"
                          className="border-b border-slate-200 px-2 py-1.5 font-mono font-semibold text-slate-700"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {converted.previewRows.map((row: JsonRow, index: number) => (
                      <tr key={index} className="align-top">
                        <td className="border-b border-slate-100 px-2 py-1.5 font-mono text-slate-400">
                          {formatInt(index + 1)}
                        </td>
                        {converted.keys.slice(0, shownColumns).map((key) => {
                          const cell = cellPreview(row[key]);
                          return (
                            <td
                              key={key}
                              className={`border-b border-slate-100 px-2 py-1.5 font-mono break-all ${
                                cell.text === EM_DASH ? "text-slate-400 italic" : "text-slate-700"
                              }`}
                            >
                              {cell.text}
                              {cell.truncated && (
                                <span className="ml-1 font-sans text-amber-700">
                                  (cell is {formatInt(cell.total)} characters)
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {converted.previewRows.length < converted.dataRows && (
                  <p className="mt-2 text-xs text-slate-500">
                    Showing {formatInt(converted.previewRows.length)} of {formatInt(converted.dataRows)}{" "}
                    rows and {formatInt(shownColumns)} of {formatInt(converted.columns)} columns.
                    The JSON output is complete — the table is a preview.
                  </p>
                )}
              </div>
            </Panel>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          Converted in this tab — your CSV is never uploaded, and no request is made with it.
        </span>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-800">
          This conversion is not lossless, and here is exactly where it changes your data.
        </p>
        <p>
          <strong className="font-semibold">Preserved:</strong> every cell&apos;s text character for
          character, including leading and trailing spaces, embedded delimiters, embedded line breaks
          and doubled quotes; the order of the rows; and the order of the columns.
        </p>
        <p>
          <strong className="font-semibold">Changed on purpose:</strong> no type is inferred — all
          values are JSON strings. Keys come from the header row with surrounding whitespace trimmed,
          or are generated as <code>column1…columnN</code>. Empty header cells become{" "}
          <code>columnN</code> for their position. Duplicate header names become{" "}
          <code>name (2)</code>, <code>name (3)</code> and so on, and every rename is listed above. A
          row with fewer fields than keys gets JSON <code>null</code> in the missing cells; a row with
          more fields keeps the extra values in a <code>_surplus</code> array. Blank lines are skipped.
          A leading UTF-8 BOM is skipped. CRLF, LF and a bare CR all end a record.
        </p>
        <p>
          <strong className="font-semibold">Not done, though a spreadsheet does it:</strong> no Excel
          serial dates, no locale-aware number or currency parsing, no <code>#N/A</code> or other error
          values, no stripping of a leading apostrophe that marks text, no formula evaluation —{" "}
          <code>=SUM(A1:A9)</code> stays that literal string — and no encoding sniffing, so a file that
          is not UTF-8 arrives with U+FFFD characters. Quoting style is not preserved: a cell that did
          not need quotes in the source may need them here, and a cell quoted in the source may not.
        </p>
        <p>
          <strong className="font-semibold">Dialect:</strong> RFC 4180 with a configurable
          delimiter, plus three disclosed extensions — a skipped BOM, skipped blank lines, and a bare CR
          treated as a line ending. A quote in the middle of an unquoted field is reported as an
          anomaly rather than accepted, because accepting it quietly is how a converter loses a comma.
          Input is capped at {MAX_INPUT_LABEL} of pasted text, {MAX_FILE_LABEL} per opened file,{" "}
          {MAX_ROWS_LABEL}, {MAX_COLUMNS_LABEL} and {MAX_FIELD_LABEL}; each is
          refused with its real numbers before any parsing work starts.
        </p>
        <p>
          <strong className="font-semibold">Both panels above are previews</strong>, and the copy and
          download buttons give you the whole document.
        </p>
      </div>
    </div>
  );
}
