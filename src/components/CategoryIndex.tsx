import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  CATEGORIES,
  getCategorySlug,
  getToolsByCategory,
  type Category,
} from "@/lib/tools";

const CATEGORY_COPY: Record<Category, string> = {
  Compress:
    "Compress PDFs, images and text in your browser. Size savings and quality trade-offs depend on the tool, settings and source file.",
  Convert:
    "Turn formats instantly: image to PDF, HTML to PDF, JSON to CSV, markdown to HTML and more.",
  "Encode & Decode":
    "Base64, URL, JWT, hashes and encryption — encode and decode without uploading a single byte.",
  Developer:
    "Format JSON and SQL, test regex, diff code, check HTTP statuses and calculate checksums.",
  "Media & Design":
    "Edit images, generate QR codes, gradients and box shadows right in your browser.",
  Generate:
    "UUIDs, passwords, random numbers, lorem ipsum and more, generated locally in a click.",
  "Text Tools":
    "Count words, convert case, clean and sort lines, preview markdown — all without uploads.",
  Office:
    "Work with CSV, SQLite, Word, Excel and PowerPoint files without ever sending them to a server.",
};

export function CategoryIndex() {
  return (
    <section className="max-w-6xl mx-auto px-5 pb-12 w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Browse all tools by category
        </h2>
        <p className="mt-2 text-slate-600 max-w-2xl mx-auto text-sm sm:text-base">
          Every utility in each category is free, runs in your browser, and never uploads your
          files — you can start using any of these without an account.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {CATEGORIES.map((c) => {
          const tools = getToolsByCategory(c);
          return (
            <div
              key={c}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-slate-900">{c}</h3>
                <span className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 shrink-0">
                  {tools.length} tools
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{CATEGORY_COPY[c]}</p>
              <div className="flex flex-wrap gap-1.5 mt-4 flex-1 content-start">
                {tools.slice(0, 6).map((t) => (
                  <a
                    key={t.slug}
                    href={`/tools/${t.slug}`}
                    className="text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-full px-2.5 py-1 transition"
                  >
                    {t.name}
                  </a>
                ))}
              </div>
              <Link
                href={`/categories/${getCategorySlug(c)}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all {c} tools
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
