/**
 * Pure, browser-free helpers for the JWT Decoder.
 *
 * Nothing in here touches the DOM, `atob`, `Buffer`, `crypto` or the network:
 * the base64url decoder is written out by hand from RFC 4648 §5 so that a
 * character outside the alphabet is *rejected with a reason* rather than
 * silently dropped, and so the same code runs in the tab and under the Node
 * audit. Nothing here verifies a signature, because this tool cannot: a
 * decoder has no key material and no issuer to check against.
 */

export const EM_DASH = "\u2014";

/** Refuse anything larger before a single byte is decoded. */
export const MAX_TOKEN_CHARS = 262_144;

export const MAX_CLAIM_DISPLAY_CHARS = 200;

/** The RFC 7519 registered claims this tool reads a date out of. */
export const TIME_CLAIMS = ["exp", "nbf", "iat", "auth_time"] as const;

/** RFC 7519 §4.1 registered claims, in specification order. */
export const REGISTERED_CLAIMS = [
  "iss",
  "sub",
  "aud",
  "exp",
  "nbf",
  "iat",
  "jti",
] as const;

export type PayloadShape = "object" | "array" | "scalar";

export type Tone = "neutral" | "ok" | "warn" | "bad";

const B64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const SEGMENT_NAMES = ["Header", "Payload", "Signature"] as const;

/** Largest absolute epoch a JavaScript Date can represent (ECMA-262 §21.4.1.1). */
const MAX_DATE_MS = 8.64e15;

// ---------------------------------------------------------------------------
// formatting primitives
// ---------------------------------------------------------------------------

export function formatInt(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const MAX_TOKEN_LABEL = `${formatInt(MAX_TOKEN_CHARS)} characters (256 KB)`;

export function describeDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (!Number.isFinite(abs)) return "an unknown amount of time";
  if (abs < 1000) return "less than a second";
  const units: Array<[number, string]> = [
    [86400000, "day"],
    [3600000, "hour"],
    [60000, "minute"],
    [1000, "second"],
  ];
  const parts: string[] = [];
  let rest = Math.floor(abs);
  for (const [size, name] of units) {
    const n = Math.floor(rest / size);
    if (n > 0) {
      parts.push(`${formatInt(n)} ${name}${n === 1 ? "" : "s"}`);
      rest -= n * size;
    }
    if (parts.length === 2) break;
  }
  return parts.length > 0 ? parts.join(" ") : "less than a second";
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function describeJsonType(value: unknown): string {
  if (value === null) return "a JSON null";
  if (Array.isArray(value)) return "a JSON array";
  switch (typeof value) {
    case "object":
      return "a JSON object";
    case "string":
      return "a JSON string";
    case "number":
      return "a JSON number";
    case "boolean":
      return "a JSON boolean";
    default:
      return "a JSON value";
  }
}

export function describePayloadShape(value: unknown): PayloadShape {
  if (isPlainObject(value)) return "object";
  if (Array.isArray(value)) return "array";
  return "scalar";
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

export type Base64UrlResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: string };

function describeChar(ch: string): string {
  const code = ch.codePointAt(0) ?? 0;
  const printable = code >= 0x20 && code !== 0x7f;
  return printable ? `"${ch}"` : `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * RFC 4648 §5 ("base64url", the alphabet JWTs use) decoded by hand.
 *
 * `atob` is deliberately not used: it is forgiving about input this tool has to
 * be honest about. It accepts standard-Base64 `+` and `/`, it ignores
 * characters outside the alphabet on some engines, and it cannot say *which*
 * character was wrong. A token pasted out of a shell history or a log file is
 * exactly the case where a wrong character must be named.
 */
export function decodeBase64Url(segment: string): Base64UrlResult {
  if (segment.length === 0) {
    return { ok: false, reason: "the segment is empty" };
  }
  const values = new Map<string, number>();
  for (let i = 0; i < B64URL_ALPHABET.length; i++) {
    values.set(B64URL_ALPHABET[i], i);
  }
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (ch === "=") {
      return {
        ok: false,
        reason: `it contains "=" padding at position ${formatInt(i + 1)} — base64url (RFC 4648 §5) never pads`,
      };
    }
    if (ch === "+" || ch === "/") {
      return {
        ok: false,
        reason: `it contains "${ch}" at position ${formatInt(i + 1)} — that is standard Base64, not base64url (base64url uses "-" and "_")`,
      };
    }
    if (!values.has(ch)) {
      return {
        ok: false,
        reason: `it contains ${describeChar(ch)} at position ${formatInt(i + 1)}, which is outside the base64url alphabet (A-Z, a-z, 0-9, "-", "_")`,
      };
    }
  }
  const remainder = segment.length % 4;
  if (remainder === 1) {
    return {
      ok: false,
      reason: `it is ${formatInt(segment.length)} characters long — a base64 group is 4 characters carrying 3 bytes, so a remainder of 1 character can never be produced`,
    };
  }
  // Canonical base64 leaves the unused low bits of the final character zero.
  // Accepting a non-zero remainder would mean decoding bytes the encoder never
  // wrote, so it is refused with the position rather than quietly rounded off.
  const last = values.get(segment[segment.length - 1]) ?? 0;
  if (remainder === 2 && last % 0b10000 !== 0) {
    return {
      ok: false,
      reason: `its final character "${segment[segment.length - 1]}" carries unused bits that are not zero, so it is not a canonical base64url encoding`,
    };
  }
  if (remainder === 3 && last % 0b100 !== 0) {
    return {
      ok: false,
      reason: `its final character "${segment[segment.length - 1]}" carries unused bits that are not zero, so it is not a canonical base64url encoding`,
    };
  }

  const byteLength = Math.floor((segment.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (let i = 0; i < segment.length; i++) {
    buffer = (buffer << 6) | (values.get(segment[i]) as number);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out] = (buffer >> bits) & 0xff;
      out++;
    }
  }
  return { ok: true, bytes };
}

export type Utf8Result = { ok: true; text: string } | { ok: false; reason: string };

export function decodeUtf8Text(bytes: Uint8Array): Utf8Result {
  try {
    // `fatal` makes a broken or truncated multi-byte sequence an error instead
    // of a run of U+FFFD replacement characters.
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return {
      ok: false,
      reason: `the ${formatInt(bytes.length)} decoded bytes are not valid UTF-8 (a broken or truncated multi-byte sequence)`,
    };
  }
}

export type JsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: string };

export function parseJsonSegment(text: string): JsonResult {
  if (text.length === 0) {
    return { ok: false, reason: "the decoded segment is empty, so there is nothing to read" };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    return {
      ok: false,
      reason: `the decoded segment is not valid JSON (${detail}). It starts with: ${preview}`,
    };
  }
}

// ---------------------------------------------------------------------------
// scrubbing
// ---------------------------------------------------------------------------

export interface ScrubResult {
  text: string;
  notes: string[];
}

/** Remove what people paste around a token, and say what was removed. */
export function scrubInput(raw: string): ScrubResult {
  const notes: string[] = [];
  let text = raw;
  const trimmed = text.trim();
  if (trimmed !== text) notes.push("Ignored whitespace around the token.");
  text = trimmed;
  const bearer = /^bearer[ \t]+/i.exec(text);
  if (bearer) {
    notes.push(`Removed the leading “${bearer[0].trim()}” so the token itself is what gets decoded.`);
    text = text.slice(bearer[0].length).trim();
  }
  return { text, notes };
}

// ---------------------------------------------------------------------------
// structure
// ---------------------------------------------------------------------------

export interface SegmentReport {
  index: number;
  name: string;
  encodedLength: number;
  byteLength: number | null;
  ok: boolean;
  problem: string;
  text: string;
  json?: unknown;
}

function analyzeSegment(encoded: string, index: number): SegmentReport {
  const name = SEGMENT_NAMES[index] ?? `Segment ${index + 1}`;
  const report: SegmentReport = {
    index,
    name,
    encodedLength: encoded.length,
    byteLength: null,
    ok: false,
    problem: "",
    text: "",
  };
  if (index > 2) {
    return {
      ...report,
      problem:
        "A signed JWT (JWS compact serialization) has exactly three dot-separated segments, so this is not part of a token.",
    };
  }
  const decoded = decodeBase64Url(encoded);
  if (!decoded.ok) {
    // The empty signature is the unsecured-JWT case and needs its own wording:
    // a generic "the segment is empty" hides the one thing that matters about it.
    if (index === 2 && encoded.length === 0) {
      return {
        ...report,
        byteLength: 0,
        problem:
          'The signature segment is empty — this is an unsecured token ("alg": "none") and carries no signature at all.',
      };
    }
    return { ...report, problem: decoded.reason };
  }
  const text = decodeUtf8Text(decoded.bytes);
  if (!text.ok) return { ...report, byteLength: decoded.bytes.length, problem: text.reason };
  if (index === 2) {
    return { ...report, byteLength: decoded.bytes.length, ok: true };
  }
  const json = parseJsonSegment(text.text);
  if (!json.ok) return { ...report, byteLength: decoded.bytes.length, problem: json.reason };
  // RFC 7515 §4 requires the header to be a JSON object. A payload may legally
  // be anything at all (RFC 7519 §7.2 does not require an object), so a
  // non-object payload is decoded and disclosed rather than refused.
  if (index === 0 && !isPlainObject(json.value)) {
    return {
      ...report,
      byteLength: decoded.bytes.length,
      text: text.text,
      problem: `the header decoded, but it is ${describeJsonType(json.value)} — RFC 7515 §4 requires the JOSE header to be a JSON object`,
    };
  }
  return {
    ...report,
    byteLength: decoded.bytes.length,
    ok: true,
    text: text.text,
    json: json.value,
  };
}

export interface DecodedJwt {
  kind: "decoded";
  segments: SegmentReport[];
  header: Record<string, unknown>;
  payload: unknown;
  payloadShape: PayloadShape;
  alg: string | null;
  typ: string | null;
  kid: string | null;
  notes: string[];
}

export interface RefusedJwt {
  kind: "refused";
  message: string;
  segments: SegmentReport[];
  notes: string[];
}

export type TokenAnalysis =
  | { kind: "empty" }
  | { kind: "too-large"; message: string }
  | RefusedJwt
  | DecodedJwt;

function headerString(header: Record<string, unknown>, key: string): string | null {
  const value = header[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function analyzeToken(raw: string): TokenAnalysis {
  if (raw.length === 0) return { kind: "empty" };
  // The cap is checked first, before any split, decode or JSON parse happens.
  if (raw.length > MAX_TOKEN_CHARS) {
    return {
      kind: "too-large",
      message: `This token is ${formatInt(raw.length)} characters — the cap is ${MAX_TOKEN_LABEL}, and nothing was decoded. A JWT that size is not a real token: check for a copied blob, a certificate, or a truncated paste.`,
    };
  }
  const scrubbed = scrubInput(raw);
  const notes = scrubbed.notes;
  const text = scrubbed.text;
  if (text.length === 0) return { kind: "empty" };

  const parts = text.split(".");
  const segments = parts.map((part, i) => analyzeSegment(part, i));

  if (parts.length !== 3) {
    const message =
      parts.length === 5
        ? "This looks like a JWE — an encrypted token has five dot-separated segments. This tool decodes signed tokens (JWS) only, and it cannot decrypt anything."
        : `A signed JWT has exactly three dot-separated segments (header.payload.signature). This input has ${formatInt(
            parts.length,
          )} segment${parts.length === 1 ? "" : "s"}.`;
    return { kind: "refused", message, segments, notes };
  }
  if (!segments[0].ok) {
    return {
      kind: "refused",
      message: `The header segment could not be read: ${segments[0].problem}.`,
      segments,
      notes,
    };
  }
  if (!segments[1].ok) {
    return {
      kind: "refused",
      message: `The payload segment could not be read: ${segments[1].problem}.`,
      segments,
      notes,
    };
  }
  const header = segments[0].json as Record<string, unknown>;
  const payload = segments[1].json;
  if (!segments[2].ok) {
    notes.push(
      `The signature segment is not readable base64url (${segments[2].problem}) — that does not stop the header and payload from being shown, and it is still not checked.`,
    );
  }
  return {
    kind: "decoded",
    segments,
    header,
    payload,
    payloadShape: describePayloadShape(payload),
    alg: headerString(header, "alg"),
    typ: headerString(header, "typ"),
    kid: headerString(header, "kid"),
    notes,
  };
}

// ---------------------------------------------------------------------------
// claims
// ---------------------------------------------------------------------------

export interface ClaimRow {
  key: string;
  text: string;
  truncated: boolean;
  totalChars: number;
  isTimestamp: boolean;
  epochSeconds: number | null;
  readable: string | null;
  relative: string;
  tone: Tone;
  note: string;
}

function claimValueText(value: unknown): { text: string; truncated: boolean; total: number } {
  let text: string;
  if (typeof value === "string") text = value;
  else if (value === null || typeof value === "number" || typeof value === "boolean") {
    text = String(value);
  } else text = prettyJson(value).replace(/\n\s*/g, " ");
  if (text.length > MAX_CLAIM_DISPLAY_CHARS) {
    return {
      text: `${text.slice(0, MAX_CLAIM_DISPLAY_CHARS)}…`,
      truncated: true,
      total: text.length,
    };
  }
  return { text, truncated: false, total: text.length };
}

export function isTimeClaim(key: string): boolean {
  return (TIME_CLAIMS as readonly string[]).includes(key);
}

export function formatEpochSeconds(seconds: number): { iso: string; readable: string } | null {
  const ms = seconds * 1000;
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return { iso, readable: `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC` };
}

/**
 * The human reading of a NumericDate claim, in the words the claim deserves.
 * `nowMs` of 0 means "not measured yet" (the first server render), which
 * returns nothing rather than a number invented from the build machine's clock.
 */
export function relativeReading(
  key: string,
  epochSeconds: number,
  nowMs: number,
): { text: string; tone: Tone } {
  if (!(nowMs > 0)) return { text: "", tone: "neutral" };
  const deltaMs = epochSeconds * 1000 - nowMs;
  const past = deltaMs < 0;
  const span = describeDuration(deltaMs);
  switch (key) {
    case "exp":
      return past
        ? { text: `Expired ${span} ago`, tone: "bad" }
        : {
            text: `Expires in ${span}`,
            tone: deltaMs <= 60000 ? "warn" : "ok",
          };
    case "nbf":
      return past
        ? { text: `Valid since ${span} ago`, tone: "ok" }
        : { text: `Not valid for another ${span}`, tone: "warn" };
    case "iat":
      return past
        ? { text: `Issued ${span} ago`, tone: "neutral" }
        : { text: `Issued ${span} from now — that is in the future`, tone: "warn" };
    default:
      return past
        ? { text: `${span} ago`, tone: "neutral" }
        : { text: `in ${span}`, tone: "neutral" };
  }
}

function orderClaims(keys: string[]): string[] {
  const registered = REGISTERED_CLAIMS.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !(REGISTERED_CLAIMS as readonly string[]).includes(k));
  return [...registered, ...rest.sort()];
}

/**
 * One row per payload claim. A payload that is an array or a scalar has no
 * claims at all, and says so by returning no rows rather than by pretending.
 */
export function claimRows(payload: unknown, nowMs: number): ClaimRow[] {
  if (!isPlainObject(payload)) return [];
  return orderClaims(Object.keys(payload)).map((key) => {
    const value = payload[key];
    const shown = claimValueText(value);
    const isTimestamp = isTimeClaim(key);
    let epochSeconds: number | null = null;
    let note = "";
    if (isTimestamp) {
      if (typeof value === "number" && Number.isFinite(value)) {
        epochSeconds = value;
      } else if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
        epochSeconds = Number(value);
        note = `${key} is a JSON string here; RFC 7519 NumericDate is a number, so a server may not read it the way this page does.`;
      } else {
        note = `${key} is ${describeJsonType(value)}, not a NumericDate, so no date is shown for it.`;
      }
      if (epochSeconds !== null && formatEpochSeconds(epochSeconds) === null) {
        note = `${key} is outside the range a browser date can represent, so it is shown as written and not read as a date.`;
        epochSeconds = null;
      }
    }
    const reading =
      epochSeconds !== null ? relativeReading(key, epochSeconds, nowMs) : { text: "", tone: "neutral" as Tone };
    return {
      key,
      text: shown.text,
      truncated: shown.truncated,
      totalChars: shown.total,
      isTimestamp,
      epochSeconds,
      readable: epochSeconds !== null ? formatEpochSeconds(epochSeconds)?.readable ?? null : null,
      relative: reading.text,
      tone: reading.tone,
      note,
    };
  });
}

export function claimCount(payload: unknown): number {
  return isPlainObject(payload) ? Object.keys(payload).length : 0;
}
