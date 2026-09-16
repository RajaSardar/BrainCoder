"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

export default function ToolFaq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();

  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            aria-expanded={open === i}
            aria-controls={`${id}-answer-${i}`}
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition"
          >
            <span className="text-sm font-semibold text-slate-800">
              {item.question}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                open === i ? "rotate-180" : ""
              }`}
            />
          </button>
          <div id={`${id}-answer-${i}`} hidden={open !== i} className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">
            {item.answer}
          </div>
        </div>
      ))}
    </div>
  );
}
