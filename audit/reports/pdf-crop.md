# PDF Crop: Parallel Judges Audit

Date: 2026-09-23. Status: thirty-second tool upgraded and verified — the
second tool of the fourth audit wave. Ten judges returned (PDF domain expert,
functional, technical architect, code reviewer, UX, business, security, a11y,
SEO and performance); every gap they raised was closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Preview (pdf.js honors `/Rotate`) and crop (`getSize()` unrotated MediaBox) disagree on rotated pages, so a standalone `/Rotate 90` page gets its margins cut from the wrong visual edges; no caps; no runId; double-fire of applyCrop (busy guard missing); input value never reset; raw `err.message` |
| Domain expert | **CRITICAL: MediaBox origin dropped.** `getSize()` returns only width/height, and `setMediaBox(x, y, w, h)` re-fixes the origin at `(0,0)`, so a document whose MediaBox starts at `[100 100 712 892]` would have its whole content shifted ~100 pt. Crop must be a CropBox-only edit that keeps MediaBox (and its origin) intact. Also flagged: crop and preview mismatch on rotation; `/Rotate` semantics per production table; TrimBox/BleedBox/ArtBox should be kept in sync; pdf-lib save() defaults regenerate appearances |
| Technical architect | Dual parsers (pdf.js for preview + pdf-lib for model) double the memory and leak the pdf.js worker unless `loadingTask.destroy()` runs; `data.slice(0)` only needed because pdf.js transfers its input buffer; preview rendering competes with crop prep with no runId; overlay div is not non-semantic/ARIA |
| Code reviewer | `ignoreEncryption: true` on a real encrypted PDF silently writes cleartext streams into an `/Encrypt` document (hybrid output that viewers reject) — proven by probe; no sizes expose (percent-only crop); stale slider state across documents is a UX structure question; filename/path casing inconsistent |
| End-user UX | Marketing promises drag-and-drop, "interactive drag handles", per-page adjustments, "inches, millimeters, or pixels" and a phantom "trim option" — none exist. FAQ "Does cropping permanently remove content?" is serialized into schema.org FAQPage JSON-LD with a false guarantee |
| Business analyst | The copy-lies are the top trust risk; FAQ honest rewrite required (crop clips rendering, content stays recoverable, file size ~unchanged); steer encrypted files to PDF Unlock; reciprocal link (crop already lists page-numbers; page-numbers now lists crop) |
| Security/privacy | PASS — no network egress. `ignoreEncryption` is the one foot-gun: removing it is mandatory because the preview gate (pdf.js opens owner-protected files) lets those through to the corrupting path. Hostile inputs bounded by size/page caps |
| A11y specialist | Four `Field`-rendered range inputs with no programmatic labels (use SliderField/htmlFor); no `role=alert`/`role=status`; no `aria-busy`; preview overlay div has no role/name (keep it `role=img` with an aria-label and the raster `img` aria-hidden); slate-400 captions fail AA (~2.5:1) — bump to slate-500 |
| SEO/content | Missing `TOOL_KEYWORDS["pdf-crop"]` + `TOOL_FEATURE_LIST` in seo.ts; no guide (recommended `how-to-crop-a-pdf`); FAQPage JSON-LD consumes the false "trim" answer; tagline "Trim margins" is accurate and untouched |
| Perf judge | pdf.js worker never destroyed (leak for the tab's lifetime); two full parses + save in memory; no yield loop; no caps; save() defaults. Leanest acceptable pipeline: single pdf-lib load in handleFile (validate + count + ratio), pdf.js ONLY for the transient page-1 raster preview with immediate `destroy()`, ratio from pdf-lib not the viewport |

## Changes And Evidence

- `src/features/pdf-crop/PdfCrop.tsx` (rebuilt):
  - **CropBox-only, rotation-aware, MediaBox origin preserved.** A probe of the
    real preview renderer (pdf.js `viewport.convertToViewportPoint`) gave the
    exact media→displayed mapping: `/Rotate 90` is the transpose `(py, px)`, 180
    mirrors x, 270 is `(H−py, W−px)`. `cropBoxFor()` computes the kept rect in
    *unrotated* MediaBox coordinates per page, so the same percentages match the
    preview on mixed portrait/landscape files. The node grid verifies all four
    rotations map to the exact overlay extents. `setCropBox(x,y,w,h)` is applied
    (MediaBox untouched → no content shift for offset-origin documents, e.g.
    `[100 100 712 892]`), and TrimBox/BleedBox/ArtBox are synced when present.
  - **`ignoreEncryption` dropped.** Real encrypted PDFs throw on plain `load()`
    (verified against the RC4 fixture `e2e/fixtures/encrypted.pdf`) and are
    steered to PDF Unlock with a friendly message. A probe proved pdf-lib's
    `ignoreEncryption:true` path produces output whose own reload fails
    (`catalog.Pages is not a function`) — the silent-corruption path is closed.
  - **Two-parser pipeline with a single model.** One pdf-lib `load(...)`
    validates, counts pages and supplies the crop model and preview ratio.
    pdf.js is imported transiently only to rasterize page 1 for the preview;
    its input uses `data.slice(0)`, and `loadingTask.destroy()` runs in
    `finally` on every path. Preview failure is degraded gracefully ("No preview
    could be rendered… the sliders still crop every page") instead of blocking.
  - **Caps, runId, reset, friendly errors.** 100 MB / 200 pages with PDF Split
    steering, `runIdRef` guarding load/preview/crop/finally so a stale async
    result can neither clobber newer state nor trigger a download,
    `resetState()` on load error, input `value=""` reset so the same file can
    be re-picked, busy-guard at the top of `applyCrop` (no double-download),
    and `friendlyError()` mapping encrypted → PDF Unlock, invalid → "doesn't
    look like a valid PDF". `SAVE_OPTS` stops appearance regeneration; a
    1-frame yield every 50 pages keeps the tab responsive.
  - **Honest control set.** Four 0–45% sliders (Top/Bottom/Left/Right are all
    disabled at zero; a "Move at least one slider…" hint appears while nothing
    is set), uniform-per-page cropping explicitly stated, page-1-only preview
    labeled "Preview (page 1)" with a kept-area overlay, "n /" no phantom trim.
  - **A11y.** Fieldset "Crop margins"; `SliderField` labels queried by `for`;
    `role=status` idle/load/progress/result lines, `role=alert` errors,
    `aria-busy` on the root; the kept-area overlay is `role="img"` with an
    aria-label and the raster image is `aria-hidden`; captions bumped to
    slate-500.
- `src/lib/tool-content.ts` (`"pdf-crop"` entry rewritten): the drag-and-drop,
  "interactive handles", per-page adjustments, unit (inches/mm/px) and phantom
  "trim" claims are gone. Features/howTo/FAQ now state exactly what exists:
  0–45% cuts per edge, uniform across all pages, rotation-correct placement,
  page-1 preview overlay, non-destructive crop ("clipped, not deleted — file
  size stays roughly the same"), uniform-only FAQ, rotation FAQ, PDF Unlock
  steering, privacy FAQ. `relatedSlugs` dropped `pdf-to-image` for
  `pdf-scale-pages`.
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-crop"]` (8 terms: "crop pdf online",
  "trim pdf margins", "remove white space from pdf", …) and a truthful
  `TOOL_FEATURE_LIST` JSON-LD override added.
- `src/lib/tools.ts`: the tagline "Crop PDF margins" was already accurate —
  left unchanged.
- `src/lib/guides.ts`: new guide `how-to-crop-a-pdf` (visible-boundary vs
  delete semantics, percentage trimming + preview, uniform-per-page and
  rotation handling, PDF Unlock prerequisite, redact vs crop distinction).
- Verification:
  - `audit/check-pdf-crop.mjs` — **61/61** node checks: kept-rect → displayed
    overlay extents for all four rotations (0/90/180/270, MediaBox
    `[0 0 612 792]`), MediaBox untouched + TrimBox/BleedBox/ArtBox synced,
    offset-origin `[100 100 …]` MediaBox origin preserved and crop within
    media, mixed 2-page 90/270 document, real encrypted fixture throws on
    plain load, rotation normalization (360→0, −270→90).
  - `e2e/pdf-crop-browser.mjs` — **52/52** production Chrome scenarios:
    accessible idle state, loaded "3 pages", fieldset legend, real page-1
    raster preview + `role=img` kept-area overlay, four labelled sliders,
    disabled-at-zero crop + hint, happy-path crop of a file whose page 2 is
    `/Rotate 90` — decoded CropBox equals the rotation-aware math per page
    (rot90 page uses the transposed formula), MediaBox and rotations preserved,
    repeat crop with new margins still valid, encrypted/invalid/oversized
    steering, zero hydration or page errors, honest `/tools/pdf-crop` copy
    checks (0–45%, uniform, non-destructive, no drag/drop, no units, no
    per-page, no trim option, PDF Unlock route), guide 200, sitemap lists tool
    + guide.
  - Build: clean tsc + eslint; production build passed (**293 pages**, 28
    guides).
- Tracked residuals (accepted): the preview rasterizes only page 1 (accurate
  and disclosed); cropping is intentionally percent-only; the pdf.js raster is
  a second parser by necessity for the preview feature and is now transient +
  destroyed.