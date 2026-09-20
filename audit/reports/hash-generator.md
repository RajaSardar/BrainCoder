# Hash Generator: Parallel Judges Audit

Date: 2026-09-20. Status: thirteenth tool upgraded and verified within the
coverage below. Part of the three-tool Wave 1 run (hash-generator,
markdown-preview, html-minifier) judged simultaneously. Hash ran the full
the judge set in parallel; the technical-architect report was not returned
(aborted after timing out), and the missing coverage (algorithm selection
guard, digest correctness) was independently covered by the functional,
security and edge-case judges plus the harness assertions in this report.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | PASS on SHA-1/SHA-256 digests and copy. FAIL: boots pre-filled with "Hello, world!" — noise that gets hashed and pasted; stale results are left behind when Clear empties the box (results + copy buttons stay filled for the previous input); input has no length cap |
| Technical architect | *(not returned — aborted)* — covered by functional/security/edge findings + the digest + race assertions below |
| End-user UX | FAIL: fresh-visit "Hello, world!" sample confuses; no empty/placeholder state; Clear leaves results stale; busy state invisible during hashing |
| Content/SEO | Claim-integrity: "multiple formats (hex/binary/base64)" NOT implemented (hex only); "MD5 including" promise NOT implemented (SHA family only — a real data-integrity risk, since MD5 users get a different hash with zero warning); tagline/article copy padded; FAQ sparse |
| Business analyst | Correct positioning (checksums, integrity, no uploads). MUST: start empty, stop overpromising MD5/multi-format. SHOULD: copy-all, per-algorithm clarity, honest pointer for MD5 users |
| A11y specialist | HIGH: results are a plain grid with no live region — nothing announces when hashes appear; copy buttons indistinguishable from each other by name; pending state invisible |
| Security/privacy | PASS: Web Crypto only, zero egress. MEDIUM: no `crypto.subtle` availability guard — a browser without it would throw and leave the component unusable; unused raw material stays in the page's memory (hex-only output keeps memory pressure low but input remains) |
| Edge cases | Empty string, whitespace-only and huge input behavior unspecified; rapid retype must settle on the latest value (no stale digests); paste of large blocks should not jank on every keystroke |
| Performance | Digest cost is trivial for 1MB, but every keystroke triggers a recompute — debounced; no cap means 100MB pastes run unbounded |
| SSR/cross-browser | PASS: deterministic SSR (no Date.now, no crypto in prerender). Route smoke 200s. Sanitization of the empty state needed to keep SSR == client |

## Changes And Evidence

- `src/features/hash-generator/HashGenerator.tsx` (rebuilt):
  - **Empty boot (UX, functional, business):** input starts empty and results
    show an em-dash placeholder; the old "Hello, world!" default is gone
    (no accidental pasting of demo text, deterministic SSR).
  - **Debounce + cap (perf, edge):** 150ms `setTimeout` debounce settles rapid
    retyping on the latest input (cancelled-timer race is gone); input capped at
    1,000,000 chars with a disclosed cap note. An `aria-busy` pending flag rides
    on the results live region.
  - **Web Crypto guard (security):** if `crypto.subtle` is unavailable the
    component renders a `role=alert` explanation instead of throwing.
  - **Honest output (content, business):** only SHA-1/SHA-256/SHA-384/SHA-512
    hex are computed — the false "MD5 included" and "multiple formats
    (hex/binary/base64)" claims are gone from copy, FAQ points MD5/CRC users to
    the Checksum Calculator tool.
  - **Clear resets everything (UX, functional):** Clear empties the input AND
    restores the placeholder state with copy buttons disabled — no stale
    hashes for the previous input.
  - **Copy-all (business, UX):** a "Copy all" button writes all four algorithm
    lines to the clipboard; enabled only when there is input.
  - **A11y (a11y):** results container is `role=status` + `aria-live=polite` +
    `aria-busy`; per-algorithm copy buttons carry distinct `aria-label`s
    ("Copy SHA-256 hash", …); copy-all has its own label; placeholder text
    uses a sufficient-contrast slate tone.
- `src/components/ui/index.tsx`: shared `CopyButton` gained an optional
  `ariaLabel` prop (defaults to the existing label) so tools can give each
  copy action a distinct accessible name.
- `src/lib/tool-content.ts`: hash-generator block rewritten around reality —
  hex-only SHA-1/SHA-256/SHA-384/SHA-512, debounced, local-only; the honest MD5
  disclaimer + Checksum Calculator pointer documented in a FAQ; features/howTo
  match the shipped empty-boot + copy-all + cap behavior.
- `src/lib/seo.ts`: keywords updated (dropped "md5 generator", added sha384,
  sha512, "hash text to sha256"); tool-specific JSON-LD featureList override
  added.

## Verification

- `npx tsc --noEmit` and eslint pass; production build passes (287 pages).
- New harness `e2e/hash-generator-browser.mjs`: **29 production Chrome
  scenarios passed** — empty boot with em-dash placeholder and all copy
  buttons disabled, SHA-1/256/384/512 digests of "abc" byte-exact, rapid
  retype settles on SHA-256("abcd") (debounce/cancel race), Copy-all writes
  all four algorithm lines to the clipboard, per-algorithm copy writes the
  hex value for that card, Clear restores placeholder + disabled buttons,
  1,000,000-char cap on the input, no Web Crypto alert in Chrome, aria-live/
  aria-busy/aria-label scaffolding present, `/use/` and `/tools/` routes 200,
  marketing copy mentions SHA-384 and honestly points MD5 users to the
  Checksum Calculator; zero hydration errors and zero page errors across the
  session.
- Sibling re-runs green: timestamp-converter 43/43 (control harness for the
  shared server/build), and same-build re-runs of the other two Wave 1 tools.

## Residuals

- Results are hex-only by design; binary/base64 encodings are not offered.
  MD5 is not offered (pointed to Checksum Calculator), so users needing the
  exact MD5 algorithm get the correct tool rather than a wrong hash.
- Input remains in the textarea after hashing (needed for editing); no
  explicit in-place wipe is offered.
- Copy feedback ("Copied to clipboard") is asserted indirectly via clipboard
  content (CopyButton flip animation is timing-flaky under headless Chrome).
- Whole-site residuals tracked elsewhere (site-header 375px navigation
  overflow, `'unsafe-eval'` in CSP script-src, `/verify` wording, ToolPreview
  uploads mocked, physical mobile/Safari/Firefox not tested locally — Chrome
  headless only).