import { FileText } from "lucide-react";
import { TOOLS } from "@/lib/tools";
import { ToolCard } from "@/components/ToolCard";

const PDF_TOOLS = TOOLS.filter(
  (t) =>
    t.slug === "html-to-pdf" ||
    t.slug.endsWith("-to-pdf") ||
    t.slug.startsWith("pdf-") ||
    t.slug === "word-to-pdf"
);

export function HomeFeatured() {
  return (
    <section className="max-w-6xl mx-auto px-5 pt-2 pb-10 w-full">
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              PDF tools — free &amp; private
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Create, edit, annotate, compress, merge, split and convert PDFs. Nothing leaves your
              device.
            </p>
          </div>
          <FileText className="w-8 h-8 text-indigo-500 shrink-0" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PDF_TOOLS.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </div>
    </section>
  );
}