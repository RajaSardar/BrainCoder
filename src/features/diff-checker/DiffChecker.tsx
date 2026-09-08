"use client";

import { useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { Button, StyledTextarea } from "@/components/ui";

type LineStatus = "same" | "added" | "removed";

export default function DiffChecker() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [compared, setCompared] = useState(false);

  const result = useMemo(() => {
    const a = left.split("\n");
    const b = right.split("\n");
    const max = Math.max(a.length, b.length);
    const rows: { left?: string; right?: string; status: LineStatus }[] = [];
    for (let i = 0; i < max; i++) {
      const la = a[i] ?? "";
      const lb = b[i] ?? "";
      if (la === lb) {
        rows.push({ left: la, right: lb, status: "same" });
      } else {
        if (la !== "") rows.push({ left: la, status: "removed" });
        if (lb !== "") rows.push({ right: lb, status: "added" });
      }
    }
    return rows;
  }, [left, right]);

  const added = result.filter((r) => r.status === "added").length;
  const removed = result.filter((r) => r.status === "removed").length;

  return (
    <div className="space-y-5 w-full">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Original</p>
          <StyledTextarea rows={10} value={left} onChange={(e) => setLeft(e.target.value)} placeholder="Paste the original text…" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Changed</p>
          <StyledTextarea rows={10} value={right} onChange={(e) => setRight(e.target.value)} placeholder="Paste the changed text…" />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" onClick={() => setCompared(true)}>
          <GitCompareArrows className="w-4 h-4 mr-1.5 inline" /> Compare
        </Button>
        {compared && (result.length === 0 || (added === 0 && removed === 0)) && (
          <span className="text-sm text-green-600 font-medium">No differences found ✓</span>
        )}
        {compared && (added > 0 || removed > 0) && (
          <span className="text-sm text-slate-500">
            <span className="text-green-600 font-medium">+{added}</span> added ·{" "}
            <span className="text-red-600 font-medium">−{removed}</span> removed
          </span>
        )}
      </div>

      {compared && result.length > 0 && (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm font-mono">
            <tbody>
              {result.map((row, i) => {
                const bg =
                  row.status === "added"
                    ? "bg-green-50"
                    : row.status === "removed"
                      ? "bg-red-50"
                      : "bg-white";
                const textColor =
                  row.status === "added"
                    ? "text-green-800"
                    : row.status === "removed"
                      ? "text-red-800 line-through"
                      : "text-slate-700";
                return (
                  <tr key={i} className={bg + " border-b border-slate-100"}>
                    <td className="w-10 px-2 py-1 text-right text-xs text-slate-400 select-none align-top">
                      {row.status === "same" ? i + 1 : row.status === "added" ? "+" : "−"}
                    </td>
                    <td className={`px-3 py-1 whitespace-pre-wrap break-all align-top ${textColor}`}>
                      {row.left ?? ""}
                    </td>
                    <td className="w-10 px-2 py-1 text-right text-xs text-slate-400 select-none align-top">
                      {row.status === "same" ? i + 1 : row.status === "removed" ? "−" : "+"}
                    </td>
                    <td className={`px-3 py-1 whitespace-pre-wrap break-all align-top ${textColor}`}>
                      {row.right ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}