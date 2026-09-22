# PDF Rotator: Parallel Judges Audit

Date: 2026-09-22. Status: twenty-seventh tool upgraded and verified — the
third tool of the current audit wave. Ten judges returned; every gap they
raised was closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Silent corruption risk via `ignoreEncryption: true`; negative-modulo math produced invalid `/Rotate` values; auto-download churn; no caps; raw `err.message` errors; no roles/aria-busy; no input-value reset |
| Domain expert | RUNTIME-VERIFIED `(0 - 90) % 360 = -90` → pdf-lib's `setRotation` only asserts "multiple of 90", so `/Rotate -90` and `/Rotate -180` are serialized verbatim (illegal per spec); `save()` regenerates form appearances/rewrites the file (so "lossless bytes" over-claim) plus `ignoreEncryption` never decrypts; the pdf.js pass for a page count was redundant |
| Technical architect | CRITICAL — no runId guard (wrong-file race, rotate-during-load race, name/bytes mismatch mid-rotate); dual parsers (pdf.js + pdf-lib) loaded the document twice; the pdf.js loading task was never destroyed; workerSrc URL inlined instead of the shared helper |
| Code reviewer | No CRITICAL/HIGH; the shared `downloadBlob` consumer is correct; inlined workerSrc duplication is the same URL string as support.ts; the dual-load design is the sizeable gap |
| End-user UX | Marketing lied on multiple axes (per-page rotation, preview, drag-and-drop, "no file size limits", "270° in either direction" vs. only-button combinations); auto-download per click produces duplicate/identical filenames (the same `-rotated.pdf` name, same content because rotation never accumulated); rotate-all is irreversible without re-upload |
| Business analyst | CRITICAL — landing page misrepresents the tool; how-to describes a non-existent UI (drag-and-drop, click-on-pages). Recommendation (adopted): keep rotate-all simple, DON'T build per-page (PDF Editor owns that), write honest copy, add the missing SEO row/guide, verify all 5 relatedSlugs (pdf-crop, pdf-remove-pages, pdf-merge, pdf-split, pdf-editor — all existed) |
| SEO/content | CRITICAL C1–C10 — longDescription, two features, the drag/click how-to steps, and two FAQs describe per-page rotation/preview that don't exist; 270° reachable only via the counter-clockwise button; no TOOL_KEYWORDS row, no featureList override, no guide |
| Security/privacy | VERIFIED no network egress (file bytes never leave the tab; pdf worker asset is a local bundle, not a CDN; CSP `worker-src 'self' blob:` OK; the only outbound call is the Vercel analytics beacon). MEDIUM — `ignoreEncryption` re-saves locked docs as decrypted-but-corrupt output; recommended an explicit 100 MB cap; filename injection not an issue (user-controlled string is only a download name) |
| A11y specialist | HIGH — no live regions at all (error div, success div and the file-info span lack `role=alert`/`role=status`, failing WCAG 4.1.3); no `aria-busy`; rotate options need a labelled group; counter-clockwise button label/icon ambiguity; slate-400 caption ~2.98:1 fails AA |
| Performance | HIGH — redundant whole-file pdf.js parse just to count pages (≈2×N memory, task never destroyed); HIGH — rotation blocks the main thread synchronously (no worker/yield), so a busy state often never paints for large docs; MEDIUM — double-rotate re-rotated the original bytes (two 90° clicks produced ONE 90° output, not 180°); repeated `-rotated.pdf` filename each download |

## Changes And Evidence

- `src/features/pdf-rotate/PdfRotate.tsx` (rebuilt):
  - **pdf.js removed from this tool entirely.** A single pdf-lib load validates
    the file and counts pages; the raw bytes are kept as the working document.
    This kills the dual-parser redundancy, the leaked worker task and the
    inline workerSrc duplication in one move.
  - **Rotation now accumulates.** After each rotate the resulting bytes replace
    the working copy, so 90° CW twice really yields 180°, and clicking further
    continues from the current orientation (two CCW = 180°, three CW = 270°,
    four 90° steps = back to 0°).
  - **Angle math normalized.** `((a % 360) + 360) % 360` is applied to every
    cumulative step, so the serialized `/Rotate` is always 0/90/180/270 and
    can never be negative.
  - **`ignoreEncryption` dropped.** locked documents are detected on load and
    steered to PDF Unlock with a friendly `role=alert`; invalid files get
    "doesn't look like a valid PDF".
  - **100 MB cap** with guidance to PDF Split for larger files.
  - Every rotate auto-downloads with a **distinct incremental filename**
    (`<base>-rotated.pdf`, `-rotated-2.pdf`, …), and each download is the
    current cumulative result — no more byte-identical duplicate saves.
  - Stale-async closed: a `runId` guard spans every await, rotate buttons are
    disabled while busy, the hidden file input is cleared after every change
    (so re-picking the same file works and resets rotation state), and
    `aria-busy` is set on the root during work. A `setTimeout(0)` yield after
    setting the busy state lets the "Rotating all N pages …" status paint
    before the synchronous pdf-lib work runs.
  - A11y parity: `role=alert` error, `role=status` on both the info line and
    the success/progress message, `aria-label` on the file input, a real
    `<fieldset>`/`<legend>` "Rotate direction" group, and the caption moved
    slate-400 → slate-500.
  - pdf-lib `save()` runs with `{ updateFieldAppearances: false,
    addDefaultPage: false }` so form fields aren't silently re-rendered
    (the "no quality loss" FAQ is now accurate: rotation is metadata-only,
    but the file is rewritten by the encoder).
- `src/lib/tool-content.ts`: pdf-rotate entry rewritten honest — rotate-ALL
  only, no preview, no drag-and-drop; howTo describes Open PDF → choose a
  direction → instant download of every page at once; FAQs cover the 270°
  path, per-page users being routed to PDF Editor, scanned PDFs, and the
  100 MB / password-locked caveats. Reciprocal links: `pdf-rotate` added to
  pdf-to-image, pdf-merge and pdf-split (pdf-resize and pdf-editor already
  listed it); pdf-rotate's own list now includes the reciprocal pdf-to-image.
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-rotate"]` (rotate pdf, pdf rotator,
  rotate pdf 90 degrees, rotate pdf pages online, rotate pdf counter
  clockwise, …) + a `TOOL_FEATURE_LIST` JSON-LD override describing
  one-click whole-document rotation, chaining to 270°, and instant downloads.
- `src/lib/tools.ts`: tagline corrected to "Turn a sideways PDF the right
  way — every page at once" (the old "per-page 90°/180°/270°" phrasing
  implied per-page controls).
- `src/lib/guides.ts`: new guide `how-to-rotate-a-pdf` (rotates every page
  at once, how each direction maps, chaining/lossless semantics, 100 MB and
  unlock-first caveats, per-page → PDF Editor) — production build is now
  **290 static pages**.

## Verification

- `audit/check-pdf-rotate.mjs` (Node, runs the real pdf-lib serialization) —
  **18/18 PASS**: `normalize` maps only to 0/90/180/270 (−90 → 270, −450 →
  270, 360 → 0); a 3-page document rotated through a full chain (−90, −90,
  180, 90, 90, 90, 90) lands on valid orientations every step with all pages
  in sync; two CCW accumulate to 180 and four 90° CW steps return to 0; the
  serialized output (with object streams disabled to expose raw tokens)
  contains `/Rotate 180`/`/Rotate 270` and never `/Rotate -`; page count is
  preserved and the rotated file reopens cleanly; `save(SAVE_OPTS)` emits a
  new, valid document.
- `npx tsc --noEmit` clean; eslint clean on all changed files;
  `npm run build` green (290 pages).
- `e2e/pdf-rotate-browser.mjs` — **39 production Chrome scenarios, 39/39
  green** (`BASE_URL http://localhost:3801`, pdf-lib fixtures + a 100 MB
  file generated at runtime): idle state names the input, hides rotate
  controls and explains whole-document rotation; a 3-page upload reports the
  page count and "now at 0°"; three rotate controls appear; the first 90° CW
  click downloads `sample3-rotated.pdf` and re-parsing the file shows all 3
  pages at 90°; a second 90° CW click downloads a distinct
  `-rotated-2.pdf` with all pages at 180° (accumulation verified against the
  actual bytes, not the UI); counter-clockwise chains 180° → 90° → 0° with
  the "back to the original orientation" status; 180° sets 180°; re-picking
  the same file resets the counter to `-rotated.pdf` and restarts from the
  original orientation; an encrypted PDF shows the friendly unlock `role=
  alert` pointing at PDF Unlock; a non-PDF shows "doesn't look like a valid
  PDF"; a >100 MB file is rejected with PDF Split guidance; zero hydration
  errors; zero page errors; /tools/pdf-rotate copy says "rotated together",
  documents 270°/100 MB/PDF Editor and contains none of the old per-page,
  click-on-pages, preview or drag-and-drop claims; /tools/pdf-to-image
  cross-links to PDF Rotator; the how-to-rotate-a-pdf guide renders; the
  sitemap lists both the tool page and the guide.

## Residual

- Shared, not re-reported: site-header 375px nav overflow; `'unsafe-eval'`
  CSP; /verify wording; WebKit not runnable; Next.js route announcer
  `role=alert`; pdf-lib pinned (no active advisory).
- Rotate-all is the product: whole-document reorientation in one click, with
  PDF Editor explicitly recommended for per-page work — disclosed in the
  copy, the FAQs and the new guide. Rotation is metadata-only but pdf-lib
  rewrites the file; the losslessness claim is qualified to match.
- Rotation runs synchronously on the main thread; the 100 MB cap bounds it,
  a busy message paints first via the setTimeout(0) yield, and the tool
  never spawns a worker (the regex-tester note about worker assets under
  Turbopack still applies to any future worker-based approach).