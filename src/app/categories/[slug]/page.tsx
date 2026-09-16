import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ChevronRight, ShieldCheck, Tag, Zap } from "lucide-react";
import {
  CATEGORIES,
  getCategoryBySlug,
  getCategorySlug,
  getToolsByCategory,
  type Category,
} from "@/lib/tools";
import {
  buildCategoryMetadata,
  categoryJsonLd,
  CATEGORY_DESCRIPTIONS,
} from "@/lib/seo";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: getCategorySlug(c) }));
}

export async function generateMetadata(
  props: PageProps<"/categories/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};
  return buildCategoryMetadata(category, slug);
}

export default async function CategoryPage(props: PageProps<"/categories/[slug]">) {
  const { slug } = await props.params;
  const category: Category | undefined = getCategoryBySlug(slug);
  if (!category) notFound();

  const tools = getToolsByCategory(category);
  const description = CATEGORY_DESCRIPTIONS[category];

  return (
    <div className="max-w-6xl mx-auto px-5 pt-6 w-full pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd(category, slug)) }}
      />

      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-1.5 text-sm text-slate-500 mb-8 flex-wrap"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="hover:text-slate-700 transition">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/#tools" className="hover:text-slate-700 transition">
          Tools
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 font-medium">{category} tools</span>
      </nav>

      {/* Hero */}
      <div className="relative rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 mb-10 shadow-sm overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"
        />
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-3 py-1">
            <Tag className="w-3 h-3" />
            {tools.length} free tools
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full px-3 py-1">
            <ShieldCheck className="w-3 h-3" />
            Nothing uploaded
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
          {category} tools
        </h1>
        <p className="mt-3 text-lg text-slate-600 max-w-2xl">{description}</p>
        <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Every tool runs in your browser. No account or uploads; limits vary by tool.
        </p>
      </div>

      {/* All tools in category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>

      {/* Back link */}
      <div className="text-center mt-12">
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
