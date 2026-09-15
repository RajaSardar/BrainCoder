import { ChevronDown } from "lucide-react";
import { HOME_FAQ } from "@/lib/seo";

export function HomeFaq() {
  return (
    <section id="faq" className="max-w-6xl mx-auto px-5 pb-16 w-full">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8">
        Frequently asked questions
      </h2>
      <div className="max-w-3xl mx-auto space-y-3">
        {HOME_FAQ.map((item) => (
          <details
            key={item.question}
            className="group bg-white rounded-2xl border border-slate-200 open:shadow-md transition"
          >
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 font-semibold text-slate-900 select-none">
              {item.question}
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}