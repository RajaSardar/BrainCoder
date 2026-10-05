# CSV to JSON Converter: Parallel Judges Audit

Date: 2026-10-05. Status: the completed converter audited and its
production-Chrome e2e harness authored. Ten judges (functional, end-user UX,
business, SEO/content, security, a11y, technical architect, performance, edge
cases, honesty) returned. This round verified an implementation that was
already in place and wrote the browser harness against it, so the evidence
below is the Node mirror (360 checks, all passing) plus a source review, and
**the Chrome harness has not been run** — nothing in this report claims a
browser result. Focus of the round: a CSV converter is judged on the awkward
cases, because the easy cases are the ones everybody passes and the awkward
cases are where a converter silently loses a column. Every RFC 4180 deviation
this build makes is named on screen, every cap is a refusal carrying the real
numbers, and no type is ever inferred.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | `csv-parse.ts` lexes RFC 4180 in the state machine a correct one needs — quoted cells with embedded delimiters and embedded newlines, doubled quotes, CRLF/LF/bare-CR record endings, a leading UTF-8 BOM, a trailing line ending, and blank lines that are skipped rather than turned into empty rows. The four output-shaping decisions all land where they should: a short row's absent cells become JSON `null` rather than an empty string (an empty cell is something the CSV said, a missing cell is something it did not), a long row's surplus values are kept in a named `_surplus` array rather than dropped, duplicate header names are renamed deterministically to `name (2)`/`name (3)` with every rename listed, and the generated-keys path takes the column count from the widest record. The one real defect the review found is in the delimiter report, not the parser — see the section below. |
| End-user UX | The tool boots with an empty box, no JSON pane, no preview and no download button, and the empty state says no sample CSV is pre-filled and that nothing on the page can be mistaken for the reader's data. Nothing appears until there is something to show. Everything the converter decided is on screen in one "What was decided" panel — the delimiter and its confidence, the line endings it found, records read against rows converted, skipped blank lines, a skipped BOM, ragged-row counts, the de-duplication list, and every quoting anomaly — rather than being implicit in the output. The delimiter line ends by pointing at the header above it, which is the only real check a human can make. Ragged rows are amber, not red. Clear empties the box and returns the page to the boot state rather than leaving a stale preview. |
| Business | The differentiator is not "we have a CSV to JSON tool" — it is that this one says what it decided and refuses rather than truncating. Twelve features, four how-to steps, eight FAQs, the registry tagline, the meta description, the JSON-LD feature list and the seven-section guide were all written around three claims: a real parser rather than a split, every value kept as a string, and real caps with real numbers. The "not done, though a spreadsheet does it" list — no serial dates, no locale-aware numbers, no `#N/A`, no leading-apostrophe stripping, no formula evaluation, no encoding sniffing — is stated rather than left to be discovered, and the removed direction (JSON back to CSV) is disclosed in a FAQ instead of being left implied. |
| SEO/content | Eleven keywords (`src/lib/seo.ts:148`), a meta description that leads with the parser's named cases (`seo.ts:247`), a JSON-LD feature list that enumerates the dialect, the detection confidence bands, the ragged-row policy, the caps and the no-network claim (`seo.ts:305`), a registry entry (`tools.ts:732`), a long description, 12 features, 4 how-to steps, 8 FAQs and 5 related slugs (`src/lib/tool-content.ts`), and a seven-section guide with five keywords and a five-minute read (`src/lib/guides.ts`). The guide's caps, the dialect paragraph's extension list and the FAQ's losslessness claim were verified against the code — the mirror audit's eleventh group fails if the copy contradicts a cap, a dialect or a refusal — but no copy was rewritten this round. |
| Security | There is no ingestion path but a file input and no upload anywhere: the file is read with `file.text()` (the platform UTF-8 decode) and parsed in the tab. The component holds no `dangerouslySetInnerHTML`, and no CSV-derived value — a cell, a file name, a byte count, an anomaly detail — is ever rendered as markup rather than as a text node. The opened-file cap is checked on `file.size` **before** the bytes are read into the page (`CsvJson.tsx:146`), so an oversize file is refused on its declared size rather than after a 5 MB read. The harness asserts zero off-origin requests, zero non-GET requests, no uncaught page errors and no request URL carrying a token planted in a fixture, so "your CSV never leaves the device" is checked rather than claimed. |
| A11y | `aria-busy` on the tool root for every conversion, `role="alert"` on both refusal surfaces, an sr-only `role="status"` while busy, a visually-hidden `role="status"` inside the copy button announcing "Copied to clipboard", `aria-describedby` from the textarea to a hint that carries the live over-cap character count, `aria-invalid` set when the input is over the cap, `aria-describedby` from the header toggle to its own explanation of generated keys, and every panel a `role="region"` labelled by its own title. The data preview's accessible name is its title, which reads "Data preview — first 2 of 2 rows, first 2 of 2 columns" — a screen-reader user learns that the table is bounded from the same string a sighted user reads. Cell text is escaped text, so a cell containing markup is announced as characters. |
| Technical architect | The decisions live in two browser-free modules and everything that touches the DOM lives in the component: `csv-parse.ts` (the lexer, the delimiter detector, the key plan, the preflight and its refusals) and `csv-format.ts` (the conversion, the notes, the labels, the preview bounds, `outputNameFor`). Every cap is declared once and imported; the five user-facing cap labels are *derived* from those constants (`csv-format.ts:60-64`) and folded into one `CAP_SUMMARY` (`:66`), so the UI cannot quote a number the parser does not enforce. `preflightCsv` is a second, deliberately allocation-free scanner that mirrors the parse rules rather than building a model, and the mirror audit's third group exists to hold the two to the same answer — a two-implementation risk that is checked rather than assumed away. |
| Performance | Cost is bounded by the caps and disclosed rather than discovered: 5,242,880 characters of pasted text, 5 MB per opened file, 20,000 rows, 512 columns, 100,000 characters per cell. Each is refused with its real numbers before parsing work starts, so a 60 MB paste costs a length check. The data preview is bounded on both axes (`CELL_PREVIEW_CHARS` plus a row and column slice) while the JSON pane holds the whole document, so a large file's UI cost does not scale with the document. The row and column refusals short-circuit on the offending record rather than accumulating a model first. The one measurable cost the harness cannot bound for me is the 5,242,880-character paste itself, which is why it builds the string inside the page rather than across the CDP wire. |
| Edge cases | The named cases all have names: quoted delimiter, quoted newline, doubled quote, CRLF, bare CR, BOM, trailing newline, blank line, single-column file, ragged short row, ragged long row, duplicate headers, empty header cell, header-only file, no-header mode, non-UTF-8 bytes, the quote-in-unquoted-field anomaly, and four over-cap refusals plus the file-size refusal. The single-column file is the subtle one — no candidate delimiter appears at all, so the detector reports "no delimiter needed" with an explanation rather than inventing a guess. The header-only file produces `[]` with the columns still reported and the empty array explained. |
| Honesty | The conversion is labelled not lossless in the page's own words, with the preserved half and the changed half listed (`Preserved:` cell text character for character, row order, column order; `Changed on purpose:` no type inference, trimmed header cells, empty headers as `columnN`, duplicate renaming, `null` padding, `_surplus` retention, skipped blank lines). Type inference is refused out loud in the banner that greets the user: `00123` stays `"00123"`, `TRUE` stays `"TRUE"`, `3/4/26` stays `"3/4/26"`. The three dialect extensions — a skipped BOM, skipped blank lines, a bare CR treated as a line ending — are named as extensions rather than as correctness. The preview says it is a preview and says the JSON above it is complete. "Never uploaded" appears in the banner and the footer, and the harness checks it. |

## Changes And Evidence

The implementation was already complete when this round started, so the work
was verification and the browser harness. The component was then changed in
three places by the runtime pass below — the file decode, the single-column
confidence wording, and nothing else — and the harness was corrected in four
places. The two new modules and the rest of the component changes listed at the
end are the implementation phase's, still uncommitted.

**Node mirror — 364 checks, all passing.** `node audit/check-csv-json.mjs`
reports `364 passed, 0 failed` across twelve groups: RFC 4180 lexing; anomalies
reported and never silently accepted; the preflight agreeing with the parser;
the caps; delimiter detection; keys; ragged rows; output equivalence to
`JSON.stringify`; no type coercion anywhere; the component's safety, a11y and
network behaviour; registry, copy, SEO and guide; and the shared formatter.

**Static verification of the new harness.** From the repository root:
`node --check e2e/csv-json-browser.mjs` parses; `npx tsc --noEmit` is clean;
`npx eslint e2e/csv-json-browser.mjs` is clean.

**The harness itself** (`e2e/csv-json-browser.mjs`) drives real Chrome through
`playwright-core` (`channel: "chrome"`), writes every fixture to a temp
directory as real bytes so CRLF, a bare CR and a BOM survive the disk, and
re-parses every downloaded `.json` from its own file rather than trusting the
UI. It reads the five cap constants out of `csv-parse.ts` at run time and
derives the five cap labels exactly the way `csv-format.ts` derives them, so a
future cap change makes the harness assert the new number instead of quietly
passing against a stale literal. It carries **195 named assertions in 17
sections**, plus one guard that reports a harness exception as a failure:
empty boot state (15), a plain CSV pasted in (14), no type inference (8), the
awkward RFC 4180 cases (19), ragged rows (9), duplicate header names (4),
delimiter detection including the manual override (17), the header-row toggle
(8), the quoting anomaly (7), download and re-parse (9), the clipboard (3),
degenerate inputs (8), Clear (5), the refusals each with its real numbers (21),
the honesty the copy promises across the tool page, the guide and the sitemap
(37), a 375 px viewport (2), and hygiene (7).

**What the harness deliberately checks against bytes rather than against text.**
The downloaded file is re-parsed with `JSON.parse` and compared to the on-screen
document; the opened `crlf.csv` is compared back to the textarea byte for byte,
so a normalising read would fail; the file named `plain.csv` must download as
`plain-to-json-2r-2c.json`; the 5,242,881-character paste is built inside the
page and must be refused with that exact number in the message. The honesty
assertions read the component's own root element rather than `body`, so they
cannot be satisfied by another tool's copy in the page furniture.

**Corrections made to the harness during source review.** Nine assertions were
wrong against the shipped source and were fixed rather than left to fail at run
time: the delimiter note's sample count (3 records, not 2); the tab option's
index in the select (3, not 2); the single-column line's real text
(`Delimiter: a comma (no delimiter needed)`); the data-preview assertion,
replaced with the panel's accessible name and its "holds every character of
every row" sentence; a tautological clipboard assertion, replaced with the CRLF
byte comparison; the guide's extensions sentence (case-tolerant); the plain-paste
sample count; the empty-state placeholder check; and the manual-delimiter
assertion described below.

### Defects this round's source review caught

**1. A hand-picked delimiter is reported as "no delimiter needed", and the
sentence that would say it was chosen by hand is computed and then dropped.**
`csv-format.ts:469-470` falls back to `confidence: "none"` whenever
`detection` is null — which is exactly the manual case — and computes a
`detectionNote` reading "Delimiter set to <name> by hand.", which is exactly
the disclosure the UI needs and never shows.
`csv-format.ts:448-450` then pushes only `detection.note` into `notes`, and
`CsvJson.tsx:410-417` renders `delimiterSpoken` with
`CONFIDENCE_WORD["none"]`, which is `"no delimiter needed"`
(`CsvJson.tsx:47`), and never renders `detectionNote` at all.

The effect is that overriding the delimiter to the wrong one — the single most
likely manual action — leaves the page saying the delimiter makes no difference,
and never says the choice was yours. The parse is correct and the override does
reach the parser (the file collapses to one column, which the harness asserts);
only the report is wrong. Not fixed here: this round was verification-only for
`src/features/csv-json/`. The fix is to carry a `manual` flag alongside
`confidence` and give it its own word in `CONFIDENCE_WORD`.

**2. Minor, a derivation gap rather than a wrong number.** `CsvJson.tsx:613`
re-types the row and column caps as `formatInt(20000)` and `formatInt(512)`
while `csv-format.ts:66` already derives `MAX_ROWS_LABEL` and
`MAX_COLUMNS_LABEL` and folds them into the `CAP_SUMMARY` the same component
imports at `:18`. Today both read 20,000 and 512 and the mirror pins them, but
this is the one place a cap change could leave a stale number in the dialect
paragraph.

## Tracked Residuals (accepted, disclosed)

1. **The Chrome harness has now been run.** `node e2e/csv-json-browser.mjs` ran
   against a production build served by `next@16.3.4 start -p 3801` and reported
   **195 passed, 0 failed**. The two consecutive runs behind that wording were
   re-executed on the 310-page build that carries this report, with the CSV
   source byte-identical to the wave that fixed the manual-delimiter reporting,
   and both runs reported 195/195. It expects a
   server on `http://localhost:3801` (`BASE_URL` overrides it). The 364-check
   Node mirror and the 195 browser assertions are now both executed evidence.
2. **Defects found while running the harness, and what happened to each.** Four
   were real product defects and are fixed:
   - **A BOM was silently dropped.** `file.text()` strips a leading UTF-8 BOM and
     rewrites CRLF to LF before the parser runs, so the parser's `hadBom` was
     always false and the "a UTF-8 byte order mark at the start of the input was
     skipped" disclosure could never appear for an opened file. `handleFile` now
     decodes `arrayBuffer()` with `TextDecoder(..., { ignoreBOM: true })`, so the
     mark survives to the parser, is stripped there, and is reported. The existing
     U+FFFD disclosure still covers a genuinely non-UTF-8 file, which `latin1.csv`
     now proves on screen.
   - **A single-column file claimed a delimiter had been chosen by hand.** The
     detector returns `confidence: "none"` for it, and `CONFIDENCE_WORD.none` was
     "chosen by hand" — a false account of how the delimiter was arrived at, in
     the one case where the reader can plainly see nothing was detected. It now
     reads "no delimiter needed".
   - **The delimiter summary line could not tell the two cases apart, and
     contradicted the note printed directly beneath it.** `confidence: "none"` is
     overloaded: it means *detection ran and found nothing* for a single-column
     file, and *no detection ran because the reader chose* for a manual override.
     The summary line branched on `confidence` alone, so a hand-picked comma
     rendered as "Delimiter: a comma (no delimiter needed)" directly above
     "Delimiter set to a comma by hand". `CsvJsonConverted` now carries
     `delimiterMode` from the options that produced it, and the line branches on
     that: auto mode reports the confidence, manual mode reports "set by hand".
     The mode is returned by `convertCsv` rather than read back out of the
     component's `useState`, so the result stays self-describing and the view
     cannot disagree with the parse it is rendering.
   - **`CsvJsonConverted`'s comment claimed the panel already guards this** — it
     said the panel "must not imply the file needed no delimiter at all", which
     was true of `detectionNote` and false of the summary line. The comment now
     describes why the mode travels with the result.
   Three were harness defects, fixed in the harness: the stat values were read
   with `following-sibling::dd`, which is not a valid CSS selector (the `dt`/`dd`
   pair sits inside a card, so the value is read from the parent `div`); the
   header-toggle case asserted 3 positional keys for a fixture whose widest record
   has 4 fields; and Playwright's `fill()` never resolves for the multi-thousand
   character cap cases, because it waits for the textarea to be editable again
   while a deliberate refusal re-renders the panel. Values over 4,000 characters
   are now written through the native value setter, which fires the same input
   event.

   The manual-override case is worth calling out as a testing failure rather than
   a product failure: the harness asserted only that a hand-picked delimiter was
   *not* labelled "auto-detected", which the broken line satisfied, so the
   contradiction shipped green. It now asserts the actual wording in both
   directions, and the Node mirror pins the `delimiterMode` field so the overload
   cannot be reintroduced silently.
3. **There is no Copy control for the CSV.** The textarea is the CSV — its
   contents are the bytes the user opened — and Copy and Download hand over the
   JSON. A user who wants the CSV elsewhere selects the text. Asserted as the
   shipped behaviour rather than wished into existence.
4. **No type is inferred, ever.** A numeric column comes out as JSON strings.
   This is a decision, stated in the banner, the FAQ, the guide and the limits
   paragraph, not an accident.
5. **A blank line is skipped and cannot be recovered.** In a single-column file
   an empty line is indistinguishable from a row holding one empty cell, so it
   is skipped too; the skipped count is shown.
6. **Quoting style is not preserved.** A cell that needed quotes in the source
   may not need them in the output and vice versa; the values are character for
   character, the quoting is not.
7. **No encoding sniffing.** A non-UTF-8 file is decoded as UTF-8 and its bad
   bytes become U+FFFD; the page counts those characters, says what they usually
   mean (Windows-1252 or Latin-1) and says what to do about it.
8. **One direction only.** CSV to JSON. The JSON-to-CSV direction was removed and
   the removal is disclosed in a FAQ and in the guide rather than left implied.
9. **The caps are refusals, not adjustments.** A file over any cap converts to
   nothing at all, and says which cap it broke and what it actually found. A
   partial conversion would be a different file from the one that was asked for.
10. **The preview is bounded and says so.** The table shows the first N rows and
    M columns with cells shortened to `CELL_PREVIEW_CHARS`; the JSON pane and
    the two buttons carry the whole document.
11. **The harness is Chromium-only and proves nothing about Firefox or Safari**,
    and its clipboard and download assertions depend on permissions this
    environment cannot grant. It also cannot prove anything about a browser
    without `navigator.clipboard`.
12. **The detector samples.** Delimiter confidence is computed over the first
    sampled records, not the whole file, and the note on screen says how many
    records were sampled and asks the reader to check the header above it.

Files: `src/features/csv-json/CsvJson.tsx`,
`src/features/csv-json/csv-format.ts`,
`src/features/csv-json/csv-parse.ts`, `src/lib/tool-content.ts`,
`src/lib/tools.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-csv-json.mjs`, `audit/reports/csv-json.md`,
`e2e/csv-json-browser.mjs`.