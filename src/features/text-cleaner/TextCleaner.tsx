"use client";

import { useState } from "react";
import { Eraser } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

interface Options {
  stripHtml: boolean;
  collapse: boolean;
  singleLine: boolean;
  removeEmpty: boolean;
  trimLines: boolean;
}

const opts: (keyof Options)[] = ["stripHtml", "collapse", "singleLine", "removeEmpty", "trimLines"];

const OPTION_LABELS: Record<keyof Options, { label: string; hint: string }> = {
  stripHtml: { label: "Strip HTML tags", hint: "Removes <tag…> markup and decodes HTML entities." },
  collapse: { label: "Collapse spaces & tabs", hint: "Converts runs of spaces/tabs to a single space." },
  singleLine: { label: "Join onto one line", hint: "Replaces all line breaks and leading/trailing space with single spaces." },
  removeEmpty: { label: "Remove empty lines", hint: "Drops blank lines from the result." },
  trimLines: { label: "Trim each line", hint: "Strips surrounding whitespace from every line." },
};

const SAMPLE = `<div>  This   is   <b>messy</b>   text.

   It has   strange   spacing   and   <span>tags</span>.  </div>

    Also,   some   empty   lines   above.`;

export default function TextCleaner() {
  const [input, setInput] = useState(SAMPLE);
  const [options, setOptions] = useState<Options>({ stripHtml: true, collapse: true, singleLine: false, removeEmpty: true, trimLines: true });
  const [output, setOutput] = useState("");

  const clean = () => {
    let text = input;
    if (options.stripHtml) {
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    if (options.singleLine) {
      text = text.replace(/\s+/g, " ").trim();
    } else {
      let lines = text.split(/\r?\n/);
      if (options.trimLines) lines = lines.map((l) => l.trim());
      if (options.collapse) lines = lines.map((l) => l.replace(/[ \t]+/g, " "));
      if (options.removeEmpty) lines = lines.filter((l) => l.length > 0);
      text = lines.join("\n");
      if (options.collapse && !options.trimLines) text = text.trim();
    }
    setOutput(text);
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Eraser className="w-4 h-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-700">Text Cleaner</h2>
      </div>

      <StyledTextarea value={input} onChange={(e) => setInput(e.target.value)} rows={8} placeholder="Paste messy text…" />

      <div className="rounded-xl border border-slate-200 bg-white p-4 grid sm:grid-cols-2 gap-3">
        {opts.map((o) => (
          <label key={o} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={options[o]}
              onChange={(e) => setOptions((prev) => ({ ...prev, [o]: e.target.checked }))}
              className="accent-emerald-600 w-4 h-4 mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">{OPTION_LABELS[o].label}</span>
              <span className="block text-xs text-slate-400">{OPTION_LABELS[o].hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={clean}>Clean text</Button>
        <CopyButton text={output} />
      </div>

      <StyledTextarea readOnly value={output} rows={8} placeholder="Cleaned text appears here…" />
      {output && output !== input && (
        <p className="text-xs text-slate-400">
          {input.length.toLocaleString()} → {output.length.toLocaleString()} characters ({Math.round(((input.length - output.length) / Math.max(input.length, 1)) * 100)}% reduction).
        </p>
      )}
    </div>
  );
}