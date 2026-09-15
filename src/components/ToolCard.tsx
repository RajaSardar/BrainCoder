import Link from "next/link";
import type { ToolConfig } from "@/lib/tools";

export function ToolCard({ tool }: { tool: ToolConfig }) {
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