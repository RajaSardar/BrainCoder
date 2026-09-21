# Image to PDF: Parallel Judges Audit

Date: 2026-09-21. Status: twenty-first tool upgraded and verified —
last of the three-tool wave covering css-cursor, gzip-tool and
image-to-pdf (judged, upgraded and verified independently in parallel;
this report covers image-to-pdf). All ten judges returned usable reports
(one first-pass report was lost to a rate limit and re-run; none of its
findings went un-surfaced — every issue it raised appears in the
architect/edge-case/functional reports below). All gaps were runtime
closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | `buildPdf` wraps `doc.save()` in try/finally — no catch, so a failure (e.g. an image removed during the build, or an un-embeddable frame) silently aborts with no message. `bytes.buffer.slice(...)` would serve, but `Blob([bytes])` with a non-ArrayBuffer-backed view carries trailing bytes. Fit mode has no downscale — a 4032px photo yields a 56-inch page |
| Technical architect | `result.bytes.buffer` is used raw as an ArrayBuffer even though `new Uint8Array(result.bytes)` is chunk-backed — Blob content is padded with trailing zeros. Object URLs are created per image and never released (no unmount revocation). No dedup of repeated drops → memory growth. Same remove-button accessible name on every card |
| End-user UX | Drag & drop and reorder are promised in copy but no drop handlers and no move controls exist. No busy state during the (synchronous) PDF build — the tab freezes silently. The success path gives zero feedback (the download just happens) |
| Content/SEO | features promise custom page dimensions, orientation selection, drag-and-drop reordering, and animated-GIF "conversion" — none implemented (GIF was rendered via a canvas fallback so only the first frame is ever captured). howTo describes a reorder UI that doesn't exist. Tagline/description promise "orientation" (no such control) |
| Business analyst | Core value = quick merge of images to PDF with page-size choice, all client-side. MUST: drop the false animated-GIF/`orientation`/custom-dimension marketing, MUST reorder the build so failures surface, SHOULD: real drag-drop order control, PDF page-count feedback, removal during build |
| A11y specialist | HIGH (Level A): both the `<select>` and the margin `<input type=range>` are unlabelled — the shared `Field` renders `<label>` as a `<p>` (no htmlFor). Margin range has no `aria-valuetext` and uses a hardcoded width slider. `role=alert`/live-region missing for build errors; removal buttons all announce "Remove image"; busy not announced |
| Security/privacy | pdf-lib 1.17.1 is old (no active advisory; pinned ages). tab-local DoS by dropping hundreds of multibyte images — no caps at all. Object URLs held for the page lifetime (leak-ish). No egress, no storage writes — otherwise clean |
| Edge cases | An image removed from the list while a build is running is fetched at `fetch(url)` AFTER revocation → the whole build dies. Zero-dimension image → NaN/Infinity page sizes in the PDF. TIFF/HEIC are dropped silently (the input filter says images but those formats produce load failure). `pdf-lib` writes `/Count` in Object Streams — page-count assertions must not grep the raw bytes |
| Performance | The build is a single synchronous WebAssembly pass — acceptable, but progress ("Building page x of N") is trivial to add and the raw `bytes.buffer` bug makes even the happy path larger than it should be. Dropping the same file twice rewrites identical pages |
| SSR/cross-browser | Client-only pdf-lib; mounted feature gate needed so canvas/worker availability is settled before the build buttons enable. SSR-safe by construction; routes smoke 200 |

## Changes And Evidence

- `src/features/image-to-pdf/ImageToPdf.tsx` (rebuilt):
  - **Build no longer silently abortable (functional, edge, architect):**
    `buildPdf` snapshots the added items at start (a removal mid-build can
    never revoke the URL being resumed), wraps each embed in its own
    try/catch with a canvas→JPEG fallback so one bad frame can't kill the
    whole PDF, counts `ok` pages, and always terminates with visible
    feedback: a success `role=status` naming the page count or an error in
    `role=alert`. busy state disables Add/remove/move/download and the
    root is `aria-busy`.
  - **Correct bytes (architect):** the download now builds the Blob from an
    exact-size copy of the buffer
    (`bytes.buffer.slice(byteOffset, byteOffset + byteLength)`) so no
    trailing zero padding is served.
  - **Fit mode can no longer corrupt (functional, edge):** page dimensions
    are clamped to `MAX_PAGE = 14400` (the PDF integer limit) with a
    scale-to-fit + centered white-background draw — a 4032px photo now
    produces a bounded page instead of a 56-inch one, and zero-dimension
    images can't yield NaN/infinity pages.
  - **Reorder + dedup + drop (functional, UX, business):** move up/down
    buttons (disabled at the edges and while busy, with the file name in
    each accessible name), dedup by name+size so repeated drops are
    rejected with a message, and real drop handling on the empty state and
    the grid while idle.
  - **A11y (a11y):** the size `<select>` gets a `useId`-backed
    `<label htmlFor>`; the margin control uses the shared `SliderField`
    (label htmlFor) and is only shown when a real page size is selected
    (fit mode ignores margins — no dead control); remove buttons announce
    `Remove <filename>`; move buttons announce `Move <filename> up/down`;
    buttons carry the house focus ring; status/error live regions added.
  - **Hygiene (security, perf, architect):** object URLs are tracked in a
    `urlsRef` Set, revoked on unmount and freed when an item is removed;
    root `aria-busy` + progress "Building page x of N".
- `src/lib/tool-content.ts`: image-to-pdf block rewritten — features now
  honestly scope formats (JPG/PNG/WebP/BMP/GIF with GIF pinned to a static
  first frame), page-size/margin options (fit/A4/Letter, no custom
  dimensions, no orientation), drag-drop add, reorder via move controls,
  client-side processing and free; howTo rewritten in four honest steps
  (the phantom reorder UI reference removed); FAQ answers which formats are
  supported, mixed sizes, the no-upload privacy answer (kept) and honestly
  scopes GIF behavior.
- `src/lib/seo.ts`: image-to-pdf keyword row + JSON-LD featureList override
  added; animated-GIF/`orientation` terms removed.
- `src/lib/tools.ts`: description rewritten "Turn one or more JPG, PNG or
  WebP images into a single PDF with page size, margins and fit options." —
  the `orientation` promise is gone (H1 already honest).

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Production build passed — static pages 287/287 (single build for the
  three-tool wave).
- `e2e/image-to-pdf-browser.mjs` — 30 production Chrome scenarios, 30/30
  green: Add-images button + labelled select; fit/A4/letter options; the
  empty state promises drag-drop; no margin slider in fit mode; two PNGs
  add in order via `setInputFiles` with a `role=status` count and a queued
  summary; a duplicate name+size is rejected; move-up reorders and
  disables at the first position; remove buttons carry a distinct
  accessible name; the downloaded PDF has the `%PDF` magic and exactly 2
  pages (`PDFDocument.load` + `getPageCount` — pdf-lib emits `/Count` in
  Object Streams so raw-byte grep is wrong); build reports "N pages";
  drag-and-drop over the grid adds an image; A4 exposes the margin slider
  and a 3-image build yields 3 pages; an unloadable image reports a
  `role=alert` and is not queued; removing all images restores the
  drop-friendly empty state with the queued count back to 0; `/use` +
  `/tools` 200; marketing copy pins GIF to a static first frame, documents
  reordering, and contains no orientation/landscape or custom-dimensions
  claim; zero hydration errors; zero page errors.
- Wave-1/2/3 harnesses re-run green against the same build.

## Residual (shared, not re-reported)

Site-header 375px nav overflow; `'unsafe-eval'` CSP; `/verify` wording;
ToolPreview upload mock; WebKit not runnable in harnesses; Next.js route
announcer `__next-route-announcer__` `role=alert` present on every page.
pdf-lib 1.17.1 remains pinned (no active advisory); TIFF/HEIC inputs are
not image formats here and show a load-failure message.