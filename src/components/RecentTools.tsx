"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Clock, ArrowRight, Heart } from "lucide-react";
import { getRecentTools, getFavorites, subscribeUserState } from "@/lib/userState";
import { getTool, type ToolConfig } from "@/lib/tools";
import { FavoriteButton } from "@/components/FavoriteButton";

function getRecentSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return JSON.stringify(getRecentTools());
}

function getFavoritesSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return JSON.stringify(getFavorites());
}

function parseTools(raw: string): ToolConfig[] {
  try {
    const slugs: unknown = JSON.parse(raw);
    if (!Array.isArray(slugs)) return [];
    return slugs
      .filter((s): s is string => typeof s === "string")
      .map((slug) => getTool(slug))
      .filter((t): t is ToolConfig => t != null)
      .slice(0, 8);
  } catch {
    return [];
  }
}

function ToolCardSmall({
  tool,
  showFavorite,
}: {
  tool: ToolConfig;
  showFavorite?: boolean;
}) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group relative flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-900/5 transition text-center"
    >
      {showFavorite && (
        <span className="absolute top-1.5 right-1.5">
          <FavoriteButton slug={tool.slug} />
        </span>
      )}
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
}

export function RecentTools() {
  const recentRaw = useSyncExternalStore(subscribeUserState, getRecentSnapshot, () => "[]");
  const favsRaw = useSyncExternalStore(subscribeUserState, getFavoritesSnapshot, () => "[]");
  const recent = parseTools(recentRaw);
  const favorites = parseTools(favsRaw);

  if (recent.length === 0 && favorites.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-5 w-full space-y-8">
      {/* Favorites */}
      {favorites.length > 0 && (
        <section aria-label="Your favorite tools">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" fill="currentColor" />
              Your favorites
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {favorites.map((tool) => (
              <ToolCardSmall key={tool.slug} tool={tool} showFavorite />
            ))}
          </div>
        </section>
      )}

      {/* Recents */}
      {recent.length > 0 && (
        <section aria-label="Your recent tools">
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
            {recent.map((tool) => (
              <ToolCardSmall key={tool.slug} tool={tool} showFavorite />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}