import { Marked, type Tokens } from "marked";
import {
  HIGHLIGHT_LANGUAGES,
  escapeDisplay,
  highlightCode,
  highlightHtmlSource,
  isHighlightable,
} from "./highlight";
import { sanitizeHtml } from "./sanitize";

export { HIGHLIGHT_LANGUAGES, isHighlightable };

/** Input cap. Above this the textarea stops accepting characters. */
export const MAX_INPUT_CHARS = 200_000;

/**
 * The output pane is colored with token spans. Past this size the colorization
 * is skipped (the same text is shown, uncolored) so a very large paste cannot
 * stall the render.
 */
export const MAX_PANE_HIGHLIGHT_CHARS = 150_000;

export const DEFAULT_DOWNLOAD_STEM = "markdown";

/** Only these characters may appear in a `language-*` class from a fence. */
const LANG_RE = /^[a-z0-9+#-]{1,24}$/;

/** Plain-text fence labels: escaped but deliberately not tokenized. */
const PLAIN_LANGS = new Set(["", "text", "plain", "txt", "none"]);

function codeRenderer(highlight: boolean) {
  return {
    code({ text, lang }: Tokens.Code): string {
      const language = (lang ?? "").trim().split(/\s+/)[0].toLowerCase();
      const tokenize = highlight && !PLAIN_LANGS.has(language) && isHighlightable(language);
      const body = tokenize ? highlightCode(text, language) : escapeDisplay(text);
      const cls = LANG_RE.test(language) ? ` class="language-${language}"` : "";
      return `<pre><code${cls}>${body}</code></pre>\n`;
    },
  };
}

let parsers: { plain: Marked; highlighted: Marked } | null = null;

/** One reusable instance per mode; the parser itself is stateless. */
function parserFor(highlight: boolean): Marked {
  if (!parsers) {
    const build = (highlightBlocks: boolean) => {
      const instance = new Marked({ gfm: true, breaks: false, pedantic: false });
      instance.use({ renderer: codeRenderer(highlightBlocks) });
      return instance;
    };
    parsers = { plain: build(false), highlighted: build(true) };
  }
  return highlight ? parsers.highlighted : parsers.plain;
}

export interface ConvertResult {
  /** Sanitized HTML fragment. Empty when `error` is set. */
  html: string;
  error: string | null;
}

const PARSE_ERROR =
  "That Markdown could not be converted. Look for an unclosed fenced code block or extremely deep nesting, and try again.";

/**
 * Markdown → sanitized HTML. Raw inline HTML in the source is rendered as HTML
 * (marked passes it through), then stripped down to the allowlist by
 * `sanitizeHtml` — so the fragment, the preview and the download are the same
 * string, and none of them can carry script.
 */
export function convertMarkdown(
  md: string,
  options: { highlightCode?: boolean } = {},
): ConvertResult {
  try {
    const parsed = parserFor(options.highlightCode === true).parse(md, {
      async: false,
    });
    if (typeof parsed !== "string") return { html: "", error: PARSE_ERROR };
    return { html: sanitizeHtml(parsed), error: null };
  } catch {
    return { html: "", error: PARSE_ERROR };
  }
}

/** Escaped, token-colored HTML for the read-only output pane. */
export function paneHtml(html: string): string {
  if (!html) return "";
  if (html.length > MAX_PANE_HIGHLIGHT_CHARS) return escapeDisplay(html);
  return highlightHtmlSource(html);
}

const UNSAFE_NAME = /[\\/:*?"<>|\u0000-\u001f]/g;

/** `<src>.html`: a paste tool has no file, so the stem is disclosed/editable. */
export function downloadFileName(stem: string): string {
  const base = stem
    .replace(/\.(md|markdown|mdown|txt|html?|text)$/i, "")
    .replace(UNSAFE_NAME, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 60);
  return `${base || DEFAULT_DOWNLOAD_STEM}.html`;
}

const DOC_CSS = `  body{max-width:44rem;margin:2.5rem auto;padding:0 1.25rem;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;background:#fff}
  pre{background:#f1f5f9;padding:1rem;border-radius:8px;overflow:auto}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
  :not(pre)>code{background:#f1f5f9;padding:.1em .35em;border-radius:4px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #e2e8f0;padding:.5rem .75rem;text-align:left}
  blockquote{border-left:4px solid #cbd5e1;margin:0 0 1rem;padding-left:1rem;color:#475569}
  img{max-width:100%;height:auto}
  a{color:#0369a1}`;

const TOKEN_CSS = `  .tok-comment{color:#64748b}
  .tok-string{color:#b45309}
  .tok-number{color:#6d28d9}
  .tok-keyword{color:#be123c}
  .tok-literal{color:#0f766e}
  .tok-tag{color:#1d4ed8}
  .tok-attr{color:#a16207}
  .tok-property{color:#0f766e}
  .tok-heading{color:#1d4ed8;font-weight:700}
  .tok-link{color:#0f766e}
  .tok-emphasis{color:#be123c;font-style:italic}`;

function escapeTitle(title: string): string {
  return title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The downloaded file is a standalone document — a minimal wrapper (doctype,
 * charset, viewport, one inline stylesheet, no scripts) around exactly the
 * fragment that Copy and Preview show.
 */
export function wrapDocument(
  body: string,
  title: string,
  options: { highlightCode?: boolean } = {},
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeTitle(title)}</title>
<style>
${DOC_CSS}
${options.highlightCode === true ? `${TOKEN_CSS}\n` : ""}</style>
</head>
<body>
${body}</body>
</html>
`;
}

export interface ConvertStats {
  inputChars: number;
  words: number;
  outputChars: number;
  outputBytes: number;
  blocks: number;
}

/** Counters shown above the panes. Cheap, derived, never a source of truth. */
export function convertStats(md: string, html: string): ConvertStats {
  const text = md.trim();
  return {
    inputChars: md.length,
    words: text ? text.split(/\s+/).length : 0,
    outputChars: html.length,
    outputBytes: new TextEncoder().encode(html).length,
    blocks: html ? (html.match(/<h[1-6][\s>]/g) ?? []).length : 0,
  };
}
