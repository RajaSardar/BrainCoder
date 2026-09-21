# Text to PDF: Parallel Judges Audit

Date: 2026-09-21. Status: twenty-fifth tool upgraded and verified —
first of the three-tool wave covering text-to-pdf, pdf-to-ppt and the
remaining registry entries (judged, upgraded and verified independently
in parallel; this report covers text-to-pdf). Ten judges returned; every
gap they raised was runtime-closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | CRITICAL — the WinAnsi embed throws: a CJK/emoji/Cyrillic char makes the whole build throw via `StandardFonts.Helvetica`. CRITICAL/HIGH — an over-wide *first* word is never chunked (`|| !cur` short-circuit) so it clips off the page. HIGH — chunking keeps a stale `cur`, emitting duplicate/ghost lines. Paragraph splitting only handled `\n`, not `\r\n`/bare `\r` |
| Technical architect | The long-word chunker is O(n²)/O(n³): an 8000-char word took ~60–100s and a 500k paste froze the tab for minutes. Width re-measurement slices the whole remaining token per chunk |
| End-user UX | Copy promised a "Convert to PDF" button that doesn't exist, custom margins/line-height that aren't implemented, and a Letter option; errors for unsupported characters were raw; no visible cap on huge pastes |
| Content/SEO | Long description/features/FAQ lied on three axes (font/margins/line-spacing customization, "Convert to PDF", "A4 or Letter") and never disclosed the WinAnsi limitation or the character cap |
| Business analyst | Core value = honest local plain-text→A4 PDF with a real font-size control. MUST: friendly non-WinAnsi error, truthful copy, disclosed cap; SHOULD: keep output simple and fast even for very long pastes |
| A11y specialist | Textarea had no accessible label; the error div had no role; no busy/status announcement; slate-400 placeholder contrast was low; the Download button stayed enabled without input |
| Security/privacy | Everything client-side, no egress, no storage — clean. Error path must never surface internal fonts stack |
| Edge cases | Long unbroken words clipped; the last line could exceed a fresh page and leave a blank page; CR-only files mis-split |
| Performance | Quadratic word chunking; the Blob was `new Blob([bytes.buffer])` (whole pool) and the object URL was revoked immediately after click |
| SSR/cross-browser | Static prerender is correct; the route must stay a 200 and the tool must work in Safari/Firefox (fill/keyboard paste paths) |

## Changes And Evidence

- `src/features/pdf-office/support.ts` — `buildTextPdf` rewritten:
  - **WinAnsi prevalidation (functional, business):** every input character
    is probed with `font.widthOfTextAtSize` in a try/catch and the first 8
    offending chars are collected. On failure the single friendly error is:
    "This tool embeds basic Latin (WinAnsi) text, and
    these characters can't be rendered: "你" … Remove or replace them
    (CJK, emoji, Cyrillic, Greek and other non-Latin scripts aren't
    supported), then try again." (singular/plural handled).
  - **Linear chunking (architect, perf):** over-wide tokens are chunked
    with a per-token single-pass char-width precompute plus a running-sum
    breakpoint and a bounded kerning-verify loop — no re-measure of the
    whole remainder per chunk, no binary search. 500,000-char single word
    builds in well under the budget (was minutes+); the *first* word is
    always chunked too (the `|| !cur` gap is gone).
  - **No ghost lines (functional):** `cur` is reset after a wide token;
    duplicate-line regression covered by a dedicated engine check.
  - **CR/CRLF split (edge):** paragraphs split on `/\r\n?|\n/`; checks
    assert bare-CR and CRLF inputs produce exactly two lines.
  - **No trailing blank page / tab glyphs (edge):** tab is expanded to
    four spaces; the paginator's new-page threshold prevents a trailing
    empty page; 16-pt test asserts multi-page output.
- `src/features/text-to-pdf/TextToPdf.tsx` (rebuilt):
  - Textarea gets `id` + sr-only label ("Text to convert to PDF") and
    `maxLength={MAX_CHARS}` (500,000).
  - Real font-size `SliderField` wired to `buildTextPdf(text, { fontSize })`
    (10–24 pt, default 13); the slider has an associated label and shows the
    current value.
  - Status `role=status`: empty → "Nothing to build yet."; busy → "Building
    your PDF…"; else "N chars — wrapped & paginated at A4" with
    " (this tool caps input at 500,000 characters)" appended at the cap.
    Root div sets `aria-busy` during a build.
  - Errors render in a `role=alert` div with the engine's friendly message;
    the button re-enables after an error.
  - Download uses an exact-size slice
    `(bytes.buffer as ArrayBuffer).slice(byteOffset, byteOffset+byteLength)`
    for the Blob, an anchor appended to the body for the click, and a
    deferred `URL.revokeObjectURL` (1s). Filename `text.pdf`.
  - Button is disabled while empty; placeholder and label meet contrast.
- `src/lib/tool-content.ts`: text-to-pdf entry rewritten to the behavior —
  plain text only, A4 fixed, 10–24 pt font-size slider, 500,000-char cap,
  basic-Latin (WinAnsi) limitation disclosed, no fabricated convert-font-
  margin controls; `text-cleaner` relatedSlugs now include text-to-pdf
  (reciprocal link added).
- `src/lib/seo.ts`: `TOOL_KEYWORDS["text-to-pdf"]` row and a JSON-LD
  `TOOL_FEATURE_LIST["text-to-pdf"]` override added.
- `src/lib/tools.ts`: description rewritten — "Turn plain text into a
  clean, paginated A4 PDF right in your browser." (no "Convert to PDF"
  button phrasing).
- `src/lib/guides.ts`: new guide `how-to-convert-text-to-pdf` (size, font
  slider, WinAnsi note, A4) — production build is now 288 static pages.

## Verification

- Engine (`check.mjs`, mirror of `buildTextPdf` + pdfjs extraction):
  **14/14 PASS** — no duplicate "one two three" lines; all words present;
  first-word 2000-char chunk preserves every char; 8000-char word < 3s;
  500,000-char word well under budget; bare-CR and CRLF split into exactly
  two lines; CJK and emoji raise the friendly error naming the character;
  "café — •" (WinAnsi) preserved; tab text preserved; 16-pt multi-page; no
  trailing blank page; the harness's exact 1200-char scenario emits exactly
  1200 chars (extraction confusion with "fox" in the filler was a test
  artifact, fixed in both scripts).
- `npx tsc --noEmit` clean; eslint clean on all changed files;
  `npm run build` green (288 pages).
- `e2e/text-to-pdf-browser.mjs` — **35 production Chrome scenarios, 35/35
  green** (`BASE_URL http://localhost:3801`, downloads parsed via
  pdf.js legacy build + `standardFontDataUrl`): SSR sample value equality;
  labelled textarea (label association vs aria-label/aria-labelledby);
  `maxlength=500000`; role=status present; slider labelled + shows default
  and 16 pt after fill; empty input disables the button and announces
  "Nothing to build yet."; live char count on type; downloaded file is
  `%PDF` and `pdf-lib getPageCount` ≥ 2 for the long paste; the 1,200-char
  unbroken word and the 1,500-char first word survive extraction fully
  (chunking + first-word fixes); CJK "你好" and emoji "😀" each surface the
  friendly role=alert and the button re-enables; exactly one friendly error
  at a time; WinAnsi "café — •" preserved; 560k paste is truncated to
  500,000 and the cap is disclosed in the status region; the 500k build
  still downloads a valid PDF; /tools/text-to-pdf copy truthfully mentions
  "10–24 pt", no longer claims margin/line-spacing customization or Letter,
  references the real "Download PDF" button, and discloses both the
  basic-Latin limitation and the character cap; the new guide renders; zero
  hydration errors; zero page errors. Shared-wave siblings re-run from the
  same build.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; /verify wording; ToolPreview upload mocks; WebKit not runnable;
  Next.js route announcer `role=alert`.
- The WinAnsi limitation is a disclosed product decision: only basic Latin
  renders with the embedded Helvetica base-14 font — CJK/emoji/Cyrillic/
  Greek are rejected with an actionable message rather than silently
  corrupted. Output is always A4; the 500,000-char cap is disclosed in-copy
  and in the status region.
- pdf-lib remains pinned (no active advisory).