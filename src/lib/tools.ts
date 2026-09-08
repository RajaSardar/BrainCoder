import type { LucideIcon } from "lucide-react";
import {
  FileText,
  ImageIcon,
  Braces,
  Link2,
  Binary,
  StickyNote,
  KeyRound,
  GitCompareArrows,
  Scaling,
  TerminalSquare,
  Timer,
  Fingerprint,
  FileCode2,
  Minimize2,
  CaseSensitive,
  Hash,
  AlignLeft,
  SlidersHorizontal,
  MousePointerClick,
  FileType2,
} from "lucide-react";

export type Category =
  | "Compress"
  | "Convert"
  | "Encode & Decode"
  | "Developer"
  | "Text Tools"
  | "Generate";

export interface ToolConfig {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  icon: LucideIcon;
  accent: string;
  gradient: string;
}

export const CATEGORIES: Category[] = [
  "Compress",
  "Convert",
  "Encode & Decode",
  "Developer",
  "Generate",
  "Text Tools",
];

export const TOOLS: ToolConfig[] = [
  {
    slug: "pdf-compressor",
    name: "PDF Compressor",
    tagline: "Shrink PDFs right in your browser",
    description:
      "Reduce PDF file size by recompressing embedded images. Files never leave your device.",
    category: "Compress",
    icon: FileText,
    accent: "text-indigo-600",
    gradient: "from-indigo-500 to-purple-600",
  },
  {
    slug: "image-compressor",
    name: "Image Compressor",
    tagline: "JPG, PNG, WebP & AVIF compression",
    description:
      "Compress images with smart format selection, optional resizing, and never a bigger file.",
    category: "Compress",
    icon: ImageIcon,
    accent: "text-rose-600",
    gradient: "from-rose-500 to-pink-600",
  },
  {
    slug: "image-resizer",
    name: "Image Resizer",
    tagline: "Resize images pixel-perfect",
    description:
      "Change image dimensions with aspect-ratio lock and preview, then download the result.",
    category: "Convert",
    icon: Scaling,
    accent: "text-emerald-600",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    slug: "json-formatter",
    name: "JSON Formatter",
    tagline: "Format, validate & minify JSON",
    description:
      "Pretty-print, validate and minify JSON with instant feedback and clear error messages.",
    category: "Developer",
    icon: Braces,
    accent: "text-amber-600",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    slug: "url-encoder",
    name: "URL Encoder & Decoder",
    tagline: "Encode or decode URL components",
    description:
      "Percent-encode and decode URLs and query strings with live character-by-character transforms.",
    category: "Encode & Decode",
    icon: Link2,
    accent: "text-blue-600",
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    slug: "base64",
    name: "Base64 Encoder & Decoder",
    tagline: "Encode text to Base64 and back",
    description:
      "Convert text, JSON and binary data to Base64 and decode it back, Unicode-safe.",
    category: "Encode & Decode",
    icon: Binary,
    accent: "text-violet-600",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    slug: "notepad",
    name: "Notepad",
    tagline: "Private auto-saving text notepad",
    description:
      "Write notes that auto-save locally in your browser. Open and export as .txt files.",
    category: "Text Tools",
    icon: StickyNote,
    accent: "text-yellow-600",
    gradient: "from-yellow-500 to-amber-600",
  },
  {
    slug: "password-generator",
    name: "Password Generator",
    tagline: "Strong random passwords instantly",
    description:
      "Generate cryptographically strong passwords with length and character-type controls.",
    category: "Generate",
    icon: KeyRound,
    accent: "text-green-600",
    gradient: "from-green-500 to-emerald-600",
  },
  {
    slug: "diff-checker",
    name: "Diff Checker",
    tagline: "Compare two texts line by line",
    description:
      "Spot added and removed lines between two blocks of text with a clear side-by-side view.",
    category: "Text Tools",
    icon: GitCompareArrows,
    accent: "text-cyan-600",
    gradient: "from-cyan-500 to-sky-600",
  },
  {
    slug: "regex-tester",
    name: "Regex Tester",
    tagline: "Test regular expressions live",
    description:
      "Write a regex, see matches highlighted in your text, and test flags and capture groups.",
    category: "Developer",
    icon: TerminalSquare,
    accent: "text-fuchsia-600",
    gradient: "from-fuchsia-500 to-pink-600",
  },
  {
    slug: "timestamp-converter",
    name: "Timestamp Converter",
    tagline: "Unix time to human date and back",
    description:
      "Convert Unix timestamps to human-readable dates in your local timezone, and the reverse.",
    category: "Convert",
    icon: Timer,
    accent: "text-orange-600",
    gradient: "from-orange-500 to-red-600",
  },
  {
    slug: "hash-generator",
    name: "Hash Generator",
    tagline: "SHA-256, SHA-1 and more",
    description:
      "Generate cryptographic hashes of text in SHA-1, SHA-256, SHA-384 and SHA-512.",
    category: "Encode & Decode",
    icon: Fingerprint,
    accent: "text-teal-600",
    gradient: "from-teal-500 to-emerald-600",
  },
  {
    slug: "markdown-preview",
    name: "Markdown Preview",
    tagline: "Live Markdown editing & preview",
    description:
      "Write Markdown on the left, see rendered HTML on the right. Copy the output as HTML.",
    category: "Developer",
    icon: FileCode2,
    accent: "text-sky-600",
    gradient: "from-sky-500 to-indigo-600",
  },
  {
    slug: "html-minifier",
    name: "HTML Minifier",
    tagline: "Minify and pretty-print HTML",
    description:
      "Strip comments and whitespace from HTML or reformat messy markup into indented structure.",
    category: "Developer",
    icon: Minimize2,
    accent: "text-red-600",
    gradient: "from-red-500 to-orange-600",
  },
  {
    slug: "case-converter",
    name: "Case Converter",
    tagline: "camelCase, snake_case, kebab-case…",
    description:
      "Convert text between common casing styles with live preview and one-click copy.",
    category: "Convert",
    icon: CaseSensitive,
    accent: "text-lime-600",
    gradient: "from-lime-500 to-green-600",
  },
  {
    slug: "uuid-generator",
    name: "UUID Generator",
    tagline: "Generate UUIDs in bulk",
    description:
      "Create version-4 UUIDs, with options for uppercase and hyphen-free variants.",
    category: "Generate",
    icon: Hash,
    accent: "text-blue-600",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    slug: "word-counter",
    name: "Word Counter",
    tagline: "Count words, chars, lines & reading time",
    description:
      "Live statistics for any text: words, characters, sentences, paragraphs and reading time.",
    category: "Text Tools",
    icon: AlignLeft,
    accent: "text-indigo-600",
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    slug: "lorem-ipsum",
    name: "Lorem Ipsum Generator",
    tagline: "Placeholder text for your designs",
    description:
      "Generate lorem ipsum paragraphs, sentences and words for layouts and mockups.",
    category: "Generate",
    icon: FileType2,
    accent: "text-pink-600",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    slug: "color-converter",
    name: "Color Converter",
    tagline: "HEX, RGB, HSL & CSS colors",
    description:
      "Convert colors between HEX, RGB and HSL with a live color preview.",
    category: "Convert",
    icon: SlidersHorizontal,
    accent: "text-purple-600",
    gradient: "from-purple-500 to-fuchsia-600",
  },
  {
    slug: "css-cursor",
    name: "CSS Cursor Generator",
    tagline: "Preview the cursor property",
    description:
      "Preview every CSS cursor value on an interactive target and copy the exact CSS snippet.",
    category: "Developer",
    icon: MousePointerClick,
    accent: "text-gray-600",
    gradient: "from-gray-500 to-slate-600",
  },
];

export function getTool(slug: string): ToolConfig | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getToolsByCategory(category: Category): ToolConfig[] {
  return TOOLS.filter((t) => t.category === category);
}