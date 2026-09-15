"use client";

import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getFavorites, toggleFavorite, subscribeUserState } from "@/lib/userState";

function getFavoritesSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return JSON.stringify(getFavorites());
}

export function FavoriteButton({
  slug,
  className = "",
}: {
  slug: string;
  className?: string;
}) {
  const raw = useSyncExternalStore(subscribeUserState, getFavoritesSnapshot, () => "[]");
  let active = false;
  try {
    active = JSON.parse(raw).includes(slug);
  } catch {
    /* ignore */
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(slug);
      }}
      className={`inline-flex items-center justify-center rounded-full p-1.5 transition
        ${active ? "text-rose-500 hover:text-rose-600 bg-rose-50" : "text-slate-300 hover:text-slate-500 bg-transparent"}
        ${className}`}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      title={active ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className="w-4 h-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}