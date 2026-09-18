import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

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
  "text-size-calculator": dynamic(
    () => import("@/features/text-size-calculator/TextSizeCalculator"),
  ),
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

export default function ToolMount({ slug }: { slug: string }) {
  const Component = mountMap[slug];
  if (!Component) notFound();
  return <Component />;
}