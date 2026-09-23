# PDF Page Numbers: Parallel Judges Audit

Date: 2026-09-23. Status: thirty-first tool upgraded and verified — the first
tool of the fourth audit wave. Ten judges returned (PDF domain expert, SEO and
Performance hit API rate limits on the first attempt and completed on retry);
every gap they raised was closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | `startAt + pageCount - 1` as "total" is misleading when startAt ≠ 1 (pageCount 3 at start 0 prints "0 / 2"…"2 / 2"); `getSize()` is the pre-rotation MediaBox so `/Rotate` pages get sideways/wrong-edge numbers and the "works regardless of page orientations" FAQ is false; no runId; no caps; raw err.message; re-picking the same file fires no change; number input accepts NaN/decimals/negatives that reach `widthOfTextAtSize` |
| Domain expert | `ignoreEncryption: true` silently corrupts owner-protected documents — a valid RC4 doc with an empty user password passes the pdf.js gate and pdf-lib's `ignoreEncryption` appends cleartext streams to an `/Encrypt` document, producing spec-violating output that viewers render as garbage; StandardFonts.Helvetica is a base-14 reference, not embedded; `n / total` labels for start 0/1/5; y=28 / x=48 offsets sit inside the margin; the "use PDF Cropper first to create margin space" remedy is backwards (cropping clips content, it doesn't create margin) |
| Technical architect | No runId means a stale load/error/finally can clobber newer state and a stale async result can download anyway; text content aborts with nothing re-rendered; pdf.js task never destroyed (worker leak); no size/page caps; dual parsers for one job; input value never reset so the same file can't be re-chosen |
| Code reviewer | startAt min/max absent → `NaN`/`Infinity` labels baked into the PDF; `POSITIONS[].y` dead code; dual-parser memory cost; save() defaults re-render form appearances; `data.slice(0)` needed only because pdf.js transfers its input buffer |
| End-user UX | Marketing promises Roman numerals, "Page X of Y", adjustable font/color — none exist; "skip the title page" via startNumber is a myth; no preview and no size cap; raw error strings; only color distinguishes the selected position |
| Business analyst | The marketing lies are the top trust risk; the "skip the first page" FAQ is a lie with real SEO intent behind it ("start page numbers on page 2") — recommend an honest offset explanation because a true skip toggle doesn't exist; self-referencing relatedSlugs; no SEO rows; disclose the caps |
| Security/privacy | PASS — no network egress. `ignoreEncryption` is a foot-gun (traps when the pdf.js gatekeeper is dropped); err.message lands in React-escaped DOM (safe); hostile large files can OOM the tab — caps needed; workerSrc is locally self-hosted |
| A11y specialist | No live regions (role=status/role=alert), no aria-pressed on the position buttons, range input had no programmatic label (Field renders `<p>`+children — use SliderField), number input not label-for bound, no aria-busy, no fieldset/legend groups |
| SEO/content | Missing TOOL_KEYWORDS + TOOL_FEATURE_LIST rows; no guide (draft `how-to-add-page-numbers-to-a-pdf` expected); copy-truth false-claims list; the tagline "Number pages in six positions" is accurate |
| Perf judge | pdf.js transfers/detaches the input buffer so `data.slice(0)` is required — switching to a single pdf-lib parser removes the copy, the worker and a second decode (peak RSS ~3–4× for 100 MB in dual-parser mode); no yield + no page cap stalls the main thread; save() defaults cost |

## Changes And Evidence

- `src/features/pdf-page-numbers/PdfPageNumbers.tsx` (rebuilt):
  - **pdf.js removed entirely.** One pdf-lib `load(...)` validates, counts pages
    and holds the working document, then the stamp pass re-loads it. No worker,
    no memcpy, no second parser, no `data.slice(0)`.
  - **`ignoreEncryption` dropped.** The stamp pass loads without it, so a
    password-protected file fails with pdf-lib's "is encrypted" error and is
    steered to PDF Unlock with a friendly message. Owner-protected files can
    no longer be silently corrupted into cleartext-residue PDFs.
  - **Rotation compensation that keeps labels screen-upright.** A probe proved
    `dropText` emits `Tm = [cosθ, sinθ, −sinθ, cosθ, x, y]` and that the label
    reads left-to-right and upright on screen only when `rotate = +/Rotate`.
    The new `placement()` computes a *visual* corner (`vx`/`vy` in viewer
    coordinates: `MARGIN=48` horizontal, `EDGE=28` bottom / `height−40` top,
    right/center measured from the label's real text width, quarter-turns
    swapping the effective width/height) and converts it back to the unrotated
    `(x, y, rotate)` per corner:
    rot 0 → `(vx, vy)`; 90 → `(W−vy, vx)`; 180 → `(W−vx, H−vy)`;
    270 → `(vy, H−vx)`. The node harness verifies all 24 combinations land on
    the intended visual corner and that the emitted Tm equals `R(rot)` on real
    pages at 0/90/180/270 — so mixed portrait/landscape documents keep every
    label in the same visual corner, upright.
    (Page-relative compensation — the watermark's `effAngle = user − rot`,
    which keeps a diagonal stamp at the same angle *to the page* — is the right
    model for watermarks; page numbers instead must stay upright *on screen*, so
    the very same probe math is applied with the opposite convention. Both are
    verified against emitted Tm in their own audits.)
  - **Honest labels and semantics.** "n / total" with `total = startAt +
    pageCount − 1` (the last displayed label — documented in copy and FAQ, so
    start 0 on a 3-page file reads "0 / 2 … 2 / 2"); the start number input is
    `trunc`ed and clamped to 0–9999 so NaN/decimals/negatives can never reach
    the font; every page is numbered (chip removed); no skip-a-page promise.
  - **Caps, runId, reset, friendly errors.** 100 MB / 200 pages with
    split-steering messages, `runIdRef` guarding load/stamp/finally so a stale
    result can neither clobber state nor trigger a download, `resetState()` on
    every load error, input `value=""` reset on pick so the same file can be
    re-chosen, and `friendlyError()` mapping encrypted → PDF Unlock and
    invalid → "doesn't look like a valid PDF". `SAVE_OPTS`
    (`updateFieldAppearances:false, addDefaultPage:false`) stops appearance
    regeneration. A 1-frame yield every 25 stamped pages keeps the tab
    responsive.
  - **A11y.** Fieldset/legend "Numbering options" + nested "Position" group;
    six `aria-pressed` toggle buttons (active state now border+bg, not
    color-only); `SliderField` ("Font size", 8–24 pts) with label htmlFor;
    number input bound via `useId` label; "n / total" checkbox in the same
    fieldset; `role=status` idle/load/progress/result lines; `role=alert`
    errors; `aria-busy` on the root; dark-grey labels with a density that
    passes AA.
- `src/lib/tool-content.ts` (`"pdf-page-numbers"` entry rewritten):
  Roman numbers, "Page X of Y", "adjustable font, size, color" and the
  drag-and-drop/upload howTo steps are gone; features and howTo now state
  exactly what exists (fixed dark-grey Helvetica, Arabic numerals, six
  positions, 8–24 pt, start offset). The overlap FAQ now says cropping *trims*
  content and a margin must already exist, and directs PDF Cropper instead of
  recommending the backwards remedy. FAQ added/rewritten for the offset-vs-skip
  distinction, landscape+portrait rotation handling, and the new PDF Unlock
  steering. `relatedSlugs` dropped the self-reference and swapped in
  `pdf-crop` (page-numbers kept in the top-6 reciprocal window of merge/split/
  watermark/crop with no reorder needed).
- `src/lib/tools.ts`: tagline/description already true ("Number pages in six
  positions", plain or "n / total") — left unchanged.
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-page-numbers"]` (7 terms incl. "start
  page numbers on page 2") and a truthful `TOOL_FEATURE_LIST` JSON-LD override
  added.
- `src/lib/guides.ts`: new guide `how-to-add-page-numbers-to-a-pdf` (position
  & label choice, start offsets, rotated-page placement, PDF Unlock
  prerequisite, no preview caveat).
- Verification:
  - `audit/check-pdf-page-numbers.mjs` — **67/67** node checks: visual-corner
    math for all 6 positions × 4 rotations, drawn Tm blocks equal `R(rot)`,
    save/reload with `/Rotate` preserved, n/total semantics for start 0/1,
    start clamp (NaN/neg/over-range), caps, SAVE_OPTS, friendlyError mapping.
  - `e2e/pdf-page-numbers-browser.mjs` — **47/47** production Chrome scenarios:
    accessible idle state, loaded "3 pages", fieldset legends, six aria-pressed
    toggles, SliderField + label-for number input + bounded value, default
    download `sample3-numbered.pdf` with "1 / 3" on page 1 and an upright
    rotate=90 "2 / 3" on the rotated page 2 (hex-decoded Tj runs), customized
    start 0 / top-right / plain numbers verified by decoded glyph runs,
    clamp behavior, encrypted/invalid/oversized steering, zero hydration or
    page errors, and honest `/tools/` copy checks (incl. no drag-and-drop, no
    Roman, fixed-font/Arabic-only disclaimer, PDF Unlock + PDF Cropper routes).
  - Build: clean tsc + eslint; production build passed (**293 pages**, 27
    guides).
- Tracked residuals (accepted): the fixture `e2e/fixtures/encrypted.pdf` is
  malformed for pdf.js but correctly triggers pdf-lib's "is encrypted" path;
  text is fixed Helvetica so non-Latin labels can't be drawn (a WinAnsi
  preflight was considered and skipped because the number formatting makes
  unsupported characters effectively unreachable); page size mis-match between
  sheets is tolerated (each page places by its own size).