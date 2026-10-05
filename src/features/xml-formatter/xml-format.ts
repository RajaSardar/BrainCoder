/**
 * A quote-aware XML tokenizer and a real well-formedness check.
 *
 * The version this replaces matched tags with a regular expression, `<[^>]*>`, and
 * then reported "Valid XML" whenever the tag stack balanced. That reported success
 * for two root elements, for unquoted attribute values, for duplicate attributes,
 * for undeclared entities and prefixes, for the words `hello`, and for empty input.
 * Minify mode skipped the stack check entirely, so the same document got opposite
 * answers depending only on which button was selected. The quoted-value corruption
 * came from the same line: `<a title="a > b">` ended its "tag" at the `>` inside the
 * attribute value and rewrote the value to `a>b`.
 *
 * So the tokenizer below consumes a quoted attribute value atomically, which is what
 * makes `>` inside a value ordinary text, and the check is a real one: names, quoting,
 * duplicate attributes, single root, matched tags, legal references, comment and CDATA
 * terminators. Both modes run the same check and reach the same verdict, because the
 * verdict is computed from the tokens and never from the mode.
 *
 * What this does NOT do is validate against a DTD or schema. "Well-formed" is the
 * accurate word and the copy says so.
 */

/** Refused with its real number rather than truncated. */
export const MAX_XML_CHARS = 200_000;

/** Nesting cap. The old builder was quadratic in depth: 68 KB at depth ~23,250 threw a RangeError. */
export const MAX_XML_DEPTH = 200;

/** Generated-output cap, checked while building rather than after allocating it. */
export const MAX_XML_OUTPUT_CHARS = 400_000;

export type XmlIndent = "tab" | "1" | "2" | "4";

export interface XmlFormatOptions {
  mode: "format" | "minify";
  /** Default is to keep comments. Stripping is the destructive direction, so it is opt-in. */
  stripComments: boolean;
  indent: XmlIndent;
}

export const DEFAULT_XML_OPTIONS: XmlFormatOptions = {
  mode: "format",
  stripComments: false,
  indent: "2",
};

export interface XmlPosition {
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

export type XmlResult =
  | {
      kind: "processed";
      text: string;
      stats: { elements: number; comments: number; maxDepth: number; bytesRemoved: number };
    }
  /** Nothing pasted: neither well-formed nor malformed. */
  | { kind: "empty" }
  | { kind: "malformed"; message: string; line: number; column: number }
  | { kind: "refused"; message: string }
  | { kind: "internal"; message: string };

type TokenKind = "xml-decl" | "pi" | "comment" | "cdata" | "doctype" | "open" | "close" | "text";

interface Token {
  kind: TokenKind;
  /** Verbatim source text. Formatting never rewrites a token from inside. */
  raw: string;
  start: number;
  end: number;
  /** Element name, for open and close. */
  name?: string;
  /** Present on an `open` token whose tag ended `/>`. */
  selfClosing?: boolean;
  /** The token index just after this one, for a text run followed by a close tag. */
  closeIndex?: number;
}

const NAME_START =
  /[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
const NAME_CHAR =
  /[:A-Z_a-z\-.\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0300-\u036F\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\d]/;

const isXmlWhitespace = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";
const isSpaceLike = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v";

/** Raised internally and caught by the one entry point, so the lexer never throws past it. */
class MalformedXml extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(message);
    this.name = "MalformedXml";
  }
}

class RefusedXml extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefusedXml";
  }
}

function positionAt(source: string, offset: number): XmlPosition {
  let line = 1;
  let lineStart = 0;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: limit - lineStart + 1 };
}

/** Scans a name, returning its end offset, or -1 when no name starts here. */
function scanName(source: string, from: number): number {
  if (from >= source.length) return -1;
  if (!NAME_START.test(source[from]!)) return -1;
  let i = from + 1;
  while (i < source.length && NAME_CHAR.test(source[i]!)) i++;
  return i;
}

/**
 * Reads a quoted attribute value, returning the offset just past the closing quote.
 * The value is consumed as a unit, so a `>` inside it is ordinary text. A `<` is not
 * allowed inside a value and is reported, because neither one is recoverable.
 */
function scanAttValue(source: string, from: number): { end: number; value: string } {
  const quote = source[from];
  if (quote !== '"' && quote !== "'") {
    throw new MalformedXml(
      "This attribute value is not quoted. XML requires every attribute value to be in single or double quotes.",
      from,
    );
  }
  let i = from + 1;
  while (i < source.length) {
    const c = source[i]!;
    if (c === "<") {
      throw new MalformedXml("This attribute value contains a `<`, which XML does not allow.", i);
    }
    if (c === quote) {
      return { end: i + 1, value: source.slice(from + 1, i) };
    }
    i++;
  }
  throw new MalformedXml(`This attribute value is never closed with a ${quote}.`, from);
}

/** Attribute names are compared as written; XML has no case folding. */
function checkReference(source: string, at: number, declared: ReadonlySet<string>, where: string): void {
  const semi = source.indexOf(";", at + 1);
  if (semi < 0 || semi - at > 32) {
    throw new MalformedXml(`An `+"`&`"+` in ${where} has no entity name after it.`, at);
  }
  const body = source.slice(at + 1, semi);
  if (body.startsWith("#")) {
    const isHex = body[1] === "x" || body[1] === "X";
    const digits = isHex ? body.slice(2) : body.slice(1);
    const valid = isHex ? /^[0-9a-fA-F]+$/.test(digits) : /^[0-9]+$/.test(digits);
    if (!valid || digits.length === 0) {
      throw new MalformedXml(`This character reference `+"`&"+`${body};`+" is not a valid number.", at);
    }
    return;
  }
  const builtin = body === "amp" || body === "lt" || body === "gt" || body === "quot" || body === "apos";
  if (builtin || declared.has(body)) return;
  throw new MalformedXml(
    `This refers to the entity `+"`&"+`${body};`+`, which is never declared. Declare it in a DOCTYPE internal subset or escape it.`,
    at,
  );
}

/** Checks every `&` in a run of text or an attribute value. */
function checkReferences(
  source: string,
  start: number,
  end: number,
  declared: ReadonlySet<string>,
  where: string,
): void {
  let i = start;
  while (i < end) {
    const c = source[i]!;
    if (c === "&") {
      checkReference(source, i, declared, where);
      const semi = source.indexOf(";", i);
      i = semi + 1;
      continue;
    }
    if (c === "<") {
      throw new MalformedXml(`A \`<\` appears in ${where} where XML allows only an element.`, i);
    }
    i++;
  }
}

/**
 * Collects `<!ENTITY name "value">` from a DOCTYPE internal subset, so that a
 * document which legitimately declares its own entities is accepted rather than
 * rejected for using them.
 */
function collectDeclaredEntities(subset: string): Set<string> {
  const declared = new Set<string>();
  let i = 0;
  while (i < subset.length) {
    const at = subset.indexOf("<!ENTITY", i);
    if (at < 0) break;
    let j = at + "<!ENTITY".length;
    while (j < subset.length && isSpaceLike(subset[j]!)) j++;
    // A parameter entity, `%name`, is not a general entity declaration.
    if (subset[j] === "%") {
      i = at + 8;
      continue;
    }
    const nameEnd = scanName(subset, j);
    if (nameEnd < 0) {
      i = at + 8;
      continue;
    }
    declared.add(subset.slice(j, nameEnd));
    i = nameEnd;
  }
  return declared;
}

/**
 * Finds the `>` that closes a `<!DOCTYPE`, counting `[` and `]` so the internal
 * subset is read as one unit. The old `indexOf(">")` stopped at the first `>` inside
 * the subset and then emitted broken markup for every document with entity
 * declarations in it.
 */
function scanDoctype(source: string, from: number): { end: number; subset: string } {
  let i = from;
  while (i < source.length && source[i] !== ">" && source[i] !== "[") i++;
  if (source[i] === "[") {
    const subsetStart = i + 1;
    let depth = 1;
    i++;
    let quote: string | null = null;
    while (i < source.length) {
      const c = source[i]!;
      if (quote !== null) {
        if (c === quote) quote = null;
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        i++;
        continue;
      }
      if (c === "[") depth++;
      else if (c === "]") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    if (depth !== 0) {
      throw new MalformedXml("This DOCTYPE internal subset is never closed with `]`.", from);
    }
    const subset = source.slice(subsetStart, i - 1);
    while (i < source.length && source[i] !== ">") i++;
    if (i >= source.length) {
      throw new MalformedXml("This DOCTYPE is never closed with `>`.", from);
    }
    return { end: i + 1, subset };
  }
  if (i >= source.length) {
    throw new MalformedXml("This DOCTYPE is never closed with `>`.", from);
  }
  return { end: i + 1, subset: "" };
}

/** Splits the source into tokens, or throws MalformedXml with an offset. */
function tokenize(source: string): { tokens: Token[]; declaredEntities: Set<string> } {
  const tokens: Token[] = [];
  const declaredEntities = new Set<string>();
  const len = source.length;
  let i = 0;
  let sawDoctype = false;
  let sawRoot = false;

  const push = (kind: TokenKind, start: number, end: number, extra: Partial<Token> = {}): void => {
    tokens.push({ kind, raw: source.slice(start, end), start, end, ...extra });
  };

  while (i < len) {
    const c = source[i]!;

    if (c !== "<") {
      const start = i;
      while (i < len && source[i] !== "<") i++;
      push("text", start, i);
      continue;
    }

    // <?xml ... ?> is the declaration; any other <?target ?> is a processing instruction.
    if (source.startsWith("<?", i)) {
      const start = i;
      const isDecl = /^<\?xml[\s?]/.test(source.slice(i, i + 6));
      const close = source.indexOf("?>", i + 2);
      if (close < 0) {
        throw new MalformedXml(
          isDecl ? "This XML declaration is never closed with `?>`." : "This processing instruction is never closed with `?>`.",
          i,
        );
      }
      const end = close + 2;
      if (!isDecl) {
        const nameEnd = scanName(source, i + 2);
        if (nameEnd < 0) {
          throw new MalformedXml("This processing instruction has no target name.", i + 2);
        }
        const target = source.slice(i + 2, nameEnd);
        if (target.toLowerCase() === "xml") {
          throw new MalformedXml(
            "`xml` is reserved and may only appear as the XML declaration itself, at the very start of the document.",
            i + 2,
          );
        }
      }
      push(isDecl ? "xml-decl" : "pi", start, end);
      i = end;
      continue;
    }

    if (source.startsWith("<!--", i)) {
      const start = i;
      const close = source.indexOf("-->", i + 4);
      if (close < 0) {
        throw new MalformedXml("This comment is never closed with `-->`.", i);
      }
      const body = source.slice(i + 4, close);
      if (body.includes("--")) {
        throw new MalformedXml("This comment contains `--`, which XML does not allow inside a comment.", i);
      }
      if (body.endsWith("-")) {
        throw new MalformedXml("This comment ends with `-`, which cannot be written as `-->`.", i);
      }
      push("comment", start, close + 3);
      i = close + 3;
      continue;
    }

    if (source.startsWith("<![CDATA[", i)) {
      const start = i;
      const close = source.indexOf("]]>", i + 9);
      if (close < 0) {
        throw new MalformedXml("This CDATA section is never closed with `]]>`.", i);
      }
      push("cdata", start, close + 3);
      i = close + 3;
      continue;
    }

    if (source.startsWith("<!DOCTYPE", i)) {
      if (sawRoot) {
        throw new MalformedXml("A DOCTYPE must come before the root element.", i);
      }
      if (sawDoctype) {
        throw new MalformedXml("A document may have only one DOCTYPE declaration.", i);
      }
      const { end, subset } = scanDoctype(source, i + "<!DOCTYPE".length);
      for (const name of collectDeclaredEntities(subset)) declaredEntities.add(name);
      push("doctype", i, end);
      sawDoctype = true;
      i = end;
      continue;
    }

    if (source.startsWith("</", i)) {
      const start = i;
      const nameStop = scanName(source, i + 2);
      if (nameStop < 0) {
        throw new MalformedXml("This closing tag has no element name after `</`.", i + 2);
      }
      const name = source.slice(i + 2, nameStop);
      // Whitespace is allowed between the name and `>`, nothing else is.
      let afterName = nameStop;
      while (afterName < len && isXmlWhitespace(source[afterName]!)) afterName++;
      if (source[afterName] !== ">") {
        throw new MalformedXml(`This closing tag for \`${name}\` is malformed.`, i);
      }
      push("close", start, afterName + 1, { name });
      i = afterName + 1;
      continue;
    }

    if (source.startsWith("<!", i)) {
      throw new MalformedXml(
        "This `<!` is not a DOCTYPE, comment or CDATA section. Declarations are only allowed inside a DOCTYPE internal subset.",
        i,
      );
    }

    // An opening tag. The whole tag is read with attribute values consumed atomically.
    {
      const start = i;
      const nameEnd = scanName(source, i + 1);
      if (nameEnd < 0) {
        throw new MalformedXml("This element name is not a valid XML name.", i + 1);
      }
      const name = source.slice(i + 1, nameEnd);
      const seen = new Set<string>();
      let selfClosing = false;
      let p = nameEnd;
      for (;;) {
        while (p < len && isSpaceLike(source[p]!)) p++;
        if (p >= len) {
          throw new MalformedXml(`The tag for \`${name}\` is never closed with \`>\`.`, start);
        }
        if (source[p] === ">") {
          p++;
          break;
        }
        if (source[p] === "/") {
          if (source[p + 1] !== ">") {
            throw new MalformedXml(`The \`/\` in the tag for \`${name}\` is not followed by \`>\`.`, p);
          }
          p += 2;
          selfClosing = true;
          break;
        }
        const attrEnd = scanName(source, p);
        if (attrEnd < 0) {
          throw new MalformedXml(
            `This attribute in the tag for \`${name}\` has no name. XML attributes need a name, an \`=\` and a quoted value.`,
            p,
          );
        }
        const attr = source.slice(p, attrEnd);
        if (seen.has(attr)) {
          throw new MalformedXml(`\`${name}\` repeats the attribute \`${attr}\`, which XML does not allow.`, p);
        }
        seen.add(attr);
        let q = attrEnd;
        while (q < len && isSpaceLike(source[q]!)) q++;
        if (source[q] !== "=") {
          throw new MalformedXml(`The attribute \`${attr}\` on \`${name}\` has no \`=\` after its name.`, q);
        }
        q++;
        while (q < len && isSpaceLike(source[q]!)) q++;
        if (q >= len) {
          throw new MalformedXml(`The attribute \`${attr}\` on \`${name}\` has no value.`, attrEnd);
        }
        const { end: valueEnd } = scanAttValue(source, q);
        checkReferences(source, q + 1, valueEnd - 1, declaredEntities, `the attribute \`${attr}\` of \`${name}\``);
        p = valueEnd;
        // Two attributes with nothing between them are not two attributes.
        if (p < len && !isSpaceLike(source[p]!) && source[p] !== ">" && source[p] !== "/") {
          throw new MalformedXml(
            `This needs whitespace between the attributes of \`${name}\`.`,
            p,
          );
        }
      }
      push("open", start, p, { name, selfClosing });
      i = p;
      sawRoot = true;
    }
  }

  return { tokens, declaredEntities };
}

interface Checked {
  tokens: Token[];
  declaredEntities: Set<string>;
  stats: { elements: number; comments: number; maxDepth: number };
  /** Indices of text runs that are whitespace only. */
  whitespaceText: Set<number>;
}

/**
 * The well-formedness check, and the only place a verdict is produced. Both modes
 * call it, so the badge cannot contradict itself.
 */
function checkWellFormed(source: string): Checked {
  const { tokens, declaredEntities } = tokenize(source);

  const stack: string[] = [];
  let sawRoot = false;
  let rootClosed = false;
  let elements = 0;
  let comments = 0;
  let maxDepth = 0;
  const whitespaceText = new Set<number>();

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]!;

    if (t.kind === "text") {
      if (t.raw.trim() === "") {
        whitespaceText.add(k);
      } else {
        checkReferences(source, t.start, t.end, declaredEntities, "this text");
        if (!sawRoot) {
          throw new MalformedXml(
            "This text appears before the root element. XML allows only whitespace, comments, processing instructions and an optional DOCTYPE before it.",
            t.start,
          );
        }
        if (rootClosed) {
          throw new MalformedXml("This text appears after the root element is closed.", t.start);
        }
      }
      continue;
    }

    if (t.kind === "comment") {
      comments++;
      continue;
    }

    if (t.kind === "cdata") {
      if (!sawRoot || rootClosed) {
        throw new MalformedXml("This CDATA section is outside the root element.", t.start);
      }
      continue;
    }

    if (t.kind === "xml-decl" || t.kind === "pi") {
      const what = t.kind === "xml-decl" ? "XML declaration" : "processing instruction";
      if (rootClosed) {
        throw new MalformedXml(
          `This ${what} appears after the root element is closed.`,
          t.start,
        );
      }
      // The declaration is only a declaration when it is the very first thing in the
      // document. `<r><?xml version="1.0"?></r>` is a PI aimed at a target named `xml`,
      // which the spec reserves, so it is malformed either way. Accepting it marked a
      // document well-formed that libxml2 rejects.
      if (t.kind === "xml-decl" && t.start !== 0) {
        throw new MalformedXml(
          `An XML declaration may only appear at the very start of the document, before any other content. This one starts at character ${t.start.toLocaleString("en-US")}.`,
          t.start,
        );
      }
      continue;
    }

    if (t.kind === "doctype") continue;

    if (t.kind === "open") {
      if (rootClosed) {
        throw new MalformedXml(
          `A second root element, \`${t.name}\`, starts after the root element is closed. XML allows exactly one.`,
          t.start,
        );
      }
      sawRoot = true;
      elements++;
      if (t.selfClosing) {
        // A self-closing root element is a complete document on its own, so a second
        // element after it is a second root. Without this, `<a/><b/>` passed.
        if (stack.length === 0) rootClosed = true;
        continue;
      }
      stack.push(t.name!);
      if (stack.length > maxDepth) maxDepth = stack.length;
      if (stack.length > MAX_XML_DEPTH) {
        throw new RefusedXml(
          `This document nests elements more than ${MAX_XML_DEPTH} levels deep, which this page refuses.`,
        );
      }
      continue;
    }

    // close
    if (stack.length === 0) {
      throw new MalformedXml(
        `This closing tag \`</${t.name}>\` has nothing open to close.`,
        t.start,
      );
    }
    const top = stack[stack.length - 1]!;
    if (top !== t.name) {
      throw new MalformedXml(
        `This closes \`</${t.name}>\` but \`<${top}>\` is the element still open.`,
        t.start,
      );
    }
    stack.pop();
    if (stack.length === 0) rootClosed = true;
  }

  if (stack.length > 0) {
    const open = tokens.find((t) => t.kind === "open" && t.name === stack[stack.length - 1] && !t.selfClosing);
    throw new MalformedXml(
      `\`<${stack[stack.length - 1]}>\` is never closed.`,
      open?.start ?? source.length,
    );
  }
  if (!sawRoot) {
    throw new MalformedXml("This document has no root element. XML needs exactly one.", 0);
  }

  return { tokens, declaredEntities, stats: { elements, comments, maxDepth }, whitespaceText };
}

function indentUnitFor(indent: XmlIndent): string {
  return indent === "tab" ? "\t" : " ".repeat(Number(indent));
}

/** Thrown to stop a build that has already gone over the output cap. */
class OutputTooLarge extends Error {}

function build(
  checked: Checked,
  source: string,
  options: XmlFormatOptions,
): { text: string; bytesRemoved: number } {
  const { tokens, whitespaceText } = checked;
  const keep = (t: Token) => !(t.kind === "comment" && options.stripComments);

  /**
   * Scans from an element's opening tag to its matching close and reports whether its
   * content is element-only. When it is not, the caller emits that whole span verbatim:
   * text content is data, and re-indenting around it would change it. This is what keeps
   * `<pre>` blocks and mixed content byte-identical instead of reflowing the words.
   */
  const findElementEnd = (openIndex: number): { end: number; elementOnly: boolean } => {
    const open = tokens[openIndex]!;
    if (open.selfClosing) return { end: openIndex, elementOnly: true };

    let depth = 0;
    let sawContentText = false;
    for (let k = openIndex; k < tokens.length; k++) {
      const t = tokens[k]!;
      if (t.kind === "open") {
        if (t.selfClosing) {
          // A self-closing tag has no children, so it must not deepen the count.
          // Counting it here made `<a><b/></a>` look one level deeper than it is and
          // sent findElementEnd past its own closing tag.
          continue;
        }
        depth++;
        if (k !== openIndex && depth > MAX_XML_DEPTH) {
          throw new RefusedXml(
            `This document nests elements more than ${MAX_XML_DEPTH} levels deep, which this page refuses.`,
          );
        }
      } else if (t.kind === "close") {
        depth--;
        if (depth === 0) return { end: k, elementOnly: !sawContentText };
        if (depth < 0) break;
      } else if (t.kind === "cdata") {
        // CDATA is text content, so it is the data this formatter must not reflow.
        // Only a DIRECT child counts: text inside a grandchild is that grandchild's
        // business, and this element is still element-only.
        if (depth === 1) sawContentText = true;
      } else if (t.kind === "text" && !whitespaceText.has(k)) {
        if (depth === 1) sawContentText = true;
      }
    }
    // Unreachable once the well-formedness check has passed, because that check walks
    // the same stack. It throws rather than falling back to a guess, so a future change
    // to either walk cannot quietly start emitting re-indented output of the wrong shape.
    throw new MalformedXml(`The end of \`<${open.name}>\` could not be located.`, open.start);
  };

  if (options.mode === "minify") {
    /**
     * Whitespace between elements is presentational only when the enclosing element has
     * element-only content. Testing the neighbours instead is wrong in both directions:
     * requiring both neighbours to be text misses every `<a>\n  <b/>\n</a>`, and allowing
     * either neighbour to be a tag would close the gap in `<p>Hello <b>x</b></p>`, which
     * is a document whose spacing is the data.
     */
    const droppable = new Set<number>();
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k]!;
      if (t.kind !== "open" || t.selfClosing) continue;
      const { end, elementOnly } = findElementEnd(k);
      if (!elementOnly) continue;
      for (let j = k + 1; j < end; j++) {
        if (tokens[j]!.kind === "text" && whitespaceText.has(j)) droppable.add(j);
      }
    }

    let out = "";
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k]!;
      if (!keep(t)) continue;
      if (t.kind === "text" && droppable.has(k)) continue;
      out += t.raw;
      if (out.length > MAX_XML_OUTPUT_CHARS) throw new OutputTooLarge();
    }
    return { text: out, bytesRemoved: source.length - out.length };
  }

  const unit = indentUnitFor(options.indent);
  const lines: string[] = [];
  let pending = "";
  let pendingChars = 0;

  const pushLine = (level: number, text: string) => {
    pending += unit.repeat(level) + text;
    pendingChars += unit.length * level + text.length;
    if (pendingChars > MAX_XML_OUTPUT_CHARS) throw new OutputTooLarge();
    if (pending.length > 0) {
      lines.push(pending);
      pending = "";
      pendingChars = 0;
    }
  };

  const verbatimSpan = (from: number, to: number): string => {
    let span = "";
    for (let j = from; j <= to; j++) {
      const child = tokens[j]!;
      if (!keep(child)) continue;
      span += child.raw;
      if (span.length > MAX_XML_OUTPUT_CHARS) throw new OutputTooLarge();
    }
    return span;
  };

  /** Emits one element and everything under it. Returns the token index after it. */
  const emitElement = (index: number, level: number): number => {
    const open = tokens[index]!;
    if (open.selfClosing) {
      pushLine(level, open.raw.trim());
      return index + 1;
    }
    const { end, elementOnly } = findElementEnd(index);
    if (!elementOnly) {
      pushLine(level, verbatimSpan(index, end));
      return end + 1;
    }

    pushLine(level, open.raw.trim());
    let k = index + 1;
    while (k < end) {
      const child = tokens[k]!;
      if (child.kind === "text") {
        // Element-only content is whitespace between children by construction.
        k++;
        continue;
      }
      if (!keep(child)) {
        k++;
        continue;
      }
      if (child.kind === "open") {
        k = emitElement(k, level + 1);
        continue;
      }
      // comment, processing instruction, DOCTYPE or CDATA at this level.
      pushLine(level + 1, child.raw.trim());
      k++;
    }
    pushLine(level, tokens[end]!.raw.trim());
    return end + 1;
  };

  let k = 0;
  while (k < tokens.length) {
    const t = tokens[k]!;
    if (t.kind === "text") {
      // Document-level whitespace is not data either; keeping it leaves ragged gaps
      // between the prolog items.
      if (!whitespaceText.has(k)) pushLine(0, t.raw);
      k++;
      continue;
    }
    if (t.kind === "open") {
      k = emitElement(k, 0);
      continue;
    }
    if (!keep(t)) {
      k++;
      continue;
    }
    // xml-decl, DOCTYPE, processing instruction or comment at document level.
    pushLine(0, t.raw.trim());
    k++;
  }

  if (pending.length > 0) lines.push(pending);
  return { text: lines.join("\n"), bytesRemoved: 0 };
}

/** The one entry point. Everything above throws; everything below reports. */
export function formatXml(source: string, options: XmlFormatOptions): XmlResult {
  if (source.trim() === "") return { kind: "empty" };

  if (source.length > MAX_XML_CHARS) {
    return {
      kind: "refused",
      message: `This document is ${source.length.toLocaleString("en-US")} characters, over the ${MAX_XML_CHARS.toLocaleString("en-US")}-character limit. Nothing was changed.`,
    };
  }

  let checked: Checked;
  try {
    checked = checkWellFormed(source);
  } catch (err) {
    if (err instanceof RefusedXml) {
      return { kind: "refused", message: err.message };
    }
    if (err instanceof MalformedXml) {
      const { line, column } = positionAt(source, err.offset);
      return { kind: "malformed", message: err.message, line, column };
    }
    return { kind: "internal", message: "The document could not be checked." };
  }

  try {
    const { text, bytesRemoved } = build(checked, source, options);
    return {
      kind: "processed",
      text,
      stats: {
        elements: checked.stats.elements,
        comments: checked.stats.comments,
        maxDepth: checked.stats.maxDepth,
        bytesRemoved: options.mode === "minify" ? bytesRemoved : 0,
      },
    };
  } catch (err) {
    if (err instanceof RefusedXml) {
      return { kind: "refused", message: err.message };
    }
    if (err instanceof OutputTooLarge) {
      return {
        kind: "refused",
        message: `Formatting this document would produce more than ${MAX_XML_OUTPUT_CHARS.toLocaleString("en-US")} characters, so it was not shown.`,
      };
    }
    return { kind: "internal", message: "The document could not be formatted." };
  }
}