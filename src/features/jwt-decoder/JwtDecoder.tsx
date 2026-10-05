"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CircleAlert, KeyRound, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";
import {
  EM_DASH,
  MAX_TOKEN_CHARS,
  MAX_TOKEN_LABEL,
  REGISTERED_CLAIMS,
  analyzeToken,
  claimCount,
  claimRows,
  formatInt,
  prettyJson,
} from "./jwt-format";
import type { ClaimRow, SegmentReport, TokenAnalysis, Tone } from "./jwt-format";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-slate-500",
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
};

function segmentState(segment: SegmentReport): string {
  if (segment.ok) return "Decoded";
  if (segment.index === 2) return "Not decoded";
  return "Unreadable";
}

function SegmentRow({ segment }: { segment: SegmentReport }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="w-24 shrink-0 text-sm font-medium text-slate-700">{segment.name}</span>
      <span
        className={`w-28 shrink-0 text-xs font-semibold ${
          segment.ok ? "text-emerald-700" : "text-amber-700"
        }`}
      >
        {segmentState(segment)}
      </span>
      <span className="text-xs text-slate-500">
        {formatInt(segment.encodedLength)} characters
        {segment.byteLength !== null ? ` \u2192 ${formatInt(segment.byteLength)} bytes` : ""}
      </span>
      {segment.problem && (
        <span className="w-full text-xs text-amber-800 break-words">{segment.problem}</span>
      )}
    </li>
  );
}

function ClaimLine({ row }: { row: ClaimRow }) {
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="text-sm text-indigo-700 break-all">{row.key}</code>
        {row.relative && (
          <span className={`text-xs font-semibold ${TONE_CLASS[row.tone]}`}>{row.relative}</span>
        )}
      </div>
      <p className="text-sm text-slate-700 break-all">{row.text}</p>
      {row.truncated && (
        <p className="text-xs text-slate-500">
          Shown truncated — this claim is {formatInt(row.totalChars)} characters long; the copy
          button on the panel below gives you all of it.
        </p>
      )}
      {row.readable && <p className="text-xs font-mono text-slate-500">{row.readable}</p>}
      {row.note && <p className="text-xs text-amber-700">{row.note}</p>}
    </li>
  );
}

function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      role="region"
      aria-label={title}
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function JwtDecoder() {
  const [raw, setRaw] = useState("");
  const [nowMs, setNowMs] = useState(0);
  const tokenId = useId();
  const hintId = useId();

  const analysis: TokenAnalysis = useMemo(() => analyzeToken(raw), [raw]);
  const decoded = analysis.kind === "decoded" ? analysis : null;
  // Everything except the two states that have nothing to report: a structural
  // report always exists once there is input to look at.
  const shown = analysis.kind === "empty" || analysis.kind === "too-large" ? null : analysis;
  const rows = useMemo(() => (decoded ? claimRows(decoded.payload, nowMs) : []), [decoded, nowMs]);

  // The clock is only read while there is a date claim to read it against, and
  // it is armed after mount so the server render and the first client render
  // agree (a module-scope Date.now() would not).
  useEffect(() => {
    if (!decoded || rows.length === 0) return;
    const arm = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(arm);
      clearInterval(id);
    };
  }, [decoded, rows.length]);

  const overCap = raw.length > MAX_TOKEN_CHARS;
  const hasClaims = decoded ? claimCount(decoded.payload) > 0 : false;
  const registeredSeen = new Set(rows.map((r) => r.key));
  const registeredMissing = REGISTERED_CLAIMS.filter((c) => !registeredSeen.has(c));

  const headerJson = decoded ? prettyJson(decoded.header) : "";
  const payloadJson = decoded ? prettyJson(decoded.payload) : "";
  const claimCountValue = claimCount(decoded ? decoded.payload : null);

  return (
    // Decoding is synchronous and local: there is no pending state to announce,
    // and `aria-busy={false}` says exactly that rather than inventing work.
    <div className="space-y-4 w-full p-4 sm:p-6" aria-busy={false}>
      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm text-amber-900">
          <strong className="font-bold">Decoded, not verified.</strong> This page base64url-decodes
          a token and reads its claims. It has no key, no issuer and no way to check a signature,
          so it never tells you whether a token is authentic. Anyone can mint a token that says
          anything. Your token is read in this tab and is never sent anywhere.
        </p>
      </div>

      <div>
        <label htmlFor={tokenId} className="block text-sm font-medium text-slate-700 mb-2">
          JSON Web Token (compact serialization)
        </label>
        <StyledTextarea
          id={tokenId}
          rows={4}
          value={raw}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setRaw(e.target.value)}
          aria-describedby={hintId}
          aria-invalid={overCap}
          placeholder="Paste a token — header.payload.signature"
          className={`text-xs ${overCap ? "border-red-300" : ""}`}
        />
        <p id={hintId} className="mt-2 text-xs text-slate-500">
          Three dot-separated segments: header, payload, signature. Paste a token you are entitled
          to read — a token is a credential, and decoding one does not make it safe to share.
          {" "}
          {raw.length > 0
            ? `${formatInt(raw.length)} of ${MAX_TOKEN_LABEL}.`
            : `Input is capped at ${MAX_TOKEN_LABEL}; anything larger is refused before any decoding happens.`}
        </p>
      </div>

      {analysis.kind === "too-large" && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {analysis.message}
        </div>
      )}

      {analysis.kind === "refused" && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm space-y-1"
        >
          <p className="flex items-start gap-2">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Not read as a JWT.</strong> {analysis.message}
            </span>
          </p>
        </div>
      )}

      {shown && shown.notes.length > 0 && (
        <ul className="text-xs text-slate-500 space-y-1">
          {shown.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {analysis.kind === "empty" && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <KeyRound className="w-6 h-6 mx-auto mb-2 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">
            Paste a token above and its three segments are decoded here.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Algorithm {EM_DASH} issuer {EM_DASH} expiry {EM_DASH} no sample token is loaded, because a
            decoded sample is exactly the kind of thing that gets mistaken for a real one.
          </p>
        </div>
      )}

      {shown && (
        <div role="status" aria-live="polite" className="sr-only">
          {decoded
            ? `Decoded ${formatInt(decoded.segments.length)} segments and ${formatInt(claimCountValue)} claims. Decoded, not verified.`
            : "The input was not read as a JWT."}
        </div>
      )}

      {shown && (
        <Panel title="Structure">
          <ul className="divide-y divide-slate-100">
            {shown.segments.map((segment) => (
              <SegmentRow key={segment.name} segment={segment} />
            ))}
          </ul>
        </Panel>
      )}

      {decoded && (
        <>
          <Panel
            title="Header"
            actions={
              <CopyButton text={headerJson} ariaLabel="Copy the decoded header" disabled={!headerJson} />
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-3">
              {(
                [
                  ["Algorithm (alg)", decoded.alg],
                  ["Type (typ)", decoded.typ],
                  ["Key ID (kid)", decoded.kid],
                ] as Array<[string, string | null]>
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-mono font-semibold text-slate-800 break-all">
                    {value ?? <span className="text-slate-300">{EM_DASH}</span>}
                  </p>
                </div>
              ))}
            </div>
            <pre className="overflow-x-auto border-t border-slate-100 px-4 py-3 text-xs font-mono text-slate-700 whitespace-pre-wrap break-all">
              {headerJson}
            </pre>
          </Panel>

          <Panel
            title="Payload"
            actions={
              <CopyButton
                text={payloadJson}
                ariaLabel="Copy the decoded payload"
                disabled={!payloadJson}
              />
            }
          >
            {decoded.payloadShape !== "object" && (
              <p className="px-4 pt-3 text-xs text-amber-700">
                This payload is a JSON {decoded.payloadShape}, not a JSON object, so it has no
                named claims to read dates out of. RFC 7519 §7.2 does not require the payload to
                be an object — the JSON below is exactly what the segment holds.
              </p>
            )}
            <pre className="overflow-x-auto px-4 py-3 text-xs font-mono text-slate-700 whitespace-pre-wrap break-all">
              {payloadJson}
            </pre>
          </Panel>

          <Panel
            title={
              hasClaims
                ? `Claims (${formatInt(claimCountValue)})`
                : "Claims"
            }
          >
            {rows.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <ClaimLine key={row.key} row={row} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                This payload carries no named claims{" "}
                {decoded.payloadShape === "object" ? "— it is an empty JSON object." : "."}
              </p>
            )}
            {registeredMissing.length > 0 && (
              <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                Not present in this token: {registeredMissing.join(", ")}.
              </p>
            )}
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <CopyButton text={raw} ariaLabel="Copy the raw token" />
            <Button type="button" variant="secondary" onClick={() => setRaw("")}>
              <Trash2 className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
              Clear
            </Button>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              Decoded in this tab — the token never leaves the page.
            </span>
          </div>
        </>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-2">
        <p className="flex items-start gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-slate-800">What this tool cannot do.</strong> It
            does not verify the signature, does not check the token against an issuer, a JWKS
            endpoint or a public key, and does not tell you whether a claim is true. Decoding is
            just base64url plus JSON: the header and payload of a JWS are readable by anyone who
            has the token. To actually validate a token, send it to the service that issued it —
            or verify the signature yourself with the issuer&apos;s key.
          </span>
        </p>
        <p>
          It also only handles the signed compact form (three segments). A five-segment JWE is an
          encrypted token and cannot be read without the decryption key, so that is refused with a
          reason rather than half-decoded. Encrypted JWE payloads and nested or signed claims
          (JWT-in-JWT) are not followed.
        </p>
        <p>
          Base64 is encoding, not encryption — decoding proves nothing about confidentiality. And
          because the text you see comes from the token, it is attacker-controlled: treat every
          claim as data, not as an instruction, and never paste a token you found in a log into
          anything that acts on it.
        </p>
      </div>
    </div>
  );
}
