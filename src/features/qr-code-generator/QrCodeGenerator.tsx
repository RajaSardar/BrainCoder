"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, X } from "lucide-react";
import { Button, Field, StyledTextarea } from "@/components/ui";

const DEFAULT_TEXT = "https://braincoder.sardar.dev";
const PREVIEW_SIZE = 256;
const TOO_LONG_MESSAGE =
  "That text is too long for a QR code. Try shortening it or using a URL shortener.";

const QR_V40_CAPACITY = {
  numeric: { L: 7089, M: 5596, Q: 3993, H: 3057 },
  alphanumeric: { L: 4296, M: 3391, Q: 2420, H: 1852 },
  byte: { L: 2953, M: 2331, Q: 1663, H: 1273 },
} as const;

const NUMERIC_RE = /^[0-9]+$/;
const ALPHANUMERIC_RE = /^[0-9A-Z $%*+\-./:]+$/;

function exceededCapacity(ec: "L" | "M" | "Q" | "H", text: string): boolean {
  const bytes = new TextEncoder().encode(text).length;
  const mode = NUMERIC_RE.test(text)
    ? "numeric"
    : ALPHANUMERIC_RE.test(text)
      ? "alphanumeric"
      : "byte";
  return bytes > QR_V40_CAPACITY[mode][ec];
}

function friendlyQrError(message: string): string {
  if (/too big|too long/i.test(message)) {
    return TOO_LONG_MESSAGE;
  }
  return "Sorry, we couldn't generate that QR code. Please check your text and try again.";
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const [lighter, darker] = lA >= lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

export default function QrCodeGenerator() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [size, setSize] = useState(320);
  const [ec, setEc] = useState<"L" | "M" | "Q" | "H">("M");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);

  const trimmed = text.trim();
  const hasText = trimmed.length > 0;

  useEffect(() => {
    if (!hasText || exceededCapacity(ec, trimmed)) return;
    let cancelled = false;
    QRCode.toDataURL(trimmed, {
      width: PREVIEW_SIZE,
      margin: 4,
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
  }, [hasText, trimmed, ec, fg, bg]);

  const overCapacity = hasText && exceededCapacity(ec, trimmed);
  const qrReady = hasText && dataUrl && !overCapacity;
  const shownError = overCapacity ? TOO_LONG_MESSAGE : error;
  const errorActive = hasText && !!shownError && !errorDismissed;

  const lowContrast = useMemo(() => contrastRatio(fg, bg) < 4, [fg, bg]);

  const downloadPng = async () => {
    if (!hasText) return;
    if (exceededCapacity(ec, trimmed)) {
      setError(TOO_LONG_MESSAGE);
      return;
    }
    try {
      const url = await QRCode.toDataURL(trimmed, {
        width: size,
        margin: 4,
        errorCorrectionLevel: ec,
        color: { dark: fg, light: bg },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Sorry, we couldn't generate that QR code. Please check your text and try again.");
    }
  };

  const downloadSvg = async () => {
    if (!hasText) return;
    if (exceededCapacity(ec, trimmed)) {
      setError(TOO_LONG_MESSAGE);
      return;
    }
    let url = "";
    try {
      const svg = await QRCode.toString(trimmed, {
        type: "svg",
        margin: 4,
        errorCorrectionLevel: ec,
        color: { dark: fg, light: bg },
      });
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qrcode.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Sorry, we couldn't export the QR code. Please try again.");
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  return (
    <div className="space-y-5 w-full" id="qr-code-generator">
      <label
        htmlFor="qr-text-input"
        className="block text-sm font-medium text-slate-700"
      >
        Text or URL to encode
      </label>
      <StyledTextarea
        id="qr-text-input"
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setErrorDismissed(false);
        }}
        placeholder="Text or URL to encode…"
        aria-describedby={errorActive ? "qr-code-error" : undefined}
      />

      <Button
        type="button"
        variant="secondary"
        onClick={() => setText("")}
        disabled={!hasText}
        className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
      >
        Clear input
      </Button>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Field label={`Download size: ${size}px`}>
          <input
            type="range"
            min={100}
            max={1000}
            step={20}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label={`Download size: ${size}px`}
            className="w-48 min-h-11 accent-emerald-600 cursor-pointer"
          />
        </Field>
        <Field label="Error correction">
          <select
            value={ec}
            onChange={(e) => {
              setEc(e.target.value as typeof ec);
              setErrorDismissed(false);
            }}
            aria-label="Error correction level"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 min-h-11 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            onChange={(e) => {
              setFg(e.target.value);
              setErrorDismissed(false);
            }}
            aria-label="Foreground color"
            className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
        <Field label="Background">
          <input
            type="color"
            value={bg}
            onChange={(e) => {
              setBg(e.target.value);
              setErrorDismissed(false);
            }}
            aria-label="Background color"
            className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </div>

      <div className="space-y-4">
        {errorActive && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p id="qr-code-error">{shownError}</p>
            <button
              type="button"
              onClick={() => setErrorDismissed(true)}
              aria-label="Dismiss error"
              className="shrink-0 rounded-lg p-1 text-red-500 transition hover:bg-red-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {qrReady ? (
          <div className="flex flex-wrap items-start gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt="QR code preview"
                className="w-64 h-64 rounded-xl"
              />
              {lowContrast && (
                <p className="mt-3 max-w-64 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Low contrast between the foreground and background colors may
                  make this QR code hard to scan.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={downloadPng}
                className="min-h-11 bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
                Download PNG
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={downloadSvg}
                className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
              >
                <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
                Download SVG
              </Button>
            </div>
          </div>
        ) : hasText ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
            Generating…
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
            <QrCode className="w-8 h-8 mx-auto text-slate-300 mb-2" aria-hidden="true" />
            Enter some text or a URL to generate a QR code.
          </div>
        )}

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {errorActive
            ? "Text is too long for a QR code."
            : qrReady
              ? "QR code ready."
              : hasText && !overCapacity
                ? "Generating…"
                : ""}
        </p>
      </div>
    </div>
  );
}