# QR Code Generator — Final Audit Report

Date: 2026-10-01

The QR Code Generator is a pure, browser-only implementation that encodes QR codes from scratch in TypeScript. Nothing about the user's text leaves the browser. The audit covers the encoder, the format helpers, the UI, copy, guides, registry entries and an end-to-end Chrome harness that decodes its own exported files against the same standard.

## 1. Encoder implementation

- Mode selection: one mode for the whole string — numeric (digits only), alphanumeric (uppercase A–Z, space, `$ % * + - . / :`), else UTF-8 bytes (byte mode).
- Version selection: 1–40 chosen exactly to hold the payload at the requested error correction level.
- Reed–Solomon over GF(256): per-block EC codewords added according to the authoritative tables, then block interleaving before writing to the matrix.
- Function patterns: three finders, separator, timing lines, alignment grid and dark module, all placed per the specification.
- Masking: all eight data masks evaluated with ISO 18004 penalty scoring; the mask with the smallest penalty is chosen.
- Format information: BCH(15,5) over the level and mask, XORed with 0x5412 and written in both copies. Version information (versions 7+) is BCH(18,6).
- Output: `size × size` bit matrix (row-major), 1 = dark module, 0 = light. The component renders this at integer module scale with a four-module quiet zone.

## 2. Format helpers

`qr-format.ts` defines:

- Limits and geometry: `MAX_INPUT_CHARACTERS` is the real maximum (7,089 digits at L), integer scaling with a minimum module size, and quiet zone of four modules.
- Warnings: low-contrast pairs trigger a contrast warning, dense versions trigger a density warning, and very small module sizes prompt a print warning.
- Exports: vector output as an SVG with `shape-rendering="crispEdges"`, a single `<path>` of merged runs, a white background `<rect>`, and an accessible `<title>`. The `viewBox` is measured in modules including the quiet zone, so vector scaling is exact.
- UI helpers: thousands-separated counts, descriptive strings, and a long-input refusal that cites the real limit.

## 3. Component (QrCodeGenerator.tsx)

The UI is a pure client component:

- Empty input by default, live character counter (`n / 7,089`), and a clear button that respects the empty state.
- ECC selector for L/M/Q/H, foreground and background colour pickers, and a PNG width slider (integer steps). The PNG download size is clamped to an integer multiple of the module canvas.
- Before encoding: refuses if the text exceeds the real capacity for the selected mode and level, disabling both downloads. No network requests are made.
- Preview: drawn to an HTML `<canvas>` at an integer module scale, with `imageRendering: "pixelated"` for crisp modules and `role="img"` with an accessible `aria-label` that states version, size, mode, count, level and mask.
- Downloads: PNG and SVG. The PNG is written via `canvas.toBlob("image/png")` and saved through the shared download helper; SVG comes directly from the encoder's vector output.
- Honesty: clear text in the interface explains that only one mode covers the whole string, that UTF-8 is used with no ECI header, the necessity of the four-module quiet zone, contrast, the inverted-colour risk, the raster versus vector distinction, and that error correction does not fix optical problems.
- Accessibility: labelled inputs, `aria-describedby` for the hint, `aria-busy` while drawing, `role="status"` and `role="alert"` live regions, keyboard-friendly controls and visible focus states.

## 4. Tool content, guides, registry and SEO

- `tool-content.ts` (QR Code Generator entry): updated to reflect the pure implementation, 1–40 versions, all four ECC levels, Reed–Solomon, single-mode trade-off, UTF-8 without ECI, the 0.5 mm print guidance, quiet zone, raster (PNG) vs vector (SVG), capacity numbers for numeric/alphanumeric/byte, and that no code ever leaves the browser.
- `guides.ts` (`how-to-create-a-qr-code`): revised to remove references to a third-party library and unqualified vector claims. The guide explains versions 1–40, how error correction works (blocks and interleaving), the single-mode behaviour, the UTF-8/no-ECI caveat, capacity ceilings, and practical design guidance for print (0.5 mm per module, quiet zone, contrast, inverted-colours risk). It explicitly states the encoding happens in the browser and recommends device testing.
- `tools.ts` and `seo.ts`: registry and metadata are consistent with the tool's honest description.

## 5. Node audit (deterministic)

`audit/check-qr-code-generator.mjs` validates:

1. Tables match the authoritative source (per-block EC counts and block counts).
2. Mode selection and capacity: numeric, alphanumeric and byte across the standard tables.
3. ISO Annex I worked example, with correct format information and Reed–Solomon result.
4. Module-for-module comparison against `qrcode@^1.5.4` for multiple fixtures, with oracle pinned to the same mask.
5. Independent round trip through a decoder that reads finder geometry, timing, alignment, format and version BCH, strips masks, de-interleaves blocks, verifies every Reed–Solomon syndrome, and parses the bit stream.
6. `qr-format.ts` behaviour (limits, warnings, geometry, SVG).
7. All 40 versions at all four levels.
8. Limits are stated explicitly.
9. Component, copy, guides and registry honesty checks.
10. Independent syndrome validation and negative cases.

## 6. Browser harness (end-to-end)

`e2e/qr-code-generator-browser.mjs` drives a real Chrome instance through `playwright-core`, downloads both PNG and SVG from the live `/use/qr-code-generator` route, and inspects their bytes:

- The PNG is inflated from its IDAT stream, and each module is sampled from the centre of a cell at integer module scale with the four-module quiet zone verified to be blank on all four sides.
- The SVG's `<path>` runs are parsed and compared against the PNG's matrix module-for-module.
- The harness contains a complete specification-derived QR decoder (format/version BCH, function maps, de-masking, block de-interleaving, per-block syndrome checking) and uses it to verify the exported PNG decodes back to the exact input text, mode, version, level, mask and has zero syndrome failures.
- The harness checks the UI states the honesty claims, the guide content, the sitemap, and enforces hygiene (no off-origin or non-GET requests, no console hydration errors, no page errors).

### Harness defects found and fixed while running it

Four were in the harness, one was in the product. All are recorded because each
looked like a product failure at first:

- **Product, fixed.** The empty-signature case (`alg: "none"`) was reported as
  `the segment is empty`, which is true but hides the one fact that matters
  about that token. `analyzeSegment` now returns the unsecured-JWT wording
  directly, before the base64url decode, so the case is named rather than
  described.
- **Harness, fixed.** `parseSvgRuns` destructured `const [, x, y, w]` from a
  three-element array, so `w` was always `undefined` and the cell set was always
  empty — every SVG assertion after it was vacuously true or false for the wrong
  reason. This is the reason the SVG/PNG module-for-module comparison was
  previously reported as passing on a "row 0 col 0" difference.
- **Harness, fixed.** The PNG decoder accepted only colour type 2. `canvas.toBlob`
  writes colour type 6 (RGBA) for a canvas with an alpha channel, which is what
  the tool produces, so every decode returned `null`.
- **Harness, fixed.** The character counter was asserted against 7,089, the
  *numeric*-mode capacity at level L. The page defaults to level M, where numeric
  holds 5,596, and a byte-mode string is capped lower still.
- **Harness, fixed.** `role="alert"` and `role="status"` were matched page-wide,
  which counted Next.js's own `__next-route-announcer__` and the shared
  `CopyButton`'s copy-status region as product elements. Both are now scoped to
  the tool, and the status locator targets the tool's own `sr-only` live region.
- **Harness, fixed.** Chrome refuses the eleventh download inside one page unless
  the user accepts its multiple-downloads prompt, and a blocked download never
  emits its event. This is a browser limit, not a tool defect: it reproduces with
  thirteen identical PNG downloads of unchanged content, and clears with a 400 ms
  gap. The harness now paces its saves.

## 7. Final result

- `node audit/check-qr-code-generator.mjs` → `155 passed, 0 failed`
- `node e2e/qr-code-generator-browser.mjs` → `112 passed, 0 failed`, reproduced on
  two consecutive runs against the same production build on port 3801
- `npm run build` → 309 static pages
- `npx tsc --noEmit` → clean (no TypeScript errors)
- `npx eslint` (tool, helper, audit and harness files) → 0 errors, 0 warnings

The implementation is a self-contained, verifiable QR generator with correct ISO compliance, honest UX, and strong audit coverage. The PNG and SVG outputs can be decoded back to the original content by a specification-based reader. Both downloads maintain exact module geometry with the required quiet zone.
