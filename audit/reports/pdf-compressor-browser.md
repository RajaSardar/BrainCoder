# PDF Compressor Browser Verification

Date: 2026-09-16

## Result

**PASS after parent fix: 15 scenarios passed, 0 failed, exit 0.** The initial verification below found four failures caused by one production error-message defect. The parent added an exact library-message fallback when the transpiled encrypted-error prototype does not support instanceof, rebuilt production, and reran the complete harness successfully. Encrypted inputs now show actionable guidance. Earlier failure details are retained as history.

Final parent checks: `npm run build` passed (279 generated pages); `node e2e/pdf-compressor-browser.mjs` passed 15/15; `node --experimental-strip-types --test-reporter=dot e2e/pdf-compressor.mjs` passed 73/73; targeted ESLint passed. Final browser run observed 0 page errors, 0 tool/other HTTP requests and 28 localhost analytics console errors. These are scoped observations, not universal security or browser-compatibility guarantees.

Final command, against the parent's existing production server:

```sh
BASE_URL=http://localhost:3788 node e2e/pdf-compressor-browser.mjs
```

Environment: macOS, Node v22.16.0, installed playwright-core with headless Google Chrome 152.0.7977.84. The script defaults to `http://localhost:3788` when `BASE_URL` is absent. Tests execute sequentially. No build, application-server start/stop, commit, agent spawning, dependency installation, or unrelated file edits were performed. The parent's server PID 95906 was not managed by this work.

## Finding And Reproduction

**Medium: encrypted PDFs expose a developer-facing pdf-lib bypass suggestion instead of the intended recovery guidance.**

1. Open `http://localhost:3788/use/pdf-compressor`.
2. Choose an AES-256 or RC4 encrypted PDF. Both a non-empty user password and an empty user password with owner restrictions reproduce the issue.
3. Click **Compress PDF**.
4. The visible alert inside the compressor form displays:

```text
Input document to `PDFDocument.load` is encrypted. You can use `PDFDocument.load(..., { ignoreEncryption: true })` if you wish to load the document anyways.
```

Expected from current source and implementation report:

```text
Encrypted or password-protected PDFs are not supported. Use an unencrypted copy you are authorized to edit.
```

The regression generates all four encrypted fixtures in memory with installed `@pdfsmaller/pdf-encrypt`; it reproduces the defect without requiring saved fixtures. It asserts the source stays selected, no Download exists, and Compress PDF is enabled before asserting the recovery wording. Those rejection/state assertions passed for all four inputs in the final run.

Relevant source: `src/features/pdf-compressor/compressor.ts:153-158` maps errors only when `error instanceof EncryptedPDFError`; `src/features/pdf-compressor/compression.worker.ts:48-53` forwards the exception message. The served worker is `/_next/static/chunks/turbopack-worker-2ru9m5gbh1na6.js`. The observed production path does not produce the intended mapping. Constructor identity/prototype behavior in the browser bundle is a follow-up investigation, not an established root cause. No source fix or rebuild was attempted under this verification-only scope.

## Passed Coverage

| Scenario | Observed result |
| --- | --- |
| Light image PDF | 2,925,045 to 956,643 bytes; decoded JPEG 2,000 x 833 |
| Balanced image PDF | 2,925,045 to 376,744 bytes; decoded JPEG 1,600 x 667 |
| Strong image PDF | 2,925,045 to 106,487 bytes; decoded JPEG 1,200 x 500 |
| Compact text-only PDF | 1,194 to 1,194 bytes; byte-exact original; honest Original PDF kept status |
| Native keyboard workflow | Enter opens file chooser; single-file chooser; arrow keys change native radio selection; Tab reaches submit; Enter submits/downloads/adjusts; Space removes source |
| Corrupt PDF and recovery | Visible form-scoped role alert while selected; no download; dismiss works; valid replacement successfully compresses/downloads |
| Busy/cancel/retry | File replacement, removal, submit and all three presets disabled; live busy status; keyboard cancellation retains source and unlocks controls; real Strong retry succeeds |
| 375px tool layout | Empty, selected long filename, result and corrupt-alert states have tool width/scrollWidth 375/375; functional compression/download and New file reset |
| 320px tool layout | Same states have tool width/scrollWidth 320/320; functional compression/download and New file reset |
| Landing page | Corrected worker/lossy/100 MiB/metadata/fallback/signature copy; illustrative preview; seven FAQ panels with unique matching aria-controls IDs, correct aria-expanded/hidden state and Enter/Space toggling; visible answers match FAQ JSON-LD; four HowTo steps |
| Guide | Corrected limits/presets/worker/fallback/signature copy; Open PDF Compressor href is `/use/pdf-compressor`; keyboard activation actually navigates there and loads file input |
| Observability | Actual HTTP requests observed/classified; no file payload signatures, file-upload MIME types, unclassified tool requests, or uncaught page errors |

The table describes assertions within 11 passing scenarios; it is not an additional test count.

The image fixture is a deterministic native `@napi-rs/canvas` noise JPEG drawn on a real pdf-lib page, not merely an unused resource. Its native encoder's ICC APP2 segment is removed to produce an explicitly supported unprofiled DeviceRGB input. All three presets must materially shrink the file, not just reserialize PDF structure. Actual browser download events are consumed with `createReadStream`, not substituted with direct engine calls or a synthetic blob fetch. Every successful output is parsed by pdf-lib and independently by PDF.js: two page sizes, title metadata and selectable text on both pages are checked. Native JPEG decoding verifies actual dimensions match the PDF image dictionary.

The long filename is 234 ASCII characters including `.pdf`, with no spaces. Desktop checks use 1440 x 1000; mobile-width checks use 375 x 812 and 320 x 812. Overflow checks inspect form bounds, descendant bounds and descendant scrollWidth, not just the document root. Native input internal filename scrolling is excluded, but its outer bounds are checked.

## Network And Errors

Final run recorded 810 HTTP requests: 515 assets, 254 navigation/RSC requests, 14 service-worker shell/navigation fetches, 27 analytics requests and **0 tool/other requests**. These include cache/service-worker observations and are not 810 unique endpoints. The normal service worker remains enabled, except for the controlled busy-state interval below.

All requests, including ignored analytics/assets, are inspected for the generated private marker, PDF header, raw/base64 fixture samples, and PDF/multipart/octet-stream request MIME types. Unexpected non-asset/non-navigation tool traffic fails separately. No blanket zero-network claim is made. `public/sw.js` was read to verify that observed `/`, manifest, navigation and icon fetches were shell/cache activity rather than compression uploads.

There were **0 uncaught page errors** and **28 console errors**. Console messages were repeated missing `/_vercel/insights/script.js` 404s and MIME-execution refusals on localhost. They were captured and reported, not treated as compressor upload failures. Analytics delivery on deployed hosting is not verified here.

This is observed HTTP request coverage for generated fixtures, not a proof against arbitrary transformed/exfiltrated data, WebSocket/WebRTC channels, every service-worker implementation, or all future code paths.

## Deterministic Timing And Limits

- Busy-state coverage temporarily holds the real observed worker bootstrap HTTP request. Its Turbopack URL fragment is normalized; CDP bypasses the service-worker cache only during that interval. No Worker, PDF engine, response or success result is mocked. Cancel occurs before worker-script completion, then the route/cache override is removed and a real retry is parsed/downloaded.
- This does not establish cancellation during an already-running bitmap encode, all cancel/unmount races, worker termination internals, object-URL leak freedom, or the real 60-second timeout. Those were not claimed as browser-tested.
- Mobile checks are Chrome viewport resizing, not physical iOS/Android devices, mobile user agents, touch emulation, or Safari/Firefox coverage. No manual screen-reader or visual/color-fidelity review was performed.
- Native file-chooser keyboard triggering is covered through Playwright's filechooser event; the operating-system picker dialog itself is not visually inspected. Drag/drop locking was not tested.
- Digital signatures, 100 MiB boundary/OOM behavior, unsupported image encodings/masks/profiles, exhaustive malformed PDFs and other tools were not browser-tested in this script. Prior engine-report coverage is not relabeled as browser coverage.
- No fixture/download/screenshot/video/trace/report-output artifacts are retained by the script. Playwright necessarily uses temporary browser/profile/download storage; downloads are explicitly deleted and the context/browser closed. Only this Markdown report and the regression script are added to the workspace. The terminal tool independently retained a truncated initial-run log outside the repo.

## Run History And Static Checks

- Initial harness run: 8 pass / 7 fail. Five alert checks incorrectly selected Next's empty global route announcer before the tool alert appeared; worker routing missed URL fragments/cache; the network classifier had not classified actual shell/icon requests. A separate read-only browser inspection established the actual non-empty tool alert and worker URL. These were test-harness defects, corrected only in the new script. Initial mobile alert coverage was premature and was replaced with explicit form-scoped, non-empty alert assertions.
- Corrected second run: 11 pass / 4 fail, exposing the encrypted-message bug above.
- Final run using explicit `BASE_URL`: 11 pass / 4 fail. Reordered encrypted assertions establish actual rejection/source retention/no-download/retry state before the intentionally failing recovery-message assertion. All other scenarios reran successfully.
- `./node_modules/.bin/eslint e2e/pdf-compressor-browser.mjs`: passed both before and after final script edits, exit 0 with no output.
- `git diff --check`: exit 0 for existing tracked diffs; the two newly added files remain untracked. Final status review showed the original tracked modification set unchanged.

Existing feature/shared-content modifications, unrelated tool changes, `e2e/pdf-compressor.mjs`, audit reports and scratch audit scripts were read where relevant and left untouched.
