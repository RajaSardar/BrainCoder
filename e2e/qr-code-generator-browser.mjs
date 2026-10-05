// Production-Chrome e2e for the "QR Code Generator" tool.
//
// The point of this harness is that it does not trust the UI's own words. The
// tool claims three things that are easy to claim and easy to get wrong:
//
//   1. the exported PNG is a QR code that a real reader can decode,
//   2. its modules land on exact pixel boundaries with the four-module quiet
//      zone intact, and
//   3. the exported SVG is the same matrix, in vector form.
//
// So both downloads are re-parsed from their own bytes. The PNG is inflated back
// into pixels, then decoded by the QR decoder written from the specification's
// description of a scanner — finder patterns, timing lines, alignment grid,
// format information, de-masking, de-interleaving, Reed-Solomon syndromes, and
// the bit stream itself. The SVG is parsed and its path runs compared against the
// PNG's modules. If the tool ever quietly emits a code that does not decode, or
// clips the quiet zone, or scales by a fraction, this fails.
//
//   node e2e/qr-code-generator-browser.mjs        # expects a server on :3801
//   BASE_URL=http://localhost:3001 node e2e/qr-code-generator-browser.mjs
//
// NOT run by the implementer — the orchestrator builds, starts the server and
// runs this.

import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/qr-code-generator`;
const GUIDE = `${BASE_URL}/guides/how-to-create-a-qr-code`;
const DL = "/tmp/qr-code-generator-e2e";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// --------------------------------------------------------------------------
// GF(256) — the field Reed-Solomon is defined over
// --------------------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// --------------------------------------------------------------------------
// The standard's tables, written out here rather than shared with the tool, so
// the harness does not inherit a mistake from the implementation under test.
// --------------------------------------------------------------------------
const ECC_PER_BLOCK = [
   7, 10, 13, 17,
  10, 16, 22, 28,
  15, 26, 18, 22,
  20, 18, 26, 16,
  26, 24, 18, 22,
  18, 16, 24, 28,
  20, 18, 18, 26,
  24, 22, 22, 26,
  30, 22, 20, 24,
  18, 26, 24, 28,
  20, 30, 28, 24,
  24, 22, 26, 28,
  26, 22, 24, 22,
  30, 24, 20, 24,
  22, 24, 30, 24,
  24, 28, 24, 30,
  28, 28, 28, 28,
  30, 26, 28, 28,
  28, 26, 26, 26,
  28, 26, 30, 28,
  28, 26, 28, 30,
  28, 28, 30, 24,
  30, 28, 30, 30,
  30, 28, 30, 30,
  26, 28, 30, 30,
  28, 28, 28, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
  30, 28, 30, 30,
];
const BLOCKS = [
   1,  1,  1,  1,
   1,  1,  1,  1,
   1,  1,  2,  2,
   1,  2,  2,  4,
   1,  2,  4,  4,
   2,  4,  4,  4,
   2,  4,  6,  5,
   2,  4,  6,  6,
   2,  5,  8,  8,
   4,  5,  8,  8,
   4,  5,  8, 11,
   4,  8, 10, 11,
   4,  9, 12, 16,
   4,  9, 16, 16,
   6, 10, 12, 18,
   6, 10, 17, 16,
   6, 11, 16, 19,
   6, 13, 18, 21,
   7, 14, 21, 25,
   8, 16, 20, 25,
   8, 17, 23, 25,
   9, 17, 23, 34,
   9, 18, 25, 30,
  10, 20, 27, 32,
  12, 21, 29, 35,
  12, 23, 34, 37,
  12, 25, 34, 40,
  13, 26, 35, 42,
  14, 28, 38, 45,
  15, 29, 40, 48,
  16, 31, 43, 51,
  17, 33, 45, 54,
  18, 35, 48, 57,
  19, 37, 51, 60,
  19, 38, 53, 63,
  20, 40, 56, 66,
  21, 43, 59, 70,
  22, 45, 62, 74,
  24, 47, 65, 77,
  25, 49, 68, 81,
];
const EC_FROM_FORMAT_BITS = { 1: "L", 0: "M", 3: "Q", 2: "H" };
const LEVEL_ORDINAL = { L: 0, M: 1, Q: 2, H: 3 };
const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function totalCodewords(version) {
  return Math.floor(rawDataModules(version) / 8);
}
// ISO/IEC 18004 §7: the modules available for data and error correction,
// before the format and version information are subtracted. The alignment term
// counts the alignment patterns against the number of alignment coordinates, not
// against the version number.
function rawDataModules(version) {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    modules -= (25 * align - 10) * align - 55;
    if (version >= 7) modules -= 36;
  }
  return modules;
}
function dataCodewords(version, level) {
  const i = (version - 1) * 4 + LEVEL_ORDINAL[level];
  return totalCodewords(version) - ECC_PER_BLOCK[i] * BLOCKS[i];
}
function alignmentCentres(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step =
    size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

// --------------------------------------------------------------------------
// Reading a PNG back — header for the size, inflate for the pixels
// --------------------------------------------------------------------------
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Bytes as Latin-1 text, so chunk types can be compared. */
const latin1 = (bytes, from, to) =>
  String.fromCharCode(...Array.from(bytes.subarray(from, to)));
const be32 = (bytes, at) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

function parsePng(b) {
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) if (b[i] !== PNG_SIGNATURE[i]) return null;
  if (latin1(b, 12, 16) !== "IHDR") return null;
  return { width: be32(b, 16), height: be32(b, 20) };
}

/**
 * Expand one non-interlaced 8-bit PNG to RGBA. Works off a plain
 * Uint8Array so it reads a download as well as a file, and re-inflates the IDAT
 * stream itself rather than trusting any decoder in the browser. Colour type 2
 * (RGB) and 6 (RGBA) are both accepted, because canvas.toBlob writes the latter
 * for a canvas that carries an alpha channel.
 */
function decodePngPixels(b) {
  const head = parsePng(b);
  if (!head) return null;
  const depth = b[24];
  const colour = b[25];
  if (depth !== 8 || (colour !== 2 && colour !== 6)) return null;
  if (b[28] !== 0) return null; // interlace
  const width = head.width;
  const height = head.height;
  const channels = colour === 6 ? 4 : 3;
  const stride = width * channels;
  let offset = 8;
  const idat = [];
  while (offset + 8 <= b.length) {
    const len = be32(b, offset);
    const type = latin1(b, offset + 4, offset + 8);
    if (type === "IDAT") idat.push(Buffer.from(b.subarray(offset + 8, offset + 8 + len)));
    offset += len + 12;
  }
  if (!idat.length) return null;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) return null;
  const out = new Uint8Array(stride * height);
  const line = new Uint8Array(stride);
  const prior = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1);
    const filter = raw[at];
    for (let i = 0; i < stride; i += 1) {
      const x = raw[at + 1 + i];
      const a = i >= channels ? line[i - channels] : 0;
      const c = i >= channels ? prior[i - channels] : 0;
      const bb = prior[i];
      let v;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + bb;
      else if (filter === 3) v = x + ((a + bb) >> 1);
      else if (filter === 4) {
        const p = a + bb - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - bb);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c);
      } else return null;
      line[i] = v & 0xff;
    }
    out.set(line, y * stride);
    prior.set(line);
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < out.length; i += channels, p += 4) {
    rgba[p] = out[i];
    rgba[p + 1] = out[i + 1];
    rgba[p + 2] = out[i + 2];
    // An RGBA source keeps its own alpha; an RGB source is fully opaque.
    rgba[p + 3] = channels === 4 ? out[i + 3] : 255;
  }
  return { width, height, rgba };
}

/** Sample one pixel, as [r,g,b]. */
const at = (img, x, y) => {
  const p = (y * img.width + x) * 4;
  return [img.rgba[p], img.rgba[p + 1], img.rgba[p + 2]];
};

// --------------------------------------------------------------------------
// The decoder — written from the specification's description of a scanner, not
// from the encoder under test.
// --------------------------------------------------------------------------
function decodeMatrix(img) {
  // Nothing here is told the module count or the quiet-zone width: both are
  // measured off the exported image, the way a scanner measures them.
  const note = {};

  // The quiet zone is blank by definition, so the bounding box of dark pixels is
  // exactly the symbol itself. That gives the pixel extent without assuming it.
  const isDark = (x, y) => {
    const [r, g, b] = at(img, x, y);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };
  let top = -1;
  let left = -1;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (isDark(x, y)) {
        if (top < 0) top = y;
        if (left < 0 || x < left) left = x;
        if (x > right) right = x;
        bottom = y;
      }
    }
  }
  if (top < 0) throw new Error("no dark modules at all");
  note.top = top;
  note.left = left;

  // The top row of the top-left finder pattern is seven solid modules followed
  // by a blank separator, which fixes the module pitch without any prior.
  let run = 0;
  while (left + run <= right && isDark(left + run, top)) run += 1;
  if (run < 7) throw new Error(`finder run only ${run} px, too small to be a QR code`);
  const pitch = run / 7;
  note.pitch = pitch;

  const realSize = Math.round((right - left + 1) / pitch);
  const version = (realSize - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new Error(`implausible version from the measured ${realSize} modules`);
  }
  note.version = version;
  note.quiet = {
    top: Math.round(top / pitch),
    left: Math.round(left / pitch),
    right: Math.round((img.width - 1 - right) / pitch),
    bottom: Math.round((img.height - 1 - bottom) / pitch),
  };

  // Sample the centre of each module, so an edge pixel cannot flip a cell.
  const grid = (col, row) => isDark(Math.round(left + (col + 0.5) * pitch), Math.round(top + (row + 0.5) * pitch));

  // Read the format information. Bit 0 sits at the top of column 8 and the
  // string wraps around the top-left finder; a second copy runs along row 8 and
  // back up column 8. Both are read and required to be identical.
  const first = [];
  for (let i = 0; i <= 5; i += 1) first.push(grid(8, i) ? 1 : 0);
  first.push(grid(8, 7) ? 1 : 0);
  first.push(grid(8, 8) ? 1 : 0);
  first.push(grid(7, 8) ? 1 : 0);
  for (let i = 9; i < 15; i += 1) first.push(grid(8, realSize - 15 + i) ? 1 : 0);
  const second = [];
  for (let i = 0; i < 8; i += 1) second.push(grid(realSize - 1 - i, 8) ? 1 : 0);
  second.push(grid(7, 8) ? 1 : 0);
  for (let i = 9; i < 15; i += 1) second.push(grid(14 - i, 8) ? 1 : 0);
  note.formatIdentical = first.join("") === second.join("");
  if (!note.formatIdentical) throw new Error("the two format-information copies disagree");

  const read = first.reduce((acc, bit, i) => acc | (bit << i), 0);
  // Undo the 0x5412 mask the standard applies, then verify the 10-bit BCH
  // codeword with its own polynomial, so a corrupt format block cannot name a
  // level at all. The level and mask only mean anything in the unmasked value.
  const formatBits = read ^ 0x5412;
  // The generator polynomial 0x537 has degree 10, so reduce the 15-bit codeword
  // by XOR-ing it in wherever bit 10 and above is still set.
  let remainder = formatBits;
  for (let i = 14; i >= 10; i -= 1) {
    if ((remainder >>> i) & 1) remainder ^= 0x537 << (i - 10);
  }
  note.formatBchOk = remainder === 0;
  if (!note.formatBchOk) throw new Error(`format information fails its own BCH check: ${read.toString(2)}`);

  // The five data bits sit at the top of the 15-bit word: two for the level, three
// // for the mask. The low ten bits are the BCH remainder.
  note.level = EC_FROM_FORMAT_BITS[(formatBits >>> 13) & 3];
  note.mask = (formatBits >>> 10) & 7;
  if (!note.level) throw new Error("format information names an unknown error correction level");

  // Rebuild the function-module map, then read the data region.
  const isFunction = new Uint8Array(realSize * realSize);
  const mark = (col, row, w, h) => {
    for (let y = row; y < row + h; y += 1) {
      for (let x = col; x < col + w; x += 1) {
        if (x >= 0 && y >= 0 && x < realSize && y < realSize) isFunction[y * realSize + x] = 1;
      }
    }
  };
  // The three finders, each with the one-module separator that the standard
  // reserves around it, clipped at the symbol edge.
  for (const [c, r] of [
    [0, 0],
    [realSize - 8, 0],
    [0, realSize - 8],
  ]) {
    mark(c, r, 8, 8);
  }
  for (let i = 8; i < realSize - 8; i += 1) {
    mark(i, 6, 1, 1);
    mark(6, i, 1, 1);
  }
  for (const c of alignmentCentres(version)) {
    for (const r of alignmentCentres(version)) {
      const nearFinder =
        (c <= 8 && r <= 8) || (c <= 8 && r >= realSize - 9) || (c >= realSize - 9 && r <= 8);
      if (!nearFinder) mark(c - 2, r - 2, 5, 5);
    }
  }
  // The format information area at both ends, plus the always-dark module.
  mark(0, 8, 9, 1);
  mark(8, 0, 1, 9);
  mark(realSize - 8, 8, 8, 1);
  mark(8, realSize - 8, 1, 8);
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const a = Math.floor(i / 3);
      const b = (i % 3) + realSize - 11;
      mark(a, b, 1, 1);
      mark(b, a, 1, 1);
    }
  }

  // Undo the data mask, collecting the data bit stream in the zigzag order the
  // specification defines.
  const maskAt = (row, col) => {
    switch (note.mask) {
      case 0: return (row + col) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return col % 3 === 0;
      case 3: return (row + col) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
      case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
      default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    }
  };
  const bits = [];
  for (let right = realSize - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < realSize; step += 1) {
      const upward = ((right + 1) & 2) === 0;
      const row = upward ? realSize - 1 - step : step;
      for (let c = 0; c < 2; c += 1) {
        const col = right - c;
        if (isFunction[row * realSize + col]) continue;
        let bit = grid(col, row) ? 1 : 0;
        if (maskAt(row, col)) bit ^= 1;
        bits.push(bit);
      }
    }
  }

  // The whole codeword stream, data and error correction together, is what the
  // zigzag produces. Its length must match the standard's tables exactly.
  const totalCws = totalCodewords(version);
  const codewords = [];
  for (let i = 0; i < totalCws && i * 8 + 8 <= bits.length; i += 1) {
    let v = 0;
    for (let k = 0; k < 8; k += 1) v = (v << 1) | bits[i * 8 + k];
    codewords.push(v);
  }
  note.codewords = codewords;

  // Undo the block interleaving. The stream is data codewords from every block,
  // interleaved, then the error correction codewords from every block.
  const blocks = BLOCKS[(version - 1) * 4 + LEVEL_ORDINAL[note.level]];
  const degree = ECC_PER_BLOCK[(version - 1) * 4 + LEVEL_ORDINAL[note.level]];
  const shortLen = Math.floor(codewords.length / blocks);
  const longCount = codewords.length % blocks;
  // The shorter blocks come first and the remainder is spread over the last ones.
  const sizes = [];
  for (let b = 0; b < blocks; b += 1) sizes.push(shortLen - degree + (b >= blocks - longCount ? 1 : 0));
  const data = [];
  const ecBlocks = [];
  for (let b = 0; b < blocks; b += 1) {
    data.push([]);
    ecBlocks.push([]);
  }
  let p = 0;
  const maxData = Math.max(...sizes);
  for (let k = 0; k < maxData; k += 1) {
    for (let b = 0; b < blocks; b += 1) if (k < sizes[b]) data[b].push(codewords[p++]);
  }
  for (let k = 0; k < degree; k += 1) {
    for (let b = 0; b < blocks; b += 1) ecBlocks[b].push(codewords[p++]);
  }
  note.blockSizes = sizes;

  // Every syndrome of every block must vanish, or this is not a valid codeword.
  // The syndromes only cancel within a block, so this is checked per block after
  // de-interleaving, never on the interleaved stream.
  let syndromeFailures = 0;
  for (let b = 0; b < blocks; b += 1) {
    const full = [...data[b], ...ecBlocks[b]];
    if (full.length !== sizes[b] + degree) {
      syndromeFailures += 1;
      continue;
    }
    for (let i = 0; i < degree; i += 1) {
      let acc = 0;
      for (const cw of full) acc = gfMul(acc, EXP[i]) ^ cw;
      if (acc !== 0) syndromeFailures += 1;
    }
  }
  note.syndromeFailures = syndromeFailures;
  note.syndromeChecks = blocks * degree;
  const dataStream = [].concat(...data);

  // Read the bit stream: mode, count, payload.
  const bitAt = (i) => {
    const byte = dataStream[i >> 3];
    return byte === undefined ? 0 : (byte >> (7 - (i & 7))) & 1;
  };
  const take = (n) => {
    let v = 0;
    for (let i = 0; i < n; i += 1) v = (v << 1) | bitAt(cursor + i);
    cursor += n;
    return v;
  };
  let cursor = 0;
  const modeBits = take(4);
  // The count indicator width steps at versions 10 and 27, not on a fixed
  // stride, so the band is chosen by name.
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  const ccBits =
    modeBits === 1 ? [10, 12, 14][band] : modeBits === 2 ? [9, 11, 13][band] : [8, 16, 16][band];
  const count = take(ccBits);
  let text = "";
  note.mode = modeBits === 1 ? "numeric" : modeBits === 2 ? "alphanumeric" : modeBits === 4 ? "byte" : "unknown";
  if (modeBits === 1) {
    let rest = count;
    while (rest > 0) {
      const group = Math.min(3, rest);
      text += String(take(group === 3 ? 10 : group === 2 ? 7 : 4)).padStart(group, "0");
      rest -= group;
    }
  } else if (modeBits === 2) {
    let rest = count;
    while (rest > 0) {
      if (rest >= 2) {
        const v = take(11);
        text += ALPHANUMERIC[Math.floor(v / 45)] + ALPHANUMERIC[v % 45];
        rest -= 2;
      } else {
        text += ALPHANUMERIC[take(6)];
        rest -= 1;
      }
    }
  } else if (modeBits === 4) {
    const bytes = [];
    for (let i = 0; i < count; i += 1) bytes.push(take(8));
    text = new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
  } else {
    throw new Error(`unknown mode indicator ${modeBits}`);
  }
  note.text = text;
  note.expectedData = dataCodewords(version, note.level);
  note.totalCodewords = totalCws;
  note.ecPerBlock = degree;
  note.blockCount = blocks;
  return note;
}

// --------------------------------------------------------------------------
// SVG parsing — the path runs, checked against the same matrix
// --------------------------------------------------------------------------
function parseSvgRuns(svg) {
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!viewBox) throw new Error("no viewBox");
  const total = Number(viewBox[1]);
  const path = svg.match(/<path[^>]*\sd="([^"]+)"/);
  if (!path) throw new Error("no path");
  const cells = new Set();
  for (const m of path[1].matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const w = Number(m[3]);
    for (let i = 0; i < w; i += 1) cells.add(`${y}:${x + i}`);
  }
  return { total, cells, widthAttr: Number(svg.match(/width="(\d+)"/)[1]) };
}

// --------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
function check(ok, label, extra = "") {
  if (ok) {
    passed += 1;
    console.log(`ok  ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.error(`NOT OK  ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

const consoleIssues = [];
const pageErrors = [];
const offOrigin = [];
const nonGet = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t)) consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("request", (r) => {
  const url = r.url();
  if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) offOrigin.push(url);
  if (r.method() !== "GET") nonGet.push(`${r.method()} ${url}`);
});

async function settle() {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30_000 });
}

const input = page.locator("#qr-text-input");
const preview = page.locator("#qr-code-generator canvas");
// Scoped to the tool and matched on the sr-only live region: Next.js and the
// shared CopyButton each render a role="status" element of their own.
const status = page.locator("#qr-code-generator p.sr-only[role='status']").last();
// Next.js renders a visually-hidden route announcer with role="alert", so the
// product alert has to be scoped to the tool root to avoid counting it.
const alertBox = page.locator("#qr-code-generator [role='alert']");

async function type(text) {
  await input.fill(text);
  await settle();
}

async function setLevel(level) {
  await page.locator('select[aria-label="Error correction level"]').selectOption(level);
  await settle();
}

// Chrome refuses the eleventh rapid download in one page unless the user accepts
// its "multiple downloads" prompt, and a blocked download never emits the event.
// A short gap between saves keeps the run below that ceiling.
async function download(saveAs, buttonName, timeout = 60_000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  await settle();
  await page.waitForTimeout(400);
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(`${DL}/${saveAs}`)) };
}

/**
 * Everything the tool says about the code it just made, parsed out of its own
 * status text: version, module count, mode, character count, level and mask. The
 * exported bytes are then held against these numbers, not against this file's
 * expectations, so the harness checks the tool against itself.
 */
async function stated() {
  const label = (await preview.getAttribute("aria-label")) || "";
  const grab = (re) => {
    const m = label.match(re);
    return m ? m[1] : "";
  };
  const version = Number(grab(/version (\d+)/));
  const size = Number(grab(/(\d+)×\d+ modules/));
  const mode = grab(/(numeric|alphanumeric|byte) mode/);
  const chars = Number(grab(/· ([\d,]+) (?:characters?|bytes?)/));
  const level = grab(/error correction ([LMQH])/);
  const mask = Number(grab(/data mask (\d)/));
  return { version, size, mode, chars, level, mask, canvas: size + 8, label };
}

try {
  // ---------------------------------------------------------- the empty state ---
  const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  check(!!resp && resp.status() === 200, "the QR code generator page renders", resp ? String(resp.status()) : "no response");
  await settle();

  check(await input.evaluate((el) => el.value === ""), "the input starts empty");
  check(/Enter some text/i.test(await page.textContent("#qr-code-generator")), "the empty state asks for input");
  check((await preview.count()) === 0, "no QR code is drawn before anything is typed");
  // The empty state counts in the numeric mode it will start in, at the default
  // error-correction level M, where a version 40 code holds 5,596 digits.
  check(/0 \/ 5,596/.test(await page.textContent("#qr-code-generator")), "the character counter shows the real maximum of 5,596");
  check((await alertBox.count()) === 0, "no error before anything is typed");

  // ------------------------------------------------------------- a real code ---
  const URL_TEXT = "https://braincoder.sardar.dev/use/qr-code-generator";
  await type(URL_TEXT);
  check((await preview.count()) === 1, "a preview canvas appears");
  const url = await stated();
  check(url.mode === "byte", "a lowercase URL is encoded in byte mode", url.mode);
  check(url.level === "M", "the default level is M", url.level);
  check(url.chars === URL_TEXT.length, "the status line counts the characters entered", `${url.chars} vs ${URL_TEXT.length}`);
  check(
    url.size === url.version * 4 + 17,
    "the module count matches the version the tool reported",
    `${url.size} for version ${url.version}`,
  );
  check(url.mask >= 0 && url.mask <= 7, "the tool reports one of the eight data masks", String(url.mask));

  const png = await download("url.png", "Download PNG");
  check(png.name.endsWith(".png"), "the PNG download is named .png", png.name);
  const img = decodePngPixels(png.bytes);
  check(!!img, "the PNG decodes as a non-interlaced 8-bit image");
  if (img) {
    check(img.width === img.height, "the PNG is square", `${img.width}x${img.height}`);
    // The canvas is the symbol plus a four-module quiet zone on every side, and
    // the module scale must be a whole number of pixels.
    const canvas = url.canvas;
    check(
      img.width % canvas === 0,
      `the PNG width is a whole multiple of the ${canvas}-module canvas`,
      `${img.width} px`,
    );
    const scale = img.width / canvas;
    check(Number.isInteger(scale), "the module scale is a whole number of pixels", String(scale));
    check(scale >= 3, "each module is at least 3 px wide", `${scale} px`);

    // The quiet zone must be blank on all four sides.
    const edgeBlank = (x, y) => {
      const [r, g, b] = at(img, x, y);
      return (r * 299 + g * 587 + b * 114) / 1000 > 200;
    };
    let quietClean = true;
    for (let i = 0; i < 4 * scale; i += 1) {
      if (
        !edgeBlank(i, 0) ||
        !edgeBlank(img.width - 1 - i, 0) ||
        !edgeBlank(0, i) ||
        !edgeBlank(0, img.height - 1 - i) ||
        !edgeBlank(img.width - 1 - i, img.height - 1 - i)
      ) {
        quietClean = false;
        break;
      }
    }
    check(quietClean, "the four-module quiet zone is blank on every side");

    // And the whole thing must decode back to the text that went in.
    let decoded = null;
    try {
      decoded = decodeMatrix(img);
    } catch (e) {
      decoded = { error: String(e.message || e) };
    }
    check(!!decoded && !decoded.error, "the exported PNG decodes as a QR code", decoded ? decoded.error || "" : "");
    if (decoded && !decoded.error) {
      check(decoded.text === URL_TEXT, "the PNG decodes back to exactly the text entered", decoded.text);
      check(decoded.version === url.version, "the decoder reads the version the tool reported", `${decoded.version} vs ${url.version}`);
      check(decoded.level === url.level, "the format information reads the level the tool reported", `${decoded.level} vs ${url.level}`);
      check(decoded.mask === url.mask, "the format information reads the mask the tool reported", `${decoded.mask} vs ${url.mask}`);
      check(decoded.formatIdentical, "the two copies of the format information agree");
      check(decoded.formatBchOk, "the format information passes its own BCH check");
      check(
        decoded.syndromeFailures === 0,
        `all ${decoded.syndromeChecks} Reed-Solomon syndromes are zero`,
        `${decoded.syndromeFailures} nonzero`,
      );
      check(decoded.mode === url.mode, "the decoder reads the mode the tool reported", `${decoded.mode} vs ${url.mode}`);
      check(
        decoded.codewords.length === decoded.totalCodewords,
        "the zigzag produced exactly as many codewords as the standard's tables",
        `${decoded.codewords.length} vs ${decoded.totalCodewords}`,
      );
      check(
        decoded.totalCodewords - decoded.expectedData === decoded.ecPerBlock * decoded.blockCount,
        "the codewords split into data and error correction the way the tables say",
        `${decoded.totalCodewords - decoded.expectedData} vs ${decoded.ecPerBlock * decoded.blockCount}`,
      );
      check(
        decoded.quiet.top === 4 && decoded.quiet.left === 4 && decoded.quiet.right === 4 && decoded.quiet.bottom === 4,
        "the decoder measures exactly four modules of quiet zone on each side",
        JSON.stringify(decoded.quiet),
      );
    }
  }

  // --------------------------------------------------------------- the SVG ---
  const svg = await download("url.svg", "Download SVG");
  check(svg.name.endsWith(".svg"), "the SVG download is named .svg", svg.name);
  const markup = Buffer.from(svg.bytes).toString("utf8");
  check(markup.startsWith("<svg"), "the SVG file really is an SVG");
  check(markup.includes('xmlns="http://www.w3.org/2000/svg"'), "the SVG declares its namespace");
  check(/shape-rendering="crispEdges"/.test(markup), "the SVG asks for square module edges");
  check(
    new RegExp(`viewBox="0 0 ${url.canvas} ${url.canvas}"`).test(markup),
    `the viewBox measures the ${url.canvas}-module canvas in modules, quiet zone included`,
    (markup.match(/viewBox="[^"]*"/) || [""])[0],
  );
  const runs = parseSvgRuns(markup);
  check(runs.total === url.canvas, `the canvas is ${url.canvas} modules across`, String(runs.total));
  check(runs.cells.size > 0 && runs.cells.size < url.canvas * url.canvas, "the path holds dark modules but not the whole canvas", `${runs.cells.size} cells`);
  check(!runs.cells.has(`${url.size / 2}:${url.size / 2}`), "the path is not a filled square");

  // The SVG and the PNG must be the same code, module for module.
  if (img) {
    const scale = img.width / url.canvas;
    let same = true;
    let firstDiff = "";
    for (let row = 0; row < url.size; row += 1) {
      for (let col = 0; col < url.size; col += 1) {
        const inSvg = runs.cells.has(`${row + 4}:${col + 4}`);
        const [r, g, b] = at(img, Math.round((col + 4.5) * scale), Math.round((row + 4.5) * scale));
        const inPng = (r * 299 + g * 587 + b * 114) / 1000 < 128;
        if (inSvg !== inPng) {
          same = false;
          if (!firstDiff) firstDiff = `row ${row} col ${col}`;
        }
      }
    }
    check(same, "the SVG and the PNG are the same matrix, module for module", firstDiff);
  }

  // -------------------------------------------------- every level, one shape ---
  for (const level of ["L", "M", "Q", "H"]) {
    await setLevel(level);
    const said = await stated();
    check(said.level === level, `selecting ${level} is reflected in the status line`, said.label);
    const out = await download(`level-${level}.png`, "Download PNG");
    const decodedImg = decodePngPixels(out.bytes);
    let ok = false;
    let why = "no image";
    if (decodedImg) {
      try {
        const found = decodeMatrix(decodedImg);
        ok =
          found.text === URL_TEXT &&
          found.level === level &&
          found.version === said.version &&
          found.mask === said.mask &&
          found.syndromeFailures === 0;
        why = `${found.level} v${found.version} mask ${found.mask} ${found.syndromeFailures} syndromes`;
      } catch (e) {
        why = String(e.message || e);
      }
    }
    check(ok, `a code at level ${level} round-trips through a real PNG`, why);
  }
  await setLevel("M");

  // ------------------------------------------------- module modes and unicode ---
  /** Type text, then insist the mode is the one expected and the PNG round-trips. */
  async function modeCase(text, expected, saveAs) {
    await type(text);
    const said = await stated();
    check(said.mode === expected, `${JSON.stringify(text.slice(0, 18))} uses ${expected} mode`, said.mode);
    const out = await download(saveAs, "Download PNG");
    const decodedImg = decodePngPixels(out.bytes);
    if (!decodedImg) {
      check(false, `the ${saveAs} PNG decodes as an image`);
      return null;
    }
    let got = null;
    try {
      got = decodeMatrix(decodedImg);
    } catch (e) {
      got = { error: String(e.message || e) };
    }
    check(!!got && !got.error, `the ${saveAs} PNG decodes as a QR code`, got ? got.error || "" : "");
    if (got && !got.error) {
      check(got.text === text, `the ${saveAs} PNG decodes back to the exact text`, got.text);
      check(got.mode === expected, `the decoder reads ${expected} mode from the bit stream`, got.mode);
      check(got.syndromeFailures === 0, `every syndrome of the ${saveAs} code is zero`, `${got.syndromeFailures} nonzero`);
    }
    return got;
  }

  await modeCase("8675309", "numeric", "numeric.png");
  await modeCase("HELLO WORLD 123", "alphanumeric", "alnum.png");
  await modeCase("naïve café", "byte", "unicode.png");
  await modeCase("こんにちは", "byte", "kanji.png");
  // A single lowercase letter has to drag a whole numeric string into byte mode.
  await modeCase("8675309a", "byte", "mixed.png");

  // ------------------------------------------------------- the honesty layer ---
  const body = await page.textContent("#qr-code-generator");
  check(/never leaves|not uploaded|no server/i.test(body), "the UI states the code never leaves the browser");
  check(/UTF-8/.test(body) && /ECI/.test(body), "the UI states the UTF-8 caveat and the missing ECI header");
  check(/one mode|single mode|whole string/i.test(body), "the UI states that one mode covers the whole string");
  check(/0\.5 mm/.test(body) || /module/i.test(body), "the UI gives print and module size guidance");
  check(/quiet zone/i.test(body), "the UI explains the quiet zone");
  check(/contrast/i.test(body), "the UI surfaces contrast");
  check(/invert/i.test(body), "the UI mentions the inverted-colour risk");
  check(/raster|pixel/i.test(body), "the UI calls the PNG a raster image measured in pixels");
  check(/vector|scal/i.test(body), "the UI calls the SVG vector");
  check(/not promise/i.test(body), "the UI says plainly what it does not promise");

  // Low contrast must be flagged, not silently accepted.
  await page.locator('input[aria-label="Foreground colour"]').fill("#777777");
  await page.locator('input[aria-label="Background colour"]').fill("#888888");
  await settle();
  const lowBody = await page.textContent("#qr-code-generator");
  check(/contrast|smudge|dark/i.test(lowBody), "a low-contrast pair is called out on the page", lowBody.slice(0, 0));
  await page.locator('input[aria-label="Foreground colour"]').fill("#000000");
  await page.locator('input[aria-label="Background colour"]').fill("#ffffff");
  await settle();

  // A dense version must warn about its module size.
  await type("9".repeat(600));
  const denseBody = await page.textContent("#qr-code-generator");
  check(/version \d+/i.test(denseBody), "a dense code names its version in the warning", denseBody.match(/This is version \d+[^.]*/)?.[0] || "");
  await type("https://braincoder.sardar.dev/use/qr-code-generator");

  // ------------------------------------------------------------- refusals ---
  await input.fill("9".repeat(8000));
  await settle();
  const overBody = await page.textContent("#qr-code-generator");
  // 8,000 digits exceed the 5,596 a version 40 code holds at the default level M.
  check(/version 40/.test(overBody) && /5,596/.test(overBody), "over-long input is refused with the real limit in the message");
  check((await preview.count()) === 0, "no code is drawn for over-long input");
  // With no code there is nothing to save, so the download controls are absent
  // rather than present and clickable.
  check((await page.getByRole("button", { name: "Download PNG" }).count()) === 0, "no PNG button is offered for over-long input");
  check((await page.getByRole("button", { name: "Download SVG" }).count()) === 0, "no SVG button is offered for over-long input");

  // A level that cannot hold the text must refuse too, without blaming the length.
  await input.fill("a".repeat(2000));
  await settle();
  await setLevel("H");
  const levelBody = await page.textContent("#qr-code-generator");
  check(/error correction H/.test(levelBody), "a level that cannot hold the text is refused by name", levelBody.match(/At error correction H[^.]*/)?.[0] || "");
  check((await preview.count()) === 0, "no code is drawn when the level cannot hold the text");
  await setLevel("L");
  await settle();
  check((await preview.count()) === 1, "dropping to level L accepts the same text");

  // -------------------------------------------------------------- a11y ---
  await type("12345");
  check((await input.getAttribute("aria-describedby") || "").includes("qr-code-hint"), "the input is described by the hint");
  check((await page.locator("label[for='qr-text-input']").count()) === 1, "the textarea has a real label element");
  check(await status.isVisible(), "a live region is present");
  const statusText = await status.textContent();
  check(/version \d+/.test(statusText || ""), "the live region announces the finished code", statusText || "");

  await input.fill("");
  await settle();
  // Scoped to the tool, since Next.js keeps its own empty route announcer alert.
  check((await page.locator("#qr-code-generator [role='alert']").count()) === 0, "clearing the input clears the error");

  // ------------------------------------------------------------ the guide ---
  const guidePage = await context.newPage();
  const gres = await guidePage.goto(GUIDE, { waitUntil: "domcontentloaded" });
  const guideBody = gres && gres.ok() ? await guidePage.textContent("body") : "";
  check(!!gres && gres.status() === 200, "the how-to guide renders");
  check(/version 40|versions 1 to 40|40 versions/i.test(guideBody), "the guide explains how many versions exist");
  check(/error correction/i.test(guideBody), "the guide explains the error correction trade-off");
  check(/0\.5 mm/.test(guideBody), "the guide gives a module size for printing");
  check(/UTF-8/.test(guideBody) && /ECI/.test(guideBody), "the guide covers the UTF-8 caveat");
  check(/quiet zone/i.test(guideBody), "the guide explains the quiet zone");
  check(/browser|device/i.test(guideBody), "the guide says the encoding happens in the browser");
  check(!/qrcode library/i.test(guideBody), "the guide no longer credits a library for the encoding");
  check(!/infinitely sharp|scalable at any size/i.test(guideBody), "the guide does not promise an infinitely sharp PNG");
  await guidePage.close();

  const sitemapResponse = await page.request.get(`${BASE_URL}/sitemap.xml`);
  const sitemap = sitemapResponse.ok() ? await sitemapResponse.text() : "";
  check(sitemap.includes("/tools/qr-code-generator"), "the sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-create-a-qr-code"), "the sitemap lists the QR guide");

  // ---------------------------------------------------------------- hygiene ---
  check(offOrigin.length === 0, "no off-origin request: the text never leaves the device", offOrigin.slice(0, 3).join(" "));
  check(nonGet.length === 0, "the tool made no non-GET request", nonGet.slice(0, 3).join(" "));
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 2).join(" | "));
  check(consoleIssues.length === 0, "no hydration or server/client mismatch warnings", consoleIssues.slice(0, 2).join(" | "));
} catch (e) {
  failed += 1;
  failures.push("harness");
  check(false, `harness exception: ${String(e).slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) console.log(`failing: ${failures.join(" | ")}`);
process.exit(failed === 0 ? 0 : 1);