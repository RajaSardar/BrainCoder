"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const listeners = new Set<(file: File | null) => void>();
let current: File | null = null;

export function watchDemoFile(file: File | null) {
  current = file;
  listeners.forEach((l) => l(file));
}

const bodyHasDemoFile = (body: unknown): boolean => {
  if (!current || body == null) return false;
  if (body === current) return true;
  if (body instanceof FormData) {
    for (const value of body.values()) {
      if (value instanceof Blob && value === current) return true;
    }
  }
  return false;
};

interface AuditEvent {
  at: number;
  label: string;
  error?: boolean;
}

export function NetworkAudit() {
  const [uploadAttempts, setUploadAttempts] = useState(0);
  const [outboundDuringDemo, setOutboundDuringDemo] = useState(0);
  const [watched, setWatched] = useState<{ name: string; size: number } | null>(
    null,
  );
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const startedRef = useRef(false);

  const log = useCallback(
    (label: string, error = false) =>
      setEvents((prev) => [
        ...prev.slice(-19),
        { at: Date.now(), label, error },
      ]),
    [],
  );

  const handleWatch = useCallback(
    (file: File | null) => {
      setEvents([]);
      if (file) {
        setUploadAttempts(0);
        setOutboundDuringDemo(0);
        setWatched({ name: file.name, size: file.size });
        log(`watched file assigned to local processor: ${file.name}`);
      } else {
        setWatched(null);
        log("monitoring resumed — no file watched", false);
      }
    },
    [log],
  );

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      listeners.add(handleWatch);
    }
    return () => {
      listeners.delete(handleWatch);
    };
  }, [handleWatch]);

  useEffect(() => {
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (bodyHasDemoFile(init?.body)) {
        setUploadAttempts((u) => u + 1);
        log("BLOCKED: outbound request tried to carry your file", true);
      } else if (init?.body) {
        setOutboundDuringDemo((n) => n + 1);
        log("outbound request (no file data) began");
      }
      return origFetch(input as RequestInfo | URL, init as RequestInit);
    };

    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      if (bodyHasDemoFile(body)) {
        setUploadAttempts((u) => u + 1);
        log("BLOCKED: XHR tried to send your file", true);
      } else if (body != null) {
        setOutboundDuringDemo((n) => n + 1);
      }
      return origSend.call(this, body);
    };

    return () => {
      window.fetch = origFetch;
      XMLHttpRequest.prototype.send = origSend;
    };
  }, [log]);

  const kib = watched ? (watched.size / 1024).toFixed(1) : "0.0";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live network audit
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          window.fetch · XHR intercepted
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
        <div className="p-4">
          <p
            className="text-3xl font-extrabold tabular-nums"
            aria-live="polite"
          >
            {uploadAttempts}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            upload attempts detected
          </p>
        </div>
        <div className="p-4">
          <p className="text-3xl font-extrabold tabular-nums">
            {outboundDuringDemo}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            outbound requests
          </p>
        </div>
        <div className="p-4">
          <p className="text-3xl font-extrabold tabular-nums text-emerald-600">
            {watched ? `${kib} KiB` : "—"}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500 truncate">
            {watched ? watched.name : "no file watched yet"}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-950 px-4 py-3 font-mono text-[11px] leading-relaxed">
        {events.length === 0 ? (
          <p className="text-slate-500">
            {watched
              ? "auditing… waiting for a network request carrying your file."
              : "drop a file below — the audit begins the moment you do."}
          </p>
        ) : (
          events.map((e, i) => (
            <p
              key={i}
              className={e.error ? "text-rose-400" : "text-emerald-400"}
            >
              <span className="text-slate-600">
                {new Date(e.at).toLocaleTimeString("en-US", {
                  hour12: false,
                })}{" "}
              </span>
              {e.label}
            </p>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
        <span aria-hidden="true">✓</span>
        {watched
          ? "Your file never left this page — processing is local."
          : "Files are processed locally, in your browser, by WebAssembly."}
      </div>
    </div>
  );
}