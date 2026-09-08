"use client";

import { useMemo, useRef, useState } from "react";
import { Archive, FileDown, Upload, Loader2 } from "lucide-react";
import { StyledTextarea, Button, CopyButton } from "@/components/ui";

type GzipFormat = "gzip" | "deflate" | "deflate-raw";

const FORMATS: { id: GzipFormat; label: string; fileExt: string }[] = [
  { id: "gzip", label: "Gzip (.gz)", fileExt: "gz" },
  { id: "deflate", label: "Deflate (.deflate)", fileExt: "deflate" },
  { id: "deflate-raw", label: "Deflate raw (.raw)", fileExt: "raw" },
];

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
  try {
    const raw = atob(b64.replace(/\s+/g, ""));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function prettify(text: string): { formatted: string; wasJson: boolean } {
  const t = text.trim();
  if (t && (t[0] === "{" || t[0] === "[")) {
    try {
      return { formatted: JSON.stringify(JSON.parse(t), null, 2), wasJson: true };
    } catch {
      /* fall through */
    }
  }
  return { formatted: text, wasJson: false };
}

function extractPayloadData(input: string): { b64: string; key: string | null } | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj && typeof obj === "object" && typeof obj.data === "string" && obj.data.trim()) {
        const key = Object.keys(obj).find((k) => k !== "data") ?? null;
        return { b64: obj.data, key };
      }
    } catch {
      return null;
    }
  }
  if (trimmed.length >= 20 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return { b64: trimmed, key: null };
  }
  return null;
}

async function compressBytes(bytes: Uint8Array<ArrayBuffer>, format: GzipFormat): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressBytes(bytes: Uint8Array<ArrayBuffer>, format: GzipFormat): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function triggerDownload(bytes: Uint8Array<ArrayBuffer>, name: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function GzipTool() {
  const [format, setFormat] = useState<GzipFormat>("gzip");
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog. ".repeat(8));
  const [output, setOutput] = useState("");
  const [outputKind, setOutputKind] = useState<"base64" | "text">("base64");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inputSize, setInputSize] = useState<number | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  const [payloadKey, setPayloadKey] = useState("zlib");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fmt = FORMATS.find((f) => f.id === format)!;

  const sizes = useMemo(() => {
    if (inputSize === null || outputSize === null) return null;
    const ratio = inputSize === 0 ? 0 : Math.round((1 - outputSize / inputSize) * 100);
    return { ratio };
  }, [inputSize, outputSize]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  };

  const compressAs = (kind: "base64" | "json") =>
  run(async () => {
    const bytes = new TextEncoder().encode(input);
    const out = await compressBytes(bytes, format);
    const b64 = bytesToBase64(out);
    setInputSize(bytes.length);
    setOutputSize(out.length);
    setOutputKind("base64");
    if (kind === "base64") {
      setOutput(b64);
      setMessage(`Compressed to ${formatBytes(out.length)} (download available).`);
    } else {
      setOutput(JSON.stringify({ [payloadKey]: true, data: b64 }, null, 2));
      setMessage(
        `Compressed to ${formatBytes(out.length)}, wrapped as {"${payloadKey}":true,"data":…}. To rebuild with another key, use the file download or select a different output.`
      );
    }
  });

  const decompressText = () =>
    run(async () => {
      const payload = extractPayloadData(input) ?? (outputKind === "base64" && output ? { b64: output, key: null } : null);
      let bytes: Uint8Array<ArrayBuffer> | null = null;
      let sourceLabel = "text";
      if (payload) {
        const decoded = base64ToBytes(payload.b64);
        if (decoded) {
          bytes = decoded;
          sourceLabel = payload.key ? `“${payload.key}” payload` : "base64";
          if (payload.key && payload.key !== "data") setPayloadKey(payload.key);
        }
      } else {
        bytes = new TextEncoder().encode(input);
      }
      if (!bytes || bytes.length === 0) throw new Error("Nothing to decompress.");

      const order = [format, ...FORMATS.map((f) => f.id).filter((id) => id !== format)];
      let out: Uint8Array<ArrayBuffer> | null = null;
      let usedFormat = "";
      for (const id of order) {
        try {
          out = await decompressBytes(bytes, id);
          usedFormat = id;
          break;
        } catch {
          /* try next */
        }
      }
      if (!out) throw new Error("Could not decompress. The data isn’t valid gzip/deflate.");

      const text = new TextDecoder("utf-8", { fatal: false }).decode(out);
      const { formatted, wasJson } = prettify(text);
      setInputSize(bytes.length);
      setOutputSize(out.length);
      setOutputKind("text");
      setOutput(formatted.length > 200000 ? formatted.slice(0, 200000) + `\n\n… truncated (${formatBytes(text.length)})` : formatted);
      setMessage(
        `Decompressed ${sourceLabel} with ${usedFormat} (${formatBytes(bytes.length)} → ${formatBytes(out.length)}).` +
          (wasJson ? " Output pretty-formatted as JSON." : "")
      );
    });

  const handleFile = async (wantCompress: boolean) => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    await run(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setInputSize(bytes.length);

      if (wantCompress) {
        const out = await compressBytes(bytes, format);
        setOutputSize(out.length);
        setOutputKind("base64");
        setOutput(bytesToBase64(out));
        setFileName(`${file.name}.${fmt.fileExt}`);
        triggerDownload(out, `${file.name}.${fmt.fileExt}`, "application/gzip");
        setMessage(`Compressed "${file.name}" ${formatBytes(bytes.length)} → ${formatBytes(out.length)} and downloaded.`);
      } else {
        const out = await decompressBytes(bytes, format);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(out);
        const { formatted, wasJson } = prettify(text);
        setOutputSize(out.length);
        setOutputKind("text");
        setOutput(formatted.length > 200000 ? formatted.slice(0, 200000) + `\n\n… truncated` : formatted);
        setMessage(
          `Decompressed "${file.name}" into ${formatBytes(out.length)} of text.` +
            (wasJson ? " Output pretty-formatted as JSON." : "")
        );
      }
    });
  };

  const downloadOutput = () => {
    if (!output) return;
    if (outputKind === "base64") {
      const bytes = base64ToBytes(output);
      if (bytes) triggerDownload(bytes, `compressed.${fmt.fileExt}`, "application/gzip");
    } else {
      const bytes = new TextEncoder().encode(output);
      triggerDownload(bytes, "decompressed.txt", "text/plain");
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Archive className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold text-slate-700">Format</span>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`px-3 py-1.5 rounded-full border text-xs transition ${
                format === f.id
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-5">
        <div className="flex flex-col">
          <p className="text-xs font-medium text-slate-500 mb-2">Input (text)</p>
          <StyledTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={12}
            className="min-h-[24rem] lg:h-[calc(100vh-27rem)] lg:min-h-[24rem]"
            placeholder={'Paste text to compress, or a {"key":true,"data":"…"} payload / base64 to decompress…'}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => compressAs("base64")}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Compress → base64
            </Button>
            <Button type="button" disabled={busy} onClick={() => compressAs("json")}>
              Compress → JSON payload
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={decompressText}>
              Decompress → formatted text
            </Button>
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium text-slate-500 mb-2">Output ({outputKind})</p>
          <div className="min-h-[24rem] lg:h-[calc(100vh-27rem)] rounded-xl border border-slate-200 bg-white p-4 text-sm font-mono text-slate-700 whitespace-pre-wrap break-all overflow-auto">
            {output || <span className="text-slate-300">Output appears here…</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CopyButton text={output} />
            <Button type="button" variant="secondary" disabled={!output} onClick={downloadOutput}>
              <FileDown className="w-4 h-4" /> Download
            </Button>
            {sizes && (
              <span className="text-xs text-slate-500">
                {formatBytes(inputSize!)} → {formatBytes(outputSize!)}{" "}
                <span className={sizes.ratio > 0 ? "text-emerald-600" : "text-slate-400"}>
                  ({sizes.ratio > 0 ? "−" : "+"}
                  {Math.abs(sizes.ratio)}%)
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <input ref={fileRef} type="file" className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:px-4 file:py-2 file:text-sm file:cursor-pointer" />
          <Button type="button" variant="secondary" disabled={busy} onClick={() => handleFile(true)}>
            <Upload className="w-4 h-4" /> Compress file
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => handleFile(false)}>
            Decompress file
          </Button>
          {fileName && <span className="text-xs text-slate-500">Saved as {fileName}</span>}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Decompression auto-detects JSON payloads like {"{“zlib”:true,“data”:“H4sI…”}"} (reads the base64 in `data`),
          plain base64, or raw .{fmt.fileExt} bytes — and auto-tries gzip → deflate → deflate-raw, pretty-printing JSON results.
          Compress any file to {fmt.fileExt} (auto-download) or decompress a .{fmt.fileExt} file back to text.
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      {message && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message}</div>}
    </div>
  );
}