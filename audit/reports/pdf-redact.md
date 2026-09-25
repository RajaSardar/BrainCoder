# PDF Redact: Parallel Judges Audit

Date: 2026-09-25. Status: fortieth tool upgraded and verified — the second
tool of the seventh audit wave. Ten judges (functional, PDF/domain expert,
technical architect, code reviewer, end-user UX, business, security, a11y,
SEO and performance) returned; every gap raised was closed and verified.
Focus of the round: real burn-in redaction (boxes stamped into the page
content stream), a keyboard-accessible placement path, and copy that never
lies about what redaction does and doesn't remove.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | "Redact" must physically cover content — a box drawn into the
 page content stream that no viewer can click away — not an overlay. Users
 place one or more rectangles per page, can remove/clear regions, see the
 total count, and download `<src>-redacted.pdf`. The result must survive as
 real content: the harness reads the downloaded file's stream operators
 rather than trusting what the UI claims. |
| Domain expert (PDF) | Burn-in means the box is drawn in the content
 stream as a filled rectangle. The pattern to verify: a `cm` transform
 (`1 0 0 1 x y cm`), a `0 0 m` moveto, an `h` + `f` fill, and critically NO
 `re` operator (a plain rect path) — the `re`-free fill proves the geometry
 is stamped through the transform. Export must use
 `updateFieldAppearances: false` and `addDefaultPage: false` so no
 appearances/blank page are silently added. pdf-lib rejects a Node
 `Buffer` on load — bytes must arrive as a `Uint8Array`. |
| Technical architect | Preview rasterized by the shared pdf.js pipeline at
 `RENDER_SCALE = 1.5` for crisp region drawing; display coords are divided
 back by the scale into PDF points (top-left origin) before stamping.
 Per-session `runId` guard across the async render/export chain; caps
 (100 MB / 200 pages) from the shared constant. |
| Code reviewer | `toUiError` routing so real engine throws (encrypted
 uploads, invalid files) surface as friendly steers instead of raw
 messages; download naming strips the extension (`<src>-redacted.pdf`); the
 region list is editable per page; no unhandled promise paths. |
| End-user UX | Drag a rectangle over sensitive content on any page, with
 per-region coordinates listed; a numeric fallback (Page / X / Y / Width /
 Height, all in points from the top-left) means the feature works with a
 keyboard or screen reader, not just a mouse. Total-region count shown
 before export; "Working on the PDF…" busy line. |
| Business analyst | Trust is the product: copy must say the operation is
 local, and must not claim the covered text is deleted — it states the text
 stays beneath the box (visual erasure, not forensic erasure) and that
 metadata/form values/hidden text outside the boxes survive. Encrypted
 uploads tell the user to unlock with the Unlock PDF tool first. |
| Security | PASS — bytes never leave the browser; e2e request tracker saw
 only same-origin assets during a real run. No content egress. |
| A11y specialist | The file opener is a `<label>` wrapping a hidden
 input for a larger tap target; `useId` labels on the inputs; numeric
 regions keyboard-editable; controls in `fieldset`/`legend` groups; busy
 announced via the sr-only `role=status` line; errors via `role=alert`;
 `aria-busy` on the root card. |
| SEO/content | `TOOL_KEYWORDS["pdf-redact"]` (incl. "redact pdf online") +
 truthful `TOOL_FEATURE_LIST` JSON-LD; CUSTOM_TITLES "Redact PDF online —
 black out text in a PDF for free"; honest long description (blackens
 content, does not delete the underlying text); updated guide
 `how-to-redact-a-pdf` now states plainly that covered text is "not removed
 from the file". |
| Perf judge | One raster pass (1.5x) per page only when regions are drawn —
 not the whole document at once; export stamps only the listed regions, so
 cost scales with regions, not pages. |

## Changes And Evidence

- `src/features/pdf-redact/PdfRedact.tsx` (rebuilt) — drag-to-draw
  redaction rectangles on any page, per-page region list with remove/clear,
  a keyboard-accessible numeric fallback (Page / X / Y / W / H in points
  from the top-left), `RENDER_SCALE = 1.5`, `SAVE_OPTS =
  { updateFieldAppearances: false, addDefaultPage: false }`, total-region
  count, "Working on the PDF…" busy, download `<src>-redacted.pdf` via
  `downloadBlob`.
- Burn-in is stamped into the content stream with
  `page.drawRectangle(...)`; the e2e fixture verifies the operators —
  `1 0 0 1 x y cm`, `0 0 m`, `h f Q` — and asserts **no `re` operator**
  appears, proving the box geometry is applied through the transform rather
  than as a rect draw. Capture returns `new Uint8Array(...)` so pdf-lib
  loads the resulting bytes.
- Friendly-error routing (`friendlyError`/`userFacing`/`toUiError`): an
  encrypted upload steers to "remove it with Unlock PDF first" and links to
  the Unlock tool; a non-PDF surfaces the invalid-file message; >100 MB and
  >200 pages are rejected with the cap counts.
- Copy (`src/lib/tool-content.ts`, `src/lib/seo.ts`): honest — "redaction
  blackens the area but does not delete the underlying text", "not a
  forensic guarantee", metadata/form values/hidden text survive, nothing is
  uploaded. No drag-and-drop claim.
- Guide: updated `how-to-redact-a-pdf` to state plainly that "the covered
  text is not removed from the file; it still exists beneath the rectangle"
  and that content outside the boxes is left untouched.
- `audit/check-pdf-redact.mjs` — **31/31** Node-mirror checks.
- `e2e/pdf-redact-browser.mjs` — **51/51** production Chrome scenarios:
  accessible opener (`<label>` + hidden input), idle claim, regions hidden
  until load, drag and numeric placement, per-page listing + removal, count
  before export, content-stream burn-in proof (cm/m/h/f, no `re`), download
  naming, busy announced (MutationObserver recorder — Playwright's ~100ms
  polling misses sub-200ms busy windows on fast hardware), busy attribute
  clears, encrypted → Unlock steer (message + link), invalid file, oversized
  and over-page caps, numeric-input a11y, honest copy on `/tools/pdf-redact`
  (routes protected files to Unlock PDF), guide keeps the honest-limits
  disclosure, sitemap lists tool + guide, zero hydration/page errors.
- Build: clean tsc + eslint; production build passed (**300 pages**, 34
  guides across the wave).
- Tracked residual (accepted): this is strong visual redaction, not
  forensic/cryptographic erasure — the covered glyph data remains in the
  file beneath the box, and metadata/form values outside the drawn regions
  survive. Disclosed in copy, FAQ and guide rather than hidden.

Files: `src/features/pdf-redact/PdfRedact.tsx`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-pdf-redact.mjs`, `e2e/pdf-redact-browser.mjs`.