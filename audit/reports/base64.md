# Base64 Encoder & Decoder: Parallel Judges Audit

Date: 2026-09-16. Status: sixth tool upgraded and verified within the coverage
below. Like earlier batches, ten independent judges ran in parallel (read-only,
no edits). This batch completed in the same session as the domain switch to
`braincoder.sardar.dev` (committed separately).

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| End user | text round-trips are exact incl. Unicode/emoji; howTo falsely says "click Encode"/"click Decode" though conversion is live; URL-safe checkbox's effect is invisible for many inputs; error string masquerade is gone; 1MB+ works but there is no cap |
| Domain | core helpers (btoa/TextEncoder/atob/TextDecoder, base64url per RFC 4648 §5, padding normalization) ACCEPT; two fixes: mod-1 (truncated) input silently passes to atob with a misleading message, and "bit-perfect accuracy" / "binary … Unicode-safe" copy is false because decode is UTF-8-only (silent U+FFFD corruption) |
| Architect | mode toggle uses aria-pressed/group instead of radiogroup/radio; no 2MB cap; no dismiss on the error alert; output has no live char count; live region double-announces the full error (same text in role=alert AND sr-only status); swap double-encodes because it never flips mode |
| Code reviewer | swap double-encode confirmed (critical behavioral bug); TextDecoder fatal:false silently corrupts binary; mod-1 never valid → needs explicit rejection; error message cause mismatch for truncation; curly-quote lint detail; keep array+join encode |
| Functional tester | 31-scenario plan: 24 PASS, 8 Fails — highest = swap double-encode; also missing focus-visible, no char count, always-enabled Clear, unassociated output label, no cap; exact verbatim assertions provided for the harness |
| Business analyst | copy truthfulness: "bit-perfect accuracy" and "binary data Unicode-safe" are false; howTo click steps contradict "real time as you type"; FAQ accurate but missing URL-safe, binary-caveat, JWT; differentiator to champion = live conversion + built-in base64url for JWT/URL contexts |
| Content/SEO | keyword row has high-airlift terms the page can't rank for; recommended long-tail swaps; &-amp junk in meta keywords via shared `toolKeywords()` split (name "Base64 Encoder & Decoder"); proposed guide, 2 new FAQs, relatedSlugs change (drop aes-encryption, add utf8-converter + url-encoder); corrected `Guide` field is `description`, not `seoDescription` |
| Security/privacy | all PASS: 100% client-side, CSP blocks any network call, no eval/innerHTML path, clipboard is click-gated; two findings: no JWT "plaintext payload / signature unverified" duty-of-care copy, and missing input size guard |
| Accessibility | 5 FAILs/5 CONs: radiogroup semantics, error double-speech, focus-visible ring missing on mode buttons + shared Button, ~36px touch targets (need min-h-11), output tab order (needs tabIndex=-1), plus aria-invalid/aria-describedby error association and output label alignment |
| Performance | measured 1MB→166ms, 2MB→322ms, 5MB→1013ms, 10MB→1.9s main-thread blocks; debounce rejected; useDeferredValue weakly warranted; 2MB cap parity recommended on evidence; array+join confirmed 4.6x faster than +=; 2MB keeps mobile freeze ~under 1s |

## Changes And Evidence

- `src/features/base64/Base64Tool.tsx` rebuilt: mode toggle is now
  `<fieldset>`+sr-only `<legend>`+`role="radiogroup"` with `role="radio"`
  `aria-checked` buttons, `min-h-11` and `focus-visible` ring; URL-safe checkbox
  kept encode-only with implicit label; 2MB cap with visible "Input is limited
  to 2 MB." notice; decode now has three distinct honest errors — truncation
  (mod-1 padded length), invalid characters, and binary-not-UTF-8 (decoder set
  to `fatal: true` so raw bytes error out instead of silently printing U+FFFD);
  role=alert carries an id + Dismiss button, input gets `aria-invalid` and
  `aria-describedby`; sr-only live region announces "Invalid input." instead of
  echoing the full error, and never duplicates the over-limit notice; output
  shows a live character count, is labelled "Output", and is pulled out of tab
  order; Clear is disabled when empty; swap flips mode and round-trips text
  (was double-encoding — the critical bug), disabled on error/empty. No
  debounce/useDeferredValue (perf judge: cap is the fix, not deferring).
- Copy (`tool-content.ts`): longDescription rewritten to three honest blocks —
  removes the "bit-perfect accuracy" binary overclaim, states URL-safe support
  and that binary sources report an error instead of printing garbage; features
  list updated to implemented reality ("no button to press"); howTo has zero
  false "click Encode/Decode" steps; FAQs grew 4 → 7 (added standard vs
  URL-safe, image/file decode error, JWT plaintext + signature caveat);
  relatedSlugs → `binary-text, image-base64, utf8-converter, url-encoder`.
- Registry (`tools.ts`): tagline "Encode text to Base64 and back — URL-safe
  included"; description rewritten honestly (dropped "binary data … Unicode-safe").
- SEO (`seo.ts`): base64 keyword row → long-tail terms this page can actually
  satisfy (base64 encode decode online, text to base64, base64 to text,
  base64url, utf-8 base64 encoder, base64 string to plain text). Shared fix:
  `toolKeywords()` now filters split-name tokens to `[a-z0-9]+` so the "&" in
  "Base64 Encoder & Decoder" no longer leaks a junk `& tool` token into meta
  keywords tags for every ampersand-named tool.
- Guide (`guides.ts`): new `how-to-encode-and-decode-base64` (fields match the
  `Guide` interface incl. `description`), 3 sections covering alphabet+use
  cases, padding + base64url, and text-vs-binary decoding, `toolSlug: "base64"`.
- Verification: production build 284 pages (was 283; +1 guide), targeted lint
  exit 0, and `e2e/base64-browser.mjs` — 27 production Chrome scenarios passed
  (round-trips incl. Unicode/emoji/combining marks, padding variants,
  unpadded + whitespace-tolerant decode, URL-safe encode + auto-detect decode,
  three distinct error paths, dismiss + recovery, swap mode-flip round trip,
  2MB refusal and recovery, 375px mobile no-overflow, radio semantics, and a
  cross-tool CopyButton regression on JSON Formatter). The `__next-route-announcer__`
  region is excluded from all role=alert assertions.

## Remaining Limits

Not runtime-verified: physical mobile devices, Firefox, Safari, or real
screen-reader passes. The shared `Button` component still lacks an always-on
`focus-visible` ring (base64 passes focus-visible on its own buttons but the
shared component gap applies site-wide and remains a shared-system residual).
Residual shared items still open: /verify audit wording, physical-browser
matrix, header 375px nav overflow, `image-base64` self-link and
`utf8-converter`/`aes-encryption` reciprocal relatedSlugs edges. The decode is
UTF-8-text-only by design and now documents that constraint honestly rather
than silently corrupting binary input.

Other tools in the registry have not completed this ten-judge process beyond
PDF Compressor, Image Compressor, Image Resizer, JSON Formatter, URL Encoder,
and Base64 Encoder & Decoder — 118 remaining.

Next tool: Notepad, the next entry after base64 in the registry.