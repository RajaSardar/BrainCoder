import CronExpressionParser, { type CronFieldCollection } from "cron-parser";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CronResult =
  | { kind: "empty" }
  | { kind: "invalid"; error: string }
  | { kind: "parsed"; next: Date[] };

/**
 * Library messages that are true but unreadable, mapped to the same fact in plain
 * English. Anything unmapped is passed through unchanged — the parser's own words
 * are still the most accurate description of what it found.
 */
export function friendlyCronError(message: string): string {
  if (message === "Invalid explicit day of month definition") {
    return "That day of the month never occurs in that month — February 30, April 31 and so on.";
  }
  return message;
}

/**
 * cron-parser itself accepts anything from one to six fields and silently fills
 * the rest with wildcards, so "* * * *" parses without complaint and renders as
 * if it were a five-field expression. This restates the real rule before the
 * library is asked: a macro, or five fields, or six with seconds first.
 */
export function fieldCountError(expr: string): string | null {
  const trimmed = expr.trim();
  if (trimmed.startsWith("@")) return null;
  const fields = trimmed.split(/\s+/).filter(Boolean).length;
  if (fields === 5 || fields === 6) return null;
  return `A cron expression has 5 fields (minute hour day-of-month month day-of-week), or 6 with seconds first — you typed ${fields}.`;
}

export function parseCron(expr: string, count: number, nowMs: number): CronResult {
  if (!expr.trim()) return { kind: "empty" };
  const countError = fieldCountError(expr);
  if (countError) return { kind: "invalid", error: countError };
  try {
    const interval = CronExpressionParser.parse(expr, nowMs ? { currentDate: new Date(nowMs) } : undefined);
    const next: Date[] = [];
    for (let i = 0; i < count; i++) next.push(interval.next().toDate());
    return { kind: "parsed", next };
  } catch (err) {
    return { kind: "invalid", error: friendlyCronError(err instanceof Error ? err.message : "Invalid cron expression.") };
  }
}

/**
 * The parsed fields, one line each. The seconds line appears only for a 6-field
 * expression, because the parser materialises `second` for every expression (a
 * 5-field one silently gets second: 0) and printing that would invent a field the
 * reader did not type; weekday numbers are shown as names and 0 and 7 (both
 * Sunday) are collapsed, so "0,7" reads "Sun" rather than "Sun, Sun".
 */
export function describeFields(expr: string): string {
  if (fieldCountError(expr)) return "";
  let fields: CronFieldCollection;
  try {
    fields = CronExpressionParser.parse(expr).fields;
  } catch {
    return "";
  }
  const tokens = expr.trim().split(/\s+/);
  const hasSeconds = tokens.length === 6 && !tokens[0].startsWith("@");
  const fmt = (field: { values: ArrayLike<number | string>; isWildcard: boolean }) =>
    field.isWildcard ? "*" : Array.from(field.values).join(", ");
  const dow = (field: { values: ArrayLike<number | string>; isWildcard: boolean }) =>
    field.isWildcard
      ? "*"
      : [
          ...new Set(
            Array.from(field.values).map((v) =>
              typeof v === "number" ? WEEKDAYS[v % 7] ?? String(v) : String(v),
            ),
          ),
        ].join(", ");
  const lines = [
    hasSeconds ? `second: ${fmt(fields.second)}` : null,
    `minute: ${fmt(fields.minute)}`,
    `hour: ${fmt(fields.hour)}`,
    `day of month: ${fmt(fields.dayOfMonth)}`,
    `month: ${fmt(fields.month)}`,
    `day of week: ${dow(fields.dayOfWeek)}`,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
