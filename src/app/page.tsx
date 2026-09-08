"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Lock, Shield, Zap, MousePointerClick } from "lucide-react";
import { CATEGORIES, getToolsByCategory, type ToolConfig } from "@/lib/tools";

function ToolCard({ tool }: { tool: ToolConfig }) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 transition flex flex-col gap-3"
    >
      <div
        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-md shrink-0`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition">
          {tool.name}
        </h3>
        <p className="text-sm text-slate-500 mt-1">{tool.tagline}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return CATEGORIES.flatMap(getToolsByCategory).filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-5 pt-16 pb-10 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 mb-6">
          <Lock className="w-3.5 h-3.5" /> 100% private — files never leave your device
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          A free toolkit for
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {" "}developers
          </span>
        </h1>
        <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
          Compress, encode, convert, format and generate — all in your browser. No sign-up, no
          uploads, no limits. Free forever.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-8 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" /> Instant results
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-green-500" /> No uploads
          </span>
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="w-4 h-4 text-purple-500" /> Works with any file type
          </span>
        </div>
      </section>

      {/* Search */}
      <section id="tools" className="max-w-6xl mx-auto px-5 pb-6 w-full">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools… (e.g. pdf, base64, hash)"
            className="w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 py-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>
      </section>

      {/* Tools grid */}
      <section className="max-w-6xl mx-auto px-5 pb-20 w-full">
        {filtered ? (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              {filtered.length} result{filtered.length === 1 ? "" : "s"} for{" "}
              <span className="font-medium text-slate-700">&quot;{query}&quot;</span>
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <ToolCard key={t.slug} tool={t} />
              ))}
            </div>
          </div>
        ) : (
          CATEGORIES.map((category) => {
            const tools = getToolsByCategory(category);
            if (tools.length === 0) return null;
            return (
              <div key={category} className="mb-12">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600" />
                  {category}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tools.map((t) => (
                    <ToolCard key={t.slug} tool={t} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}