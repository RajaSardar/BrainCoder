import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  HelpCircle,
  Play,
  Zap,
} from "lucide-react";
import { getTool, TOOLS, type ToolConfig } from "@/lib/tools";
import { getGuidesByTool } from "@/lib/guides";
import {
  buildToolMetadata,
  toolJsonLd,
  faqJsonLd,
  howToJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { TOOL_CONTENT, type ToolContent } from "@/lib/tool-content";
import { notFound } from "next/navigation";
import ToolFaq from "@/components/ToolFaq";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: PageProps<"/tools/[slug]">) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) return {};
  return buildToolMetadata(tool);
}

function getRelatedTools(slug: string, content?: ToolContent) {
  const slugs = content?.relatedSlugs ?? [];
  return slugs
    .map((s) => getTool(s))
    .filter((t): t is ToolConfig => t != null && t.slug !== slug)
    .slice(0, 5);
}

export default async function ToolPage(props: PageProps<"/tools/[slug]">) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const relatedGuides = getGuidesByTool(slug);
  const content = TOOL_CONTENT[slug];
  const relatedTools = getRelatedTools(slug, content);
  const toolUrl = `${SITE_URL}/tools/${slug}`;

  return (
    <div className="max-w-[90rem] mx-auto px-5 py-6 w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(toolJsonLd(tool)),
        }}
      />
      {content && content.faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd(content.faq, tool.name)),
          }}
        />
      )}
      {content && content.howTo.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              howToJsonLd(content.howTo, tool.name, toolUrl),
            ),
          }}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-5 flex-wrap">
        <Link href="/" className="hover:text-slate-900 transition">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/#tools" className="hover:text-slate-900 transition">
          Tools
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 font-medium">{tool.name}</span>
      </nav>

      {/* Hero */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg shrink-0`}
        >
          <tool.icon className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {tool.name}
          </h1>
          <p className="mt-1 text-slate-600 text-base sm:text-lg">
            {tool.tagline}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={`/use/${slug}`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:from-indigo-700 hover:to-purple-700 transition shadow-md shadow-indigo-500/20"
            >
              <Play className="w-4 h-4" /> Launch full-screen tool
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              100% browser-based — nothing uploaded
            </span>
          </div>
        </div>
      </div>

      {/* Long description */}
      {content && (
        <div className="prose prose-slate max-w-none mb-8">
          <div
            className="text-sm text-slate-700 leading-relaxed space-y-3 [&_p]:mb-3"
            dangerouslySetInnerHTML={{
              __html: content.longDescription,
            }}
          />
        </div>
      )}

      {/* Features */}
      {content && content.features.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Key features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {content.features.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How to use */}
      {content && content.howTo.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-indigo-500" />
            How to use {tool.name}
          </h2>
          <ol className="space-y-3">
            {content.howTo.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {s.step}
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {s.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Tool */}
      <div
        id="tool"
        className="rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-xl shadow-slate-900/5 scroll-mt-20 flex flex-col items-center text-center gap-4"
      >
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg`}
        >
          <tool.icon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{tool.name}</h2>
        <p className="text-slate-600 max-w-md text-sm">{tool.tagline}</p>
        <Link
          href={`/use/${slug}`}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition shadow-lg shadow-indigo-500/20"
        >
          <Play className="w-5 h-5" /> Launch tool — full screen
        </Link>
        <p className="text-xs text-slate-400">
          100% browser-based — nothing is uploaded.
        </p>
      </div>

      {/* FAQ */}
      {content && content.faq.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            Frequently asked questions
          </h2>
          <ToolFaq items={content.faq} />
        </div>
      )}

      {/* Related tools */}
      {relatedTools.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Related tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedTools.map((rt) => (
              <Link
                key={rt.slug}
                href={`/tools/${rt.slug}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:shadow-md hover:border-indigo-200 transition group"
              >
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${rt.gradient} flex items-center justify-center shrink-0`}
                >
                  <rt.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition truncate">
                    {rt.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {rt.tagline}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Related guides */}
      {relatedGuides.length > 0 && (
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-5">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            How-to guides
          </h2>
          <ul className="mt-3 space-y-2">
            {relatedGuides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-700 hover:text-indigo-900 hover:underline font-medium"
                >
                  {guide.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href="/#tools"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Browse all tools
        </Link>
      </div>
    </div>
  );
}

