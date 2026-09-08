"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Download, FileText, Loader2 } from "lucide-react";
import { Button, Field } from "@/components/ui";

type PageSize = "fit" | "a4" | "letter";

interface Item {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

function fileId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export default function ImageToPdf() {
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<PageSize>("fit");
  const [margin, setMargin] = useState(24);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        setItems((prev) => [
          ...prev,
          {
            id: fileId(),
            name: file.name,
            url,
            width: img.naturalWidth,
            height: img.naturalHeight,
          },
        ]);
      } catch {
        URL.revokeObjectURL(url);
      }
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const buildPdf = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const { PDFDocument, PageSizes } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const fixed = { a4: PageSizes.A4, letter: PageSizes.Letter };

      for (const it of items) {
        const resp = await fetch(it.url);
        const buf = await resp.arrayBuffer();
        let image: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
        try {
          image = isPng(it.name) ? await doc.embedPng(buf) : await doc.embedJpg(buf);
        } catch {
          image = null;
        }
        if (!image) {
          const el = await loadImage(it.url);
          const canvas = document.createElement("canvas");
          canvas.width = el.naturalWidth;
          canvas.height = el.naturalHeight;
          const g = canvas.getContext("2d");
          g?.drawImage(el, 0, 0);
          const jbuf = await (await fetch(canvas.toDataURL("image/jpeg", 0.92))).arrayBuffer();
          image = await doc.embedJpg(jbuf);
        }

        if (size === "fit") {
          doc.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0 });
        } else {
          const [pw, ph] = fixed[size];
          const innerW = pw - margin * 2;
          const innerH = ph - margin * 2;
          const scale = Math.min(innerW / image.width, innerH / image.height);
          const dw = image.width * scale;
          const dh = image.height * scale;
          const page = doc.addPage([pw, ph]);
          page.drawImage(image, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
        }
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "images.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          <Plus className="w-4 h-4 mr-1.5 inline" /> Add images
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Field label="Page size">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as PageSize)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="fit">Fit to each image</option>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </Field>
        {size !== "fit" && (
          <Field label={`Margin: ${margin}pt`}>
            <input
              type="range"
              min={0}
              max={96}
              step={4}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-40 accent-indigo-600"
            />
          </Field>
        )}
        <Button type="button" onClick={buildPdf} disabled={items.length === 0 || busy}>
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-1.5 inline" />
          )}
          {busy ? "Building…" : "Download PDF"}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          Add one or more images — they will be combined into a single PDF, entirely in your browser.
          Supports JPG and PNG.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden group"
            >
              <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="text-xs text-slate-500 truncate">{it.name}</p>
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="text-slate-400 hover:text-red-500 shrink-0"
                  aria-label="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isPng(name: string): boolean {
  return name.toLowerCase().endsWith(".png");
}