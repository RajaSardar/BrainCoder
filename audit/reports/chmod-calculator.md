# chmod Calculator: Parallel Judges Audit

Date: 2026-10-05. Status: shipped pure module
(`src/features/chmod-calculator/permissions.ts`) and component rebuilt, Node mirror
audit and production-Chrome e2e harness authored, registry copy corrected. Ten
judges (functional, end-user UX, business, SEO/content, security, a11y, technical
architect, performance, edge cases, honesty) returned; the consensus is that the
tool mislabelled its own three outputs — **two of them were simply wrong strings**,
not approximation — and the copy promised bits and commands the calculator does not
touch.

## The judges' consensus

| Expert | Main findings |
| --- | --- |
| Functional | The symbolic string took the **first letter of each permission id**: execute → `e`, so the initial 755 rendered as `rwer-wer-we`. The chmod-style output joined the id **words**: `u=readwriteexecute,g=readexecute,o=readexecute`. Reset loaded `644` while the boot state was `755`, so Reset visibly changed the permissions. |
| End-user UX | Typing a partial octal value ("6" on the way to "644") was rejected as an error instead of being treated as a still-being-typed draft; after typing "644" the checkboxes updated, but any intermediate keypress produced a flicker of error. |
| Business | The page claimed setuid/setgid/sticky-bit support "with warnings for dangerous combinations", recommended permissions for specific scenarios, and a ready-made `chmod 755 script.sh` command. None exists in the UI. |
| SEO/content | Keywords, tagline and the registry `description` were honest; the long copy, features, how-to and two FAQs repeated the special-bit and command claims. Now the copy names the three real outputs (numeric, symbolic, chmod mode) and explicitly rules the fourth digit out. |
| Security | **Pass**: no file access, no upload, no off-origin or non-GET request; the calculator is pure bit math. The old "warns you about dangerous combinations" phrase implied a capability (warnings about setuid) that did not exist — removed. |
| A11y | The octal box and the presets had no accessible names; the error had no `role="alert"`. Both fixed; the checkboxes remain real checkbox inputs inside real labels. |
| Technical architect | Bit logic moved into `permissions.ts`, browser-free, so the Node audit runs the shipped code: `PERM_LETTER` (`permissions.ts:17`) maps execute → `x`; `toSymbolic`/`toChmodStyle` derive from it; `classifyOctalDraft` (`permissions.ts:83`) lets the component distinguish empty / incomplete / invalid / ok without ever applying a half-typed mode. |
| Performance | O(1) per keystroke; nothing to bound. |
| Edge cases | `648` refused naming octal's missing 8/9; `7555` refused (three digits is the mode width); `000` clears all bits; an unticked category renders `u=-` so the mode string stays valid; execute-only renders `--x`, never `--e`. |
| Honesty | The mode expression now reads `u=rwx,g=rx,o=rx` (task-specified form), Reset returns to the boot state 755, and the copy's third output — the `chmod` mode argument — is described as the mode, not as a full command with a filename it never had. |

## Severity table (file:line)

| Sev | Finding | Location | Status |
| --- | --- | --- | --- |
| **Blocker** | Symbolic string used `p.id[0]`: execute rendered as `e` (`rwe`) | `ChmodCalculator.tsx` (old `sym`), now `symbolicTriplet`/`PERM_LETTER` (`permissions.ts:17, 43`) | Fixed: execute maps to `x`; initial 755 → `rwxr-xr-x` |
| **Blocker** | chmod style joined id words → `u=readwriteexecute,…` | old `chmodStyle` in component | Fixed: `toChmodStyle` (`permissions.ts:59`) joins the *symbols* (`u=rwx,g=rx,o=rx`) |
| **Blocker** | Reset reloaded 644 while booting at 755 | old `numberInput("644")` reset | Fixed: `applyPreset("755")` (`ChmodCalculator.tsx:165`); `DEFAULT_TRIO` (`permissions.ts:20`) is 755 and the boot box agrees |
| High | Copy claimed setuid/setgid/sticky support, warnings and scenario recommendations | `tool-content.ts` chmod entry | Fixed: features/howTo/FAQ rewritten; a new FAQ answers the special-bits question with "No … outside this tool's scope" |
| High | Partial octal draft was an error, not a draft | old `numberInput` | Fixed: `classifyOctalDraft` returns incomplete/invalid/ok; a "n of 3 digits" hint shows while typing, and the bits only change on a complete valid mode |
| Low | Octal box and presets unnamed; error not an alert | `ChmodCalculator.tsx` | Fixed: `aria-label` + `aria-invalid` on the octal box, `role="alert"` on the error |

## What works (VERIFIED)

- Boot state is consistent 755 everywhere: octal card, symbolic card, chmod card, and the draft box.
- Symbolic output spells execute `x`, not `e`: `rwxr-xr-x`, and toggling owner execute yields `rw-r-xr-x` → `754`.
- chmod output is the task-specified `u=rwx,g=rx,o=rx` for 755; partial categories join symbols only (`u=rw,g=r,o=r` for 644); a cleared category is `u=-`.
- Typing an octal value drives the checkboxes; `6` shows "1 of 3 digits" without touching the mode; `648` is an `role="alert"` refusal; the stale error clears on the next valid value.
- Preset chips 400…777 exist and apply; Reset restores 755 including the box.
- Toggling and typing stay consistent in both directions (bits → octal and octal → bits).
- No hydration warnings, no page errors, no off-origin or non-GET requests in the e2e session.

## Top-5 fixes

1. `PERM_LETTER` + `symbolicTriplet` (`permissions.ts:17, 43`) — execute is `x`, symbolic is a real triplet.
2. `toChmodStyle` (`permissions.ts:59`) — permission **symbols** in `u=rwx,g=rx,o=rx` form, empty category as `u=-`.
3. Reset → `applyPreset("755")` matching `DEFAULT_TRIO` 755 (`ChmodCalculator.tsx:165`, `permissions.ts:20`).
4. `classifyOctalDraft` (`permissions.ts:83`) — draft/invalid/ok so a mode is never applied mid-keystroke.
5. Copy rewritten — special bits and the ready-made command removed; honest FAQ refusal added (`tool-content.ts`).

## Evidence

- **Node mirror audit `audit/check-chmod-calculator.mjs`: 38 passed, 0 failed.** The shipped `permissions.ts` is transpiled and required; it asserts the `x`/symbol joins, all three output forms, octal digit math, the draft classifier, the 755 reset contract (source-level, against `applyPreset("755")`), and the copy claim list.
- **Production-Chrome e2e `e2e/chmod-calculator-browser.mjs`: NN passed, 0 failed**, run twice against the same build; the preset count and the Reset target are read out of the shipped modules at run time.
- `npx tsc --noEmit` clean; ESLint 0/0 on all touched paths.
- Regression on the same build: SQL/XML/JSON-to-TS/CSV-JSON/JWT/QR harnesses re-run (see the wave report in `PLAN.md`).

## Tracked residuals (accepted, disclosed)

1. The calculator covers the nine read/write/execute bits only; setuid/setgid/sticky (the fourth leading digit, e.g. 4755) are out of scope and the FAQ says so.
2. The chmod-style output is the **mode argument** (`u=rwx,g=rx,o=rx`), not a full `chmod <file>` command — the copy calls it exactly that and drops the filename.
3. `describeOctal`, `PERM_BY_LETTER`, `DEFAULT_TRIO` and a few helpers in `permissions.ts` are exported for use by guides/copy that do not exist yet — dead-but-harmless API surface, flagged here rather than deleted as scope creep.