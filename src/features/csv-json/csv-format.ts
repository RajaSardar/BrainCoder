/**
 * Pure, browser-free key naming, record building and JSON serialisation for the
 * CSV → JSON Converter.
 *
 * All the decisions a reader has to be able to audit live here: what a key is
 * called, what a short row becomes, what a long row becomes, and the exact
 * bytes that get downloaded. The component renders these decisions; it does not
 * make any of them.
 *
 * Nothing in here infers a type. Every value in the output is a JSON string,
 * because a CSV has no types and guessing turns `00123` into `123` and a zip
 * code into a number.
 */

import {
  DELIMITER_CHOICES,
  MAX_COLUMNS,
  MAX_FIELD_CHARS,
  MAX_FILE_BYTES,
  MAX_INPUT_CHARS,
  MAX_ROWS,
  choiceFor,
  describeLineEndings,
  detectDelimiter,
  parseCsv,
  preflightCsv,
} from "./csv-parse";
import type { CsvAnomaly, DetectionConfidence, LineEndings, PreflightRefusal } from "./csv-parse";

export type { CsvAnomaly, DetectionConfidence };

export const EM_DASH = "\u2014";

export {
  MAX_COLUMNS,
  MAX_FIELD_CHARS,
  MAX_FILE_BYTES,
  MAX_INPUT_CHARS,
  MAX_ROWS,
  DELIMITER_CHOICES,
};

/** Characters of the JSON document rendered into the page. */
export const JSON_PREVIEW_CHARS = 20_000;

/** Rows and columns drawn in the table preview. */
export const TABLE_PREVIEW_ROWS = 20;
export const TABLE_PREVIEW_COLUMNS = 8;

/** Characters of a single cell drawn in the table preview. */
export const CELL_PREVIEW_CHARS = 120;

// ---------------------------------------------------------------------------
// labels derived from the caps, so the copy cannot quote a number the parser
// does not enforce
// ---------------------------------------------------------------------------

const n = (value: number): string => value.toLocaleString("en-US");

export const MAX_INPUT_LABEL = `${n(MAX_INPUT_CHARS)} characters`;
export const MAX_FILE_LABEL = `5 MB (${n(MAX_FILE_BYTES)} bytes)`;
export const MAX_ROWS_LABEL = `${n(MAX_ROWS)} rows`;
export const MAX_COLUMNS_LABEL = `${n(MAX_COLUMNS)} columns per row`;
export const MAX_FIELD_LABEL = `${n(MAX_FIELD_CHARS)} characters per cell`;

export const CAP_SUMMARY = `${MAX_INPUT_LABEL} of pasted text or ${MAX_FILE_LABEL} of file, ${MAX_ROWS_LABEL}, ${MAX_COLUMNS_LABEL}, ${MAX_FIELD_LABEL}`;

export const INDENT_CHOICES = [2, 4] as const;
export type Indent = (typeof INDENT_CHOICES)[number];

export function utf8ByteLength(text: string): number {
  // Written out rather than delegating to `new TextEncoder()`, so the byte count
  // this tool prints is the same number in the tab, in the audit and in a test,
  // and so it needs no global that a bundler might not ship.
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i) as number;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else {
      bytes += 4;
      i += 1;
    }
  }
  return bytes;
}

export function formatInt(value: number): string {
  return n(value);
}

// ---------------------------------------------------------------------------
// keys
// ---------------------------------------------------------------------------

/** Key used to carry the values a row has beyond the last column. */
export const SURPLUS_KEY = "_surplus";

export interface KeyRename {
  position: number;
  original: string;
  key: string;
  why: "empty-header" | "duplicate-header";
}

export interface KeyPlan {
  keys: string[];
  renames: KeyRename[];
  /** True when the keys are generated `column1…columnN` rather than read from a header. */
  generated: boolean;
  /** The surplus key, moved aside if the CSV already has a column with that name. */
  surplusKey: string;
  /** How many header cells had surrounding whitespace trimmed. */
  trimmedHeaders: number;
}

/**
 * The key for each column, de-duplicated deterministically.
 *
 * The *n*-th column named `name` becomes `name (n)`, and if that would collide
 * with a name already assigned the counter keeps going. Every rename is
 * returned so the page can list exactly what it changed instead of hiding it.
 */
export function planKeys(headerCells: string[], generated: boolean): KeyPlan {
  const renames: KeyRename[] = [];
  const trimmed = generated ? 0 : headerCells.filter((c) => c !== c.trim()).length;

  const bases = headerCells.map((cell, index) => {
    if (generated) return `column${index + 1}`;
    const trimmedCell = cell.trim();
    if (trimmedCell === "") {
      renames.push({
        position: index + 1,
        original: cell,
        key: `column${index + 1}`,
        why: "empty-header",
      });
      return `column${index + 1}`;
    }
    return trimmedCell;
  });

  const used = new Set<string>();
  const occurrences = new Map<string, number>();
  const keys = bases.map((base, index) => {
    const seen = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, seen);
    let suffix = seen;
    let key = seen === 1 ? base : `${base} (${suffix})`;
    while (used.has(key)) {
      suffix += 1;
      key = `${base} (${suffix})`;
    }
    used.add(key);
    if (key !== base) {
      renames.push({ position: index + 1, original: base, key, why: "duplicate-header" });
    }
    return key;
  });

  let surplusKey = SURPLUS_KEY;
  let bump = 2;
  while (used.has(surplusKey)) {
    surplusKey = `${SURPLUS_KEY}_${bump}`;
    bump += 1;
  }

  return { keys, renames, generated, surplusKey, trimmedHeaders: trimmed };
}

// ---------------------------------------------------------------------------
// records
// ---------------------------------------------------------------------------

/** One output row: every value is a string, a string array, or null. */
export type JsonRow = Record<string, string | string[] | null>;

export interface RaggedSummary {
  shortRows: number;
  longRows: number;
  paddedCells: number;
  surplusCells: number;
  /** 1-based record number of the first row that had to be padded. */
  firstShort: number | null;
  /** 1-based record number of the first row that had surplus values. */
  firstLong: number | null;
  expectedColumns: number;
}

function emptyRagged(expectedColumns: number): RaggedSummary {
  return {
    shortRows: 0,
    longRows: 0,
    paddedCells: 0,
    surplusCells: 0,
    firstShort: null,
    firstLong: null,
    expectedColumns,
  };
}

/**
 * The JSON document, plus the bounded slice of it the table preview draws.
 *
 * Built one record at a time so a 5 MB input never holds both the full array of
 * objects and the finished string at the same time. The per-record
 * `JSON.stringify(obj, null, indent)` is re-indented by one level, which for
 * any structure is byte-identical to `JSON.stringify(array, null, indent)` — a
 * property asserted in the audit rather than assumed here.
 */
export interface BuiltJson {
  json: string;
  previewRows: JsonRow[];
}

export function buildJson(
  dataRows: string[][],
  plan: KeyPlan,
  indent: Indent,
): BuiltJson & { ragged: RaggedSummary } {
  const keys = plan.keys;
  const columnCount = keys.length;
  const ragged = emptyRagged(columnCount);
  const pad = " ".repeat(indent);
  const chunks: string[] = [];
  const previewRows: JsonRow[] = [];

  for (let r = 0; r < dataRows.length; r += 1) {
    const cells = dataRows[r];
    const row: JsonRow = {};
    const missing = Math.max(0, columnCount - cells.length);
    const surplus = Math.max(0, cells.length - columnCount);

    for (let c = 0; c < columnCount; c += 1) {
      // A cell the row does not have becomes JSON null, which is deliberately
      // not the empty string: `""` means the CSV said "empty", null means the
      // CSV said nothing at all.
      row[keys[c]] = c < cells.length ? cells[c] : null;
    }
    if (surplus > 0) {
      row[plan.surplusKey] = cells.slice(columnCount);
    }
    if (missing > 0) {
      ragged.shortRows += 1;
      ragged.paddedCells += missing;
      if (ragged.firstShort === null) ragged.firstShort = r + 1;
    }
    if (surplus > 0) {
      ragged.longRows += 1;
      ragged.surplusCells += surplus;
      if (ragged.firstLong === null) ragged.firstLong = r + 1;
    }

    if (r < TABLE_PREVIEW_ROWS) previewRows.push(row);

    // One record at a time, re-indented by the array's own level. For any
    // structure this is byte-identical to JSON.stringify(array, null, indent);
    // the audit asserts that equality rather than taking it on trust.
    chunks.push(pad + JSON.stringify(row, null, indent).split("\n").join(`\n${pad}`));
  }

  const json = chunks.length === 0 ? "[]" : `[\n${chunks.join(",\n")}\n]`;

  return { json, previewRows, ragged };
}

// ---------------------------------------------------------------------------
// the conversion
// ---------------------------------------------------------------------------

export interface CsvJsonConverted {
  kind: "converted";
  json: string;
  jsonChars: number;
  jsonBytes: number;
  indent: Indent;
  keys: string[];
  previewRows: JsonRow[];
  /** Records in the input, including the header row when there is one. */
  inputRecords: number;
  /** Records turned into JSON objects. */
  dataRows: number;
  columns: number;
  hasHeader: boolean;
  delimiterChar: string;
  delimiterLabel: string;
  delimiterSpoken: string;
  /** "auto" when the delimiter was detected, otherwise the delimiter the reader chose. */
  delimiterMode: "auto" | string;
  confidence: DetectionConfidence;
  detectionNote: string;
  ragged: RaggedSummary;
  anomalies: CsvAnomaly[];
  blankLines: number;
  hadBom: boolean;
  lineEndings: LineEndings;
  lineEndingLabel: string;
  plan: KeyPlan;
  /** Everything the page should tell the user, already phrased. */
  notes: string[];
}

export interface CsvJsonEmpty {
  kind: "empty";
}

export interface CsvJsonRefused {
  kind: "refused";
  message: string;
}

export type CsvJsonResult = CsvJsonEmpty | CsvJsonRefused | CsvJsonConverted;

export interface ConvertOptions {
  /** "auto" sniffs the delimiter and reports its confidence; otherwise explicit. */
  delimiterMode: "auto" | string;
  hasHeader: boolean;
  indent: Indent;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function convertCsv(rawText: string, options: ConvertOptions): CsvJsonResult {
  if (rawText.length === 0) return { kind: "empty" };

  if (rawText.length > MAX_INPUT_CHARS) {
    return {
      kind: "refused",
      message: `This input is ${n(rawText.length)} characters. The cap is ${MAX_INPUT_LABEL}, and nothing was parsed. Split the file, or convert the part you need.`,
    };
  }

  const detection =
    options.delimiterMode === "auto" ? detectDelimiter(rawText) : null;
  const delimiterChar =
    options.delimiterMode === "auto"
      ? (detection?.char ?? ",")
      : options.delimiterMode;
  const choice = choiceFor(delimiterChar);

  const pre = preflightCsv(rawText, delimiterChar);
  if (!pre.ok) {
    const refusal = pre as PreflightRefusal;
    return { kind: "refused", message: refusal.reason };
  }

  const parsed = parseCsv(rawText, delimiterChar);

  const notes: string[] = [];

  // Header cells decide the keys. Without a header row the keys are generated,
  // and the column count is the widest record in the file — which is the honest
  // answer when rows disagree with each other.
  const headerCells = options.hasHeader && parsed.records.length > 0 ? parsed.records[0] : [];
  const dataRows = options.hasHeader ? parsed.records.slice(1) : parsed.records;
  const headerForPlan =
    options.hasHeader && headerCells.length > 0 ? headerCells : new Array<string>(parsed.maxFields).fill("");

  const plan = planKeys(headerForPlan, !options.hasHeader || headerCells.length === 0);

  if (!options.hasHeader && parsed.records.length > 0) {
    notes.push(
      `The first row is treated as data, not as keys, so every key is generated: column1 through column${plan.keys.length}. The column count is the widest record in the file (${n(
        parsed.maxFields,
      )} field${parsed.maxFields === 1 ? "" : "s"}).`,
    );
  }
  if (parsed.records.length === 0) {
    notes.push(
      `This input holds no records at all${
        parsed.blankLines > 0
          ? ` — only ${n(parsed.blankLines)} blank line${parsed.blankLines === 1 ? "" : "s"}, which are skipped`
          : ""
      }. The JSON output is an empty array.`,
    );
  }
  if (options.hasHeader && parsed.records.length === 1 && parsed.records[0].length > 0) {
    notes.push(
      `The header row is the only record in this input, so the JSON output is an empty array with ${n(
        plan.keys.length,
      )} key${plan.keys.length === 1 ? "" : "s"} that no row uses.`,
    );
  }
  if (plan.trimmedHeaders > 0) {
    notes.push(
      `${n(plan.trimmedHeaders)} header cell${plan.trimmedHeaders === 1 ? "" : "s"} had leading or trailing whitespace trimmed before becoming a key. The cell values themselves are untouched.`,
    );
  }
  const emptyRenames = plan.renames.filter((r) => r.why === "empty-header");
  if (emptyRenames.length > 0) {
    notes.push(
      `${n(emptyRenames.length)} header cell${emptyRenames.length === 1 ? " was" : "s were"} empty, so the${emptyRenames.length === 1 ? " key was" : " keys were"} generated from ${emptyRenames.length === 1 ? "its column position" : "their column positions"}: ${emptyRenames
        .map((r) => r.key)
        .join(", ")}.`,
    );
  }
  const dupRenames = plan.renames.filter((r) => r.why === "duplicate-header");
  if (dupRenames.length > 0) {
    notes.push(
      `${n(dupRenames.length)} duplicate header name${dupRenames.length === 1 ? " was" : "s were"} renamed so no key could silently overwrite another: ${dupRenames
        .map((r) => `${capitalize(r.original)} → ${r.key} (column ${n(r.position)})`)
        .join("; ")}.`,
    );
  }
  if (plan.surplusKey !== SURPLUS_KEY) {
    notes.push(
      `This CSV already has a column named ${SURPLUS_KEY}, so surplus values go into ${plan.surplusKey} instead.`,
    );
  }

  const built = buildJson(dataRows, plan, options.indent);

  if (built.ragged.shortRows > 0) {
    notes.push(
      `${n(built.ragged.shortRows)} row${built.ragged.shortRows === 1 ? " has" : "s have"} fewer fields than the ${n(
        plan.keys.length,
      )} keys, so ${n(built.ragged.paddedCells)} missing cell${built.ragged.paddedCells === 1 ? " is" : "s are"} JSON null — which is not the same as an empty cell, because an empty cell is ${JSON.stringify("")}. First at row ${n(
        built.ragged.firstShort ?? 0,
      )}.`,
    );
  }
  if (built.ragged.longRows > 0) {
    notes.push(
      `${n(built.ragged.longRows)} row${built.ragged.longRows === 1 ? " has" : "s have"} more fields than the ${n(
        plan.keys.length,
      )} keys, so ${n(built.ragged.surplusCells)} surplus value${built.ragged.surplusCells === 1 ? " is" : "s are"} kept in a ${plan.surplusKey} array rather than dropped. First at row ${n(
        built.ragged.firstLong ?? 0,
      )}.`,
    );
  }
  if (parsed.blankLines > 0) {
    notes.push(
      `${n(parsed.blankLines)} blank line${parsed.blankLines === 1 ? " was" : "s were"} skipped and not counted as rows. In a single-column file an empty line cannot be told apart from a row holding one empty cell, so it is skipped too.`,
    );
  }
  if (parsed.hadBom) {
    notes.push("A UTF-8 byte order mark at the start of the input was skipped.");
  }
  notes.push(
    `Line endings: ${describeLineEndings(parsed.lineEndings)}. CRLF, LF and a bare CR all end a record, and a trailing line ending does not create an empty row.`,
  );
  if (parsed.anomalies.length > 0) {
    notes.push(
      `${n(parsed.anomalies.length)} quoting anomal${parsed.anomalies.length === 1 ? "y was" : "ies were"} found and are listed below. Nothing was thrown away.`,
    );
  }
  const detectionNote = detection
    ? detection.note
    : `Delimiter set to a ${choice.label} by hand, so nothing was detected and there is no confidence to report.`;
  notes.push(detectionNote);

  const jsonBytes = utf8ByteLength(built.json);

  return {
    kind: "converted",
    json: built.json,
    jsonChars: built.json.length,
    jsonBytes,
    indent: options.indent,
    keys: plan.keys,
    previewRows: built.previewRows,
    inputRecords: parsed.records.length,
    dataRows: dataRows.length,
    columns: plan.keys.length,
    hasHeader: options.hasHeader,
    delimiterChar,
    delimiterLabel: choice.label,
    delimiterSpoken: choice.spoken,
    // "none" is overloaded: it means either that detection ran and found no
    // delimiter (a genuinely single-column file), or that no detection ran
    // because the reader chose the delimiter. Only delimiterMode tells those
    // two apart, so it travels with the result rather than being re-derived
    // from the component's own state.
    delimiterMode: options.delimiterMode,
    confidence: detection ? detection.confidence : "none",
    detectionNote: detection ? detection.note : `Delimiter set to ${choice.spoken} by hand.`,
    ragged: built.ragged,
    anomalies: parsed.anomalies,
    blankLines: parsed.blankLines,
    hadBom: parsed.hadBom,
    lineEndings: parsed.lineEndings,
    lineEndingLabel: describeLineEndings(parsed.lineEndings),
    plan,
    notes,
  };
}

// ---------------------------------------------------------------------------
// presentation helpers
// ---------------------------------------------------------------------------

export interface CellPreview {
  text: string;
  truncated: boolean;
  total: number;
}

/** A cell, shortened for the table and labelled as shortened. */
export function cellPreview(value: string | string[] | null): CellPreview {
  if (value === null) return { text: EM_DASH, truncated: false, total: 0 };
  const text = Array.isArray(value) ? `[${value.length} surplus value${value.length === 1 ? "" : "s"}]` : value;
  if (text.length > CELL_PREVIEW_CHARS) {
    return {
      text: `${text.slice(0, CELL_PREVIEW_CHARS)}…`,
      truncated: true,
      total: text.length,
    };
  }
  return { text, truncated: false, total: text.length };
}

export interface JsonPreview {
  text: string;
  truncated: boolean;
  total: number;
}

/** The JSON document, bounded for the page. Copy and Download give all of it. */
export function jsonPreview(json: string): JsonPreview {
  if (json.length > JSON_PREVIEW_CHARS) {
    return {
      text: json.slice(0, JSON_PREVIEW_CHARS),
      truncated: true,
      total: json.length,
    };
  }
  return { text: json, truncated: false, total: json.length };
}

export function safeStem(name: string): string {
  const stem = name
    .replace(/\.[A-Za-z0-9]{1,8}$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 60);
  return stem === "" ? "csv" : stem;
}

/** A download name that says what is in the file and never hides itself. */
export function outputNameFor(sourceName: string | null, dataRows: number, columns: number): string {
  const stem = sourceName ? safeStem(sourceName) : "data";
  return `${stem}-to-json-${n(dataRows)}r-${n(columns)}c.json`;
}

export function previewRangeNote(total: number, shown: number, noun: string): string {
  return shown < total
    ? `Preview: the first ${n(shown)} of ${n(total)} ${noun}${total === 1 ? "" : "s"}.`
    : `${n(total)} ${noun}${total === 1 ? "" : "s"}.`;
}

/**
 * U+FFFD in the decoded text means the bytes were not valid UTF-8 and the
 * browser substituted a replacement character. There is no encoding picker
 * here, so the count is surfaced instead of being quietly carried into the
 * output as a character the CSV never contained.
 */
export function countReplacementChars(text: string): number {
  let count = 0;
  let index = text.indexOf("\uFFFD");
  while (index !== -1) {
    count += 1;
    index = text.indexOf("\uFFFD", index + 1);
  }
  return count;
}

export function describeByteSize(bytes: number): string {
  return `${n(bytes)} byte${bytes === 1 ? "" : "s"} (${bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`})`;
}
