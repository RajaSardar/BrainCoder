"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { CopyButton } from "@/components/ui";

interface UnitDef {
  label: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

interface CategoryDef {
  name: string;
  base: string;
  units: UnitDef[];
}

const u = (label: string, toBase: (v: number) => number, fromBase: (v: number) => number): UnitDef => ({ label, toBase, fromBase });

const CATEGORIES: Record<string, CategoryDef> = {
  temperature: {
    name: "Temperature",
    base: "°C",
    units: [
      u("Celsius (°C)", (v) => v, (v) => v),
      u("Fahrenheit (°F)", (v) => ((v - 32) * 5) / 9, (v) => (v * 9) / 5 + 32),
      u("Kelvin (K)", (v) => v - 273.15, (v) => v + 273.15),
    ],
  },
  length: {
    name: "Length",
    base: "m",
    units: [
      u("Millimeters", (v) => v / 1000, (v) => v * 1000),
      u("Centimeters", (v) => v / 100, (v) => v * 100),
      u("Meters", (v) => v, (v) => v),
      u("Kilometers", (v) => v * 1000, (v) => v / 1000),
      u("Inches", (v) => v * 0.0254, (v) => v / 0.0254),
      u("Feet", (v) => v * 0.3048, (v) => v / 0.3048),
      u("Yards", (v) => v * 0.9144, (v) => v / 0.9144),
      u("Miles", (v) => v * 1609.344, (v) => v / 1609.344),
    ],
  },
  weight: {
    name: "Weight",
    base: "kg",
    units: [
      u("Milligrams", (v) => v / 1e6, (v) => v * 1e6),
      u("Grams", (v) => v / 1000, (v) => v * 1000),
      u("Kilograms", (v) => v, (v) => v),
      u("Tonnes", (v) => v * 1000, (v) => v / 1000),
      u("Ounces", (v) => v * 0.028349523125, (v) => v / 0.028349523125),
      u("Pounds", (v) => v * 0.45359237, (v) => v / 0.45359237),
      u("Stones", (v) => v * 6.35029318, (v) => v / 6.35029318),
    ],
  },
  volume: {
    name: "Volume",
    base: "L",
    units: [
      u("Milliliters", (v) => v / 1000, (v) => v * 1000),
      u("Liters", (v) => v, (v) => v),
      u("Cubic meters", (v) => v * 1000, (v) => v / 1000),
      u("Teaspoons (US)", (v) => v * 0.00492892159375, (v) => v / 0.00492892159375),
      u("Tablespoons (US)", (v) => v * 0.01478676478125, (v) => v / 0.01478676478125),
      u("Fluid ounces (US)", (v) => v * 0.0295735295625, (v) => v / 0.0295735295625),
      u("Cups (US)", (v) => v * 0.2365882365, (v) => v / 0.2365882365),
      u("Pints (US)", (v) => v * 0.473176473, (v) => v / 0.473176473),
      u("Quarts (US)", (v) => v * 0.946352946, (v) => v / 0.946352946),
      u("Gallons (US)", (v) => v * 3.785411784, (v) => v / 3.785411784),
    ],
  },
  area: {
    name: "Area",
    base: "m²",
    units: [
      u("Sq millimeters", (v) => v / 1e6, (v) => v * 1e6),
      u("Sq centimeters", (v) => v / 1e4, (v) => v * 1e4),
      u("Sq meters", (v) => v, (v) => v),
      u("Hectares", (v) => v * 10000, (v) => v / 10000),
      u("Sq kilometers", (v) => v * 1e6, (v) => v / 1e6),
      u("Sq inches", (v) => v * 0.00064516, (v) => v / 0.00064516),
      u("Sq feet", (v) => v * 0.09290304, (v) => v / 0.09290304),
      u("Sq yards", (v) => v * 0.83612736, (v) => v / 0.83612736),
      u("Acres", (v) => v * 4046.8564224, (v) => v / 4046.8564224),
      u("Sq miles", (v) => v * 2589988.110336, (v) => v / 2589988.110336),
    ],
  },
  speed: {
    name: "Speed",
    base: "m/s",
    units: [
      u("Meters/second", (v) => v, (v) => v),
      u("Kilometers/hour", (v) => v / 3.6, (v) => v * 3.6),
      u("Miles/hour", (v) => v * 0.44704, (v) => v / 0.44704),
      u("Knots", (v) => v * 0.514444444444, (v) => v / 0.514444444444),
      u("Feet/second", (v) => v * 0.3048, (v) => v / 0.3048),
    ],
  },
  data: {
    name: "Data",
    base: "bytes",
    units: [
      u("Bits", (v) => v / 8, (v) => v * 8),
      u("Bytes", (v) => v, (v) => v),
      u("KB", (v) => v * 1024, (v) => v / 1024),
      u("MB", (v) => v * 1024 ** 2, (v) => v / 1024 ** 2),
      u("GB", (v) => v * 1024 ** 3, (v) => v / 1024 ** 3),
      u("TB", (v) => v * 1024 ** 4, (v) => v / 1024 ** 4),
      u("PB", (v) => v * 1024 ** 5, (v) => v / 1024 ** 5),
    ],
  },
};

const KEYS = Object.keys(CATEGORIES);

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-6)) return v.toExponential(4);
  if (Number.isInteger(v) && abs < 1e6) return v.toString();
  return String(Math.round(v * 1e6) / 1e6);
}

export default function UnitConverter() {
  const [catKey, setCatKey] = useState("length");
  const [value, setValue] = useState(1);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(2);

  const cat = CATEGORIES[catKey];
  const fromUnit = cat.units[from];
  const toUnit = cat.units[to];
  const base = fromUnit.toBase(value);
  const result = toUnit.fromBase(base);

  const rows = cat.units.map((unit, i) => (i === from ? null : { label: unit.label, text: fmt(unit.fromBase(base)) })).filter((r) => r !== null);

  const categoryTabs = (
    <div className="flex flex-wrap gap-1.5">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            setCatKey(k);
            setFrom(0);
            setTo(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${catKey === k ? "bg-lime-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-lime-50"}`}
        >
          {CATEGORIES[k].name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-lime-600" />
        <h2 className="text-sm font-semibold text-slate-700">Unit Converter</h2>
      </div>

      {categoryTabs}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid sm:grid-cols-[1fr_1fr_1fr] gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">From</label>
            <select
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-600"
            >
              {cat.units.map((unit, i) => (
                <option key={unit.label} value={i}>{unit.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">To</label>
            <select
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-600"
            >
              {cat.units.map((unit, i) => (
                <option key={unit.label} value={i}>{unit.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-emerald-300">
            {value} {fromUnit.label} <span className="text-slate-500">=</span> <span className="font-bold">{fmt(result)}</span> {toUnit.label}
          </span>
          <CopyButton text={`${fmt(result)} ${toUnit.label}`} />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map(
            (r) =>
              r && (
                <div key={r.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-400">{r.label}</span>
                  <span className="font-mono text-sm text-slate-800">{r.text}</span>
                </div>
              )
          )}
        </div>
        <p className="text-xs text-slate-400">Base unit: {cat.base}. Data sizes use binary (1024) prefixes.</p>
      </div>
    </div>
  );
}