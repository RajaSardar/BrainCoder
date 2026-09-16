---
title: "Shipping Rust to the Browser: How We Built a True PDF-Redaction Core in WebAssembly"
published: false
description: "How BrainCoder ships a Rust + wasm-bindgen core (built on the zpdf crate) for privacy-first, client-side PDF merge, split, match and redaction — with a transparent JS fallback and byte-identical output tests."
tags: rust, wasm, javascript, webdev
cover_image: https://braincoder.sardar.dev/icon.svg
canonical_url: https://braincoder.sardar.dev/guides/how-to-redact-a-pdf
---

BrainCoder is a collection of 123+ **free, privacy-first developer tools** that all run 100% in the browser. No uploads, no sign-up — files are read locally and never leave the device. That's a great privacy story, but it creates a hard engineering constraint: **every heavy operation has to run on the client.**

PDFs are the hardest case. Merging, splitting, and especially *redaction* are genuinely hard to do well in JavaScript. So we wrote the core in **Rust, compiled it to WebAssembly**, and bridged it to TypeScript with a transparent JS fallback.

This post walks through exactly how that core works, how we prove its output is correct, and the trade-offs we hit.

---

## Why Rust + WASM instead of a server?

Two reasons, both rooted in the product's core promise:

1. **Privacy is the product.** If files never leave the device, there are no servers to run PDF operations on. The processing engine has to ship *to* the user.
2. **JavaScript is the wrong tool for binary PDF surgery.** Manipulating PDFs means parsing object streams, managing cross-reference tables, and rewriting content streams byte-for-byte. That's memory-safe systems work — Rust's home turf.

WebAssembly lets us have the best of both: native-level speed, predictable memory behavior, and a sandbox that runs offline in any modern browser.

The crate lives at `crates/core/`, built with `wasm-bindgen` 0.2.128 on top of the **`zpdf`** crate family (`zpdf-core`, `zpdf-parser`, `zpdf-writer`).

---

## The API surface

`wasm-bindgen` exposes five functions to JavaScript:

| Function | What it does |
| --- | --- |
| `find_matches` | Word-level phrase matching → normalized redaction rects |
| `split_words` | Geometry-aware word splitting of text runs |
| `merge_pdfs` | Append one PDF after another (incremental) |
| `extract_pdfs` | Extract arbitrary page groups per output |
| `redact_pdfs` | **True content excision** — removes matching text/images/paths, then paints an opaque box |

The TypeScript bridge in `src/lib/wasm-core.ts` is small on purpose. It lazy-loads the module once, keeps a promise cache so concurrent tools share a single instantiation, and treats every call as optimistic:

```ts
export async function redactPdfsWasm(
  bytes: Uint8Array,
  pageRects: number[][][],
): Promise<{ bytes: Uint8Array; ms: number } | null> {
  const core = await loadCore();
  if (!core) return null;                       // JS fallback happens upstream
  try {
    const out = core.redact_pdfs(bytes.slice(0), pageRects);
    return { bytes: new Uint8Array(out.slice(0)), ms: performance.now() - t0 };
  } catch (err) {
    console.warn("[wasm-core] redact failed, using JS fallback:", err);
    return null;
  }
}
```

If WebAssembly isn't available (or the module throws), every tool transparently falls back to a pure-JS implementation — for redaction rects, `matchRectsJs` in the same file. The user never sees the difference; they just get results.

---

## The part that's hard to get right: redaction

Most "redact" tools are lying. They paint a black rectangle **on top** of the text — but the text is still in the PDF, selectable, searchable, and copyable. That's not redaction, that's a sticky note.

Real redaction has to reach into the content stream and **delete the operators that draw the sensitive content**, so the bytes genuinely no longer exist. That's what `redact_pdfs` does:

```rust
#[wasm_bindgen]
pub fn redact_pdfs(bytes: Vec<u8>, page_rects: js_sys::Array) -> Result<Vec<u8>, JsValue> {
    let mut writer = IncrementalWriter::new(bytes)?;
    for (page_index, group) in page_rects.iter().enumerate() {
        let rects: Vec<Rect> = /* parse [x0,y0,x1,y1] items */;
        writer.redact_page(
            page_index,
            &rects,
            &RedactOptions { fill: Some((0.0, 0.0, 0.0)) },
        )?;
    }
    let mut buf = Cursor::new(Vec::new());
    writer.write(&mut buf)?;
    Ok(buf.into_inner())
}
```

`zpdf-writer`'s redaction walks every page's content stream, finds text-showing, image, and path operators that intersect the target rect, and **removes them** — not covers them. Only then does it fill the region with an opaque black box so the layout still reads naturally.

Because we use an `IncrementalWriter`, the original file bytes stay untouched and the redacted layer is appended — standard PDF practice — while the *sensitive content itself* is excised from what remains.

---

## Finding the words inside a PDF

Before we can redact "John Q. Public", we have to find it. PDFs don't give us words — they give us **glyph runs**: positioned character sequences where the font and spacing are the same. "Hello world" often arrives as `Hello` + ` world`, or worse, split mid-word.

The core's `split_words` reconstructs real words from those runs using per-character geometry instead of trusting whitespace:

- Each character gets a width *weight* tuned per glyph class (`W`, `M`, `o`, `i`, punctuation all differ).
- Total run width is distributed across character weights to estimate each glyph's advance.
- Runs with whitespace are split at the gap; runs wider than `WORD_SPLIT_MIN_WIDTH` times the font size are broken into word-sized segments.
- Padding and right-extra advance (`WORD_PAD_EM`, `WORD_RIGHT_EXTRA_EM`) compensate for the visual gap around ligatures and descenders.

Then `find_matches` does a normalized, phrase-level scan: case-folded, punctuation-stripped word matching (`machine learning` matches `Machine Learning,`), and returns a single boundary rect around the contiguous match — padded proportionally to font size, normalized to 0..1 page coordinates.

The whole pipeline — split runs into words, find phrase, compute rects — runs natively in Rust. On a typical page it's milliseconds end-to-end.

---

## Byte-identical correctness: how we know it's right

A WASM rewrite is only trustworthy if it provably does the same thing as the reference. So we don't just eyeball it — `e2e/wasm-validate.mjs` runs **equivalence + round-trip tests in Node**:

- `find_matches` / `split_words` are fed identical inputs to the pure-JS reference and compared with **byte-identical** output for randomized word sets.
- `merge_pdfs`, `extract_pdfs`, and `redact_pdfs` outputs are re-parsed with `pdf-lib` / `pdf.js` and validated structurally (page counts, content, round-trip readability).

The audit is scripted:

```bash
npm run build:core   # cargo build --target wasm32-unknown-unknown + wasm-bindgen (web + nodejs)
npm run test:core    # equivalence + round-trip in Node
```

`build:core` emits three artifacts from one Rust build:
- `src/lib/core/pkg/` — ESM glue for the browser
- `e2e/.wasm-node/` — Node glue for validation tests
- `public/wasm/core_bg.wasm` — the binary served to users

---

## Size and performance

The single shared WASM binary is **~666 KB raw / ~245 KB gzipped** and covers all five operations across every tool that needs them — one download, lazy-loaded only when a PDF tool first runs.

Binaries are tuned in `Cargo.toml` for size, not speed, since this is a web payload:

```toml
[profile.release]
opt-level = "s"
lto = true
codegen-units = 1
panic = "abort"
strip = "symbols"
```

WASM lazily loaded means the home page and every non-PDF tool pay **zero** cost.

---

## What we learned

1. **wasm-bindgen's `Vec<T>` binding is the friendly API.** Passing `Vec<f64>` / `Vec<u8>` across the boundary for typed arrays is near-zero overhead and reads far better than manual memory juggling via `reinterpret`+`malloc`.
2. **Nesting is annoying, but manageable.** `page_rects` is `Array<Array<[f64;4]>>` — it crosses the boundary as JS `Array`s, but only on *input*. Outputs return flat `Vec`s that JS slices without copies.
3. **The JS fallback is a feature, not a hedge.** It doubles as an oracle for the equivalence tests. If WASM regresses, tests catch it; if WASM is unavailable, users still get their tool. Two implementations is real redundancy, not just belt-and-suspenders.
4. **Do the real version of the thing.** "Redact" that merely covers text is worse than no feature — it gives users false security. The incremental cost of doing content-stream surgery in Rust is precisely why we chose Rust over a JS hack.

---

## Try it

The core runs live in production on every tool that touches PDF text:

- [Redact a PDF](https://braincoder.sardar.dev/tools/pdf-redact) — true excision, no cosmetic boxes
- [Auto-Redact a PDF](https://braincoder.sardar.dev/tools/pdf-auto-redact) — `find_matches` + `redact_pdfs` end to end
- [PDF Merger / Splitter](https://braincoder.sardar.dev/tools/pdf-merge) — `merge_pdfs` / `extract_pdfs`

Everything is open source (MIT) — whole working app at [github.com/RajaSardar/BrainCoder](https://github.com/RajaSardar/BrainCoder), Rust core in `crates/core/`.

And because we're a no-upload app, there's a [live network audit](https://braincoder.sardar.dev/verify) you can watch intercept `fetch`/`XHR` while you use a tool. Files don't lie — and neither does the network tab.