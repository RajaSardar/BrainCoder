export const MAX_INPUT_BYTES = 200 * 1024;
export const MAX_PAGES = 200;
export const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false };

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGINS: PageMargins = {
  top: 62,
  right: 56,
  bottom: 62,
  left: 56,
};

export type SpanStyle = "regular" | "bold" | "italic" | "mono";
export type Align = "left" | "right" | "center";

export const FONT_KEY: Record<SpanStyle, "regular" | "bold" | "italic" | "mono"> = {
  regular: "regular",
  bold: "bold",
  italic: "italic",
  mono: "mono",
};

export interface Span {
  text: string;
  style: SpanStyle;
  muted?: boolean;
}

export interface TableCell {
  spans: Span[];
  align: Align;
}

export type Block =
  | { kind: "heading"; level: number; spans: Span[] }
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "listItem"; ordered: boolean; index: number; spans: Span[] }
  | { kind: "quote"; spans: Span[] }
  | { kind: "code"; lines: string[] }
  | { kind: "rule" }
  | { kind: "note"; spans: Span[] }
  | { kind: "table"; rows: TableCell[][]; headerRows: number };

export interface DroppedTag {
  tag: string;
  count: number;
}

export interface ModelStats {
  blocks: number;
  textChars: number;
  headings: number;
  tables: number;
  listItems: number;
  replacedChars: number;
}

export interface HtmlModel {
  title: string;
  blocks: Block[];
  dropped: DroppedTag[];
  droppedCount: number;
  stats: ModelStats;
}

const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const WINANSI_GAPS = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

export function isWinAnsiChar(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return !WINANSI_GAPS.has(code);
  return WINANSI_EXTRA.has(code);
}

export function sanitizeText(input: string): { text: string; replaced: number } {
  let out = "";
  let replaced = 0;
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 63;
    if (isWinAnsiChar(code)) out += ch;
    else {
      out += "?";
      replaced++;
    }
  }
  return { text: out, replaced };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  middot: "\u00b7",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  euro: "\u20ac",
  pound: "\u00a3",
  yen: "\u00a5",
  deg: "\u00b0",
  laquo: "\u00ab",
  raquo: "\u00bb",
  times: "\u00d7",
  divide: "\u00f7",
  plusmn: "\u00b1",
  frac12: "\u00bd",
  frac14: "\u00bc",
  frac34: "\u00be",
  sect: "\u00a7",
  para: "\u00b6",
  dagger: "\u2020",
  permil: "\u2030",
};

export function decodeEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(
    /&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]{1,31});/g,
    (whole, body: string) => {
      if (body[0] === "#") {
        const hex = body[1] === "x" || body[1] === "X";
        const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
        if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return whole;
        try {
          return String.fromCodePoint(code);
        } catch {
          return whole;
        }
      }
      const hit = NAMED_ENTITIES[body.toLowerCase()];
      return hit ?? whole;
    },
  );
}

const SKIP_SUBTREE = new Set([
  "script",
  "style",
  "noscript",
  "iframe",
  "object",
  "embed",
  "applet",
  "canvas",
  "video",
  "audio",
  "svg",
  "math",
  "template",
  "title",
  "map",
  "picture",
  "source",
  "track",
  "param",
  "dialog",
  "meter",
  "progress",
  "marquee",
  "portal",
]);

const DROPPED_VOID = new Set([
  "img",
  "input",
  "button",
  "select",
  "textarea",
  "link",
  "meta",
  "base",
  "area",
  "col",
  "colgroup",
  "menuitem",
  "keygen",
]);

const BOLD_TAGS = new Set(["strong", "b"]);
const ITALIC_TAGS = new Set(["em", "i", "cite", "var", "q", "address"]);
const MONO_TAGS = new Set(["code", "kbd", "samp", "tt", "dfn"]);

const IGNORED_TAGS = new Set([
  "html",
  "body",
  "head",
  "span",
  "a",
  "u",
  "ins",
  "s",
  "strike",
  "del",
  "mark",
  "small",
  "big",
  "sub",
  "sup",
  "font",
  "label",
  "bdi",
  "bdo",
  "ruby",
  "rt",
  "rp",
  "wbr",
  "time",
  "abbr",
  "details",
  "summary",
  "center",
  "nobr",
  "acronym",
  "figure",
  "figcaption",
  "legend",
  "optgroup",
  "datalist",
  "output",
  "hgroup",
  "slot",
  "data",
  "dir",
  "menu",
  "search",
  "bgsound",
]);

const BLOCK_STARTS = new Set([
  "html",
  "body",
  "div",
  "p",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "blockquote",
  "pre",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav",
  "hr",
  "br",
  "form",
  "fieldset",
  "hgroup",
]);

const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

interface Attrs {
  [key: string]: string;
}

function parseAttrs(raw: string): Attrs {
  const out: Attrs = {};
  const re =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (!(name in out)) out[name] = decodeEntities(value);
  }
  return out;
}

function alignOf(attrs: Attrs): Align {
  const direct = (attrs["text-align"] ?? attrs["align"] ?? "").toLowerCase();
  const inline = /text-align\s*:\s*([a-z-]+)/i.exec(attrs["style"] ?? "");
  const raw = `${direct} ${inline ? inline[1] : ""}`.toLowerCase();
  if (raw.includes("right")) return "right";
  if (raw.includes("center") || raw.includes("middle")) return "center";
  return "left";
}

function cleanList(list: Span[]): Span[] {
  const copy = list.map((s) => ({ ...s }));
  for (let i = copy.length - 1; i >= 0; i--) {
    const trimmed = copy[i].text.replace(/\s+$/, "");
    if (!trimmed) copy.pop();
    else {
      copy[i] = { ...copy[i], text: trimmed };
      break;
    }
  }
  if (copy.length) copy[0] = { ...copy[0], text: copy[0].text.replace(/^\s+/, "") };
  return copy.filter((s) => s.text.length > 0);
}

export function parseHtmlToModel(
  html: string,
  opts: { defaultTitle?: string } = {},
): HtmlModel {
  const source = typeof html === "string" ? html : "";
  const blocks: Block[] = [];
  const dropped = new Map<string, number>();
  let replacedChars = 0;
  let textChars = 0;

  const drop = (tag: string) => {
    dropped.set(tag, (dropped.get(tag) ?? 0) + 1);
  };

  let spans: Span[] = [];
  let headingLevel = 0;
  let headingSpans: Span[] = [];
  let listCtx: { ordered: boolean; index: number } | null = null;
  let itemSpans: Span[] | null = null;
  let quoteDepth = 0;
  let quoteSpans: Span[] = [];
  let table: { rows: TableCell[][]; headerFlags: boolean[]; caption: Span[]; inHead: boolean; inCaption: boolean } | null = null;
  let row: TableCell[] | null = null;
  let rowHeaderCells = 0;
  let cell: { spans: Span[]; align: Align; isHeader: boolean } | null = null;
  let bold = 0;
  let italic = 0;
  let mono = 0;
  let href: string | null = null;

  const style = (): SpanStyle => {
    if (cell?.isHeader) return "bold";
    if (mono > 0) return "mono";
    if (bold > 0) return "bold";
    if (italic > 0) return "italic";
    return "regular";
  };

  const target = (): Span[] => {
    if (itemSpans) return itemSpans;
    if (cell) return cell.spans;
    if (table?.inCaption) return table.caption;
    if (quoteDepth > 0) return quoteSpans;
    if (headingLevel > 0) return headingSpans;
    return spans;
  };

  const pushSpan = (span: Span) => {
    if (!span.text) return;
    if (span.text.trim()) textChars += span.text.replace(/\s+/g, " ").trim().length;
    target().push(span);
  };

  const pushText = (raw: string, keepBreaks: boolean) => {
    if (!raw) return;
    const decoded = decodeEntities(raw);
    const sanitized = sanitizeText(decoded);
    replacedChars += sanitized.replaced;
    if (keepBreaks) {
      pushSpan({ text: sanitized.text, style: style() });
      return;
    }
    pushSpan({ text: sanitized.text.replace(/[\t\r\n\f ]+/g, " "), style: style() });
  };

  const emitHeading = () => {
    if (headingLevel === 0) return;
    const kept = cleanList(headingSpans);
    if (kept.length) blocks.push({ kind: "heading", level: headingLevel, spans: kept });
    headingLevel = 0;
    headingSpans = [];
  };

  const emitItem = () => {
    if (!itemSpans) return false;
    const kept = cleanList(itemSpans);
    if (kept.length) {
      blocks.push({
        kind: "listItem",
        ordered: listCtx?.ordered ?? false,
        index: listCtx?.index ?? 1,
        spans: kept,
      });
      if (listCtx) listCtx.index++;
    }
    itemSpans = null;
    return true;
  };

  const emitQuote = () => {
    const kept = cleanList(quoteSpans);
    if (kept.length) blocks.push({ kind: "quote", spans: kept });
    quoteSpans = [];
  };

  const emitCell = () => {
    if (!cell) return;
    if (!row) row = [];
    row.push({ spans: cleanList(cell.spans), align: cell.align });
    if (cell.isHeader) rowHeaderCells++;
    cell = null;
  };

  const emitRow = () => {
    emitCell();
    if (!table) {
      row = null;
      rowHeaderCells = 0;
      return;
    }
    if (row && row.length) {
      table.rows.push(row);
      table.headerFlags.push(rowHeaderCells === row.length);
    }
    row = null;
    rowHeaderCells = 0;
  };

  const emitTable = () => {
    emitRow();
    if (!table) return;
    if (table.rows.length) {
      let headerRows = 0;
      for (let i = 0; i < table.rows.length; i++) {
        if (table.headerFlags[i]) headerRows++;
        else break;
      }
      const caption = cleanList(table.caption);
      if (caption.length) blocks.push({ kind: "note", spans: caption });
      blocks.push({ kind: "table", rows: table.rows, headerRows });
    }
    table = null;
    row = null;
    cell = null;
  };

  const flush = () => {
    emitHeading();
    emitTable();
    emitItem();
    emitQuote();
    const kept = cleanList(spans);
    if (kept.length) blocks.push({ kind: "paragraph", spans: kept });
    spans = [];
  };

  const addNote = (text: string) => {
    flush();
    const sanitized = sanitizeText(decodeEntities(text));
    replacedChars += sanitized.replaced;
    const body = sanitized.text.replace(/\s+/g, " ").trim();
    if (body) {
      blocks.push({ kind: "note", spans: [{ text: body, style: "italic", muted: true }] });
    }
  };

  let i = 0;
  const len = source.length;
  while (i < len) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      pushText(source.slice(i), false);
      break;
    }
    if (lt > i) pushText(source.slice(i, lt), false);
    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (source.startsWith("<!", lt) || source.startsWith("<?", lt)) {
      const end = source.indexOf(">", lt);
      i = end === -1 ? len : end + 1;
      continue;
    }
    const tagMatch =
      /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/.exec(
        source.slice(lt),
      );
    if (!tagMatch) {
      pushSpan({ text: "<", style: style() });
      i = lt + 1;
      continue;
    }
    const closing = tagMatch[1] === "/";
    const tag = tagMatch[2].toLowerCase();
    const attrs = parseAttrs(tagMatch[3] ?? "");
    i = lt + tagMatch[0].length;

    if (SKIP_SUBTREE.has(tag)) {
      drop(tag);
      if (!closing) {
        const closeRe = new RegExp(`</${tag}\\s*>`, "i");
        const rest = source.slice(i);
        const found = closeRe.exec(rest);
        i = found ? i + found.index + found[0].length : len;
      }
      continue;
    }

    if (DROPPED_VOID.has(tag)) {
      if (!closing) {
        drop(tag);
        const alt = (attrs.alt ?? "").trim();
        if (tag === "img" && alt) addNote(`[image omitted: ${alt}]`);
      }
      continue;
    }

    if (HEADING_LEVELS[tag]) {
      if (closing) emitHeading();
      else {
        flush();
        headingLevel = HEADING_LEVELS[tag];
        headingSpans = [];
      }
      continue;
    }

    if (tag === "pre") {
      if (closing) continue;
      flush();
      const end = /<\/pre\s*>/i.exec(source.slice(i));
      const raw = end ? source.slice(i, i + end.index) : source.slice(i);
      i = end ? i + end.index + end[0].length : len;
      const sanitized = sanitizeText(decodeEntities(raw));
      replacedChars += sanitized.replaced;
      const lines = sanitized.text
        .replace(/\r\n?/g, "\n")
        .replace(/\t/g, "    ")
        .split("\n")
        .slice(0, 400);
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      if (lines.length) {
        for (const line of lines) {
          if (line.trim()) textChars += line.length;
        }
        blocks.push({ kind: "code", lines });
      }
      continue;
    }

    if (tag === "br") {
      pushSpan({ text: "\n", style: style() });
      continue;
    }

    if (tag === "hr") {
      if (!closing) {
        flush();
        blocks.push({ kind: "rule" });
      }
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      if (closing) {
        flush();
        listCtx = null;
      } else {
        flush();
        listCtx = { ordered: tag === "ol", index: 1 };
      }
      continue;
    }

    if (tag === "li") {
      if (closing) {
        emitItem();
      } else {
        flush();
        if (!listCtx) listCtx = { ordered: false, index: 1 };
        itemSpans = [];
      }
      continue;
    }

    if (tag === "blockquote") {
      if (closing) {
        quoteDepth = Math.max(0, quoteDepth - 1);
        if (quoteDepth === 0) emitQuote();
      } else {
        flush();
        quoteDepth++;
        quoteSpans = [];
      }
      continue;
    }

    if (tag === "table") {
      if (closing) emitTable();
      else {
        flush();
        table = { rows: [], headerFlags: [], caption: [], inHead: false, inCaption: false };
      }
      continue;
    }

    if (tag === "thead" || tag === "tbody" || tag === "tfoot") {
      if (table) table.inHead = closing ? false : tag === "thead";
      continue;
    }

    if (tag === "caption") {
      if (table && !closing) table.inCaption = true;
      else if (table) table.inCaption = false;
      continue;
    }

    if (tag === "tr") {
      if (closing) emitRow();
      else {
        emitRow();
        row = [];
      }
      continue;
    }

    if (tag === "th" || tag === "td") {
      emitCell();
      if (!closing) cell = { spans: [], align: alignOf(attrs), isHeader: tag === "th" };
      continue;
    }

    if (tag === "a") {
      if (closing) {
        const url = href;
        href = null;
        if (url && /^https?:\/\//i.test(url) && !/[\s<>]/.test(url)) {
          pushSpan({ text: ` (${url})`, style: style(), muted: true });
        }
      } else {
        href = attrs.href ?? null;
      }
      continue;
    }

    if (BOLD_TAGS.has(tag)) {
      if (closing) bold = Math.max(0, bold - 1);
      else bold++;
      continue;
    }

    if (MONO_TAGS.has(tag)) {
      if (closing) mono = Math.max(0, mono - 1);
      else mono++;
      continue;
    }

    if (ITALIC_TAGS.has(tag)) {
      if (closing) italic = Math.max(0, italic - 1);
      else italic++;
      continue;
    }

    if (IGNORED_TAGS.has(tag)) continue;

    if (BLOCK_STARTS.has(tag)) {
      if (!closing) flush();
      continue;
    }

    if (!closing) drop(tag);
  }
  flush();
  if (table) emitTable();

  const droppedList: DroppedTag[] = Array.from(dropped.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const finalBlocks = blocks.slice();
  const hasH1 = finalBlocks.some((b) => b.kind === "heading" && b.level === 1);
  const fallback = (opts.defaultTitle ?? "").replace(/\s+/g, " ").trim();
  if (!hasH1 && fallback) {
    const sanitized = sanitizeText(fallback);
    replacedChars += sanitized.replaced;
    finalBlocks.unshift({
      kind: "heading",
      level: 1,
      spans: [{ text: sanitized.text, style: "bold" }],
    });
  }

  return {
    title: fallback,
    blocks: finalBlocks,
    dropped: droppedList,
    droppedCount: droppedList.reduce((sum, d) => sum + d.count, 0),
    stats: {
      blocks: finalBlocks.length,
      textChars,
      headings: finalBlocks.filter((b) => b.kind === "heading").length,
      tables: finalBlocks.filter((b) => b.kind === "table").length,
      listItems: finalBlocks.filter((b) => b.kind === "listItem").length,
      replacedChars,
    },
  };
}

export function droppedSummary(dropped: DroppedTag[]): string {
  if (!dropped.length) return "";
  const list = dropped.map((d) => (d.count > 1 ? `${d.tag} x${d.count}` : d.tag)).join(", ");
  const total = dropped.reduce((sum, d) => sum + d.count, 0);
  return `Dropped ${total} unsupported element${total === 1 ? "" : "s"} (${list}).`;
}

export function pdfFileName(source: string, title: string): string {
  const clean = (raw: string) =>
    (raw ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  const fromSource = clean((source ?? "").replace(/\.[a-z0-9]{1,8}$/i, ""));
  const fromTitle = clean(title ?? "");
  return `${fromSource || fromTitle || "document"}.pdf`;
}

export interface TextMeasurer {
  width(text: string, style: SpanStyle, size: number): number;
}

interface Word {
  text: string;
  style: SpanStyle;
  muted: boolean;
  hardBreak: boolean;
}

export function toWords(spans: Span[]): Word[] {
  const words: Word[] = [];
  for (const span of spans) {
    const segments = span.text.split("\n");
    for (let s = 0; s < segments.length; s++) {
      const hardBreak = s > 0;
      const parts = segments[s].split(/\s+/).filter(Boolean);
      if (!parts.length) {
        if (hardBreak) {
          words.push({ text: "", style: span.style, muted: span.muted === true, hardBreak: true });
        }
        continue;
      }
      for (let p = 0; p < parts.length; p++) {
        words.push({
          text: parts[p],
          style: span.style,
          muted: span.muted === true,
          hardBreak: hardBreak && p === 0,
        });
      }
    }
  }
  return words;
}

const NO_SPACE_BEFORE = /^[.,;:!?)\]}%\u00b7\u2026'"\u2019\u201d]/;

function splitLongWord(
  word: Word,
  measure: TextMeasurer,
  size: number,
  maxWidth: number,
): Word[] {
  const out: Word[] = [];
  let chunk = "";
  for (const ch of word.text) {
    const next = chunk + ch;
    if (chunk && measure.width(next, word.style, size) > maxWidth) {
      out.push({ ...word, text: chunk });
      chunk = ch;
    } else {
      chunk = next;
    }
  }
  if (chunk) out.push({ ...word, text: chunk });
  return out;
}

export function wrapSpans(
  spans: Span[],
  measure: TextMeasurer,
  size: number,
  maxWidth: number,
): Span[][] {
  const words = toWords(spans);
  const lines: Span[][] = [];
  let current: Span[] = [];
  let currentWidth = 0;

  const flush = () => {
    if (current.length) lines.push(current);
    current = [];
    currentWidth = 0;
  };

  for (const raw of words) {
    if (raw.hardBreak) flush();
    if (!raw.text) continue;
    const pieces =
      measure.width(raw.text, raw.style, size) > maxWidth
        ? splitLongWord(raw, measure, size, maxWidth)
        : [raw];
    for (let k = 0; k < pieces.length; k++) {
      if (k > 0) flush();
      const word = pieces[k];
      const tight = NO_SPACE_BEFORE.test(word.text);
      const space = current.length && !tight ? measure.width(" ", word.style, size) : 0;
      const w = measure.width(word.text, word.style, size);
      if (current.length && currentWidth + space + w > maxWidth + 0.01) flush();
      if (current.length && space > 0) {
        const tail = current[current.length - 1];
        current[current.length - 1] = { ...tail, text: `${tail.text} ` };
        currentWidth += space;
      }
      current.push({ text: word.text, style: word.style, muted: word.muted });
      currentWidth += w;
    }
  }
  flush();
  return lines;
}

export interface PlacedRun {
  text: string;
  x: number;
  width: number;
  style: SpanStyle;
  size: number;
  muted: boolean;
}

export type PageItem =
  | { kind: "text"; x: number; y: number; size: number; runs: PlacedRun[] }
  | { kind: "rule"; x: number; y: number; width: number; thickness: number }
  | { kind: "band"; x: number; y: number; width: number; height: number };

export interface LaidOutPage {
  items: PageItem[];
}

export interface LayoutResult {
  pages: LaidOutPage[];
  truncated: boolean;
  maxPages: number;
}

export interface BlockStyle {
  size: number;
  font: SpanStyle;
  lineHeight: number;
  spaceBefore: number;
  spaceAfter: number;
  indent: number;
}

export const HEADING_STYLES: Record<number, BlockStyle> = {
  1: { size: 21, font: "bold", lineHeight: 1.24, spaceBefore: 0, spaceAfter: 9, indent: 0 },
  2: { size: 16.5, font: "bold", lineHeight: 1.24, spaceBefore: 15, spaceAfter: 6, indent: 0 },
  3: { size: 13.5, font: "bold", lineHeight: 1.24, spaceBefore: 12, spaceAfter: 5, indent: 0 },
  4: { size: 11.5, font: "bold", lineHeight: 1.24, spaceBefore: 10, spaceAfter: 4, indent: 0 },
  5: { size: 11, font: "bold", lineHeight: 1.24, spaceBefore: 9, spaceAfter: 4, indent: 0 },
  6: { size: 10.5, font: "bold", lineHeight: 1.24, spaceBefore: 8, spaceAfter: 4, indent: 0 },
};

export const PARAGRAPH_STYLE: BlockStyle = {
  size: 10.5,
  font: "regular",
  lineHeight: 1.45,
  spaceBefore: 0,
  spaceAfter: 8,
  indent: 0,
};

export const QUOTE_STYLE: BlockStyle = {
  size: 10.5,
  font: "italic",
  lineHeight: 1.45,
  spaceBefore: 4,
  spaceAfter: 9,
  indent: 18,
};

export const LIST_STYLE: BlockStyle = {
  size: 10.5,
  font: "regular",
  lineHeight: 1.42,
  spaceBefore: 0,
  spaceAfter: 3,
  indent: 16,
};

export const CODE_STYLE: BlockStyle = {
  size: 8.6,
  font: "mono",
  lineHeight: 1.38,
  spaceBefore: 5,
  spaceAfter: 9,
  indent: 8,
};

export const NOTE_STYLE: BlockStyle = {
  size: 9,
  font: "italic",
  lineHeight: 1.35,
  spaceBefore: 3,
  spaceAfter: 7,
  indent: 0,
};

export const TABLE_STYLE = {
  size: 8.8,
  lineHeight: 1.32,
  spaceBefore: 4,
  spaceAfter: 10,
  cellPadX: 4.5,
  cellPadY: 3.6,
  ruleThickness: 0.55,
  minColumn: 44,
};

export const RULE_STYLE = { spaceBefore: 9, spaceAfter: 9, thickness: 0.7 };

export function columnWidths(natural: number[], available: number, min: number): number[] {
  const widths = natural.map((v) => Math.max(min, Math.ceil(v)));
  const total = widths.reduce((a, b) => a + b, 0);
  if (total > available) {
    const fixed = widths.map((v) => Math.min(v, min));
    const extra = widths.map((v, i) => v - fixed[i]);
    const extraSum = extra.reduce((a, b) => a + b, 0);
    const remaining = available - fixed.reduce((a, b) => a + b, 0);
    if (extraSum <= 0 || remaining <= 0) return fixed;
    return fixed.map((v, i) => v + (extra[i] * remaining) / extraSum);
  }
  if (total > 0 && widths.length > 0) {
    const scale = available / total;
    return widths.map((v) => v * scale);
  }
  return widths;
}

export interface LayoutOptions {
  pageWidth?: number;
  pageHeight?: number;
  margins?: PageMargins;
  maxPages?: number;
}

function spanWidth(line: Span[], measure: TextMeasurer, size: number): number {
  let w = 0;
  for (const piece of line) w += measure.width(piece.text, piece.style, size);
  return w;
}

export function layoutModel(
  model: HtmlModel,
  measure: TextMeasurer,
  opts: LayoutOptions = {},
): LayoutResult {
  const pageWidth = opts.pageWidth ?? A4_WIDTH;
  const pageHeight = opts.pageHeight ?? A4_HEIGHT;
  const margins = opts.margins ?? DEFAULT_MARGINS;
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const left = margins.left;
  const contentWidth = pageWidth - margins.left - margins.right;
  const bottom = pageHeight - margins.bottom;

  const pages: LaidOutPage[] = [{ items: [] }];
  let truncated = false;
  let top = margins.top;

  const items = () => pages[pages.length - 1].items;

  const newPage = (): boolean => {
    if (pages.length >= maxPages) {
      truncated = true;
      return false;
    }
    pages.push({ items: [] });
    top = margins.top;
    return true;
  };

  const ensure = (height: number) => (top + height <= bottom ? true : newPage());

  const gap = (amount: number) => {
    if (items().length) top += amount;
  };

  const pushLine = (
    line: Span[],
    x: number,
    size: number,
    baselineTop: number,
    forceStyle?: SpanStyle,
    forceMuted?: boolean,
  ) => {
    const runs: PlacedRun[] = [];
    let runX = x;
    for (const piece of line) {
      if (!piece.text) continue;
      const pStyle = forceStyle ?? piece.style;
      const muted = forceMuted ?? piece.muted === true;
      const w = measure.width(piece.text, pStyle, size);
      const tail = runs[runs.length - 1];
      if (
        tail &&
        tail.style === pStyle &&
        tail.muted === muted &&
        Math.abs(tail.x + tail.width - runX) < 0.05
      ) {
        tail.text += piece.text;
        tail.width += w;
      } else {
        runs.push({ text: piece.text, x: runX, width: w, style: pStyle, size, muted });
      }
      runX += w;
    }
    if (runs.length) {
      items().push({
        kind: "text",
        x: runs[0].x,
        y: pageHeight - baselineTop - size,
        size,
        runs,
      });
    }
  };

  const placeLines = (
    lines: Span[][],
    x: number,
    style: BlockStyle,
    keepAhead: number,
    forceStyle?: SpanStyle,
    forceMuted?: boolean,
  ): boolean => {
    const lineHeight = style.size * style.lineHeight;
    for (let l = 0; l < lines.length; l++) {
      if (!ensure(l === 0 ? lineHeight + keepAhead : lineHeight)) return false;
      pushLine(lines[l], x, style.size, top, forceStyle, forceMuted);
      top += lineHeight;
    }
    return true;
  };

  for (const block of model.blocks) {
    if (truncated) break;

    if (block.kind === "rule") {
      gap(RULE_STYLE.spaceBefore);
      if (!ensure(RULE_STYLE.thickness * 2 + 2)) break;
      items().push({
        kind: "rule",
        x: left,
        y: pageHeight - top,
        width: contentWidth,
        thickness: RULE_STYLE.thickness,
      });
      top += RULE_STYLE.thickness * 2 + 2 + RULE_STYLE.spaceAfter;
      continue;
    }

    if (block.kind === "code") {
      const style = CODE_STYLE;
      gap(style.spaceBefore);
      const lineHeight = style.size * style.lineHeight;
      outer: for (const raw of block.lines) {
        const lines = wrapSpans(
          [{ text: raw, style: style.font }],
          measure,
          style.size,
          contentWidth - style.indent,
        );
        for (const line of lines) {
          if (!ensure(lineHeight)) break outer;
          pushLine(line, left + style.indent, style.size, top, style.font);
          top += lineHeight;
        }
      }
      if (truncated) break;
      top += style.spaceAfter;
      continue;
    }

    if (block.kind === "table") {
      const { size, lineHeight, cellPadX, cellPadY, minColumn, ruleThickness } = TABLE_STYLE;
      const columns = block.rows.reduce((max, r) => Math.max(max, r.length), 0);
      if (!columns) continue;
      const natural = new Array<number>(columns).fill(0);
      for (const r of block.rows) {
        for (let c = 0; c < r.length; c++) {
          const lines = wrapSpans(r[c].spans, measure, size, contentWidth);
          for (const line of lines) {
            natural[c] = Math.max(natural[c], spanWidth(line, measure, size));
          }
        }
      }
      const widths = columnWidths(natural, contentWidth, minColumn + cellPadX * 2);
      const xs: number[] = [];
      let acc = left;
      for (const w of widths) {
        xs.push(acc);
        acc += w;
      }

      const wrapRow = (r: TableCell[]) =>
        r.map((c, index) => {
          const colWidth = widths[index] ?? minColumn;
          return wrapSpans(
            c.spans.length ? c.spans : [{ text: "", style: "regular" as SpanStyle }],
            measure,
            size,
            Math.max(12, colWidth - cellPadX * 2 - 2),
          );
        });

      const drawHeader = (headerRow: TableCell[]) => {
        const cellLines = wrapRow(headerRow);
        const count = cellLines.reduce((m, l) => Math.max(m, l.length), 1);
        const headerHeight = count * size * lineHeight + cellPadY * 2;
        items().push({
          kind: "band",
          x: left,
          y: pageHeight - top - headerHeight,
          width: contentWidth,
          height: headerHeight,
        });
        cellLines.forEach((cellLinesC, c) => {
          cellLinesC.forEach((line, li) => {
            pushLine(line, xs[c] + cellPadX, size, top + cellPadY + li * size * lineHeight);
          });
        });
        top += headerHeight;
        items().push({
          kind: "rule",
          x: left,
          y: pageHeight - top,
          width: contentWidth,
          thickness: ruleThickness,
        });
        top += 2;
      };

      gap(TABLE_STYLE.spaceBefore);

      for (let r = 0; r < block.rows.length; r++) {
        const cellLines = wrapRow(block.rows[r]);
        const lineCount = cellLines.reduce((m, l) => Math.max(m, l.length), 1);
        const rowHeight = lineCount * size * lineHeight + cellPadY * 2;
        if (top + rowHeight > bottom) {
          if (!newPage()) break;
          if (block.headerRows > 0 && r > 0) drawHeader(block.rows[0]);
        }
        if (r < block.headerRows) {
          items().push({
            kind: "band",
            x: left,
            y: pageHeight - top - rowHeight,
            width: contentWidth,
            height: rowHeight,
          });
        }
        cellLines.forEach((cellLinesC, c) => {
          const colWidth = widths[c] ?? minColumn;
          const align = block.rows[r][c]?.align ?? "left";
          cellLinesC.forEach((line, li) => {
            const lineWidth = spanWidth(line, measure, size);
            const shift =
              align === "right"
                ? Math.max(0, colWidth - cellPadX * 2 - lineWidth)
                : align === "center"
                  ? Math.max(0, (colWidth - cellPadX * 2 - lineWidth) / 2)
                  : 0;
            pushLine(
              line,
              xs[c] + cellPadX + shift,
              size,
              top + cellPadY + li * size * lineHeight,
            );
          });
        });
        items().push({
          kind: "rule",
          x: left,
          y: pageHeight - top - rowHeight,
          width: contentWidth,
          thickness: ruleThickness,
        });
        top += rowHeight;
      }
      if (truncated) break;
      top += TABLE_STYLE.spaceAfter;
      continue;
    }

    const style =
      block.kind === "heading"
        ? HEADING_STYLES[block.level] ?? HEADING_STYLES[6]
        : block.kind === "quote"
          ? QUOTE_STYLE
          : block.kind === "note"
            ? NOTE_STYLE
            : block.kind === "listItem"
              ? LIST_STYLE
              : PARAGRAPH_STYLE;

    gap(style.spaceBefore);

    if (block.kind === "listItem") {
      const marker = block.ordered ? `${block.index}.` : "\u2022";
      const markerWidth = measure.width(marker, "regular", style.size);
      const lines = wrapSpans(
        block.spans,
        measure,
        style.size,
        contentWidth - style.indent - 4,
      );
      const lineHeight = style.size * style.lineHeight;
      for (let l = 0; l < lines.length; l++) {
        if (!ensure(lineHeight)) break;
        if (l === 0) {
          items().push({
            kind: "text",
            x: left,
            y: pageHeight - top - style.size,
            size: style.size,
            runs: [
              {
                text: marker,
                x: left,
                width: markerWidth,
                style: "regular",
                size: style.size,
                muted: false,
              },
            ],
          });
        }
        pushLine(lines[l], left + style.indent, style.size, top);
        top += lineHeight;
      }
      if (truncated) break;
      top += style.spaceAfter;
      continue;
    }

    const source = block.spans.map((s) => {
      if (block.kind === "heading") {
        return { ...s, style: s.style === "mono" ? ("mono" as SpanStyle) : ("bold" as SpanStyle) };
      }
      if (block.kind === "quote" && s.style === "regular") {
        return { ...s, style: "italic" as SpanStyle };
      }
      return s;
    });
    const lines = wrapSpans(source, measure, style.size, contentWidth - style.indent);
    const keepAhead =
      block.kind === "heading" ? PARAGRAPH_STYLE.size * PARAGRAPH_STYLE.lineHeight : 0;
    const ok = placeLines(
      lines,
      left + style.indent,
      style,
      keepAhead,
      block.kind === "note" ? "italic" : undefined,
      block.kind === "note" ? true : undefined,
    );
    if (!ok) break;
    top += style.spaceAfter;
  }

  const used = pages.filter((p) => p.items.length > 0);
  return {
    pages: used.length ? used : [{ items: [] }],
    truncated,
    maxPages,
  };
}

export interface PdfPageLike<Font, Color> {
  drawText(
    text: string,
    options: { x: number; y: number; size: number; font: Font; color?: Color },
  ): void;
  drawLine(options: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    thickness: number;
    color: Color;
  }): void;
  drawRectangle(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: Color;
  }): void;
}

export interface PdfDocLike<Font, Color> {
  addPage(size: [number, number]): PdfPageLike<Font, Color>;
}

export interface PdfFontSet<Font> {
  regular: Font;
  bold: Font;
  italic: Font;
  mono: Font;
}

export interface PdfPalette<Color> {
  text: Color;
  muted: Color;
  rule: Color;
  band: Color;
}

export interface PaintOptions {
  pageWidth?: number;
  pageHeight?: number;
}

export function paintLayout<Font, Color>(
  doc: PdfDocLike<Font, Color>,
  pages: LaidOutPage[],
  fonts: PdfFontSet<Font>,
  palette: PdfPalette<Color>,
  opts: PaintOptions = {},
): void {
  const pageWidth = opts.pageWidth ?? A4_WIDTH;
  const pageHeight = opts.pageHeight ?? A4_HEIGHT;
  for (const laidOut of pages) {
    const page = doc.addPage([pageWidth, pageHeight]);
    for (const item of laidOut.items) {
      if (item.kind === "rule") {
        page.drawLine({
          start: { x: item.x, y: item.y },
          end: { x: item.x + item.width, y: item.y },
          thickness: item.thickness,
          color: palette.rule,
        });
        continue;
      }
      if (item.kind === "band") {
        page.drawRectangle({
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          color: palette.band,
        });
        continue;
      }
      for (const run of item.runs) {
        page.drawText(run.text, {
          x: run.x,
          y: item.y,
          size: item.size,
          font: fonts[FONT_KEY[run.style]],
          color: run.muted ? palette.muted : palette.text,
        });
      }
    }
  }
}

export function firstPageText(pages: LaidOutPage[], maxChars = 420): string {
  const words: string[] = [];
  for (const item of pages[0]?.items ?? []) {
    if (item.kind !== "text") continue;
    for (const run of item.runs) {
      if (run.text.trim()) words.push(run.text.trim());
    }
  }
  const joined = words.join(" ");
  return joined.length > maxChars ? `${joined.slice(0, maxChars).trimEnd()}…` : joined;
}
