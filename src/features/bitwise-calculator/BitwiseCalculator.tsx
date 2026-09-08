"use client";

import { useState } from "react";
import { CircuitBoard } from "lucide-react";
import { CopyButton } from "@/components/ui";

type Op = "AND" | "OR" | "XOR" | "NAND" | "NOR";

function apply(op: Op, a: number, b: number): number {
  switch (op) {
    case "AND":
      return a & b;
    case "OR":
      return a | b;
    case "XOR":
      return a ^ b;
    case "NAND":
      return ~(a & b);
    case "NOR":
      return ~(a | b);
  }
}

function fmt(value: number, op: Op): string {
  const v = op === "NAND" || op === "NOR" ? value >>> 0 : value;
  return `${v.toString(10)} · 0x${v.toString(16)} · ${v.toString(2)}`;
}

const BITS = 32;

export default function BitwiseCalculator() {
  const [a, setA] = useState(0b1100);
  const [b, setB] = useState(0b1010);
  const [op, setOp] = useState<Op>("AND");

  const bitsA = (a >>> 0).toString(2).padStart(BITS, "0").slice(-16);
  const bitsB = (b >>> 0).toString(2).padStart(BITS, "0").slice(-16);
  const result = apply(op, a, b);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <CircuitBoard className="w-4 h-4 text-lime-600" />
        <h2 className="text-sm font-semibold text-slate-700">Bitwise Calculator</h2>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Operand A</label>
            <input
              type="number"
              value={a}
              onChange={(e) => setA(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
            <p className="mt-1.5 font-mono text-xs text-slate-400">{bitsA}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Operand B</label>
            <input
              type="number"
              value={b}
              onChange={(e) => setB(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
            <p className="mt-1.5 font-mono text-xs text-slate-400">{bitsB}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["AND", "OR", "XOR", "NAND", "NOR"] as Op[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOp(o)}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-medium transition ${op === o ? "bg-lime-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-lime-50"}`}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-mono">result → {op}</span>
            <CopyButton text={`${a} ${op.toLowerCase()} ${b} = ${result}`} label="Copy equation" />
          </div>
          <p className="text-lg font-mono text-lime-300 break-all">{fmt(result, op)}</p>
          <p className="mt-2 font-mono text-xs text-slate-500 break-all">{(result >>> 0).toString(2).padStart(BITS, "0").slice(-16)}</p>
        </div>

        <div className="grid grid-cols-4 gap-3 text-center text-xs text-slate-500">
          <div className="rounded-lg bg-slate-50 py-2">{((a >>> 0).toString(2).match(/1/g) ?? []).length} bits set (A)</div>
          <div className="rounded-lg bg-slate-50 py-2">{((b >>> 0).toString(2).match(/1/g) ?? []).length} bits set (B)</div>
          <div className="rounded-lg bg-slate-50 py-2">{((result >>> 0).toString(2).match(/1/g) ?? []).length} bits set (result)</div>
          <div className="rounded-lg bg-slate-50 py-2">{BITS}-bit values</div>
        </div>
      </div>
    </div>
  );
}