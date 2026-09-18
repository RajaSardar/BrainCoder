export interface TextMetrics {
  utf8Bytes: number;
  utf8BytesNoWhitespace: number;
  utf16Bytes: number;
  utf16BytesNoWhitespace: number;
  chars: number;
  charsNoWhitespace: number;
  whitespaceCount: number;
  words: number;
  lines: number;
  readingMinutes: number;
}

let encoder: TextEncoder | null = null;

export function countUtf8Bytes(text: string): number {
  if (!encoder) encoder = new TextEncoder();
  return encoder.encode(text).byteLength;
}

export function computeTextMetrics(text: string): TextMetrics {
  const noWhitespace = text.replace(/\s/g, "");
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return {
    utf8Bytes: countUtf8Bytes(text),
    utf8BytesNoWhitespace: countUtf8Bytes(noWhitespace),
    utf16Bytes: text.length * 2,
    utf16BytesNoWhitespace: noWhitespace.length * 2,
    chars: [...text].length,
    charsNoWhitespace: [...noWhitespace].length,
    whitespaceCount: [...text].length - [...noWhitespace].length,
    words,
    lines: text ? text.split("\n").length : 0,
    readingMinutes: Math.round((words / 200) * 100) / 100,
  };
}

export function collapseWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/[ \t]+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}