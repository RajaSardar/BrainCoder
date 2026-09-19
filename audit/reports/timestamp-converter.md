# Timestamp Converter: Parallel Judges Audit

Date: 2026-09-19. Status: twelfth tool upgraded and verified within the
coverage below. Ten independent judges ran in parallel (read-only, no edits);
the edge-cases judge returned an empty report (no findings text) — its scope
(failed dates, leap years, DST, round-trips, floats) was instead covered by the
functional tester plus a strict parser written from those cases and asserted in
the harness.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | PASS on canonical seconds/ms conversions and the Now button. FAIL: default state embeds a stale build-time timestamp (`1789786769`, ~3.7h old at test time) that flashes on load; 13-digit ms pasted with the checkbox off is silently ×1000 into year ~56633; the reverse field cannot be typed char-by-char (partial text evicted, e.g. "2024" snapped to a bogus date); date-only "2024-01-05" is read as UTC midnight contradicting the "(local)" label; out-of-range input crashes |
| Technical architect | CRITICAL: uncaught `RangeError: Invalid time value` on out-of-range input — `toISOString()` at the original :19/:84 has no guard; valid range ±8.64e15 ms; `8640000000000` OK, `8640000000001` crashes; `1e308`/`1e400` → Infinity → crashes. HIGH: module-load `Date.now()` default is what causes the SSR hydration mismatch. MEDIUM: reverse field is a controlled input derived from forward state, so typing partial dates is impossible; `parseDate` hardcodes `setIsMs(false)` |
| End-user UX | C1 CRITICAL: reverse field destroys typed input (char-by-char typing produced garbage dates like `2001-02-01 00:00:24`; only paste worked). H1 HIGH: 13-digit ms with checkbox off → year 58686 with zero feedback. No invalid-input feedback at all. ms checkbox affordance/discoverability. 375px |
| Content/SEO | Claim-integrity table: timezone offset configuration NOT implemented; RFC 2822 and "locale-specific formats" NOT implemented; live current timestamp NOT implemented; direction-toggle "choose conversion direction" NOT implemented; "converts as you type" placeholder false (reverse field frozen). relatedSlugs irrelevant. Suggested corrected copy + long-tail keywords supplied |
| Business analyst | Category fit right. MUST: auto-detect 10-vs-13-digit; MUST: live ticking current-time display (explicitly promised by copy, absent). SHOULD: RFC 2822/HTTP-date output; SHOULD: timezone name + offset label. No-uploads/everything-local is the only visible win |
| A11y specialist | HIGH: both text inputs have NO accessible name (`Field` renders `<p>`, placeholder-only name ≈ 3.94:1 contrast). HIGH: no live region (`role=status`) for conversions or errors; silent data loss on invalid input. MEDIUM: placeholder contrast. No `aria-invalid`, no `aria-describedby` |
| Security/privacy | Zero outbound egress PASS (only same-origin Next chunks); XSS PASS (inputs render literally); no storage writes; clipboard only on user click. RangeError render crash flagged as robustness defect |
| Edge cases | *(returned empty)* — covered by functional + the strict parser design below |
| Performance | Perf per keystroke trivial (~0.5ms). FAIL: entering a 20+ digit value crashes at the 13th digit. Same-origin chunking fine (tool module ~1.5KB in a shared ~6-tool chunk, 857KB total wire) |
| SSR/cross-browser | Static HTML embeds build-time timestamp `1789786769`. Hydration mismatch CONFIRMED in Chrome and Firefox — React error #418 ("Hydration failed because the server rendered HTML didn't match the client … Variable input such as Date.now()"). No-JS shows the stale value. Route smoke 200s |

## Changes And Evidence

- `src/features/timestamp-converter/TimestampConverter.tsx` (rebuilt):
  - **Hydration fixed (SSR/cross-browser, architect):** the module-level
    `Date.now()` default is gone entirely. The timestamp input and reverse draft
    now start empty (deterministic server == client), so there are no mismatched
    text/value nodes on hydration. A client-only effect boots to the current
    seconds, fills the reverse draft, and starts a 1-second `nowSec` tick (all
    state writes happen inside `setInterval`/`setTimeout` callbacks — the
    sync `set-state-in-effect` lint rule is respected).
  - **Crash guard (architect, functional, security, perf):** the ts memo only
    accepts `^-?\d+(\.\d+)?$`, rejects non-finite values, and requires
    `|ms| ≤ 8.64e15`. Boundary `8640000000000000` still converts
    (`+275760-09-13T00:00:00.000Z`); one ms over shows a `role=alert`
    validation message with empty cards — the route no longer unmounts to the
    Next error screen. Exponent and hex forms are rejected honestly.
  - **Reverse field (UX, architect, functional):** a separate draft state that
    the forward pipeline never overwrites while it is being edited. New strict
    `parseDateTimeLocal` accepts `YYYY-MM-DD HH:MM:SS` (date-only = local
    midnight, matching the "(local)" label), validates components via
    `setFullYear` round-trip so `2021-02-29`, month 13, day 32 are rejected and
    the year 0–99 range is safe. A complete valid value commits as-you-type;
    invalid text keeps the draft on screen with a message and leaves the
    forward timestamp untouched; blur normalizes to zero-padded local.
  - **13-digit auto-detect (functional, UX, business):** values ≥ 1e12 are
    treated as milliseconds with a `role=status` hint ("13-digit value detected
    — treated as milliseconds"); the checkbox remains an explicit override.
  - **Live clock + RFC 2822 (business, content):** cards are now Local time
    (with timezone name and UTC-offset label computed via
    `Intl.DateTimeFormat` in the client-only effect), UTC, ISO 8601, and
    HTTP date (`toUTCString()`, RFC 2822). A ticking "Current Unix time: …"
    line sits next to the Now button.
  - **Feedback + a11y (a11y, UX):** `aria-label` on both inputs, `aria-invalid`
    + `aria-describedby` wiring, `role=alert` for validation, `role=status`
    for the auto-detect hint, `inputMode="numeric"`, empty input no longer
    implies epoch-0. Error borders on the relevant field.
- `src/lib/tool-content.ts`: the block was rewritten around reality — the five
  fabricated claims (timezone offset configuration, RFC 2822/locale formats,
  live timestamp, direction toggle, conversions "as you type") are replaced by
  the auto-detect, four-format, live-clock, reverse-as-you-type features that
  now exist. FAQ's "64-bit integers" corrected to JavaScript double precision
  (~year 275,760); a FAQ documents strict local parsing semantics.
  relatedSlugs → json-formatter / cron-parser / http-status / jwt-decoder /
  uuid-generator (each verified present in `tools.ts`).
- `src/lib/seo.ts`: timestamp keywords expanded (unix timestamp to datetime,
  date to epoch converter, current unix timestamp, ms to seconds converter);
  JSON-LD `TOOL_FEATURE_LIST` override added; the regex-tester override still
  saying "worker-isolated safety timeout" fixed to the shipped gate wording.
- `src/lib/tools.ts`: description updated to match what is shipped ("Convert
  Unix timestamps to local time, UTC, ISO 8601 or HTTP date — and the reverse.").

## Verification

- Production build passes (285 pages).
- New harness `e2e/timestamp-converter-browser.mjs`: **43 production Chrome
  scenarios passed** — boot auto-fill + 4 cards + ticking current-time line,
  no hydration errors across the whole session (#418 gone in Chrome), seconds
  conversion checked against Node-computed local/UTC/ISO/HTTP values,
  13-digit auto-detect with `role=status` hint, explicit-ms override and
  restore, float and negative (pre-1970) seconds, 8.64e15 boundary conversion,
  one-ms-over boundary guarded, oversized integer / `1e309` / `abc` all
  alerts with the tool still mounted and zero page errors, reverse field typed
  char-by-char without clobbering, date-only = local midnight, invalid leap
  day rejected while forward stays unchanged, valid leap day commits, local
  card text round-trips exactly, Now sets near-current seconds and clears the
  ms checkbox, live tick advances, 4 copy buttons and clipboard contains the
  card value on click, aria-labels/aria-invalid/role=alert presence, and both
  routes 200 with corrected 2038 wording reachable on /tools/. 0 console
  errors (apart from the known localhost Vercel insights 404 noise).
- Sibling re-runs green: json-formatter 15/15, text-size-calculator 24/24,
  regex-tester 39/39, word-counter spot check (3 words) — plus
  `/tools/timestamp-converter` 200.

## Residuals

- The shared `CopyButton` "Copied" indicator flips and reverts reliably as a
  DOM mutation, but is timing-flaky to assert under headless Chrome, so the
  harness asserts the meaningful guarantee (clipboard content == card value).
- RFC 2822 output is GMT-labeled via `toUTCString()`, as the HTTP-date
  standard, not forced into a chosen zone.
- DST-ambiguous local times resolve to the browser's default interpretation;
  no ambiguity picker. Date-only local-midnight semantics are as documented.
- Reverse year field is exactly 4 digits (0000–9999); parsing years beyond
  9999 would require an expanded input.
- Edge-cases judge returned no report (scope handled by the strict parser +
  harness cases above).
- Whole-site residuals tracked elsewhere (site-header 375px navigation
  overflow, `'unsafe-eval'` in CSP script-src, `/verify` wording, ToolPreview
  uploads mocked, physical mobile/Safari/Firefox not tested locally — Chrome
  headless only).