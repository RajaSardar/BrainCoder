"use client";

import { useCallback, useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { Button, CopyButton, SliderField } from "@/components/ui";

const DEFAULT_COUNT = 5;
const MIN_COUNT = 1;
const MAX_COUNT = 100;

function randomV4(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "";
}

function generateUuid(count: number, uppercase: boolean, noDashes: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomV4();
    if (!raw) return [];
    let u = raw;
    if (noDashes) u = u.replace(/-/g, "");
    if (uppercase) u = u.toUpperCase();
    out.push(u);
  }
  return out;
}

export default function UuidGenerator() {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [uppercase, setUppercase] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);

  const cryptoAvailable =
    typeof globalThis.crypto?.getRandomValues === "function" ||
    typeof globalThis.crypto?.randomUUID === "function";

  const regenerate = useCallback(
    (nextCount: number, nextUppercase: boolean, nextNoDashes: boolean) => {
      setUuids(generateUuid(nextCount, nextUppercase, nextNoDashes));
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => regenerate(DEFAULT_COUNT, false, false), 0);
    return () => clearTimeout(t);
  }, [regenerate]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <SliderField
            label="Count"
            value={count}
            min={MIN_COUNT}
            max={MAX_COUNT}
            onChange={(v) => {
              setCount(v);
              regenerate(v, uppercase, noDashes);
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-11">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => {
              setUppercase(e.target.checked);
              regenerate(count, e.target.checked, noDashes);
            }}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Uppercase
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-11">
          <input
            type="checkbox"
            checked={noDashes}
            onChange={(e) => {
              setNoDashes(e.target.checked);
              regenerate(count, uppercase, e.target.checked);
            }}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          No hyphens
        </label>
        <Button
          type="button"
          onClick={() => regenerate(count, uppercase, noDashes)}
          disabled={!cryptoAvailable}
        >
          <Hash className="w-4 h-4 mr-1.5 inline" /> Generate
        </Button>
        <CopyButton
          text={uuids.join("\n")}
          label="Copy all"
          ariaLabel="Copy all UUIDs"
          disabled={uuids.length === 0}
        />
        <Button
          type="button"
          variant="danger"
          onClick={() => setUuids([])}
          disabled={uuids.length === 0}
        >
          Clear
        </Button>
      </div>

      <p role="status" aria-live="polite" className="text-xs sm:text-sm text-slate-600">
        {uuids.length > 0
          ? `${uuids.length} UUID${uuids.length === 1 ? "" : "s"} generated${
              noDashes ? " (no hyphens)" : ""
            }${uppercase ? " (uppercase)" : ""}`
          : cryptoAvailable
            ? "No UUIDs yet — press Generate."
            : "Cryptographic UUID generation is unavailable in this browser."}
      </p>

      {!cryptoAvailable && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          This tool needs the browser’s Web Crypto random source (crypto.getRandomValues or crypto.randomUUID),
          which isn’t available here. Try a modern browser over HTTPS or localhost.
        </p>
      )}

      {uuids.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {uuids.map((u, i) => (
            <div
              key={u}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <code className="font-mono text-sm text-blue-700 break-all">{u}</code>
              <CopyButton
                text={u}
                label=""
                ariaLabel={`Copy UUID ${i + 1}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}