"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, FolderOpen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";

const STORAGE_KEY = "braincoder.notepad";
const DOC_CHAR_CAP = 2_000_000;
const FILE_BYTE_CAP = 8 * 1024 * 1024;
const TOO_LARGE_MESSAGE =
  "This note is limited to 2 million characters. Copy or download a backup before it grows this large.";

function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatTime(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function downloadName(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim());
  const stem = (firstLine ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${stem || "note"}-${new Date().toISOString().slice(0, 10)}.txt`;
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

export default function Notepad() {
  const [text, setText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const textRef = useRef("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<string | null>(null);
  const disarmTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);
  const lastAnnounceMinute = useRef("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [copied, setCopied] = useState(false);
  const [armClear, setArmClear] = useState(false);

  const setErrorState = useCallback((message: string | null) => {
    errorRef.current = message;
    setError(message);
  }, []);

  const updateText = useCallback(
    (raw: string) => {
      if (disarmTimer.current) {
        window.clearTimeout(disarmTimer.current);
        disarmTimer.current = null;
      }
      setArmClear(false);
      if (raw.length > DOC_CHAR_CAP) {
        const clamped = raw.slice(0, DOC_CHAR_CAP);
        textRef.current = clamped;
        setText(clamped);
        if (errorRef.current !== TOO_LARGE_MESSAGE) setErrorState(TOO_LARGE_MESSAGE);
        return;
      }
      textRef.current = raw;
      setText(raw);
      if (errorRef.current === TOO_LARGE_MESSAGE) setErrorState(null);
    },
    [setErrorState]
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      let value = "";
      try {
        value = localStorage.getItem(STORAGE_KEY) ?? "";
      } catch {}
      if (value.length > DOC_CHAR_CAP) value = value.slice(0, DOC_CHAR_CAP);
      textRef.current = value;
      setText(value);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated || text === "") return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, text);
        setSaveFailed(false);
        const now = new Date();
        setLastSavedAt(now);
        const minute = now.toTimeString().slice(0, 5);
        if (lastAnnounceMinute.current !== minute) {
          lastAnnounceMinute.current = minute;
          setAnnounce(`Note saved at ${minute}`);
        }
      } catch {
        setSaveFailed(true);
        setErrorState(
          "Couldn't save — this browser's storage is full or blocked. Copy your note before closing the tab."
        );
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [text, hydrated, setErrorState]);

  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, textRef.current);
      } catch {}
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) updateText(event.newValue ?? "");
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
      if (disarmTimer.current) window.clearTimeout(disarmTimer.current);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, [updateText]);

  const onOpen = (file: File | undefined) => {
    if (!file) return;
    if (file.size > FILE_BYTE_CAP) {
      setErrorState("That file is over 8 MB and can't be opened here. Split it into smaller text files first.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      updateText(raw);
      const placeholderCount = (raw.match(/\uFFFD/g) ?? []).length;
      if (placeholderCount > 20) {
        setErrorState("That file doesn't look like plain text — some characters couldn't be read.");
      }
      setAnnounce(`File loaded — ${countWords(textRef.current)} words`);
      taRef.current?.focus();
    };
    reader.readAsText(file, "utf-8");
  };

  const onCopy = async () => {
    if (!text) return;
    const ok = await writeClipboard(text);
    if (ok) {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      setCopied(true);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
      setErrorState(null);
      setAnnounce("Copied to clipboard");
    } else {
      setErrorState("Copy failed — this browser blocked the clipboard. Select the text and copy manually.");
    }
  };

  const onSave = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName(text);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onClickClear = () => {
    if (!text) return;
    if (armClear) {
      if (disarmTimer.current) {
        window.clearTimeout(disarmTimer.current);
        disarmTimer.current = null;
      }
      textRef.current = "";
      setText("");
      setArmClear(false);
      setLastSavedAt(null);
      setErrorState(null);
      setAnnounce("Note cleared");
      taRef.current?.focus();
    } else {
      setArmClear(true);
      disarmTimer.current = window.setTimeout(() => setArmClear(false), 4000);
    }
  };

  const words = useMemo(() => countWords(text), [text]);
  const chars = text.length;
  const saveLabel = saveFailed
    ? "not saving"
    : lastSavedAt
      ? `saved at ${formatTime(lastSavedAt)}`
      : "auto-saves locally";
  const focusRing =
    "min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

  return (
    <div className="space-y-3 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          className={focusRing}
        >
          <FolderOpen className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          Open
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          disabled={!text}
          className={focusRing}
        >
          <Download className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          Save
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCopy}
          disabled={!text}
          className={focusRing}
        >
          {copied ? (
            <Check className="w-4 h-4 mr-1.5 inline text-green-600" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          variant={armClear ? "danger" : "secondary"}
          onClick={onClickClear}
          disabled={!text}
          className={focusRing}
        >
          <Trash2 className="w-4 h-4 mr-1.5 inline" aria-hidden="true" />
          {armClear ? "Confirm clear" : "Clear"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/*"
          className="hidden"
          aria-label="Open a text file"
          onChange={(e) => {
            onOpen(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p id="notepad-meta" className="text-xs text-slate-600 ml-auto">
          {words} word{words === 1 ? "" : "s"} · {chars} char{chars === 1 ? "" : "s"} · {saveLabel}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setErrorState(null)}
            aria-label="Dismiss error"
            className="shrink-0 inline-flex items-center justify-center rounded-md p-1 hover:bg-red-100 transition min-h-8 min-w-8"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <label htmlFor="notepad-text" className="block text-sm font-medium text-slate-700">
        Notes
      </label>
      <textarea
        id="notepad-text"
        ref={taRef}
        value={text}
        onChange={(e) => updateText(e.target.value)}
        placeholder="Start typing…"
        aria-describedby="notepad-meta"
        className="w-full h-[420px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y placeholder:text-slate-500"
      />
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
    </div>
  );
}