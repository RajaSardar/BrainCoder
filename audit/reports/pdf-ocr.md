# PDF OCR: Parallel Judges Audit

Date: 2026-09-25. Status: thirty-eighth tool upgraded and verified — the
third tool of the sixth audit wave. Ten judges (functional, PDF/OCR domain
expert, technical architect, code reviewer, end-user UX, business, security,
a11y, SEO and performance) returned; every gap raised was closed and
verified. Focus of the round: genuinely on-device OCR (tesseract.js) against
self-hosted WASM/lang models, with a proven zero-external-request run and
honest .txt-only output.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | OCR is only honest if it actually recognizes text in the browser: rasterize each page with pdf.js, run tesseract.js with a worker, and page markers "— Page N —" must survive into the .txt. No caps; raw `err.message`; the earlier image-OCR variant still pointed at the jsDelivr CDN (asset fix carried into this pass). |
| Domain expert (OCR/rendering) | A scanned PDF's text must be rasterized before recognition; the rasterizer must not reach for external standard fonts — the fixture therefore **embeds** `LiberationSans-Regular.ttf` (from pdfjs-dist) so pdf.js renders without a font fetch; three WASM cores (lstm / simd-lstm / relaxedsimd-lstm) with cpu-feature pick + non-SIMD fallback so `wasmFeatureDetect`-unsupported browsers still run; the English model is the training gate used for the recognition assertion |
| Technical architect | Worker model: `worker.min.js` + selected core + `traineddata/*.lang.traineddata.gz` served from `/ocr/` (public), tesseract cache via IndexedDB after first load; 12 languages are shipped — the selector must show exactly the shipped set; page markers prepended per page; output stays a `.txt` (never a "searchable PDF" — that is a different, disclaimed artifact). In-memory bytes end-to-end. |
| Code reviewer | `runId` guard across the whole async chain (recognize → download); `toUiError` routing so pdf.js engine throws (which are real `Error` instances and were leaking raw — "No password given") surface as friendly steers; output named `<src>-ocr.txt`; the success status must report characters recognized; a 1-page fixture proves recognition and the download contents. |
| End-user UX | Show the OCR result readably (labelled region, `role=status` busy "Rendering page 1 of 1 / Recognizing page 1 of 1"), download `<src>-ocr.txt`, and explain the artifact: plain text, not a searchable PDF. Encrypted uploads must steer to PDF Unlock, non-PDFs to a friendly error. |
| Business analyst | Trust hinges on the on-device promise and the "it's a text file" framing. Copy must state "runs entirely in your browser — your document never leaves your device", disclose the model download (~1.5–3 MB) up front, refuse "100% accuracy" numbers, and not claim searchable-text-layer output. |
| Security | PASS — the e2e request tracker proved **zero external-origin requests** during a full real run (only the /ocr/ worker, core and eng.traineddata.gz plus same-origin app assets; `blob:` URLs excluded as same-origin by construction). No file-content egress. Bounded by 100 MB / 200 pages caps. |
| A11y specialist | File input `useId` label, language fieldset/legend, `role=status` idle/load/success and busy lines, `role=alert` errors, `aria-busy` root, result as `role=region aria-label="OCR result"` with `pre`, keyboard buttons with distinct accessible names. |
| SEO/content | `TOOL_KEYWORDS["pdf-ocr"]` (incl. "ocr pdf online") + truthful `TOOL_FEATURE_LIST` JSON-LD; CUSTOM_TITLES "OCR PDF online — recognize text in scanned PDFs free"; honest feature copy; new guide `how-to-ocr-a-pdf` (200 + sitemap-listed). |
| Perf judge | One pdf.js rasterization pass per page (114 dpi default), one tesseract worker, model cached in IndexedDB after first run; the language selector populates from a shipped-model constant, never a fetched list. |

## Changes And Evidence

- `src/features/pdf-ocr/PdfOcr.tsx` (rebuilt) + `src/features/image-ocr/ImageOcr.tsx`:
  - **Self-hosted engine.** Both worker paths are hardcoded to the app's
    `/ocr/` (no CDN defaults anywhere): `workerPath: "/ocr/worker.min.js"`,
    `corePath: "/ocr/"`, `langPath: "/ocr/traineddata/"`. `public/ocr/` ships
    `worker.min.js`, three WASM cores (`lstm`, `simd-lstm`,
    `relaxedsimd-lstm` — selected by cpu-feature detection with a non-SIMD
    fallback) and 12 `.traineddata.gz` models; the selector renders exactly
    the shipped set from one constant.
  - **PDF → raster → text.** Each page is rasterized by pdf.js and passed to
    a single tesseract worker; "— Page N —" markers separate pages; success
    reports characters recognized; the download is `<src>-ocr.txt` containing
    the markers and content verbatim.
  - **Honest artifact.** Output is plain text — copy, features and FAQ never
    promise a searchable-text-layer PDF; the model-download disclosure
    (~1.5–3 MB, one-time, IndexedDB-cached) is shown up front.
  - **Caps + team standard.** 100 MB / 200 pages enforced with guidance;
    `runId` guard over every await, busy guard, `resetState()`,
    `toUiError`/`userFacing` routing (engine throws now surface as friendly
    steers: encrypted → "already password-protected — remove it with Unlock
    PDF" + link; no-PDF-header → "doesn't look like a valid PDF"),
    `aria-busy` root, `role=status`/`role=alert`, `useId` labels, language
    fieldset, prose-pitch raster + recognition statuses.
- `src/lib/tool-content.ts` (`"pdf-ocr"`): on-device privacy claim,
  model-download disclosure, "outputs a plain .txt" framing, no accuracy
  numbers, no drag-and-drop promise, no searchable-PDF promise; encrypted and
  blank-page steers to the correct sibling tools.
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-ocr"]`, truthful `TOOL_FEATURE_LIST`
  JSON-LD, `CUSTOM_TITLES` for the tool title, `how-to-ocr-a-pdf` guide.
- Verification:
  - `audit/check-pdf-ocr.mjs` — **52/52** node checks: all self-hosted assets
    exist (`worker.min.js`, 3 cores with expected byte prefixes, 12 traineddata
    files with `1f 8b` gzip magic); the language select populates exactly the
    shipped set; **no CDN literal** (`jsdelivr.net`/`unpkg.com`/`rawcdn.githack`
    etc.) appears in `PdfOcr.tsx` or `ImageOcr.tsx`; the self-host constants
    are the hardcoded `/ocr/` literals; friendly-error mirror maps encrypted
    and no-PDF-header inputs; caps (100 MB / 200 pages) enforced by the shared
    constant.
  - `e2e/pdf-ocr-browser.mjs` — **28/28** production Chrome scenarios against
    a real 1-page fixture whose text is drawn with an **embedded** TTF
    (LiberationSans from pdfjs-dist, registered via `@pdf-lib/fontkit` in the
    harness only, `--no-save`): recognized output is `"--- Page 1 ---\nHello
    OCR"` (whitespace-normalized); the request tracker saw **zero external-
    origin** requests and ≥2 `/ocr/` fetches (worker + `eng.traineddata.gz`);
    `role=status` busy carried "Rendering page 1 of 1" and "Recognizing page
    1 of 1" then cleared; result exposed as `role=region aria-label="OCR
    result"`; download named `scan-ocr.txt` and its bytes match the result;
    encrypted fixture → PDF Unlock message + link; non-PDF → invalid-file
    message; >cap → guided; 12 languages listed; model disclosure shown up
    front; copy honesty (on-device, .txt output, no searchable-PDF claim,
    no accuracy numbers, no drag-and-drop) on `/tools/pdf-ocr`; guide 200;
    sitemap lists tool + guide; zero hydration/page errors.
  - Build: clean tsc + eslint; production build passed (**298 pages**, 32
    guides).
- Tracked residual (accepted): accuracy depends on the scanned source —
  copy discloses this instead of quoting numbers; recognition is best-effort
  on the English model for default runs (other languages selectable);
  a one-time ~1.5–3 MB model download is disclosed and cached in IndexedDB.

Files: `src/features/pdf-ocr/PdfOcr.tsx`,
`src/features/image-ocr/ImageOcr.tsx`, `public/ocr/**`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`, `audit/check-pdf-ocr.mjs`,
`e2e/pdf-ocr-browser.mjs`.