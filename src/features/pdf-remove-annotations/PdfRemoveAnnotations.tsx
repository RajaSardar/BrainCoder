"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eraser,
  FileText,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import type { PDFDocument, PDFObject, PDFRef } from "pdf-lib";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const LOAD_OPTS = { updateMetadata: false };
const SAVE_OPTS = {
  useObjectStreams: false,
  updateFieldAppearances: false,
  addDefaultPage: false,
};
const MAX_PAGE_CHIPS = 24;
/** Pages between progress repaints while the annotation layer is being stripped. */
const PAINT_EVERY = 10;
/** Longest stem kept in the download name, so the OS never truncates the suffix. */
const MAX_STEM = 96;

type PdfLib = typeof import("pdf-lib");
type AnnKind = "markup" | "link" | "stamp" | "widget" | "other";
type KindCounts = Record<AnnKind, number>;

/** Per-bucket wording, singular and plural: "1 link" must not read as "1 links". */
const KIND_LABEL: Record<AnnKind, { one: string; many: string }> = {
  markup: { one: "comment, highlight or note", many: "comments, highlights and notes" },
  link: { one: "link", many: "links" },
  stamp: { one: "stamp", many: "stamps" },
  widget: { one: "form field", many: "form fields" },
  other: { one: "other annotation", many: "other annotations" },
};

const MARKUP_SUBTYPES = new Set([
  "Text",
  "Highlight",
  "Underline",
  "Squiggly",
  "StrikeOut",
  "FreeText",
  "Ink",
  "Popup",
  "Caret",
  "FileAttachment",
  "Sound",
  "Movie",
  "Screen",
  "Polygon",
  "PolyLine",
  "Redact",
  "Projection",
]);

interface PageScan {
  page: number;
  total: number;
}

interface ScanResult {
  pages: PageScan[];
  total: number;
  kinds: KindCounts;
}

interface StripProgress {
  phase: "pages" | "prune";
  page: number;
  total: number;
}

interface StripResult {
  removed: number;
  keptWidgets: number;
  pruned: number;
  candidates: number;
  /**
   * Set when the reachability walk itself threw. Pruning is then best-effort
   * and its outcome is unknown, so the copy has to disclose the residual rather
   * than report a clean scrub it cannot prove.
   */
  pruneFailed: boolean;
}

function emptyCounts(): KindCounts {
  return { markup: 0, link: 0, stamp: 0, widget: 0, other: 0 };
}

function classify(subtype: string): AnnKind {
  if (subtype === "Widget") return "widget";
  if (subtype === "Link") return "link";
  if (subtype === "Stamp") return "stamp";
  if (MARKUP_SUBTYPES.has(subtype)) return "markup";
  return "other";
}

function hasPdfHeader(data: Uint8Array): boolean {
  const limit = Math.min(data.length, 1024);
  for (let i = 0; i + 5 <= limit; i++) {
    if (
      data[i] === 0x25 &&
      data[i + 1] === 0x50 &&
      data[i + 2] === 0x44 &&
      data[i + 3] === 0x46 &&
      data[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

function annotEntries(
  lib: PdfLib,
  doc: PDFDocument,
  index: number,
): Array<{ ref: PDFObject; kind: AnnKind }> {
  const array = doc.getPage(index).node.Annots();
  if (!(array instanceof lib.PDFArray)) return [];
  return array.asArray().map((ref) => {
    const obj = ref instanceof lib.PDFRef ? doc.context.lookup(ref) : ref;
    const sub =
      obj instanceof lib.PDFDict ? obj.get(lib.PDFName.of("Subtype")) : undefined;
    const subtype = sub instanceof lib.PDFName ? sub.asString().replace(/^\//, "") : "Unknown";
    return { ref, kind: classify(subtype) };
  });
}

function scanDocument(
  lib: PdfLib,
  doc: PDFDocument,
  onPage?: (page: number, total: number) => void,
): ScanResult {
  const pages: PageScan[] = [];
  const kinds = emptyCounts();
  let total = 0;
  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    onPage?.(i + 1, pageCount);
    const entries = annotEntries(lib, doc, i);
    let pageTotal = 0;
    for (const entry of entries) {
      kinds[entry.kind] += 1;
      pageTotal += 1;
    }
    total += pageTotal;
    pages.push({ page: i + 1, total: pageTotal });
  }
  return { pages, total, kinds };
}

function collectRefs(
  lib: PdfLib,
  obj: PDFObject | undefined,
  out: PDFRef[],
): void {
  if (!obj) return;
  if (obj instanceof lib.PDFRef) {
    out.push(obj);
    return;
  }
  if (obj instanceof lib.PDFDict) {
    for (const key of obj.keys()) collectRefs(lib, obj.get(key), out);
    return;
  }
  if (obj instanceof lib.PDFArray) {
    for (const child of obj.asArray()) collectRefs(lib, child, out);
  }
}

function reachableRefs(lib: PdfLib, doc: PDFDocument): Set<string> {
  const roots: PDFRef[] = [];
  const trailer = doc.context.trailerInfo;
  collectRefs(lib, trailer.Root, roots);
  collectRefs(lib, trailer.Info, roots);
  collectRefs(lib, trailer.Encrypt, roots);
  const live = new Set<string>();
  const stack = roots.slice();
  while (stack.length) {
    const ref = stack.pop() as PDFRef;
    const key = ref.toString();
    if (live.has(key)) continue;
    live.add(key);
    const children: PDFRef[] = [];
    collectRefs(lib, doc.context.lookup(ref), children);
    for (const child of children) {
      if (!live.has(child.toString())) stack.push(child);
    }
  }
  return live;
}

/**
 * Annotation keys whose values are objects the annotation owns outright. The
 * walk deliberately never follows /P (page back-reference), /Parent (form field
 * tree), /StructParent or /AF, because those point at shared, still-live
 * structure rather than at annotation data.
 */
const OWNED_KEYS = ["IRT", "OC", "Popup", "QuadPoints", "R", "Vertices", "InkList"];
const APPEARANCE_STATES = ["N", "D"];

/**
 * Every indirect object a removed annotation hangs off: the /Popup a comment
 * opens, /IRT and /R reply threads, /OCG layer membership, ink and polygon
 * vertex arrays and the /AP appearance streams. A popup that is not itself
 * listed in the page /Annots array is still a live object in the file, so it
 * has to be pruned explicitly or the comment text stays in the saved bytes. A
 * seen-set makes the walk cycle-safe, because /IRT and /R routinely point back
 * at their own thread.
 */
function ownedRefs(
  lib: PdfLib,
  doc: PDFDocument,
  start: PDFObject | undefined,
  out: PDFRef[],
): void {
  if (!start) return;
  const seen = new Set<string>();
  const stack: PDFObject[] = [start];
  while (stack.length) {
    const obj = stack.pop() as PDFObject;
    if (obj instanceof lib.PDFRef) {
      const key = obj.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(obj);
      const resolved = doc.context.lookup(obj);
      if (resolved instanceof lib.PDFDict) stack.push(resolved);
      continue;
    }
    if (obj instanceof lib.PDFArray) {
      for (const child of obj.asArray()) stack.push(child);
      continue;
    }
    if (!(obj instanceof lib.PDFDict)) continue;
    for (const key of OWNED_KEYS) {
      const value = obj.get(lib.PDFName.of(key));
      if (value) stack.push(value);
    }
    const appearance = obj.get(lib.PDFName.of("AP"));
    if (!appearance) continue;
    const resolved =
      appearance instanceof lib.PDFRef
        ? doc.context.lookup(appearance)
        : appearance;
    if (resolved instanceof lib.PDFArray) {
      for (const child of resolved.asArray()) stack.push(child);
    } else if (resolved instanceof lib.PDFDict) {
      for (const state of APPEARANCE_STATES) {
        const value = resolved.get(lib.PDFName.of(state));
        if (value) stack.push(value);
      }
    } else if (resolved) {
      stack.push(resolved);
    }
  }
}

function formFieldRefs(lib: PdfLib, doc: PDFDocument): PDFRef[] {
  const acro = doc.context.lookup(doc.catalog.get(lib.PDFName.of("AcroForm")));
  if (!(acro instanceof lib.PDFDict)) return [];
  const fields = doc.context.lookup(acro.get(lib.PDFName.of("Fields")));
  if (!(fields instanceof lib.PDFArray)) return [];
  const out: PDFRef[] = [];
  const seen = new Set<string>();
  const stack = fields.asArray().slice();
  while (stack.length) {
    const ref = stack.pop();
    if (!(ref instanceof lib.PDFRef)) continue;
    const key = ref.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const dict = doc.context.lookup(ref);
    if (!(dict instanceof lib.PDFDict)) continue;
    out.push(ref);
    for (const name of ["Kids", "Parent"]) {
      const related = doc.context.lookup(dict.get(lib.PDFName.of(name)));
      if (related instanceof lib.PDFArray) {
        for (const child of related.asArray()) stack.push(child);
      } else if (related instanceof lib.PDFRef) {
        stack.push(related);
      }
    }
  }
  return out;
}

async function stripAnnotations(
  lib: PdfLib,
  doc: PDFDocument,
  keepFormFields: boolean,
  onProgress?: (progress: StripProgress) => void | Promise<void>,
): Promise<StripResult> {
  const removedRefs: PDFRef[] = [];
  const childRefs: PDFRef[] = [];
  const seen = new Set<string>();
  const pageTotal = doc.getPageCount();
  let removed = 0;
  let keptWidgets = 0;
  const take = (list: PDFRef[], ref: PDFRef) => {
    const key = ref.toString();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(ref);
  };
  for (let i = 0; i < pageTotal; i++) {
    const page = doc.getPage(i);
    const entries = annotEntries(lib, doc, i);
    if (entries.length === 0) {
      page.node.delete(lib.PDFName.of("Annots"));
    } else {
      const kept: PDFObject[] = [];
      for (const entry of entries) {
        if (keepFormFields && entry.kind === "widget") {
          kept.push(entry.ref);
          keptWidgets += 1;
          continue;
        }
        removed += 1;
        if (entry.ref instanceof lib.PDFRef) {
          take(removedRefs, entry.ref);
          ownedRefs(lib, doc, doc.context.lookup(entry.ref), childRefs);
        }
      }
      if (kept.length === 0) page.node.delete(lib.PDFName.of("Annots"));
      else page.node.set(lib.PDFName.of("Annots"), doc.context.obj(kept));
    }
    // Yield between batches so the progress line actually repaints on a
    // long document instead of freezing on "Removing annotations…".
    const done = i + 1;
    if (done === 1 || done % PAINT_EVERY === 0 || done === pageTotal) {
      await onProgress?.({ phase: "pages", page: done, total: pageTotal });
    }
  }
  if (!keepFormFields || keptWidgets === 0) {
    for (const ref of formFieldRefs(lib, doc)) take(removedRefs, ref);
    doc.catalog.delete(lib.PDFName.of("AcroForm"));
  }
  // Reachability is evaluated only after the page trees and the AcroForm have
  // been unlinked, so an object that is now only reachable from a removed
  // annotation counts as dead. Anything still reachable is left untouched:
  // a shared stream or a page back-reference must survive.
  let pruned = 0;
  let candidates = 0;
  let pruneFailed = false;
  try {
    await onProgress?.({ phase: "prune", page: 0, total: pageTotal });
    const live = reachableRefs(lib, doc);
    const doomed: PDFRef[] = [];
    const doomedSeen = new Set<string>();
    for (const ref of [...removedRefs, ...childRefs]) {
      const key = ref.toString();
      if (doomedSeen.has(key)) continue;
      doomedSeen.add(key);
      if (live.has(key)) continue;
      doomed.push(ref);
    }
    candidates = doomed.length;
    for (const ref of doomed) {
      if (doc.context.delete(ref)) pruned += 1;
    }
  } catch {
    pruneFailed = true;
  }
  return { removed, keptWidgets, pruned, candidates, pruneFailed };
}

function friendlyError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/encrypted|password/i.test(m)) {
    return "This PDF is password-protected. Remove the password with PDF Unlock, then strip its annotations.";
  }
  if (/No PDF header|Failed to parse|Invalid PDF|not a PDF/i.test(m)) {
    return "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.";
  }
  return "Could not read that PDF. It may be corrupt or unsupported.";
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

function removableCountFor(total: number, widgets: number, keepFormFields: boolean): number {
  return keepFormFields ? Math.max(0, total - widgets) : total;
}

function nextPaint(): Promise<void> {
  return new Promise((done) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => done());
      return;
    }
    setTimeout(done, 0);
  });
}

function outputNameFor(source: string): string {
  const base = source
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim()
    .slice(0, MAX_STEM)
    .replace(/[. ]+$/, "");
  return `${base || "document"}-no-annotations.pdf`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sizeDelta(from: number, to: number): string {
  if (from <= 0) return "—";
  const pct = Math.round(((to - from) / from) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function describeKinds(kinds: KindCounts): string {
  const parts: string[] = [];
  for (const kind of Object.keys(KIND_LABEL) as AnnKind[]) {
    const n = kinds[kind];
    if (n > 0) parts.push(`${n} ${n === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many}`);
  }
  return parts.join(", ");
}

interface RemovedResult {
  bytes: Uint8Array;
  name: string;
  found: number;
  removed: number;
  kept: number;
  pruned: number;
  candidates: number;
  pruneFailed: boolean;
  sourceSize: number;
}

export default function PdfRemoveAnnotations() {
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sourceSize, setSourceSize] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [keepFormFields, setKeepFormFields] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<RemovedResult | null>(null);

  const runIdRef = useRef(0);
  // The source bytes live in a ref, not in state: a 100 MB Uint8Array in a
  // useState value is copied by devtools and can be double-held by strict mode.
  const bytesRef = useRef<Uint8Array | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openId = useId();
  const keepId = useId();

  const resetState = () => {
    bytesRef.current = null;
    setLoaded(false);
    setSourceSize(0);
    setPageCount(0);
    setScan(null);
    setKeepFormFields(false);
    setMessage("");
    setProgress("");
    setResult(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    const run = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    setProgress("Reading the file…");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `This file is ${sizeLabel(file.size)} — files up to 100 MB are supported.`,
        );
      }
      const data = new Uint8Array(await file.arrayBuffer());
      if (run !== runIdRef.current) return;
      if (data.length === 0) {
        throw userFacing("That file is empty. Choose a PDF that has at least one page.");
      }
      if (!hasPdfHeader(data)) {
        throw userFacing(
          "That file doesn't look like a valid PDF. Choose a single PDF up to 100 MB.",
        );
      }
      const lib = await import("pdf-lib");
      if (run !== runIdRef.current) return;
      const doc = await lib.PDFDocument.load(data, LOAD_OPTS);
      if (run !== runIdRef.current) return;
      const pages = doc.getPageCount();
      if (pages > MAX_PAGES) {
        throw userFacing(
          `This PDF has ${pages} pages — files up to 200 pages are supported. Use PDF Split first.`,
        );
      }
      const result = scanDocument(lib, doc, (page, total) => {
        if (run === runIdRef.current)
          setProgress(`Scanning page ${page} of ${total}…`);
      });
      if (run !== runIdRef.current) return;
      bytesRef.current = data;
      setLoaded(true);
      setSourceSize(data.length);
      setName(file.name);
      setPageCount(pages);
      setScan(result);
      setMessage(
        result.total === 0
          ? `Loaded ${file.name} — ${pages} ${plural(pages, "page", "pages")}, and no annotations were found, so there is nothing to remove.`
          : `Found ${result.total} ${plural(result.total, "annotation", "annotations")} in ${file.name} (${pages} ${plural(pages, "page", "pages")}, ${sizeLabel(data.length)}). Review the breakdown, then confirm to remove them.`,
      );
    } catch (err) {
      if (run !== runIdRef.current) return;
      resetState();
      setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const handlePicker = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    void handleFile(file);
  };

  const handleRemove = async () => {
    const bytes = bytesRef.current;
    if (!bytes || !scan || busy || scan.total === 0) return;
    const run = ++runIdRef.current;
    const keptFields = keepFormFields && scan.kinds.widget > 0;
    const willRemove = removableCountFor(scan.total, scan.kinds.widget, keepFormFields);
    if (willRemove === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    setProgress("Removing annotations…");
    try {
      const lib = await import("pdf-lib");
      if (run !== runIdRef.current) return;
      const doc = await lib.PDFDocument.load(bytes, LOAD_OPTS);
      if (run !== runIdRef.current) return;
      const result = await stripAnnotations(lib, doc, keptFields, async (info) => {
        if (run !== runIdRef.current) return;
        setProgress(
          info.phase === "pages"
            ? `Removing annotations — page ${info.page} of ${info.total}…`
            : "Pruning orphaned annotation data…",
        );
        await nextPaint();
      });
      if (run !== runIdRef.current) return;
      if (result.removed !== willRemove) {
        throw userFacing(
          `This file reports ${scan.total} ${plural(scan.total, "annotation", "annotations")}, but only ${result.removed} could be located for removal. The file was not changed — try a different copy.`,
        );
      }
      if (run !== runIdRef.current) return;
      setProgress("Writing the new file…");
      await nextPaint();
      const out = new Uint8Array(await doc.save(SAVE_OPTS));
      if (run !== runIdRef.current) return;
      const filename = outputNameFor(name);
      downloadBlob(out, filename);
      // A failed reachability walk leaves the outcome unknown, so it is
      // disclosed exactly like a partial prune instead of being reported clean.
      const leaked = result.pruneFailed || result.pruned < result.candidates;
      setResult({
        bytes: out,
        name: filename,
        found: scan.total,
        removed: result.removed,
        kept: result.keptWidgets,
        pruned: result.pruned,
        candidates: result.candidates,
        pruneFailed: result.pruneFailed,
        sourceSize: bytes.length,
      });
      setMessage(
        `Removed ${result.removed} ${plural(result.removed, "annotation", "annotations")} and downloaded ${filename} (${sizeLabel(out.length)}, was ${sizeLabel(bytes.length)} — ${sizeDelta(bytes.length, out.length)}).${
          keptFields
            ? ` ${result.keptWidgets} ${plural(result.keptWidgets, "form field", "form fields")} stayed in place and is still fillable.`
            : ""
        } Page text, images and layout are unchanged.${
          leaked
            ? " Some removed annotation data may still sit in the file as unreferenced bytes that no reader will show."
            : ""
        }`,
      );
    } catch (err) {
      if (run !== runIdRef.current) return;
      setResult(null);
      setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const annotated = scan ? scan.pages.filter((p) => p.total > 0) : [];
  const shownChips = annotated.slice(0, MAX_PAGE_CHIPS);
  const hiddenChips = annotated.length - shownChips.length;
  const widgetCount = scan ? scan.kinds.widget : 0;
  const keepsFields = keepFormFields && widgetCount > 0;
  const removableCount = scan ? removableCountFor(scan.total, widgetCount, keepFormFields) : 0;
  const canRemove = !!loaded && !!scan && scan.total > 0 && removableCount > 0 && !busy;

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={inputRef}
        id={openId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only peer"
        disabled={busy}
        aria-label="Choose a PDF to remove annotations from"
        onChange={(e) => void handlePicker(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? progress || "Working…" : ""}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={openId}
          className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition inline-flex items-center gap-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600 ${
            busy
              ? "opacity-60 pointer-events-none"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 cursor-pointer"
          }`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="w-4 h-4" aria-hidden="true" />
          )}
          {busy
            ? progress || "Working…"
            : name
              ? "Choose another PDF"
              : "Open PDF"}
        </label>
        <span className="text-sm text-slate-500" role="status">
          {name
            ? `${name} — ${pageCount} ${plural(pageCount, "page", "pages")}, ${sizeLabel(sourceSize)}`
            : "Strip comments, highlights, stamps, links and form fields from a PDF while the page content stays exactly as it is. Up to 200 pages and 100 MB — nothing is uploaded."}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm"
        >
          {error}
          {/Unlock/i.test(error) && (
            <Link
              href="/use/pdf-unlock"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 underline ml-1"
            >
              Open PDF Unlock <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm"
        >
          {message}
        </div>
      )}

      {loaded && scan && (
        <fieldset
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
          disabled={busy}
        >
          <legend className="px-2 text-sm font-semibold text-slate-700">
            Annotations found in {name}
          </legend>

          <div>
            <p className="text-2xl font-bold text-slate-800">
              {scan.total}{" "}
              <span className="text-sm font-medium text-slate-400">
                {plural(scan.total, "annotation", "annotations")}
              </span>
            </p>
            {scan.total > 0 ? (
              <>
                <p className="text-sm text-slate-600 mt-1">
                  {describeKinds(scan.kinds)}.
                </p>
                <ul className="flex flex-wrap gap-1.5 mt-2 list-none p-0">
                  {shownChips.map((p) => (
                    <li
                      key={p.page}
                      className="text-[11px] font-medium text-slate-600 bg-slate-100 rounded-lg px-2 py-1"
                    >
                      page {p.page}: {p.total}
                    </li>
                  ))}
                  {hiddenChips > 0 && (
                    <li className="text-[11px] font-medium text-slate-500 bg-slate-50 rounded-lg px-2 py-1">
                      + {hiddenChips} more {plural(hiddenChips, "page", "pages")}
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <p className="text-sm text-slate-600 mt-1">
                No comments, highlights, stamps, links or form fields are stored
                in this file, so there is nothing to remove. Choose another PDF
                if that is not what you expected.
              </p>
            )}
          </div>

          {widgetCount > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <label
                htmlFor={keepId}
                className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer"
              >
                <input
                  id={keepId}
                  type="checkbox"
                  checked={keepFormFields}
                  onChange={(e) => {
                    // A result built under the old setting no longer describes
                    // what is on screen, so it is cleared rather than left stale.
                    setKeepFormFields(e.target.checked);
                    setResult(null);
                  }}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                <span>
                  Keep the {widgetCount} interactive{" "}
                  {plural(widgetCount, "form field", "form fields")} in place
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Form fields are annotations too, so the default removes them
                    along with the markup. Keeping them leaves the fields
                    fillable — but the markup around them still disappears.
                  </span>
                </span>
              </label>
            </div>
          )}

          {keepsFields && removableCount === 0 && (
            <p className="text-sm text-amber-700">
              Every annotation in this file is a form field, so keeping them
              leaves nothing to remove. Uncheck the box to strip them, or choose
              another PDF.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={!canRemove} onClick={() => void handleRemove()}>
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
              ) : (
                <Eraser className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
              )}
              {busy
                ? "Removing…"
                : scan.total === 0
                  ? "Nothing to remove"
                  : removableCount === 0
                    ? "Nothing left to remove"
                    : `Remove ${removableCount} ${plural(removableCount, "annotation", "annotations")} → download`}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={resetState}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
              Start over
            </Button>
          </div>

          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Only the annotation layer is removed: page content streams are
              not modified, so text, images and layout are preserved exactly as
              they were, and document metadata, bookmarks and file attachments
              are left alone. A filled form field keeps its value only if that
              value was already drawn into the page (a flattened form); in most
              files the value lives inside the field itself and goes away with
              it. The annotation objects are dropped from the document
              structure rather than hidden, though a little unreferenced data can
              survive in the bytes and no reader will ever show it. There is no
              undo after the download — keep the original if you may need the
              comments again.
            </span>
          </p>
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Four things worth knowing before you strip a document you did not
              author. The count above counts annotation objects sitting in the
              pages&apos; /Annots arrays: a form field with no widget on any page
              is still removed by default but is not included in that number, and
              a comment&apos;s popup is not counted separately. Changing any
              annotation — including only deleting a comment — invalidates a
              digital signature, so a signed PDF comes out no longer signed. A
              removal that PDF viewers hide is also what some &quot;show
              comments&quot; and &quot;print markup&quot; settings react to, so a
              reader that has markup display switched on will show nothing new
              here. And the whole file is held in this tab&apos;s memory while it
              runs, which is what the 100 MB and 200 page caps are there for.
            </span>
          </p>
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              A dynamic form is the one case that loses more than the boxes. An
              XFA / JavaScript form keeps its field data and its fill-in
              behaviour in the same AcroForm entry the fields live in, so
              removing the fields removes that entry too and the form stops
              behaving like a form. Flatten such a document first, or read the
              values out before you strip it. This tool is also not a redaction
              tool: it clears the markup layer, and it says nothing about text
              that was already hidden inside a page — use PDF Redact for that.
            </span>
          </p>
        </fieldset>
      )}

      {result && (
        <div
          role="status"
          className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Eraser className="h-4 w-4" aria-hidden="true" />
            Clean copy ready — {result.name}
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-xs text-emerald-900 sm:grid-cols-4">
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Found / removed</dt>
              <dd className="font-semibold">
                {result.found} / {result.removed}
              </dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Form fields kept</dt>
              <dd className="font-semibold">
                {result.kept} {plural(result.kept, "field", "fields")}
              </dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">Output size</dt>
              <dd className="font-semibold">{sizeLabel(result.bytes.length)}</dd>
            </div>
            <div className="rounded-lg bg-white/70 px-2.5 py-2">
              <dt className="text-emerald-700">vs. original</dt>
              <dd className="font-semibold">
                {sizeDelta(result.sourceSize, result.bytes.length)}
              </dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadBlob(result.bytes, result.name)}
          >
            <FileText className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
            Download {result.name} again
          </Button>
          <p className="text-xs text-emerald-800">
            Open the download and confirm the pages you care about read the way
            you expect before you send it.
            {result.pruneFailed || result.pruned < result.candidates
              ? " Some removed annotation data may still sit in the file as unreferenced bytes that no reader will show."
              : result.candidates > 0
                ? ` All ${result.candidates} objects the removed annotations owned were pruned from the file, not just unlinked.`
                : ""}
          </p>
        </div>
      )}
    </div>
  );
}
