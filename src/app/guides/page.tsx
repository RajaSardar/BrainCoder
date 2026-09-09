import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { GUIDES } from "@/lib/guides";
import { getTool } from "@/lib/tools";
import { guidesIndexJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Guides — how-to articles for free online tools",
  description:
    "Step-by-step guides for everyday tasks: how to compress, merge and split PDFs online for free, privately, in your browser.",
  keywords: [
    "how to compress pdf online",
    "how to merge pdf online",
    "how to split pdf online",
    "pdf tutorials",
    "online tool guides",
  ],
  alternates: {
    canonical: "/guides",
  },
};

export default function GuidesPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-8 w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(guidesIndexJsonLd()) }}
      />
      <header className="mb-8">
        <div className="flex items-center gap-2 text-indigo-600 mb-2">
          <BookOpen className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Guides</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          How-to guides for free online tools
        </h1>
        <p className="mt-2 text-slate-600">
          Short, practical walkthroughs for the tasks people search for most. Every guide links
          straight to a free tool that runs in your browser.
        </p>
      </header>

      <ul className="space-y-4">
        {GUIDES.map((guide) => {
          const tool = getTool(guide.toolSlug);
          return (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-md transition"
              >
                <div>
                  <h2 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition">
                    {guide.title}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">{guide.description}</p>
                  {tool && (
                    <p className="text-xs text-slate-400 mt-2">
                      Uses: <span className="text-indigo-600 font-medium">{tool.name}</span>
                    </p>
                  )}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}