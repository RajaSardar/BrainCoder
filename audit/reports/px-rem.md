# PX ↔ REM: Parallel Judges Audit

Date: 2026-10-10. Status: shipped module (`src/features/px-rem/units.ts`) and
component rebuilt, Node mirror audit and production-Chrome e2e harness authored,
registry copy corrected. Ten judges (functional, end-user UX, business,
SEO/content, security, a11y, technical architect, performance, edge cases,
honesty) returned; the consensus is that the tool's worst failures were **silent
miscomputation and sold features**: `toFixed()` rounded results against its own
example, an empty input computed as `0rem`, and the copy rebuilt a feature set
(em/vw/vh, batch, viewport units) the page never had.

## The judges' consensus

| Expert | Main findings |
| --- | --- |
| Functional | `Number("")` is `0`, so clearing the input rendered `0rem`; `14.5px` converted with `toFixed(4)` to `0.9063rem` while the copy promised `0.90625rem` — the page contradicted its own example. Copying during an invalid state copied the "—" placeholder into the clipboard. The 20-row auto base switcher was fine but the reference table wasn't announced as a table. |
| End-user UX | Neither input had a programmatic name (the shared `Field` renders a `<p>`); the base slider was labelled only by a stray text line; there was no feedback element for results. |
| Business | The copy sold features that didn't exist: em/vw/vh conversion, viewport-relative conversion, and a batch converter — all live in the FAQ and description. The "16px = 1rem" example was real; the base range ("any base") wasn't — the slider only reaches 8–24px. |
| SEO/content | Rich results already rendered; the defects were the invented feature list and FAQ bullets. Description repeated the false batch/viewport claims. |
| Security | **Pass**: no upload, no off-origin request, no non-GET request in the e2e session; conversion is pure arithmetic client-side. |
| A11y | No `<label htmlFor>` on either input; results were plain text with no live-region announcement; the cap error was not an alert. |
| Technical architect | The converter should be a pure module usable off-browser (Node audit–runnable); it is now — `units.ts` exports `pxToRem`/`remToPx`/`parseUnitValue` with no React import. |
| Performance | `toFixed(4)` also truncated precision at exactly 4 digits; the cap at 1,000,000 px/rem bounds the arithmetic trivially. |
| Edge cases | Empty, whitespace-only, `Infinity`, `NaN`, hex, and `>1,000,000` inputs must be invalid (not computed); negative numbers and `0` should still convert; the base must clamp to 8–24. |
| Honesty | Copy now states px ↔ rem only, the true 8–24px base range, and the exact `0.90625rem` example; the reference table and "zero batch, zero server, zero tracking" note are all true. |

## Severity table (file:line)

| Sev | Finding | Location | Status |
| --- | --- | --- | --- |
| **Blocker** | `Number("") === 0` made an empty input compute `0rem` | `PxRem.tsx` (old `handlePxChange`) | Fixed: `parseUnitValue` (`units.ts`) rejects blank/whitespace → renders "—" |
| **Blocker** | `toFixed(4)` contradicted the copy's own `0.90625rem` example | `PxRem.tsx` (old `format`) | Fixed: `formatNumber` (`units.ts`) keeps 6 decimals, trims zeros |
| **Blocker** | Copy button actively copied the "—" placeholder on invalid input | `PxRem.tsx` (old copy handler) | Fixed: copy is disabled while the result is invalid |
| High | No `<label htmlFor>` on the two inputs or the slider | `PxRem.tsx` | Fixed: real labels + `useId`; slider announces live via `role="status"` |
| High | Copy sold em/vw/vh, viewport units, and a batch converter | `tool-content.ts` (px-rem block), `seo.ts` keywords/featureList | Fixed: honest description/FAQ/`featureList`; keywords widened |
| High | "Any base" claim vs 8–24px slider | `PxRem.tsx`, `tool-content.ts` | Fixed: copy states 8–24px; `clampBase` enforces it in shipped code |
| Low | Reference table had no caption/scope semantics | `PxRem.tsx` | Fixed: `<caption>` + `<th scope>` + true-size preview column |

## What works (VERIFIED)

- `pxToRem(14.5)` = `0.90625rem` and `remToPx` returns `24px` / `1.5rem` round trips exactly (and from `1.6rem` at a 10px base).
- Empty, whitespace, hex (`0x10`), `Infinity`, and `1,000,001px` inputs render "—", never a number; copy is disabled there. `0`, negative, and fractional values convert.
- Base slider defaults 16 and clamps to 8–24; every conversion, the `role="status"` live region and the 20-row reference table all follow the base; `1.6rem → 24px → 1.5rem → 24px` at a 16px base.
- The whole session makes no off-origin and no non-GET request; no hydration warnings; no page errors.
- Registry copy: "px ↔ rem only", the 8–24px range, the exact `0.90625rem` example, no batch/vw/vh/vmin/vmax claims; the new guide `how-to-convert-px-to-rem` explains the rem-root dependency; both routes are in the sitemap.

## Top-5 fixes

1. `parseUnitValue()` (`units.ts`) — strict string→number gate that rejects every non-numeric shape, so an empty input is *invalid*, not `0`.
2. `formatNumber()` (`units.ts`) — 6-decimal, zero-trimmed precision that satisfies the copy's own `0.90625rem` example.
3. Copy this tool cannot do: disabled copy button on invalid input; `role="alert"` cap note; honest "px ↔ rem only" description.
4. Accessible labels: real `<label htmlFor>` for pixel and rem inputs plus the base slider, `role="status"` result region, `<caption>`/`th scope` table.
5. `clampBase()` (`units.ts`) — base range 8–24 enforced in shipped code, so no page state can ever produce a UI outside the copy's promised range.

## Evidence

- **Node mirror audit `audit/check-px-rem.mjs`: 51 passed, 0 failed.** The shipped `units.ts` is transpiled with the repo's compiler, required as CJS, and asserted for the strict parser, the precision example, the base clamp, negative/zero/cap handling, and the guardrails in the component/`tool-content` source.
- **Production-Chrome e2e `e2e/px-rem-browser.mjs`: 48 passed, 0 failed**, run twice against the same build; the 8–24 range and the 20-row reference table are read out of the shipped module source at run time.
- `npx tsc --noEmit` clean; ESLint 0/0 on all touched paths; `next build` green (314 static pages).
- Regression on the same build: SQL/XML/JSON-to-TS/CSV-JSON/JWT/QR harnesses re-run — 911 assertions passed (see the wave report in `PLAN.md`).

## Tracked residuals (accepted, disclosed)

1. The base slider is capped at 8–24px by design (`clampBase`); root sizes outside that range are uncommon and the copy says so.
2. `formatNumber` trims trailing zeros at 6 decimals, so an irrational result like `1.000001` is displayed at full 6-decimal precision — never rounded to an incorrect example.
3. The true-size preview assumes the pixel density of the viewing display; it is honest but approximate on HiDPI screens (disclosed in the tool note, not the copy).