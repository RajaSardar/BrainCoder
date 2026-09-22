# PDF Remove Blank Pages: Parallel Judges Audit

Date: 2026-09-22. Status: twenty-eighth tool upgraded and verified — the
first tool of the third audit wave. Ten judges returned; every gap they
raised was closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Single-flag logic could flag text pages with faint ink; no file/page caps; raw `err.message` surfaced; no input-value reset (re-picking the same file silently skipped); no resetState on load errors (stale pages/bytes left on screen); no roles/aria-busy |
| Domain expert | Blank detection is inherently a heuristic — needs BOTH an ink-coverage scan and a text gate; transparent vs white vs light-content pages must be decided explicitly (alpha<40 transparent; blank iff ink/visible < 0.001, ink = lum<245, strict <); faint headers/page numbers are the classic false flag; nothing may be removed without a click; "exactly as they were" and "works on just about any PDF source" over-claims |
| Technical architect | CRITICAL — no runId guard (page render + detect + delete race); pdf.js load task and page objects never cleaned up (worker leak); every page rendered at full scale for the scan AND the preview — one single render should feed both; caps |
| Code reviewer | Shared `downloadBlob` consumer must keep selection order and dims; all-selected keep-set must be a real guard (a `keep = []` would try to save an empty document); honest filename collision mechanism |
| End-user UX | Auto-delete without review is unacceptable; Delete must be disabled at zero selected; all-selected must be blocked ("nothing would be left"); honesty of filenames (`-edited.pdf` beat `-no-blank-pages.pdf`); messages must name counts ("Removed N pages — M remaining") without engine/timing jargon; the old "HTML5 / JS / WASM engine" line belongs in /verify only |
| Business analyst | Detection is the product moat but only if it never silently destroys content; heuristic must be disclosed near the CTA; reciprocity: blank detection is the natural stepping-stone from merge/split (add cross-links from pdf-merge and pdf-split — verified they only render the top-6 related slugs); rejected "learn from users" pivot |
| SEO/content | longDescription promised markup "is left untouched" and implied the tool can't remove full pages; FAQ needed "only pages with negligible ink are flagged" and "never removed without your click"; keywords/featureList JSON-LD missing; no guide |
| Security/privacy | VERIFIED no network egress (bytes never leave the tab; worker asset is the local pdf.js bundle). Caps; don't claim OCR; scans warning; JPEG/hidden-layer caveats unwarranted for this tool |
| A11y specialist | Detected-blank state invisibly rendered (color-only) — need aria-label + aria-pressed; no fieldset/legend grouping; no live regions; busy state unannounced; slate-400 captions fail AA |
| Performance | Two full-scale renders per page (thumbnail + scan) plus per-page pdf.js parse = O(N·2X); scan should read the same raster at stride 4; 200-page cap bounds the cost; text gate must not double the load cost |

## Changes And Evidence

- `src/features/pdf-remove-blank-pages/PdfRemoveBlankPages.tsx` (rebuilt):
  - **One render, two uses.** Every page renders once at `THUMB_SCALE = 0.5`;
    the same canvas raster feeds the thumbnail AND the ink scan, so the
    memory cost is halved and detection reads exactly what the user sees.
  - **Hardened detector.** Stride-4 `getImageData`, `alpha < 40` treated as
    transparent, `visible === 0 → blank`, ink = `lr(lum) < 245`,
    blank iff `ink / visible < 0.001` (strict below, using `<`). A second
    gate calls `getTextContent` and any page with non-empty text is never
    blank, regardless of ink. Faint headers under the 0.1% threshold read as
    text and survive. Node unit checks mirror the arithmetic exactly on
    synthetic RGBA buffers.
  - **Nothing is ever removed without a click.** Detected blanks are merely
    PRESELECTED (aria-pressed) — Delete is user-initiated, disabled at
    `removing.size === 0`, and covers the preflight only.
  - **Guards + honesty.** All-selected is blocked: "Every page is selected —
    nothing would be left. Tap a page to keep it before deleting." Output is
    `<source>-edited.pdf`; the success message is "Removed N page(s) — M
    remaining" with no engine/timing jargon; the detection footnote says the
    check is a heuristic.
  - Caps (100 MB, 200 pages), `runId` race guard, `task.destroy()` in finally
    + `page.cleanup()`, input reset, `resetState()` on load errors (stale
    pages/bytes cleared), friendly errors (encrypted → PDF Unlock; invalid →
    "doesn't look like a valid PDF"; oversized → PDF Split), `aria-busy`,
    `role=status`/`role=alert`, fieldset "Blank page selection",
    detected-blank aria-labels, "Select {n} blank page(s)" / Select-all/Clear
    toggle, slate-500 captions.
- `src/lib/tool-content.ts`: pdf-remove-blank-pages entry rewritten honest
  (heuristic disclosed, "never removed without your click", rebuild-from-kept
  note, caps; the "left untouched"/"any source" overclaims gone);
  reciprocal links — pdf-merge and pdf-split now link to Remove Blank Pages
  and were reordered into the top-6 rendered related window; the blank tool's
  own list links to PDF Delete Pages, PDF Unlock, et al.
- `src/lib/tools.ts` + `src/lib/seo.ts`: tagline "Detect and delete
  near-empty pages"; honest description; TOOL_KEYWORDS + TOOL_FEATURE_LIST
  rows added.
- `src/lib/guides.ts`: new guide `how-to-remove-blank-pages-from-pdf`
  (heuristic + review-before-delete + unlock caveat) — production build is
  now **292 static pages**.

## Verification

- `audit/check-pdf-remove-blank-pages.mjs` (Node, synthetic canvas buffers +
  real fixture) — **9/9 PASS**: white buffer blank, fully-transparent blank,
  0.5% ink not blank, 0.2% faint header not blank, exactly 0.1% at 100×100
  not blank (strict `<`), light-grey counts as ink, reassembly mirror keeps
  only unmarked pages, guard-equivalence for the all-selected case.
- `npx tsc --noEmit` clean; eslint clean on all changed files;
  `npm run build` green (292 pages).
- `e2e/pdf-remove-blank-pages-browser.mjs` — **38 production Chrome
  scenarios, 38/38 green** (`BASE_URL http://localhost:3801`, using the repo's
  real `e2e/fixtures/blank-pages.pdf` whose middle page was confirmed empty
  by text extraction): idle state names the input and explains local
  detection; the 3-page upload reports exactly one detected blank, preselects
  page 2 (aria-pressed) with the detected-blank aria-label, and the reselect
  control reads "Select 1 blank page"; Select-all swaps the toggle to Clear
  and Delete enables for 3 then disables at zero; attempting Delete with
  every page selected shows the "nothing would be left" role=alert; marking
  one content page and deleting downloads `blank-pages-edited.pdf` which
  re-parses to 1 page with the "Removed 2 pages — 1 remaining" status;
  re-picking the same file resets the selection; an encrypted PDF shows the
  friendly unlock message pointing at PDF Unlock, a non-PDF shows "doesn't
  look like a valid PDF", and a >100 MB file is rejected with PDF Split
  guidance; zero hydration errors; zero page errors; /tools/pdf-remove-blank-
  pages copy discloses the heuristic, says nothing is removed without a click,
  documents the caps and contains none of the "just about any PDF source" or
  "exactly as they were" overclaims; pdf-merge and pdf-split pages now
  cross-link to Remove Blank Pages; the how-to-remove-blank-pages-from-pdf
  guide renders; the sitemap lists both the tool page and the guide.
  (The first run caught that related cards render only the first six slugs —
  the reciprocal links were reordered to land inside that window.)

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; /verify wording; WebKit not runnable; Next.js route announcer
  `role=alert`; pdf-lib pinned (no active advisory).
- Detection is a heuristic by design — the 0.1% ink threshold and the text
  gate are tuned conservative (fewer false blanks), disclosed in the copy,
  the footnote, the FAQ and the guide. Review the badges before deleting.
- The kept-page rebuild drops document-level bookmarks/metadata (honest FAQ);
  the original file is never modified.