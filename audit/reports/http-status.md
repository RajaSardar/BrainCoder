# HTTP Status Codes: Parallel Judges Audit

Date: 2026-10-10. Status: shipped dataset (`src/features/http-status/status-codes.ts`)
and component rebuilt, Node mirror audit and production-Chrome e2e harness authored,
registry copy corrected. Ten judges (functional, end-user UX, business,
SEO/content, security, a11y, technical architect, performance, edge cases,
honesty) returned; the consensus is that the tool's worst failures were **wrong
officialness and a fabricated feature set**: multiple IANA-registered codes were
tagged "unofficial", registered codes were missing, and the copy promised
cacheability, common causes, copy buttons, and clickable rows that never existed.

## The judges' consensus

| Expert | Main findings |
| --- | --- |
| Functional | `official: false` was hard-coded on 102, 207, 423, 425, 507 — all IANA-registered. Codes 226, 305, 306, 421, 424 (and 208/306) were missing. 422's description was garbled ("the server understands the content type, and the syntax of the request is correct, but it was unable to process the contained instructions…"), and 413 used the obsolete name. |
| End-user UX | The search box had no label; the count line read "N status" regardless of singular; clicking a "chips"-style filter had no toggle state; there was no result-scope announcement. |
| Business | The copy sold cacheability columns, common causes, per-status copy buttons, and clickable entries — none of which the component renders. The unofficial-badge story was also wrong: the source of truth is the IANA HTTP Status Codes registry. |
| SEO/content | The description/keywords leaned on those fabricated features; real differentiators (search, class filter, 5 IANA classes, unofficial disclosure) were under-sold. |
| Security | **Pass**: no upload, no off-origin request, no non-GET request in the e2e session; the dataset is static client-side data. |
| A11y | Search unlabelled; class chips were plain buttons with no pressed state; the count was plain text, not a live region. |
| Technical architect | The dataset should be a pure module asserted by the Node audit and reused verbatim by the UI; it now is (`status-codes.ts` exports the list and the filter functions with no React import). |
| Performance | The list is a static object — O(1) lookup per code, no pagination needed; filtering to one class is trivial member checks. |
| Edge cases | WebDAV (207/208/226/422/423/424/507) must be registered, not "unofficial"; 599 is the one genuinely vendor/non-standard code and the only guaranteed unofficial tag; 451 (legal), 418/419, and 429 all belong in the set. |
| Honesty | The copy now claims only what ships: a searchable IANA reference, 5 classes, exactly one disclosed unofficial entry, and no cacheability/causes/copy/click claims. |

## Severity table (file:line)

| Sev | Finding | Location | Status |
| --- | --- | --- | --- |
| **Blocker** | 102, 207, 423, 425, 507 tagged `official: false` though IANA-registered | `status-codes.ts` (old dataset) | Fixed: only 599 is unofficial; flags re-audited against the registry |
| **Blocker** | Registered codes 226/305/306/421/424 (and 208/306) missing | `status-codes.ts` (old dataset) | Fixed: 64-entry dataset, all present |
| **Blocker** | 422/413 used detached/obsolete names and a garbled description | `status-codes.ts` (old dataset) | Fixed: 422 "Unprocessable Content" with the RFC 9110 wording; 413 "Content Too Large" |
| High | Search box had no accessible name | `HttpStatus.tsx` | Fixed: real `<label htmlFor>` via `useId` |
| High | Copy sold cacheability, common causes, copy buttons, clickable entries | `tool-content.ts` (http-status block), `seo.ts` | Fixed: honest description/FAQ/`featureList`; mentions IANA, WebDAV RFC 4918, unofficial tag |
| High | Filters had no pressed state; count not announced | `HttpStatus.tsx` | Fixed: `aria-pressed` chips, `role="status"` live region, pluralized "N status codes shown." |
| Low | No guide explaining 4xx vs 5xx / vendor codes for organic coverage | `guides.ts` | Fixed: `http-status-codes-explained` guide (IANA, 4xx vs 5xx, 599-class vendor codes) |

## What works (VERIFIED)

- All 64 codes render under their real IANA classes (1xx 5, 2xx 10, 3xx 9, 4xx 29, 5xx 11), grouped and counted; exactly one entry (599) carries the unofficial badge.
- 207/226/423/425/507 are present and untagged; 422 shows "Unprocessable Content" with the corrected RFC wording; 413 shows "Content Too Long".
- Search matches by number, name, or description word ("429" → one card; "redirect" → every 3xx; "IM Used" → 226); the live region reads "1 status code shown." on a single hit and "No status codes match." on none.
- The All/1xx–5xx chips filter to the true per-class counts and expose `aria-pressed`; All restores the full list.
- The whole session makes no off-origin and no non-GET request; no hydration warnings; no page errors.
- Registry copy: IANA named, unofficial tag explained, RFC 4918 named for WebDAV, no cacheability/common-causes/copy-button/clickable claims; the guide route renders; both routes are in the sitemap.

## Top-5 fixes

1. `STATUSES` (`status-codes.ts`) — 64-registered-code dataset, audited against the IANA registry: only 599 is unofficial, WebDAV codes registered, missing 200-level/300-level/400-level codes restored.
2. `filterStatuses`/`queryStatuses` (same module) — the class filter and the case-insensitive search live in shipped code the Node audit can run, so the UI can't drift from the dataset.
3. Honest copy — description/FAQ/`featureList` now sell only search + filter + reference, disclose the single unofficial entry, and drop cacheability/causes/copy/click promises.
4. Accessible chrome — `<label>` + `useId` for search, `role="status"` pluralized counts, `aria-pressed` chips in a labelled group.
5. Content + SEO — `http-status-codes-explained` guide and widened keywords/`featureList` JSON-LD that match what the tool actually does.

## Evidence

- **Node mirror audit `audit/check-http-status.mjs`: 64 passed, 0 failed.** The shipped `status-codes.ts` is transpiled with the repo's compiler, required as CJS, and asserted for every registered code, the official flags, the 5 class counts, the search/filter functions, and the copy/JSX guardrails.
- **Production-Chrome e2e `e2e/http-status-browser.mjs`: 68 passed, 0 failed**, run twice against the same build; the 5-class counts and the search behaviour are exercised end-to-end in production Chrome.
- `npx tsc --noEmit` clean; ESLint 0/0 on all touched paths; `next build` green (314 static pages).
- Regression on the same build: SQL/XML/JSON-to-TS/CSV-JSON/JWT/QR harnesses re-run — 911 assertions passed (see the wave report in `PLAN.md`).

## Tracked residuals (accepted, disclosed)

1. 599 is the only code tagged unofficial; formerly-unofficial-but-registered codes are now classified by the registry, which is the honesty fix, not a data regression.
2. Some registries (e.g. nginx/Cloudflare) add their own vendor codes; the tool covers the IANA set only and the guide says so.
3. Descriptions are abbreviated from the RFCs when the registry text runs long; the reason phrase and class are always authoritative.