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

const ALLOWED_ATTRS = new Set([
  "alt",
  "checked",
  "class",
  "colspan",
  "disabled",
  "href",
  "rowspan",
  "src",
  "title",
  "type",
]);

function safeHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v.startsWith("#")) return true;
  if (v.startsWith("/") || v.startsWith("./") || v.startsWith("../")) return true;
  if (v.startsWith("http://") || v.startsWith("https://")) return true;
  if (v.startsWith("mailto:") || v.startsWith("tel:")) return true;
  return false;
}

function safeSrc(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (v.startsWith("/") || v.startsWith("./") || v.startsWith("../")) return true;
  if (v.startsWith("http://") || v.startsWith("https://")) return true;
  if (v.startsWith("data:image/")) return true;
  return false;
}

function sanitizeNode(parent: Element): void {
  for (let i = parent.children.length - 1; i >= 0; i--) {
    const el = parent.children[i];
    sanitizeNode(el);
    if (!ALLOWED_TAGS.has(el.tagName)) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" && !safeHref(attr.value)) el.removeAttribute(attr.name);
      if (name === "src" && !safeSrc(attr.value)) el.removeAttribute(attr.name);
    }
  }
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}