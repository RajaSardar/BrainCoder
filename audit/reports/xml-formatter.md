# XML Formatter: Parallel Judges Audit

Date: 2026-10-05. Status: the parser and formatter rewritten from scratch, the
component rebuilt, a Node audit authored, copy and guide rewritten. Ten judges
(functional, end-user UX, business, SEO/content, security, a11y, technical
architect, performance, edge cases, honesty) returned. Every judge found the same
headline defect and it is one defect with two halves: **the page reported
"Valid XML" for documents that are not XML at all, and minify mode skipped the
check entirely** — so the same input got opposite answers depending only on which
button was pressed.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The false positives, all reproduced: `<a/><b/>` (two roots), `<a href=x/>` (unquoted value), `<a x="1" x="2"/>` (duplicate attribute), `<a>&nope;</a>` (undeclared entity), the bare word `hello`, empty input — every one reported **valid**. Minify mode did not check well-formedness at all. The tag-matching used a `<[^>]*>` regex, so `>` inside a quoted attribute value ended the tag early and corrupted the output. Errors reported `expected </undefined>` instead of the actual element name. |
| End-user UX | The badge said "Valid XML", which is a stronger claim than the tool could support and false about one input in six. Minify had no indication of whether it had succeeded. Copy and Download were live on a failed parse. Fixed: the badge says **Well-formed**, both modes share one verdict, actions are disabled unless a document was processed, and errors report a line and a column. |
| Business | The copy claimed syntax highlighting, precise error highlighting, self-closing tag normalization, attribute normalization, "handles all XML constructs correctly" and catching "mismatched namespace prefixes" — none of which existed. It also promised 8-space indentation. All rewritten around what the tool does: re-indent structure, check well-formedness, never rewrite text. |
| SEO/content | Five keywords for a tool that both formats and checks. Now 14, naming the two real jobs (`xml minifier`, `check xml well formed`, `xml error line column`). The registry name changed from **XML Formatter & Validator** to **XML Formatter & Well-Formness Check**, because the tool validates nothing. |
| Security | **Pass** on egress: no upload, no off-origin request, no non-GET request, nothing in a URL. **Fail** on resource exhaustion, and worse than SQL's: the implementation was quadratic in nesting. A 68 KB document threw a `RangeError`, and a 112 KB document built a **488 MB string** and froze the tab. Fixed by a depth cap checked during the scan, so a 23,250-level bomb is refused in milliseconds. |
| A11y | The mode buttons had no pressed state, the select and checkbox had no programmatic names, neither textarea was named, and the output pane was in the tab order. Now `aria-pressed` on each mode, real `<label htmlFor>` on the select and checkbox, both panes named, output at `tabIndex={-1}`. The status text is deliberately **not** a live region, because it quotes the reader's own XML. |
| Technical architect | A regex tag matcher replaced by a quote-aware tokenizer that consumes attribute values atomically. The formatter and the well-formedness check are now one pass over the token list, so the two can never disagree. Neither module touches the DOM, so the audit runs the shipped code in Node against libxml2. |
| Performance | Quadratic in depth before, bounded now: `MAX_XML_CHARS` 200,000, `MAX_XML_DEPTH` 200, `MAX_XML_OUTPUT_CHARS` 400,000. A 23,250-level bomb (68 KB) is refused in under a millisecond rather than attempting a 488 MB allocation; a 195,897-character legal document formats in 27 ms. |
| Edge cases | `>` inside a quoted attribute value; DOCTYPE with an internal subset declaring an entity; `<?xml?>` not at position 0 (illegal per spec — libxml2 rejects it, and so does the shipped code now); `<pre>` blocks; mixed content; CDATA; namespaces with prefixes; processing instructions; unterminated comment and CDATA; duplicate attributes; names starting with a digit; output re-validated by a real parser. All asserted. |
| Honesty | "Validator" in the display name, "Valid XML" on the badge, and a download button whose filename and indentation behaviour did not match the copy. Every one corrected. The panel now opens "Re-indents structure, never rewrites text." and states plainly that there is no DTD or schema check. |

## Changes And Evidence

**A real tokenizer, not a regex.** `<[^>]*>` cannot parse XML, because attribute
values may legally contain `>`. The tokenizer tracks quote state while scanning an
open tag, so `<a title="a > b">t</a>` survives. The audit's own first text extractor
made this mistake and had to be fixed the same way — recorded below.

**One verdict, two modes.** `checkWellFormed()` runs before formatting in both
modes and returns the same message for the same input. The audit asserts verdict
equality across 13 inputs in both modes.

**The verdict is measured against libxml2, not against memory.** `xmllint --noout`
runs over the same corpus and the two verdicts are compared. A hand-written list of
expected verdicts would only record what the author already believed; the old
code's failures were all cases where that belief was wrong. If `xmllint` is missing
the harness fails loudly rather than skipping, because a silently skipped oracle is
not evidence. Result: **40/40 agree**, and the one disagreement it found
(`<?xml version="1.0"?>` after the root) was a real bug in the shipped code, now
fixed.

**Text is never rewritten, and that is enforced structurally.** Only whitespace
between elements is re-indented, and only inside elements whose children are all
elements. An element holding text — mixed content, `pre`, CDATA, an attribute value
— is emitted verbatim. The visible consequence is that a mostly-text document may
look barely different afterwards, and that is the correct behaviour rather than a
failure. The audit asserts text content equality across 9 cases × 4 indent settings
plus minify.

**Comments are kept by default.** Deleting someone's comments should be their
decision. `stripComments` is opt-in and applies to output only, never the input.

**Both files were genuinely new** — `xml-format.ts` (846 lines) and a rebuilt
`XmlFormatter.tsx`. Nothing was patched in place, because the tag matcher was the
foundation and the old one could not parse.

### Audit and harness

- **Node audit `audit/check-xml-formatter.mjs`: 298 passed, 0 failed.** 13 groups:
  the libxml2 oracle comparison, the six previously-false positives, mode
  agreement, error positions, text preservation, structure re-indentation, minify
  semantics, comment handling, round-tripping 10 documents × 4 indents through
  libxml2, the caps and depth bombs, statistics honesty, the shipped copy, and
  component-source checks.
- **Production-Chrome e2e `e2e/xml-formatter-browser.mjs`: 270 passed, 0 failed**,
  run **twice against the same build** (`BUILD_ID UrM--a4v7dQ6vcDo5UDSB`, 312
  static pages).
- `npx tsc --noEmit` clean; ESLint clean on all touched paths.

### Regression check on the rest of the wave

Same 312-page build: JWT decoder **41/41**, QR code generator **112/112**, CSV to
JSON **195/195**, JSON to TypeScript **150/150**. Node audits: 238, 364 and 397
passed, 0 failed.

## Defects Found By The Verification Itself

1. **Minify did not remove whitespace, and the mirror audit caught it.** The
   neighbour test was inverted: it dropped whitespace only when *neither* adjacent
   token was an element, which missed every `<users>\n  <user/>\n</users>` and would
   have destroyed `<p>Hello <b>x</b></p>` had the polarity been flipped naively. Fixed
   by computing element-only status per element and dropping whitespace only inside
   such elements — the same analysis the format path uses.
2. **The audit's `textContent` helper was broken the same way as the original code.**
   Using `<[^>]*>` it ate `<not>` inside CDATA and truncated at `>` inside an
   attribute, producing false failures on exactly the cases being tested. Replaced
   with a quote-aware scanner.
3. **`<?xml?>` after the root was accepted.** libxml2 disagreed; the shipped code
   was wrong. Now refused with its position.
4. **Three expectations were wrong, not the tool.** An 8-line document asserted as
   7, a 5-line prolog asserted as 7, and a self-closing element counted as a
   nesting level. Each corrected after counting by hand.
5. **The e2e's first run asserted wording that had changed.** The badge is absent
   rather than blank for an empty box, and the placeholder is on the textarea rather
   than in the panel text. Both now assert the real thing: "Nothing to check" and
   the placeholder attribute.

## Tracked Residuals (accepted, disclosed)

1. **Well-formedness is not validity, and the tool says so.** No DTD or XSD is
   fetched and no schema is applied. A document can be well-formed and meaningless
   to its consumer. The badge, the panel, the registry name and the guide all say
   this rather than borrowing the word valid.
2. **Namespace prefixes are not resolved to URIs.** Prefixed elements, declarations
   and default namespaces are read correctly, but no prefix is resolved and no
   external DTD is fetched, so structure is checked and meaning is not.
3. **A mostly-text document may look unchanged after formatting.** This is
   deliberate. Re-flowing that text would change the document.
4. **The output cap can refuse a document whose input was within the input cap**,
   since indentation expands element-only content. Stated in the refusal with both
   numbers.
5. **`internal` is retained** so an unexpected throw becomes a stated problem rather
   than a blank panel.