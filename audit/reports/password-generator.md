# Password Generator: Parallel Judges Audit

Date: 2026-09-17. Status: ninth tool upgraded and verified within the coverage
below. Ten independent judges ran in parallel (read-only, no edits).

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| End user | default readout calls a 103-bit recommended password "Weak" (16 chars, all types → 37% red bar); "exclude ambiguous" still leaks I/l/1/O/0/o ~40% of the time (guaranteed-slot path bypasses the filter); toggling options never refreshes the shown password; icon-only Regenerate button matches no "Click Generate" copy; slider has no numeric companion |
| Domain/security | RNG is genuinely unbiased (crypto.getRandomValues + rejection sampling, 1-call per byte, zero Math.random in the path); no network on generate/copy; but the lazy `useState` initializer runs during SSR/statically prerendered HTML — a real fixed password ships on the wire for every visitor; strength `/2.8` divisor compresses the whole scale so default reads Weak while copy recommends 16+; FAQ "80 bits ≈ 10^24 years" off by ~19 orders of magnitude; "Each password is unique" / "10^24 years" / "zero trust" overclaims |
| Architect/a11y | output input unnamed (`textbox name:""`), slider unnamed, no `role=status` on regenerate (keyboard user hears nothing), meter has no role/semantics, checkboxes not in a fieldset, Regenerate/Copy/checkbox targets below 44px, SSR/hydration mismatch from server-side generate, strength pool ignores excludeAmbiguous, no empty-state messaging |
| Code reviewer | exclude-ambiguous bypass confirmed (~29.5% of 400 samples leak); SSR-transmitted password; hardcoded lazy-init duplicates default config; `secureRandomIndex` foot-gun for max<=0 or >256; stale copyable password when all types off; duplicate pool constants + magic 2.8; `.slice(0,len)` redundant |
| Functional tester | PASS: valid default, regenerate differs, slider 6/64, type toggles, copy round-trip; FAIL (verbatim): exclude-ambiguous leaks (4/20), copy claims 4–128 vs real 6–64, "Copied" feedback + stale-clear + unnamed inputs + mobile scrollWidth 454 (site header; tool itself fits) |
| Business | worst-case false advertising: "Generate multiple passwords at once" has no UI; "4 to 128" vs 6–64; entropy + crack-time "displayed" but nowhere in the DOM; "Click 'Generate'" button doesn't exist; ready-to-paste replacement copy supplied (len 6–64, drop batch, honest entropy line, offline/no-upload selling point) |
| Content/SEO | `featureList` template emits "generate and generate" for the Generate category; `toolTitle` produces "free generate tool" (junk suffix for verbs); keyword row had low-value head terms ("secure password", "password maker"); guide claims "passphrases" the tool doesn't have; FAQ "80 bits ~10^24 years" indefensible; supplied replacement keyword array + FAQ additions |
| Performance | prod client footprint identical (byte-for-byte) to sibling tools — 0 marginal cost; generation ~38 µs (len 16) / ~137 µs (len 64) — no hotspot; toggle/slider re-renders negligible; no optimization warranted (`transition-[width,background-color]` instead of `transition-all` only NIT); `next dev` vs `next start` caveat on measurement |
| Security/privacy | zero runtime data leaks confirmed (no requests on generate/copy, no storage, no URL, click-gated clipboard) — but HIGH SSR leak (password baked into statically-prerendered HTML; same value served to every visitor until hydration); `'unsafe-eval'` allowed in script-src (dev/turbopack need — noted, cluster-level); readOnly input needs `autocomplete="off"` + manager ignore hints; missing duty-of-care copy (clipboard persistence, shared devices, untrusted sites) |
| Quality/consistency | every house a11y/UX pattern missing vs Notepad/Base64/QR (status region, alert+explain-empty, focus-visible ring, htmlFor labels, min-h-11, visible-text buttons); checkbox group needs fieldset+legend; secureRandomIndex duplication is worth a shared `lib` helper for the sibling Math.random-based random tools (out of scope here, noted); ToolPreview is the generic upload mock (shared limitation) |

## Changes And Evidence

- `src/features/password-generator/PasswordGenerator.tsx` rebuilt:
  - generation only ever runs **client-side**: `password` inits to `""` and is
    produced in a deferred effect, so the server-rendered/static HTML ships an
    empty value — the SSR/static leak found by three judges is closed (verified:
    `curl` of the served page shows `value=""`, and the live field fills with a
    fresh client-side password). The effect regenerates on any setting change
    (length, char-type toggle, ambiguous-exclusion), so the readout never
    carries a stale value; a `canGenerate` guard clears the field (and disables
    Copy + Regenerate) when every type is unselected instead of throwing on an
    empty pool;
  - the **exclude-ambiguous bypass is fixed**: charsets are stripped per type
    *before* the guaranteed "one of each" slots are drawn, and the same stripped
    pools feed both the guarantee path and the length fill — 0/25 regenerations
    contained `Il1O0o` in the E2E test (previously ~30-40% leaked);
  - **strength meter is honest**: real entropy bits shown as
    `≈ {bits} bits`, meter is `role="meter"` with `aria-valuemin="0"`
    `aria-valuemax="100"` `aria-valuenow` + `aria-valuetext`, and labels map to
    absolute entropy (Weak <60 bits, Good 60-95, Strong ≥96) with the width
    equal to `min(100, bits)`. The default 16-char all-types password now
    correctly reads **Strong / 100 / ≈103 bits** instead of the misleading
    "Weak". The arbitrary `/2.8` norm is gone;
  - output input gets `aria-label="Generated password"`, click-to-select on
    focus, and `autocomplete="off"` / `autoCapitalize="off"` /
    `autoCorrect="off"` plus `data-1p-ignore` / `data-lpignore` /
    `data-form-type="other"` manager-ignore hints (no name/id, per the security
    judge);
  - Char types live in a `<fieldset><legend>`; the length slider is labelled
    via `<label htmlFor>` ("Length: {n} characters"); Regenerate is now a
    visible `icon + "Regenerate"` button with the house `min-h-11`
    focus-visible ring; checkboxes/exclude row got `min-h-11` touch targets and
    outline-vocabulary focus; `securityRandomIndex` throws a RangeError for
    max≤0 / max>256 instead of NaN-spinning; `transition-[width,background-color]`
    replaces `transition-all`; a `sr-only role="status"` region announces
    "New password generated — {n} characters" on manual regenerate (silent on
    auto-regenerates to avoid chatter).
- Copy (`tool-content.ts`): features now match shipped reality exactly —
  "6 to 64 characters", batch claim **deleted**, ambiguous-exclusion lists the
  real set "(I, l, 1, O, 0, o)", "Live strength and entropy indicator (≈ bits
  plus Weak / Good / Strong)" (true now), one-click copy + instant regeneration.
  longDescription drops crack-time/enterprise-policy overclaims and is honest
  about clipboard persistence; howTo says "Click 'Regenerate'" and notes the
  field auto-refreshes; FAQ grew 4 → 6 (added "Is it safe to use an online
  password generator?" and "Can I generate passwords offline?"), the entropy
  answer's "10^24 years" falsehood is replaced with the correct math (2^80
  guesses ≈ millennia at billions/sec), account-storage answer notes clipboard
  persistence on shared devices, and "memorable phrase" pushes back without
  implying a passphrase feature.
- Registry (`tools.ts`): description → "Generate strong random passwords
  offline in your browser — choose length and character types, exclude similar
  letters, and copy in one click. No sign-up, nothing uploaded."
- SEO (`seo.ts`): password-generator row → long-tail terms the page can satisfy
  (strong password generator online, free password generator no sign up,
  offline password generator, password generator with symbols, password
  generator for wifi, password generator 16 characters, strong random password
  online). Shared fixes: `toolTitle()` now maps verb categories to nouns
  (Compress → "free compression tool", Convert → "free conversion tool",
  Generate → "free generator") so "free generate tool" is gone site-wide, and
  the JSON-LD `featureList` template no longer emits "generate and generate"
  for the Generate category.
- Guide (`guides.ts`): retitled to "How to Generate a Strong Password Online"
  (dropped the misleading "Memorable"), description no longer claims a
  passphrase feature ("Tunable length, character sets and similar-letter
  exclusion"), keywords realigned to the long-tails, and the "lean on a
  passphrase" tip now recommends a password manager, `updated` bumped to
  2026-09-16.
- Verification: `e2e/password-browser.mjs` — 29 production Chrome scenarios
  passed (fresh valid 16-char password with one of each type, default rates
  Strong at actual ≈103 bits, regenerate changes it, slider 6/64 auto-resizes,
  lowercase-off regenerates without lowercase, **zero ambiguous chars over 25
  regenerations**, exclusion instantly refreshes the readout, exact clipboard
  copy + "Copied" feedback, all-types-off clears + disables both buttons +
  explains via meter, re-enable regenerates, slider htmlFor label + fieldset +
  meter semantics + status region + output aria-label, 375px no-overflow,
  24-char still strong, and a cross-tool notepad regression). Sibling re-runs
  green: notepad 34, base64 27, url-encoder 19, qr 23. Lint 0 errors / 4
  pre-existing warnings; production build passed.

## Remaining Limits

Not runtime-verified: physical mobile devices, Firefox, Safari, or real
screen-reader passes. The shared `Button`/`CopyButton` components still default
to a compact `px-3 py-1.5` hit area site-wide (this tool compensates locally).
Residual shared items still open: /verify audit wording, physical-browser
matrix, header 375px nav overflow (this tool's own controls fit at 375px, the
site header does not), `image-base64` self-link and
`utf8-converter`/`aes-encryption` reciprocal relatedSlugs edges, `'unsafe-eval'`
in `script-src` (needed by Turbopack dev), and the shared ToolPreview upload
mock shown on non-PDF tools. The sibling random tools (random-number-generator,
random-name-picker, coin-flipper/dice) still use `Math.random()`; sharing the
`secureRandomIndex` helper with them is a trackable follow-up.

Other tools in the registry have not completed this ten-judge process beyond
PDF Compressor, Image Compressor, Image Resizer, JSON Formatter, URL Encoder,
Base64 Encoder & Decoder, QR Code Generator, Notepad, and Password Generator —
114 remaining.

Next tool: Diff Checker, the next entry after password-generator in the
registry.