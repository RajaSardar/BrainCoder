# BrainCoder — Directory & Awesome-List Submission Plan

**Product:** BrainCoder (https://braincoder.vercel.app · repo https://github.com/RajaSardar/BrainCoder) — 123+ free, privacy-first browser tools in one Next.js 16 app. Every tool runs 100% in the browser; files never leave the device. No upload, no sign-up, no account. Rust/WASM PDF core (`zpdf` crate) with transparent JS fallback. MIT-licensed, open source. Proof page at /verify.
**Researched:** Sep 2026 · **Goal:** honest ranking of where a pre-launch, zero-traffic site should spend an hour.

---

## 0. Submission kit (make once, reuse everywhere)

- Logo (128×128) + 3 screenshots (homepage, a PDF tool, /verify proof page).
- 1-line: "123+ free, privacy-first browser tools — PDF, images, JSON, SQL, dev utilities. Files never leave your device."
- 3-paragraph description. Category angles: **PDF tools / developer tools / privacy tools / no-signup tools / open-source**.
- URL to paste everywhere: **https://braincoder.vercel.app** + repo link.
- ⚠️ **Domain warning:** several directories reject free subdomains. SaaSHub *explicitly* rejects `*.vercel.app` (their example is literally that). Until a custom domain exists, treat SaaSHub as blocked; verify case-by-case for the rest.

---

## 1. Directory table

| # | Name | URL | Signup | Cost | Category tag | Priority | Why / honest note |
|---|------|-----|--------|------|--------------|----------|-------------------|
| 1 | alternativeTo | [/submit](https://alternativeto.net/) | Yes (email verify; GitHub/Apple/email — Google disabled) | Free ($5 priority review optional) | software-alternatives directory | **HIGH** | Biggest app-alternative directory, dofollow link. Free queue = months; $5 moves it to 1–2 days. **Risk:** its decline list calls out "collections of online tools" — submit as *one app* (like PDF24), not a directory. |
| 2 | OpenAlternative | [openalternative.co/submit](https://openalternative.co/submit) | Yes (magic link/Google/GitHub) | Free | open-source alternatives directory | **HIGH** | MIT repo is a perfect fit. Must name the proprietary products it replaces (iLovePDF/Smallpdf/PDF24). Approval 2–4 weeks. Nofollow link, but 12k+ subscriber OSS audience. |
| 3 | linkmap.in — PDF Tools | [linkmap.in/browse/pdf-tools](https://linkmap.in/browse/pdf-tools) | No (manual/contact) | Free | niche PDF-tools directory | **HIGH** | Human-reviewed, "no affiliates, no trackers", explicitly tags **Client-Side** PDF tools (already lists BentoPDF, PDFCraft). Exactly our audience. Small site = actually reachable. |
| 4 | TechLogHub | [techloghub.com/submit](https://techloghub.com/submit) | Yes (email verify) | Free | developer-tools directory | **MEDIUM** | Free permanent listing, manual review 24–48h, accepts open-source + dev tools, sitemap-indexed. New/small → real visibility while it grows. |
| 5 | IndieStack | [indiestack.ai/submit](https://indiestack.ai/submit) | No to submit (GitHub to manage) | Free | AI-agent-facing dev-tools directory | **MEDIUM** | Free, ~24h review, wants maintained + docs + free/OSS tier — we qualify. Future-proof (MCP/AI-agent discovery) but young. |
| 6 | LetsLaunch | [letslaunch.today](https://letslaunch.today/developer-tools-directory) | Yes | Free | dev-tools launch board | **MEDIUM** | Free dofollow once you install their badge. "5 upvotes/24h" permanence rule currently paused. Dev-focused board. |
| 7 | listin.gg | [listin.gg/submit](https://listin.gg/submit) | Yes | Free basic | curated tools catalog (1,200+ tools) | **MEDIUM** | Human-reviewed ≤48h, permanent dofollow. 12k monthly visitors; small but free. |
| 8 | Startup Fame | [startupfa.me](https://startupfa.me) | Yes | Free ($15–30 to pick launch day) | indie-hacker launchpad | **MEDIUM** | DR83 dofollow, do-follow earlier installs. Do **not** run first — its upvote game needs distribution, which we only have post-HN. |
| 9 | dev.to topic/community | [dev.to/t/opensource](https://dev.to/t/opensource) | Yes | Free | community post / topic page | **MEDIUM** | Not a directory — a tagged "showdev/build-in-public" post is the listing-equivalent. Run in Wave 2 to amplify the same copy. |
| 10 | SaaSHub | [saashub.com/submit](https://www.saashub.com/submit/) | Yes (email/GitHub) | Free ($99/mo featured, optional) | software comparisons | **LOW (blocked)** | **Explicitly rejects free subdomains** — our `*.vercel.app` URL is auto-rejected. Skip until custom domain. Great alternatives-page traffic after that. |
| 11 | Snapfor | [snapfor.com](https://snapfor.com) | Yes | Free | dev/design community bookmarking | **LOW** | Small reach; nothing authoritative found in 2026 on its current submit flow — verify before investing. |
| 12 | free-for.dev | [github.com/ripienaar/free-for-dev](https://github.com/ripienaar/free-for-dev) | PR (GitHub) | Free | "free stuff" mega-list (137k★) | **LOW** | Format is free *tiers of hosting/DB/APIs* for builders, not end-user tool websites. A PR here is a stretch and noisy. |
| 13 | Tool Finder | [toolfinder.co/add-new-tool](https://toolfinder.net/add-new-tool) | Yes | **Paid** (150€ one-time; $29 on .com mirror) | productivity-tools catalog | **LOW** | Paid listing; zero-traffic pre-launch doesn't justify it. Revisit post-launch if budget allows. |
| 14 | G2 / Capterra / GetApp | g2.com · capterra.com · getapp.com | Yes | Free listing | enterprise review platforms | **LOW** | Expect existing users/reviews + released product; approval is days-weeks and ROI at zero traffic is nil. |

---

## 2. Awesome-list PR plan

| List | Section/file | Maintained? | Priority | Ready-to-paste one-liner |
|------|-------------|-------------|----------|--------------------------|
| [mcuking/Awesome-WebAssembly-Applications](https://github.com/mcuking/Awesome-WebAssembly-Applications) | Readme → `Inside the browser` → **`Online Productive Tools`** | ✅ Active (pushed 2026-09-11); PRs merged regularly | **HIGH** | `- [[BrainCoder](https://braincoder.vercel.app)] 123+ free privacy-first browser tools — PDF compress/merge/split/redact, images, JSON/SQL formatters — on a Rust/WASM (zpdf) core; files never leave the device.` |
| [pluja/awesome-privacy](https://github.com/pluja/awesome-privacy) | Readme → **`## Office`** | ✅ Very active (19.7k★, pushed 2026-07); large, curated, PR-friendly | **HIGH** | `- [BrainCoder](https://braincoder.vercel.app) - 123+ free, open source (MIT), privacy-first browser tools — PDF, image, dev & office utilities, all processed locally with zero uploads.` |
| [alexanderop/awesome-local-first](https://github.com/alexanderop/awesome-local-first) | Readme → `Real-World Examples` → **`Example Applications`** | ✅ Active (pushed 2026-08); small but responsive | **MEDIUM** | `- [BrainCoder](https://braincoder.vercel.app) – 123+ browser-based PDF/image/dev tools that run entirely on-device; a free, MIT, local-first toolbox with a live zero-upload proof page.` |
| [mbasso/awesome-wasm](https://github.com/mbasso/awesome-wasm) | Readme → `## Projects` → **`### Others`** | ⚠️ Stale (last push 2024-11) — PR may sit | **LOW/MED** | `- [BrainCoder](https://braincoder.vercel.app) - 123+ privacy-first browser tools powered by a Rust/Wasm PDF engine.` |
| [awesome-selfhosted/awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) | `## Document Management` (via awesome-selfhosted-data) | ✅ Extremely active (319k★); strict review | **MEDIUM — flag** | ⚠️ **Requires self-hostable free software with source.** BrainCoder qualifies (MIT + Next.js repo you can deploy), and client-side PDF toolkits have precedent (BentoPDF is listed here). But they're strict — ship a Dockerfile/self-host note or it'll be declined. Entry line mirrors BentoPDF's: `- [BrainCoder](url) - Privacy-first client-side PDF and dev toolkit; processes files directly in the browser.` |
| [zdayang/awesome-privacy-web-tools](https://github.com/zdayang/awesome-privacy-web-tools) | Readme → `🛠 Developer Utilities` / `📄 Text & Content` | ⚠️ Alive but **0★**, self-promotional | **LOW** | `- [BrainCoder](https://braincoder.vercel.app) - All-in-one privacy suite: 123+ browser tools (PDF, JSON, hash, QR, converters) that never leave your device.` |

Notes:
- We have **no extension** → skip all "awesome browser-extension" lists, as planned.
- awesome-selfhosted also runs non-free/unofficial pages and checks **source control + demo** — have both the repo and /verify ready.
- Order: mcuking + pluja first (full thematic fit), local-first same week, the rest opportunistically.

---

## 3. alternativeTo submission copy

**Mechanics (verified, Sep 2026):** account + verified email (GitHub/Apple/email — Google signup disabled) → "Suggest new application" at `alternativeto.net/manage-item/`. Fields: name, short + full description, pricing (**Free**, + **Open Source** + source link), platforms (**Online**), tags, icon (128×128+), screenshots. Free queue = months; $5 priority = 1–2 days. **Decline risk:** "collections of online tools" are on their decline list — position as a single app ("multi-tool PDF & dev suite"), file counts like PDF24/TinyWow.

**Full product description (~145 words):**

> BrainCoder is a free, open-source (MIT) suite of 123+ browser-based developer and office tools in one app: PDF compress, merge, split, edit, **true redaction**, password-protect; image tools; JSON/SQL/XML formatters; regex tester; JWT decoder; crypto & hash tools; password, QR and UUID generators; Word/Excel/PPT converters; CSV↔JSON; and an SQLite viewer.
>
> Every tool runs 100% in your browser via WebAssembly (heavy PDF work uses a Rust core, `zpdf`, with a transparent JS fallback) — **your files never leave your device**. No upload, no sign-up, no account, no daily limits. Privacy is verifiable: the app ships a live proof page at /verify that shows zero outbound network activity while tools run, and the entire codebase is open source on GitHub.
>
> 100% free, no ads-file-limit games. Use it where privacy matters most: tax documents, contracts, medical records, proprietary configs, and code snippets. No registration, no trace.

**5 tags:** `PDF`, `Privacy`, `PDF Tools`, `Developer Tools`, `File Converters`

**Suggested alternatives on the listing (real, widely known):** iLovePDF (alternativeto.net/software/ilovepdf), Smallpdf, PDF24 Tools, Sejda, TinyWow, devtoolbox.

**Alternative-type:** alternative to cloud PDF suites that upload your files (**iLovePDF, Smallpdf, PDF24, Sejda**) and to developer toolkits (**devtoolbox, 12ft-style converters**).

**Visitor-suggestion version (a user "suggested alternative" to a competitor):**

> You upload PDFs to someone else's server just to merge or compress them. BrainCoder (https://braincoder.vercel.app) runs 123+ PDF, image, JSON, SQL and dev tools entirely in your browser — nothing is uploaded, no account, MIT open source, with a live zero-upload proof at /verify.

**10-word tagline:** "123+ privacy-first browser tools. Zero uploads. Zero sign-up. MIT open source."

---

## 4. Product Hunt — deferred (not now)

PH is a **launch event, not a directory** — it needs first-day momentum we don't have pre-HN. Per the growth plan, HN ships in Week 4–5; **PH only makes sense after HN distribution exists**. Launching PH pre-HN means 24h of quiet and a wasted slot.

When it's time, a PH launch needs:
- Maker profile (avatar, bio) + claimed product page (not a team-draft link).
- 5–8 gallery images: homepage, a real PDF redaction flow, one dev tool, and the /verify proof page.
- Launch Tuesday 00:01 PST, announced a week out.
- First-day comment strategy: be in thread 0–60 min for every question; 3 seeded, honest beta-user comments; no upvote-begging.

**Tagline candidates:**
1. "123+ free, privacy-first browser tools — PDF, images, JSON, SQL. Files never leave your device."
2. "The all-in-one toolbox that runs entirely in your browser — zero uploads, zero accounts, zero traces."
3. "Stop uploading docs to unknown servers. 123+ dev & office tools, 100% on-device, MIT open source."

---

## 5. Run order

**Prep (before any submission):** kit from §0 + optionally a custom domain decision (unblocks SaaSHub).

**Wave 1 — directories (forms, no dependency on traffic):**
1. alternativeTo (HIGH, pay the $5 to beat the months-long queue)
2. OpenAlternative (HIGH)
3. linkmap.in (HIGH — manual/contact template below)
4. TechLogHub, IndieStack, LetsLaunch, listin.gg (MEDIUM, one afternoon)

**Wave 2 — awesome PRs + community (same week):**
5. mcuking Awesome-WebAssembly-Applications (HIGH)
6. pluja/awesome-privacy (HIGH)
7. alexanderop/awesome-local-first (MEDIUM)
8. dev.to tagged post (amplify ~the alternativeTo copy)

**Wave 3 — post-HN (Week 4–5+):**
9. SaaSHub — only after a custom domain exists.
10. Startup Fame, timed to ride HN attention.
11. Skip: Tool Finder (paid), free-for.dev (wrong format), G2/Capterra (no user base yet).

**Never:** pay for listing placements; submit to SaaSHub with the `vercel.app` URL.

### Ready-to-paste intro messages

**(a) Directory needing manual approval (linkmap.in / Snapfor-style contact):**

> **Subject:** Add BrainCoder — 123+ client-side, no-upload browser tools
>
> Hi team, I run BrainCoder (https://braincoder.vercel.app, repo https://github.com/RajaSardar/BrainCoder) — a free, MIT-licensed suite of 123+ browser-based PDF/image/dev-office tools (compress, merge, split, true redaction, converters, formatters, generators, SQLite viewer). Every tool runs 100% locally via WASM; files never leave the device, and we publish proof at /verify. I noticed you flag "client-side" tools and would love to be listed. Happy to share a description, logo, or screenshots. Thanks!

**(b) Awesome-list PR description (mcuking, ready to paste into the PR body):**

> **Add BrainCoder: 123+ privacy-first browser tools (Rust/WASM PDF engine)**
>
> BrainCoder (https://braincoder.vercel.app) is a free, MIT-licensed suite of 123+ browser-based developer and office tools: PDF compress/merge/split/redact/protect (Rust/WASM core on the `zpdf` crate with transparent JS fallback), image tools, JSON/SQL/XML formatters, regex tester, JWT decoder, crypto/hash tools, generators, and converters. All processing is client-side — files never leave the device (proof page at /verify). Fits the "Online Productive Tools" section: a productive tool your readers can use with zero setup. Source: https://github.com/RajaSardar/BrainCoder

**(c) alternativeTo submission (paste-ready description for the form):**

> Use §3 "Full product description". Short field: *"123+ free, privacy-first browser tools — PDF, images, JSON/SQL, dev utilities. Files never leave your device; MIT open source."*
> License: **Free** + **Open Source** (link repo). Platform: **Online**. Tag: PDF / Privacy / PDF Tools / Developer Tools / File Converters (choose 5). Alternatives added on listing: iLovePDF, Smallpdf, PDF24, Sejda, TinyWow, devtoolbox.

---

## 6. Tracking table

| Site | URL | Account used | Submitted (date) | Status (pending/live/declined) | Traffic noted (later) |
|------|-----|--------------|------------------|-------------------------------|----------------------|
| alternativeTo | alternativeto.net | | | | |
| OpenAlternative | openalternative.co | | | | |
| linkmap.in | linkmap.in/browse/pdf-tools | | | | |
| TechLogHub | techloghub.com | | | | |
| IndieStack | indiestack.ai | | | | |
| LetsLaunch | letslaunch.today | | | | |
| listin.gg | listin.gg | | | | |
| Startup Fame | startupfa.me | | | | |
| dev.to topic | dev.to/t/opensource | | | | |
| SaaSHub (blocked → custom domain) | saashub.com | | | | |
| Snapfor | snapfor.com | | | | |
| free-for.dev (likely skip) | github.com/ripienaar/free-for-dev | | | | |
| Tool Finder (paid — likely skip) | toolfinder.co | | | | |
| G2/Capterra/GetApp (likely skip) | g2.com | | | | |
| mcuking AWAA PR | github.com/mcuking/Awesome-WebAssembly-Applications | | | | |
| pluja/awesome-privacy PR | github.com/pluja/awesome-privacy | | | | |
| awesome-local-first PR | github.com/alexanderop/awesome-local-first | | | | |
| mbasso/awesome-wasm PR | github.com/mbasso/awesome-wasm | | | | |
| awesome-selfhosted PR (needs Docker/self-host) | github.com/awesome-selfhosted/awesome-selfhosted | | | | |
| zdayang/awesome-privacy-web-tools PR | github.com/zdayang/awesome-privacy-web-tools | | | | |
| Product Hunt (deferred, post-HN) | producthunt.com | | | | |

**Recheck cadence:** status review at 2 weeks and 4 weeks post-submission; update descriptions/screenshots every ~6 months on anything that goes live.