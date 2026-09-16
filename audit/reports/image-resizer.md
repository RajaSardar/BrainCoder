# Image Resizer: Parallel Judges Audit

Date: 2026-09-16. Status: third tool upgraded and verified within the coverage
below. This was the first tool whose ten judges ran in parallel.

## Ten Independent Judges

Each judge was a separate agent; none was replaced with a single agent
pretending to be all ten experts. Per the user's directive they were launched
concurrently because they are read-only and independent.

| Expert | Main findings |
| --- | --- |
| End user | No DnD despite claiming it, no resized preview, silent corrupt-file failure, preset claim false, outcome never communicated |
| Image domain | No caps on dims/decode, JPEG white-fill undocumented, animation/ICC loss, EXIF risk low, "pixel-perfect" overstated for upscale |
| Technical architect | Effect cleanup revokes live preview URL on result change (breaks next resize), stuck spinner, stale-result race, huge canvases, formatBytes >=1TiB |
| Code reviewer | NaN/Infinity dimensions poison inputs and block resize (Number("1e")), spinner stuck, Field labels not real labels |
| Functional tester | Full browser test plan with exact numeric assertions (500×375, aspect math, alpha behavior, corrupt/heavy/edge cases) |
| Business analyst | 4 FALSE/partial marketing claims (presets, resized preview, drag & drop, output dims display); unique niche vs image-compressor; tagline overstatement |
| Content/SEO | Same false copy pinpointed with proposed copy, keyword set honest, missing guide scoped, relatedSlugs clean |
| Security/privacy | Client-side flow byte-safe and truly local; unbounded decode/alloc risk; EXIF/GPS stripped in output (privacy-positive); site-shell requests are analytics/page only |
| Accessibility | Unlabeled inputs, icon-only reset, no live region/focus, format selector visual-only, dropzone Space + aria gaps, contrast/target notes |
| Performance | CRITICAL effect-revoke bug + stuck-spinner confirmed; reset/file-change not guarded against in-flight resize; toBlob-null silent; caps recommended |

Consolidated critical/important defects matched across judges and fixed.

## Changes And Evidence

- `src/features/image-resizer/ImageResizer.tsx` rebuilt: safe dimension
  state (`clampDim` -> 1..8192, NaN/Infinity-safe), 40-megapixel budget,
  50MB file cap, request-token guard against stale in-flight results and
  post-unmount leaks, split URL-revoke effects (fixes the live-preview revoke
  bug), try/catch/finally resize with visible `role="alert"` errors,
  Promise-wrapped toBlob with null handling, preset chips (256×256, 640×360,
  1080×1080, 1280×720, 1920×1080), real drag & drop, resized-image preview
  with result dimensions and size, focus to a result heading, `role="status"`
  live region, radio-group semantics for presets and format, keyboard- and
  aria-complete dropzone, `motion-reduce` spinner, touch-target min-h-11,
  sanitized download filename, always-visible reset that restores defaults.
- Content (`tool-content.ts`): features/howTo/FAQ rewritten to match the
  implementation (presets, preview, drop, re-encoded output dims/size,
  caps of 8,192px and 50MB, JPEG flatten, metadata/EXIF not preserved);
  longDescription softened to "in seconds"; related links unchanged.
- SEO (`seo.ts`): honest keyword extensions (resize photo online, resize to
  1920x1080, aspect-ratio lock, resize without uploading).
- Guide (`guides.ts`): new `how-to-resize-an-image-online` with toolSlug,
  covering behavior, bleed-through, and private processing.
- Shared `format.ts`: `formatBytes` now clamps the size index instead of
  emitting "undefined" at >=1TiB (used by this tool's download button).
- Verification: 3 node checks (`e2e/image-resizer.mjs`) and 28 production
  Chrome scenarios (`e2e/image-resizer-browser.mjs`) passed, including corrupt
  file, >50MB rejection, drag & drop load, aspect lock, presets, PNG/JPEG/WebP
  export with byte-level assertions, alpha flatten to opaque white, NaN/
  oversize/area-cap guards with no stuck spinner, repeat-use coherence, reset,
  and a 375px mobile no-overflow check. Production build passed (281 pages).
  Targeted lint passed exit 0.

## Remaining Limits

Not runtime-verified: physical mobile devices, Firefox, Safari, real
screen-reader passes, or cross-engine canvas behavior for the largest sizes.
Main-thread resize (no worker) still janks on very large images — capped by the
new pixel budget. EXIF orientation relies on implicit browser decode
orientation. The selected-state contrast (white on emerald-600) matches the
design system used site-wide; a future system-level pass could darken it. The
shared site header nav can still overflow horizontally at 375px — a shared-site
item already logged in the Image Compressor report. The shared /verify audit
wording and coverage concerns remain pending, not silently certified by this
tool's tests.

Other tool worktree changes found at session start were preserved, not approved
or counted as completed audits. No other tool has completed the ten-judge
process beyond PDF Compressor, Image Compressor, and Image Resizer.

Next tool: JSON Formatter, the next entry after Image Resizer in the registry.