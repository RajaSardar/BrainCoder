# Word Counter: Parallel Judges Audit

Date: 2026-09-20. Status: sixteenth tool upgraded and verified — the
second wave of the parallel-judges program and the first three-tool wave
(word-counter, lorem-ipsum, color-converter judged, upgraded and verified
independently in parallel; this report covers word-counter). All ten
judges returned usable reports; consolidation merged overlapping findings
and the highest-impact claims were runtime-verified in the harness.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Sentence counter `trimmed.split(/[.!?]+/)` breaks on decimals (3.14), abbreviations (Mr., e.g.) and initials, so "Mr. Smith went home." counts 2 sentences. Punctuation-only tokens count as words ("!.!." → 1). Chars counter uses UTF-16 code units — emoji double-counted, contradicting the FAQ's multi-byte claim. No input cap and synchronous many-pass compute on every keystroke; big pastes freeze (measured ~228ms @ 5MB) |
| Technical architect | Category-broken `replace(/\s/g,"")` allocates a full copy per keystroke; `uniqueWords` Set is the dominant cost (~15ms of the 35ms @ 1MB). `toLocaleString()` without a locale → SSR/CSR mismatch on grouped numbers. Reading-time pre-rounding then `toFixed(1)` loses precision. Time cards duplicated outside the array |
| End-user UX | Default textarea pre-filled with a hardcoded pangram misrepresents the empty state and there is no Clear button (both claimed-like features referenced elsewhere). No live feedback beyond the numbers themselves; big-paste freeze. CJK word counts are grossly undercounted yet marketed as "handles Chinese/Japanese/Korean" |
| Content/SEO | FAQ overclaims multi-byte/CJK word counting (tokenizer is whitespace-based). JSON-LD featureList is generic — "Format, convert and generate" boilerplate for a growth tool. features list misses the cheap wins (reading time, speaking time, unique words) that the UI actually ships |
| Business analyst | Core utility value fine (count + clear + copy). Should land cheap differentiators already in the DOM: unique words, reading time. Honest scoping of CJK matters more than the current overclaim. Must keep the empty-state honest |
| A11y specialist | HIGH: textarea has no programmatic label (`Field` renders a `<p>`). No live region announcing count updates. Stat cards announce the value before the label (dd before dt). No Clear contrast/affordance concerns, but the Clear button was absent entirely |
| Security/privacy | No egress, no storage writes — count-only tool. Nothing to fix beyond keeping tokenization local. The `Word boundary` regex must stay `u`-flag-safe against ReDoS on pathological input |
| Edge cases | `e.g.` splits a sentence mid-sentence; `v1.2.3` fragments; sentences without terminal punctuation are silently dropped (trailing "…" text uncounted); `a. b. c` gives 2 sentences — correct per period-rule but users expect 3; empty textarea computes a phony 1-line/1-paragraph baseline |
| Performance | The text normalize pass runs 3 separate regexes + unicode property scans per render; uniqueWords Set + whole-string copy dominate. Use a deferred value + single pass; cap input; compute on the deferred snapshot so typing stays at input latency |
| SSR/cross-browser | All counts render client-side; `toLocaleString()` un-locale'd is the only latent hydration mismatch (grouped separators appear when >1000). Routes smoke 200; no-JS shows empty counters (acceptable, honest) |

## Changes And Evidence

- `src/features/word-counter/WordCounter.tsx` (rebuilt):
  - **Sentence counter rewritten** (functional, edge): decimals are
    shielded (`\b\d+(?:\.\d+)+\b` → same-length "0" run), then a
    fixed abbreviation set (Mr, Mrs, Ms, Dr, Prof, Sr, Jr, St, vs, etc,
    e.g., i.e., incl, approx) is muted, and sentences match
    `/[^.!?。！？]+[.!?。！？]+(?=\s|$)/g`. "Mr. Smith went home." → 1;
    "Wait, 3.14 is pi." → 1; "Use e.g. apples. v1.2.3 released." → 2;
    "a. B. c" → 2 (fragment rule kept).
  - **Words tokenized correctly** (functional, performance): single regex
    `[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu` — punctuation-only input
    yields 0 words, hyphenated/dotted terms count once, emoji excluded
    from the word count.
  - **Code-point character counting** (functional, content): `for…of`
    iterates code points, so "😀🙂" → 2 characters (honest multi-byte
    claim); no whole-string copy per keystroke.
  - **Perf & caps** (performance, architect, UX): `useDeferredValue(text)`
    + `useMemo(computeStats)` so typing latency stays at input speed and
    stats recompute on the deferred snapshot; `maxLength={1,000,000}`
    with a disclosed character-limit note and a status readout.
  - **Honest empty state + Clear** (UX, functional): state starts `""`
    (no fake pangram); a real Clear button (disabled when empty) resets;
    `role=status aria-live=polite` line reports "N words, M characters"
    or "Waiting for text…".
  - **a11y** (a11y): textarea bound via `useId` + `<label htmlFor>`;
    stat cards are `<dl>` blocks with `<dt>` (label) before `<dd>`
    (value) in DOM order (value visually ordered first via CSS) so the
    label is announced first; `toLocaleString("en-US")` pinned to kill
    the grouped-separator hydration risk.
- `src/lib/tool-content.ts`: content block rewritten — honest scoping of
  word/sentence counting to space-delimited scripts, code-point-accurate
  characters for every script (CJK), decimal/abbreviation sentence
  behavior documented, 1,000,000-character limit FAQ added, features
  now list unique words and reading/speaking time, CJK overclaim deleted,
  howTo is empty-state → review → Clear.
- `src/lib/seo.ts`: keyword row widened ("how many words", "count
  characters online"); JSON-LD featureList override added (was generic
  growth boilerplate).

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Production build passed — static pages 287/287 (single build for the
  three-tool wave).
- `e2e/word-counter-browser.mjs` — 38 production Chrome scenarios, 38/38
  green: empty boot with all-zero cards + disabled Clear; programmatic
  textarea label; maxLength 1,000,000; "Mr. Smith went home." → 1
  sentence/4 words; decimal + abbreviation immunity; "a. B. c" → 2;
  "!.!." → 0 words and 0 sentences; "Hello - world" → 2; emoji → 2
  characters; case-insensitive unique words; lines/paragraphs split
  rules; hyphenated/dotted single tokens; 40k-word paste accurate with
  zero page errors; pluralized status live region; dl card ordering;
  Clear; `/use` + `/tools` 200; marketing copy has the 1,000,000 limit,
  no CJK overclaim, honest space-delimited wording; zero hydration
  errors; zero page errors.
- Wave-1/2 harnesses re-run green against the same build; shared
  SliderField ripple is covered by uuid/lorem harnesses in this wave.

## Residual (shared, not re-reported)

Site-header 375px nav overflow; `'unsafe-eval'` CSP; `/verify` wording;
ToolPreview upload mock; WebKit not runnable in harnesses; Next.js route
announcer `__next-route-announcer__` `role=alert` present on every page.