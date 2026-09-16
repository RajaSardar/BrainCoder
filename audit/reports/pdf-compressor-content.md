# PDF Compressor Content Corrections

Date: 2026-09-16

## Basis And Scope

Read `pdf-compressor-implementation.md` and the current compressor engine, client, worker, and UI before editing shared content. Current implemented behavior superseded older audit findings. Read root `AGENTS.md` and installed Next.js documentation for pages/async params, linking and navigation, metadata, and server/client components before route edits. Loaded the installed JavaScript skill; no agents were used.

All manual edits used `apply_patch`. Existing feature and audit edits were preserved. No feature engine/UI, other tool implementations, tests, dependencies, or configuration were changed. No commits, pushes, builds, server lifecycle commands, or browser tests were run.

## Changed Paths

- `src/lib/tool-content.ts`: Replaced only the PDF Compressor description, features, four-step how-to, and FAQ. Corrected three inbound `pdf-compress` related slugs to `pdf-compressor` (Remove Blank Pages, Flatten PDF, and Scale PDF Pages entries); other tool content was left alone.
- `src/lib/tools.ts`: Updated the compressor registry description with the single-file 100 MiB cap, three lossy presets, text preservation, and never-larger output. Existing metadata consumers inherit this description.
- `src/lib/guides.ts`: Rewrote `how-to-compress-pdf-online` to match the actual workflow and limitations; updated its revision date. Other guides were unchanged.
- `src/lib/seo.ts`: Removed the Compress category's blanket lossless claim and used the compressor description for its structured-data feature list instead of unrelated format/convert/generate claims.
- `src/components/CategoryIndex.tsx`: Corrected the duplicated Compress category description without changing other categories or layout.
- `src/app/categories/[slug]/page.tsx`: Replaced the blanket no-limits sentence with tool-dependent limits.
- `src/app/tools/[slug]/page.tsx`: Replaced the hard-coded three-step introduction with neutral wording; removed no-hidden-limits and immediate-output claims from the shared trust band. Layout and details links were retained.
- `src/app/guides/[slug]/page.tsx`: Changed the shared Open-tool CTA destination from `/tools/${tool.slug}` to `/use/${tool.slug}`. Details/canonical links elsewhere remain `/tools`.
- `src/components/ToolPreview.tsx`: Added a compressor-only illustrative label, single PDF, 100 MiB limit, and Light/Balanced/Strong preset display. The compressor branch omits fictitious progress and download status. Other tool previews retain their existing presentation.
- `src/components/ToolFaq.tsx`: Added `aria-expanded`, stable `useId`-based `aria-controls` targets, persistent hidden answer panels, and a decorative chevron designation. Existing toggle behavior and layout remain.
- `audit/reports/pdf-compressor-content.md`: This report.

## Content Contract

The compressor entry and guide now state that one non-empty PDF up to 100 MiB is processed locally in a JavaScript worker, not WASM. All three image presets are lossy; unsupported images are skipped. Text is not rasterized, metadata is preserved, and compression is not sanitization or OCR. Encrypted PDFs and documents with populated digital signatures are rejected; empty signature fields alone are not, and authenticity is not validated. Equal/larger output falls back to the byte-exact original. No percentage reduction, target size, or immediate result is promised. The FAQ and guide also explain cancellation, the 60-second timeout, and browser resource limits.

The tool page already derives its FAQ and HowTo JSON-LD directly from the same content arrays, so visible and structured answers/steps share the corrected source. The guide metadata similarly uses the revised guide description.

## Actual Checks

Ran from `/Users/rajasardar/repos/BrainCoder`:

```sh
./node_modules/.bin/eslint src/lib/tool-content.ts src/lib/tools.ts src/lib/guides.ts src/lib/seo.ts "src/app/tools/[slug]/page.tsx" "src/app/categories/[slug]/page.tsx" "src/app/guides/[slug]/page.tsx" src/components/ToolFaq.tsx src/components/ToolPreview.tsx src/components/CategoryIndex.tsx
```

Result: exit 0, no errors or warnings. An earlier nine-file run also passed before the duplicated category copy was corrected.

```sh
git diff --check -- src/lib/tool-content.ts src/lib/tools.ts src/lib/guides.ts src/lib/seo.ts "src/app/tools/[slug]/page.tsx" "src/app/categories/[slug]/page.tsx" "src/app/guides/[slug]/page.tsx" src/components/ToolFaq.tsx src/components/ToolPreview.tsx src/components/CategoryIndex.tsx
```

Result: exit 0, no whitespace errors in the ten touched source paths.

- Reviewed the scoped source diff against the engine/UI and checked worktree status before and after source edits.
- A final source search for obsolete `pdf-compress` link/slug endings, `without losing quality`, `Three straightforward steps`, and `no hidden limits` found no matches in `src` TypeScript/TSX files.
- Inspected route sources: the guide CTA now targets the existing `/use/[slug]` route, while related-tool and tool-info links retain `/tools/[slug]`. This is source inspection, not an HTTP or browser navigation test.
- Inspected the FAQ source for state-derived expansion and matching answer IDs. No keyboard or screen-reader test was performed.

## Deferred Verification

No engine tests were rerun, and the previous implementation report's test results are not claimed as checks performed in this content step. No type-check, Next build, browser rendering, mobile layout, hydration, download, or accessibility automation was run. These source/lint checks do not establish browser or release readiness.

The `/verify` privacy-proof/blocking issue remains a separate deferred shared audit; that route was not changed. Broader homepage and other-tool marketing claims were not overhauled. `ToolSubNav` was left unchanged because no navigation change was needed for the compressor's existing section targets.
