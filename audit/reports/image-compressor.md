# Image Compressor: Sequential Audit

Date: 2026-09-16. Status: second tool upgraded and verified within the coverage
below. The user then directed that future judge runs proceed in parallel because
the ten experts are read-only and independent.

## Ten Independent Judges

Each judge was a separate agent; none was replaced with a single agent
pretending to be all ten experts. Image Compressor's judges ran before the
parallel-directive took effect, so they ran one at a time.

| Order | Expert | Main findings |
| --- | --- | --- |
| 1 | End user | Invisible compress errors, falsified results, choices beaten by auto |
| 2 | Image domain | AVIF/WebP/auto format mishandling, apply-compute duplicated work |
| 3 | Technical architect | Worker reachability, canvas dims, quality rescale, no cleanup |
| 4 | Code reviewer | Wrong mime emission, dead code, mislabeled source bytes |
| 5 | Functional tester | Ran isolated probes; confirmed Auto crash and silent error path |
| 6 | Business analyst | Position as local recompression with a never-bigger guarantee |
| 7 | Content/SEO | False slider/batch/instant claims, missing guide, thin keywords |
| 8 | Security/privacy | In-memory only, no uploads, worker/fallback decode barriers |
| 9 | Accessibility | Native chips not radios, dismissible alert not announced, no focus |
| 10 | Performance/reliability | Step-down resizing, bounded pixel counts, worker timeouts |

Judges were read-only; implementation began after judge 10 completed. Judge 5
ran actual isolated probes. Static inspection was not counted as browser testing.

## Changes And Evidence

- Engine/client/worker/UI fixes: this report covers the highlights; the
  implementation was a single read-only-privileged agent applying 29 fixes
  across 7 files.
- Confirmed critical defects fixed:
  - Default "Auto" format crashed in the worker (`document` referenced inside
    `pickOutputMime` in Web Worker context).
  - All compression errors were invisible: the alert was gated on
    `error && !file`, which can never fire after a successful selection.
  - Never-larger fallback mislabeled kept original bytes as JPEG.
  - Unsupported AVIF encodes were silently mislabeled instead of rejected or
    downgraded with the real format.
- Engine (`compress-image.ts`): format/mime table, exported `sniffImageMime`,
  quality-only presets, unconditional never-larger fallback that preserves the
  sniffed source type, encode-with-fallback chain that labels output by actual
  blob type, zero-dimension and 40-megapixel guards, and a step-down canvas
  ladder that starts at `max(target, source/2)` with high smoothing.
- Client/worker (`client-image.ts`, `imageCompression.worker.ts`):
  `ImageCompressionResult` carries the real blob, request-id correlation,
  120s timeout with worker termination on expiry, a main-thread availability
  probe for "Auto", and correct transferables. Dead fields/helpers removed.
- UI (`ImageCompressor.tsx`): unconditional `role="alert"` error banner,
  `role="status"` live region, native radio groups with `aria-checked` and
  visual selected state, `type="button"` everywhere, deterministic result
  heading focus, HEIC/empty/oversize/non-image guards, honest skipped wording
  ("unchanged", "never larger"), keyboard-accessible dropzone, larger touch
  targets, and reduced-motion support.
- Content: the image-compressor landing block was rewritten honestly (presets,
  single file up to 50MB, never-bigger guarantee, no slider/batch/instant
  claims), related tools gained pdf-compressor, a new
  `how-to-compress-an-image-online` guide was added, and SEO keywords expanded.
- 5 node-side checks for the pure logic and 24 production Chrome scenarios
  passed (`e2e/image-compressor.mjs`, `e2e/image-compressor-browser.mjs`).
- Production build passed, generating 280 pages (previously 279). Targeted
  lint passed with exit 0.

## Remaining Limits

Real encoders for AVIF/WebP are exercised only inside Chrome/Chromium here;
runtime verification on Firefox/Safari, physical mobile devices, and manual
screen-reader passes are unverified. Reducing a very large image to its final
size inside a single step is preserved as a future optimization. The shared
site header nav can overflow horizontally at 375px on this route — a
shared-site item, not part of this tool's subtree, recorded here for a future
pass. The shared /verify audit wording and coverage concerns remain pending,
not silently certified by this tool's tests.

Other tool worktree changes found at session start were preserved, not approved
or counted as completed audits. No other tool has completed the ten-judge
process beyond PDF Compressor and Image Compressor.

Next tool: Image Resizer, the next entry after Image Compressor in the registry.