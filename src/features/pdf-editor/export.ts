import type { Annotation } from "./annotations";
import { drawAnnotation, drawAnnotations } from "./annotations";
import {
  applyFormValues,
  drawDecorations,
  loadWorkingDoc,
  type ExportOptions,
} from "./pdf-ops";
import { rgb } from "pdf-lib";

export interface PageDimensions {
  width: number;
  height: number;
}

const EXPORT_SCALE = 2;

export async function exportPdf(
  data: ArrayBuffer,
  annotations: Record<number, Annotation[]>,
  pages: number,
  options?: ExportOptions
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const out = await PDFDocument.create();

  for (let i = 0; i < pages; i++) {
    const page = await doc.getPage(i + 1);
    const viewport = page.getViewport({ scale: EXPORT_SCALE });
    const dims = viewport;
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, viewport }).promise;

    ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
    for (const ann of annotations[i] ?? []) drawAnnotation(ctx, ann);
    drawDecorations(ctx, options?.decorations ?? { enabled: false }, i, pages, dims);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = await out.embedJpg(bytes);

    const base = page.getViewport({ scale: 1 });
    const p = out.addPage([Math.round(base.width), Math.round(base.height)]);
    p.drawImage(image, {
      x: 0,
      y: 0,
      width: Math.round(base.width),
      height: Math.round(base.height),
    });
  }

  const bytes = await out.save();
  return encryptOutput(bytes, options);
}

export async function exportFilledPdf(
  data: ArrayBuffer,
  annotations: Record<number, Annotation[]>,
  pages: number,
  options?: ExportOptions
): Promise<Uint8Array> {
  const doc = await loadWorkingDoc(data);
  if (doc.getPageCount() !== pages && doc.getPageCount() < pages) {
    return exportPdf(data, annotations, pages, options);
  }
  if (options?.formValues) applyFormValues(doc, options.formValues);
  try {
    for (let i = 0; i < doc.getPageCount(); i++) {
      await drawAnnotationsIntoPage(doc, doc.getPage(i), annotations[i] ?? []);
    }
  } catch (e) {
    console.error("[export-filled] drawAnnotationsIntoPage failed, fallback:", e instanceof Error ? e.message : String(e));
    return exportPdf(data, annotations, pages, options);
  }
  const bytes = await doc.save();
  return encryptOutput(bytes, options);
}

async function encryptOutput(
  bytes: Uint8Array,
  options?: ExportOptions
): Promise<Uint8Array> {
  const userPassword = options?.userPassword?.trim();
  const ownerPassword = options?.ownerPassword?.trim();
  if (!userPassword && !ownerPassword) return bytes;
  const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
  const perms = options?.permissions;
  return encryptPDF(bytes, userPassword ?? "", {
    ownerPassword: ownerPassword || undefined,
    allowPrinting: perms?.printing !== "notAllowed",
    allowCopying: perms?.copying !== "notAllowed",
    allowModifying: perms?.modifying !== "notAllowed",
    allowAnnotating: perms?.annotating !== "notAllowed",
    allowFillingForms: perms?.fillingForms !== "notAllowed",
    allowExtraction: perms?.contentAccessibility !== "notAllowed",
    allowAssembly: perms?.documentAssembly !== "notAllowed",
  });
}

function hexToRgb(color: string): ReturnType<typeof rgb> {
  const m = /^#?([0-9a-f]{6})$/i.exec(color ?? "#2563eb");
  const hex = m ? m[1] : "2563eb";
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255
  );
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const idx = dataUrl.indexOf(",");
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function drawAnnotationsIntoPage(
  doc: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  anns: Annotation[]
): Promise<void> {
  for (const ann of anns) {
    const color = hexToRgb(ann.color);
    switch (ann.kind) {
      case "image": {
        const dataUrl = ann.dataUrl;
        if (!dataUrl) break;
        try {
          const bytes = dataUrlToBytes(dataUrl);
          const img =
            dataUrl.startsWith("data:image/png") || dataUrl.startsWith("data:image/webp")
              ? await doc.embedPng(bytes)
              : await doc.embedJpg(bytes);
          page.drawImage(img, {
            x: ann.x ?? 0,
            y: ann.y ?? 0,
            width: ann.width ?? 0,
            height: ann.height ?? 0,
          });
        } catch (e) {
          console.error("[export-image] embed failed:", e instanceof Error ? e.message : String(e));
        }
        break;
      }
      case "rect": {
        page.drawRectangle({
          x: ann.x ?? 0,
          y: ann.y ?? 0,
          width: ann.width ?? 0,
          height: ann.height ?? 0,
          borderColor: color,
          borderWidth: ann.lineWidth ?? 2,
        });
        break;
      }
      case "oval": {
        const x = ann.x ?? 0;
        const y = ann.y ?? 0;
        const w = ann.width ?? 0;
        const h = ann.height ?? 0;
        const k = 0.5523;
        const e = (cp: number) => `${cp}`;
        const path =
          `M ${e(x + w / 2)} ${e(y)} ` +
          `C ${e(x + w / 2 + w / 2 * k)} ${e(y)} ${e(x + w)} ${e(y + h / 2 - h / 2 * k)} ${e(x + w)} ${e(y + h / 2)} ` +
          `C ${e(x + w)} ${e(y + h / 2 + h / 2 * k)} ${e(x + w / 2 + w / 2 * k)} ${e(y + h)} ${e(x + w / 2)} ${e(y + h)} ` +
          `C ${e(x + w / 2 - w / 2 * k)} ${e(y + h)} ${e(x)} ${e(y + h / 2 + h / 2 * k)} ${e(x)} ${e(y + h / 2)} ` +
          `C ${e(x)} ${e(y + h / 2 - h / 2 * k)} ${e(x + w / 2 - w / 2 * k)} ${e(y)} ${e(x + w / 2)} ${e(y)} ` +
          `Z`;
        page.drawSvgPath(path, { borderColor: color, borderWidth: ann.lineWidth ?? 2 });
        break;
      }
      case "line": {
        page.drawLine({
          start: ann.start ?? { x: 0, y: 0 },
          end: ann.end ?? { x: 0, y: 0 },
          thickness: ann.lineWidth ?? 2,
          color,
        });
        break;
      }
      case "arrow": {
        const start = ann.start ?? { x: 0, y: 0 };
        const end = ann.end ?? { x: 0, y: 0 };
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const width = ann.lineWidth ?? 2;
        const head = Math.max(10, width * 4);
        page.drawLine({ start, end, thickness: width, color });
        const baseX = end.x - ux * head;
        const baseY = end.y - uy * head;
        const wing = head * 0.4;
        page.drawLine({ start: { x: baseX - uy * wing, y: baseY + ux * wing }, end, thickness: width, color });
        page.drawLine({ start: { x: baseX + uy * wing, y: baseY - ux * wing }, end, thickness: width, color });
        break;
      }
      case "highlight": {
        page.drawRectangle({
          x: ann.x ?? 0,
          y: ann.y ?? 0,
          width: ann.width ?? 0,
          height: ann.height ?? 0,
          color,
          opacity: 0.35,
        });
        break;
      }
      case "underline":
      case "strikethrough": {
        const x = ann.x ?? 0;
        const y = ann.y ?? 0;
        const w = ann.width ?? 0;
        const h = ann.height ?? 0;
        const thickness = Math.max(1, ann.lineWidth ?? 3);
        const lineY = ann.kind === "underline" ? y + h - thickness : y + h / 2 - thickness / 2;
        page.drawRectangle({ x, y: lineY, width: w, height: thickness, color });
        break;
      }
      case "redact": {
        page.drawRectangle({
          x: ann.x ?? 0,
          y: ann.y ?? 0,
          width: ann.width ?? 0,
          height: ann.height ?? 0,
          color: rgb(17 / 255, 17 / 255, 17 / 255),
        });
        break;
      }
      case "text":
      case "date":
      case "textEdit":
      case "note": {
        const lines = (ann.text ?? "").split("\n");
        const fontSize = ann.fontSize ?? 16;
        const baselineY = ann.kind === "textEdit" ? (ann.baselineY ?? 0) : (ann.y ?? 0) + fontSize;
        const x = ann.x ?? 0;
        if (ann.kind === "textEdit") {
          page.drawRectangle({
            x,
            y: (ann.y ?? 0) - (fontSize * (lines.length - 1) * 1.2),
            width: ann.width ?? 0,
            height: (ann.height ?? 0) + fontSize * lines.length * 1.2,
            color: rgb(1, 1, 1),
          });
        }
        if (ann.kind === "note") break;
        lines.forEach((line, i) => {
          page.drawText(line, {
            x,
            y: baselineY - i * fontSize * 1.2,
            size: fontSize,
            color,
          });
        });
        break;
      }
      case "pen":
      case "brush": {
        const pts = ann.points ?? [];
        if (pts.length < 2) break;
        const path = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
        page.drawSvgPath(path, {
          color: ann.kind === "brush" ? color : undefined,
          borderColor: color,
          borderWidth: ann.lineWidth ?? 2,
          opacity: ann.kind === "brush" ? (ann.opacity ?? 0.45) : undefined,
        });
        break;
      }
    }
  }
}

export async function exportPageImage(
  data: ArrayBuffer,
  annotations: Record<number, Annotation[]>,
  pageIndex: number,
  format: "png" | "jpeg"
): Promise<Uint8Array> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: EXPORT_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array(0);
  await page.render({ canvas, viewport }).promise;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
  drawAnnotations(ctx, annotations[pageIndex] ?? []);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, format === "png" ? "image/png" : "image/jpeg", 0.92)
  );
  if (!blob) return new Uint8Array(0);
  return new Uint8Array(await blob.arrayBuffer());
}