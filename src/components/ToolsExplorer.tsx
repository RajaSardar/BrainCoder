"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ListFilter, ChevronsLeft, ChevronsRight, LayoutGrid, X } from "lucide-react";
import { CATEGORIES, getToolsByCategory, TOOLS } from "@/lib/tools";
import { ToolCard } from "@/components/ToolCard";

function readHashCategory(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#cat=(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function ToolsExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const syncCategory = () => {
      const c = readHashCategory();
      setCategory(c && categoriesToShow.includes(c as (typeof categoriesToShow)[number]) ? c : null);
    };
    syncCategory();
    window.addEventListener("hashchange", syncCategory);
    return () => window.removeEventListener("hashchange", syncCategory);
  }, [categoriesToShow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const clearAll = () => {
    setQuery("");
    setCategory(null);
  };

  return (
    <section id="tools" className="max-w-6xl mx-auto px-5 pb-16 w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Browse all free tools
        </h2>
        <span className="hidden sm:block text-xs text-slate-400">
          Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono">/</kbd> to search
        </span>
      </div>

      <div className="relative max-w-2xl mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          aria-label="Search tools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools… (e.g. pdf, base64, hash)"
          className="w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 py-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        />
      </div>

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
                role="searchbox"
                aria-label="Search categories"
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
              <nav className="space-y-1" aria-label="Filter tools by category">
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
            </div>
          )}
        </aside>

        <div>
          {query.trim() !== "" && (
            <p aria-live="polite" className="text-sm text-slate-500 mb-4">
              {filtered.length} result{filtered.length === 1 ? "" : "s"} for{" "}
              <span className="font-medium text-slate-700">&quot;{query.trim()}&quot;</span>
              {category && (
                <>
                  {" "}in <span className="font-medium text-slate-700">{category}</span>
                </>
              )}
            </p>
          )}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">No tools found</p>
              <p className="text-sm text-slate-500 mt-1">
                Try a different search term or clear the filters.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition"
              >
                <X className="w-4 h-4" /> Clear search &amp; filters
              </button>
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
  );
}