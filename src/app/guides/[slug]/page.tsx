import Link from "next/link";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import { getGuide, GUIDES } from "@/lib/guides";
import { getTool } from "@/lib/tools";
import {
  buildGuideMetadata,
  guideJsonLd,
  SITE_NAME,
} from "@/lib/seo";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<'/guides/[slug]'>) {
  const { slug } = await props.params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return buildGuideMetadata(guide);
}

export default async function GuidePage(props: PageProps<'/guides/[slug]'>) {
  const { slug } = await props.params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const tool = getTool(guide.toolSlug);
  if (!tool) notFound();

  return (
    <article className="max-w-3xl mx-auto px-5 py-8 w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(guideJsonLd(guide, tool)) }}
      />

      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> All guides
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
          {guide.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-slate-500 mt-3">
          <span>{SITE_NAME}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {guide.readMinutes} min read
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={guide.updated}>
            Updated {new Date(guide.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </time>
        </div>
        <p className="mt-4 text-lg text-slate-600">{guide.description}</p>
      </header>

      {guide.sections.map((section, i) => (
        <section key={i} className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-3">{section.heading}</h2>
          {section.paragraphs.map((p, j) => (
            <p key={j} className="text-slate-600 leading-relaxed mb-3">{p}</p>
          ))}
        </section>
      ))}

      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 mt-10">
        <h2 className="font-bold text-slate-900">Try it free — {tool.name}</h2>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          {tool.description}
        </p>
        <Link
          href={`/tools/${tool.slug}`}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-indigo-700 transition"
        >
          Open {tool.name} <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}