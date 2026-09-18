# Diff Checker: Parallel Judges Audit

Date: 2026-09-18. Status: tenth tool upgraded and verified within the coverage
below. Ten independent judges ran in parallel (read-only, no edits); two
(performance, cross-browser) were rate-limited on first attempt and completed
on retry.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | 14/14 scenarios pass (alignment, counts, context sizes, split/unified markers, exact unified-diff clipboard, swap/clear/sample idempotency, live ignore toggles). ONE bug found live: **same rows render the LEFT text in the right pane** (`diff.ts` built `right: aLines[aIndex]`), so with ignore-case/-whitespace the right side showed the wrong spelling, and "Copy as unified diff" emitted the left spelling for equal lines — applying the copied diff would rewrite normalized lines to the left file's bytes. Minor: `-1,1` hunk for insert-at-top (non-canonical), final-newline diff invisible, `+0 / −0` pill noise |
| Code quality | Myers verified correct end-to-end (backtrack, run-pairing, numbers resume after unequal pairs). CRITICAL: `trace.push(v.slice())` per diagonal → O((n+m)²) time AND memory (5k reversed lines = 1.53 GB heap; ~10k OOM). MAJOR: `toLocaleLowerCase()` is locale-dependent (Turkish I/ı diverge); `text.split("")` splits surrogate pairs; CRLF `\r` survives on upload path so every line differs; 3 full Myers passes per keystroke (diffLines + buildHunks + buildUnifiedText memo) ungated; `readAsText` UTF-8-only. Minor: dead `"hunk"` OpType, index-keys, no file-error handler |
| Privacy/security | **Zero egress** — full CDP request sweep with a marker string in both panes: only same-origin Next assets + RSC prefetches; no storage writes; clipboard writes only on explicit click; XSS payloads render as literal text; no eval/innerHTML/postMessage. MAJOR: no input cap → MB-scale paste hits the quadratic trace (73,980 chars froze tab 2.56s). MINOR: clipboard `.catch(() => {})` had no fallback; 'unsafe-eval' reaches prod CSP |
| Performance | Hydration 153 ms; JS 0.84 MB — excellent. But diff recomputed on EVERY keystroke (no debounce, not gated on compared/view) and `buildUnifiedText` ran a 3rd pass only Copy consumes. Worst case: 2k reversed ≈1.5s, 4k ≈2.7s, 8k ≈13.5s freeze, 5k = +1.5 GB heap. No worker, no virtualization; chars mode quadratic for dense small diffs. Recommended: gate memos + drop 3rd pass first |
| SEO | Title correct (no junk verbs). **FALSE howTo**: "yellow (modifications)" — the table never shows yellow (only the amber pill count). **FALSE FAQ**: "hundreds of thousands of lines" ≈2 orders of magnitude beyond the measured OOM. Junk JSON-LD featureList ("Format, convert, generate and text tools"). Meta description omitted the word "diff"; keyword row OK; `html-to-pdf` weak related slug |
| UX/a11y | 4 WCAG AA failures: no live region (results never announced), tab toggles plain buttons (no aria-selected, no arrow keys, active cyan 3.68:1), split view color-only (red/green invisible to deuteranopia), table without headers/caption/legend. Also 13×13 checkboxes, 16px upload targets, no focus ring / "Copied" feedback, empty-compare double message. Passes: contrast ratios, label association, tab order, icons |
| i18n | **Proven live**: ignore-case differs by locale (tr-TR I/i spuriously different, İ/i equal — opposite of en-US); char granularity renders U+FFFD for emoji changes; word granularity useless for CJK (one-char change colors the whole sentence). Minor: BOM safe (Chromium strips it), git -w strips more than git (\u3000), ß no folding, ~28 en-only strings |
| Edge cases | Grade A-. Verified correct: Myers, hunk/context, granularities, swap, sample idempotency, interior blank lines, astral chars in words mode. The hypothesized trailing-newline invisibility does NOT reproduce (only a 0-vs-1 final newline is invisible). Minor: empty added rows lack min-height; CRLF upload lacks a toggle (paste path normalized by browser); \u2028 not a line terminator |
| Cross-browser | Chrome PASS, Firefox PASS (CJK renders), WebKit not testable locally (installed build too old — dyld error). SSR clean: `<html lang="en">`, textareas ship without value, no tool data in static HTML, CSR bailout correct. Long lines keep the 48px number column (break-all). Note: site-header overflows 375px (pre-existing, tool content contained by overflow-x-auto) |
| Honesty/copy | One fabricated claim (howTo "yellow modifications") and one dangerous false claim (FAQ size). "Copy or Export" over-claims export (no Export control). "any text format" vs file accept list missing yaml/xml/log. Description under-reports (omits modifications, unified view, char level). All else verified true. Suggested rewrites supplied |

## Changes And Evidence

- `diff.ts`:
  - **same-row data bug fixed** — equal rows now render `bLines[op.bIndex]`
    (user's actual right-side text) in the right pane; copied context lines use
    git-style left-file spelling;
  - `normalize()` uses `toLowerCase()` (locale-invariant) — Turkish I/ı and
    cross-browser nondeterminism gone;
  - `tokenizeChars` uses `Array.from(text)` (code-point aware) — emoji/astral
    stay whole in char-granularity highlights;
  - **CJK-aware `tokenizeWords`** — Han/Kana/Hangul/fullwidth runes tokenize per
    code point (`/[${cjk}]|[^\s]+|\s+/g`), so a one-char CJK change highlights
    only that char (verified: only the added `，` renders green);
  - `splitLines` strips a trailing `\r` per line — CRLF uploads compare equal to
    LF text without needing "ignore trailing spaces";
  - canonical hunk counts (`-1,0` for insert-at-top, not `-1,1`);
  - added `buildUnifiedTextFromHunks(hunks)`; the Copy path now formats from the
    hunks already stored in the diff result — the 3rd Myers pass is gone
    (`buildUnifiedText` retained as a thin wrapper).
- `DiffChecker.tsx`:
  - **both diff memos gated on `compared`** — zero diff computation until
    Compare is clicked (verified: no table/DOM diff work before Compare);
    `unifiedText` derived from stored hunks;
  - results pill inside `role="status" aria-live="polite"` (SR users hear the
    summary); render-side empty messages removed → exactly one empty state
    ("No lines to compare" for blank input, "No differences found" for equal
    text); `+0 / −0` hidden;
  - split view is **not color-only**: `−`/`+` text-marker column, sr-only
    `<caption>`, `<thead>` `# / Original / # / Changed` headers, plus a visible
    legend ("Red = removed or modified… · Green = added or modified…");
  - view + highlight groups are real tabs (`role="tablist"`/`role="tab"`,
    `aria-selected`, roving tabindex, Arrow/Home/End keyboard nav); active tab
    `bg-indigo-600` ≈6:1 (was cyan 3.68:1);
  - copy uses the shared `CopyButton` (transient "Copied" + sr-only status +
    `execCommand` fallback) instead of a silent `.catch`;
  - checkbox labels and upload buttons got `min-h-11` + house focusRing; hidden
    file inputs carry `aria-label`; `FileReader` gained `onerror`; accept list
    extended (yaml/xml/log/toml/ini/py/go/java/c/… + text/* + application/json
    + application/xml + application/x-yaml) so "works with configuration
    files" is honest;
  - amber `role="status"` warning when combined lines >4000 or chars
    >1,000,000 — honest disclosure instead of a silent tab freeze.
- Shared `Button` (`components/ui/index.tsx`): added `min-h-11` +
  `focus-visible:outline-indigo-600` (site-wide target + visible focus parity).
- Copy (`tool-content.ts`): howTo step 3 rewritten to the REAL colors (green
  additions, red deletions, modified as a red/green pair with inline
  word/character highlighting + modified-count badge); step 4 renamed "Review
  and Copy the Diff" (Export claim deleted); FAQ size answer is honest and
  matches the new warning; feature copy → "Copy results as a unified diff for
  sharing or documentation"; longDescription de-duped "diff tool"; relatedSlugs
  → notepad, word-counter, text-cleaner, text-lines, markdown-preview
  (`html-to-pdf` removed).
- Registry (`tools.ts`): description → "Spot added, removed, and modified lines
  between two blocks of text with a clear side-by-side or unified diff view."
  (restores the "diff" keyword to the meta description).
- SEO (`seo.ts`): per-tool `TOOL_FEATURE_LIST` override so diff-checker's
  JSON-LD featureList is honest ("Side-by-side and unified diff views, word-
  and character-level highlighting, ignore-case and whitespace options,
  unified-diff copy — all in your browser") instead of the generic
  "Format, convert, generate and text tools".
- Verification: `e2e/diff-checker-browser.mjs` — **31/31 production Chrome
  scenarios** (SSR empty inputs; nothing computes before Compare; single empty-
  compare message; identical → No differences + no copy button; same-row
  right-side regression; byte-exact unified clipboard; −/+ markers; th/caption/
  legend; role=status; one selected tab; Arrow-key cycling; hunk header;
  CRLF-upload vs LF-paste equal; ignore-whitespace vs trailing; CJK comma-only
  highlight; emoji intact at char granularity (no U+FFFD); touch-sized label;
  375px tool fit; large-input honesty banner; notepad regression). Production
  build passed (285 pages); lint 0 errors / 4 pre-existing warnings; tsc clean.

## Remaining Limits

Not runtime-verified: physical mobile devices, real screen-reader passes, and
WebKit (local Playwright WebKit is too old for this macOS — Chrome and Firefox
both passed the smoke matrix). The worst-case engine cost is bounded but not
eliminated: 5k–8k fully-rewritten lines still take seconds on Compare (honest
banner discloses it); linear-space Myers (Hirschberg) or a Web Worker for the
trace are the recommended future follow-ups. Residual shared items still open:
/verify proof wording, physical-browser matrix, header nav overflow past 375px
(the site header, not the tool), `image-base64` self-link,
`utf8-converter`/`aes-encryption` reciprocal relatedSlugs edges,
`'unsafe-eval'` in script-src (Turbopack), shared ToolPreview upload mock, print
CSS for colored diff backgrounds, and sibling random tools still on
`Math.random()` (share `secureRandomIndex` as a tracked follow-up).

Other tools in the registry have not completed this ten-judge process beyond
PDF Compressor, Image Compressor, Image Resizer, JSON Formatter, URL Encoder,
Base64 Encoder & Decoder, QR Code Generator, Notepad, Password Generator, and
Diff Checker — 113 remaining.

Next tool: Regex Tester (next entry after diff-checker in the registry).