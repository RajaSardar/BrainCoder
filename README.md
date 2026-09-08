# BrainCoder

A free, private collection of developer tools — one Next.js app, everything runs in your browser with no uploads or servers involved.

## Tools

- **Compress**: PDF compressor, Image compressor, Image resizer
- **Convert**: Timestamp converter, Base64, URL encoder/decoder, Color converter
- **Encode & Decode**: URL, Base64, HTML minifier/pretty-printer, Hash generator
- **Developer**: JSON formatter, Regex tester, Diff checker, Markdown preview, CSS cursor generator
- **Generate**: UUID generator, Password generator, Lorem ipsum generator
- **Text Tools**: Notepad, Word counter, Case converter

Each tool lives in its own folder under `src/features/<tool>` and is wired into the app through the registry in `src/lib/tools.ts`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home page is a searchable directory; each tool has its own route at `/tools/<slug>`.

## Scripts

```bash
npm run build     # production build (Prerenders all tool pages)
npm run start     # serve the production build
npm run lint      # eslint (react-hooks + next rules)
```

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- React 19, TypeScript
- Tailwind CSS 4
- PDF & image compression run locally with Web Workers (pdf-lib, pdfjs-dist, canvas)