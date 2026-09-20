"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { Button, StyledTextarea } from "@/components/ui";

const MAX_CHARS = 1_000_000;

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
  const words = trimmed.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) ?? [];
  const shielded = trimmed
    .replace(/\b\d+(?:\.\d+)+\b/g, (m) => "0".repeat(m.length))
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|incl|approx)\./gi, "X");
  const sentenceMatches = shielded.match(/[^.!?。！？]+[.!?。！？]+(?=\s|$)/g) ?? [];
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length : 0;

  let chars = 0;
  let charsNoSpaces = 0;
  for (const ch of text) {
    chars += 1;
    if (!/\s/.test(ch)) charsNoSpaces += 1;
  }

  const uniqueWords = new Set(
    words.map((w) => w.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}\p{N}'-]/gu, "")),
  ).size;

  return {
    words: words.length,
    chars,
    charsNoSpaces,
    sentences: sentenceMatches.length,
    paragraphs,
    lines: text ? text.split("\n").length : 0,
    readingMinutes: Math.round((words.length / 200) * 100) / 100,
    speakingMinutes: Math.round((words.length / 130) * 100) / 100,
    uniqueWords,
  };
}

export default function WordCounter() {
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);
  const stats = useMemo(() => computeStats(deferredText), [deferredText]);
  const textareaId = useId();
  const empty = text.trim().length === 0;
  const atCap = text.length >= MAX_CHARS;

  const cards = [
    { label: "Words", value: stats.words.toLocaleString("en-US") },
    { label: "Characters", value: stats.chars.toLocaleString("en-US") },
    { label: "Characters (no spaces)", value: stats.charsNoSpaces.toLocaleString("en-US") },
    { label: "Sentences", value: stats.sentences.toLocaleString("en-US") },
    { label: "Paragraphs", value: stats.paragraphs.toLocaleString("en-US") },
    { label: "Lines", value: stats.lines.toLocaleString("en-US") },
    { label: "Unique words", value: stats.uniqueWords.toLocaleString("en-US") },
    { label: "Reading time", value: `${stats.readingMinutes.toFixed(1)} min` },
    { label: "Speaking time", value: `${stats.speakingMinutes.toFixed(1)} min` },
  ];

  return (
    <div className="space-y-5 w-full">
      <div>
        <label htmlFor={textareaId} className="sr-only">
          Text to count
        </label>
        <StyledTextarea
          id={textareaId}
          rows={10}
          maxLength={MAX_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text to count…"
        />
        <div className="flex items-center justify-between mt-2">
          <p role="status" aria-live="polite" className="text-xs sm:text-sm text-slate-600">
            {empty ? "Waiting for text…" : `${stats.words.toLocaleString("en-US")} ${stats.words === 1 ? "word" : "words"}, ${stats.chars.toLocaleString("en-US")} ${stats.chars === 1 ? "character" : "characters"}`}
          </p>
          <Button type="button" variant="secondary" onClick={() => setText("")} disabled={empty}>
            Clear
          </Button>
        </div>
        {atCap && (
          <p className="text-xs text-slate-500 mt-1">
            Character limit reached — the counter covers the first 1,000,000 characters.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <dl key={c.label} className="rounded-xl bg-white border border-slate-200 p-4 text-center flex flex-col">
            <dt className="text-xs text-slate-500 mt-1 order-2">{c.label}</dt>
            <dd className="text-2xl font-bold text-indigo-600">{c.value}</dd>
          </dl>
        ))}
      </div>
    </div>
  );
}