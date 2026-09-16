export type JsonFormatResult =
  | { ok: true; formatted: string; minified: string }
  | { ok: false; error: string; line: number | null; column: number | null };

export function formatJson(input: string, indent: number | string): JsonFormatResult {
  try {
    const value = JSON.parse(input);
    return {
      ok: true,
      formatted: JSON.stringify(value, null, indent),
      minified: JSON.stringify(value),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";

    if (message.includes("Maximum call stack size exceeded")) {
      return {
        ok: false,
        error: "This JSON is nested too deeply to format.",
        line: null,
        column: null,
      };
    }

    const lineColumnMatch = /\(line (\d+) (column )(\d+)\)/.exec(message);
    if (lineColumnMatch) {
      return {
        ok: false,
        error: stripLocationClauses(message),
        line: Number(lineColumnMatch[1]),
        column: Number(lineColumnMatch[3]),
      };
    }

    let pos: number | null = null;

    const positionMatch = /at position (\d+)/.exec(message);
    if (positionMatch) {
      pos = Number(positionMatch[1]);
    } else if (message.includes("Unexpected end of JSON input")) {
      pos = input.length;
    } else {
      const snippetMatch = /'([^']*)' is not valid JSON/.exec(message);
      if (snippetMatch) {
        const index = input.lastIndexOf(snippetMatch[1]);
        if (index >= 0) {
          pos = index + snippetMatch[1].length;
        }
      }
    }

    let line: number | null = null;
    let column: number | null = null;
    if (pos !== null) {
      const before = input.slice(0, pos);
      line = before.split("\n").length;
      column = pos - before.lastIndexOf("\n");
    }

    return {
      ok: false,
      error: stripLocationClauses(message),
      line,
      column,
    };
  }
}

function stripLocationClauses(message: string): string {
  let cleaned = message
    .replace(/at position \d+ \(line \d+ column \d+\)$/, "")
    .replace(/\(line \d+ column \d+\)$/, "")
    .replace(/at position \d+$/, "")
    .trim();

  if (!cleaned) {
    cleaned = "Invalid JSON.";
  }

  return cleaned;
}