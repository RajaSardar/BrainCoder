"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Play } from "lucide-react";

const LINKS = [
  { id: "about", label: "Overview" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "faq", label: "FAQ" },
];

function subscribe(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}

interface ToolSubNavProps {
  slug: string;
  name: string;
  gradient: string;
  iconSlot: React.ReactNode;
}

export function ToolSubNav({
  slug,
  name,
  gradient,
  iconSlot,
}: ToolSubNavProps) {
  const scrolled = useSyncExternalStore(
    subscribe,
    () => window.scrollY > 360,
    () => false,
  );

  const jump = (id: string) => () => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Desktop sticky sub-nav */}
      <nav className="hidden lg:block sticky top-16 z-10 -mt-6">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-1">
              {LINKS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={jump(l.id)}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  {l.label}
                </button>
              ))}
            </div>
            <Link
              href={`/use/${slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition shadow-md shadow-indigo-500/20"
            >
              <Play className="w-4 h-4" /> Launch {name}
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile floating launch bar */}
      <div
        className={`fixed bottom-0 inset-x-0 z-30 lg:hidden transition-all duration-300 ${
          scrolled
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0"
        }`}
      >
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-xl shadow-slate-900/10">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}
          >
            {iconSlot}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
            <p className="text-xs text-slate-500 truncate">
              Free — in your browser
            </p>
          </div>
          <Link
            href={`/use/${slug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition shadow-md shadow-indigo-500/20 shrink-0"
          >
            <Play className="w-4 h-4" /> Launch
          </Link>
        </div>
      </div>
    </>
  );
}