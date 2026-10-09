export const MIN_BASE = 2;
export const MAX_BASE = 36;
export const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export const INPUT_BASES: number[] = Array.from({ length: MAX_BASE - MIN_BASE + 1 }, (_, i) => MIN_BASE + i);

export type Row = { label: string; value: string; note?: string };

export type ConvertResult =
  | { kind: "empty" }
  | { kind: "invalid"; error: string }
  | { kind: "converted"; value: bigint; rows: Row[] };

const PREFIX_FOR_BASE: Record<number, string> = { 2: "0b", 8: "0o", 16: "0x" };

/**
 * Remove a sign and, when it matches the selected base, that base's radix prefix.
 *
 * The prefix is only stripped when it belongs to the base being read: "0b11" is
 * binary in base 2 but is a perfectly ordinary hex number in base 16, and "0x10"
 * in base 10 is an error rather than a licence to reinterpret what was typed.
 */
export function stripRadixPrefix(raw: string, base: number): { digits: string; negative: boolean; prefix: string } {
  let t = raw.trim().toLowerCase();
  let negative = false;
  if (t.startsWith("-") || t.startsWith("+")) {
    negative = t[0] === "-";
    t = t.slice(1);
  }
  const prefix = PREFIX_FOR_BASE[base] ?? "";
  let stripped = "";
  if (prefix && t.startsWith(prefix)) {
    stripped = prefix;
    t = t.slice(prefix.length);
  }
  return { digits: t, negative, prefix: stripped };
}

export function parseInBase(base: number, digits: string, negative: boolean): bigint | null {
  const alphabet = DIGITS.slice(0, base);
  if (digits.length === 0) return null;
  let value = BigInt(0);
  for (const ch of digits) {
    const d = alphabet.indexOf(ch);
    if (d < 0) return null;
    value = value * BigInt(base) + BigInt(d);
  }
  return negative ? -value : value;
}

/** U+ notation for a code point, with the character itself when it is a real scalar value. */
export function codePointRow(value: bigint): Row {
  const outOfRange = value < BigInt(0) || value > BigInt(0x10ffff);
  if (outOfRange) return { label: "Unicode code point", value: "—", note: "outside U+0000–U+10FFFF" };
  const n = Number(value);
  const hex = n.toString(16).toUpperCase().padStart(4, "0");
  const surrogate = n >= 0xd800 && n <= 0xdfff;
  return {
    label: "Unicode code point",
    value: `U+${hex}`,
    note: surrogate ? "surrogate half — not a character on its own" : String.fromCodePoint(n),
  };
}

export function convert(input: string, base: number): ConvertResult {
  if (input.trim() === "") return { kind: "empty" };
  const { digits, negative, prefix } = stripRadixPrefix(input, base);
  if (digits.length === 0) {
    return { kind: "invalid", error: `Enter digits after the ${prefix || "sign"} — there is nothing to convert.` };
  }
  const value = parseInBase(base, digits, negative);
  if (value === null) {
    const bad = [...digits].find((ch) => DIGITS.slice(0, base).indexOf(ch) < 0) ?? "?";
    return { kind: "invalid", error: `“${bad}” is not a digit in base ${base}.` };
  }
  const neg = value < BigInt(0);
  const abs = neg ? -value : value;
  const sign = neg ? "-" : "";
  return {
    kind: "converted",
    value,
    rows: [
      { label: "Binary (2)", value: `${sign}0b${abs.toString(2)}` },
      { label: "Octal (8)", value: `${sign}0o${abs.toString(8)}` },
      { label: "Decimal (10)", value: `${sign}${abs.toString(10)}` },
      { label: "Hexadecimal (16)", value: `${sign}0x${abs.toString(16).toUpperCase()}` },
      codePointRow(value),
    ],
  };
}
