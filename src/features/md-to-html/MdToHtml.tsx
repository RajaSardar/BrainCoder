"use client";

import { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import {
  Code2,
  Download,
  Eye,
  FileText,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button, CopyButton, StyledTextarea } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  DEFAULT_DOWNLOAD_STEM,
  HIGHLIGHT_LANGUAGES,
  MAX_INPUT_CHARS,
  convertMarkdown,
  convertStats,
  downloadFileName,
  paneHtml,
  wrapDocument,
} from "./convert";

const SAMPLE = `# Release notes — Markdown to HTML

Paste **Markdown**, get clean HTML. \`CommonMark\` and GitHub extensions, sanitized, and converted in this tab.

## Highlights
- Headings, lists, tables, quotes, links and images with alt text
- Fenced code blocks with a language hint
- ~~Strikethrough~~ and task lists
- Inline HTML such as <mark>markup</mark> is kept — <script>alert(1)</script> is not

## Checklist
- [x] Paste Markdown
- [x] Copy the HTML
- [ ] Ship it

| Output | Where it goes |
| ------ | ------------- |
| Clipboard | your editor |
| An .html file | your disk |

## Code
\`\`\`js
const { html } = convert("# Hello");
\`\`\`

> Nothing is uploaded — the conversion happens in this tab.
`;

const MAX_FILE_BYTES = MAX_INPUT_CHARS;

const IDLE_STATUS =
  "Paste Markdown to convert it — everything runs in this tab and nothing is uploaded.";

function userFacing(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as Error & { userFacing?: boolean }).userFacing) {
    return err.message;
  }
  return "That file could not be read. Try a plain .md or .txt file saved as UTF-8.";
}

/** `notes.md` → `notes`, so the download is named `notes.html`. */
function stemFromName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,8}$/, "");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function MdToHtml() {
  const [md, setMd] = useState(SAMPLE);
  const [view, setView] = useState<"html" | "preview">("html");
  const [tokenize, setTokenize] = useState(false);
  const [stem, setStem] = useState(DEFAULT_DOWNLOAD_STEM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const runIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdId = useId();
  const fileId = useId();
  const stemId = useId();

  const deferredMd = useDeferredValue(md);
  const hasInput = deferredMd.trim().length > 0;
  const result = useMemo(
    () => convertMarkdown(deferredMd, { highlightCode: tokenize }),
    [deferredMd, tokenize],
  );
  const parseError = hasInput ? result.error : null;
  const html = hasInput && !parseError ? result.html : "";
  const stats = useMemo(() => convertStats(deferredMd, html), [deferredMd, html]);
  const pane = useMemo(() => paneHtml(html), [html]);
  const fileName = downloadFileName(stem);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `That file is ${file.size.toLocaleString()} bytes — this converter reads at most ${MAX_INPUT_CHARS.toLocaleString()} characters. Trim or split it first.`,
        );
      }
      const text = await file.text();
      if (runId !== runIdRef.current) return;
      if (text.length > MAX_INPUT_CHARS) {
        throw userFacing(
          `That file holds ${text.length.toLocaleString()} characters — the cap here is ${MAX_INPUT_CHARS.toLocaleString()}. Trim or split it first.`,
        );
      }
      const nextStem = stemFromName(file.name) || DEFAULT_DOWNLOAD_STEM;
      setMd(text);
      setStem(nextStem);
      setMessage(
        `Loaded ${file.name} — ${text.length.toLocaleString()} characters. The download will be named ${downloadFileName(nextStem)}.`,
      );
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(toUiError(err));
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    void handleFile(file);
  };

  const handleDownload = () => {
    if (!html) return;
    const fullDocument = wrapDocument(html, fileName, { highlightCode: tokenize });
    downloadBlob(
      new TextEncoder().encode(fullDocument),
      fileName,
      "text/html;charset=utf-8",
    );
    setMessage(
      `Downloaded ${fileName} — a standalone page with no scripts, wrapping the same HTML you copy here.`,
    );
  };

  const status = message || (hasInput ? "" : IDLE_STATUS);

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={fileInputRef}
        id={fileId}
        type="file"
        accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
        className="sr-only"
        onChange={(e) => handlePicker(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? "Reading the file…" : ""}
      </span>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-slate-600">
          <span className="font-medium text-slate-700">
            {stats.inputChars.toLocaleString()}
          </span>{" "}
          characters in ·{" "}
          <span className="font-medium text-slate-700">{stats.words.toLocaleString()}</span>{" "}
          words ·{" "}
          <span className="font-medium text-slate-700">
            {stats.outputChars.toLocaleString()}
          </span>{" "}
          characters of HTML out ({formatBytes(stats.outputBytes)}) ·{" "}
          <span className="font-medium text-slate-700">{stats.blocks}</span> headings
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={fileId}
            className={`min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition inline-flex items-center gap-2 cursor-pointer ${
              busy
                ? "opacity-60 pointer-events-none"
                : "hover:bg-slate-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600"
            }`}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="w-4 h-4" aria-hidden="true" />
            )}
            Open .md file
          </label>
          <CopyButton
            text={html}
            label="Copy HTML"
            ariaLabel="Copy the generated HTML"
            disabled={!html}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownload}
            disabled={!html}
          >
            <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
            Download {fileName}
          </Button>
        </div>
      </div>

      <p role="status" className="text-xs sm:text-sm text-slate-600">
        {status}
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      {parseError && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {parseError}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 items-start">
        <div>
          <label htmlFor={mdId} className="block text-sm font-medium text-slate-700 mb-2">
            Markdown
          </label>
          <StyledTextarea
            id={mdId}
            rows={16}
            value={md}
            maxLength={MAX_INPUT_CHARS}
            spellCheck={false}
            onChange={(e) => setMd(e.target.value)}
          />
          {md.length >= MAX_INPUT_CHARS && (
            <p className="text-xs text-amber-700 mt-1">
              Input is capped at {MAX_INPUT_CHARS.toLocaleString()} characters — anything
              pasted beyond that is not converted.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-slate-700">HTML</p>
            <div
              className="flex rounded-xl border border-slate-200 bg-white p-1"
              role="group"
              aria-label="Output view"
            >
              <button
                type="button"
                aria-pressed={view === "html"}
                onClick={() => setView("html")}
                className={`min-h-9 px-3 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
                  view === "html"
                    ? "bg-sky-700 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                HTML
              </button>
              <button
                type="button"
                aria-pressed={view === "preview"}
                onClick={() => setView("preview")}
                className={`min-h-9 px-3 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
                  view === "preview"
                    ? "bg-sky-700 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Preview
              </button>
            </div>
          </div>

          {hasInput && !parseError ? (
            view === "html" ? (
              <pre
                aria-label="Generated HTML"
                tabIndex={0}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono leading-relaxed text-slate-800 overflow-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                style={{ minHeight: 360, maxHeight: 560 }}
                dangerouslySetInnerHTML={{ __html: pane }}
              />
            ) : (
              <div
                role="region"
                aria-label="Rendered preview"
                data-md-preview=""
                className="rounded-xl border border-slate-200 bg-white px-5 py-4 overflow-auto md-preview"
                style={{ minHeight: 360, maxHeight: 560 }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          ) : (
            <p
              className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500"
              style={{ minHeight: 200 }}
            >
              {parseError
                ? "Nothing to show — the converter could not read this input."
                : "Paste Markdown on the left. The HTML appears here as you type, and the Preview tab renders exactly that HTML."}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[13rem]">
          <label
            htmlFor={stemId}
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Download name
          </label>
          <input
            id={stemId}
            type="text"
            value={stem}
            maxLength={60}
            onChange={(e) => setStem(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Saved as <span className="font-mono">{fileName}</span>
            {stem.trim() ? "" : ` — placeholder, this is a paste tool with no file`}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={tokenize}
            onChange={(e) => setTokenize(e.target.checked)}
            className="accent-sky-700 h-4 w-4 mt-0.5"
          />
          <span>
            Wrap fenced code in highlight tokens
            <span className="block text-xs text-slate-500 max-w-md">
              Adds{" "}
              <span className="font-mono">
                &lt;span className=&quot;tok tok-keyword&quot;&gt;
              </span>{" "}
              markup around code. A small built-in highlighter for{" "}
              {HIGHLIGHT_LANGUAGES.join(", ")} — regex-based, not a full
              parser, so odd syntax can be mis-marked. Turn it off for clean
              HTML.
            </span>
          </span>
        </label>

        <Button type="button" variant="secondary" onClick={() => setMd("")}>
          Clear
        </Button>
        <Button type="button" variant="secondary" onClick={() => setMd(SAMPLE)}>
          Reset sample
        </Button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-2">
        <p className="flex items-start gap-1.5">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>What the output really is:</strong> raw HTML you write in
            your Markdown is kept as HTML, then the whole result is sanitized:
            {"<script>"}, event handlers (<code>onclick</code> and friends),
            unsafe URLs (<code>javascript:</code>), iframes, styles, embedded
            SVG and form controls are removed, and tags outside the allowlist
            are unwrapped. An <code>&lt;a&gt;</code> that loses an unsafe URL
            keeps its text but loses the <code>href</code>. HTML comments are
            dropped. The Copy button, the Preview and the download all show the
            same sanitized string.
          </span>
        </p>
        <p className="flex items-start gap-1.5">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Converted in this tab — the Markdown, the generated HTML and any file
            you open are read locally and never uploaded. The download is a
            standalone page: a doctype, a charset tag and one inline
            stylesheet around your HTML, with no scripts.
          </span>
        </p>
      </div>
    </div>
  );
}
