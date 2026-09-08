"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";
import { StyledTextarea } from "@/components/ui";

const SAMPLE = `{
  "name": "json-viewer",
  "version": "1.0.0",
  "dependencies": {
    "lucide-react": "^1.0.0",
    "next": "16.x"
  },
  "scripts": [
    { "name": "dev", "command": "next dev" },
    { "name": "build", "command": "next build" }
  ],
  "flags": [true, false, null, 1],
  "meta": {
    "keywords": ["json", "tree"]
  }
}`;

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `array[${v.length}]`;
  if (typeof v === "object") return `object (${Object.keys(v as object).length})`;
  return typeof v;
}

function colorOf(v: unknown): string {
  if (v === null) return "text-slate-400 italic";
  if (typeof v === "string") return "text-emerald-600";
  if (typeof v === "number") return "text-sky-600";
  if (typeof v === "boolean") return "text-amber-600";
  return "";
}

interface NodeProps {
  name: string;
  value: unknown;
  depth: number;
  last: boolean;
}

function JsonNode({ name, value, depth, last }: NodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const expandable = value !== null && typeof value === "object";

  if (!expandable) {
    return (
      <div className={`flex items-start gap-2 ${depth > 0 ? "border-l border-slate-100" : ""}`} style={{ paddingLeft: depth * 16 }}>
        <span className="text-violet-600 text-sm">{name}</span>
        <span className="text-slate-300">:</span>
        <span className={`text-sm ${colorOf(value)} break-all`}>{String(value)}</span>
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const isArray = Array.isArray(value);
  const toggleable = entries.length > 0;

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <button
        type="button"
        onClick={() => toggleable && setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-sm text-slate-700 ${toggleable ? "cursor-pointer hover:text-indigo-600" : "cursor-default"}`}
      >
        {toggleable ? (
          <span className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        ) : (
          <span className="w-3.5" />
        )}
        <span className="text-violet-600">{name}</span>
        <span className="text-slate-300">:</span>
        <span className="text-slate-400 text-xs">
          {isArray ? "[" : "{"}
          {toggleable ? `${entries.length} ${isArray ? (entries.length === 1 ? "item" : "items") : "key" + (entries.length === 1 ? "" : "s")}` : ""}
          {isArray ? "]" : "}"}
        </span>
        {last && <span className="text-slate-300">{isArray ? "" : ","}</span>}
      </button>
      {open && (
        <div className={depth > 0 ? "border-l border-slate-100 ml-1.5" : ""}>
          {entries.map(([k, v], i) => (
            <JsonNode key={k} name={isArray ? String(k) : k} value={v} depth={depth + 1} last={i === entries.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function JsonViewer() {
  const [input, setInput] = useState(SAMPLE);
  const [root, setRoot] = useState<unknown>(null);
  const [rootName, setRootName] = useState("");
  const [error, setError] = useState("");

  const parse = () => {
    setError("");
    try {
      const parsed: unknown = JSON.parse(input);
      if (parsed !== null && typeof parsed === "object") {
        const entries = Object.entries(parsed as Record<string, unknown>);
        if (entries.length === 1 && typeof entries[0][1] === "object" && entries[0][1] !== null) {
          setRoot(entries[0][1]);
          setRootName(entries[0][0]);
        } else {
          setRoot(parsed);
          setRootName("root");
        }
      } else {
        setRoot(parsed);
        setRootName("root");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON.");
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <ListTree className="w-4 h-4 text-slate-600" />
        <h2 className="text-sm font-semibold text-slate-700">JSON Tree Viewer</h2>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} placeholder="Paste JSON…" />
      <button
        type="button"
        onClick={parse}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition"
      >
        Render tree
      </button>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {root !== null && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-auto max-h-[36rem]">
          <p className="text-xs text-slate-400 mb-2 font-mono">Preview of “{rootName}” ({typeOf(root)})</p>
          <JsonNode name={rootName} value={root} depth={0} last />
        </div>
      )}
    </div>
  );
}