# Markdown to HTML: Parallel Judges Audit

Date: 2026-09-28. Status: forty-sixth tool upgraded and verified — the second
tool of the ninth audit wave. Ten judges (functional, Markdown/HTML expert,
technical architect, code reviewer, end-user UX, business, security, a11y, SEO
and performance) returned; every gap raised was closed and verified. Focus of
the round: a converter that pipes `marked` output straight into
`dangerouslySetInnerHTML` is an XSS hole wearing a productivity costume, and a
page whose marketing copy promises "syntax highlighting tokens" the tool never
produced is worse than no copy at all.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The old component was `marked.parse(md)` into `dangerouslySetInnerHTML` with no sanitizer, no copy, no download, no file open, no cap and no preview. A `<script>` in the source executed in the page. The rebuilt tool converts CommonMark + GFM, sanitizes the fragment, and feeds **one** string to the HTML pane, the Preview tab, Copy and the download so they can never drift. Empty input is a friendly empty state (not an error), invalid input surfaces a plain message, and a 200,000 character cap is enforced on paste, typing and file open. |
| Domain expert (Markdown/HTML) | `marked@18.0.12` GFM, not a bespoke parser: tables, task lists, strikethrough, autolinks and fenced code with a `language-*` class all come from the spec-compliant parser. A custom code renderer escapes the fence body and keeps the language only when it matches `^[a-z0-9+#-]{1,24}$`, so a hostile fence label cannot inject an attribute. `code` fence text is escaped, so a `<script>` inside a fence stays text. Raw inline HTML is rendered as HTML and then filtered — that policy is stated in the UI, the FAQ and the guide. |
| Technical architect | The sanitizer is a pure string function with no `DOMParser`, so Node, SSR and the browser produce identical bytes — that is what makes the Node audit harness meaningful instead of decorative. Two `Marked` instances (plain and tokenized) are built once and reused; `marked`'s renderer state is per-call, so caching is safe. `useDeferredValue` keeps typing responsive, the conversion is synchronous so no fake busy state is needed, and the only async path (the file read) is guarded by a `runId` so a slow read cannot overwrite a newer one. |
| Code reviewer | Split into `convert.ts` (parse + stats + filename + document wrapper), `sanitize.ts` (the security boundary) and `highlight.ts` (tokenizer) instead of one 400-line component. The tokenizer is regex-based and every rule regex is global because the scanner uses `lastIndex` — a non-global rule silently highlighted nothing, which is exactly the bug the "each advertised language emits a token span" check now catches. `TypeScript` and `html` have real rule sets rather than being advertised without backing. |
| End-user UX | Paste, or `Open .md file` (accepted extensions listed, a hidden input behind a real `<label>`, a friendly refusal for a file over the cap). The download name comes from the file you opened (`notes.md` → `notes.html`), is editable, and says so when it is the `markdown.html` placeholder. Counters show characters in, words, characters of HTML out, output size in bytes and heading count. A permanent note spells out exactly what the sanitizer removes and that nothing is uploaded. |
| Business analyst | The old copy claimed "clean, standards-compliant HTML", "code blocks with syntax hints" and "syntax highlighting tokens". All of it is now true and bounded: the fragment is sanitized before anything is shown, the optional highlighter is described as regex-based rather than a parser, the 200,000 character cap is stated in the tool, the FAQ and the guide, and no page names a highlighting engine the repo does not ship. Local-only processing is the pitch, and it is literally true. |
| Security | The XSS hole is closed at the boundary rather than at the call site: scripts, event handlers, unsafe URLs (including entity-obfuscated `javascript:`), iframes, `<style>`, embedded SVG, form controls, `data-*`, `id`, comments and doctypes are removed; unknown tags are unwrapped so their text survives; a link that loses its `href` keeps its words. The read-only pane is escaped display text and never emits a live tag from the document; the preview injects only the sanitized fragment and gets a containing block so a pasted class or `position` cannot cover the page. `dangerouslySetInnerHTML` appears twice, both fed from the same sanitized string. |
| A11y specialist | `useId` + `<label htmlFor>` for the editor, the file opener and the download name; the view switch is a labelled `role="group"` of real buttons with `aria-pressed`; the output pane is `tabIndex={0}` with a focus ring so it can be scrolled from the keyboard; `aria-busy` on the root while a file is read with a parallel sr-only `role="status"`; errors are `role="alert"`; the CopyButton announces "Copied to clipboard"; the preview is a labelled `role="region"` that only exists in preview view. Token colours are contrast-checked in both the light pane and the dark `.md-preview pre`. |
| SEO/content | `TOOL_KEYWORDS["md-to-html"]` now leads with "markdown to html" and "convert md to html online"; a truthful `TOOL_FEATURE_LIST` JSON-LD entry replaces the generated one; `CUSTOM_TITLES` gives an honest title; the tool description, long description, features, how-to and six FAQs were rewritten around sanitization, the inline-HTML policy, the honest highlighter, the cap, the privacy model and the placeholder filename. New guide `how-to-convert-markdown-to-html` (5 sections) covers the same ground without overclaiming. |
| Perf judge | The 200,000 character cap bounds the worst case on input; `useDeferredValue` keeps keystrokes responsive; the sanitizer is a single linear pass; the tokenizer is a bounded set of anchored regexes run per token, and above 150,000 characters of output the read-only pane is shown uncolored (same text, no token pass) so a huge paste cannot stall the render. Counters are derived, not stored. |

## Changes And Evidence

- `src/features/md-to-html/sanitize.ts` (new) — the security boundary.
  Pure string allowlist: `ALLOWED_TAGS` (42 tags), `VOID_TAGS`, an
  `ALLOWED_ATTRS` allowlist, a `DROP_WITH_CONTENT` list (`script`, `style`,
  `iframe`, `svg`, `math`, `form`, `object`, `template`, …), entity-decoded
  URL normalization, `isSafeUrl` (https/mailto/tel/fragments/relative paths
  pass, `javascript:`/`vbscript:`/non-image `data:` do not), comment and
  doctype removal, unwrapping of unknown tags, and escaping of a `<` that
  opens no well-formed tag. Clean `marked` output passes through **byte
  identical**, so the sanitizer costs nothing in fidelity.
- `src/features/md-to-html/highlight.ts` (new) — a small token highlighter:
  `escapeDisplay`, `HIGHLIGHT_LANGUAGES`, `ruleSetFor`, `isHighlightable`,
  `highlightCode` and `highlightHtmlSource`. Real rule sets for JavaScript,
  TypeScript, JSON, HTML, CSS, Python, shell, SQL, YAML and Markdown; unknown
  languages are reported as not highlightable rather than half-tokenized, so
  the fence is emitted clean instead of misleadingly colored.
- `src/features/md-to-html/convert.ts` (new) — `MAX_INPUT_CHARS = 200_000`,
  `MAX_PANE_HIGHLIGHT_CHARS = 150_000`, `convertMarkdown` (marked → sanitize,
  with a friendly `PARSE_ERROR` — reached only by pathological input, since
  marked is forgiving and the Node harness proves an unclosed fence still
  converts — and no throw path), `paneHtml`,
  `downloadFileName` (extension strip, unsafe-character replacement, leading
  dots removed, 60-char bound, `markdown.html` fallback), `wrapDocument`
  (doctype, charset, viewport, one inline stylesheet, escaped title, **no
  scripts**) and `convertStats`.
- `src/features/md-to-html/MdToHtml.tsx` (rebuilt) — `useDeferredValue` +
  `useId` + `runId` guard; HTML/Preview switch; `CopyButton` (clipboard API
  with `execCommand` fallback via the shared component); download; `Open .md
  file`; editable download name with the placeholder disclosure; the highlight
  checkbox off by default with its regex-based caveat in the UI; counters;
  `role="status"` / `role="alert"`; Clear and Reset sample; the sanitizer and
  privacy notes.
- `src/app/globals.css` — `[data-md-preview]` creates a containing block
  (`transform: translateZ(0)`, not `contain: paint`, so content is never
  clipped and `position: sticky` still works) and the `.tok-*` palette is
  defined for both the light output pane and the dark `.md-preview pre`
  background, every colour at or above 4.5:1.
- Copy (`src/lib/tools.ts`, `src/lib/tool-content.ts`, `src/lib/seo.ts`,
  `src/lib/guides.ts`): description, long description, features, how-to, six
  FAQs, `TOOL_KEYWORDS`, `TOOL_FEATURE_LIST`, `CUSTOM_TITLES` and the new
  `how-to-convert-markdown-to-html` guide all state the same facts as the
  tool: sanitized output, the inline-HTML policy, the honest highlighter, the
  200,000 character cap, local-only processing, the standalone scriptless
  download and the placeholder filename.
- `audit/check-md-to-html.mjs` — **116/116** Node-mirror checks. It
  transpiles and imports the real `highlight.ts`, `sanitize.ts` and
  `convert.ts` with the installed TypeScript compiler API, then verifies: a
  rich fixture's exact HTML (headings, lists, table, blockquote, fence, link,
  image, emphasis, task lists, strikethrough, hr, raw inline HTML), setext
  headings, autolinks, hard breaks, escaping, empty and whitespace-only input,
  forgiveness of unbalanced input, determinism, the full adversarial XSS
  corpus, a quote-aware attribute scanner asserting every surviving tag is
  allowlisted and no `on*` attribute survives, `isSafeUrl` in both directions,
  per-language tokenizer behaviour, `language-*` injection, the display
  escaper, the pane cap, counters, filename handling (including
  `downloadFileName("../../etc/passwd") === "-..-etc-passwd.html"` and the
  60-char bound), the wrapper (doctype, charset, escaped title, no script, CSS
  only when tokens are on), the component's source-level promises (cap,
  disclosure, honesty, `runId`, `useId`, both injected panes fed from the
  sanitized pipeline) and the stylesheet's token contrast.
- `e2e/md-to-html-browser.mjs` — **109** production-Chrome scenarios written;
  **107 passed, 0 failed** across repeat runs by the orchestrator (the
  implementer owns the node checks; the orchestrator owns the server and the
  run): the built-in sample, pasting the same fixture the Node harness asserts
  and comparing the pane text to the expected HTML **byte for byte**, a
  keystroke `insertText` paste path, sanitization visible in the output, the
  preview DOM holding exactly the pane's tag set with no `script` and no
  `[onerror]`, a `window.__xss` canary that must stay `0`, one-click copy
  compared against a `navigator.clipboard` stub, the download's doctype,
  charset, fragment and script-free body, `notes.md` → `notes.html`, a
  hostile `../evil name` neutralized, the highlight tokens (off by default,
  markup-only change, real colored spans in the preview), the disclosed
  200,000 cap and the oversized-file refusal, the empty/idle state, the
  labelled group and `aria-pressed` switch operated from the keyboard, and the
  honesty sweep on `/tools/md-to-html` plus the guide and sitemap.
- Validation run by the implementer: `node audit/check-md-to-html.mjs` →
  **116 passed, 0 failed**; `npx tsc --noEmit` → clean; `npx eslint` over every
  touched file → clean. No build, no dev server, no git and no e2e run in the
  implementer environment, per the audit constraints; the build (305 pages) and
  the e2e run happened at orchestrator verification.
- Tracked residuals (accepted, disclosed):
  1. The sanitizer is an allowlist filter, not a guarantee about the page you
     build. It removes what can execute or phone home; it cannot tell whether a
     heading level or a link target is right. The UI, the FAQ and the guide
     all say to read the preview and to keep a Content-Security-Policy.
  2. The highlighter is regex-based, not a parser, so unusual syntax can be
     mis-marked. It is off by default and labelled as decoration, not
     correctness; languages outside the nine listed fall back to clean text.
  3. Sanitizing is a string pass, not a parse-and-rebuild, so a malformed tag
     is escaped rather than reconstructed. That is the safe direction (a lone
     `<` becomes `&lt;`), but the output of pathological input is not
     byte-identical to what a browser would have parsed.
  4. Output is a fragment. There is no bundling, no asset rewriting and no
     base-URL resolution, so relative image and link paths keep pointing at
     whatever directory the fragment ends up in — the copy says so.
  5. The 200,000 character cap is a deliberate limit for a browser pane, not
     a promise of unlimited input; the UI, content, FAQ and guide all state
     it, and an oversized file is refused with the number rather than
     truncated.

Files: `src/features/md-to-html/MdToHtml.tsx`,
`src/features/md-to-html/convert.ts`,
`src/features/md-to-html/sanitize.ts`,
`src/features/md-to-html/highlight.ts`, `src/app/globals.css`,
`src/lib/tools.ts`, `src/lib/tool-content.ts`, `src/lib/seo.ts`,
`src/lib/guides.ts`, `audit/check-md-to-html.mjs`,
`e2e/md-to-html-browser.mjs`.
