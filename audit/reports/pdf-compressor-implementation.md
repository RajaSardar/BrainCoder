# PDF Compressor Implementation

Date: 2026-09-16

## Scope

Implemented following the user's completed sequential judging phase; no agents were spawned and judging was not repeated. Read root `AGENTS.md`, `audit/TOOL-AUDIT-KIT.md`, installed Next.js 16.3.4 `use-client` and server/client component guidance, and loaded `javascript-expert`.

Only these files were manually changed/created:

- `src/features/pdf-compressor/compressor.ts`
- `src/features/pdf-compressor/client-compressor.ts`
- `src/features/pdf-compressor/PdfCompressor.tsx`
- `e2e/pdf-compressor.mjs`
- This report

The existing `compression.worker.ts` protocol remains sufficient because each client call now owns a separate disposable worker. Unrelated Base64, case converter, PDF-to-Word, QR code, and audit work was preserved. No dependencies, shared/product files outside the feature, commits, pushes, server lifecycle commands, or Next builds were changed/run.

## Changes

- Re-encoding returns JPEG bytes plus actual output width/height. Replacement image dictionaries are cloned, retaining optional content (`/OC`), structure (`/StructParent`), interpolation, intent, and other non-encoding keys.
- Images must explicitly resolve to DeviceRGB or DeviceGray, 8 bits/component, one DCTDecode or FlateDecode filter (a one-element array is supported), and absent/null/empty/default decode parameters. Unsupported spaces, chains, decode mappings, predictors, masks, external streams, malformed data, and explicit JPEG color transforms remain untouched. Resource default-color-space overrides conservatively disable image recompression throughout the document to avoid both source and output reinterpretation.
- Precollects mask objects before processing images, including masks stored earlier than their parents. Mask parents and referenced `/SMask` and `/Mask` images are skipped.
- JPEG SOF dimensions, component count, and supported 8-bit baseline/progressive encoding are checked before browser decoding. Input embedded ICC profiles and APP1/EXIF are skipped to avoid color/orientation transformations. Encoder-generated sRGB canvas output may contain its own ICC profile.
- Preserves the 100 MiB input cap in UI, client, and engine. Images are sequential and limited to 12 million pixels and 16,384 pixels per axis. Flate output is read incrementally into an exact-size buffer, cancelled on overflow, and rejected on truncation. Bitmap and canvas resources are released in `finally` paths, including encode/context failures and HTML canvas fallback.
- Removes encryption bypass. Both engine entry points reject encrypted documents, including owner-password-only files, with an actionable error. Populated signature dictionaries are detected across direct/indirect objects before mutation; empty signature fields do not trigger rejection. No decryption or signature validation is invented.
- Preserves metadata, text operators, fonts, page geometry/count, and form appearances rather than stripping metadata or rasterizing pages. Structural reserialization is retained only when smaller. Whole-document output that is equal/larger returns byte-exact original input, method `none`, zero changed images, and actual page count.
- Every client call owns a disposable worker. AbortSignal and default 60-second timeout cover file read plus processing; cancellation terminates the worker. Success, worker errors, messageerror, post/constructor/read errors, and URL allocation failure clean up listeners/timers. Settled calls ignore late responses before creating URLs.
- The successful client caller owns the object URL. UI tracks ownership immediately in a ref, revokes it on replacement/reset/adjust/unmount, and revokes stale completions. This covers completion-before-effect/unmount races as well as normal result cleanup.
- UI errors remain visible with selected files using `role="alert"`. Native visible file input and fieldset/radio presets replace simulated controls. Busy replacement, removal, and preset changes are blocked; cancel/unmount abort processing. Live status, honest unchanged/skipped counts, explicit non-submit button types, 44px targets, and long filename wrapping were added without changing the overall visual layout. Adjust compression retains the source PDF.

## Verification

All commands ran from `/Users/rajasardar/repos/BrainCoder` using installed dependencies and Node v22.16.0.

```sh
node --experimental-strip-types e2e/pdf-compressor.mjs
```

Result: **73 tests passed, 0 failed, 0 skipped/cancelled**. 59 engine tests and 14 client lifecycle tests. Uses generated pdf-lib fixtures, native `@napi-rs/canvas` adapters, fflate, actual AES-256/RC4 encryption via `@pdfsmaller/pdf-encrypt`, and independent PDF.js text extraction. No fixture files or generated artifacts are written.

After the final encrypted-error wording/timeout wording changes, reran the same 73 tests with the dot reporter:

```sh
node --experimental-strip-types --test-reporter=dot e2e/pdf-compressor.mjs
```

Result: all 73 passed, exit 0. Node emits expected experimental type-stripping and typeless-package ESM reparsing warnings. Package configuration was not changed to suppress them.

```sh
./node_modules/.bin/eslint src/features/pdf-compressor e2e/pdf-compressor.mjs
```

Result: exit 0, no errors or warnings.

```sh
./node_modules/.bin/tsc --noEmit --incremental false --skipLibCheck --strict --target es2022 --module esnext --moduleResolution bundler --jsx react-jsx --esModuleInterop --lib dom,dom.iterable,esnext src/features/pdf-compressor/compressor.ts src/features/pdf-compressor/client-compressor.ts src/features/pdf-compressor/compression.worker.ts src/features/pdf-compressor/PdfCompressor.tsx
```

Result: exit 0, all four feature files type-check; no incremental/build artifacts generated.

```sh
git diff --check
```

Result: exit 0.

Regression assertions include actual decoded JPEG versus dictionary dimensions, dictionary/stream preservation for unsupported images, referenced masks, default color overrides, sequential decoding, native and mocked inflation overflow, resource cleanup, encrypted input rejection, populated and empty signatures, unchanged output and forced whole-document growth fallback, text/page/font preservation, concurrent out-of-order worker responses, isolated cancellation, pre-abort/read-abort, timeout/late responses, error paths, timer/listener cleanup, and URL ownership.

During development the first harness run had 59 passes/6 failures: the native encoder adds an ICC profile to both fixtures and output. The source fixture was made explicitly unprofiled; output validation now distinguishes known canvas output from untrusted profiled input. Added an explicit input-profile rejection test. Subsequent expanded runs passed. Early targeted lint/type checks also caught and resolved a timer declaration warning and HTML canvas narrowing error.

## Limits And Follow-Up

- **Residual parser OOM:** pdf-lib parses the complete document and can inflate PDF object streams before these image guards execute. The 100 MiB file cap, worker isolation, and timeout do not guarantee a hard memory bound or recovery from process-level memory exhaustion. Serialization also retains input/document/output memory; no global limit is imposed across concurrent independent callers.
- Native DecompressionStream may internally buffer data. The application caps retained decoded image bytes and cancels the reader as soon as an oversized chunk is observed; this is not a hard native-decoder heap quota.
- File.arrayBuffer is not itself abortable. Cancelling/timing out during reading rejects immediately and prevents worker creation when the read finishes; the underlying read may still finish in memory.
- Browser JPEG conversion is lossy, and supported DeviceGray is emitted as RGB. Exact colorimetric equivalence is not claimed. Complex/professional color pipelines, profiles, masks, predictors, and default-device overrides are deliberately skipped rather than approximated.
- Signature fixtures have populated signature dictionaries and ByteRange/Contents but are not cryptographically signed certificates. Tests establish rejection before mutation, not cryptographic verification, trust validation, or exhaustive hostile-PDF signature detection.
- The forced document-growth regression injects an oversized serializer result to exercise the fallback deterministically; natural compact text fixtures independently verify byte-exact no-change behavior.
- Browser tests were deliberately deferred to the parent. Real Next worker bundling, mobile layout, keyboard/screen-reader behavior, file-picker/drop replacement locking, cancel/retry/unmount UI races, downloads, and browser-specific bitmap/color behavior still need browser verification. Native canvas/fake Worker coverage does not substitute for these checks.
- No Next build, shared server start/stop, or broader tool suite was run. Related shared SEO/content was outside ownership and unchanged. Do not mark browser/release verification complete from this report.
