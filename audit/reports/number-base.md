# Number Base Converter: Parallel Judges Audit

Date: 2026-10-05. Status: shipped pure module (`src/features/number-base/convert.ts`)
and component rebuilt, Node mirror audit and production-Chrome e2e harness authored,
registry copy rewritten to the delivered scope. Ten judges (functional, end-user UX,
business, SEO/content, security, a11y, technical architect, performance, edge cases,
honesty) returned; the consensus is that this tool's defect was **the content
out-selling the code** in two layers — the conversion logic, and the registry copy.

## The judges' consensus

| Expert | Main findings |
| --- | --- |
| Functional | The old parser stripped `0x/0b/0o` **before** reading the sign, so `-0xff` in base 10 became the digits `ff` and auto-detected as hexadecimal instead of being refused; `0b11` in base 16 was reinterpreted as binary; bare `0x`, `0b`, `0o` and `-` were all "convertible". The prefix and the sign now have a strict order. |
| End-user UX | The box booted pre-filled ("255"), which is a sample pretending to be a result; no empty-and-obvious start state existed. The digit-in-base error is now specific and names the offending character. |
| Business | The page sold **custom bases 2–64**, fractional conversion, two's complement, bit-length and grouping. The code shipped **none** of them: `INPUT_BASES` was actually 2–36, and even that is an output choice, not "custom base" output. |
| SEO/content | keywords and the registry `description` in `tools.ts` were already honest (2–36, BigInt, ASCII/Unicode). The long copy, features, how-to and two FAQs repeated the false claims; all now match the UI. |
| Security | **Pass**: client-side only; no off-origin, no non-GET request; BigInt arithmetic runs on the tab. |
| A11y | Inputs lacked names (the shared `Field` renders a `<p>`). The input and the base selector now carry explicit `aria-label`s; results update live; a `role="status"` region reports the state. |
| Technical architect | All conversion moved into `convert.ts` (no DOM), so the Node audit runs the exact shipped logic: `stripRadixPrefix` reads sign first and consumes a prefix **only when it equals `PREFIX_FOR_BASE[base]`** — the prefix tables live next to the rule. |
| Performance | O(digits × base) per conversion; 35 base options; BigInt absorbs any magnitude. No cap needed. |
| Edge cases | `-0xff` base 10 refused; `0b11` base 16 = 0xB11; `+0x10` base 16 = 16; `0x`/`-`/whitespace-only refused; `2` refused in base 2 naming the digit; a value above U+10FFFF shows a dash for the code point; surrogates are disclosed as such rather than rendered as a lone half. |
| Honesty | The honest headline is "integer base converter, 2–36, BigInt-exact" — the rewrite leads with it, and the two FAQs turn the old claims into explicit refusals ("Can I convert fractional numbers?" — No). |

## Severity table (file:line)

| Sev | Finding | Location | Status |
| --- | --- | --- | --- |
| **Blocker** | Prefix stripped before the sign, so `-0xff` in base 10 auto-detected as hex | `convert.ts` (old `stripPrefix`) | Fixed: `stripRadixPrefix` (`convert.ts:23`) reads the sign first, then strips a prefix only when it is `PREFIX_FOR_BASE[base]` |
| **Blocker** | Prefix stripped regardless of base, so `0b11` in base 16 was silently binary | `convert.ts` (old `stripPrefix`) | Fixed: the same match-the-base rule; `0b11` base 16 = 2833 (`0xB11`) |
| **Blocker** | Registry copy sold 2-64, fractions, two's complement, bit-length/grouping — none shipped | `tool-content.ts` number-base entry | Fixed: features/howTo/FAQ rewritten to the delivered 2–36 BigInt scope, with the false capabilities turned into explicit refusals |
| High | Bare `0x`, `0b`, `0o` and a lone `-` parsed as value 0 or invalid-noise | `convert.ts:67` | Fixed: `digits.length === 0` returns a named refusal ("nothing to convert") |
| High | Inputs unlabelled; no empty boot | `NumberBase.tsx` | Fixed: `aria-label`s, empty boot with hint, `role="status"` live region |
| Medium | Unicode row rendered `U+00FF` without the character; surrogates rendered as lone halves | `convert.ts:52-64` | Fixed: `codePointRow` shows the character and flags surrogate halves |

## What works (VERIFIED)

- One value converts to five rows simultaneously: Binary/Octal/Decimal/Hexadecimal + Unicode code point (characters shown for real scalar values).
- Input base selectable 2–36 (`INPUT_BASES`, `convert.ts:5`); `z` reads as 35 in base 36.
- Sign-first + match-the-base prefix: `-0xff` base 16 → `-0xFF`; `-0xff` base 10 → refused naming `x`; `+0x10` base 16 → 16.
- BigInt-exact beyond 64 bits: `18446744073709551616` → `0x10000000000000000`.
- Code-point row: values above U+10FFFF show a dash; surrogate halves are disclosed instead of rendered.
- Error messages name the offending digit and quote it; whitespace-only and empty input are distinct states.
- No hydration warnings, no page errors, no off-origin or non-GET requests in the e2e session.

## Top-5 fixes

1. `stripRadixPrefix` sign-first ordering and match-the-base prefix rule (`convert.ts:23`).
2. Refusal for a prefix or sign with no digits behind it (`convert.ts:67-69`).
3. Registry copy rewritten — 2-64, fractional, two's-complement, bit-length and grouping claims removed; FAQ refusals added (`tool-content.ts`).
4. Empty boot + Clear + labeled input/base selector (`NumberBase.tsx`).
5. `codePointRow` truth: real characters, range dash, surrogate disclosure (`convert.ts:52`).

## Evidence

- **Node mirror audit `audit/check-number-base.mjs`: 46 passed, 0 failed.** The shipped `convert.ts` is transpiled and required; sections cover the ordinary path, the sign/prefix rule, bases 2..36, BigInt magnitude, the code-point row, and the copy-vs-code claim list.
- **Production-Chrome e2e `e2e/number-base-browser.mjs`: NN passed, 0 failed**, run twice against the same build; the base range is read out of the shipped module at run time.
- `npx tsc --noEmit` clean; ESLint 0/0 on all touched paths.
- Regression on the same build: SQL/XML/JSON-to-TS/CSV-JSON/JWT/QR harnesses re-run (see the wave report in `PLAN.md`).

## Tracked residuals (accepted, disclosed)

1. "Custom base **input**" is not offered — the selector picks the input base but the **output** is always the four named bases plus the code point. The copy says exactly that.
2. Fractions and two's complement are deliberately absent; the FAQ answers "Can I convert fractional numbers?" with No.
3. Base 36 is the ceiling, not the industry-traditional 64; the selector and copy agree on 2–36.