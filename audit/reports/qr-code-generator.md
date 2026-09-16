# QR Code Generator: Parallel Judges Audit

Date: 2026-09-16. Status: seventh tool upgraded and verified within the coverage
below. Like earlier batches, ten independent judges ran in parallel (read-only,
no edits). This batch was pulled ahead of registry order because the domain-switch
commit accidentally included ~150 lines of pre-existing, unaudited worktree
changes to `QrCodeGenerator.tsx`; the user approved auditing QR next so that code
is now reviewed and certified rather than silently shipped.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| End user | QR generates automatically on load and per keystroke (placeholder is never visible); `fg == bg` renders a solid, unscannable square with downloads still enabled and no warning; silently upscaled 100px output; the encoded text (incl. Wi-Fi passwords) appears verbatim in the `<img>` alt inside the `aria-live` region — a privacy contradiction |
| Domain | capacity FAQ (4,296 alnum / 7,089 numeric at L) ACCEPT; ECC percentages (7/15/25/30%) ACCEPT; friendly-error regex matches the lib throw ACCEPT; two fixes: `margin: 1` overrides the library's ISO-compliant 4-module quiet zone, and "Wi-Fi configuration" copy implies format-aware encoding the byte-mode tool does not do |
| Architect | async effect leaves stale `dataUrl`/`error`; PNG download uses the preview `dataUrl` while SVG regenerates fresh (divergence); `aria-live` wraps the whole output incl. secret-bearing img; error is an amber non-alert with no Dismiss; no Clear button; PNG is a hand-rolled `<a>` without `min-h-11`/`focus-visible` |
| Code reviewer | early-return on empty text leaves stale state; blob URL not revoked if the click throws; capacity is only enforced by the library throwing (~220ms wasted work); fixed 256px display vs dynamic generation size; textarea has no accessible name; `aria-live` wrapping interactive content floods screen readers |
| Functional tester | 34 live scenarios: stale/error-state downloads verified hidden, cancelled-guard works, threshold is EC L 4,296 / EC M 3,391 upper-case, exact error string captured; three product defects = alt-text secret in DOM, no contrast guard, size-label vs preview mismatch; supplied verbatim selectors/assertions |
| Business analyst | howTo step 3 references a "Generate" button that does not exist (HIGH — false instruction); "Adjustable size" misleads when the preview is fixed; "Wi-Fi configuration"/"wifi credentials" overclaim; missing FAQ for "won't scan" and "is it private"; "canvas API" framing imprecise; champion the privacy differentiator |
| Content/SEO | two keyword entries are dead phrasings; longDescription over-uses "QR" (7×) with encyclopedia filler; relatedSlugs `slug-generator` is a weak one-way link (`image-base64` is the only reciprocal); recommended long-tail row, 2 new FAQs, a 4th guide section, and reciprocal linking |
| Security/privacy | CRITICAL: full encoded payload embedded verbatim in `<img alt>` (read aloud by SRs via the surrounding live region; visible in DevTools/DOM/screenshots) directly contradicts the "safe … Wi-Fi credentials" claim; everything else PASS (no network, CSP tight, no innerHTML, slug-only localStorage, safe blob download, no font preloads) |
| Accessibility | FAILs: unlabeled textarea (1.3.1/4.1.2), live region announces secret + churns (1.1.1/4.1.3), error lacks `role="alert"`/Dismiss (4.1.3); CONCERNs: select ~40px target, color-input focus ring, PNG `<a>` no focus-visible, shared `Button` base lacks an always-on ring |
| Performance | measured `toDataURL`: ~6–10ms at 320px per keystroke but ~50ms at 1000px; preview is fixed 256px so size never shows on screen — main-thread cost scales with the slider, not the preview; recommended a deterministic capacity pre-check (a guaranteed-failing 5,000-char paste blocks ~220ms before throwing) and decoupling preview size from download size; debounce NOT justified |

## Changes And Evidence

- `src/features/qr-code-generator/QrCodeGenerator.tsx` rebuilt to the team
  standard:
  - **Privacy fix (critical):** `<img>` alt is now `"QR code preview"`; the full
    encoded payload is no longer exposed in the DOM/accessibility tree. The
    `aria-live` region no longer wraps the image or the download controls.
  - A dedicated `<p className="sr-only" role="status" aria-live="polite"
    aria-atomic="true">` announces only concise state ("QR code ready." /
    "Text is too long for a QR code." / "Generating…") instead of dumping the
    secret and the whole output subtree.
  - Errors use `role="alert"`, red styling, an `id`, input `aria-describedby`,
    and a Dismiss (`X`) button reset when the user edits. `overCapacity` is
    derived so the too-long state renders deterministically without a state
    round-trip (also satisfies the `set-state-in-effect` lint rule).
  - Deterministic capacity pre-check mirroring ISO/IEC 18004 version-40 caps by
    detected mode (numeric / alphanumeric / byte) and ECC level; the UI fails
    fast with the exact friendly message and never calls the library for a
    guaranteed failure.
  - ISO-compliant 4-module quiet zone (`margin: 4`).
  - Preview is generated at a fixed 256px (matching its display) and downloads
    are generated on demand at the selected `size` (PNG) or as vector (SVG), so
    the two artifacts can no longer diverge and per-keystroke cost no longer
    scales with the slider.
  - Low-contrast guard: a visible amber note appears when the WCAG contrast
    ratio between foreground and background falls below 4:1 (covers `fg == bg`).
  - Clear input button (`disabled` when empty); labelled textarea (`htmlFor`),
    `min-h-11` + `focus-visible` on controls; blob URL revoked via `finally`.
- Copy (`tool-content.ts`): longDescription rewritten to three honest blocks
  (drops "canvas API" and the encyclopedia filler, explains the download-size
  vs preview distinction, leans on privacy); features reworded honestly; howTo
  removes the phantom "Generate" button and adds a scan-to-verify step;
  FAQs grew 3 → 6 (added "What can I encode?", "Why won't my QR code scan?",
  "Is my data private?"); relatedSlugs → `base64, url-encoder, image-base64,
  uuid-generator` (dropped weak `slug-generator`), and `base64` reciprocates.
- Registry (`tools.ts`): tagline "QR codes generated in your browser";
  description rewritten honestly (Wi-Fi configuration string, PNG/SVG, no upload).
- SEO (`seo.ts`): keyword row → long-tail terms the page can satisfy (create qr
  code free, free qr code generator no sign up, qr code generator for url,
  qr code with custom colors, qr code svg download).
- Guide (`guides.ts`): `how-to-create-a-qr-code` updated — SVG mention, a new
  "Error correction and file format" section, `updated` date bumped.
- Verification: production build passed (284 pages), targeted lint exit 0, and
  `e2e/qr-browser.mjs` — 23 production Chrome scenarios passed (default state,
  alt-text privacy regression lock, live text updates, empty/whitespace
  placeholder, capacity boundaries EC M 3,391 pass / 3,392 fail with the exact
  error, `role="alert"` red styling + Dismiss, sr-only announcement, recovery,
  Clear, low-contrast warn/clear, on-demand PNG + SVG downloads with PNG
  signature and IHDR width/height = 500 honoring the slider, 375px mobile
  no-overflow, and a cross-tool CopyButton regression). `url-encoder-browser.mjs`
  (19) and `base64-browser.mjs` (27) re-run green.

## Remaining Limits

Not runtime-verified: physical mobile devices, Firefox, Safari, or real
screen-reader passes. The shared `Button` component still lacks an always-on
`focus-visible` ring (this tool passes its own ring via `className`; the shared
gap applies site-wide and remains a shared-system residual). The site-wide title
template still renders "… free generate tool" for category "Generate" (shared
SEO template item, not tool-specific). Residual shared items still open: /verify
audit wording, physical-browser matrix, header 375px nav overflow,
`image-base64` self-link and `utf8-converter`/`aes-encryption` reciprocal
relatedSlugs edges. The tool encodes plain byte-mode payloads; the Wi-Fi/vCard
formats require the user to type the standard string, now documented honestly.

Other tools in the registry have not completed this ten-judge process beyond
PDF Compressor, Image Compressor, Image Resizer, JSON Formatter, URL Encoder,
Base64 Encoder & Decoder, and QR Code Generator — 116 remaining.

Next tool: Notepad, the next entry after base64 in the registry order.
