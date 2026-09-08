import type { Metadata } from "next";
import type { ToolConfig } from "./tools";

export const SITE_URL = "https://braincoder.vercel.app";

export const SITE_NAME = "BrainCoder";
export const SITE_DESCRIPTION =
  "Free online developer tools — compress PDFs & images, encode, convert, format, hash and generate. All in your browser, no uploads, no sign-up.";

const GENERIC_KEYWORDS = [
  "free online tools",
  "developer tools",
  "browser based tools",
  "no sign up tools",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Compress: ["compress files online", "reduce file size", "file compressor free"],
  Convert: ["file converter online", "convert files in browser", "format converter"],
  "Encode & Decode": ["encoder online", "decoder online", "encode decode tool"],
  Developer: ["dev utilities", "code formatter online", "developer toolbox"],
  "Text Tools": ["text tools online", "text manipulation", "text utilities"],
  Generate: ["generator online", "random generator", "instant generator"],
  "Media & Design": ["media tools online", "design generator", "image tools online"],
};

const TOOL_KEYWORDS: Record<string, string[]> = {
  "pdf-compressor": ["compress pdf online", "reduce pdf file size", "shrink pdf", "pdf compressor free", "make pdf smaller"],
  "image-compressor": ["compress image online", "reduce image file size", "compress jpg png webp", "image compressor free"],
  "image-resizer": ["resize image online", "image resizer free", "resize jpg png webp", "reduce image dimensions"],
  "json-formatter": ["json formatter online", "json beautifier", "json validator", "prettify json", "pretty print json", "format json"],
  "url-encoder": ["url encoder online", "url decoder", "percent encoding", "encodeuri component online", "uri encoder"],
  base64: ["base64 encoder online", "base64 decoder", "text to base64", "base64 to text", "encode base64", "decode base64"],
  notepad: ["online notepad", "notepad online", "text editor online", "quick notes", "scratchpad"],
  "password-generator": ["password generator", "strong password generator online", "random password generator", "secure password", "password maker"],
  "diff-checker": ["diff checker online", "compare text", "text diff", "file comparison online", "find difference between two texts"],
  "regex-tester": ["regex tester online", "test regex", "regular expression tester", "regex matcher", "regex debugger", "regex builder"],
  "timestamp-converter": ["unix timestamp converter", "epoch converter", "timestamp to date", "epoch to datetime", "ms to seconds"],
  "hash-generator": ["hash generator online", "md5 generator", "sha256 generator", "sha1 generator", "sha512 hash", "hash text"],
  "markdown-preview": ["markdown preview", "markdown editor live", "markdown to html preview", "render markdown"],
  "html-minifier": ["html minifier online", "minify html", "compress html code", "remove whitespace html"],
  "case-converter": ["case converter online", "text case converter", "uppercase to lowercase", "title case", "snake case camel case"],
  "uuid-generator": ["uuid generator online", "random uuid v4", "generate uuid", "guid generator", "bulk uuid"],
  "word-counter": ["word counter online", "count words", "character counter", "sentence counter", "word count tool"],
  "lorem-ipsum": ["lorem ipsum generator", "dummy text generator", "placeholder text", "lorem text"],
  "color-converter": ["color converter online", "hex to rgb", "rgb to hex", "hex to hsl", "color code converter"],
  "css-cursor": ["css cursor generator", "cursor css", "url cursor generator", "w3c cursor online"],
  "gzip-tool": ["gzip online", "compress text gzip", "decompress gzip", "deflate online", "gzip string"],
  "image-to-pdf": ["image to pdf online", "jpg to pdf", "png to pdf", "convert image to pdf free"],
  "pdf-to-image": ["pdf to image online", "pdf to png", "pdf to jpg", "pdf pages to image"],
  "md-to-html": ["markdown to html", "md to html converter", "convert markdown online"],
  "html-to-pdf": ["html to pdf online", "convert html to pdf", "webpage to pdf", "print html as pdf"],
  "html-to-image": ["html to image", "html to png", "screenshot html online", "capture div as image"],
  "image-ocr": ["ocr online", "image to text", "extract text from image", "ocr jpg png", "photo to text"],
  "image-editor": ["image editor online", "edit photo in browser", "crop resize image", "online drawing"],
  "jwt-decoder": ["jwt decoder online", "decode jwt token", "inspect jwt claims", "jwt header payload", "parse jwt"],
  "qr-code-generator": ["qr code generator online", "create qr code", "make qr free", "generate qr from text url"],
  "csv-json": ["csv to json", "json to csv", "convert csv online", "csv json converter"],
  "json-to-typescript": ["json to typescript", "json to ts interface", "typescript interface generator", "json to type"],
  "sql-formatter": ["sql formatter online", "format sql", "beautify sql query", "sql pretty print", "sql formatter free"],
  "xml-formatter": ["xml formatter online", "format xml", "beautify xml", "xml pretty print", "indent xml"],
  "cron-parser": ["cron expression parser online", "cron schedule generator", "next cron run", "cron expression explained"],
  "number-base": ["number base converter online", "hex to decimal", "binary to decimal", "octal to hex", "base converter"],
  "chmod-calculator": ["chmod calculator", "linux permissions calculator", "chmod 755 meaning", "file permissions converter"],
  "px-rem": ["px to rem", "rem to px", "convert pixels to rem", "css unit converter"],
  "http-status": ["http status codes list", "http status lookup", "list of http codes", "404 500 meaning"],
  "html-entities": ["html entity encode decode", "escape html online", "html special characters", "unicode escape"],
  "text-lines": ["sort lines online", "remove duplicate lines", "line sorter", "join lines", "format line list"],
  "url-parser": ["url parser online", "parse url parts", "url query parser", "extract url components"],
  "image-base64": ["image to base64", "base64 to image", "data uri encoder", "encode image base64 online"],
  "binary-text": ["text to binary", "binary to text", "ascii to binary", "binary translator"],
  rot13: ["rot13 decoder", "rot13 encoder", "rot13 cipher", "caesar cipher", "decrypt rot13"],
  "morse-code": ["morse code translator", "text to morse", "morse to text", "morse code encoder"],
  "utf8-converter": ["utf8 encoder", "utf8 decoder", "unicode to utf8", "utf 8 converter", "escape utf8"],
  base32: ["base32 encoder", "base32 decoder", "base32 encode online", "base32 to text"],
  "checksum-calculator": ["checksum calculator online", "crc32 calculator", "md5 sha256 checksum", "sha3 checksum", "file checksum"],
  "aes-encryption": ["aes encrypt online", "aes decrypt", "aes 256 encryption", "online encryption tool", "aes gcm cbc"],
  "box-shadow-generator": ["box shadow generator", "css box shadow", "box shadow css generator", "shadow generator"],
  "border-radius-generator": ["border radius generator", "border radius css", "rounded corners generator", "border radius preview"],
  "cubic-bezier-editor": ["cubic bezier generator", "bezier curve editor", "css easing function", "cubic-bezier tool"],
  "gradient-generator": ["css gradient generator", "gradient maker online", "linear gradient css", "radial gradient generator"],
  "css-unit-converter": ["css unit converter", "px to em", "px to vw vh", "rem em px converter", "css units convert"],
  "json-xml": ["json to xml", "xml to json", "convert json to xml online", "xml to json converter"],
  "json-yaml": ["json to yaml", "yaml to json", "convert json yaml online", "yaml formatter"],
  "toml-json": ["toml to json", "json to toml", "toml parser", "convert toml online"],
  "html-markdown": ["html to markdown", "markdown to html", "html markdown converter", "convert html to md"],
  "json-viewer": ["json viewer online", "json tree viewer", "view json file", "json visualizer"],
  "slug-generator": ["slug generator online", "url slug generator", "seo slug", "create text slug"],
  "unicode-styles": ["unicode text converter", "fancy text generator", "zalgo text", "unicode style text"],
  "upside-down-text": ["upside down text generator", "flip text upside down", "backwards text", "upside down letters"],
  "text-repeater": ["repeat text online", "text repeater", "duplicate text generator", "repeat string"],
  "text-cleaner": ["clean text online", "remove extra spaces", "text cleaner", "normalize whitespace"],
  "random-number-generator": ["random number generator online", "random number between", "pick random numbers"],
  "random-name-picker": ["random name picker", "pick random name", "wheel decide name", "draw names online"],
  "coin-dice-roller": ["coin flip online", "dice roller", "dice roll simulator", "flip a coin"],
  "bitwise-calculator": ["bitwise calculator online", "and or xor calculator", "bitwise operations", "binary calculator"],
  "roman-numerals": ["roman numerals converter", "number to roman numerals", "roman to number", "roman numeral calculator"],
  "ipv4-converter": ["ipv4 converter", "ip to binary", "ip to hex", "ip address converter"],
  "cidr-calculator": ["cidr calculator", "ip subnet calculator", "subnet mask calculator", "ip range calculator", "subnetting"],
  "image-format-converter": ["image format converter online", "jpg to png", "webp to jpg", "png to webp", "avif converter"],
  "image-filters": ["image filters online", "apply photo filter", "image effects", "grayscale sepia filter"],
  "image-splitter": ["split image online", "image grid splitter", "crop image into grid", "image slicer"],
  "unit-converter": ["unit converter online", "length converter", "weight converter", "temperature converter", "metric converter"],
  "html-formatter": ["html formatter online", "format html", "beautify html", "prettier html", "html indent"],
  "css-formatter": ["css formatter online", "format css", "beautify css", "css pretty print", "minify css"],
  "javascript-formatter": ["javascript formatter online", "js beautifier", "prettier javascript", "format js code", "js formatter"],
  "csv-formatter": ["csv formatter online", "format csv", "csv beautifier", "csv viewer", "clean csv data"],
  "csv-to-sql": ["csv to sql", "csv to insert statement", "generate sql insert", "create insert query from csv"],
  "sqlite-viewer": ["sqlite viewer online", "open sqlite file", "browse sqlite database", "sqlite to csv", "sqlite query tool"],
  "pdf-merge": ["merge pdf online", "combine pdf files", "merge pdf free", "join pdf documents"],
  "pdf-split": ["split pdf online", "separate pdf pages", "extract pages from pdf", "split pdf by page"],
  "svg-formatter": ["svg formatter online", "format svg code", "beautify svg", "pretty print svg", "indent svg"],
  "svg-to-png": ["svg to png converter", "convert svg to png online", "svg to png free", "rasterize svg"],
};

export function toolKeywords(tool: ToolConfig): string[] {
  const words = tool.name.toLowerCase().split(/\s+/).filter(Boolean);
  const fromName = words.map((w) => `${w} tool`);
  const categoryKw = CATEGORY_KEYWORDS[tool.category] ?? [];
  return [
    ...(TOOL_KEYWORDS[tool.slug] ?? []),
    ...fromName,
    ...categoryKw,
    ...GENERIC_KEYWORDS,
  ];
}

export function toolTitle(tool: ToolConfig): string {
  return `${tool.name} online — free ${tool.category.toLowerCase()} tool`;
}

export function buildToolMetadata(tool: ToolConfig): Metadata {
  const url = `${SITE_URL}/tools/${tool.slug}`;
  return {
    title: toolTitle(tool),
    description: `${tool.description} 100% free, runs entirely in your browser — nothing is uploaded.`,
    keywords: toolKeywords(tool),
    alternates: {
      canonical: `/tools/${tool.slug}`,
    },
    openGraph: {
      title: toolTitle(tool),
      description: tool.description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title: toolTitle(tool),
      description: tool.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export function toolJsonLd(tool: ToolConfig) {
  const url = `${SITE_URL}/tools/${tool.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: tool.name,
        url,
        description: tool.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript. Works in all modern browsers.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        featureList: `Format, convert, generate and ${tool.category.toLowerCase()} — all in your browser`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Tools",
            item: `${SITE_URL}/#tools`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: tool.name,
            item: url,
          },
        ],
      },
    ],
  };
}

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "CollectionPage",
        name: `${SITE_NAME} — Free online developer tools`,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
    ],
  };
}