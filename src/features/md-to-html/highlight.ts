/**
 * A deliberately small, regex-based token highlighter. It is NOT a parser and
 * makes no claim of being one: it wraps interesting runs of characters in
 * `<span class="tok tok-*">` so the generated HTML (and the code inside a
 * fenced block) is readable. Everything is escaped for display, so the result
 * can be dropped into a `<pre>` with `dangerouslySetInnerHTML`.
 *
 * Only `<` and `>` are escaped. Entities that already exist in the source
 * string (`&amp;`, `&#39;`, …) are left alone, so the pane shows the file
 * content exactly as it is written.
 */
export function escapeDisplay(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Languages with a dedicated rule set. Anything else is escaped, untokenized. */
export const HIGHLIGHT_LANGUAGES = [
  "javascript",
  "typescript",
  "json",
  "html",
  "css",
  "python",
  "shell",
  "sql",
  "yaml",
  "markdown",
] as const;

interface TokenRule {
  cls: string;
  /** Every rule regex carries the global flag: `scan` drives it with lastIndex. */
  re: RegExp;
}

const NUMBER_RE =
  /\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)\b/g;
const DQ_STRING = /"(?:\\[\s\S]|[^"\\])*"?/g;
const SQ_STRING = /'(?:\\[\s\S]|[^'\\])*'?/g;
const BT_STRING = /`(?:\\[\s\S]|[^`\\])*`?/g;
const C_LINE_COMMENT = /\/\/[^\n]*/g;
const C_BLOCK_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/g;
const HASH_COMMENT = /#[^\n]*/g;
const DASH_COMMENT = /--[^\n]*/g;

function words(list: string): RegExp {
  return new RegExp(`\\b(?:${list})\\b`, "g");
}

function wordsCi(list: string): RegExp {
  return new RegExp(`\\b(?:${list})\\b`, "gi");
}

const JS_KEYWORDS =
  "const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|typeof|instanceof|in|of|try|catch|finally|throw|async|await|yield|import|export|from|as|default|delete|void|interface|type|enum|implements|public|private|readonly";
const JS_LITERALS = "true|false|null|undefined|NaN|Infinity";
const PY_KEYWORDS =
  "def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|with|try|except|finally|raise|lambda|pass|break|continue|global|nonlocal|yield|assert|del|async|await";
const SH_KEYWORDS =
  "if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|local|source|echo|cd|set|unset|trap|shift|exit|read";
const SQL_KEYWORDS =
  "select|from|where|insert|into|values|update|set|delete|create|table|alter|drop|join|left|right|inner|outer|cross|on|as|and|or|not|null|order|by|group|having|limit|offset|distinct|union|all|primary|key|foreign|references|default|check|unique|index|view|with|returning|exists|between|like|is";

const HTML_LANG_RULES: TokenRule[] = [
  { cls: "tok-comment", re: /<!--[\s\S]*?(?:-->|$)/g },
  { cls: "tok-tag", re: /<\/?[A-Za-z][\w:.-]*/g },
  { cls: "tok-attr", re: /[A-Za-z_:][\w.:-]*(?=\s*=)/g },
  { cls: "tok-string", re: /"(?:[^"]*)"|'(?:[^']*)'/g },
];

const RULES: Record<string, TokenRule[]> = {
  javascript: [
    { cls: "tok-comment", re: C_BLOCK_COMMENT },
    { cls: "tok-comment", re: C_LINE_COMMENT },
    { cls: "tok-string", re: BT_STRING },
    { cls: "tok-string", re: DQ_STRING },
    { cls: "tok-string", re: SQ_STRING },
    { cls: "tok-literal", re: words(JS_LITERALS) },
    { cls: "tok-keyword", re: words(JS_KEYWORDS) },
    { cls: "tok-number", re: NUMBER_RE },
  ],
  json: [
    { cls: "tok-attr", re: /"(?:\\[\s\S]|[^"\\])*"(?=\s*:)/g },
    { cls: "tok-string", re: DQ_STRING },
    { cls: "tok-literal", re: words("true|false|null") },
    { cls: "tok-number", re: NUMBER_RE },
  ],
  css: [
    { cls: "tok-comment", re: C_BLOCK_COMMENT },
    { cls: "tok-string", re: DQ_STRING },
    { cls: "tok-string", re: SQ_STRING },
    { cls: "tok-keyword", re: /@[A-Za-z-]+/g },
    { cls: "tok-property", re: /[-A-Za-z][-\w]*(?=\s*:)/g },
    {
      cls: "tok-number",
      re: /-?\b\d*\.?\d+(?:px|rem|em|%|vh|vw|vmin|vmax|ch|s|ms|fr|deg|turn)?\b/g,
    },
  ],
  python: [
    { cls: "tok-comment", re: HASH_COMMENT },
    { cls: "tok-string", re: /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)/g },
    { cls: "tok-string", re: DQ_STRING },
    { cls: "tok-string", re: SQ_STRING },
    { cls: "tok-keyword", re: /@[A-Za-z_][\w.]*/g },
    { cls: "tok-literal", re: words("True|False|None") },
    { cls: "tok-keyword", re: words(PY_KEYWORDS) },
    { cls: "tok-number", re: NUMBER_RE },
  ],
  shell: [
    { cls: "tok-comment", re: HASH_COMMENT },
    { cls: "tok-string", re: DQ_STRING },
    { cls: "tok-string", re: SQ_STRING },
    { cls: "tok-literal", re: words("true|false") },
    { cls: "tok-keyword", re: words(SH_KEYWORDS) },
    { cls: "tok-number", re: NUMBER_RE },
  ],
  sql: [
    { cls: "tok-comment", re: DASH_COMMENT },
    { cls: "tok-string", re: /'(?:''|[^'])*'?/g },
    { cls: "tok-literal", re: words("true|false|null") },
    { cls: "tok-keyword", re: wordsCi(SQL_KEYWORDS) },
    { cls: "tok-number", re: NUMBER_RE },
  ],
  yaml: [
    { cls: "tok-comment", re: HASH_COMMENT },
    { cls: "tok-string", re: DQ_STRING },
    { cls: "tok-string", re: SQ_STRING },
    { cls: "tok-attr", re: /[A-Za-z_][\w.-]*(?=\s*:)/g },
    { cls: "tok-literal", re: words("true|false|null|yes|no|on|off") },
    { cls: "tok-number", re: NUMBER_RE },
  ],
  markdown: [
    { cls: "tok-comment", re: /```[\s\S]*?(?:```|$)|`[^`\n]*`?/g },
    { cls: "tok-heading", re: /^[ \t]{0,3}#{1,6}[^\n]*/gm },
    { cls: "tok-link", re: /!?\[[^\]\n]*\]\([^)\n]*\)|<https?:\/\/[^>\n]*>/g },
    { cls: "tok-emphasis", re: /\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_/g },
    { cls: "tok-keyword", re: /^[ \t]*(?:[-*+]|\d+\.)(?=\s)/gm },
  ],
};

// TypeScript reuses the JavaScript rules (the keyword list carries the type
// keywords); both names are advertised, so both must actually tokenize.
RULES.typescript = RULES.javascript;
RULES.html = HTML_LANG_RULES;

const ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  node: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json5: "json",
  jsonc: "json",
  htm: "html",
  xml: "html",
  svg: "html",
  vue: "html",
  scss: "css",
  less: "css",
  py: "python",
  python3: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  console: "shell",
  shellscript: "shell",
  yml: "yaml",
  md: "markdown",
  mdown: "markdown",
};

/** Resolve a fence info string to a rule-set name, or null when unsupported. */
export function ruleSetFor(language: string): string | null {
  const key = ALIASES[language.toLowerCase()] ?? language.toLowerCase();
  return key in RULES ? key : null;
}

/** True when the language has a real token rule set (not an escaped passthrough). */
export function isHighlightable(language: string): boolean {
  return ruleSetFor(language) !== null;
}

function scan(src: string, rules: TokenRule[]): string {
  let out = "";
  let plain = "";
  let i = 0;
  while (i < src.length) {
    let best: { cls: string; index: number; len: number } | null = null;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(src);
      if (!m || m[0].length === 0) continue;
      if (best === null || m.index < best.index) {
        best = { cls: rule.cls, index: m.index, len: m[0].length };
      }
    }
    if (best === null) {
      plain += src.slice(i);
      break;
    }
    if (best.index > i) plain += src.slice(i, best.index);
    out += escapeDisplay(plain);
    plain = "";
    out += `<span class="tok ${best.cls}">${escapeDisplay(
      src.slice(best.index, best.index + best.len),
    )}</span>`;
    i = best.index + best.len;
  }
  out += escapeDisplay(plain);
  return out;
}

/** Escape a code string, adding token spans when the language is supported. */
export function highlightCode(code: string, language: string): string {
  const key = ruleSetFor(language);
  if (key === null) return escapeDisplay(code);
  return scan(code, RULES[key]);
}

const HTML_RULES: TokenRule[] = [
  { cls: "tok-comment", re: /<!--[\s\S]*?(?:-->|$)/g },
  { cls: "tok-tag", re: /<\/?[A-Za-z][\w:.-]*/g },
  { cls: "tok-attr", re: /[A-Za-z_:][\w.:-]*(?=\s*=)/g },
  { cls: "tok-string", re: /"(?:[^"]*)"|'(?:[^']*)'/g },
  { cls: "tok-literal", re: /&(?:#\d+|#x[0-9A-Fa-f]+|[A-Za-z]+);/g },
  { cls: "tok-tag", re: /<\/?|\/?>/g },
];

/** Escape an HTML string for the read-only output pane, adding token spans. */
export function highlightHtmlSource(html: string): string {
  return scan(html, HTML_RULES);
}
