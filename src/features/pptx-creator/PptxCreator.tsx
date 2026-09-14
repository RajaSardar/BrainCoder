"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Presentation, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui";
import { buildTextPptx, type PptxSlide } from "@/lib/pptx";
import { downloadBlob } from "@/lib/download";

const EMPTY: PptxSlide = { title: "", body: [""] };

export default function PptxCreator() {
  const [slides, setSlides] = useState<PptxSlide[]>([{ ...EMPTY }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const update = (i: number, patch: Partial<PptxSlide>) => {
    setSlides((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setDone(false);
  };

  const updateBody = (i: number, value: string) => {
    const body = value.split("\n");
    update(i, { body });
  };

  const addSlide = () => {
    setSlides((prev) => [...prev, { ...EMPTY }]);
  };

  const removeSlide = (i: number) => {
    setSlides((prev) => (prev.length === 1 ? [{ ...EMPTY }] : prev.filter((_, j) => j !== i)));
    setDone(false);
  };

  const move = (i: number, dir: -1 | 1) => {
    setSlides((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const hasSlides = slides.some((s) => s.title.trim() || s.body.some((b) => b.trim()));

  const generate = async () => {
    if (!hasSlides) return;
    setBusy(true);
    setError("");
    try {
      const clean = slides
        .map((s) => ({
          title: s.title.trim() || `Slide ${slides.indexOf(s) + 1}`,
          body: s.body
            .map((b) => b.trim())
            .filter((b) => b.length > 0),
        }))
        .filter((s) => s.title || s.body.length);
      if (clean.length === 0) {
        setError("Add some content first.");
        return;
      }
      const bytes = buildTextPptx(clean);
      downloadBlob(
        bytes,
        "presentation.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the presentation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <p className="text-xs text-slate-500">
        Each card is a slide. Title on top, one bullet or line per row in the
        body. Wrap a line in <code className="bg-slate-100 px-1 rounded">**like this**</code> to
        make it bold on the slide.
      </p>

      <div className="space-y-4">
        {slides.map((s, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-md bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-semibold">
                Slide {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === slides.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete slide"
                  onClick={() => removeSlide(i)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <input
              value={s.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Slide title"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={s.body.join("\n")}
              onChange={(e) => updateBody(i, e.target.value)}
              placeholder={"One bullet per line\nSecond point"}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={addSlide}>
          <Plus className="w-4 h-4 mr-1.5 inline" /> Add slide
        </Button>
        <Button type="button" disabled={busy || !hasSlides} onClick={() => void generate()}>
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Presentation className="w-4 h-4 mr-1.5 inline" />
          )}
          Generate .pptx
        </Button>
        {done && (
          <span className="text-sm text-emerald-700 font-medium">
            presentation.pptx downloaded ({slides.length} slide{slides.length === 1 ? "" : "s"})
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}