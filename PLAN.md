# BrainCoder — Master Plan & Progress Tracker

> Created: 2026-09-15  
> Last updated: 2026-09-15  
> Status: **Phase 1 Review — retention loop + analytics + CSP + a11y shipped; waiting: live env & metrics**

---

## Vision

BrainCoder is a privacy-first, browser-based developer toolkit (123 tools) being converted from a free MIT project into a sustainable SaaS business. Files never leave the device.

## One-Liner

> **BrainCoder is the privacy-first browser toolkit that replaces 20+ separate online utilities — files never leave your device.**

---

## What We've Done So Far

### Phase 0 — UI/UX Redesign (Complete)

| Commit | What | Status |
|--------|------|--------|
| `99eb156` | Tool detail page redesign: hero with action CTA, trust band, about card, features grid, how-to timeline, FAQ accordion, related tools, ToolPreview mock, ToolSubNav sticky nav | Done |
| `9fed366` | Move primary action CTA to top of tool pages; demoted mid-page gradient banner to slim strip; removed redundant mobile launch bar (per 4-agent UX debate) | Done |
| `b3ed725` | Homepage rebuild: server-rendered hero with proof stats (123 tools/8 categories/0 uploads), featured PDF band, ToolsExplorer client island, 8 category index cards with internal links, FAQ with FAQPage JSON-LD, siteJsonLd extended with Organization + ItemList, footer category links | Done |

**Total files changed across Phase 0:** ~15 files, ~1,500+ lines written, ~800+ lines removed.

### Phase 0 — Verification

- [x] Lint: clean
- [x] Build: green (all 123 tool routes prerender as SSG)
- [x] E2E: 18/18 passing
- [x] Tool detail pages: action-first hero + slim mid strip
- [x] Homepage: server components + client island, all sections rendered
- [x] SEO: JSON-LD (WebSite, CollectionPage, Organization, ItemList, FAQPage, BreadcrumbList), sitemap, metadata
- [x] Screenshots: `/tmp/tool-top.png`, `/tmp/home-top.png`, `/tmp/home-mid.png`

---

## Current Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.3.4 |
| React | React + React DOM | 19.2.8 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS (PostCSS plugin only) | 4.x |
| Icons | lucide-react | 1.40.0 |
| Fonts | Geist Sans + Geist Mono | next/font |
| PDF core | Rust → WASM (wasm-bindgen, zpdf-writer) | crates/core |
| JS PDF | pdf-lib, pdfjs-dist | 1.17.1, 6.3.289 |
| Office | mammoth (docx), marked (md), sql.js, qrcode | various |
| Image | html2canvas, fflate | various |
| Testing | Playwright (e2e), custom WASM validation | e2e/ |
| Hosting | Vercel (static SSG) | braincoder.sardar.dev |
| License | MIT | — |
| Auth | None | — |
| Database | None | — |
| Revenue | None | — |

---

## Routes

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Static (server components) | Homepage: hero, featured, search grid, categories, FAQ |
| `/tools/[slug]` | SSG (123 pages) | Tool detail: SEO, JSON-LD, action-first hero, features, FAQ |
| `/use/[slug]` | SSG (123 pages) | Fullscreen tool app (client-side processing) |
| `/guides` | SSG | Guides index |
| `/guides/[slug]` | SSG | Individual guide articles |
| `sitemap.xml` | Dynamic | Auto-generated |
| `robots.txt` | Static | Crawl rules |

---

## Strategy — 25-Agent Synthesis

### Positioning

**Developer-focused, privacy-first.** Do NOT compete with ilovepdf on head keywords (they have DR 83, 40K backlinks). Own the "no upload, no account, verifiable privacy" niche for developers.

### Pricing Model (Future)

| Tier | Price | What |
|------|-------|------|
| Free | $0 | All 123 tools, unlimited, no account needed |
| Pro | $7.99/mo | Batch processing, AI redaction, cloud vault, history |
| Team | $14/seat/mo | Shared vaults, team workspace, audit log |

**Decision: Keep everything free for now.** Build the foundation first; add pricing after product-market signal.

### Planned Phases

#### Phase 1 — Free SaaS Foundation (Days 1-30)

**Goal:** Ship analytics + retention loop + SEO hygiene. Keep everything free. Get users, measure, learn.

**Key insight from 3-agent validation (2026-09-15):** Skip Clerk, Turso, Vercel Pro, and all backend complexity. Use anonymous IDs + localStorage. Ship retention in 5 days with zero new dependencies. Add auth only when cross-device sync proves valuable.

| # | Task | Why | Status |
|---|------|-----|--------|
| 1 | Analytics: `@vercel/analytics` (Web Analytics in Vercel dashboard) | Know what users do | Done |
| 2 | Fix homepage meta (remove hardcoded "123", drop generic keywords) | Stop competing on unwinnable head terms | Done |
| 3 | Add repository/homepage/bugs to package.json | Enable backlink equity from GitHub | Done |
| 4 | Create `src/lib/userState.ts` — anonymous ID + recent tools + favorites | Retention loop foundation | Done |
| 5 | Create `src/components/RecentTools.tsx` — client component | Show recent tools on homepage | Done |
| 6 | Wire `addRecentTool()` into tool pages | Track usage automatically | Done |
| 7 | Add RecentTools section to homepage (between hero and featured) | Returning users see their history first | Done |
| 8 | CSP headers + X-Content-Type-Options + X-Frame-Options + Referrer-Policy | Security minimum bar | Done |
| 9 | a11y: focus-visible ring + skip-to-content link | WCAG AA minimum | Done |

**Phase 1 — now complete. All core tasks delivered.**

**Analytics delivered:**
- Installed `@vercel/analytics`; rewrote `src/components/Analytics.tsx` to wrap `<Analytics />` from `@vercel/analytics/next`. No env vars needed — project-level analytics already enabled in Vercel dashboard.
- Replaced Plausible in CSP: `https://va.vercel-scripts.com` in both `script-src` and `connect-src`.
- `.env.example` cleaned of stale `NEXT_PUBLIC_ANALYTICS_DOMAIN` reference.

**CSP delivered:**
- `next.config.ts` now returns these headers on every page:
  - `Content-Security-Policy` — strict `default-src 'self'`, allowing only the capabilities BrainCoder genuinely needs (inline styles, blob/data for WASM workers + canvas, Vercel analytics). Critical: `connect-src` must include `blob: data:` — many tools do `fetch(canvas.toDataURL(...))` to turn canvas snapshots into array buffers; CSP blocks this without `data:` in `connect-src`.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

**a11y delivered:**
- `globals.css` — `:focus-visible` ring (indigo-600, 2px offset), suppressed on mouse click via `:focus:not(:focus-visible)`.
- `skip-link` class: visually hidden, slides in at top-left on keyboard focus, links to `#main`.
- `layout.tsx` — `<a href="#main" class="skip-link">Skip to content</a>` as first focusable element; `<main id="main">` target.

**Retained notes for future reference:**
- `connect-src 'self' data: blob:` is essential. Many tools use `fetch()` on `data:` or `blob:` URLs to convert canvas-to-arrayBuffer under CSP. Without this, `excel-to-pdf`, `pptx-creator`, `image-resizer`, and similar tools silently fail.
- `worker-src 'self' blob:` is needed for pdf.js and tesseract.js web workers.
- CSP headers require `next.config.ts` change + full dev server restart to take effect.

**Retention loop delivered (batched in one pass):**
- `src/lib/userState.ts` — `getOrCreateUserId()`, `getRecentTools()`, `addRecentTool()` (deduped, FIFO, max 20), `clearRecentTools()`, `getFavorites()`, `toggleFavorite()`. All safe-guarded (no SSR crash, storage blocked/full tolerated).
- `src/components/RecentTools.tsx` — uses `useSyncExternalStore` (not `useEffect` + `setState`, which React 19 lint rejects). Renders **null** on fresh visits (no history) → no visual footprint for new users. Shows 6 most recent tools in a compact grid, links to `/tools/[slug]`, "View all" links to `/#tools`.
- `src/components/TrackToolUse.tsx` — tiny `"use client"` component mounted on `/use/[slug]` that calls `addRecentTool(slug)` on mount. Logging the *actual launch* (not just viewing the detail page) is the accurate "used it" signal.
- `src/app/use/[slug]/page.tsx` — renders `<TrackToolUse slug={slug} />`.
- `src/app/page.tsx` — `<RecentTools />` mounted between hero and featured band, separated by spacers.

**Browser-verified (Playwright):**
- Fresh visit → section hidden (0 matches)
- After launching json-formatter → `bc_recent=["json-formatter"]`, `bc_user_id` created
- Launch base64 + json-formatter twice → deduped `["base64","json-formatter"]`
- Homepage shows section, most-recent-first ordering confirmed
- Lint clean, build green (262 SSG pages), 18/18 e2e pass

**What we're NOT building in Phase 1 (per agent validation):**
- ~~Clerk auth~~ → skip until cross-device sync proves needed
- ~~Turso + Drizzle~~ → localStorage sufficient for retention
- ~~Dashboard route group~~ → not needed without auth
- ~~Vercel Pro~~ → stay on free tier until limits hit
- ~~Cloud vault~~ → Month 2+ only
- ~~Privacy Policy + ToS~~ → only needed when accepting payments

**Phase 1 success metrics:**
- [x] Homepage meta fixed (no generic keywords, no hardcoded count)
- [x] package.json has repository fields
- [x] Retention loop shipped (anonymous ID + recent tools)
- [x] Vercel Analytics wired up (no env var needed)
- [x] CSP headers deployed (tested with excel-to-pdf, pdf-merge, image-resizer)
- [x] a11y focus-visible + skip link shipped
- [ ] 15%+ of visitors have ≥1 entry in `bc_recent` after 2 weeks (measure post-launch)
- [ ] 20%+ of returning users click a recent tool (measure post-launch)

#### Phase 2 — Product Discovery (Weeks 2-6)

**Goal:** Build the habit loop + organic traffic flywheel. Everything stays free.

**Key insight from growth + PM agents (2026-09-15):** Chrome/VS Code extensions are distractions. Long-tail SEO is the #1 ROI lever. Favorites + PWA are the highest-ROI product additions.

| # | Task | Why | Priority | Status |
|---|------|-----|----------|--------|
| 1 | Add favorites to `RecentTools.tsx` (heart icon on tool cards) | Completes the retention loop | High — PM agent | Done |
| 2 | PWA manifest + service worker | Home-screen icon = retention multiplier for utility apps | High — PM agent | Done |
| 3 | Category landing pages (`/categories/${slug}`) | Topical authority hubs — internal linking boosts long-tail ranking | High — growth agent | Done |
| 4 | 5-8 more guides ("how to redact a pdf", "how to sign a pdf", etc.) | Guides rank for how-to queries + internal link to tools | High — growth agent | Done |
| 5 | "Verify: 0 uploads" proof page | Shareable proof of the privacy moat — PR / HN material | Medium — growth agent | Done |
| 6 | Rust/WASM technical deep-dive (dev.to post) | Builds authority + backlinks + GitHub stars | Medium — growth agent | Done |
| 7 | Ship to Hacker News (Week 4-5) | Validation spike + initial backlink base | Medium — growth agent | Kit ready — post on launch day |
| 8 | Directory listings (alternativeTo, awesome-list PRs) | Durable indexable backlinks | Low — growth agent | Plan + copy ready |

**Favorites delivered:**
- `src/components/FavoriteButton.tsx` — heart button client component. Filled rose when active, outline when not. `aria-label` + `title` announce add/remove. Stops event propagation so clicking doesn't navigate.
- `src/components/RecentTools.tsx` — now renders two sections: **Your favorites** (with remove hearts) and **Your recent tools** (with add hearts). Both cards share `ToolCardSmall`.
- `src/lib/userState.ts` — added `subscribeUserState()` notification bus. **Critical lesson:** plain `useSyncExternalStore` with a no-op `subscribe` does NOT re-render on same-tab localStorage writes (the `storage` event only fires cross-tab). Components must subscribe to a shared listener set that `addRecentTool`/`toggleFavorite`/`clearRecentTools` notify.
- Browser-verified: add favorite → section appears instantly, `bc_favorites` written; remove → section disappears, empty array. Lint clean, build green, 18/18 e2e.

**PWA delivered:**
- `public/manifest.webmanifest` — name/short_name/description, standalone display, theme + background colors, `purpose: "any" + "maskable"` icon (reuses `/icon.svg`).
- `public/sw.js` — service worker: precaches shell on install, cache-first hashed `/_next/static/`, network-first navigations (offline falls back to homepage), stale-while-revalidate same-origin assets, cache versioning + cleanup on activate.
- `src/components/PwaRegister.tsx` — registers `/sw.js` client-side, **gated to production** (`process.env.NODE_ENV !== "production"` early-return) so it never interferes with dev.
- `src/app/layout.tsx` — `manifest: "/manifest.webmanifest"` in metadata, `appleWebApp` capable, and **`themeColor` moved to a separate `export const viewport`** (Next.js 16: themeColor in `metadata` throws a deprecation warning on every page).
- Verified: `/manifest.webmanifest` → 200 `application/manifest+json`; `/sw.js` → 200; `<link rel="manifest">` present in head.

**Category pages delivered (topical authority hubs):**
- `src/lib/tools.ts` — added `getCategorySlug()` + `getCategoryBySlug()` mapping the 8 categories to URL-safe slugs (`Encode & Decode` → `encode-decode`, `Media & Design` → `media-design`, etc.).
- `src/lib/seo.ts` — `buildCategoryMetadata()`, exported `CATEGORY_DESCRIPTIONS` (shared copy moved out of `CategoryIndex.tsx`), and `categoryJsonLd()` (CollectionPage + BreadcrumbList).
- `src/app/categories/[slug]/page.tsx` — SSG (8 pages): breadcrumb, hero with tool-count + "nothing uploaded" badge, full tool grid via `ToolCard`, JSON-LD, back link. H1 such as "Compress tools".
- Internal linking improved: `CategoryIndex` "View all" + footer category links now point to `/categories/${slug}` (real crawlable pages) instead of `#cat=` anchors.
- `sitemap.ts` — added 8 category URLs (`priority 0.7`, weekly).
- Verified: `/categories/compress` → 200, H1 + tool cards + JSON-LD; sitemap lists all 8; build now 270 SSG pages; 18/18 e2e after warm-up (first run fails on cold dev compile — known dev-mode pattern).

**Guide library grown 7 → 15 delivered:**
- 8 new guides, each targeting an uncovered tool with 4-6 long-tail keywords and a CTA that internal-links to `/tools/${slug}`:
  1. `how-to-convert-pdf-to-word` → pdf-to-word ("pdf to docx", "edit pdf as word")
  2. `how-to-password-protect-a-pdf` → pdf-protect ("lock pdf with password", "encrypt pdf free")
  3. `how-to-unlock-a-password-protected-pdf` → pdf-unlock ("remove password from pdf", "decrypt pdf free")
  4. `how-to-redact-a-pdf` → pdf-redact ("black out text in pdf", "remove sensitive information from pdf") — cross-mentions Auto-Redact
  5. `how-to-remove-pages-from-a-pdf` → pdf-remove-pages ("delete blank pages from pdf") — cross-mentions Remove Blank Pages
  6. `how-to-convert-csv-to-json` → csv-json (developer category, both directions)
  7. `how-to-generate-a-strong-password` → password-generator (offline randomness angle)
  8. `how-to-create-a-qr-code` → qr-code-generator
- Bedrock principle threaded through all: **no-upload privacy is a selling point, not a footnote** — each guide explicitly contrasts in-browser processing vs. uploading to a server.
- sitemap, `/guides` index and JSON-LD all pick up from `GUIDES` automatically (278 SSG pages now). Browser-verified each guide: H1, Article JSON-LD, CTA tool link. Build green, 18/18 e2e.

**"Verify: 0 uploads" proof page delivered (`/verify`):**
- `src/components/NetworkAudit.tsx` — **live network audit**: hooks `window.fetch` + `XMLHttpRequest.prototype.send` the moment the page loads and flags any outbound request that tries to carry a watched file (red "BLOCKED" line). Counters: upload attempts, outbound requests, watched file size. Verdict strip + false-if-caught behavior makes it a real test, not a claim.
- `src/components/LocalHashDemo.tsx` — drop a real file, SHA-256 computed **locally** with `crypto.subtle` (`await file.arrayBuffer()` → digest). Proves files can be fully processed with zero network I/O. Shares state with the audit via a tiny pub/sub (`watchDemoFile`) — same lesson as favorites: cross-component sync needs a notification bus, not a shared ref.
- `src/app/verify/page.tsx` — hero ("Proof, not a promise"), audit + demo side-by-side, "how can tools run without a server" explainer (static Next.js build → CDN, client-side pdf.js/pdf-lib/WASM, Blob URLs, open source), DevTools self-verification walkthrough, honest caveat (static assets + aggregate analytics beacon — never file content). WebPage + Breadcrumb JSON-LD.
- Replaced the self-referencing "Live app" header link (pointed at own domain) with **"0 uploads — verify"**; footer gained a links row (verify, guides, GitHub); sitemap entry priority 0.6.
- Verified: file-drop flow (setInputFiles → SHA shown → audit back to 0), header/footer links live, 279 SSG pages, lint clean, 18/18 e2e.

**Rust/WASM dev.to deep-dive drafted (`articles/rust-wasm-pdf-core.md`):**
- Title: "Shipping Rust to the Browser: How We Built a True PDF-Redaction Core in WebAssembly" — frontmatter-ready for dev.to (tags: rust, wasm, javascript, webdev; `published: false`; canonical → `/guides/how-to-redact-a-pdf`).
- Technically accurate — written from the actual source, no invented claims:
  - Real crate: `crates/core/` (braincoder-core, edition 2021) on **zpdf-core/parser/writer 0.13** + wasm-bindgen 0.2.128; five exports (`find_matches`, `split_words`, `merge_pdfs`, `extract_pdfs`, `redact_pdfs`).
  - **True redaction** explained honestly: content-stream operator excision via `zpdf-writer`'s `redact_page` (not cosmetic cover-boxes) — the moat differentiator.
  - Word reconstruction math: `char_weight` glyph weights, `WORD_SPLIT_MIN_WIDTH`, `WORD_PAD_EM`, `WORD_RIGHT_EXTRA_EM`, normalized phrase matching → 0..1 rects.
  - JS bridge: lazy single-instantiation promise cache, transparent JS fallback (`matchRectsJs`), `build:core` emits **one Rust build → 3 artifacts** (browser ESM, Node glue for tests, public wasm).
  - Size verified from binary: ~666 KB raw / ~245 KB gzipped; `opt-level="s" lto codegen-units=1 panic="abort" strip` release profile.
  - Correctness story: `e2e/wasm-validate.mjs` byte-identical equivalence vs JS oracle + pdf-lib/pdf.js round-trips (`npm run test:core`).
  - Lessons: `Vec`-typed wasm-bindgen bindings; JS fallback doubles as test oracle; real-vs-cosmetic redaction.
  - Backlinks: `/tools/pdf-redact`, `/tools/pdf-auto-redact`, `/tools/pdf-merge`, repo, `/verify` live audit.
- **Publish step**: flip `published: true`, paste into dev.to editor, submit to `dev.to/rust` + `dev.to/wasm` + `dev.to/javascript` communities. (Not auto-published from repo — no dev.to API token configured.)

**What we're explicitly NOT doing in Phase 2 (per agents):**
- ~~Chrome extension~~ → distraction until traffic > 5K/mo
- ~~VS Code extension~~ → 40M users but no distribution channel yet
- ~~Batch processing queue~~ → Phase 3 (only relevant when paid tier exists)
- ~~A/B test pricing~~ → not until there are paying customers
- ~~Auth / accounts~~ → only add when cross-device sync proves needed

**Phase 2 success metrics:**
- [ ] 5-10 tools ranking top-3 for long-tail keywords (GSC, 60 days)
- [ ] 500+ organic clicks/month (GSC, 90 days)
- [ ] 25+ referring domains (Ahrefs/SEMrush, 90 days)
- [ ] 100+ GitHub stars (launch + communities)
- [x] Favorites feature shipped (5%+ adoption to measure post-launch)
- [x] PWA manifest + SW shipped (2%+ installs to measure post-launch)
- [x] 8+ how-to guides covering PDF + non-PDF long-tail keywords (15 total)
- [x] "Verify: 0 uploads" proof page live with a functioning network-audit demo
- [x] Rust/WASM dev.to deep-dive drafted (publish: flip `published: true` → dev.to)
- [x] Show HN launch kit written (`launch/hacker-news.md`)
- [x] Directory + awesome-list submission plan and copy written (`launch/directory-submissions.md`)

**Launch kit `launch/hacker-news.md` (research-grounded, Sep 2026):** recommended Show HN title ("I built 123 browser dev tools with a Rust/WASM core – files never leave your device") + backup; 10 ranked title candidates; ~200-word ready-to-paste post body; timing (Tue–Thu 9–11am PT) + first-2-hours engagement plan; criticism-response table (iLovePDF/PDFgear/no-backend/redaction-skeptic); 13-point pre-launch checklist (flagged gap: OG title not yet verified on hn.algolia); 24h follow-up + metrics (front page ~80–100 pts, 500–2k stars = strong result). Key insight: the 2026 "AI slop" backlash is a tailwind — zero-upload architecture is the counter-narrative — but posture is "explain the architecture", never "position against AI".

**`launch/directory-submissions.md` (verified, Sep 2026):** 14-directory table with honest priorities — SaaSHub previously blocked `*.vercel.app` but custom domain `braincoder.sardar.dev` is now live (submit and verify); alternativeTo decline list flags "collections of online tools" → submit as a single app (position like PDF24); Tool Finder is paid (150€); free-for.dev is wrong format; G2/Capterra no value at zero traffic. 6 awesome-list PRs with repo/maintained-check + ready-to-paste one-liners (top fit: `mcuking/Awesome-WebAssembly-Applications` "Online Productive Tools", active 2026-09-11; then `pluja/awesome-privacy"); alternativeTo submission copy (~145 word description, 5 tags, real competitors, $5 priority-review tip); Product Hunt deferred post-HN; 3-tier run order; 21-row tracking table.

**Parallel-execution note:** both launch files were produced by two independent research agents running simultaneously (no shared file / no conflict).

#### Phase 3 — Scale Distribution (Months 4-6)

| Task | Why |
|------|-----|
| REST API (paid) | B2B revenue |
| Enterprise tier ($49/mo) | High-LTV customers |
| Marketplace | Network effects |
| Partnerships (Notion, Slack) | Distribution |

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-15 | Tool page: action-first hero | 4-agent UX debate: CTA at top converts better |
| 2026-09-15 | Homepage: server components + client island | Performance agent: reduce client JS, keep interactive island small |
| 2026-09-15 | FAQ: native `<details>` not React accordion | Performance: zero JS, SEO crawlable, a11y native |
| 2026-09-15 | Keep everything free for now | Validate product before adding paywall |
| 2026-09-15 | Auth: Clerk (recommended by 3/5 tech agents) | Free 10K MAU, drop-in UI, session cookies |
| 2026-09-15 | Billing: Lemon Squeezy (when ready) | MoR handles global VAT/tax |
| 2026-09-15 | DB: Turso/libSQL + Drizzle ORM | Edge SQLite, free tier, serverless |
| 2026-09-15 | Don't compete with ilovepdf on head SEO | DR 83 vs DR ~0; own developer niche instead |
| 2026-09-15 | Skip Clerk/Turso/Vercel Pro for MVP | 3-agent validation: use localStorage + anonymous IDs; zero cost until 50K users |
| 2026-09-15 | Retention MVP = recent tools on homepage | PM agent: most users return to find "that tool I used last week"; skip favorites/auth for now |
| 2026-09-15 | Growth: long-tail SEO first, HN/PH later | Growth agent: compound organic traffic; launch channels are spike, not durable |
| 2026-09-15 | Don't build Chrome/VS Code extension yet | Growth agent: distraction; optimize existing 123 pages first |
| 2026-09-15 | Track tool use on `/use/[slug]` (not `/tools/[slug]`) | PM agent: only track actual launches, not just page views |
| 2026-09-15 | Use `useSyncExternalStore` not `useEffect` + `setState` | React 19 lint rejects setState in effects; `useSyncExternalStore` is designed for localStorage |
| 2026-09-15 | RecentTools returns null on fresh visit | PM agent: conditional rendering avoids confusing new users with an empty "recent" section |
| 2026-09-15 | Use `@vercel/analytics/next` not Plausible | User has Vercel Web Analytics enabled; no env vars or external accounts needed |
| 2026-09-15 | CSP `connect-src` must include `data: blob:` | BrainCoder tools call `fetch(canvas.toDataURL(...))` to convert canvas → ArrayBuffer; CSP blocks this without explicit `data:` in `connect-src` |
| 2026-09-15 | Skip link + focus-visible in `globals.css` | WCAG 2.1 AA: visible focus for keyboard users, skip nav for screen readers; no extra components needed |
| 2026-09-15 | Category pages at `/categories/${slug}` not `/tools/${slug}` | Avoids conflict with existing dynamic `/tools/[slug]` route; URL-safe slugified categories |
| 2026-09-15 | SW registration gated to production only | Dev-mode service workers cause stale-cache confusion; register only when `NODE_ENV === "production"` |
| 2026-09-15 | `themeColor` in `viewport` export, not `metadata` | Next.js 16 deprecates `metadata.themeColor` (throws warning on every page) |
| 2026-09-15 | Category copy shared via `CATEGORY_DESCRIPTIONS` in `seo.ts` | Single source for hero copy, metadata description, and JSON-LD |
| 2026-09-15 | Verify page audit hooks `fetch` + `XHR.prototype.send` at mount | Catches any request (incl. FormData/Blob bodies) that would carry the watched file — actually enforceable, unlike a static claim |
| 2026-09-15 | Proof-page demo hashes file with `crypto.subtle` locally | Real interactive proof: file digest without a single network byte |
| 2026-09-15 | Swapped header "Live app" (self-link to own domain) for "0 uploads — verify" | Header real-estate now reinforces the moat instead of pointlessly pointing at the same site |
| 2026-09-15 | dev.to deep-dive stored in-repo with `published: false` frontmatter | Article lives with the code it documents; publish = flip flag + paste to dev.to (no API token) |
| 2026-09-15 | Launch kit + directory plan produced by two parallel agents | Independent tasks → parallel agents; single shared output dir `launch/`, no cross-file writes |
| 2026-09-15 | Defer SaaSHub + Product Hunt until custom domain / HN momentum | Custom domain `braincoder.sardar.dev` now live; SaaSHub should accept it. PH needs first-day distribution only HN can provide |

---

## Architecture Decisions

### Route Structure (Target — Phase 1)

```
src/app/
├── page.tsx              # Homepage (server components + RecentTools client island)
├── tools/[slug]/         # Tool detail (SEO, SSG)
├── use/[slug]/           # Fullscreen app (client-side)
├── guides/               # Blog/guides
├── layout.tsx            # Root layout, header, footer
└── middleware.ts          # (future: auth session validation)

Phase 2+ (NOT building now):
├── (marketing)/          # Route group for public pages
├── (dashboard)/          # Auth-gated dashboard
│   ├── layout.tsx        # Sidebar + auth check
│   ├── dashboard/        # Main dashboard
│   ├── recent/           # My recent tools
│   ├── vault/            # Cloud save
│   └── account/          # Profile + settings
└── api/                  # Webhooks (future)
```

### Component Architecture (Current → Phase 1 Target)

```
Current:
  page.tsx → [HomeHero, HomeFeatured, ToolsExplorer(client), CategoryIndex, HomeFaq]
  tools/[slug]/page.tsx → [ToolSubNav, ToolPreview, ToolFaq]

Phase 1 Target:
  page.tsx → [HomeHero, RecentTools(client, NEW), HomeFeatured, ToolsExplorer(client), CategoryIndex, HomeFaq]
  tools/[slug]/page.tsx → [ToolSubNav, ToolPreview, ToolFaq] (add addRecentTool() call)
  lib/userState.ts → anonymous ID, recent tools, favorites (NEW)
  components/RecentTools.tsx → client component for homepage (NEW)

Phase 2+ Target (NOT building now):
  (marketing)/page.tsx → same + Pricing, Testimonials
  (dashboard)/layout.tsx → auth() + sidebar
  (dashboard)/dashboard/page.tsx → recent tools + quick actions
  (dashboard)/vault/page.tsx → encrypted file vault
```

---

## Agent Debate History

### Debate 1: Tool Page CTA Placement (4 agents)
- **For** (2): Action-first converts; mobile thumb-zone
- **Against** (2): CTA fatigue; SEO hierarchy
- **Synthesis:** Single primary CTA at top; demoted mid-band to slim strip; removed mobile floating bar
- **Result:** Shipped as `9fed366`

### Debate 2: Homepage Rebuild (5 agents)
- **SEO:** Needs crawlable content, FAQ, category pages, internal links
- **UX:** Polished search, clear hierarchy, component split
- **CRO:** Tools reachable fast, don't bury grid below content
- **Performance:** Split client island, server-render everything else
- **Synthesis:** Server-rendered hero/featured/categories/FAQ below grid; client island = search+filter+grid only
- **Result:** Shipped as `b3ed725`

### Debate 3: SaaS Conversion (25 agents)
- **Tech (5):** Monolith App Router, Clerk auth, Turso DB, Vercel stays, WASM stays client-side
- **Product (4):** Batch processing = conversion hook, vault = retention, shadcn/ui for design system
- **Growth (5):** SEO long-tail, GitHub launch, VS Code extension, embeds, analytics from day 1
- **Business (4):** $7.99/mo Pro, Lemon Squeezy, bootstrap (not fundable yet), B2B WASM SDK long-term
- **Ops (5):** CSP headers, a11y AA, Playwright e2e expansion, Plausible analytics, server-render homepage grid
- **Contrarian (2):** ChatGPT threat is real, MIT = no moat, but market exists and monetizes
- **Synthesis:** Ship vault + auth in 30 days, keep free, validate before pricing

### Debate 4: Phase 1 Validation (3 agents — 2026-09-15)
- **Tech stack agent:** SKIP Clerk, Turso, Vercel Pro. Use anonymous IDs + localStorage. Zero cost until 50K users. Add auth Month 2 only if cross-device sync proves needed.
- **Product/PM agent:** GO with recent tools as MVP retention feature. Single feature: "Recent tools" row on homepage, conditionally rendered. Favorites in Week 2. No auth needed yet.
- **Growth agent:** GO with amendments. #1 lever = long-tail SEO + analytics (currently flying blind). Don't chase head keywords. Don't build more tools. Category landing pages + guides for topical clusters. HN in Week 4, PH 2-3 weeks later.
- **Synthesis:** Simplify Phase 1 to: analytics → fix homepage meta → userState.ts → RecentTools component → wire into homepage. Ship in 5 days. Everything else is downstream.

---

## Risks & Mitigations

| # | Risk | Severity | Status | Mitigation |
|---|------|----------|--------|------------|
| 1 | ChatGPT eats simple text tools | CRITICAL | Active | Focus on file-based workflows (PDF, image, office); AI-enhance own tools |
| 2 | Zero SEO authority vs ilovepdf | HIGH | Active | Own developer niche; open-source for backlinks; HN/Dev.to launch |
| 3 | Free tier cannibalization | HIGH | Planned | Gate depth (batch, history, vault), not breadth |
| 4 | Solo founder burnout | HIGH | Planned | Ship Phase 1 in 30 days; evaluate demand by Day 60 |
| 5 | Privacy claim scrutiny | MEDIUM | Planned | Publish technical whitepaper; network tab proof |
| 6 | No CSP headers | MEDIUM | Planned | Ship CSP in Phase 1 |
| 7 | a11y gaps (focus, contrast) | MEDIUM | Planned | Fix top 5 before SaaS launch |

---

## Success Metrics

| Timeframe | Metric | Target | Actual |
|-----------|--------|--------|--------|
| Day 30 | Registered users | 500 | — |
| Day 30 | Trial starts | 100 | — |
| Day 30 | MAU | 5,000 | — |
| Day 60 | Paying customers | 25 | — |
| Day 60 | MRR | $200 | — |
| Day 90 | Paying customers | 50 | — |
| Day 90 | MRR | $400 | — |
| Day 90 | Organic traffic | 20K clicks/mo | — |
| Day 180 | Paying customers | 200 | — |
| Day 180 | MRR | $1,600 | — |
| Day 180 | MAU | 30,000 | — |

---

## File Reference

### Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/tools.ts` | ToolConfig type + TOOLS array (123 tools) + CATEGORIES |
| `src/lib/seo.ts` | Metadata builders, JSON-LD generators, HOME_FAQ |
| `src/lib/tool-content.ts` | Per-tool longDescription, features, howTo, faq |
| `src/lib/wasm-core.ts` | WASM lazy-loader with JS fallback |
| `src/app/page.tsx` | Homepage composition |
| `src/app/layout.tsx` | Root layout, header, footer |
| `src/app/tools/[slug]/page.tsx` | Tool detail page |
| `src/app/use/[slug]/page.tsx` | Fullscreen tool app |
| `src/components/ToolsExplorer.tsx` | Client island: search + filter + grid |
| `src/components/HomeHero.tsx` | Server: hero with proof stats |
| `src/components/HomeFeatured.tsx` | Server: PDF featured band |
| `src/components/CategoryIndex.tsx` | Server: 8 category cards |
| `src/components/HomeFaq.tsx` | Server: native details FAQ |
| `src/components/ToolCard.tsx` | Shared tool card component |
| `src/components/ToolPreview.tsx` | Browser-window mock in tool hero |
| `src/components/ToolSubNav.tsx` | Desktop sticky anchor nav |
| `src/components/ToolFaq.tsx` | FAQ accordion (tool pages) |
| `crates/core/src/lib.rs` | Rust/WASM core (PDF operations) |
| `e2e/office.mjs` | Playwright e2e suite (18 steps) |

### New Files (Planned for Phase 1)

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/layout.tsx` | Dashboard layout with auth gate |
| `src/app/(dashboard)/dashboard/page.tsx` | Main dashboard |
| `src/app/(dashboard)/recent/page.tsx` | My recent tools |
| `src/app/(dashboard)/vault/page.tsx` | Encrypted cloud vault |
| `src/app/(dashboard)/account/page.tsx` | Profile + settings |
| `src/lib/auth.ts` | Clerk auth helpers |
| `src/lib/db.ts` | Turso/Drizzle connection |
| `src/lib/db/schema.ts` | Database schema |
| `src/components/DashboardNav.tsx` | Dashboard sidebar |
| `src/components/AuthProvider.tsx` | Clerk provider wrapper |
| `src/middleware.ts` | Auth session validation |
| `src/lib/analytics.ts` | localStorage event layer |
| `src/lib/crypto.ts` | AES-256-GCM vault encryption |

---

## Pending Items (blocked on founder action or credentials)

| Item | Blocker | Owner | Status |
|------|---------|-------|--------|
| `pluja/awesome-privacy` PR | Weak fit — `## Office` lists full office suites (LibreOffice/OnlyOffice/Cryptpad), not tool collections; same "collections of online tools" decline risk the research flagged. Options: skip / open under `## Office` / try `## Utilities` | Decide | ⏸ held |
| `awesome-selfhosted` PR | Requires MIT repo + **self-hosting path (Dockerfile/self-host note)** — declined without source/deploy proof | Add Dockerfile or drop | ⏸ held |
| dev.to article publish | Needs `DEV_TO_TOKEN` env or manual paste to dev.to (flip `published: true`) | Me/founder | ⏸ blocked |
| alternativeTo + directory forms | Need email-verified accounts ($5 priority review suggested; custom domain `braincoder.sardar.dev` now live — submit to SaaSHub) | Founder | ⏸ blocked |
| Show HN launch | Must post at right time on launch day (Tue–Thu 9–11am PT) per `launch/hacker-news.md` | Founder | ⏸ scheduled |
| mcuking AWAA PR | Done — [PR #36](https://github.com/mcuking/Awesome-WebAssembly-Applications/pull/36) open | — | ✅ live |

## Sequential Tool Upgrades

- User correction (2026-09-16): ten distinct expert agents per tool. They are
  read-only and independent, so they run in parallel; judges never wait on each
  other's output. Finish judging, upgrades and verification before the next tool.
- Workflow: `audit/TOOL-AUDIT-KIT.md`. All 123 registry tools remain in scope.
- PDF Compressor: ten judges completed; engine/client/UI and related content
  upgraded. 73 regression tests and 15 production Chrome scenarios passed;
  production build passed (279 pages). Report: `audit/reports/pdf-compressor.md`.
- Image Compressor: ten judges completed (parallel-ready workflow); engine,
  client, worker, UI and related content upgraded. 5 node regression checks and
  24 production Chrome scenarios passed; production build passed (280 pages).
  Report: `audit/reports/image-compressor.md`.
- Image Resizer: ten independent judges ran in parallel for the first time;
  engine-free component, worker, UI and content upgraded (safe dims/caps,
  presets, drag & drop, result preview, a11y parity, honest copy, new guide).
  3 node checks and 28 production Chrome scenarios passed; production build
  passed (281 pages). Report: `audit/reports/image-resizer.md`.
- JSON Formatter: ten independent judges ran in parallel. Component + new pure
  module upgraded (single deferred parse, engine-derived line/column errors,
  minified copy, a11y live regions + radiogroup, contrast, 2MB cap, friendly
  deep-nesting), content made fully honest, new guide. 10 node checks and 15
  production Chrome scenarios passed; production build passed (282 pages).
  Report: `audit/reports/json-formatter.md`.
- URL Encoder: ten independent judges ran in parallel. Component rebuilt
  (error separated from output into role=alert, encode-only checkbox with
  two-state label, radiogroup mode toggle, strict decode, whole-URL hint,
  2MB cap, dismissable error, a11y parity); shared CopyButton given success-
  gated feedback and aria-hidden icons; content, SEO, tagline and guide
  rewritten. 19 production Chrome scenarios passed (including a CopyButton
  cross-tool regression); production build passed (283 pages). No separate
  node harness — no extracted module. Report: `audit/reports/url-encoder.md`.
- Base64 Encoder & Decoder: ten independent judges ran in parallel. Component
  rebuilt to the team standard (radiogroup mode toggle, 2MB cap, dismissable
  role=alert errors now split into truncation / invalid-char / binary-not-UTF-8
  cases with fatal TextDecoder so raw bytes error instead of printing U+FFFD,
  swap now flips mode to round-trip instead of double-encoding, output char
  count + tabIndex=-1, input aria-invalid/describedby); shared `toolKeywords()`
  fixed to drop the junk "&" token; copy, FAQ (4→7 incl. JWT caveat), tagline,
  SEO row and a new guide rewritten. 27 production Chrome scenarios passed;
  production build passed (284 pages). Report: `audit/reports/base64.md`.
- QR Code Generator: ten independent judges ran in parallel (pulled ahead of
  registry order because the domain-switch commit had swept in unaudited
  QrCodeGenerator changes). Component rebuilt (alt text no longer leaks the
  encoded payload — critical privacy fix — img/downloads moved out of the live
  region into a concise sr-only status, dismissable red role=alert errors,
  deterministic mode-aware v40 capacity pre-check, ISO 4-module quiet zone,
  fixed 256px preview with on-demand size-correct PNG/SVG downloads, low-contrast
  warning, labelled input, Clear, min-h-11/focus-visible parity); copy, features,
  howTo (phantom Generate button removed), FAQ (3→6), tagline, SEO row, related
  graph (base64 reciprocates) and the QR guide rewritten. 23 production Chrome
  scenarios passed (plus url-encoder 19 and base64 27 re-run green); production
  build passed (284 pages). Report: `audit/reports/qr-code-generator.md`.
- Notepad: ten independent judges ran in parallel. Component rebuilt on the
  team standard (pagehide/visibilitychange flush closes the 300ms data-loss
  window, hydration via useState+setTimeout(0)+hydrated flag with an empty-guard
  kills the #418 SSR mismatch and mount write-back, guarded setItem with a
  "not saving" role=alert instead of silent death, 2,000,000-char cap,
  cross-tab storage-event sync, execCommand-fallback copy with "Copied"
  feedback, first-line-derived download name with delayed revoke, two-step
  armed Clear replacing confirm(), 8MB file-open guard, visible label +
  aria-describedby + role=status); the phantom undo/redo + word-wrap claims are
  gone from copy; FAQ 3→5 with honest recovery/shared-device answers; `seo.ts`
  `toolTitle()` made plural-aware (kills the "free text tools tool" residual);
  `/use/[slug]` page tool name promoted span→h1; new guide
  `how-to-use-a-free-online-notepad`. 34 production Chrome scenarios passed
  (notepad) plus base64 27 / url-encoder 19 / qr 23 re-runs green; production
  build passed (285 pages). Report: `audit/reports/notepad.md`.
- Password Generator: ten independent judges ran in parallel. Component rebuilt
  on the team standard (client-only generation via a deferred effect — the
  lazy-initializer had been shipping a real password in static HTML — per-type
  stripped pools that fix the exclude-ambiguous guarantee-path bypass, honest
  entropy-bits meter instead of the "/2.8 → default reads Weak" scale, role=meter
  + status region + htmlFor slider + fieldset legend + min-h-11/focus parity,
  empty-config clears + disables + explains, autocomplete-off/output aria-label,
  click-to-select, delay-safe RangeError guards); batch/4-128/crack-time claims
  deleted and copy rewritten true; FAQ 4→6 with corrected entropy math and
  privacy/offline PAA; shared `toolTitle()` maps verb categories to nouns (free
  generate tool residual gone) and JSON-LD featureList no longer reads "generate
  and generate"; guide retitled honest and passphrase claim removed. 29
  production Chrome scenarios passed (incl. 0/25 ambiguous leak) plus notepad
  34 / base64 27 / url-encoder 19 / qr 23 re-runs green; production build
  passed (285 pages). Report: `audit/reports/password-generator.md`.
- Diff Checker: ten independent judges ran in parallel (two rate-limited on
  first attempt, completed on retry). Engine fixed and upgraded:
  same-row/right-side text bug (rendered LEFT bytes in the right pane),
  locale-nondeterministic ignore-case (`toLocaleLowerCase` → `toLowerCase`),
  surrogate-splitting char highlight (`split("")` → `Array.from`), CJK word
  tokens split per code point (one-char change no longer colors the whole
  sentence), CRLF `\r` stripped in `splitLines` (upload path), canonical `-1,0`
  hunk headers, and the 3rd Myers pass removed (copy formats from stored hunks).
  Both diff memos now gate on Compare and the render no longer duplicates
  empty/identical states; an honest amber warning covers very large inputs;
  the false "yellow modifications" howTo step and the "hundreds of thousands of
  lines" FAQ are corrected; JSON-LD featureList is now tool-specific (no "format,
  convert, generate" for a diff tool); split view gained `−`/`+` text markers,
  th headers, caption, legend, a role=status live region, real tablist/tab
  semantics with arrow keys, and the house min-h-11/focusRing (also added to the
  shared Button); Copy uses the shared CopyButton with feedback. 31 production
  Chrome scenarios passed (incl. same-row regression, byte-exact unified diff,
  CJK comma-only highlight, emoji-intact char mode, CRLF upload equality) plus
  notepad 34 / base64 27 / url-encoder 19 / qr 23 re-runs green; production
  build passed (285 pages). Report: `audit/reports/diff-checker.md`.
- Timestamp Converter: ten independent judges ran in parallel (the edge-cases
  judge returned an empty report; its scope was covered by the functional
  findings plus the strict parser written from them and asserted in the
  harness). The component was rebuilt because three judges independently
  showed it could crash and two confirmed a broken hydration path. Out-of-range
  input (over 8.64e15 ms, incl. 1e308/1e400 → Infinity) threw an uncaught
  RangeError from toISOString() and unmounted the whole /use route to the Next
  error screen — the ts memo now validates `^-?\d+(\.\d+)?$`, refuses non-finite
  values, and enforces `|ms| ≤ 8.64e15`, so the exact boundary converts
  (+275760-09-13) while one ms over shows a role=alert message with empty
  cards. Hydration mismatch (#418 in Chrome+Firefox) came from Date.now() at
  module load baking a build-time value into the static HTML — the default is
  gone; both fields start empty (deterministic SSR) and a client-only effect
  boots to the current second and starts a 1s tick (set-state only inside
  callbacks, so the sync set-state-in-effect lint rule is respected). The
  reverse field was a derived controlled input that evicted partial typing, so
  it is now a separate draft state committed only when a complete strict local
  date parses (YYYY-MM-DD HH:MM:SS, date-only = local midnight, component
  round-trip rejects 2021-02-29/month-13/day-32, blur normalizes). 13-digit
  values are auto-detected as milliseconds with a role=status hint; the ms
  checkbox remains an explicit override. Empty input no longer implies
  1970; invalid input gets role=alert + aria-invalid + aria-describedby on
  both inputs (they previously had placeholder-only names). Shipped the three
  cheap wins every judge asked for: a live ticking "Current Unix time" line
  beside the Now button, a 4th HTTP-date (RFC 2822) card, and a local-time
  label with the browser timezone name + UTC offset (Intl, computed in the
  client effect so it can't mismatch SSR). Copy rewrote the five fabricated
  content claims (timezone-offset configuration, RFC 2822/locale formats, live
  display, direction toggle, "converts as you type"), replaced the wrong
  "64-bit integers" 2038 FAQ with double-precision (~275,760) and documented
  local-parsing semantics; relatedSlugs moved to json-formatter/cron-parser/
  http-status/jwt-decoder/uuid-generator (all exist); SEO keywords widened and
  a JSON-LD featureList override added (the regex-tester override's stale
  "worker-isolated" claim also fixed). 43 production Chrome scenarios passed
  (incl. boundary crash guard, zero hydration errors, char-by-char reverse
  typing, leap-day rejection, round-trip, auto-detect, live tick, clipboard
  content) plus json-formatter 15 / text-size 24 / regex-tester 39 /
  word-counter spot check green; production build passed (285 pages). Report:
  `audit/reports/timestamp-converter.md`.
- Word Counter: ten independent judges ran in parallel (all ten returned).
  Component rebuilt on the team standard: the sentence splitter now shields
  decimals and mutes common abbreviations (Mr./e.g./etc./v1.2.3) before
  matching terminal punctuation — "Mr. Smith went home." → 1 sentence,
  "Use e.g. apples." stays one unit, punctuation-only input ("!.!.") counts 0
  words/sentences; words tokenize via a Unicode property regex (hyphenated
  and dotted terms count once, punctuation never); characters count code
  points (emoji honest, the old UTF-16 double-count is gone) in a single
  for…of pass with no per-keystroke copy. Performance: `useDeferredValue` +
  `useMemo` keep typing at input latency on a 1,000,000-char cap (was ~228ms
  visible on 5MB pastes), with a disclosed limit note. Empty state is now
  honest (no hardcoded pangram): a Clear button (disabled when empty), a
  `role=status` aria-live line ("N words, M characters", singular handled),
  `useId` + label htmlFor textarea, dl-based stat cards with the label
  announced before the value, `toLocaleString("en-US")` pinned (rules out a
  grouped-separator hydration mismatch), and reading/speaking time + unique
  words cards. Copy rewrote the CJK overclaim into honest scoping —
  character counts accurate for every script, word/sentence counts tuned for
  space-delimited languages — added the 1,000,000 FAQ, and features now list
  unique words and reading/speaking time; keywords widened and a JSON-LD
  featureList override added. 38 production Chrome scenarios passed
  (abbreviation/decimal immunity, 0-word punctuation, emoji chars, unique
  collapse, lines/paragraphs, 40k-word paste accurate + zero errors,
  pluralized status, dl order, Clear, honest /tools/ copy) plus Wave 1/2
  re-runs green; production build passed (287 pages). Report:
  `audit/reports/word-counter.md`.
- Lorem Ipsum: ten independent judges ran in parallel (all ten returned).
  Component rebuilt on the team standard: the `useState(() => build(mode,
  count))` lazy initializer had been running Math.random during SSR AND client
  hydration — React #418. State now starts "" and a client-only deferred
  effect (setTimeout callback, sync set-state-in-effect rule respected) fills
  the output on mount and regenerates on every mode/count change — the
  stale-output trap is gone (no more copying text that doesn't match the
  controls). The slider was raised 20 → 50 to match the promised 1–50 range
  and replaced with the shared SliderField (useId label htmlFor from the prior
  wave). Mode buttons live in a `role=group aria-label="Type"` group with
  `aria-pressed` + ring (color-only active state removed); the output textarea
  is readOnly with `aria-label="Generated output"` and a `role=status` line
  announces the active config. The canonical "Lorem ipsum dolor sit amet"
  opener now leads every first generated unit (words mode: "lorem ipsum…" for
  count ≥ 2) so the classic claim is literally true, and a no-adjacent-
  duplicates pick guard removes word collisions. Copy deleted the fabricated
  "shuffle words"/"pure random"/"slider or input" capabilities, scoped privacy
  to "generated text never leaves your browser", and documented the opener,
  the anti-repeat guarantee and the real range; keywords widened + JSON-LD
  featureList override added. 30 production Chrome scenarios passed
  (hydration-zero, opener, 1–50 label, aria-pressed group, auto-regen on
  mode/count, 50-word batch with zero adjacent dupes, Generate re-roll,
  readOnly output + clipboard copy, honest /tools/ copy) plus Wave 1/2
  re-runs green; production build passed (287 pages). Report:
  `audit/reports/lorem-ipsum.md`.
- Color Converter: ten independent judges ran in parallel (all ten returned).
  Component rebuilt: hex-ONLY input was making the promised RGB/HSL switching,
  rgba/hsla and clamping unreachable, so a real `parseColor()` now accepts
  #RGB/#RRGGBB/#RGBA/#RRGGBBAA and CSS rgb()/rgba()/hsl()/hsla() (numeric or %
  channels, alpha 0–1 or 0–100%, hue 360-wrap, whitespace-tolerant) — all three
  formats output live, alpha carries through every format, and out-of-range
  channels clamp (rgb(300,0,0) → 255) exactly as marketed. Input triage
  distinguishes valid / hopeful (partial hex or css prefix — no error, hides
  results) / hopeless (garbage like "red"/"#ggg" → role=alert + aria-invalid +
  hidden results); the picker tracks a separate `lastValid` state instead of
  the raw (possibly garbage) hex, so partial overwrites never snap it to
  #000000. rgbToHex is computed once per render. A11y: useId + label htmlFor
  on the hex input, role=alert error banner, distinct copy aria-labels
  ("Copy HEX/RGB/HSL value"), house indigo focus ring (was purple). Tagline
  fixed ("HEX, RGB, HSL & CSS colors" → "HEX, RGB & HSL color converter",
  matching the CSS-names FAQ); copy dropped the phantom "Choose Output Format"
  step, documents 3/4/6/8-digit hex, alpha flow and clamping; keywords widened
  (hsl-to-rgb, rgba-to-hex…) + JSON-LD featureList override added AND the
  generic Convert-category fallback fixed (the doubled "convert" in "Format,
  convert, generate and convert"). 33 production Chrome scenarios passed
  (default #7C3AED→rgb+hsl, #f00, rgb()→hex, hsl()→#FF0000, rgba alpha
  round-trips, 8-digit hex, clamping, distinct copy labels + clipboard,
  hopeless/hopeful/empty triage, picker keeps last valid, honest /tools/ copy)
  plus Wave 1/2 re-runs green; production build passed (287 pages). Report:
  `audit/reports/color-converter.md`.
- CSS Cursor: ten independent judges ran in parallel (all ten returned).
  Component rebuilt: the pasted-URL promise is dead (no way to load a remote
  image, and browsers block cursor url() fetches), so a labelled local
  PNG/CUR file input now renders a real custom cursor on the interactive
  preview target (`cursor: url("blob:…") 2 2, pointer;`) with the Blob URL
  revoked on unmount/replacement; the 36 keyword cards became plain buttons
  with `aria-pressed` selection + distinct accessible names and a single Copy
  button writes the exact `cursor: value;` declaration (per-card copy buttons
  removed); non-image files get a role=alert. Copy, keyword row, JSON-LD
  featureList and description rewritten to the honest scope (local-only custom
  cursor + browser remote-URL blocking documented in FAQ, which also keeps the
  no-upload disclosure). 21 production Chrome scenarios passed (36 cards,
  default pointer declaration + label, selection state, grab updates,
  exact-clipboard copy, custom-PNG blob declaration, clear-custom restore,
  non-image alert, honest /tools/ copy) plus prior re-runs green; production
  build passed (287 pages). Report: `audit/reports/css-cursor.md`.
- Gzip Tool: ten independent judges ran in parallel (all ten returned).
  Component rebuilt: the output region now really holds the compressed value
  as text (copy writes the exact base64); JSON-payload mode emits
  `{"<format>":true,"data":…}` and its Download unwraps to the raw .gz/
  .deflate bytes; decompression works on bytes with binary detection
  (NUL/U+FFFD heuristics) surfacing a "Download original bytes" action instead
  of FFFD soup; the stack-overflowing whole-buffer `String.fromCharCode(...)`
  spread is a chunked 32 KB loop; formats scoped to gzip/deflate/deflate-raw
  (data-URI and raw-byte-string claims deleted); 20 MB input / 64 MB
  decompressed caps with a 200 KB display truncation note (full data kept for
  copy/download); CompressionStream feature-gate role=alert banner replaces a
  missing-constructor crash; a11y: label htmlFor on the textarea, role=group +
  aria-pressed pills, aria-label/aria-busy output region, role=status/alert.
  Copy, SEO row, JSON-LD featureList and description rewritten honest. 33
  production Chrome scenarios passed (labelled input, pills, H4sI base64,
  exact clipboard, node-gunzip cross-checks, JSON payload + keyed Decompressed
  report + payload-Data download, binary warning + byte-identical original
  download, plain-text not mis-detected, truncated-display/full-copy, file
  compress/decompress, deflate pill, honest /tools/ copy) plus prior re-runs
  green; production build passed (287 pages). Report:
  `audit/reports/gzip-tool.md`.
- Image to PDF: ten independent judges ran in parallel (all ten returned;
  one first-pass report lost to a rate limit and re-run). Component rebuilt:
  buildPdf snapshots items up front, embeds each image in its own
  try/catch with a canvas→JPEG fallback and reports success (`role=status`,
  page count) or failure (`role=alert`) — the silent abort is gone; downloads
  use an exact-size buffer copy (the raw `bytes.buffer` had trailing zero
  padding); fit mode clamps to the 14400 pt PDF limit with a scale-to-fit +
  white background draw (no more 56-inch pages / NaN from zero-dim files);
  move up/down reordering (disabled at edges, distinct accessible names),
  dedup by name+size, and real drag-drop on the empty state and grid; the size
  select is properly labelled and the margin control switched to the shared
  SliderField (label htmlFor) shown only for A4/Letter; object URLs tracked
  and revoked on unmount/removal; root aria-busy + "Building page x of N"
  progress. Copy, SEO row, JSON-LD featureList and description rewritten
  honest (GIF = static first frame; no orientation/custom-dimensions/animated
  claims). 30 production Chrome scenarios passed (labelled select, fit/A4/
  letter, honest empty state, order-preserving add, duplicate reject,
  reorder/disables, distinct remove names, %PDF magic + exact page counts via
  pdf-lib load, build status, drag-drop, A4 margin slider, unloadable-image
  alert, clear-to-empty, honest /tools/ copy, zero hydration/page errors)
  plus prior re-runs green; production build passed (287 pages). Report:
  `audit/reports/image-to-pdf.md`.
- PDF to Image: ten independent judges ran in parallel. Component rebuilt on
  the pdf.js pipeline shared with word-to-pdf and pdf-to-text (`getDocument` +
  `task.destroy`, per-page preview rendering, PNG/JPEG export, ZIP packaging,
  page-range input behind the shared `pageRangeSyntaxError` validator, drag-drop,
  locked-PDF detection with a friendly "password-protected" message, 500-page
  cap). The harness exposed a detached-ArrayBuffer crash: pdf.js transfers the
  data buffer, so re-using the same ArrayBuffer across renders threw "Cannot
  perform Construct on a detached ArrayBuffer" — all three `getDocument` call
  sites now pass `data.slice(0)`. Copy is honest about the real output
  resolution (render scale ≈72–288 PPI) — the "300 DPI" claim is gone. 29
  production Chrome scenarios passed (three previews, PNG magic-byte save,
  JPEG re-render + magic, a range restricting to one page → one preview via
  `waitForFunction` on img counts (the rerender is slow and text settles first),
  ZIP name/container/entry/magic, invalid "2-1"/"abc" range rejection + clear
  to recover, locked PDF (the new `e2e/fixtures/make-encrypted.mjs` R2/RC4-40
  fixture) → friendly alert, drag-drop, zero hydration/page errors, honest
  /tools/ copy). Report: `audit/reports/pdf-to-image.md`.
- Word to PDF: ten independent judges ran in parallel. Component rebuilt around
  the shared docx-to-HTML-to-PDF path: real .docx (OOXML) opens (generated zip
  fixtures validated through mammoth), legacy .doc (CFB) is rejected with the
  exact friendly message ("Please choose a .docx file … save it as .docx
  first"; asserted with `/choose a \.docx file/`), the accept-attribute check
  is token-based so the ".docx" token isn't masked by the ".doc" substring,
  a preview phase precedes a %PDF download verified by pdf-lib page counts
  (1 and ≥2), and all four error states surface as role=alert. 28 production
  Chrome scenarios passed (short/long/empty OOXML, CFB .doc + CFB-masked
  .docx, accept tokens, preview phase, download name + %PDF magic + page
  counts, error alerts, drag-drop, zero hydration/page errors, honest /tools/
  copy). Report: `audit/reports/word-to-pdf.md`.
- PDF to Text: ten independent judges ran in parallel (the architect report
  came back empty; its coverage supplied by the other judges plus the harness).
  Component rebuilt on the shared pdf-office `extractPdfText` (reading-order
  y/x line assembly, page range, 500-page cap, `task.destroy`) and the
  TextExtractor worker: a labelled textarea holds the extracted text, the .txt
  download carries the `\uFEFF` BOM, clipboard copy is verified, scanned pages
  report "No selectable text was found" with a link to PDF OCR (the tesseract
  CDN fetch is now user-visible — tracked residual), locked PDFs get a friendly
  alert (the encrypted fixture loads via pdf.js without a prompt, matching the
  app), and an invalid page range is rejected up front — subsequent file picks
  are blocked until the bad range is cleared. 26 production Chrome scenarios
  passed (same-baseline right-before-left tokens assemble in reading order,
  per-page text, BOM download, clipboard, range exclude/include, "zz" rejection
  + clear-to-recover, scanned → OCR link, locked alert, zero hydration/page
  errors, honest /tools/ copy). Report: `audit/reports/pdf-to-text.md`.
- Text to PDF: ten independent judges ran in parallel. `buildTextPdf` in
  the shared pdf-office module was rewritten (WinAnsi prevalidation throws a
  single friendly error naming the first offending chars so CJK/emoji/
  Cyrillic never crash the embed; a linear per-token char-width chunker
  replaced the O(n²)/O(n³) binary-search path so a 500,000-char word builds
  fast and even the *first* word is chunked; `cur` reset kills the ghost
  duplicate line; paragraphs split on `/\r\n?|\n/`; no trailing blank page).
  The component was rebuilt: labelled textarea, real 10–24 pt font-size
  SliderField, 500,000 `maxlength` with the cap disclosed in the status
  region and in copy, role=status live announcements, role=alert errors,
  aria-busy, exact-size Blob + deferred revoke. Copy no longer claims margin/
  line-spacing customization, a "Convert to PDF" button, or Letter support.
  New guide `how-to-convert-text-to-pdf`. 14/14 engine checks and 35/35
  production Chrome scenarios passed; production build passed (288 pages).
  Report: `audit/reports/text-to-pdf.md`.
- PDF to PPT: ten independent judges ran in parallel. The engine was upgraded
  (`renderPdfPages` hardened — `data.slice(0)`, `task.destroy()` in finally,
  `page.cleanup()`, null-ctx throws instead of silently dropping the page, so
  pdf-to-word benefits too; new `renderPptSlides` emits PNG **bytes** with a
  15,000,000 px² + 16,000px canvas guard that reports reduced scale, ≤12
  downscaled preview thumbnails, target page lists and live per-page
  progress; `buildPptx` now takes `{page, bytes, width, height}`, writes media
  straight into the zip at `level: 0`, and guards non-finite geometry so
  zero/oversized/minuscule pages can never emit NaN/Infinity coords). The
  component was rebuilt: no auto-download (explicit Download .pptx via the
  shared exact-size `downloadBlob`, `<base>.pptx`), 100 MB / 200 pages-per-run
  caps, real page range, drag-and-drop drop zone (role=button + keys), a
  1–3x image-quality slider that actually re-renders, Re-render button on
  dirty settings, 12-preview cap with truthful non-editable-text notes,
  role=status progress + success, role=alert errors (friendly password-locked
  and invalid-file messages), aria-busy + disabled buttons + runId race guard.
  Copy/FAQ/SEO rewritten honest (snapshot slides, not editable text; PDF to
  Text/Markdown as editable alternatives); reciprocal link from pdf-to-image;
  new guide `how-to-convert-pdf-to-powerpoint`. 18/18 node structure checks
  and 40/40 production Chrome scenarios passed; production build passed
  (289 pages). Report: `audit/reports/pdf-to-ppt.md`.
- Next: PDF Rotator (follows pdf-to-ppt in registry order). Remaining 96
  tools have not completed this process.
- Hash Generator: ten independent judges ran in parallel (the architect report
  was not returned — aborted; its coverage supplied by functional/security/
  edge findings plus the harness). Component rebuilt on the team standard
  (empty boot with em-dash placeholder — the demo "Hello, world!" default is
  gone, 150ms debounce settling rapid retypes on the latest input, 1,000,000
  char cap with disclosed note, crypto.subtle availability guard with a
  role=alert instead of a throw, Clear now resets results + re-disables copy
  instead of leaving stale hashes, results live region with aria-busy,
  per-algorithm copy aria-labels + Copy-all, honest hex-only SHA-1/256/384/512
  scope); shared CopyButton gained an ariaLabel prop for distinct accessible
  names; copy rewrote the fabricated MD5 + "multiple formats (hex/binary/
  base64)" claims and now points MD5/CRC users to Checksum Calculator,
  keywords dropped "md5 generator" and widened to sha384/sha512, JSON-LD
  tool-specific featureList added. 29 production Chrome scenarios passed
  (digest byte-exact check against known SHA-256 vectors, debounce race,
  copy-all/per-algo clipboard contents, clear-reset, empty state, caps,
  a11y roles) plus the other two Wave 1 tools and timestamp-converter
  re-runs green; production build passed (287 pages).
  Report: `audit/reports/hash-generator.md`.
- Markdown Preview: ten independent judges ran in parallel (functional and
  performance not returned — aborted; security not returned — connection
  reset; the critical XSS was independently runtime-verified by the architect
  and edge-case judges, both probes fired `xss_fired=1`). Component upgraded
  around a new allowlist sanitizer module
  (`src/features/markdown-preview/sanitize.ts`): a DOMParser allowlist
  (approx 50 tags, strict attribute allowlist, javascript:/vbscript:/data:
  URL stripping with data:image kept, disallowed tags unwrapped to inert text)
  sits between `marked` and the preview div, gated behind a mounted flag so
  SSR and first client render are identical (no hydration mismatch; DOMParser
  is client-only). marked v18 was probed in Node first: tables/task lists/
  strikethrough/autolinks work, footnotes render as a plain link (never
  claimed), raw HTML passes through (the sink now closed). Promised-but-missing
  features were actually implemented: drafts auto-save to localStorage
  (300ms debounce, restored on reload) and Copy HTML / Download .html export
  the sanitized output; the fires claims (synchronized scrolling, syntax
  highlighting, footnotes, "export with one click") were expelled from copy,
  FAQ explicitly discloses footnotes are not included, GFM support is
  described precisely (tables, task lists, strikethrough, autolinks, fenced
  code). Parse failures surface as role=alert with the last good output kept;
  useDeferredValue + 1,000,000 cap handle large docs; textarea/preview gained
  accessible names and aria-live. 30 production Chrome scenarios passed (XSS
  triads inert, task list checked state, table, autolink, strikethrough,
  sanitized Copy HTML, download filename, autosave-vs-reload restoration,
  Clear/Reset, a11y roles, honest footnotes disclosure on /tools/) plus Wave 1
  siblings and timestamp-converter re-runs green; production build passed
  (287 pages). Report: `audit/reports/markdown-preview.md`.
- HTML Minifier: ten independent judges ran in parallel (architect not
  returned — aborted; its corruption concerns were independently produced by
  six judges with identical examples). The O(n²) regex engine was replaced by
  a pure single-pass scanner (`src/features/html-minifier/html-minify.ts`,
  `minifyHtml`/`beautifyHtml`): raw-text regions (script/style/textarea/pre)
  pass through verbatim so a JS string containing `<!--` survives, quoted
  attribute values are never rewritten (`class="a  b"`, `title="1 > 2"`),
  inline/block whitespace rules keep exactly one space between inline elements
  while dropping inter-block runs, comments are removed linearly (the ReDoS
  backtracking regexes are gone), conditional comments (`<!--[if IE]>`)
  survive only when the new keep-conditional option is on, and pretty-print
  reindents without ever deep-indenting void `<br>`/`<img>`. normalizeTag also
  collapses stray spaces before `>` and `/>` — a late fix caught when the
  browser harness flagged `<div  class="a  b" >` → `<div class="a  b">`
  (16/16 Node unit cases green; 1MB perf 46ms/42ms vs ~8.2s before, a 160×
  win). The component gained the minify/pretty mode toggle (aria-pressed),
  byte-accurate savings line in a role=status region (TextEncoder counts),
  Open .html via a labelled file input, Copy/Download with mode-aware
  filenames, and Clear. Copy rewrote the fabricated "attribute surgery" claims
  (redundant-attribute removal, boolean shortening, optional-tag collapsing,
  10-40% reduction, drag-and-drop) into the honest whitespace+comments scope;
  keywords and a JSON-LD featureList override added. 34 production Chrome
  scenarios passed (pre/script/textarea verbatim, conditional keep/drop,
  inline spacing, `a > b`, beautify depth, byte stats, filename, guarded
  buttons, aria roles) plus Wave 1 siblings and timestamp-converter re-runs
  green; production build passed (287 pages). Report:
  `audit/reports/html-minifier.md`.
- UUID Generator: ten independent judges ran in parallel (all ten returned
  reports — the first perfect wave). Component rebuilt on the team standard:
  the `useState(() => generateUuid())` lazy initializer had been running
  crypto.randomUUID during SSR AND client hydration — React #418 (the classic
  hydration mismatch). Generation now boots on a client-only deferred effect
  (setTimeout callback, so the sync set-state-in-effect lint rule is respected);
  the crypto calls moved behind a capability guard (`getRandomValues` still
  works in insecure contexts, `randomUUID` does not, so a getRandomValues-based
  v4 fallback replaces the http-origin crash — a client-only role=alert tells
  users when neither is available). The stale-config trap is gone: slider and
  toggles re-render the list live via an explicit next-values handler, so the
  displayed batch always matches the current options (slider max corrected
  50→100 to match the promised range; floor 1). Copy truth is fixed: copy-all
  and per-row copy use the shared CopyButton (success-gated feedback +
  execCommand fallback + distinct `aria-label`s); a Clear button empties the
  list and both copy/Clear disable when empty; a `role=status` live region
  reports the generated count and active variants honestly ("5 UUIDs
  generated"; singular handled at 1). The phantom "Generate Batch" button and
  "batch up to 100 without saying how" wording are gone from copy; features,
  howTo (slider-first, re-roll, variants, copy, Clear) and FAQ were rewritten —
  the 122-random-bit wording replaces the 128-bit phrasing, and a new
  no-upload disclosure FAQ added. Keywords widened (no-dashes/uppercase/1-100
  terms) and a JSON-LD featureList override added; a11y: SliderField gained a
  useId-backed `label htmlFor` (was an unlabelled range — the Field component
  renders a `<p>`), CopyButton gained the shared focus-visible ring, and the
  per-row copy hit area/contrast parity landed. 58 production Chrome scenarios
  passed (hydration-zero, slider 1/100 live re-render, 100-row no-dupes,
  version/variant nibbles surviving 32-char strip, uppercase re-format,
  clipboards for copy-all and per-row, Clear disable states, Generate re-roll +
  refill, a11y roles, honest /tools/ copy) plus Wave 1 siblings and
  timestamp-converter re-runs green; production build passed (287 pages).
  Report: `audit/reports/uuid-generator.md`.
- Regex Tester: ten independent judges ran in parallel (one rate-limited on first
  attempt, completed on retry). The evaluation engine was hardened and the UI
  rebuilt. RegExp enumeration moved into a tested pure module
  (`src/features/regex-tester/regex-engine.ts`) with a 5000-match cap that is now
  DISCLOSED (amber "first 5,000 matches" notice + honest count) and a 400ms soft
  deadline for runaway match loops. Catastrophic backtracking can no longer
  freeze the tab unnoticed: a heuristic gates nested/repeated-quantifier and
  alternation-in-group patterns (e.g. (a+)+, (a|b)*) behind an amber warning with
  an explicit "Run anyway" button, so pathological patterns never auto-execute a
  user's browser (a Web Worker attempt was dropped — Turbopack's next build emits
  user worker assets as video/mp2t behind nosniff and resolves the URL to an
  un-hashed root path, so that precedent tool path is currently non-functional).
  Input is capped at 2,000,000 chars with a disclosed truncation notice (house
  StyledTextarea focus styling preserved). Capture groups no longer vanish: group
  identity is preserved (`$1 = a, year = 2024`, "∅" for non-participating groups)
  and named-group names are surfaced by a capture-order parser; zero-length
  matches render as explicit "∅ (empty match)" rows instead of invisible blanks.
  Flags became an accessible checkbox set (g, i, m, s, u, d, y) instead of a
  free-text field; a /…/ or /…/flags wrapper is auto-detected with a note; a
  needs-u hint fires for \p{…}/\x{…} without the u flag. A collapsed ~18-token
  quick-reference panel now exists (the old feature bullet was a lie), matched by
  copy rewrites: embedded CJK token purged from the long description, the false
  "slashes are added automatically" and "provided checkboxes" howTo steps
  corrected, relatedSlugs moved to text-cleaner/text-lines/word-counter/
  html-entities/checksum-calculator, and JSON-LD featureList is now tool-specific.
  A11y fixes: role=alert on the error and timeout banners, role=status live
  regions for the badge/truncation/limit notices, aria-labels on pattern and text
  inputs and each flag checkbox, table caption + scope=col, slate-400→slate-600
  contrast on the raised/* text, and an overflow-x-auto wrapper (min-w table) so
  long matches scroll inside the card instead of pushing the 375px page
  (the rolling site-header navigation overflow remains a tracked residual).
  Highlight marks are skipped for zero-length matches. 39 production Chrome
  scenarios passed (incl. group identity, named groups, non-participating groups,
  i/u flag behaviors, zero-length, invalid regex, slash wrapper, 5000 disclosure,
  catastrophic gate + run-anyway + recovery, 375px containment, a11y roles) plus
  json-formatter / word-counter / text-size-calculator re-runs green; production
  build passed (285 pages). Report: `audit/reports/regex-tester.md`.
- Residual checks: physical mobile/Safari/Firefox, manual screen readers, parser
  memory limits, and shared /verify proof wording. No universal audit guarantee.
- Existing changes to other tools are preserved but not counted as reviewed.

## Notes

- Agent count: 25 experts across tech, product, growth, business, ops, contrarian
- All agent outputs saved in conversation context (can be re-synthesized)
- The "keep everything free" decision is a strategic choice to validate product-market fit before monetizing
- The MIT license is a feature, not a bug — it builds developer trust
- The WASM engine is the long-term B2B product; the 123-tool website is the funnel

---

*This document is a living plan. Update it as each phase progresses.*
