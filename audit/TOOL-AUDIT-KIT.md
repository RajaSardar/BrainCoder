# BrainCoder Tool Audit Kit

## Workflow

User corrections:
- Use 10 separate expert agents per tool, not one multi-role agent (2026-09-16).
- Judges are read-only, independent and may run in PARALLEL (2026-09-16).
- WAVES of 2–3 tools run concurrently (2026-09-20): judges for all tools in the
  wave launch in parallel; consolidation, implementation, the single production
  build, and per-tool harnesses each cover the whole wave before the next wave
  starts. Finish all tools in the wave (judge, upgrade content/pages, verify)
  before starting the next wave.

1. Select the next tool from the registry, starting with PDF Compressor.
2. Run the 10 judges below in parallel (read-only, independent). Wait for all
   to finish before implementing.
3. Judges inspect code and gather evidence without changing product files.
4. Consolidate confirmed findings; implement focused code and content fixes.
5. Run regression tests, lint and build. Record failures and untested cases.
6. Record completion and advance to the next tool. Never mark a tool tested
   from an HTTP 200 alone, or treat a subjective score as release approval.

## Judges (run in parallel)

1. End user: task clarity, error recovery, desktop/mobile workflows.
2. Domain expert: output correctness, format constraints, data preservation.
3. Technical architect: state, async lifecycle, workers, browser APIs.
4. Code reviewer: maintainability, types, React patterns, regression risks.
5. Functional tester: valid/invalid inputs and downloaded output assertions.
6. Business analyst: useful scope, honest positioning, free-product value.
7. Content/SEO editor: landing page, guide, metadata and related-link accuracy.
8. Security/privacy reviewer: untrusted files, data flows, truthful guarantees.
9. Accessibility specialist: keyboard, labels, status announcements, mobile.
10. Performance/reliability engineer: memory, cancellation, large files, failures.

## Evidence Rules

- Report severity, file/line references, reproduction or source evidence,
  recommended minimal fix, and tests actually run versus proposed tests.
- Do not fabricate scores, output checks, browser testing or security proof.
- Local asset fetches are not file uploads. Inspect destinations and payloads.
- Content must match implementation, not arbitrary word counts or SEO quotas.
- Judges do not start/stop shared servers or run concurrent builds. The parent
  owns verification and runs one server/build at a time.
- Use existing dependencies, preserve the design system, keep everything free.
- Preserve unrelated worktree changes. Use apply_patch for manual edits.
- Read AGENTS.md and relevant installed Next.js docs before framework changes.

## Tracking

Registry: src/lib/tools.ts. Code: src/features/{slug}/. Related content:
src/lib/tool-content.ts, src/lib/guides.ts, src/lib/seo.ts, tool/use/category
routes and shared preview components. Reports: audit/reports/{slug}.md.

Record each judge's findings, implemented changes, verification commands and
results, deferred work and next tool. All 123 tools remain in scope; only mark
individual tools complete once their own judging, upgrades and checks finish.
