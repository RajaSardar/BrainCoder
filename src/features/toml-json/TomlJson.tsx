"use client";

import { useState } from "react";
import { FileCog } from "lucide-react";
import { parse, stringify } from "smol-toml";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const JSON_SAMPLE = `{
  "title": "Smol TOML",
  "version": "1.0.0",
  "owner": {
    "name": "Raja",
    "dob": "1992-01-01T00:00:00Z"
  },
  "servers": [
    { "host": "10.0.0.1", "ports": [8001, 8002] },
    { "host": "10.0.0.2", "ports": [9001, 9002] }
  ]
}`;

const TOML_SAMPLE = `title = "Smol TOML"
version = "1.0.0"

[owner]
name = "Raja"
dob = 1992-01-01T00:00:00Z

[[servers]]
host = "10.0.0.1"
ports = [8001, 8002]

[[servers]]
host = "10.0.0.2"
ports = [9001, 9002]
`;

export default function TomlJson() {
  const [mode, setMode] = useState<"toToml" | "toJson">("toToml");
  const [input, setInput] = useState(JSON_SAMPLE);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const convert = () => {
    setError("");
    try {
      if (mode === "toToml") {
        setOutput(stringify(JSON.parse(input)));
      } else {
        setOutput(JSON.stringify(parse(input), null, 2));
      }
    } catch (e) {
      setOutput("");
      setError(e instanceof Error ? e.message : "Conversion failed.");
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <FileCog className="w-4 h-4 text-orange-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["toToml", "toJson"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "toToml" ? "JSON → TOML" : "TOML → JSON"}
            </button>
          ))}
        </div>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={12} placeholder={mode === "toToml" ? "Paste JSON…" : "Paste TOML…"} />
      {mode === "toJson" && (
        <p className="text-xs text-slate-400">
          Tip: set the input textarea to <button type="button" onClick={() => setInput(TOML_SAMPLE)} className="text-orange-600 underline">this TOML sample</button>.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={convert}>Convert</Button>
        <CopyButton text={output} />
      </div>

      <StyledTextarea readOnly value={output} rows={12} placeholder="Converted output…" />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <p className="text-xs text-slate-400">Arrays of objects become [[array-of-tables]] — passes the classic “servers” spec example from toml-lang.org.</p>
    </div>
  );
}