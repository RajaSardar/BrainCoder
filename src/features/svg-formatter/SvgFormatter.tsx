"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Shapes } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";
import { formatCode } from "@/lib/formatCode";

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#6366f1"/><path fill="none" stroke="#fff" stroke-width="2" d="M8 12l3 3 5-6"/></svg>`;

export default function SvgFormatter() {
  const [input, setInput] = useState(SAMPLE);
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [printWidth, setPrintWidth] = useState(80);
  const [indentSize, setIndentSize] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; value: string }>({ ok: true, value: "" });

  const run = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      if (mode === "minify") {
        setResult({ ok: true, value: input.replace(/>\s+</g, "><").trim() });
      } else {
        const value = await formatCode(input, {
          parser: "html",
          plugins: ["html"],
          printWidth,
          tabWidth: indentSize,
        });
        setResult({ ok: true, value });
      }
    } catch (err) {
      setResult({ ok: false, value: err instanceof Error ? err.message : "Formatting failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["format", "minify"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                mode === m ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "format" ? "Format" : "Minify"}
            </button>
          ))}
        </div>
        {mode === "format" && (
          <>
            <label className="text-sm">
              <span className="block text-xs font-medium text-slate-500 mb-1">Print width</span>
              <input
                type="number"
                value={printWidth}
                min={20}
                max={200}
                onChange={(e) => setPrintWidth(Number(e.target.value))}
                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </label>
            <select
              value={indentSize}
              onChange={(e) => setIndentSize(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={1}>1 space</option>
            </select>
          </>
        )}
        <span className="flex items-center gap-1.5 text-sm">
          <Shapes className="w-4 h-4 text-rose-500" />
          {result.ok ? (
            <span className="text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {mode === "format" ? "Formatted" : "Minified"}
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Invalid markup
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={() => void run()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {mode === "format" ? "Format" : "Minify"} SVG
        </Button>
        <Button type="button" variant="secondary" onClick={() => setInput("")}>
          Clear
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">SVG</p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">{mode === "format" ? "Formatted" : "Minified"}</p>
            {result.ok && <CopyButton text={result.value} />}
          </div>
          <StyledTextarea rows={16} value={result.value} readOnly className="bg-slate-100 font-mono text-xs" />
          {!result.ok && <p className="text-xs text-red-600 mt-2">{result.value}</p>}
        </div>
      </div>
    </div>
  );
}