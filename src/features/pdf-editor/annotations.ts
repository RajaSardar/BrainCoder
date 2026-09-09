export type AnnotationKind = "pen" | "rect" | "highlight" | "text";

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  color: string;
  points?: Point[];
  lineWidth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const FONT_FAMILY = "Arial, Helvetica, sans-serif";

export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (ann.kind) {
    case "pen": {
      const pts = ann.points ?? [];
      if (pts.length < 2) {
        ctx.restore();
        return;
      }
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = ann.lineWidth ?? 2;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      break;
    }
    case "rect":
    case "highlight": {
      const x = ann.x ?? 0;
      const y = ann.y ?? 0;
      const w = ann.width ?? 0;
      const h = ann.height ?? 0;
      if (w === 0 && h === 0) break;
      if (ann.kind === "highlight") {
        ctx.fillStyle = ann.color;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.lineWidth ?? 2;
        ctx.globalAlpha = 1;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case "text": {
      const lines = (ann.text ?? "").split("\n");
      const fontSize = ann.fontSize ?? 16;
      ctx.fillStyle = ann.color;
      ctx.globalAlpha = 1;
      ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
      lines.forEach((line, i) => {
        ctx.fillText(line, ann.x ?? 0, (ann.y ?? 0) + fontSize * (i + 1));
      });
      break;
    }
  }

  ctx.restore();
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  anns: Annotation[]
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const ann of anns) drawAnnotation(ctx, ann);
}

export function textAnnotationSize(
  ann: Annotation,
  ctx: CanvasRenderingContext2D
): { width: number; height: number } {
  const lines = (ann.text ?? "").split("\n");
  const fontSize = ann.fontSize ?? 16;
  ctx.save();
  ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
  let width = 0;
  for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
  ctx.restore();
  return { width, height: lines.length * fontSize * 1.2 };
}

export function hitTestAnnotation(
  ann: Annotation,
  pt: Point,
  ctx: CanvasRenderingContext2D
): boolean {
  const pad = 6;
  switch (ann.kind) {
    case "rect":
    case "highlight": {
      const x = ann.x ?? 0;
      const y = ann.y ?? 0;
      const w = ann.width ?? 0;
      const h = ann.height ?? 0;
      return (
        pt.x >= x - pad && pt.x <= x + w + pad && pt.y >= y - pad && pt.y <= y + h + pad
      );
    }
    case "text": {
      const size = textAnnotationSize(ann, ctx);
      const x = ann.x ?? 0;
      const y = (ann.y ?? 0) + (ann.fontSize ?? 16);
      return (
        pt.x >= x - pad &&
        pt.x <= x + size.width + pad &&
        pt.y >= y - size.height - pad &&
        pt.y <= y + pad
      );
    }
    case "pen": {
      const pts = ann.points ?? [];
      const tol = Math.max(pad, (ann.lineWidth ?? 2) / 2 + 3);
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(pt, pts[i - 1], pts[i]) <= tol) return true;
      }
      if (pts.length === 1) return Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) <= tol;
      return false;
    }
  }
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function getAnnotationBBox(ann: Annotation, ctx: CanvasRenderingContext2D): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  switch (ann.kind) {
    case "rect":
    case "highlight": {
      const x = Math.min(ann.x ?? 0, (ann.x ?? 0) + (ann.width ?? 0));
      const y = Math.min(ann.y ?? 0, (ann.y ?? 0) + (ann.height ?? 0));
      return { x, y, width: Math.abs(ann.width ?? 0), height: Math.abs(ann.height ?? 0) };
    }
    case "text": {
      const size = textAnnotationSize(ann, ctx);
      return {
        x: ann.x ?? 0,
        y: ann.y ?? 0,
        width: size.width,
        height: size.height,
      };
    }
    case "pen": {
      const pts = ann.points ?? [];
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      return {
        x: Math.min(...xs, 0),
        y: Math.min(...ys, 0),
        width: Math.max(...xs, 0) - Math.min(...xs, 0),
        height: Math.max(...ys, 0) - Math.min(...ys, 0),
      };
    }
  }
}

export function toTopLeft(ann: Annotation, ctx: CanvasRenderingContext2D): Annotation {
  const box = getAnnotationBBox(ann, ctx);
  const next: Annotation = { ...ann };
  if (ann.kind === "pen") {
    next.points = (ann.points ?? []).map((p) => ({ x: p.x - box.x, y: p.y - box.y }));
  }
  next.x = box.x;
  next.y = box.y;
  next.width = box.width;
  next.height = box.height;
  return next;
}

export function pointsToRect(a: Point, b: Point): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}