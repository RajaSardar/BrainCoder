"use client";

import { useCallback, useState } from "react";
import { Hash, Copy, Check } from "lucide-react";
import { Button, Field } from "@/components/ui";

function generateUuid(count: number, uppercase: boolean, noDashes: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let u = crypto.randomUUID();
    if (noDashes) u = u.replace(/-/g, "");
    if (uppercase) u = u.toUpperCase();
    out.push(u);
  }
  return out;
}

export default function UuidGenerator() {
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [uuids, setUuids] = useState<string[]>(() => generateUuid(5, false, false));
  const [copiedAll, setCopiedAll] = useState(false);

  const regenerate = useCallback(() => {
    setUuids(generateUuid(count, uppercase, noDashes));
  }, [count, uppercase, noDashes]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(uuids.join("\n"));
    } catch {
      /* ignore */
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const copyOne = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={`Count: ${count}`}>
          <input
            type="range"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-48 accent-blue-600"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => setUppercase(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Uppercase
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <input
            type="checkbox"
            checked={noDashes}
            onChange={(e) => setNoDashes(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          No hyphens
        </label>
        <Button type="button" onClick={regenerate}>
          <Hash className="w-4 h-4 mr-1.5 inline" /> Generate
        </Button>
        <Button type="button" variant="secondary" onClick={copyAll}>
          {copiedAll ? <Check className="w-4 h-4 mr-1.5 inline text-green-600" /> : <Copy className="w-4 h-4 mr-1.5 inline" />}
          {copiedAll ? "Copied" : "Copy all"}
        </Button>
      </div>

      {uuids.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {uuids.map((u, i) => (
            <div
              key={`${u}-${i}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <code className="font-mono text-sm text-blue-700 break-all">{u}</code>
              <button
                type="button"
                onClick={() => copyOne(u)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
                aria-label="Copy UUID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}