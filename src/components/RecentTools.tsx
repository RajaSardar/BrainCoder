"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Clock, ArrowRight } from "lucide-react";
import { getRecentTools } from "@/lib/userState";
import { getTool, type ToolConfig } from "@/lib/tools";

function getRecentSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return JSON.stringify(getRecentTools());
}

function subscribe(): () => void {
  return () => {};
}

function parseTools(raw: string): ToolConfig[] {
  try {
    const slugs: unknown = JSON.parse(raw);
    if (!Array.isArray(slugs)) return [];
    return slugs
      .filter((s): s is string => typeof s === "string")
      .map((slug) => getTool(slug))
      .filter((t): t is ToolConfig => t != null)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export function RecentTools() {
  const raw = useSyncExternalStore(subscribe, getRecentSnapshot, () => "[]");
  const recent = parseTools(raw);

  if (recent.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-5 w-full" aria-label="Your recent tools">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Your recent tools
        </h2>
        <Link
          href="/#tools"
          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
        >
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {recent.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-900/5 transition text-center"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-sm`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700 transition leading-tight">
                {tool.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}