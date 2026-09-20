const RAW_TEXT_TAGS = new Set(["script", "style", "textarea", "pre"]);

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "caption",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "html",
  "legend",
  "li",
  "main",
  "menu",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const WS = /\s/;

function readTagEnd(html: string, start: number): number {
  let i = start;
  let quote: string | null = null;
  while (i < html.length) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
    i++;
  }
  return html.length - 1;
}

function normalizeTag(raw: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (WS.test(ch)) {
      let j = i;
      while (j + 1 < raw.length && WS.test(raw[j + 1])) j++;
      const next = raw[j + 1];
      if (next !== ">" && !(next === "/" && raw[j + 2] === ">")) {
        if (out && !/\s$/.test(out)) out += " ";
      }
      i = j;
      continue;
    }
    out += ch;
  }
  return out.replace(/\s+$/g, "");
}

function collapseText(text: string): string {
  return text.replace(/\s+/g, " ");
}

function findCloseTag(html: string, from: number, name: string): number {
  const probeLen = name.length + 2;
  let k = from;
  while (k + probeLen <= html.length) {
    if (html.slice(k, k + probeLen).toLowerCase() === `</${name}`) return k;
    k++;
  }
  return -1;
}

export function minifyHtml(
  html: string,
  options?: { preserveConditional?: boolean },
): string {
  const preserveConditional = options?.preserveConditional ?? false;
  const out: string[] = [];
  let i = 0;
  let lastInline = false;
  let owedSpace = false;

  const consumeWhitespace = (nextInline: boolean) => {
    if (owedSpace && lastInline && nextInline) out.push(" ");
    owedSpace = false;
    lastInline = nextInline;
  };

  const pushText = (chunk: string, atEnd: boolean) => {
    let collapsed = collapseText(chunk);
    if (!lastInline) collapsed = collapsed.replace(/^\s+/, "");
    if (!atEnd) collapsed = collapsed.replace(/ +$/, "");
    if (collapsed) {
      if (owedSpace && lastInline) out.push(" ");
      out.push(collapsed);
      owedSpace = false;
      lastInline = true;
      if (!atEnd && /\s+$/.test(chunk)) owedSpace = true;
    } else if (/^\s+$/.test(chunk)) {
      owedSpace = true;
    }
  };

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      pushText(html.slice(i), true);
      break;
    }
    if (lt > i) {
      pushText(html.slice(i, lt), false);
      i = lt;
      continue;
    }

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const commentEnd = end === -1 ? html.length : end + 3;
      const comment = html.slice(lt, commentEnd);
      if (preserveConditional && /^<!--\s*(\[if|<!\[endif)/i.test(comment)) {
        if (owedSpace && lastInline) out.push(" ");
        owedSpace = false;
        out.push(comment);
      }
      i = commentEnd;
      continue;
    }

    if (html.startsWith("<!", lt)) {
      const end = readTagEnd(html, lt + 1);
      out.push(html.slice(lt, end + 1));
      i = end + 1;
      lastInline = false;
      continue;
    }

    if (html.startsWith("</", lt)) {
      const m = /^<\/([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 64));
      if (!m) {
        i = lt + 1;
        continue;
      }
      const name = m[1].toLowerCase();
      consumeWhitespace(!BLOCK_TAGS.has(name));
      out.push(`</${name}>`);
      i = lt + m[0].length + 1;
      continue;
    }

    if (/^<[a-zA-Z]/.test(html.slice(lt, lt + 2))) {
      const tagEnd = readTagEnd(html, lt + 1);
      const raw = html.slice(lt, tagEnd + 1);
      const nameMatch = /^<([a-zA-Z][\w:-]*)/.exec(raw);
      const name = nameMatch ? nameMatch[1].toLowerCase() : "";

      if (RAW_TEXT_TAGS.has(name)) {
        const restFrom = tagEnd + 1;
        const closeStart = findCloseTag(html, restFrom, name);
        if (closeStart === -1) {
          consumeWhitespace(!BLOCK_TAGS.has(name));
          out.push(normalizeTag(raw));
          out.push(html.slice(restFrom));
          break;
        }
        const closeEnd = readTagEnd(html, closeStart + 2);
        consumeWhitespace(!BLOCK_TAGS.has(name));
        out.push(normalizeTag(raw));
        out.push(html.slice(restFrom, closeStart));
        out.push(`</${name}>`);
        i = closeEnd + 1;
        continue;
      }

      consumeWhitespace(!BLOCK_TAGS.has(name));
      out.push(normalizeTag(raw));
      i = tagEnd + 1;
      continue;
    }

    out.push("<");
    i = lt + 1;
    lastInline = true;
  }
  return out.join("").trim();
}

export function beautifyHtml(html: string): string {
  const lines: string[] = [];
  const SPACE = "  ";
  let i = 0;
  let depth = 0;

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      const chunk = html.slice(i);
      if (chunk.trim()) lines.push(SPACE.repeat(depth) + collapseText(chunk).trim());
      break;
    }
    if (lt > i) {
      const chunk = html.slice(i, lt);
      if (chunk.trim()) {
        if (/\s/.test(chunk) && !chunk.includes("\n")) {
          lines.push(SPACE.repeat(depth) + collapseText(chunk).trim());
        } else {
          lines.push(SPACE.repeat(depth) + chunk.trim());
        }
      }
      i = lt;
      continue;
    }

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }

    if (/^<!DOCTYPE/i.test(html.slice(lt, lt + 9))) {
      const end = html.indexOf(">", lt);
      lines.push(html.slice(lt, end + 1));
      i = end + 1;
      continue;
    }

    if (html.startsWith("<!", lt)) {
      const end = readTagEnd(html, lt + 1);
      lines.push(SPACE.repeat(depth) + html.slice(lt, end + 1));
      i = end + 1;
      continue;
    }

    if (html.startsWith("</", lt)) {
      const m = /^<\/([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 64));
      if (!m) {
        i = lt + 1;
        continue;
      }
      depth = Math.max(0, depth - 1);
      lines.push(SPACE.repeat(depth) + `</${m[1].toLowerCase()}>`);
      i = lt + m[0].length + 1;
      continue;
    }

    if (/^<[a-zA-Z]/.test(html.slice(lt, lt + 2))) {
      const end = readTagEnd(html, lt + 1);
      const raw = html.slice(lt, end + 1);
      const nameMatch = /^<([a-zA-Z][\w:-]*)/.exec(raw);
      const name = nameMatch ? nameMatch[1].toLowerCase() : "";

      if (RAW_TEXT_TAGS.has(name)) {
        const restFrom = end + 1;
        const closeStart = findCloseTag(html, restFrom, name);
        if (closeStart === -1) {
          lines.push(SPACE.repeat(depth) + normalizeTag(raw));
          if (html.slice(restFrom).trim()) lines.push(html.slice(restFrom));
          break;
        }
        const content = html.slice(restFrom, closeStart);
        const closeEnd = readTagEnd(html, closeStart + 2);
        lines.push(SPACE.repeat(depth) + normalizeTag(raw));
        if (content.trim()) {
          for (const line of content.split("\n")) {
            if (line.trim()) lines.push(line);
            else lines.push("");
          }
        }
        lines.push(SPACE.repeat(depth) + `</${name}>`);
        i = closeEnd + 1;
        continue;
      }

      lines.push(SPACE.repeat(depth) + normalizeTag(raw));
      if (!VOID_TAGS.has(name) && !/\/\s*>$/.test(raw.trim())) depth++;
      i = end + 1;
      continue;
    }

    i = lt + 1;
  }
  return lines.join("\n").replace(/\n+/g, "\n");
}