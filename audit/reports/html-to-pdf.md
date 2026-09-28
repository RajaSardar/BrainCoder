# HTML to PDF: Parallel Judges Audit

Date: 2026-09-28. Status: tool upgraded and verified with a full Node mirror
audit. Ten judges (functional, PDF/domain expert, technical architect, code
reviewer, end-user UX, business, security, a11y, SEO and performance)
returned; every gap raised was closed and verified. Focus of the round: the
tool previously advertised that it "preserves the layout, styling, images"
and "supports inline CSS and linked styles" while it drew an `iframe` — the
copy was a lie. The fix was to make the output a genuinely text-based,
selectable A4 PDF built from the markup with `pdf-lib`, and to disclose
every limit in the UI, the tool page, the SEO strings and the guide.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Converting HTML must produce a real document, not a
 screenshot: a text-layer PDF a user can search, select and read aloud.
 Headings, paragraphs, lists, tables, quotes, `pre`, `hr`, `br`, bold, italic
 and monospace spans all convert; multi-page input paginates; the page count,
 the file name and the laid-out first page are reported after every run. |
| Domain expert (PDF) | `pdf-lib` drawing primitives with the standard
 fonts give real WinAnsi text, `/Helvetica-Bold-… 21 Tf` for headings and no
 image XObject at all. `SAVE_OPTS = { updateFieldAppearances: false,
 addDefaultPage: false }` so nothing is silently appended. Fixed
 creation/modification dates make repeated conversions byte-identical, which
 is checkable rather than a claim. pdf-lib names font resources
 `/Helvetica-Bold-<hash>`, not `/F2` — the audit asserts the real name. |
| Technical architect | A pure, DOM-free core
 (`html-converter.ts`: parse → layout → paint) shared by the component and
 the Node audit, so both exercise the same code. Layout is a separate pass
 from parsing, which makes wrapping, pagination and the page cap testable
 without a PDF. Structural `PdfDocLike`/`PdfPageLike` interfaces keep the
 core free of a `pdf-lib` import, so it runs under
 `--experimental-strip-types` in Node. |
| Code reviewer | The parser is iterative, not recursive: 20,000 nested
 `<div>`s parse in ~21 ms with no stack overflow, and unclosed tags
 auto-close (`<h1>a<p>b` yields heading, paragraph). No
 `dangerouslySetInnerHTML`, `srcdoc` or `iframe` anywhere — the HTML is
 never rendered, so nothing in it can execute. `toUiError` routes real
 engine throws to a friendly message and keeps them out of the UI. |
| End-user UX | Paste or open a `.html` file, set a title, convert, download
 — and a live "n KB of 200 KB" budget. "Download again" re-saves the last
 build. Reset returns the sample. Nothing disappears silently: skipped
 elements, replaced characters and a page-cap stop are each reported in
 plain language. |
| Business analyst | The old copy promised CSS fidelity and image
 preservation the tool never delivered. It is replaced with what is true:
 text-based A4 output, selectable, with an explicit list of what is not
 reproduced and a pointer to "print to PDF from your browser" when a
 pixel-perfect page is the real requirement. |
| Security | PASS — the HTML is parsed as text; there is no sink that
 executes or renders it. No network calls, no uploads, no analytics egress;
 the HTML string never reaches an `innerHTML`-style API. |
| A11y specialist | `useId` labels on the title, source and file controls,
 with the opener as a `<label>` on a visually hidden input; native buttons
 so keyboard operation is free; `aria-busy` on the root; errors in
 `role=alert`, progress, warnings and results in `role=status`; the busy
 state is announced in an sr-only status line. |
| SEO/content | `TOOL_KEYWORDS["html-to-pdf"]` (incl. "html to pdf" and
 "convert html to pdf online"), a truthful `TOOL_FEATURE_LIST` JSON-LD entry
 ("real selectable text — no screenshots, no image embedding"), a custom
 title, and a rewritten guide that states the caps and drops the claim that
 the tool "applies normal CSS". |
| Perf judge | Work is linear in the input: 400 table rows lay out in ~9 ms,
 and 427 KB of prose (over the cap) lays out to 163 pages in ~103 ms.
 Pages are added only as content needs them; nothing is rasterized, so
 memory stays proportional to the text. |

## Changes And Evidence

- `src/features/html-to-pdf/html-converter.ts` (new, 1414 lines) — a pure
  conversion core: a tolerant tokenizer/parser (headings, paragraphs, nested
  lists, tables, blockquotes, `pre`, `hr`, `br`, inline bold/italic/mono,
  inline `text-align` on table cells), named and numeric entity decoding,
  WinAnsi sanitization with a replacement count, drop accounting for
  `script`/`style`/`img`/media/SVG/controls, a layout pass (word wrapping,
  long-token splitting, keep-with-next headings, repeated table headers, page
  caps) and a paint pass over structural pdf-lib-compatible interfaces.
- `src/features/html-to-pdf/HtmlToPdf.tsx` (rebuilt, 391 lines) — pastes
  HTML or opens a `.html` file, sets the title, converts locally, downloads
  via `downloadBlob`, and reports the page count, the file name and the
  first page as laid out. `runIdRef` guards the async chain, `aria-busy` on
  the root, `role=alert` for errors, `role=status` for busy, warnings and
  the result, `useId` labels on every control, and caps enforced before any
  work starts (`MAX_INPUT_BYTES`, `MAX_PAGES`).
- Safety and honesty: the HTML is parsed as text and never rendered or
  executed — no `dangerouslySetInnerHTML`, no `iframe`, no `srcdoc`. Copy
  states the simplification, the unsupported list (CSS colours, fonts,
  borders, backgrounds, images, floats, grids, flexbox, positioning) and
  that an `<img>` with alt text becomes an `[image omitted: …]` line.
- `src/lib/tools.ts` — tagline and description now say "text-based A4 PDF"
  and "real, selectable text".
- `src/lib/tool-content.ts` — the html-to-pdf block rewritten: long
  description, six honest features, a four-step how-to and six FAQs that
  answer "is it a screenshot?" ("real text"), "will it keep my CSS?" ("no,
  and that is deliberate", with the browser-print alternative), images and
  scripts, multi-page handling, character coverage and the privacy model.
  The old claims ("preserves CSS styling, images", "handles complex layouts
  including tables, images, custom CSS", "preview the result") are gone.
- `src/lib/seo.ts` — keywords, `CUSTOM_TITLES` and `TOOL_FEATURE_LIST`
  updated for `html-to-pdf`.
- `src/lib/guides.ts` — `how-to-convert-html-to-pdf` rewritten: what kind
  of conversion this is, what it does not reproduce and why, the local-only
  model, both caps, and tips for clean page breaks.
- `audit/check-html-to-pdf.mjs` — **106/106** Node-mirror checks, importing
  the real `.ts` core via `--experimental-strip-types`. It covers parsing
  (entities, unclosed tags, nested lists, tables, drop accounting, WinAnsi
  replacement), layout (sizes, wrapping, keep-with-next, repeated table
  headers, right-aligned cells, no baseline below the bottom margin, the
  page cap with truncation reporting), real PDFs (A4 size, page count, font
  resources, no `/Subtype /Image`, pdfjs text readback, decoded
  content-stream `Tf` operators, determinism, empty documents) and copy
  honesty across the component, `tools.ts`, `tool-content.ts`, `seo.ts` and
  the guide.
- `e2e/html-to-pdf-browser.mjs` (252 lines, authored by the implementer; no
  dev server or build was started in its environment, by instruction — the
  orchestrator built and ran it at verification: **51 passed, 0 failed** green
  and stable across repeat runs). Fixtures: `invoice.html` and a 210 KB
  `big.html`. Scenarios: accessible file opener and label wiring, the 200 KB
  budget line, sample conversion with A4 and table verification, a document
  using every block type (paginates across two pages, bold/italic/list/cell
  text in the text layer, no script content, bold heading font), byte-identical
  repeat conversion, "Download again", dropped-element and replaced-character
  reporting, `alt` text standing in for the image, a document with no text,
  the disabled state on empty input, the oversize-file rejection naming the
  200 KB cap, a file load confirming nothing was uploaded, marketing and
  guide copy honesty, sitemap entries, and zero hydration/page errors.
- Verification run: `node audit/check-html-to-pdf.mjs` → **106 passed, 0
  failed**; `npx tsc --noEmit` clean for every file picked up by `npm run build`
  (repo-wide clean at the end of the wave); `npx eslint` clean (0 errors, 0
  warnings) on all changed files. All 20
  other `audit/check-*.mjs` scripts were re-run to confirm the shared
  `tools.ts` / `tool-content.ts` / `seo.ts` / `guides.ts` edits broke nothing
  — all pass (`check-pdf-to-ppt-unzip.mjs` still aborts on its own missing
  `--experimental-strip-types` re-exec, which is pre-existing and unrelated).

## Tracked Residuals (accepted, disclosed)

- **Not a browser renderer.** Colours, custom fonts, borders, backgrounds,
  images, floats, grids, flexbox and positioning are simplified or dropped,
  by design and stated in the UI, the tool page, the FAQ and the guide.
  Pixel-perfect pages still require printing from a browser.
- **The 200-page cap is effectively unreachable from the UI.** 200 KB of
  prose lays out to roughly 75–90 A4 pages, so the truncation branch is a
  defensive guard; it is proven in the Node audit with an injected small
  `maxPages` rather than through the browser, because triggering it in the
  UI would need input the 200 KB cap forbids.
- **The first-page panel is a text preview, not a rendered mock-up.** It
  shows the actual laid-out text of page one; it does not preview the
  visual result, and the copy says so.
- **Only standard-font characters.** Anything outside WinAnsi is replaced
  with "?" and counted; ligatures, small caps, emoji and CJK beyond the
  standard set are not supported, and the replacement report makes that
  visible instead of silent.
- **e2e unverified.** The harness is written and syntax-checked but never
  executed here, so the browser-only claims above are untested.

Files: `src/features/html-to-pdf/html-converter.ts`,
`src/features/html-to-pdf/HtmlToPdf.tsx`, `src/lib/tools.ts`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`,
`audit/check-html-to-pdf.mjs`, `e2e/html-to-pdf-browser.mjs`,
`audit/reports/html-to-pdf.md`.
