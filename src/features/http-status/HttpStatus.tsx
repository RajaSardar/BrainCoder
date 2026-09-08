"use client";

import { useMemo, useState } from "react";
import { Server, Search } from "lucide-react";

type StatusClass = { name: string; color: string; bg: string; text: string; border: string };

interface Status {
  code: number;
  name: string;
  description: string;
  official: boolean;
}

const CLASSES: Record<string, StatusClass> = {
  "1xx": { name: "Informational", color: "#0369a1", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "2xx": { name: "Success", color: "#047857", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "3xx": { name: "Redirection", color: "#b45309", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "4xx": { name: "Client error", color: "#b91c1c", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "5xx": { name: "Server error", color: "#6d28d9", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

const STATUSES: Status[] = [
  { code: 100, name: "Continue", description: "The server has received the request headers and the client should proceed to send the body.", official: true },
  { code: 101, name: "Switching Protocols", description: "The requester has asked the server to switch protocols and the server confirms it will do so.", official: true },
  { code: 102, name: "Processing", description: "WebDAV: indicates the server is still processing the request.", official: false },
  { code: 103, name: "Early Hints", description: "Used to send some response headers before the final HTTP message.", official: true },
  { code: 200, name: "OK", description: "The request has succeeded.", official: true },
  { code: 201, name: "Created", description: "The request has succeeded and a new resource has been created.", official: true },
  { code: 202, name: "Accepted", description: "The request has been accepted for processing, but it is not yet complete.", official: true },
  { code: 203, name: "Non-Authoritative Information", description: "The response is from a transforming proxy, so it may differ from the origin server's response.", official: true },
  { code: 204, name: "No Content", description: "The request succeeded but there is no content to return.", official: true },
  { code: 205, name: "Reset Content", description: "The server asks the client to reset the view that sent the request.", official: true },
  { code: 206, name: "Partial Content", description: "The server is sending only part of the resource (range requests).", official: true },
  { code: 207, name: "Multi-Status", description: "WebDAV: multiple status codes for multiple operations.", official: false },
  { code: 300, name: "Multiple Choices", description: "The request has more than one possible response; the client must choose one.", official: true },
  { code: 301, name: "Moved Permanently", description: "This and all future requests should be directed to the given URI.", official: true },
  { code: 302, name: "Found", description: "The resource is temporarily under a different URI.", official: true },
  { code: 303, name: "See Other", description: "The response is at a different URI and should be fetched with GET.", official: true },
  { code: 304, name: "Not Modified", description: "The resource has not been modified since the last request (conditional request).", official: true },
  { code: 307, name: "Temporary Redirect", description: "The resource is temporarily at another URI, but future requests should use the original URI.", official: true },
  { code: 308, name: "Permanent Redirect", description: "The resource is permanently at another URI, and the method must not change.", official: true },
  { code: 400, name: "Bad Request", description: "The request could not be understood by the server due to malformed syntax.", official: true },
  { code: 401, name: "Unauthorized", description: "Authentication is required and has failed or has not yet been provided.", official: true },
  { code: 402, name: "Payment Required", description: "Reserved for future use.", official: true },
  { code: 403, name: "Forbidden", description: "The request was valid, but the server refuses to respond to it.", official: true },
  { code: 404, name: "Not Found", description: "The requested resource could not be found on the server.", official: true },
  { code: 405, name: "Method Not Allowed", description: "The request method is not supported for the requested resource.", official: true },
  { code: 406, name: "Not Acceptable", description: "The server cannot produce a response matching the Accept headers.", official: true },
  { code: 407, name: "Proxy Authentication Required", description: "Authentication is required through a proxy before the request continues.", official: true },
  { code: 408, name: "Request Timeout", description: "The server timed out waiting for the request. The client may repeat the request.", official: true },
  { code: 409, name: "Conflict", description: "The request could not be processed due to a conflict with the current state.", official: true },
  { code: 410, name: "Gone", description: "The resource is no longer available and will not be available again.", official: true },
  { code: 411, name: "Length Required", description: "A Content-Length header is required but was not sent.", official: true },
  { code: 412, name: "Precondition Failed", description: "One or more preconditions in the request headers evaluated to false.", official: true },
  { code: 413, name: "Payload Too Large", description: "The request is larger than the server is willing or able to process.", official: true },
  { code: 414, name: "URI Too Long", description: "The URI provided was too long for the server to process.", official: true },
  { code: 415, name: "Unsupported Media Type", description: "The media format of the requested data is not supported by the server.", official: true },
  { code: 416, name: "Range Not Satisfiable", description: "The Range header cannot be satisfied.", official: true },
  { code: 417, name: "Expectation Failed", description: "The expectation in the Expect header could not be met by the server.", official: true },
  { code: 418, name: "I'm a teapot", description: "The server refuses to brew coffee because it is a teapot (RFC 2324).", official: true },
  { code: 422, name: "Unprocessable Entity", description: "The request was well-formed but semantically incorrect instructions.", official: true },
  { code: 423, name: "Locked", description: "The resource that is being accessed is locked.", official: false },
  { code: 425, name: "Too Early", description: "The server is unwilling to risk processing a request that might be replayed.", official: false },
  { code: 426, name: "Upgrade Required", description: "The client should switch to a different protocol (TLS/1.0).", official: true },
  { code: 428, name: "Precondition Required", description: "The origin server requires the request to be conditional.", official: true },
  { code: 429, name: "Too Many Requests", description: "The user has sent too many requests in a given amount of time.", official: true },
  { code: 431, name: "Request Header Fields Too Large", description: "The server is unwilling to process the request because header fields are too large.", official: true },
  { code: 451, name: "Unavailable For Legal Reasons", description: "The resource is unavailable for legal reasons.", official: true },
  { code: 500, name: "Internal Server Error", description: "The server encountered an unexpected condition.", official: true },
  { code: 501, name: "Not Implemented", description: "The server does not support the functionality required to fulfill the request.", official: true },
  { code: 502, name: "Bad Gateway", description: "The server, acting as a gateway, received an invalid response from upstream.", official: true },
  { code: 503, name: "Service Unavailable", description: "The server is currently unable to handle the request (overloaded or down).", official: true },
  { code: 504, name: "Gateway Timeout", description: "The server, acting as a gateway, did not get a response in time.", official: true },
  { code: 505, name: "HTTP Version Not Supported", description: "The server does not support the HTTP protocol version used in the request.", official: true },
  { code: 506, name: "Variant Also Negotiates", description: "The server has an internal configuration error: chosen variant is misconfigured.", official: true },
  { code: 507, name: "Insufficient Storage", description: "WebDAV: the server is unable to store the representation needed to complete the request.", official: false },
  { code: 508, name: "Loop Detected", description: "The server detected an infinite loop while processing the request.", official: true },
  { code: 510, name: "Not Extended", description: "Further extensions to the request are required for the server to fulfill it.", official: true },
  { code: 511, name: "Network Authentication Required", description: "The client needs to authenticate to gain network access.", official: true },
  { code: 599, name: "Network Connect Timeout", description: "The proxy timed out while waiting for the network connection.", official: false },
];

export default function HttpStatus() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATUSES;
    return STATUSES.filter(
      (s) => String(s.code).includes(q) || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const g: { key: string; items: Status[] }[] = [];
    for (const s of filtered) {
      const key = `${Math.floor(s.code / 100)}xx`;
      const group = g.find((x) => x.key === key);
      if (group) group.items.push(s);
      else g.push({ key, items: [s] });
    }
    return g.sort((a, b) => Number(a.key[0]) - Number(b.key[0]));
  }, [filtered]);

  return (
    <div className="space-y-5 w-full">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code, name or description…"
          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {grouped.map(({ key, items: cls }) => {
        const meta = CLASSES[key];
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-3 mt-4">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.text} border ${meta.border}`}
              >
                {key}
              </span>
              <p className="text-sm font-semibold text-slate-700">{meta.name}</p>
              <span className="text-xs text-slate-400">{cls.length} status</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {cls.map((s) => (
                <div key={s.code} className="rounded-xl border border-slate-200 bg-white p-4 flex gap-3">
                  <span
                    className="shrink-0 font-mono text-sm font-bold px-2.5 py-1 rounded-lg h-fit"
                    style={{ color: meta.color, background: `${meta.color}1a` }}
                  >
                    {s.code}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {s.name}
                      {!s.official && (
                        <span className="ml-2 text-[11px] font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                          unofficial
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 text-slate-500 px-4 py-6 text-sm text-center">
          <Server className="w-6 h-6 mx-auto mb-2 text-slate-300" />
          No HTTP status codes match your search.
        </div>
      )}
    </div>
  );
}