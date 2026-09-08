"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Lock,
  Shield,
  Zap,
  MousePointerClick,
  ChevronsLeft,
  ChevronsRight,
  ListFilter,
  LayoutGrid,
} from "lucide-react";
import { CATEGORIES, getToolsByCategory, TOOLS, type ToolConfig } from "@/lib/tools";

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

export default function HomeContent() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of TOOLS) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return map;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.flatMap((c) => getToolsByCategory(c)).filter((t) => {
      const matchQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      const matchC = !category || t.category === category;
      return matchQ && matchC;
    });
  }, [query, category]);

  const categoriesToShow = useMemo(
    () => CATEGORIES.filter((c) => getToolsByCategory(c).length > 0),
    []
  );

  const sidebar = (
    <nav className="space-y-1">
      <button
        type="button"
        onClick={() => setCategory(null)}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
          category === null
            ? "bg-indigo-50 text-indigo-700 font-medium"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <LayoutGrid className="w-4 h-4 shrink-0" />
        <span className="flex-1">All tools</span>
        <span className="text-xs text-slate-400">{TOOLS.length}</span>
      </button>
      {categoriesToShow.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCategory(category === c ? null : c)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
            category === c
              ? "bg-indigo-50 text-indigo-700 font-medium"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span className="flex-1 truncate">{c}</span>
          <span className="text-xs text-slate-400">{counts.get(c) ?? 0}</span>
        </button>
      ))}
    </nav>
  );

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

      {/* Tools */}
      <section className="max-w-6xl mx-auto px-5 pb-20 w-full">
{/* Mobile filter toggle */}
      <div className="lg:hidden mb-4 relative">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm hover:border-slate-300 transition w-full"
        >
          <ListFilter className="w-4 h-4" />
          Filter by category
          <span className="text-xs text-slate-400 ml-auto">
            {category ?? "All"} · {TOOLS.length} tools
          </span>
        </button>
        {filtersOpen && (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-md">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="Search categories…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="max-h-56 overflow-auto space-y-1">
              {categoriesToShow
                .filter((c) => c.toLowerCase().includes(categoryQuery.trim().toLowerCase()))
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategory(category === c ? null : c);
                      setFiltersOpen(false);
                      setCategoryQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
                      category === c ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex-1 truncate">{c}</span>
                    <span className="text-xs text-slate-400">{counts.get(c) ?? 0}</span>
                  </button>
                ))}
              {categoriesToShow.every((c) => !c.toLowerCase().includes(categoryQuery.trim().toLowerCase())) && (
                <p className="text-xs text-slate-400 px-3 py-2">No categories match.</p>
              )}
            </div>
          </div>
        )}
      </div>

        <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col gap-2 self-start sticky top-6">
            {collapsed ? (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition"
                aria-label="Show filters"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Categories
                  </span>
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    aria-label="Collapse filters"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                </div>
                {sidebar}
              </div>
            )}
          </aside>

          <div>
            {query.trim() !== "" && (
              <p className="text-sm text-slate-500 mb-4">
                {filtered.length} result{filtered.length === 1 ? "" : "s"} for{" "}
                <span className="font-medium text-slate-700">&quot;{query.trim()}&quot;</span>
                {category && (
                  <>
                    {" "}in{" "}
                    <span className="font-medium text-slate-700">{category}</span>
                  </>
                )}
              </p>
            )}
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                No tools match your filter. Try a different search or clear the category.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}