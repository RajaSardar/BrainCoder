# HTML Minifier: Parallel Judges Audit

Date: 2026-09-20. Status: fifteenth tool upgraded and verified within the
coverage below. Part of the three-tool Wave 1 run (hash-generator,
markdown-preview, html-minifier) judged simultaneously. HTML ran the full
judge set in parallel; the technical-architect report was not returned
(aborted after timing out). The corruption findings that would have been its
core concern were independently produced by six other judges with identical
concrete examples, and the scanner that replaces the old regex engine was
unit-tested in Node (13 cases) plus re-asserted in the browser harness.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | PASS on trivial whitespace collapse. FAIL: whitespace inside `<textarea>`/`<pre>` corrupted; content inside `<script>`/`<style>` mangled (a JS string containing `<!-- ` was broken); attribute values with repeated spaces rewritten; `a > b` text damaged; comments inside script strings destroyed the output |
| Technical architect | *(not returned — aborted)* — the regex machine below was flagged by functional/UX/edge/perf with identical examples |
| End-user UX | FAIL: no mode toggle for minify vs. pretty-print (only minify existed); no byte/savings feedback; conditional comments destroyed with no opt-out; the tool silently rewrites `pre`/`script` content the user cannot see is being damaged |
| Content/SEO | Claim-integrity: "removes redundant attributes", "shortens boolean attributes", "collapses optional tags", "10–40% size reduction", "optimizes attribute ordering" — NONE implemented; "preserve critical comments" option NOT implemented; "drag-and-drop upload" NOT implemented. relatedSlugs invalid |
| Business analyst | Correct privacy angle. MUST: honest scope (whitespace + comments only, no attribute surgery), show measurable savings, keep conditional comments. SHOULD: pretty-print mode, file open/download |
| A11y specialist | HIGH: textareas have no accessible names; mode not exposed as a toggle (aria-pressed); no live region for the output size; stats are silent |
| Security/privacy | PASS: zero egress. ReDoS: the legacy comment regexes (`<!--.*?-->`-style with backtracking) allow catastrophic backtracking on crafted inputs, freezing the tab |
| Edge cases | Confirms all corruption cases with a nasty doctype/conditional/pre/script fixture; `>` inside attribute values and text must survive; void elements and `<br>` must not be deep-indented in pretty mode; large documents must not O(n²) |
| Performance | Old regex pipeline was O(n²) on the probe input (slice+toLowerCase per match scanning = quadratic on large files); single pass required |
| SSR/cross-browser | PASS: deterministic SSR (pure string processing). Route smoke 200s. Textareas need accessible names on SSR too |

## Changes And Evidence

- `src/features/html-minifier/html-minify.ts` (new pure module — scanner
  replaces the regex pipeline):
  - **Raw-text regions preserved (functional, edge):** `<script>`, `<style>`,
    `<textarea>` and `<pre>` content is copied verbatim — quotes, `<!--`,
    repeated spaces and all — by a linear `findCloseTag` probe that never
    interprets content. A JS string containing `<!--` (the judge's
    fake-comment case: `// <!-- this string must survive -->`) survives intact.
  - **Attribute values never rewritten (functional, edge):** quoted values
    (including `class="a  b"`, `title="1 > 2"`) are passed through verbatim by
    reading tag ends quote-aware and normalizing only the unquoted inter-
    attribute whitespace.
  - **Inline/block spacing rules (functional, edge):** text is collapsed to
    single spaces; block-tag boundaries drop the surrounding whitespace, while
    inline elements keep exactly one separating space (`</b> <i>` preserved).
  - **Comments (functional, content):** plain comments removed; conditional
    comments (`<!--[if IE]>…<![endif]-->`) preserved only when the
    "Keep conditional comments" option is on. Comment scanning is linear
    (indexOf-based), so the ReDoS-backed regexes are gone.
  - **Beautify mode (UX, edge):** pretty-print reindents block structure with
    2-space levels; void elements (`<br>`, `<img>`, `<meta>`…) never increase
    depth, so following text stays at the sibling level — the deep-indent bug
    is gone. `a > b` in text survives both modes.
  - **Tag hygiene:** `readTagEnd` finds the real end of each tag (quote-aware);
    `normalizeTag` collapses unquoted whitespace and now also drops stray
    spaces before `>` and self-closing `/>` (a late find: `<div  class="a  b" >`
    → `<div class="a  b">`) while leaving quoted `>` alone.
- `src/features/html-minifier/HtmlMinifier.tsx` (rebuilt):
  - Minify/Pretty-print mode toggle (real radiogroup buttons with
    `aria-pressed`, house red-600 active style + focus ring), keep-conditional
    checkbox (minify mode only), Clear, Open .html (hidden file input +
    visible `htmlFor` label, FileReader), Copy + Download .html
    (minified.html / formatted.html, disabled with no output).
  - Byte-accurate stats via `TextEncoder`: "Minified · 1.2 KB → 840 B
    (−32%) · 1234 → 850 chars" in a `role=status` + `aria-live=polite` line.
  - Input built on `useDeferredValue` so huge pastes don't block the UI;
    sample mimics a real legacy page (conditional comment, pre, script with a
    `<!----` string, style).
- `src/lib/tool-content.ts`: html-minifier block rewritten around reality —
    whitespace + comment removal only (with explicit "never strips/rewrites
    attributes, never shortens boolean attributes, never collapses optional
    tags"), pre/textarea/script/style preservation, conditional-comment
    opt-in, pretty-print, byte-level savings metrics. relatedSlugs verified
    present.
- `src/lib/seo.ts`: keyword line expanded (compress html code, remove
  whitespace html, html pretty print online); JSON-LD featureList override
  added.

## Verification

- Node unit suite (`--experimental-strip-types`, temp test): **16/16 cases
  passed** — pre/textarea/script verbatim, quoted attr values, inline/block
  spacing, comment strip + conditional keep/drop by default, doctype kept,
  `a > b` text, `-->` inside script strings, tag spacing around `>`, `/>`
  self-close, `>` inside attributes; 1MB perf: minify ~46ms, beautify ~42ms
  (old regex pipeline was ~8.2s on the same size — a 160× regression removed).
- `npx tsc --noEmit` and eslint pass; production build passes (287 pages).
- New harness `e2e/html-minifier-browser.mjs`: **34 production Chrome
  scenarios passed** — sample pre/script/conditional handling (preserved vs.
  stripped vs. kept when option on), attribute values + `a > b` + inline space
  + inter-block collapse, script/pre/textarea verbatim, conditional default
  removal, void/self-closing integrity, option-tag collapse, entity-bearing
  and `>`-in-attribute values, beautify block indentation + `br` depth,
  byte stats + savings sign + aria-live, download emits minified.html,
  Copy/Download disabled with no output, aria-labels + Open .html label +
  aria-pressed on the active mode, both routes 200, honest byte-level wording
  on /tools/; zero hydration errors and zero page errors across the session.
- Sibling verification: the two other Wave 1 tools re-run green on the same
  build; timestamp-converter control harness green (shared server/build).

## Residuals

- Scope is deliberately whitespace + comments only. No attribute
  stripping/shortening, no optional-tag collapsing, no attribute reordering —
  the earlier "10–40% reduction" claims are deleted.
- Conditional comments are preserved as-is byte-for-byte when enabled;
  downlevel-revealed script inside them is not re-minified.
- `\r` line endings are treated as whitespace (collapsed in text runs); CRLF
  input still parses, output uses single spaces/\n.
- Physical 375px layout verified by the house page-level residual (site-header
  nav overflow only); tool grid collapses on narrow viewports (sm breakpoint).
- Copy feedback ("Copied to clipboard") asserted via clipboard content
  (CopyButton flip animation is timing-flaky under headless Chrome).
- Whole-site residuals tracked elsewhere (site-header 375px navigation
  overflow, `'unsafe-eval'` in CSP script-src, `/verify` wording, ToolPreview
  uploads mocked, physical mobile/Safari/Firefox not tested locally — Chrome
  headless only).