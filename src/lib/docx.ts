import TurndownService from "turndown";
import { zipSync, type Zippable } from "fflate";

export async function docxToHtml(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: data });
  return result.value;
}

export async function docxToText(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return result.value;
}

export async function docxToMarkdown(data: ArrayBuffer): Promise<string> {
  const html = await docxToHtml(data);
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  return td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------- DOCX writer

export interface WordBlock {
  style:
    | "Title"
    | "Heading1"
    | "Heading2"
    | "Heading3"
    | "Body"
    | "Bullet"
    | "PageBreak";
  text?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function runsToXml(
  text: string,
  size: number,
  bold?: boolean,
  color?: string,
  italic?: boolean,
): string {
  const raw = text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter((s) => s.length > 0);
  return raw
    .map((r) => {
      let content = r;
      let b = bold;
      let it = italic;
      if (r.startsWith("**") && r.endsWith("**") && r.length > 4) {
        content = r.slice(2, -2);
        b = true;
      } else if (r.startsWith("*") && r.endsWith("*") && r.length > 2) {
        content = r.slice(1, -1);
        it = true;
      }
      const props = [
        `<w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri"/>`,
        `<w:sz w:val="${Math.round(size * 2)}"/>`,
        `<w:szCs w:val="${Math.round(size * 2)}"/>`,
        b ? `<w:b/><w:bCs/>` : "",
        it ? `<w:i/><w:iCs/>` : "",
        color ? `<w:color w:val="${color}"/>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(content)}</w:t></w:r>`;
    })
    .join("");
}

export function buildWordDocx(blocks: WordBlock[]): Uint8Array {
  const paragraphs = blocks
    .map((b) => {
      if (b.style === "PageBreak") {
        return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
      }
      const text = b.text ?? "";
      switch (b.style) {
        case "Title": {
          const runs = runsToXml(text, 28, true, "1F3864");
          return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="320" w:before="120"/></w:pPr>${runs}</w:p>`;
        }
        case "Heading1": {
          const runs = runsToXml(text, 20, true, "2E5A9E");
          return `<w:p><w:pPr><w:spacing w:before="280" w:after="140"/><w:outlineLvl w:val="0"/></w:pPr>${runs}</w:p>`;
        }
        case "Heading2": {
          const runs = runsToXml(text, 16, true, "3569B4");
          return `<w:p><w:pPr><w:spacing w:before="220" w:after="110"/><w:outlineLvl w:val="1"/></w:pPr>${runs}</w:p>`;
        }
        case "Heading3": {
          const runs = runsToXml(text, 14, true, "4472C4");
          return `<w:p><w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="2"/></w:pPr>${runs}</w:p>`;
        }
        case "Bullet": {
          const runs = runsToXml(text, 11);
          return `<w:p><w:pPr><w:ind w:left="420" w:hanging="240"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t xml:space="preserve">•\u2002</w:t></w:r>${runs}</w:p>`;
        }
        default: {
          const runs = runsToXml(text, 11);
          return `<w:p><w:pPr><w:spacing w:after="120" w:line="260" w:lineRule="auto"/></w:pPr>${runs}</w:p>`;
        }
      }
    })
    .join("\n");

  const zippable: Zippable = {
    "[Content_Types].xml": new TextEncoder().encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": new TextEncoder().encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>",
    ),
    "word/document.xml": new TextEncoder().encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        "<w:body>" +
        paragraphs +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
        "</w:body></w:document>",
    ),
  };

  return zipSync(zippable, { level: 6 });
}

// Parse a simple markdown-ish draft into Word blocks.
export function parseDraftToBlocks(draft: string): WordBlock[] {
  const blocks: WordBlock[] = [];
  const lines = draft.replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.trim() === "---") {
      blocks.push({ style: "PageBreak" });
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ style: "Heading1", text: line.slice(2) });
    } else if (line.startsWith("## ")) {
      blocks.push({ style: "Heading2", text: line.slice(3) });
    } else if (line.startsWith("### ")) {
      blocks.push({ style: "Heading3", text: line.slice(4) });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ style: "Bullet", text: line.slice(2) });
    } else if (line.startsWith("<title>") && line.endsWith("</title>")) {
      blocks.push({
        style: "Title",
        text: line.slice(7, -8).trim(),
      });
    } else {
      blocks.push({ style: "Body", text: line });
    }
  }
  return blocks;
}