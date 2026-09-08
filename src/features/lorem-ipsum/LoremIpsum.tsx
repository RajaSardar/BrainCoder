"use client";

import { useCallback, useState } from "react";
import { FileType2 } from "lucide-react";
import { Button, Field, StyledTextarea, CopyButton } from "@/components/ui";

const WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident culpa qui officia deserunt mollit anim id est laborum".split(
    " "
  );

function pick(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function sentence(): string {
  const n = 6 + Math.floor(Math.random() * 8);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(pick());
  let s = parts.join(" ");
  s = s[0].toUpperCase() + s.slice(1);
  return s + ".";
}

function paragraph(): string {
  const n = 4 + Math.floor(Math.random() * 4);
  const sents: string[] = [];
  for (let i = 0; i < n; i++) sents.push(sentence());
  return sents.join(" ");
}

export default function LoremIpsum() {
  const [mode, setMode] = useState<"paragraphs" | "sentences" | "words">("paragraphs");
  const [count, setCount] = useState(3);
  const [output, setOutput] = useState(() => {
    const ps: string[] = [];
    for (let i = 0; i < 3; i++) ps.push(paragraph());
    return ps.join("\n\n");
  });

  const generate = useCallback(() => {
    const units: string[] = [];
    for (let i = 0; i < count; i++) {
      if (mode === "paragraphs") units.push(paragraph());
      else if (mode === "sentences") units.push(sentence());
      else units.push(pick());
    }
    setOutput(mode === "words" ? units.join(" ") : units.join(mode === "paragraphs" ? "\n\n" : " "));
  }, [mode, count]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Type">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 w-fit">
            {(["paragraphs", "sentences", "words"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  mode === m ? "bg-pink-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`Count: ${count}`}>
          <input
            type="range"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-48 accent-pink-600"
          />
        </Field>
        <Button type="button" onClick={generate}>
          <FileType2 className="w-4 h-4 mr-1.5 inline" /> Generate
        </Button>
      </div>

      <div className="flex justify-end">
        <CopyButton text={output} />
      </div>
      <StyledTextarea rows={12} value={output} readOnly className="bg-slate-100" />
    </div>
  );
}