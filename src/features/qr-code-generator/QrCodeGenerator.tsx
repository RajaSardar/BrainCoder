"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download } from "lucide-react";
import { Button, Field, StyledTextarea } from "@/components/ui";

const DEFAULT_TEXT = "https://braincoder.sardar.dev";

// qrcode throws for payloads that can't fit the largest symbol version.
// We surface the raw message but keep the UI copy friendly and actionable.
function friendlyQrError(message: string): string {
  if (/too big|too long/i.test(message)) {
    return "That text is too long for a QR code. Try shortening it or using a URL shortener.";
  }
  return "Sorry, we couldn't generate that QR code. Please check your text and try again.";
}

export default function QrCodeGenerator() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [size, setSize] = useState(320);
  const [ec, setEc] = useState<"L" | "M" | "Q" | "H">("M");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const value = text.trim();
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: ec,
      color: { dark: fg, light: bg },
    })
      .then((url) => {
        if (cancelled) return;
        setDataUrl(url);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setDataUrl("");
        setError(friendlyQrError(err?.message ?? String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [text, size, ec, fg, bg]);

  const hasText = text.trim().length > 0;

  const downloadSvg = async () => {
    const value = text.trim();
    if (!value || !dataUrl) return;
    try {
      const svg = await QRCode.toString(value, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: ec,
        color: { dark: fg, light: bg },
      });
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qrcode.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer the revoke so the browser has started the download before the blob is freed.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Sorry, we couldn't export the SVG. Please try again.");
    }
  };

  return (
    <div className="space-y-5 w-full">
      <StyledTextarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text or URL to encode…"
      />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Field label={`Download size: ${size}px`}>
          <input
            type="range"
            min={100}
            max={1000}
            step={20}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="QR code size in pixels"
            className="w-48 accent-emerald-600"
          />
        </Field>
        <Field label="Error correction">
          <select
            value={ec}
            onChange={(e) => setEc(e.target.value as typeof ec)}
            aria-label="Error correction level"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="L">L — 7%</option>
            <option value="M">M — 15%</option>
            <option value="Q">Q — 25%</option>
            <option value="H">H — 30%</option>
          </select>
        </Field>
        <Field label="Foreground">
          <input
            type="color"
            value={fg}
            onChange={(e) => setFg(e.target.value)}
            aria-label="QR code foreground color"
            className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
          />
        </Field>
        <Field label="Background">
          <input
            type="color"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            aria-label="QR code background color"
            className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
          />
        </Field>
      </div>

      <div aria-live="polite">
        {hasText && error ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : hasText && dataUrl ? (
          <div className="flex flex-wrap items-start gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={`QR code encoding: ${text.trim()}`}
                className="w-64 h-64 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <a
                href={dataUrl}
                download="qrcode.png"
                className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 transition inline-flex items-center gap-1.5"
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
    </div>
  );
}