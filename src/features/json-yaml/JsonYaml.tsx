"use client";

import { useState } from "react";
import { FileJson2 } from "lucide-react";
import { dump, load } from "js-yaml";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const JSON_SAMPLE = `{
  "app": "BrainCoder",
  "port": 3000,
  "debug": false,
  "regions": ["us-east-1", "eu-west-1"],
  "database": {
    "host": "localhost",
    "replicas": 2,
    "ssl": {
      "enabled": true,
      "cert": "star.example.com"
    }
  }
}`;

const YAML_SAMPLE = `app: BrainCoder
port: 3000
debug: false
regions:
  - us-east-1
  - eu-west-1
database:
  host: localhost
  replicas: 2
  ssl:
    enabled: true
    cert: star.example.com
`;

export default function JsonYaml() {
  const [mode, setMode] = useState<"toYaml" | "toJson">("toYaml");
  const [input, setInput] = useState(JSON_SAMPLE);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const convert = () => {
    setError("");
    try {
      if (mode === "toYaml") {
        setOutput(dump(JSON.parse(input), { indent: 2, lineWidth: -1, noRefs: true }).trimEnd());
      } else {
        setOutput(JSON.stringify(load(input), null, 2));
      }
    } catch (e) {
      setOutput("");
      setError(e instanceof Error ? e.message : "Conversion failed.");
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <FileJson2 className="w-4 h-4 text-amber-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["toYaml", "toJson"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-amber-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "toYaml" ? "JSON → YAML" : "YAML → JSON"}
            </button>
          ))}
        </div>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={12} placeholder={mode === "toYaml" ? "Paste JSON…" : "Paste YAML…"} />
      {mode === "toJson" && (
        <p className="text-xs text-slate-400">
          Tip: set the input textarea to <button type="button" onClick={() => setInput(YAML_SAMPLE)} className="text-amber-600 underline">this YAML sample</button>.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={convert}>Convert</Button>
        <CopyButton text={output} />
      </div>

      <StyledTextarea readOnly value={output} rows={12} placeholder="Converted output…" />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <p className="text-xs text-slate-400">Uses the js-yaml parser — full YAML 1.2 support including anchors, aliases and inline structures.</p>
    </div>
  );
}