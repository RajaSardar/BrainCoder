# PDF to Text: Parallel Judges Audit

Date: 2026-09-21. Status: twenty-fourth tool upgraded and verified —
last of the three-tool wave covering pdf-to-image, word-to-pdf and
pdf-to-text (judged, upgraded and verified independently in parallel;
this report covers pdf-to-text). Ten judges returned; nine returned usable
reports and one (the technical architect) came back empty after the rate
limit — every concern that judge's role normally covers (buffer transfer,
memory, page-order determinism) was independently surfaced by the
functional and edge-case judges and is closed below.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Scanned/image-only PDFs extract nothing and the tool just shows an empty result — users could not tell why. Page-order within a line is decided by pdf.js emit order, not reading order (left-to-right columns can come back right-before-left). No page-range support |
| Technical architect | *(empty — recovered from other judges)* The same `ArrayBuffer`/pdf.js transfer concerns as pdf-to-image apply; no loading-task destroy; no run-id to discard stale results |
| End-user UX | No progress ("Extracting text… page x of N"), no character count. Errors are raw pdf.js messages ("PasswordException"). No hint that scanned PDFs should go to OCR, and no link |
| Content/SEO | Claims it can extract text "from any PDF" — false for scans; claims a paste flow that never existed ("Just paste…"); no page-range mention. FAQ implies OCR is included |
| Business analyst | Core value = honest text-layer extraction with a download + copy, plus a clear handoff to OCR for scans. MUST: scope copy to text-layer PDFs, route scanned PDFs to pdf-ocr, add page range; SHOULD: reading-order fix, character feedback, friendly error names |
| A11y specialist | HIGH: input and textarea are unlabelled; no live region; busy never announced; empty-result state indistinguishable from a failed one |
| Security/privacy | No egress, no storage — clean. Extracted text is held in state for the tab lifetime; nothing written to disk silently |
| Edge cases | An encrypted PDF reports `PasswordException` raw; `pageRangeSyntaxError` and per-page bounds missing; a 500-page PDF would run text extraction on every page with no selection |
| Performance | Sequential per-page `getTextContent` is fine, but the harness showed `page.cleanup()` matters on long files; progress callback is trivial to add |
| SSR/cross-browser | Document now uses the shared `ensurePdfjsWorker` bootstrapping; routes must stay SSR 200 |

## Changes And Evidence

- `src/features/pdf-office/support.ts` (shared, upgraded):
  - `extractPdfText(data, { pages?, onPage? })` — page-range selection, a
    per-page progress callback, `await task.destroy()` in `finally`, a
    500-page selection cap, and **reading-order line assembly**: items are
    grouped into lines by y-proximity and each line's tokens are sorted by
    x, so a two-column layout returns LEFT-column-then-RIGHT-column instead
    of document-order; blank lines between y-gaps are preserved.
  - `ensurePdfjsWorker(pdfjs)` and `pageRangeSyntaxError` exported for all
    pdf tools (used by pdf-to-image and pdf-to-text).
- `src/features/pdf-to-text/PdfToText.tsx` (rebuilt):
  - **Page range (business, functional):** a `Pages` input
    (`e.g. 1-3 (all if empty)`) feeds `extractPdfText`; invalid syntax
    ("Enter pages like 1-3,5…") is rejected up front so a bad range can't
    silently produce the wrong slice.
  - **Scanned-PDF handoff (UX, functional, business):** when extraction
    yields no text, an amber `role=status` says "No selectable text was
    found — this looks like a scanned PDF. Try PDF OCR to read the page
    images." with a real `/tools/pdf-ocr` link.
  - **Friendly errors (edge):** `PasswordException` → "This PDF is
    password-protected — unlock it first with PDF Unlock, then extract from
    the unlocked file."; `InvalidPDFException` → "That file doesn't look
    like a valid PDF."
  - **Output + copy + download (functional):** the extracted text lands in
    a read-only labelled textarea with a character count ("N characters
    extracted from file."); the shared `CopyButton` copies it; "Download
    .txt" writes a UTF-8 **BOM-prefixed** file
    (`\uFEFF` + text) so Windows Notepad renders it correctly.
  - **Staleness guard + a11y (architect, a11y):** a `runId` token discards
    out-of-order results; labelled file input/textarea/pages input
    (useId `<label htmlFor>`), root `aria-busy`, `role=status` "Extracting
    text… page x of N", `role=alert` errors, keyboard-activatable drop zone.
  - **Cap (edge, perf):** 100 MB file cap with a message; page-range
    selection is capped at 500 pages.
- `src/lib/tool-content.ts`: pdf-to-text rewritten — scope pinned to the
  text layer (not "any PDF"), scanned PDFs explicitly routed to PDF OCR,
  page-range documented, 100 MB cap, output + copy + download flow
  documented; relatedSlugs = pdf-ocr, pdf-to-word, pdf-to-markdown,
  text-to-pdf, pdf-to-excel.
- `src/lib/seo.ts`: pdf-to-text keyword row added; JSON-LD featureList
  override added (text layer, page range, copy/download, local-only).
- `src/lib/tools.ts`: description rewritten — "Extract the text layer of a
  PDF (or a page range) to a .txt file — 100% in your browser."; the
  "any PDF"/paste wording is gone.

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Production build passed (287 static pages).
- `e2e/pdf-to-text-browser.mjs` — 26 production Chrome scenarios, 26/26
  green. Fixtures built at runtime with pdf-lib: a 2-page PDF with two
  paragraphs on page 1 and a deliberately right-before-left same-baseline
  pair (asserts the extractor returns "LEFT SIDE RIGHT SIDE" — the
  reading-order fix), a page 2 token, a blank (scanned-style) page, and the
  shared `e2e/fixtures/encrypted.pdf` R2/RC4-40 Standard security handler
  fixture (generated by `e2e/fixtures/make-encrypted.mjs`; validated in
  Node against pdf.js to raise `PasswordException` so the friendly alert
  path is real). Covers: labelled drop zone/input/pages field; extraction
  of both paragraphs on separate lines; same-line reorder; page-2 text;
  `.txt` download with the document name, `\uFEFF` BOM and content; copy-to-
  clipboard read-back; labelled textarea; range "1" keeps page 1 and
  excludes page 2; "zz" is rejected up front and the wrong-range guard
  clears when the field is emptied; a blank page → "No selectable text was
  found" + OCR link; the encrypted PDF → "password-protected" alert; zero
  hydration errors; zero page errors; `/tools` marketing documents the page
  range and scanned-PDF limitation and contains no "any PDF" or
  paste-flow overclaim.
- `e2e/pdf-to-image-browser.mjs` (29/29) and `e2e/word-to-pdf-browser.mjs`
  (28/28) green against the same build.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; `/verify` wording; ToolPreview upload mocks; WebKit not runnable;
  Next.js route announcer `role=alert`.
- pdf-ocr / image-ocr still fetch tesseract worker/core/lang from
  `cdn.jsdelivr.net`, falsifying their "no uploads" claims — NOT fixed
  here (out of wave scope, flagged for a future OCR wave). Because the
  scanned handoff now points users to PDF OCR, this residual is now
  user-visible.
- pdf-lib 1.17.1 in the bundle is a fork build that omits
  `PDFDocument.encrypt` — irrelevant to reading paths verified here (the
  encrypted fixture is produced externally); a future pdf-unlock wave must
  account for that limitation.