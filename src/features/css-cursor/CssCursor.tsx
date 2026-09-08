"use client";

import { MousePointerClick } from "lucide-react";
import { CopyButton } from "@/components/ui";

const CURSORS = [
  "auto",
  "default",
  "none",
  "pointer",
  "context-menu",
  "help",
  "progress",
  "wait",
  "cell",
  "crosshair",
  "text",
  "vertical-text",
  "alias",
  "copy",
  "move",
  "no-drop",
  "not-allowed",
  "grab",
  "grabbing",
  "all-scroll",
  "col-resize",
  "row-resize",
  "n-resize",
  "e-resize",
  "s-resize",
  "w-resize",
  "ne-resize",
  "nw-resize",
  "se-resize",
  "sw-resize",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "zoom-in",
  "zoom-out",
];

export default function CssCursor() {
  return (
    <div className="space-y-5 w-full">
      <div
        className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-56"
        style={{ cursor: "pointer" }}
      >
        <div className="text-center">
          <MousePointerClick className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-500">Hover any cursor sample below</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CURSORS.map((c) => (
          <div
            key={c}
            className="rounded-xl border border-slate-200 bg-white p-4 text-center hover:shadow-md transition"
            style={{ cursor: c }}
          >
            <p className="font-mono text-sm text-gray-700 mb-2">{c}</p>
            <CopyButton text={`cursor: ${c};`} label="Copy" />
          </div>
        ))}
      </div>
    </div>
  );
}