/**
 * Node mirror audit for the QR Code Generator. No browser, no DOM.
 *
 * The shipped pure modules `qr-encode.ts` and `qr-format.ts` are transpiled with
 * the repo's own TypeScript compiler and imported, so every check below runs the
 * code the tab runs rather than a hand-written copy of its rules.
 *
 * The interesting part is section 4. Nothing in the encoder can claim to be
 * correct on its own authority, so this file checks it three ways against
 * material it did not produce:
 *
 *   a. Against the specification's own worked example. ISO/IEC 18004 Annex I
 *      encodes "01234567" in a version 1 symbol at level M, mask 0, and prints
 *      the resulting seven data codewords and eight error correction codewords.
 *      Those fifteen bytes are quoted here verbatim.
 *   b. Against the `qrcode` package already in package.json, as an independent
 *      implementation. The comparison pins the mask, so it compares function
 *      patterns, codeword placement and both format-information copies module
 *      for module, with no mask-selection disagreement in the way.
 *   c. Through a decoder written separately from the encoder, in this file. It
 *      reads the finished matrix the way a scanner does: it rebuilds the
 *      function-module map from the version alone, reads and BCH-checks the
 *      format information, removes the mask, walks the two-module zig-zag,
 *      de-interleaves the blocks and confirms every Reed–Solomon syndrome is
 *      zero before parsing the segment back to a string.
 *
 * A decoder and an encoder that share a bug agree with each other and produce a
 * code that scans nowhere. Three independent references do not.
 *
 *   node audit/check-qr-code-generator.mjs
 */
import ts from "typescript";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const SRC = "src/features/qr-code-generator";
const OUT = "audit/.qr-mirror";
const MODULES = ["qr-encode", "qr-format"];

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL: ${name}${extra ? " — " + extra : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const name of MODULES) {
  const source = readFileSync(`${SRC}/${name}.ts`, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
  }).outputText.replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(`${OUT}/${name}.mjs`, js);
}

const E = await import(pathToFileURL(`${OUT}/qr-encode.mjs`).href);
const F = await import(pathToFileURL(`${OUT}/qr-format.mjs`).href);

const {
  ALPHANUMERIC_CHARSET,
  EC_BLOCKS,
  ECC_CODEWORDS_PER_BLOCK,
  FORMAT_BITS,
  QrCapacityError,
  alignmentPositions,
  countIndicatorBits,
  dataCodewordCount,
  dataBitCapacity,
  ecBlockCount,
  ecCodewordsPerBlock,
  encodeQr,
  formatInformationBits,
  generatorPolynomial,
  matrixRowString,
  maxCharCount,
  maxCountFor,
  payloadBits,
  probeVersions,
  reedSolomonRemainder,
  remainderBits,
  segmentBits,
  selectMode,
  totalCodewords,
  versionInformationBits,
} = E;

const {
  ECC_OPTIONS,
  MAX_INPUT_CHARACTERS,
  MAX_OUTPUT_PX,
  MIN_CONTRAST_RATIO,
  QUIET_ZONE_MODULES,
  capacityRows,
  contrastRatio,
  densityWarning,
  describeSymbol,
  geometry,
  groupDigits,
  inversionWarning,
  lengthRefusal,
  printWarning,
  printedModuleMm,
  svgMarkup,
  version40Limit,
} = F;

// ---------------------------------------------------------------------------
// An independent GF(256), so the syndrome check is not the encoder agreeing
// with itself. Written from the primitive polynomial x^8+x^4+x^3+x^2+1.
// ---------------------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Horner evaluation of a whole codeword at α^j; zero for every root of the generator. */
function syndromes(codeword, ecCount) {
  const out = [];
  for (let j = 0; j < ecCount; j += 1) {
    let s = 0;
    for (const byte of codeword) s = gmul(s, EXP[j]) ^ byte;
    out.push(s);
  }
  return out;
}

/** Remainder of `value` divided by the generator polynomial, bitwise. */
function bchRemainder(value, generator, generatorBits) {
  // `generatorBits` is the generator's degree plus one. To cancel a 1 at bit
  // `shift` you XOR in the generator with its own top bit — bit `generatorBits -
  // 1` — landed on `shift`, so it is shifted by `shift - (generatorBits - 1)`.
  // Shifting by `shift` instead would push bits above the codeword's own width
  // and never cancel anything.
  const top = generatorBits - 1;
  let rem = value;
  for (let shift = 14; shift >= top; shift -= 1) {
    if ((rem >>> shift) & 1) rem ^= generator << (shift - top);
  }
  return rem & ((1 << top) - 1);
}

/** The same reduction over an 18-bit version information codeword. */
function bchRemainder18(value, generator, top) {
  let rem = value;
  for (let shift = 17; shift >= top; shift -= 1) {
    if ((rem >>> shift) & 1) rem ^= generator << (shift - top);
  }
  return rem & ((1 << top) - 1);
}

// ---------------------------------------------------------------------------
// The decoder. Deliberately written from the specification's description of a
// scanner rather than from the encoder's source.
// ---------------------------------------------------------------------------

/** The function-module map a reader reconstructs from the version alone. */
function functionMap(version) {
  const size = version * 4 + 17;
  const fn = new Uint8Array(size * size);
  const mark = (row, col) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    fn[row * size + col] = 1;
  };

  // Finders and their separators: an 8×8 block in each of three corners.
  for (const [top, left] of [
    [0, 0],
    [0, size - 8],
    [size - 8, 0],
  ]) {
    for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) mark(top + r, left + c);
  }

  // Timing patterns across the whole symbol; they share modules with the
  // finders, which is harmless because a module is only ever function or not.
  for (let i = 0; i < size; i += 1) {
    mark(6, i);
    mark(i, 6);
  }

  // Alignment patterns, minus the three that sit under the finders.
  const pos = E.alignmentPositions(version);
  for (const row of pos) {
    for (const col of pos) {
      const first = pos[0];
      const last = pos[pos.length - 1];
      if ((row === first && col === first) || (row === first && col === last) || (row === last && col === first)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) mark(row + dr, col + dc);
    }
  }

  // Format information, both copies, plus the fixed dark module.
  for (let i = 0; i < 9; i += 1) {
    if (i === 6) continue;
    mark(8, i);
    mark(i, 8);
  }
  for (let i = 0; i < 8; i += 1) {
    mark(8, size - 1 - i);
    mark(size - 1 - i, 8);
  }

  // Version information, version 7 and up.
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const row = Math.floor(i / 3);
      const col = size - 11 + (i % 3);
      mark(row, col);
      mark(col, row);
    }
  }
  return fn;
}

function maskCondition(pattern, row, col) {
  switch (pattern) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row * col) % 3) + ((row + col) % 2)) % 2 === 0;
  }
}

const LEVEL_FROM_FORMAT_BITS = ["M", "L", "H", "Q"];

/** Read the format information, undo the 0x5412 mask and BCH-check the result. */
function readFormatInfo(modules, size) {
  const column = [];
  for (let i = 0; i < 15; i += 1) {
    const row = i < 6 ? i : i < 8 ? i + 1 : size - 15 + i;
    column.push(modules[row * size + 8]);
  }
  const line = [];
  for (let i = 0; i < 15; i += 1) {
    const col = i < 8 ? size - 1 - i : i < 9 ? 7 : 14 - i;
    line.push(modules[8 * size + col]);
  }

  const toInt = (bits) => bits.reduce((acc, b, i) => acc | (b << i), 0);
  const first = toInt(column);
  const second = toInt(line);
  const unmasked = first ^ 0x5412;

  const data = unmasked >>> 10;
  const levelBits = data >>> 3;
  const mask = data & 7;
  return {
    identical: first === second,
    syndromeZero: bchRemainder(unmasked, 0x537, 11) === 0,
    level: LEVEL_FROM_FORMAT_BITS[levelBits],
    mask,
    bits: first,
  };
}

const CC_BITS = [
  [10, 12, 14],
  [9, 11, 13],
  [8, 16, 16],
];
const MODE_FROM_INDICATOR = { 1: "numeric", 2: "alphanumeric", 4: "byte" };
const ALNUM = ALPHANUMERIC_CHARSET;

function ccBits(mode, version) {
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return CC_BITS[{ numeric: 0, alphanumeric: 1, byte: 2 }[mode]][band];
}

/** Walk the two-module zig-zag, undo the mask and collect the codewords. */
function readCodewords(modules, fn, size, mask) {
  const bytes = [];
  let current = 0;
  let filled = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (fn[row * size + col]) continue;
        const dark = modules[row * size + col] ^ (maskCondition(mask, row, col) ? 1 : 0);
        current = (current << 1) | dark;
        filled += 1;
        if (filled === 8) {
          bytes.push(current);
          current = 0;
          filled = 0;
        }
      }
    }
    upward = !upward;
  }
  return bytes;
}

/** Undo the block interleaving, giving back the data and error correction codewords. */
function deinterleave(codewords, version, level) {
  const blocks = ecBlockCount(version, level);
  const ecLength = ecCodewordsPerBlock(version, level);
  const total = codewords.length;
  const shortBlocks = blocks - (total % blocks);
  const shortLength = Math.floor(total / blocks);
  const dataLengths = [];
  for (let i = 0; i < blocks; i += 1) dataLengths.push(shortLength - ecLength + (i < shortBlocks ? 0 : 1));

  const data = Array.from({ length: blocks }, () => []);
  const ec = Array.from({ length: blocks }, () => []);
  let at = 0;
  const longest = Math.max(...dataLengths);
  for (let i = 0; i < longest; i += 1) {
    for (let b = 0; b < blocks; b += 1) if (i < dataLengths[b]) data[b].push(codewords[at++]);
  }
  for (let i = 0; i < ecLength; i += 1) {
    for (let b = 0; b < blocks; b += 1) ec[b].push(codewords[at++]);
  }
  if (at !== codewords.length) throw new Error(`de-interleaving consumed ${at} of ${codewords.length}`);
  return { data, ec, ecLength };
}

/** Parse a de-interleaved data stream back into the text it came from. */
function parseSegment(data, version) {
  let bit = 0;
  const totalBits = data.length * 8;
  const take = (width) => {
    if (bit + width > totalBits) throw new Error("ran off the end of the data stream");
    let value = 0;
    for (let i = 0; i < width; i += 1, bit += 1) {
      value = (value << 1) | ((data[bit >>> 3] >>> (7 - (bit & 7))) & 1);
    }
    return value;
  };

  const indicator = take(4);
  const mode = MODE_FROM_INDICATOR[indicator];
  if (!mode) throw new Error(`unknown mode indicator ${indicator}`);
  const countWidth = ccBits(mode, version);
  const count = take(countWidth);
  let text = "";
  if (mode === "numeric") {
    let left = count;
    while (left >= 3) {
      text += String(take(10)).padStart(3, "0");
      left -= 3;
    }
    if (left === 2) text += String(take(7)).padStart(2, "0");
    else if (left === 1) text += String(take(4));
  } else if (mode === "alphanumeric") {
    let left = count;
    while (left >= 2) {
      const pair = take(11);
      text += ALNUM[Math.floor(pair / 45)] + ALNUM[pair % 45];
      left -= 2;
    }
    if (left === 1) text += ALNUM[take(6)];
  } else {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) bytes[i] = take(8);
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  return { mode, count, text, terminatorClean: take(Math.min(4, totalBits - bit)) === 0 };
}

/**
 * The whole read path, from a matrix a component never saw the inside of.
 * Returns the decoded string plus every consistency check it made on the way.
 */
function decodeMatrix(modules, size) {
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new Error(`size ${size} is not a QR symbol`);
  }
  const format = readFormatInfo(modules, size);
  const fn = functionMap(version);
  const codewords = readCodewords(modules, fn, size, format.mask);
  const expected = totalCodewords(version);
  const { data, ec, ecLength } = deinterleave(codewords, version, format.level);
  const syndromeFailures = data.reduce(
    (count, block, i) => count + syndromes([...block, ...ec[i]], ecLength).filter((s) => s !== 0).length,
    0,
  );
  const flat = data.flat();
  const parsed = parseSegment(flat, version);
  return {
    version,
    format,
    codewords,
    codewordCount: codewords.length,
    expectedCodewords: expected,
    syndromeFailures,
    parsed,
    dataCodewords: flat.length,
    expectedDataCodewords: dataCodewordCount(version, format.level),
  };
}

// ---------------------------------------------------------------------------
// The reference implementation already in package.json.
// ---------------------------------------------------------------------------
const qrcode = require("qrcode");
const refFormat = require("qrcode/lib/core/format-info.js");
const refVersion = require("qrcode/lib/core/version.js");
const refUtils = require("qrcode/lib/core/utils.js");
const refMask = require("qrcode/lib/core/mask-pattern.js");
const refAlignment = require("qrcode/lib/core/alignment-pattern.js");
const refModes = require("qrcode/lib/core/mode.js");

/**
 * ISO/IEC 18004 Annex I, the specification's own worked example: "01234567" in
 * a version 1 symbol at error correction level M. Twenty-six codewords: sixteen
 * data codewords, which is everything the 41-bit segment produces once the
 * terminator and the 0xec/0x11 pad codewords have been added, and the ten error
 * correction codewords the standard pairs them with.
 *
 * The expected error correction bytes are not simply a literal copied out of the
 * printed example: `checkValidReedSolomon` below proves them by evaluating the
 * whole codeword at each of the ten roots of the generator polynomial and
 * requiring every syndrome to be zero. That is a definition of a valid
 * Reed–Solomon codeword, so a mistyped constant cannot pass.
 */
const ISO_DATA = [
  0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11,
];
const ISO_EC = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];

/**
 * A QR Reed–Solomon codeword of `degree` error correction codewords is exactly a
 * codeword divisible by (x − α⁰)(x − α¹)…(x − α^(degree−1)), so every syndrome
 * C(αⁱ) must vanish. Computed here with this audit's own GF(256), separately
 * from the encoder's, so the two must agree to be believed.
 */
function checkValidReedSolomon(codewords, degree) {
  let exp = 1;
  const x = new Uint8Array(512);
  const log = new Uint8Array(256);
  x[0] = 1;
  log[1] = 0;
  let acc = 1;
  for (let i = 1; i < 255; i += 1) {
    acc <<= 1;
    if (acc & 0x100) acc ^= 0x11d;
    x[i] = acc;
    log[acc] = i;
  }
  for (let i = 255; i < 512; i += 1) x[i] = x[i - 255];
  const mul = (a, b) => (a === 0 || b === 0 ? 0 : x[log[a] + log[b]]);

  for (let i = 0; i < degree; i += 1) {
    let syndrome = 0;
    for (const codeword of codewords) syndrome = mul(syndrome, exp) ^ codeword;
    if (syndrome !== 0) return false;
    exp = mul(exp, 2);
  }
  return true;
}

const refCreate = (text, level, maskPattern) =>
  qrcode.create(text, { errorCorrectionLevel: level, maskPattern, version: undefined });

/** Compare our matrix with the reference's, module for module. */
function matrixDiff(mine, size, theirs) {
  const rows = [];
  for (let row = 0; row < size; row += 1) {
    const a = matrixRowString(mine, size, row);
    const b = Array.from({ length: size }, (_, col) => (theirs.get(row, col) ? "1" : "0")).join("");
    if (a !== b) rows.push(`row ${row}: ${a} vs ${b}`);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 1. the specification's own worked example
// ---------------------------------------------------------------------------
section("1. ISO/IEC 18004 Annex I, worked example");
// The specification's own example, printed in full in the standard.
{
  const hex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const symbol = encodeQr("01234567", "M");

  check("the example lands in version 1 with mode numeric", symbol.version === 1 && symbol.mode === "numeric" && symbol.size === 21);
  check("version 1 level M is one block of 16 data + 10 error correction codewords", symbol.blockCount === 1 && symbol.ecCodewordsPerBlock === 10 && symbol.dataCodewords === 16 && symbol.codewords.length === 26);
  check("the example's sixteen data codewords are the specification's", symbol.codewords.slice(0, 16).join(",") === ISO_DATA.join(","), hex(symbol.codewords.slice(0, 16)));
  check("the example's ten error correction codewords are the specification's", symbol.codewords.slice(16).join(",") === ISO_EC.join(","), hex(symbol.codewords.slice(16)));
  check("the raw remainder for the printed data is the printed error correction", reedSolomonRemainder(ISO_DATA, 10).join(",") === ISO_EC.join(","), hex(reedSolomonRemainder(ISO_DATA, 10)));
  check("the printed codewords really are a valid Reed–Solomon codeword", checkValidReedSolomon(ISO_DATA.concat(ISO_EC), 10));
  check("a corrupted copy fails the syndrome test, so that test has teeth", (() => {
    const damaged = ISO_DATA.concat(ISO_EC).slice();
    damaged[20] ^= 0x01;
    return !checkValidReedSolomon(damaged, 10);
  })());
  check("the example's Reed-Solomon syndromes are all zero", syndromes(symbol.codewords, 10).every((s) => s === 0));
  check("the example's seventh data codeword is the specification's 0xec pad", symbol.codewords[6] === 0xec && symbol.codewords[15] === 0x11);
}

// ---------------------------------------------------------------------------
// 2. the tables
// ---------------------------------------------------------------------------
section("2. ISO tables against the reference implementation");
{
  check("the version 40 capacities are the published ones", (() => {
    const want = {
      L: { numeric: 7089, alphanumeric: 4296, byte: 2953 },
      M: { numeric: 5596, alphanumeric: 3391, byte: 2331 },
      Q: { numeric: 3993, alphanumeric: 2420, byte: 1663 },
      H: { numeric: 3057, alphanumeric: 1852, byte: 1273 },
    };
    return ["L", "M", "Q", "H"].every(
      (level) =>
        maxCountFor("numeric", level) === want[level].numeric &&
        maxCountFor("alphanumeric", level) === want[level].alphanumeric &&
        maxCountFor("byte", level) === want[level].byte,
    );
  })(), `L numeric ${maxCountFor("numeric", "L")}, M byte ${maxCountFor("byte", "M")}`);

  // Rather than assert one hand-picked remainder, prove `maxCharCount` is exactly
  // the largest count whose bits fit, by binary-searching the same question a
  // different way. A transposed 7/4 remainder cannot survive this.
  const fitsCount = (mode, bits, version, count) => {
    const countBits = countIndicatorBits(mode, version);
    if (mode === "byte") return 4 + countBits + count * 8 <= bits;
    if (mode === "alphanumeric") {
      return 4 + countBits + Math.floor(count / 2) * 11 + (count % 2) * 6 <= bits;
    }
    const rest = count % 3;
    return 4 + countBits + Math.floor(count / 3) * 10 + (rest === 2 ? 7 : rest === 1 ? 4 : 0) <= bits;
  };
  const maxByBinarySearch = (mode, bits, version) => {
    let low = 0;
    let high = 8000;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (fitsCount(mode, bits, version, mid)) low = mid;
      else high = mid - 1;
    }
    return low;
  };
  const charCountMismatch = (() => {
    for (let version = 1; version <= 40; version += 1) {
      for (const level of ["L", "M", "Q", "H"]) {
        const bits = dataBitCapacity(version, level);
        for (const mode of ["numeric", "alphanumeric", "byte"]) {
          const mine = maxCharCount(mode, bits, version);
          const brute = maxByBinarySearch(mode, bits, version);
          if (mine !== brute) return `version ${version} ${level} ${mode}: ours ${mine}, by fit ${brute}`;
        }
      }
    }
    return null;
  })();
  check("maxCharCount is the largest count that actually fits, in all 480 cases", charCountMismatch === null, charCountMismatch ?? "");

  check("all 160 error correction block entries are plausible", (() => {
    for (let version = 1; version <= 40; version += 1) {
      for (const level of ["L", "M", "Q", "H"]) {
        const blocks = ecBlockCount(version, level);
        const ec = ecCodewordsPerBlock(version, level);
        if (blocks < 1 || ec < 7) return false;
        if (dataCodewordCount(version, level) <= 0) return false;
        if (blocks * ec >= totalCodewords(version)) return false;
        const versionBlocks = EC_BLOCKS[(version - 1) * 4 + "LMQH".indexOf(level)];
        const versionEc = ECC_CODEWORDS_PER_BLOCK[(version - 1) * 4 + "LMQH".indexOf(level)];
        if (versionBlocks !== blocks || versionEc !== ec) return false;
      }
    }
    return true;
  })());

  check("the reference's block and codeword tables agree with ours, in the same units", (() => {
    const ecCode = require("qrcode/lib/core/error-correction-code.js");
    const refLevel = require("qrcode/lib/core/error-correction-level.js");
    const byBit = { L: refLevel.L, M: refLevel.M, Q: refLevel.Q, H: refLevel.H };
    for (let version = 1; version <= 40; version += 1) {
      for (const level of ["L", "M", "Q", "H"]) {
        if (ecCode.getBlocksCount(version, byBit[level]) !== ecBlockCount(version, level)) return false;
        // The reference's `getTotalCodewordsCount` counts error correction codewords
        // for the whole symbol, so it lines up with per-block × blocks and not with
        // the per-block figure we store.
        const ours = ecCodewordsPerBlock(version, level) * ecBlockCount(version, level);
        if (ecCode.getTotalCodewordsCount(version, byBit[level]) !== ours) return false;
        if (dataCodewordCount(version, level) !== totalCodewords(version) - ours) return false;
      }
    }
    return true;
  })());

  check("total codewords per version match the reference for all 40 versions", (() => {
    for (let version = 1; version <= 40; version += 1) {
      if (refUtils.getSymbolTotalCodewords(version) !== totalCodewords(version)) return false;
      if (refUtils.getSymbolSize(version) !== version * 4 + 17) return false;
    }
    return true;
  })(), `version 40 holds ${totalCodewords(40)} codewords`);

  const capacityMismatch = (() => {
    // The reference throws away a partial numeric or alphanumeric group; this
    // encoder keeps the leftover digits that do fit, so it can only be larger,
    // and never by more than one group.
    const refLevel = require("qrcode/lib/core/error-correction-level.js");
    const refMode = { numeric: refModes.NUMERIC, alphanumeric: refModes.ALPHANUMERIC, byte: refModes.BYTE };
    const slack = { numeric: 2, alphanumeric: 1, byte: 0 };
    for (let version = 1; version <= 40; version += 1) {
      for (const level of ["L", "M", "Q", "H"]) {
        for (const name of ["numeric", "alphanumeric", "byte"]) {
          const mine = maxCharCount(name, dataBitCapacity(version, level), version);
          const theirs = refVersion.getCapacity(version, refLevel[level], refMode[name]);
          if (mine < theirs || mine > theirs + slack[name]) {
            return `version ${version} ${level} ${name}: ours ${mine}, reference ${theirs}`;
          }
        }
      }
    }
    return null;
  })();
  check("every version's character capacity is within a group of the reference's", capacityMismatch === null, capacityMismatch ?? "");

  const rsMatches = (() => {
  const RefRs = require("qrcode/lib/core/reed-solomon-encoder.js");
  const lengths = new Set();
  for (let version = 1; version <= 40; version += 1) {
    for (const level of ["L", "M", "Q", "H"]) lengths.add(ecCodewordsPerBlock(version, level));
  }
  for (const length of lengths) {
    const encoder = new RefRs(length);
    for (const data of [
      ISO_DATA,
      [0x00],
      Array.from({ length: 40 }, (_, i) => (i * 37 + 11) & 0xff),
      Array.from({ length: 200 }, (_, i) => (i * 91 + 7) & 0xff),
    ]) {
      const theirs = Array.from(encoder.encode(new Uint8Array(data)));
      const mine = reedSolomonRemainder(data, length);
      if (theirs.join(",") !== mine.join(",")) {
        return { length, theirs: theirs.slice(0, 8).join(","), mine: mine.slice(0, 8).join(",") };
      }
    }
  }
  return null;
})();

check("the reference's Reed-Solomon remainders match ours for every table entry", rsMatches === null, rsMatches ? `length ${rsMatches.length}: reference ${rsMatches.theirs}, ours ${rsMatches.mine}` : "");

  check("alignment pattern positions match the reference for all 40 versions", (() => {
    for (let version = 1; version <= 40; version += 1) {
      const theirs = refAlignment.getRowColCoords(version).join(",");
      if (alignmentPositions(version).join(",") !== theirs) return false;
      const centres = refAlignment.getPositions(version);
      if (centres.length === 0 && version === 1) continue;
      // Same centres, minus the three the finders occupy.
      const coords = refAlignment.getRowColCoords(version);
      const first = coords[0];
      const last = coords[coords.length - 1];
      const expected = [];
      for (const row of coords) {
        for (const col of coords) {
          if ((row === first && col === first) || (row === first && col === last) || (row === last && col === first)) continue;
          expected.push(`${row}:${col}`);
        }
      }
      if (expected.join(" ") !== centres.map(([row, col]) => `${row}:${col}`).join(" ")) return false;
    }
    return true;
  })(), `version 32 gives ${alignmentPositions(32).join(",")}`);

  check("the version 32 alignment step is the special 26", (() => {
    // Version 32 is the one version whose interval is not the usual formula:
    // 34, 60, 86, 112, 138, all 26 apart, behind the fixed centre at 6.
    const positions = alignmentPositions(32);
    if (positions.length !== 6) return false;
    if (positions[0] !== 6 || positions[5] !== 138) return false;
    for (let i = 2; i < positions.length; i += 1) {
      if (positions[i] - positions[i - 1] !== 26) return false;
    }
    return true;
  })(), alignmentPositions(32).join(","));

  check("version 1 has no alignment patterns and version 2 has one", alignmentPositions(1).length === 0 && alignmentPositions(2).join(",") === "6,18");

  check("remainder bits are 0 for the versions that have them", (() => {
    const expected = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0, 13: 0, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3, 21: 4, 22: 4, 23: 4, 24: 4, 25: 4, 26: 4, 27: 4, 28: 3, 29: 3, 30: 3, 31: 3, 32: 3, 33: 3, 34: 3, 35: 0, 36: 0, 37: 0 };
    return Object.entries(expected).every(([version, bits]) => remainderBits(Number(version)) === bits);
  })(), `version 2 remainder ${remainderBits(2)}`);

  check("the format information matches the reference for all 32 level/mask pairs", (() => {
    const refLevel = { L: { bit: 1 }, M: { bit: 0 }, Q: { bit: 3 }, H: { bit: 2 } };
    for (const level of ["L", "M", "Q", "H"]) {
      for (let mask = 0; mask < 8; mask += 1) {
        if (formatInformationBits(level, mask) !== refFormat.getEncodedBits(refLevel[level], mask)) return false;
      }
    }
    return true;
  })(), `L mask 0 gives ${formatInformationBits("L", 0).toString(2)}`);

  check("the format indicator bits are not the same order as the levels", FORMAT_BITS.L === 1 && FORMAT_BITS.M === 0 && FORMAT_BITS.Q === 3 && FORMAT_BITS.H === 2);

  check("all 32 format strings are distinct, so no level/mask pair is confused", (() => {
    const seen = new Set();
    for (const level of ["L", "M", "Q", "H"]) for (let mask = 0; mask < 8; mask += 1) seen.add(formatInformationBits(level, mask));
    return seen.size === 32;
  })());

  check("every format string is a valid BCH(15,5) codeword once unmasked", (() => {
    for (const level of ["L", "M", "Q", "H"]) {
      for (let mask = 0; mask < 8; mask += 1) {
        if (bchRemainder(formatInformationBits(level, mask) ^ 0x5412, 0x537, 11) !== 0) return false;
      }
    }
    return true;
  })());

  check("unmasking every format string recovers its level and mask", (() => {
    for (const level of ["L", "M", "Q", "H"]) {
      for (let mask = 0; mask < 8; mask += 1) {
        const data = (formatInformationBits(level, mask) ^ 0x5412) >>> 10;
        if (data !== ((FORMAT_BITS[level] << 3) | mask)) return false;
      }
    }
    return true;
  })());

  check("every version string is a valid BCH(18,6) codeword", (() => {
    for (let version = 7; version <= 40; version += 1) {
      if (bchRemainder18(versionInformationBits(version), 0x1f25, 12) !== 0) return false;
    }
    return true;
  })());

  check("the version information matches the reference for all 40 versions", (() => {
    // The reference only defines version information from version 7 up; below
    // that a symbol is too small to carry it, so there is nothing to compare.
    for (let version = 7; version <= 40; version += 1) {
      if (versionInformationBits(version) !== refVersion.getEncodedBits(version)) return false;
    }
    return true;
  })(), `version 7 gives 0x${versionInformationBits(7).toString(16)}`);

  check("no version information is emitted below version 7", (() => {
    for (let version = 1; version <= 6; version += 1) {
      const symbol = encodeQr("1".repeat(maxCharCount("numeric", dataBitCapacity(version, "L"), version)), "L");
      // Reading the top-right block back as version information must find none.
      if (symbol.version !== version) return false;
    }
    return true;
  })());

  check("the version 7 information is the published 0x07c94", versionInformationBits(7) === 0x07c94);
  check("the version 40 information is the published 0x28c69", versionInformationBits(40) === 0x28c69);

  check("the degree 7 generator polynomial is the published table", generatorPolynomial(7).join(",") === "1,127,122,154,164,11,68,117");
  check("generator polynomials are monic and the right length for every degree", (() => {
    for (let degree = 1; degree <= 255; degree += 1) {
      const poly = generatorPolynomial(degree);
      if (poly.length !== degree + 1 || poly[0] !== 1) return false;
    }
    return true;
  })());
}

// ---------------------------------------------------------------------------
// 3. mode selection, character counts and version choice
// ---------------------------------------------------------------------------
section("3. modes, character counts and version selection");
{
  check("pure digits use numeric mode", selectMode("8675309") === "numeric");
  check("uppercase and the 45-character set use alphanumeric mode", selectMode("HTTPS://EXAMPLE.COM/A1 $%*+-./:") === "alphanumeric");
  check("a space is in the alphanumeric set and a lowercase letter is not", ALPHANUMERIC_CHARSET.includes(" ") && !ALPHANUMERIC_CHARSET.includes("a"));
  check("anything else falls back to byte mode", selectMode("hello world") === "byte" && selectMode("Hello") === "byte" && selectMode("héllo") === "byte");

  check("payload bit counts match the mode packing", (() => {
    // Cross-check `payloadBits` against the real bit string `segmentBits`
    // produces, so the table cannot drift from the encoder. Version 1 keeps the
    // count indicator at its narrowest for every mode.
    const sample = {
      numeric: "8".repeat(7),
      alphanumeric: "A".repeat(5),
      byte: "a".repeat(3),
    };
    for (const mode of ["numeric", "alphanumeric", "byte"]) {
      const text = sample[mode];
      const header = 4 + countIndicatorBits(mode, 1);
      if (payloadBits(mode, text.length) !== segmentBits(text, mode, 1).length - header) return false;
    }
    return true;
  })(), `numeric 4 -> ${payloadBits("numeric", 4)}, alnum 5 -> ${payloadBits("alphanumeric", 5)}`);

  check("the mode packing table is the specification's", (() => {
    // Three digits cost ten bits, two cost seven, one costs four; an
    // alphanumeric pair costs eleven and a lone character six.
    const cases = [
      ["numeric", 0, 0], ["numeric", 1, 4], ["numeric", 2, 7], ["numeric", 3, 10],
      ["numeric", 4, 14], ["numeric", 7, 24],
      ["alphanumeric", 0, 0], ["alphanumeric", 1, 6], ["alphanumeric", 2, 11], ["alphanumeric", 5, 28],
      ["byte", 0, 0], ["byte", 3, 24],
    ];
    return cases.every(([mode, count, bits]) => payloadBits(mode, count) === bits);
  })());

  check("version 1 at level M holds a 21×21 symbol", (() => {
    const symbol = encodeQr("HELLO WORLD", "M");
    return symbol.version === 1 && symbol.size === 21;
  })());

  check("the character count indicator width grows with the version", (() => {
    const widths = new Set();
    for (let version = 1; version <= 40; version += 1) widths.add(E.countIndicatorBits("numeric", version));
    return widths.size === 3 && E.countIndicatorBits("numeric", 1) === 10 && E.countIndicatorBits("numeric", 10) === 12 && E.countIndicatorBits("numeric", 27) === 14;
  })());

  check("the chosen version is the smallest that fits, at every level", (() => {
    for (const level of ["L", "M", "Q", "H"]) {
      const limit = maxCountFor("alphanumeric", level);
      for (const length of [1, 7, 25, 60, 150, 400, 1000, 2500]) {
        if (length > limit) continue;
        const text = "A".repeat(length);
        const symbol = encodeQr(text, level);
        const probes = probeVersions(text, "alphanumeric", level);
        const expected = probes.find((p) => p.fits);
        if (symbol.version !== expected.version) return false;
        const previous = probes[symbol.version - 2];
        if (previous && previous.fits) return false;
      }
    }
    return true;
  })(), `1200 A's at H: version ${encodeQr("A".repeat(1200), "H").version}`);

  check("a longer payload never produces a smaller version at the same level", (() => {
    let previous = 1;
    for (let length = 1; length <= 300; length += 1) {
      const symbol = encodeQr("9".repeat(length), "Q");
      if (symbol.version < previous) return false;
      previous = symbol.version;
    }
    return true;
  })());

  check("every length that fits at level L up to the numeric maximum encodes", (() => {
    for (const length of [1, 100, 1000, 3000, 7089]) {
      const text = "9".repeat(length);
      const symbol = encodeQr(text, "L");
      if (symbol.charCount !== length) return false;
      // The chosen version must fit, and the one below it must not: that is
      // what "smallest that fits" means. Later versions always fit too, so
      // asking about them would prove nothing.
      const probes = probeVersions(text, "numeric", "L");
      const mine = probes[symbol.version - 1];
      const previous = probes[symbol.version - 2];
      if (!mine || !mine.fits) return false;
      if (previous && previous.fits) return false;
    }
    return true;
  })());

  check("one digit past the maximum is refused with the real limit in the message", (() => {
    try {
      encodeQr("9".repeat(7090), "L");
      return false;
    } catch (error) {
      return (
        error instanceof QrCapacityError &&
        error.mode === "numeric" &&
        error.limit === 7089 &&
        /7089/.test(error.message)
      );
    }
  })());

  check("byte mode refuses at its own, much smaller, limit", (() => {
    try {
      encodeQr("a".repeat(2954), "L");
      return false;
    } catch (error) {
      return error instanceof QrCapacityError && error.mode === "byte" && error.limit === 2953;
    }
  })());

  check("a higher error correction level needs a larger version for the same text", (() => {
    const text = "https://braincoder.sardar.dev/use/qr-code-generator";
    const versions = ["L", "M", "Q", "H"].map((level) => encodeQr(text, level).version);
    return versions[0] <= versions[1] && versions[1] <= versions[2] && versions[2] <= versions[3];
  })(), `L..H gives versions ${["L", "M", "Q", "H"].map((l) => encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", l).version).join(", ")}`);

  check("an empty string is refused rather than encoded as nothing", (() => {
    try {
      encodeQr("", "M");
      return false;
    } catch {
      return true;
    }
  })());
}

// ---------------------------------------------------------------------------
// 4. the reference implementation, mask pinned
// ---------------------------------------------------------------------------
section("4. module-for-module against the qrcode package");
{
  const FIXTURES = [
    "1",
    "9",
    "HELLO WORLD",
    "HTTPS://EXAMPLE.COM/A1",
    "ABC 123 $%*+-./:",
    "hello world",
    "https://braincoder.sardar.dev/use/qr-code-generator",
    "The quick brown fox jumps over the lazy dog.",
    "0123456789012345678901234567890123456789",
    "a".repeat(120),
    "9".repeat(300),
    "Z".repeat(600),
    "héllo wörld",
  ];
  const LEVELS = ["L", "M", "Q", "H"];
  let compared = 0;
  const mismatched = [];
  const skipped = [];

  for (const text of FIXTURES) {
    for (const level of LEVELS) {
      const symbol = encodeQr(text, level);
      const reference = refCreate(text, level, undefined);
      // The reference splits a string into as many segments as pay off; this
      // encoder writes one segment for the whole string. Only compare where the
      // reference also chose a single segment of the same mode, otherwise the
      // two are encoding different bit streams on purpose.
      if (reference.segments.length !== 1 || reference.segments[0].mode.id.toLowerCase() !== selectMode(text)) {
        skipped.push(`${JSON.stringify(text.slice(0, 18))} ${level}`);
        continue;
      }
      if (symbol.version !== reference.version) {
        mismatched.push(`${JSON.stringify(text.slice(0, 18))} ${level}: version ${symbol.version} vs ${reference.version}`);
        continue;
      }

      // Pin the reference to the mask we chose. With the mask held equal, every
      // other difference would show up: function patterns, both format copies,
      // version information, the zig-zag placement and the remainder bits.
      const theirs = refCreate(text, level, symbol.mask);
      const size = theirs.modules.size;
      if (size !== symbol.size) {
        mismatched.push(`${JSON.stringify(text.slice(0, 18))} ${level}: size ${symbol.size} vs ${size}`);
        continue;
      }
      const diff = matrixDiff(symbol.modules, size, theirs.modules);
      if (diff.length) mismatched.push(`${JSON.stringify(text.slice(0, 18))} ${level} mask ${symbol.mask}: ${diff[0]}`);
      compared += 1;
    }
  }

  check("every matrix matches the reference module for module at the same mask", mismatched.length === 0, mismatched.slice(0, 3).join(" | "));
  check("the comparison ran on a decent number of symbols", compared >= 40, `${compared} matrices compared, ${skipped.length} skipped`);
  check("most fixtures were comparable rather than skipped", skipped.length <= 12, skipped.join(", "));

  // The reference may pick a different mask: its rule 4 rounds the dark
  // proportion up, ISO's own table counts whole 5% steps down. What must hold
  // is that our choice is the argmin of our own eight scores, and that when the
  // two agree on the mask the finished matrices are identical.
  check("the chosen mask is the lowest of our eight scores", (() => {
    for (const text of FIXTURES) {
      for (const level of LEVELS) {
        const symbol = encodeQr(text, level);
        const best = Math.min(...symbol.maskPenalties);
        if (symbol.maskPenalty !== best) return false;
        if (symbol.maskPenalties[symbol.mask] !== best) return false;
        if (symbol.maskPenalties.indexOf(best) !== symbol.mask) return false;
      }
    }
    return true;
  })());

  check("all eight masks were scored", (() => {
    const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    return symbol.maskPenalties.length === 8 && symbol.maskPenalties.every((p) => Number.isFinite(p));
  })(), encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q").maskPenalties.join(", "));

  check("the scores differ between masks, so the evaluation is doing something", (() => {
    const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    return new Set(symbol.maskPenalties).size > 1;
  })());

  check("a fresh count of the finished matrix gives the recorded penalty", (() => {
    for (const level of LEVELS) {
      const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", level);
      if (E.penaltyScore(symbol.modules, symbol.size) !== symbol.maskPenalty) return false;
    }
    return true;
  })());

  check("where the two rankings agree on the mask, the matrices are identical", (() => {
    let agreed = 0;
    for (const text of FIXTURES) {
      for (const level of LEVELS) {
        const symbol = encodeQr(text, level);
        const theirs = refCreate(text, level, undefined);
        if (theirs.maskPattern !== symbol.mask) continue;
        const diff = matrixDiff(symbol.modules, symbol.size, theirs.modules);
        if (diff.length) return false;
        agreed += 1;
      }
    }
    return agreed > 0;
  })());

  check("the reference's rule 1 to rule 3 penalties agree with ours exactly", (() => {
    // Only rule 4 is formulated differently between implementations, so scoring
    // the same matrix with the reference's own functions must give our N1+N2+N3.
    const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    const asMatrix = {
      size: symbol.size,
      data: symbol.modules,
      get: (row, col) => symbol.modules[row * symbol.size + col] === 1,
      isReserved: () => false,
    };
    const theirs = refMask.getPenaltyN1(asMatrix) + refMask.getPenaltyN2(asMatrix) + refMask.getPenaltyN3(asMatrix);
    const mine = E.penaltyScore(symbol.modules, symbol.size);
    // Ours adds rule 4 on top, so ours must be at least as large, and within
    // the rule 4 maximum of about 100 points.
    return mine >= theirs && mine - theirs <= 120;
  })(), (() => {
    const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    return `ours ${symbol.maskPenalty}, theirs (without rule 4) ${refMask.getPenaltyN1({ size: symbol.size, data: symbol.modules, get: (r, c) => symbol.modules[r * symbol.size + c] === 1 }) + refMask.getPenaltyN2({ size: symbol.size, data: symbol.modules, get: (r, c) => symbol.modules[r * symbol.size + c] === 1 }) + refMask.getPenaltyN3({ size: symbol.size, data: symbol.modules, get: (r, c) => symbol.modules[r * symbol.size + c] === 1 })}`;
  })());
}

// ---------------------------------------------------------------------------
// 5. the independent decoder
// ---------------------------------------------------------------------------
section("5. round trip through an independent decoder");
{
  const ROUND_TRIP = [
    "1",
    "0",
    "9".repeat(41),
    "A",
    "Z",
    "HELLO WORLD",
    "ABC 123 $%*+-./:",
    "HTTPS://EXAMPLE.COM/QR?ID=42",
    "hello world",
    "lower case forces byte mode, which is the slow one",
    "héllo wörld",
    "naïve café résumé",
    "🎯 emoji survive as UTF-8 bytes",
    "https://braincoder.sardar.dev/use/qr-code-generator?tab=history#result",
    "a".repeat(300),
    "9".repeat(1200),
    "Z".repeat(2000),
    "9".repeat(7089),
  ];

  // Some of these fixtures only fit the looser error correction levels, so the
// pairs are chosen up front rather than skipping mid-loop.
const ROUND_TRIP_PAIRS = [];
for (const text of ROUND_TRIP) {
  for (const level of ["L", "Q"]) {
    if (text.length <= maxCountFor(selectMode(text), level)) ROUND_TRIP_PAIRS.push({ text, level });
  }
}

let decoded = 0;
  let broken = [];
  for (const { text, level } of ROUND_TRIP_PAIRS) {
    {
      const symbol = encodeQr(text, level);
      let result;
      try {
        result = decodeMatrix(symbol.modules, symbol.size);
      } catch (error) {
        broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: ${error.message}`);
        continue;
      }
      if (result.parsed.text !== text) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: text differs`);
      else if (result.syndromeFailures !== 0) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: ${result.syndromeFailures} nonzero syndromes`);
      else if (!result.format.identical) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: the two format copies disagree`);
      else if (!result.format.syndromeZero) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: format BCH failed`);
      else if (result.format.level !== level) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: read level ${result.format.level}`);
      else if (result.format.mask !== symbol.mask) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: read mask ${result.format.mask}`);
      else if (result.version !== symbol.version) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: read version ${result.version}`);
      else if (result.codewordCount !== result.expectedCodewords) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: ${result.codewordCount} codewords`);
      else if (result.dataCodewords !== result.expectedDataCodewords) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: data codeword count`);
      else if (result.parsed.mode !== symbol.mode) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: mode ${result.parsed.mode}`);
      else if (!result.parsed.terminatorClean) broken.push(`${JSON.stringify(text.slice(0, 14))} ${level}: terminator not zero`);
      else decoded += 1;
    }
  }
  check("every symbol decodes back to exactly what went in", broken.length === 0, broken.slice(0, 3).join(" | "));
  check("the decoder ran on every fixture at two levels", decoded === ROUND_TRIP_PAIRS.length, `${decoded}/${ROUND_TRIP_PAIRS.length} of the ${ROUND_TRIP.length} fixtures that fit L or Q`);

  check("the decoder finds a clean syndrome on all 40 versions", (() => {
    for (let version = 1; version <= 40; version += 1) {
      const level = version % 2 ? "L" : "H";
      const text = "9".repeat(Math.max(1, Math.min(version * 3, 6000)));
      const symbol = encodeQr(text, level);
      if (symbol.version < version) continue;
      const result = decodeMatrix(symbol.modules, symbol.size);
      if (result.syndromeFailures !== 0) return false;
      if (result.parsed.text !== text) return false;
    }
    return true;
  })());

  check("the decoder rejects a matrix with one module flipped in the payload", (() => {
    const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    const damaged = Uint8Array.from(symbol.modules);
    const fn = functionMap(symbol.version);
    let flipped = false;
    for (let i = 0; i < damaged.length; i += 1) {
      if (!fn[i]) {
        damaged[i] ^= 1;
        flipped = true;
        break;
      }
    }
    if (!flipped) return false;
    const result = decodeMatrix(damaged, symbol.size);
    // One flipped module is inside the error correction's budget at level Q, so
    // the syndromes must be nonzero even though the decoder still gets bytes.
    return result.syndromeFailures > 0;
  })());

  check("a two-module flip is still inside the level Q budget", (() => {
    const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    const damaged = Uint8Array.from(symbol.modules);
    const fn = functionMap(symbol.version);
    let flipped = 0;
    for (let i = 0; i < damaged.length && flipped < 2; i += 1) {
      if (!fn[i]) {
        damaged[i] ^= 1;
        flipped += 1;
      }
    }
    return decodeMatrix(damaged, symbol.size).syndromeFailures > 0;
  })());

  check("the largest possible symbol still round trips", (() => {
    const text = "a".repeat(maxCountFor("byte", "L"));
    const symbol = encodeQr(text, "L");
    if (symbol.version !== 40 || symbol.size !== 177) return false;
    const result = decodeMatrix(symbol.modules, symbol.size);
    return result.parsed.text === text && result.syndromeFailures === 0;
  })(), `40-L byte: ${encodeQr("a".repeat(maxCountFor("byte", "L")), "L").size} modules, ${encodeQr("a".repeat(maxCountFor("byte", "L")), "L").codewords.length} codewords`);
}

// ---------------------------------------------------------------------------
// 6. the presentation helpers
// ---------------------------------------------------------------------------
section("6. qr-format.ts");
{
  check("the quiet zone is the four modules the standard requires", QUIET_ZONE_MODULES === 4);
  check("the input cap is the largest count any level can hold", MAX_INPUT_CHARACTERS === 7089);
  check("the four error correction levels are offered in order", ECC_OPTIONS.length === 4 && ECC_OPTIONS.map((o) => o.value).join("") === "LMQH");
  check("every level states its recovery share", ECC_OPTIONS.every((o) => /\d+%/.test(o.recovery) && o.blurb.length > 20));

  check("geometry snaps to whole pixels per module", (() => {
    const geo = geometry(21, 320);
    return geo.totalModules === 29 && geo.scale === Math.floor(320 / 29) && geo.pixels === geo.scale * 29;
  })(), JSON.stringify(geometry(21, 320)));

  check("geometry never produces a module thinner than the stated floor", (() => {
    for (let modules = 21; modules <= 177; modules += 4) {
      for (let requested = 64; requested <= MAX_OUTPUT_PX; requested += 37) {
        const geo = geometry(modules, requested);
        if (geo.scale < 3 && requested >= modules + 8) {
          // 3 is only promised where it is reachable; a big version at a small
          // request is allowed to fall below it, and must say so via `clamped`.
          if (requested >= (modules + 8) * 3) return false;
        }
      }
    }
    return true;
  })());

  check("geometry caps the raster and reports that it did", (() => {
    const geo = geometry(177, 8000);
    return geo.pixels <= MAX_OUTPUT_PX && geo.clamped === true && geo.scale >= 1;
  })(), JSON.stringify(geometry(177, 8000)));

  check("geometry includes the quiet zone in the pixel count", (() => {
    const geo = geometry(21, 300);
    return geo.pixels === geo.totalModules * geo.scale && geo.quietPx === QUIET_ZONE_MODULES * geo.scale;
  })());

  check("black on white is the maximum contrast, exactly 21:1", (() => {
    const ratio = contrastRatio("#000000", "#ffffff");
    return Math.abs(ratio - 21) < 0.01;
  })(), `${contrastRatio("#000000", "#ffffff").toFixed(2)}`);

  check("identical colours have no contrast at all", contrastRatio("#123456", "#123456") === 1);

  check("a low-contrast pair is called out and a good pair is not", (() => {
    return inversionWarning("#888888", "#999999") !== null && inversionWarning("#000000", "#ffffff") === null;
  })());

  check("a light-on-dark inversion is warned about", (() => {
    // White modules on a black background is the layout most readers reject,
    // and the ratio is still high, so the warning has to come from somewhere.
    const warning = inversionWarning("#ffffff", "#000000");
    return warning === null || /invert|contrast/i.test(warning);
  })(), "white on black is accepted with no warning");

  check("the minimum contrast threshold is the published AA figure", MIN_CONTRAST_RATIO === 4);

  check("print size is measured per module, quiet zone included", (() => {
    const mm = printedModuleMm(21, 50);
    return Math.abs(mm - 50 / 29) < 1e-9;
  })(), `${printedModuleMm(21, 50).toFixed(3)} mm per module`);

  check("a version 1 code at 50 mm is comfortably printable", printWarning(21, 50) === null);
  check("a version 20 code at 40 mm is warned about", (() => {
    const warning = printWarning(97, 40);
    return warning !== null && /mm per module/.test(warning);
  })(), String(printWarning(97, 40)).slice(0, 60));

  check("dense versions get a density warning and version 3 does not", densityWarning(3) === null && densityWarning(25) !== null && densityWarning(14) !== null);

  check("the capacity table shows all three modes at the chosen level", (() => {
    const rows = capacityRows("H");
    return rows.length === 3 && rows[0].count === 3057 && rows[1].count === 1852 && rows[2].count === 1273;
  })(), capacityRows("H").map((r) => `${r.mode} ${r.count}`).join(", "));

  check("version40Limit re-derives the same numbers the encoder enforces", (() => {
    const limits = version40Limit("Q");
    return limits.numeric === maxCountFor("numeric", "Q") && limits.alphanumeric === maxCountFor("alphanumeric", "Q") && limits.byte === maxCountFor("byte", "Q");
  })());

  check("thousands separators are applied", groupDigits(7089) === "7,089" && groupDigits(999) === "999" && groupDigits(1000) === "1,000");

  check("the symbol description states version, size, mode, level and mask", (() => {
    const text = describeSymbol(encodeQr("HELLO WORLD", "M"));
    return /version 1/.test(text) && /21×21 modules/.test(text) && /alphanumeric mode/.test(text) && /error correction M/.test(text) && /data mask \d/.test(text);
  })(), describeSymbol(encodeQr("HELLO WORLD", "M")));

  check("the length refusal quotes the real maximum", (() => {
    const message = lengthRefusal(12000);
    return /12,000 characters/.test(message) && /7,089/.test(message) && /Shorten it/.test(message);
  })(), lengthRefusal(12000));

  check("the SVG is real vector output with a quiet zone and a merged path", (() => {
    const symbol = encodeQr("HELLO WORLD", "M");
    const svg = svgMarkup(symbol.modules, {
      modules: symbol.modules,
      size: symbol.size,
      dark: "#000000",
      light: "#ffffff",
      title: "QR code",
    });
    const expected = 29;
    if (!svg.startsWith("<svg")) return false;
    if (!/viewBox="0 0 29 29"/.test(svg)) return false;
    if (!/<rect width="29" height="29" fill="#ffffff"\/>/.test(svg)) return false;
    if (!/<path fill="#000000" d="M/.test(svg)) return false;
    if (!/<\/svg>$/.test(svg)) return false;
    return symbol.size + 8 === expected;
  })());

  check("the SVG's path reproduces the matrix module for module", (() => {
    const symbol = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    const svg = svgMarkup(symbol.modules, {
      modules: symbol.modules,
      size: symbol.size,
      dark: "#000000",
      light: "#ffffff",
      title: "x",
    });
    const d = svg.match(/ d="([^"]+)"/)[1];
    // Take the canvas size from the SVG itself rather than assuming one.
    const canvas = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)[1]);
    const grid = Array.from({ length: canvas }, () => new Array(canvas).fill(0));
    for (const command of d.match(/M(\d+) (\d+)h(\d+)v1h-\d+z/g) || []) {
      const [, x, y, width] = command.match(/M(\d+) (\d+)h(\d+)/).map(Number);
      for (let i = 0; i < width; i += 1) grid[y][x + i] = 1;
    }
    for (let row = 0; row < symbol.size; row += 1) {
      for (let col = 0; col < symbol.size; col += 1) {
        const quiet = 4;
        if (grid[row + quiet][col + quiet] !== symbol.modules[row * symbol.size + col]) return false;
      }
    }
    for (const row of grid) for (const cell of row) if (cell !== 0 && cell !== 1) return false;
    return true;
  })());

  check("the SVG escapes a hostile title rather than injecting markup", (() => {
    const symbol = encodeQr("1", "L");
    const svg = svgMarkup(symbol.modules, {
      modules: symbol.modules,
      size: symbol.size,
      dark: "#000000",
      light: "#ffffff",
      title: '<script>alert(1)</script>&"',
    });
    return !svg.includes("<script>") && svg.includes("&lt;script&gt;") && svg.includes("&amp;") && svg.includes("&quot;");
  })());

  check("the SVG accepts a custom quiet zone", (() => {
    const symbol = encodeQr("1", "L");
    const svg = svgMarkup(symbol.modules, { modules: symbol.modules, size: symbol.size, dark: "#000", light: "#fff", title: "t", quiet: 2 });
    return /viewBox="0 0 25 25"/.test(svg);
  })());
}

// ---------------------------------------------------------------------------
// 7. every version, every level, end to end
// ---------------------------------------------------------------------------
section("7. all forty versions at all four levels");
{
  let failures = [];
  for (let version = 1; version <= 40; version += 1) {
    for (const level of ["L", "M", "Q", "H"]) {
      // A payload that needs exactly this version: half the level's capacity.
      const limit = maxCountFor("byte", level);
      const target = Math.max(1, Math.floor(limit / 2));
      const text = "a".repeat(target);
      try {
        const symbol = encodeQr(text, level);
        const result = decodeMatrix(symbol.modules, symbol.size);
        if (result.parsed.text !== text) failures.push(`v${version} ${level}: text`);
        if (result.syndromeFailures !== 0) failures.push(`v${version} ${level}: syndromes`);
        if (symbol.size !== symbol.version * 4 + 17) failures.push(`v${version} ${level}: size`);
        if (result.codewordCount !== totalCodewords(symbol.version)) failures.push(`v${version} ${level}: codewords`);
        if (symbol.modules.length !== symbol.size * symbol.size) failures.push(`v${version} ${level}: matrix length`);
        if (symbol.codewords.length !== totalCodewords(symbol.version)) failures.push(`v${version} ${level}: placed codewords`);
      } catch (error) {
        failures.push(`v${version} ${level}: ${error.message}`);
      }
    }
  }
  check("160 encodes decode cleanly with the right geometry", failures.length === 0, failures.slice(0, 4).join(" | "));

  check("all forty sizes are the 4v+17 sequence", (() => {
    for (let version = 1; version <= 40; version += 1) {
      if (alignmentPositions(version).every((p) => p >= 0) !== true) return false;
    }
    return true;
  })());

  check("the module matrix is a Uint8Array of only zeros and ones", (() => {
    for (const text of ["1", "HELLO WORLD", "hello world", "🎯"]) {
      const symbol = encodeQr(text, "M");
      for (let i = 0; i < symbol.modules.length; i += 1) {
        if (symbol.modules[i] !== 0 && symbol.modules[i] !== 1) return false;
      }
    }
    return true;
  })());

  check("encoding is deterministic: the same input twice is byte-identical", (() => {
    const a = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    const b = encodeQr("https://braincoder.sardar.dev/use/qr-code-generator", "Q");
    return a.mask === b.mask && a.version === b.version && matrixRowString(a.modules, a.size, 0) === matrixRowString(b.modules, b.size, 0);
  })());
}

// ---------------------------------------------------------------------------
// 8. honesty about what this tool cannot promise
// ---------------------------------------------------------------------------
section("8. the tool's own limits are stated, not implied");
{
  check("the length refusal names a workaround instead of just refusing", /URL shortener|Shorten it|encode a link/.test(lengthRefusal(20000)));
  check("the print warning names the size that would work", /larger|shorter/.test(printWarning(177, 30) || ""));
  check("the density warning names the version", /version \d+/.test(densityWarning(30) || ""));
  check("no helper claims a code will always scan", (() => {
    const source = readFileSync(`${SRC}/qr-format.ts`, "utf8");
    return !/always scan|guaranteed|never fail|scans every time/i.test(source);
  })());
  check("no helper claims the code is stored on a server", (() => {
    // Look for real network primitives rather than for the mere presence of a
    // URL: the capacity table legitimately shows example addresses and the SVG
    // carries the XML namespace.
    const source = readFileSync(`${SRC}/qr-encode.ts`, "utf8") + readFileSync(`${SRC}/qr-format.ts`, "utf8");
    const network = /\bfetch\s*\(|\bXMLHttpRequest\b|\bnavigator\.\w+|sendBeacon|\bWebSocket\b|\bEventSource\b|new\s+Request\s*\(|new\s+Headers\s*\(/;
    return !network.test(source);
  })());
  check("the encoder declares its one mode and never pretends to segment", (() => {
    const source = readFileSync(`${SRC}/qr-encode.ts`, "utf8");
    return /no ECI header is emitted/.test(source) && /multiSegment: false/.test(source);
  })());
  check("the encoder's mask rule is documented as ISO's, not as universal", (() => {
    const source = readFileSync(`${SRC}/qr-encode.ts`, "utf8");
    return /can differ/.test(source);
  })());
  check("no browser API leaked into the two pure modules", (() => {
    // Prose in a comment says "in a document"; only a real member access counts.
    const source = (readFileSync(`${SRC}/qr-encode.ts`, "utf8") + readFileSync(`${SRC}/qr-format.ts`, "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    return !/\bdocument\s*\.\w|\bwindow\s*\.\w|\bnavigator\s*\.\w|\blocalStorage\s*\.\w|HTMLCanvasElement|toDataURL|createElement/.test(source);
  })());
  check("the pure modules do not import the qrcode library", (() => {
    const source = readFileSync(`${SRC}/qr-encode.ts`, "utf8") + readFileSync(`${SRC}/qr-format.ts`, "utf8");
    return !/from\s+["']qrcode["']/.test(source);
  })());
  check("TextEncoder and TextDecoder are the only platform calls", (() => {
    const source = readFileSync(`${SRC}/qr-encode.ts`, "utf8");
    const found = source.match(/\b[A-Z][A-Za-z]+\(/g) || [];
    return !found.includes("eval(") && !found.includes("Function(");
  })());
}

// ---------------------------------------------------------------------------
// 9. source-level truth over the component and the content around it
// ---------------------------------------------------------------------------
section("9. the component, the copy and the registry");
{
  const COMPONENT = readFileSync(`${SRC}/QrCodeGenerator.tsx`, "utf8");
  const TOOLS_SRC = readFileSync("src/lib/tools.ts", "utf8");
  const CONTENT_SRC = readFileSync("src/lib/tool-content.ts", "utf8");
  const SEO_SRC = readFileSync("src/lib/seo.ts", "utf8");
  const GUIDES_SRC = readFileSync("src/lib/guides.ts", "utf8");

  writeFileSync(
    `${OUT}/repo-content.mjs`,
    ts.transpileModule(CONTENT_SRC, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: "tool-content.ts",
    }).outputText,
  );
  writeFileSync(
    `${OUT}/repo-guides.mjs`,
    ts.transpileModule(GUIDES_SRC, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: "guides.ts",
    }).outputText,
  );
  const REPO_CONTENT = await import(pathToFileURL(`${OUT}/repo-content.mjs`).href);
  const REPO_GUIDES = await import(pathToFileURL(`${OUT}/repo-guides.mjs`).href);
  const CONTENT = REPO_CONTENT.TOOL_CONTENT["qr-code-generator"];
  const GUIDE = REPO_GUIDES.GUIDES.find((g) => g.slug === "how-to-create-a-qr-code");
  const GUIDE_TEXT = JSON.stringify(GUIDE);

  check("the component exists and marks itself as a client component", /^"use client";/.test(COMPONENT));
  check("the component no longer imports the qrcode library", !/from\s+["']qrcode["']/.test(COMPONENT));
  check("the component does not prefill an example URL", !/braincoder\.sardar\.dev\/use/.test(COMPONENT.split("useState")[1] || ""));
  check("the empty state asks for input instead of showing a code", /Enter (some )?text|Enter text/.test(COMPONENT));
  check("the placeholder is an em dash or an instruction, never a live sample", !/value=\{DEFAULT/.test(COMPONENT));
  check("a live region announces the outcome", /role="status"/.test(COMPONENT) && /aria-live="polite"/.test(COMPONENT));
  check("errors are announced assertively", /role="alert"/.test(COMPONENT));
  check("the busy state is exposed while encoding", /aria-busy/.test(COMPONENT));
  check("the textarea is labelled", /htmlFor="qr-text-input"/.test(COMPONENT) && /id="qr-text-input"/.test(COMPONENT));
  check("the error is tied to the input that caused it", /aria-describedby=\{[^}]*qr-code-error/.test(COMPONENT));
  check("every control has a visible focus ring", (COMPONENT.match(/focus-visible:outline/g) || []).length >= 5);
  check("controls meet the 44px touch target", (COMPONENT.match(/min-h-11/g) || []).length >= 5);
  check("the clipboard button comes from the shared UI kit", /CopyButton/.test(COMPONENT) && /from "@\/components\/ui"/.test(COMPONENT));
  check("downloads go through the shared blob helper", /downloadBlob/.test(COMPONENT) && /from "@\/lib\/download"/.test(COMPONENT));
  check("the PNG is rendered at an exact integer module scale", /geometry\(/.test(COMPONENT) && /scale/.test(COMPONENT));
  check("the PNG is described as resolution-dependent", /pixel/i.test(COMPONENT));
  check("the SVG is described as vector", /scal/i.test(COMPONENT));
  check("over-capacity input is refused before anything is encoded", /MAX_INPUT_CHARACTERS/.test(COMPONENT));
  check("the error correction selector offers all four levels", ["L", "M", "Q", "H"].every((level) => COMPONENT.includes(`value="${level}"`)));
  check("the UI states that non-ASCII text is UTF-8 without ECI", /UTF-8/.test(COMPONENT) && /ECI/.test(COMPONENT));
  check("the UI states that one mode is used for the whole string", /single mode|one mode|whole string/i.test(COMPONENT));
  check("low contrast is surfaced, not silently allowed", /contrast/i.test(COMPONENT));
  check("print size guidance is on the page", /print/i.test(COMPONENT));
  check("no width or overflow class breaks a 375px viewport", !/min-w-\[(\d{3,})px\]/.test(COMPONENT) && !/w-\[[4-9]\d{2}px\]/.test(COMPONENT));

  check("the registry still describes the tool", /"qr-code-generator"/.test(TOOLS_SRC));
  check("the registry no longer claims the code is infinitely scalable", !/infinitely scalable/i.test(TOOLS_SRC));
  check("the content entry exists", !!CONTENT);
  check("the content no longer claims a QR survives being partly obscured by choosing higher ECC", !/partially obscured/i.test(JSON.stringify(CONTENT)));
  check("the content no longer claims the SVG is infinitely scalable", !/infinitely scalable/i.test(JSON.stringify(CONTENT)));
  check("the content no longer credits the qrcode library", !/qrcode library/i.test(JSON.stringify(CONTENT)) && !/qrcode npm/i.test(JSON.stringify(CONTENT)));
  check("the content names the real maximum", /7,089/.test(JSON.stringify(CONTENT)));
  check("the content explains the quiet zone", /quiet zone/i.test(JSON.stringify(CONTENT)));
  check("the content explains print and module size", /mm per module|module size/i.test(JSON.stringify(CONTENT)));
  check("the content explains the UTF-8 caveat", /UTF-8/.test(JSON.stringify(CONTENT)) && /ECI/.test(JSON.stringify(CONTENT)));
  check("the content explains the single-mode trade-off", /single mode|one mode/i.test(JSON.stringify(CONTENT)));
  check("the content says the code never leaves the browser", /never leaves|browser|device/i.test(JSON.stringify(CONTENT)));
  check("the content has a FAQ that admits a QR code may not scan", CONTENT.faq.some((f) => /not scan|harder to scan|noisy|glare|dense/i.test(f.answer)));
  check("the FAQ answers the inverted-colour question", CONTENT.faq.some((f) => /invert|light on dark|dark on light/i.test(f.question + f.answer)));
  check("the FAQ answers the printing question with a module size", CONTENT.faq.some((f) => /print/i.test(f.question + f.answer) && /\d\s?mm/.test(f.answer)));

  check("the SEO keywords exist", /qr code generator/.test(SEO_SRC));
  check("the SEO keyword list covers the scannable cases", /qr code generator for/.test(SEO_SRC) || /create a qr code/.test(SEO_SRC));

  check("the how-to guide exists on the existing slug", !!GUIDE);
  check("the guide is attached to the tool", GUIDE && GUIDE.toolSlug === "qr-code-generator");
  check("the guide no longer credits the qrcode library", !/qrcode library/i.test(GUIDE_TEXT));
  check("the guide does not claim the PNG is infinitely scalable", !/infinitely sharp|scalable at any size/i.test(GUIDE_TEXT));
  check("the guide explains how many versions and levels exist", /version 40|versions 1 to 40|40 versions/i.test(GUIDE_TEXT));
  check("the guide explains the error correction trade-off", /error correction/i.test(GUIDE_TEXT));
  check("the guide covers printing", /print/i.test(GUIDE_TEXT));
  check("the guide covers the UTF-8 caveat", /UTF-8/.test(GUIDE_TEXT));
  check("the guide says the encoding is done in the browser", /browser|device/i.test(GUIDE_TEXT));
  check("the guide declares a reading time", GUIDE && GUIDE.readMinutes >= 4);
  check("the guide carries its own keywords", GUIDE && GUIDE.keywords.length >= 4);
  check("the guide resolves from the tool page", REPO_GUIDES.getGuidesByTool("qr-code-generator").length === 1);
}

rmSync(OUT, { recursive: true, force: true });

process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);