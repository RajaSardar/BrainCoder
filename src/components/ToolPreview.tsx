import { FolderOpen, UploadCloud, FileText, Download } from "lucide-react";
import type { ToolConfig } from "@/lib/tools";

const MOCK_FILES = [
  { name: "document.pdf", size: "1.2 MB" },
  { name: "report.pdf", size: "860 KB" },
];

export function ToolPreview({ tool }: { tool: ToolConfig }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className={`absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br ${tool.gradient} opacity-20 blur-3xl`}
      />
      <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <span className="w-3 h-3 rounded-full bg-red-400/80" />
          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
          <span className="w-3 h-3 rounded-full bg-green-400/80" />
          <span className="ml-3 text-xs text-slate-400 font-mono truncate">
            braincoder.app/use/{tool.slug}
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg shadow-slate-900/10 shrink-0`}
            >
              <tool.icon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{tool.name}</p>
              <p className="text-xs text-slate-500">{tool.tagline}</p>
            </div>
          </div>

          <div className="relative mt-5 rounded-xl border-2 border-dashed border-slate-300 p-5 text-center overflow-hidden">
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-[0.06]`}
            />
            <div className="relative z-10">
              <div
                className={`mx-auto w-11 h-11 rounded-full bg-gradient-to-br ${tool.gradient} flex items-center justify-center`}
              >
                <UploadCloud className="w-5 h-5 text-white" />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                Drop your file here
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                or browse from your device
              </p>
              <span className="mt-3 inline-block rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                <FolderOpen className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                Browse files
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {MOCK_FILES.map((f, i) => (
              <div
                key={f.name}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-700 truncate">
                      {f.name}
                    </p>
                    <p className="text-xs text-slate-400 shrink-0">{f.size}</p>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-slate-200">
                    <div
                      className={`h-1 rounded-full bg-gradient-to-r ${tool.gradient}`}
                      style={{ width: i === 0 ? "72%" : "50%" }}
                    />
                  </div>
                </div>
                {i === 0 && (
                  <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}