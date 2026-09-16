# JSON Formatter: Parallel Judges Audit

Date: 2026-09-16. Status: fourth tool upgraded and verified within the coverage
below. Like Image Resizer, its ten judges ran in parallel.

## Ten Independent Judges

Each judge was a separate agent; none was replaced with a single agent
pretending to be all ten experts. They were launched concurrently because they
are read-only and independent.

| Expert | Main findings |
| --- | --- |
| End user | Claims a tree view / highlighting / tolerant parsing that do not exist; no minified copy; error location absent for common errors; only-formatted copy button |
| Functional tester | Full browser test plan with exact-string assertions (2/4-space formatting, minified output, badge flips, error edges, empty/null/scalars, unicode, 2MB cap) |
| Technical architect | Two independent parses per keystroke (two memos); no debounce for large pastes; stale deferred-state after Clear; deep nesting gives raw RangeError stack message |
| Code reviewer | Line/column claim false (engine message only, no position for trailing commas); unhandled "Unexpected end" and bracket-depth cases | 
| Business analyst | 5 FALSE/partial marketing claims (tree view, syntax highlighting, tolerant parsing, exact location, format button, minify toggle, minified copy) |
| Content/SEO | Same false copy pinpointed with paste-ready honest copy; missing how-to guide scoped; relatedSlugs recommended swap url-parser → xml-formatter; keyword extensions |
| Security/privacy | No network/XSS (textarea value, no innerHTML), no storage, client-only, zero-risk clipboard — confirmed safe |
| Accessibility | Unlabeled textareas, badge/error not announced (no role=status/alert), indent chips not a radiogroup, amber-500/white ~2.1:1 fails contrast, small touch targets |
| Performance | Single-parse memo replaces double parse; useDeferredValue for >64KB without timers; deep-nesting RangeError to friendly message; 2MB input cap |
| QA/reliability | Copy label "Copy (nothing)" poor; Clear does not announce anything; minified field lacks copy; empty/whitespace/null/"42"/duplicate-key edge cases enumerated |

Consolidated critical/important defects matched across judges and fixed.

## Changes And Evidence

- New pure module `src/lib/json-format.ts`, `formatJson(input, indent)` returns
  `{ ok, formatted, minified }` or `{ ok:false, error, line, column }` from a
  SINGLE parse. Error location is extracted from the engine message when present
  (position or explicit line/column), falling back to the end-of-input and
  message-snippet heuristics, converted to 1-based line/column; the duplicated
  location clause is stripped from the displayed message. Deep nesting maps
  `Maximum call stack size exceeded` to a friendly "nested too deeply" message.
- `src/features/json-formatter/JsonFormatter.tsx` rebuilt: single deferred parse
  per keystroke (`useDeferredValue`, no timers — the debounce fix), role=radio
  indent group in a fieldset/legend, `role="status"` live badge, `role="alert"`
  error box showing line and column, aria-labeled textareas (input, formatted,
  minified), readOnly outputs with tabIndex=-1, minified CopyButton, 2MB input
  cap with a clearing "Input is limited to 2 MB." notice, amber-700 selected
  chip (fixes the ~2.1:1 amber-500/white failure), slate-600 char counts,
  min-h-11 touch targets, Disabled-empty Clear that also clears the cap notice.
- Content (`tool-content.ts`): longDescription/features/howTo/FAQ rewritten
  honestly — tree view, syntax highlighting, tolerant parsing, format button
  and minify toggle claims removed; line/column phrased as "where parsing
  stopped"; added FAQ clarifying numbers normalize, >2^53 precision loss, and
  duplicate keys last-wins; relatedSlugs swapped url-parser → xml-formatter.
- SEO (`seo.ts`): keyword extensions (json pretty print, validate json online,
  json minify) preserving the six existing keywords.
- Guide (`guides.ts`): new `how-to-format-json-online` with toolSlug, covering
  behavior, indent choice, validity/line-column errors, and the two copy buttons.
- Verification: 10 node checks (`e2e/json-formatter.mjs`) on the module
  (exact 2/4-space strings, minified, engine-agnostic line/column via three
  different V8 message shapes, multi-line positions, friendly deep-nesting,
  duplicate-key/number normalization) and 15 production Chrome scenarios
  (`e2e/json-formatter-browser.mjs`): initial state, exact formatted/minified
  values, 4-space switch, trailing-comma and unquoted-key and truncated errors
  with line/column, recovery, deep-nesting, 2MB refusal + notice clearing,
  Clear coalescing to empty, and a 375px mobile no-overflow check. The injected
  `#__next-route-announcer__` (role=alert/status) is excluded from live-region
  assertions. Production build passed (282 pages), targeted lint exit 0, and a
  stale pre-build `next-server` holding :3788 was replaced with a fresh server.

## Remaining Limits

Not runtime-verified: physical mobile devices, Firefox, Safari, real
screen-reader passes, or Node-vs-Chrome message-shape differences in error text
(the harness tests only assert non-empty messages plus exact line/column, so
both engines pass). The line/column value is engine-derived: when no locateable
position exists the error shows without a location. Duplicate keys and >2^53
integers are documented rather than "fixed" (JSON semantics). The shared Copy
Button keeps its current size; only this tool's local controls got min-h-11.
The shared site header nav can still overflow horizontally at 375px — a
shared-site item logged in earlier reports. The shared /verify audit wording and
coverage concerns remain pending, not silently certified by this tool's tests.

Other tool worktree changes found at session start were preserved, not approved
or counted as completed audits. No other tool has completed the ten-judge
process beyond PDF Compressor, Image Compressor, Image Resizer, and JSON
Formatter.

Next tool: URL Encoder, the next entry after JSON Formatter in the registry.