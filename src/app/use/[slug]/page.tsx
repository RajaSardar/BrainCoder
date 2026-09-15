import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTool, TOOLS } from "@/lib/tools";
import { notFound } from "next/navigation";
import ToolMount from "@/components/ToolMount";
import { TrackToolUse } from "@/components/TrackToolUse";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: PageProps<"/use/[slug]">) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: tool.description,
    alternates: {
      canonical: `/tools/${tool.slug}`,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function UseToolPage(props: PageProps<"/use/[slug]">) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <div className="h-[calc(100dvh-4rem)] min-h-[640px] w-full flex flex-col">
      <TrackToolUse slug={slug} />
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 bg-white">
        <Link
          href={`/tools/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Tool info
        </Link>
        <span className="text-sm font-semibold text-slate-800 truncate">
          {tool.name}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <ToolMount slug={slug} />
      </div>
    </div>
  );
}