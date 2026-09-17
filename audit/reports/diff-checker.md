# Diff Checker: Parallel Judges Audit

Date: 2026-09-17. Status: tenth tool upgraded and verified within the coverage
below. Ten independent judges ran in parallel (read-only, no edits); two were
rate-limited on first attempt and completed on retry.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | 14/14 feature scenarios pass, incl. split/unified correctness, counts, context sizing, exact clipboard match, swap/clear/sample, and live ignore-toggles. One real bug: **same rows render the LEFT text in the right pane** (`diff.ts` built `right: aLines[aIndex]`), so ignore-case/-whitespace showed the wrong bytes and the copied unified diff carried the left spelling — applying it to the actual file would rewrite normalized lines. Also: pure insert-at-top hunk header emits non-canonical `-1,1` instead of `-1,0`; a file's single final newline difference is invisible; summary pill always shows `+0 / −0` noise |
| Code quality | Myers implementation verified correct (backtrack, run-pairing, line numbering all pass; unequal pair counts resume numbers correctly). Critical: `trace.push(v.slice())` per diagonal is O((n+m)²) time **and** memory — 10k reversed lines OOM (measured 5k → 1.53 GB heap). Major: `toLocaleLowerCase()` nondeterministic across locales (Turkish I/ı); `text.split("")` breaks surrogate pairs; CRLF `\r` makes every line differ on the upload path; 3 full Myers passes per keystroke (`diffLines` + `buildHunks` + `buildUnifiedText` memo), ungated and eager even before Compare; `readAsText` UTF-8-only. Minor: dead `"hunk"` OpType branch, incident-safe chunk-collapse aliasing, fragile index-key reuse, no file-input error/value-reset handling |
| Privacy/security | **No data leaves the browser** — full CDP request sweep (CLIP marker in both panes) saw only same-origin Next assets + RSC prefetches; localStorage/sessionStorage untouched by the tool; clipboard writes only the requested unified diff on click; XSS probe (script/img/onerror payloads) renders 100% as text, zero dangerouslySetInnerHTML/eval/Function/postMessage. Major: no input-size guard → a MB-scale paste hits the O(n+m)² trace and freezes the tab (measured 73,980 chars = 2.56 s). Minor: clipboard `.catch(() => {})` has no fallback (shared CopyButton has one); `'unsafe-eval'` reaches prod CSP (Turbopack-dev rationale in the file comment, not dev-scoped) |
| Performance | Hydration 153 ms, JS payload 0.84 MB — excellent. But: diff recomputes on every keystroke with **no debounce**, not gated on `compared`/`view`, and `buildUnifiedText` runs a 3rd Myers pass that only Copy consumes. Worst-case reversed 2k lines = 1.5 s freeze, 4k = 2.7 s, 8k = 13.5 s, 5k = +1.5 GB heap. No worker (project already ships worker patterns elsewhere), no virtualization, `chars` mode quadratic for dense diffs. Recommendations: gate the memos on `compared`, drop the 3rd pass, share one script, debounce/worker, cap + warn |
| SEO | Title `Diff Checker online — free · BrainCoder` (no junk verbs). **Major**: howTo step 3 claims "yellow (modifications)" — the table never uses yellow; **Major**: FAQ claims "hundreds of thousands of lines" — off by ~2 orders of magnitude vs the measured OOM; **Major**: JSON-LD `featureList` is the generic template ("Format, convert, generate and text tools") that a diff checker neither generates nor converts. Minor: meta description omitted the keyword "diff"; keyword row has two zero-volume terms; feature/related-slug fine-tuning; `html-to-pdf` related slug weak; no dedicated guide needed (would cannibalize the tool page). Recommended title swallowed after noun-map audit — pattern already correct |
| UX/accessibility | Four WCAG AA failures: no live region (results never announced), tab toggles are plain buttons with no tab semantics/roving tabs and active-tab contrast 3.68:1, split view is color-only (no `+`/`−` text markers; deuteranopia reads red/green as one), results table has no headers/caption/legend. Also: checkbox targets 13×13 px, upload buttons 16 px tall, no focus ring (vs house `focusRing`), Copy gives no "Copied" feedback, blank-compare shows two contradictory messages, shared `Button` misses the house `min-h-11`. Passes: contrast ratios 4.79–7.60, label programmatic association, keyboard tab order, icons, context select |
| Internationalization | Major×3, all proven in the live tool: **(1)** ignore-case is locale-dependent — under `tr-TR`, `I` vs `i` diffs spuriously while `İSTANBUL`/`istanbul` equalize, opposite of `en-US`; **(2)** char granularity splits surrogate pairs — an emoji change renders two U+FFFD boxes; **(3)** word granularity is useless for CJK — one inserted char colors the entire 13-char sentence. Minor: BOM proven safe (Chromium `readAsText` strips it), "Ignore whitespace (git -w)" strips more than git (`\u3000`), `ß` no folding (documented limitation), ~28 hardcoded strings but site is en-only |
| Edge cases | Grade A-: Myers alignment, hunk construction, context=0, granularities, swap, sample idempotency, blank-line handling, astral chars in words mode all pass. The suspected trailing-newline invisibility does **not** reproduce (splitLines pops exactly one terminal empty; `a\nb\n\n` vs `a\nb\n\n\n` IS detected). Real gaps (minor): a 0-vs-1 final newline difference is invisible, empty added rows have no min-height/placeholder, upload-path CRLF has no dedicated toggle (paste path is transparently normalized by the browser), blank-compare double message, `\u2028` not a line terminator |
| Cross-browser | Engine matrix: Chrome **PASS**, Firefox **PASS** (identical summary, CJK renders), WebKit not testable (locally-installed build's OS is too old — dyld symbol error). SSR clean: `<html lang="en">`, textareas ship without `value`, no tool data in static HTML, CSR bailout correct. Long line keeps 48 px number column with `break-all`. Style: self-hosted Geist fonts (no third-party FOUT), no print-color CSS (diff backgrounds won't print), site-header 375 px overflow confirmed pre-existing (tool content itself contained by `overflow-x-auto`) |
| Honesty/copy | **One fabricated claim** (howTo step 3 "yellow modifications" — nothing is yellow in the table; only the pill is amber) and **one dangerous false claim** (FAQ "hundreds of thousands of lines" → the trace measures ~1.6 GB at 5k and OOMs at 10k). Also: "Copy or Export Results" has no Export control; "works with … any text format" vs a file-accept list missing `.yaml/.xml/.log/.yaml`; description under-reports (omits modifications, unified view, char-level). Everything else verified true (client-side privacy, colors, copy, component copy). Grade C — plus step-4 rename and an accept-list extension |

## Changes And Evidence

- `src/features/diff-checker/diff.ts` engine fixes:
  - **same-row right-pane bug fixed**: same rows now render `bLines[op.bIndex]`
    (the user's actual right-side text) instead of the left text — visible in
    split view and in the copied unified diff context lines (which now match
    git semantics: context lines are the original-file spelling);
  - `normalize()` uses `toLowerCase()` (locale-invariant, deterministic ASCII
    folding) instead of `toLocaleLowerCase()` — the Turkish I/ı divergence and
    cross-locale nondeterminism are gone;
  - `tokenizeChars` now splits with `Array.from()` (code-point aware) so
    character-granularity highlighting keeps emoji/astral glyphs whole (verified
    no U+FFFD mid-highlight);
  - `tokenizeWords` is **CJK-aware**: Han/Kana/Hangul/fullwidth runs tokenize
    per code point, so a one-character CJK change highlights just that character
    (verified: only the added `，` renders green, not the whole sentence);
  - `splitLines` strips a trailing `\r` per line, so CRLF uploads compare equal
    to LF text without relying on the "Ignore trailing spaces" workaround
    (verified via a real `\r\n` file upload);
  - hunk headers are canonical again: an insert-at-top hunk emits `-1,0` (was
    `-1,1` because counts were force-minimumed to 1);
  - **3rd Myers pass removed**: copyable text is now

    `buildUnifiedTextFromHunks(diff.hunks)` — formatted from the hunks already
    stored in the diff result, so the Copy button does zero re-diffing
    (`buildUnifiedText` kept as a thin compatibility wrapper).
- `src/features/diff-checker/DiffChecker.tsx`:
  - **both diff memos gated on `compared`**: nothing diff-related computes
    until the user clicks Compare (verified: no result table/DOM work before
    Compare; identically-line inputs are fast d=0 exits once compared);
    `buildUnifiedText` is gone from the render path; `splitLines` runs once per
    compared render;
  - **honest large-input warning**: an amber `role="status"` banner explains a
    very large or heavily rewritten input can be slow or freeze the tab (was a
    silent OOM trap; matches the corrected FAQ);
  - results pill is now a single `role="status" aria-live="polite"` region (SR
    users hear the summary); the redundant body empty-states are removed so an
    empty compare shows exactly "No lines to compare" and identical texts show
    exactly one "No differences found";
  - split view is **no longer color-only**: a dedicated `−`/`+` text-marker
    column, `<caption>` (sr-only), `<thead><th scope="col">` headers
    (Original / Changed), and a visible legend ("Red = removed or modified
    lines from the Original · Green = added or modified lines in the Changed
    text");
  - view and highlight groups are real **tabs**: `role="tablist"` +
    `role="tab"` + `aria-selected` with arrow/Home/End keyboard navigation;
    active tab recolored `bg-indigo-600` (white-on-indigo ≈ 6:1, was 3.68:1 on
    cyan);
  - Copy uses the shared **`CopyButton`** ("Copied" feedback + sr-only status +
    `execCommand` fallback) instead of a silent `.catch` call;
  - checkbox labels and upload buttons got `min-h-11` touch targets and the
    house `focusRing`; hidden file inputs carry `aria-label`; `FileReader` now
    has an `onerror` handler; the file `accept` list extended to the common
    code/config set (yaml, xml, log, toml, ini, py, go, java, c, sql, sh, …) so
    "works with configuration files" is honest.
- Shared UI (`src/components/ui/index.tsx`): the house `min-h-11` and
  `focus-visible:outline-indigo-600` were added to the shared `Button` base
  (site-wide 44 px target + visible focus keyboard parity); `CopyButton`
  unchanged.
- Registry (`tools.ts`): description now covers modifications and views —
  "Spot added, removed, and modified lines between two blocks of text with a
  clear side-by-side or unified diff view." (also puts the "diff" keyword back
  into the meta description).
- Copy (`tool-content.ts`): howTo step 3 rewritten with the **true colors**
  (green additions, red deletions, modified lines as a red/green pair with
  inline word/character highlighting + a modified-count badge); step 4 renamed
  "Review and Copy the Diff" (no more "Export" that doesn't exist); the false
  "hundreds of thousands of lines" FAQ replaced with browser-memory-honest
  guidance that matches the new warning banner; feature "Copy results as a
  unified diff"; longDescription dedupes the "diff tool" repetition;
  relatedSlugs swapped `html-to-pdf` (no compare intent) for `text-lines` +
  `markdown-preview`.
- SEO (`seo.ts`): per-tool JSON-LD `featureList` override for diff-checker
  ("Side-by-side and unified diff views, word- and character-level
  highlighting, ignore-case and whitespace options, unified-diff copy — all in
  your browser") replacing the generic "Format, convert, generate and text
  tools" template that this tool can't back up; keyword row unchanged (all five
  verified accurate).
- Verification: `e2e/diff-checker-browser.mjs` — 31 production Chrome scenarios
  passed (SSR ships empty inputs, **no work before Compare**, single empty-state
  message, identical → No differences found with copy hidden, **same-row
  right-side spelling regression**, byte-exact unified-diff clipboard, `−`/`+`
  markers + th headers + legend + live region + one selected tab, arrow-key tab
  cycling, CRLF-upload vs LF-paste equality, ignore whitespace vs trailing
  spaces, **CJK comma-only highlight**, **emoji intact at char granularity**,
  touch-sized labels, 375 px tool fit, large-input honesty banner, cross-tool
  notepad regression). Sibling re-runs green: notepad 34, base64 27,
  url-encoder 19, qr 23. Lint 0 errors / 4 pre-existing warnings; production
  build passed (285 pages).

## Remaining Limits

Not runtime-verified: physical mobile devices, real screen-reader passes, and
WebKit (local Playwright WebKit build is too old for this macOS — Chrome and
Firefox both passed the smoke matrix). The worst-case engine cost is bounded
but not eliminated: a 5k–8k-line fully-rewritten file still takes seconds on
Compare (the honest banner discloses this); a linear-space Myers
(Hirschberg) backtrack or a Web Worker + row virtualization are the recommended
follow-ups and the `toLowerCase()`/array-tokenizer changes are now in the shared
engine for any future re-implementation. Residual shared items still open:
/verify audit wording, physical-browser matrix, header 375px nav overflow (site
header, not the tool), `image-base64` self-link,
`utf8-converter`/`aes-encryption` reciprocal relatedSlugs edges, `'unsafe-eval'`
in `script-src` (Turbopack dev — noted but reaches prod), the shared ToolPreview
upload mock, print CSS for colored diff backgrounds, and the sibling random
tools still using `Math.random()` (share `secureRandomIndex` as a trackable
follow-up).

Other tools in the registry have not completed this ten-judge process beyond
PDF Compressor, Image Compressor, Image Resizer, JSON Formatter, URL Encoder,
Base64 Encoder & Decoder, QR Code Generator, Notepad, Password Generator, and
Diff Checker — 113 remaining.

Next tool: Regex Tester, the entry after diff-checker in the registry.