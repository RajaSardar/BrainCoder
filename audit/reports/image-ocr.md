# Image OCR: Parallel Judges Audit

Date: 2026-09-28. Status: forty-ninth tool upgraded and verified. Ten judges
(functional, OCR/domain expert, technical architect, code reviewer, end-user
UX, business, security, a11y, SEO and performance) returned; every gap raised
was closed and the closed ones verified. Focus of the round: the old build
fired the engine on file-drop and said "identify and extract all readable
text", which is a claim no recognizer can make — so the round was about
replacing overclaims with mechanics (the format is read from the file's own
header bytes, every cap is a refusal with real numbers, the engine's confidence
is reported as the engine's opinion) and about actually terminating a
WebAssembly worker instead of leaking one per run.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The old build created its worker inside a `handleClick` that a drop handler and a file input both called, so a user could start two recognizers over one image and race two results into one `<pre>`. It had no byte cap, no pixel cap, no header read: a 40-megapixel photo was handed straight to the decoder, and a `.png` that was really a text file died somewhere inside Tesseract with a raw error string. There was no busy state, no `aria-busy`, no `role="alert"`/`role="status"`, no runId, no cancel, no result statistics, and the preview `blob:` URL was never revoked. Closed: three caps (25 MB, 16 MP, 8192 px on the long side) that *refuse* rather than adjust, a format confirmed from magic bytes before the image is decoded, `runIdRef` compared after every await, a Cancel that terminates the live worker, character/word/line counts, a duration, the engine's own confidence with a plain-language band, `<image>-ocr-<language>.txt` in both copy and a re-download, and `URL.revokeObjectURL` on clear and on unmount. |
| Domain expert (OCR) | The central domain fact is that OCR *guesses*, and Tesseract's `data.confidence` is its opinion of its own guesses — not a percentage of characters that are correct. Printing "94% accurate" is a lie the engine cannot support, so the tool bands the score (high ≥ 80, fair ≥ 55, low) and prints what each band means. Two further engine facts the copy now states: Tesseract downsamples a large image to roughly 300 DPI *before* recognition, which is the real reason a 12-megapixel phone photo reads worse than a cropped scan, and EXIF rotation is not applied, so a sideways photo comes out sideways. LSTM-only OEM is requested explicitly (`oem = 1`) so the tool does not pay to load a legacy model it never uses. One model runs per pass: a page with a Danish body and an English header needs two runs, and that is stated rather than implied. |
| Technical architect | `ocr-format.ts` holds the caps, the header reader, the language table, the naming convention, the progress map and the error classifier, and imports **nothing** — so the tool's first paint never pulls the recognizer in, and the Node mirror audit can import the shipped rules directly. `ocr-engine.ts` statically imports only `./ocr-format` and reaches `tesseract.js` through `await import()`, so tesseract.js and its WASM core are fetched when a run starts and never when the page is painted. The engine is created, driven and terminated in one place: `worker.terminate()` runs in a `finally`, and a `terminate` handle is handed back to the component the moment the worker exists, so Cancel does not have to wait for a `recognize` promise it can no longer cancel. Every await in both modules is followed by a `runId !== runIdRef.current` guard, and the engine takes an `isStale` callback and returns `null` when superseded, so a stale run can neither write state nor download. The `File` is passed to `recognize` rather than the read `Uint8Array`, which avoids re-wrapping up to 25 MB in a `Blob` for nothing. |
| Code reviewer | The three caps, the three labels, the twelve language rows and the five format rows are defined exactly once and imported by the component, the engine, the copy and the audit — a duplicated literal is how a marketing page and an engine drift apart, and the audit now asserts the single definition and that the marketing text quotes those exact strings. The byte-refusal message prints the file's **exact byte count and the cap in bytes** as well as MB, because 26,214,425 bytes prints as "25.0 MB" and only the byte count explains why that is over a 25 MB limit. `bmpSize` reads its height through a signed `le32`: a top-down BMP stores a negative height, and the unsigned read turned −100 into 4,294,967,196 — the audit caught this on a real fixture. The audit's own fixture raster had the same class of bug (`y + minY` instead of `y - minY`), and the recognizer returning an empty string for every word was what exposed it; that is the section-14 check doing its job. |
| End-user UX | The tool now opens empty and says what it is for, and nothing happens until an image is chosen. Picking a file reads only its header — the status line names the file, the format, the true pixel dimensions and the true file size — and only then do the preview, the language picker and the Extract button appear. The language note tells the user how many models exist, how big the one they picked will download, that it is a first-run-only cost and that it comes from this site, and to pick the language of the *text in the image*. Progress names the engine's real stage with a percentage; Cancel stops the run and says the image is still selected. A result shows counts, a duration, the confidence with its band, the cleaned text, Copy and Download again. A blank image is a *result* — "Nothing read", why, and what to try — not a silent failure. Clear drops the preview and the result. The amber box states what OCR is and where it breaks before anything runs. |
| Business analyst | The old feature list promised "identify and extract all readable text", "reliable text extraction for most standard documents", "Supports multiple languages and common fonts" and "no upload limits" — four claims the tool could not support, and "no upload limits" was false for a tool that would try to decode a 400-megapixel photo. All four are gone, replaced by specifics a competitor cannot copy: 12 named languages with their real model sizes, the format read from header bytes, the three caps refused with real numbers, the five real engine stages, the confidence score described as the engine's opinion, and a `<image>-ocr-<language>.txt` download. The differentiator is the same as every other tool in this repo — the bytes never leave the device — but stated precisely: the image is never uploaded, and the engine, its WASM core and the model are all served from this origin rather than a third-party CDN. |
| Security | There is no upload path and no third-party origin: the image is read with `file.arrayBuffer()`, the recognizer is a WASM module loaded from `/ocr/worker.min.js` with its core and models from `/ocr/`, and the Node audit asserts no CDN host appears in either source file and that all three paths are passed to the worker factory. Nothing user-supplied reaches `dangerouslySetInnerHTML`; the extracted text is rendered inside a `<pre>` as text, and the preview is an `<img>` with a blob URL. The output name is derived from the source with path separators, reserved characters, control codes and leading dots neutralised, so `../../etc/passwd.png` becomes `etc-passwd-ocr-eng.txt`. The cap check runs *before* `arrayBuffer()`, so an oversize file costs a `stat` rather than a copy of itself. A malformed language id falls back to English rather than becoming a 404 against the traineddata directory. |
| A11y specialist | The visible opener is a real `<label htmlFor>` bound to the file input with `useId`; the input itself carries `aria-label="Choose an image to read text from"`, because a visually-hidden file input has no other name. The language `<select>` has a bound visible label and `aria-describedby` pointing at the model-size note. `aria-busy` sits on the root and clears when the run ends. There is an sr-only `role="status"` that mirrors live progress, a second visible `role="status"` for idle/loaded/success, `role="alert"` for every refusal with the fix in the sentence, and the result as a `role="region"` with `aria-label="Extracted text result"`. The Copy button has its own `aria-label` distinct from its visible "Copy" text; the language `<select>` is disabled during a run; the text pane is a focusable `<pre tabIndex={0}>` so a long result is keyboard-scrollable; the preview `<img>` has a descriptive alt naming the file and its size rather than an empty one. A 375px viewport is checked for horizontal overflow. |
| SEO/content | `TOOL_KEYWORDS["image-ocr"]` went from 5 terms to 31, adding the long tails the tool can actually answer ("ocr png jpg webp bmp", "ocr without uploading", "offline ocr tool", "ocr japanese image online", "image to txt download", "tesseract ocr in browser"). A `CUSTOM_TITLES` entry and a tool-specific JSON-LD `featureList` entry were added, the latter stating the five formats, the twelve languages, the three caps, the five stages, the confidence caveat, the downsampling and EXIF disclosures and the download name. The long description, the nine-item feature list, the four how-to steps and the five FAQs were rewritten: three FAQs are new, and two of them answer "why is the result wrong" rather than restating the marketing line. `tools.ts` gained the formats, the language count and the honesty clause, and its old "Private — nothing is uploaded" was dropped because the metadata template already appends "runs entirely in your browser — nothing is uploaded", and the duplication read as padding. No `guide` key was added to `ToolContent` — that type has no such field, and the page resolves guides through `getGuidesByTool("image-ocr")`. |
| Perf judge | The first paint costs nothing recognizer-shaped: the pure module is a few KB of arithmetic and `tesseract.js` is behind a dynamic import, so a visitor who never presses Extract never downloads the engine. The cost of a run is bounded by the caps, and the first-run cost is stated before the user commits: the English model is 2.8 MB gzipped, Japanese 2.0 MB, French 690 KB, and it is cached by the browser afterwards. The 16 MP and 8192 px caps are the memory bound — they exist because a 12-megapixel phone photo is both slow and, after the engine's own downsampling, *less* accurate than a crop. The bytes are read exactly once, at pick time, for the header preflight, and are then dropped: what the component keeps is the `File`, and what the engine recognizes is that same `File` rather than a re-wrapped `Blob`, so a 25 MB image is never copied a second time on its way to the recognizer. The `finally` terminate is the fix for the real cost here: a leaked WASM worker holds its model in memory, and the old build leaked one per failed run. |

## Changes And Evidence

- `src/features/image-ocr/ocr-format.ts` (new) — the single source of truth:
  the three caps and their derived labels, the five format rows and the `accept`
  string, the twelve language rows with their real model byte sizes, the
  self-hosted `OCR_WORKER_PATH`/`OCR_CORE_PATH`/`OCR_LANG_PATH`, the magic-byte
  sniffer, the per-format header readers (PNG IHDR, JPEG SOF0/SOF1/SOF2 walked
  past APPn and standalone markers, GIF logical screen descriptor, WebP
  VP8X/VP8L/VP8, BMP core and info headers including top-down), `preflightImage`
  with one message per refusal, `outputNameFor`, `normalizeOcrText`, `textStats`,
  the confidence bands, the five engine statuses mapped to sentences, and the
  error classifier with its message table. No imports at all.
- `src/features/image-ocr/ocr-engine.ts` (new) — the only module that touches
  the engine, reached through `await import("./ocr-engine")`. Creates the worker
  with `oem = 1` and all three self-hosted paths, hands a `terminate` handle
  back the moment the worker exists, maps the logger through `progressLine` while
  dropping every status it does not recognise, and terminates in a `finally`.
  A superseded run returns `null` rather than throwing.
- `src/features/image-ocr/ImageOcr.tsx` — rewritten: empty boot state, the
  byte cap checked before `arrayBuffer()`, header preflight, preview, the
  language picker with a real model-size note, an explicit Extract, mapped
  progress, a working Cancel, `runIdRef` guards after every await, the result
  region with counts/duration/confidence band, Copy, `Download … again`, the
  format-refusal steer to `/use/image-format-converter`, `aria-busy`,
  `role="status"`/`role="alert"`/`role="region"`, and object-URL release on
  clear and unmount.
- **The engine is actually run, in Node, against the self-hosted model.** The
  audit renders real glyph outlines from the Liberation Sans that ships with
  `pdfjs-dist` into a genuine PNG (its own encoder, CRCs and all), gunzips
  `public/ocr/traineddata/eng.traineddata.gz`, starts `tesseract.js` from this
  repo, and asserts the recognizer reads `INVOICE` back out of the image, that
  its confidence is a real number in range, that the cleaned text's stats match,
  and that **every status the engine actually emitted is one the progress mapper
  declares**. That last assertion is why the mapper's list is exactly five
  strings long.
- **Header parsing, per format and on real bytes.** A JPEG with an APP0 segment
  in front of its SOF0, a progressive JPEG (SOF2), a top-down BMP with a
  negative height, a core-header BMP v2, and all three WebP chunk layouts
  (VP8X, VP8L, VP8 ) are each measured. The negatives matter as much: a
  truncated PNG IHDR, a zero-dimension header, a buffer too short for a BMP
  header, an unterminated JPEG segment and an unknown WebP chunk are all
  *refused* rather than guessed, and no fixture throws.
- **Refusals, at and past every boundary.** An empty file, a text file named
  `.png`, a PNG with no readable header, a 9000×100 header, a 5000×5000 header
  and a file one byte over the cap are each refused, each message is asserted to
  quote the file's *real* numbers and the real cap, and an image exactly on the
  16 MP budget (8000×2000) and one exactly on the 8192 px side limit are
  accepted. The side check is asserted to run before the pixel check, so an
  image that breaks both gets the more specific message. A check also asserts no
  refusal message contains `undefined`, `NaN`, a `.ts:` path or a stack frame.
- **The language table is checked against the filesystem, not against itself.**
  Every advertised id must have a `.traineddata.gz` in `public/ocr/`, every file
  on disk must be advertised, and each row's `modelBytes` must equal
  `statSync` of that file — a number in a table that does not match the file the
  site serves is a lie the download panel would print.
- **Self-hosting, asserted three ways.** The worker, core and model paths are
  `/ocr/…` and the files are on disk; the engine passes all three to
  `createWorker`; and no CDN host appears in either source file, with an
  explicit check that tesseract's default jsDelivr paths are not left in place.
- Copy (`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
  `src/lib/tools.ts`): the five formats including GIF, which the old copy
  omitted; the twelve languages by name; the three caps with the module's own
  numbers; the header-byte confirmation; the first-run model cost; the five real
  stages; the confidence as the engine's opinion; the downsampling and EXIF
  disclosures; the download name; and the removal of "identify and extract all
  readable text", "reliable text extraction", "no upload limits" and "fast,
  private, and accurate". A Node check greps for each removed claim so it cannot
  quietly return.
- Guide: `how-to-ocr-an-image` (`toolSlug: "image-ocr"`, 6 sections,
  `readMinutes: 5`) — what OCR is, what the tool checks before it reads a
  character, why a 12-megapixel photo reads worse than a cropped scan, the five
  things that reliably break it, reading the confidence number, and what this is
  not (not a document scanner, not a form filler, no handwriting, no PDFs, no
  HEIC/AVIF/TIFF/SVG).
- `audit/check-image-ocr.mjs` — **174/174** Node-mirror checks across fourteen
  sections, including the real OCR run described above. It transpiles the
  shipped `ocr-format.ts` with the repo's own TypeScript and imports the result,
  so the rules under test are the rules that ship. It found two real bugs while
  being built: the unsigned BMP height in the shipped module — a top-down BMP
  read as 4,294,967,196 px tall, which the side cap then rejected — and the
  audit fixture's own inverted origin offset, which is what made the first real
  recognition come back as an empty string.
- e2e `e2e/image-ocr-browser.mjs` — **99** production-Chrome scenarios,
   authored and `node --check`ed, then run by the orchestrator against the
   production build: the
  real opener and idle claim, header-derived dimensions and size on load, all
  twelve language options and the model-size note, the limits box, five
  refusals each asserted against the exact numbers the file actually has, a real
  OCR run whose downloaded `.txt` is compared byte-for-byte with the text on
  screen and searched for the two words drawn into the fixture, the announced
  engine stages, the confidence band and its disclaimer, Copy verified through
  the clipboard, a byte-identical re-download, a second run in another language
  filed under its own name, a blank image reported as a result rather than a
  failure, Clear, a 375px overflow check scoped to `main#main`, the
  worker/core/model requests each asserted to have come from this origin, the
  tool page and guide copy honesty, the sitemap, and zero off-origin requests,
  non-GET requests, page errors and hydration warnings.
   Before the run, every DOM- and copy-shaped assertion in the harness was
   checked against the shipped source — which found and fixed four assertions
   that would have failed against a correct page: a byte-cap literal that was
   not 25 MiB
   (27,262,880 rather than 26,214,400, now derived from `MAX_BYTES` so a future
   cap change fails the run instead of passing on a stale copy); two
   `#${noteId}` locators that cannot address a React `useId()` value containing
   colons, now `[id="…"]`; an accuracy-word sweep that flagged the FAQ's own
   question "How accurate is this?" as a claim, now excluding a question or a
   negation; and a pixel-cap pattern that expected "16 MP" where the page prose
   says "16-megapixel". The oversize fixture was also rebuilt as a genuine valid
   PNG padded past the cap, so the byte refusal is proven to fire before any
   header parse instead of being confounded with an invalid image.
- Orchestrator run: `node e2e/image-ocr-browser.mjs` → **99 passed, 0 failed**
  against the production build on port 3801.
- Verification: `node audit/check-image-ocr.mjs` → **174 passed, 0 failed**;
  `npx tsc --noEmit` → **0 errors repo-wide**; `npx eslint` on every touched file
  (`src/features/image-ocr/ImageOcr.tsx`,
  `src/features/image-ocr/ocr-format.ts`,
  `src/features/image-ocr/ocr-engine.ts`, `audit/check-image-ocr.mjs`,
  `e2e/image-ocr-browser.mjs`, `src/lib/tools.ts`, `src/lib/tool-content.ts`,
  `src/lib/seo.ts`, `src/lib/guides.ts`) → **clean, 0 errors and 0 warnings**;
  `node --check e2e/image-ocr-browser.mjs` → **clean**.

### Defects the orchestrator's run caught

The first runtime run failed 4 of the 99 assertions. One was a real copy defect
and three were over-strict harness checks:

1. **Real product defect.** The byte-cap refusal quoted the file size and the cap
   in rounded megabytes ("26.0 MB", "25 MB") but never the exact byte counts, so
   a user who wanted to see the real figures had nowhere to find them. The
   message now carries both the exact file bytes and the exact cap in bytes.
2. The origin-language check accepted only "own origin" or "served from this
   site", while the component says "downloaded from this site". Both describe
   the same true fact — the model comes from this site's own origin — so the
   check was widened rather than the copy weakened.
3. The oversized-file and cap-byte checks wanted the exact `toLocaleString`
   figures, which is what surfaced defect 1.
4. The accuracy sweep scanned the **whole page**, so it matched
   "Resize images pixel-perfect" from an unrelated tool in the shared nav rail
   and from the escaped RSC script payload — neither of which is Image OCR's
   copy. The sweep is now scoped to this tool's own content, from its heading to
   the related-tools rail, so it judges this tool's claims and only these.
- Tracked residuals (accepted, disclosed):
  1. **OCR is a guess and the tool says so everywhere.** The confidence score is
     the recognizer's opinion of its own guesses, banded rather than printed as
     a percentage of correctness, because no engine can produce the latter and
     the tool will not invent it.
  2. **The engine downsamples a large photo before recognizing it.** A very
     large image is not quietly resized by this tool — it is refused at 16 MP —
     but the engine's own internal downsample is outside its control. This is
     the single biggest accuracy factor and it is disclosed in the component,
     the long description and the guide, with the "crop it instead" fix.
  3. **EXIF rotation is not applied.** A photo stored sideways comes out
     sideways. Applying it would mean a decode and a re-encode before the run;
     refusing to pretend the tool does it is the honest choice, and the guide
     says to rotate first.
  4. **One model per run.** Twelve languages means twelve separate downloads, a
     page with two scripts needs two passes, and mixing a Latin model with Han
     or Hangul text in one image will not work. Stated in the language note, the
     long description and the guide rather than left to be discovered.
  5. **No handwriting, no multi-column reading order, no layout extraction.**
     The models are LSTM printed-text models, and this build produces one guess
     per line rather than a confidence-ranked candidate list. Stated as
     "what this is not" in both the guide and the long description.
  6. **The byte cap is checked before the bytes are read, so the refusal message
     depends on `File.size`.** A file whose reported size disagrees with its real
     length would produce a message about the wrong number; the browser is the
     only source of that number and the two cannot be cross-checked without
     reading the whole file first, which is exactly what the cap avoids.
  7. **A single OCR run is single-threaded and memory-bound.** An image at the
     16 MP ceiling is a heavy tab, which is what the cap is for. The `finally`
     terminate means a cancelled or failed run does not leave a worker holding
     its model in memory, but a 16 MP run in progress is still a 16 MP run.

Files: `src/features/image-ocr/ImageOcr.tsx`,
`src/features/image-ocr/ocr-format.ts`,
`src/features/image-ocr/ocr-engine.ts`, `src/lib/tool-content.ts`,
`src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-image-ocr.mjs`, `audit/reports/image-ocr.md`,
`e2e/image-ocr-browser.mjs`.
