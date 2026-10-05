# SQL Formatter: Parallel Judges Audit

Date: 2026-10-05. Status: the preflight rebuilt, the component rebuilt, its Node
audit and production-Chrome e2e harness authored, copy rewritten, guide written.
Ten judges (functional, end-user UX, business, SEO/content, security, a11y,
technical architect, performance, edge cases, honesty) returned. The judges
converged on one point: **a SQL formatter's worst failure is not an error, it is
quietly returning different tokens than you pasted.** A wrong-but-parseable query
is harder to notice than a refusal, so the work was judged on whether the tool
refuses rather than guesses.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The headline defect is a mangling bug, not a crash. Paste a query with a missing `*/` and the formatter reads the comment body as arithmetic and returns SQL whose tokens are not the ones you sent. Both dialects with nested-comment support and those without were checked, as were MySQL/MariaDB backslash-in-string rules versus PostgreSQL `standard_conforming_strings`, dollar-quoted bodies, and the error-message flood: **507 characters of broken input produced a 16,961,223-character error string** from the library. Also found: the shipped Tab option was `value="\t"`, two characters, so it emitted no tab at all; the output pane could receive an error message as if it were SQL. |
| End-user UX | Copy and Download were live regardless of whether formatting succeeded, so a failed format could put an error on the clipboard. The box booted with content. No character limit was shown, so a query silently over the cap looked merely unformatted. Fixed: empty boot with `Load sample`/`Clear`, both actions disabled unless `kind === "formatted"`, a live `{n} of {n} characters` counter, and an error cap of 240 characters so the panel cannot be flooded. |
| Business | The copy sold three things the tool never did: comma-aligned column lists, "all major dialects", and correct handling of proprietary functions. It also offered an 8-space indent that did not exist. Rewritten around what is actually delivered — 21 dialects, refusal over repair, byte-for-byte tokens — and a guide that leads with the mangling failure mode rather than with features. |
| SEO/content | Five keywords for a tool whose entire value is dialect choice was thin. Now 15, naming the dialects actually offered (`mysql query formatter`, `postgresql sql beautifier`, `format tsql`) and the differentiator (`sql formatter without uploading`). The registry tagline became "Re-indent a query, or be told why it can't be", which is the honest one-sentence version. |
| Security | **Pass** on egress: nothing is uploaded, no off-origin request is made, no non-GET request is made, and no request URL is long enough to be carrying a query. **Fail** on resource exhaustion: the input cap was 10,000× too high — a 195,897-character query took 1.1 s and a 98,000-character one was accepted without complaint. Reduced to 100,000 characters, plus 200 parenthesis levels and 64 nested-comment levels, all refused with real numbers. |
| A11y | Selects had no programmatic name, neither textarea was named, and the status text had no live region. Now labelled via real `<label htmlFor>`, both panes named, `aria-busy` while deferred work is pending, output out of the tab order, and a `role="status"` region that announces **counts only** — it deliberately does not announce the error message, because that quotes the reader's own SQL back on every keystroke. |
| Technical architect | The component called `format` directly on every keystroke and had no separate module. Now `sql-format.ts` owns the preflight, the caps, the dialect registry and the result union, with no DOM access, so the audit can run the shipped code in Node. `useDeferredValue` plus `useMemo` on the options object means a keyword-case change does not re-walk the input. |
| Performance | Unbounded. Now: 100,000 characters, 200 nesting levels, 64 nested-comment levels, 240-character errors. The 195,897-character document that took 1.1 s is now refused outright, and a 98,000-character one is comfortably inside the cap. Depth bombs are refused during the preflight scan rather than handed to the parser. |
| Edge cases | The cases that mattered: unterminated `/*`, nested comments in all four dialects that support them (`postgresql`, `duckdb`, `db2i`, `transactsql`) and in the seventeen that do not; `$$` and `$tag$` dollar quotes, terminated and not; MySQL/MariaDB versus PostgreSQL backslash rules; unbalanced and stray parentheses; multiple statements with blank-line control; recovery from error back to valid. All asserted. |
| Honesty | "All major dialects" is false at 21 named dialects and the copy should say so. "Correctly handles proprietary functions" is untestable and was removed. The badge said "Valid" for a query that could not parse. The panel now opens "Formatting cannot repair a query." and says it will not close a bracket, finish a string or guess a dialect. |

## Changes And Evidence

**The preflight is the whole point.** `preflight()` walks the input tracking
comment state, string state, dollar-quote state and parenthesis depth, per
dialect, *before* the library sees anything. It is what turns a silent mangling
into a refusal:

- An unterminated block comment is refused rather than formatted.
- A nested block comment is refused in the seventeen dialects that do not
  support nesting, and formatted normally in the four that do.
- An unterminated string or dollar quote is refused, with the delimiter named.
- Unbalanced parentheses are counted and reported.

**The caps are exported constants** so the UI, the audit, the copy and the guide
quote the same numbers: `MAX_SQL_CHARS` 100,000, `MAX_SQL_DEPTH` 200,
`MAX_SQL_COMMENT_DEPTH` 64, `MAX_SQL_ERROR_CHARS` 240.

**The result union makes an error impossible to mistake for output.**
`formatted | empty | invalid-sql | refused | internal`, and the component derives
the pane contents as `result.kind === "formatted" ? result.sql : ""`. An error can
therefore never reach the clipboard or the download, and the Node audit asserts
that exact line of source rather than trusting the behaviour.

**Error text is capped at 240 characters.** The 16,961,223-character message the
library produced for 507 characters of input is shortened, and the shortened text
is rendered as an error, never into the output pane.

**A real tab, not a backslash-t.** `<option value="tab">` with the module mapping
the sentinel to `useTabs`. The old `value="\t"` was two characters. Both the Node
audit and the harness assert a real tab character reaches the output.

**Three honest refusals instead of a repair attempt.** Unterminated comment,
nested comment in an unsupporting dialect, unbalanced parentheses. Each names its
own fault rather than saying "could not be formatted", and the e2e asserts the
specific reason per case.

### Audit and harness

- **Node audit `audit/check-sql-formatter.mjs`: 209 passed, 0 failed.** It
  transpiles the shipped module with the repo's own compiler and runs the
  behavioural checks against it, then asserts the shipped copy against the shipped
  code: no comma alignment, no "all major dialects", no proprietary-function claim,
  caps in the prose must equal the module's constants, keywords must name a real
  dialect, and the guide must exist.
- **Production-Chrome e2e `e2e/sql-formatter-browser.mjs`: 143 passed, 0 failed**,
  run **twice against the same build** (`BUILD_ID UrM--a4v7dQ6vcDo5UDSB`, 312
  static pages). Caps and the dialect count are read from the source at run time,
  so a cap change makes the harness assert the new number instead of passing
  against a stale literal.
- `npx tsc --noEmit` clean; ESLint clean on all touched paths.

### Regression check on the rest of the wave

Same 312-page build: JWT decoder **41/41**, QR code generator **112/112**, CSV to
JSON **195/195**, JSON to TypeScript **150/150**. Node audits: 238, 364 and 397
passed, 0 failed.

## Defects Found By The Verification Itself

1. **The audit's text extractor was itself the bug, twice.** The XML audit's first
   `textContent` helper used `<[^>]*>`, which ate `<not>` inside CDATA and
   truncated `<a title="a > b">` at the `>` inside the attribute — producing false
   failures on exactly the cases under test. Replaced with a quote-aware scanner,
   the same rule the formatter is built on.
2. **Three hand-written expectations were wrong, not the tool.** An 8-line document
   asserted as 7, a 5-line prolog asserted as 7, and a self-closing element counted
   as a nesting level. Each was corrected after counting rather than after reading.
3. **The audit's dialect claim was over-broad and now checks one thing.** "Handles
   all major dialects" was replaced by an assertion that Oracle appears as
   `Oracle PL/SQL` and N1QL appears at all — both of which had genuinely been absent
   from the copy.
4. **The e2e's first run asserted page furniture.** It looked for a stats line
   reading "characters from", which is the live region's wording, not the pane's.
   The live region and the counts line are now asserted separately and for the
   right thing: the region carries counts only and never the query.
5. **`/use/` routes are not in the sitemap by design.** Two harness checks assumed
   they were. They now assert `/tools/` and `/guides/`, which is what the sitemap
   actually emits.

## Tracked Residuals (accepted, disclosed)

1. **21 dialects is not every database.** `sql-formatter` names them and the page
   names all 21. "All major dialects" would be false and was removed rather than
   softened.
2. **Refusing is stricter than most SQL tooling.** A query with a nested comment in
   MySQL is refused even though MySQL would parse it one way and this tool declines
   to guess. That is the intended trade and it is on screen before you paste.
3. **Formatting says nothing about correctness.** A query that formats perfectly
   can reference a column that does not exist. The guide says so in those words.
4. **`internal` exists and is nearly unreachable.** It is kept so an unexpected
   throw becomes a stated problem rather than a blank panel, and the badge reads
   "Internal error" rather than claiming success.
5. **A stale duplicate harness exists at `e2e/qr-browser.mjs`** (254 lines,
   superseded by the 956-line `e2e/qr-code-generator-browser.mjs`) and defaults to
   a port that no longer serves the site. Left untouched as unrelated to this wave;
   recorded here so it is not mistaken for a regression.