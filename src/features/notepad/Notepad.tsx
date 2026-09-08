"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, Download, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

const STORAGE_KEY = "braincoder.notepad";

export default function Notepad() {
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) ?? "";
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, text);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const onOpen = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const onDownload = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "note.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          <FolderOpen className="w-4 h-4 mr-1.5 inline" /> Open
        </Button>
        <Button type="button" variant="secondary" onClick={onDownload}>
          <Download className="w-4 h-4 mr-1.5 inline" /> Save
        </Button>
        <Button type="button" variant="secondary" onClick={onCopy}>
          <Copy className="w-4 h-4 mr-1.5 inline" /> Copy
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (text && !confirm("Clear all text? This cannot be undone.")) return;
            setText("");
          }}
        >
          <Trash2 className="w-4 h-4 mr-1.5 inline" /> Clear
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/*"
          className="hidden"
          onChange={(e) => onOpen(e.target.files?.[0])}
        />
        <span className="text-xs text-slate-400 ml-auto">
          {text.split(/\s+/).filter(Boolean).length} words · auto-saved locally
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start typing… your notes are saved automatically in this browser."
        className="w-full h-[420px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition resize-y"
      />
    </div>
  );
}