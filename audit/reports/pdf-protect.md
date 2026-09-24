# PDF Protect: Parallel Judges Audit

Date: 2026-09-24. Status: thirty-third tool upgraded and verified — the
first tool of the fifth audit wave. Ten judges returned (PDF/encryption domain
expert, functional, technical architect, code reviewer, end-user UX, business,
security, a11y, SEO and performance); every gap they raised was closed and
verified. Focus of the round: real AES-256 protection with honest scope.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | No caps (file size/pages); no enforcement of the 5‑character minimum — short passwords silently went through; no confirm field; restrictions always enabled (copy claimed you could block printing/copying, and the UI actually couldn't); no busy guard on Protect (double-downloads); no runId; raw `err.message`; input value never reset |
| Domain expert (2nd run) | **Verified AES-256 is real** (R=6, random salts, `/U`/`/O`/`/OE` per Algorithm 2.B from the spec) and that the permission flags genuinely set P bits (`allow* !== false` → bit set). **CRITICAL copy/UI mismatch**: `ownerPassword` defaults to `userPassword` in the lib, so a "set an owner password + permissions" UI never existed and must not be promised. `encodePasswordAES256` truncates to 127 bytes (SASLprep) — UI change: enforce `maxLength` 127 with an explicit error instead of silent truncation. Re-encrypting an encrypted file throws `AlreadyEncryptedError` — must be surfaced as friendly "remove the password with Unlock PDF first." Output must be proven encrypted (a plain `PDFDocument.load` of the result must throw) |
| Technical architect | Single pdf-lib load to validate/count + dynamic `import("@pdfsmaller/pdf-encrypt")` only at encrypt time (no eager bundle cost); one async path with a runId guard; in-memory `Uint8Array` end-to-end, no egress. Post-encryption self-test (plain load must throw) gives a hard guarantee instead of trusting the lib silently |
| Code reviewer | >127-char passwords were truncated in the low layer while the UI said nothing — reject, don't clip. `PDFDocument.load` on an already-encrypted upload throws with pdf-lib's "is encrypted" message — map it. Output filename `<src>-protected.pdf`. `download.ts` shared helper cloned every passed `Uint8Array` into a second copy on every download site-wide — removable once all callers are verified to pass `Uint8Array` |
| End-user UX | Copy promised drag-and-drop, "owner and user passwords", "no file size limits", "virtually unbreakable" and implied restrictions were a hard guarantee. None of that matched. The successful state must explain the *actual outcome* ("It now opens only with your password"). Password fields must clear after success |
| Business analyst | Copy-lies are the top trust risk (a security product over-claiming is fatal). FAQ must state: one password (no separate permissions password), AES-256 = Acrobat's standard for protected PDFs, restrictions honored by Acrobat/most desktop readers but ignored by some minimal or browser-based viewers (treat as convenience, not a hard guarantee), Chrome/Firefox built-in viewers don't accept PDF passwords at all. Steer removal to PDF Unlock; keep reciprocal links |
| Security | PASS — AES-256-R6 with per-file random salts (probe-verified), no network egress, password never leaves the browser. Bounded by size/page caps. Guidance note: the weak point is a short or predictable password (CLI-advisory in copy). `AlreadyEncryptedError` path is the one edge to guard (friendly steering, allowed) |
| A11y specialist | `useId` label/htmlFor for both password inputs; fieldset/legend ("Set a password", "Restrict what recipients can do"); `role=alert` errors, `role=status` idle/load/success lines; `aria-busy` on the root during async work; sr-only busy text; slate-500 captions (4 checkboxes each need their own label, keyboard-navigable) |
| SEO/content | `TOOL_KEYWORDS["pdf-protect"]` + a truthful `TOOL_FEATURE_LIST` JSON-LD missing; page `<title>` inherited the Convert-category "…conversion" suffix (wrong); a `how-to-password-protect-a-pdf` guide already existed (kept, verified 200); tagline already accurate |
| Perf judge | One pdf-lib parse total; encrypt lib dynamically imported; download helper's redundant full-buffer copy removed (probe: all 30+ `downloadBlob` callers pass fresh `Uint8Array`, so `new Blob([bytes])` is safe with a `Uint8Array<ArrayBuffer>` assertion) |

## Changes And Evidence

- `src/features/pdf-protect/PdfProtect.tsx` (rebuilt):
  - **Caps + honest validation.** 100 MB / 200 pages enforced with guidance;
    password must be 5–127 characters (short → "Password must be at least 5
    characters.", over → "…127 characters or fewer."), confirm field,
    mismatch error, `maxLength={127}` so the library's SASLprep truncation
    boundary can never be reached silently.
  - **Real permission restrictions.** Four toggles map to
    `allowPrinting / allowCopying / allowModifying / allowAnnotating`
    (`!lock` → `allow:*`). A node probe decodes the encrypted `<</Encrypt>>`
    dict's `/P` value via `PDFName.of("P")` and proves the print bit is set by
    default and cleared when "Block printing" is checked. The honest-only
    "permissions stay enabled" plan was deliberately upgraded once the lib's
    `allow*` flags were verified to work.
  - **Single password, stated plainly.** `ownerPassword` defaults to
    `userPassword` in the lib, so there is no owner/permissions password in
    the UI and no copy claiming one.
  - **Proof the encryption took.** After encrypting, the component calls
    `PDFDocument.load(outBytes)` again — it must throw (pdf-lib's "document
    is encrypted" error) or the run fails loudly ("The encrypted copy didn't
    take"). The download is refused unless the result is genuinely locked.
  - **`AlreadyEncryptedError` guard.** Uploading an encrypted file hits
    pdf-lib's plain-load throw on read → "This PDF is already
    password-protected. If you know its password, remove it with Unlock PDF
    first." (verified in e2e against the RC4 fixture).
  - **Team standard.** runId guard on every await (read, encrypt, self-test,
    finally), busy guard (Protect no-op while busy), `resetState()` on
    errors, `aria-busy` root, friendly `friendlyError` (encrypted → Unlock
    PDF steering; "No PDF header" → "doesn't look like a valid PDF"), input
    `aria-label` "Choose a PDF to protect", password fields cleared after
    success, `<src>-protected.pdf` naming, success status states the outcome.
  - **A11y.** `useId` label/htmlFor pairs (Password / Confirm password),
    two fieldsets with legends, `role=status` idle/load/success and
    `role=alert` errors, sr-only busy line, slate-500 captions.
- `src/lib/download.ts`: the redundant `new Uint8Array(bytes)` copy was
  removed — `new Blob([bytes as Uint8Array<ArrayBuffer>], { type })`.
  Blob silces the exact view bytes; TS is satisfied via the generic assertion.
  Every call-site verified to pass a fresh `Uint8Array` (probe + the full e2e
  suite that exercises ~30 download-using tools stayed green).
- `src/lib/tool-content.ts` (`"pdf-protect"`): drag-and-drop, "owner and user
  passwords", "no file size limits" and hype are gone. Long description,
  features, how-to and FAQ now state: one open password, optional
  print/copy/edit/annotate restrictions, AES-256 (Acrobat's standard), the
  "honored by Adobe Acrobat and most desktop readers; some minimal or
  browser-based viewers ignore them" caveat, and the Chrome/Firefox built-in
  PDF viewer limitation ("open in a dedicated reader instead"). FAQ removed
  and "unlock later" routed to Unlock PDF.
- `src/lib/seo.ts`: `TOOL_KEYWORDS["pdf-protect"]` (7 terms incl. "protect pdf
  online", "lock pdf with password", "add password to pdf"), truthful
  `TOOL_FEATURE_LIST` JSON-LD, and the Read of `toolTitle` now honours a
  `CUSTOM_TITLES` override so the tool is titled
  "Password Protect PDF online — free PDF lock tool" rather than the
  Convert-category "…conversion" title (same for Unlock and Metadata).
- Verification:
  - `audit/check-pdf-protect.mjs` — **16/16** node checks: round-trip
    encrypt → `isEncrypted` (AES-256, V=5 R=6) → `decryptPDF` → plain
    load keeps all 3 pages; wrong password rejected; plain load of the
    encrypted bytes throws (the component's proof path fires); `encryptPDF`
    on an already-encrypted input raises `AlreadyEncryptedError`;
    **permission bits physically differ** in the RC4 `<</Encrypt>>` dict
    (`allowPrinting:false` clears the print bit — decoded via pdf-lib
    `PDFName/"P"` lookup); RC4 output decrypts back;
    `encodePasswordAES256` truncates 130× "x" to exactly 127 bytes.
  - `e2e/pdf-protect-browser.mjs` — **36/36** production Chrome scenarios:
    accessible idle state, both fieldsets render, four restriction toggles,
    short/mismatch password alerts, real AES-256 download (isEncrypted:
    AES-256 R6), plain-load throws, password-decrypt round-trip of 3 pages,
    fields cleared + outcome status, >200 pages steering, locked-PDF upload
    steers to Unlock, not-a-PDF and >100 MB errors, zero hydration/page
    errors, honest `/tools/pdf-protect` copy (AES-256, 100 MB, minimum
    length, viewer caveats, no drag/drop, no "owner+user", no unbounded
    limits, no hype), honest tool title, guide 200, sitemap lists tool +
    guide.
  - Build: clean tsc + eslint; production build passed (**295 pages**, 30
    guides).
- Tracked residuals (accepted): restrictions are a convenience layer — honored
  by Acrobat/most desktop readers, ignored by some viewers (disclosed in copy
  and component caption); Chrome/Firefox's built-in viewers don't accept
  password-protected PDFs at all (disclosed); there is deliberately no
  separate permissions/owner-only second password (lib semantics, stated as
  such).

Files: `src/features/pdf-protect/PdfProtect.tsx`, `src/lib/download.ts`,
`src/lib/tool-content.ts`, `src/lib/seo.ts` (CUSTOM_TITLES),
`audit/check-pdf-protect.mjs`, `e2e/pdf-protect-browser.mjs`.