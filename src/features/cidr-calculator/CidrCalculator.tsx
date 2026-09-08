"use client";

import { useState } from "react";
import { Radar } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

function parseIpv4(input: string): number[] | null {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(input);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.some((o) => o > 255) ? null : octets;
}

function ipv4ToInt(octets: number[]): number {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function intToIpv4(v: number): string {
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff].join(".");
}

interface CidrInfo {
  address: number[];
  prefix: number;
  mask: number[];
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  usableHosts: number;
  wildcard: string;
}

function compute(address: number[], prefix: number): CidrInfo {
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = maskInt ^ 0xffffffff;
  const addrInt = ipv4ToInt(address);
  const network = addrInt & maskInt;
  const broadcast = (network | wildcard) >>> 0;
  const totalHosts = 2 ** (32 - prefix);
  const usableHosts = totalHosts >= 2 ? totalHosts - 2 : 0;
  const mask = [24, 16, 8, 0].map((s) => (maskInt >>> s) & 0xff);
  return {
    address,
    prefix,
    mask,
    network: intToIpv4(network),
    broadcast: intToIpv4(broadcast),
    firstHost: intToIpv4(network + 1),
    lastHost: intToIpv4(broadcast - 1),
    totalHosts,
    usableHosts,
    wildcard: [24, 16, 8, 0].map((s) => (wildcard >>> s) & 0xff).join("."),
  };
}

export default function CidrCalculator() {
  const [cidr, setCidr] = useState("192.168.1.42/24");
  const [info, setInfo] = useState<CidrInfo | null>(null);
  const [error, setError] = useState("");

  const calculate = () => {
    setError("");
    const m = /^\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})\s*$/.exec(cidr);
    if (!m) {
      setError("Expected format: 192.168.1.42/24");
      return;
    }
    const octets = parseIpv4(m[1]);
    const prefix = Number(m[2]);
    if (!octets || prefix > 32) {
      setError("Invalid IP or prefix length (must be 0–32).");
      return;
    }
    setInfo(compute(octets, prefix));
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Radar className="w-4 h-4 text-cyan-600" />
        <h2 className="text-sm font-semibold text-slate-700">CIDR Calculator</h2>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-52">
          <label className="text-xs font-medium text-slate-500 block mb-1.5">IP / prefix</label>
          <input
            type="text"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="192.168.1.0/24"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <Button type="button" onClick={calculate}>Calculate</Button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {info && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ["Network", info.network],
                ["Broadcast", info.broadcast],
                ["First host", info.firstHost],
                ["Last host", info.lastHost],
              ] as [string, string][]
            ).map(([label, val]) => (
              <div key={label} className="rounded-xl bg-cyan-50 border border-cyan-200 p-3">
                <p className="text-xs text-cyan-600 mb-1">{label}</p>
                <p className="font-mono text-sm text-cyan-900">{val}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            {(
              [
                ["Subnet mask", info.mask.join(".")],
                ["Wildcard mask", info.wildcard],
                ["Total addresses", info.totalHosts.toLocaleString()],
                ["Usable hosts", info.usableHosts === 0 && info.prefix >= 31 ? `0 (prefix /${info.prefix})` : info.usableHosts.toLocaleString()],
                ["Address", info.address.join(".")],
                ["Prefix length", `/${info.prefix}`],
              ] as [string, string][]
            ).map(([label, val]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="font-mono text-sm text-slate-800">{val}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton text={`${info.network}/${info.prefix}`} label="Copy network" />
            <CopyButton text={`${info.firstHost} - ${info.lastHost}`} label="Copy range" />
          </div>
        </>
      )}
      <p className="text-xs text-slate-400">IPv4 only. Enter any IP within the range — the calculator normalizes to the network address.</p>
    </div>
  );
}