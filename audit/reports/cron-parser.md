# Cron Expression Parser: Parallel Judges Audit

Date: 2026-10-05. Status: shipped module (`src/features/cron-parser/cron.ts`) and
component rebuilt, Node mirror audit and production-Chrome e2e harness authored,
registry copy corrected. Ten judges (functional, end-user UX, business,
SEO/content, security, a11y, technical architect, performance, edge cases,
honesty) returned; the consensus is that the tool's worst failure is **silent
acceptance** — an expression with the wrong number of fields parsed anyway, and a
seconds panel existed that was never shown.

## The judges' consensus

| Expert | Main findings |
| --- | --- |
| Functional | The library (`cron-parser@5.10.0`) accepts **one through six** fields and silently fills the missing ones with wildcards. `"* * * *"` — and even `"*"` — parsed as five-field expressions and rendered five field lines, so a mistyped crontab line looked legitimate. The parsed-fields panel for a 6-field expression reused the 5-field layout, so `*/15 * * * * *` was described **as if it had no seconds field**. |
| End-user UX | The two inputs had no programmatic name (the shared `Field` renders a `<p>`, naming nothing); the invalid-expression panel was not an alert; the hint text named only "5 fields" while six-field and macro forms were also supported. |
| Business | The FAQ promised `@midnight` as a supported macro; the library rejects it (`cannot resolve alias "mid"`). Everything else the page sold — ranges, steps, lists, named months/weekdays — was genuinely delivered. |
| SEO/content | Content had been rewritten already for the previous pass; the remaining defect was the `@midnight` claim and the phrase-per-line flow, which is now accurate: five/six/macro, months and weekdays by name, 0 and 7 both being Sunday. |
| Security | **Pass**: no upload, no off-origin request, no non-GET request in the whole e2e session; dates computed client-side off a 1-second tick. |
| A11y | `role="alert"` missing on the error panel; inputs named only by `aria-label`, not by a real `<label htmlFor>`. Both fixed; the run-count slider keeps its dynamic "Next: N" label. |
| Technical architect | The parsing path now runs through `fieldCountError()` before the library sees the input (`cron.ts:28`), so the rule "5 fields, 6, or a macro" is enforced by shipped code the Node audit can run — not by a regex in the harness. |
| Performance | No cap needed: cron parsing is O(fields) and the compute is bounded by the 1–20 run slider. |
| Edge cases | February 30 is refused with a plain-English reason via `friendlyCronError` (`cron.ts:16`); weekday `0,7` collapses to one "Sun"; named weekdays/month resolve; 7-field input refused by the library with "too many fields" — now re-stated in the tool's own field-count message. |
| Honesty | The panel now says only what parses: 5 fields list 5 lines, 6 fields list a seconds line first, a macro lists the resolved 5. The copy says `@midnight` is not a macro and points at `0 0 * * *`. |

## Severity table (file:line)

| Sev | Finding | Location | Status |
| --- | --- | --- | --- |
| **Blocker** | 1–6 field counts all parse; `"* * * *"` rendered as valid, inventing an untold field | `cron.ts:36` (old `parseCron`), `CronParser.tsx` | Fixed: `fieldCountError` (`cron.ts:28`) enforces 5/6 or a macro before parsing; `describeFields` returns `""` for anything else (`cron.ts:58`) |
| **Blocker** | Seconds field never shown for 6-field input | `cron.ts:66`, `describeFields` lines | Fixed: `hasSeconds` adds `second:` first when the expression is genuinely six fields |
| **Blocker** | Error panel lacked `role="alert"` | `CronParser.tsx:114` | Fixed: invalid panel is `role="alert"`; empty boot is a neutral hint, not a red error |
| High | Inputs had no accessible name; slider label not associated | `CronParser.tsx:47-68` | Fixed: real `<label htmlFor>` via `useId` for expression and slider; UTC checkbox already wrapped in a real label |
| High | Copy says `@midnight` is accepted | `tool-content.ts:3619` (FAQ) | Fixed: states `@midnight` is not resolved by the parser and suggests `0 0 * * *` |
| Low | Example set lacked a 6-field and a macro chip, so the two supported shapes were undiscoverable | `CronParser.tsx:8` | Already fixed in the working pass: chips for `*/15 * * * * *` and `@daily` added |

## What works (VERIFIED)

- Five-field expressions parse and each field gets its own line (`minute: 0, 5, …`, `hour: *`, `day of month: *`, `month: *`, `day of week: Mon` — names, not numbers).
- Six-field expressions get `second:` first, then the same five lines; five-field expressions never show a seconds line.
- `@yearly/@annually/@monthly/@weekly/@daily/@hourly` all parse; `@reboot` and `@midnight` are refused with the parser's own message.
- February 30 / April 31 refuse with the plain-English "that day of the month never occurs" explanation; February 29 is accepted.
- Weekday `0,7` (both Sundays) collapses to a single "Sun" via a Set.
- The 1–20 run slider re-computes from the current second on a 1 s interval; UTC toggle switches formatting.
- Empty boot is a hint box ("Type a cron expression above"); invalid input shows `role="alert"` with the field-count rule or the parser's error; `role="status"` live region reports counts only.
- No hydration warnings, no page errors, no off-origin or non-GET requests in the e2e session.

## Top-5 fixes

1. `fieldCountError()` (`cron.ts:28`) — the real 5-or-6-fields-or-macro rule, enforced in shipped code so `"*"` and `"* * * *"` can never parse as valid.
2. Seconds shown only for genuine six-field input (`cron.ts:66`), so a 6-field expression is never mis-described as five.
3. `role="alert"` on the error panel + a separate neutral empty state (`CronParser.tsx:110-118`).
4. Real `<label htmlFor>` for the expression and the run-count slider (`CronParser.tsx:47-70`).
5. Copy corrected: `@midnight` disclosed as unsupported, macro list matches the parser, field-count rule stated verbatim in the helper text.

## Evidence

- **Node mirror audit `audit/check-cron-parser.mjs`: 56 passed, 0 failed.** The shipped `cron.ts` is transpiled with the repo's compiler and required (CommonJS interop, because `cron-parser` is CJS with `__esModule`); it asserts the field-count rule, macro acceptance/rejection, the seconds panel, weekday collapsing, impossible-date refusals, the `role="alert"`/`htmlFor` source, and the copy.
- **Production-Chrome e2e `e2e/cron-parser-browser.mjs`: 43 passed, 0 failed**, run twice against the same build; the slider ceiling is read out of the shipped component at run time.
- `npx tsc --noEmit` clean; ESLint 0/0 on all touched paths.
- Regression on the same build: SQL/XML/JSON-to-TS/CSV-JSON/JWT/QR harnesses re-run (see the wave report in `PLAN.md`).

## Tracked residuals (accepted, disclosed)

1. The first dates the parser returns are computed from the 1 s tick, so a run that has just fired drops off mid-session; that is documented behaviour, and the live region recomputes automatically.
2. `@midnight` is not supported because the parser resolves only `@yearly/@annually/@monthly/@weekly/@daily/@hourly`; the copy now says so and points to `0 0 * * *`.
3. The tool describes schedules; it does not validate that a job actually *does* anything — a perfectly parseable expression can fire a no-op. That is out of scope by design.