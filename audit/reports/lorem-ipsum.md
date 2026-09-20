# Lorem Ipsum: Parallel Judges Audit

Date: 2026-09-20. Status: seventeenth tool upgraded and verified — the
second wave of the parallel-judges program and the third-tool parallel
workload (word-counter, lorem-ipsum, color-converter judged, upgraded and
verified independently in parallel; this report covers lorem-ipsum). All
ten judges returned usable reports; the hydration-mismatch claim was
independently reproduced and the fix runtime-verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Changing mode/count silently keeps the OLD output until Generate is clicked (stale-output trap) — user copies text that doesn't match the selected config. No "shuffle words" toggle exists though the howTo tells users to toggle it |
| Technical architect | **HIGH: hydration mismatch (#418)** — `useState(() => build(mode, count))` runs `Math.random()` during SSR AND on the client, so the prerendered HTML already embeds generated lorem text; server text differs from client text every load. Also claimed "slider or input" quantity and "1 to 50" with slider max only 20; `<p>` label reimplements SliderField |
| End-user UX | Slider unlabelled (Field renders `<p>`, no htmlFor). Mode toggle shows active state as color-only, unreadable in Force Colors. Output textarea has no accessible name. No live region announcing regenerations. "3 modes (classic/shuffled/pure random)" fonts a switcher that doesn't exist |
| Content/SEO | Fabricated capabilities: "shuffle words for a more natural look" (no control), "pure random text" (no control), "slider or input" (input doesn't exist), privacy line "No data stored or transmitted" overstated (TrackToolUse + analytics are site-wide). FAQ never documents the canonical "lorem ipsum dolor sit amet" opener. JSON-LD featureList is generic boilerplate |
| Business analyst | Core free-utility fit is fine; the value is instant copy. MUST make the output follow the controls, MUST make range honest. SHOULD: canonical opener as a selling point, no-adjacent-repeats quality marker, tightened privacy wording |
| A11y specialist | HIGH: mode buttons convey state only by color (no aria-pressed / non-color cue) and aren't a labelled group. Count slider has no programmatic label. Output textarea unlabelled. No aria-live status on regeneration or Generate |
| Security/privacy | No egress from the generator itself; generated text never leaves the browser. Privacy copy should be scoped to "text never leaves your browser" rather than absolute "no data stored or transmitted" (site analytics are out of tool scope). No storage writes |
| Edge cases | Words mode with count < 2 can't show the opener. Word-boundary collision in generated paragraphs (a picked word adjacent to its duplicate across a canonical boundary). Batch of 1 should read grammatically ("1 paragraph"). Huge counts must stay cheap |
| Performance | Linear, pure-string builder; 50 paragraphs ≈ 0.123ms/17KB — the slider can safely go to 50. No memoization concern beyond calling build once per render |
| SSR/cross-browser | Hydration mismatch CONFIRMED (Chrome): build-time random text in HTML vs fresh client text → React error. No-JS pages show stale build-time lorem. Routes smoke 200 |

## Changes And Evidence

- `src/features/lorem-ipsum/LoremIpsum.tsx` (rebuilt):
  - **Hydration fixed (architect, functional, SSR):** state starts `""` —
    deterministic SSR equals first client render. A mount effect inside a
    `setTimeout(0)` callback generates the initial batch (sync
    set-state-in-effect rule respected); the same effect keyed on
    `[mode, count]` regenerates on every configuration change — the
    stale-output trap is gone and Generate remains a pure event-handler
    re-roll.
  - **Empty→content gap fixed (UX, functional):** output is auto-filled
    on mount and auto-regenerates on mode/count change, so there is never
    a blank box. `role=status aria-live=polite` announces
    "N paragraphs|sentences|words".
  - **Honest range + shared slider (architect, UX, a11y):** max raised 20
    → 50 to match the documented "1 to 50"; the hand-rolled slider is
    replaced with the shared `SliderField` (useId + label htmlFor from the
    previous wave), accent indigo.
  - **Mode toggle accessibility (a11y):** buttons live in
    `role=group aria-label="Type"`, each carries `aria-pressed` plus a
    ring (non-color active cue).
  - **Canonical opener (content, business):** every first generated unit
    opens with "Lorem ipsum dolor sit amet" (words mode: "lorem ipsum…"
    when count ≥ 2), so the "classic" claim is literally true; a
    no-adjacent-duplicates `pick()` guard removes repeated word
    collisions.
  - **Output/name wiring (a11y):** output textarea is `readOnly` with
    `aria-label="Generated output"`; copy rides the shared `CopyButton`
    with a distinct aria-label.
  - **Honest copy (content, privacy):** deleted shuffle/pure-random/"slider
    or input" claims; privacy tightened to "generated text never leaves
    your browser".
- `src/lib/tool-content.ts`: block rewritten — features document the
  classic opener, no-adjacent-repeats, auto-regeneration and the real
  1–50 range; howTo is unit → quantity → Generate/re-roll → copy; FAQ
  explains the opener, why lorem ipsum (vs "test test test"), and
  production usage; polarizing "classic/shuffled/random" modality removed
  everywhere.
- `src/lib/seo.ts`: keyword row widened ("generate lorem ipsum", "lorem
  ipsum paragraphs", "dummy copy generator"); JSON-LD featureList override
  added (was generic generate boilerplate).

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Production build passed — static pages 287/287 (single build for the
  three-tool wave).
- `e2e/lorem-ipsum-browser.mjs` — 30 production Chrome scenarios, 30/30
  green: client-only mount fills 3 paragraphs with zero hydration errors;
  opener "Lorem ipsum dolor sit amet" present; slider spans 1–50 with a
  programmatic label; mode toggle groups + aria-pressed; mode/count
  changes auto-regenerate (sentences→3, words→50 tokens prefixed
  "lorem ipsum ", paragraphs→5); no adjacent duplicate tokens across a
  50-word batch; status line tracks config; Generate re-rolls a different
  batch; readOnly output with aria-label; copy writes the exact on-screen
  text; `/use` + `/tools` 200; marketing copy lists 1–50 + opener and is
  free of shuffle/pure-random/slider-or-input claims; zero hydration
  errors; zero page errors.
- Wave-1/2 harnesses re-run green against the same build.

## Residual (shared, not re-reported)

Site-header 375px nav overflow; `'unsafe-eval'` CSP; `/verify` wording;
ToolPreview upload mock; WebKit not runnable in harnesses; Next.js route
announcer `__next-route-announcer__` `role=alert` present on every page.