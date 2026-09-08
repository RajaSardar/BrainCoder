"use client";

import { useEffect, useState } from "react";
import { ImageIcon, ImagePlus, Download } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";
import { Field } from "@/components/ui";

interface Encoded {
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
  b64: string;
}

function dataUrlToB64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageBase64() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [encoded, setEncoded] = useState<Encoded[]>([]);
  const [b64Input, setB64Input] = useState("");
  const [mime, setMime] = useState("image/png");
  const [previewSrc, setPreviewSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const cleaned = b64Input.replace(/\s+/g, "");
    if (!cleaned) return;
    let src = "";
    try {
      src = `data:${mime};base64,${cleaned}`;
    } catch {
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      if (alive) setPreviewSrc(src);
    };
    img.onerror = () => {
      if (alive) setError("Invalid base64 for the selected image type.");
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [b64Input, mime]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list: Encoded[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Could not read file."));
        r.readAsDataURL(file);
      });
      list.push({ name: file.name, mime: file.type || "image/*", size: file.size, dataUrl, b64: dataUrlToB64(dataUrl) });
    }
    setEncoded(list);
  };

  const download = () => {
    if (!previewSrc) return;
    const a = document.createElement("a");
    a.href = previewSrc;
    a.download = `decoded-${Date.now()}.${mime.split("/")[1] || "png"}`;
    a.click();
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <ImageIcon className="w-4 h-4 text-violet-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["encode", "decode"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${
                mode === m ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "encode" ? "Image → Base64" : "Base64 → Image"}
            </button>
          ))}
        </div>
      </div>

      {mode === "encode" ? (
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/40 p-8 cursor-pointer hover:bg-violet-50 transition">
            <ImagePlus className="w-8 h-8 text-violet-500" />
            <span className="text-sm font-medium text-violet-700">
              Drop PNG, JPG, GIF, SVG, WEBP, BMP or AVIF files here — or click to browse
            </span>
            <span className="text-xs text-slate-400">Multiple files supported · nothing is uploaded</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </label>

          {encoded.length > 0 && (
            <div className="space-y-4">
              {encoded.map((e) => (
                <div key={e.name} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.dataUrl} alt={e.name} className="w-12 h-12 object-cover rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{e.name}</p>
<p className="text-xs text-slate-400">{e.mime} · {formatBytes(e.size)}</p>
                  </div>
                  <span className="text-xs text-slate-400">data:…;base64</span>
                  </div>
                  <textarea
                    readOnly
                    value={e.b64}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 break-all"
                  />
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={e.dataUrl} label="Copy data URL" />
                    <CopyButton text={e.b64} label="Copy base64" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Image type (defaults to PNG)">
              <select
                value={mime}
                onChange={(e) => {
                  setMime(e.target.value);
                  setError("");
                  setPreviewSrc("");
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp", "image/bmp"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="secondary" disabled={!previewSrc} onClick={download}>
                <Download className="w-4 h-4" /> Download image
              </Button>
            </div>
          </div>
          <label className="text-xs font-medium text-slate-500 block mb-2">Base64 input</label>
          <textarea
            value={b64Input}
            onChange={(e) => {
              setB64Input(e.target.value);
              setError("");
              setPreviewSrc("");
            }}
            rows={6}
            placeholder="Paste base64 here to preview the image…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
          />
          {previewSrc && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc} alt="Decoded preview" className="max-h-80 max-w-full rounded-lg shadow" />
            </div>
          )}
          {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Everything happens in your browser — images never leave your device.
      </p>
    </div>
  );
}