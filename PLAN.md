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
| Hosting | Vercel (static SSG) | braincoder.vercel.app |
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
| 4 | 5-8 more guides ("how to redact a pdf", "how to sign a pdf", etc.) | Guides rank for how-to queries + internal link to tools | High — growth agent | Not started |
| 5 | "Verify: 0 uploads" proof page | Shareable proof of the privacy moat — PR / HN material | Medium — growth agent | Not started |
| 6 | Rust/WASM technical deep-dive (dev.to post) | Builds authority + backlinks + GitHub stars | Medium — growth agent | Not started |
| 7 | Ship to Hacker News (Week 4-5) | Validation spike + initial backlink base | Medium — growth agent | Not started |
| 8 | Directory listings (alternativeTo, awesome-list PRs) | Durable indexable backlinks | Low — growth agent | Not started |

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

## Notes

- Agent count: 25 experts across tech, product, growth, business, ops, contrarian
- All agent outputs saved in conversation context (can be re-synthesized)
- The "keep everything free" decision is a strategic choice to validate product-market fit before monetizing
- The MIT license is a feature, not a bug — it builds developer trust
- The WASM engine is the long-term B2B product; the 123-tool website is the funnel

---

*This document is a living plan. Update it as each phase progresses.*
