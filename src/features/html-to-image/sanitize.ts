/**
 * A string-based allowlist sanitizer for the HTML that gets rendered into the
 * capture preview.
 *
 * Why not DOMParser: the sanitizer has to produce the exact same bytes in the
 * browser and in a plain Node harness, and it must not depend on a DOM. So the
 * output is *rebuilt from tokens* rather than scrubbed in place: anything that
 * is not recognised as an allowlisted tag, a `<style>` block or text is
 * dropped, and every attribute is re-serialized from a strict parse.
 *
 * This matters more here than in a text converter. The preview is live markup
 * in this page's own origin, so an `<img onerror>` or a `javascript:` href that
 * survived would run here. `<style>` is deliberately allowlisted — a screenshot
 * tool that dropped the CSS block would be useless — and the UI discloses that a
 * style block in your HTML is applied to this page, so scope your selectors.
 */

/** Presentational and structural tags a screenshot might legitimately contain. */
const ALLOWED_TAGS = new Set([
  "A", "ABBR", "ADDRESS", "ARTICLE", "ASIDE", "B", "BDI", "BDO", "BIG", "BLOCKQUOTE", "BR",
  "CAPTION", "CENTER", "CITE", "CODE", "COL", "COLGROUP", "DD", "DEL", "DETAILS", "DFN", "DIV",
  "DL", "DT", "EM", "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6",
  "HEADER", "HGROUP", "HR", "I", "IMG", "INS", "KBD", "LI", "MAIN", "MARK", "NAV", "OL", "P",
  "PRE", "Q", "RP", "RT", "RUBY", "S", "SAMP", "SECTION", "SMALL", "SPAN", "STRIKE", "STRONG",
  "STYLE", "SUB", "SUMMARY", "SUP", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TIME", "TR",
  "TT", "U", "UL", "VAR", "WBR",
]);

const VOID_TAGS = new Set(["BR", "COL", "HR", "IMG", "WBR"]);

/**
 * Dropped together with their contents: their children are script source or
 * foreign content that can execute. `style` is the deliberate exception and is
 * in ALLOWED_TAGS instead.
 */
const DROP_WITH_CONTENT = new Set([
  "APPLET", "AUDIO", "BUTTON", "CANVAS", "FRAMESET", "IFRAME", "MARQUEE", "MATH", "NOSCRIPT",
  "OBJECT", "PLAINTEXT", "SCRIPT", "SELECT", "SVG", "TEMPLATE", "TEXTAREA", "TITLE", "VIDEO",
  "XMP",
]);

/**
 * Void elements that must be skipped as a single tag. Searching for a closing
 * `</link>` here would swallow the whole rest of the document, which is the
 * classic way a "remove the tag" pass destroys a page.
 */
const DROP_VOID = new Set([
  "BASE", "EMBED", "FRAME", "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK",
]);

const ALLOWED_ATTRS = new Set([
  "align", "alt", "bgcolor", "border", "cellpadding", "cellspacing", "cite", "class", "color",
  "colspan", "datetime", "dir", "face", "height", "href", "lang", "rel", "reversed", "role",
  "rowspan", "size", "span", "src", "start", "style", "target", "title", "type", "valign", "width",
]);

/** Inert attribute namespaces a stylesheet may hook into; both are prefix-matched. */
const ALLOWED_PREFIXES = ["data-", "aria-"];

/** Raster inline images only: `data:image/svg+xml` and `data:text/html` can carry script. */
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)[;,]/;

const CDATA_RE = /<!\[CDATA\[[\s\S]*?\]\]>/y;
const COMMENT_RE = /<!--[\s\S]*?-->/y;
/** Doctype, processing instruction and other bogus markup: never kept. */
const BOGUS_RE = /<[!?][^>]*>?/y;
const TAG_RE = /<(\/?)([A-Za-z][A-Za-z0-9:._-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]*)))?/g;
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
 * Decode the entity forms a browser resolves inside a URL attribute, so
 * `java&#115;cript:` and `jav&Tab;ascript:` are judged on what they really are.
 */
function normalizeUrl(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex: string) => charCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => charCode(parseInt(dec, 10)))
    .replace(/&colon;?/gi, ":")
    .replace(/&(?:tab|newline);?/gi, "")
    .replace(/[\x00-\x20\x7f]/g, "")
    .toLowerCase();
}

/** True for relative URLs, `http(s)`, `mailto`, `tel`, fragments and — for `src` — raster data URIs. */
export function isSafeUrl(value: string, allowDataImage: boolean): boolean {
  const url = normalizeUrl(value);
  if (!url) return true;
  if (url.startsWith("#")) return true;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  if (url.startsWith("mailto:") || url.startsWith("tel:")) return true;
  if (allowDataImage && SAFE_DATA_IMAGE.test(url)) return true;
  // A colon after the first `/`, `?` or `#` is part of a path segment, not a scheme.
  const colon = url.indexOf(":");
  if (colon === -1) return true;
  const delim = url.search(/[/?#]/);
  return delim !== -1 && colon > delim;
}

/** The only escaping the re-serializer needs: a re-quoted value cannot hold `"`. */
function escapeAttr(value: string): string {
  return value.replace(/</g, "&lt;");
}

/** Attributes whose value is a URL, and whether a raster data URI is acceptable. */
const URL_ATTRS: Record<string, boolean> = { href: false, src: true, cite: false, action: false, formaction: false, poster: false, background: false, data: true, srcset: false, longdesc: false };

/**
 * A kept `style` attribute and a kept `<style>` block are the one place a
 * `javascript:` string can survive into the page, so the handful of CSS
 * constructs that browsers once executed are stripped. The rest of the CSS is
 * left exactly as written, because a re-typed declaration would change the
 * image the user asked for.
 */
function scrubStyleText(value: string): string {
  return value
    .replace(/@import[^;]*;?/gi, "")
    .replace(/[^;{}]*?(?:javascript\s*:|vbscript\s*:|expression\s*\(|-moz-binding|behaviou?r\s*:)[^;{}]*/gi, "");
}

function sanitizeAttrs(raw: string, report: SanitizeReport): string {
  let out = "";
  const seen = new Set<string>();
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    if (name.startsWith("on")) {
      report.removedAttributes += 1;
      report.eventHandlers += 1;
      continue;
    }
    // `id` is never kept: it could collide with the page's own ids and hijack a
    // label's `for` target or a `:target` rule. The trade-off is disclosed.
    if (!ALLOWED_ATTRS.has(name) && !ALLOWED_PREFIXES.some((p) => name.startsWith(p))) {
      report.removedAttributes += 1;
      continue;
    }
    let value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name in URL_ATTRS && !isSafeUrl(value, URL_ATTRS[name])) {
      report.removedAttributes += 1;
      report.unsafeUrls += 1;
      continue;
    }
    if (name === "style") {
      const scrubbed = scrubStyleText(value);
      if (scrubbed !== value) {
        report.removedAttributes += 1;
        report.unsafeUrls += 1;
        if (!scrubbed.trim()) continue;
        value = scrubbed;
      }
    }
    out += ` ${name}="${escapeAttr(value)}"`;
  }
  return out;
}

/** Sticky regexes are matched at an exact offset in the real input. */
function matchAt(re: RegExp, input: string, index: number): RegExpExecArray | null {
  re.lastIndex = index;
  return re.exec(input);
}

export interface SanitizeReport {
  html: string;
  removedTags: string[];
  removedAttributes: number;
  eventHandlers: number;
  unsafeUrls: number;
  styleBlocks: number;
}

/**
 * Rebuild `input` from an allowlist. The returned `html` is what the preview
 * renders *and* what the capture paints, so the two can never disagree.
 */
export function sanitizeCaptureHtml(input: string): SanitizeReport {
  const report: SanitizeReport = {
    html: "",
    removedTags: [],
    removedAttributes: 0,
    eventHandlers: 0,
    unsafeUrls: 0,
    styleBlocks: 0,
  };
  const note = (tag: string) => {
    if (!report.removedTags.includes(tag)) report.removedTags.push(tag);
  };
  let out = "";
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      out += escapeAttr(input.slice(i));
      break;
    }
    if (lt > i) out += escapeAttr(input.slice(i, lt));

    const comment = matchAt(COMMENT_RE, input, lt);
    if (comment) {
      i = comment.index + comment[0].length;
      continue;
    }
    const cdata = matchAt(CDATA_RE, input, lt);
    if (cdata) {
      i = cdata.index + cdata[0].length;
      continue;
    }
    const tag = matchAt(TAG_RE, input, lt);
    if (!tag) {
      const bogus = matchAt(BOGUS_RE, input, lt);
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
    if (name === "STYLE") {
      const close = closeRe("STYLE").exec(input.slice(i));
      const body = close ? input.slice(i, i + close.index) : input.slice(i);
      const scrubbed = scrubStyleText(body);
      if (scrubbed !== body) {
        report.unsafeUrls += 1;
        if (!scrubbed.trim()) {
          note(name);
          i = close ? i + close.index + close[0].length : input.length;
          continue;
        }
      }
      out += `<${written}>${scrubbed}</${written}>`;
      report.styleBlocks += 1;
      i = close ? i + close.index + close[0].length : input.length;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      note(name);
      const close = closeRe(name).exec(input.slice(i));
      // No closing tag: swallow the remainder rather than leak raw source.
      i = close ? i + close.index + close[0].length : input.length;
      continue;
    }
    if (DROP_VOID.has(name)) {
      note(name);
      continue;
    }
    if (ALLOWED_TAGS.has(name)) {
      out += `<${written}${sanitizeAttrs(tag[3], report)}>`;
      continue;
    }
    // Anything else is unwrapped: the tag disappears, its children stay.
    note(name);
  }
  report.html = out;
  return report;
}

/** The one-line disclosure shown under the editor, phrased from the real counts. */
export function sanitizeSummary(report: SanitizeReport): string {
  if (report.removedTags.length === 0 && report.removedAttributes === 0) {
    return "Nothing was removed — the HTML is already safe to render in this page.";
  }
  const parts: string[] = [];
  if (report.removedTags.length > 0) {
    parts.push(`removed ${report.removedTags.map((t) => `<${t.toLowerCase()}>`).join(", ")}`);
  }
  if (report.eventHandlers > 0) {
    parts.push(`${report.eventHandlers} event handler${report.eventHandlers === 1 ? "" : "s"}`);
  }
  if (report.unsafeUrls > 0) {
    parts.push(`${report.unsafeUrls} unsafe URL${report.unsafeUrls === 1 ? "" : "s"}`);
  }
  if (report.removedAttributes - report.eventHandlers - report.unsafeUrls > 0) {
    const other = report.removedAttributes - report.eventHandlers - report.unsafeUrls;
    parts.push(`${other} other attribute${other === 1 ? "" : "s"}`);
  }
  if (report.styleBlocks > 0) {
    parts.push(`kept ${report.styleBlocks} <style> block${report.styleBlocks === 1 ? "" : "s"} — scope its selectors`);
  }
  return `Sanitized for this page — ${parts.join(", ")}. The preview and the capture use exactly this markup.`;
}
