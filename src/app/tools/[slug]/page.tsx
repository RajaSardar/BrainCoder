import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  Gauge,
  HelpCircle,
  Lock,
  MousePointerClick,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
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
import { ToolPreview } from "@/components/ToolPreview";
import { ToolSubNav } from "@/components/ToolSubNav";

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
    .slice(0, 6);
}

const FEATURE_ICONS = [
  Sparkles,
  Zap,
  ShieldCheck,
  Gauge,
  MousePointerClick,
  SlidersHorizontal,
  Download,
  Lock,
];

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "100% private",
    text: "Nothing is uploaded — everything runs in your browser.",
  },
  {
    icon: Lock,
    title: "Free forever",
    text: "No accounts, no watermarks, no hidden limits.",
  },
  {
    icon: Gauge,
    title: "No sign-up",
    text: "Open the tool and start using it right away.",
  },
  {
    icon: Zap,
    title: "Instant results",
    text: "No queues or uploads, so you get output immediately.",
  },
];

export default async function ToolPage(props: PageProps<"/tools/[slug]">) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const relatedGuides = getGuidesByTool(slug);
  const content = TOOL_CONTENT[slug];
  const relatedTools = getRelatedTools(slug, content);
  const toolUrl = `${SITE_URL}/tools/${slug}`;

  return (
    <>
      <div className="max-w-6xl mx-auto px-5 pt-6 w-full pb-24 lg:pb-16">
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
        <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-8 flex-wrap" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-slate-700 transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/#tools" className="hover:text-slate-700 transition">
            Tools
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 font-medium">{tool.name}</span>
        </nav>

        <ToolSubNav
          slug={tool.slug}
          name={tool.name}
          gradient={tool.gradient}
          iconSlot={<tool.icon className="w-5 h-5 text-white" />}
        />

        {/* Hero */}
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center mb-14">
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-3 py-1">
                <Tag className="w-3 h-3" />
                {tool.category}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full px-3 py-1">
                <ShieldCheck className="w-3 h-3" />
                Nothing uploaded
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {tool.name}
            </h1>
            <p className="mt-3 text-lg text-slate-600 max-w-xl">
              {tool.tagline}
            </p>
            <p className="mt-3 text-slate-500 text-[15px] max-w-xl leading-relaxed">
              {tool.description}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/use/${slug}`}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:from-indigo-700 hover:to-purple-700 transition shadow-lg shadow-indigo-500/25"
              >
                <Play className="w-4 h-4" /> Launch tool — free
              </Link>
              {content && content.howTo.length > 0 && (
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  How it works
                </a>
              )}
            </div>
          </div>
          <ToolPreview tool={tool} />
        </div>

        {/* Trust band */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <item.icon className="w-5 h-5 text-indigo-600" />
              <p className="mt-2 text-sm font-bold text-slate-900">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* About */}
        {content && (
          <div id="about" className="grid lg:grid-cols-[1fr_17rem] gap-8 mb-14 scroll-mt-24">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-4">
                About this tool
              </h2>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
                <div
                  className="text-[15px] text-slate-600 leading-relaxed [&_p]:mb-4 [&_p]:last:mb-0"
                  dangerouslySetInnerHTML={{ __html: content.longDescription }}
                />
              </div>
            </div>
            <aside className="rounded-2xl border border-slate-200 bg-white p-6 h-fit">
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                At a glance
              </h3>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                    Category
                  </dt>
                  <dd className="mt-1 font-medium text-slate-700">
                    {tool.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                    How it runs
                  </dt>
                  <dd className="mt-1 font-medium text-slate-700">
                    In your browser
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                    Price
                  </dt>
                  <dd className="mt-1 inline-flex items-center gap-1.5 font-medium text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Free forever
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                    Requires
                  </dt>
                  <dd className="mt-1 font-medium text-slate-700">
                    No account, no install
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        )}

        {/* Features */}
        {content && content.features.length > 0 && (
          <div id="features" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">
              Key features
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Everything you get with {tool.name} — no premium upsell.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {content.features.map((f, i) => {
                const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tool.gradient} flex items-center justify-center shrink-0 shadow-sm`}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed pt-1">
                      {f}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* How to use */}
        {content && content.howTo.length > 0 && (
          <div id="how-it-works" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">
              How to use {tool.name}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Three straightforward steps — no sign-up required.
            </p>
            <ol className="relative space-y-0">
              {content.howTo.map((s, i) => (
                <li
                  key={i}
                  className="relative flex items-start gap-5 pb-8 last:pb-0"
                >
                  {i < content.howTo.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[17px] top-11 bottom-0 w-px bg-gradient-to-b from-indigo-200 to-slate-100"
                    />
                  )}
                  <span
                    className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br ${tool.gradient} text-white text-sm font-bold shrink-0 shadow-md`}
                  >
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <h3 className="text-base font-bold text-slate-900">
                      {s.step}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {s.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Launch CTA */}
        <div
          id="tool"
          className={`relative rounded-3xl bg-gradient-to-br ${tool.gradient} p-8 sm:p-12 text-white overflow-hidden mb-14 shadow-xl scroll-mt-24`}
        >
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-black/10"
          />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <tool.icon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Ready to use {tool.name}?
                </h2>
                <p className="mt-1 text-white/85 text-sm max-w-md">
                  It&apos;s free, private and instant — your files never leave
                  your device.
                </p>
              </div>
            </div>
            <Link
              href={`/use/${slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-6 py-3.5 font-semibold text-sm hover:bg-slate-100 transition shadow-lg shrink-0"
            >
              <Play className="w-4 h-4" /> Launch the tool
            </Link>
          </div>
        </div>

        {/* FAQ */}
        {content && content.faq.length > 0 && (
          <div id="faq" className="mb-14 scroll-mt-24">
            <h2 className="text-xl font-extrabold text-slate-900 mb-2 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              Frequently asked questions
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Quick answers before you launch the tool.
            </p>
            <ToolFaq items={content.faq} />
          </div>
        )}

        {/* Related tools */}
        {relatedTools.length > 0 && (
          <div className="mb-14">
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">
              Related tools
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Saved you searching — here are similar utilities.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedTools.map((rt) => (
                <Link
                  key={rt.slug}
                  href={`/tools/${rt.slug}`}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-900/5 transition"
                >
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${rt.gradient} flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    <rt.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition">
                      {rt.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
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
          <div className="mb-14 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 sm:p-7">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              How-to guides
            </h2>
            <ul className="mt-4 grid sm:grid-cols-2 gap-2.5">
              {relatedGuides.map((guide) => (
                <li key={guide.slug}>
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-white hover:text-indigo-900 hover:shadow-sm transition border border-indigo-100"
                  >
                    {guide.title}
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/#tools"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Browse all {TOOLS.length} tools
          </Link>
        </div>
      </div>

      <ToolSubNav
        slug={tool.slug}
        name={tool.name}
        gradient={tool.gradient}
        iconSlot={<tool.icon className="w-5 h-5 text-white" />}
      />
    </>
  );
}