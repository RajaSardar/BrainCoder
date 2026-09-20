"use client";

import { useCallback, useEffect, useState } from "react";
import { FileType2 } from "lucide-react";
import { Button, CopyButton, SliderField, StyledTextarea } from "@/components/ui";

const WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident culpa qui officia deserunt mollit anim id est laborum".split(
    " ",
  );

const MIN_COUNT = 1;
const MAX_COUNT = 50;

type Mode = "paragraphs" | "sentences" | "words";

function buildUnits(mode: Mode, count: number): string {
  let lastWord = -1;
  const pick = () => {
    let i: number;
    do {
      i = Math.floor(Math.random() * WORDS.length);
    } while (i === lastWord && WORDS.length > 1);
    lastWord = i;
    return WORDS[i];
  };

  const canonical = ["lorem", "ipsum", "dolor", "sit", "amet"];

  const makeSentence = (first: boolean): string => {
    const n = 6 + Math.floor(Math.random() * 8);
    const parts = first ? canonical.slice() : [];
    while (parts.length < n) parts.push(pick());
    let s = parts.join(" ");
    s = s[0].toUpperCase() + s.slice(1);
    return s + ".";
  };

  const makeParagraph = (first: boolean): string => {
    const n = 4 + Math.floor(Math.random() * 3);
    const sents: string[] = [];
    for (let i = 0; i < n; i++) sents.push(makeSentence(first && i === 0));
    return sents.join(" ");
  };

  const units: string[] = [];
  if (mode === "words") {
    const tokens: string[] = [];
    if (count >= 2) tokens.push("lorem", "ipsum");
    while (tokens.length < count) tokens.push(pick());
    units.push(tokens.join(" "));
  } else if (mode === "sentences") {
    for (let i = 0; i < count; i++) units.push(makeSentence(i === 0));
  } else {
    for (let i = 0; i < count; i++) units.push(makeParagraph(i === 0));
  }
  return units.join(mode === "paragraphs" ? "\n\n" : " ");
}

export default function LoremIpsum() {
  const [mode, setMode] = useState<Mode>("paragraphs");
  const [count, setCount] = useState(3);
  const [output, setOutput] = useState("");
  const [meta, setMeta] = useState<{ mode: Mode; count: number } | null>(null);

  const build = useCallback((m: Mode, c: number) => buildUnits(m, c), []);

  const apply = useCallback(
    (m: Mode, c: number) => {
      const txt = build(m, c);
      setOutput(txt);
      setMeta({ mode: m, count: c });
    },
    [build],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const txt = build(mode, count);
      setOutput(txt);
      setMeta({ mode, count });
    }, 0);
    return () => clearTimeout(t);
  }, [mode, count, build]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Type</p>
          <div role="group" aria-label="Type" className="flex rounded-xl border border-slate-200 bg-white p-1 w-fit">
            {(["paragraphs", "sentences", "words"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition min-h-11 ${
                  mode === m
                    ? "bg-pink-600 text-white ring-2 ring-pink-600 ring-offset-2"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="w-56">
          <SliderField
            label="Count"
            value={count}
            min={MIN_COUNT}
            max={MAX_COUNT}
            onChange={(v) => setCount(v)}
          />
        </div>
        <Button type="button" onClick={() => apply(mode, count)}>
          <FileType2 className="w-4 h-4 mr-1.5 inline" /> Generate
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p role="status" aria-live="polite" className="text-xs text-slate-600">
          {meta ? `${meta.count} ${meta.mode}` : ""}
        </p>
        <CopyButton text={output} label="Copy output" ariaLabel="Copy generated text" />
      </div>
      <StyledTextarea rows={12} value={output} readOnly aria-label="Generated output" className="bg-slate-100" />
    </div>
  );
}