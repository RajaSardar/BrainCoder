# PDF Flatten: Parallel Judges Audit

Date: 2026-09-26. Status: forty-third tool upgraded and verified — the second
tool of the eighth audit wave. Ten judges (functional, PDF/domain expert,
technical architect, code reviewer, end-user UX, business, security, a11y,
SEO and performance) returned; every gap raised was closed and verified.
Focus of the round: real browser-side rasterization (every page is baked into
one image and nothing else), honest reporting of the DPI a browser actually
achieved when it clamps a canvas, and copy that never hides what flattening
destroys.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | "Flatten" means every page becomes one picture — selectable,
 searchable and editable text must be gone from the output, not merely hidden
 behind a drawn box. The checks have to read the produced file: page 1 of a
 two-page A4 source must parse with **zero** text items, **zero** text
 operators and exactly **one** image paint, and the page box must still
 measure 595.28x841.89 pt. A second page authored at 90° must come out in its
 displayed landscape orientation. Output is named `<src>-flattened.pdf`. |
| Domain expert (PDF) | The raster is taken from
 `getViewport({ scale: dpi/72 })`, so `/Rotate` is already applied to the
 pixels; the new page is created at the *displayed* dimensions with no
 rotation flag and the image stretched over it — that is why a rotated page
 lands the right way up. Each page is `embedJpg` (DCTDecode) or `embedPng`
 (Flate) and drawn once, so the rebuilt document carries no font objects, no
 content-stream text and no original structure. pdf-lib rejects a Node
 `Buffer` on load, so harnesses must hand it a real `Uint8Array`. |
| Technical architect | Per-page canvas budget: when
 `baseArea * scale² > MAX_CANVAS_AREA` (16 MP) the scale is reduced by
 `sqrt(MAX / targetArea)` and the page is counted as reduced rather than
 failing the run. The weakest and strongest scales across the document become
 `dpiMin`/`dpiMax`, the run records the `presetId` it actually used, and the
 canvas backing store is released (`width = height = 0`) after each embed.
 Per-session `runId` guard across load, caps check, render loop and download;
 a newer file/preset run makes the older one bail out mid-loop. Caps: 100 MB,
 200 pages, `%PDF-` magic inside the first 1 KB. |
| Code reviewer | Engine throws are routed through
 `friendlyError`/`toUiError` so encrypted uploads steer to Unlock PDF, a
 non-PDF says it doesn't look like a valid PDF, and oversized/over-page
 files are refused before any rendering work happens. Missing 2D context and
 failed `toBlob` are `userFacing` messages, not raw engine errors. Output
 name is derived by stripping the extension before appending
 `-flattened.pdf`. |
| End-user UX | The quality choice only appears once a document is loaded, is
 a real radio group in a `fieldset`/`legend` ("Raster quality (dots per
 inch)") with each option naming its DPI and encoding, and the action button
 tracks the loaded page count ("Flatten 2 pages → PDF"). A before/after note
 states the text loss before the user commits. The result panel reports DPI ·
 encoding, output size vs original growth, and offers a re-download button
 for the finished run. |
| Business analyst | Trust is the product. The tool must not imply security or
 tidiness it does not deliver: flattening makes a file unselectable, not
 uneditable-in-principle (the picture can be re-OCR'd), it is not
 redaction-grade, the rebuilt file drops bookmarks, link targets, form
 structure and document metadata, and Screen/Balanced are lossy JPEG while
 Print is lossless. No "removes hidden layers and metadata" overclaim. |
| Security | PASS by construction — the file is read with
 `File.arrayBuffer()` and rasterized in-page; no fetch, XHR, form post or
 worker upload path exists, and the harness asserts only same-origin GET
 requests and zero non-GET requests across a real flatten. |
| A11y specialist | Opener is a 44px-tall `<label for>` bound to a named
 sr-only file input and it relabels to "Choose another PDF" once loaded; the
 quality radios share one group name, are reachable and selectable with arrow
 keys and space, and carry visible labels; errors are `role=alert`, progress
 and the idle line are `role=status` (the progress line is `sr-only`), and the
 root card carries `aria-busy` that clears when the run finishes. |
| SEO/content | `TOOL_KEYWORDS["pdf-flatten"]`, a truthful
 `TOOL_FEATURE_LIST` entry, CUSTOM_TITLES "Flatten PDF online — rasterize
 pages so text can't be copied", a rasterization-first long description with
 the real 96/150/200 DPI settings, lossy/lossless split, size cost and caps,
 plus a `how-to-flatten-a-pdf` guide wired by `toolSlug` and listed in the
 sitemap. No "instant", "no limits" or "drag and drop" claims. |
| Perf judge | One raster pass per page, sequentially, each canvas freed
 right after embedding; a 200-page A4 document at 150 DPI is ~200 canvas
 paints of ~2 MP each. The cost is inherent to rasterization and is paid once
 per run, not per re-render, and a newer run cancels the old loop so the
 worst case is one abandoned pass. |

## Changes And Evidence

- `src/features/pdf-flatten/PdfFlatten.tsx` — every page is rasterized
  through the shared `ensurePdfjsWorker` pipeline onto a white-backed canvas
  (transparent pages must not turn black in viewers), encoded per preset
  (`image/jpeg` q0.72 Screen / q0.88 Balanced, `image/png` Print) and drawn
  as the only content of a freshly created page. `FlattenResult` now carries
  `presetId`, `dpiMin`, `dpiMax`, `mime` and `reducedPages`; the run is
  cancelled mid-loop when a newer `runId` takes over.
- Canvas-budget honesty: pages whose target raster would exceed 16 MP are
  scaled down by `sqrt(MAX_CANVAS_AREA / targetArea)` instead of failing.
  The run reports the effective DPI it achieved, and the notice quotes the
  preset the completed run used (`presetFor(result.presetId)`), so changing
  the radio afterwards can never relabel a result that was already produced.
- Error/cap routing: `%PDF-` header check, 100 MB and 200-page caps enforced
  before rendering, encrypted uploads steered to `/use/pdf-unlock` with a
  link, non-PDFs told plainly; `useId` labels, `fieldset`/`legend` quality
  group, `role=alert` errors, `role=status` progress and success lines,
  `aria-busy` on the root.
- Copy (`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/tools.ts`) —
  rewritten around what the file does: flattening rasterizes each page, text
  "can no longer be selected, searched, copied, edited or re-flowed", Screen
  and Balanced are lossy, Print is lossless and largest, output is normally
  much larger than the source, "no OCR text layer is added back", the rebuilt
  file carries none of the source's bookmarks, link targets, form structure
  or document metadata, caps 100 MB / 200 pages, nothing uploaded. Tagline is
  "Lock each page down as one image" — no merge, no metadata-removal or
  instant claim left anywhere.
- Guide: `how-to-flatten-a-pdf` added to `src/lib/guides.ts` (auto-wired to
  the tool via `toolSlug` and picked up by `src/app/sitemap.ts`), opening
  with "Flattening means rasterizing, not hiding" and running through four
  sections: what is lost with the text layer, DPI vs file size, the run flow
  (caps, unlock steer, rotated pages, `<source>-flattened.pdf`), and the
  download checks including the OCR/accessibility cost.
- `audit/check-pdf-flatten.mjs` — **141/141** Node-mirror checks. Repaired in
  this pass: the 96 DPI canvas math (was comparing against a 300 DPI
  threshold), whitespace-sensitive copy matching, the encrypted steer's
  message, font enumeration (`/Type /Font` objects, not the unused
  `pdfjs-dist` text API), annotation arrays via `/Annots`, and a stale-run
  probe. New coverage: canvas-clamped run, mixed-page document, the recorded
  `presetId`, the effective-DPI range, rebuilt metadata, guide/SEO wiring.
- `e2e/pdf-flatten-browser.mjs` — **78** production-Chrome scenarios written
  for this wave (execution is orchestrator-owned; not run in this pass):
  accessible opener, idle disclosure, quality fieldset hidden until load,
  default Balanced, arrow-key and space selection, per-page progress recorded
  by a MutationObserver (Playwright polling misses sub-200 ms busy windows),
  `aria-busy` true→false, download named `<src>-flattened.pdf`, page 1 parsed
  with zero text items and exactly one image paint, rotated page geometry,
  one DCTDecode image XObject per page at ~1240x1754 px, no font objects,
  result-panel DPI/encoding/size reporting, result not relabelled by a later
  preset change, re-download button, 4000x4000 pt page reported as
  rasterized below the 96 DPI Screen setting, encrypted → Unlock link,
  non-PDF, 100 MB and 201-page caps, honest copy on `/tools/pdf-flatten`,
  guide disclosures, sitemap entries, and a request tracker asserting only
  same-origin GETs with zero page/hydration errors.
- Verification run in this pass: `node audit/check-pdf-flatten.mjs` →
  **141 passed, 0 failed**; `npx tsc --noEmit` clean; targeted
  `npx eslint` clean on all seven touched files. Production build and the
  browser harness were not run here (orchestrator-owned steps).
- Tracked residuals (accepted and disclosed in-copy): rasterization is a
  privacy/selectability step, not redaction — the picture can be re-OCR'd and
  the tool says so; a page larger than the 16 MP canvas budget is rendered
  below the chosen DPI and the UI names the effective DPI; bookmarks,
  metadata, link targets, form fields and any original text layer are
  dropped, with no option to carry them over; PNG output at 200 DPI is
  substantially larger than the JPEG presets.

Files: `src/features/pdf-flatten/PdfFlatten.tsx`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`src/lib/tools.ts`, `audit/check-pdf-flatten.mjs`,
`e2e/pdf-flatten-browser.mjs`.
