# PDF Compare: Parallel Judges Audit

Date: 2026-09-25. Status: thirty-ninth tool upgraded and verified — the
first tool of the seventh audit wave. Ten judges (functional, PDF/domain
expert, technical architect, code reviewer, end-user UX, business, security,
a11y, SEO and performance) returned; every gap raised was closed and
verified. Focus of the round: a real page-by-page text-layer diff between
PDFs against a chosen original, a deterministic invalid-PDF path, honest
"what this compares" copy, and a stable production-Chrome harness.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | "Compare"
 must mean the two documents' text layers, page by page, against a user
-picked original — not a binary hash. Show added/removed lines, keep an
 only-differences filter, let the user page through the result, and download
 a plaintext diff report. Multiple PDFs must be supported (an original plus
 the candidates to compare against it), capped so the UI stays sane. |
| Domain expert (PDF) | pdf.js's in-browser throw for a non-PDF differs from
 the Node legacy build ("Invalid PDF structure.") — so the friendly-error
 regex alone can't route deterministically. Sniff the magic bytes: a file
 whose first five bytes are not `%PDF-` is rejected up front with the same
 message everywhere. Encrypted PDFs are the other trap: pdf-lib reads an RC4
 file as "No PDF header found", which would mis-route users — preflight with
 pdf.js `getDocument` so a real open-password file steers to PDF Unlock. |
| Technical architect | Diff engine: reuse the shared pdf.js reading-order
 pipeline (y-then-x ascending, whitespace-only `" "` items skipped), align
 pages between the document and the original, and emit an item-level diff
 keyed on page. Rebuild resets via `runId` guards after every await; all PDF
 text goes through the existing in-memory path. |
| Code reviewer | `userFacing`/`toUiError` routing so real engine `Error`
 throws never leak raw. `%PDF-` preflight added inside `handleAdd` right
 after `arrayBuffer()`. Document cap honours `MAX_DOCS = 5` with a friendly
 "Only up to 5 PDFs" alert; the download is named `<orig>-diff-report.txt`
 and the report reflects the currently selected originals. |
| End-user UX | `role=status` for load and "Comparing…" busy lines, removed
 lines shown red and added lines shown green, a per-doc original radio, a
 filter toggle, and page navigation over multi-page results. |
| Business analyst | The value is "what changed between these PDFs, fast",
 so copy must say text-layer comparison (visual/scan differences are out of
 scope), local processing, and the 100 MB / 200 page caps. No overclaiming:
 "comparison" is not "layout diff". |
| Security | PASS — the harness captured a real run's request log and saw
 only same-origin assets; bytes stay in memory via `arrayBuffer()` +
 pdf.js; nothing is uploaded. Caps enforced by the shared constant. |
| A11y specialist | File inputs use `useId` labels, a fieldset groups the
 per-document originals with a legend, `role=status` sr-only announces load
 and busy phases, errors are `role=alert`, the result region is labelled,
 and controls are keyboard-reachable with distinct accessible names. |
| SEO/content | `TOOL_KEYWORDS["pdf-compare"]` (incl. "compare pdf online") +
 truthful `TOOL_FEATURE_LIST` JSON-LD; CUSTOM_TITLES "Compare PDF documents
 online — diff text between two PDFs"; honest feature copy; new guide
 `how-to-compare-pdfs-online` (200 + sitemap-listed). |
| Perf judge | Items stream into the diff progressively per page; the page
 navigation keeps rendering cheap (one page view at a time); the doc list
 caps at five so the engine workload stays bounded. |

## Changes And Evidence

- `src/features/pdf-compare/PdfCompare.tsx` (rebuilt, ~938 lines) — up to
  `MAX_DOCS = 5` PDFs with a labelled "original" radio per document, a
  page-by-page text-layer diff against the chosen original, an
  only-differences filter, page navigation, added/removed line lists,
  result count summary, and a `downloadBlob` report named
  `<orig>-diff-report.txt`.
- **Deterministic invalid-file handling** — `handleAdd` decodes the first
  five bytes after `arrayBuffer()`; anything that isn't `%PDF-` throws
  `userFacing("This file doesn't look like a valid PDF.")` before pdf.js is
  even asked. The encrypted case is preflighted with pdf.js
  `getDocument(..).getPage(1)` so "No password given" routes to the Unlock
  PDF steer instead of pdf-lib's misleading "No PDF header found".
- Diff model: shared reading-order pipeline (y-then-x ascending, skip
  whitespace-only items) per page; difference items carry the page number
  and the added/removed side.
- Copy (`src/lib/tool-content.ts`, `src/lib/seo.ts`): honest "compares the
  text layer of each page" framing, local-processing claim, caps disclosed,
  JSON-LD featureList matching the real feature set.
- Guide (`src/lib/guides.ts`): new `how-to-compare-pdfs-online` with honest
  scope (text layer, not visual/layout/scan diff).
- `audit/check-pdf-compare.mjs` — **43/43** Node-mirror checks (engine
  behaviours mirror the browser build).
- `e2e/pdf-compare-browser.mjs` — **56/56** production Chrome scenarios:
  accessible file input, idle claim, originals hidden before upload, an
  original radio per PDF, diff render for the first original, zero spurious
  `role=alert`s (filtered against Next.js's always-present route-announcer
  via `hasText /\S/`), added/removed line display and red styling, download
  of `<orig>-diff-report.txt`, only-differences filter, page navigation
  over a 60-page fixture (added/removed rows carp — shared "Same line" text
  verified on page 2 where the changed line lives; each fixture page holds
  one line by design), encrypted fixture → Unlock steer, non-PDF → friendly
  message (header sniff), oversized rejection, the 5-document cap (per-file
  settle waits — the busy guard makes rapid adds droppable), honest copy on
  `/tools/pdf-compare`, guide 200, sitemap lists tool + guide, zero
  hydration/page errors.
- Build: clean tsc + eslint; production build passed (**300 pages**, 34
  guides across the wave).
- Tracked residual (accepted): comparison is text-layer only — differences
  in layout, images, scans and vector art are out of scope and disclosed
  rather than claimed.

Files: `src/features/pdf-compare/PdfCompare.tsx`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-pdf-compare.mjs`, `e2e/pdf-compare-browser.mjs`.