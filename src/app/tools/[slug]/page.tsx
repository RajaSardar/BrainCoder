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
import dynamic from "next/dynamic";

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
  const isEditor = slug === "pdf-editor" || slug === "pdf-creator";
  const toolUrl = `${SITE_URL}/tools/${slug}`;

  if (isEditor) {
    return (
      <div className="h-dvh min-h-[640px] w-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(toolJsonLd(tool)),
          }}
        />
        <h1 className="sr-only">{tool.name}</h1>
        <p className="sr-only">{tool.description}</p>
        <ToolMount slug={slug} />
      </div>
    );
  }

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
            <a
              href="#tool"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:from-indigo-700 hover:to-purple-700 transition shadow-md shadow-indigo-500/20"
            >
              <Play className="w-4 h-4" /> Use this tool free
            </a>
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
        className="rounded-3xl border border-slate-200 bg-white/70 p-3 shadow-xl shadow-slate-900/5 scroll-mt-20"
      >
        <ToolMount slug={slug} />
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

const mountMap: Record<string, ReturnType<typeof dynamic>> = {
  "pdf-compressor": dynamic(
    () => import("@/features/pdf-compressor/PdfCompressor"),
  ),
  "pdf-editor": dynamic(() => import("@/features/pdf-editor/PdfEditor")),
  "pdf-creator": dynamic(() => import("@/features/pdf-creator/PdfCreator")),
  "image-compressor": dynamic(
    () => import("@/features/image-compressor/ImageCompressor"),
  ),
  "image-resizer": dynamic(
    () => import("@/features/image-resizer/ImageResizer"),
  ),
  "json-formatter": dynamic(
    () => import("@/features/json-formatter/JsonFormatter"),
  ),
  "url-encoder": dynamic(() => import("@/features/url-encoder/UrlEncoder")),
  base64: dynamic(() => import("@/features/base64/Base64Tool")),
  notepad: dynamic(() => import("@/features/notepad/Notepad")),
  "password-generator": dynamic(
    () => import("@/features/password-generator/PasswordGenerator"),
  ),
  "diff-checker": dynamic(() => import("@/features/diff-checker/DiffChecker")),
  "regex-tester": dynamic(() => import("@/features/regex-tester/RegexTester")),
  "timestamp-converter": dynamic(
    () => import("@/features/timestamp-converter/TimestampConverter"),
  ),
  "hash-generator": dynamic(
    () => import("@/features/hash-generator/HashGenerator"),
  ),
  "markdown-preview": dynamic(
    () => import("@/features/markdown-preview/MarkdownPreview"),
  ),
  "html-minifier": dynamic(
    () => import("@/features/html-minifier/HtmlMinifier"),
  ),
  "case-converter": dynamic(
    () => import("@/features/case-converter/CaseConverter"),
  ),
  "uuid-generator": dynamic(
    () => import("@/features/uuid-generator/UuidGenerator"),
  ),
  "word-counter": dynamic(() => import("@/features/word-counter/WordCounter")),
  "lorem-ipsum": dynamic(() => import("@/features/lorem-ipsum/LoremIpsum")),
  "color-converter": dynamic(
    () => import("@/features/color-converter/ColorConverter"),
  ),
  "css-cursor": dynamic(() => import("@/features/css-cursor/CssCursor")),
  "gzip-tool": dynamic(() => import("@/features/gzip-tool/GzipTool")),
  "image-to-pdf": dynamic(() => import("@/features/image-to-pdf/ImageToPdf")),
  "pdf-to-image": dynamic(() => import("@/features/pdf-to-image/PdfToImage")),
  "pdf-to-word": dynamic(() => import("@/features/pdf-to-word/PdfToWord")),
  "word-to-pdf": dynamic(() => import("@/features/word-to-pdf/WordToPdf")),
  "pdf-to-text": dynamic(() => import("@/features/pdf-to-text/PdfToText")),
  "text-to-pdf": dynamic(() => import("@/features/text-to-pdf/TextToPdf")),
  "pdf-to-ppt": dynamic(() => import("@/features/pdf-to-ppt/PdfToPpt")),
  "pdf-rotate": dynamic(() => import("@/features/pdf-rotate/PdfRotate")),
  "pdf-remove-blank-pages": dynamic(
    () => import("@/features/pdf-remove-blank-pages/PdfRemoveBlankPages"),
  ),
  "pdf-remove-pages": dynamic(
    () => import("@/features/pdf-remove-pages/PdfRemovePages"),
  ),
  "pdf-watermark": dynamic(
    () => import("@/features/pdf-watermark/PdfWatermark"),
  ),
  "pdf-page-numbers": dynamic(
    () => import("@/features/pdf-page-numbers/PdfPageNumbers"),
  ),
  "pdf-crop": dynamic(() => import("@/features/pdf-crop/PdfCrop")),
  "pdf-protect": dynamic(() => import("@/features/pdf-protect/PdfProtect")),
  "pdf-unlock": dynamic(() => import("@/features/pdf-unlock/PdfUnlock")),
  "pdf-metadata": dynamic(() => import("@/features/pdf-metadata/PdfMetadata")),
  "pdf-to-excel": dynamic(() => import("@/features/pdf-to-excel/PdfToExcel")),
  "pdf-to-markdown": dynamic(
    () => import("@/features/pdf-to-markdown/PdfToMarkdown"),
  ),
  "pdf-ocr": dynamic(() => import("@/features/pdf-ocr/PdfOcr")),
  "pdf-compare": dynamic(() => import("@/features/pdf-compare/PdfCompare")),
  "pdf-redact": dynamic(() => import("@/features/pdf-redact/PdfRedact")),
  "pdf-auto-redact": dynamic(
    () => import("@/features/pdf-auto-redact/PdfAutoRedact"),
  ),
  "pdf-overlay": dynamic(() => import("@/features/pdf-overlay/PdfOverlay")),
  "pdf-flatten": dynamic(() => import("@/features/pdf-flatten/PdfFlatten")),
  "pdf-remove-annotations": dynamic(
    () => import("@/features/pdf-remove-annotations/PdfRemoveAnnotations"),
  ),
  "pdf-scale-pages": dynamic(
    () => import("@/features/pdf-scale-pages/PdfScalePages"),
  ),
  "md-to-html": dynamic(() => import("@/features/md-to-html/MdToHtml")),
  "html-to-pdf": dynamic(() => import("@/features/html-to-pdf/HtmlToPdf")),
  "html-to-image": dynamic(
    () => import("@/features/html-to-image/HtmlToImage"),
  ),
  "image-ocr": dynamic(() => import("@/features/image-ocr/ImageOcr")),
  "image-editor": dynamic(() => import("@/features/image-editor/ImageEditor")),
  "jwt-decoder": dynamic(() => import("@/features/jwt-decoder/JwtDecoder")),
  "qr-code-generator": dynamic(
    () => import("@/features/qr-code-generator/QrCodeGenerator"),
  ),
  "csv-json": dynamic(() => import("@/features/csv-json/CsvJson")),
  "json-to-typescript": dynamic(
    () => import("@/features/json-to-typescript/JsonToTypeScript"),
  ),
  "sql-formatter": dynamic(
    () => import("@/features/sql-formatter/SqlFormatter"),
  ),
  "xml-formatter": dynamic(
    () => import("@/features/xml-formatter/XmlFormatter"),
  ),
  "cron-parser": dynamic(() => import("@/features/cron-parser/CronParser")),
  "number-base": dynamic(() => import("@/features/number-base/NumberBase")),
  "chmod-calculator": dynamic(
    () => import("@/features/chmod-calculator/ChmodCalculator"),
  ),
  "px-rem": dynamic(() => import("@/features/px-rem/PxRem")),
  "http-status": dynamic(() => import("@/features/http-status/HttpStatus")),
  "html-entities": dynamic(
    () => import("@/features/html-entities/HtmlEntities"),
  ),
  "text-lines": dynamic(() => import("@/features/text-lines/TextLines")),
  "url-parser": dynamic(() => import("@/features/url-parser/UrlParser")),
  "image-base64": dynamic(() => import("@/features/image-base64/ImageBase64")),
  "binary-text": dynamic(() => import("@/features/binary-text/BinaryText")),
  rot13: dynamic(() => import("@/features/rot13/Rot13")),
  "morse-code": dynamic(() => import("@/features/morse-code/MorseCode")),
  "utf8-converter": dynamic(
    () => import("@/features/utf8-converter/Utf8Converter"),
  ),
  base32: dynamic(() => import("@/features/base32/Base32")),
  "checksum-calculator": dynamic(
    () => import("@/features/checksum-calculator/ChecksumCalculator"),
  ),
  "aes-encryption": dynamic(
    () => import("@/features/aes-encryption/AesEncryption"),
  ),
  "box-shadow-generator": dynamic(
    () => import("@/features/box-shadow-generator/BoxShadowGenerator"),
  ),
  "border-radius-generator": dynamic(
    () => import("@/features/border-radius-generator/BorderRadiusGenerator"),
  ),
  "cubic-bezier-editor": dynamic(
    () => import("@/features/cubic-bezier-editor/CubicBezierEditor"),
  ),
  "gradient-generator": dynamic(
    () => import("@/features/gradient-generator/GradientGenerator"),
  ),
  "css-unit-converter": dynamic(
    () => import("@/features/css-unit-converter/CssUnitConverter"),
  ),
  "json-xml": dynamic(() => import("@/features/json-xml/JsonXml")),
  "json-yaml": dynamic(() => import("@/features/json-yaml/JsonYaml")),
  "toml-json": dynamic(() => import("@/features/toml-json/TomlJson")),
  "html-markdown": dynamic(
    () => import("@/features/html-markdown/HtmlMarkdown"),
  ),
  "json-viewer": dynamic(() => import("@/features/json-viewer/JsonViewer")),
  "slug-generator": dynamic(
    () => import("@/features/slug-generator/SlugGenerator"),
  ),
  "unicode-styles": dynamic(
    () => import("@/features/unicode-styles/UnicodeStyles"),
  ),
  "upside-down-text": dynamic(
    () => import("@/features/upside-down-text/UpsideDownText"),
  ),
  "text-repeater": dynamic(
    () => import("@/features/text-repeater/TextRepeater"),
  ),
  "text-cleaner": dynamic(() => import("@/features/text-cleaner/TextCleaner")),
  "random-number-generator": dynamic(
    () => import("@/features/random-number-generator/RandomNumberGenerator"),
  ),
  "random-name-picker": dynamic(
    () => import("@/features/random-name-picker/RandomNamePicker"),
  ),
  "coin-dice-roller": dynamic(
    () => import("@/features/coin-dice-roller/CoinDiceRoller"),
  ),
  "bitwise-calculator": dynamic(
    () => import("@/features/bitwise-calculator/BitwiseCalculator"),
  ),
  "roman-numerals": dynamic(
    () => import("@/features/roman-numerals/RomanNumerals"),
  ),
  "ipv4-converter": dynamic(
    () => import("@/features/ipv4-converter/Ipv4Converter"),
  ),
  "cidr-calculator": dynamic(
    () => import("@/features/cidr-calculator/CidrCalculator"),
  ),
  "image-format-converter": dynamic(
    () => import("@/features/image-format-converter/ImageFormatConverter"),
  ),
  "image-filters": dynamic(
    () => import("@/features/image-filters/ImageFilters"),
  ),
  "image-splitter": dynamic(
    () => import("@/features/image-splitter/ImageSplitter"),
  ),
  "unit-converter": dynamic(
    () => import("@/features/unit-converter/UnitConverter"),
  ),
  "html-formatter": dynamic(
    () => import("@/features/html-formatter/HtmlFormatter"),
  ),
  "css-formatter": dynamic(
    () => import("@/features/css-formatter/CssFormatter"),
  ),
  "javascript-formatter": dynamic(
    () => import("@/features/javascript-formatter/JavascriptFormatter"),
  ),
  "csv-formatter": dynamic(
    () => import("@/features/csv-formatter/CsvFormatter"),
  ),
  "csv-to-sql": dynamic(() => import("@/features/csv-to-sql/CsvToSql")),
  "sqlite-viewer": dynamic(
    () => import("@/features/sqlite-viewer/SqliteViewer"),
  ),
  "pdf-merge": dynamic(() => import("@/features/pdf-merge/PdfMerge")),
  "pdf-split": dynamic(() => import("@/features/pdf-split/PdfSplit")),
  "svg-formatter": dynamic(
    () => import("@/features/svg-formatter/SvgFormatter"),
  ),
  "svg-to-png": dynamic(() => import("@/features/svg-to-png/SvgToPng")),
  "word-to-text": dynamic(() => import("@/features/word-to-text/WordToText")),
  "word-to-markdown": dynamic(
    () => import("@/features/word-to-markdown/WordToMarkdown"),
  ),
  "word-viewer": dynamic(() => import("@/features/word-viewer/WordViewer")),
  "word-creator": dynamic(() => import("@/features/word-creator/WordCreator")),
  "csv-to-excel": dynamic(() => import("@/features/csv-to-excel/CsvToExcel")),
  "excel-viewer": dynamic(() => import("@/features/excel-viewer/ExcelViewer")),
  "excel-to-csv": dynamic(() => import("@/features/excel-to-csv/ExcelToCsv")),
  "excel-to-json": dynamic(() => import("@/features/excel-to-json/ExcelToJson")),
  "excel-merge": dynamic(() => import("@/features/excel-merge/ExcelMerge")),
  "excel-to-pdf": dynamic(() => import("@/features/excel-to-pdf/ExcelToPdf")),
  "pptx-creator": dynamic(() => import("@/features/pptx-creator/PptxCreator")),
};

function ToolMount({ slug }: { slug: string }) {
  const Component = mountMap[slug];
  if (!Component) notFound();
  return <Component />;
}
