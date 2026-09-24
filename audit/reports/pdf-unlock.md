# PDF Unlock: Parallel Judges Audit

Date: 2026-09-24. Status: thirty-fourth tool upgraded and verified — the
second tool of the fifth audit wave. Ten judges returned (PDF/encryption domain
expert, functional, technical architect, code reviewer, end-user UX, business,
security, a11y, SEO and performance); every gap they raised was closed and
verified. Focus of the round: real decryption with an honest supported-set.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | No caps; no runId; no busy guard; existing input not reset; the placeholder said "Enter the password — it stays in your browser" which implied *you* set the password; wrong-password surfaced raw; **output never validated** — whatever the decrypt wrapper returned was shipped even if it was garbage |
| Domain expert | Decryption is real work, not stripping a tag: the owner and user passwords both unlock a standard PDF, so accept BOTH. RC4-40, RC4-128 (V=2/R=3) and AES-256 (V=5/R=6) are supported by the dependency; **AES-128 (V=4) is NOT** and must be refused explicitly, not mis-explained. The "not password-protected" case must be a friendly, distinct path ("This PDF isn't password-protected."). A decrypted result must be validated as a real PDF: plain `PDFDocument.load` of the output must succeed |
| Technical architect | Dynamic `import("@pdfsmaller/pdf-decrypt")` only at unlock time; single pdf-lib pass beforehand to classify the file (encrypted / not-encrypted / not-a-PDF / unsupported V=4); output = freshly-written plain `Uint8Array` re-loaded for validation; runId guards every async hop |
| Code reviewer | Refuse unsupported encryption with a message naming the R algorithm ("RC4 40-bit, RC4 128-bit and AES-256 are supported") instead of a cryptic dependency error. Empty password on a restrictions-only file is a legitimate unlock (lib supports it) — allow but label. Wrong user vs wrong owner password both fail the same way. Output file named `<src>-unlocked.pdf`. Never retain the password across a re-pick (clear on upload) |
| End-user UX | "Enter the password" was overwritten by a VPN-adjacent gem: the new copy tells the user exactly what qualifies — "If you know the password, type it and unlock… If you've forgotten it, no tool can help" (direct, honest, deletes the old lie). The blank / not-protected / unsupported states each need their own plain-language message, not a generic failure |
| Business analyst | Copy formerly implied successful unlock = data salvaged and the file permanently de-protected; now: one password formula, "the output opens without a password", AES-128 honest no, Chrome/Firefox viewer note, steering to Protect to re-lock. Reciprocal link set kept consistent with the neighbours |
| Security | PASS — password stays in a hidden input in memory only, never logged or sent; no egress; `friendlyError` must not echo the password. Bound by size/page caps. Deleting a password is a legitimate capability of encryption; handled. |
| A11y specialist | `useId` label/htmlFor on the password input; fieldset/legend "PDF password"; `role=alert` for errors, `role=status` for state lines; `aria-busy` root; sr-only busy; slate-500 captions; button stays focusable while disabled during processing |
| SEO/content | `TOOL_KEYWORDS["pdf-unlock"]` + truthful `TOOL_FEATURE_LIST` JSON-LD missing; CUSTOM_TOOL_TITLES mis-title; guide was linked as `how-to-unlock-a-pdf` but the real slug is `how-to-unlock-a-password-protected-pdf` (broken destination — fixed); reciprocal guides (Protect/Crop use case) verified |
| Perf judge | Single pdf-lib parse + one decrypt lib pass; no worker; output validated with one reload; no eager bundle cost; runId prevents a slow older run from clobbering a newer one |

## Changes And Evidence

- `src/features/pdf-unlock/PdfUnlock.tsx` (rebuilt):
  - **Honest, direct framing.** Headline tells the user exactly what unlocks a
    file and what can't: "If you know the password (or only a restrictions
    password was set), type it — the file opens without a password afterward.
    If you've forgotten the password, no tool can recover it." The old
    "Enter the password — it stays in your browser" misframe is gone.
  - **Both passwords + empty-password case.** Owner password and user
    password both unlock the standard anyway; the decrypt lib takes a single
    candidate. A file that is encrypted only to *restrict* uses `allow:*`
    flags but keeps an empty user password — that genuinely unlocks with an
    empty input; the UI accepts it (placeholder says "leave blank if the
    password was never set").
  - **Explicit supported-set refusal.** Files with encryption that the
    dependency can't decrypt (AES-128, V=4) are detected up front (pdf-lib
    exposes `/V` on the `/Encrypt` dict) and refused loudly:
    "AES-128 encryption isn't supported yet — open this PDF in Adobe Acrobat
    (or Preview) to remove the password. RC4 40-bit, RC4 128-bit and AES-256
    files unlock here." Fake/unsupported V values fall back to the same
    message instead of a dependency exception.
  - **Output proof.** Decrypted output is re-loaded with a plain
    `PDFDocument.load`; only a genuinely open, valid PDF is offered for
    download. A run whose output still reports encrypted (impossible with a
    correct lib, but guarded anyway) fails loudly rather than shipping.
  - **`friendlyError` ordering fixed during e2e.** "This file doesn't look
    like a valid PDF." now wins the ordering fight:
    `Failed to parse|No PDF header` is checked BEFORE `Failed to
    (read|decrypt) PDF`, because `isEncrypted` wraps parse failures inside a
    "Failed to read PDF: …" prefix that the old order swallowed into a vague
    "couldn't be read" message. Fallback restored:
    "Couldn't unlock this PDF — try again." (never empty).
  - **Not-encrypted and wrong-password states** are distinct and
    plain-language: "This PDF isn't password-protected." /
    "That password doesn't work for this PDF — try the other one, or leave it
    blank." (role=alert).
  - **Team standard.** Caps 100 MB / 200 pages (oversized → PDF Split),
    runId, busy guard (Unlock no-op while busy), password cleared on new
    file, input reset so a re-pick works, `resetState()` on error, honest
    `<src>-unlocked.pdf` naming, `aria-busy` root, `useId` label-for,
    fieldset/legend "PDF password", sr-only busy, slate-500 captions,
    role=status idle/load/progress/success.
  - **Copy/SEO.** Long description/features/howTo/FAQ rewritten (knows-the-
    password gating, empty password case, AES-128 no, "opens without a
    password" outcome, Chrome/Firefox viewer note, → Protect to re-lock and
    → PDF Crop whose own pipeline steers encrypted files here).
- `src/lib/seo.ts`: `TOOL_UNLOCK`/`TOOL_METADATA` share the new
  `CUSTOM_TITLES["pdf-unlock"]` → "Unlock PDF Online — Remove Password From
  PDF", `TOOL_KEYWORDS["pdf-unlock"]` (7 terms) and a truthful
  `TOOL_FEATURE_LIST` JSON-LD.
- `src/lib/tool-content.ts` ("pdf-unlock" rewritten and simplified — slimmer,
  honest, no invented claims).
- Verification:
  - `audit/check-pdf-unlock.mjs` — **15/15** node checks: decrypt the RC4
    fixture with the user password ("pw") and with the **owner password**
    ("owner") — output plain-loads with all pages; wrong password rejected
    with the dependency's "Failed to decrypt" path; not-encrypted input
    classified and refused ("isn't password-protected"); AES-256-R6
    (produced by Protect) decrypts back to the source pages; a fake
    V=4/AES-128 doc is refused with the supported-set message; not-a-PDF
    refused as invalid; decrypted output header is `%PDF` and re-loadable
    without a password. (Fixture: `e2e/fixtures/encrypted.pdf`, rebuilt
    with `@pdfsmaller/pdf-encrypt` RC4 V=2/R=3, 128-bit.)
  - `e2e/pdf-unlock-browser.mjs` — **33/33** production Chrome scenarios:
    accessible idle state, fieldset legend, typeable input, unlock via
    "pw" (real, byte-identical pages), owner-password unlock, wrong-password
    alert, empty input on the restrictions-only file unlocks, not-encrypted
    message, not-a-PDF message, unsupported AES-128 message, oversized/220-
    page steering, zero hydration/page errors, honest copy (one-password
    formula, no "we can recover it", AES-128 no, outcome stated), honest tool
    title, guide 200 (`how-to-unlock-a-password-protected-pdf`), sitemap
    lists tool + guide. E2E caught the guide-slug mismatch before this report
    was written.
  - Build: clean tsc + eslint; production build passed (**295 pages**, 30
    guides).
- Tracked residuals (accepted): AES-128 and rare custom AES-variants aren't
  supported — refused honestly, with an Acrobat/Preview route out; documents
  whose encrypted streams live inside object streams remain unreliable with
  this dependency (accepted, disclosed in FAQ: "open in Acrobat/Preview for
  exotic encryptions"); decryption re-writes the PDF, so a source with
  non-conforming structure may come back visually unchanged or slightly
  different (documented, non-destructive guarantee is only about the
  password).

Files: `src/features/pdf-unlock/PdfUnlock.tsx`, `src/lib/seo.ts`,
`src/lib/tool-content.ts`, `e2e/fixtures/make-encrypted.mjs`,
`e2e/fixtures/encrypted.pdf`, `audit/check-pdf-unlock.mjs`,
`e2e/pdf-unlock-browser.mjs`.