# URL Encoder: Parallel Judges Audit

Date: 2026-09-16. Status: fifth tool upgraded and verified within the coverage
below. Like Image Resizer and JSON Formatter, its ten judges ran in parallel.
The shared CopyButton component was given a minor a11y improvement as part of
this batch.

## Ten Independent Judges

Each judge was a separate agent; none was replaced with a single agent
pretending to be all ten experts. They were launched concurrently because they
are read-only and independent.

| Expert | Main findings |
| --- | --- |
| End user | Default component-on mangles a full URL contradicting the FAQ; error masquerades as copyable output; decode of non-encoded text silently passes; "Use result as input" double-click footgun; no char counts |
| Domain | "RFC 3986 compliant" overstated (encodeURIComponent leaves !'()* unencoded); checkbox label omits decode axis; error text wrong for encode mode; lone surrogates throw URIError, not silently handled |
| Technical architect | Error writes into output textarea then is fed back by swap; checkbox governs both encode/decode while label only names encode; no aria-pressed / radiogroup; both textareas unlabeled; readOnly output in tab order; decodeURI leaves reserved escapes intact (silent no-op) |
| Code reviewer | Self-perpetuating error-text round-trip; checkbox label mismatched to effect; no guard on "Use result as input"; mode-specific error message missing; exact string assertions for harness listed |
| Functional tester | Full browser test plan with two behaviour-FAILs (default encode destroys full URL structure, decode-mode leaves component-encoded URLs untouched), one a11y GAP (no aria-labels), five 375-mobile expected PASS; CopyButton regression scenario recommended |
| Business analyst | 3 false copy claims (RFC 3986, "click encode or decode," default preserves structure); real differentiator is the component/whole-URL toggle + round-trip verify loop; recommends tighter tagline |
| Content/SEO | Verified accurate/inaccurate claims row-by-row; proposed honest longDescription/features/howTo/faq, new `how-to-encode-a-url` guide, cleaned seo keywords and relatedSlugs (url-parser + html-entities over slug-generator); `toolKeywords()` shared bug with & junk noted |
| Security/privacy | 100% client-side (confirmed no fetch/XHR/WebSocket), no clipboard exfiltration, javascript:/data: never rendered as links, error text is unambiguous, CSP and analytics scoped; CopyButton fallback always reported success regardless |
| Accessibility | Encode/Decode lack radiogroup semantics (WCAG 1.3.1/4.1.2); no aria-label on either textarea; no focus-visible ring on mode buttons; error text is inline data not role=alert; readOnly output in tab order with no live region; checkbox hides dual decode effect; CopyButton "Copied" not announced; touch targets < 44px |
| Performance | Transform is fast native O(n) per keystroke — debouncing/delay NOT warranted (confirmed by independent measurements); optional 2MB cap for parity recommended; CopyButton had no wasteful clones |

Consolidated critical/important defects matched across judges and fixed.

## Changes And Evidence

- `src/features/url-encoder/UrlEncoder.tsx` rebuilt: error is now a separate
  `{output, error}` state returned from `useMemo`, rendered in a `role="alert"`
  block with dismiss button — never written into the output textarea, never
  copyable, never fed back by swap; error text is mode-specific ("could not
  encode" vs "could not decode"); checkbox is now encode-only (hidden in decode
  mode) with a two-state label describing exactly what each setting encodes;
  encode/decode are a radiogroup with `role="radio"` + `aria-checked`; both
  textareas are labeled (htmlFor + aria-label); output gets `tabIndex={-1}`;
  "Use result as input" is disabled when output is empty or error; Clear is
  disabled when empty; a whole-URL hint surfaces when component mode is on and
  the input matches a scheme:// prefix; a 2 MB input cap is enforced with a
  visible notice; the sr-only status live region announces output updates;
  min-h-11 touch targets on mode buttons; focus-visible rings on all controls.
- `src/components/ui/index.tsx` (CopyButton only): icons get `aria-hidden="true"`;
  a visually-hidden `<span role="status">` announces "Copied to clipboard";
  success is gated — `setCopied(true)` only after clipboard write or successful
  `execCommand("copy")` return; the shared component remains otherwise unchanged.
- Content (`tool-content.ts`): longDescription, features, howTo and FAQ rewritten
  honestly — RFC 3986 strict claim removed, what the two encoding modes actually
  do is explained, "no button to press" corrects the false click-to-convert
  step, FAQ on full-URL encoding now explains both modes, new decode-error FAQ,
  relatedSlugs updated to `url-parser, html-entities, utf8-converter, base64`.
- SEO (`seo.ts`): keyword row cleaned — removed low-airlift jargon ("encodeuri
  component online", "percent encoding"), added honest high-intent phrases
  ("encode url component online", "url percent encoder", "decode url component
  online", "encode url online").
- Registry (`tools.ts`): tagline updated to "Percent-encode URLs or single
  values — round-trip verified".
- Guide (`guides.ts`): new `how-to-encode-a-url` with toolSlug, covering
  percent-encoding, the two encoding modes, live output, error behaviour and
  double-encoding avoidance. Production build: 283 pages (was 282).
- Verification: 19 production Chrome scenarios (`e2e/url-encoder-browser.mjs`)
  passed: page load, default state, component/whole-URL exact encode outputs,
  whole-URL hint appear/clear, decode mode hides checkbox, strict decoder
  reverses full component-encoded URL, invalid decode error alert + dismiss,
  encode-mode lone-surrogate wording, "Use result as input" double round-trip,
  clear coalescing, 2MB refusal + notice clearing, 375px mobile no-overflow,
  and a cross-tool CopyButton regression scenario confirming the shared a11y
  edit didn't break the formatted-copy flow on JSON Formatter. The stale
  `__next-route-announcer__` is excluded from all role=alert/status assertions.
  No separate node harness was written: the transform is one native call per
  direction with no extracted shared module to unit-test.
  Production build passed (283 pages), targeted lint exit 0.

## Remaining Limits

Not runtime-verified: physical mobile devices, Firefox, Safari, real
screen-reader passes, or lone-surrogate round-trip fidelity (the lone-surrogate
encode now surfaces a proper error message rather than silently corrupting).
The checkbox is hidden in decode mode by design; a future enhancement could
expose an optional whole-URL decode for advanced users. The shared CopyButton
min-h-11 target size and full announcement UX remain a shared-system residual;
the button was not enlarged in this batch. The shared /verify audit wording and
coverage concerns remain pending, not silently certified by this tool's tests.

Other tool worktree changes found at session start were preserved, not approved
or counted as completed audits. No other tool has completed the ten-judge
process beyond PDF Compressor, Image Compressor, Image Resizer, JSON Formatter,
and URL Encoder.

Next tool: Base64 Encoder & Decoder, the next entry after URL Encoder in the
registry.