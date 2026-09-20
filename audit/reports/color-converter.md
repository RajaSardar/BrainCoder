# Color Converter: Parallel Judges Audit

Date: 2026-09-20. Status: eighteenth tool upgraded and verified — the
second wave of the parallel-judges program and the three-tool parallel
workload completed last (word-counter, lorem-ipsum, color-converter
judged, upgraded and verified independently in parallel; this report
covers color-converter). All ten judges returned usable reports; the
capability gaps were runtime-closed and verified.

## Ten Independent Judges

| Expert | Main findings |
| --- | --- |
| Functional | Input is hex-ONLY yet the copy promises "Choose Output Format" between HEX/RGB/HSL and the tagline promises "HEX, RGB, HSL & CSS colors". rgba/hsla claimed but impossible over a hex-only input. Clamping claimed but unreachable — no rgb()/hsl() input means no out-of-range values can exist. rgbToHex called ~4× per render |
| Technical architect | Picker state is `const [hex, setHex] = useState("#7c3aed")` and the `<input type=color>` reads `hex` even when it holds garbage — partial erase ("#7C") or an invalid string ("zzz") snaps the picker to #000000, destroying the user's last valid color. Invalid input should keep the last valid value |
| End-user UX | A syntactically valid-but-unknown color like "red" shows a silent dead state (no error, no result) — hopeless triage. Typing "#7C" mid-hex shows no feedback (should be hopeful, not an error). HEX input unlabelled. Three copy buttons all announce "Copy" |
| Content/SEO | "Choose Output Format" step describes a selector that does not exist. FAQ/features promise rgba/hsla and clamping that hex-only input can never deliver. Tagline "& CSS colors" sits right next to a FAQ saying CSS color names are NOT supported. "rgb to hex" keyword unreachable today. JSON-LD featureList is generic Convert boilerplate |
| Business analyst | "Pick a color → get all formats" is a solid utility. MUST: honor the promised input formats (hex/rgb/hsl), MUST resolve the tagline contradiction, SHOULD: alpha support (differentiator), clamping feedback, copy-per-format |
| A11y specialist | HIGH: HEX text input has no accessible name. HIGH: the validation error banner is not announced (`role=alert` missing). MEDIUM: three adjacent copy buttons share the identical accessible name "Copy". LOW: focus ring is `purple-500` vs the house indigo focus-visible |
| Security/privacy | Parsing is regex-ranged and finite — no ReDoS vector. No egress, no storage writes. Clamping/normalizing stays local. Nothing else to fix |
| Edge cases | CSS `rgb()` with percentage channels; sci-notation; whitespace-tolerant parsing; 3/4/6/8-digit hex (with alpha) vs short hex; hsl hue 360 wrap; alpha 0..1 vs 0–100%; garbage vs partial input must be distinguished (hopeless vs hopeful) |
| Performance | trivial — the concern is calling rgbtToHex 4× per keystroke and setState churn; hoist to a single derived value |
| SSR/cross-browser | All parsing client-side; the only SSR input is the static default color — no hydration risk. Routes smoke 200 |

## Changes And Evidence

- `src/features/color-converter/ColorConverter.tsx` (rebuilt):
  - **Real three-way input (functional, business, content):**
    `parseColor()` now accepts `#RGB/#RRGGBB/#RGBA/#RRGGBBAA` and CSS
    `rgb()/rgba()/hsl()/hsla()` (number or % channels, alpha 0–1 or
    0–100%, `h % 360` hue wrap, whitespace-tolerant). The RGB/HSL and
    rgba/hsla promises in the copy are now literally true. Precedence is
    hex-fallback free; `rgbToHex` computed once per render via `useMemo`.
  - **Clamping now reachable and real (functional, edge):**
    `Math.max(0, Math.min(max, Math.round(n)))` per channel — switching to
    rgb() makes out-of-range reachable (rgb(300,0,0) → 255) exactly as
    marketing claims.
  - **Honest triage, no black-picker (architect, UX):** input classified
    as valid (results shown), "hopeful" (hex/CSS prefix — no error, no
    results), or "hopeless" (error, `role=alert`, results hidden). Picker
    now tracks a separate `lastValid` state instead of the raw (possibly
    garbage) hex, so partial overwrites never snap it to #000000.
  - **Alpha everywhere (business, edge):** 4/8-digit hex and rgba/hsla
    inputs carry alpha through hex (#RRGGBBAA), rgb/rgba and hsl/hsla
    outputs.
  - **a11y (a11y):** hex input gets a `useId` + `<label htmlFor>` (plus
    `aria-invalid`/`aria-describedby`), the error banner is `role=alert`,
    the three copy buttons carry distinct aria-labels ("Copy HEX / RGB /
    HSL value"), focus ring aligned to the house indigo
    `focus-visible:outline-indigo-600`.
- `src/lib/tool-content.ts`: block rewritten — features document hex 3/4/6/8
  and rgb/hsl input, alpha, clamping, last-valid swatch, per-format copy;
  howTo drops the phantom "Choose Output Format" step; FAQ explains code
  formats, clamping, alpha flow and that CSS names are unsupported.
- `src/lib/tools.ts`: tagline corrected "HEX, RGB, HSL & CSS colors" →
  "HEX, RGB & HSL color converter" (CSS-name marketing removed; FAQ stays
  honest).
- `src/lib/seo.ts`: keyword row widened ("hsl to rgb", "rgba to hex",
  "hex to rgba"); JSON-LD featureList override added; AND the generic
  Convert-category fallback fixed — the doubled-word "Format, convert,
  generate and convert" template is replaced for the Convert category.

## Verification

- `npx tsc --noEmit` clean; eslint clean on all changed files; the disused
  `parseAlpha` duplication removed during review.
- Production build passed — static pages 287/287 (single build for the
  three-tool wave).
- `e2e/color-converter-browser.mjs` — 33 production Chrome scenarios, 33/33
  green: default #7C3AED → rgb(124, 58, 237) + hsl(262, 83%, 58%); picker
  width from hex input; #f00 #rgb expand; rgb(124, 58, 237) → #7C3AED;
  hsl(0,100%,50%) → #FF0000; rgba(255,0,0,0.5) flows alpha to hex
  #FF000080 + rgba + hsla; 8-digit hex round-trips; rgb(300,0,0) clamps to
  255; distinct copy aria-labels + HEX copy writes the exact value; "red"
  → role=alert + aria-invalid + hidden results + picker keeps last valid;
  empty → error-free and result-free; "#7C" and "hsl(2" partial → no
  error; "#ggg" → error + picker keeps last valid (#ff0000); `/use` +
  `/tools` 200; marketing copy documents 8-digit hex and clamping, and the
  phantom "Choose Output Format" step is gone; zero hydration errors; zero
  page errors.
- Wave-1/2 harnesses re-run green against the same build.

## Residual (shared, not re-reported)

Site-header 375px nav overflow; `'unsafe-eval'` CSP; `/verify` wording;
ToolPreview upload mock; WebKit not runnable in harnesses; Next.js route
announcer `__next-route-announcer__` `role=alert` present on every page.