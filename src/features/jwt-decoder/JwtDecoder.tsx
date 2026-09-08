"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { CopyButton, Field, StyledTextarea } from "@/components/ui";

function b64urlDecode(part: string): string | null {
  try {
    let b = part.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const bin = atob(b);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

function b64urlToBytes(part: string): Uint8Array<ArrayBuffer> {
  let b = part.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const NOW = Date.now();

function fmtDate(sec: number): string {
  const ms = Number.isFinite(sec) ? sec * 1000 : NaN;
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

interface ParseResult {
  valid: boolean;
  headerStr: string;
  payloadStr: string;
  alg: string;
  typ: string;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  rawHeader: string;
  rawPayload: string;
  rawSig: string;
}

function parseToken(token: string): ParseResult | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSig] = parts;
  const headerJson = b64urlDecode(rawHeader);
  const payloadJson = b64urlDecode(rawPayload);
  if (!headerJson || !payloadJson) return null;
  try {
    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);
    return {
      valid: true,
      headerStr: headerJson,
      payloadStr: payloadJson,
      alg: typeof header.alg === "string" ? header.alg : "—",
      typ: typeof header.typ === "string" ? header.typ : "—",
      header,
      payload,
      rawHeader,
      rawPayload,
      rawSig,
    };
  } catch {
    return null;
  }
}

export default function JwtDecoder() {
  const [token, setToken] = useState(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkJyYWluQ29kZXIiLCJpYXQiOjE3MTUxOTAyMDIsImV4cCI6MTc3NzkwNjIwMn0.9ZwGs2NbR1lpUHRBxQWjJs2SS4tr0xYViHjq5M0KgRU"
  );
  const [secret, setSecret] = useState("");
  const [now, setNow] = useState(NOW);
  const [verified, setVerified] = useState<{ input: string; secret: string; result: "ok" | "fail" } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parsed = useMemo(() => parseToken(token), [token]);

  useEffect(() => {
    let cancelled = false;
    if (!parsed || !parsed.rawSig || !secret.trim() || !parsed.alg.startsWith("HS")) {
      return;
    }
    const run = async () => {
      try {
        const alg = parsed.alg === "HS384" ? "SHA-384" : parsed.alg === "HS512" ? "SHA-512" : "SHA-256";
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(secret),
          { name: "HMAC", hash: alg },
          false,
          ["verify"]
        );
        const ok = await crypto.subtle.verify(
          "HMAC",
          key,
          b64urlToBytes(parsed.rawSig),
          new TextEncoder().encode(`${parsed.rawHeader}.${parsed.rawPayload}`)
        );
        if (!cancelled)
          setVerified({ input: token, secret, result: ok ? "ok" : "fail" });
      } catch {
        if (!cancelled) setVerified({ input: token, secret, result: "fail" });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [parsed, secret, token]);

  const rows = useMemo(() => {
    if (!parsed) return [];
    return Object.entries(parsed.payload).map(([key, value]) => {
      const num = typeof value === "number" ? value : typeof value === "string" && !Number.isNaN(Number(value)) ? Number(value) : null;
      const isDate = num !== null && (key === "exp" || key === "iat" || key === "nbf" || key === "auth_time");
      return { key, value, date: isDate ? fmtDate(num as number) : null, exp: key === "exp" ? (num as number) : null };
    });
  }, [parsed]);

  return (
    <div className="space-y-5 w-full">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Encoded JWT</p>
        <StyledTextarea rows={3} value={token} onChange={(e) => setToken(e.target.value)} className="font-mono text-xs" />
      </div>

      {!parsed ? (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          Not a valid 3-part JWT (header.payload.signature).
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Algorithm</p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm font-semibold text-slate-800">{parsed.alg}</p>
                <CopyButton text={parsed.alg} />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Type</p>
              <p className="font-mono text-sm font-semibold text-slate-800">{parsed.typ}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Signature</p>
              <p className="font-mono text-sm text-slate-800 truncate">{parsed.rawSig.slice(0, 24)}…</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Header</p>
                <CopyButton text={parsed.headerStr} />
              </div>
              <StyledTextarea rows={6} value={parsed.headerStr} readOnly className="bg-slate-100" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Payload</p>
                <CopyButton text={parsed.payloadStr} />
              </div>
              <StyledTextarea rows={6} value={parsed.payloadStr} readOnly className="bg-slate-100" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <p className="text-xs font-medium text-slate-500 px-4 pt-3 pb-1">Claims</p>
            <div className="divide-y divide-slate-100 text-sm">
              {rows.map((r) => (
                <div key={r.key} className="flex items-start gap-3 px-4 py-2.5">
                  <code className="w-32 shrink-0 text-indigo-700">{r.key}</code>
                  <div className="flex-1 text-slate-700 break-all">{String(r.value)}</div>
                  {r.exp !== null && (
                    <span className={`shrink-0 text-xs font-medium ${now > r.exp * 1000 ? "text-red-600" : "text-green-600"}`}>
                      {now > r.exp * 1000 ? "EXPIRED" : `valid ~${Math.max(0, Math.round((r.exp * 1000 - now) / 60000))}m`}
                    </span>
                  )}
                  {r.date && <span className="shrink-0 text-xs text-slate-400">{r.date}</span>}
                </div>
              ))}
            </div>
          </div>

          <Field label="Secret (verify HMAC signature)">
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste the HMAC secret to verify HS256/384/512 signatures"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>
          {secret.trim() && parsed.alg.startsWith("HS") && verified && verified.input === token && verified.secret === secret && (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                verified.result === "ok"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {verified.result === "ok" ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              {verified.result === "ok" ? "Signature is valid." : "Signature verification failed."}
            </div>
          )}
          {secret.trim() && !parsed.alg.startsWith("HS") && (
            <p className="text-xs text-slate-400">
              {parsed.alg} uses asymmetric keys — local verification isn&apos;t supported here.
            </p>
          )}
        </>
      )}
    </div>
  );
}