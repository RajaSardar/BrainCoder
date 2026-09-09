import type { Annotation } from "./annotations";
import { drawAnnotation } from "./annotations";

export interface PageDimensions {
  width: number;
  height: number;
}

const EXPORT_SCALE = 2;

export async function exportPdf(
  data: ArrayBuffer,
  annotations: Record<number, Annotation[]>,
  pages: number
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const doc = await pdfjs.getDocument({ data }).promise;
  const out = await PDFDocument.create();

  for (let i = 0; i < pages; i++) {
    const page = await doc.getPage(i + 1);
    const viewport = page.getViewport({ scale: EXPORT_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, viewport }).promise;

    ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
    for (const ann of annotations[i] ?? []) drawAnnotation(ctx, ann);

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

  return out.save();
}