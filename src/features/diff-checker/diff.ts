"use client";

export type Granularity = "words" | "characters";

export interface DiffOptions {
  ignoreCase?: boolean;
  ignoreAllSpace?: boolean;
  ignoreTrailingSpace?: boolean;
  granularity?: Granularity;
}

export interface ChunkDef {
  text: string;
  kind: "equal" | "added" | "removed";
}

export type RowKind = "same" | "changed" | "added" | "removed";

export interface DiffRow {
  kind: RowKind;
  aIndex: number | null;
  bIndex: number | null;
  left: string;
  right: string;
  leftChunks?: ChunkDef[];
  rightChunks?: ChunkDef[];
  leftNo: number | null;
  rightNo: number | null;
}

export type OpType = "equal" | "delete" | "insert";

export interface Op {
  type: OpType;
  aIndex: number | null;
  bIndex: number | null;
}

function normalize(s: string, opts: DiffOptions): string {
  let t = s;
  if (opts.ignoreCase) t = t.toLocaleLowerCase();
  if (opts.ignoreAllSpace) return t.replace(/\s+/g, "");
  if (opts.ignoreTrailingSpace) t = t.replace(/\s+$/g, "");
  return t;
}

const eqAt = (opts: DiffOptions) => (a: string, b: string) =>
  normalize(a, opts) === normalize(b, opts);

export function myersScript(a: string[], b: string[], eq: (x: string, y: string) => boolean): Op[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  const v = new Array<number>(2 * max + 1).fill(0);
  const trace: number[][] = [];
  let dFound = -1;

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && eq(a[x], b[y])) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        dFound = d;
        break;
      }
    }
    if (dFound >= 0) break;
  }

  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = dFound; d >= 0; d--) {
    const vv = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && vv[offset + k - 1] < vv[offset + k + 1])) prevK = k + 1;
    else prevK = k - 1;
    const prevX = vv[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: "equal", aIndex: x - 1, bIndex: y - 1 });
      x--;
      y--;
    }
    if (d === 0) break;
    if (x === prevX) {
      ops.push({ type: "insert", aIndex: null, bIndex: y - 1 });
      y--;
    } else {
      ops.push({ type: "delete", aIndex: x - 1, bIndex: null });
      x--;
    }
  }
  return ops.reverse();
}

export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export interface DiffResult {
  rows: DiffRow[];
  added: number;
  removed: number;
  changed: number;
  same: number;
  hunks: LookupHunk[];
}

interface LookupRow {
  aNo: number | null;
  bNo: number | null;
  kind: OpType | "hunk";
  text: string;
}

export interface LookupHunk {
  aStart: number;
  aCount: number;
  bStart: number;
  bCount: number;
  rows: LookupRow[];
}

export function diffLines(
  aLines: string[],
  bLines: string[],
  opts: DiffOptions,
  context = 3
): DiffResult {
  const script = myersScript(aLines, bLines, eqAt(opts));

  // Pair runs of deletes with following inserts into "changed" rows.
  const rows: DiffRow[] = [];
  let aNo = 0;
  let bNo = 0;
  let added = 0;
  let removed = 0;
  let changed = 0;
  let same = 0;

  const pushRow = (row: DiffRow) => {
    rows.push(row);
    if (row.aIndex !== null) aNo++;
    if (row.bIndex !== null) bNo++;
    if (row.kind === "added") added++;
    else if (row.kind === "removed") removed++;
    else if (row.kind === "changed") changed++;
    else same++;
  };

  let i = 0;
  while (i < script.length) {
    const op = script[i];
    if (op.type === "equal" && op.aIndex !== null && op.bIndex !== null) {
      pushRow({
        kind: "same",
        aIndex: op.aIndex,
        bIndex: op.bIndex,
        left: aLines[op.aIndex],
        right: aLines[op.aIndex],
        leftNo: aNo + 1,
        rightNo: bNo + 1,
      });
      i++;
      continue;
    }
    if (op.type === "insert" && op.bIndex !== null) {
      pushRow({
        kind: "added",
        aIndex: null,
        bIndex: op.bIndex,
        left: "",
        right: bLines[op.bIndex],
        leftNo: null,
        rightNo: bNo + 1,
      });
      i++;
      continue;
    }
    if (op.type === "delete" && op.aIndex !== null) {
      const dels: Op[] = [];
      while (i < script.length && script[i].type === "delete") {
        dels.push(script[i]);
        i++;
      }
      const ins: Op[] = [];
      while (i < script.length && script[i].type === "insert") {
        ins.push(script[i]);
        i++;
      }
      const paired = Math.max(dels.length, ins.length);
      for (let r = 0; r < paired; r++) {
        const del = dels[r];
        const insd = ins[r];
        const aIdx = del ? del.aIndex : null;
        const bIdx = insd ? insd.bIndex : null;
        const left = aIdx !== null ? aLines[aIdx] : "";
        const right = bIdx !== null ? bLines[bIdx] : "";
        const kind: RowKind =
          aIdx !== null && bIdx !== null ? "changed" : aIdx !== null ? "removed" : "added";
        let leftChunks: ChunkDef[] | undefined;
        let rightChunks: ChunkDef[] | undefined;
        if (kind === "changed") {
          const token = tokenDiff(left, right, opts);
          leftChunks = token.left;
          rightChunks = token.right;
        }
        pushRow({
          kind,
          aIndex: aIdx,
          bIndex: bIdx,
          left,
          right,
          leftChunks,
          rightChunks,
          leftNo: aIdx !== null ? aNo + 1 : null,
          rightNo: bIdx !== null ? bNo + 1 : null,
        });
      }
      continue;
    }
    i++;
  }

  return { rows, added, removed, changed, same, hunks: buildHunks(aLines, bLines, opts, context) };
}

function tokenizeWords(text: string, opts: DiffOptions): string[] {
  if (opts.ignoreAllSpace) return text.match(/\S+/g) ?? [];
  const matches = text.match(/[^\s]+|\s+/g);
  return matches ?? (text === "" ? [] : [text]);
}

function tokenizeChars(text: string): string[] {
  if (text === "") return [];
  return text.split("");
}

function tokenDiff(
  left: string,
  right: string,
  opts: DiffOptions
): { left: ChunkDef[]; right: ChunkDef[] } {
  const a =
    opts.granularity === "characters"
      ? tokenizeChars(left)
      : tokenizeWords(left, opts);
  const b =
    opts.granularity === "characters"
      ? tokenizeChars(right)
      : tokenizeWords(right, opts);
  const script = myersScript(a, b, eqAt(opts));
  const lc: ChunkDef[] = [];
  const rc: ChunkDef[] = [];
  for (const op of script) {
    if (op.type === "equal") {
      const t = a[op.aIndex ?? 0];
      lc.push({ text: t, kind: "equal" });
      rc.push({ text: t, kind: "equal" });
    } else if (op.type === "delete") {
      lc.push({ text: a[op.aIndex ?? 0], kind: "removed" });
    } else {
      rc.push({ text: b[op.bIndex ?? 0], kind: "added" });
    }
  }
  // Collapse adjacent chunks of the same kind to keep DOM small.
  const collapse = (chunks: ChunkDef[]): ChunkDef[] =>
    chunks.reduce<ChunkDef[]>((acc, c) => {
      const last = acc[acc.length - 1];
      if (last && last.kind === c.kind) last.text += c.text;
      else acc.push({ text: c.text, kind: c.kind });
      return acc;
    }, []);
  return { left: collapse(lc), right: collapse(rc) };
}

export function buildUnifiedText(
  aLines: string[],
  bLines: string[],
  opts: DiffOptions,
  context = 3
): string {
  const hunks = buildHunks(aLines, bLines, opts, context);
  const out: string[] = ["--- Original", "+++ Changed"];
  for (const hunk of hunks) {
    out.push(`@@ -${hunk.aStart},${hunk.aCount} +${hunk.bStart},${hunk.bCount} @@`);
    for (const row of hunk.rows) {
      const mark = row.kind === "equal" ? " " : row.kind === "delete" ? "-" : "+";
      out.push(`${mark}${row.text}`);
    }
  }
  return out.join("\n");
}

export function buildHunks(
  aLines: string[],
  bLines: string[],
  opts: DiffOptions,
  context = 3
): LookupHunk[] {
  const ctx = Math.max(context, 0);
  const script = myersScript(aLines, bLines, eqAt(opts));

  interface RawLine {
    kind: OpType;
    aNo: number | null;
    bNo: number | null;
    text: string;
  }

  // 1. Expand full script into numbered rows (context on each side of a
  //    change included at the raw level).
  const raw: RawLine[] = [];
  let ia = 0;
  let ib = 0;
  for (const op of script) {
    if (op.type === "equal") {
      raw.push({ kind: "equal", aNo: ia + 1, bNo: ib + 1, text: aLines[op.aIndex!] });
      ia++;
      ib++;
    } else if (op.type === "delete") {
      raw.push({ kind: "delete", aNo: ia + 1, bNo: null, text: aLines[op.aIndex!] });
      ia++;
    } else {
      raw.push({ kind: "insert", aNo: null, bNo: ib + 1, text: bLines[op.bIndex!] });
      ib++;
    }
  }

  // 2. Find change indices, then carve context windows around them.
  const changeIdx: number[] = [];
  for (let i = 0; i < raw.length; i++) if (raw[i].kind !== "equal") changeIdx.push(i);
  if (changeIdx.length === 0) return [];

  // Merge overlapping windows (separated by fewer than 2*ctx equal rows).
  const spans: Array<{ start: number; end: number }> = [];
  for (const ci of changeIdx) {
    const s = Math.max(0, ci - ctx);
    const e = Math.min(raw.length, ci + ctx + 1); // exclusive
    const prev = spans[spans.length - 1];
    if (prev && s <= prev.end) prev.end = Math.max(prev.end, e);
    else spans.push({ start: s, end: e });
  }

  const hunks: LookupHunk[] = [];
  for (const span of spans) {
    const rows = raw
      .slice(span.start, span.end)
      .map((r) => ({ aNo: r.aNo, bNo: r.bNo, kind: r.kind as OpType | "hunk", text: r.text }));
    const aStart = rows.find((r) => r.aNo !== null)?.aNo ?? 1;
    const bStart = rows.find((r) => r.bNo !== null)?.bNo ?? 1;
    const aCount = Math.max(1, rows.filter((r) => r.aNo !== null).length);
    const bCount = Math.max(1, rows.filter((r) => r.bNo !== null).length);
    hunks.push({ aStart, aCount: Math.max(1, aCount), bStart, bCount: Math.max(1, bCount), rows });
  }

  return hunks;
}