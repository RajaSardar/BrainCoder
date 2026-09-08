"use client";

import { useState } from "react";
import { Network } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

interface Parts {
  octets: number[];
  binary: string;
  hex: string;
  octal: string;
  integer: number;
}

function parseIpv4(input: string): number[] | null {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(input);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

function toParts(octets: number[]): Parts {
  const binary = octets.map((o) => o.toString(2).padStart(8, "0")).join(".");
  let hex = "";
  let octal = "";
  let integer = 0;
  for (const o of octets) {
    hex += o.toString(16).padStart(2, "0");
    octal += o.toString(8).padStart(3, "0");
    integer = integer * 256 + o;
  }
  return { octets, binary, hex, octal, integer };
}

function fromInteger(total: number): number[] | null {
  if (!Number.isInteger(total) || total < 0 || total > 0xffffffff) return null;
  return [(total >>> 24) & 0xff, (total >>> 16) & 0xff, (total >>> 8) & 0xff, total & 0xff];
}

export default function Ipv4Converter() {
  const [ip, setIp] = useState("192.168.1.42");
  const [intInput, setIntInput] = useState("");
  const [parts, setParts] = useState<Parts | null>(null);
  const [intResult, setIntResult] = useState("");
  const [error, setError] = useState("");

  const convertIp = () => {
    setError("");
    const octets = parseIpv4(ip);
    if (!octets) {
      setError("Invalid IPv4 address.");
      return;
    }
    setParts(toParts(octets));
  };

  const convertInt = () => {
    setError("");
    const total = Number(intInput);
    const octets = fromInteger(total);
    if (!octets) {
      setError("Enter a whole number from 0 to 4294967295.");
      return;
    }
    setIntResult(octets.join("."));
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-700">IPv4 Converter</h2>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-52">
            <label className="text-xs font-medium text-slate-500 block mb-1.5">IPv4 address</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 192.168.1.42"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="button" onClick={convertIp}>Convert</Button>
        </div>

        {parts && (
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                ["Binary", parts.binary],
                ["Hexadecimal", `0x${parts.hex}`],
                ["Octal", `0${parts.octal}`],
                ["Integer (decimal)", parts.integer.toLocaleString()],
              ] as [string, string][]
            ).map(([label, val]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                <p className="font-mono text-sm text-slate-800 break-all">{val}</p>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-52">
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Integer back to IPv4</label>
              <input
                type="number"
                value={intInput}
                onChange={(e) => setIntInput(e.target.value)}
                placeholder="e.g. 3232235818"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button type="button" variant="secondary" onClick={convertInt}>To IP</Button>
          </div>
          {intResult && <p className="mt-2 font-mono text-sm text-blue-700">{intResult}</p>}
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
        {parts && (
          <div className="flex flex-wrap gap-2">
            <CopyButton text={`${parts.octets.join(".")}\n${parts.binary}\n0x${parts.hex}\n${parts.integer}`} label="Copy all" />
          </div>
        )}
      </div>
    </div>
  );
}