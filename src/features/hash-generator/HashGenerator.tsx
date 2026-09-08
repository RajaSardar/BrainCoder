"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Field, Button, CopyButton } from "@/components/ui";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algo = (typeof ALGORITHMS)[number];

export default function HashGenerator() {
  const [input, setInput] = useState("Hello, world!");
  const [result, setResult] = useState<Record<Algo, string>>({
    "SHA-1": "",
    "SHA-256": "",
    "SHA-384": "",
    "SHA-512": "",
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const entries = await Promise.all(
        ALGORITHMS.map(async (algo) => {
          const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(input || ""));
          const hex = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          return [algo, hex] as const;
        })
      );
      if (cancelled) return;
      setResult(Object.fromEntries(entries) as Record<Algo, string>);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [input]);

  return (
    <div className="space-y-5 w-full">
      <Field label="Input text">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="Type or paste text to hash…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-y"
        />
      </Field>

      <div className="space-y-2">
        {ALGORITHMS.map((algo) => (
          <div key={algo} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-slate-500">{algo}</p>
              <CopyButton text={result[algo]} />
            </div>
            <p className="font-mono text-sm text-teal-700 break-all">{result[algo]}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" onClick={() => setInput("")} variant="secondary">
          Clear
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Fingerprint className="w-3.5 h-3.5" /> Computed locally with the Web Crypto API.
        </div>
      </div>
    </div>
  );
}