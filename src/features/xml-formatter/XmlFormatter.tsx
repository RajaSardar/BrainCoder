"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, StyledTextarea, CopyButton } from "@/components/ui";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<users>
<user id="1"><name>Alex</name><active>true</active></user>
<user id="2"><name>Riya</name><enabled><feature flag="dark-mode"/></enabled></user>
</users>`;

function tokenize(xml: string): { tokens: string[]; error: string } {
  const re =
    /<!--[\s\S]*?-->|<![CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/?[A-Za-z][^>]*>|[^<]+/g;
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  let badAt = -1;
  let idx = 0;
  while ((m = re.exec(xml)) !== null) {
    if (m.index !== idx) {
      const fragment = xml.slice(idx, m.index).trim();
      if (fragment) {
        badAt = idx;
        break;
      }
    }
    tokens.push(m[0]);
    idx = m.index + m[0].length;
  }
  if (badAt >= 0) {
    return { tokens: [], error: `Unexpected content at position ${badAt}` };
  }
  const tail = xml.slice(idx).trim();
  if (tail) return { tokens: [], error: `Unexpected content at position ${idx}` };
  return { tokens, error: "" };
}

const isClose = (t: string) => /^<\/[^>]+>$/.test(t);
const isOpen = (t: string) => /^<[^>]+>$/.test(t) && !/^<\//.test(t);
const isSelf = (t: string) => /^<[^>]+\/>$/.test(t);
const isText = (t: string) => !t.startsWith("<");
const isComment = (t: string) => t.startsWith("<!--");
const isCdata = (t: string) => t.startsWith("<![CDATA[");
const isDecl = (t: string) => t.startsWith("<!") || t.startsWith("<?");
const tagName = (t: string) => /^<\/?([A-Za-z][\w:.-]*)/.exec(t)?.[1] ?? "";

export default function XmlFormatter() {
  const [input, setInput] = useState(SAMPLE);
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [stripComments, setStripComments] = useState(true);
  const [indentSize, setIndentSize] = useState(2);

  const result = (() => {
    const { tokens, error } = tokenize(input);
    if (error) return { ok: false as const, value: "", error };

    if (mode === "minify") {
      let out = "";
      for (const t of tokens) {
        if (isComment(t) && stripComments) continue;
        if (isText(t)) {
          out += t.trim();
        } else {
          out += t;
        }
      }
      return { ok: true as const, value: out, error: "" };
    }

    const indent = " ".repeat(indentSize);
    const lines: string[] = [];
    const stack: string[] = [];
    let level = 0;

    const push = (s: string) => lines.push(indent.repeat(level) + s);

    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (isComment(t)) {
        if (!stripComments) push(t);
        i++;
        continue;
      }
      if (isCdata(t) || isDecl(t)) {
        push(t.trim());
        i++;
        continue;
      }
      if (isSelf(t)) {
        push(t);
        i++;
        continue;
      }
      if (isClose(t)) {
        const name = tagName(t);
        const top = stack.pop();
        if (top !== name) {
          return { ok: false as const, value: "", error: `Mismatched tag: expected </${top}> but found </${name}>` };
        }
        level--;
        push(t);
        i++;
        continue;
      }
      if (isOpen(t)) {
        const name = tagName(t);
        let j = i + 1;
        let textBuf = "";
        while (j < tokens.length && isText(tokens[j])) {
          textBuf += tokens[j];
          j++;
        }
        const next = tokens[j];
        const inline =
          !!next && isClose(next) && tagName(next) === name && textBuf.trim().length <= 96 && !textBuf.includes("\n");
        if (inline) {
          push(`${t}${textBuf.trim()}${next}`);
          i = j + 1;
          continue;
        }
        stack.push(name);
        push(t);
        level++;
        i++;
        continue;
      }
      if (isText(t)) {
        if (!t.trim() && lines.length > 0) {
          i++;
          continue;
        }
        push(t.trim());
        i++;
        continue;
      }
      push(t);
      i++;
    }

    if (stack.length > 0) {
      return { ok: false as const, value: "", error: `Unclosed tag <${stack[stack.length - 1]}>` };
    }
    return { ok: true as const, value: lines.join("\n"), error: "" };
  })();

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["format", "minify"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                mode === m ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "format" ? "Format" : "Minify"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <input
            type="checkbox"
            checked={stripComments}
            onChange={(e) => setStripComments(e.target.checked)}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Strip comments
        </label>
        {mode === "format" && (
          <select
            value={indentSize}
            onChange={(e) => setIndentSize(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={1}>1 space</option>
          </select>
        )}
        <span className="flex items-center gap-1.5 text-sm pb-2">
          {result.ok ? (
            <span className="text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Valid XML
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> {result.error}
            </span>
          )}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">XML</p>
          <StyledTextarea rows={16} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">{mode === "format" ? "Formatted" : "Minified"}</p>
            <CopyButton text={result.value} />
          </div>
          <StyledTextarea rows={16} value={result.value} readOnly className="bg-slate-100 font-mono text-xs" />
        </div>
      </div>

      <Button type="button" variant="secondary" onClick={() => setInput("")}>
        Clear
      </Button>
    </div>
  );
}