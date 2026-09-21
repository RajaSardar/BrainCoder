"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Download, FileText, Loader2 } from "lucide-react";
import { Button, SliderField } from "@/components/ui";

type PageSize = "fit" | "a4" | "letter";

interface Item {
  id: string;
  name: string;
  url: string;
  size: number;
  width: number;
  height: number;
}

const MAX_PAGE = 14400;

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

function triggerDownload(bytes: ArrayBuffer, name: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isPng(name: string): boolean {
  return name.toLowerCase().endsWith(".png");
}

export default function ImageToPdf() {
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<PageSize>("fit");
  const [margin, setMargin] = useState(24);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const seen = new Set(items.map((i) => `${i.name}:${i.size}`));
    const incoming = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && !seen.has(`${f.name}:${f.size}`),
    );
    if (incoming.length === 0) {
      setError("No new images to add — choose a different image file.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    let added = 0;
    let failed = 0;
    for (const file of incoming) {
      const url = URL.createObjectURL(file);
      urlsRef.current.add(url);
      try {
        const img = await loadImage(url);
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          urlsRef.current.delete(url);
          URL.revokeObjectURL(url);
          failed++;
          continue;
        }
        setItems((prev) => [
          ...prev,
          {
            id: fileId(),
            name: file.name,
            url,
            size: file.size,
            width: img.naturalWidth,
            height: img.naturalHeight,
          },
        ]);
        added++;
      } catch {
        urlsRef.current.delete(url);
        URL.revokeObjectURL(url);
        failed++;
      }
    }
    setBusy(false);
    const dupes = files.length - incoming.length;
    if (added > 0) {
      setStatus(
        `Added ${added} image${added === 1 ? "" : "s"}${failed ? `, skipped ${failed}` : ""}${dupes > 0 ? `, ${dupes} duplicate${dupes === 1 ? "" : "s"} ignored` : ""}.`,
      );
    } else if (failed > 0) {
      setError(`Couldn’t load ${failed} of the selected files.`);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        urlsRef.current.delete(target.url);
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const buildPdf = async () => {
    if (items.length === 0 || busy) return;
    const snapshot = items;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const { PDFDocument, PageSizes } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const fixed = { a4: PageSizes.A4, letter: PageSizes.Letter };
      const total = snapshot.length;
      let ok = 0;
      let failed = 0;
      for (let idx = 0; idx < total; idx++) {
        const it = snapshot[idx];
        setStatus(`Building page ${idx + 1} of ${total}…`);
        try {
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
            if (!g) throw new Error("Canvas unavailable");
            g.fillStyle = "#ffffff";
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.drawImage(el, 0, 0);
            const jbuf = new Uint8Array(await (await fetch(canvas.toDataURL("image/jpeg", 0.92))).arrayBuffer());
            image = await doc.embedJpg(jbuf);
          }
          if (size === "fit") {
            const pw = Math.min(image.width, MAX_PAGE);
            const ph = Math.min(image.height, MAX_PAGE);
            const page = doc.addPage([pw, ph]);
            const scale = Math.min(image.width > 0 ? pw / image.width : 1, image.height > 0 ? ph / image.height : 1);
            const dw = image.width * scale;
            const dh = image.height * scale;
            page.drawImage(image, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
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
          ok++;
        } catch {
          failed++;
        }
      }
      if (ok === 0) throw new Error("None of the images could be embedded into the PDF.");
      const bytes = await doc.save();
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      triggerDownload(buf, "images.pdf", "application/pdf");
      setStatus(`PDF saved — ${ok} page${ok === 1 ? "" : "s"}${failed ? `, ${failed} image${failed === 1 ? "" : "s"} skipped` : ""}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the PDF.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (busy) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) void addFiles(files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-5 w-full" aria-busy={busy}>
      <div className="flex flex-wrap items-end gap-4">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          <Plus className="w-4 h-4 mr-1.5 inline" aria-hidden="true" /> Add images
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          aria-label="Add images"
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div>
          <label htmlFor="image-pdf-size" className="text-xs font-medium text-slate-500">
            Page size
          </label>
          <select
            id="image-pdf-size"
            value={size}
            onChange={(e) => setSize(e.target.value as PageSize)}
            className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="fit">Fit to each image</option>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </div>
        {size !== "fit" && (
          <div className="w-48">
            <SliderField label="Margin" value={margin} min={0} max={96} step={4} unit="pt" onChange={setMargin} />
          </div>
        )}
        <Button type="button" onClick={() => void buildPdf()} disabled={items.length === 0 || busy}>
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" aria-hidden="true" />
          ) : (
            <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          )}
          {busy ? "Building…" : "Download PDF"}
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        {items.length} image{items.length === 1 ? "" : "s"} queued — JPG, PNG, WebP, BMP and static GIF.
      </p>

      {items.length === 0 ? (
        <div
          className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" aria-hidden="true" />
          Drag and drop images here, or click Add images — they will be combined into a single PDF, entirely in your
          browser.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" onDrop={onDrop} onDragOver={onDragOver}>
          {items.map((it, index) => (
            <div key={it.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden group">
              <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex flex-col gap-1 px-3 py-2">
                <p className="text-xs text-slate-500 truncate">{it.name}</p>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(it.id, -1)}
                      disabled={busy || index === 0}
                      aria-label={`Move ${it.name} up`}
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <ArrowUp className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(it.id, 1)}
                      disabled={busy || index === items.length - 1}
                      aria-label={`Move ${it.name} down`}
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <ArrowDown className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={busy}
                    aria-label={`Remove ${it.name}`}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {status && (
        <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
          {status}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}