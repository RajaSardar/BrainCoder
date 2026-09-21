# PDF to Image: Parallel Judges Audit

Date: 2026-09-21. Status: twenty-second tool upgraded and verified —
first of the three-tool wave covering pdf-to-image, word-to-pdf and
pdf-to-text (judged, upgraded and verified independently in parallel;
this report covers pdf-to-image). Ten judges returned; every gap they
raised was runtime-closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Per-page previews labelled "Page N" but saves derive their extension from the clicked button, not the rendered format — switching PNG→JPEG then saving could mislabel. Page-range input accepts garbage (`2-1`, `abc`) without feedback. Re-rendering forces a full re-download path (the old code converted on every settings change) |
| Technical architect | The same `ArrayBuffer` was passed to `pdfjs.getDocument` twice — pdf.js transfers the buffer into the worker, so the second use throws "Cannot perform Construct on a detached ArrayBuffer". No reuse/destroy discipline on the loading task; canvas decode re-encodes to data-URL per preview. No cap on canvas area (a huge page at high scale can exceed browser canvas limits) |
| End-user UX | No ZIP of all converted pages — users save page by page. No progress signal during render. No "settings changed" hint that previews are stale after tweaking scale/range/format. Scale slider label "Output scale" with an unannounced unit |
| Content/SEO | Claims "300 DPI" output — the tool renders at browser-dependent raster scale with no true DPI, overclaim. Marketing does not mention page range or ZIP. settingsDirty state suggested a "Re-render" flow the copy never explains |
| Business analyst | Core value = convert PDF pages to PNG/JPEG client-side with range control and a single ZIP download. MUST: honest resolution claim, page range + ZIP, MUST NOT let a re-render-then-save produce a mislabeled file extension. SHOULD: adaptive downscale near browser canvas limits |
| A11y specialist | HIGH: the format `<select>` and range input are unlabelled (shared Field previously rendered `<label>` as a `<p>`); the card remove/save buttons announce only "Save"; busy is not announced; format/scale changes give no live feedback |
| Security/privacy | No egress, no storage writes — clean. Files can be 100 MB+; page limits (200/page selections) absent so a huge conversion can hang the tab. Data-URLs kept on the page for the whole session for previews |
| Edge cases | Page-range "0-2" should reject (page numbers start at 1). A locked (encrypted) PDF faults with the raw pdf.js `PasswordException` message. `page.cleanup()` needed between renders of a long document to bound memory |
| Performance | Every Re-render re-opens and re-parses the document (slow, but correct). Rendering is sequential per page — fine, but the first page appears only after the whole convert finishes; per-page progress is trivial |
| SSR/cross-browser | Client-only pdf.js under dynamic import is correct; the worker must be bootstrapped (`GlobalWorkerOptions.workerSrc`) via a shared helper to avoid double-drift with pdf-to-text/pdf-ocr |

## Changes And Evidence

- `src/features/pdf-to-image/PdfToImage.tsx` (rebuilt):
  - **No more detached ArrayBuffer (architect, functional):** the pristine
    `ArrayBuffer` is stored once (`bytesRef`); every `pdfjs.getDocument`
    call passes `data.slice(0)` so pdf.js's zero-copy transfer never
    detaches a buffer that will be reused (matches the repo's established
    `data.slice(0)` pattern in pdf-to-excel/pdf-compare/pdf-editor).
    Loading tasks are tracked and `await task.destroy()` in `finally`.
  - **Extension always matches content (functional, business):** each
    preview keeps its own data-URL and per-page saves derive the extension
    from that URL (`imageExt`), never from the format select.
  - **Page range + enforcement (functional, edge, business):** shared
    `pageRangeSyntaxError` from `src/features/pdf-office/support.ts`
    rejects `0-2`/`2-1`/garbage ("Enter pages like 1-3,5…"), out-of-range
    selections name the count, `MAX_PAGES = 200`, and `selectPages` derives
    the count live from the range.
  - **ZIP of selected pages (UX, business):** `Download ZIP` runs
    `fflate.zipSync` into `{docName}-{n}-pages.zip` with its own busy
    status ("Building ZIP — page x of N") and a success `role=status`
    ("N pages · size downloaded."). The ZIP always uses current settings.
  - **Re-render flow (UX, architect):** scale/format/range changes set a
    dirty flag + amber "Settings changed — re-render to refresh the
    previews…" hint and a `Re-render` button instead of silently re-running;
    previews are capped at 12 while the ZIP handles all selected pages.
  - **Adaptive scale (UX, edge):** `MAX_CANVAS_AREA = 15_000_000`; renders
    above it are downscaled and announced ("Reduced the scale on N pages…").
    White fill under JPEG; `page.cleanup()` between pages.
  - **A11y (a11y):** `useId`-backed `<label htmlFor>` for the format
    `<select>` (SliderField pattern), an "≈ N PPI at US-Letter size"
    caption under the 1–4× scale slider, per-page save buttons announce
    "Save page N as png/jpg image", root `aria-busy`, `role=status` for
    progress/zip + `role=alert` for errors.
  - **Friendly errors (edge):** `PasswordException` → "This PDF is
    password-protected…"; `InvalidPDFException` → "That file doesn't look
    like a valid PDF."
  - **Drop zone (functional):** persistent dashed `role=button` drop target
    with an accessible label and keyboard activation.
- `src/features/pdf-office/support.ts`:
  - `ensurePdfjsWorker(pdfjs)` exported and shared (sets
    `GlobalWorkerOptions.workerSrc` to the bundled
    `pdfjs-dist/build/pdf.worker.min.mjs`).
  - `pageRangeSyntaxError` exported with the app-wide messages used by
    pdf-to-image and pdf-to-text.
- `src/lib/tool-content.ts`: pdf-to-image rewritten — resolution honestly
  scoped as ≈72–288 PPI (1–4×; no "300 DPI"), page ranges and ZIP
  documented, first-12-page preview caveat, 100 MB / 200-page caps;
  relatedSlugs = image-to-pdf, pdf-to-text, pdf-ocr, pdf-crop, pdf-split.
- `src/lib/seo.ts`: pdf-to-image featureList override updated to mention
  page range + ZIP; "300 DPI" never appears.
- `src/lib/tools.ts`: description rewritten "Convert PDF pages to PNG or
  JPEG images with a page range and ZIP download — 100% in your browser."

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Production build passed (287 static pages; this wave's single production
  build also served word-to-pdf and pdf-to-text).
- `e2e/pdf-to-image-browser.mjs` — 29 production Chrome scenarios, 29/29
  green: labelled select + slide; labelled file input + clickable drop zone;
  a 3-page build renders 3 previews; single-page save carries a descriptive
  name and valid PNG magic; switching to JPEG surfaces the re-render hint
  and the re-rendered save downloads a real `.jpg` (JPEG magic); restricting
  the range to page 2 renders exactly one preview; the ZIP download is named
  `{name}-1-pages.zip`, contains exactly `{name}-page-2.jpg`, and is a valid
  zip; ZIP completion is announced; `2-1` is rejected and clearing the range
  clears the error; `abc` is rejected; a locked PDF shows the friendly
  password alert (`e2e/fixtures/encrypted.pdf` — a real R2/RC4-40 Standard
  security-handler fixture generated by `e2e/fixtures/make-encrypted.mjs`,
  validated in Node to raise pdf.js `PasswordException`); drag-and-drop
  converts under the dropped name; zero hydration errors; zero page errors;
  `/tools` marketing scopes ≈72–288 PPI, contains no "300 DPI", documents
  the page range + ZIP.
- `e2e/word-to-pdf-browser.mjs` (28/28) and `e2e/pdf-to-text-browser.mjs`
  (26/26) green against the same build.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; `/verify` wording; ToolPreview upload mocks; WebKit not runnable;
  Next.js route announcer `role=alert`.
- pdf-ocr / image-ocr still fetch tesseract worker/core/lang from
  `cdn.jsdelivr.net`, falsifying their "no uploads" marketing — deliberately
  NOT fixed in this wave (out of scope, noted for a future OCR wave).
- Re-render re-parses the PDF each time (pdf.js costs) — correct, and ZIP +
  previews share that single parse; acceptable for document sizes served.