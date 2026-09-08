export function LogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bc-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#bc-grad)" />
      <path d="M17.5 5 L8 18.5 h5.5 L14.5 27 24 13.5 h-5.5 L17.5 5z" fill="#fff" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 group">
      <LogoMark className={compact ? "w-6 h-6" : "w-8 h-8"} />
      <span className={`font-bold ${compact ? "text-sm" : "text-lg"} text-slate-900 group-hover:text-indigo-600 transition-colors`}>
        Brain<span className="text-indigo-600">Coder</span>
      </span>
    </span>
  );
}