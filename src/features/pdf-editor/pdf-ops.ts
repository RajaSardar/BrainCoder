import type { PDFDocument, PDFObject } from "pdf-lib";
import { PDFName, PDFArray, PDFDict, PDFPage, degrees } from "pdf-lib";

export interface FormWidget {
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "signature" | "button";
  x: number;
  y: number;
  width: number;
  height: number;
  options: string[];
}

export interface PageDecorationOptions {
  enabled: boolean;
  kind: "watermark" | "pageNumber" | "header" | "footer";
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: "center" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "bottomCenter";
}

export interface ExportOptions {
  formValues?: Record<string, string | boolean>;
  decorations?: PageDecorationOptions;
  userPassword?: string;
  ownerPassword?: string;
  permissions?: {
    printing?: "allow" | "notAllowed";
    modifying?: "allow" | "notAllowed";
    copying?: "allow" | "notAllowed";
    annotating?: "allow" | "notAllowed";
    fillingForms?: "allow" | "notAllowed";
    contentAccessibility?: "allow" | "notAllowed";
    documentAssembly?: "allow" | "notAllowed";
  };
}

function num(value: unknown): number {
  const o = value as { asNumber?: () => number } | null;
  if (o && typeof o.asNumber === "function") return o.asNumber();
  return Number(o);
}

function readT(dict: PDFDict): string | null {
  const t = dict.lookup(PDFName.of("T"));
  if (t && "decodeText" in t) {
    return (t as { decodeText: () => string }).decodeText();
  }
  return null;
}

function readRect(dict: PDFDict): { x: number; y: number; width: number; height: number } | null {
  const rect = dict.lookup(PDFName.of("Rect"));
  if (!(rect instanceof PDFArray || (rect as { size?: number })?.size === 4)) return null;
  const arr = rect as PDFArray;
  const nums = [0, 1, 2, 3].map((i) => num((arr.get(i) as unknown)?.valueOf?.() ?? arr.get(i)));
  const x1 = Math.min(nums[0], nums[2]);
  const y1 = Math.min(nums[1], nums[3]);
  const x2 = Math.max(nums[0], nums[2]);
  const y2 = Math.max(nums[1], nums[3]);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export async function loadWorkingDoc(data: ArrayBuffer): Promise<PDFDocument> {
  const { PDFDocument } = await import("pdf-lib");
  const copy = data.slice(0);
  try {
    return await PDFDocument.load(copy, { ignoreEncryption: true });
  } catch {
    return PDFDocument.create();
  }
}

export async function detectFormWidgets(
  pdf: PDFDocument,
  pageIndex: number
): Promise<FormWidget[]> {
  const widgets: FormWidget[] = [];
  let annots: PDFArray | undefined;
  try {
    annots = pdf.getPage(pageIndex).node.Annots();
  } catch {
    return [];
  }
  if (!annots) return widgets;
  const pageHeight = (pdf.getPage(pageIndex).getHeight() || 792) as number;

  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    let dict: PDFDict;
    try {
      dict = (pdf.context.lookup(ref) as PDFObject | undefined) instanceof PDFDict
        ? (pdf.context.lookup(ref) as PDFDict)
        : (ref as PDFDict);
    } catch {
      continue;
    }
    const subtype = dict.lookup(PDFName.of("Subtype"));
    if (!subtype || subtype.toString() !== "/Widget") continue;

    let ft = String(dict.lookup(PDFName.of("FT")) ?? "");
    let name = readT(dict);
    if (!name) {
      try {
        const parent = dict.lookup(PDFName.of("Parent")) as unknown as PDFDict;
        if (parent) {
          name = readT(parent);
          if (!ft) ft = String(parent.lookup(PDFName.of("FT")) ?? "");
        }
      } catch {
        // no parent
      }
    }
    if (!name) name = `field${i}`;

    const rect = readRect(dict);
    if (!rect) continue;
    const x = rect.x;
    const y = pageHeight - rect.y - rect.height;

    let type: FormWidget["type"] = "text";
    if (ft === "/Tx") type = "text";
    else if (ft === "/Ch") type = "dropdown";
    else if (ft === "/Sig") type = "signature";
    else if (ft === "/Btn") type = "checkbox";
    else if (!ft) type = "button";

    const sameName = widgets.filter((w) => w.name === name);
    if (type === "checkbox" && sameName.length > 0) {
      sameName.forEach((w) => {
        w.type = "radio";
      });
      type = "radio";
    }

    const options: string[] = [];
    try {
      const optNode = dict.lookup(PDFName.of("Opt"));
      if (optNode instanceof PDFArray) {
        const arr = optNode as PDFArray;
        for (let oi = 0; oi < arr.size(); oi++) {
          const item = arr.get(oi);
          const decoded = (item as { decodeText?: () => string }).decodeText?.();
          if (decoded) options.push(decoded);
        }
      }
    } catch {
      // options optional
    }

    widgets.push({ name, type, x, y, width: rect.width, height: rect.height, options });
  }

  const merged: FormWidget[] = [];
  const byPageAndName = new Map<string, FormWidget>();
  for (const w of widgets) {
    if (w.type === "radio") {
      const key = `${pageIndex}:${w.name}`;
      const existing = byPageAndName.get(key);
      if (existing) continue;
      byPageAndName.set(key, w);
      merged.push(w);
    } else {
      merged.push(w);
    }
  }
  return merged;
}

export function applyFormValues(
  doc: PDFDocument,
  values: Record<string, string | boolean>
): void {
  const form = (doc as unknown as { getForm: () => { getField: (n: string) => unknown } }).getForm();
  for (const [name, value] of Object.entries(values)) {
    try {
      const field = form.getField(name);
      const fn = field as {
        setText?: (v: string) => void;
        check?: () => void;
        uncheck?: () => void;
        select?: (v: string) => void;
        getName?: () => string;
      };
      if (typeof value === "string") {
        if (fn.setText) fn.setText(value);
        else if (fn.select) fn.select(value);
      } else if (typeof value === "boolean") {
        if (value && fn.check) fn.check();
        else if (!value && fn.uncheck) fn.uncheck();
      }
    } catch {
      // field may not exist; skip
    }
  }
}

export async function pageOps(
  data: ArrayBuffer,
  op: "rotate" | "deletePage" | "duplicatePage" | "moveLeft" | "moveRight",
  pageIndex: number
): Promise<Uint8Array | null> {
  const doc = await loadWorkingDoc(data);
  try {
    if (op === "rotate") {
      const page = doc.getPage(pageIndex);
      const current = page.getRotation().angle;
      page.setRotation(degrees(((current + 90) % 360 + 360) % 360));
    } else if (op === "deletePage") {
      if (doc.getPageCount() <= 1) return null;
      doc.removePage(pageIndex);
    } else if (op === "duplicatePage") {
      const [copy] = await doc.copyPages(doc, [pageIndex]);
      doc.insertPage(pageIndex + 1, copy);
    } else if (op === "moveLeft" || op === "moveRight") {
      const count = doc.getPageCount();
      if (count <= 1) return null;
      const target = op === "moveLeft" ? pageIndex - 1 : pageIndex + 1;
      if (target < 0 || target >= count) return null;
      const [copy] = await doc.copyPages(doc, [pageIndex]);
      doc.removePage(pageIndex);
      doc.insertPage(target, copy);
    } else {
      return null;
    }
    return await doc.save();
  } catch {
    return null;
  }
}

export async function splitPage(
  data: ArrayBuffer,
  pageIndex: number,
  direction: "horizontal" | "vertical"
): Promise<Uint8Array | null> {
  const doc = await loadWorkingDoc(data);
  try {
    const count = doc.getPageCount();
    if (count < 1 || pageIndex < 0 || pageIndex >= count) return null;
    const page = doc.getPage(pageIndex);
    const { width, height } = page.getSize();
    const clips =
      direction === "horizontal"
        ? [
            { x: 0, y: height / 2, w: width, h: height - height / 2 },
            { x: 0, y: 0, w: width, h: height / 2 },
          ]
        : [
            { x: width / 2, y: 0, w: width - width / 2, h: height },
            { x: 0, y: 0, w: width / 2, h: height },
          ];
    const [a, b] = await doc.copyPages(doc, [pageIndex, pageIndex]);
    a.setMediaBox(clips[0].x, clips[0].y, clips[0].w, clips[0].h);
    b.setMediaBox(clips[1].x, clips[1].y, clips[1].w, clips[1].h);
    doc.removePage(pageIndex);
    doc.insertPage(pageIndex, b);
    doc.insertPage(pageIndex, a);
    return await doc.save();
  } catch {
    return null;
  }
}

export async function mergeAdjacentPages(
  data: ArrayBuffer,
  pageIndex: number
): Promise<Uint8Array | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  try {
    const pdfDoc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
    if (pageIndex < 0 || pageIndex >= pdfDoc.numPages - 1) return null;
    const renderPage = async (idx: number, scale: number) => {
      const pg = await pdfDoc.getPage(idx + 1);
      const vp = pg.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      await pg.render({ canvas, viewport: vp }).promise;
      return { canvas, vp };
    };
    const a = pdfDoc.getPage(pageIndex + 1);
    const aView = await a.then((p) => p.getViewport({ scale: 1 }));
    const bViewBase = await pdfDoc.getPage(pageIndex + 2).then((p) => p.getViewport({ scale: 1 }));
    const outH = 792;
    const scaleA = outH / aView.height;
    const scaleB = outH / bViewBase.height;
    const outW = Math.floor(aView.width * scaleA + bViewBase.width * scaleB);
    const ra = await renderPage(pageIndex, scaleA);
    const rb = await renderPage(pageIndex + 1, scaleB);
    const comp = document.createElement("canvas");
    const K = 2;
    comp.width = outW * K;
    comp.height = outH * K;
    const ctx = comp.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.drawImage(ra.canvas, 0, 0, ra.canvas.width * K, ra.canvas.height * K);
    ctx.drawImage(rb.canvas, ra.canvas.width * K, 0, rb.canvas.width * K, rb.canvas.height * K);
    const blob = await new Promise<Blob | null>((res) => comp.toBlob(res, "image/jpeg", 0.92));
    if (!blob) return null;
    const imgBytes = new Uint8Array(await blob.arrayBuffer());

    const doc = await loadWorkingDoc(data);
    const img = await doc.embedJpg(imgBytes);
    const merged = PDFPage.create(doc);
    merged.setSize(outW, outH);
    merged.drawImage(img, { x: 0, y: 0, width: outW, height: outH });
    doc.removePage(pageIndex);
    doc.removePage(pageIndex);
    doc.insertPage(pageIndex, merged);
    return await doc.save();
  } catch {
    return null;
  }
}

export function drawDecorations(
  ctx: CanvasRenderingContext2D,
  opts: Partial<PageDecorationOptions>,
  pageIndex: number,
  pageCount: number,
  dims: { width: number; height: number }
): void {
  if (!opts.enabled) return;
  const kind = opts.kind ?? "watermark";
  const text = opts.text ?? "";
  const fontSize = opts.fontSize ?? 18;
  const opacity = opts.opacity ?? 0.35;
  const color = opts.color ?? "#2563eb";
  const rendered =
    kind === "pageNumber"
      ? text.replace("{n}", String(pageIndex + 1)).replace("{N}", String(pageCount))
      : text;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
  const metrics = ctx.measureText(rendered);
  const margin = 24;
  let x = dims.width / 2 - metrics.width / 2;
  let y = margin + fontSize;
  if (opts.position === "topLeft") {
    x = margin;
    y = margin + fontSize;
  } else if (opts.position === "topRight") {
    x = dims.width - metrics.width - margin;
    y = margin + fontSize;
  } else if (opts.position === "bottomLeft") {
    x = margin;
    y = dims.height - margin;
  } else if (opts.position === "bottomRight") {
    x = dims.width - metrics.width - margin;
    y = dims.height - margin;
  } else if (opts.position === "bottomCenter") {
    x = dims.width / 2 - metrics.width / 2;
    y = dims.height - margin;
  } else if (opts.position === "center") {
    y = dims.height / 2;
  }
  ctx.fillText(rendered, x, y);
  ctx.restore();
}