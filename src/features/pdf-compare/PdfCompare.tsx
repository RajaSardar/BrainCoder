"use client";

import { useRef, useState } from "react";
import { GitCompareArrows, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui";

interface PagePair {
  page: number;
  thumbA: string;
  thumbB: string;
  overlay: string;
  pct: number;
}

const MAX_PAGES = 30;

export default function PdfCompare() {
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pairs, setPairs] = useState<PagePair[]>([]);
  const [modalPair, setModalPair] = useState<PagePair | null>(null);
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<{ a: Uint8Array | null; b: Uint8Array | null }>({
    a: null,
    b: null,
  });
  const totalDiff = pairs.length
    ? (pairs.reduce((m, p) => m + p.pct, 0) / pairs.length).toFixed(1)
    : "0.0";

  const handleFiles = async (slot: "a" | "b", file: File | undefined) => {
    if (!file) return;
    if (slot === "a") setNameA(file.name);
    else setNameB(file.name);
    try {
      const data = await file.arrayBuffer();
      bytesRef.current[slot] = new Uint8Array(data);
    } catch {
      setError("Could not read PDF.");
    }
    if (bytesRef.current.a && bytesRef.current.b) {
      await runCompare();
    }
  };

  const runCompare = async () => {
    const { a, b } = bytesRef.current;
    if (!a || !b) return;
    setBusy(true);
    setError("");
    setPairs([]);
    setProgress("Loading PDFs…");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const [docA, docB] = await Promise.all([
        pdfjs.getDocument({ data: a.slice(0) }).promise,
        pdfjs.getDocument({ data: b.slice(0) }).promise,
      ]);
      const count = Math.min(docA.numPages, docB.numPages, MAX_PAGES);
      if (docA.numPages !== docB.numPages) {
        setError(
          `The PDFs have different page counts (${docA.numPages} vs ${docB.numPages}). Comparing the first ${count} pages.`,
        );
      }
      const out: PagePair[] = [];
      const scale = 1.2;

      for (let p = 1; p <= count; p++) {
        setProgress(`Comparing page ${p} of ${count}…`);
        const [pgA, pgB] = await Promise.all([
          docA.getPage(p),
          docB.getPage(p),
        ]);
        const vpA = pgA.getViewport({ scale });
        const vpB = pgB.getViewport({ scale });
        const w = Math.max(vpA.width, vpB.width);
        const h = Math.max(vpA.height, vpB.height);

        const cA = document.createElement("canvas");
        cA.width = Math.floor(w);
        cA.height = Math.floor(h);
        const ctxA = cA.getContext("2d")!;
        await pgA.render({ canvas: cA, viewport: vpA }).promise;
        const dataA = ctxA.getImageData(0, 0, cA.width, cA.height);

        const cB = document.createElement("canvas");
        cB.width = Math.floor(w);
        cB.height = Math.floor(h);
        const ctxB = cB.getContext("2d")!;
        await pgB.render({ canvas: cB, viewport: vpB }).promise;
        const dataB = ctxB.getImageData(0, 0, cB.width, cB.height);

        const ov = document.createElement("canvas");
        ov.width = Math.floor(w);
        ov.height = Math.floor(h);
        const ctxOv = ov.getContext("2d")!;
        ctxOv.drawImage(cB, 0, 0);
        const ovData = ctxOv.getImageData(0, 0, ov.width, ov.height);

        let diffPixels = 0;
        const len = dataA.data.length;
        for (let i = 0; i < len; i += 4) {
          const dR = Math.abs(dataA.data[i] - dataB.data[i]);
          const dG = Math.abs(dataA.data[i + 1] - dataB.data[i + 1]);
          const dB = Math.abs(dataA.data[i + 2] - dataB.data[i + 2]);
          if (dR + dG + dB > 40) {
            diffPixels++;
            ovData.data[i] = 255;
            ovData.data[i + 1] = 0;
            ovData.data[i + 2] = 0;
            ovData.data[i + 3] = 180;
          }
        }
        ctxOv.putImageData(ovData, 0, 0);

        const pct = (diffPixels / (cA.width * cA.height)) * 100;
        out.push({
          page: p,
          thumbA: cA.toDataURL("image/jpeg", 0.8),
          thumbB: cB.toDataURL("image/jpeg", 0.8),
          overlay: ov.toDataURL("image/png"),
          pct,
        });
      }

      setPairs(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <div className="space-y-5 w-full">
      {modalPair && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setModalPair(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-800">
                Page {modalPair.page} — {modalPair.pct.toFixed(1)}% difference
              </h4>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalPair(null)}
                className="!px-3 !py-1 text-xs"
              >
                Close
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(["thumbA", "thumbB", "overlay"] as const).map((key) => (
                <div
                  key={key}
                  className="rounded-xl overflow-hidden border border-slate-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={modalPair[key]}
                    alt={`${key === "thumbA" ? "File A" : key === "thumbB" ? "File B" : "Diff overlay"} page ${modalPair.page}`}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center">
              Left = file A · Middle = file B · Right = differences highlighted
              in red
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputARef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFiles("a", e.target.files?.[0])}
      />
      <input
        ref={inputBRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFiles("b", e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-end gap-4">
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputARef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          {nameA || "Choose PDF A (original)"}
        </Button>
        <Button
          type="button"
          disabled={busy}
          variant="secondary"
          onClick={() => inputBRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1.5 inline" />
          )}
          {nameB || "Choose PDF B (revised)"}
        </Button>
        <span className="text-xs text-slate-400">
          {nameA && nameB
            ? "Comparing…"
            : "Pick two PDFs to see a page-by-page pixel diff."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {progress && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          {progress}
        </div>
      )}

      {pairs.length > 0 && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitCompareArrows className="w-4 h-4 text-indigo-500" />
              <p className="text-sm font-semibold text-slate-800">
                Difference summary
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-slate-800">
                  {pairs.length}
                </p>
                <p className="text-xs text-slate-500">pages compared</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-indigo-600">
                  {totalDiff}%
                </p>
                <p className="text-xs text-slate-500">avg diff</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-600">
                  {(100 - Number(totalDiff)).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500">avg similarity</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pairs.map((pr) => (
              <button
                key={pr.page}
                type="button"
                onClick={() => setModalPair(pr)}
                className="group rounded-2xl border border-slate-200 bg-white overflow-hidden text-left hover:shadow-md transition"
              >
                <div className="grid grid-cols-3 divide-x divide-slate-100">
                  {(["thumbA", "thumbB", "overlay"] as const).map((key) => (
                    <div
                      key={key}
                      className="relative aspect-[3/4] overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pr[key]}
                        alt={`${key === "thumbA" ? "A" : key === "thumbB" ? "B" : "Diff"} page ${pr.page}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute top-1 left-1 text-[10px] font-bold bg-white/90 text-slate-600 rounded px-1">
                        {key === "thumbA" ? "A" : key === "thumbB" ? "B" : "Δ"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    Page {pr.page}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pr.pct < 1 ? "bg-green-100 text-green-700" : pr.pct < 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                  >
                    {pr.pct.toFixed(1)}% diff
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
