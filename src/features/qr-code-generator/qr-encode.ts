/**
 * A complete QR Code encoder (ISO/IEC 18004), written out in full and with no
 * browser API in sight, so the Node audit can transpile this file with the
 * repo's own TypeScript compiler, import it and check the bytes it produces.
 *
 * Nothing here is delegated to a library: mode selection, version selection,
 * Reed–Solomon error correction over GF(256) with the real generator
 * polynomials, block splitting and interleaving, the function patterns, the
 * eight data masks with the ISO §8.8.2 penalty scores, the 15-bit format
 * information and the 18-bit version information are all computed here.
 *
 * Everything is deterministic: the same text and the same error-correction
 * level always produce the same matrix, with no clock, no randomness and no
 * locale involved.
 *
 * The matrix this returns is `size * size` values in row-major order, 1 = dark
 * module, 0 = light. The component turns it into pixels; `qr-format.ts` turns
 * it into a file.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type EccLevel = "L" | "M" | "Q" | "H";

export type QrMode = "numeric" | "alphanumeric" | "byte";

export interface QrSymbol {
  /** 1–40, chosen from the real data length and the ECC level. */
  version: number;
  level: EccLevel;
  /** The single mode used for the whole string. */
  mode: QrMode;
  /** Modules on one side: 4 * version + 17. */
  size: number;
  /** The chosen data mask, 0–7, and its ISO penalty score. */
  mask: number;
  maskPenalty: number;
  /** Every mask's penalty, so the choice can be shown rather than asserted. */
  maskPenalties: number[];
  /** The codewords that were placed, data and error correction interleaved. */
  codewords: number[];
  /**
   * The finished matrix, `size * size` values in row-major order: 1 = dark
   * module, 0 = light. This is what a scanner reads, once a quiet zone of four
   * light modules on every side has been added by whoever renders it.
   */
  modules: Uint8Array;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  blockCount: number;
  /** Bits the character count indicator occupies at this version. */
  countBits: number;
  /** Characters (numeric/alphanumeric) or bytes (byte mode) that were encoded. */
  charCount: number;
  /** True when the string needed more than one segment — never true here. */
  multiSegment: false;
}

/* -------------------------------------------------------------------------- */
/* GF(256) — the field Reed–Solomon is defined over                            */
/* -------------------------------------------------------------------------- */

/** 2^8 with the QR primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d). */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
})();

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("division by zero in GF(256)");
  if (a === 0) return 0;
  return GF_EXP[(GF_LOG[a] + 255 - GF_LOG[b]) % 255];
}

export function gfPow(a: number, n: number): number {
  if (a === 0) return 0;
  return GF_EXP[(GF_LOG[a] * n) % 255];
}

/**
 * (α^n − 1)·x + … — the generator polynomial for `degree` error correction
 * codewords, highest power first. Degree 7 is
 * [1, 127, 122, 154, 164, 11, 68, 117], which is the published table.
 */
const GENERATOR_CACHE = new Map<number, number[]>();

export function generatorPolynomial(degree: number): number[] {
  const cached = GENERATOR_CACHE.get(degree);
  if (cached) return cached;
  if (degree < 1 || degree > 255) throw new Error(`no generator polynomial of degree ${degree}`);
  let poly = [1];
  for (let d = 0; d < degree; d += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i += 1) {
      next[i] ^= poly[i];
      next[i + 1] ^= gfMul(poly[i], GF_EXP[d]);
    }
    poly = next;
  }
  GENERATOR_CACHE.set(degree, poly);
  return poly;
}

/**
 * The Reed–Solomon remainder of `data` for `ecLength` codewords: the error
 * correction codewords that go into the block.
 */
export function reedSolomonRemainder(data: number[], ecLength: number): number[] {
  const gen = generatorPolynomial(ecLength);
  const remainder = new Array<number>(ecLength).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecLength; i += 1) remainder[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return remainder;
}

/* -------------------------------------------------------------------------- */
/* Version and error-correction tables (ISO/IEC 18004 Annex D)                 */
/* -------------------------------------------------------------------------- */

/**
 * Error correction codewords per block — ISO/IEC 18004 Table 9. One line per
 * version, four numbers to a line in the order L, M, Q, H, so the whole table
 * can be read against the specification without counting. The largest value is
 * 30, comfortably inside the 255 nonzero elements of GF(256).
 *
 * Note this is per block, not per symbol. The `qrcode` package's table of the
 * same name holds the per-symbol total instead, which is why the audit compares
 * perBlock × blocks rather than perBlock on its own.
 */
export const ECC_CODEWORDS_PER_BLOCK: readonly number[] = [
  7, 10, 13, 17, //  1
  10, 16, 22, 28, //  2
  15, 26, 18, 22, //  3
  20, 18, 26, 16, //  4
  26, 24, 18, 22, //  5
  18, 16, 24, 28, //  6
  20, 18, 18, 26, //  7
  24, 22, 22, 26, //  8
  30, 22, 20, 24, //  9
  18, 26, 24, 28, // 10
  20, 30, 28, 24, // 11
  24, 22, 26, 28, // 12
  26, 22, 24, 22, // 13
  30, 24, 20, 24, // 14
  22, 24, 30, 24, // 15
  24, 28, 24, 30, // 16
  28, 28, 28, 28, // 17
  30, 26, 28, 28, // 18
  28, 26, 26, 26, // 19
  28, 26, 30, 28, // 20
  28, 26, 28, 30, // 21
  28, 28, 30, 24, // 22
  30, 28, 30, 30, // 23
  30, 28, 30, 30, // 24
  26, 28, 30, 30, // 25
  28, 28, 28, 30, // 26
  30, 28, 30, 30, // 27
  30, 28, 30, 30, // 28
  30, 28, 30, 30, // 29
  30, 28, 30, 30, // 30
  30, 28, 30, 30, // 31
  30, 28, 30, 30, // 32
  30, 28, 30, 30, // 33
  30, 28, 30, 30, // 34
  30, 28, 30, 30, // 35
  30, 28, 30, 30, // 36
  30, 28, 30, 30, // 37
  30, 28, 30, 30, // 38
  30, 28, 30, 30, // 39
  30, 28, 30, 30, // 40
];

/** Error correction blocks — ISO/IEC 18004 Table 9, same order. */
export const EC_BLOCKS: readonly number[] = [
  1, 1, 1, 1, //  1
  1, 1, 1, 1, //  2
  1, 1, 2, 2, //  3
  1, 2, 2, 4, //  4
  1, 2, 4, 4, //  5
  2, 4, 4, 4, //  6
  2, 4, 6, 5, //  7
  2, 4, 6, 6, //  8
  2, 5, 8, 8, //  9
  4, 5, 8, 8, // 10
  4, 5, 8, 11, // 11
  4, 8, 10, 11, // 12
  4, 9, 12, 16, // 13
  4, 9, 16, 16, // 14
  6, 10, 12, 18, // 15
  6, 10, 17, 16, // 16
  6, 11, 16, 19, // 17
  6, 13, 18, 21, // 18
  7, 14, 21, 25, // 19
  8, 16, 20, 25, // 20
  8, 17, 23, 25, // 21
  9, 17, 23, 34, // 22
  9, 18, 25, 30, // 23
  10, 20, 27, 32, // 24
  12, 21, 29, 35, // 25
  12, 23, 34, 37, // 26
  12, 25, 34, 40, // 27
  13, 26, 35, 42, // 28
  14, 28, 38, 45, // 29
  15, 29, 40, 48, // 30
  16, 31, 43, 51, // 31
  17, 33, 45, 54, // 32
  18, 35, 48, 57, // 33
  19, 37, 51, 60, // 34
  19, 38, 53, 63, // 35
  20, 40, 56, 66, // 36
  21, 43, 59, 70, // 37
  22, 45, 62, 74, // 38
  24, 47, 65, 77, // 39
  25, 49, 68, 81, // 40
];

const LEVEL_ORDINAL: Record<EccLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

/**
 * The two-bit error-correction indicator written into the format information.
 * It is not the same order as L, M, Q, H — L is 01 and M is 00.
 */
export const FORMAT_BITS: Record<EccLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

export function ecCodewordsPerBlock(version: number, level: EccLevel): number {
  return ECC_CODEWORDS_PER_BLOCK[(version - 1) * 4 + LEVEL_ORDINAL[level]];
}

export function ecBlockCount(version: number, level: EccLevel): number {
  return EC_BLOCKS[(version - 1) * 4 + LEVEL_ORDINAL[level]];
}

/**
 * Modules available for data and error correction codewords before the format
 * and version areas are subtracted: 8 * totalCodewords + remainder bits.
 */
export function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignCount = Math.floor(version / 7) + 2;
    result -= (25 * alignCount - 10) * alignCount - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

export function totalCodewords(version: number): number {
  return Math.floor(rawDataModules(version) / 8);
}

/** Bits left over after the last codeword, which the spec pads with zeros. */
export function remainderBits(version: number): number {
  return rawDataModules(version) % 8;
}

export function dataCodewordCount(version: number, level: EccLevel): number {
  return totalCodewords(version) - ecCodewordsPerBlock(version, level) * ecBlockCount(version, level);
}

export function dataBitCapacity(version: number, level: EccLevel): number {
  return dataCodewordCount(version, level) * 8;
}

/** Alignment pattern centres, ascending. Version 1 has none. */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const positions = [6];
  for (let pos = size - 7; positions.length < count; pos -= step) positions.splice(1, 0, pos);
  return positions;
}

/* -------------------------------------------------------------------------- */
/* Modes                                                                       */
/* -------------------------------------------------------------------------- */

export const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const NUMERIC_RE = /^[0-9]*$/;
const ALPHANUMERIC_RE = /^[0-9A-Z $%*+\-./:]*$/;

/** The narrowest mode whose alphabet holds every character, else byte mode. */
export function selectMode(text: string): QrMode {
  if (NUMERIC_RE.test(text)) return "numeric";
  if (ALPHANUMERIC_RE.test(text)) return "alphanumeric";
  return "byte";
}

/** Mode indicator bits: numeric 0001, alphanumeric 0010, byte 0100. */
export function modeIndicator(mode: QrMode): number {
  if (mode === "numeric") return 1;
  if (mode === "alphanumeric") return 2;
  return 4;
}

/** Character count indicator width, which grows with the version. */
export function countIndicatorBits(mode: QrMode, version: number): number {
  if (version <= 9) return mode === "numeric" ? 10 : mode === "alphanumeric" ? 9 : 8;
  if (version <= 26) return mode === "numeric" ? 12 : mode === "alphanumeric" ? 11 : 16;
  return mode === "numeric" ? 14 : mode === "alphanumeric" ? 13 : 16;
}

export function alphanumericValue(char: string): number {
  const at = ALPHANUMERIC_CHARSET.indexOf(char);
  if (at < 0) throw new Error(`"${char}" is not in the alphanumeric set`);
  return at;
}

/** How many characters, or bytes, the given mode can carry in `bits` bits. */
export function maxCharCount(mode: QrMode, bits: number, version: number): number {
  const countBits = countIndicatorBits(mode, version);
  const payload = bits - 4 - countBits;
  if (payload < 0) return 0;
  if (mode === "numeric") {
    const groups = Math.floor(payload / 10);
    const rest = payload % 10;
    // A full group of three digits costs 10 bits; a leftover group of two digits
    // costs 7 bits and a leftover single digit costs 4.
    return groups * 3 + (rest >= 7 ? 2 : rest >= 4 ? 1 : 0);
  }
  if (mode === "alphanumeric") {
    const groups = Math.floor(payload / 11);
    const rest = payload % 11;
    return groups * 2 + (rest >= 6 ? 1 : 0);
  }
  return Math.floor(payload / 8);
}

/* -------------------------------------------------------------------------- */
/* Bit buffer and segment encoding                                             */
/* -------------------------------------------------------------------------- */

class BitBuffer {
  readonly bits: number[] = [];

  get length(): number {
    return this.bits.length;
  }

  push(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i -= 1) this.bits.push((value >>> i) & 1);
  }
}

/**
 * Encode `text` in `mode` into data bits: mode indicator, character count, then
 * the payload in the mode's own packing. Byte mode writes the string's UTF-8
 * bytes; no ECI header is emitted, which the UI states.
 */
export function segmentBits(text: string, mode: QrMode, version: number): number[] {
  const buffer = new BitBuffer();
  buffer.push(modeIndicator(mode), 4);
  const countBits = countIndicatorBits(mode, version);
  const count = mode === "byte" ? new TextEncoder().encode(text).length : text.length;
  if (count >= 1 << countBits) {
    throw new Error(`${count} does not fit in a ${countBits}-bit character count indicator`);
  }
  buffer.push(count, countBits);

  if (mode === "numeric") {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      buffer.push(Number(chunk), chunk.length * 3 + 1);
    }
  } else if (mode === "alphanumeric") {
    for (let i = 0; i < text.length; i += 2) {
      const chunk = text.slice(i, i + 2);
      if (chunk.length === 2) {
        buffer.push(alphanumericValue(chunk[0]) * 45 + alphanumericValue(chunk[1]), 11);
      } else {
        buffer.push(alphanumericValue(chunk[0]), 6);
      }
    }
  } else {
    for (const byte of new TextEncoder().encode(text)) buffer.push(byte, 8);
  }
  return buffer.bits;
}

/* -------------------------------------------------------------------------- */
/* Blocks and interleaving                                                     */
/* -------------------------------------------------------------------------- */

export interface QrBlocks {
  data: number[][];
  ec: number[][];
  interleaved: number[];
}

/**
 * Split the data codewords into the spec's blocks, compute each block's error
 * correction codewords, and interleave them the way a reader undoes it.
 */
export function buildBlocks(data: number[], version: number, level: EccLevel): QrBlocks {
  const blockCount = ecBlockCount(version, level);
  const ecLength = ecCodewordsPerBlock(version, level);
  const total = totalCodewords(version);
  // ISO 18004 §8.5.2: the shorter blocks come first, and any remainder is
  // spread one codeword at a time over the blocks at the end.
  const shortBlocks = blockCount - (total % blockCount);
  const shortLength = Math.floor(total / blockCount);

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i += 1) {
    const length = shortLength - ecLength + (i < shortBlocks ? 0 : 1);
    const block = data.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    ecBlocks.push(reedSolomonRemainder(block, ecLength));
  }
  if (offset !== data.length) throw new Error("block split did not consume every data codeword");

  const interleaved: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const block of dataBlocks) if (i < block.length) interleaved.push(block[i]);
  }
  for (let i = 0; i < ecLength; i += 1) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }
  return { data: dataBlocks, ec: ecBlocks, interleaved };
}

/* -------------------------------------------------------------------------- */
/* Matrix                                                                      */
/* -------------------------------------------------------------------------- */

const bit = (value: number, index: number): number => ((value >>> index) & 1) as number;

class Matrix {
  readonly size: number;
  readonly modules: Uint8Array;
  readonly reserved: Uint8Array;

  constructor(size: number) {
    this.size = size;
    this.modules = new Uint8Array(size * size);
    this.reserved = new Uint8Array(size * size);
  }

  get(row: number, col: number): number {
    return this.modules[row * this.size + col];
  }

  set(row: number, col: number, value: number): void {
    this.modules[row * this.size + col] = value;
  }

  isReserved(row: number, col: number): boolean {
    return this.reserved[row * this.size + col] === 1;
  }

  setFunction(row: number, col: number, value: number): void {
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) return;
    this.set(row, col, value);
    this.reserved[row * this.size + col] = 1;
  }

  /** The 7×7 finder plus its one-module separator, so the matrix is 1 clear. */
  drawFinder(centerRow: number, centerCol: number): void {
    for (let dr = -4; dr <= 4; dr += 1) {
      for (let dc = -4; dc <= 4; dc += 1) {
        const distance = Math.max(Math.abs(dr), Math.abs(dc));
        this.setFunction(centerRow + dr, centerCol + dc, distance !== 2 && distance !== 4 ? 1 : 0);
      }
    }
  }

  drawAlignment(centerRow: number, centerCol: number): void {
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        this.setFunction(centerRow + dr, centerCol + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0);
      }
    }
  }

  drawFunctionPatterns(version: number): void {
    const size = this.size;
    // Finders at three corners, each with its separator.
    this.drawFinder(3, 3);
    this.drawFinder(3, size - 4);
    this.drawFinder(size - 4, 3);

    // Timing patterns: alternating modules from 8 to size - 9.
    for (let i = 8; i < size - 8; i += 1) {
      this.setFunction(6, i, i % 2 === 0 ? 1 : 0);
      this.setFunction(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // Alignment patterns, skipping the three that would sit on a finder.
    const positions = alignmentPositions(version);
    for (const row of positions) {
      for (const col of positions) {
        const nearFinder =
          (row === positions[0] && col === positions[0]) ||
          (row === positions[0] && col === positions[positions.length - 1]) ||
          (row === positions[positions.length - 1] && col === positions[0]);
        if (nearFinder) continue;
        this.drawAlignment(row, col);
      }
    }

    // Reserve the format information area around the top-left finder: row 8
    // and column 8 at both ends, minus the two timing modules they share.
    for (let i = 0; i <= 8; i += 1) {
      if (i !== 6) {
        this.setFunction(8, i, 0);
        this.setFunction(i, 8, 0);
      }
    }
    for (let i = 0; i < 8; i += 1) {
      this.setFunction(8, size - 1 - i, 0);
      this.setFunction(size - 1 - i, 8, 0);
    }
    // The single module that is always dark, whatever the mask or the level.
    this.setFunction(size - 8, 8, 1);

    // Version information, two copies, from version 7 up.
    if (version >= 7) {
      const bits = versionInformationBits(version);
      for (let i = 0; i < 18; i += 1) {
        const colour = bit(bits, i);
        const col = size - 11 + (i % 3);
        const row = Math.floor(i / 3);
        this.setFunction(row, col, colour);
        this.setFunction(col, row, colour);
      }
    }
  }

  /** The two-module-wide upward/downward zig-zag, skipping the timing column. */
  drawCodewords(codewords: number[]): void {
    const size = this.size;
    let bitIndex = 0;
    const totalBits = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical += 1) {
        for (let offset = 0; offset < 2; offset += 1) {
          const col = right - offset;
          const upward = ((right + 1) & 2) === 0;
          const row = upward ? size - 1 - vertical : vertical;
          if (!this.isReserved(row, col) && bitIndex < totalBits) {
            this.set(row, col, bit(codewords[bitIndex >>> 3], 7 - (bitIndex & 7)));
            bitIndex += 1;
          }
          // Everything past the last codeword is a remainder bit, and the spec
          // says those stay light.
        }
      }
    }
  }

  applyMask(pattern: number): void {
    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        if (this.isReserved(row, col)) continue;
        if (maskBit(pattern, row, col)) {
          const at = row * this.size + col;
          this.modules[at] = this.modules[at] ^ 1;
        }
      }
    }
  }

  /**
   * The 15 format bits, written twice: once down column 8 and once along row 8.
   * Bit 0 is the least significant bit. The two copies are not mirror images —
   * the column copy holds bits 0–7 beside the top-left finder and bits 8–14 at
   * the bottom left, while the row copy holds bits 0–7 at the top right and
   * bits 8–14 beside the top-left finder.
   */
  writeFormatInformation(level: EccLevel, pattern: number): void {
    const bits = formatInformationBits(level, pattern);
    const size = this.size;
    for (let i = 0; i < 15; i += 1) {
      const colour = bit(bits, i);
      // Copy one, in column 8: rows 0–5, then 7 and 8, then the bottom seven.
      if (i < 6) this.set(i, 8, colour);
      else if (i < 8) this.set(i + 1, 8, colour);
      else this.set(size - 15 + i, 8, colour);
      // Copy two, in row 8: the top-right eight, then 7, then columns 5 down to 0.
      if (i < 8) this.set(8, size - 1 - i, colour);
      else if (i < 9) this.set(8, 7, colour);
      else this.set(8, 14 - i, colour);
    }
    this.set(size - 8, 8, 1);
  }

  darkCount(): number {
    let count = 0;
    for (let i = 0; i < this.modules.length; i += 1) count += this.modules[i];
    return count;
  }
}

/** The eight data mask conditions of ISO/IEC 18004 §8.8.1, indexed by mask. */
export function maskBit(pattern: number, row: number, col: number): boolean {
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
    case 7:
      return (((row * col) % 3) + ((row + col) % 2)) % 2 === 0;
    default:
      throw new Error(`bad mask pattern: ${pattern}`);
  }
}

/**
 * ISO/IEC 18004 §8.8.2, the four penalty rules. Rule 4 uses the specification's
 * wording — the whole number of 5% steps between the dark proportion and 50% —
 * not the ceiling variant some encoders use, so the mask this picks can differ
 * from theirs and this file says so rather than hiding it.
 */
export function penaltyScore(modules: Uint8Array, size: number): number {
  const at = (row: number, col: number) => modules[row * size + col];

  // N1: every run of five or more same-coloured modules in a line, 3 + (n - 5).
  let n1 = 0;
  for (let row = 0; row < size; row += 1) {
    let run = 1;
    for (let col = 1; col < size; col += 1) {
      if (at(row, col) === at(row, col - 1)) run += 1;
      else {
        if (run >= 5) n1 += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) n1 += 3 + (run - 5);
  }
  for (let col = 0; col < size; col += 1) {
    let run = 1;
    for (let row = 1; row < size; row += 1) {
      if (at(row, col) === at(row - 1, col)) run += 1;
      else {
        if (run >= 5) n1 += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) n1 += 3 + (run - 5);
  }

  // N2: every 2×2 block of one colour.
  let n2 = 0;
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const sum = at(row, col) + at(row, col + 1) + at(row + 1, col) + at(row + 1, col + 1);
      if (sum === 0 || sum === 4) n2 += 3;
    }
  }

  // N3: the 1:1:3:1:1 dark:light:dark:light:dark pattern with four light modules
  // on either side, in a row or a column. Both orderings are the same eleven
  // modules read in opposite directions, so two windows are all that is needed:
  // 10111010000 and 00001011101.
  let n3 = 0;
  const PATTERN_AFTER_QUIET = 0b10111010000;
  const PATTERN_BEFORE_QUIET = 0b00001011101;
  const countPatterns = (read: (offset: number) => number) => {
    let window = 0;
    for (let offset = 0; offset < size; offset += 1) {
      window = ((window << 1) | read(offset)) & 0x7ff;
      if (offset >= 10 && (window === PATTERN_AFTER_QUIET || window === PATTERN_BEFORE_QUIET)) {
        n3 += 40;
      }
    }
  };
  for (let row = 0; row < size; row += 1) {
    countPatterns((offset) => at(row, offset));
  }
  for (let col = 0; col < size; col += 1) {
    countPatterns((offset) => at(offset, col));
  }

  // N4: the whole number of 5% steps the dark proportion is away from 50%.
  let dark = 0;
  for (let i = 0; i < modules.length; i += 1) dark += modules[i];
  const percent = (dark * 100) / (size * size);
  const n4 = Math.floor(Math.abs(percent - 50) / 5) * 10;

  return n1 + n2 + n3 + n4;
}

/** The 15-bit format information: BCH(15,5) over level and mask, then 0x5412. */
export function formatInformationBits(level: EccLevel, pattern: number): number {
  const data = (FORMAT_BITS[level] << 3) | pattern;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  }
  return (((data << 10) | remainder) ^ 0x5412) & 0x7fff;
}

/** The 18-bit version information: BCH(18,6) over the version number. */
export function versionInformationBits(version: number): number {
  let remainder = version;
  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  }
  return (version << 12) | remainder;
}

/* -------------------------------------------------------------------------- */
/* Version selection                                                           */
/* -------------------------------------------------------------------------- */

export interface VersionProbe {
  version: number;
  /** Bits the segment needs at this version, mode indicator included. */
  neededBits: number;
  /** Bits the version can carry at this ECC level. */
  capacityBits: number;
  fits: boolean;
}

/** How a single-mode segment measures against every version, smallest first. */
export function probeVersions(text: string, mode: QrMode, level: EccLevel): VersionProbe[] {
  const count = mode === "byte" ? new TextEncoder().encode(text).length : text.length;
  const body = payloadBits(mode, count);
  return Array.from({ length: 40 }, (_, i) => {
    const version = i + 1;
    const countBits = countIndicatorBits(mode, version);
    const capacityBits = dataBitCapacity(version, level);
    // A character count that no longer fits its own indicator cannot be written
    // at this version at all, so the version is out even when the payload would.
    const neededBits = count >= 1 << countBits ? Infinity : 4 + countBits + body;
    return { version, neededBits, capacityBits, fits: neededBits <= capacityBits };
  });
}

/** Payload bits for `count` characters in `mode`, ignoring the header. */
export function payloadBits(mode: QrMode, count: number): number {
  if (count === 0) return 0;
  if (mode === "numeric") {
    const groups = Math.floor(count / 3);
    const rest = count % 3;
    return groups * 10 + (rest === 0 ? 0 : rest === 1 ? 4 : 7);
  }
  if (mode === "alphanumeric") {
    const groups = Math.floor(count / 2);
    return groups * 11 + (count % 2 === 0 ? 0 : 6);
  }
  return count * 8;
}

/* -------------------------------------------------------------------------- */
/* The encoder                                                                 */
/* -------------------------------------------------------------------------- */

export class QrCapacityError extends Error {
  readonly mode: QrMode;
  readonly level: EccLevel;
  readonly needed: number;
  /** Largest character or byte count this mode and level can carry at version 40. */
  readonly limit: number;

  constructor(message: string, mode: QrMode, level: EccLevel, needed: number, limit: number) {
    super(message);
    this.name = "QrCapacityError";
    this.mode = mode;
    this.level = level;
    this.needed = needed;
    this.limit = limit;
  }
}

/** The largest character or byte count for a mode and level, at version 40. */
export function maxCountFor(mode: QrMode, level: EccLevel): number {
  return maxCharCount(mode, dataBitCapacity(40, level), 40);
}

/**
 * Encode `text` as a real QR symbol. Throws `QrCapacityError` when the string
 * cannot fit at the requested level — with the limit that was actually applied,
 * which is the version 40 capacity for that mode and level.
 */
export function encodeQr(text: string, level: EccLevel): QrSymbol {
  if (text.length === 0) throw new Error("nothing to encode");
  const mode = selectMode(text);
  const probes = probeVersions(text, mode, level);
  const chosen = probes.find((p) => p.fits);
  if (!chosen) {
    const needed = mode === "byte" ? new TextEncoder().encode(text).length : text.length;
    const limit = maxCountFor(mode, level);
    throw new QrCapacityError(
      `${needed} ${unitFor(mode)} will not fit at error correction ${level}; version 40 holds ${limit}.`,
      mode,
      level,
      needed,
      limit,
    );
  }

  const version = chosen.version;
  const bits = segmentBits(text, mode, version);
  const capacityBits = dataBitCapacity(version, level);
  if (bits.length > capacityBits) {
    // Defensive: probeVersions already refused this case.
    throw new Error(`segment of ${bits.length} bits exceeds the ${capacityBits}-bit capacity`);
  }

  // Pad the segment to a whole codeword, then to the terminator, then with the
  // alternating pad codewords 0xec, 0x11 (ISO/IEC 18004 §8.4.9).
  const padded = bits.slice();
  const terminator = Math.min(4, capacityBits - padded.length);
  for (let i = 0; i < terminator; i += 1) padded.push(0);
  while (padded.length % 8 !== 0) padded.push(0);

  const dataCodewords: number[] = [];
  for (let i = 0; i < padded.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | padded[i + j];
    dataCodewords.push(value);
  }
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (dataCodewords.length < dataCodewordCount(version, level)) {
    dataCodewords.push(padBytes[padIndex % 2]);
    padIndex += 1;
  }

  const blocks = buildBlocks(dataCodewords, version, level);
  const codewords = blocks.interleaved;
  if (codewords.length !== totalCodewords(version)) {
    throw new Error("interleaving produced the wrong number of codewords");
  }

  const size = version * 4 + 17;
  const matrix = new Matrix(size);
  matrix.drawFunctionPatterns(version);
  matrix.drawCodewords(codewords);

  // Try all eight masks, keep the lowest ISO penalty score, and break a tie on
  // the lowest mask number as the specification's evaluation order does.
  const penalties: number[] = [];
  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let pattern = 0; pattern < 8; pattern += 1) {
    matrix.applyMask(pattern);
    matrix.writeFormatInformation(level, pattern);
    const penalty = penaltyScore(matrix.modules, size);
    penalties.push(penalty);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = pattern;
    }
    matrix.applyMask(pattern);
  }

  matrix.applyMask(bestMask);
  matrix.writeFormatInformation(level, bestMask);

  const count = mode === "byte" ? new TextEncoder().encode(text).length : text.length;
  return {
    version,
    level,
    mode,
    size,
    mask: bestMask,
    maskPenalty: bestPenalty,
    maskPenalties: penalties,
    codewords,
    modules: matrix.modules,
    dataCodewords: dataCodewordCount(version, level),
    ecCodewordsPerBlock: ecCodewordsPerBlock(version, level),
    blockCount: ecBlockCount(version, level),
    countBits: countIndicatorBits(mode, version),
    charCount: count,
    multiSegment: false,
  };
}

export function unitFor(mode: QrMode): string {
  if (mode === "numeric") return "digits";
  if (mode === "alphanumeric") return "characters";
  return "bytes";
}

/** The symbol's own module matrix, `size * size` values in row-major order. */
export function matrixOf(symbol: QrSymbol): Uint8Array {
  return symbol.modules;
}

/** Row `index` of the symbol as a string of "1"/"0", for tests and diffing. */
export function matrixRowString(modules: Uint8Array, size: number, index: number): string {
  let row = "";
  for (let col = 0; col < size; col += 1) row += modules[index * size + col] ? "1" : "0";
  return row;
}