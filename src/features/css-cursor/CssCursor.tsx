"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointerClick, Image as ImageIcon, X } from "lucide-react";
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

const CUSTOM_KEY = "__custom__";
const FALLBACK = "pointer";

export default function CssCursor() {
  const [selected, setSelected] = useState("pointer");
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [hint, setHint] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef("");

  const isCustom = selected === CUSTOM_KEY;
  const cursorValue = isCustom && customUrl ? `url("${customUrl}") 2 2, ${FALLBACK}` : selected;
  const snippet = `cursor: ${cursorValue};`;
  const previewLabel = isCustom ? `custom cursor (${customName})` : selected;

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const onSelect = (c: string) => {
    setSelected(c);
    setHint("");
  };

  const onCustomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isCursorImage = file.type.startsWith("image/") && /\.(png|cur)$/i.test(file.name);
    if (!isCursorImage) {
      setHint("Choose a PNG or CUR cursor image from your device.");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setCustomUrl(url);
    setCustomName(file.name);
    setSelected(CUSTOM_KEY);
    setHint("");
  };

  const clearCustom = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
    }
    setCustomUrl("");
    setCustomName("");
    setSelected(FALLBACK);
  };

  return (
    <div className="space-y-5 w-full" aria-live="polite">
      <section
        aria-label="Interactive cursor preview"
        className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-56 select-none transition active:scale-[0.995] active:bg-slate-100"
        style={{ cursor: cursorValue }}
      >
        <div className="text-center pointer-events-none px-4">
          <MousePointerClick className="w-8 h-8 mx-auto text-slate-400 mb-2" aria-hidden="true" />
          <p className="text-sm text-slate-500">Hover and press to feel the cursor</p>
          <p className="font-mono text-xs text-slate-600 mt-2 break-all">{snippet}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-slate-700">
          Previewing: <span className="font-mono">{previewLabel}</span>
        </p>
        <CopyButton text={snippet} ariaLabel="Copy cursor declaration" />
      </div>

      {hint && (
        <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          {hint}
        </div>
      )}

      <div
        className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4"
        role="group"
        aria-label="Custom cursor image"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-pressed={isCustom}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <ImageIcon className="w-5 h-5 text-slate-500" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-slate-700">
                {isCustom ? `Custom image cursor (${customName})` : "Custom image cursor…"}
              </span>
              <span className="block text-xs text-slate-500">
                {isCustom ? "Click to replace" : "Load a PNG or CUR file from your device"}
              </span>
            </span>
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={clearCustom}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" /> Clear custom
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Browsers only allow same-origin or data URLs for cursor images, so the file is read locally and never uploaded.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".png,.cur,image/png,image/x-icon"
          className="hidden"
          onChange={onCustomFile}
        />
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        role="group"
        aria-label="CSS cursor keywords"
      >
        {CURSORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            aria-pressed={selected === c}
            aria-label={`Preview ${c} cursor`}
            className={`rounded-xl border p-4 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
              selected === c
                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                : "border-slate-200 bg-white hover:shadow-md"
            }`}
            style={{ cursor: c }}
          >
            <span className="font-mono text-sm text-gray-700 block">{c}</span>
          </button>
        ))}
      </div>
    </div>
  );
}