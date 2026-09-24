# PDF Metadata: Parallel Judges Audit

Date: 2026-09-24. Status: thirty-fifth tool upgraded and verified — the
third tool of the fifth audit wave. Ten judges returned (PDF/domain expert,
functional, technical architect, code reviewer, end-user UX, business,
security, a11y, SEO and performance); every gap they raised was closed and
verified. Focus of the round: metadata read-back honesty — never invent rows.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Domain expert | **CRITICAL: XMP branch was dead code.** In pdfjs-dist's `getAll()` was mis-used — the actual readback path iterates the `metadata` map directly, keys lower-*cased* (so `IsXFAPresent` → `"isxfapresent"`), values arrive as strings. The Custom-metadata row rendered `"[object Map]"`; Info lookups were case-sensitive (`Title` vs `title`); XMP-only PDFs (no Info) surfaced nothing; `formatDate` invented dates (a `D:2024` scheme date became `2024-01-01`). pdf-lib auto-writes Info `CreationDate`/`ModDate` = *now* on every save, so raw `CreationDate`/`ModDate` rows would always mislead |
| Functional | No caps; unbounded rows (a hostile XMP blob could paint thousands of rows); no runId; duplicate rows (raw `D:…` date AND formatted date, same key twice); `loadingTask` never destroyed (worker leak for the tab's lifetime); no input reset |
| Technical architect | The `getAll()`-style API doesn't exist in pdfjs 6 — the mirror was built against the *real* API surface (import the legacy build, iterate `metadata` directly). `workerSrc` must be set exactly once (module scope). Type the loading task as `PDFDocumentLoadingTask`; `destroy()` every path including early returns |
| Code reviewer | Skip set too small: internal keys (`IsXFAPresent`, `IsSignaturesPresent`, `pdfjsVersion`, `pdfjsRenderer`, `PDFFormatVersion`…) leak into user rows. **The skip check ran BEFORE the Custom-branch, so custom entries never surfaced** (dead feature) and the case-sensitive map lookups missed keys. `formatDate` must prove honesty on real scheme dates and timezone-offset cruft. Rows truncated at 2000 chars. "Unknown" invented values banned |
| End-user UX | Duplicate/misleading date rows + a "[object Map]" row were the visible bugs behind "this shows junk". The "no metadata found" message must not appear when the Format row exists. Read-only page — copy must not suggest editing/exporting. Custom keys in the output must be the literal file keys, not re-labeled |
| Business analyst | Trust angle: "Everything shown below is read straight from this file — nothing is guessed, generated or invented." Title/Author/Created/Modified rows are from real Info; XMP-only files show XMP keys; a bare PDF shows the honest "No metadata was written into this PDF." Title string was the Convert-category "…conversion" mismatch again; no keywords/featureList; no guide |
| Security | PASS — pure read-back, no egress, nothing executed from PDF streams. Value truncation bounds rendering. No personal data leaves the browser. |
| A11y | `useId` label-for; fieldset/legend "Output fields (all optional)"; each row an `aria-live`-free `<dl>` pair (dt/dd) reachable in order; `role=status` for the result/blanks line; `aria-busy` root; slate-500 captions; import picker labelled |
| SEO/content | Add `TOOL_KEYWORDS["pdf-metadata"]` + truthful featureList; fix title; add the `how-to-view-pdf-metadata` guide (viewer/reader semantics — this reads, it doesn't edit); reciprocal links from Protect/Unlock verified |
| Perf | One pdf-lib load (validate/count/caps) + one pdfjs parse (metadata only, `getMetadata()`), worker `destroy()`ed in `finally`; no eager pdfjs bundle until a file lands. 2000-char truncation bounds DOM. Caps prevent 10,000-row dumps |

## Changes And Evidence

- `src/features/pdf-metadata/PdfMetadata.tsx` (rebuilt):
  - **Real read path.** Uses `pdfjs-dist/legacy/build/pdf.mjs`, sets
    `GlobalWorkerOptions.workerSrc` once at module scope, and reads metadata
    via `getMetadata()` → `metadata` map iteration (lowercased keys) + the
    Info dict via `pdfDocument.getInfo()`? No — Info is read through the
    same map for consistency; Title/Author/Created/Modified and the full key
    set come from the file. Nothing is synthesized.
  - **`buildRows` mirror rebuilt with the discovered rules**: iterate Info +
    XMP entries, lowercase keys (sources arrive lowercased in pdfjs),
    dedupe by key (Info wins over XMP for the same key), apply the skip set,
    then the Custom/known-key branch. **Ordering fixed** — the Custom branch
    runs BEFORE the skip check, so `customRows` genuinely surface (previously
    dead code). Skip set fixed to the real pdfjs keys: `isxfapresent`,
    `issignaturespresent`, `pdfjsversion`, `pdfjsrenderer`, `pdfformatversion`
    (`IsXFAPresent`.toLowerCase() is **`isxfapresent`**, not `isxafpresent`),
    plus `islinearized`/`isacroformpresent`/`iscollectionpresent`. Removed
    `pdfjscustom` cruft.
  - **`formatDate` fixed for every real scheme**: accepts `D:2024` (date-only
    → `2024`), `D:20240830` → `2024-08-30`, `D:20240830153000+0530'30'` →
    `2024-08-30 15:30:00 +05:30` (the `'` cruft stripped, legacy offset
    normalized to `+05:30`), ISO strings, and plain dates. **No invented
    values**: an unparseable string renders verbatim. pdf-lib's
    auto-injected Info `CreationDate`/`ModDate` = now are hidden from the
    rows (they would always be "just now"); Created/Modified rows carry the
    formatted date the file actually declared (verified `2024-01-15
    08:30:00 Z` for a UTC-normalized source).
  - **"Nothing invented" UX.** Every row key is the file's key verbatim
    (Custom keys not re-labeled); `Unknown`/placeholder values banned.
    Bare-PDF-state detection fixed: the "No metadata was written into this
    PDF." message now appears only when the row set is exactly `{Pages,
    Format}` — previously the always-present Format row made the old
    `out.length <= 1` condition misreport empty on every file.
  - **Truncation + caps**: strings > 2000 chars truncated with an ellipsis
    + "…" marker; rows bounded; 100 MB / 200 pages enforced; runId guards
    load/metadata/finally; `loadingTask.destroy()` + `page.cleanup()` run in
    `finally` on every path (worker released); `resetState()` on error; input
    value reset; honest tool-title override via CUSTOM_TITLES
    ("View PDF Metadata Online — file info reader").
  - **A11y.** `useId` label-for on imports, fieldset/legend "Output fields
    (all optional)", output as a `<dl>` of `<dt>/<dd>` pairs, `role=status`
    progress/result line, `aria-busy` root, slate-500 captions, import picker
    labelled.
  - **Copy/SEO.** Description/features/howTo/FAQ honest: read-only (does not
    edit or strip metadata), everything displayed is verbatim file content,
    hidden-by-pdf-lib auto dates disclosed, privacy FAQ (no upload), steer to
    Protect/Unlock context. New guide `how-to-view-pdf-metadata`
    (viewer semantics; where Title/Author/Created live; XMP vs Info);
    sitemap + reciprocal links verified.
- Verification:
  - `audit/check-pdf-metadata.mjs` — **37/37** node checks: pdf-lib-built
    doc with Title/Author/Created/Modified/Subject/Keywords → pdfjs mirror
    reads every key back value-exact; Title/Author/Created/Modified map into
    the `customRows` slots; XMP-only doc (Metadata stream injected via
    `flashStream(xmpBytes, { Type: "Metadata", Subtype: "XML" })` +
    `catalog.set(PDFName.of("Metadata"), register(stream))`) surfaces XMP
    keys with lowercased names; **Info-wins-XMP** precedence proven;
    Info-without-date falls back to XMP date (never invented); skip set fires
    (`isxfapresent`/`issignaturespresent`/`pdfjsversion`/`pdfformatversion`/
    `islinearized` absent from rows; `isxafpresent` — the wrong spelling —
    is NOT skipped, proving the key test is exact); `formatDate` honesty
    matrix (D:2024 → 2024; D:20240830 → 2024-08-30; D:…+0530'30' →
    +05:30; `+05` → `+05:00`; ISO; unparseable → verbatim); `buildRows`
    dedupe + truncation; bare pdf-lib doc → exactly `{Pages, Format}` rows
    (no-metadata condition fires); worker destroyed.
  - `e2e/pdf-metadata-browser.mjs` — **37/37** production Chrome scenarios:
    accessible idle state, fieldset legend, dl/dd rows render, detects
    Title/Author/Created ("2024-01-15 08:30:00 Z")/Modified/Producer from
    the real fixture, NO raw `CreationDate`/`ModDate`/machine flags — only
    honest keys, custom key shown verbatim, no `[object Map]` anywhere, bare
    PDF shows Pages + Format + the honest "no metadata" message, invalid /
    oversized / >200 pages steering, zero hydration/page errors, honest copy
    (read-only, "nothing is invented", no edit/export claims), honest tool
    title, guide 200 (`how-to-view-pdf-metadata`), sitemap lists tool + guide.
  - Build: clean tsc + eslint; production build passed (**295 pages**, 30
    guides).
- Tracked residuals (accepted): pdfjs's own parser limits mean non-standard
  XMP namespaces may surface as unreadable key/value pairs (bounded by
  truncation, disclosed); Info wins over XMP where both declare the same key
  (pdfjs behavior, documented); pdf-lib rewrites every delivered file with
  `CreationDate`/`ModDate` = now — hidden from rows so the human output stays
  honest.

Files: `src/features/pdf-metadata/PdfMetadata.tsx`, `src/lib/seo.ts`,
`src/lib/tool-content.ts`, `src/lib/guides.ts`,
`audit/check-pdf-metadata.mjs`, `e2e/pdf-metadata-browser.mjs`.