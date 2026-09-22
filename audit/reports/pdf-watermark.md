# PDF Watermark: Parallel Judges Audit

Date: 2026-09-22. Status: thirtieth tool upgraded and verified — the third
tool of the third audit wave. Ten judges returned; every gap they raised was
closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Angle math `((a % 180) + 540) % 180 - 90` maps 45° → −45° (wrong); centering passed full text-width where the formula expected half-width; no runId; caps; raw errors; no input reset; text input had no label→for binding |
| Domain expert | Only the built-in Helvetica is reliable in every viewer — a "visible-font" duplication makes the output font-dependent; WinAnsi limits the charset (emoji/marks must be rejected, not silently garbled); rotation must be compensated against the page's own `/Rotate`; a vertical center computed from font metrics (ASC 0.72 / DESC 0.21 → offset (ASC−DESC)/2) with a fit-to-width clamp |
| Technical architect | Redundant pdf.js parse just to count pages (pdf-lib alone can); centered-rotation Tm math (`p' = R(θ)·p + origin`) must be verified against pdf-lib; save must not re-render form appearances; runId + destroy/cleanup |
| Code reviewer | `downloadBlob` consumer counts must match; opacity clamp (0.01–1); 80-char cap; output must reopen cleanly |
| End-user UX | "Preview" and "adjustable font/color/position" claims that don't exist — the tool places the text centered on every page in a fixed dark-grey bold Helvetica; honest filename `-watermarked.pdf`; result status "stamped X across N pages at P%" |
| Business analyst | A watermark is a visual deterrent, NOT redaction — copy must not promise coverage removal; routing: PDF Editor owns per-page/color/placement, PDF Redact owns removal, PDF Unlock owns protected files, output is never re-protected; reciprocal links within a 6-card window |
| SEO/content | "corner positioning", "adjustable font, size, color" and "pixel-perfect" features never matched the build; FAQs needed the WinAnsi charset caution; keywords/featureList JSON-LD missing; no guide |
| Security/privacy | VERIFIED no network egress (bytes never leave the tab; no worker even needed). WinAnsi preflight prevents silent mojibake in output. Caps fine |
| A11y specialist | Sliders and the text field lacked accessible labels; no fieldset/legend; no live regions; busy state unannounced; slate-400 caption contrast fails AA |
| Performance | Dual parse (pdf.js for count + pdf-lib for stamp) was 2× memory for no benefit; single pdf-lib load + one stamp pass; the 100 MB cap bounds the work |

## Changes And Evidence

- `src/features/pdf-watermark/PdfWatermark.tsx` (rebuilt):
  - **pdf.js removed entirely.** One pdf-lib `load` validates, counts pages
    and holds the working document — no redundant second parser.
  - **Fixed typography for a predictable result.** Text renders as built-in
    bold Helvetica in dark grey (rgb 0.3 ×3) at 12–120 pt, 1–100% opacity,
    −90..90°, centered on every page with a per-page fit-to-width clamp.
  - **Centering verified against pdf-lib's rotate semantics.** A separate
    probe established that pdf-lib emits `Tm = [cosθ, sinθ, −sinθ, cosθ, x,
    y]`, i.e. `p' = R(θ)·p + origin` anchored at (x,y). The origin is
    `pageCenter − R(θ)·(halfTextWidth, (ASC−DESC)/2·size)`, and the centering
    call passes the HALF-width. Extensive probe checks confirm the drawn
    glyph run lands at the arithmetic page center for 0/−45/45/90/−90/30°
    using real font metrics and that the emitted Tm equals R(effAngle) with
    the centered origin.
  - **`normalizeAngle` fixed.** The real formula is now
    `m = ((a % 180) + 180) % 180; m >= 90 ? m - 180 : m` — 45° stays 45°, −90°
    maps to 90. Page rotation is compensated (`effAngle = normalize(user −
    rot)`; quarter-turns swap the effective fit width), so a watermarked
    rotated page still centers correctly and `/Rotate` is preserved.
  - **WinAnsi preflight.** `font.widthOfTextAtSize` on the label throws for
    characters WinAnsi can't encode; the stamp path catches it and shows a
    friendly role=alert ("…can't be encoded in the built-in font… use basic
    Latin letters, numbers and common punctuation") instead of emitting
    garbled glyphs. Opacity is clamped, text is capped at 80 chars.
  - Honest filename `<source>-watermarked.pdf`; status "stamped "X" across N
    pages at P% opacity"; 100 MB cap; runId guard; encrypted/invalid/oversized
    friendly errors; input reset; `aria-busy`; fieldset legend "Watermark
    settings"; text input bound to its `<label for>` via `useId`; labelled
    Font size / Opacity / Angle sliders; role=status/role=alert; slate-500
    captions. Disclaimer: a watermark is a visual deterrent — not redaction.
- `src/lib/tool-content.ts`: pdf-watermark entry rewritten honest — corner
  positioning, "adjustable font/color" and preview claims removed in favor of
  "fixed bold Helvetica", "12–120 pt / 1–100% / −90..90°", and "centered with
  auto-fit"; WinAnsi FAQ; routing FAQ to PDF Editor for color/placement
  (its real watermark feature was verified in PdfEditor.tsx/pdf-ops.ts),
  PDF Redact for permanent removal, PDF Unlock for protected files; related
  slugs reordered so PDF Unlock + PDF Redact land inside the top-6 render
  window.
- `src/lib/guides.ts`: new guide `how-to-add-a-text-watermark-to-a-pdf`
  (what a watermark can and cannot do, control ranges, protected-file caveat).
- `src/lib/tools.ts` + `src/lib/seo.ts`: tagline "Stamp the same text on
  every page"; honest description; TOOL_KEYWORDS + TOOL_FEATURE_LIST rows
  added.

## Verification

- `audit/check-pdf-watermark.mjs` (Node, real pdf-lib serialization; content
  streams deflated with zlib before scanning) — **24/24 PASS**: normalizeAngle
  regression (45→45, −90→90, 180→180); rotateForPage compensation; the
  centered bbox (whole glyph run) matches the arithmetic page center at
  0/−45/45/90/−90/30° for a real 595.28×841.89 page with built-in font
  metrics; the emitted `Tm` equals R(effAngle) + centered origin; output
  reopens with the page `/Rotate` preserved; watermark glyph run present
  after inflating the compressed stream (default save() compresses);
  WinAnsi throw; opacity clamp; 80-char cap constant.
- `npx tsc --noEmit` clean; eslint clean on all changed files;
  `npm run build` green (292 pages).
- `e2e/pdf-watermark-browser.mjs` — **34 production Chrome scenarios, 34/34
  green** (`BASE_URL http://localhost:3801`, a 3-page fixture): idle state
  names the accessible input and explains local stamping; uploading reports
  "Loaded 3 pages"; the settings fieldset appears with a `label for` bound to
  the text input and three labels (done, Font size/Opacity/Angle); stamping
  defaults downloads `sample3-watermarked.pdf` which re-parses to 3 pages
  with rotations preserved and the status "stamped "CONFIDENTIAL" across 3
  pages"; changing the text/opacity/angle and re-stamping updates the status
  to "80% opacity" and keeps all pages; an emoji label shows the friendly
  "can't be encoded" role=alert while the loaded file stays usable;
  encrypted/non-PDF/oversized uploads each show the correct routing;
  zero hydration errors; zero page errors; /tools/pdf-watermark copy states
  the real ranges and the fixed font, routes to PDF Redact / PDF Unlock /
  PDF Editor, and contains none of the corner-positioning or pixel-perfect
  claims; the how-to-add-a-text-watermark-to-a-pdf guide renders; the sitemap
  lists the tool page and the guide.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; /verify wording; WebKit not runnable; Next.js route announcer
  `role=alert`; pdf-lib pinned (no active advisory).
- The watermark is a visual deterrent, not redaction, and the watermarked
  output is not re-protected — both disclosed in the copy, FAQ and guide.
- Fixed dark-grey bold Helvetica is a deliberate trade of expressive control
  for viewer portability; users wanting font/color/placement are routed to
  PDF Editor (which was verified to actually ship a watermark feature).