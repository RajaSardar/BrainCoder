"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/Logo";

const FULLSCREEN_ROUTES = ["/tools/pdf-editor"];

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname && FULLSCREEN_ROUTES.includes(pathname)) return null;

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <LogoMark className="w-8 h-8" />
          <span className="font-bold text-lg text-slate-900">
            Brain<span className="text-indigo-600">Coder</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/#tools" className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition">
            Tools
          </Link>
          <Link href="/guides" className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition">
            Guides
          </Link>
          <a
            href="https://braincoder.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            Live app
          </a>
          <a
            href="https://github.com/RajaSardar/BrainCoder"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}