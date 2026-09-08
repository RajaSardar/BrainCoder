"use client";

import { useMemo, useState } from "react";
import { Globe, Link2 } from "lucide-react";
import { Field } from "@/components/ui";
import { CopyButton } from "@/components/ui";

function tryParse(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProto);
  } catch {
    return null;
  }
}

export default function UrlParser() {
  const [input, setInput] = useState("https://user:pass@example.com:8080/path/to/page?name=ferret&color=purple#section-2");

  const parsed = useMemo(() => {
    const url = tryParse(input);
    if (!url) return { ok: false as const, error: "Enter a valid URL (e.g. https://example.com/path?q=1)." };
    const params: { key: string; value: string }[] = [];
    url.searchParams.forEach((value, key) => params.push({ key, value }));

    const rows = {
      Protocol: url.protocol.split(":")[0],
      Host: url.hostname,
      Port: url.port || "(default)",
      Username: url.username || "(none)",
      Password: url.password || "(none)",
      Pathname: url.pathname || "/",
      Hash: url.hash || "(none)",
      Origin: url.origin,
    };
    return { ok: true as const, error: "", url, params, rows };
  }, [input]);

  return (
    <div className="space-y-5 w-full">
      <Field label="URL">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          placeholder="https://example.com/path?q=1"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      {parsed.ok ? (() => {
        const p = parsed;
        return (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(p.rows).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <CopyButton text={String(value)} />
                  </div>
                  <p className="font-mono text-sm text-slate-800 mt-0.5 break-all">{String(value)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <p className="px-4 pt-3.5 pb-2 text-xs font-medium text-slate-400">Query parameters ({p.params.length})</p>
              {p.params.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-slate-400">No query parameters.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {p.params.map(({ key, value }) => (
                      <tr key={key}>
                        <td className="px-4 py-2 font-mono text-blue-600 break-all">{key}</td>
                        <td className="px-4 py-2 font-mono text-slate-600 break-all">{value}</td>
                        <td className="px-1 py-2 text-right">
                          <CopyButton text={`${key}=${value}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-2 text-sm text-slate-600">
              <Link2 className="w-4 h-4 text-blue-500" />
              <span className="font-mono break-all">{p.url.toString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={p.url.toString()} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1.5">
                <Globe className="w-4 h-4" /> Open in new tab
              </a>
            </div>
          </>
        );
      })() : (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {parsed.error}
        </div>
      )}
    </div>
  );
}