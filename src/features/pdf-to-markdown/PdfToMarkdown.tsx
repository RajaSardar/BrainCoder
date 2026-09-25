"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BookMarked, Loader2, FileText, ArrowRight, Braces } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;

let pdfjsReady = false;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface LayoutLine {
  text: string;
  blank: boolean;
}

function layoutPageLines(
  viewport: { convertToViewportPoint(x: number, y: number): number[] },
  items: {
    str?: string;
    transform?: number[];
    width?: number;
  }[],
): LayoutLine[] {
  interface Word {
    x: number;
    y: number;
    w: number;
    text: string;
  }
  const words: Word[] = [];
  for (const it of items) {
    if (typeof it.str !== "string" || !it.str.trim()) continue;
    const t = it.transform ?? [1, 0, 0, 1, 0, 0];
    const pt = viewport.convertToViewportPoint(t[4] ?? 0, t[5] ?? 0);
    const x = pt[0] ?? 0;
    const y = pt[1] ?? 0;
    words.push({
      x,
      y,
      w: it.width ?? Math.max(4, it.str.length * 5),
      text: it.str,
    });
  }
  if (words.length === 0) return [];

  words.sort((a, b) => (Math.abs(a.y - b.y) > 2.5 ? a.y - b.y : a.x - b.x));

  const groups: Word[][] = [[words[0]]];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    const sameLine = Math.abs(prev.y - cur.y) <= 2.5 && prev.x <= cur.x;
    if (sameLine) groups[groups.length - 1].push(cur);
    else groups.push([cur]);
  }

  const dys: number[] = [];
  for (let i = 1; i < groups.length; i++) {
    const dy = groups[i][0].y - groups[i - 1][0].y;
    if (dy > 0 && dy < 100) dys.push(dy);
  }
  dys.sort((a, b) => a - b);
  const pitch = dys.length ? dys[Math.floor(dys.length / 2)] : 12;

  return groups.map((wordsInLine, i) => {
    const sorted = [...wordsInLine].sort((a, b) => a.x - b.x);
    let text = sorted[0].text;
    let endX = sorted[0].x + sorted[0].w;
    for (let j = 1; j < sorted.length; j++) {
      const w = sorted[j];
      const gap = w.x - endX;
      text += gap > 24 ? "  " : gap > 1 ? " " : "";
      text += w.text;
      endX = Math.max(endX, w.x + w.w);
    }
    const dyPrev = i > 0 ? groups[i][0].y - groups[i - 1][0].y : 0;
    return { text: text.trim(), blank: i > 0 && dyPrev > pitch * 1.7 };
  });
}

function friendlyError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/password|encrypted/i.test(m))
    return "This PDF is password-protected. Remove the password with PDF Unlock, then try again.";
  if (/Invalid PDF|Failed to parse|No PDF header|encryption/i.test(m))
    return "This file doesn't look like a valid PDF.";
  return "Couldn't read that PDF — try again with a different file.";
}

function userFacing(msg: string): Error {
  const e = new Error(msg);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing)
    return err.message;
  return friendlyError(err);
}

function shouldBeHeading(line: string): boolean {
  if (line.length < 2 || line.length > 60) return false;
  if (/[.!?:;,]$/.test(line)) return false;
  if (/^\s*[-*•·▪◦]/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length > 7) return false;
  if (/\b(the|a|an|and|or|of|to|in|for|this|that|with|from)\b/i.test(line))
    return false;
  if (!/[A-Z0-9]/.test(line)) return false;
  return true;
}

export default function PdfToMarkdown() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [md, setMd] = useState("");
  const [html, setHtml] = useState("");
  const [pages, setPages] = useState(0);
  const [emptyPages, setEmptyPages] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const runId = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMd("");
    setHtml("");
    setEmptyPages([]);
    setProgress("");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `This PDF is ${Math.round(file.size / 1048576)} MB — files up to 100 MB are supported.`,
        );
      }
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const pdfjs = await import("pdfjs-dist");
      if (!pdfjsReady) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        pdfjsReady = true;
      }
      const task = pdfjs.getDocument({ data });
      let doc;
      try {
        doc = await task.promise;
        if (doc.numPages > MAX_PAGES) {
          throw userFacing(
            `This PDF has ${doc.numPages} pages — files up to 200 pages are supported. Use PDF Split first.`,
          );
        }
        const pageMds: string[] = [];
        const pageHtml: string[] = [];
        const empty: number[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          if (runId !== runIdRef.current) return;
          setProgress(`Converting page ${p} of ${doc.numPages}…`);
          const page = await doc.getPage(p);
          const viewport = page.getViewport({ scale: 1 });
          try {
            const content = await page.getTextContent();
            const lines = layoutPageLines(
              viewport,
              (content.items ?? []) as {
                str?: string;
                transform?: number[];
                width?: number;
                hasEOL?: boolean;
              }[],
            );
            const meaningful = lines.filter((l) => !l.blank && l.text);
            if (meaningful.length === 0) {
              empty.push(p);
              pageMds.push("");
              pageHtml.push("");
              continue;
            }

            const mdLines: string[] = [];
            const htmlLines: string[] = [];
            let inList = false;
            const block: string[] = [];
            for (const { text } of meaningful) {
              const bullet = text.match(/^([•●▪・◦•\-\*])\s*(.+)$/);
              if (
                bullet &&
                /^[-\*•]/.test(text) &&
                text.length < 120
              ) {
                if (!inList && block.length > 0) {
                  mdLines.push(block.join(" "));
                  htmlLines.push(`<p>${escapeHtml(block.join(" "))}</p>`);
                  block.length = 0;
                }
                if (!inList) {
                  mdLines.push("");
                  htmlLines.push("<ul>");
                  inList = true;
                }
                mdLines.push(`- ${bullet[2]}`);
                htmlLines.push(`  <li>${escapeHtml(bullet[2])}</li>`);
              } else {
                if (inList) {
                  mdLines.push("");
                  htmlLines.push("</ul>");
                  inList = false;
                }
                if (shouldBeHeading(text)) {
                  if (block.length > 0) {
                    mdLines.push(block.join(" "));
                    htmlLines.push(`<p>${escapeHtml(block.join(" "))}</p>`);
                    block.length = 0;
                  }
                  mdLines.push(`## ${text}`);
                  htmlLines.push(`<h2>${escapeHtml(text)}</h2>`);
                } else {
                  block.push(text);
                }
              }
            }
            if (inList) {
              mdLines.push("");
              htmlLines.push("</ul>");
            }
            if (block.length > 0) {
              mdLines.push(block.join(" "));
              htmlLines.push(`<p>${escapeHtml(block.join(" "))}</p>`);
            }

            if (p > 1) {
              pageMds.push("");
              pageMds.push("---");
              pageMds.push("");
            }
            pageMds.push(mdLines.join("\n"));
            pageHtml.push(htmlLines.join("\n"));
          } finally {
            await page.cleanup();
          }
        }

        const title = file.name.replace(/\.pdf$/i, "") || "Untitled";
        const body = pageMds.join("\n\n").replace(/^\s+/gm, "").replace(/\s+\n/g, "\n");
        const mdOut = `# ${title}\n\n${body}\n`;
        const htmlOut =
          `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
          `<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:2rem;line-height:1.6;color:#111}h1{font-size:1.8rem}h2{font-size:1.15rem;margin-top:1.5rem}li{margin-bottom:.25rem}</style></head><body>` +
          `<h1>${escapeHtml(title)}</h1>` +
          pageHtml.join("\n") +
          "</body></html>";

        if (runId !== runIdRef.current) return;
        setName(file.name);
        setBase(title);
        setMd(mdOut);
        setHtml(htmlOut);
        setPages(doc.numPages);
        setEmptyPages(empty);
      } finally {
        await task.destroy().catch(() => {});
      }
    } catch (err) {
      if (runId === runIdRef.current) {
        setName("");
        setError(toUiError(err));
      }
    } finally {
      if (runId === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const downloadMd = () => {
    const enc = new TextEncoder().encode(md);
    downloadBlob(enc, `${base}.md`, "text/markdown");
  };
  const downloadHtml = () => {
    const enc = new TextEncoder().encode(html);
    downloadBlob(enc, `${base}.html`, "text/html");
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF to convert to Markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
      <span className="sr-only" role="status">
        {busy ? progress || "Reading the PDF…" : ""}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {busy ? (progress || "Working…") : name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name} — ${pages} pages · ${md.length.toLocaleString()} chars`
            : "Extracts a PDF's text layer into Markdown — headings and lists are best-effort guesses."}
        </span>
      </div>

      {error && (
        <div
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
          {/OCR/i.test(error) && (
            <Link
              href="/use/pdf-ocr"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 underline ml-1"
            >
              Open PDF OCR <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {emptyPages.length > 0 && (
        <div
          className="rounded-xl bg-slate-50 border border-slate-200 text-slate-600 px-4 py-3 text-sm"
          role="status"
        >
          Pages {emptyPages.join(", ")} have no selectable text — if this is a
          scanned PDF, OCR it first.{" "}
          <Link
            href="/use/pdf-ocr"
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 underline"
          >
            Open PDF OCR <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {md && (
        <>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={downloadMd}>
              <BookMarked className="w-4 h-4 mr-1.5 inline" /> Download .md
            </Button>
            <Button type="button" variant="secondary" onClick={downloadHtml}>
              <Braces className="w-4 h-4 mr-1.5 inline" /> Download .html
            </Button>
          </div>
          <p className="text-sm text-slate-500" role="status">
            The .html is a rendering of the Markdown above — it is not a
            visual copy of the original PDF.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Markdown preview
            </div>
            <pre className="px-5 py-4 text-sm text-slate-700 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
              {md.slice(0, 4000)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}