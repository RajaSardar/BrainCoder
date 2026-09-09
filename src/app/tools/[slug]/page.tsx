import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getTool, TOOLS } from "@/lib/tools";
import { getGuidesByTool } from "@/lib/guides";
import { buildToolMetadata, toolJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: PageProps<'/tools/[slug]'>) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) return {};
  return buildToolMetadata(tool);
}

export default async function ToolPage(props: PageProps<'/tools/[slug]'>) {
  const { slug } = await props.params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const relatedGuides = getGuidesByTool(slug);
  const isEditor = slug === "pdf-editor";

  if (isEditor) {
    return (
      <div className="h-[calc(100dvh-4rem)] min-h-[640px] w-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd(tool)) }}
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd(tool)) }}
      />
      <Link
        href="/#tools"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> All tools
      </Link>

      <div className="flex items-start gap-4 mb-5">
        <div
          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg shrink-0`}
        >
          <tool.icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {tool.name}
          </h1>
          <p className="mt-0.5 text-slate-600">{tool.description}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/70 p-3 shadow-xl shadow-slate-900/5">
        <ToolMount slug={slug} />
      </div>

      {relatedGuides.length > 0 && (
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-5">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            How-to guide
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
    </div>
  );
}

import dynamic from "next/dynamic";

const mountMap: Record<string, ReturnType<typeof dynamic>> = {
  "pdf-compressor": dynamic(() => import("@/features/pdf-compressor/PdfCompressor")),
  "pdf-editor": dynamic(() => import("@/features/pdf-editor/PdfEditor")),
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
  "gzip-tool": dynamic(() => import("@/features/gzip-tool/GzipTool")),
  "image-to-pdf": dynamic(() => import("@/features/image-to-pdf/ImageToPdf")),
  "pdf-to-image": dynamic(() => import("@/features/pdf-to-image/PdfToImage")),
  "md-to-html": dynamic(() => import("@/features/md-to-html/MdToHtml")),
  "html-to-pdf": dynamic(() => import("@/features/html-to-pdf/HtmlToPdf")),
  "html-to-image": dynamic(() => import("@/features/html-to-image/HtmlToImage")),
  "image-ocr": dynamic(() => import("@/features/image-ocr/ImageOcr")),
  "image-editor": dynamic(() => import("@/features/image-editor/ImageEditor")),
  "jwt-decoder": dynamic(() => import("@/features/jwt-decoder/JwtDecoder")),
  "qr-code-generator": dynamic(() => import("@/features/qr-code-generator/QrCodeGenerator")),
  "csv-json": dynamic(() => import("@/features/csv-json/CsvJson")),
  "json-to-typescript": dynamic(() => import("@/features/json-to-typescript/JsonToTypeScript")),
  "sql-formatter": dynamic(() => import("@/features/sql-formatter/SqlFormatter")),
  "xml-formatter": dynamic(() => import("@/features/xml-formatter/XmlFormatter")),
  "cron-parser": dynamic(() => import("@/features/cron-parser/CronParser")),
  "number-base": dynamic(() => import("@/features/number-base/NumberBase")),
  "chmod-calculator": dynamic(() => import("@/features/chmod-calculator/ChmodCalculator")),
  "px-rem": dynamic(() => import("@/features/px-rem/PxRem")),
  "http-status": dynamic(() => import("@/features/http-status/HttpStatus")),
  "html-entities": dynamic(() => import("@/features/html-entities/HtmlEntities")),
  "text-lines": dynamic(() => import("@/features/text-lines/TextLines")),
  "url-parser": dynamic(() => import("@/features/url-parser/UrlParser")),
  "image-base64": dynamic(() => import("@/features/image-base64/ImageBase64")),
  "binary-text": dynamic(() => import("@/features/binary-text/BinaryText")),
  rot13: dynamic(() => import("@/features/rot13/Rot13")),
  "morse-code": dynamic(() => import("@/features/morse-code/MorseCode")),
  "utf8-converter": dynamic(() => import("@/features/utf8-converter/Utf8Converter")),
  base32: dynamic(() => import("@/features/base32/Base32")),
  "checksum-calculator": dynamic(() => import("@/features/checksum-calculator/ChecksumCalculator")),
  "aes-encryption": dynamic(() => import("@/features/aes-encryption/AesEncryption")),
  "box-shadow-generator": dynamic(() => import("@/features/box-shadow-generator/BoxShadowGenerator")),
  "border-radius-generator": dynamic(() => import("@/features/border-radius-generator/BorderRadiusGenerator")),
  "cubic-bezier-editor": dynamic(() => import("@/features/cubic-bezier-editor/CubicBezierEditor")),
  "gradient-generator": dynamic(() => import("@/features/gradient-generator/GradientGenerator")),
  "css-unit-converter": dynamic(() => import("@/features/css-unit-converter/CssUnitConverter")),
  "json-xml": dynamic(() => import("@/features/json-xml/JsonXml")),
  "json-yaml": dynamic(() => import("@/features/json-yaml/JsonYaml")),
  "toml-json": dynamic(() => import("@/features/toml-json/TomlJson")),
  "html-markdown": dynamic(() => import("@/features/html-markdown/HtmlMarkdown")),
  "json-viewer": dynamic(() => import("@/features/json-viewer/JsonViewer")),
  "slug-generator": dynamic(() => import("@/features/slug-generator/SlugGenerator")),
  "unicode-styles": dynamic(() => import("@/features/unicode-styles/UnicodeStyles")),
  "upside-down-text": dynamic(() => import("@/features/upside-down-text/UpsideDownText")),
  "text-repeater": dynamic(() => import("@/features/text-repeater/TextRepeater")),
  "text-cleaner": dynamic(() => import("@/features/text-cleaner/TextCleaner")),
  "random-number-generator": dynamic(() => import("@/features/random-number-generator/RandomNumberGenerator")),
  "random-name-picker": dynamic(() => import("@/features/random-name-picker/RandomNamePicker")),
  "coin-dice-roller": dynamic(() => import("@/features/coin-dice-roller/CoinDiceRoller")),
  "bitwise-calculator": dynamic(() => import("@/features/bitwise-calculator/BitwiseCalculator")),
  "roman-numerals": dynamic(() => import("@/features/roman-numerals/RomanNumerals")),
  "ipv4-converter": dynamic(() => import("@/features/ipv4-converter/Ipv4Converter")),
  "cidr-calculator": dynamic(() => import("@/features/cidr-calculator/CidrCalculator")),
  "image-format-converter": dynamic(() => import("@/features/image-format-converter/ImageFormatConverter")),
  "image-filters": dynamic(() => import("@/features/image-filters/ImageFilters")),
  "image-splitter": dynamic(() => import("@/features/image-splitter/ImageSplitter")),
  "unit-converter": dynamic(() => import("@/features/unit-converter/UnitConverter")),
  "html-formatter": dynamic(() => import("@/features/html-formatter/HtmlFormatter")),
  "css-formatter": dynamic(() => import("@/features/css-formatter/CssFormatter")),
  "javascript-formatter": dynamic(() => import("@/features/javascript-formatter/JavascriptFormatter")),
  "csv-formatter": dynamic(() => import("@/features/csv-formatter/CsvFormatter")),
  "csv-to-sql": dynamic(() => import("@/features/csv-to-sql/CsvToSql")),
  "sqlite-viewer": dynamic(() => import("@/features/sqlite-viewer/SqliteViewer")),
  "pdf-merge": dynamic(() => import("@/features/pdf-merge/PdfMerge")),
  "pdf-split": dynamic(() => import("@/features/pdf-split/PdfSplit")),
  "svg-formatter": dynamic(() => import("@/features/svg-formatter/SvgFormatter")),
  "svg-to-png": dynamic(() => import("@/features/svg-to-png/SvgToPng")),
};

function ToolMount({ slug }: { slug: string }) {
  const Component = mountMap[slug];
  if (!Component) notFound();
  return <Component />;
}