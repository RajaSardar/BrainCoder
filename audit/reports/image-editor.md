# Image Editor: Parallel Judges Audit

Date: 2026-09-29. Status: fiftieth tool rebuilt and verified — the third tool
of the ninth audit wave. Ten judges (functional, image/domain expert, technical
architect, code reviewer, end-user UX, business, security, a11y, SEO and
performance) returned; every gap raised was closed and verified. Focus of the
round: an in-browser image editor has to be honest about which of its
operations move pixels and which resample them, and it has to refuse rather
than quietly deliver a different file than the one that was asked for — the
whole value of the tool is that the file on disk is the file that was measured.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The component itself was sound on geometry but wrong about coordinates. The crop drag measured the pointer against the painted frame and then stored the result as a crop in the image's own coordinates — correct only while the image was unrotated and unmirrored, and silently wrong in exactly the case the guide advertises ("a crop you set is carried through a later rotation"). Closed: the drag is now measured with `naturalPoint`, which inverts the matrix the canvas was actually painted with, so a rotation or a mirror needs no special case at all. Three further defects were closed in the same round. The result panel's object URL was never revoked, so every export leaked a full-size blob for the life of the page; `releaseResultUrl`/`clearResult` now run on every edit, undo, crop drag, new file, close and unmount. The Download button was `disabled` whenever the plan was refused, which hid the only moment the refusal reason mattered — it is now clickable and repeats the reason in a `role="alert"`, with `aria-describedby` pointing at the paragraph that explains it. And `exportImage` cleared the result panel *before* testing the plan, so a refused export destroyed the previous good file's panel and its re-download; the refusal branch now returns first. |
| Domain expert (image) | Deciding what this tool can honestly claim starts with one distinction the copy now makes explicit: rotation, mirroring and cropping rearrange the pixel grid, so they are exact; resizing is the only operation that resamples, and it is the browser's own resampler, so enlarging interpolates and cannot invent detail. That is not an AI upscaler, and the limits box, the long description, the features, the FAQs and the guide all say so in those words. A second honesty question is metadata: the browser decodes pixels, so EXIF, GPS, timestamps and the ICC profile are gone at that moment — the one EXIF field that changes what you see is the orientation flag, which is why `createImageBitmap` is called with `imageOrientation: "from-image"`, and the tool says that is the only field it honours. A third is animation: GIF and animated WebP arrive as their first frame, named as such in the copy. A fourth is the encoder: `canvas.toBlob` can hand back a different type than was asked for, so the filename comes from the MIME type that actually came back (`outputNameForMime`) and a substitution is announced rather than hidden. |
| Technical architect | The pure decisions live in two browser-free modules, verified by a check: `editor-format.ts` (caps, header sniffing, dimensions per format, the preflight refusals, the matrix algebra, `outputFrame`, `planOutput`, `previewTarget`/`renderTarget`, the naming, the error classification) and `editor-pixels.ts` (the adjustment and filter chain, annotation geometry, stroke simplification). Everything that touches a canvas lives in the component. The architecture's central decision this round is `planPaint(state, viewMode, size)`: what a state *should* paint is computed from that state alone, never from a size captured at the last render, and a refusal returns `null` — so nothing is painted and the last render that did fit stays on screen instead of being blanked. `paintRef` holds what is actually on the canvas, so pointer maths can never use a stale size, and the same run-id guard cancels an in-flight decode or encode when a newer one starts. |
| Code reviewer | Every cap is declared once in `editor-format.ts` and imported, and the three user-facing labels are *derived* (`25 MB`, `16 MP`, `8192 px`), so the UI cannot quote a number the planner does not enforce. The judge's review of the pure modules found four real defects, all closed: `normalizeCrop` accepted `NaN` and infinite requests, so a degenerate value could reach the renderer; `clampQuality` snapped with `Math.round(v / step) * step`, and `0.3 / 0.05` is `6.000000000000001` in binary floating point, so the 0.30 floor came back as `0.30000000000000004` and never equalled the constant it came from — it now counts in twentieths; `adjustmentSummary` could print a non-finite adjustment while the pixel code clamped it; and a comment in a pure module named a browser type. The audit itself was wrong in a dozen places (mirror and half-turn inverses, aspect ratio, crop origin, pixel-budget fixtures, the saturation coefficients, the text cap, the byte formatter) and disagreed with code that was right — that is the mirror's own value: it was corrected to derive expectations from the matrices and to transpile and compare the repo's real `src/lib/format.ts` instead of a hand-copied second implementation. |
| End-user UX | The tool boots empty with no invented image and no download control until a file is open, and the empty state says the image is never uploaded. The stage is the canvas, capped at 1200 px on the long side so a large image still repaints, and the export is always rendered at full size — the difference is stated under the stage. The output line names the size, the format, the quality, the rotation, the mirror, the crop, the scale, the adjustments, the filter and the annotation count, so the file about to be downloaded is legible before it is downloaded. Scale is offered three ways (field, slider, presets) and typed values are held as text and committed on blur or Enter, so "2.5" is not rewritten under the cursor; out-of-range values are clamped and shown clamped. A crop can be typed as well as dragged, and a drag counts as one undo step. Every download is named for what is in it, and the result panel shows the downloaded file itself from the same bytes, with the stale re-download removed the moment anything changes. |
| Business analyst | The differentiator is not "we have an editor" — it is that this one refuses. A 400% request that would come out at 48 megapixels is answered with the size it asked for, the budget it broke and the largest scale that would fit, because silently handing back a smaller file is a different file from the one that was asked for. The copy leads with that rather than burying it. The registry entry, the long description, twelve features, four how-to steps, seven FAQs, the meta title, the JSON-LD feature list and the guide were all written around three differentiators: exact geometry versus a resampling resize, real caps with real numbers, and a local-only privacy promise stated where a buyer looks first. The format table is honest per format (PNG lossless and largest, JPEG lossy and composites transparency on white, WebP lossy and smaller with a stated fallback), and the "what this is not" list — no layers, no PSD, no selection, no healing, no AI, no HEIC/AVIF/RAW, no redo — is stated rather than left to be discovered. |
| Security | There is no ingestion path but a file input and no upload: the file is read with `file.arrayBuffer()`, decoded with `createImageBitmap` and encoded from a canvas, all in the tab, and the e2e asserts zero off-origin requests and zero non-GET requests. Every refusal happens before a decoder is handed the bytes — the file size, then the format sniffed from the header rather than the extension, then the declared size, then the side and pixel caps — so a renamed text file and a 25-megapixel file are turned away by the preflight rather than by an engine error later. The output name is neutralised by `safeStem`: path separators, reserved characters, control codes and a leading dash or dot are replaced, and a stem left with nothing falls back to a default, so the download can never be `....png` or hidden. Only a local `data:`/`blob:` object URL is created, and it is revoked on every state change and on unmount. The component holds no `dangerouslySetInnerHTML`, and no file-derived value — a name, a rejection message, a byte count — is ever rendered as markup rather than as escaped text. |
| A11y specialist | A `<label htmlFor>` opener bound with `useId`, six `<fieldset>`/`<legend>` groups, visible labels on every number and select, a visually-hidden label on the scale slider that announces the current value, `aria-describedby` from the scale field to the projection sentence, from the format select to the format's trade-off note and from the quality slider to its own note, `min`/`max`/`step`/`inputMode` on the numbers, Enter to commit a crop or a scale, `aria-pressed` on the rotation, mirror, filter and tool buttons, `aria-busy` on the root for every decode and encode, an sr-only `role=status` while busy, visible `role=status` lines for the file, the output line, the load message and the success message, and `role="alert"` for every refusal. The one finding: a refused export disabled the Download button, which is invisible to a keyboard user and to a screen reader at the exact moment the reason matters — the button now stays enabled, is wired to the refusal paragraph with `aria-describedby`, and pressing it repeats the reason in an alert. The stage canvas is `role="img"` with a label that carries its real on-screen size and the crop or annotation state, and the result is a named `role="region"` whose image `alt` describes the actual file. |
| SEO/content | The tool had no keywords, no custom title, no JSON-LD feature list and no guide. All four were added: twenty long-tail keywords that match what the tool does (`crop image online`, `rotate image online`, `annotate image online`, `private image editor browser`, `offline image editor`, …), a meta title, a feature list that names the exact geometry, the uniform scale, the per-pixel adjustments, the coordinate-carrying annotations, the 30-step undo, the quality argument, the three caps, the naming convention and the full list of what is not supported, and a seven-section guide covering which edits are exact and which resamples, why a crop survives a later rotation, why an over-budget export is refused instead of shrunk, what the file loses on the way out, how the format and the quality slider interact, and what the tool is not. The long description, the features, the how-to steps, the FAQs and the guide were all reconciled against the code in this round: the guide's caps were missing the 16 MP figure, the refusal paragraph contradicted the button's behaviour, the 120-character text cap and the annotation flattening were not stated, and a literal `8 × 8 px` had been written as an HTML entity that rendered as `8` and `8 px`. The audit asserts the copy cannot state a cap, a filter or a limit the module denies. |
| Perf judge | The cost is bounded by the caps rather than by taste, and the caps are disclosed: a 16-megapixel adjustment pass allocates about 61 MB of pixel buffer, and the limits box prints that figure rather than leaving it to be discovered. The preview is capped at 1200 px on the long side so a large image still repaints at a bounded cost, while the export is rendered at full size once. The expensive per-pixel work runs only when the adjustments or the filter are not neutral (`applyAdjustments` returns immediately otherwise), and the freehand stroke is simplified to at most 400 points before it is stored, so a long drag cannot grow the state without bound. Canvas pixels are released immediately after `toBlob`, both in the export path and on the failure path, so a 16 MP canvas does not sit resident while the user reads the result. The two bounding-store pixel buffers are the only large allocations, and both are sized by a cap the user was told about. |

## Changes And Evidence

- `src/features/image-editor/ImageEditor.tsx` — rewritten around three
  decisions. The crop drag is measured in the image's own coordinates through
  `naturalPoint`, which inverts the matrix the canvas was actually painted with
  (`paintRef`), so a rotation or a mirror needs no special case; `planPaint`
  returns `null` for a refused state, which leaves the last render that fitted
  on screen instead of blanking it; and result URLs are revoked by
  `releaseResultUrl` through `clearResult` on every edit, undo, crop drag, new
  file, close and unmount. The Download button stays enabled for a refused plan
  and repeats the reason in an alert; `exportImage` returns on the refusal
  before it touches the result panel, so a refused export cannot destroy the
  previous good file's panel or its re-download. An empty text stamp is refused
  with a reason instead of drawing nothing, and the crop is stored and applied
  as one undo step.
- `src/features/image-editor/editor-format.ts` — the pure decisions: caps and
  their derived labels, the input format table and its real `accept` strings,
  `sniffImageFormat` from header bytes, `readImageSize` per format, the
  preflight with a typed reason per refusal, the matrix algebra
  (`applyMatrix`, `multiplyMatrix`, `invertMatrix`, `transformPoint`,
  `transformRect`, `projectRect`), `outputFrame`, `normalizeCrop`,
  `clampScale`/`maxScaleFor`, `planOutput` (with a
  `side`/`pixels` attribution and the largest scale that would fit),
  `previewScaleFor`/`previewTarget`/`renderTarget`, `qualityAppliesTo`,
  `clampQuality` (counted in twentieths, so the 0.30 floor is exactly 0.30),
  `safeStem`/`outputNameFor`/`outputNameForMime`/`formatForMime` and the error
  classification with one honest sentence per kind. No browser API, asserted by
  a check.
- `src/features/image-editor/editor-pixels.ts` — the pure pixel and annotation
  maths: the adjustment chain in the order the UI states it (brightness, then
  contrast, then saturation, then the filter), the CSS-compatible contrast
  slope, the Rec. 601 luma, the six filters with per-filter notes, the clamping
  and the summary of what is in the pixels, annotation geometry, `widthOnCanvas`
  and `outputBrushWidth` (screen pixels become output pixels, so a thin stroke
  exports thin), arrowhead geometry, `simplifyFreehand` and the text cap.
  Alpha is never touched. No browser API, asserted by a check.
- `src/lib/tool-content.ts` — the `image-editor` long description, twelve
  features, four how-to steps, seven FAQs and the five related slugs, written
  around exact-versus-resampling geometry, the caps that refuse with real
  numbers, the format table and the local-only privacy promise. Fixed in this
  round: a literal `8 × 8 px` had been written as `8 &times; 8 px`, the
  120-character text cap is now stated, and the annotation baking into a single
  canvas with no layers and no PSD is stated where the features promise it.
- `src/lib/tools.ts` — the entry reads "Crop, rotate, resize & annotate" with a
  description that states the exact geometry, the three formats and the refusal
  behaviour.
- `src/lib/seo.ts` — `TOOL_KEYWORDS["image-editor"]` added (20 long-tail
  entries), a `CUSTOM_TITLES` entry added, and a tool-specific JSON-LD
  `featureList` entry that names the exact geometry, the per-pixel chain, the
  coordinate-carrying annotations, the 30-step undo, the three formats, the
  three caps and the full list of what is not supported.
- `src/lib/guides.ts` — new guide `how-to-edit-an-image-online`
  (`toolSlug: "image-editor"`, 7 sections, `readMinutes: 5`). Fixed in this
  round: the caps line now includes 16 MP, and the refusal paragraph now
  matches the implementation — the download button stays clickable and repeats
  the reason rather than sitting disabled and unexplained.
- `audit/check-image-editor.mjs` — **320/320** Node-mirror checks in sixteen
  groups: single-sourced caps and derived labels; the format from the bytes
  rather than the extension; per-format dimensions read from real header
  fixtures; refusals before decode, each naming its real numbers; rotation,
  mirroring and crop exactness, with the half-turn and mirror inverses derived
  from the matrices rather than asserted by hand; the render target being the
  geometry the component actually paints with; the scale range, the budget and
  the largest-scale-that-fits attribution; a crop clamped into the frame;
  non-finite crop, quality and adjustment inputs; the pixel maths the copy
  claims; annotation geometry, stroke-width conversion and the point cap; the
  export formats and the quality argument; the download name including reserved
  characters, control codes and a dots-only stem; failures becoming a sentence
  rather than a raw engine string; the byte formatter compared against the
  repo's own `src/lib/format.ts` by transpiling it; the copy unable to state a
  cap, a filter or a limit the module denies; and source-level truth for every
  a11y, cap, refusal, honesty and copy claim in the component, the tool
  content, the SEO entries, the registry and the guide — including that the
  crop drag is measured in natural coordinates, that the Download button is
  clickable while refused, that `exportImage` returns before clearing the
  result, and that the quality slider sources its step from the constant.
- e2e `e2e/image-editor-browser.mjs` — **124** production-Chrome assertions
  authored (123 named checks plus a harness guard). Fixtures are written as
  real PNGs by an inline encoder: a 120 × 80 file of four flat blocks, a 3 MP
  file, an 8200 px-wide file, a 25-megapixel file and a renamed text file. Every
  download is re-parsed from its own bytes — a full PNG inflate for the pixels,
  and the JPEG SOF and WebP VP8/VP8L/VP8X headers for the size — so the claims
  are checked against the file that came out: the top-left pixel of the 100%
  export is the pixel that was in the fixture; a quarter turn really moves the
  natural corners to the turned frame's corners; mirroring really moves the
  right-hand block to the left; the typed crop really starts at the pixel it
  says it starts at and ends on the block it says it ends on; 50% of a 40 × 30
  crop is 20 × 15; +20% brightness is a 1.2 multiply and grayscale is Rec. 601
  luma; a stroke drawn at natural (60, 40) is still there after the image is
  rotated underneath it, and the rotated annotated file differs from a rotated
  file with no annotation in it; one undo reverts a whole crop drag; the
  refusals quote the size asked for, the budget broken and the largest scale
  that would fit, the button is clickable, pressing it repeats the reason in an
  alert, and nothing is downloaded; an over-budget input never reaches the
  canvas; and the last render that fitted is still the one on the canvas. Plus
  the empty boot, the renamed-file refusal, the header-derived size on load, a
  byte-identical re-export, reset edits restoring the first file exactly, the
  empty text stamp refusal, the annotation count and clear, the JPEG and WebP
   headers with the MIME-truthful extension, the quality slider disabled for
   PNG, the result panel and its clearing on the next edit, the per-format
   trade-off notes, the control counts and bounds and clamps, the tool and guide
   copy, the sitemap, and zero off-origin requests, non-GET requests, page
   errors and hydration warnings.
 - Orchestrator run: `node e2e/image-editor-browser.mjs` → **124 passed, 0
   failed**, run twice against the production build with the same result.
 - Verification: `node audit/check-image-editor.mjs` → **320 passed, 0
   failed**; `npx tsc --noEmit` → **0 errors repo-wide**; `npx eslint` on every
   touched file (`src/features/image-editor/ImageEditor.tsx`,
   `src/features/image-editor/editor-format.ts`,
   `src/features/image-editor/editor-pixels.ts`, `src/lib/tool-content.ts`,
   `src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
   `audit/check-image-editor.mjs`, `e2e/image-editor-browser.mjs`) → **clean,
   0 errors and 0 warnings**; `node --check` on the harness and the audit →
   clean. No forbidden directory was touched.

### Defects the orchestrator's run caught

The first runtime run failed 25 of the 124 assertions. Every one of them was in
the harness rather than in the tool, and each was a decoder that was quietly
asserting on the wrong bytes:

1. `imageFacts` was handed the `Uint8Array` that `download()` returns, and its
   header parsers called `readUInt32BE`/`toString("latin1", …)`/`subarray` on it,
   so **every** format check reported null. It now converts once at the entry
   point. This is the same `Uint8Array`-vs-`Buffer` trap that
   `e2e/html-to-image-browser.mjs` fell into.
2. `decodePng` read IHDR at the wrong offsets — `at+8`/`at+9` for bit depth and
   colour type, but the data starts at `at+8`, so those fields are at `at+16` and
   `at+17` and interlace is at `at+20`. It was reading `compression=80` as a bit
   depth and rejecting the file outright, so no pixel assertion ran at all.
3. The fixture generator wrote row filter 2 (Up) but stored **raw** pixel values
   instead of the deltas that filter implies. Every conformant decoder — the
   browser's included — reconstructed garbage below row 0, so the tool was being
   asked to round-trip a corrupt image. The generator now writes real deltas.
4. The mirror assertion looked for green at the turned frame's top-left. After a
   quarter turn green occupies the right half, so a left mirror carries it to the
   left *bottom*; the check now samples where the geometry actually puts it, and
   a second check confirms the right-half red block lands on the left too.
5. The undo assertion expected one undo to restore the original 120×80 size. Undo
   is one step per change, so it correctly took back the mirror and left the
   quarter turn standing. The check now asserts the 80×120 size *and* that the
   pre-mirror pixels are back, which is a stronger statement than the size alone.
6. The stage canvas sits at y≈1177 in a 720px viewport, so `page.mouse` drags
   and clicks were landing on nothing at all and no annotation was ever drawn.
   `onScreenStageBox()` now scrolls the stage into view and refuses to drive the
   mouse if the box is still off-screen, so a silent no-op cannot pass again.
7. The two text-stamp assertions assumed a clean canvas, but the brush stroke
   from earlier in the run is still on the image. They now compare the panel's
   count against the count immediately before the click, which tests the real
   invariant — an empty stamp adds nothing, a filled one adds exactly one.

## Tracked Residuals (accepted, disclosed)

1. It is a canvas editor, not a photo editor. There are no layers, no PSD, no
   selection or healing tools, no content-aware fill and no AI of any kind, and
   annotations are baked into the single canvas the file is written from, so
   there is nothing to re-order or move afterwards. Stated on the tool, in the
   features and in the guide.
2. Resizing is the browser's own resampler, so enlarging interpolates between
   the pixels that exist. It cannot invent detail, it is not an AI upscaler, and
   all three say so rather than leaving "resize" to imply more.
3. Every download is re-encoded from the pixels on screen, even when nothing was
   changed, so re-exporting an untouched JPEG is a second lossy generation and
   the file drifts a little further from the original each time. PNG is the only
   lossless choice here, and the tool says so.
4. Output is untagged sRGB with no EXIF, camera, GPS, timestamp or ICC profile.
   A wide-gamut photo can shift slightly, and the orientation flag — the one
   EXIF field that changes what you see — is applied on the way in by the
   browser. Disclosed in the limits box, the long description, an FAQ and the
   guide.
5. GIF and animated WebP arrive as their first frame and every later frame is
   lost. There is no frame picker, because there is no frame selection in a
   single canvas.
6. A browser without a WebP encoder gets PNG bytes. The file is named for the
   bytes it actually received and the substitution is announced, so the
   extension never lies, but the requested format is not honoured.
7. The budget is a ceiling, not a guarantee: an adjustment pass on a 16 MP
   image allocates about 61 MB of pixel buffer and takes a moment, and the
   limits box prints that figure. The on-screen canvas is capped at 1200 px on
   the long side, so for an image above that cap the preview and the file are
   not the same pixels — the export is always rendered at full size, and the
   difference is stated under the stage.
8. A brush stroke is stored as at most 400 simplified points and is baked in as
   pixels, so it cannot be edited after the fact. The limit is stated in the
   annotate panel and in the how-to steps.
9. There is no redo. Undo is a 30-step walk backwards through the history of
   the image that is open right now, and the FAQ says exactly that rather than
   implying a two-way history.
10. The e2e harness runs against production Chrome and the production build, and
    the pixel assertions decode the exported file by hand rather than trusting
    the component's own reported size. It cannot prove anything about a browser
    without canvas encoding, and it does not run on Firefox or Safari.

Files: `src/features/image-editor/ImageEditor.tsx`,
`src/features/image-editor/editor-format.ts`,
`src/features/image-editor/editor-pixels.ts`, `src/lib/tool-content.ts`,
`src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-image-editor.mjs`, `e2e/image-editor-browser.mjs`.
