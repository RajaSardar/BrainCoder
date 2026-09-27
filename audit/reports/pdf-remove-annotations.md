# PDF Remove Annotations: Parallel Judges Audit

Date: 2026-09-27. Status: forty-fourth tool upgraded and verified — the third
tool of the eighth audit wave. Ten judges (functional, PDF/domain expert,
technical architect, code reviewer, end-user UX, business, security, a11y, SEO
and performance) returned; every gap raised was closed and verified. Focus of
the round: the removal had to be a real structural rewrite rather than a
visual hiding, a visible count and breakdown the user can review *before*
confirming, a download that cannot be lost, and copy that never implies the
output is redacted, signed, or scrubbed.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The old build stripped annotations and reported nothing: no count, no breakdown, no per-page detail, and a download that fired once with no way back if the browser swallowed it. Users need: an "Open PDF" opener, a scan that reports the exact number of annotations found with a per-kind breakdown and a per-page list, confirmation only after that, an optional keep-form-fields box, a `<base>-no-annotations.pdf` download, and a result panel that keeps the bytes for a re-download. Gaps found during the round and closed: the result panel had to become a `role=status` region so a screen-reader user hears the outcome, the keep-fields checkbox had to clear a stale result (otherwise the panel described a run that no longer matched the options), and the download filename needed a hard stem cap. |
| Domain expert (PDF) | Annotations are page-level `/Annots` entries; the honest removal deletes the `/Annots` array from every page, not just the entries a reader happens to hide, and it must clear the catalog `/AcroForm` when widget annotations go, or a reader rebuilds an empty form. Acrobat writes a comment's `/Popup` *without* listing it in `/Annots`, so unlinking alone leaves the popup's contents — and the author's name — in the file; a reachability walk from the object graph is required to prune what the removed annotations owned, and it is best-effort (a walk that throws is disclosed, never silently claimed as pruned). The round added exactly that walk plus its failure disclosure. Filled field values live inside the field, not on the page, so they disappear with the widget unless they were already flattened into page content — a catch that must be stated, not hidden. Signature dictionaries are invalidated by any rewrite, and XFA/JavaScript forms lose their `/AcroForm` entirely. |
| Technical architect | pdf-lib is imported lazily so the initial JS payload stays small; a `runId` ref bails after every await so a superseded run can neither write state nor download; the source bytes live in a ref rather than component state, so React never re-copies a 100 MB `Uint8Array` on a progress tick. Scanning and stripping are separate passes: the scan is read-only and cheap, the mutation pass yields to the event loop every `PAINT_EVERY = 10` pages so the progress line actually repaints on a 200-page document, and pruning is a third, clearly-labelled phase. The result is held as one `Uint8Array` used for both the download and the re-download, so the two can never disagree. |
| Code reviewer | `friendlyError`/`userFacing`/`toUiError` routing so engine throws become friendly steers; `outputNameFor` strips only a trailing `.pdf`, neutralises path separators and control characters, caps the stem at `MAX_STEM = 96` and trims trailing dots and spaces (a name cannot be `report.` or end in a space on Windows), and one name is built and used for the download, the success line and the re-download button. `sizeDelta` states the change in both directions rather than only when the file shrank. Two findings closed: the per-kind wording rendered "1 links"/"1 form fields" (singular and plural labels now come from one table, mirrored in the Node check), and the result panel's "Found / removed" pair was only meaningful once the kept-field count was itemised beside it. |
| End-user UX | Nothing is removed until the user has seen what will go: the scan line names the file, the page count and the size, the fieldset carries the breakdown ("2 comments, highlights and notes, 1 link, 1 stamp, 1 form field") and a per-page list, and the button reads "Remove 5 annotations → download". A clean file is not treated as an error — the button reads "Nothing to remove" and the status says there is nothing to remove. The result panel restates what happened, what was kept, the output size against the original, and offers "Download marked-no-annotations.pdf again" without re-running anything. |
| Business analyst | Trust is the product. The copy states what the tool does (the annotation layer goes; page text, images and layout do not) and what it does not do: this is not redaction and PDF Redact is the right tool for hidden content, a signed PDF comes out unsigned even if one comment was deleted, links go because links are implemented as annotations, a filled value disappears with its field unless it was already flattened, and unreferenced bytes can survive a rewrite so no forensic scrub is promised. The keep-fields wording had to be corrected: it promised the fields' *values* would stay, which only holds for values already flattened into the page. |
| Security | No upload path exists: bytes are read with `file.arrayBuffer()`, rewritten with pdf-lib and saved locally. `ignoreEncryption` is not used, so a protected file is refused and steered to `/use/pdf-unlock`; both files are preflighted for the `%PDF-` magic bytes before the parser is trusted; caps (100 MB / 200 pages) are enforced before any work; the user's bytes are never written back. The file input is the only ingestion path — there is no drag-and-drop surface and no `dangerouslySetInnerHTML` of user input. |
| A11y specialist | A real `<label htmlFor>` opener bound to a hidden input with a `useId` id, one `fieldset`/`legend` group holding the file name, size, breakdown and per-page detail, a labelled checkbox, `role=alert` for errors, four `role=status` regions (sr-only busy line, idle/ready line, file-status line, result panel) and `aria-busy` on the root container that clears when the run ends. Progress is announced through a status line that names the real phase ("Scanning page 12 of 200…", "Pruning orphaned annotation data…", "Writing the new file…") rather than a spinner with no text. The unlock steer is a real `Link`, not a click handler on a `div`. |
| SEO/content | `TOOL_KEYWORDS["pdf-remove-annotations"]` (incl. "remove annotations from pdf online free", "delete pdf comments", "remove annotations without uploading"), a truthful `TOOL_FEATURE_LIST` entry, a `CUSTOM_TITLES` entry that names the job, and copy updates across the long description, feature list, how-to and FAQ: the pruning claim, the corrected keep-fields wording, the re-download, the XFA consequence, the signature consequence and the redaction boundary. The guide's worked example was arithmetically wrong (it summed a 40-object file to "removes all 43"); it now adds up, the file is `-no-annotations.pdf` by name, and the section on limits is honest about signatures, XFA and surviving bytes. No `guide` key was added to `ToolContent`: that type has no such field and the marketing page already renders related guides from `getGuidesByTool`. |
| Perf judge | Cost is bounded by the caps, not by the document: the scan pass touches only each page's `/Annots` array, the mutation pass touches the same arrays, and pruning walks the object graph once. Nothing is rasterized at any point. pdf-lib's work is synchronous between awaits, so the loop yields to the event loop every `PAINT_EVERY = 10` pages and at the last page, which keeps the progress line honest on a 200-page run; a 200-page run of a 100 MB file is still memory-hungry in a browser tab, and that is disclosed. |

## Changes And Evidence

- `src/features/pdf-remove-annotations/PdfRemoveAnnotations.tsx` — scan,
  breakdown, per-page detail, keep-form-fields, async strip with progress,
  reachability prune with a failure disclosure, result panel with re-download,
  `aria-busy`, `runId` bails after every await, friendly-error routing,
  download `<base>-no-annotations.pdf` via `downloadBlob`, `%PDF-` preflight,
  100 MB / 200-page caps, encryption steer, `MAX_STEM = 96` filename cap.
- **Structural removal, verified in the saved bytes.** The audit's fixtures
  carry a link, a comment whose popup is deliberately *not* listed in the page
  `/Annots` array (the shape Acrobat writes), a highlight, a stamp and a filled
  text widget. After a run the mirror proves: no `/Annots` array survives on any
  page, the catalog `/AcroForm` is gone, none of the four payload strings
  remain in the file, and no `/Subtype` of `Link`, `Text`, `Highlight`, `Stamp`
  or `Widget` survives. The text pdfjs extracts from every page is identical
  before and after, which is the honest claim the copy makes — "page text,
  images and layout are unchanged" is scoped to the annotation layer, not to the
  whole file.
- **The orphan popup.** Because the popup is unreachable from the page arrays,
  unlinking alone would leave it in the file. A dedicated fixture proves the
  reachability walk removes the orphaned popup and the orphaned reply thread.
  The walk is built on "live first, then candidates": a fixture proves it never
  queues live structure (the page tree, the font, the page content stream) and
  collects only what was reachable *exclusively* from the removed annotations —
  in the main fixture that is the widget's `/AP` appearance stream, which is why
  the candidate count is 8 for 7 annotations.
- **The user's own bytes are never rewritten.** A run over the annotated fixture
  leaves the input array element-for-element identical and the source file on
  disk byte-for-byte unchanged.
- **Pruning honesty.** `pruneFailed` is surfaced to the user. A check forces the
  reachability walk to throw and asserts the result still saves, the annotation
  is still gone, and the component discloses that pruning did not complete
  rather than claiming the objects were collected.
- **Keep-form-fields mode** removes the markup and leaves the widget and its
  `AcroForm` in place, and the filled value survives it — verified through
  pdfjs, which reports the widget's `fieldValue`, because the value lives in a
  compressed appearance stream and a raw-byte search would pass vacuously. The
  mirror's own payload assertions probe **both** pdf-lib string encodings
  (literal `(...)` and UTF-16BE hex `<FEFF...>`) for the same reason, and a
  precondition check proves the source bytes really carried the strings being
  asserted absent.
- **A verified result, and a download that cannot be lost.** The result panel is
  a `role=status` region with an `h3` ("Clean copy ready"), a definition list of
  found/removed, kept fields and the size change against the original, and a
  re-download button that serves the same bytes the automatic download used —
  so the re-download is byte-identical by construction, and the harness asserts
  it.
- **Caps and error paths** are covered by real files: a 201-page document is
  refused at the page cap, a 100 MiB + 1 KB file is refused before parsing, a
  file without the `%PDF-` magic is refused by name, and the existing encrypted
  fixture is steered to `/use/pdf-unlock` with a real link. A file with no
  annotations is not an error.
- Copy (`src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`):
  honest about the annotation layer, the pruning, the re-download, links,
  filled values, signatures, XFA and the redaction boundary; `src/lib/tools.ts`
  was already truthful and is unchanged.
- Guide: `how-to-remove-annotations-from-a-pdf` (`toolSlug:
  "pdf-remove-annotations"`, 6 sections, `readMinutes: 4`) — what counts as an
  annotation, checking before removing, the filled-in value catch, the run and
  the re-download, what the tool does not do, and the limits. Its worked example
  was arithmetically wrong (a 40-object file that "removes all 43 of them") and
  now adds up; the stale "43 objects" claim is gone and a Node check asserts
  both halves of that fix.
- `audit/check-pdf-remove-annotations.mjs` — **256/256** Node-mirror checks,
  including the orphan-popup, live-structure-vs-candidates, prune-failure,
  keep-mode, byte-immutability, idempotence and 200-page-cap cases, progress cadence, the
  singular/plural regression guard, filename hardening, and source-level
  lifecycle and copy checks.
- `e2e/pdf-remove-annotations-browser.mjs` — 90 authored production-Chrome
  scenarios plus a harness-exception guard (**not run** in this environment by
  instruction; `node --check` parses it): the real `<label>` opener, the
  `/nothing is uploaded/` idle claim, the scan line, the breakdown and per-page
  detail, the keep-fields checkbox, `<base>-no-annotations.pdf` naming, the
  downloaded bytes checked with pdfjs and pdf-lib (subtypes, page text, widget
  values, `/Annots` count, `AcroForm`, payload strings), busy progress through
  all three phases recorded by a MutationObserver, `aria-busy` clearing, the
  result panel, a byte-identical re-download, a 25-page run, a clean file, the
  unlock steer, invalid/oversize/over-page refusals, zero hydration and page
  errors, the marketing page's copy honesty, the guide, and the sitemap.
  Five defects in the harness itself were found and fixed while reconciling it
  with the real engine rather than left to fail on a future run: a missing
  `PDFName` import; a raw Node `Buffer` handed to pdfjs, which rejects it
  outright; an `annots.size === "number"` guard that silently counted zero
  annotations on every file (pdf-lib's `size()` is a method); raw-byte payload
  searches that would have passed vacuously against pdf-lib's UTF-16BE hex
  string encoding (and a `/e2e_notes` search that was vacuous for the same
  reason — a field's `/T` is a PDF string, not a name); and negative copy checks
  (`drag and drop`, `instant`, `guarantee`) run over the whole page, where the
  "Related tools" cards and site chrome legitimately use those words — they are
  now scoped to this tool's own copy region. Every fixture, precondition and
  byte-level assertion in the harness was additionally re-verified offline
  against pdf-lib and pdfjs without launching a browser.
- Verification: `node audit/check-pdf-remove-annotations.mjs` → **256 passed, 0
  failed**; `npx tsc --noEmit` → **0 errors repo-wide**; `npx eslint` on every
  touched file (`src/features/pdf-remove-annotations/PdfRemoveAnnotations.tsx`,
  `audit/check-pdf-remove-annotations.mjs`,
  `e2e/pdf-remove-annotations-browser.mjs`, `src/lib/tools.ts`,
  `src/lib/tool-content.ts`, `src/lib/seo.ts`, `src/lib/guides.ts`) → **clean,
  0 errors and 0 warnings**. `npm run build` and the e2e harness were **not run**
  in this environment by instruction.
- Tracked residuals (accepted, disclosed):
  1. This is not redaction. Hidden text, invisible layers and white-on-white
     content are untouched, and the component, the marketing copy and the guide
     all say so and point at PDF Redact.
  2. A signed PDF comes out unsigned — any rewrite invalidates the signature,
     even if a single comment was deleted.
  3. A filled-in form value normally disappears with its field, because it
     lives inside the field rather than on the page. A value already flattened
     into page content stays visible. Ticking keep-form-fields keeps the field
     fillable but not its old value.
  4. XFA and JavaScript forms lose their `/AcroForm` when widgets are removed,
     so a dynamic form becomes a static document.
  5. A rewrite of any PDF can leave unreferenced bytes behind. No conforming
     reader displays them, and that is exactly why the copy promises no
     forensic scrub — but it also means the pruned-object count is the honest
     number, not "nothing is left in the file".
  6. Document-level structure (bookmarks, named destinations, metadata) is
     carried through by pdf-lib's save, and this tool makes no promise beyond
     the page content and annotations it does not touch.
  7. pdf-lib rewriting is single-threaded and memory-bound: a 200-page,
     100 MB file is a heavy tab. The `requestAnimationFrame`/event-loop yields
     keep the UI responsive, and the caps bound the worst case.

Files: `src/features/pdf-remove-annotations/PdfRemoveAnnotations.tsx`,
`src/lib/tool-content.ts`, `src/lib/tools.ts`, `src/lib/seo.ts`,
`src/lib/guides.ts`, `audit/check-pdf-remove-annotations.mjs`,
`e2e/pdf-remove-annotations-browser.mjs`.
