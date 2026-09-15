<div align="center">

# 🧠 BrainCoder

**123+ free, privacy-first developer tools — one app, all in your browser.**

[![Live app](https://img.shields.io/badge/Try%20it%20live-braincoder.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://braincoder.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust%20/WASM-B7410E?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## ✨ What is it?

BrainCoder is a collection of **123+ free developer and office tools** bundled into a
single Next.js app. Compress PDFs and images, convert between formats, format and
validate code, encode/decode data, generate passwords and QR codes, edit Word/Excel/
PowerPoint files, redact PDFs, and more.

**Every tool runs 100% in your browser.** Files are never uploaded to a server — no
sign-up, no tracking, no waiting.

> 🪶 **Engineering highlight:** the PDF matching, merging, splitting, and redaction
> engines are written in **Rust and compiled to WebAssembly**, then bridged to
> TypeScript with a JS fallback. See [Architecture](#-architecture).

## 🚀 Live app

**[https://braincoder.vercel.app](https://braincoder.vercel.app)**

## 🧰 Tools at a glance

| Category | Count | Highlights |
| --- | --- | --- |
| **Convert** | 48 | PDF ⇄ Word/PPT/Excel/Markdown, PDF split, merge, editor, watermark, redact, protect, unlock, cropper, rotator |
| **Developer** | 26 | JSON/SQL/XML/HTML/CSS/JS formatters, regex tester, JWT decoder, SQLite viewer, cron parser, checksum/HMAC, CIDR calculator |
| **Encode & Decode** | 11 | URL, Base64/Base32, hash, HTML entities, AES, Morse code, ROT13, UTF-8, binary, image↔Base64 |
| **Office** | 11 | Word creator/viewer ⇄ text/Markdown, Excel ⇄ CSV/JSON/PDF, Excel merge, PowerPoint creator |
| **Text Tools** | 9 | Notepad, diff checker, word counter, text cleaner, slug generator, Unicode/upside-down text |
| **Media & Design** | 8 | Image editor, format converter, filters, splitter, gradient/box-shadow/border-radius generators, cubic Bézier editor |
| **Generate** | 7 | Password, UUID, Lorem Ipsum, QR code, random numbers, random name picker, coin flip & dice |
| **Compress** | 3 | PDF compressor, image compressor, gzip tool |

Every tool is a standalone feature under [`src/features/<slug>/`](src/features) and is
wired into the app through the registry in [`src/lib/tools.ts`](src/lib/tools.ts).

## 🏗 Architecture

- **Next.js 16** (App Router, Turbopack, React 19, TypeScript) with static prerendering
  for all 123+ tool routes.
- **Tailwind CSS 4** for styling.
- **csr-only tools** (`"use client"`) that read files locally via `FileReader` /
  `arrayBuffer()` and drive Web Workers / canvas — nothing leaves the device.
- **Rust + WebAssembly core** ([`crates/core/`](crates/core)) built on
  [`zpdf-writer`](https://crates.io/crates/zpdf-writer) and `wasm-bindgen`:
  - `find_matches` — word-level phrase matching for auto-redaction.
  - `split_words` — geometry-aware word splitting.
  - `merge_pdfs` / `extract_pdfs` — page merge/split/extract.
  - `redact_pdfs` — **true content excision** that removes matching text/images/paths
    from the content stream rather than painting a cosmetic box on top.
  - The bridge in [`src/lib/wasm-core.ts`](src/lib/wasm-core.ts) lazy-loads the WASM
    module and falls back to pure-JS implementations (pdf-lib, pdf.js) transparently.
- **SEO:** sitemap.xml, robots.txt, per-tool metadata and JSON-LD in
  [`src/lib/seo.ts`](src/lib/seo.ts), automatically generated OG/Twitter images.

## 📦 Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home page is a searchable
directory; each tool lives at `/tools/<slug>`.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (prerenders all tool & guide pages) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js + React Hooks rules) |
| `npm run test:e2e` | Playwright end-to-end suite (18 steps) |
| `npm run build:core` | Build the Rust core → wasm glue (`web` + `nodejs`) |
| `npm run test:core` | Validate the WASM core against the JS reference |

### Rust / WASM development

Requires a Rust toolchain with the `wasm32-unknown-unknown` target and
`wasm-bindgen-cli`:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128
npm run build:core   # emits src/lib/core/pkg + e2e/.wasm-node + public/wasm
npm run test:core    # equivalence + round-trip tests in Node
```

## 🧪 Testing

- `npm run test:e2e` runs the cross-browser E2E suite against the production build on
  `:3777`, exercising real downloads for Word/Excel/PPT/PDF tools.
- `npm run test:core` proves the Rust/WASM implementation produces byte-identical
  results to the JS reference for matching/splitting, plus merge/extract/redact
  round-trips parsed by pdf.js.

## 🤝 Contributing

Contributions are welcome. Please keep tools **client-side only**, match the existing
pattern (feature folder + entry in `src/lib/tools.ts`), and run `npm run lint` and
`npm run build` before opening a PR.

## 📄 License

This project is licensed under the [MIT License](LICENSE).