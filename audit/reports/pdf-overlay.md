# PDF Overlay: Parallel Judges Audit

Date: 2026-09-26. Status: forty-second tool upgraded and verified — the first
tool of the eighth audit wave. Ten judges (functional, PDF/domain expert,
technical architect, code reviewer, end-user UX, business, security, a11y,
SEO and performance) returned; every gap raised was closed and verified.
Focus of the round: a real, correct compositing path (the previous build
emitted a dangling XObject and produced a file with no stamp on it at all),
CropBox- and rotation-correct placement, a page-range scope, PDF-point
offsets, and copy that never lies about what an overlay does and does not do
to text.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The old tool stamped "every page" and gave no way to target a subset, no X/Y offsets, and no numeric fallback. Users need: two labelled file openers, eight position presets, X/Y offsets in PDF points, opacity, all-pages vs a validated range (`1-3,7`), cycle vs first-page-only stamp mapping, a live preview, a refusal when the stamp would fall completely off the page, and a `<base>-overlaid.pdf` download. The harness must verify the downloaded bytes, not the UI's claims. Two gaps found during the round and closed: the range field must apply *only* in range mode (otherwise a stale range changed the button count without changing the run), and an off-page refusal must not disable the button — the user gets an inline "nothing will be drawn" note and the refusal is raised on click, so an unrelated bad range never blocks a valid run. |
| Domain expert (PDF) | The old code did `stampDoc.embedPage(stampPage)` and drew the result onto a **base** page. pdf-lib allocates the embedded object in the *calling* document's context, so this produced a page whose `/XObject` name pointed at an object that does not exist in the base file — pdfjs logged `XObject should be a stream` and the stamp never appeared. The fix is `baseDoc.embedPage(stampPage)`, cached per stamp page. Verified: the fixed path writes a real `/Form` XObject and pdfjs extracts the stamp text; the old path leaves a non-`/Form` dangling entry. Opacity must land in the page's `/ExtGState` `/ca`; placement must be a `1 0 0 1 x y cm` (or a scale+translate matrix for stretch). Export with `updateFieldAppearances: false, addDefaultPage: false`; never `ignoreEncryption`. Two further points the round closed: placement is measured on the page's **CropBox** (the part a reader actually sees) and the CropBox origin is added back when the content stream is written, and placement stays in the page's own unrotated coordinates so a `/Rotate 90` page turns its stamp along with its text. |
| Technical architect | pdf-lib is imported lazily so the initial JS payload stays small; pdf.js is used only for the preview page. A `runId` ref bails after every await so a superseded run cannot write state or download; a separate `previewEpoch` ref plus a render-task destroy stops a slow preview from overwriting a newer one. The full plan (all placements validated) is built *before* the first `drawPage`, so an invalid run never produces partial output. Every target page is measured against its own visible box, so mixed portrait/landscape documents stay correct, and the CropBox origin and `/Rotate` flag are read once per file at load time. The preview rasterizes the base page the way a reader sees it and the stamp unrotated (the orientation `drawPage` uses), then turns the stamp with CSS to match — so the preview and the download cannot disagree about rotation. |
| Code reviewer | `friendlyError`/`userFacing`/`toUiError` routing so engine throws become friendly steers; the fallback message no longer lower-cases the label (it said "the base pdf" — fixed to "the base PDF"). `outputNameFor` strips only a trailing `.pdf`, case-insensitively, then neutralises path separators and control characters and trims to 80 characters, so a file named `../../etc/passwd.pdf` cannot steer the download path. One name is built and used for the download and the "download again" button. Embedded stamp pages are cached in a `Map<number, PDFEmbeddedPage>` so a 200-page run embeds at most `min(stampPages, targets)` times. A failed load clears its own document so there is no half-loaded state. |
| End-user UX | A live preview of the first page about to be stamped, with the stamp drawn at the exact size, position and transparency it will get, plus a readout of the geometry in PDF points ("Stamp 595.28 × 148.82 pt at x 0, y 347 on page 1 (595.28 × 841.89 pt) at 35% opacity"). A partly off-page stamp is disclosed ("Part of the stamp hangs off the page edge and will be cropped"); a fully off-page stamp is refused by page number. Every slider has a typed value beside it and both clamp to the same bounds (±600 pt, 5–100%), presets are `aria-pressed` buttons, and the submit button states the page count it will stamp. |
| Business analyst | Trust is the product. The copy must state that the stamp is drawn into the page above the base content, that this is **not a merge**, that the base keeps its page count/text/links/annotations/fields — and it must state the awkward parts plainly: if the stamp PDF contains real text, that text is embedded as page content and stays visible, extractable and searchable; the file is re-saved, so a digital signature on the base does not survive; and a page carrying its own rotation turns its stamp. It is not a way to hide content, and encrypted uploads are steered to PDF Unlock. One copy bug found and fixed: the FAQ told users to change the stamp's size with the X/Y offsets, which move a stamp and never resize one. |
| Security | No upload path exists in the tool: bytes are read with `file.arrayBuffer()`, composed with pdf-lib, and saved locally. `ignoreEncryption` is gone, so a protected file is refused rather than partially processed. Both files are preflighted for the `%PDF-` magic bytes within the first kilobyte before the parser is trusted, and the user's bytes are never written back — verified byte-for-byte after a run. Caps (100 MB / 200 pages) are enforced before any compositing work. |
| A11y specialist | Two real `<label>` openers bound to hidden inputs with `useId` ids and distinct `aria-label`s. The labels use `has-[:focus-visible]:` for their focus ring (the previous `peer-focus-visible:` could never match — the inputs are siblings, not ancestors, of the labels, so the ring was dead). Three `fieldset`/`legend` groups in a fixed order, every control bound to a real label, four `role=status` regions (sr-only busy line, idle/ready, placement readout, refusal/notice), `role=alert` for errors, and `aria-busy` on the root container. The unlock steer is a real `Link` to `/use/pdf-unlock`. |
| SEO/content | `TOOL_KEYWORDS["pdf-overlay"]` (incl. "overlay pdf online", "stamp pdf onto another pdf", "overlay pdf without uploading"), a truthful `TOOL_FEATURE_LIST` JSON-LD string, `CUSTOM_TITLES` "Overlay PDF online — stamp one PDF onto another free", a rewritten long description / feature list / 5-step how-to / 8-question FAQ, an accurate tool description, and a new guide `how-to-overlay-pdfs-online` whose central section is the extractable-text disclosure. All three surfaces now state the signature caveat and the rotation behaviour, and the preview is described as "the first page you are about to stamp" rather than "page 1". Sitemap picks the guide up automatically from `GUIDES`. |
| Perf judge | Cost is bounded by the targets, not the document: one embed per distinct stamp page, cached; a per-page visible-box array computed once at load; no rasterization of the document at all (only the single preview page, at `PREVIEW_SCALE = 1.4`, and only on change). The preview's scale is reduced rather than failing when a page's raster would exceed the browser's canvas area limit. pdf-lib's draw/save work is synchronous, so the loop yields via `requestAnimationFrame` after the first page and every `PAINT_EVERY = 25` pages, which lets the progress line actually repaint on a long run. Caps keep the worst case at 200 pages. |

## Changes And Evidence

- `src/features/pdf-overlay/PdfOverlay.tsx` (rebuilt) — two labelled file
  openers, `%PDF-` preflight, 100 MB / 200-page caps, encryption steer,
  `aria-busy`, `runId` bails after every await, busy guards, preview
  epoch/cancel guard, friendly-error routing, download
  `<base>-overlaid.pdf` via `downloadBlob`.
- **The regression, fixed and guarded.** The old build called
  `stampDoc.embedPage(stampPage)`; because pdf-lib allocates the embedded
  object in the *calling* document's context, the saved base file carried an
  `/XObject` name that pointed at an object the base file did not contain.
  pdfjs rejected it (`FormatError: XObject should be a stream`) and the stamp
  was simply absent from the output. The component now embeds through the
  base document (`baseDoc.embedPage(stampPage)`), cached per stamp page.
  `audit/check-pdf-overlay.mjs` runs both paths and asserts the difference:
  the fixed output's XObject resolves to a real `/Form` stream and its text
  extracts, while the old path leaves a non-`/Form` dangling entry.
- Geometry and appearance are verified in the saved bytes, not in the UI:
  every preset/offset pair writes the expected `cm` translate; the stretch
  preset writes a non-uniform scale matrix; `stretch` covers the full page box
  at the origin; opacity 25/50/100% appear as `/ca 0.25 / 0.5 / 1` in the
  page's `ExtGState`; cycle mode gives base page 2 the stamp's page 2 and
  wraps base page 3 back to stamp page 1; first-page mode repeats stamp page
  1 everywhere; the base page count and base text survive.
- **CropBox and rotation.** Placement is computed against each page's
  CropBox and written at `box.x + x`, `box.y + y`. A dedicated fixture with a
  non-zero CropBox origin proves the origin is added back into the content
  stream (`cm` = origin + fitted placement) and that the page still receives
  its stamp; a mixed portrait/landscape fixture proves each page is placed
  independently; and the component reads `/Rotate` per page, stamps in the
  page's own unrotated coordinates, and says so in the preview when a page is
  rotated.
- **The user's file is never rewritten.** A check runs a full overlay over the
  same bytes twice and compares: the base and stamp byte arrays are identical
  after the run, and two runs over the same input produce byte-identical
  output (no timestamp leaking into the file).
- Page selection reuses the shared `pageRangeSyntaxError` from
  `src/features/pdf-office/support.ts` so the message matches the rest of the
  family; the range applies only when "Only a page range" is selected; an
  empty range means every page, duplicates are de-duplicated and sorted, and a
  downward or past-the-end range is refused with the real page count. The
  whole plan is validated before the first `drawPage`, so a refused run
  produces no output at all.
- Copy (`src/lib/tool-content.ts`, `src/lib/tools.ts`, `src/lib/seo.ts`,
  `src/lib/guides.ts`): honest about the searchable stamp text, the "not a
  merge" framing, the unchanged base page, the fit-to-page preset behaviour
  (including the corrected size FAQ), page rotation, the signature caveat, the
  caps, the Unlock-PDF steer, and no uploads. No drag-and-drop claim.
- Guide: new `how-to-overlay-pdfs-online` (`toolSlug: "pdf-overlay"`,
  5 sections) — what overlaying does, positions/offsets/opacity, page ranges
  and stamp mapping, the honest searchable-text limit with the redaction and
  flatten alternatives, and the caps/privacy limits. A `guide` field was
  **not** added to `ToolContent`: `ToolContent` has no such field, and the
  marketing page already renders a "Related guides" section from
  `getGuidesByTool(tool.slug)`, so the guide is linked in both directions by
  the existing `toolSlug` relationship — visible on `/tools/pdf-overlay`, back
  to the tool on `/guides/how-to-overlay-pdfs-online`, and picked up by the
  sitemap from `GUIDES`. Adding an unused, unrendered key would have been
  dead data.
- `audit/check-pdf-overlay.mjs` — **99/99** Node-mirror checks, including the
  two regression guards above, real pdf-lib/pdfjs assertions over generated
  fixtures written to a temp dir, the CropBox-origin and byte-immutability
  checks, the offset/opacity clamping and the `OFFSET_LIMIT`/`MIN_OPACITY`
  mirrors, pdf.js opening a full 200-page overlaid file (the preview engine at
  the cap), encryption/invalid/oversize/over-page paths, and source-level
  lifecycle checks (run-id bail after every await, busy guards, preview epoch,
  no half-loaded state, lazy pdf-lib import, base-context embedding, embed
  cache, sanitized download name).
- `e2e/pdf-overlay-browser.mjs` — 62 authored production-Chrome scenarios
  plus a harness-exception guard (**not run** in this environment by
  instruction; `node --check` parses it):
  two distinct file-input accessible names, controls hidden until both files
  are open, the `/neither is uploaded/` idle claim, per-file load statuses,
  the preview's position-bearing `aria-label`, the placement readout, three
  legends, eight `aria-pressed` presets, three labelled sliders plus three
  typed values, preset/offset/opacity reflected live, range validation with an
  inline error and a disabled submit, `<base>-overlaid.pdf` naming, busy
  announced via a MutationObserver recorder, the `cm` translate in the
  download, the real `/Form` XObject, `/ca` opacity, untouched page 3, cycle
  vs first-page text, partly-off disclosure, a fully-off refusal with no
  download event at all, the stretch scale matrix, the unlock steer plus its
  link, invalid/oversize/over-page caps, cleared state after a failed load,
  zero hydration/page errors, honest copy on `/tools/pdf-overlay`, the guide's
  disclosure, the marketing page's related-guide link, and the sitemap. One
  assertion bug found while reconciling the harness with the final component:
  the first-page-mode check was inverted (`!(/Do/.test(...))` on a page that
  *should* carry a stamp) and is now asserted in the right direction.
- Verification: `node audit/check-pdf-overlay.mjs` → **99 passed, 0 failed**;
  `npx tsc --noEmit` → **0 errors repo-wide**; `npx eslint` on every touched
  file (`src/features/pdf-overlay/PdfOverlay.tsx`,
  `audit/check-pdf-overlay.mjs`, `e2e/pdf-overlay-browser.mjs`,
  `src/lib/tools.ts`, `src/lib/tool-content.ts`, `src/lib/seo.ts`,
  `src/lib/guides.ts`) → **clean, 0 errors and 0 warnings**. Two
  `react-hooks` errors and one dependency warning raised by the
  compiler-aware rules during the round were fixed rather than suppressed: the
  derived plan was lifted to a module-level `buildPlan` instead of a `useMemo`
  the compiler could not memoize, the preview effect no longer calls `setState`
  in its body (previews are cleared in the event handlers that replace them),
  and the effect's dependency list is complete. `npm run build` and the e2e
  harness were **not run** in this environment by instruction.
- Tracked residuals (accepted, disclosed):
  1. An embedded stamp is a real stamp — its text remains extractable and
     searchable. This is correct behaviour, stated in the component copy, the
     marketing copy and the guide rather than papered over.
  2. The preview renders the first page about to be stamped, not every page.
     Every target page is still measured and validated individually, and the
     download is authoritative.
  3. A page with a non-zero CropBox origin or a `/Rotate` flag is stamped
     correctly, but the preview of a rotated page is an approximation of the
     rotation (it turns the stamp in CSS to match the rendered base page);
     the download is the authority, and the component discloses the rotation
     next to the preview.
  4. pdf-lib compositing is single-threaded and synchronous between awaits;
     a 200-page run of two near-100 MB files is memory-hungry in a browser
     tab. The `requestAnimationFrame` yields keep the UI responsive, and the
     caps bound the worst case.
  5. Document-level structure (bookmarks, named destinations, metadata) is
     carried through by pdf-lib's save, but this tool makes no promise about
     preserving it beyond the base pages it does not touch.

Files: `src/features/pdf-overlay/PdfOverlay.tsx`, `src/lib/tool-content.ts`,
`src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-pdf-overlay.mjs`, `e2e/pdf-overlay-browser.mjs`.
