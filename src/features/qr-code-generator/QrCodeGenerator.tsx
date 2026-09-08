"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download } from "lucide-react";
import { Button, Field, StyledTextarea } from "@/components/ui";

export default function QrCodeGenerator() {
  const [text, setText] = useState("https://braincoder.vercel.app");
  const [size, setSize] = useState(320);
  const [ec, setEc] = useState<"L" | "M" | "Q" | "H">("M");
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    const value = text.trim();
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: ec })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [text, size, ec]);

  const hasText = text.trim().length > 0;

  const downloadSvg = async () => {
    const value = text.trim();
    if (!value) return;
    const svg = await QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: ec });
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qrcode.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 w-full">
      <StyledTextarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text or URL to encode…"
      />

      <div className="flex flex-wrap items-end gap-4">
        <Field label={`Size: ${size}px`}>
          <input
            type="range"
            min={128}
            max={640}
            step={16}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-48 accent-emerald-600"
          />
        </Field>
        <Field label="Error correction">
          <select
            value={ec}
            onChange={(e) => setEc(e.target.value as typeof ec)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="L">L — 7%</option>
            <option value="M">M — 15%</option>
            <option value="Q">Q — 25%</option>
            <option value="H">H — 30%</option>
          </select>
        </Field>
      </div>

      {hasText && dataUrl ? (
        <div className="flex flex-wrap items-start gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="QR code" className="w-64 h-64 rounded-xl" />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <a
              href={dataUrl}
              download="qrcode.png"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Download PNG
            </a>
            <Button type="button" variant="secondary" onClick={downloadSvg}>
              <Download className="w-4 h-4 mr-1.5 inline" /> Download SVG
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
          <QrCode className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          Enter some text or a URL to generate a QR code.
        </div>
      )}
    </div>
  );
}