export type Perm = "read" | "write" | "execute";
export type Group = "user" | "group" | "other";
export type Trio = Record<Group, readonly Perm[]>;

export const PERMS: { id: Perm; label: string; value: number }[] = [
  { id: "read", label: "r (4)", value: 4 },
  { id: "write", label: "w (2)", value: 2 },
  { id: "execute", label: "x (1)", value: 1 },
];

export const GROUPS: { id: Group; label: string }[] = [
  { id: "user", label: "User (owner)" },
  { id: "group", label: "Group" },
  { id: "other", label: "Other" },
];

export const PERM_LETTER: Record<Perm, string> = { read: "r", write: "w", execute: "x" };
export const PERM_BY_LETTER: Record<string, Perm> = { r: "read", w: "write", x: "execute" };

export const DEFAULT_TRIO: Trio = {
  user: ["read", "write", "execute"],
  group: ["read", "execute"],
  other: ["read", "execute"],
};

/** 755-style digit for one category: read=4, write=2, execute=1. */
export function octalDigit(perms: readonly Perm[]): number {
  let n = 0;
  for (const p of PERMS) if (perms.includes(p.id)) n += p.value;
  return n;
}

export function permsFromDigit(digit: number): Perm[] {
  const out: Perm[] = [];
  if (digit >= 4) out.push("read");
  if (digit % 4 >= 2) out.push("write");
  if (digit % 2 === 1) out.push("execute");
  return out;
}

/** rwx triplet for one category, always in r-w-x order regardless of how the user ticked. */
export function symbolicTriplet(perms: readonly Perm[]): string {
  return PERMS.map((p) => (perms.includes(p.id) ? PERM_LETTER[p.id] : "-")).join("");
}

export function toOctal(trio: Trio): string {
  return `${octalDigit(trio.user)}${octalDigit(trio.group)}${octalDigit(trio.other)}`;
}

export function toSymbolic(trio: Trio): string {
  return `${symbolicTriplet(trio.user)}${symbolicTriplet(trio.group)}${symbolicTriplet(trio.other)}`;
}

/**
 * u=rwx,g=r-x,o=r-x — the form `chmod` itself accepts. Categories are spelled with
 * just the letters that are set (no trailing dashes), and a category with nothing
 * set is `u=-`.
 */
export function toChmodStyle(trio: Trio): string {
  const part = (g: Group) => {
    const present = PERMS.filter((p) => trio[g].includes(p.id))
      .map((p) => PERM_LETTER[p.id])
      .join("");
    return present || "-";
  };
  return `u=${part("user")},g=${part("group")},o=${part("other")}`;
}

export type OctalDraft =
  | { state: "empty" }
  | { state: "incomplete" }
  | { state: "invalid"; message: string }
  | { state: "ok"; trio: Trio };

/**
 * Read what is in the octal box while it is being typed.
 *
 * A controlled input cannot be validated on the way in without also deciding what
 * to render next, so the draft is classified rather than applied: "6" and "64" are
 * incomplete, "648" and "7555" are invalid, and only a complete three-digit octal
 * value produces a new permission set.
 */
export function classifyOctalDraft(raw: string): OctalDraft {
  const value = raw.trim();
  if (value === "") return { state: "empty" };
  if (!/^[0-7]+$/.test(value)) {
    return { state: "invalid", message: "Digits 0-7 only — this is octal, so 8 and 9 do not exist." };
  }
  if (value.length > 3) {
    return { state: "invalid", message: "Enter a 3-digit octal value like 644." };
  }
  if (value.length < 3) return { state: "incomplete" };
  const trio: Trio = {
    user: permsFromDigit(Number(value[0])),
    group: permsFromDigit(Number(value[1])),
    other: permsFromDigit(Number(value[2])),
  };
  return { state: "ok", trio };
}

export const PRESETS = ["400", "600", "644", "664", "700", "755", "777"] as const;

/** One line of plain-English description of what a mode does, used by the copy and the guide. */
export function describeOctal(value: string): string {
  const digits = value.split("").map(Number);
  const labels = ["owner", "group", "others"];
  return digits
    .map((d, i) => `${labels[i]} ${symbolicTriplet(permsFromDigit(d))}`)
    .join(", ");
}
