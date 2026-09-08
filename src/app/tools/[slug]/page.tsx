import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTool, TOOLS } from "@/lib/tools";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: PageProps<'/tools/[slug]'>) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: tool.description,
  };
}

export default async function ToolPage(props: PageProps<'/tools/[slug]'>) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 w-full">
      <Link
        href="/#tools"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> All tools
      </Link>

      <div className="flex items-start gap-4 mb-8">
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg shrink-0`}
        >
          <tool.icon className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {tool.name}
          </h1>
          <p className="mt-1 text-slate-600">{tool.description}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/70 p-3 shadow-xl shadow-slate-900/5">
        <ToolMount slug={slug} />
      </div>
    </div>
  );
}

import dynamic from "next/dynamic";

const mountMap: Record<string, ReturnType<typeof dynamic>> = {
  "pdf-compressor": dynamic(() => import("@/features/pdf-compressor/PdfCompressor")),
  "image-compressor": dynamic(() => import("@/features/image-compressor/ImageCompressor")),
  "image-resizer": dynamic(() => import("@/features/image-resizer/ImageResizer")),
  "json-formatter": dynamic(() => import("@/features/json-formatter/JsonFormatter")),
  "url-encoder": dynamic(() => import("@/features/url-encoder/UrlEncoder")),
  base64: dynamic(() => import("@/features/base64/Base64Tool")),
  notepad: dynamic(() => import("@/features/notepad/Notepad")),
  "password-generator": dynamic(() => import("@/features/password-generator/PasswordGenerator")),
  "diff-checker": dynamic(() => import("@/features/diff-checker/DiffChecker")),
  "regex-tester": dynamic(() => import("@/features/regex-tester/RegexTester")),
  "timestamp-converter": dynamic(() => import("@/features/timestamp-converter/TimestampConverter")),
  "hash-generator": dynamic(() => import("@/features/hash-generator/HashGenerator")),
  "markdown-preview": dynamic(() => import("@/features/markdown-preview/MarkdownPreview")),
  "html-minifier": dynamic(() => import("@/features/html-minifier/HtmlMinifier")),
  "case-converter": dynamic(() => import("@/features/case-converter/CaseConverter")),
  "uuid-generator": dynamic(() => import("@/features/uuid-generator/UuidGenerator")),
  "word-counter": dynamic(() => import("@/features/word-counter/WordCounter")),
  "lorem-ipsum": dynamic(() => import("@/features/lorem-ipsum/LoremIpsum")),
  "color-converter": dynamic(() => import("@/features/color-converter/ColorConverter")),
  "css-cursor": dynamic(() => import("@/features/css-cursor/CssCursor")),
};

function ToolMount({ slug }: { slug: string }) {
  const Component = mountMap[slug];
  if (!Component) notFound();
  return <Component />;
}