"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Field, Button, CopyButton } from "@/components/ui";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algo = (typeof ALGORITHMS)[number];

const EMPTY_RESULTS: Record<Algo, string> = {
  "SHA-1": "",
  "SHA-256": "",
  "SHA-384": "",
  "SHA-512": "",
};

const MAX_INPUT = 1_000_000;

async function hexDigest(algo: Algo, input: string): Promise<string> {
  const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function HashGenerator() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Record<Algo, string>>(EMPTY_RESULTS);
  const [pending, setPending] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (typeof crypto === "undefined" || !crypto.subtle) {
        if (!cancelled) setUnsupported(true);
        return;
      }
      if (!input) {
        if (!cancelled) {
          setResult(EMPTY_RESULTS);
          setPending(false);
        }
        return;
      }
      setPending(true);
      try {
        const entries = await Promise.all(
          ALGORITHMS.map(async (algo) => [algo, await hexDigest(algo, input)] as const),
        );
        if (!cancelled) {
          setUnsupported(false);
          setResult(Object.fromEntries(entries) as Record<Algo, string>);
        }
      } catch {
        if (!cancelled) setUnsupported(true);
      } finally {
        if (!cancelled) setPending(false);
      }
    }, input ? 150 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input]);

  const allHashes = ALGORITHMS.map((algo) => `${algo}: ${result[algo]}`).join("\n");

  return (
    <div className="space-y-5 w-full">
      <Field label="Input text">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          maxLength={MAX_INPUT}
          placeholder="Type or paste text to hash…"
          aria-label="Input text"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-y"
        />
        {input.length >= MAX_INPUT && (
          <p className="text-xs text-slate-500 mt-1">
            Input capped at {MAX_INPUT.toLocaleString()} characters.
          </p>
        )}
      </Field>

      {unsupported && (
        <p
          role="alert"
          className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
        >
          Your browser doesn&apos;t expose the Web Crypto API (crypto.subtle), so hashes can&apos;t be
          computed here. Try a current version of Chrome, Firefox, Edge or Safari.
        </p>
      )}

      <div className="space-y-2" role="status" aria-live="polite" aria-busy={pending}>
        {ALGORITHMS.map((algo) => (
          <div key={algo} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-slate-500">{algo}</p>
              <CopyButton
                text={result[algo]}
                disabled={!result[algo]}
                ariaLabel={`Copy ${algo} hash`}
              />
            </div>
            <p className="font-mono text-sm text-teal-700 break-all">
              {result[algo] || <span className="text-slate-300">—</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" onClick={() => setInput("")} variant="secondary">
          Clear
        </Button>
        <CopyButton
          text={allHashes}
          label="Copy all"
          ariaLabel="Copy all hashes"
          disabled={!input.trim()}
        />
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Fingerprint className="w-3.5 h-3.5" /> Computed locally in your browser with the Web
          Crypto API — nothing leaves your device.
        </div>
      </div>
    </div>
  );
}