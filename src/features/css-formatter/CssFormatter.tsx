"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";
import { formatCode } from "@/lib/formatCode";

const SAMPLE = `.card{display:flex;flex-direction:column;gap:.5rem;padding:1rem 1.5rem;border:1px solid #e2e8f0;border-radius:.75rem}.card:hover{box-shadow:0 10px 15px -3px rgb(0 0 0/.1)}@media (max-width:640px){.card{flex-direction:row}}`;

export default function CssFormatter() {
  const [input, setInput] = useState(SAMPLE);
  const [printWidth, setPrintWidth] = useState(80);
  const [tabWidth, setTabWidth] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; value: string }>({ ok: true, value: "" });

  const run = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const value = await formatCode(input, {
        parser: "css",
        plugins: ["postcss"],
        printWidth,
        tabWidth,
      });
      setResult({ ok: true, value });
    } catch (err) {
      setResult({ ok: false, value: err instanceof Error ? err.message : "Formatting failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block text-xs font-medium text-slate-500 mb-1">Print width</span>
          <input
            type="number"
            value={printWidth}
            min={20}
            max={200}
            onChange={(e) => setPrintWidth(Number(e.target.value))}
            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-slate-500 mb-1">Tab width</span>
          <input
            type="number"
            value={tabWidth}
            min={2}
            max={8}
            onChange={(e) => setTabWidth(Number(e.target.value))}
            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>
        <Button type="button" disabled={busy} onClick={() => void run()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Format
        </Button>
        <Button type="button" variant="secondary" onClick={() => setInput("")}>
          Clear
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">CSS</p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              Formatted
              {result.ok ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
            </p>
            {result.ok && <CopyButton text={result.value} />}
          </div>
          <StyledTextarea rows={16} value={result.value} readOnly className="bg-slate-100 font-mono text-xs" />
          {!result.ok && <p className="text-xs text-red-600 mt-2">{result.value}</p>}
        </div>
      </div>
    </div>
  );
}