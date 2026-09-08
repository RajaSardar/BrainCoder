"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Field, StyledTextarea, CopyButton } from "@/components/ui";

type TsValue =
  | { kind: "primitive"; type: string }
  | { kind: "object"; fields: [string, TsValue][] }
  | { kind: "array"; of: TsValue };

function infer(value: unknown): TsValue {
  if (value === null || value === undefined) return { kind: "primitive", type: "any" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "array", of: { kind: "primitive", type: "any" } };
    const itemTypes = new Set(value.map((v) => JSON.stringify(infer(v))));
    const items = value.map(infer);
    if (itemTypes.size === 1) return { kind: "array", of: items[0] };
    const primitives: TsValue[] = [];
    const objects: TsValue[] = [];
    for (const it of items) {
      if (it.kind === "object") objects.push(it);
      else primitives.push(it);
    }
    if (objects.length > 0 && primitives.length === 0) {
      const merged = mergeObjects(objects);
      return { kind: "array", of: merged };
    }
    return { kind: "array", of: { kind: "primitive", type: "any" } };
  }
  switch (typeof value) {
    case "string":
      return { kind: "primitive", type: "string" };
    case "number":
      return { kind: "primitive", type: Number.isInteger(value) ? "number" : "number" };
    case "boolean":
      return { kind: "primitive", type: "boolean" };
    default:
      if (typeof value === "object") {
        const fields: [string, TsValue][] = Object.entries(value as Record<string, unknown>).map(
          ([k, v]) => [k, infer(v)]
        );
        return { kind: "object", fields };
      }
      return { kind: "primitive", type: "any" };
  }
}

function mergeObjects(objects: TsValue[]): TsValue {
  if (objects.length === 0 || !("fields" in objects[0])) {
    return { kind: "primitive", type: "any" };
  }
  const map = new Map<string, TsValue[]>();
  for (const o of objects) {
    if (o.kind === "object") {
      for (const [k, v] of o.fields) {
        const arr = map.get(k) ?? [];
        arr.push(v);
        map.set(k, arr);
      }
    }
  }
  const fields: [string, TsValue][] = Array.from(map.entries()).map(([k, vs]) => {
    if (vs.every((v) => JSON.stringify(v) === JSON.stringify(vs[0]))) return [k, vs[0]];
    const uniq = new Set(vs.map((v) => JSON.stringify(v)));
    if (uniq.size === 1) return [k, vs[0]];
    const types = new Set(vs.map((v) => (v.kind === "object" ? "object" : v.kind === "array" ? "array" : (v as { type: string }).type)));
    if (types.size === 1) {
      const first = vs[0];
      if (first.kind === "object") return [k, mergeObjects(vs.filter((v) => v.kind === "object"))];
      return [k, first];
    }
    return [k, { kind: "primitive", type: Array.from(types).join(" | ") }];
  });
  return { kind: "object", fields };
}

function sanitizeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_$]+/g, "_").replace(/^([0-9])/, "_$1") || "Field";
}

function render(root: TsValue, rootName: string): string {
  const interfaces: string[] = [];
  const used = new Set<string>();

  const unique = (base: string): string => {
    let name = base;
    let i = 1;
    while (used.has(name)) name = `${base}_${i++}`;
    used.add(name);
    return name;
  };

  const typeOf = (value: TsValue, base: string): string => {
    if (value.kind === "primitive") return value.type;
    if (value.kind === "array") return `${typeOf(value.of, base)}[]`;
    const name = unique(sanitizeName(base) || "Type");
    const fields = (value.fields ?? [])
      .map(([key, v]) => {
        const type = typeOf(v, sanitizeName(key) || "Field");
        const nullable = v.kind === "primitive" && v.type === "any";
        return `  ${sanitizeName(key)}${nullable ? "?" : ""}: ${type};`;
      })
      .join("\n");
    interfaces.push(`export interface ${name} {\n${fields}\n}`);
    return name;
  };

  const rootType = typeOf(root, rootName);
  return [...interfaces, `export type ${sanitizeName(rootName) || "Root"} = ${rootType};`].join(
    "\n\n"
  );
}

const SAMPLE = `{
  "id": 1,
  "name": "Alex",
  "isAdmin": true,
  "email": "alex@example.com",
  "roles": ["admin", "user"],
  "profile": {
    "age": 29,
    "address": {
      "city": "Mumbai",
      "zip": "400001"
    }
  },
  "lastLogin": null
}`;

export default function JsonToTypeScript() {
  const [input, setInput] = useState(SAMPLE);
  const [rootName, setRootName] = useState("User");

  const result = useMemo(() => {
    try {
      const parsed = JSON.parse(input);
      const root = infer(parsed);
      return { ok: true, value: render(root, rootName) };
    } catch (err) {
      return { ok: false, value: err instanceof Error ? err.message : "Invalid JSON" };
    }
  }, [input, rootName]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Root type name">
          <input
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            className="w-48 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
        <CopyButton text={result.value} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">JSON</p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">TypeScript</p>
            {!result.ok && (
              <span className="flex items-center gap-1.5 text-xs text-red-600">
                <XCircle className="w-3.5 h-3.5" /> {result.value}
              </span>
            )}
            {result.ok && (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Generated
              </span>
            )}
          </div>
          <StyledTextarea rows={16} value={result.value} readOnly className="bg-slate-100 font-mono text-xs" />
        </div>
      </div>
    </div>
  );
}