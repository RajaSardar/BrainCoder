"use client";

import { useId, useMemo, useState } from "react";
import { Ruler, ArrowRight } from "lucide-react";
import { CopyButton } from "@/components/ui";
import {
  DASH,
  DEFAULT_BASE,
  MAX_ABS_VALUE,
  MAX_BASE,
  MIN_BASE,
  formatNumber,
  parseUnitValue,
  pxToRem,
  referenceTable,
  remToPx,
} from "./units";

export default function PxRem() {
  const [base, setBase] = useState(DEFAULT_BASE);
  const [px, setPx] = useState("24");
  const [rem, setRem] = useState("1.5");

  const baseId = useId();
  const pxId = useId();
  const remId = useId();

  const pxValue = parseUnitValue(px);
  const remValue = parseUnitValue(rem);

  const pxResult = pxValue === null ? DASH : `${formatNumber(pxToRem(pxValue, base))}rem`;
  const remResult = remValue === null ? DASH : `${formatNumber(remToPx(remValue, base))}px`;

  const table = useMemo(() => referenceTable(base), [base]);

  const pxInvalid = px.trim() !== "" && pxValue === null;
  const remInvalid = rem.trim() !== "" && remValue === null;

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={baseId} className="block text-sm font-medium text-slate-700 mb-2">
            Base font size: {base}px
          </label>
          <input
            id={baseId}
            type="range"
            min={MIN_BASE}
            max={MAX_BASE}
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            aria-describedby={`${baseId}-readout`}
            className="w-48 accent-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          />
        </div>
        <p
          id={`${baseId}-readout`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono w-40"
        >
          {base}px = 1rem
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <label htmlFor={pxId} className="block text-sm font-medium text-slate-700 mb-3">
            Pixels → rem
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={pxId}
              type="number"
              inputMode="decimal"
              step="any"
              value={px}
              onChange={(e) => setPx(e.target.value)}
              aria-invalid={pxInvalid}
              aria-describedby={pxInvalid ? `${pxId}-error` : undefined}
              className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-slate-400">px</span>
            <ArrowRight className="w-4 h-4 text-slate-300" aria-hidden="true" />
            <span className="font-mono text-lg font-semibold text-emerald-600">{pxResult}</span>
            <CopyButton text={pxResult} disabled={pxValue === null} ariaLabel="Copy rem result" />
          </div>
          {pxInvalid && (
            <p id={`${pxId}-error`} role="alert" className="mt-2 text-xs text-red-600">
              Enter a number up to {MAX_ABS_VALUE.toLocaleString("en-US")}.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <label htmlFor={remId} className="block text-sm font-medium text-slate-700 mb-3">
            rem → pixels
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={remId}
              type="number"
              inputMode="decimal"
              step="any"
              value={rem}
              onChange={(e) => setRem(e.target.value)}
              aria-invalid={remInvalid}
              aria-describedby={remInvalid ? `${remId}-error` : undefined}
              className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-slate-400">rem</span>
            <ArrowRight className="w-4 h-4 text-slate-300" aria-hidden="true" />
            <span className="font-mono text-lg font-semibold text-emerald-600">{remResult}</span>
            <CopyButton text={remResult} disabled={remValue === null} ariaLabel="Copy pixel result" />
          </div>
          {remInvalid && (
            <p id={`${remId}-error`} role="alert" className="mt-2 text-xs text-red-600">
              Enter a number up to {MAX_ABS_VALUE.toLocaleString("en-US")}.
            </p>
          )}
        </div>
      </div>

      <p className="sr-only" role="status">
        {pxValue !== null ? `${formatNumber(pxToRem(pxValue, base))} rem for ${pxValue} pixels` : ""}
        {pxValue !== null && remValue !== null ? "; " : ""}
        {remValue !== null ? `${formatNumber(remToPx(remValue, base))} pixels for ${remValue} rem` : ""}
        {` at a ${base}px base.`}
      </p>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Common pixel values and their rem equivalents at a {base}px base font size</caption>
          <thead className="bg-slate-50 text-left">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500">
                Pixels
              </th>
              <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500">
                rem
              </th>
              <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500">
                Preview
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.map((r) => (
              <tr key={r.px}>
                <td className="px-4 py-2 font-mono text-slate-600">{r.px}px</td>
                <td className="px-4 py-2 font-mono text-slate-600">{r.rem}rem</td>
                <td className="px-4 py-2">
                  <span className="font-mono text-slate-800" style={{ fontSize: `${r.px}px`, lineHeight: 1 }}>
                    Ag
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Ruler className="w-3.5 h-3.5" aria-hidden="true" /> Conversion for common pixel values at the current {base}px
        base. The Preview column renders each size at its true pixel height.
      </p>
    </div>
  );
}
