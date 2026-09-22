# PDF to PPT: Parallel Judges Audit

Date: 2026-09-22. Status: twenty-sixth tool upgraded and verified — the
second tool of the current wave. Ten judges returned; every gap they raised
was runtime-closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | No MAX_PAGES / MAX_FILE_BYTES / MAX_CANVAS_AREA guards (unbounded memory); encrypted PDF surfaced the raw "No password given"; corrupt PDF surfaced the raw "Invalid PDF structure"; the scale slider did nothing after conversion (auto-render captured the first pick only); the preview `<img>` grid was unbounded; dataURL→zip round-trip was byte-identical but string-heavy |
| Technical architect | CRITICAL — dataURL-string pipeline holds every page as a base64 string plus atob copies (≈400–550 MB peak at 50 pages ×3x); no page/file guards; all main-thread; page objects never cleaned, task never destroyed; no `data.slice(0)` (pdf.js detaches the input buffer); no runId for rapid re-picks; ad-hoc `new Blob([bytes.buffer])` + immediate revoke duplicated the shared `downloadBlob` |
| End-user UX | Marketing lied on five axes (editable slides/text boxes, drag-and-drop, slide options/dimensions, a real convert button, any-length support); no progress feedback during render; buttons never disabled while busy; preview grid unbounded; error states had no `role=alert`; the quality slider was dead after conversion; "Saved base.pptx" wording; the file auto-downloaded before any preview |
| Content/SEO | "editable slides"/"text boxes and layout structure" claims false; how-to described drag-and-drop, a convert button and slide dimensions that didn't exist; "any length" needed a stated ceiling; the page-range FAQ would only become true once the feature was real; missing SEO keywords/featureList; no guide; no reciprocal link from pdf-to-image |
| Business analyst | Core value = a fast 16:9 deck of faithful page snapshots with honest scope. MUST: promise only snapshots, disclose non-editable text; SHOULD: page range, previews, progress, real filename, caps; recommend PDF-to-Text/Markdown (not PDF-to-Word, a different promise) when users need editable text |
| A11y specialist | Slider had no accessible name (the `Field` wrapper renders a `<p>`, not a `<label>`); no status/alert live regions or `aria-busy`; the Choose-PDF button never disabled while busy; the drop zone was an inert div (no `role=button`/keydown); slate-400 text contrast below threshold |
| Security/privacy | Verified XML injection is NOT present — every interpolated value (page indices, slide geometry, constants) is numeric/static; everything client-side; `ensurePdfjsWorker` used. The unbounded per-tab memory was the real (self-inflicted) DoS, not a malicious one |
| Edge cases | Unbounded canvas area: a 10000×10000 pt page at 3x → 9e8 px² (~3.6 GB canvas) → OOM; zero-area/clamped canvas made `k = Infinity` so `cx/cy = Infinity` and `offX/offY = NaN` — structurally corrupt slide XML; no cleanup/sync-zip freezes on huge docs; multiple rapid file picks unguarded; zero-page edge structure |
| Performance | Classic O(N) but with 3–4 simultaneous copies per page (dataURL string, base64, media bytes, Blob) peaking ≈400–550 MB at 50 pages ×3x; synchronous `toDataURL` + `zipSync` at level 6 on already-compressed PNGs (level 0 stores faster); previews rendered full-size then downscaled in CSS instead of tiny thumbnails; worker/page leaks |
| SSR/cross-browser | `use-client` boundary correct, no SSR/hydration risk; extracted OOXML structure is valid (slide/image/rels/layout wiring); Next's docs note acknowledged — patterns mirror existing tools; WebKit not runnable in this environment |

## Changes And Evidence

- `src/features/pdf-office/support.ts`:
  - `renderPdfPages` (shared with pdf-to-word) hardened without breaking its
    contract: `data.slice(0)` passed to every `getDocument` (pdf.js detaches
    the caller's buffer), a `PdfLoadingTask` is created inside `try` and
    `task.destroy()` runs in `finally` (so locked/corrupt loads still free
    the worker), each `page.cleanup()` after render, and a null 2D context
    now throws a friendly oversized-page error instead of silently dropping
    the page. These fixes therefore also land in PDF to Word.
  - NEW `renderPptSlides(data, opts)` — png `canvas.toBlob` **bytes** (no
    dataURL strings) for each target page with `{ scale, maxCanvasArea,
    previewLimit, targets, onPage }`: a `maxCanvasArea` (15,000,000 px²,
    the pdf-to-image convention) and 16,000px max-dimension guard shrink the
    render scale and report `reduced`; previews are genuine downscaled
    thumbnails capped at `previewLimit` (12); the same safe task/page
    lifecycle; `onPage` fires per page for live progress.
  - `buildPptx(slides: PptSlide[])` — accepts `{page, bytes, width, height}`
    and writes the PNG bytes straight into the zip (no atob round-trip).
    Slide geometry now guards against non-finite `k`: `Number.isFinite`
    checks fall back to the full available extent instead of emitting
    `NaN`/`Infinity` coords. `zipSync` runs at `level: 0` (PNG media is
    already compressed; XML handwriting is negligible).
- `src/features/pdf-to-ppt/PdfToPpt.tsx` (rebuilt):
  - No auto-download. Upload renders and previews first; an explicit
    **Download .pptx** button builds and saves the deck as
    `<base>.pptx` via the shared exact-size `downloadBlob`.
  - Caps: `MAX_FILE_BYTES` 100 MB, `MAX_PAGES` 200 per run (error steers to
    PDF Split or a page range), the engine's 15M px² canvas cap with a
    "Reduced the image scale on N pages" notice when hit.
  - **Page range** input with `pageRangeSyntaxError` inline validation
    ("1-3,5", out-of-range, descending) — the FAQ promise is now real. An
    empty range = the whole document. Re-render is automatic; a
    **Re-render** button appears whenever settings are dirty.
  - **Drag-and-drop** enabled (the marketing step now describes reality):
    clickable drop zone with `role=button`, `tabIndex 0`, Enter/Space
    keydown, drag-over prevention and drop handling.
  - Image-quality slider (1×–3×) that actually re-renders (settings-dirty
    flow); labelled via `SliderField`.
  - Progress `role=status` "Rendering slide X of Y", a "Building the .pptx…"
    status, success status with filename/slide-count + privacy note, and
    `role=alert` errors using `friendlyRenderError`:
    PasswordException → "password-protected … unlock it first with PDF
    Unlock", InvalidPDFException → "doesn't look like a valid PDF".
  - `aria-busy` on the root, Choose/Re-render/Download disabled while busy,
    slider and range disabled mid-render, a running `runId` guards rapid
    re-picks/edits. Preview grid capped at 12 with descriptive alt text and
    a note ("slides are snapshot images — text inside them isn't editable").
- `src/lib/tool-content.ts`: pdf-to-ppt entry rewritten to reality —
  full-slide snapshot images, non-editable text disclosed, page range, the
  1–3x quality slider, 12-slide previews, 100 MB/200-page caps, honest
  alternatives (PDF to Text / PDF to Markdown for editable content);
  `relatedSlugs` = pdf-to-image, pdf-to-text, pdf-to-markdown, pptx-creator,
  pdf-to-word (overclaiming pdf-merge/pdf-page-numbers dropped).
  `pdf-to-image`'s relatedSlugs now include pdf-to-ppt (reciprocal).
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-to-ppt"]` + a `TOOL_FEATURE_LIST`
  JSON-LD override describing snapshots, range, quality, previews and caps.
- `src/lib/tools.ts`: description rewritten — "…every page placed on its
  own slide as a snapshot image — pick a page range and image quality…".
- `src/lib/guides.ts`: new guide `how-to-convert-pdf-to-powerpoint`
  (snapshot semantics, quality vs. size, page ranges, privacy, unlock-first
  note) — production build is now **289 static pages**.

## Verification

- `audit/check-pdf-to-ppt-unzip.mjs` (Node, run on the real module via
  `node --experimental-strip-types`) — **18/18 PASS**: 3-slide deck unzips
  with `[Content_Types]` listing all three slides, presentation.xml wiring
  each slide id uniquely, every slide embeds its own image via rId2 with
  rels pointing at the right media/layout; media bytes round-trip intact
  (PNG signature preserved); zero-area, negative and 1e12×1e12 slides all
  produce finite integer coords (no NaN/Infinity, fallback extent used).
- `npx tsc --noEmit` clean; eslint clean on all changed files;
  `npm run build` green (289 pages).
- `e2e/pdf-to-ppt-browser.mjs` — **40 production Chrome scenarios, 40/40
  green** (`BASE_URL http://localhost:3801`, pdf-lib fixtures generated at
  runtime): idle drop zone is focusable/clickable; file input named; slider
  present and labelled; range input present; download button hidden until a
  doc renders; 3-page upload auto-renders 3 previews, "3 slides ready",
  download button appears; full-deck download is `<base>.pptx` with 3 slides
  + 3 images, every slide embeds its snapshot, no NaN/Infinity, and a
  success status naming the file and count; page-range "2" re-renders to one
  preview (page 1 disappears) and the deck contains exactly that page;
  descending and garbage ranges rejected with the friendly message and the
  error clears on empty; encrypted PDF gets the friendly unlock alert that
  points at PDF Unlock; a non-PDF gets "doesn't look like a valid PDF"; a
  210-page doc trips the 200-per-run cap with PDF Split guidance; a 15-page
  doc at 3x shows live "Rendering slide" progress, previews capped at 12,
  "15 slides ready", and the progress status clears; a 4200×3000 poster page
  renders with the "Reduced the image scale" notice; a dropped file converts
  under its own base name; zero hydration errors; zero page errors;
  /tools/pdf-to-ppt copy admits snapshot slides and non-editable text, has
  no "editable slides"/"editable text boxes"/"slide dimensions" claims,
  documents the page range; /tools/pdf-to-image cross-links to PDF to
  PowerPoint; sitemap.xml lists the tool and the new guide.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; /verify wording; ToolPreview upload mocks; WebKit not runnable;
  Next.js route announcer `role=alert`.
- Snapshot slides are the product: decks are images, not editable text —
  disclosed in copy, in the drop zone, in the preview note and via the
  alternatives the tool recommends. 100 MB / 200 pages / 15M px² are the
  documented ceilings; the canvas guard is reported to the user when it
  engages.
- pdf.js remains pinned (no active advisory).