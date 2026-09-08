"use client";

import { useState } from "react";
import { CodeXml } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const JSON_SAMPLE = `{
  "name": "BrainCoder",
  "version": 1.0,
  "tags": ["dev", "tools"],
  "owner": {
    "name": "Raja",
    "active": true
  }
}`;

const XML_SAMPLE = `<root>
  <name>BrainCoder</name>
  <version>1.0</version>
  <tags>dev</tags>
  <tags>tools</tags>
  <owner>
    <name>Raja</name>
    <active>true</active>
  </owner>
</root>`;

export default function JsonXml() {
  const [mode, setMode] = useState<"toXml" | "toJson">("toXml");
  const [input, setInput] = useState(JSON_SAMPLE);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const convert = () => {
    setError("");
    try {
      setOutput(mode === "toXml" ? jsonToXmlString(input) : xmlToJsonString(input));
    } catch (e) {
      setOutput("");
      setError(e instanceof Error ? e.message : "Conversion failed.");
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <CodeXml className="w-4 h-4 text-indigo-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["toXml", "toJson"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === m ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "toXml" ? "JSON → XML" : "XML → JSON"}
            </button>
          ))}
        </div>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} placeholder={mode === "toXml" ? "Paste JSON…" : "Paste XML…"} />
      {mode === "toJson" && (
        <p className="text-xs text-slate-400">
          Tip: set the input textarea to <button type="button" onClick={() => setInput(XML_SAMPLE)} className="text-indigo-600 underline">this XML sample</button>.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={convert}>Convert</Button>
        <CopyButton text={output} />
      </div>

      <StyledTextarea readOnly value={output} rows={10} placeholder="Converted output…" />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <p className="text-xs text-slate-400">
        Convention: repeated elements become arrays, and <code className="text-slate-500">@attr</code> / <code className="text-slate-500">#text</code> keys map to XML attributes / text content.
      </p>
    </div>
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function appendXml(value: unknown, name: string, out: string[], indent: number): void {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) {
    out.push(`${pad}<${name}/>`);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) appendXml(item, name, out, indent);
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const attrs = Object.entries(record).filter(([k]) => k.startsWith("@"));
    const children = Object.entries(record).filter(([k]) => !k.startsWith("@") && k !== "#text");
    const text = record["#text"];
    const attrStr = attrs.map(([k, v]) => ` ${k.slice(1)}="${escapeXml(String(v))}"`).join("");
    if (children.length === 0) {
      if (text === undefined || text === null) {
        out.push(`${pad}<${name}${attrStr}/>`);
      } else {
        out.push(`${pad}<${name}${attrStr}>${escapeXml(String(text))}</${name}>`);
      }
      return;
    }
    out.push(`${pad}<${name}${attrStr}>`);
    if (text !== undefined && text !== null) out.push(`${pad}  ${escapeXml(String(text))}`);
    for (const [key, val] of children) appendXml(val, key, out, indent + 1);
    out.push(`${pad}</${name}>`);
  } else {
    out.push(`${pad}<${name}>${escapeXml(String(value))}</${name}>`);
  }
}

function jsonToXmlString(input: string): string {
  const parsed: unknown = JSON.parse(input);
  const out: string[] = [];
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed as Record<string, unknown>);
    if (keys.length === 1 && !keys[0].startsWith("@") && keys[0] !== "#text") {
      appendXml((parsed as Record<string, unknown>)[keys[0]], keys[0], out, 0);
      return out.join("\n");
    }
  }
  appendXml(parsed, "root", out, 0);
  return out.join("\n");
}

function nodeToJson(node: Element): unknown {
  const attrs = Object.fromEntries(Array.from(node.attributes).map((a) => [`@${a.name}`, a.value]));
  const childElements = Array.from(node.children);
  if (childElements.length === 0) {
    const text = node.textContent ?? "";
    if (text.trim() === "" && Object.keys(attrs).length === 0) return null;
    if (Object.keys(attrs).length === 0) return text;
    return Object.assign({ "#text": text }, attrs);
  }
  const obj: Record<string, unknown> = { ...attrs };
  const text = Array.from(node.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? "")
    .join("")
    .trim();
  if (text) obj["#text"] = text;
  for (const el of childElements) {
    const key = el.tagName;
    const val = nodeToJson(el);
    if (key in obj) {
      const cur = obj[key];
      if (Array.isArray(cur)) cur.push(val);
      else obj[key] = [cur, val];
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

function xmlToJsonString(input: string): string {
  const doc = new DOMParser().parseFromString(input, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Invalid XML.");
  return JSON.stringify(nodeToJson(doc.documentElement), null, 2);
}