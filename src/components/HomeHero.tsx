import { Lock, Zap, Shield, MousePointerClick } from "lucide-react";

export function HomeHero() {
  return (
    <section className="max-w-4xl mx-auto px-5 pt-14 pb-10 text-center">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 mb-6">
        <Lock className="w-3.5 h-3.5" /> 100% private — files never leave your device
      </span>
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
        Free developer tools in{" "}
        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          your browser
        </span>
      </h1>
      <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
        Compress, convert, encode, format and generate — 123 privacy-first utilities that need
        no sign-up and never upload your files.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-8 text-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500" /> 123 free tools
        </span>
        <span className="flex items-center gap-1.5">
          <MousePointerClick className="w-4 h-4 text-purple-500" /> 8 categories
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-green-500" /> 0 uploads, no sign-up
        </span>
      </div>
    </section>
  );
}