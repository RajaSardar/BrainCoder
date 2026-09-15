import corePkg from "./.wasm-node/core.js";

const { find_matches } = corePkg;

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
console.log("\nWASM core matches JS reference on all cases.");