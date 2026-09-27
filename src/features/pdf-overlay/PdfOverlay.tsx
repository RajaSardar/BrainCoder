"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Blend,
  FileText,
  Layers,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  ensurePdfjsWorker,
  pageRangeSyntaxError,
} from "@/features/pdf-office/support";
import type { PDFEmbeddedPage } from "pdf-lib";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 200;
const MIN_OPACITY = 5;
const MAX_OPACITY = 100;
const OFFSET_LIMIT = 600;
const PREVIEW_SCALE = 1.4;
/** Preview only: shrink the scale rather than build an oversized canvas. */
const MAX_PREVIEW_AREA = 4_000_000;
const HEADER_SCAN_BYTES = 1024;
const PDF_MAGIC = "%PDF-";
const SAVE_OPTS = { updateFieldAppearances: false, addDefaultPage: false } as const;
const PAINT_EVERY = 25;

const POSITION_PRESETS = [
  { id: "stretch", label: "Stretch to page" },
  { id: "center", label: "Center (fit)" },
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
] as const;

type PositionPreset = (typeof POSITION_PRESETS)[number]["id"];
type StampMode = "cycle" | "first";
type Scope = "all" | "range";
type QuarterTurn = 0 | 90 | 180 | 270;
type OffKind = "none" | "partial" | "full";

/** The visible box of one page, in the page's own unrotated coordinates. */
interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: QuarterTurn;
}

interface LoadedPdf {
  name: string;
  bytes: Uint8Array;
  size: number;
  pages: PageBox[];
}

/** A placement in the page's own coordinates, relative to its visible box. */
interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlanEntry {
  page: number;
  stampPage: number;
  placement: Placement;
  off: OffKind;
}

interface OverlayResult {
  bytes: Uint8Array;
  outputName: string;
  pagesStamped: number;
  totalPages: number;
  opacity: number;
  preset: PositionPreset;
  offsetX: number;
  offsetY: number;
  sizeLabel: string;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeRotation(angle: number): QuarterTurn {
  const raw = Number.isFinite(angle) ? Math.round(angle) : 0;
  const wrapped = ((raw % 360) + 360) % 360;
  return (Math.round(wrapped / 90) * 90) % 360 as QuarterTurn;
}

function displayedSize(width: number, height: number, rotation: QuarterTurn) {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

/**
 * Cheap preflight: a PDF must announce itself with the %PDF- header inside its
 * first kilobyte (some writers emit junk first). Real parsing is still done by
 * pdf-lib — this only turns an obviously wrong file into a friendly message
 * instead of a raw engine exception.
 */
function looksLikePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(
    bytes.subarray(0, Math.min(bytes.length, HEADER_SCAN_BYTES)),
  );
  return head.includes(PDF_MAGIC);
}

/** "The base PDF" -> "the base PDF": sentence-friendly, still upper-case PDF. */
function inSentence(label: string): string {
  return label.replace(/^The /, "the ");
}

function friendlyError(error: unknown, label: string): string {
  const name = (error as { name?: string; code?: number } | null)?.name ?? "";
  const msg = error instanceof Error ? error.message : String(error);
  if (name === "PasswordException" || /encrypted|password/i.test(msg)) {
    return `${label} is password-protected. Remove the password with PDF Unlock, then add the overlay again.`;
  }
  if (/no pdf header|failed to parse|invalid pdf|not a pdf|invalidpdfexception/i.test(msg)) {
    return `${label} doesn't look like a valid PDF. Choose a PDF up to 100 MB and 200 pages.`;
  }
  return `Could not read ${inSentence(label)}. It may be corrupt or unsupported.`;
}

function userFacing(message: string): Error {
  const e = new Error(message);
  (e as Error & { userFacing?: boolean }).userFacing = true;
  return e;
}

function toUiError(error: unknown, label: string): string {
  if (error instanceof Error && (error as { userFacing?: boolean }).userFacing) {
    return error.message;
  }
  return friendlyError(error, label);
}

function outputNameFor(baseName: string): string {
  const stem = baseName
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim()
    .slice(0, 80);
  return `${stem || "document"}-overlaid.pdf`;
}

/**
 * Every preset except "stretch" fits the stamp to the page — the shorter side
 * sits flush with the page edge, aspect ratio kept — and then anchors it to a
 * corner, an edge or the middle. The offsets are added last, in PDF points.
 */
function placementFor(
  preset: PositionPreset,
  page: PageBox,
  stamp: PageBox,
  offsetX: number,
  offsetY: number,
): Placement {
  if (preset === "stretch") {
    return { x: 0, y: 0, width: page.width, height: page.height };
  }
  const fit = Math.min(page.width / stamp.width, page.height / stamp.height);
  const width = stamp.width * fit;
  const height = stamp.height * fit;
  let x = (page.width - width) / 2;
  let y = (page.height - height) / 2;
  if (preset.endsWith("-left")) x = 0;
  else if (preset.endsWith("-right")) x = page.width - width;
  if (preset.startsWith("top")) y = page.height - height;
  else if (preset.startsWith("bottom")) y = 0;
  return { x: x + offsetX, y: y + offsetY, width, height };
}

/** "none" = fully on the page, "partial" = cropped by the page edge, "full" = invisible. */
function offKind(placement: Placement, page: PageBox): OffKind {
  if (
    placement.x >= page.width ||
    placement.y >= page.height ||
    placement.x + placement.width <= 0 ||
    placement.y + placement.height <= 0
  ) {
    return "full";
  }
  if (
    placement.x < -0.5 ||
    placement.y < -0.5 ||
    placement.x + placement.width > page.width + 0.5 ||
    placement.y + placement.height > page.height + 0.5
  ) {
    return "partial";
  }
  return "none";
}

function stampPageFor(target: number, stampPages: number, mode: StampMode): number {
  if (mode === "first" || stampPages <= 1) return 1;
  return ((target - 1) % stampPages) + 1;
}

function parseTargets(
  range: string,
  total: number,
): { ok: true; pages: number[] } | { ok: false; message: string } {
  const syntax = pageRangeSyntaxError(range);
  if (syntax) return { ok: false, message: syntax };
  const pages = new Set<number>();
  const trimmed = range.trim();
  if (trimmed) {
    for (const segment of trimmed.split(",")) {
      const match = /^(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(segment.trim());
      if (!match) continue;
      const from = Number(match[1]);
      const to = match[2] ? Number(match[2]) : from;
      for (let p = from; p <= to; p += 1) {
        if (p > total) {
          return {
            ok: false,
            message: `The base PDF has ${fmt(total)} page${total === 1 ? "" : "s"} — page ${fmt(p)} is past the last page.`,
          };
        }
        pages.add(p);
      }
    }
  }
  const list = Array.from(pages).sort((a, b) => a - b);
  if (list.length === 0) {
    for (let p = 1; p <= total; p += 1) list.push(p);
  }
  return { ok: true, pages: list };
}

/**
 * A page's /Rotate flag turns the finished page and everything drawn on it,
 * including the stamp, exactly as it turns the page's own text. The stamp is
 * therefore placed in the page's own unrotated coordinates, and this projects
 * that placement into the orientation a reader sees — for the preview only.
 */
function displayBox(
  placement: Placement,
  page: PageBox,
): { cx: number; cy: number; w: number; h: number; rotate: QuarterTurn } {
  const px = page.x + placement.x + placement.width / 2;
  const py = page.y + placement.y + placement.height / 2;
  const rotation = page.rotation;
  const frame = displayedSize(page.width, page.height, rotation);
  let cx: number;
  let cy: number;
  if (rotation === 0) {
    cx = (px - page.x) / page.width;
    cy = (page.y + page.height - py) / page.height;
  } else if (rotation === 90) {
    cx = (py - page.y) / page.height;
    cy = (px - page.x) / page.width;
  } else if (rotation === 180) {
    cx = (page.x + page.width - px) / page.width;
    cy = (py - page.y) / page.height;
  } else {
    cx = (page.y + page.height - py) / page.height;
    cy = (page.x + page.width - px) / page.width;
  }
  return {
    cx,
    cy,
    w: placement.width / frame.width,
    h: placement.height / frame.height,
    rotate: rotation,
  };
}

type Plan =
  | { ok: true; entries: PlanEntry[] }
  | { ok: false; message: string };

/**
 * Resolves the whole run before a single byte is drawn: which base pages get a
 * stamp, which stamp page each one uses, where it lands, and whether the
 * offsets pushed it off the page entirely. A refusal here means nothing is
 * saved, so a user never gets a half-stamped file.
 */
function buildPlan(
  base: LoadedPdf | null,
  stamp: LoadedPdf | null,
  activeRange: string,
  preset: PositionPreset,
  offsetX: number,
  offsetY: number,
  mode: StampMode,
): Plan {
  if (!base || !stamp) return { ok: false, message: "" };
  const parsed = parseTargets(activeRange, base.pages.length);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const entries: PlanEntry[] = [];
  for (const page of parsed.pages) {
    const box = base.pages[page - 1];
    if (!box) {
      return { ok: false, message: `Page ${fmt(page)} could not be read from the base PDF.` };
    }
    const stampPage = stampPageFor(page, stamp.pages.length, mode);
    const stampBox = stamp.pages[stampPage - 1];
    if (!stampBox) {
      return {
        ok: false,
        message: `Stamp page ${fmt(stampPage)} could not be read from the stamp PDF.`,
      };
    }
    const placement = placementFor(preset, box, stampBox, offsetX, offsetY);
    const off = offKind(placement, box);
    if (off === "full") {
      return {
        ok: false,
        message: `The stamp falls completely off page ${fmt(page)} with these offsets — reduce the offset or pick another position.`,
      };
    }
    entries.push({ page, stampPage, placement, off });
  }
  if (entries.length === 0) {
    return { ok: false, message: "There are no pages to stamp in that selection." };
  }
  return { ok: true, entries };
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

async function readPdf(bytes: Uint8Array, file: File, label: string): Promise<LoadedPdf> {
  if (bytes.length === 0) {
    throw userFacing(`${label} is empty. Choose a PDF with at least one page.`);
  }
  if (!looksLikePdf(bytes)) {
    throw userFacing(
      `${label} doesn't look like a valid PDF. Choose a PDF up to 100 MB and 200 pages.`,
    );
  }
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const count = doc.getPageCount();
  if (count === 0) throw userFacing(`${label} has no pages.`);
  if (count > MAX_PAGES) {
    throw userFacing(
      `${label} has ${fmt(count)} pages — files up to ${fmt(MAX_PAGES)} pages are supported here. Use PDF Split first.`,
    );
  }
  const pages = doc.getPages().map((page) => {
    const box = page.getCropBox();
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: normalizeRotation(page.getRotation().angle),
    };
  });
  return { name: file.name, bytes, size: bytes.length, pages };
}

export default function PdfOverlay() {
  const [base, setBase] = useState<LoadedPdf | null>(null);
  const [stamp, setStamp] = useState<LoadedPdf | null>(null);
  const [preset, setPreset] = useState<PositionPreset>("center");
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [mode, setMode] = useState<StampMode>("cycle");
  const [scope, setScope] = useState<Scope>("all");
  const [rangeText, setRangeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OverlayResult | null>(null);
  const [basePreview, setBasePreview] = useState("");
  const [stampPreview, setStampPreview] = useState("");

  const baseInputRef = useRef<HTMLInputElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);
  const runIdRef = useRef(0);
  const previewEpochRef = useRef(0);
  const baseInputId = useId();
  const stampInputId = useId();
  const offsetXId = useId();
  const offsetYId = useId();
  const opacityId = useId();
  const scopeAllId = useId();
  const scopeRangeId = useId();
  const rangeId = useId();
  const modeCycleId = useId();
  const modeFirstId = useId();

  const basePages = base?.pages.length ?? 0;
  const stampPages = stamp?.pages.length ?? 0;
  // The range field only applies in range mode; "all pages" ignores whatever is
  // still typed there, so the button count can never disagree with the run.
  const activeRange = scope === "range" ? rangeText : "";
  const targets = parseTargets(activeRange, basePages);
  const rangeError = targets.ok ? "" : targets.message;

  const plan = buildPlan(base, stamp, activeRange, preset, offsetX, offsetY, mode);
  const firstEntry = plan.ok && plan.entries.length > 0 ? plan.entries[0] : null;
  const previewPageNumber = firstEntry ? firstEntry.page : 1;
  const previewPageBox = base?.pages[previewPageNumber - 1] ?? null;
  const frame = previewPageBox
    ? displayedSize(previewPageBox.width, previewPageBox.height, previewPageBox.rotation)
    : null;
  const box = firstEntry && previewPageBox ? displayBox(firstEntry.placement, previewPageBox) : null;

  const boxStyle =
    box && frame
      ? {
          left: `${(box.cx - box.w / 2) * 100}%`,
          top: `${(box.cy - box.h / 2) * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
          transform: `rotate(${box.rotate}deg)`,
        }
      : undefined;

  useEffect(() => {
    const epoch = ++previewEpochRef.current;
    let cancelled = false;
    const baseBytes = base?.bytes;
    const stampBytes = stamp?.bytes;
    if (!baseBytes || !stampBytes) return;
    const stampPage = stampPageFor(previewPageNumber, stampPages || 1, mode);
    const renderPage = async (
      pdfjs: typeof import("pdfjs-dist"),
      bytes: Uint8Array,
      pageNumber: number,
      rotation?: number,
    ) => {
      const task = pdfjs.getDocument({ data: bytes.slice(0) });
      try {
        const doc = await task.promise;
        const page = await doc.getPage(pageNumber);
        const unscaled = page.getViewport({ scale: 1, rotation });
        // Browsers refuse very large canvases, so the preview scale is reduced
        // rather than failing on a poster-sized page.
        const shrink = Math.min(
          1,
          Math.sqrt(MAX_PREVIEW_AREA / Math.max(1, unscaled.width * unscaled.height)),
        );
        const viewport = page.getViewport({ scale: PREVIEW_SCALE * shrink, rotation });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";
        await page.render({ canvas, viewport }).promise;
        return canvas.toDataURL("image/png");
      } finally {
        try {
          await task.destroy();
        } catch {
          /* noop */
        }
      }
    };
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      ensurePdfjsWorker(pdfjs);
      // The base page is rendered the way a reader sees it (its own /Rotate
      // applied); the stamp is rendered unrotated, because that is the
      // orientation drawPage uses, and is turned with CSS to match the page.
      const baseUrl = await renderPage(pdfjs, baseBytes, previewPageNumber);
      if (cancelled || epoch !== previewEpochRef.current) return;
      setBasePreview(baseUrl);
      const stampUrl = await renderPage(pdfjs, stampBytes, stampPage, 0);
      if (cancelled || epoch !== previewEpochRef.current) return;
      setStampPreview(stampUrl);
    })().catch(() => {
      // A failed preview must never invent or clear an error: the download is
      // the authority on what was produced.
      if (!cancelled) {
        setBasePreview("");
        setStampPreview("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [base?.bytes, stamp?.bytes, stampPages, previewPageNumber, mode]);

  const onFile = async (file: File | null, which: "base" | "stamp") => {
    if (!file || busy) return;
    const label = which === "base" ? "The base PDF" : "The stamp PDF";
    const run = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage(`Reading ${which === "base" ? "the base PDF" : "the stamp PDF"}…`);
    setProgress("");
    setResult(null);
    // Drop the preview of the file being replaced so the old page can never be
    // shown against the new one.
    if (which === "base") {
      setBasePreview("");
    } else {
      setStampPreview("");
    }
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `${label} is ${(file.size / (1024 * 1024)).toFixed(1)} MB — files up to 100 MB are supported here.`,
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (run !== runIdRef.current) return;
      const loaded = await readPdf(bytes, file, label);
      if (run !== runIdRef.current) return;
      if (which === "base") {
        setBase(loaded);
      } else {
        setStamp(loaded);
      }
      const noun = which === "base" ? "base" : "stamp";
      setMessage(
        `Loaded the ${noun} PDF ${loaded.name} — ${fmt(loaded.pages.length)} page${loaded.pages.length === 1 ? "" : "s"}, ${formatBytes(loaded.size)}.`,
      );
    } catch (err) {
      if (run !== runIdRef.current) return;
      if (which === "base") {
        setBase(null);
      } else {
        setStamp(null);
      }
      setMessage("");
      setError(toUiError(err, label));
    } finally {
      if (run === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const handlePicker = (which: "base" | "stamp", file: File | null) => {
    const input = which === "base" ? baseInputRef.current : stampInputRef.current;
    if (input) input.value = "";
    void onFile(file, which);
  };

  const reset = () => {
    runIdRef.current += 1;
    previewEpochRef.current += 1;
    setBase(null);
    setStamp(null);
    setResult(null);
    setError("");
    setMessage("");
    setBusy(false);
    setProgress("");
    setRangeText("");
    setPreset("center");
    setOffsetX(0);
    setOffsetY(0);
    setOpacity(100);
    setMode("cycle");
    setScope("all");
    setBasePreview("");
    setStampPreview("");
  };

  const overlay = async () => {
    if (!base || !stamp || busy) return;
    const planned = plan;
    if (!planned.ok) {
      setError(planned.message || "Choose a base PDF and a stamp PDF first.");
      return;
    }
    const run = ++runIdRef.current;
    setError("");
    setMessage("");
    setResult(null);
    setBusy(true);
    setProgress(`Overlaying page ${fmt(planned.entries[0].page)} of ${fmt(base.pages.length)}…`);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(base.bytes, { updateMetadata: false });
      if (run !== runIdRef.current) return;
      const stampDoc = await PDFDocument.load(stamp.bytes, { updateMetadata: false });
      if (run !== runIdRef.current) return;
      const embedded = new Map<number, PDFEmbeddedPage>();
      let done = 0;
      for (const entry of planned.entries) {
        let pageEmbed = embedded.get(entry.stampPage);
        if (!pageEmbed) {
          // The embedded page has to be allocated in the *base* document's
          // context: embedding through the stamp document leaves the saved
          // file pointing at an /XObject it does not contain, and the stamp
          // silently disappears.
          pageEmbed = await doc.embedPage(stampDoc.getPage(entry.stampPage - 1));
          embedded.set(entry.stampPage, pageEmbed);
        }
        const box = base.pages[entry.page - 1];
        doc.getPage(entry.page - 1).drawPage(pageEmbed, {
          x: box.x + entry.placement.x,
          y: box.y + entry.placement.y,
          width: entry.placement.width,
          height: entry.placement.height,
          opacity: opacity / 100,
        });
        done += 1;
        // pdf-lib's draw is synchronous, so yield occasionally or the progress
        // line never repaints on a long document.
        if (done === 1 || done % PAINT_EVERY === 0) {
          setProgress(`Overlaying page ${fmt(entry.page)} of ${fmt(base.pages.length)}…`);
          await nextPaint();
          if (run !== runIdRef.current) return;
        }
      }
      setProgress("Saving the new PDF…");
      const saved = new Uint8Array(await doc.save(SAVE_OPTS));
      if (run !== runIdRef.current) return;
      const outputName = outputNameFor(base.name);
      setResult({
        bytes: saved,
        outputName,
        pagesStamped: planned.entries.length,
        totalPages: base.pages.length,
        opacity,
        preset,
        offsetX,
        offsetY,
        sizeLabel: formatBytes(saved.length),
      });
      setMessage(
        `Stamped ${fmt(planned.entries.length)} of ${fmt(base.pages.length)} page${base.pages.length === 1 ? "" : "s"} at ${fmt(opacity)}% opacity — downloaded ${outputName}.`,
      );
      downloadBlob(saved, outputName);
    } catch (err) {
      if (run !== runIdRef.current) return;
      setResult(null);
      setMessage("");
      setError(toUiError(err, "The base PDF"));
    } finally {
      if (run === runIdRef.current) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const ready = Boolean(base && stamp);
  const targetList = targets.ok ? targets.pages : [];
  const stampCount = plan.ok ? plan.entries.length : targetList.length;
  const cropped = plan.ok ? plan.entries.some((e) => e.off === "partial") : false;
  const refusal = !plan.ok && !rangeError && ready ? plan.message : "";

  const placementText = (() => {
    if (!firstEntry || !previewPageBox) return "";
    const x = previewPageBox.x + firstEntry.placement.x;
    const y = previewPageBox.y + firstEntry.placement.y;
    return (
      `Stamp ${firstEntry.placement.width.toFixed(2)} × ${firstEntry.placement.height.toFixed(2)} pt` +
      ` at x ${x.toFixed(0)}, y ${y.toFixed(0)} on page ${fmt(firstEntry.page)}` +
      ` (${previewPageBox.width.toFixed(2)} × ${previewPageBox.height.toFixed(2)} pt)` +
      ` at ${fmt(opacity)}% opacity` +
      (firstEntry.off === "partial"
        ? " — part of the stamp hangs off the page edge and will be cropped."
        : ".")
    );
  })();

  const idleText =
    base || stamp
      ? `Base: ${base ? `${base.name} (${fmt(basePages)} pages)` : "none"} · Stamp: ${
          stamp ? `${stamp.name} (${fmt(stampPages)} pages)` : "none"
        }.`
      : "Overlay one PDF onto another — a letterhead, watermark, form or approved stamp page — on this device. Both files are read here and neither is uploaded.";

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <span className="sr-only" role="status">
        {busy ? progress || "Working on the PDFs…" : ""}
      </span>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={baseInputId}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
              busy
                ? "pointer-events-none opacity-60"
                : "cursor-pointer bg-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700"
            }`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4" aria-hidden="true" />
            )}
            {base ? "Open another base PDF" : "Open base PDF"}
            <input
              ref={baseInputRef}
              id={baseInputId}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label="Choose the base PDF that receives the stamp"
              onChange={(e) => handlePicker("base", e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-1.5 text-xs text-slate-500">
            The pages that receive the stamp. Up to {fmt(MAX_PAGES)} pages and{" "}
            {fmt(MAX_FILE_BYTES / (1024 * 1024))} MB.
          </p>
        </div>
        <div>
          <label
            htmlFor={stampInputId}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
              busy
                ? "pointer-events-none opacity-60"
                : "cursor-pointer border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            }`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Layers className="h-4 w-4" aria-hidden="true" />
            )}
            {stamp ? "Open another stamp PDF" : "Open stamp PDF"}
            <input
              ref={stampInputRef}
              id={stampInputId}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label="Choose the stamp PDF to place on top"
              onChange={(e) => handlePicker("stamp", e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-1.5 text-xs text-slate-500">
            A page drawn on top — a logo, letterhead, confidentiality label or approved stamp.
          </p>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        Read with pdf-lib and previewed with pdf.js in this tab. Nothing is uploaded.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          {error}
          {/unlock/i.test(error) && (
            <Link
              href="/use/pdf-unlock"
              className="ml-1 inline-flex items-center gap-1 font-semibold text-amber-800 underline"
            >
              Open PDF Unlock <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      <p role="status" className="min-h-[1.5rem] text-sm text-slate-600">
        {busy ? progress || "Working on the PDFs…" : message || idleText}
      </p>

      {ready && (
        <>
          <fieldset
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
            disabled={busy}
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Where the stamp lands
            </legend>
            <div
              role="group"
              aria-label="Stamp position preset"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {POSITION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={preset === p.id}
                  onClick={() => setPreset(p.id)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    preset === p.id
                      ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Every preset except Stretch to page fits the stamp to the page with its aspect
              ratio kept — the shorter side sits flush with the page edge — so a small logo is
              enlarged to fill the sheet. Stretch to page covers the whole page and ignores the
              stamp&apos;s own proportions.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={offsetXId} className="block text-xs font-medium text-slate-700">
                  Horizontal offset (pt)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={offsetXId}
                    type="range"
                    min={-OFFSET_LIMIT}
                    max={OFFSET_LIMIT}
                    step={1}
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    className="h-2 w-full accent-indigo-600"
                  />
                  <input
                    type="number"
                    min={-OFFSET_LIMIT}
                    max={OFFSET_LIMIT}
                    step={1}
                    value={offsetX}
                    aria-label="Horizontal offset in points"
                    onChange={(e) =>
                      setOffsetX(
                        clamp(Number(e.target.value) || 0, -OFFSET_LIMIT, OFFSET_LIMIT),
                      )
                    }
                    className="w-20 rounded-lg border border-slate-300 px-1.5 py-1 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor={offsetYId} className="block text-xs font-medium text-slate-700">
                  Vertical offset (pt)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={offsetYId}
                    type="range"
                    min={-OFFSET_LIMIT}
                    max={OFFSET_LIMIT}
                    step={1}
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    className="h-2 w-full accent-indigo-600"
                  />
                  <input
                    type="number"
                    min={-OFFSET_LIMIT}
                    max={OFFSET_LIMIT}
                    step={1}
                    value={offsetY}
                    aria-label="Vertical offset in points"
                    onChange={(e) =>
                      setOffsetY(
                        clamp(Number(e.target.value) || 0, -OFFSET_LIMIT, OFFSET_LIMIT),
                      )
                    }
                    className="w-20 rounded-lg border border-slate-300 px-1.5 py-1 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor={opacityId} className="block text-xs font-medium text-slate-700">
                  Opacity (%)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={opacityId}
                    type="range"
                    min={MIN_OPACITY}
                    max={MAX_OPACITY}
                    step={1}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="h-2 w-full accent-indigo-600"
                  />
                  <input
                    type="number"
                    min={MIN_OPACITY}
                    max={MAX_OPACITY}
                    step={1}
                    value={opacity}
                    aria-label="Stamp opacity as a percentage"
                    onChange={(e) =>
                      setOpacity(
                        clamp(Number(e.target.value) || MIN_OPACITY, MIN_OPACITY, MAX_OPACITY),
                      )
                    }
                    className="w-20 rounded-lg border border-slate-300 px-1.5 py-1 text-sm"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Offsets are PDF points (1/72 inch) from the anchored position: positive moves right
              and up, negative moves left and down. They move the stamp, they never resize it.
              Opacity is one constant transparency for the whole stamp — 100% is solid, 5% is a
              faint watermark — and the page underneath is never made translucent.
            </p>
            {placementText && (
              <p role="status" className="text-xs font-medium text-slate-700">
                {placementText}
              </p>
            )}
            {refusal && (
              <p role="status" className="text-xs font-medium text-amber-800">
                Nothing will be drawn: {refusal}
              </p>
            )}
          </fieldset>

          <fieldset
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
            disabled={busy}
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Which pages get the stamp
            </legend>
            <div className="space-y-2">
              <label htmlFor={scopeAllId} className="flex items-center gap-2 text-sm">
                <input
                  id={scopeAllId}
                  type="radio"
                  name="pdf-overlay-scope"
                  className="h-4 w-4"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All {fmt(basePages)} pages
              </label>
              <label htmlFor={scopeRangeId} className="flex items-center gap-2 text-sm">
                <input
                  id={scopeRangeId}
                  type="radio"
                  name="pdf-overlay-scope"
                  className="h-4 w-4"
                  checked={scope === "range"}
                  onChange={() => setScope("range")}
                />
                Only a page range
              </label>
              <div className="pl-6">
                <label htmlFor={rangeId} className="block text-xs font-medium text-slate-700">
                  Pages to stamp
                </label>
                <input
                  id={rangeId}
                  type="text"
                  value={rangeText}
                  placeholder="1-3,5"
                  aria-describedby={`${rangeId}-hint`}
                  onChange={(e) => setRangeText(e.target.value)}
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <p id={`${rangeId}-hint`} className="mt-1 text-xs text-slate-500">
                  {scope === "range"
                    ? `Numbers and ranges separated by commas, e.g. 1-3,5. Leave it empty to stamp every page. The base PDF has ${fmt(basePages)} pages.`
                    : "Not used in this mode — every page is stamped. The range applies when you choose Only a page range."}
                </p>
                {scope === "range" &&
                  (rangeError ? (
                    <p className="mt-1 text-xs font-medium text-red-700">{rangeError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      {targetList.length} page{targetList.length === 1 ? "" : "s"} selected:{" "}
                      {targetList.length > 12
                        ? `${targetList.slice(0, 12).join(", ")}…`
                        : targetList.join(", ")}
                      .
                    </p>
                  ))}
              </div>
            </div>
          </fieldset>

          <fieldset
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
            disabled={busy}
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Which stamp page to use
            </legend>
            <div className="space-y-2">
              <label htmlFor={modeCycleId} className="flex items-center gap-2 text-sm">
                <input
                  id={modeCycleId}
                  type="radio"
                  name="pdf-overlay-stamp-mode"
                  className="h-4 w-4"
                  checked={mode === "cycle"}
                  onChange={() => setMode("cycle")}
                />
                Cycle the stamp PDF&apos;s pages (base page 1 takes stamp page 1, page 2 takes
                stamp page 2, and it wraps around)
              </label>
              <label htmlFor={modeFirstId} className="flex items-center gap-2 text-sm">
                <input
                  id={modeFirstId}
                  type="radio"
                  name="pdf-overlay-stamp-mode"
                  className="h-4 w-4"
                  checked={mode === "first"}
                  onChange={() => setMode("first")}
                />
                Use only the stamp&apos;s first page everywhere
              </label>
            </div>
            <p className="text-xs text-slate-500">
              {stampPages > 0
                ? `Base page 1 gets stamp page 1; cycle mode keeps moving through the stamp from there. A stamp page that carries its own page rotation is drawn in its unrotated orientation.`
                : "Open a stamp PDF to see which stamp page each base page receives."}
          </p>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={busy || Boolean(rangeError)} onClick={() => void overlay()}>
              {busy ? (
                <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Blend className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              )}
              {busy
                ? "Overlaying…"
                : `Overlay ${fmt(stampCount)} page${stampCount === 1 ? "" : "s"} → PDF`}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={reset}>
              <RotateCcw className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              Start over
            </Button>
            {cropped && (
              <span className="text-xs text-amber-700">
                Part of the stamp hangs off the page edge and will be cropped.
              </span>
            )}
          </div>
        </>
      )}

      {ready && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {result && (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {result.outputName}
                </h3>
                <dl className="grid grid-cols-2 gap-2 text-xs text-emerald-900 sm:grid-cols-4">
                  <div className="rounded-lg bg-white/70 px-2.5 py-2">
                    <dt className="text-emerald-700">Pages stamped</dt>
                    <dd className="font-semibold">
                      {fmt(result.pagesStamped)} of {fmt(result.totalPages)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white/70 px-2.5 py-2">
                    <dt className="text-emerald-700">Position</dt>
                    <dd className="font-semibold">
                      {POSITION_PRESETS.find((p) => p.id === result.preset)?.label}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white/70 px-2.5 py-2">
                    <dt className="text-emerald-700">Offsets</dt>
                    <dd className="font-semibold">
                      {result.offsetX}, {result.offsetY} pt
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white/70 px-2.5 py-2">
                    <dt className="text-emerald-700">Opacity / size</dt>
                    <dd className="font-semibold">
                      {fmt(result.opacity)}% · {result.sizeLabel}
                    </dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => downloadBlob(result.bytes, result.outputName)}
                >
                  <FileText className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                  Download {result.outputName} again
                </Button>
                <p className="text-xs text-emerald-800">
                  Open the download before you send it. The stamp is real page content, not a
                  picture of one: if your stamp PDF is built from text, that text stays visible,
                  extractable and searchable, and the page underneath is unchanged. A digital
                  signature on the base file does not survive re-saving. Your original file is
                  untouched.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h3 className="flex items-center gap-2 font-semibold">
                <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                Honest limits
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>
                  It is not a way to hide content. Overlaying draws the stamp above the base
                  content, so the base text, links, annotations and form fields are all still
                  there underneath — use PDF Redact for that.
                </li>
                <li>
                  The stamp stays visible, extractable and searchable when the stamp PDF is built
                  from text. Treat it as a working mark, not a forensic seal.
                </li>
                <li>
                  It is not a merge: the two documents are not joined into one reading flow and
                  the base keeps its page count.
                </li>
                <li>Password-protected PDFs are refused — unlock them with PDF Unlock first.</li>
                <li>Digital signatures on the base file do not survive re-saving.</li>
                <li>
                  Each file can be up to {fmt(MAX_FILE_BYTES / (1024 * 1024))} MB and{" "}
                  {fmt(MAX_PAGES)} pages.
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Layers className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              Live preview
            </h3>
            {basePreview && stampPreview && previewPageBox && frame && box && firstEntry ? (
              <div className="mt-3">
                <div
                  role="img"
                  aria-label={`Page ${fmt(previewPageNumber)} of the base PDF with the stamp drawn on top, positioned at x ${(previewPageBox.x + firstEntry.placement.x).toFixed(0)}, y ${(previewPageBox.y + firstEntry.placement.y).toFixed(0)} in PDF points`}
                  className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                  style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={basePreview}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stampPreview}
                    alt=""
                    aria-hidden="true"
                    className="absolute object-contain"
                    style={{ ...boxStyle, opacity: opacity / 100 }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Page {fmt(previewPageNumber)} of the base PDF, with the stamp at the size,
                  position and transparency it will have in the download. Anything hanging off the
                  page edge is cropped, exactly as a reader would crop it.
                </p>
                {previewPageBox.rotation !== 0 && (
                  <p className="mt-1 text-xs text-amber-800">
                    This page carries a {previewPageBox.rotation}° page rotation, so the stamp is
                    drawn in the page&apos;s own coordinates and turns with the page — the same way
                    the page&apos;s own text turns.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                The preview renders as soon as both PDFs are open. It is a guide, not the
                authority — the download is.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
