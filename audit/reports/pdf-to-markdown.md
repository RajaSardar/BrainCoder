# PDF to Markdown: Parallel Judges Audit

Date: 2026-09-25. Status: thirty-seventh tool upgraded and verified — the
second tool of the sixth audit wave. Ten judges (functional, PDF/typography
domain expert, technical architect, code reviewer, end-user UX, business,
security, a11y, SEO and performance) returned; every gap raised was closed
and verified. Focus of the round: honest text-layer extraction with a
predicted-at-read-time heading heuristic and a real reading-order model,
verified against fixtures.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Reading order is a lie until proven: `convertToViewportPoint(x, y)`'s viewport Y grows downward, so y-descending clusters reversed later rows. There was no blank-page detection ("Pages N have no selectable text" never appeared for genuinely empty pages) and no predicted-heading capability at all. Raw `err.message`. |
| Domain expert (PDf text model) | A heading is a **best-effort guess** — use a heuristic (short lines that don't end in sentence punctuation, with a word run that reads title-like) and say so in copy, never claim "semantic structure preserved". Blank detection should use the *line pitch*: a page whose majority line spacing stays consistent declares its own scale, so a blank line is `dyPrev > pitch × 1.7` — font-agnostic and rotation-proof |
| Technical architect | Share the one `extractPdfText`/reading-order pipeline with pdf-to-excel (single pdfjs parse, identical order model in both mirrors); produce `.md` and a rendering `.html` so the user sees Markdown as a rendered document; in-memory bytes, no egress. |
| Code reviewer | Escape HTML in the .html render and escape Markdown text (trailing `\` ambiguity — backslash-escape weak-characters); ordered-list numbering must survive reflow; page separator `\n---\n` only *before* a text page when there is more than one page; output named `<src>.md`; `runId` guard; `toUiError` routing. |
| End-user UX | Success state must show the extracted text (not just "done"), offer both .md and .html downloads, and honestly warn that heading/bold/italic are guesses. The blank-page note must be visible and must link to OCR. |
| Business analyst | The trust risk is over-claiming: copy previously implied "preserves structure". It must say **it does not** reproduce tables, bold/italic styling, links, images or code blocks, and treat headings/lists as best-effort. Scanned files steer to OCR; keep reciprocal links. |
| Security | PASS — no user-file egress (e2e network tracker: no outbound file traffic; only same-origin assets). No injected HTML survives: `<script>` in a PDF's text layer renders inert in the .html view (matching Node mirror). Bounded by 100 MB / 200 pages caps. |
| A11y specialist | File input gets `useId` label, `role=status` idle/load/success, `role=alert` errors, `aria-busy` root, sr-only busy text, keyboard buttons with distinct accessible names. |
| SEO/content | `TOOL_KEYWORDS["pdf-to-markdown"]` + truthful `TOOL_FEATURE_LIST` JSON-LD; CUSTOM_TITLES title "PDF to Markdown — extract PDF text into .md free"; honest feature copy (best-effort headings, no table/formatting claim); new guide `how-to-convert-pdf-to-markdown`. |
| Perf judge | One pdfjs parse; heading prediction and MD assembly are pure function-of-text; .html rendering reuses the in-browser markdown renderer already shipped for the Markdown Preview tool — no new runtime. |

## Changes And Evidence

- `src/features/pdf-to-markdown/PdfToMarkdown.tsx` (rebuilt):
  - **Reading order, now correct.** Clusters sorted **y-ascending, then
    x-ascending** to match the viewport coordinate system (the earlier
    y-descending sort silently reversed later pages — pinned by a rotated
    fixture `AAA BBB / CCC DDD` that must come back top-to-bottom).
  - **Pitch-based blank detection.** Page line pitch is median-of-deltas; a
    page whose majority spacing is consistent declares its own scale and a
    blank line is `dyPrev > pitch × 1.7` with a fallback threshold — a blank
    first page in a two-page fixture now reports "Pages 1 have no selectable
    text" and steers to OCR instead of emitting nothing.
  - **Heading heuristic.** Short lines that do not end in sentence
    punctuation and read title-like become `##` (the document title is always
    the `#` file name); lists are renumbered as ordered lists on reflow.
    Copy labels all of it "best-effort guesses".
  - **Honest output.** `\n---\n` page separators only before a *text page*
    when `pages > 1`; Markdown text escaped for ambiguous trailing characters;
    the `.html` download is an actual rendered document (`<!DOCTYPE html>`,
    `## Meeting Notes`) built from the same sanitized output — and is labelled
    "a rendering of the Markdown above", not a layout replica.
  - **Caps + team standard.** 100 MB / 200 pages enforced; `runId` guard,
    busy guard, `resetState()`, `toUiError`/`userFacing` friendly routing
    (encrypted → Unlock PDF steer, no-PDF-header → "doesn't look like a valid
    PDF"), `aria-busy` root, `role=status`/`role=alert`, `useId` label,
    `<src>.md` naming, success status shows the extracted text.
- `src/lib/tool-content.ts` (`"pdf-to-markdown"`): the "preserves structure"
  implication is gone; copy states it "does not reproduce tables, bold/italic
  styling, links, images or code blocks" and that headings and lists are
  best-effort guesses; scanned-PDF users steered to OCR.
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-to-markdown"]`, truthful
  `TOOL_FEATURE_LIST` JSON-LD, `CUSTOM_TITLES` for the tool title.
- Verification:
  - `audit/check-pdf-to-markdown.mjs` — **14/14** node checks on the shared
    mirror: reading-order pipeline returns top-to-bottom for the rotated
    fixture; `escMarkdown`/html escaping match the component; the pitch model
    detects the blank first page and reproduces text-page order; the heading
    heuristic maps short non-sentence lines to `##`; page separators appear
    only before text pages when `pages > 1`; friendly errors for not-a-PDF
    and encrypted fixtures.
  - `e2e/pdf-to-markdown-browser.mjs` — **33/33** production Chrome scenarios:
    blank-page1/text-page2 fixture ("Meeting Notes" 18pt + two paragraphs) →
    status "Pages 1 have no selectable text" + link to OCR; `.md` content is
    byte-stage predictable (`# notes`, `## Meeting Notes`, paragraphs in
    order) with the separator correct; `.html` is a real rendered document
    with the predicted `<h2>Meeting Notes</h2>`; both downloads named
    `<src>.md`/`<src>.html`; copy honesty on `/tools/pdf-to-markdown`
    (honest title, "does not reproduce tables, bold/italic styling, links,
    images or code blocks", best-effort headings, no drag-and-drop, no
    accuracy hype, **no claim of preserved tables/formatting**); the
    FAQ-question phrasing "Does it preserve tables…?" is allowed because its
    answer is "No"; guide 200; sitemap lists tool + guide; zero hydration/
    page errors.
  - Build: clean tsc + eslint; production build passed (**298 pages**, 32
    guides).
- Tracked residual (accepted): extraction follows the PDF *text layer*;
  headings, lists and formatting are predictions, disclosed as such; tables,
  bold/italic, images and code blocks are not reproduced (disclosed); scanned
  files steer to OCR.

Files: `src/features/pdf-to-markdown/PdfToMarkdown.tsx`,
`src/lib/tool-content.ts`, `src/lib/seo.ts`,
`audit/check-pdf-to-markdown.mjs`, `e2e/pdf-to-markdown-browser.mjs`.