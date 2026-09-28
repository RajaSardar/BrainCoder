/**
 * A string-based allowlist sanitizer for the Markdown → HTML pipeline.
 *
 * Why not DOMParser: the sanitizer has to produce the exact same bytes in the
 * browser, on the server and in a plain Node harness, and it must not depend on
 * a DOM. So the output is *rebuilt from tokens* rather than scrubbed in place:
 * anything that is not recognised as an allowlisted tag or as text is dropped,
 * and every attribute is re-serialized from a strict parse. A `<` that does not
 * open a well-formed tag is escaped to `&lt;`, so malformed markup can never be
 * smuggled through as live markup when the copied output is pasted elsewhere.
 */

const ALLOWED_TAGS = new Set([
  "A",
  "ABBR",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CITE",
  "CODE",
  "DD",
  "DEL",
  "DIV",
  "DL",
  "DT",
  "EM",
  "FIGCAPTION",
  "FIGURE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "I",
  "IMG",
  "INPUT",
  "KBD",
  "LI",
  "MARK",
  "OL",
  "P",
  "PRE",
  "S",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL",
  "VAR",
]);

const VOID_TAGS = new Set(["BR", "HR", "IMG", "INPUT"]);

/** Attribute allowlist. `class` is kept so language and token classes survive. */
const ALLOWED_ATTRS = new Set([
  "alt",
  "checked",
  "class",
  "colspan",
  "disabled",
  "height",
  "href",
  "rowspan",
  "src",
  "start",
  "title",
  "type",
  "width",
]);

/**
 * Tags removed together with their contents. Their children are raw text or
 * foreign content that can execute or fetch, so keeping the text would leak
 * script source into the output and an unterminated tag would swallow the rest
 * of the document.
 */
const DROP_WITH_CONTENT = new Set([
  "APPLET",
  "AUDIO",
  "CANVAS",
  "EMBED",
  "FRAME",
  "FRAMESET",
  "IFRAME",
  "MATH",
  "MARQUEE",
  "NOSCRIPT",
  "OBJECT",
  "PLAINTEXT",
  "SCRIPT",
  "STYLE",
  "SVG",
  "TEMPLATE",
  "TITLE",
  "VIDEO",
  "XMP",
]);

/** Raster inline images only. `data:image/svg+xml` can carry script. */
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)[;,]/;

const CDATA_RE = /<!\[CDATA\[[\s\S]*?\]\]>/y;
const COMMENT_RE = /<!--[\s\S]*?-->/y;
/** Doctype, processing instruction and other bogus markup: never kept. */
const BOGUS_RE = /<[!?][^>]*>?/y;
const TAG_RE =
  /<(\/?)([A-Za-z][A-Za-z0-9:._-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
const ATTR_RE =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]*)))?/g;
const CLOSE_CACHE = new Map<string, RegExp>();

function closeRe(tag: string): RegExp {
  let re = CLOSE_CACHE.get(tag);
  if (!re) {
    re = new RegExp(`</${tag}\\s*>`, "i");
    CLOSE_CACHE.set(tag, re);
  }
  re.lastIndex = 0;
  return re;
}

function charCode(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return "";
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}

/**
 * Decode the entity forms a browser would resolve inside a URL attribute, so
 * `java&#115;cript:` and `jav&Tab;ascript:` are judged on what they really are.
 */
function normalizeUrl(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex: string) => charCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => charCode(parseInt(dec, 10)))
    .replace(/&colon;?/gi, ":")
    .replace(/&(?:tab|newline);?/gi, "")
    .replace(/[\u0000-\u0020\u007f]/g, "")
    .toLowerCase();
}

/** True for relative URLs, `http(s)`, `mailto`, `tel` and inline raster images. */
export function isSafeUrl(value: string, allowDataImage: boolean): boolean {
  const url = normalizeUrl(value);
  if (!url) return true;
  if (url.startsWith("#")) return true;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  if (url.startsWith("mailto:") || url.startsWith("tel:")) return true;
  if (allowDataImage && SAFE_DATA_IMAGE.test(url)) return true;
  // A colon that appears after the first `/`, `?` or `#` is part of a path
  // segment, not a scheme: `docs/a:b` is relative, `data:x` is not.
  const colon = url.indexOf(":");
  if (colon === -1) return true;
  const delim = url.search(/[/?#]/);
  return delim !== -1 && colon > delim;
}

/** The only escaping the re-serializer needs: a re-quoted value cannot hold `"`. */
function escapeAttr(value: string): string {
  return value.replace(/</g, "&lt;");
}

function sanitizeAttrs(raw: string): string {
  let out = "";
  const seen = new Set<string>();
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    if (name.startsWith("on")) continue;
    if (!ALLOWED_ATTRS.has(name)) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name === "href" && !isSafeUrl(value, false)) continue;
    if (name === "src" && !isSafeUrl(value, true)) continue;
    out += ` ${name}="${escapeAttr(value)}"`;
  }
  return out;
}

/** Sticky regexes are matched at an exact offset in the real input. */
function matchAt(re: RegExp, input: string, index: number): RegExpExecArray | null {
  re.lastIndex = index;
  return re.exec(input);
}

export function sanitizeHtml(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += escapeAttr(html.slice(i));
      break;
    }
    if (lt > i) out += escapeAttr(html.slice(i, lt));

    const comment = matchAt(COMMENT_RE, html, lt);
    if (comment) {
      i = comment.index + comment[0].length;
      continue;
    }
    const cdata = matchAt(CDATA_RE, html, lt);
    if (cdata) {
      i = cdata.index + cdata[0].length;
      continue;
    }
    const tag = matchAt(TAG_RE, html, lt);
    if (!tag) {
      const bogus = matchAt(BOGUS_RE, html, lt);
      if (bogus) {
        i = bogus.index + bogus[0].length;
        continue;
      }
      // Not a well-formed tag: keep it visible as text, never as markup.
      out += "&lt;";
      i = lt + 1;
      continue;
    }

    const written = tag[2];
    const name = written.toUpperCase();
    const closing = tag[1] === "/";
    i = tag.index + tag[0].length;

    if (closing) {
      if (ALLOWED_TAGS.has(name) && !VOID_TAGS.has(name)) out += `</${written}>`;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      const close = closeRe(name).exec(html.slice(i));
      // No closing tag: swallow the remainder rather than leak raw text.
      i = close ? i + close.index + close[0].length : html.length;
      continue;
    }
    if (ALLOWED_TAGS.has(name)) {
      out += `<${written}${sanitizeAttrs(tag[3])}>`;
    }
    // Anything else is unwrapped: the tag disappears, its children stay.
  }
  // A paragraph whose entire content was stripped is noise, not output.
  return out.replace(/<p>\s*<\/p>/gi, "");
}
