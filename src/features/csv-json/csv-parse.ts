/**
 * Pure, browser-free CSV lexing for the CSV → JSON Converter.
 *
 * Nothing in here touches the DOM, `Buffer`, `atob`, `fetch` or the clock. The
 * scanner is written out by hand rather than delegated to a CSV library because
 * two of the things this tool has to be honest about are not available from a
 * forgiving parser: a quote that appears in the *middle* of an unquoted field
 * is reported as an anomaly instead of being silently swallowed, and the caps
 * are refused with a reason before any record is built.
 *
 * The two passes are deliberately separate. `preflightCsv` walks the input once
 * counting records, fields and field lengths and bails out the moment a cap is
 * passed, without allocating a single string; `parseCsv` is the pass that
 * actually builds the records and runs only after the preflight has agreed.
 */

/** Delimiters offered in the UI. Tab is a real U+0009, never a backslash-t. */
export interface DelimiterChoice {
  id: string;
  char: string;
  label: string;
  /** What a delimiter looks like when it has to be described in a sentence. */
  spoken: string;
}

export const DELIMITER_CHOICES: readonly DelimiterChoice[] = [
  { id: "comma", char: ",", label: "Comma ( , )", spoken: "a comma" },
  { id: "semicolon", char: ";", label: "Semicolon ( ; )", spoken: "a semicolon" },
  { id: "tab", char: "\t", label: "Tab (U+0009)", spoken: "a tab" },
  { id: "pipe", char: "|", label: "Pipe ( | )", spoken: "a pipe" },
];

export function choiceFor(char: string): DelimiterChoice {
  return (
    DELIMITER_CHOICES.find((d) => d.char === char) ??
    // A one-character delimiter that is not one of the four offered is still
    // parseable, so it gets an honest label instead of being rejected.
    {
      id: "custom",
      char,
      label: `Custom (${char === " " ? "space" : char})`,
      spoken: char === " " ? "a space" : `“${char}”`,
    }
  );
}

// ---------------------------------------------------------------------------
// caps
// ---------------------------------------------------------------------------

/** Largest input accepted, measured in characters for pasted text. */
export const MAX_INPUT_CHARS = 5_242_880;

/** Largest opened file accepted, measured in bytes on disk. */
export const MAX_FILE_BYTES = 5_242_880;

/** Largest number of records (blank lines excluded) in one conversion. */
export const MAX_ROWS = 20_000;

/** Largest number of fields in any single record. */
export const MAX_COLUMNS = 512;

/** Largest number of characters in any single field. */
export const MAX_FIELD_CHARS = 100_000;

// ---------------------------------------------------------------------------
// anomalies
// ---------------------------------------------------------------------------

export type CsvAnomalyKind =
  | "quote-in-unquoted-field"
  | "text-after-closing-quote"
  | "unterminated-quote";

export interface CsvAnomaly {
  kind: CsvAnomalyKind;
  /** 1-based record number in the input, counting the header row. */
  record: number;
  /** 1-based field position inside that record. */
  field: number;
  /** 1-based character position in the input. */
  position: number;
  detail: string;
}

export const ANOMALY_LABEL: Record<CsvAnomalyKind, string> = {
  "quote-in-unquoted-field": "Quote inside an unquoted field",
  "text-after-closing-quote": "Text after a closing quote",
  "unterminated-quote": "Quote never closed",
};

export const ANOMALY_EXPLANATION: Record<CsvAnomalyKind, string> = {
  "quote-in-unquoted-field":
    "RFC 4180 allows a double quote only as the opening and closing quote of a quoted field. Here one appears in the middle of a field that was never quoted, so it is kept as ordinary text and reported rather than being treated as a quote.",
  "text-after-closing-quote":
    'RFC 4180 ends a quoted field at the closing quote: the next character must be the delimiter or a line ending. Text after it is kept as part of the field and reported.',
  "unterminated-quote":
    "The input ends while a field is still inside its opening quote. RFC 4180 requires every quoted field to be closed, so the field is closed at the end of the input and reported here rather than the whole file being refused, which would throw away every row before it.",
};

// ---------------------------------------------------------------------------
// preflight
// ---------------------------------------------------------------------------

export interface PreflightOk {
  ok: true;
  /** Records found, with blank lines excluded — this is what the parser returns. */
  recordCount: number;
  /** Widest record seen. This is the column count when there is no header row. */
  maxFields: number;
  /** Longest single field seen. */
  maxFieldChars: number;
  blankLines: number;
}

export interface PreflightRefusal {
  ok: false;
  reason: string;
}

export type PreflightResult = PreflightOk | PreflightRefusal;

function stripBom(text: string): { body: string; hadBom: boolean } {
  if (text.charCodeAt(0) === 0xfeff) return { body: text.slice(1), hadBom: true };
  return { body: text, hadBom: false };
}

export function normalizeDelimiter(delimiter: string): string {
  // A one-character delimiter is used as given; anything else falls back to a
  // comma rather than being compared with `===` against every character.
  return delimiter.length === 1 ? delimiter : ",";
}

/**
 * One linear pass that counts records, fields and field lengths and refuses the
 * four caps. It allocates no strings, so a file that trips a cap costs a scan
 * and nothing else.
 */
export function preflightCsv(rawText: string, delimiter: string): PreflightResult {
  const src = stripBom(rawText).body;
  const del = normalizeDelimiter(delimiter);

  let recordCount = 0;
  let fields = 0;
  let maxFields = 0;
  let maxFieldChars = 0;
  let fieldChars = 0;
  let blankLines = 0;
  let consumed = false;
  let inQuotes = false;
  let quoteClosed = false;

  const fieldCap = (): PreflightRefusal => ({
    ok: false,
    reason: `A single field is longer than ${MAX_FIELD_CHARS.toLocaleString("en-US")} characters (the cap; the first one found is at least ${(
      MAX_FIELD_CHARS + 1
    ).toLocaleString("en-US")} characters). A CSV cell that big is usually a whole file pasted into one cell, a base64 blob, or an exported log line. Nothing was converted.`,
  });

  const rowCap = (): PreflightRefusal => ({
    ok: false,
    reason: `This CSV holds more than ${MAX_ROWS.toLocaleString("en-US")} records (at least ${(
      MAX_ROWS + 1
    ).toLocaleString("en-US")} were found; the cap is ${MAX_ROWS.toLocaleString("en-US")} records, blank lines excluded). Nothing was converted.`,
  });

  const columnCap = (): PreflightRefusal => ({
    ok: false,
    reason: `A record in this CSV holds more than ${MAX_COLUMNS.toLocaleString("en-US")} fields (at least ${(
      MAX_COLUMNS + 1
    ).toLocaleString("en-US")} were found; the cap is ${MAX_COLUMNS.toLocaleString("en-US")} fields per record). A file that wide is usually unquoted JSON or TSV read with the wrong delimiter. Nothing was converted.`,
  });

  const endField = (): PreflightRefusal | null => {
    fields += 1;
    if (fields > MAX_COLUMNS) return columnCap();
    if (fieldChars > maxFieldChars) maxFieldChars = fieldChars;
    return null;
  };

  const endRecord = (): PreflightRefusal | null => {
    const refusal = endField();
    if (refusal) return refusal;
    recordCount += 1;
    if (recordCount > MAX_ROWS) return rowCap();
    if (fields > maxFields) maxFields = fields;
    fields = 0;
    fieldChars = 0;
    return null;
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          fieldChars += 1;
          consumed = true;
          i += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        fieldChars += 1;
      }
      if (fieldChars > MAX_FIELD_CHARS) return fieldCap();
      continue;
    }

    // A quote only opens a field when nothing has been written into it yet.
    // ` "a"` (space then quote) is therefore literal text, which is what RFC
    // 4180 requires and what the anomaly report exists to surface.
    if (ch === '"' && fieldChars === 0 && !quoteClosed) {
      inQuotes = true;
      consumed = true;
      continue;
    }

    if (ch === del) {
      const refusal = endField();
      if (refusal) return refusal;
      fieldChars = 0;
      quoteClosed = false;
      consumed = true;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      if (consumed) {
        const refusal = endRecord();
        if (refusal) return refusal;
        quoteClosed = false;
        consumed = false;
      } else {
        blankLines += 1;
      }
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      continue;
    }

    fieldChars += 1;
    quoteClosed = false;
    consumed = true;
    if (fieldChars > MAX_FIELD_CHARS) return fieldCap();
  }

  if (consumed) {
    const refusal = endRecord();
    if (refusal) return refusal;
  }

  return { ok: true, recordCount, maxFields, maxFieldChars, blankLines };
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

export interface LineEndings {
  crlf: number;
  lf: number;
  cr: number;
}

export interface CsvParse {
  /** Records in file order, blank lines excluded. */
  records: string[][];
  anomalies: CsvAnomaly[];
  blankLines: number;
  hadBom: boolean;
  lineEndings: LineEndings;
  /** Widest record, which is the column count when there is no header row. */
  maxFields: number;
  /** True when the last field of the last record was still inside its quote. */
  endedInsideQuote: boolean;
}

function lineEndingName(endings: LineEndings): string {
  const kinds: string[] = [];
  if (endings.crlf > 0) kinds.push("CRLF");
  if (endings.lf > 0) kinds.push("LF");
  if (endings.cr > 0) kinds.push("CR");
  if (kinds.length === 0) return "none (a single record)";
  if (kinds.length > 1) return `${kinds.join(" + ")} (mixed)`;
  return kinds[0];
}

/**
 * RFC 4180 with the delimiter configurable, plus three disclosed extensions: a
 * leading UTF-8 BOM is skipped, a blank line is skipped, and a bare CR ends a
 * record the way CRLF and LF do.
 *
 * The record is never dropped for being malformed: a stray quote is reported
 * and its text kept, because a converter that silently loses a row is worse
 * than one that says which row it had to guess about.
 */
export function parseCsv(rawText: string, delimiter: string): CsvParse {
  const { body: src, hadBom } = stripBom(rawText);
  const del = normalizeDelimiter(delimiter);

  const records: string[][] = [];
  const anomalies: CsvAnomaly[] = [];
  const lineEndings: LineEndings = { crlf: 0, lf: 0, cr: 0 };

  let record: string[] = [];
  let field = "";
  /** start = nothing written yet, open = inside quotes, quoted = quotes closed, bare = plain text */
  let mode: "start" | "open" | "quoted" | "bare" = "start";
  let fieldIndex = 0;
  let recordIndex = 0;
  let consumed = false;
  let blankLines = 0;
  let endedInsideQuote = false;
  let maxFields = 0;

  const anomaly = (kind: CsvAnomalyKind, position: number): void => {
    anomalies.push({
      kind,
      record: recordIndex + 1,
      field: fieldIndex + 1,
      position,
      detail: `${ANOMALY_LABEL[kind]} at record ${recordIndex + 1}, field ${fieldIndex + 1}, character ${position.toLocaleString(
        "en-US",
      )}.`,
    });
  };

  const endField = (): void => {
    record.push(field);
    field = "";
    mode = "start";
    fieldIndex += 1;
  };

  const endRecord = (): void => {
    endField();
    records.push(record);
    if (record.length > maxFields) maxFields = record.length;
    record = [];
    recordIndex += 1;
    fieldIndex = 0;
    consumed = false;
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (mode === "open") {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          consumed = true;
          i += 1;
        } else {
          mode = "quoted";
        }
      } else {
        // A line ending inside a quoted field is data, not a record boundary,
        // and is kept byte for byte including the CR of a CRLF pair.
        field += ch;
        consumed = true;
      }
      continue;
    }

    if (ch === '"') {
      if (mode === "start") {
        mode = "open";
        consumed = true;
        continue;
      }
      // `bare`: a quote that does not open the field. `quoted`: a second quote
      // after the field was closed. Both are anomalies, not quote syntax.
      anomaly(mode === "bare" ? "quote-in-unquoted-field" : "text-after-closing-quote", i + 1);
      field += ch;
      consumed = true;
      if (mode === "quoted") mode = "bare";
      continue;
    }

    if (ch === del) {
      endField();
      consumed = true;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      if (!consumed) {
        // A line with nothing on it. RFC 4180 has no blank line; skipping it is
        // this tool's disclosed extension, matching what a spreadsheet shows.
        blankLines += 1;
      } else {
        if (ch === "\r") {
          if (src[i + 1] === "\n") {
            lineEndings.crlf += 1;
            i += 1;
          } else {
            lineEndings.cr += 1;
          }
        } else {
          lineEndings.lf += 1;
        }
        endRecord();
      }
      continue;
    }

    field += ch;
    if (mode === "quoted") {
      // The field's quotes already closed, so ordinary text here is not legal
      // RFC 4180. It is kept as field text and reported, never discarded.
      anomaly("text-after-closing-quote", i + 1);
    } else if (mode === "start") {
      mode = "bare";
    }
    consumed = true;
  }

  if (consumed) {
    if (mode === "open") {
      endedInsideQuote = true;
      anomaly("unterminated-quote", src.length);
    }
    endRecord();
  } else if (mode === "open") {
    // An input that ends exactly on an opening quote has already been counted
    // as consumed by that quote, so this branch is unreachable in practice; it
    // exists so the invariant is stated rather than assumed.
    endedInsideQuote = true;
  }

  return { records, anomalies, blankLines, hadBom, lineEndings, maxFields, endedInsideQuote };
}

export function describeLineEndings(endings: LineEndings): string {
  return lineEndingName(endings);
}

// ---------------------------------------------------------------------------
// delimiter detection
// ---------------------------------------------------------------------------

export type DetectionConfidence = "none" | "low" | "medium" | "high";

export interface DelimiterScore {
  char: string;
  label: string;
  /** Total occurrences across the sampled records, outside quotes. */
  total: number;
  /** How many sampled records contain it at least once. */
  records: number;
  /** Largest number of occurrences in any single sampled record. */
  widest: number;
}

export interface DelimiterDetection {
  /** null when nothing beat zero occurrences in any sampled record. */
  char: string | null;
  confidence: DetectionConfidence;
  scores: DelimiterScore[];
  /** Records that were actually sampled, so the confidence has a denominator. */
  sampled: number;
  note: string;
}

/** Records read while sniffing. Enough to see a header plus real data rows. */
const DETECT_SAMPLE_RECORDS = 24;

/**
 * Sniff the delimiter and say how sure it is, rather than silently committing.
 *
 * The confidence is computed from the sample and printed: "high" means one
 * delimiter appears in every sampled record and no other delimiter appears at
 * all, "medium" means it is the only delimiter present but not in every record,
 * and "low" means another delimiter also appears in the data (or the top two
 * tie), which is exactly the case where the user should choose.
 */
export function detectDelimiter(rawText: string): DelimiterDetection {
  const src = stripBom(rawText).body;
  const perRecord: Record<string, number[]> = {};
  for (const d of DELIMITER_CHOICES) perRecord[d.char] = [];

  let pos = 0;
  let sampled = 0;
  while (pos < src.length && sampled < DETECT_SAMPLE_RECORDS) {
    const hitCounts: Record<string, number> = {};
    for (const d of DELIMITER_CHOICES) hitCounts[d.char] = 0;

    // One scan per record that counts all four candidates at once.
    let i = pos;
    let inQuotes = false;
    let fieldChars = 0;
    let sawContent = false;
    while (i < src.length) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') i += 1;
          else inQuotes = false;
        }
        fieldChars += 1;
        sawContent = true;
        i += 1;
        continue;
      }
      if (ch === '"' && fieldChars === 0) {
        inQuotes = true;
        fieldChars += 1;
        sawContent = true;
        i += 1;
        continue;
      }
      if (ch in hitCounts) {
        hitCounts[ch] += 1;
        fieldChars = 0;
        sawContent = true;
        i += 1;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && src[i + 1] === "\n") i += 1;
        break;
      }
      fieldChars += 1;
      sawContent = true;
      i += 1;
    }
    for (const d of DELIMITER_CHOICES) perRecord[d.char].push(hitCounts[d.char]);
    // A blank line carries no delimiter evidence, so it is stepped over rather
    // than counted as one of the sampled records.
    if (sawContent) sampled += 1;
    pos = i + 1;
  }

  const scores: DelimiterScore[] = DELIMITER_CHOICES.map((d) => {
    const counts = perRecord[d.char];
    return {
      char: d.char,
      label: d.label,
      total: counts.reduce((a, b) => a + b, 0),
      records: counts.filter((n) => n > 0).length,
      widest: counts.reduce((a, b) => Math.max(a, b), 0),
    };
  });

  const ranked = [...scores].sort((a, b) => b.total - a.total || a.char.localeCompare(b.char));
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (!best || best.total === 0) {
    return {
      char: null,
      confidence: "none",
      scores,
      sampled,
      note: `No comma, semicolon, tab or pipe appears outside quotes in the first ${sampled} record${
        sampled === 1 ? "" : "s"
      } of this input, so it is a single-column file. The delimiter does not change the result; a comma is used below.`,
    };
  }

  const choice = choiceFor(best.char);
  const others = scores.filter((s) => s.char !== best.char && s.total > 0);

  if (best.records === sampled && others.length === 0) {
    return {
      char: best.char,
      confidence: "high",
      scores,
      sampled,
      note: `Detected ${choice.spoken}: it appears ${best.total.toLocaleString("en-US")} time${
        best.total === 1 ? "" : "s"
      } in every one of the first ${sampled} records and no other candidate delimiter appears at all.`,
    };
  }

  if (others.length === 0) {
    return {
      char: best.char,
      confidence: "medium",
      scores,
      sampled,
      note: `Detected ${choice.spoken}: it is the only candidate delimiter present (${best.total.toLocaleString(
        "en-US",
      )} occurrence${best.total === 1 ? "" : "s"} across the first ${sampled} records), but it is not in all of them — that is normal when a few cells contain the character as data. Check it against the header above.`,
    };
  }

  const tie = runnerUp && runnerUp.total === best.total;
  return {
    char: best.char,
    confidence: "low",
    scores,
    sampled,
    note: tie
      ? `Not confident: ${choice.spoken} and ${choiceFor(runnerUp.char).spoken} each appear ${best.total.toLocaleString(
          "en-US",
        )} time${best.total === 1 ? "" : "s"} in the first ${sampled} records. ${choice.spoken} is used below — pick the delimiter yourself if that is wrong.`
      : `Not confident: ${choice.spoken} was chosen (${best.total.toLocaleString("en-US")} occurrences) but ${others
          .map((o) => `${o.label} (${o.total.toLocaleString("en-US")})`)
          .join(", ")} also appear, which usually means one of them is inside cell text. Pick the delimiter yourself if the header above does not line up.`,
  };
}
