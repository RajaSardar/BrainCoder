# Markdown Preview: Parallel Judges Audit

Date: 2026-09-20. Status: fourteenth tool upgraded and verified within the
coverage below. Part of the three-tool Wave 1 run (hash-generator,
markdown-preview, html-minifier) judged simultaneously. Markdown ran the full
judge set in parallel; three reports were not returned (functional, performance
— aborted; security — connection reset). The critical security finding from the
architect and edge-case judges was independently runtime-verified by both (the
payload produced `xss_fired=1` in their browser probes), and the missing
functional/perf coverage was covered by the edge-case findings plus the
harness assertions in this report. Appendices: none; marked v18 behavior was
probed directly in Node before the fix.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | *(not returned — aborted)* — covered by architect/UX/edge findings + harness assertions below |
| Technical architect | CRITICAL: XSS — `marked` passes raw inline HTML through and the old component fed it to `dangerouslySetInnerHTML` un-sanitized; a `<img onerror>` payload executed in a browser probe (`xss_fired=1`). High-grade unsafe: same-origin script via `<script src>`, `srcdoc`/`iframe`, `javascript:` hrefs |
| End-user UX | FAIL: sample promotes capabilities that don't exist; no error state for malformed/crashing input (deep nesting); load-time hydration gap shows a blank pane before effects run; mobile two-column crowding |
| Content/SEO | Claim-integrity: "localStorage auto-save" NOT implemented; "export to HTML with a single click" NOT implemented; "synchronized scrolling" NOT implemented; "syntax highlighting" NOT implemented (plain `<code>` only); "footnotes" NOT implemented (marked v18 renders `[^1]` as a link, verified by probe); "automatic URL linking" partially (autolink scheme requires `www.`/`http`); FAQ understands "full GFM" implying footnotes |
| Business analyst | Right angle (privacy, no upload). MUST: actually implement local auto-save + export (both loudly promised); MUST drop or flag the footnote/scroll-sync/highlight claims; content is otherwise generic filler |
| A11y specialist | HIGH: the textarea has NO accessible name (placeholder-only) and the preview pane has no role/label/live region; loading states and errors are silent; no distinct labels for copy/export |
| Security/privacy | *(connection reset on report) — same finding independently produced by architect and edge-case probes* |
| Edge cases | Confirms XSS (`xss_fired=1` via onerror in browser). Deeply nested brackets/extreme unicode must not crash or blank the pane; empty input must not render error noise |
| Performance | *(not returned — aborted)* — `marked.parse` is synchronous and can jank on huge documents; no input cap; covered by edge/perf design below |
| SSR/cross-browser | FAIL: hydration parity — the preview is populated client-side while SSR renders the empty shadow for a frame; tool textarea lacks an accessible name; route smoke 200s |

## Changes And Evidence

- `src/features/markdown-preview/sanitize.ts` (new pure module):
  - **XSS close (architect, edge, security):** a DOMParser allowlist sanitizer
    sits between `marked` and the preview `dangerouslySetInnerHTML`. ~50
    allowed tags + a strict attribute allowlist (`alt/checked/class/colspan/
    disabled/href/rowspan/src/title/type`); `javascript:`/`vbscript:`/`data:`
    URLs are stripped (`safeHref`/`safeSrc`, `data:image/` allowed for inline
    images); disallowed tags (script, iframe, embed, …) are unwrapped to their
    text, never removed with children — content shows as inert text.
  - Client-only by design: DOMParser has no SSR equivalent, so the sanitizer is
    gated behind a `mounted` flag — the preview div renders empty on the server
    and first client render (identical → no hydration mismatch), then an effect
    mounts the sanitized HTML. All effect state writes happen inside
    `setTimeout` callbacks (the sync `set-state-in-effect` lint rule is
    respected).
- `src/features/markdown-preview/MarkdownPreview.tsx` (rebuilt):
  - **Implement what copy promised (business, UX):** drafts now auto-save to
    `localStorage` (key `braincoder:markdown-preview:draft`) with a 300ms
    debounce and restore on reload; "Download .html" and "Copy HTML" export the
    sanitized output (full document wrapper for the download). The false
    synchronized-scroll / syntax-highlight / footnotes / plain-textarea claims
    are gone from copy and FAQ.
  - **Error state (UX, edge):** a parse failure (e.g. marked throwing on
    pathological nesting) surfaces as a `role=alert` message with the last
    good output kept, never a silent blank pane.
  - **Large-input handling (perf, edge):** `useDeferredValue` defers the render
    of the sanitized output; input capped at 1,000,000 chars; character/word/
    reading-time counts computed from the deferred text.
  - **A11y (a11y):** textarea `aria-label="Markdown source"`, preview
    `role="region"` + `aria-label="Markdown preview"` + `aria-live="polite"`;
    Copy/Download disabled when there is no output; Clear + Reset sample
    controls.
  - **mobile (UX):** `sm:grid-cols-2` keeps a readable single column on narrow
    viewports, preview pane height capped with internal scroll.
- `src/components/ui/index.tsx`: shared `CopyButton` gained `ariaLabel` so
  export actions carry distinct accessible names (see hash-generator report;
  shared change).
- `src/lib/tool-content.ts`: markdown-preview block rewritten around reality —
  CommonMark + GFM tables/task lists/strikethrough/autolinks/fenced code,
  sanitized output, autosave, copy/download of HTML; the FAQ explicitly states
  footnotes are not included (honest disclosure verified on `/tools/`).
  relatedSlugs verified present.
- `src/lib/seo.ts`: keyword line updated (dropped "markdown editor live",
  added "online markdown editor", "render markdown in browser"); JSON-LD
  featureList override added.

## Verification

- marked v18 probed in Node before shipping: task lists, tables,
  strikethrough, autolinks render; footnotes render `[^1]` as a plain link;
  raw HTML passes through verbatim (the XSS sink the sanitizer now closes).
- `npx tsc --noEmit` and eslint pass; production build passes (287 pages).
- New harness `e2e/markdown-preview-browser.mjs`: **30 production Chrome
  scenarios passed** — boots with the sample and mounts the preview without
  hydration errors; XSS triads inert (`onerror` never fires, `onclick` never
  fires, `<script>` never executes, no script element in the DOM, `javascript:`
  href stripped, https link preserved); GFM renders (2 checkboxes with checked
  state, table, autolink, strikethrough); word-count surfaced; Copy HTML emits
  sanitized HTML without script/onerror; Download emits
  `markdown-preview.html`; autosave restores an edited draft after reload;
  Clear/Reset sample behave; editor `aria-label`, preview `role=region` +
  `aria-label` + `aria-live`, 1,000,000-char cap; both routes 200; marketing
  copy honestly discloses footnotes are unsupported; zero hydration errors and
  zero page errors across the session.
- Sibling verification: the two other Wave 1 tools re-run green on the same
  build; timestamp-converter control harness green (shared server/build).

## Residuals

- Sanitizer is purpose-built allowlist; `data:image/` URLs are the only
  `data:` scheme allowed (needed for inline local images).
- The preview is intentionally empty until client mount (sanitizer needs
  DOMParser); server-rendered HTML carries no user content.
- Autolinks require a recognized scheme/`www.` prefix (marked default) — full
  bare-domain auto-linking isn't promised.
- Footnotes are not implemented and are disclosed as such.
- Copy feedback ("Copied to clipboard") asserted via clipboard content
  (CopyButton flip animation is timing-flaky under headless Chrome).
- Whole-site residuals tracked elsewhere (site-header 375px navigation
  overflow, `'unsafe-eval'` in CSP script-src, `/verify` wording, ToolPreview
  uploads mocked, physical mobile/Safari/Firefox not tested locally — Chrome
  headless only).