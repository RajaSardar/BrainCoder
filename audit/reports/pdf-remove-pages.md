# PDF Delete Pages (Remove Pages): Parallel Judges Audit

Date: 2026-09-22. Status: twenty-ninth tool upgraded and verified — the
second tool of the third audit wave. Ten judges returned; every gap they
raised was closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Page count was read live during render (galloping counter), not snapshotted; no caps; raw `err.message`; no input reset; no resetState on load errors; Delete clicked with zero selection downloaded a full "copy" with no message |
| Domain expert | The tool rebuilds a new file from KEPT pages — content/layout/links survive but document-level bookmarks and metadata are not guaranteed; the "fully preserved formatting" and "enter page ranges" copy implied more than the product does; whole-document deletion must be impossible (empty output) |
| Technical architect | CRITICAL — no runId guard; pdf.js load task + page objects never cleaned up; thumbnails re-parsed the document too many times; selection order must survive into the keep-set; caps |
| Code reviewer | `downloadBlob` consumer must preserve page order and geometries; the `keep = []` degenerate case is a real crash path (empty PDFDocument); honest output filename; guard strings in the busy path |
| End-user UX | "Delete and Download PDF Pages" step talked about entering page numbers in an input that doesn't exist; "Confirm the deletion" phantom step; no per-page labels (aria-pressed needed); honest filename `-kept-pages.pdf` expresses the semantics; "removed N — M remaining" message |
| Business analyst | This tool is the manual companion to Remove Blank Pages — cross-link both directions; caps disclosed; deletes should be unambiguous (dimmed vs red borders already used, but announce state); no "remove unlimited" claim |
| SEO/content | howTo described an input field and a confirm step that were never in the UI; "no page ranges" the tool actually only keeps/drops whole pages; FAQ needed the rebuild-from-kept honesty; keywords/featureList missing; guide existed with the same range claims |
| Security/privacy | VERIFIED no network egress (bytes never leave the tab). Caps fine. No OCR claims. Output does not re-protect — unlocked-file warning honest |
| A11y specialist | Page toggles were color-only state; no fieldset/legend; no live regions; busy state unannounced; slate-400 caption contrast fails AA |
| Performance | Per-page thumbnail renders re-loaded the document repeatedly (thumbs should batch off one load); page cap bounds worst case; status text must not fake progress percentages the tool doesn't track |

## Changes And Evidence

- `src/features/pdf-remove-pages/PdfRemovePages.tsx` (rebuilt):
  - **Snapshotted page count** at load; thumbnails render once each at
    0.45 scale off the one held pdf.js document.
  - **Selection semantics.** Pages are marked for deletion; output is rebuilt
    from the KEPT pages via the WASM/JS engine, preserving selection order
    and page geometries. `keep = []` (every page marked) is guarded with a
    "nothing would be left" role=alert instead of producing an empty file.
  - **No-op impossible.** Delete is disabled at `removing.size === 0` (the
    old "download the full copy" path is gone), and auto-download only
    happens on a real deletion. Filename is `<source>-kept-pages.pdf`;
    message is "Removed N page(s) — M remaining".
  - Caps (100 MB, 200 pages), `runId` guard, `task.destroy()` + cleanup,
    input reset, `resetState()` on errors, friendly encrypted/invalid/oversized
    errors, `aria-busy`, fieldset "Pages to delete", `aria-pressed` toggles,
    Select-all/Clear toggle, role=status/role=alert, slate-500 captions.
- `src/lib/tool-content.ts`: pdf-remove-pages entry rewritten honest — the
  "enter page numbers in the input field" and "Confirm the deletion" howTo
  steps are gone; FAQ says the file is rebuilt from your kept pages and that
  bookmarks/metadata may be lost; caps documented; reciprocal link to Remove
  Blank Pages added (and onto it from the blank tool).
- `src/lib/guides.ts`: `how-to-remove-pages-from-a-pdf` fixed — the page-
  ranges claim and the "pdf-lib" engine claim are removed;
  it now says the tool rebuilds from the pages you kept and covers whole-page
  deletion only; the caps and the unlock-first caveat are stated.
- `src/lib/tools.ts` + `src/lib/seo.ts`: tagline "Keep only the pages you
  want"; honest description; TOOL_KEYWORDS + TOOL_FEATURE_LIST rows added.

## Verification

- `audit/check-pdf-remove-pages.mjs` (Node, real pdf-lib serialization) —
  **12/12 PASS**: rebuilt output keeps only unmarked pages in selection order
  with original geometries; the all-marked keep-set is detected and refused
  (no empty document is ever produced); guard equivalence; caps evolve
  correctly.
- `npx tsc --noEmit` clean; eslint clean on all changed files;
  `npm run build` green (292 pages).
- `e2e/pdf-remove-pages-browser.mjs` — **34 production Chrome scenarios,
  34/34 green** (`BASE_URL http://localhost:3801`, a 3-page fixture generated
  with distinct per-page text): idle state names the accessible input and
  explains pages are tapped; uploading reports "Loaded 3 pages"; three
  thumbnails render inside a "Pages to delete" fieldset; Delete is disabled
  at zero selection and nothing is preselected; tapping page 2 flips
  aria-pressed and the label reads "Delete 1 page"; deleting downloads
  `sample3-kept-pages.pdf` which re-parses to 2 pages with a "removed 1
  page, 2 remaining" status; selecting all 3 and deleting shows the
  "nothing would be left" alert and Clear drops back to a disabled Delete-0;
  re-picking the same file resets the selection; encrypted/non-PDF/oversized
  uploads each show the friendly role=alert with the right routing (PDF
  Unlock / invalid-PDF / PDF Split); zero hydration errors; zero page errors;
  /tools/pdf-remove-pages copy documents the caps, cross-links to Remove
  Blank Pages and contains none of the page-range-input, confirm-step or
  drag-and-drop claims; the blank-pages page cross-links to "PDF Delete
  Pages"; the how-to-remove-pages-from-a-pdf guide renders without the "page
  ranges" claim and explains the rebuild-from-kept mechanism; the sitemap
  lists the tool page and the guide.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; /verify wording; WebKit not runnable; Next.js route announcer
  `role=alert`; pdf-lib pinned (no active advisory).
- Deleting is destructive by design on the DOWNLOADED copy only — the
  original file is never modified; copy and messages say to keep the original
  if it might be needed. Rebuilt output may drop document-level
  bookmarks/metadata (disclosed).
- Keyboard-only users still get a full thumbnail grid; the harness runs in
  Chrome only (WebKit tracked at wave level).