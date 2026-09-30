"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Brush as BrushIcon,
  Crop as CropIcon,
  Download,
  Eraser,
  FileImage,
  ImageDown,
  Loader2,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pen,
  RotateCcw,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  ACCEPTED_FORMAT_NAMES,
  ACCEPTED_IMAGE_TYPES,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_QUALITY,
  DEFAULT_SCALE,
  FILE_SIZE_LABEL,
  FLATTENED_FORMAT_NAMES,
  JPEG_QUALITY_MAX,
  JPEG_QUALITY_MIN,
  JPEG_QUALITY_STEP,
  MAX_FILE_BYTES,
  MAX_PIXELS,
  MAX_SCALE,
  MAX_UNDO,
  MIN_CROP_PX,
  MIN_OUTPUT_PX,
  MIN_SCALE,
  PIXEL_BUDGET_LABEL,
  PREVIEW_MAX_SIDE_PX,
  SCALE_CHOICES,
  SCALE_STEP,
  SIDE_LIMIT_LABEL,
  applyMatrix,
  clampQuality,
  clampScale,
  describeImageSize,
  editorErrorMessage,
  exportFormatSpec,
  formatBytes,
  formatForMime,
  invertMatrix,
  normalizeCrop,
  outputFrame,
  outputNameForMime,
  planOutput,
  previewScaleFor,
  previewTarget,
  preflightImage,
  projectRect,
  qualityAppliesTo,
  qualityLabel,
  renderTarget,
  type ExportFormatId,
  type Matrix,
  type Rect,
  type RenderTarget,
  type Rotation,
  type Size,
  type ViewMode,
} from "./editor-format";
import {
  ADJUST_MAX,
  ADJUST_MIN,
  DEFAULT_BRUSH_PX,
  DEFAULT_FONT_PX,
  DEFAULT_FILTER,
  FILTERS,
  FREEFHAND_TOLERANCE,
  MAX_FONT_PX,
  MAX_STROKE_POINTS,
  MAX_TEXT_CHARS,
  MAX_BRUSH_PX,
  MIN_BRUSH_PX,
  MIN_FONT_PX,
  NEUTRAL_ADJUSTMENTS,
  annotationCountLabel,
  arrowHead,
  applyAdjustments,
  adjustmentSummary,
  adjustmentsAreNeutral,
  clampAdjust,
  clampAnnotationText,
  clampBrush,
  clampFontSize,
  outputBrushWidth,
  simplifyFreehand,
  widthOnCanvas,
  type Adjustments,
  type Annotation,
  type AnnotationKind,
  type FilterId,
  type Point,
} from "./editor-pixels";

interface LoadedImage {
  name: string;
  size: number;
  label: string;
  width: number;
  height: number;
}

interface EditState {
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  crop: Rect | null;
  scale: number;
  adjust: Adjustments;
  filter: FilterId;
  annotations: Annotation[];
}

interface ExportResult {
  bytes: Uint8Array;
  filename: string;
  width: number;
  height: number;
  mime: string;
  format: ExportFormatId;
  url: string;
}

const INITIAL_EDIT: EditState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  crop: null,
  scale: DEFAULT_SCALE,
  adjust: NEUTRAL_ADJUSTMENTS,
  filter: DEFAULT_FILTER,
  annotations: [],
};

const BRUSH_COLOR = "#0f172a";
const WHITE = "#ffffff";

/** A canvas that has been painted, and how one output pixel maps onto it. */
interface Paint {
  target: RenderTarget;
  /** Canvas pixels per output pixel — exactly 1 when the canvas *is* the file. */
  unit: number;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function userFacing(message: string): Error {
  const err = new Error(message);
  (err as Error & { userFacing?: boolean }).userFacing = true;
  return err;
}

function toUiError(err: unknown): string {
  if (err instanceof Error && (err as { userFacing?: boolean }).userFacing) return err.message;
  return editorErrorMessage(err);
}

export default function ImageEditor() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [edit, setEdit] = useState<EditState>(INITIAL_EDIT);
  const [undoStack, setUndoStack] = useState<EditState[]>([]);
  const [scaleText, setScaleText] = useState(String(DEFAULT_SCALE));
  const [cropTexts, setCropTexts] = useState({ x: "0", y: "0", width: "0", height: "0" });
  const [view, setView] = useState<ViewMode>("output");
  const [tool, setTool] = useState<AnnotationKind | "none">("none");
  const [brushColor, setBrushColor] = useState(BRUSH_COLOR);
  const [brushWidth, setBrushWidth] = useState(DEFAULT_BRUSH_PX);
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_PX);
  const [format, setFormat] = useState<ExportFormatId>(DEFAULT_EXPORT_FORMAT);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ExportResult | null>(null);
  const [paint, setPaint] = useState<Paint | null>(null);

  const runIdRef = useRef(0);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveRef = useRef<Annotation | null>(null);
  const resultUrlRef = useRef("");
  /** What is actually on the canvas, so pointer maths can never use a stale size. */
  const paintRef = useRef<Paint | null>(null);

  const fileInputId = useId();
  const scaleId = useId();
  const scaleSliderId = useId();
  const scaleHintId = useId();
  const formatId = useId();
  const formatHintId = useId();
  const qualityId = useId();
  const qualityHintId = useId();
  const brightnessId = useId();
  const contrastId = useId();
  const saturationId = useId();
  const brushId = useId();
  const colorId = useId();
  const textId = useId();
  const fontId = useId();
  const cropXId = useId();
  const cropYId = useId();
  const cropWId = useId();
  const cropHId = useId();
  const stageId = useId();
  const refusalId = useId();

  const natural: Size = useMemo(
    () => (image ? { width: image.width, height: image.height } : { width: 0, height: 0 }),
    [image],
  );
  const frame: Size = useMemo(
    () => outputFrame(natural, edit.rotation, edit.flipH, edit.flipV, edit.crop),
    [natural, edit.rotation, edit.flipH, edit.flipV, edit.crop],
  );
  const plan = useMemo(() => (image ? planOutput(frame, edit.scale) : null), [image, frame, edit.scale]);
  const spec = exportFormatSpec(format);

  /**
   * The canvas a given state should be painted into, computed from that state
   * alone — never from a size captured when the component last re-rendered. A
   * refusal returns null: the export does not fit, so nothing is painted and the
   * last render that did fit is left on screen rather than blanked.
   */
  const planPaint = useCallback((state: EditState, viewMode: ViewMode, size: Size): Paint | null => {
    if (viewMode === "crop") {
      const full = outputFrame(size, state.rotation, state.flipH, state.flipV, null);
      return {
        target: previewTarget(size, state.rotation, state.flipH, state.flipV, null, full),
        unit: 1,
      };
    }
    const frameNow = outputFrame(size, state.rotation, state.flipH, state.flipV, state.crop);
    const planned = planOutput(frameNow, state.scale);
    if (!planned.ok) return null;
    return {
      target: previewTarget(size, state.rotation, state.flipH, state.flipV, state.crop, planned),
      unit: planned.width > 0 ? previewScaleFor(planned.width, planned.height) : 1,
    };
  }, []);

  const expected = useMemo(
    () => (image ? planPaint(edit, view, natural) : null),
    [image, edit, view, natural, planPaint],
  );
  /** What the stage is sized from: the last paint, or the size it is about to be. */
  const shown: Paint | null = paint ?? expected;
  const stage = shown?.target ?? null;
  const adjusted = !adjustmentsAreNeutral(edit.adjust) || edit.filter !== DEFAULT_FILTER;


  const drawAnnotation = useCallback(
    (ctx: CanvasRenderingContext2D, matrix: Matrix, unit: number, a: Annotation) => {
      const pts = a.points.map((p) => applyMatrix(matrix, p.x, p.y));
      const stroke = widthOnCanvas(a.width, unit);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = stroke;
      if (a.kind === "text") {
        ctx.font = `${widthOnCanvas(a.fontSize ?? DEFAULT_FONT_PX, unit)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(a.text ?? "", pts[0]?.x ?? 0, pts[0]?.y ?? 0);
        ctx.restore();
        return;
      }
      if (a.kind === "brush") {
        if (pts.length === 1) {
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, stroke / 2), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      if (pts.length < 2) {
        ctx.restore();
        return;
      }
      const from = pts[0];
      const to = pts[pts.length - 1];
      if (a.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else if (a.kind === "rect") {
        ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        // The head is sized in output pixels too, so an arrowhead is the same
        // shape at 400% as it is on screen at 10%.
        const headLength = Math.max(6, a.width * 4);
        const [h1, h2] = arrowHead(to, from, widthOnCanvas(headLength, unit));
        ctx.beginPath();
        ctx.moveTo(h1.x, h1.y);
        ctx.lineTo(to.x, to.y);
        ctx.lineTo(h2.x, h2.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
    [],
  );

  const paintOverlay = useCallback(
    (matrix: Matrix, list: Annotation[], live: Annotation | null, w: number, h: number, unit: number) => {
      const canvas = overlayRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const a of list) drawAnnotation(ctx, matrix, unit, a);
      if (live) drawAnnotation(ctx, matrix, unit, live);
    },
    [drawAnnotation],
  );

  const paintCropOverlay = useCallback((matrix: Matrix, crop: Rect | null, w: number, h: number) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!crop) return;
    const box = projectRect(crop, matrix);
    const x = Math.max(0, Math.min(w, box.x));
    const y = Math.max(0, Math.min(h, box.y));
    const rw = Math.max(0, Math.min(w, box.x + box.width) - x);
    const rh = Math.max(0, Math.min(h, box.y + box.height) - y);
    ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
    ctx.fillRect(0, 0, w, y);
    ctx.fillRect(0, y + rh, w, h - (y + rh));
    ctx.fillRect(0, y, x, rh);
    ctx.fillRect(x + rw, y, w - (x + rw), rh);
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, Math.max(0, rw - 2), Math.max(0, rh - 2));
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + (rw * i) / 3, y);
      ctx.lineTo(x + (rw * i) / 3, y + rh);
      ctx.moveTo(x, y + (rh * i) / 3);
      ctx.lineTo(x + rw, y + (rh * i) / 3);
      ctx.stroke();
    }
  }, []);

  const paintBase = useCallback((state: EditState, planned: Paint) => {
    const canvas = baseRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return null;
    const { target } = planned;
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.setTransform(
      target.matrix[0],
      target.matrix[1],
      target.matrix[2],
      target.matrix[3],
      target.matrix[4],
      target.matrix[5],
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!adjustmentsAreNeutral(state.adjust) || state.filter !== DEFAULT_FILTER) {
      const pixels = ctx.getImageData(0, 0, target.width, target.height);
      applyAdjustments(pixels.data, state.adjust, state.filter);
      ctx.putImageData(pixels, 0, 0);
    }
    return planned;
  }, []);

  const redraw = useCallback(
    async (state: EditState, viewMode: ViewMode, announce: string) => {
      const run = ++runIdRef.current;
      const bitmap = bitmapRef.current;
      if (!bitmap) return;
      const size: Size = { width: bitmap.width, height: bitmap.height };
      const planned = planPaint(state, viewMode, size);
      if (!planned) {
        // Over the output budget: nothing is painted, so the last render that
        // did fit stays on screen, and the refusal is announced.
        const refused = planOutput(
          outputFrame(size, state.rotation, state.flipH, state.flipV, state.crop),
          state.scale,
        );
        setError(refused.ok ? "" : refused.message);
        return;
      }
      setBusy(true);
      setStatus(announce);
      await nextFrame();
      if (run !== runIdRef.current) return;
      const painted = paintBase(state, planned);
      if (run !== runIdRef.current) return;
      if (!painted) {
        setBusy(false);
        setStatus("");
        return;
      }
      paintRef.current = painted;
      setPaint(painted);
      const { target, unit } = painted;
      if (viewMode === "crop") paintCropOverlay(target.matrix, state.crop, target.width, target.height);
      else paintOverlay(target.matrix, state.annotations, null, target.width, target.height, unit);
      if (run === runIdRef.current) {
        setBusy(false);
        setStatus("");
      }
    },
    [planPaint, paintBase, paintOverlay, paintCropOverlay],
  );

  const pushUndo = useCallback((state: EditState) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), state]);
  }, []);

  const releaseResultUrl = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = "";
  };

  /**
   * Any change to the edit state makes the bytes in the result panel wrong, so
   * the panel goes — and the object URL backing it is revoked rather than left
   * for the browser to collect whenever it gets round to it.
   */
  const clearResult = useCallback(() => {
    releaseResultUrl();
    setResult(null);
  }, []);

  const applyEdit = useCallback(
    (patch: Partial<EditState>, viewMode: ViewMode = view) => {
      const next = { ...edit, ...patch };
      pushUndo(edit);
      setEdit(next);
      clearResult();
      void redraw(
        next,
        viewMode,
        viewMode === "crop" ? "Rendering the whole frame for cropping…" : "Rendering the preview…",
      );
    },
    [edit, view, redraw, pushUndo, clearResult],
  );

  useEffect(() => () => releaseResultUrl(), []);

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    const run = ++runIdRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    clearResult();
    setStatus("Reading the file header…");
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw userFacing(
          `That file is ${formatBytes(file.size)} — images up to ${FILE_SIZE_LABEL} are supported here.`,
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (run !== runIdRef.current) return;
      const checked = preflightImage(bytes, file.name);
      if (!checked.ok) throw userFacing(checked.message);
      // imageOrientation: "from-image" is what makes a sideways phone photo
      // arrive upright; the rest of the EXIF block is gone the moment the pixels
      // are decoded, and nothing is written back into the file.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (run !== runIdRef.current) {
        bitmap.close();
        return;
      }
      const old = bitmapRef.current;
      bitmapRef.current = bitmap;
      if (old) old.close();
      setImage({ name: file.name, size: bytes.length, label: checked.label, width: bitmap.width, height: bitmap.height });
      const fresh: EditState = { ...INITIAL_EDIT, annotations: [] };
      setEdit(fresh);
      setUndoStack([]);
      setCropTexts({ x: "0", y: "0", width: "0", height: "0" });
      setScaleText(String(DEFAULT_SCALE));
      setView("output");
      setTool("none");
      setMessage(
        `Loaded ${file.name} — a ${checked.label} of ${describeImageSize(bitmap.width, bitmap.height)}, ${formatBytes(bytes.length)}. Nothing was uploaded.`,
      );
      setBusy(false);
      setStatus("");
      await nextFrame();
      if (run !== runIdRef.current) return;
      await redraw(fresh, "output", "Rendering the preview…");
    } catch (err) {
      if (run !== runIdRef.current) return;
      setBusy(false);
      setStatus("");
      setImage(null);
      setError(toUiError(err));
    }
  };

  const onFilePick = (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    void openFile(file);
  };

  const clearAll = () => {
    runIdRef.current += 1;
    const bitmap = bitmapRef.current;
    bitmapRef.current = null;
    if (bitmap) bitmap.close();
    clearResult();
    paintRef.current = null;
    setPaint(null);
    setImage(null);
    setEdit(INITIAL_EDIT);
    setUndoStack([]);
    setCropTexts({ x: "0", y: "0", width: "0", height: "0" });
    setScaleText(String(DEFAULT_SCALE));
    setView("output");
    setTool("none");
    setError("");
    setMessage("");
    setStatus("");
    setBusy(false);
  };

  const undo = () => {
    if (undoStack.length === 0 || busy) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setCropTexts({
      x: String(previous.crop?.x ?? 0),
      y: String(previous.crop?.y ?? 0),
      width: String(previous.crop?.width ?? 0),
      height: String(previous.crop?.height ?? 0),
    });
    setScaleText(String(previous.scale));
    clearResult();
    setEdit(previous);
    void redraw(previous, view, "Undoing the last change…");
  };

  const resetEdits = () => {
    if (busy || !image) return;
    applyEdit({
      rotation: 0,
      flipH: false,
      flipV: false,
      crop: null,
      scale: DEFAULT_SCALE,
      adjust: NEUTRAL_ADJUSTMENTS,
      filter: DEFAULT_FILTER,
      annotations: [],
    });
    setCropTexts({ x: "0", y: "0", width: "0", height: "0" });
    setScaleText(String(DEFAULT_SCALE));
    setTool("none");
  };

  const commitScale = (raw: string) => {
    const next = clampScale(Number(raw));
    setScaleText(String(next));
    if (next !== edit.scale) applyEdit({ scale: next });
  };

  const commitCrop = (requested: Rect) => {
    const next = normalizeCrop(requested, natural);
    if (!next) {
      setError(
        `A crop has to be at least ${MIN_CROP_PX} × ${MIN_CROP_PX} px and inside the ${natural.width} × ${natural.height} px image. Nothing was changed.`,
      );
      return;
    }
    setError("");
    setCropTexts({ x: String(next.x), y: String(next.y), width: String(next.width), height: String(next.height) });
    applyEdit({ crop: next }, "crop");
  };

  const clearCrop = () => {
    if (!edit.crop) return;
    setCropTexts({ x: "0", y: "0", width: "0", height: "0" });
    applyEdit({ crop: null });
  };

  const openCropView = () => {
    if (!image || view === "crop") return;
    setView("crop");
    setTool("none");
    setMessage("");
    setError("");
    void redraw(edit, "crop", "Rendering the whole frame for cropping…");
  };

  const applyCrop = () => {
    if (!image) return;
    setView("output");
    setError("");
    void redraw(edit, "output", edit.crop ? "Applying the crop…" : "Nothing is cropped — rendering the whole frame…");
  };

  const stagePoint = (event: React.PointerEvent<HTMLDivElement>): Point | null => {
    const node = stageRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * (stage?.width ?? 0),
      y: ((event.clientY - rect.top) / rect.height) * (stage?.height ?? 0),
    };
  };

  /**
   * A screen point in the image's own coordinates. The inverse of the matrix
   * the canvas was actually painted with, taken from the paint itself, so a
   * pointer can never be mapped through a matrix from an earlier size.
   */
  const naturalPoint = (point: Point): Point => {
    const painted = paintRef.current;
    if (!painted) return { x: 0, y: 0 };
    const raw = applyMatrix(invertMatrix(painted.target.matrix), point.x, point.y);
    return {
      x: Math.max(0, Math.min(natural.width, raw.x)),
      y: Math.max(0, Math.min(natural.height, raw.y)),
    };
  };

  const dragRef = useRef<{ kind: "crop" | AnnotationKind; start: Point } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!image || busy || view === "crop" || tool === "none") return;
    const point = stagePoint(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = naturalPoint(point);
    if (tool === "text") {
      const value = clampAnnotationText(textValue);
      if (!value) {
        setError("Type the text to stamp before choosing the Text tool — an empty stamp draws nothing.");
        return;
      }
      const annotation: Annotation = {
        kind: "text",
        points: [start],
        color: brushColor,
        width: brushWidth,
        text: value,
        fontSize: clampFontSize(fontSize),
      };
      setError("");
      applyEdit({ annotations: [...edit.annotations, annotation] });
      return;
    }
    const painted = paintRef.current;
    if (!painted) return;
    dragRef.current = { kind: tool, start };
    const annotation: Annotation = {
      kind: tool,
      points: [start, start],
      color: brushColor,
      // Screen pixels become output pixels, so a stroke you drew thin is thin in
      // the file rather than fatter than it looked.
      width: outputBrushWidth(brushWidth, painted.unit),
    };
    liveRef.current = annotation;
    paintOverlay(
      painted.target.matrix,
      edit.annotations,
      annotation,
      painted.target.width,
      painted.target.height,
      painted.unit,
    );
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const painted = paintRef.current;
    if (!drag || !image || !painted) return;
    const point = stagePoint(event);
    if (!point) return;
    const current = naturalPoint(point);
    const live = liveRef.current;
    if (!live || live.kind === "text") return;
    if (live.kind === "brush") {
      const points = live.points.length > 1 ? live.points.slice(0, -1) : live.points;
      live.points = [...points, current];
    } else {
      live.points = [drag.start, current];
    }
    paintOverlay(
      painted.target.matrix,
      edit.annotations,
      live,
      painted.target.width,
      painted.target.height,
      painted.unit,
    );
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const live = liveRef.current;
    liveRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const painted = paintRef.current;
    if (!live || !image || !painted) {
      if (painted) {
        paintOverlay(
          painted.target.matrix,
          edit.annotations,
          null,
          painted.target.width,
          painted.target.height,
          painted.unit,
        );
      }
      return;
    }
    const tolerance = Math.hypot(natural.width, natural.height) * FREEFHAND_TOLERANCE;
    const points = live.kind === "brush" ? simplifyFreehand(live.points, tolerance) : live.points;
    const moved = points.length > 1 || live.kind === "text";
    if (!moved) {
      paintOverlay(
        painted.target.matrix,
        edit.annotations,
        null,
        painted.target.width,
        painted.target.height,
        painted.unit,
      );
      return;
    }
    setError("");
    applyEdit({ annotations: [...edit.annotations, { ...live, points }] });
  };

  // ---- crop drag, which lives in the crop view ---------------------------

  const cropDragRef = useRef<Point | null>(null);
  const cropBaseRef = useRef<EditState | null>(null);

  const onCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!image || view !== "crop") return;
    const point = stagePoint(event);
    const painted = paintRef.current;
    if (!point || !painted) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    // The crop lives in the image's own coordinates, so the drag is measured
    // there too: the painted matrix is inverted once, and a rotation or a mirror
    // needs no special case at all.
    cropDragRef.current = naturalPoint(point);
    // One undo entry per drag, not one per pointer move.
    cropBaseRef.current = edit;
  };

  const onCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (view !== "crop" || !cropDragRef.current || !image) return;
    const point = stagePoint(event);
    const painted = paintRef.current;
    if (!point || !painted) return;
    const start = cropDragRef.current;
    const current = naturalPoint(point);
    const next = normalizeCrop(
      { x: start.x, y: start.y, width: current.x - start.x, height: current.y - start.y },
      natural,
    );
    if (!next) return;
    setCropTexts({ x: String(next.x), y: String(next.y), width: String(next.width), height: String(next.height) });
    setEdit((prev) => ({ ...prev, crop: next }));
    paintCropOverlay(painted.target.matrix, next, painted.target.width, painted.target.height);
  };

  const onCropPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const base = cropBaseRef.current;
    cropDragRef.current = null;
    cropBaseRef.current = null;
    // A drag is one change, so it is one step in the history.
    if (base && (base.crop?.x !== edit.crop?.x || base.crop?.y !== edit.crop?.y ||
      base.crop?.width !== edit.crop?.width || base.crop?.height !== edit.crop?.height)) {
      pushUndo(base);
      clearResult();
    }
  };

  // ---- export ------------------------------------------------------------

  const exportImage = async () => {
    if (!image || busy) return;
    const run = ++runIdRef.current;
    const bitmap = bitmapRef.current;
    if (!bitmap || !plan) return;
    if (!plan.ok) {
      // Refused: the reason is repeated in an alert and nothing is drawn, so the
      // last render that fitted — and any file already exported — stay as they are.
      setMessage("");
      setError(plan.message);
      return;
    }
    setError("");
    setMessage("");
    clearResult();
    setBusy(true);
    setStatus(`Encoding ${spec.label} at ${plan.width} × ${plan.height} px…`);
    await nextFrame();
    if (run !== runIdRef.current) return;
    let canvas: HTMLCanvasElement | null = null;
    try {
      const size: Size = { width: bitmap.width, height: bitmap.height };
      // The same geometry the preview used, at the file's real size.
      const target = renderTarget(
        size,
        edit.rotation,
        edit.flipH,
        edit.flipV,
        edit.crop,
        plan.width,
        plan.height,
      );
      canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no 2d context");
      if (!spec.alpha) {
        // JPEG has no transparency channel, so the pixels behind it are white.
        ctx.fillStyle = WHITE;
        ctx.fillRect(0, 0, target.width, target.height);
      }
      ctx.setTransform(
        target.matrix[0],
        target.matrix[1],
        target.matrix[2],
        target.matrix[3],
        target.matrix[4],
        target.matrix[5],
      );
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (adjusted) {
        const pixels = ctx.getImageData(0, 0, target.width, target.height);
        applyAdjustments(pixels.data, edit.adjust, edit.filter);
        ctx.putImageData(pixels, 0, 0);
      }
      // Unit 1: the canvas is the file, so a stroke is exactly its stored width.
      for (const a of edit.annotations) drawAnnotation(ctx, target.matrix, 1, a);

      const wanted = spec.mime;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas
          ? canvas.toBlob(resolve, wanted, qualityAppliesTo(format) ? quality : undefined)
          : resolve(null),
      );
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      canvas = null;
      if (run !== runIdRef.current) return;
      if (!blob) throw userFacing(editorErrorMessage(new Error("unable to encode the canvas")));
      const out = new Uint8Array(await blob.arrayBuffer());
      if (run !== runIdRef.current) return;
      const filename = outputNameForMime(
        image.name,
        {
          width: plan.width,
          height: plan.height,
          rotation: edit.rotation,
          flipH: edit.flipH,
          flipV: edit.flipV,
          crop: edit.crop,
          scale: edit.scale,
          filter: edit.filter,
          adjusted: !adjustmentsAreNeutral(edit.adjust),
          annotated: edit.annotations.length > 0,
        },
        blob.type,
      );
      if (!filename) throw userFacing(editorErrorMessage(new Error("unsupported mime type from the encoder")));
      downloadBlob(out, filename, blob.type);
      const url = URL.createObjectURL(new Blob([out as Uint8Array<ArrayBuffer>], { type: blob.type }));
      releaseResultUrl();
      resultUrlRef.current = url;
      const realFormat = formatForMime(blob.type) ?? format;
      setResult({
        bytes: out,
        filename,
        width: plan.width,
        height: plan.height,
        mime: blob.type,
        format: realFormat,
        url,
      });
      setMessage(
        `Exported ${plan.width} × ${plan.height} px as ${realFormat.toUpperCase()}, ${formatBytes(out.length)} — downloaded ${filename}.`,
      );
      if (blob.type !== wanted) {
        setError(
          `This browser cannot encode ${wanted.replace("image/", "").toUpperCase()}, so you got ${blob.type.replace("image/", "").toUpperCase()} instead. The file is named ${filename}, so the extension matches the bytes you actually received.`,
        );
      }
    } catch (err) {
      if (run !== runIdRef.current) return;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      setError(toUiError(err));
    } finally {
      if (run === runIdRef.current) {
        setBusy(false);
        setStatus("");
      }
    }
  };

  const canUndo = undoStack.length > 0 && !busy;
  const outputLine = plan
    ? plan.ok
      ? `${plan.width} × ${plan.height} px`
      : `${plan.width} × ${plan.height} px — refused`
    : "—";
  const editLine = [
    edit.rotation ? `rotated ${edit.rotation}°` : null,
    edit.flipH ? "mirrored" : null,
    edit.crop ? `cropped ${edit.crop.width} × ${edit.crop.height}` : null,
    edit.scale !== DEFAULT_SCALE ? `${edit.scale}%` : null,
    adjustmentSummary(edit.adjust) !== "none" ? `adjusted (${adjustmentSummary(edit.adjust)})` : null,
    edit.filter !== DEFAULT_FILTER ? edit.filter : null,
    annotationCountLabel(edit.annotations.length),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="sr-only"
        aria-label="Open an image to edit"
        onChange={(e) => onFilePick(e.target.files?.[0] ?? undefined)}
      />
      <span className="sr-only" role="status">
        {busy ? status || "Working on the image…" : ""}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={fileInputId}
          className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
            busy
              ? "opacity-60 pointer-events-none"
              : "bg-pink-600 text-white hover:bg-pink-700 shadow-md shadow-pink-500/20 cursor-pointer"
          }`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileImage className="w-4 h-4" aria-hidden="true" />
          )}
          {image ? "Open another image" : "Open image"}
        </label>
        {image && (
          <Button type="button" variant="secondary" disabled={busy} onClick={clearAll}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
            Close image
          </Button>
        )}
        <p className="text-sm text-slate-600" role="status">
          {image
            ? `${image.name} — ${image.label}, ${describeImageSize(image.width, image.height)}, ${formatBytes(image.size)}. Decoded and edited on this device.`
            : `Open a ${ACCEPTED_FORMAT_NAMES} image up to ${FILE_SIZE_LABEL} to crop, rotate, resize, adjust, annotate and export it. It is decoded and edited on this device — it is never uploaded.`}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {error}
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

      {image && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rotate and mirror
              </legend>
              <div className="flex flex-wrap gap-2">
                {([0, 90, 180, 270] as Rotation[]).map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    disabled={busy}
                    aria-pressed={edit.rotation === deg}
                    onClick={() => applyEdit({ rotation: deg })}
                    className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
                      edit.rotation === deg
                        ? "border-pink-600 bg-pink-50 text-pink-800"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={edit.flipH}
                  onClick={() => applyEdit({ flipH: !edit.flipH })}
                  className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
                    edit.flipH
                      ? "border-pink-600 bg-pink-50 text-pink-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Mirror left–right
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={edit.flipV}
                  onClick={() => applyEdit({ flipV: !edit.flipV })}
                  className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
                    edit.flipV
                      ? "border-pink-600 bg-pink-50 text-pink-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Mirror top–bottom
                </button>
                <Button type="button" variant="secondary" disabled={busy} onClick={resetEdits}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                  Reset edits
                </Button>
                <Button type="button" variant="secondary" disabled={!canUndo} onClick={undo}>
                  <Undo2 className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                  Undo
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Rotation and mirroring are exact: pixels move, nothing is resampled and nothing is
                lost. A crop you have set is carried through them.
              </p>
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Size
              </legend>
              <label htmlFor={scaleId} className="block text-sm font-medium text-slate-700 mb-1">
                Scale (%)
              </label>
              <input
                id={scaleId}
                type="number"
                inputMode="numeric"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={SCALE_STEP}
                aria-describedby={scaleHintId}
                disabled={busy}
                value={scaleText}
                onChange={(e) => setScaleText(e.target.value)}
                onBlur={(e) => commitScale(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  commitScale(e.currentTarget.value);
                }}
                className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none disabled:opacity-60"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label htmlFor={scaleSliderId} className="sr-only">
                  Scale slider, {edit.scale}% of the original size
                </label>
                <input
                  id={scaleSliderId}
                  type="range"
                  min={MIN_SCALE}
                  max={MAX_SCALE}
                  step={SCALE_STEP}
                  disabled={busy}
                  value={edit.scale}
                  onChange={(e) => commitScale(e.target.value)}
                  className="flex-1 min-w-40 accent-pink-600"
                />
                {SCALE_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={busy}
                    aria-pressed={edit.scale === choice}
                    onClick={() => {
                      setScaleText(String(choice));
                      applyEdit({ scale: choice });
                    }}
                    className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
                      edit.scale === choice
                        ? "border-pink-600 bg-pink-50 text-pink-800"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {choice}%
                  </button>
                ))}
              </div>
              <p id={scaleHintId} className="mt-2 text-xs text-slate-600">
                {plan && plan.ok
                  ? `The file will be ${plan.width} × ${plan.height} px. One scale is applied to both axes, so the image is never stretched or squashed.`
                  : plan
                    ? plan.message
                    : ""}
              </p>
            </fieldset>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Adjust
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["Brightness", "brightness"],
                    ["Contrast", "contrast"],
                    ["Saturation", "saturation"],
                  ] as const
                ).map(([label, key]) => {
                  const fieldId = key === "brightness" ? brightnessId : key === "contrast" ? contrastId : saturationId;
                  return (
                    <div key={key} className="min-w-0">
                      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700 mb-1">
                        {label} ({edit.adjust[key] > 0 ? "+" : ""}
                        {edit.adjust[key]}%)
                      </label>
                      <input
                        id={fieldId}
                        type="range"
                        min={ADJUST_MIN}
                        max={ADJUST_MAX}
                        step={1}
                        disabled={busy}
                        value={edit.adjust[key]}
                        onChange={(e) =>
                          applyEdit({ adjust: { ...edit.adjust, [key]: clampAdjust(Number(e.target.value)) } })
                        }
                        className="w-full accent-pink-600"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={edit.filter === f.id}
                    title={f.note}
                    onClick={() => applyEdit({ filter: f.id })}
                    className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
                      edit.filter === f.id
                        ? "border-pink-600 bg-pink-50 text-pink-800"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {`Adjustments and the filter are baked into the pixels, in that order, and every pixel is computed here rather than by the browser's own filter. The active look is ${adjustmentSummary(edit.adjust)}${
                  edit.filter === DEFAULT_FILTER ? " with no filter" : ` then ${edit.filter}`
                }. Each change is applied when you release the slider.`}
              </p>
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Crop
              </legend>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  aria-pressed={view === "crop"}
                  onClick={openCropView}
                >
                  <CropIcon className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                  {view === "crop" ? "Cropping" : "Crop"}
                </Button>
                <Button type="button" disabled={busy || view !== "crop"} onClick={applyCrop}>
                  Apply crop
                </Button>
                <Button type="button" variant="secondary" disabled={busy || !edit.crop} onClick={clearCrop}>
                  <Eraser className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                  Clear crop
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(
                  [
                    ["X", cropXId, "x"],
                    ["Y", cropYId, "y"],
                    ["Width", cropWId, "width"],
                    ["Height", cropHId, "height"],
                  ] as const
                ).map(([label, fieldId, key]) => (
                  <div key={key}>
                    <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600 mb-1">
                      {label} (px)
                    </label>
                    <input
                      id={fieldId}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      disabled={busy}
                      value={cropTexts[key]}
                      onChange={(e) => setCropTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        commitCrop({
                          x: Number(cropTexts.x),
                          y: Number(cropTexts.y),
                          width: Number(cropTexts.width),
                          height: Number(cropTexts.height),
                        });
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none disabled:opacity-60"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {`Press Crop to see the whole frame, then drag a rectangle on it — or type the numbers above and press Enter, which works with a keyboard alone. A crop has to be at least ${MIN_CROP_PX} × ${MIN_CROP_PX} px, is clamped inside the image, and is stored in the image's own coordinates, so it survives a later rotation.`}
              </p>
            </fieldset>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Annotate
              </legend>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["none", "Select", MousePointer2],
                    ["brush", "Brush", BrushIcon],
                    ["line", "Line", Pen],
                    ["rect", "Rectangle", Square],
                    ["arrow", "Arrow", MoveUpRight],
                    ["text", "Text", TypeIcon],
                  ] as const
                ).map(([kind, label, Icon]) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={busy || view === "crop"}
                    aria-pressed={tool === kind}
                    onClick={() => setTool(kind)}
                    className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 disabled:opacity-50 ${
                      tool === kind
                        ? "border-pink-600 bg-pink-50 text-pink-800"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor={colorId} className="block text-xs font-medium text-slate-600 mb-1">
                    Colour
                  </label>
                  <input
                    id={colorId}
                    type="color"
                    value={brushColor}
                    disabled={busy || view === "crop"}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-12 h-9 rounded-lg border border-slate-300 cursor-pointer disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor={brushId} className="block text-xs font-medium text-slate-600 mb-1">
                    Width ({brushWidth} px)
                  </label>
                  <input
                    id={brushId}
                    type="range"
                    min={MIN_BRUSH_PX}
                    max={MAX_BRUSH_PX}
                    step={1}
                    value={brushWidth}
                    disabled={busy || view === "crop"}
                    onChange={(e) => setBrushWidth(clampBrush(Number(e.target.value)))}
                    className="w-full accent-pink-600"
                  />
                </div>
                <div>
                  <label htmlFor={fontId} className="block text-xs font-medium text-slate-600 mb-1">
                    Text size ({fontSize} px)
                  </label>
                  <input
                    id={fontId}
                    type="range"
                    min={MIN_FONT_PX}
                    max={MAX_FONT_PX}
                    step={1}
                    value={fontSize}
                    disabled={busy || view === "crop"}
                    onChange={(e) => setFontSize(clampFontSize(Number(e.target.value)))}
                    className="w-full accent-pink-600"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor={textId} className="block text-xs font-medium text-slate-600 mb-1">
                  Text to stamp
                </label>
                <input
                  id={textId}
                  type="text"
                  maxLength={MAX_TEXT_CHARS}
                  value={textValue}
                  disabled={busy || view === "crop"}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none disabled:opacity-60"
                  placeholder="Type here, then choose Text and click the image"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || edit.annotations.length === 0}
                  onClick={() => applyEdit({ annotations: [] })}
                >
                  <Minus className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                  Clear annotations
                </Button>
                <Button type="button" variant="secondary" disabled={!canUndo} onClick={undo}>
                  <Undo2 className="w-3.5 h-3.5 mr-1.5 inline" aria-hidden="true" />
                  Undo
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {`${annotationCountLabel(edit.annotations.length)}. Draw with a pointer on the image; every other operation here has a control you can reach with a keyboard, and the file can be exported without drawing anything. A freehand stroke is stored as at most ${MAX_STROKE_POINTS} simplified points, a stamp keeps the font and size it was drawn with, and both are recorded in the file's own pixels so a stroke you drew thin is thin in the export.`}
              </p>
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Export
              </legend>
              <label htmlFor={formatId} className="block text-sm font-medium text-slate-700 mb-1">
                File format
              </label>
              <select
                id={formatId}
                value={format}
                disabled={busy}
                aria-describedby={formatHintId}
                onChange={(e) => setFormat(e.target.value as ExportFormatId)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none disabled:opacity-60"
              >
                {(["png", "jpeg", "webp"] as ExportFormatId[]).map((id) => (
                  <option key={id} value={id}>
                    {exportFormatSpec(id).label}
                  </option>
                ))}
              </select>
              <p id={formatHintId} className="mt-2 text-xs text-slate-600">
                {spec.note}
              </p>
              <div className="mt-3">
                <label htmlFor={qualityId} className="block text-sm font-medium text-slate-700 mb-1">
                  JPEG / WebP quality ({qualityLabel(quality)})
                </label>
                <input
                  id={qualityId}
                  type="range"
                  min={JPEG_QUALITY_MIN}
                  max={JPEG_QUALITY_MAX}
                  step={JPEG_QUALITY_STEP}
                  disabled={busy || !qualityAppliesTo(format)}
                  value={quality}
                  aria-describedby={qualityHintId}
                  onChange={(e) => setQuality(clampQuality(Number(e.target.value)))}
                  className="w-full accent-pink-600 disabled:opacity-50"
                />
                <p id={qualityHintId} className="mt-1 text-xs text-slate-600">
                  {qualityAppliesTo(format)
                    ? `${qualityLabel(quality)} is the encoder's own 0–1 quality argument: 1.00 is its best lossy output, ${JPEG_QUALITY_MIN.toFixed(2)} is visibly soft. PNG ignores it.`
                    : "PNG is lossless, so this control does nothing for it."}
                </p>
              </div>
            </fieldset>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-700" role="status">
                {`${view === "crop" ? "Cropping view" : "Output"}: ${outputLine} · ${spec.label}${
                  qualityAppliesTo(format) ? ` at quality ${qualityLabel(quality)}` : " (lossless)"
                } · ${editLine}`}
              </p>
              <Button
                type="button"
                // A refused plan does not disable the button: a disabled control is
                // invisible to a keyboard user and to a screen reader, so the one
                // moment the reason matters most is the moment it would be needed.
                // Pressing it repeats the refusal in an alert instead.
                disabled={busy || !plan}
                onClick={() => void exportImage()}
                aria-describedby={plan && !plan.ok ? refusalId : undefined}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
                )}
                {busy ? "Working…" : `Download ${outputLine} ${spec.label}`}
              </Button>
            </div>
            {plan && !plan.ok && (
              <p id={refusalId} className="text-xs text-amber-800">
                {`${plan.message} The last render that fitted is still on screen, and pressing Download repeats this reason rather than quietly writing a different file.`}
              </p>
            )}
            <div
              id={stageId}
              ref={stageRef}
              className="relative mx-auto rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              style={{
                maxWidth: stage?.width ?? 1,
                width: "100%",
                aspectRatio: `${stage?.width ?? 1} / ${stage?.height ?? 1}`,
                touchAction: "none",
                cursor: view === "crop" ? "crosshair" : tool === "none" ? "default" : "crosshair",
              }}
              onPointerDown={view === "crop" ? onCropPointerDown : onPointerDown}
              onPointerMove={view === "crop" ? onCropPointerMove : onPointerMove}
              onPointerUp={view === "crop" ? onCropPointerUp : onPointerUp}
              onPointerCancel={view === "crop" ? onCropPointerUp : onPointerUp}
            >
              <canvas
                ref={baseRef}
                className="absolute inset-0 h-full w-full pointer-events-none"
                role="img"
                aria-label={`${view === "crop" ? "The whole frame" : "Edited image"} at ${stage?.width ?? 0} by ${stage?.height ?? 0} pixels on screen, ${
                  view === "crop"
                    ? edit.crop
                      ? `with a crop of ${edit.crop.width} by ${edit.crop.height} pixels outlined`
                      : "with no crop yet"
                    : `${annotationCountLabel(edit.annotations.length)}`
                }`}
              />
              <canvas
                ref={overlayRef}
                className="absolute inset-0 h-full w-full pointer-events-none"
                aria-hidden="true"
              />
            </div>
            <p className="text-xs text-slate-600">
              {`The screen canvas is capped at ${PREVIEW_MAX_SIDE_PX} px on the long side so a large image still repaints, while the downloaded file is always rendered at full size. Below that cap the two are the same pixels.`}
            </p>
          </div>
        </>
      )}

      {result && (
        <div
          role="region"
          aria-label="Exported image result"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"
        >
          <p className="text-sm font-semibold text-emerald-900" role="status">
            {`${result.width} × ${result.height} px · ${result.mime.replace("image/", "").toUpperCase()} · ${formatBytes(result.bytes.length)} · ${result.filename}`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => downloadBlob(result.bytes, result.filename, result.mime)}
            >
              <ImageDown className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
              Download {result.filename} again
            </Button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt={`The exported file: ${result.width} by ${result.height} pixels, ${result.filename}`}
              className="max-h-40 rounded-xl border border-emerald-200 bg-white w-auto"
            />
          </div>
          <p className="text-xs text-emerald-900">
            {`This is the file you downloaded, shown from the same bytes. Any further change clears this panel, so a stale export can never be saved again under a name it does not match.`}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">What this editor really does — and what it does not</h3>
        <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
          <li>
            Rotation, mirroring and cropping are exact: pixels move, nothing is resampled. Resizing
            is the browser&apos;s own resampler, so enlarging interpolates between the pixels you
            have — it cannot invent detail, and it is not an AI upscaler.
          </li>
          <li>
            {`One scale is applied to both axes, so nothing is stretched. The output is capped at ${PIXEL_BUDGET_LABEL} and ${SIDE_LIMIT_LABEL} per side; an export over either is refused with the largest scale that fits rather than quietly shrunk.`}
          </li>
          <li>
            {`Input is capped at ${FILE_SIZE_LABEL} and ${PIXEL_BUDGET_LABEL}, and a file over either is refused with its real numbers. The format is read from the file&apos;s own header bytes, so a renamed .png is refused.`}
          </li>
          <li>
            Every download is encoded again from the pixels on screen, even when you changed
            nothing: re-exporting an untouched JPEG is a second lossy generation, and this tool
            cannot copy a JPEG byte for byte. PNG is the only lossless choice here.
          </li>
          <li>
            The browser decodes the source, so {FLATTENED_FORMAT_NAMES} arrives as its first frame
            only, an animated file loses every frame after it, and no metadata is carried over —
            no EXIF, no camera, no GPS, no timestamps, no ICC profile. Output is untagged sRGB, so
            a wide-gamut photo can shift slightly. The one EXIF field that changes your picture is
            the orientation flag, and the browser applies it on the way in.
          </li>
          <li>
            There are no layers, no PSD, no selection tools, no healing, no AI and no raw
            (HEIC/AVIF/RAW) support. Annotations are baked into the same single canvas, they keep
            the width they were drawn with, and text is always drawn upright whatever rotation the
            image is at.
          </li>
          <li>
            Adjustments and the filter are applied per pixel in this tab, after the resize and
            before the annotations, so they are baked into the export rather than being a
            view-only effect. An edit on a {PIXEL_BUDGET_LABEL} image allocates about{" "}
            {Math.round((MAX_PIXELS * 4) / (1024 * 1024))} MB of pixel buffer and takes a moment.
          </li>
          <li>
            {`The file is named for what it is: <image>-<width>x<height>, then the rotation, a mirror, the filter, "adjusted" and "annotated" when they are in the file. Caps: ${FILE_SIZE_LABEL} in, ${PIXEL_BUDGET_LABEL} and ${SIDE_LIMIT_LABEL} out, a ${MIN_OUTPUT_PX} px minimum per side.`}
          </li>
        </ul>
        {!error && (
          <p className="text-xs text-slate-600">
            Need an exact pixel size or a smaller file?{" "}
            <Link
              href="/use/image-resizer"
              className="inline-flex items-center gap-1 font-semibold text-pink-700 underline"
            >
              Open Image Resizer <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
