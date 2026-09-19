# Regex Tester: Parallel Judges Audit

Date: 2026-09-19. Status: eleventh tool upgraded and verified within the
coverage below. Ten independent judges ran in parallel (read-only, no edits);
the technical-architect judge was rate-limited on first attempt and completed
on retry.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| End-user UX | CRITICAL: match table content clipped with no scroll. False copy claims: "slashes are added automatically" (no slash handling — `/foo/g` silently returned 0 matches), "provided checkboxes" (flags were a free-text input), "quick-reference panel" (no such panel existed). 375px page horizontal overflow. Zero-length matches (`a*` on "bbb") rendered four invisible blank rows. Named-group names never surfaced. Minor: decorative fuchsia line-height, `guard` not user-adjustable |
| Domain expert | MEDIUM: silent truncation at 5000 matches — real count wrong, undisclosed, and the tail renders as non-matching. Capture-group numbers lost (`m.slice(1).filter(string)` silently drops non-participating groups). Zero-length matches invisible. LOW: `\p{...}` needs-u hint missing, `d` flag accepted but indices not shown, PCRE nuance unstated |
| Technical architect | F1 CRITICAL: catastrophic backtracking unbounded — V8 `(a+)+$` on `"a"×26+"b"` = 822ms, ×28 = 3,306ms, ×30 = 20,644ms in a single `exec()`; the 5000 guard bounds loop iterations, not per-exec time; `useDeferredValue` can't preempt a blocking exec; only a worker + `terminate()` truly bounds it; recommended worker + 400ms deadline + ReDoS banner + 2MB cap. F2 HIGH: silent 5000-match truncation (6001 real → "5000 matches", 1001-char tail highlighted as non-matching). F3 no `useDeferredValue` (house convention). F4 no 2MB cap. F5 O(n²) `result.matches.some()` inside `.map()` (line 139). F6 sticky `/y` clone correct & load-bearing. F7 no file upload (house gap). F8 unmount clean. F9 index keys safe. F10 invalid flags all caught |
| Code reviewer | MEDIUM: howTo vs implementation mismatches (checkboxes, slashes, quick-reference claims all false). MEDIUM a11y: pattern/flags inputs have no accessible name (`Field` renders `<p>`; Notepad uses `htmlFor`, JsonFormatter `aria-label`), error banner has no `role=alert`, count badge has no `role=status`. LOW: `.*` trailing empty match, unclear `∅` for absent groups |
| Functional | 36/36 checks PASS, 0 console errors. Covered emails, digits, alternation, quantifiers, classes, named groups, lookahead/lookbehind, `\p{L}`+u, flags g/i/m/s/u/y/d, invalid flags, invalid regex, zero-length, large input, empty states, highlight correspondence |
| Business analyst | MEDIUM: "Quick-reference panel" claimed but no such component exists in the 154-line file; howTo "Slashes are added automatically" false; howTo "provided checkboxes" false (free-text input); longDescription embeds CJK token mid-English |
| Content/SEO | CRITICAL/P0: embedded `正则表达式` ("regular expression") garbage in the long description. HIGH: "Named … capture group results" misleading (groups joined in one cell, names not surfaced). suggested full corrected copy supplied. relatedSlugs incl. formatters not relevant to regex users |
| Security/privacy | Zero egress PASS (only same-origin Next chunks + `va.vercel-scripts.com`); no eval/innerHTML, XSS payloads render literally. LOW: localStorage `bc_user_id` + `bc_recent` (recent-tools feature; regex data is NOT stored). HIGH: catastrophic backtracking DoS — security judge reproduced tab freeze at 28–30 chars and a 5000ms Playwright `fill()` timeout; guard does not bound backtracking |
| A11y specialist | HIGH: error banner no `role=alert`, count badge no `role=status`, pattern/flags inputs unlabelled (`Field` renders `<p>`, no id/aria-label). MEDIUM: long match values clip (no overflow-x-auto), `⌃start/0-end/0` zero-length rows announced confusingly. Contrast fuchsia-200/900 OK; table had no `<caption>`/`scope`; site header overflows 375px |
| Performance | SEVERE: `(a+)+$` freezes the tab (N=500 and N=4000 dispatch never settled in 15s; Node V8 SIGTERM-killed after 6s); the trigger is FAILED matches; matching input completes in 3–7ms; neither debounce nor `Promise.race` can preempt a blocking `exec`. HIGH: silent 5000 truncation (6000 matches → "5000 matches"). Recommended Web Worker + cancellation or explicit Run button |

Note: a Web Worker was implemented first and then REVERTED after build
verification — Turbopack's `next build` emits user worker assets
(`_next/static/media/*.ts`) with `Content-Type: video/mp2t` behind `nosniff`
and resolves the worker URL to an un-hashed root path, so the worker never
loads in the production `next start` site. The existing `pdf-compressor` /
`image-compressor` workers rely on the same mechanism and are currently
non-functional in this build (not yet browser-verified). The final design
therefore bounds the risk without a worker: heuristic gating of pathological
patterns + explicit opt-in, plus a 2MB input cap and disclosed truncation.

## Changes And Evidence

- `src/features/regex-tester/regex-engine.ts` (new): pure, tested `runRegexJob`
  with a 5000-match cap that now reports `truncated: true` (the match loop
  stops at the cap and discloses), a 400ms soft deadline that stops runaway
  match floods and reports `timedOut`, `isSuspiciousPattern` (nested/repeated
  quantifiers `\([^()]*[+*][^()]*\)[+*]` and alternation-in-group
  `\([^()]*\|[^()]*\)[+*]`), `captureGroupNames` (a capture-order parser that
  skips escaped parens and character classes and distinguishes `(...)` /
  `(?<name>...)` from `(?:...)`, lookahead, and `(?<=)`/`(?<!`) lookbehind),
  `parseRegexInput` (accepts `/pat/` and `/pat/flags` wrappers, merges literal
  flags with the checkbox set), and `FLAG_OPTIONS` = g, i, m, s, u, d, y.
- `src/features/regex-tester/RegexTester.tsx` (rebuilt, main-thread eval):
  - **Catastrophic-backtracking gate (F1 / security / performance):** suspicious
    patterns never auto-execute. An amber `role=alert` banner with a "Run anyway"
    button replaces evaluation until the user opts in; the page stays fully
    responsive (harness-proven with `(a+)+$` on a 41-char failing string).
  - **Truncation honesty (F2):** amber "Showing the first 5,000 matches — the
    rest are not evaluated" notice (`role=status`) + the badge reports the real
    rendered count (5000).
  - **Group identity (domain / SEO):** groups preserved including
    non-participating ones, rendered as `$1 = a, year = 2024, $2 = ∅`;
    named groups surfaced via `captureGroupNames`.
  - **Zero-length matches (UX / domain / a11y):** explicit `∅ (empty match)`
    rows; zero-width highlight marks skipped so text still reconstructs.
  - **Flags (code reviewer / BA / content):** accessible checkbox set
    (g, i, m, s, u, d, y) replacing free-text input — invalid flags are now
    impossible, and howTo copy matches reality.
  - **Slash wrapper (UX):** `/…/` and `/…/flags` auto-detected with a
    "slashes are optional" note; the `\p{…}`/`\x{…}` needs-u hint added.
  - **Input cap (F4):** 2,000,000-char text cap with disclosed notice.
  - **a11y:** `role=alert` error/timeout banners, `role=status` badge,
    truncation and limit notices, aria-labels on pattern, text, and each flag
    checkbox, table `<caption>` + `scope=col`, contrast raised from
    slate-400 → slate-600.
  - **Quick-reference panel (UX / BA / content):** collapsed `<details>` with
    18 entries (classes, groups, named groups, lookaheads, backrefs, Unicode
    properties, …) — the previously fabricated feature bullet now exists.
  - **Perf (F5):** the O(n²) `matches.some()` hoisted out of the row map;
    `useDeferredValue` keeps typing smooth for benign-but-heavy evals.
  - Sticky `/y` clone semantics preserved (architect-confirmed load-bearing).
- `src/lib/tool-content.ts`: `正则表达式` CJK token purged; longDescription
  rewritten (workers claim replaced with the honest guard description); howTo
  corrected ("slashes are optional", "toggle flags with the checkboxes", quick
  reference step); features updated (guard + reference panel); FAQ added for
  slow evaluation and PCRE differences; relatedSlugs moved to text-cleaner /
  text-lines / word-counter / html-entities / checksum-calculator.
- `src/lib/seo.ts`: two long-tail keywords added; JSON-LD `TOOL_FEATURE_LIST`
  override added (no more "Format, convert, generate and developer" boilerplate).

## Verification

- Production build passes (285 pages).
- New harness `e2e/regex-tester-browser.mjs`: **39 production Chrome scenarios
  passed** — email matching, numbered `$1/$2/$3` labels, named groups
  (`year = 2024`), non-participating `∅` groups, i-flag toggling, needs-u hint
  on/off, unicode property matching, four zero-length empty matches with `∅`
  labels, invalid-regex alert, slash wrapper detection + matching, 5000-match
  truncation disclosure, catastrophic gate (warning shown, zero auto-eval, page
  responsive), "Run anyway" opt-in producing real matches, benign recovery, quick-reference
  panel presence, 375px internal table scrolling, no badge on empty pattern, and
  `/tools/regex-tester` returning 200.
  Functional-tester's 36-case set is subsumed; 0 console errors.
- Sibling re-runs green: json-formatter (beautify into output area),
  word-counter, text-size-calculator ("5.0 B"), plus `/tools/json-formatter` 200.

## Residuals

- Heuristic gating does not cover every conceivable ReDoS vector; boundary
  cases are documented in the report. Evaluating a gated pattern with "Run
  anyway" still runs on the main thread — on the rare pattern the heuristic
  misses, a long failing input could still pause the tab. A Web Worker remains
  the correct long-term bound once Turbopack's worker asset serving is fixed.
- Whole-site residuals tracked elsewhere: site-header navigation overflows
  375px; `'unsafe-eval'` in the CSP script-src (Turbopack); `/verify` wording;
  physical mobile/Safari/Firefox testing not performed locally (Chrome only);
  ToolPreview uploads still mocked; `d`/`v` flag index details not surfaced;
  no file-upload button for loading test logs (house pattern exists).

Report artifacts: this file consolidates the ten judge reports
(`audit/reports/regex-tester-architect.md` was the architect's working copy and
is superseded).