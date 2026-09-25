# PDF to Excel: Parallel Judges Audit

Date: 2026-09-25. Status: thirty-sixth tool upgraded and verified — the
first tool of the sixth audit wave. Ten judges (functional, PDF/encoding
domain expert, technical architect, code reviewer, end-user UX, business,
security, a11y, SEO and performance) returned; every gap raised was closed
and verified. Focus of the round: honest spreadsheet conversion with
real reading-order handling and proven no-egress handling of the extracted
rows.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The first real table-extraction bugs were found by the fixture, not by reading: pdf.js synthesizes **whitespace-only `" "` items** whose width equals the inter-word/column gap, so column-boundary splits never fired and cells merged diagonally; viewport Y grows **downward**, so the previous y-descending sort reversed row order on later pages. No caps; `err.message` raw; no reset. |
| Domain expert (PDF rm / cell model) | Split must happen on *real* word-x gaps after dropping phantom space items; empty cells must be preserved so a 3-row grid still has 10 columns; joined runs must become the cell text; `=SUM(A1)` lives on in Excel *if* exported as a formula — that is a lie to promise and a hazard to deliver raw, so it ships as **inline text** ("cells are exported as text, not formulas") |
| Technical architect | Shared, single parse via the `extractPdfText`/`extractGrids` reading-order path (one pdfjs dependency, re-used by pdf-to-markdown); no second library for the xlsx — the XML containers are built by hand and zipped with the in-repo fflate; every tab will export identically from one row model. In-memory bytes end-to-end, no egress. |
| Code reviewer | Escape the CSV (cells starting `=`, `+`, `-`, `-`, `@` are apostrophe-prefixed), escape XML text runs in the xlsx (`&<>"'`), write the literal `t="inlineStr"` cells with a correct `dimension` ref so Excel/Sheets open it without repair prompts; output named `<src>.xlsx` / `<src>.csv`; a `runId` guard so a second file can't race the first pipeline. |
| End-user UX | Don't promise "perfect formatting" or "100% accuracy". Success must state the honest outcome ("Extracted 5 text rows (10 cells) — cells are exported as text"), and the FAQ must disclose merged cells/spanning rows are not reproduced. Reset state on new file; results must re-copy clearly. |
| Business analyst | The trust risk is over-claiming "tables are converted exactly". Copy must say best-effort text extraction into spreadsheets, disclose merged cells, and point users with scanned/Pot PDFs to OCR. Keep the reciprocal links (Excel → Markdown, and to OCR). |
| Security | PASS — no file-content egress (e2e network tracker saw no outbound user-file requests; only same-origin app, worker and pdfjs assets). CSV/formula-injection neutralization verified byte-level in node + browser. Bounded by 100 MB / 200 pages caps. |
| A11y specialist | `useId` label for the file input, fieldset/legend for the chosen format (.xlsx/.csv), `role=status` idle/load/success, `role=alert` errors, `aria-busy` root during processing, sr-only busy text, keyboard-reachable download buttons with distinct accessible names. |
| SEO/content | `TOOL_KEYWORDS["pdf-to-excel"]` and a truthful `TOOL_FEATURE_LIST` JSON-LD; CUSTOM_TITLES so `<title>` is "PDF to Excel online — free spreadsheet converter" (not the Convert-category "…conversion" suffix); honest features ("Extracts tables from PDFs into spreadsheets", no accuracy hype, no drag-and-drop promise); new guide `how-to-extract-data-from-pdf-in-excel`. |
| Perf judge | One pdfjs parse total for both exports; the xlsx path is builder-only (~ms) after rows are extracted; no double buffering on download (shared `downloadBlob` no longer clones). |

## Changes And Evidence

- `src/features/pdf-to-excel/PdfToExcel.tsx` (rebuilt):
  - **Two real fixture-found bugs fixed.** pdf.js injects zero-width-meaningless
    `" "` items whose width mirrors the column gap; the splitter now drops
    `!item.str.trim()` items before clustering, so gap-derived column
    boundaries actually fire (a `=SUM(A1)` cell lands alone in `B2` instead of
    joining the row). And `convertToViewportPoint(x, y)` returns viewport-y
    **increasing downward**, so rows are sorted y-ascending then x-ascending —
    the previous descending sort silently reversed later pages.
  - **Row model → both formats.** Empty cells preserved (a 3×3 grid keeps 10
    columns), per-cell text exported identically to .xlsx and .csv; inter-page
    blank row so multi-page files round-trip at the page boundary.
  - **Honest formula handling.** A leading `=` cell is apostrophe-neutralized
    in CSV and written as `inlineStr` text in the xlsx (never a live formula —
    copy and FAQ say "cells are exported as text").
  - **Caps + team standard.** 100 MB / 200 pages enforced with friendly
    guidance; `runId` guard over every await (parse, build, downloads),
    busy guard, `resetState()` on error, friendly `friendlyError`/`userFacing`
    routing (`toUiError` returns tagged engine messages verbatim, otherwise
    maps encrypted → "already password-protected — remove it with Unlock PDF",
    no-PDF-header → "doesn't look like a valid PDF"); `aria-busy` root,
    `role=status` idle/load/success and `role=alert` errors, `useId` labels,
    format fieldset, `<src>.xlsx` / `<src>.csv` naming, success status states
    the honest outcome.
- `src/lib/tool-content.ts` (`"pdf-to-excel"`): no accuracy hype, no
  drag-and-drop promise, no "perfect formatting". Long description, features,
  how-to and FAQ now state best-effort table-to-spreadsheet conversion,
  "Merged cells and spanning rows are not reproduced", and the formula
  disclosure above; scanned-PDF users steered to OCR.
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-to-excel"]`, truthful
  `TOOL_FEATURE_LIST` JSON-LD, `CUSTOM_TITLES` entry for the tool title.
- Verification:
  - `audit/check-pdf-to-excel.mjs` — **24/24** node checks on mirror
    implementations: `escapeCsv` neutralizes `=`/`+`/`-`/`@` prefixes and
    quotes/commas/newlines; xlsx XML escapes `&<>"'`, cells written
    `t="inlineStr"` with `c` refs (`B2`), `dimension` = `A1:E10`; the zip
    inflates via fflate and the `workbook.xml`/`sharedStrings.xml` re-parse;
    `extractGrids` skips ws-only items (grid fixture Alpha/Beta/Stripe keeps
    3 rows, 3 cols) and sorts y-asc-ending across a two-page fixture;
    inter-page blank row preserved; not-a-PDF and encrypted fixtures produce
    friendly errors.
  - `e2e/pdf-to-excel-browser.mjs` — **41/41** production Chrome scenarios,
    incl. the two fixture-found bugs as regression pins: freeze-frame of a
    2-page grid fixture (Alpha/Beta/Stripe + a 1-row second page) → status
    "5 text rows (10 cells)", row order top-to-bottom, `B2` = `=SUM(A1)` as
    cell text; the downloaded .xlsx unzips (fflate) and cell `B2` is
    `t="inlineStr"` text (so Excel can't re-evaluate it); the CSV carries a
    UTF-8 BOM and the formula cell ships as `'=SUM(A1)`; blank page → OCR
    steer; encrypted → password message + Unlock link; not-a-PDF; >100 MB;
    copy honesty (title, no drag-drop, no accuracy numbers, "cells are
    exported as text", merged-cells disclosure); guide 200; sitemap lists
    tool + guide; zero hydration/page errors.
  - Build: clean tsc + eslint; production build passed (**298 pages**, 32
    guides).
- Tracked residual (accepted): extraction follows the PDF *text layer* —
  visual table shapes that are not text runs are merged/dropped and this is
  disclosed ("Merged cells and spanning rows are not reproduced"); scanned
  files steer to OCR.

Files: `src/features/pdf-to-excel/PdfToExcel.tsx`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`,
`audit/check-pdf-to-excel.mjs`, `e2e/pdf-to-excel-browser.mjs`.