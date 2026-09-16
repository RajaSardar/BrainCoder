# Notepad: Parallel Judges Audit

Date: 2026-09-16. Status: eighth tool upgraded and verified within the coverage
below. Ten independent judges ran in parallel (read-only, no edits).

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| End user | phantom "Undo and redo" + "Word wrap toggle" controls are claimed in copy but don't exist; the 300ms debounce is a verified data-loss window (reload under 300ms loses typed note — reproduced); word count suggests copy features not in the toolbar; textarea has no label; no way to know notes are actually saved |
| Domain | word count via `trim().split(/\s+/)` is fine for Latin scripts but silent on CJK (each CJK char is a word); localStorage has no try/catch — a QuotaExceededError (~5MB) blows up setItem and dies silently mid-tab; download hardcodes "note.txt" and revokes the blob URL immediately after click, which races in some browsers; Clear via `confirm()` wipes permanently with no undo and Cmd+Z can't restore it |
| Architect | autosave effect swallows its write failure (no flag, no message); no `storage` event listener → two tabs on the same note silently diverge; the 300ms debounce has no `pagehide`/`visibilitychange` flush; no char cap → 10MB+ strings freeze the tab on paste (perf gap); hydration reads localStorage in render (Next.js #418 mismatch) and re-writes it on mount |
| Code reviewer | empty-note write on mount pollutes storage; same-file re-open never fires `onChange` (value unchanged); mount-time hydration SSR mismatch confirmed; debounce cleanup relies on unmount only; blob revoke timing; copy silently swallows failures with no feedback and no fallback |
| Functional tester | 18-scenario plan from the old component: all PASS, but verified-by-browser deficiencies match the group — fast-refresh loss, same-file re-open gap, undo-after-clear, cross-tab no-sync, and no visible save/failure feedback |
| Business analyst | copy truthfulness: claims undo/redo + word-wrap toggle that don't exist; no mention that notes are device/shared-browser-only; FAQ misses "can I recover a cleared note" and "can someone else see my notes"; differentiator = auto-save + export, but the size-limit FAQ answer omits the storage cap |
| Content/SEO | keyword row has high-airlift terms (text editor online, quick notes, scratchpad) the page can't rank for; description still ends up "free text tools tool" via the shared `toolTitle()` template; no guide exists yet for notepad (a {{req}} query gap); FAQ size answer is vague |
| Security/privacy | all PASS: 100% client-side, no network calls, clipboard is click-gated; findings: no cap means a paste can cross the localStorage quota and take the note down with a silent error; no shared-device caveat in copy; no pagehide flush means closing a tab quickly can lose the last few seconds |
| Accessibility | textarea is labelled only by placeholder → no accessible name; no `role=status` live region announcing saves; errors have no `role=alert`; buttons on the toolbar lack `min-h-11` and `focus-visible` styles; the meta footer is descriptive text, not associated with the field |
| Performance | large-paste freeze is real (no cap); the 300ms debounce itself is fine but the lack of a flush on pagehide is the loss vector; storage writes are tiny and cheap after the cap; no debounce monkey-patching needed |

## Changes And Evidence

- `src/features/notepad/Notepad.tsx` rebuilt:
  - hydration is `useState("")` + `setTimeout(0)` read of localStorage behind a
    `hydrated` flag + empty-guard on autosave, eliminating the Next.js #418
    mismatch and the redundant mount write-back;
  - flushes on `pagehide` and `visibilitychange` (hidden) via a text ref — the
    300ms debounce data-loss window is closed (fast reload persists in tests);
  - `storage` event listener keeps two tabs of the same note in sync;
  - `localStorage.setItem` fully guarded with a "not saving" label + dismissable
    `role=alert` error advising to copy before closing instead of dying silently;
    2,000,000-char `DOC_CHAR_CAP` clamped on input and storage read, with a
    visible over-limit `role=alert` ("This note is limited to 2 million
    characters…") and a Dismiss button;
  - copy uses `navigator.clipboard` with an `execCommand` fallback, success
    feedback (button flips to "Copied" for 1.5s) + sr-only announce, and an
    honest "this browser blocked the clipboard" error on failure;
  - download derives the filename from the sanitized first line + date
    (e.g. `meeting-notes-2026-09-16.txt`), appends/removes the anchor, and
    revokes the blob URL after 1s (no race);
  - Clear is a two-step armed "Clear → Confirm clear" (danger variant, 4s
    disarm) with no `confirm()` dialog and no undo claim; resetting last-saved
    state so the footer truthfully returns to "auto-saves locally";
  - Open validates an 8 MB byte cap, decodes UTF-8, flags >20 U+FFFD
    replacement chars as "doesn't look like plain text", resets the input value
    so the same file can be re-selected, and refocuses the textarea;
  - Save/Copy/Clear disabled when empty; textarea has a visible "Notes" label,
    `aria-describedby` pointing at the footer, a `role=status` live region, and
    a `min-h-11` + `focus-visible` ring on the toolbar;
  - footer format: `{n} word(s) · {m} char(s) · {auto-saves locally | saved at HH:MM | not saving}`.
- Copy (`tool-content.ts`): longDescription rewritten to three honest blocks;
  features list drops the phantom undo/redo and word-wrap claims and states
  wrap behavior as-is; howTo has zero false steps; FAQ grew 3 → 5 (added "Can I
  recover a note I cleared?" → No, and "Can someone else on this device see my
  notes?" → Yes — shared-device caveat); size-limit answer is now concrete
  (browser storage / ~2M chars cap) instead of vague.
- Registry (`tools.ts`): description → "Notepad online — notes that auto-save
  in this browser with a live word count. No sign-up, nothing uploaded; open
  and export as .txt."
- SEO (`seo.ts`): notepad keyword row → long-tail terms this page can actually
  satisfy (online notepad, auto save notes, notes auto save in browser, private
  notes online no sign up, take quick notes online). Shared fix:
  `toolTitle()` is now plural-aware (`cat.endsWith("s") || cat.includes("&") ?
  "" : " tool"`), so polyglot categories like "Text Tools" stop appending a
  junk "tool" suffix (the "free text tools tool" residual).
- Page h1 (`src/app/use/[slug]/page.tsx`): the tool name is now an `<h1>`
  instead of a `<span>` (shared a11y improvement for the fullscreen tool app).
- Guide (`guides.ts`): new `how-to-use-a-free-online-notepad` (fields match the
  `Guide` interface, published/updated 2026-09-16, 3 sections covering
  auto-save, counts, and open/export), `toolSlug: "notepad"`.
- Verification: production build 285 pages (was 284; +1 guide), lint 0 errors /
  4 pre-existing warnings, and `e2e/notepad-browser.mjs` — 34 production Chrome
  scenarios passed (fresh load, live word/char counts incl. `café ☕ 東京`,
  reload persistence, fast-reload pagehide flush, clipboard copy + "Copied"
  feedback + disabled-when-empty, derived download filename + content, two-step
  armed clear + auto-revert + count reset, file open incl. same-file re-select
  + focus return, mobile 375px no-overflow, aria label/describedby/status
  region, saved-at label flip, over-capacity alert + dismiss + cap, and a
  cross-tool base64 regression). `e2e/qr-browser.mjs` (23) and
  `e2e/url-encoder-browser.mjs` (19) and `e2e/base64-browser.mjs` (27) re-run
  green. The `__next-route-announcer__` region is excluded from all role=alert
  assertions.

## Remaining Limits

Not runtime-verified: physical mobile devices, Firefox, Safari, or real
screen-reader passes. The shared `Button` component still lacks an always-on
`focus-visible` ring (notepad compensates locally; the shared gap is
site-wide). Residual shared items still open: /verify audit wording,
physical-browser matrix, header 375px nav overflow, `image-base64` self-link
and `utf8-converter`/`aes-encryption` reciprocal relatedSlugs edges. Tightening
the download stem to the first line's first 24 chars is a deliberate honesty
choice for long first lines.

Other tools in the registry have not completed this ten-judge process beyond
PDF Compressor, Image Compressor, Image Resizer, JSON Formatter, URL Encoder,
Base64 Encoder & Decoder, QR Code Generator, and Notepad — 115 remaining.

Next tool: Password Generator, the next entry after notepad in the registry.