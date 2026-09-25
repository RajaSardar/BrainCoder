# PDF Auto-Redact: Parallel Judges Audit

Date: 2026-09-25. Status: forty-first tool upgraded and verified — the third
tool of the seventh audit wave. Ten judges (functional, PDF/domain expert,
technical architect, code reviewer, end-user UX, business, security, a11y,
SEO and performance) returned; every gap raised was closed and verified.
Focus of the round: find-every-occurrence redaction across a whole PDF with
per-page match previews, a confirm step so nothing is covered accidentally,
a disclosed match cap, honest "text-layer only" copy.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Enter one or more terms (or a regular expression) and the
 tool must show every match as a black box preview page by page, then let
 the user confirm before the PDF is rewritten. The output must hide the
 matched text from select/copy/search while leaving everything else alone.
 "Redact N regions" drives the confirm step. |
| Domain expert (PDF) | Matches are found in the PDF's text layer via pdf.js
 — scanned pages, outlined letters and phrases split across text runs can
 be missed, so copy must say so. Each match is covered by one bounding box
 over its whole text chunk, padded around the glyphs, stamped into the
 content stream like the manual Redact tool. Matching is case-insensitive
 by default with opt-in exact case and whole-word modes. |
| Technical architect | Search runs over every page's text items through a
 host-side worker of the shared pdf.js pipeline; page-by-page progress
 ("Searching page N of 60") is announced; `MAX_MATCHES = 100` bounds the
 box-cover work and is disclosed ("Search stopped at 100 matches") rather
 than hidden; a 100 MB / 200 page upload cap mirrors the family constant. |
| Code reviewer | Preview → confirm → export chain is `runId`-guarded
 across every await; the regex field is only parsed/validated when "Use
 regex" is on (an invalid regex never reaches the confirm step); terms past
 the cap are reported, not truncated silently; output is
 `<base>-redacted.pdf` and only exists after confirmation. |
| End-user UX | Terms textarea accepts a list (name, account number, email
 per line); a regex mode hides/shows its own textarea; per-page previews
 render with highlights before any download; the confirm button states the
 count ("Redact N region(s)"); busy is announced; a "Stop" is not needed —
 the flow is fast and bounded by the cap. |
| Business analyst | The pitch is "spin through a whole document for a term
 you must not let out" — so trust copy must state the search reads the text
 layer (scans/outlines can be missed), the operation stays on-device, and
 the output is visual redaction (covered words still exist below the
 boxes), matching the manual Redact tool's honesty. No "100% caught
 anything" claims. |
| Security | PASS — no file content leaves the browser; the e2e request
 tracker saw only same-origin assets on a real run; the cap prevents a
 pathological match storm. |
| A11y specialist | Label ↔ field pairing via `useId`; the regex toggle is
 a real checkbox in a `fieldset`/`legend` group; busy announce via the
 sr-only `role=status` (UI also shows progress on the primary button);
 errors via `role=alert`; `aria-busy` root; "Redact N region(s)" is a
 distinct accessible confirm button. |
| SEO/content | `TOOL_KEYWORDS["pdf-auto-redact"]` (incl. "auto redact pdf"
 / "auto redact pdf online") + truthful `TOOL_FEATURE_LIST` JSON-LD;
 CUSTOM_TITLES "Auto-Redact PDF online — black out repeated text and
 phrases for free"; honest long description (text-layer matching, covered
 words still below the boxes, scans/outlines can be missed, 100-match cap
 disclosed); new guide `how-to-auto-redact-pdf-online` covering the exact
 honest-non-forensic limits. |
| Perf judge | Progress granularity is per page so a 60-page scan stays
 responsive and observable; box-cover work is bounded by `MAX_MATCHES`;
 the confirm step prevents wasted export work. |

## Changes And Evidence

- `src/features/pdf-auto-redact/PdfAutoRedact.tsx` (rebuilt) — plain-terms
  and regex modes (regex textarea shown only when "Use regex" is checked),
  case-sensitive and whole-word-only toggles, per-page match previews with
  highlights, a confirm step, `MAX_MATCHES = 100` cap with a visible
  "Search stopped at 100 matches" notice, `MAX_FILE_BYTES` / `MAX_PAGES`
  upload cap messages (with "Use PDF Split first" guidance), page-by-page
  "Searching page N of 60…" progress, `<base>-redacted.pdf` via
  `downloadBlob`, "Redact N region(s)" confirm button rendering a precise
  count.
- Stamping reuses the burn-in path verified for PDF Redact (content-stream
  cm/m/h/f without `re`); the e2e harness asserts the same operators on the
  downloaded output.
- Matching: case-insensitive by default, whole-word and exact-case modes,
  regex validated before the confirm step ever appears; invalid regex is
  rejected with a friendly message.
- Error paths: encrypted upload → password-protected steer + Unlock PDF
  link; non-PDF → "doesn't look like a valid PDF"; >100 MB and >200 pages
  rejected with the actual counts.
- Copy (`src/lib/tool-content.ts`, `src/lib/seo.ts`): honest — text-layer
  only, padded chunk boxes, covered words still exist below the boxes, not
  a forensic sanitization, on-device, caps disclosed.
- Guide (`src/lib/guides.ts`): new `how-to-auto-redact-pdf-online` (200 +
  sitemap-listed) with the same honest limits.
- `audit/check-pdf-auto-redact.mjs` — **34/34** Node-mirror checks.
- `e2e/pdf-auto-redact-browser.mjs` — **44/44** production Chrome
  scenarios: terms match + previews + confirm → download, regex mode
  (placeholder-matched field), case-sensitive / whole-word behaviour,
  invalid regex never reaches confirm, per-page progress announcement
  (MutationObserver recorder), busy clears, encrypted → Unlock steer +
  link, invalid file, oversized / over-page caps, 100-match cap notice,
  honest copy on `/tools/pdf-auto-redact`, guide 200, sitemap lists tool +
  guide, zero hydration/page errors.
- Build: clean tsc + eslint; production build passed (**300 pages**, 34
  guides across the wave).
- Tracked residual (accepted): scanning finds text-layer content only —
  scanned documents, text-as-outlines, and terms split across text runs can
  be missed; the result is visual redaction, not forensically sanitized
  erasure. Both disclosed in copy and guide.

Files: `src/features/pdf-auto-redact/PdfAutoRedact.tsx`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-pdf-auto-redact.mjs`, `e2e/pdf-auto-redact-browser.mjs`.