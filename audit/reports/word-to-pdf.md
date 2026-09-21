# Word to PDF: Parallel Judges Audit

Date: 2026-09-21. Status: twenty-third tool upgraded and verified —
second of the three-tool wave covering pdf-to-image, word-to-pdf and
pdf-to-text (judged, upgraded and verified independently in parallel;
this report covers word-to-pdf). Ten judges returned; every gap they
raised was runtime-closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Final page slicing was wrong: `drawImage` drew `sliceH` px into an A4 box so the last partial page was stretched/whited; the architecture funneled data-URLs through a PDF built with zero-width pages plus a late `getPageCount` read. Convert even ran with an empty document |
| Technical architect | A detached `html2canvas` holder was left in the DOM after every conversion (leak per document). The whole conversion was a single synchronous slice loop — the tab freezes for long documents. Output quality claimed parity with Word ("as-is") that a raster pass cannot match |
| End-user UX | No parsed-content preview, so users convert blind; errors are a bare string; a legacy `.doc` upload fails cryptically; no busy state, no progress ("Rendering page x of N") |
| Content/SEO | Claims "identical to the original" and "no file size limits" — both false (raster snapshot, 25 MB cap). FAQ answered "convert .doc" as if supported. howTo implies a file-size claim the tool can't honor |
| Business analyst | Core value = honest local .docx→PDF conversion with a preview-then-convert step. MUST: drop the parity/unlimited claims, gate conversion on parsed content with a visible preview, reject legacy `.doc` with guidance; SHOULD: yield between page draws, cap pages/canvas, sanitize mammoth HTML |
| A11y specialist | HIGH: file input and drop zone unlabelled; no live region for progress or completion ("PDF ready" undetectable); Convert/Download never disabled during busy; ambiguous "Save"/"Start over" names |
| Security/privacy | mammoth HTML is injected with `dangerouslySetInnerHTML` — a malicious `.docx` can carry `javascript:` links / event handlers; sanitization absent. No egress, no storage — otherwise clean |
| Edge cases | A `.doc` file renamed to `.docx` (CFB magic — `d0cf11e0a1b11ae1`) passes the extension gate and then fails deep in mammoth. Empty documents produce a blank PDF instead of a message. Documents longer than `canvas` height limits throw raw errors |
| Performance | The slice loop ran house block on the main thread with zero yields; canvas at scale 2 with a 300k px cap is a real ceiling — enforce and explain it |
| SSR/cross-browser | Client-only html2canvas + pdf-lib are correct under dynamic import; shared UI errors previously also made the SSR home page render a client error (route smoke must stay 200) |

## Changes And Evidence

- `src/features/word-to-pdf/WordToPdf.tsx` (rebuilt):
  - **Two-phase flow with honest scoping (function, UX, business):** choose
    a `.docx` → mammoth parses it into a *preview* panel (scoped
    `.md-preview` typography) labelled "Parsed content — this is what gets
    rendered"; only then does "Convert to PDF" appear. The preview caption
    states the output is a visual snapshot — text isn't selectable, and
    headers/footers/pagination aren't carried over.
  - **Correct last-page slicing (functional):** the holder renders at a
    fixed 794px width (A4) with 48px padding; slices are drawn top-anchored
    at `height = phPt * (sliceH / pagePxH)` — a final partial page now sits
    at the top of its page with real margins instead of being stretched.
    White fill under every slice; no zero-width pages; `getPageCount` read
    from the final `doc`.
  - **Guards (function, edge):** empty `.docx` → "No content found in this
    .docx file."; legacy `.doc` extension → "Please choose a .docx file
    (an Office Open XML Word document); legacy .doc isn't supported — save
    it as .docx first."; a CFB-magic file masked as `.docx`
    (`d0cf11e0a1b11ae1` in the first 8 bytes) → "That's a legacy .doc
    file — save it as .docx first."; `MAX_FILE_BYTES` 25 MB,
    `MAX_CANVAS_HEIGHT` 300 000, `MAX_PAGES` 300 each with a message naming
    the limit.
  - **Sanitization (security):** `sanitizeMammothHtml` strips
    `javascript:`/`vbscript:` `href`/`src` and all `on*` handlers from the
    parsed HTML before the dangerously-set preview; `interceptLinks`
    preventsDef submit-style navigations inside the preview.
  - **Lifecycle + perf (architect, perf):** the rendering holder is removed
    in `finally`; page draws `yield` to the event loop with per-page
    progress; a `runId` token guards stale submissions; `downloadPdf` reuses
    the shared `downloadBlob` helper.
  - **A11y (a11y):** labelled file input ("Choose a .docx Word document"),
    labelled drop zone, `role=status` for "PDF ready — N pages, converted
    entirely in your browser", progress status "Rendering page x of N",
    `role=alert` errors, root `aria-busy`, Convert gated on parsed + !busy,
    Download gated on ready.
- `src/lib/tool-content.ts`: word-to-pdf rewritten — output honestly scoped
  as a visual snapshot, text non-selectable, headers/footers not carried
  over, 25 MB / multi-page caps documented, `.doc` clearly unsupported,
  preview-then-convert flow documented; relatedSlugs = pdf-to-word,
  image-to-pdf, excel-to-pdf, html-to-pdf, text-to-pdf.
- `src/lib/seo.ts`: word-to-pdf keyword row added; JSON-LD featureList
  override added (preview, convert, download, local-only).
- `src/lib/tools.ts`: description rewritten — "Preview and convert a .docx
  to a pixel-perfect-scoped PDF right in your browser."; the parity and
  unlimited-size wording is gone.

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files (two
  `react/no-unescaped-entities` apostrophes fixed).
- Production build passed (287 static pages).
- `e2e/word-to-pdf-browser.mjs` — 28 production Chrome scenarios, 28/28
  green. Fixtures are generated at runtime with `fflate.zipSync`
  (full OOXML: `[Content_Types].xml`, `_rels/.rels`,
  `word/document.xml`, `word/_rels/document.xml.rels`): short
  (multi-paragraph, heading), long (70 paragraphs → multi-page), empty,
  CFB-magic `.doc`, CFB-magic named `.docx`, and a plain-text non-docx.
  Covers: labelled drop zone + input; `accept` lists `.docx` and no legacy
  `.doc` token; Convert is hidden until a file parses; the preview panel
  shows the parsed heading and carries the "what gets rendered" label
  without any success claim; conversion ends in a "PDF ready" status; the
  downloaded file matches the doc name with a `.pdf` extension, starts with
  `%PDF`, and loads to exactly 1 page (short) / ≥2 pages (long) via
  `pdf-lib getPageCount`; empty doc → "No content found"; `.doc` →
  "choose a .docx file"; masked CFB → "That's a legacy .doc file";
  non-docx text file → "choose a .docx file"; drag-and-drop parses the
  dropped document; zero hydration errors; zero page errors; `/tools`
  marketing scopes output as a visual snapshot, contains no "identical"
  claim and no "no file size limits" claim, discloses 25 MB, the
  selectable-text limitation and the legacy-`.doc` limitation.
- `e2e/pdf-to-image-browser.mjs` (29/29) and `e2e/pdf-to-text-browser.mjs`
  (26/26) green against the same build.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; `/verify` wording; ToolPreview upload mocks; WebKit not runnable;
  Next.js route announcer `role=alert`.
- Mammoth preview limits retain hyperlinks after sanitize (they are
  inert — intercepted). pdf-lib remains pinned (no active advisory).
- html2canvas rendering is raster by nature — long, highly-styled
  documents may still split awkwardly across page slices; the multi-page
  carve-up and 300-page cap bound the damage honestly.