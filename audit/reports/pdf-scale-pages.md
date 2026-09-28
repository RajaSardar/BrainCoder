# PDF Scale Pages: Parallel Judges Audit

Date: 2026-09-27. Status: forty-fifth tool upgraded and verified — the first
tool of the ninth audit wave. Ten judges (functional, PDF/domain expert,
technical architect, code reviewer, end-user UX, business, security, a11y, SEO
and performance) returned; every gap raised was closed and verified. Focus of
the round: a page is a coordinate system rather than a picture, so "scale the
page" had to move the page boxes, the content stream and the annotation layer
together — including the rare page whose media box does not start at the
origin — while never re-rendering the page into an image and never writing a
password-protected file back out in a broken state.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The old build called `page.scale(s, s)` on page 1, ignored every other page, set `ignoreEncryption: true`, and ran the whole thing as a fire-and-forget async IIFE: no caps, no magic-byte preflight, no page count, no busy state, no double-submit guard, no stale-run guard, no result the user could inspect, and no way to get the download back. Closed: every page is scaled, the load reports the page count, the first page's real size and the exact result at the chosen factor before anything runs, the success line states the factor and the file name, and the result panel offers the same bytes again. Two findings surfaced only while reconciling the mirror against the engine: `PDFArray.of` does not exist in pdf-lib 1.17.1 (the audit fixture was silently writing nothing), and `viewport.view` was renamed to `viewBox` in pdfjs 6, so the harness's first page-size assertion read `undefined` — both fixed before the checks could pass. |
| Domain expert (PDF) | A page is `/MediaBox` plus optional `/CropBox`, `/BleedBox`, `/TrimBox`, `/ArtBox` (each may be *inherited* from the `/Pages` node), a content stream in page space, and an `/Annots` array whose geometry is also in page space. Scaling one of those three is a bug, not a shortcut: pdf-lib's own `setCropBox` deliberately leaves a custom crop box alone, so an explicit crop box would have stayed at the old size while the media box shrank. Closed: every box a page defines is read through `getInheritableAttribute` and written back, and the resulting visible box is verified through pdfjs to be exactly `f ×` the original. A non-zero media origin is the sharp case — a naive scale shifts the content relative to the new box — so content and annotation geometry (`/Rect`, `/L`, `/CL`, `/QuadPoints`, `/Vertices`, `/InkList`) are translated by the origin first, then everything is scaled and the page is re-based at zero. A form widget's `/AP` is deliberately *not* touched: it is drawn in its own `/BBox` space and mapped onto `/Rect`, so with `updateFieldAppearances: false` the field renders at the new size with the page, which is what a uniform scale is supposed to do. `/Rotate` 90/270 is preserved and the before/after sizes are reported in the *displayed* orientation. |
| Technical architect | The pure helpers (clamp, output name, paper-size matcher, byte/point/inch formatting) live in `scale-format.ts` with no pdf-lib import, so the tool's first paint never pulls the PDF engine in; `scale-geometry.ts` statically imports pdf-lib and is reached through `await import("./scale-geometry")` only when a run starts. `PDFDocument.load` is called once per run, the pages are scaled **in place** and saved with `{ updateFieldAppearances: false, addDefaultPage: false }` and `updateMetadata: false` — no rebuild, so no lost document structure. The `runId` ref is compared after every await, the scale function takes an `isStale` callback and returns `null` when superseded (so a stale run can
  neither write state nor download), and the loop yields to the event loop
  after every page so the announced per-page progress can genuinely paint.
  Source bytes live in a ref, never in state, so a progress tick does not
  re-copy a 100 MB `Uint8Array`. |
| Code reviewer | `MAX_FILE_BYTES` and `MAX_PAGES` are defined once in the pdf-lib-free helper module and imported by both the component (which refuses early, via pdfjs) and the engine (which refuses again) — a duplicated literal is how a load path and an engine drift apart, and the audit's own cap checks now assert that single definition. Errors route through `friendlyError`/`userFacing`/`toUiError`, and both engine names for an encrypted file (`PasswordException` from pdfjs, `EncryptedPDFError` from pdf-lib) map to the same Unlock steer. `describeBox` names a paper size only within 1.5% of a nominal size, which is why a Node check asserts the *negative*: 50% of A4 is deliberately given no paper name, because no standard size is exactly half of A4. A malformed annotation entry (a `/Rect` that is not an array) is caught and skipped rather than thrown out of the run — `lookupMaybe` throws `UnexpectedObjectTypeError` on a wrong type, which the first draft did not handle; there is now a fixture for it. |
| End-user UX | One factor, two controls: a labelled number field for an exact percentage and a labelled slider for feel, plus 50/75/100/150/200 presets. The preview is live and states both sides in real units — "Page 1 now: Letter — 595 × 842 pt, 8.27 in × 11.69 in" and "Page 1 at 50%: …" — so the choice is informed before the run, not after. The typed value is held as text and committed on blur or Enter, so typing "500" is not rewritten under the cursor; the field clamps to 10–400% on commit and the slider is the same state. The button reads "Scale 12 pages by 50% → PDF", a Clear button drops a loaded file, and the amber box under the controls states what a scale does and does not do before anything is written. |
| Business analyst | The differentiator against every crop/stamp/flatten tool is the sentence "the text stays real", so it is stated in the control, the result panel, `tools.ts`, the long description and the guide. The other honesty that sells trust: this is *not* a page-size converter, one factor is applied to both axes so proportions never change, a digital signature does not survive the re-save, and a form field's appearance is scaled with its box rather than re-rendered. A wrong "25% to 300%" range was costing trust with anyone who read it; it is gone from all four content files and a Node check asserts it never returns. |
| Security | No upload path exists: bytes come from `file.arrayBuffer()`, are rewritten locally and saved with `downloadBlob`. `ignoreEncryption` is never switched on, so an encrypted file is refused and routed to `/use/pdf-unlock` — the previous build's `ignoreEncryption: true` produced a file that still carried its `/Encrypt` dictionary pointing at bytes that had moved, i.e. a corrupt download. Both caps (100 MB / 200 pages) are enforced before any work, the `%PDF-` header is preflighted before a parser is trusted, the output name is derived from the source with path separators and control characters neutralised, and the user's file is never written back. The file input is the only ingestion surface and no user input reaches `dangerouslySetInnerHTML`. |
| A11y specialist | A real `<label htmlFor>` opener bound with `useId`, a `<fieldset>`/`<legend>` group for the scale, a visible `Scale (%)` label for the number field, a visually-hidden but real label for the slider, `aria-describedby` pointing at the range explanation, `min`/`max`/`step`/`inputMode="numeric"` on the number field, Enter to commit, `aria-busy` on the root that clears when the run ends, an sr-only `role=status` progress line that names the real page and total, a visible `role=status` for idle/load/success ("Scaled 2 pages by 50% — downloaded sample-scaled-50pct.pdf."), `role=alert` for every refusal, the Unlock steer as a real `<Link>`, and the result as a `role="region"` with an accessible name. A 375px viewport is checked for horizontal overflow. |
| SEO/content | `TOOL_KEYWORDS["pdf-scale-pages"]` now exists at all (the tool had none) and covers "scale pdf", "resize pdf pages" and "change pdf page size", plus long tails; a `CUSTOM_TITLES` entry and a tool-specific JSON-LD `featureList` entry were added, the latter stating the real range, the uniform scale, the selectable text, the mixed-size disclosure and the Unlock steer. The long description, features, how-to and four FAQs were rewritten: the stale 25%–300% claim is gone, the output convention is named, and the non-uniform-scale FAQ answers "no" with the reason. No `guide` key was added to `ToolContent` — that type has no such field, and the marketing page already resolves guides through `getGuidesByTool("pdf-scale-pages")`. |
| Perf judge | The cost is bounded by the caps, not by the document: scaling is arithmetic on a handful of numbers per page plus one save. Nothing is rasterized and no canvas is allocated, so there is no 16 MP ceiling to hit and no DPI to report. pdf-lib's work is synchronous between awaits, so the loop yields every 25 pages; pdfjs is used only for the page count and page 1's display size at load time (one page fetched, then destroyed) rather than for rendering. A 200-page, 100 MB document is still a heavy tab, and the caps are what bound it. |

## Changes And Evidence

- `src/features/pdf-scale-pages/PdfScalePages.tsx` — rewritten: full-document
  run, caps, `%PDF-` preflight, encryption steer, run-id and busy guards,
  number + slider + presets with a live before/after preview in points and
  inches, per-page progress, mixed-size and skipped-box disclosures, result
  panel with a byte-identical re-download, `aria-busy`, `role=status`/
  `role=alert`/`role=region`, friendly-error routing, download
  `<source>-scaled-<pct>pct.pdf` via `downloadBlob`.
- `src/features/pdf-scale-pages/scale-format.ts` (new) — clamp, output name,
  byte/point/inch formatting and the paper-size matcher, with no pdf-lib
  import so the engine stays out of the initial bundle.
- `src/features/pdf-scale-pages/scale-geometry.ts` (new) — the in-place page
  scale: inheritable box reads for media/crop/bleed/trim/art, origin
  normalisation for pages whose media box does not start at (0,0), annotation
  geometry offsets, `scaleContent` + `scaleAnnotations`, a save with
  `{ updateFieldAppearances: false, addDefaultPage: false }`, and the
  displayed-box maths that matches what a reader shows.
- **A real page scale, verified in the saved bytes.** A 612×792 two-page
  fixture scaled at 50% is 306×396 in pdfjs's viewport *and* in the stored
  media box; the text strings are identical before and after; the first glyph's
  position, rendered width and rendered height are all exactly halved; the
  text matrix carries the same factor on both axes, so nothing is sheared; and
  the output still holds zero image XObjects. The 10% and 400% boundaries are
  exercised against real bytes (61.2×79.2 and 2448×3168), as is 200%
  (1224×1584, with text genuinely larger rather than merely repositioned).
- **The crop-box trap.** An explicit `/CropBox` would have been left at the old
  size by pdf-lib's `setCropBox` semantics. The fixture defines media, crop,
  bleed, trim and art boxes and asserts all of them are scaled: after 50% the
  media box is 300×390, the trim box 285×370, and pdfjs reports a visible page
  of 290×375 — exactly half of the original 580×750 visible area.
- **The non-zero-origin case.** A page with media box [20,30,620,810] and crop
  box [20,30,600,780] is re-based at the origin, its link `/Rect` is
  translated and then scaled to 100pt wide, its `/QuadPoints` and `/InkList` are
  offset and scaled, its `/L` action is untouched, and the text keeps its
  position *relative to the visible box* — the shift a naive scale would cause
  is asserted absent, not assumed away.
- **Rotation, forms and structure.** A `/Rotate 90` page comes out at 396×306
  (its displayed orientation) with the rotation flag still set; a filled text
  field keeps its name, its value and its appearance stream, with the widget
  rectangle scaled to exactly half; the document title survives and the page
  count is unchanged, because the pages are scaled in place rather than
  rebuilt.
- **Caps and error paths** are covered by real files: a 201-page document is
  refused with its real page count, a 200-page document — the exact cap — is
  scaled, a 100 MiB + 1 byte file is over the cap by arithmetic, a file without
  the `%PDF-` magic is refused by name, and the existing encrypted fixture
  raises `EncryptedPDFError` and is steered to `/use/pdf-unlock`. A superseded
  run returns `null` and can never download.
- Copy (`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
  `src/lib/tools.ts`): the real 10%–400% range everywhere, the uniform-scale
  and aspect-ratio statements, "scaled, never re-rendered", the paper-size
  boundary, the signature and form-appearance consequences, the mixed-size
  disclosure, the output convention and the caps. `tools.ts` gained the range
  and kept its name, tagline and array structure; its "uniformly" claim is now
  backed by the implementation.
- Guide: `how-to-scale-pdf-pages` (`toolSlug: "pdf-scale-pages"`, 4 sections,
  `readMinutes: 4`) — what a page scale actually changes, why uniform is not a
  paper-size converter, running the scale and downloading, and the limits with
  the signature and appearance-stream caveats.
- `audit/check-pdf-scale-pages.mjs` — **165/165** Node-mirror checks: the
  clamp boundaries, filename sanitising, the paper-size matcher (including the
  deliberate no-name case), the magic preflight, real scaling at 10/50/200/400%,
  uniform geometry, the crop/bleed/trim/art boxes, the non-zero-origin page with
  link, quad points and ink, rotation, the form field, mixed sizes, structure
  preservation, the 200/201-page boundary, the encrypted refusal, the
  malformed-annotation guard, the stale-run guard, the single-definition caps
  (the audit caught a duplicated `MAX_PAGES` literal during the final pass and
  the two modules now share one), and source-level truth for every a11y, cap,
  save-option and copy claim.
- e2e `e2e/pdf-scale-pages-browser.mjs` — **82** production-Chrome scenarios
  green and stable across repeat runs: the real opener and idle claim, the file
  summary line, the fieldset and both labelled controls, arrow keys on the
  slider, Enter to commit, both clamps, the live preview text, a 50% run with
  the downloaded bytes checked through pdfjs and pdf-lib (viewport, view box,
  text strings, glyph geometry, image XObject count), the announced per-page
  progress, the result region, a byte-identical re-download, a crop-box/
  non-zero-origin run, a rotated run, a mixed-size run, a form run, a 200% run,
  the 201-page/encrypted/non-PDF/oversize refusals, the Unlock href, Clear, a
  375px overflow check scoped to `main#main` (the site header overflow is a
  tracked residual), tool-page and guide copy honesty, the sitemap, and zero
  off-origin requests, non-GET requests, page errors and hydration warnings.
- Verification: `node audit/check-pdf-scale-pages.mjs` → **165 passed, 0
  failed**; `npx tsc --noEmit` → **0 errors repo-wide**; `npx eslint` on every touched file
  (`src/features/pdf-scale-pages/PdfScalePages.tsx`,
  `src/features/pdf-scale-pages/scale-format.ts`,
  `src/features/pdf-scale-pages/scale-geometry.ts`,
  `audit/check-pdf-scale-pages.mjs`, `e2e/pdf-scale-pages-browser.mjs`,
  `src/lib/tools.ts`, `src/lib/tool-content.ts`, `src/lib/seo.ts`,
  `src/lib/guides.ts`) → **clean, 0 errors and 0 warnings**. `npm run build`
  and the e2e harness were run by the orchestrator at verification; the agent
  per instruction was not to run them in its environment.
- Tracked residuals (accepted, disclosed):
  1. This is not a page-size converter. One factor is applied to both axes, so
     a Letter page cannot become A4 here; the component, `tools.ts`, the long
     description, the SEO feature list and the guide all say so and point at a
     page-size or crop tool.
  2. A signed PDF comes out unsigned — any re-save invalidates the signature,
     even when the page ends up the same size (100% is a valid run).
  3. An interactive form field keeps its value, but its appearance stream is
     scaled with its rectangle rather than regenerated for the new size. That
     is the honest choice: regenerating it would keep the glyphs at full size
     inside a smaller box.
  4. Under about 25% body text is hard to read even though it stays perfectly
     sharp, and above roughly 200% the page is larger than most printers can
     print. Both limits are stated in the control and the guide.
  5. Annotation geometry is scaled where it is defined on the annotation. A
     field whose `/Rect` lives only on the field dictionary, and a named
     destination or link target that points at an absolute page coordinate,
     are outside what a page scale can move.
  6. A page box that is malformed or degenerate is left untouched rather than
     dropped, and the result panel counts and discloses it instead of claiming
     a perfect result.
  7. pdf-lib rewriting is single-threaded and memory-bound: a 200-page, 100 MB
     file is a heavy tab. The event-loop yields keep the progress line honest
     and the caps bound the worst case.

Files: `src/features/pdf-scale-pages/PdfScalePages.tsx`,
`src/features/pdf-scale-pages/scale-format.ts`,
`src/features/pdf-scale-pages/scale-geometry.ts`, `src/lib/tool-content.ts`,
`src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-pdf-scale-pages.mjs`, `e2e/pdf-scale-pages-browser.mjs`.
