# PDF to Word: Parallel Judges Audit

Date: 2026-10-13. Status: audited, Node mirror audit and production-Chrome e2e harness added. Read-only per kit. No functional code changes required.

## The judges' consensus

| Expert | Main findings |
| --- | --- |
| Functional | Renders pages via pdf.js, builds DOCX with images via fflate; scale control present. |
| End-user UX | Clear drag/drop and choose file; live status; preview shown on success. |
| Business | Honest about image-based DOCX (full-page images) — no text extraction claim. |
| SEO/content | Copy matches implementation (image-based conversion). |
| Security | Client-side; no uploads; CSP respected. |
| A11y | role="status"/role="alert" present; labels/controls accessible. |
| Technical architect | Uses shared pdf-office support; proper cleanup; worker configured. |
| Performance | Scale affects quality/memory; reasonable. |
| Edge cases | Large files constrained by browser; errors handled. |
| Honesty | Discloses behavior accurately. |

## Severity table (file:line)

| Sev | Finding | Location | Status |
| --- | --- | --- | --- |
| None | No blockers found | — | VERIFIED |

## What works (VERIFIED)

- Component exposes file input with accept pdf, quality scale control, drop zone, status/alert regions, preview on success.
- buildDocx creates valid OPC package with word/document.xml and PNG references using zipSync.
- No off-origin/non-GET requests; no page errors in harness.
- Copy is client-side/browser-only; no server upload claims.

## Top-5 fixes

1. None required.

## Evidence

- Node mirror audit `audit/check-pdf-to-word.mjs`: 9 passed, 0 failed.
- Production-Chrome e2e `e2e/pdf-to-word-browser.mjs`: 8 passed, 0 failed.
- `tsc --noEmit` clean; ESLint 0/0; `next build` green (314 static pages).

## Tracked residuals (accepted, disclosed)

1. Output is image-based DOCX (not editable text extraction) — disclosed in UI/copy.
