"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

type Group = "user" | "group" | "other";
type Perm = "read" | "write" | "execute";

const PERMS: { id: Perm; label: string; value: number }[] = [
  { id: "read", label: "r (4)", value: 4 },
  { id: "write", label: "w (2)", value: 2 },
  { id: "execute", label: "x (1)", value: 1 },
];

const GROUPS: { id: Group; label: string }[] = [
  { id: "user", label: "User (owner)" },
  { id: "group", label: "Group" },
  { id: "other", label: "Other" },
];

const PRESETS = [
  { label: "400", value: "400" },
  { label: "600", value: "600" },
  { label: "644", value: "644" },
  { label: "664", value: "664" },
  { label: "700", value: "700" },
  { label: "755", value: "755" },
  { label: "777", value: "777" },
];

export default function ChmodCalculator() {
  const [user, setUser] = useState<string[]>(["read", "write", "execute"]);
  const [group, setGroup] = useState<string[]>(["read", "execute"]);
  const [other, setOther] = useState<string[]>(["read", "execute"]);
  const [error, setError] = useState("");

  const sets = { user, group, other } as Record<Group, string[]>;

  const toggle = (g: Group, p: Perm) => {
    const setter = g === "user" ? setUser : g === "group" ? setGroup : setOther;
    const current = sets[g];
    setter(current.includes(p) ? current.filter((x) => x !== p) : [...current, p]);
  };

  const numberInput = (value: string) => {
    const digits = value.trim().match(/^([0-7]{3})$/);
    if (!digits) {
      setError("Enter a 3-digit octal value like 644.");
      return;
    }
    const m = digits[1];
    const sumOf = (digit: string) => {
      const n = Number(digit);
      const bits: string[] = [];
      if (n >= 4) {
        bits.push("read");
      }
      if (n % 4 >= 2) {
        bits.push("write");
      }
      if (n % 2 === 1) {
        bits.push("execute");
      }
      return bits;
    };
    setUser(sumOf(m[0]));
    setGroup(sumOf(m[1]));
    setOther(sumOf(m[2]));
    setError("");
  };

  const sum = (g: Group) => {
      let n = 0;
      for (const p of PERMS) if (sets[g].includes(p.id)) n += p.value;
      return n;
    };
    const u = sum("user");
    const gr = sum("group");
    const o = sum("other");
    const octal = `${u}${gr}${o}`;
    const sym = (g: Group) =>
      PERMS.map((p) => (sets[g].includes(p.id) ? p.id[0] : "-")).join("");
    const symbolic = `${sym("user")}${sym("group")}${sym("other")}`;
    const chmodStyle = `u=${sets.user.join("") || "-"},g=${sets.group.join("") || "-"},o=${sets.other.join("") || "-"}`;

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
                      sets[g.id].includes(p.id)
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span className="font-mono">{p.label}</span>
                    <input
                      type="checkbox"
                      checked={sets[g.id].includes(p.id)}
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
              key={p.value}
              type="button"
              onClick={() => numberInput(p.value)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-mono text-slate-600 hover:bg-slate-50 transition"
            >
              {p.value}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={octal}
            onChange={(e) => numberInput(e.target.value)}
            spellCheck={false}
            placeholder="644"
            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-slate-400">type octal to set</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Numeric / stat mode
            </p>
            <CopyButton text={octal} />
          </div>
          <p className="font-mono text-2xl font-bold text-indigo-600">{octal}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">Symbolic</p>
            <CopyButton text={symbolic} />
          </div>
          <p className="font-mono text-xl font-semibold text-slate-800">{symbolic}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">chmod style</p>
            <CopyButton text={chmodStyle} />
          </div>
          <p className="font-mono text-sm text-slate-700 break-all">{chmodStyle}</p>
        </div>
      </div>

      <Button type="button" variant="secondary" onClick={() => numberInput("644")}>
        Reset
      </Button>
    </div>
  );
}