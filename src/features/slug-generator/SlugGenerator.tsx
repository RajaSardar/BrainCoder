"use client";

import { useState } from "react";
import { Slash } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const SAMPLE = "Hello, World! This is a URL slug generator.";

export default function SlugGenerator() {
  const [input, setInput] = useState(SAMPLE);
  const [separator, setSeparator] = useState<"-" | "_" | "">("-");
  const [lowercase, setLowercase] = useState(true);
  const [output, setOutput] = useState("");

  const generate = () => {
    let s = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    if (lowercase) s = s.toLowerCase();
    if (separator === "") {
      s = s.replace(/[^a-z0-9]+/gi, "");
    } else {
      s = s.replace(/[^a-z0-9]+/gi, separator);
      s = s.replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
      s = s.replace(new RegExp(`\\${separator}{2,}`, "g"), separator);
    }
    setOutput(s);
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Slash className="w-4 h-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-slate-700">URL Slug Generator</h2>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="Text to slugify…" />

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">Separator</label>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {(["-", "_", ""] as const).map((sep) => (
              <button
                key={sep === "" ? "none" : sep}
                type="button"
                onClick={() => setSeparator(sep)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${separator === sep ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {sep === "" ? "None" : sep === "-" ? "Dash (-)" : "Underscore (_)"}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pt-5">
          <input type="checkbox" checked={lowercase} onChange={(e) => setLowercase(e.target.checked)} className="accent-sky-600 w-4 h-4" />
          Lowercase
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={generate}>Generate</Button>
        <CopyButton text={output} />
      </div>

      <StyledTextarea readOnly value={output} rows={3} placeholder="Slug appears here…" />
      {output && (
        <p className="text-xs text-slate-400">
          Length: {output.length} · {output.length === 0 ? "0 words" : `${output.split(output.includes("-") ? "-" : output.includes("_") ? "_" : /[^a-z0-9]/).filter(Boolean).length} segment(s)`}
        </p>
      )}
    </div>
  );
}