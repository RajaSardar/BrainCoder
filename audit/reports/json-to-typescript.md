# JSON to TypeScript: Parallel Judges Audit

Date: 2026-10-05. Status: the converter rebuilt from the ground up, its
Node audit authored, and its production-Chrome e2e harness authored and run.
Ten judges (functional, end-user UX, business, SEO/content, security, a11y,
technical architect, performance, edge cases, honesty) returned. Every judge
found the same headline defect and they are all the same defect: **the page
generated TypeScript that does not compile.** Focus of the round: a
type-inference tool is judged by whether its output survives the compiler,
because "works" here means nothing until `tsc` agrees.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | The blocker, confirmed by compiling it: every object-rooted document finished with `export type User = User;`, which is TS2300 *Duplicate identifier 'User'* and does not compile at all. Separately, internal node-kind tags reached the output as bare identifiers, so a heterogeneous array produced `array | object` — TS2552, *Cannot find name 'array'*. `null` inferred to an optional `any`, which quietly turned a required field into an optional one. A key missing from some elements of a merged array stayed required. A mixed array collapsed to `any[]` rather than a union. Two keys that sanitise alike (`a b`, `a-b`) became duplicate members. Every case verified here is re-checked by compiling it in the Node audit. |
| End-user UX | The tool booted with a sample already in the box, so the first thing on screen was output the reader had not produced. Copy copied whatever the status line held — including a parse error — so a `Copy` that appears to succeed can put an error string on the clipboard. Neither text input had a programmatic name. Fixes: empty boot with `Load sample` and `Clear`, a real `<label htmlFor>` on the root-name field (deliberately not the shared `Field`, which renders a `<p>` and so names nothing), `aria-label` on both textareas, Copy and Download disabled until there is generated code, and an `interface / field / character` count so the reader can see the size of what they are about to copy. |
| Business | The page sold features that did not exist: per-field JSDoc, enums, generics, an interface-vs-type-alias toggle, name prefix/suffix controls, and "ready-to-use" / "production-ready" phrasing, none of which the code had. The copy was rewritten around what the tool actually does and, just as importantly, what it refuses to guess — a date, a UUID and an enum all read as `string`; a key absent from the sample is not marked optional; there is no JSDoc because a comment guessed from one value is a comment that will be wrong. The guide `how-to-convert-json-to-typescript-types` and a sixth FAQ on optional fields carry the same honesty. |
| SEO/content | Ten keywords (`src/lib/seo.ts:149`), a title and description that lead with the sample-not-schema limit rather than "ready-to-use" (`seo.ts:248`), a JSON-LD feature list that enumerates the merge rule, the `null`-is-required rule, the empty-container types, the name substitution, the four caps and the no-network claim (`seo.ts:308`), a registry tagline rewritten to "A first draft of the types, from one JSON sample" (`tools.ts:745`), a long description that names the TS2300 defect it no longer emits, 12 features, 5 how-to steps, 9 FAQs, 4 related slugs and a four-section guide. The mirror audit's twelfth group fails if the copy contradicts the code, the caps or the guide. |
| Security | **Pass** on XSS, prototype pollution and egress: there is no `dangerouslySetInnerHTML`, no value derived from the pasted JSON is ever rendered as markup, nothing is written to `__proto__` or a prototype chain, and the JSON is parsed and emitted in the tab with no request made with it — the harness asserts zero off-origin requests, zero non-GET requests, and no request URL carrying a token planted in the sample. **Fail** on one axis: client-side resource exhaustion. A 54-byte document of 26 nested arrays drove 67,108,863 recursive `infer` calls and froze the tab, and nothing bounded the work. Fixed by four caps checked before and during the work. |
| A11y | Both textareas lacked accessible names, the root-name input had no `<label>` at all, and the parse message was the one string a reader most needs and it was in no live region. The component now names both panes, labels the root field with a real `htmlFor`, and announces state through a scoped sr-only `role="status"` while leaving the parse message out of any live region on purpose — it quotes the reader's own payload and would be spoken on every keystroke. That exclusion is deliberate and is now asserted, not assumed: the harness requires the tool's own markup to contain **no** `role="alert"`. |
| Technical architect | The single-file emitter that mixed inference, capping, error classification and emission is now two browser-free modules: `json-infer.ts` (223 lines, shape inference only) and `json-to-typescript.ts` (523 lines, the caps, the error classification, the emission rules and the self-check). Parsing is split from emission (`parseJsonShape` / `emitTypeScript`) so the component memoises the expensive half against the deferred input alone and a rename re-emits without re-walking the document. Names are allocated from a `used` set, so a path-named interface can never collide with the root or with a sibling. |
| Performance | Cost was unbounded and exponential in nesting before the caps. Now bounded and disclosed: 200,000 characters of pasted text, 64 nesting levels, 200,000 values, and 400,000 characters of generated code — each refused with its real numbers, and the character cap is checked before a single byte is parsed. The output cap exists because a merged array of objects can imply more fields than the input has characters. `useDeferredValue` keeps inference off the keystroke path. |
| Edge cases | The cases that mattered: an empty object (`Record<string, never>`, because a member-less interface would accept every object) and an empty array (`unknown[]`); a root that is itself an array; a root that is a scalar; a JSON `null` value; an object/array union; a key that is not a legal identifier; two keys that sanitise alike; a reserved word as the root name; a built-in an interface would shadow; a syntax error on a later line, which must report *that* line and not line 1; and recovery from an error back to a valid document. All are asserted, and the generated side of each is compiled. |
| Honesty | The page claimed "production-ready", "JSDoc-ready comments", an interface/type-alias toggle and prefix/suffix naming that did not exist. It also hid the one thing that matters most: types inferred from a single sample are a guess about a schema. Every copy surface now leads with the limit — the boot panel opens "A first draft from one sample." and closes "this is a starting point to edit, not a schema you can rely on unchecked" — and the copy says what the page will not invent. Nothing is labelled Generated until the emitted names have been checked. |

## Changes And Evidence

The emitter was replaced rather than patched, because the blocker was not one
line but a design that did not check its own output.

**Two modules, split by responsibility.** `json-infer.ts` infers a shape and
holds nothing else. `json-to-typescript.ts` owns the four caps, classifies
errors, allocates names, emits and self-checks. Neither touches the DOM.

**One interface for an object root, never an alias of itself.** An object root
emits `export interface User { ... }` and nothing else; the `export type User =
User` line is gone. Nested objects each get a named interface following the path
that reached them (`User`, `UserProfile`, `UserProfileAddress`), so the output is
flat declarations rather than a wall of inline nested types.

**The four caps** are exported constants so the UI, the audit and the guide all
quote the same numbers: `MAX_INPUT_CHARS` 200,000 (checked before parsing),
`MAX_JSON_DEPTH` 64, `MAX_NODES` 200,000, `MAX_OUTPUT_CHARS` 400,000.

**The self-check is the reason "Generated" means something.** Every emitted
document is swept for duplicate declarations and for identifiers in a type
position that are neither declared nor a TypeScript builtin. A document that
fails is reported as a stated problem instead of being shown with a green badge.
This is the check whose absence let TS2300 ship.

**Names.** A reserved word or a built-in an interface would shadow (`Record`,
`Partial`, `Array`, …) is replaced by `Root`, and the substitution is stated on
screen with the reason rather than being applied quietly. `globalThis` is
deliberately *not* refused, because it is a global value rather than a type and
`interface GlobalThis` shadows nothing.

**Inference rules, each one asserted.** `null` is a value, so it stays required
and renders as `null`. An optional marker comes from exactly one place — a key
missing from at least one element of a merged array. Shapes that disagree become
a union of what was really seen, never `any`. Keys that are not legal
identifiers are sanitised and de-duplicated deterministically (`a_b`, `a_b_2`).

**The component** boots empty, offers `Load sample` and `Clear`, keeps the parse
message out of every live region (it quotes the reader's own payload), announces
counts politely through a scoped sr-only `role="status"`, disables Copy and
Download until there is something to copy, and names both panes.

### Evidence, all re-run by the orchestrator

| Check | Result |
| --- | --- |
| `node audit/check-json-to-typescript.mjs` | **397 passed, 0 failed** |
| `npx tsc --noEmit` | clean |
| `npx eslint` on every changed and new file | 0 errors, 0 warnings |
| `node e2e/json-to-typescript-browser.mjs`, production Chrome | **150 passed, 0 failed**, twice on the same build |
| `npm run build` | 310 static pages |

The Node audit does not merely string-match: its tenth group generates a sweep of
documents and hands **at least 1,500 of them to the real TypeScript compiler**
in one in-memory program built from this repo's own tsconfig options, and fails
if any of them produces a diagnostic.

The browser harness has 23 sections and drives real Chrome: empty boot, the panel
copy, accessibility, the exact expected declarations for the sample, copy,
download, renaming without re-reading the document, reserved and shadowed root
names, array merge, empty containers, illegal identifiers, a syntax error with a
position on a later line, recovery, each of the four caps, Clear, a 375px
viewport, and hygiene (zero off-origin requests, zero non-GET requests, no URL
carrying sample data, no console or hydration warnings).

### Independent verification beyond the harnesses

Because a harness written by the same agent as the implementation can only prove
self-consistency, the blocker was re-checked by hand: twelve documents — the
original `TS2300` object root, `null`, a heterogeneous array, a mixed array, empty
containers, a sanitisation collision, nested path naming, a reserved root name, an
empty object root, an object/array union, a realistic payload and an array of
objects — were generated and compiled by `ts.createProgram` under `strict`. All
twelve typecheck clean. The first attempt reported three failures; all three
involved `Record<string, never>` and were caused by the verification script
serving no `lib.d.ts`, not by the product. Re-run against a real filesystem host,
all twelve pass.

### Defects found while running the harness, and what happened to each

One was a defect in the harness itself. It is recorded here because it is the kind
that would otherwise be mistaken for a product bug:

1. **The harness asserted against page furniture instead of the tool.** The check
   "there is no `role=alert`" used an unscoped `page.locator('[role="alert"]')`.
   Playwright's locators pierce open shadow roots, and Next.js's route announcer
   lives in one and always carries `role="alert"`, so the locator matched 1 node
   whose `outerHTML` `document.querySelectorAll` could not even see — proof it was
   in a shadow root and not in the component. The component contains no
   `role="alert"` at all. The assertion was scoped to `tool()`, which is what the
   harness's own header comment requires of every locator in the file. The
   assertion is now stronger, not weaker: it tests the tool's own markup instead of
   accidentally testing Next.js.
2. **The agent's lint claim was wrong.** It reported a clean ESLint run; there
   were two warnings, an unused `proseOf` in the audit and an unused `bodyText`
   in the harness. Both removed and the run re-verified at 0/0.
3. **Two unused variables, same cause as above** — no product impact.

### Regression check on the rest of the wave

The 310-page build also carries the three tools from wave 11 with byte-identical
source, so all four harnesses were run twice against it: JWT decoder **41/41**,
QR code generator **112/112**, CSV to JSON **195/195**, JSON to TypeScript
**150/150**, all four twice on the same build with no failures. Their Node audits
also still pass: 238, 155, 364 and 397. This run is also what substantiates the
CSV report's consecutive-runs wording, which had been asserted without a second
observed run.

## Tracked Residuals (accepted, disclosed)

1. **Type inference from one sample is still a guess about a schema.** A key the
   sample never contained is not marked optional, and a date, UUID, money amount
   or enum name all read as `string`. The page, the guide and the FAQ say this in
   those words rather than implying a schema.
2. **Optional markers have exactly one cause** — a key missing from at least one
   element of a merged array. A reader who pastes a single object will see no
   optional markers at all, which is correct for that sample. A FAQ says so
   explicitly so the absence is not read as a bug.
3. **`globalThis` is not refused as a root name.** It is a global value rather
   than a type, and `interface GlobalThis` shadows nothing and compiles, so
   refusing it would be false. This is deliberate and commented in the source.
4. **The self-check is lexical, not a type check.** It verifies that every declared
   name is unique and that every identifier in a type position resolves to a
   declaration or a builtin. It cannot know that a union is over-narrow. The 1,500
   documents the Node audit hands to the real compiler are what cover that, and
   the check exists to stop the two TS2xxx defects this page actually shipped.
5. **The 400,000-character output cap can refuse a document whose input was
   within the input cap**, because merging the elements of a large array of
   objects can imply more fields than the input has characters. This is stated in
   the refusal message itself, with both numbers.