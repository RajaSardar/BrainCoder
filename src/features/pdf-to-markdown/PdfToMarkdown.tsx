"use client";

import { useRef, useState } from "react";
import { BookMarked, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function PdfToMarkdown() {
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [md, setMd] = useState("");
  const [html, setHtml] = useState("");
  const [pages, setPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMd("");
    setHtml("");
    try {
      const data = await file.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({ data }).promise;

      interface TextItem {
        str?: string;
        hasEOL?: boolean;
        transform?: number[];
      }
      const pageMds: string[] = [];
      const pageHtml: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const items = (content.items ?? []) as TextItem[];

        interface Word {
          x: number;
          y: number;
          text: string;
        }
        const words: Word[] = [];
        for (const it of items) {
          if (typeof it.str === "string" && it.str.trim()) {
            const t = it.transform ?? [];
            words.push({ x: t[4] ?? 0, y: t[5] ?? 0, text: it.str });
          }
        }
        words.sort((a, b) =>
          Math.abs(a.y - b.y) > 2.5 ? b.y - a.y : a.x - b.x,
        );

        const lines: string[] = [];
        let cur = words.length ? words[0].text : "";
        let prevEnd = words.length ? words[0].x + words[0].text.length * 3 : 0;
        for (let i = 1; i < words.length; i++) {
          const w = words[i];
          const sameLine =
            Math.abs(words[i - 1].y - w.y) <= 2.5 && words[i - 1].x <= w.x;
          if (sameLine) {
            if (w.x - prevEnd > 24) cur += "  ";
            cur += w.text;
          } else {
            lines.push(cur.trim());
            cur = w.text;
          }
          prevEnd = Math.max(prevEnd, w.x + w.text.length * 3);
        }
        if (cur.trim()) lines.push(cur.trim());

        const meaningful = lines.map((l) => l.trim()).filter(Boolean);
        const paras = meaningful.filter((l) => l.length > 0);
        if (paras.length === 0) {
          pageMds.push(`<!-- Page ${p} (no text) -->`);
          pageHtml.push(
            `<p class="empty">(No extractable text on page ${p})</p>`,
          );
          continue;
        }

        const mdLines: string[] = [];
        const htmlLines: string[] = [];
        let inList = false;
        for (const line of paras) {
          const m = line.match(/^(\s*[•●▪・◦•\-\*])\s*(.+)$/);
          if (m && /^[-\*•]/.test(line.trim()) && line.length < 120) {
            if (!inList) {
              mdLines.push("");
              htmlLines.push("<ul>");
              inList = true;
            }
            mdLines.push(`- ${m[2]}`);
            htmlLines.push(`  <li>${escapeHtml(m[2])}</li>`);
          } else {
            if (inList) {
              mdLines.push("");
              htmlLines.push("</ul>");
              inList = false;
            }
            if (
              line.length <= 80 &&
              !/[.!?:;,]$/.test(line) &&
              /\S \S/.test(line)
            ) {
              mdLines.push(`## ${line}`);
              htmlLines.push(`<h2>${escapeHtml(line)}</h2>`);
            } else {
              mdLines.push(line);
              htmlLines.push(`<p>${escapeHtml(line)}</p>`);
            }
          }
        }
        if (inList) {
          mdLines.push("");
          htmlLines.push("</ul>");
        }

        if (p > 1) {
          pageMds.push("");
          pageMds.push(`---`);
          pageMds.push("");
        }
        pageMds.push(mdLines.join("\n"));
        pageHtml.push(htmlLines.join("\n"));
      }

      const title = file.name.replace(/\.pdf$/i, "") || "Untitled";
      const mdOut = `# ${title}\n\n` + pageMds.join("\n\n") + "\n";
      const htmlOut =
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:2rem;line-height:1.6;color:#111}h1{font-size:1.8rem}h2{font-size:1.15rem;margin-top:1.5rem}li{margin-bottom:.25rem}</style></head><body>` +
        `<h1>${escapeHtml(title)}</h1>` +
        pageHtml.join("\n") +
        "</body></html>";

      setName(file.name);
      setBase(title);
      setMd(mdOut);
      setHtml(htmlOut);
      setPages(doc.numPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setName("");
    } finally {
      setBusy(false);
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
    <div className="space-y-5 w-full">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
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
          {name ? "Choose another PDF" : "Open PDF"}
        </Button>
        <span className="text-sm text-slate-500">
          {name
            ? `${name} — ${pages} pages · ${md.length.toLocaleString()} chars`
            : "Turn a PDF into clean Markdown or HTML (keeps headings, lists and paragraphs)."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {md && (
        <>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={downloadMd}>
              <BookMarked className="w-4 h-4 mr-1.5 inline" /> Download .md
            </Button>
            <Button type="button" variant="secondary" onClick={downloadHtml}>
              Download .html
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden max-h-96 overflow-y-auto">
            <div className="px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Preview
            </div>
            <pre className="px-5 py-4 text-sm text-slate-700 whitespace-pre-wrap font-sans">
              {md.slice(0, 4000)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
