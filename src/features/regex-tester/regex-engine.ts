export interface RegexMatch {
  index: number;
  text: string;
  groups: (string | undefined)[];
}

export interface RegexResult {
  valid: boolean;
  error: string;
  matches: RegexMatch[];
  truncated: boolean;
  timedOut: boolean;
}

export interface RegexJob {
  pattern: string;
  flags: string;
  text: string;
  maxMatches: number;
  timeoutMs: number;
}

export const DEFAULT_MAX_MATCHES = 5000;
export const DEFAULT_TIMEOUT_MS = 400;

export function isSuspiciousPattern(pattern: string): boolean {
  return /\([^()]*[+*][^()]*\)[+*]/.test(pattern) || /\([^()]*\|[^()]*\)[+*]/.test(pattern);
}

export function runRegexJob(job: RegexJob): RegexResult {
  let re: RegExp;
  try {
    re = new RegExp(job.pattern, job.flags);
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid regular expression",
      matches: [],
      truncated: false,
      timedOut: false,
    };
  }

  if (!job.text) {
    return { valid: true, error: "", matches: [], truncated: false, timedOut: false };
  }

  const matches: RegexMatch[] = [];
  const clone = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const start = performance.now();
  let guard = 0;
  let truncated = false;
  let m: RegExpExecArray | null;

  while ((m = clone.exec(job.text)) !== null) {
    if (guard >= job.maxMatches) {
      truncated = true;
      break;
    }
    matches.push({ index: m.index, text: m[0], groups: m.slice(1) });
    if (m[0].length === 0) clone.lastIndex++;
    guard++;
    if (performance.now() - start > job.timeoutMs) {
      return { valid: true, error: "", matches, truncated, timedOut: true };
    }
    if (clone.lastIndex > job.text.length) break;
  }

  return { valid: true, error: "", matches, truncated, timedOut: false };
}

export function captureGroupNames(pattern: string): (string | null)[] {
  const names: (string | null)[] = [];
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === "[") {
      i++;
      while (i < pattern.length && pattern[i] !== "]") {
        if (pattern[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    if (char === "(") {
      const lookbehind = pattern.slice(i + 1, i + 4);
      const next = pattern.slice(i + 1, i + 3);
      if (next === "?<") {
        const close = pattern.indexOf(">", i + 3);
        const name = pattern.slice(i + 3, close);
        names.push(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : null);
        i = close + 1;
      } else if (
        next === "?:" ||
        next === "?=" ||
        next === "?!" ||
        lookbehind === "?<=" ||
        lookbehind === "?<!"
      ) {
        i++;
      } else {
        names.push(null);
        i++;
      }
      continue;
    }
    i++;
  }
  return names;
}

const WRAPPED_PATTERN_PATTERN = /^\/((?:[^\\/]|\\.)*)\/([dgimsuvy]*)$/;

export function parseRegexInput(
  input: string,
  checkboxFlags: string
): { pattern: string; flags: string; wrapped: boolean } {
  if (input.startsWith("/")) {
    const match = WRAPPED_PATTERN_PATTERN.exec(input);
    if (match) {
      const combined = new Set((checkboxFlags + match[2]).split(""));
      return { pattern: match[1], flags: [...combined].join(""), wrapped: true };
    }
  }
  return { pattern: input, flags: checkboxFlags, wrapped: false };
}

export const FLAG_OPTIONS = [
  { flag: "g", label: "g", hint: "global" },
  { flag: "i", label: "i", hint: "case-insensitive" },
  { flag: "m", label: "m", hint: "multiline" },
  { flag: "s", label: "s", hint: "dotAll" },
  { flag: "u", label: "u", hint: "unicode" },
  { flag: "d", label: "d", hint: "indices" },
  { flag: "y", label: "y", hint: "sticky" },
] as const;