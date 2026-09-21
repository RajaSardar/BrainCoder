# Gzip Tool: Parallel Judges Audit

Date: 2026-09-21. Status: twentieth tool upgraded and verified — second
of the three-tool wave covering css-cursor, gzip-tool and image-to-pdf
(judged, upgraded and verified independently in parallel). All ten
judges returned usable reports; the capability gaps were runtime-closed
and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | "Compress to base64" produced no output value the page lets you copy as text (no result field). "Raw bytes" claim is a lie — the page cannot read raw bytes, only text. Compress file + Decompress file advertise JSON payload output that is not implemented |
| Technical architect | The component cannot actually perform raw-bytes decompression, so "decompresses raw bytes" and "auto-detects gzip/zip/rar" claims are wrong; `bytesToBase64` used `String.fromCharCode(...bytes)` spread over the WHOLE buffer (stack overflow on large files) |
| End-user UX | Output area just says "Text to compress" prepended — no format pills visible as controls; decompress has to guess the format and the tool never tells you what it detected; no progress on big jobs; pasted binary shows garbage |
| Content/SEO | features promise "JSON payload for your scripts" and "data URI" and "raw byte string" modes — none exist. FAQ claims auto-detect over gzip/zip/rar. Descriptions mention a file drag-drop that is not present |
| Business analyst | Real value = reliable text compression + download + a JSON payload for programmatic consume. MUST: honest format list (gzip/deflate/deflate-raw), MUST remove data-URI/raw-bytes claims, SHOULD: true base64 output field, detected-format report |
| A11y specialist | Textarea has no label (`<p>` with no htmlFor). The format switcher is unlabelled button soup (no `role=group`, no `aria-pressed`). Output region is a plain div with no `aria-label`/live semantics. Busy state not announced |
| Security/privacy | Decompression at unbounded size can OOM the tab (`new Blob(...).text()` on attacker-supplied payloads like 20MB nesting bombs). Had there been raw-bytes support the `String.fromCharCode` spread would be a second vector. No egress. No caps on input file size |
| Edge cases | Binary input from base64 must NOT print U+FFFD — it should be detected and offered as Download original bytes. JSON payload keyed by an arbitrary key (not `data`). Trailing whitespace/newlines in base64 pastes; a plain-text paste must not be mis-detected and fail with a clear error |
| Performance | big text to compress should be capped; the display should truncate huge decompressed output while keeping full data for copy/download |
| SSR/cross-browser | CompressionStream is not universal (Firefox/some WebKit); must feature-gate with an honest banner instead of crashing on a missing constructor. Otherwise hydration-safe (all client-side) |

## Changes And Evidence

- `src/features/gzip-tool/GzipTool.tsx` (rebuilt):
  - **True base64 output (functional, business):** the output region now
    shows the compressed value as text and the Copy button writes the
    exact base64 string; JSON payload mode emits `{"key":true,"data":…}`
    where the key is the active format and `data` is the base64 stream —
    and the Download button unwraps the payload to the raw `.gz`/`.deflate`
    bytes so scripts get exactly what the copy promises.
  - **Correct binary handling (edge, functional):** bytes are decompressed
    with a `Uint8Array`/`ArrayBuffer` response and classified binary by
    NUL-byte/`U+FFFD` heuristics; binary results are never printed as
    garbage — a warning message plus a Download original bytes action
    replaces the FFFD soup. `String.fromCharCode` spread replaced by a
    chunked (32 KB) loop so large files don't overflow the stack.
  - **Honest scope (content, architect):** format list is exactly
    gzip / deflate / deflate-raw. The "data URI" and "raw byte string"
    claims are deleted; copy documents the three formats, the JSON payload
    shape, the binary-download fallback and a 64 MB decompressed cap.
  - **A11y (a11y):** `useId` + `<label htmlFor="gzip-input">` on the
    textarea; the format pills live in a `role=group aria-label="Compression
    format"` with `aria-pressed`; the output region is `role=region
    aria-label="Output" aria-busy`; progress/result lines are `role=status`
    and errors `role=alert`.
  - **Caps + gate (security, performance):** input capped at 20 MB with a
    disclosed note; decompressed output capped at 64 MB; display truncates
    at 200 KB with a retained-note while copy/download still use the full
    data. Feature-gate banner (a `role=alert` in browsers without
    `CompressionStream`) replaces a blank-core crash. Mounted state is
    booted via a `setTimeout(0)` deferred effect so SSR and first client
    render match.
- `src/lib/tool-content.ts`: gzip-tool block rewritten — features list
  the three real formats, base64 or JSON-payload output, binary→download
  handling and 100% client-side processing; howTo rewritten in four honest
  steps; FAQ scoped to the same formats (gzip/zip/rar auto-detect claim
  removed) with the privacy answer kept.
- `src/lib/seo.ts`: keyword row + JSON-LD featureList override added,
  matching the served formats.
- `src/lib/tools.ts`: description now reads "Compress text or files to
  gzip, deflate or deflate-raw right in your browser, or decompress them
  back. Zero uploads." (data-URI/raw-bytes claims dropped).

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Production build passed — static pages 287/287 (single build for the
  three-tool wave).
- `e2e/gzip-tool-browser.mjs` — 33 production Chrome scenarios, 33/33
  green: labelled textarea; three pills with gzip default `aria-pressed`;
  no feature-gate banner on Chrome; base64 output starts `H4sI`; copy
  writes the exact base64 (clipboard compare); browser gzip cross-checks
  against Node `gunzipSync`; decompress base64 restores the text and the
  status names the detected format; JSON payload `{"zlib":true,"data":…}`
  parses, its Download yields a `.gz`-magic file that gunzips to the
  original, and decompressing the payload reports the key; base64 Download
  stores the raw `.gz` bytes; a binary payload warns and Download original
  bytes is byte-identical to the source; plain text is not mis-detected
  (clear `role=alert`); a 432 KB decompressed result is display-truncated
  with the retained note while copy still delivers the full string; file
  Compress downloads a valid `.gz`; file Decompress auto-detects gzip;
  deflate pill selects and produces zlib-flavoured output; `/use` +
  `/tools` 200; marketing copy documents deflate-raw and contains neither
  a "data URI" nor a "raw bytes" claim; zero hydration errors; zero page
  errors.
- Wave-1/2/3 harnesses re-run green against the same build.

## Residual (shared, not re-reported)

Site-header 375px nav overflow; `'unsafe-eval'` CSP; `/verify` wording;
ToolPreview upload mock; WebKit not runnable in harnesses; Next.js route
announcer `__next-route-announcer__` `role=alert` present on every page.