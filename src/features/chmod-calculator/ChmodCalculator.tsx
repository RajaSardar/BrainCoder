"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";
import {
  GROUPS,
  PERMS,
  PRESETS,
  classifyOctalDraft,
  toChmodStyle,
  toOctal,
  toSymbolic,
  type Perm,
  type Trio,
} from "./permissions";

export default function ChmodCalculator() {
  const [trio, setTrio] = useState<Trio>({
    user: ["read", "write", "execute"],
    group: ["read", "execute"],
    other: ["read", "execute"],
  });
  const [draft, setDraft] = useState("755");
  const [error, setError] = useState("");

  const toggle = (g: keyof Trio, p: Perm) => {
    const current = trio[g];
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    const updated = { ...trio, [g]: next };
    setTrio(updated);
    setDraft(toOctal(updated));
    setError("");
  };

  const onOctalInput = (value: string) => {
    setDraft(value);
    const verdict = classifyOctalDraft(value);
    if (verdict.state === "ok") {
      setTrio(verdict.trio);
      setError("");
    } else if (verdict.state === "invalid") {
      setError(verdict.message);
    } else {
      setError("");
    }
  };

  const applyPreset = (value: string) => {
    const verdict = classifyOctalDraft(value);
    if (verdict.state === "ok") setTrio(verdict.trio);
    setDraft(value);
    setError("");
  };

  const octal = toOctal(trio);
  const symbolic = toSymbolic(trio);
  const chmodStyle = toChmodStyle(trio);
  const typing = classifyOctalDraft(draft).state === "incomplete";

  return (
    <div className="space-y-5 w-full">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid sm:grid-cols-3 gap-6">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <p className="text-sm font-semibold text-slate-700 mb-2">{g.label}</p>
              <div className="space-y-2">
                {PERMS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition ${
                      trio[g.id].includes(p.id)
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span className="font-mono">{p.label}</span>
                    <input
                      type="checkbox"
                      checked={trio[g.id].includes(p.id)}
                      onChange={() => toggle(g.id, p.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-mono text-slate-600 hover:bg-slate-50 transition"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => onOctalInput(e.target.value)}
            spellCheck={false}
            inputMode="numeric"
            aria-label="Octal mode, three digits such as 644"
            aria-invalid={error ? true : undefined}
            placeholder="644"
            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-slate-400">type octal to set</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {!error && typing && (
        <p className="text-xs text-slate-400">
          {draft.length} of 3 digits — the octal value applies once all three are typed.
        </p>
      )}

      <p role="status" className="sr-only">
        {`Octal ${octal}, symbolic ${symbolic}, ${chmodStyle}`}
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Numeric / stat mode
            </p>
            <CopyButton text={octal} ariaLabel={`Copy octal ${octal}`} />
          </div>
          <p className="font-mono text-2xl font-bold text-indigo-600">{octal}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">Symbolic (rwxr-xr-x)</p>
            <CopyButton text={symbolic} ariaLabel={`Copy symbolic ${symbolic}`} />
          </div>
          <p className="font-mono text-xl font-semibold text-slate-800">{symbolic}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">chmod style</p>
            <CopyButton text={chmodStyle} ariaLabel={`Copy chmod style ${chmodStyle}`} />
          </div>
          <p className="font-mono text-sm text-slate-700 break-all">{chmodStyle}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => applyPreset("755")}
      >
        Reset
      </Button>
    </div>
  );
}
