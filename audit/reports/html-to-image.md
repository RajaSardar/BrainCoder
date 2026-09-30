# HTML to Image: Parallel Judges Audit

Date: 2026-09-28. Status: forty-eighth tool rebuilt and verified — the second
tool of the ninth audit wave. Ten judges (functional, rendering/domain expert,
technical architect, code reviewer, end-user UX, business, security, a11y, SEO
and performance) returned; every gap raised was closed and verified. Focus of
the round: a capture tool has to be honest about the difference between
*photographing a screen* and *re-drawing a layout*, and honest about the
arithmetic of scale — the size on disk has to be the size the UI promised, or
the tool is lying in the only way users can detect.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The old build had no capture root at all: the JSX that was supposed to render the sanitized markup was absent, so `rootRef.current` was always `null`, the measured box stayed `0 × 0`, and every capture hit the zero-pixel guard and refused. The tool could never produce an image. Closed: the fixed-width capture root is rendered from `sanitized.html`, measured with a `ResizeObserver`, and is the same node handed to `html2canvas`. Alongside that, three further defects were found and fixed while reconciling the mirror: `scaleLabel()` clamped and rounded the *effective* scale, so a capture the planner had cut to 2.73x was reported and named 2.5x; the over-budget refusal reported `formatBytes(planned.pixels * 3)` and called bytes "pixels"; and a canvas that refused to encode WebP returned PNG bytes under a `.webp` filename. All three are now impossible by construction — `scaleLabel` renders any effective scale exactly, the refusal names the real megapixel count, and the filename is derived from the MIME type that actually came back (`outputNameForMime`), so a fallback file is named for its bytes. |
| Domain expert (rendering) | html2canvas does not screenshot: it clones the document into an offscreen iframe, walks the tree reading `getComputedStyle`, and repaints with the Canvas 2D API. That single fact decides every claim the tool can make. It is why the layout is right — flex and grid arrive already resolved by the browser, so the repaint matches — and equally why `filter`, `backdrop-filter`, `mix-blend-mode`, conic and repeating gradients, and `object-fit` do not come through. It is also why the honest framing is "re-draw, not screen grab" rather than the word "screenshot", which the previous copy used in the tagline, the long description and the SEO keywords. `foreignObjectRendering` defaults to false and is never enabled, so content that needs an SVG `foreignObject` will not survive and the page says so. Its canvas is sized as `floor(cssSize * scale)` — an exact, computable rule, which is what made an exact pre-commit projection possible. A `toBlob` request for a type the browser cannot encode silently returns another type, and a non-CORS image is skipped rather than drawn blank; both are disclosed on the tool, in the long description and in the guide. |
| Technical architect | The pure decisions live in `capture-format.ts` — caps, the naming convention, the scale/width clamps, the pixel planner, error classification and the format table — with no browser API anywhere in it, verified by a check. The sanitizer is a second pure module with no DOM. `html2canvas` is behind `await import("html2canvas")`, so the tool's first paint never pulls the rasterizer in, and the clone it performs is the only iframe the page ever creates. The planner returns the exact `floor(css × scale)` projection, which the hint under the control prints before the run — so the projection in the UI and the buffer on disk are the same arithmetic, not two estimates. The one architectural finding this round was that `invalidate()` did not bump the run id: editing the textarea while a capture was in flight let the old bytes land in the result panel under the new markup's filename. `invalidate()` now cancels the in-flight run, and there are eight post-`await` staleness guards including the `finally` that clears `busy` only for the run that still owns the turn. |
| Code reviewer | Every cap is declared exactly once in `capture-format.ts` and imported by the component — a duplicated literal is how a UI and a planner drift, and the audit asserts both the single definition and the absence of bare cap literals in the JSX. `PIXEL_BUDGET_LABEL` and `SIDE_LIMIT_LABEL` are derived from `MAX_OUTPUT_PX`/`MAX_SIDE_PX`, so the UI cannot quote a number the planner does not enforce. `SCALE_CHOICES` is generated from `MIN_SCALE`/`MAX_SCALE`/`SCALE_STEP` rather than hand-listed, after the reviewer found the presets were `[1, 2, 3, 4]` — hand-typed, inconsistent with the 0.5 step the slider offered, and a second source of truth. `classifyCaptureError` was checked against real engine errors and two gaps were closed: a `SecurityError`/`EncodingError` `DOMException` carries its kind in `name` with an empty `message`, so taint and encoder failures were being filed as "unknown" and sending users after the wrong problem. Canvas pixels are released immediately after `toBlob`, and there is a check that the component never reaches for `toDataURL`. |
| End-user UX | The tool boots empty — no invented markup — with a real "load sample" button as the only thing that fills the editor. The preview and the source sit side by side, and the preview is the capture box itself, labelled "exactly what the image will contain", which is a promise the audit verified structurally: exactly one `dangerouslySetInnerHTML` in the component, fed by `sanitized.html`. The measured box updates live through a `ResizeObserver`, the projection is printed under the scale control, and content wider than the box is refused with the width it needs rather than being cropped silently. Typed values are held as text and committed on blur or Enter, so typing "2.5" is not rewritten under the cursor. The success line names the pixel size, the scale and the file; the result panel offers the identical bytes again and copy-to-clipboard. The honest-limits box sits below the result, after the user has already got their file — so the disclosure informs rather than blocks. |
| Business analyst | The differentiator against every "screenshot as PNG" competitor is the arithmetic: the scale is named as a device-pixel multiplier, the 2x example (a 480 px box becomes 960 px) is stated concretely, and the pixel budget's behaviour is described as *lowering the scale and disclosing it* rather than as a limit. The old copy claimed "full CSS support including fonts, colors, gradients, shadows, and responsive layouts" and called the tool a screenshot engine; both were false and both are gone from the long description, the features, the FAQs, `tools.ts`, the tagline and the SEO keywords. Three formats are now offered with the trade-offs stated (PNG lossless and largest; JPEG lossy at 0.92 with no transparency; WebP lossy, smaller, and dependent on the browser having an encoder), which is a better differentiator than another tool that only does PNG. Privacy is stated three times in the tool copy, because "renders my HTML" is the first question a buyer with a confidential dashboard asks. |
| Security | There is no ingestion path but a file input, no upload, and no request for the markup; the check asserts the page states it and the e2e asserts zero off-origin requests. Pasted markup is rebuilt from an allowlist before it is displayed *or* painted, and the two consumers are the same string. The audit fuzzed the sanitizer and it found three real gaps, all closed: a `javascript:` URL in `cite` survived because only `href` and `src` were URL-checked (now every URL-bearing attribute is, via one `URL_ATTRS` table); a kept `style` attribute could carry `url(javascript:…)` and a kept `<style>` block could carry `@import` (both are now scrubbed, so the "no `javascript:` URL" claim is actually true); and entity-encoded, whitespace-split and control-character-obfuscated schemes are decoded and rejected, which the tests assert directly. Scripts, frames, plugins, MathML, inline SVG, form controls and template contents are dropped with their contents; void elements are skipped as single tags so a `<link>` cannot swallow the page. `id` attributes are stripped, which is disclosed as a trade-off. The caps are enforced before any work, the output name is neutralised, and the user's file is never written back. |
| A11y specialist | A real `<label htmlFor>` opener bound with `useId`, a labelled `<select>`, two `<fieldset>`/`<legend>` groups, visible labels for the width and scale fields, a visually-hidden label on the slider that announces the current value, `aria-describedby` from the scale field to the projection sentence and from the format select to the format's trade-off note, `min`/`max`/`step`/`inputMode` on the numbers, Enter to commit, `aria-pressed` on the presets so the current scale is announced, `aria-busy` on the root for the whole run, an sr-only `role=status` that says what is happening while busy, visible `role=status` lines for the byte counter, the sanitizer disclosure, the measured box and the success line, `role=alert` for every refusal, the result as a `role="region"` with an accessible name, and an `alt` that describes the actual image. A check asserts every `setError` refusal is a real message and names the action, and another counts the label/fieldset wiring so a later edit cannot quietly unlabel a control. |
| SEO/content | The tool had a four-keyword stub including "screenshot html online", no `CUSTOM_TITLES` entry, no JSON-LD `featureList` entry and no guide at all. All four were added: twelve long-tail keywords that match what the tool does; a meta title; a feature list that names the measured preview, the `floor(css × scale)` projection, the three formats, the 16 MP / 8192 px budget behaviour, the sanitizer and the honest re-draw caveat; and a five-section guide covering the arithmetic, why the scale moves on its own, the format and naming conventions, what a re-draw does not reproduce, what is stripped before drawing, and when to use a headless browser instead. The long description, six features, three how-to steps and three FAQs were rewritten around the device-pixel explanation. The audit asserts the tool copy states the real caps, contains no `pixel-perfect`/`WYSIWYG`/"screenshot" claim, and that the guide's caps match the code. |
| Perf judge | The cost is bounded by the caps, not by taste: one clone, one paint, one encode, all synchronous inside `html2canvas`. `html2canvas` is loaded on demand, so a visitor who never captures never pays for it. The sanitizer is iterative rather than recursive — the audit asserts 6,000 nested elements do not overflow the stack — and a full 200 KB document sanitizes in well under the frame budget, so typing does not stutter. The canvas is released as soon as the blob is taken rather than at component teardown, so a 16 MP capture does not sit resident while the user reads the result. The one real cost is memory during a capture: a 16 MP canvas is roughly 64 MB of backing store, and the clone is a second live document. Both are the reason the budget exists, and the budget is disclosed rather than silent. |

## Changes And Evidence

- `src/features/html-to-image/capture-format.ts` — new pure module: input
  cap, scale range/step, capture-width range, side and pixel limits, the
  white composite, the lossy quality, the image timeout, the format table with
  its real MIME types and per-format trade-off notes, `clampScale`,
  `clampCaptureWidth`, `SCALE_CHOICES`, `scaleLabel` (exact for any effective
  scale), `safeStem`/`outputNameFor`/`outputNameForMime`/`formatForMime`,
  `planOutput` (the exact `floor(css × scale)` projection with a `side`/`area`
  limit attribution), `captureIsOnScreen`, `classifyCaptureError` and
  `captureErrorMessage`. No browser API, asserted by a check.
- `src/features/html-to-image/sanitize.ts` — new pure allowlist sanitizer:
  token-rebuilt output, `<style>` kept and scrubbed of `@import` and
  executable CSS, `DROP_WITH_CONTENT` for executable and foreign content,
  `DROP_VOID` handled as single tags, one `URL_ATTRS` table applied to every
  URL-bearing attribute, scheme normalisation for entity/tab/newline/control
  obfuscation, raster-only `data:` images, `on*` stripping, `id` stripping,
  a report with exact counts, and a grammatical one-line summary.
- `src/features/html-to-image/HtmlToImage.tsx` — rewritten: the capture root
  actually rendered (the old build had none, so nothing could ever be
  captured), empty boot, file open, a `ResizeObserver` measurement, the
  live projection under the control, six refusals each naming its fix, an
  html2canvas capture with disclosed options, a lazily imported rasterizer,
  `toBlob` with a MIME-truthful filename, canvas release, an automatic
  download, a result region with clipboard copy and a byte-identical
  re-download, run-id and busy guards including cancellation from
  `invalidate()`, result invalidation on every edit, full a11y wiring, and a
  limits box that states what a re-draw cannot paint.
- `src/lib/tool-content.ts` — the `html-to-image` long description, six
  features, three how-to steps and three FAQs rewritten: the device-pixel
  explanation, the three formats with their trade-offs, the budget behaviour,
  the re-draw caveat and its named gaps, the CORS and fetch behaviour, and
  privacy. The "screenshot" framing and the "full CSS support" claim are gone.
- `src/lib/tools.ts` — the entry now reads "Render HTML to PNG, JPG or WebP at
  1–4x" with a description that states the re-draw, the 16 MP budget, the
  white composite and the box crop.
- `src/lib/seo.ts` — `TOOL_KEYWORDS["html-to-image"]` replaced (4 → 12,
  long-tail, no "screenshot"), a `CUSTOM_TITLES` entry added, and a
  tool-specific JSON-LD `featureList` entry that names the real behaviour.
- `src/lib/guides.ts` — new guide `how-to-convert-html-to-image`
  (`toolSlug: "html-to-image"`, 5 sections, `readMinutes: 5`).
- `audit/check-html-to-image.mjs` — **136/136** Node-mirror checks: the caps
  and their derived labels, the clamps and their non-numeric fallbacks, exact
  scale labelling, the naming convention including reserved characters,
  control codes and a dots-only stem, the MIME-truthful fallback name, the
  exact projection against a sweep of sizes, the budget and side invariants,
  the `overBudget` attribution, determinism, off-screen detection, the error
  classification against real engine errors and the no-raw-text guarantee, the
  sanitizer against scripts, unterminated tags, void elements, style blocks,
  entity- and whitespace-obfuscated schemes, `data:` types, breakout
  attempts, a 14-seed fuzz pass, idempotence, 6,000-deep nesting, a full
  200 KB document, and the summary strings — plus source-level truth for
  every a11y, cap, save-option, honesty and copy claim in the component, the
  tool content, the SEO entries, the registry and the guide.
- e2e `e2e/html-to-image-browser.mjs` — **89** production-Chrome scenarios,
  all run by the orchestrator: the empty boot and disabled capture, the measured
  preview, 1x/2x/4x with the downloaded file re-parsed from its own PNG header so
  the width on disk is compared to the measured CSS width, an independent
  re-capture for determinism, a byte-identical re-download, all three formats
  verified from their real headers, the sanitizer checked against the capture
  root itself, the overflow, over-cap and sanitizes-to-nothing refusals, result
  invalidation on both a markup edit and a control change, the control
  bounds and clamps, a projection-versus-file equality check, the tool and
  guide copy, the sitemap, and zero off-origin requests, non-GET requests,
  page errors and hydration warnings.
- Orchestrator run: `node e2e/html-to-image-browser.mjs` → **89 passed, 0
  failed** against the production build on port 3801.
- Verification: `node audit/check-html-to-image.mjs` → **136 passed, 0
  failed**; `npx tsc --noEmit` → **0 errors repo-wide**; `npx eslint` on every
  touched file (`src/features/html-to-image/HtmlToImage.tsx`,
  `src/features/html-to-image/capture-format.ts`,
  `src/features/html-to-image/sanitize.ts`, `src/lib/tool-content.ts`,
  `src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
  `audit/check-html-to-image.mjs`, `e2e/html-to-image-browser.mjs`) →
  **clean, 0 errors and 0 warnings**; `node --check` on the harness and the
  audit.

### Defects the orchestrator's run caught

1. **Real product bug.** `loadFile` read the run id into a local *before* calling
   `invalidate()`, and `invalidate` increments the ref. Every file upload
   therefore compared its own run id against a counter it had just advanced past
   and cancelled itself, so the capture silently never happened. The
   invalidation now runs first and the run id is captured afterwards.
2. **Real product bug.** Overflow detection read the capture root's own
   `scrollWidth`/`scrollHeight`, but a root with `overflow: hidden` reports its
   client size, so tall content was never detected and the measured preview
   under-reported the real height. The component now measures the union of the
   root's and every child's bounding rects and re-measures on a
   `MutationObserver`, so an edit that grows the content updates the readout.
3. `imageFacts` was handed the `Uint8Array` that `download()` returns and called
   `Buffer` methods on it, so the file-header assertions could never have passed;
   it now converts once at the entry point.
4. The over-cap check ran after the capture had already started, and its wording
   regex expected the cap in bytes while the UI quotes megabytes; the check is
   now ordered before the capture and matches the real message.
5. The sanitizes-to-nothing flow expected an error, where the product correctly
   shows an empty result with the sanitized preview; the harness now clicks
   capture and asserts the announced empty state.
- Tracked residuals (accepted, disclosed):
  1. It is a re-draw, not a photograph. `filter`, `backdrop-filter`,
     `mix-blend-mode`, conic and repeating gradients, `object-fit` and
     anything needing an SVG `foreignObject` do not come through. The tool,
     the long description and the guide all say so, and the guide points at a
     headless browser for full-page or DOM-independent capture.
  2. An image served without CORS headers is left out of the capture rather
     than drawn blank, and a remote `<img src>` or CSS `url()` is fetched by
     the browser as any page would fetch it. The tool has no way to change
     that, so it is disclosed rather than implied to be private.
  3. `vw`, `vh` and `position: fixed` resolve against the browser viewport,
     not the capture width, so a layout authored for a full viewport can be
     cropped differently. Stated in the tool's limits box.
  4. Output is composited on white, so a transparent source still lands on
     white. There is no transparent-output option, because a background-free
     capture of arbitrary HTML is not reliably achievable here.
  5. The budget is a ceiling, not a guarantee: a 16 MP canvas is roughly 64 MB
     of backing store plus a cloned document, so a capture at the ceiling is a
     heavy tab on a small machine. The 1x floor means content too large even at
     1x is refused rather than rendered small.
  6. A browser without a WebP encoder gets PNG bytes. The file is named for
     the bytes it received and the fallback is stated in the result panel, so
     the extension never lies, but the requested format is not honoured.
  7. The sanitizer is a filter over the markup, not a guarantee about the page
     being built. A `<style>` block is deliberately kept and applied to this
     page, so its selectors are unscoped — the tool says to scope them.
  8. The e2e harness runs against production Chrome and the production build,
     and re-parses every downloaded file from its own header rather than
     trusting the component's reported size. It does not run on Firefox or
     Safari, and it cannot assert anything about a browser without
     `html2canvas` support for the given markup.

Files: `src/features/html-to-image/HtmlToImage.tsx`,
`src/features/html-to-image/capture-format.ts`,
`src/features/html-to-image/sanitize.ts`, `src/lib/tool-content.ts`,
`src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-html-to-image.mjs`, `e2e/html-to-image-browser.mjs`.
