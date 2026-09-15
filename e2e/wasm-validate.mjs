import corePkg from "./.wasm-node/core.js";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const { find_matches, split_words, merge_pdfs, extract_pdfs } = corePkg;

const STRIP = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const norm = (s) => s.replace(STRIP, "").toLowerCase();

function jsFind(words, pageW, pageH, query) {
  const q = query.trim().toLowerCase();
  const queryWords = q.split(/\s+/).filter(Boolean);
  const rects = [];
  const n = words.length;
  const qn = queryWords.length;
  if (qn === 0) return "[]";
  for (let i = 0; i < n; i++) {
    let k = 0;
    let j = i;
    while (k < qn && j < n && norm(words[j].text) === queryWords[k]) {
      k++;
      j++;
    }
    if (k === qn) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let m = i; m < j; m++) {
        const w = words[m];
        minX = Math.min(minX, w.x);
        minY = Math.min(minY, w.y);
        maxX = Math.max(maxX, w.x + w.width);
        maxY = Math.max(maxY, w.y + w.height);
      }
      const fs = words[i].fontSize;
      const padX = (fs * 0.12) / pageW;
      const padY = (fs * 0.2) / pageH;
      const x = Math.max(0, minX / pageW - padX);
      const y = Math.max(0, minY / pageH - padY);
      const ww = Math.min(1, maxX / pageW - minX / pageW + padX * 2);
      const hh = Math.min(1, maxY / pageH - minY / pageH + padY * 2);
      rects.push([Number(x.toFixed(9)), Number(y.toFixed(9)), Number(ww.toFixed(9)), Number(hh.toFixed(9))]);
    }
  }
  return JSON.stringify(rects);
}

function wasmFind(words, pageW, pageH, query) {
  const flat = find_matches(
    words.map((w) => w.x),
    words.map((w) => w.y),
    words.map((w) => w.width),
    words.map((w) => w.height),
    words.map((w) => w.fontSize),
    words.map((w) => w.text),
    pageW,
    pageH,
    query,
  );
  const rects = [];
  for (let i = 0; i < flat.length; i += 4) {
    rects.push([0, 1, 2, 3].map((j) => Number(flat[i + j].toFixed(9))));
  }
  return JSON.stringify(rects);
}

const mk = (x, y, width, height, fontSize, text) => ({ x, y, width, height, fontSize, text });
const PAGE_W = 612;
const PAGE_H = 792;

const pages = {
  p1: [
    mk(72, 72, 40, 14, 12, "The"),
    mk(116, 72, 55, 14, 12, "patient,"),
    mk(175, 72, 60, 14, 12, "John"),
    mk(238, 72, 44, 14, 12, "A."),
    mk(285, 72, 70, 14, 12, "Smith"),
    mk(359, 72, 30, 14, 12, "has"),
    mk(392, 72, 55, 14, 12, "private"),
    mk(450, 72, 80, 14, 12, "insurance"),
    mk(72, 96, 40, 14, 12, "and"),
    mk(116, 96, 55, 14, 12, "private"),
    mk(175, 96, 60, 14, 12, "records"),
    mk(238, 96, 50, 14, 12, "marked"),
    mk(292, 96, 90, 14, 12, "(Confidential)"),
    mk(386, 96, 40, 14, 12, "for"),
    mk(430, 96, 40, 14, 12, "John"),
    mk(474, 96, 44, 14, 12, "A."),
    mk(522, 96, 46, 14, 12, "Smith"),
  ],
  p2: [
    mk(72, 72, 55, 14, 12, "CONFIDENTIAL"),
    mk(131, 72, 30, 14, 12, "by"),
    mk(165, 72, 40, 14, 12, "Smith,"),
    mk(209, 72, 44, 14, 12, "John"),
    mk(257, 72, 50, 14, 12, "MD"),
  ],
};

const cases = [
  ["private insurance", "p1"],
  ["john a. smith", "p1"],
  ["confidential", "p1"],
  ["private records", "p1"],
  ["not present", "p1"],
  ["john", "p2"],
  ["smith", "p2"],
  ["", "p1"],
  ["john smith", "p2"],
];

let failures = 0;
for (const [query, page] of cases) {
  const words = pages[page];
  const a = jsFind(words, PAGE_W, PAGE_H, query);
  const b = wasmFind(words, PAGE_W, PAGE_H, query);
  const ok = a === b;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  query="${query}" page=${page}  rects(js)=${a}  rects(wasm)=${b}`);
}

if (failures) {
  console.error(`\n${failures} case(s) mismatched.`);
  process.exit(1);
}
console.log("\nWASM core matches JS reference on all find_matches cases.");

// --- split_words equivalence ------------------------------------------------
const SPACE_WEIGHT = 0.45;
const WORD_PAD_EM = 0.16;
const WORD_RIGHT_EXTRA_EM = 0.07;
const MAX_WORD_CHARS = 20;
const WORD_SPLIT_MIN_WIDTH = 3.2;

function charWeight(ch) {
  if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\u00a0") return SPACE_WEIGHT;
  switch (ch) {
    case "W": case "M": case "O": case "Q": case "w": case "m": case "@": case "#":
    case "%": case "A": case "G": case "o": case "g": case "d": case "b": case "q":
    case "p": case "u":
      return 1.16;
    case "i": case "j": case "l": case "f": case "t": case "r": case ".": case ",":
    case "'": case "`": case "|": case "!": case "I": case ":": case ";": case ")":
    case "(":
      return 0.82;
    default:
      return 1;
  }
}

function jsSplit(runs) {
  const data = [];
  const texts = [];
  for (const run of runs) {
    if (run.width < run.fontSize * WORD_SPLIT_MIN_WIDTH || !/\s/.test(run.text)) {
      data.push(run.x, run.y, run.width, run.height, run.fontSize, run.baseline);
      texts.push(run.text);
      continue;
    }
    const tokens = [];
    let w = 0;
    for (const ch of run.text) {
      const cw = charWeight(ch);
      tokens.push({ text: ch, weight: cw });
      w += cw;
    }
    if (w <= 0) {
      data.push(run.x, run.y, run.width, run.height, run.fontSize, run.baseline);
      texts.push(run.text);
      continue;
    }
    const pad = run.fontSize * WORD_PAD_EM;
    const extraRight = run.fontSize * WORD_RIGHT_EXTRA_EM;
    const advancePerUnit = run.width / w;
    const emit = (wordArr, start) => {
      const wordWeight = wordArr.reduce((s, t) => s + t.weight, 0);
      const wordChars = wordArr.reduce((s, t) => s + t.text.length, 0);
      const wx = run.x + start * advancePerUnit;
      const ww = Math.max(wordChars * run.fontSize * 0.28, wordWeight * advancePerUnit);
      const x0 = Math.max(run.x, wx - pad);
      const x1 = Math.min(run.x + run.width, wx + ww + pad + extraRight);
      data.push(x0, run.y, Math.max(x1 - x0, run.fontSize * 0.5), run.height, run.fontSize, run.baseline);
      texts.push(wordArr.map((t) => t.text).join(""));
    };
    let cursor = 0;
    let word = [];
    let wordStart = 0;
    for (const token of tokens) {
      if (token.weight <= SPACE_WEIGHT + 1e-6) {
        if (word.length) {
          emit(word, wordStart);
          word = [];
        }
        cursor += token.weight;
        continue;
      }
      if (!word.length) wordStart = cursor;
      word.push(token);
      cursor += token.weight;
      if (word.reduce((s, t) => s + t.text.length, 0) >= MAX_WORD_CHARS) {
        emit(word, wordStart);
        word = [];
      }
    }
    if (word.length) emit(word, wordStart);
  }
  return { data, texts };
}

const wasmSplit = (runs) => {
  const batch = split_words(
    runs.map((r) => r.x),
    runs.map((r) => r.y),
    runs.map((r) => r.width),
    runs.map((r) => r.height),
    runs.map((r) => r.fontSize),
    runs.map((r) => r.baseline),
    runs.map((r) => r.text),
  );
  return { data: Array.from(batch.data()), texts: batch.texts() };
};

const eqRuns = (a, b) => a.data.length === b.data.length && a.data.every((v, i) => Math.abs(v - b.data[i]) < 1e-9) && JSON.stringify(a.texts) === JSON.stringify(b.texts);

const splitRuns = [
  { x: 60, y: 640, width: 400, height: 14, fontSize: 12, baseline: 654, text: "The patient John A Smith has private insurance details." },
  { x: 60, y: 600, width: 120, height: 14, fontSize: 12, baseline: 614, text: "CONFIDENTIAL - top" },
  { x: 60, y: 560, width: 90, height: 14, fontSize: 12, baseline: 574, text: "short" },
  { x: 10, y: 520, width: 30, height: 14, fontSize: 12, baseline: 534, text: "tiny" },
  { x: 60, y: 480, width: 300, height: 28, fontSize: 24, baseline: 502, text: "Wide W M alpha." },
];

let splitFail = 0;
for (const [idx, run] of splitRuns.entries()) {
  const a = jsSplit([run]);
  const b = wasmSplit([run]);
  const ok = eqRuns(a, b);
  if (!ok) splitFail++;
  console.log(`${ok ? "PASS" : "FAIL"}  split_words run#${idx} "${run.text}" -> ${run.width >= run.fontSize * WORD_SPLIT_MIN_WIDTH && /\s/.test(run.text) ? b.texts.length + " word(s)" : "passthrough"}`);
}

// --- merge/extract round-trip ------------------------------------------------
async function pdfText(doc, pageIndex) {
  const page = await doc.getPage(pageIndex);
  const tc = await page.getTextContent();
  return tc.items.map((i) => i.str).join(" ");
}

async function loadPdf(data) {
  return pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
}

const ttf = await readFile(new URL("../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf", import.meta.url));
async function makePdf(lines) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(ttf));
  const page = doc.addPage([500, 700]);
  lines.forEach((ln, i) => page.drawText(ln, { x: 60, y: 640 - i * 26, fontSize: 12, font }));
  return doc.save();
}

const pdfA = await makePdf(["Alpha first"]);
const pdfB = await makePdf(["Beta second"]);

const merged = merge_pdfs([new Uint8Array(pdfA), new Uint8Array(pdfB)]);
const mergedDoc = await loadPdf(merged);
const mergedP1 = await pdfText(mergedDoc, 1);
const mergedP2 = await pdfText(mergedDoc, 2);
const mergeOk = mergedDoc.numPages === 2 && mergedP1.includes("Alpha first") && mergedP2.includes("Beta second");
console.log(`${mergeOk ? "PASS" : "FAIL"}  merge_pdfs: 2 pages, p1="${mergedP1}", p2="${mergedP2}"`);

const parts = extract_pdfs(merged, [[1], [0]]);
const part1 = await loadPdf(parts[0]);
const part2 = await loadPdf(parts[1]);
const t1 = await pdfText(part1, 1);
const t2 = await pdfText(part2, 1);
const splitOk = parts.length === 2 && part1.numPages === 1 && part2.numPages === 1 && t1.includes("Beta second") && t2.includes("Alpha first");
console.log(`${splitOk ? "PASS" : "FAIL"}  extract_pdfs [[1],[0]]: group0="${t1}", group1="${t2}"`);

const both = extract_pdfs(new Uint8Array(merged), [[0, 1]]);
const bothDoc = await loadPdf(both[0]);
const bt1 = await pdfText(bothDoc, 1);
const bt2 = await pdfText(bothDoc, 2);
const bothOk = bothDoc.numPages === 2 && bt1.includes("Alpha first") && bt2.includes("Beta second");
console.log(`${bothOk ? "PASS" : "FAIL"}  extract_pdfs [[0,1]]: p1="${bt1}", p2="${bt2}"`);

if (splitFail || !mergeOk || !splitOk || !bothOk) {
  console.error("\nsplit_words / merge / extract mismatches detected.");
  process.exit(1);
}
console.log("\nWASM split_words matches JS reference; merge/extract round-trips verified.");