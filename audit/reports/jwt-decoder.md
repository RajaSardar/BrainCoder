# JWT Decoder: Parallel Judges Audit

Date: 2026-09-30. Status: the tool that was registered as "JWT Decoder &
Verifier" and shipped an HMAC secret box, rebuilt as a decoder that claims
nothing it cannot do. Ten independent judges ran in parallel (read-only, no
edits).

**What ran for this report:** `npx tsc --noEmit` (exit 0), ESLint across all
seven touched files plus the new harness (0 errors, 0 warnings), a production
`npm run build` (309 static pages), and `node audit/check-jwt-decoder.mjs` —
**238 passed, 0 failed**. The production-Chrome harness
`e2e/jwt-decoder-browser.mjs` ran against `next@16.3.4 start -p 3801` —
**41 passed, 0 failed**, reproduced on two consecutive runs against the same
build.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| End user | The old page asked for an HMAC secret on a tool named "Verifier", then silently did nothing for the RS256/ES256 tokens that are nearly all real tokens — the most common case was a dead end with no explanation. It pre-loaded a live-looking demo token on boot, which in a credential tool reads as a real credential. The rebuild is a decoder only: nothing to paste but the token, and the top of the page says so before the input. New gaps found: no exp/nbf/iat verdicts (only formatted dates), no "is it expired" tone, no visible cap, no Clear |
| Domain | RFC 7515 §7.2 requires the JOSE header to be a JSON **object** — the old code accepted `[1,2]` as a header. RFC 4648 §5 base64url forbids `=`, `+`, `/`; the old `-`→`+`/`_`→`/` rewrite silently accepted standard Base64, so a `+` decoded fine here and failed everywhere else. Padding was appended with `while (b.length % 4) b += "="`, which turns an impossible length (mod 4 = 1) into 3 `=` and an opaque `atob` throw. `TextDecoder` was non-fatal, so a binary segment rendered U+FFFD garbage instead of a refusal. No cap. RFC 7519 §7.2 does *not* require the payload to be an object, so a scalar/array payload must decode — the old `Object.entries(parsed.payload)` throws on a `null` payload. All five are fixed; the payload-object requirement was deliberately **not** imposed on the payload |
| Architect | Module-scope `const NOW = Date.now()` fed `useState` — the SSR render used the server clock and hydration re-rendered with the client clock (real hydration-mismatch class, not theoretical). Verification lived in a `useEffect` that returned `undefined` on some paths and a cleanup on others, so it could not be reasoned about. The secret lived in component state for the tool's lifetime for a check that only ever covered HMAC. The rebuild moves every decision into pure functions in `jwt-format.ts` and the component becomes a rendering of `analyzeToken(raw)` — no effects except a clock armed only while a date claim exists |
| Code reviewer | `decodeBase64Url` is written out rather than delegating to `atob`, and that is the point: it is the only way to get the three real refusals (alphabet with 1-based position, impossible length, non-zero unused trailing bits) as *reasons* instead of a boolean. Canonical trailing-bit checking is the subtle part and is covered both ways, so it cannot over-refuse real tokens. Claim ordering is a total order (RFC 7519 §4.1 order, then alpha) so the panel is stable across renders. One residual accepted: `prettyJson` uses `JSON.stringify(_, null, 2)`, which loses duplicate keys — duplicate keys are invalid-ish JSON and the raw copy button still has the exact bytes, so this is disclosed rather than fixed |
| Functional tester | 238-check Node mirror, all passing: alphabet (padding, `+`, `/`, space, newline, NUL with position, DEL by code point, empty, non-canonical trailing bits at both remainders), UTF-8 (2/3/4-byte, invalid, truncated), JSON (not-JSON with quoted reason, truncated preview), structure (1/2/3/4/5 segments, JWE named, bad header, bad payload, header-not-object, empty header, alg:none, unreadable signature), payload shapes (array/string/number/boolean/null all decode, none produce fake claim rows), cap (over, exactly-at, oversize well-formed), claim maths (order, absolute UTC, every relative reading and tone, out-of-range, wrong-type, truncation, non-object). 41 browser scenarios ran green twice in production Chrome against the same fixtures. Getting there exposed four harness defects worth recording, all fixed in the harness rather than the product: a `kid`/`typ` "missing claim" assertion that confused JOSE *header* parameters with RFC 7519 payload claims; a `36 bytes` header-length expectation where the real decoded length is 38; exact-string relative-time assertions that break the moment the page renders a second after the fixture is built; and a `compareDocumentPosition` bitmask asserted as 1 instead of `DOCUMENT_POSITION_FOLLOWING`. One genuine product defect surfaced too and was fixed: a segment-count refusal read "This input has 2." with no unit |
| Business analyst | The old copy ("Verifier", secret field) sold a capability the page did not have; that is the kind of claim that gets a tool reported as misleading. Position the honest version up: the only JWT tools that are *reliable* are the ones that admit the limit. The differentiator is not decoding — jwt.io and 30 sites do it — it is the refusal quality (named reason, byte position, RFC citation) and the claim reading (relative + absolute, `exp`/`nbf`/`iat` verdict). Recommend the differentiator sentence in the meta description. Guide `how-to-decode-a-jwt` added because "how to decode a JWT" has real informational volume and converts into the tool |
| Content/SEO | Registry was the biggest lie: `name: "JWT Decoder & Verifier"`, tagline "Decode and verify", and a description that never mentioned the limit. `tool-content.ts` had no statement of the verification boundary anywhere. Fixed all four surfaces: registry name/tagline/description, long description, features (10, led by the honesty claim), howTo (4 steps, one of which *is* the caveat), FAQ (6, incl. no-JWKS, JWE boundary, non-object payload, attacker-controlled). SEO keyword row kept `jwt expiration checker` only because expiry verdicts are now actually implemented. Guide has 4 sections, `toolSlug: "jwt-decoder"`, 5 keywords; verified resolvable through both `getGuide` and `getGuidesByTool` |
| Security/privacy | All PASS. No `dangerouslySetInnerHTML`, no `innerHTML`, no `atob`, no `Buffer`, no `crypto.subtle`, no `.verify(`, no `fetch`/XHR/beacon, no `jwks`/`.well-known` string anywhere in the component or the helper — asserted, not eyeballed. The helper imports nothing from `node:` and touches no `document`/`window`/`localStorage`. The claim text is rendered as React children only, so a payload of `<img src=x onerror=…>` is text (asserted in the mirror and, in the harness, via a `window.__pwned` probe that must stay `undefined`). New residual worth naming: the old page held a pasted **HMAC secret** in state — removing verification removed a credential-handling surface, which is a privacy improvement, not just a copy change |
| Accessibility | Old page: textarea labelled by a `<p>` (no `label htmlFor`, no `aria-describedby`), no `role="status"`/`role="alert"` at all — a screen reader got the result silently; no `aria-busy`; no Clear; four `CopyButton`s whose names were all just "Copy" (indistinguishable to a screen-reader user); `truncate` on the signature with no accessible full value. New: real `<label htmlFor>` bound with `useId`, `aria-describedby` to the hint (which also carries the live character count), `aria-invalid` tied to the cap, `role="alert"` for refusals, an `sr-only` `role="status" aria-live="polite"` that announces counts *and* the honesty caveat without echoing the error text, three named regions via `role="region" aria-label`, three distinctly-named copy buttons, `role="region"` per panel, `break-all` on every token-derived string, `spellCheck={false}` + `autoComplete="off"`, and `aria-busy={false}` stated honestly because decoding is synchronous |
| Performance | 238 checks run in ~0.43s including a TypeScript transpile and three data-module imports, so the whole decoder is cheap enough to run on every keystroke with no debounce, no `useDeferredValue` and no worker. The cost is bounded by design rather than by throttling: the cap is checked on the raw string *before* scrub, split and decode, so the worst case is one `length` compare on a 256 KB string, and a typical few-hundred-character token decodes in well under a millisecond. The clock `setInterval` is armed only while a date claim is on screen and disarmed with it, so an empty page runs no timer at all |

## Changes And Evidence

- `src/features/jwt-decoder/jwt-format.ts` (new, 560 lines) — all logic, no
  React, no DOM, no Node APIs. `MAX_TOKEN_CHARS = 262_144` +
  `MAX_TOKEN_LABEL`; `decodeBase64Url` (hand-rolled RFC 4648 §5 with
  alphabet/position, impossible-length and trailing-bit refusals);
  `decodeUtf8Text` (fatal `TextDecoder`); `parseJsonSegment`; `analyzeToken`
  returning a discriminated union `empty | too-large | refused | decoded`;
  `claimRows` with the ordered row model; `relativeReading`,
  `formatEpochSeconds`, `describeDuration`, `formatInt`, `prettyJson`,
  `scrubInput`, `isPlainObject`, `describeJsonType`, `describePayloadShape`.
- `src/features/jwt-decoder/JwtDecoder.tsx` (321 insertions, 192 deletions) —
  rebuilt as a rendering of one `analyzeToken` call. Amber "Decoded, not
  verified" banner above the input; empty boot state with no sample token;
  structure panel (per-segment state, encoded chars → decoded bytes,
  `unsecured` on an empty signature); header panel (alg/typ/kid + JSON); payload
  panel with the non-object disclosure; claims panel (registered first, missing
  registered claims listed, `Shown truncated` with the real length); three
  distinctly-named copy buttons; Clear; and a limits box that names all three
  of "does not verify the signature / does not check the token against an
  issuer, a JWKS endpoint or a public key / does not tell you whether a claim is
  true", plus the JWE and attacker-controlled notes.
- Registry (`tools.ts`): `name: "JWT Decoder"`, tagline and description
  rewritten to the honest claim. Category and slug unchanged.
- Copy (`tool-content.ts`): long description states the 262,144-character cap
  and that there is no key and no issuer; 10 features led by the honesty claim;
  4-step howTo; FAQ 6 → includes "does not fetch a JWKS endpoint", "cannot
  decrypt a JWE", the non-object payload answer, and the attacker-controlled
  answer. Related slugs kept.
- SEO (`seo.ts`): keyword row, custom title ("JWT Decoder online — decoded in
  your browser and never verified"), and the JSON-LD feature list, which now
  leads with the honesty claim and describes the real base64url handling.
- Guide (`guides.ts`, +50): `how-to-decode-a-jwt`, `readMinutes: 4`, 4 sections
  opening on decoding-vs-verifying and closing on "It cannot tell you whether a
  token is authentic, only what it says."
- Verification: `node --check` on both new files, `npx tsc --noEmit` exit 0,
  ESLint clean across `src/features/jwt-decoder/`, `tools.ts`,
  `tool-content.ts`, `seo.ts`, `guides.ts` and both harnesses, and
  `node audit/check-jwt-decoder.mjs` — 238 passed, 0 failed. The mirror
  transpiles the shipped module with the repo's own TypeScript compiler and
  imports the real `tool-content.ts` and `guides.ts`, so the content and guide
  assertions are made against the shipped data rather than against a regex
  guess at it.

## Remaining Limits

Runtime-verified: the production build, and the 41-scenario production-Chrome
harness, which passed twice against the same build on port 3801. That covers the
375px overflow arithmetic, the hydration console watch, the DOM-order check on
the honesty banner, and the cross-tool CopyButton check by observation rather
than by inference.

Still not runtime-verified: physical mobile devices, Firefox, Safari, and real
screen-reader passes.

Accepted by design, not fixed: `prettyJson` drops duplicate JSON keys (invalid
JSON in practice; the raw copy button still yields the exact segment); claims
are not followed when they are nested or themselves JWS/JWT; a `Bearer` prefix
and surrounding whitespace are scrubbed but anything else is refused rather than
guessed at; the clock is only read while a date claim exists, so a tab left open
on an expiring token updates once a second but a suspended tab resumes from a
stale reading until the next tick; base64url decoding is strict, so a token
emitted by a non-conforming encoder that used padding or standard-Base64
characters is refused with the reason rather than being coerced.

Shared-system residuals that apply here and are not owned by this tool: the
common `Button` component's touch-target and focus-ring behaviour, the physical
browser matrix, and the still-open `/verify` audit wording elsewhere in the
registry.

Other tools in the registry have not completed this ten-judge process beyond
PDF Compressor, Image Compressor, Image Resizer, JSON Formatter, URL Encoder,
Base64 Encoder & Decoder, and now JWT Decoder — 117 remaining.
