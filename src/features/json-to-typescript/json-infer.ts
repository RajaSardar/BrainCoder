/**
 * Shape inference for the JSON to TypeScript converter.
 *
 * Pure, dependency-free, one traversal. No React, no DOM, no `JSON.stringify`:
 * this module runs unchanged in the tab and under the Node audit.
 *
 * Three defects in the previous implementation are fixed here.
 *
 * 1. ARRAY ELEMENTS WERE INFERRED TWICE. The old code did
 *    `new Set(value.map(v => JSON.stringify(infer(v))))` and then
 *    `value.map(infer)` again, so an array cost `2^depth` infer calls: a 54-byte
 *    payload `[[[…["1"]…]]]` at depth 26 produced 67,108,863 calls, froze the tab
 *    and threw nothing — so no error boundary could catch it. Here an array maps
 *    its elements exactly once and the element shape is derived from that result.
 * 2. `JSON.stringify` WAS USED FOR STRUCTURAL COMPARISON. Every duplicate check
 *    allocated a serialized copy of a whole subtree, measured at 3-11x the size
 *    of the input it came from. `sameShape` below walks the two trees instead.
 * 3. `null` INFERRED TO `any`. A JSON null is a value, not a hole: it is present
 *    and required, and it renders as `T | null`. Making it `any` (or an optional
 *    marker) meant a required field silently became optional, so the generated
 *    type no longer described the input that produced it.
 */

/**
 * What a JSON value looks like, structurally.
 *
 * `unknown` is reserved for a shape this tool genuinely cannot describe — an
 * empty array has no element to look at. It is never a fallback for "mixed".
 */
export type JsonShape =
  | { kind: "null" }
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "object"; fields: ShapeField[]; allKeysPresent: boolean }
  | { kind: "array"; of: JsonShape }
  | { kind: "union"; of: JsonShape[] }
  | { kind: "unknown" };

export interface ShapeField {
  key: string;
  shape: JsonShape;
  /**
   * True only when the key was absent from at least one element of a merged
   * array. A field whose value is JSON null is present and required: `null` is a
   * value the sample has, not a field the sample lacks.
   */
  optional: boolean;
}

export interface InferLimits {
  maxDepth: number;
  maxNodes: number;
}

interface Ctx {
  limits: InferLimits;
  nodes: number;
}

/** The root value sits at level 1, so a limit of 1 accepts a scalar and nothing else. */
const ROOT_DEPTH = 1;

/**
 * Infer the shape of a parsed JSON value in one traversal.
 *
 * Throws a `RangeError` — never anything else — when the depth or node budget is
 * spent, so the caller can tell "this input is too big for the budget" apart from
 * "this input is not JSON". The message names the limit that was actually hit.
 */
export function inferJsonShape(value: unknown, limits: InferLimits): JsonShape {
  const ctx: Ctx = { limits, nodes: 0 };
  return infer(value, ROOT_DEPTH, ctx);
}

function infer(value: unknown, depth: number, ctx: Ctx): JsonShape {
  if (depth > ctx.limits.maxDepth) {
    throw new RangeError(
      `This JSON is nested deeper than ${ctx.limits.maxDepth} levels, and nothing was converted.`,
    );
  }
  ctx.nodes += 1;
  if (ctx.nodes > ctx.limits.maxNodes) {
    throw new RangeError(
      `This JSON holds more than ${ctx.limits.maxNodes.toLocaleString("en-US")} values, and nothing was converted.`,
    );
  }

  if (value === null) return { kind: "null" };

  switch (typeof value) {
    case "string":
      return { kind: "string" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "object":
      break;
    default:
      // A parsed JSON value is never a function, a symbol or a bigint; the
      // switch exists so an exotic value becomes `unknown` rather than throwing.
      return { kind: "unknown" };
  }

  return Array.isArray(value)
    ? inferArray(value, depth, ctx)
    : inferObject(value as Record<string, unknown>, depth, ctx);
}

function inferArray(items: unknown[], depth: number, ctx: Ctx): JsonShape {
  if (items.length === 0) return { kind: "array", of: { kind: "unknown" } };
  // ONE traversal. Every element is inferred exactly once and the element shape
  // is derived from these results, which is what keeps array nesting linear.
  const shapes = items.map((item) => infer(item, depth + 1, ctx));
  return { kind: "array", of: mergeElementShapes(shapes) };
}

function inferObject(value: Record<string, unknown>, depth: number, ctx: Ctx): JsonShape {
  const fields: ShapeField[] = [];
  // `Object.keys` is the key order of the source text, so the generated interface
  // reads in the same order the JSON did.
  for (const key of Object.keys(value)) {
    fields.push({ key, shape: infer(value[key], depth + 1, ctx), optional: false });
  }
  return { kind: "object", fields, allKeysPresent: true };
}

/**
 * Collapse the shapes of an array's elements into the ONE shape its elements have.
 *
 * - identical elements -> that shape
 * - all objects -> merged field-wise; a key missing from any element is optional
 *   and a key whose shapes differ becomes a union of what was actually seen
 * - otherwise -> a union of the distinct element shapes, never `any`
 */
export function mergeElementShapes(shapes: JsonShape[]): JsonShape {
  const distinct: JsonShape[] = [];
  for (const shape of shapes) {
    if (!distinct.some((seen) => sameShape(seen, shape))) distinct.push(shape);
  }
  if (distinct.length === 0) return { kind: "unknown" };
  if (distinct.length === 1) return distinct[0];
  if (distinct.every((shape) => shape.kind === "object")) {
    return mergeObjectShapes(distinct as Array<Extract<JsonShape, { kind: "object" }>>);
  }
  return { kind: "union", of: distinct };
}

/**
 * Field-wise merge of object shapes. A key absent from any element is optional;
 * that is the only thing in the whole module that may set `optional: true`.
 */
function mergeObjectShapes(objects: Array<Extract<JsonShape, { kind: "object" }>>): JsonShape {
  const order: string[] = [];
  const seenIn: Map<string, number> = new Map();
  const shapesByKey: Map<string, JsonShape[]> = new Map();

  for (const object of objects) {
    for (const field of object.fields) {
      if (!shapesByKey.has(field.key)) {
        shapesByKey.set(field.key, []);
        order.push(field.key);
      }
      shapesByKey.get(field.key)?.push(field.shape);
      seenIn.set(field.key, (seenIn.get(field.key) ?? 0) + 1);
    }
  }

  const fields: ShapeField[] = order.map((key) => {
    const shapes = shapesByKey.get(key) ?? [];
    const distinct: JsonShape[] = [];
    for (const shape of shapes) {
      if (!distinct.some((seen) => sameShape(seen, shape))) distinct.push(shape);
    }
    return {
      key,
      shape: distinct.length === 1 ? distinct[0] : { kind: "union", of: distinct },
      optional: (seenIn.get(key) ?? 0) < objects.length,
    };
  });

  return { kind: "object", fields, allKeysPresent: fields.every((f) => !f.optional) };
}

/**
 * Structural equality, used for every duplicate check.
 *
 * Deliberately not `JSON.stringify`: serializing a subtree to compare it
 * allocates a copy of that subtree, and doing it once per array element was
 * measured at 3-11x the size of the input. Unions compare in order, which is
 * fine because every union here is built in first-seen order.
 */
export function sameShape(a: JsonShape, b: JsonShape): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "object": {
      const other = b as Extract<JsonShape, { kind: "object" }>;
      if (a.fields.length !== other.fields.length) return false;
      if (a.allKeysPresent !== other.allKeysPresent) return false;
      for (let i = 0; i < a.fields.length; i += 1) {
        const left = a.fields[i];
        const right = other.fields[i];
        if (left.key !== right.key || left.optional !== right.optional) return false;
        if (!sameShape(left.shape, right.shape)) return false;
      }
      return true;
    }
    case "array":
      return sameShape(a.of, (b as Extract<JsonShape, { kind: "array" }>).of);
    case "union": {
      const other = (b as Extract<JsonShape, { kind: "union" }>).of;
      if (a.of.length !== other.length) return false;
      return a.of.every((shape, i) => sameShape(shape, other[i]));
    }
    default:
      // null, string, number, boolean and unknown carry no payload: the kind is
      // the whole of them.
      return true;
  }
}
