"use client";

import { useMemo, useState } from "react";
import { StyledTextarea } from "@/components/ui";

interface Stats {
  words: number;
  chars: number;
  charsNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingMinutes: number;
  speakingMinutes: number;
  uniqueWords: number;
}

function computeStats(text: string): Stats {
  const trimmed = text.trim();
  const wordsArr = trimmed ? trimmed.split(/\s+/) : [];
  const sentencesArr = trimmed
    ? trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    : [];
  const paragraphsArr = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0) : [];

  return {
    words: wordsArr.length,
    chars: text.length,
    charsNoSpaces: text.replace(/\s/g, "").length,
    sentences: sentencesArr.length,
    paragraphs: paragraphsArr.length,
    lines: text ? text.split("\n").length : 0,
    readingMinutes: Math.max(0, Math.round((wordsArr.length / 200) * 100) / 100),
    speakingMinutes: Math.max(0, Math.round((wordsArr.length / 130) * 100) / 100),
    uniqueWords: new Set(wordsArr.map((w) => w.toLowerCase())).size,
  };
}

export default function WordCounter() {
  const [text, setText] = useState(
    "The quick brown fox jumps over the lazy dog.\n\nThis is a second paragraph with more words in it."
  );

  const stats = useMemo(() => computeStats(text), [text]);

  const cards = [
    { label: "Words", value: stats.words },
    { label: "Characters", value: stats.chars },
    { label: "Characters (no spaces)", value: stats.charsNoSpaces },
    { label: "Sentences", value: stats.sentences },
    { label: "Paragraphs", value: stats.paragraphs },
    { label: "Lines", value: stats.lines },
    { label: "Unique words", value: stats.uniqueWords },
  ];

  return (
    <div className="space-y-5 w-full">
      <StyledTextarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste text to count…"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{c.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{stats.readingMinutes.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">min read (200 wpm)</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{stats.speakingMinutes.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">min speak (130 wpm)</p>
        </div>
      </div>
    </div>
  );
}