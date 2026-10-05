import {
  format,
  supportedDialects,
  type FormatOptionsWithLanguage,
  type SqlLanguage,
} from "sql-formatter";

/**
 * Refused with its real number rather than truncated: a truncated query is not a
 * shorter query. 100,000 rather than the 200,000 the JSON converter allows, because
 * formatting is heavier than parsing — a realistic 98,000-character query measured
 * 1,144 ms on the first run and 804 ms on the second, which is long enough to notice
 * even when the work is deferred off the keystroke.
 */
export const MAX_SQL_CHARS = 100_000;

/**
 * The formatter's own parse error is a multi-line message with a caret diagram
 * underneath it, and it quotes the reader's own payload back. On a small piece of
 * malformed input it runs away: 507 characters of `SELECT((((...` produce a
 * 16,961,223-character error string across 237,165 lines, which froze the tab for
 * seconds and pushed the whole message into the toolbar and the clipboard. Only the
 * first line is ever kept, and only up to this many characters of it.
 */
export const MAX_SQL_ERROR_CHARS = 240;

/** Nesting cap, so the preflight itself cannot be walked into a deep stack. */
export const MAX_SQL_DEPTH = 200;

/** Cap on nested block comments, for the four dialects whose formatter supports them. */
export const MAX_SQL_COMMENT_DEPTH = 64;

/**
 * Every dialect the formatter actually implements, read from the formatter itself
 * so this list cannot claim a dialect that does not exist and cannot quietly omit
 * one that does. `plsql` is Oracle's dialect: naming it "Oracle" is honest here
 * because that is what the formatter calls it, and it is labelled PL/SQL so nobody
 * is told plain Oracle SQL is covered when it is not.
 */
const DIALECT_LABELS: Record<string, string> = {
  bigquery: "BigQuery",
  clickhouse: "ClickHouse",
  db2: "IBM Db2",
  db2i: "IBM Db2i",
  duckdb: "DuckDB",
  hive: "Apache Hive",
  mariadb: "MariaDB",
  mysql: "MySQL",
  n1ql: "Couchbase N1QL",
  plsql: "Oracle PL/SQL",
  postgresql: "PostgreSQL",
  redshift: "Amazon Redshift",
  singlestoredb: "SingleStoreDB",
  snowflake: "Snowflake",
  spark: "Spark SQL",
  sqlite: "SQLite",
  sql: "Standard SQL",
  tidb: "TiDB",
  trino: "Trino",
  transactsql: "SQL Server (T-SQL)",
  tsql: "Transact-SQL",
};

export const SQL_DIALECTS: readonly { id: SqlLanguage; label: string }[] = (
  supportedDialects as readonly SqlLanguage[]
)
  .slice()
  .sort((a, b) => (DIALECT_LABELS[a] ?? a).localeCompare(DIALECT_LABELS[b] ?? b))
  .map((id) => ({ id, label: DIALECT_LABELS[id] ?? id }));

/** PostgreSQL is the default because it accepts the widest range of pasted dialect. */
export const DEFAULT_SQL_DIALECT: SqlLanguage = "postgresql";

export type KeywordCase = "upper" | "lower" | "preserve";
export type IndentChoice = "tab" | "2" | "4";

export interface SqlFormatOptions {
  language: SqlLanguage;
  keywordCase: KeywordCase;
  indent: IndentChoice;
  linesBetweenQueries: number;
}

export const DEFAULT_SQL_OPTIONS: SqlFormatOptions = {
  language: DEFAULT_SQL_DIALECT,
  keywordCase: "upper",
  indent: "2",
  linesBetweenQueries: 1,
};

export type SqlFormatResult =
  | { kind: "formatted"; sql: string }
  /** Nothing pasted: neither formatted nor an error. */
  | { kind: "empty" }
  | { kind: "invalid-sql"; message: string; line: number | null; column: number | null }
  /** Refused before formatting, with the real number. */
  | { kind: "refused"; message: string }
  | { kind: "internal"; message: string };

/**
 * Dialects where a backslash escapes the next character inside a quoted string.
 * Standard SQL has no such escape, and PostgreSQL's standard_conforming_strings
 * leaves it off by default, so treating `\` as an escape everywhere would refuse
 * valid input such as the perfectly good string literal `'\'`.
 */
const BACKSLASH_ESCAPES: ReadonlySet<string> = new Set(["mysql", "mariadb"]);

/** Dialects with dollar-quoted strings, where `$1` is a parameter but `$$` is a delimiter. */
const DOLLAR_QUOTES: ReadonlySet<string> = new Set([
  "postgresql",
  "redshift",
  "bigquery",
  "snowflake",
  "plsql",
]);

/**
 * The dialects whose formatter is configured with `nestedBlockComments: true`, read
 * out of the installed package: db2i, duckdb, postgresql and transactsql. For these
 * a nested block comment is a real construct and the formatter round-trips it
 * correctly, so refusing it would be refusing valid SQL.
 *
 * For every other dialect it is a misparse. Given an outer and an inner comment and
 * one close for each, MySQL, Standard SQL, SQLite and BigQuery all return the inner
 * comment plus `c * / 1;` — the comment text after the inner close becomes live SQL —
 * and the page reported it as Formatted. Verified against every shipped dialect.
 */
const NESTED_BLOCK_COMMENTS: ReadonlySet<string> = new Set([
  "db2i",
  "duckdb",
  "postgresql",
  "transactsql",
]);

export type PreflightResult =
  | { kind: "clean" }
  | {
      kind: "problem";
      message: string;
      line: number | null;
      column: number | null;
    };

const isIdentPart = (c: string) => /[A-Za-z0-9_$]/.test(c);

/**
 * Walks the query well enough to catch the two failures the formatter itself
 * cannot report. Both were verified against `sql-formatter@15.8.2` before this
 * function existed:
 *
 *   - An unterminated block comment. `format("SELECT a " + openComment + " b")` does
 *     not throw. It returns a line ending `a / * b`, which reads as division and
 *     multiplication on a column called `b`, and the page reported it as Formatted.
 *   - A nested block comment. Given an outer and an inner comment around `b`, then a
 *     close for each, and `c * / 1;` after them, the formatter returns the inner
 *     comment on one line and `c * / 1;` on the next: comment text becomes live SQL
 *     and the page still reported Formatted. Whether a given dialect nests comments
 *     is a dialect question. Emitting different tokens than were pasted is not, so
 *     nesting is refused with an explanation instead.
 *
 * Unterminated strings and unbalanced parentheses are caught here too, because the
 * formatter's own error for those is the one that runs away to 16 MB.
 */
export function preflightSql(sql: string, language: SqlLanguage): PreflightResult {
  const backslashEscapes = BACKSLASH_ESCAPES.has(language);
  const dollarQuotes = DOLLAR_QUOTES.has(language);
  const nestsComments = NESTED_BLOCK_COMMENTS.has(language);
  const len = sql.length;

  /** Offsets of every `(` still open, so a refusal can name how many are missing. */
  const openParens: number[] = [];

  /** Only called when the walk has already failed, so counting from the top is cheap. */
  const positionAt = (offset: number): { line: number; column: number } => {
    let l = 1;
    let start = 0;
    for (let i = 0; i < offset && i < len; i++) {
      if (sql[i] === "\n") {
        l++;
        start = i + 1;
      }
    }
    return { line: l, column: offset - start + 1 };
  };

  const fail = (offset: number, message: string): PreflightResult => {
    const { line: l, column } = positionAt(offset);
    return { kind: "problem", message, line: l, column };
  };

  let i = 0;
  while (i < len) {
    const c = sql[i]!;

    // Line comment: to end of line, never a terminator.
    if (c === "-" && sql[i + 1] === "-") {
      while (i < len && sql[i] !== "\n") i++;
      continue;
    }

    // Block comment. An unterminated one is refused in every dialect, because every
    // shipped dialect turns its text into arithmetic instead of failing. A nested one
    // is a real construct only where the formatter is configured for it.
    if (c === "/" && sql[i + 1] === "*") {
      const open = i;
      i += 2;
      let depth = 1;
      let nestedAt = -1;
      let closed = false;
      while (i < len) {
        if (sql[i] === "*" && sql[i + 1] === "/") {
          i += 2;
          depth--;
          if (depth === 0) {
            closed = true;
            break;
          }
          continue;
        }
        if (sql[i] === "/" && sql[i + 1] === "*") {
          if (nestedAt < 0) nestedAt = i;
          if (!nestsComments) {
            return fail(
              i,
              "This query nests a block comment, which this dialect does not support. Left alone the formatter turns the text after the inner close into live SQL, so nothing was formatted.",
            );
          }
          depth++;
          if (depth > MAX_SQL_COMMENT_DEPTH) {
            return {
              kind: "problem",
              message: `This query nests block comments more than ${MAX_SQL_COMMENT_DEPTH} deep, which this page refuses.`,
              line: null,
              column: null,
            };
          }
          i += 2;
          continue;
        }
        i++;
      }
      if (!closed) {
        return fail(
          open,
          "This block comment is never closed. The formatter would read the comment text as SQL, so nothing was formatted.",
        );
      }
      if (nestedAt >= 0 && !nestsComments) {
        return fail(nestedAt, "This query nests a block comment.");
      }
      continue;
    }

    // Dollar-quoted string, only where the dialect has one.
    if (c === "$" && dollarQuotes) {
      const m = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const open = i;
        i += tag.length;
        const end = sql.indexOf(tag, i);
        if (end < 0) {
          return fail(open, `This dollar-quoted string (${tag}) is never closed.`);
        }
        i = end + tag.length;
        continue;
      }
    }

    // Single-quoted string. `''` is an escaped quote everywhere; a backslash escapes
    // the next character only in the dialects where it does.
    if (c === "'") {
      const open = i;
      // Postgres E'...' strings take backslash escapes whatever the server setting.
      let escapes = backslashEscapes;
      if (!escapes && (sql[i - 1] === "E" || sql[i - 1] === "e") && (i < 2 || !isIdentPart(sql[i - 2]!))) {
        escapes = true;
      }
      i++;
      let closed = false;
      while (i < len) {
        const d = sql[i]!;
        if (d === "\\" && escapes) {
          i += 2;
          continue;
        }
        if (d === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) return fail(open, "This string literal is never closed.");
      continue;
    }

    // Double-quoted: an identifier in most dialects, a string in MySQL-family ones.
    // Either way it is delimited by doubling and never spans a newline.
    if (c === '"') {
      const open = i;
      i++;
      let closed = false;
      while (i < len) {
        const d = sql[i]!;
        if (d === "\\" && backslashEscapes) {
          i += 2;
          continue;
        }
        if (d === '"') {
          if (sql[i + 1] === '"') {
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        if (d === "\n") break;
        i++;
      }
      if (!closed) return fail(open, "This quoted identifier is never closed.");
      continue;
    }

    // Backtick-quoted identifier, MySQL family.
    if (c === "`") {
      const open = i;
      i++;
      let closed = false;
      while (i < len) {
        if (sql[i] === "\\" && backslashEscapes) {
          i += 2;
          continue;
        }
        if (sql[i] === "`") {
          if (sql[i + 1] === "`") {
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) return fail(open, "This backtick-quoted identifier is never closed.");
      continue;
    }

    // Bracket-quoted identifier, SQL Server.
    if (c === "[" && language === "transactsql") {
      const open = i;
      i++;
      const end = sql.indexOf("]", i);
      if (end < 0) return fail(open, "This bracket-quoted identifier is never closed.");
      i = end + 1;
      continue;
    }

    if (c === "(") {
      if (openParens.length >= MAX_SQL_DEPTH) {
        return {
          kind: "problem",
          message: `This query nests parentheses more than ${MAX_SQL_DEPTH} levels deep, which this page refuses rather than format.`,
          line: null,
          column: null,
        };
      }
      openParens.push(i);
      i++;
      continue;
    }

    if (c === ")") {
      if (openParens.length === 0) {
        return fail(i, "This query has a closing parenthesis with nothing open.");
      }
      openParens.pop();
      i++;
      continue;
    }

    i++;
  }

  if (openParens.length > 0) {
    const at = openParens[openParens.length - 1]!;
    const { line: l, column } = positionAt(at);
    return {
      kind: "problem",
      message:
        openParens.length === 1
          ? "This query has an unclosed parenthesis, so it is not runnable yet. Fix the brackets and it will format."
          : `This query has ${openParens.length} unclosed parentheses, the first at line ${l}, column ${column}, so it is not runnable yet.`,
      line: l,
      column,
    };
  }

  return { kind: "clean" };
}

/** Keeps the first line only, then clips it. Never returns a run of 16 MB. */
export function condenseError(message: string): string {
  const firstLine = message.split("\n", 1)[0]!.trim();
  const clipped =
    firstLine.length > MAX_SQL_ERROR_CHARS
      ? `${firstLine.slice(0, MAX_SQL_ERROR_CHARS).trimEnd()}… (message shortened)`
      : firstLine;
  return clipped === "" ? "The formatter could not read this query." : clipped;
}

/** `line 3, column 8` only when both are real; a missing position is not invented. */
function withPosition(message: string, line: number | null, column: number | null): string {
  if (line === null || column === null) return message;
  return `${message} (line ${line}, column ${column})`;
}

export function formatSql(sql: string, options: SqlFormatOptions): SqlFormatResult {
  if (sql.trim() === "") return { kind: "empty" };

  if (sql.length > MAX_SQL_CHARS) {
    return {
      kind: "refused",
      message: `This query is ${sql.length.toLocaleString("en-US")} characters, over the ${MAX_SQL_CHARS.toLocaleString("en-US")}-character limit. Nothing was formatted.`,
    };
  }

  const preflight = preflightSql(sql, options.language);
  if (preflight.kind === "problem") {
    return {
      kind: "invalid-sql",
      message: withPosition(preflight.message, preflight.line, preflight.column),
      line: preflight.line,
      column: preflight.column,
    };
  }

  const formatOptions: FormatOptionsWithLanguage = {
    language: options.language,
    keywordCase: options.keywordCase,
    useTabs: options.indent === "tab",
    tabWidth: options.indent === "tab" ? 1 : Number(options.indent),
    linesBetweenQueries: options.linesBetweenQueries,
  };

  try {
    const formatted = format(sql, formatOptions);
    // Defence in depth. The preflight already refused the runaway cases, so this
    // only fires if the formatter starts returning something enormous for input
    // that passed — better a refusal than a tab-sized string.
    if (formatted.length > MAX_SQL_CHARS * 4) {
      return {
        kind: "refused",
        message: `Formatting this query produced ${formatted.length.toLocaleString("en-US")} characters, so it was not shown.`,
      };
    }
    return { kind: "formatted", sql: formatted };
  } catch (err) {
    // The position, when the formatter gives one, is on its own trailing
    // `at line N column M` fragment; keep it rather than dropping it in the clip.
    const raw = err instanceof Error ? err.message : String(err);
    const at = /at line (\d+) column (\d+)/.exec(raw);
    return {
      kind: "invalid-sql",
      message: withPosition(
        condenseError(raw),
        at ? Number(at[1]) : null,
        at ? Number(at[2]) : null,
      ),
      line: at ? Number(at[1]) : null,
      column: at ? Number(at[2]) : null,
    };
  }
}