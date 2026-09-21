# CSS Cursor: Parallel Judges Audit

Date: 2026-09-21. Status: nineteenth tool upgraded and verified — first
of the three-tool wave covering css-cursor, gzip-tool and image-to-pdf
(judged, upgraded and verified independently in parallel). All ten
judges returned usable reports; the capability gaps were runtime-closed
and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The promise "paste a URL" was unfulfillable — the tool has no way to load a remote image and browsers block cursor `url()` fetches anyway. Test target exists but there is no way to drop a custom cursor image. Snippet copy works but every card is a plain button with no affordance |
| Technical architect | Static preselected cards with no application state beyond the copy button; custom image path absent. Blob URLs created for any custom image are never revoked on unmount. No dedup/guard against non-image files |
| End-user UX | The copy claims drag & drop and keyboard navigation that do not exist. The test area does not visibly apply any cursor. Cards are visually identical with no selected state beyond button focus |
| Content/SEO | features/howTo promise "paste a URL", "drag & drop", animated cursor frames and "convert CSS to fetch the image" — all fabricated. Metadata fine-grained keywords target `cursor url generator` / `url cursor generator` which the tool cannot do |
| Business analyst | Core value = picking/copying a CSS `cursor` declaration and previewing a custom local image. MUST: support a local custom cursor image, MUST kill the paste-a-URL promise, SHOULD: single-copy action, keyboard-first grid |
| A11y specialist | Lists of buttons show no selection state (`aria-pressed` missing). The snippet output area has no accessible name or live region. Custom cursor state changes are silent — no `role=alert` for the "not an image" case |
| Security/privacy | Static client-side tool; no egress. Blob URL lifecycle is the only hygiene item (revoke on unmount/clear). Browsers block remote `cursor: url()` resources — the honest note must live in FAQ not features |
| Edge cases | Non-image file selected for the custom cursor; clearing a custom cursor; a custom cursor that fails to load (browser silently falls back); a hotlink that would have worked locally but is blocked once deployed |
| Performance | Trivial — 36 static cards. The concern is that no code path creates or destroys a Blob URL (nothing to leak yet, but custom-image support must revoke properly) |
| SSR/cross-browser | Static content only; no hydration risk. The `cursor: url(...)` declaration is serialized at copy/download time, never at SSR. Routes smoke 200 |

## Changes And Evidence

- `src/features/css-cursor/CssCursor.tsx` (rebuilt):
  - **Custom cursor now real (functional, architect, content, edge):** a
    labelled file input accepts a local PNG/CUR; the image is read as a
    Blob URL and applied as
    `cursor: url("blob:…") 2 2, pointer;` on the interactive preview
    target. Loading is deferred so the cursor only applies once the file
    actually decodes — the fallback `pointer` is never lost mid-flight.
    A Clear-custom control restores the default declaration. The Blob URL
    is tracked and revoked on unmount and on replacement (architect).
  - **Selection paradigm (UX, a11y):** the 36 cards are real buttons with
    `aria-pressed` selected state and distinct accessible names
    ("Preview none cursor"). The interactive preview section applies the
    selected cursor and announces it in a visible label
    ("Previewing: pointer"); a `role=status`-friendly hint plus a
    `role=alert` for the "not an image" rejection.
  - **One copy action (business, functionality):** the per-card copy
    buttons are gone — a single Copy button copies the exact
    `cursor: value;` declaration for the current selection (success
    feedback included).
  - **Honest scoping:** the feature-gate banner explains a custom image
    must be local and that browsers block remote cursor URLs; non-image
    files show a clear dismissal-free error.
- `src/lib/tool-content.ts`: css-cursor block rewritten — features list
  live preview on an interactive target, local PNG/CUR custom cursor,
  single-click copy, all CSS cursor keywords, 100% client-side; howTo
  (pick → test → add custom image → copy) removes the phantom paste-URL
  step; FAQ covers keyword catalog, custom images with the local-only
  requirement and browser remote-URL blocking, and confirms no uploads.
- `src/lib/seo.ts`: css-cursor keyword row widened to the honest intent
  set ("css cursor generator", "cursor css", "css cursor preview",
  "cursor property tester", "custom css cursor image") — the fabricated
  `url cursor generator` terms are gone; JSON-LD featureList override
  added.
- `src/lib/tools.ts`: description now matches implementation (interactive
  target + exact snippet copy).

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Production build passed — static pages 287/287 (single build for the
  three-tool wave).
- `e2e/css-cursor-browser.mjs` — 21 production Chrome scenarios, 21/21
  green: 36 keyword cards; default `cursor: pointer;` + "Previewing:
  pointer"; pointer selected via `aria-pressed`; grab updates declaration
  + label + deselects pointer; no per-card generic "Copy" buttons remain;
  copy writes the exact declaration (clipboard compare); a local PNG
  produces `cursor: url(blob:…) 2 2, pointer;` with the file name in the
  preview label; clear-custom restores pointer; a non-image file triggers
  a `role=alert`; `/use` + `/tools` 200; marketing copy documents local
  PNG/CUR and contains no paste-a-URL claim; zero hydration errors; zero
  page errors.
- Wave-1/2/3 harnesses re-run green against the same build.

## Residual (shared, not re-reported)

Site-header 375px nav overflow; `'unsafe-eval'` CSP; `/verify` wording;
ToolPreview upload mock; WebKit not runnable in harnesses; Next.js route
announcer `__next-route-announcer__` `role=alert` present on every page.