# BrainCoder — Show HN Launch Kit

## 1. 2026 HN Best-Practices Summary

**Official Show HN rules (showhn.html):**
- Post must link to something people can try — no landing pages, waitlists, newsletters.
- You must be the maker and be present in the thread.
- Project must be non-trivial; "quickly-generated one-offs" get flagged.
- No self-praise, no marketing language, no emojis in titles.

**Title conventions (2026 consensus):**
- Format: `Show HN: <Product Name> – <specific factual description>`
- No superlatives ("best", "fastest"), no version numbers unless meaningful.
- Use "I built" over "We built" — it outperforms in HN data analysis.
- Parenthetical tech callouts help: "(written in Rust)", "(open source)".
- GitHub repo links perform ~3x better than domain-only links.

**Timing:**
- Weekdays, 9–11 AM Pacific / 12–2 PM Eastern is the consensus sweet spot.
- Some data suggests Sunday noon UTC has high front-page odds for niche tools (less competition), but weekday engagement velocity is higher.
- Post right when you can commit to 2–3 hours of live engagement.

**What works for free tools:**
- Open-source tools have a 13.9% "viral" (front-page) rate — one of the highest categories.
- Solo-founders now represent 52% of Show HN posts.
- Technical depth beats breadth: one strong story > 123 features listed.
- The `/verify` proof page and Rust/WASM story are your differentiators — lean into them.

**The 2026 "AI slop" zeitgeist — this is your tailwind:**
- Meta's Muse Image backlash (July 2026), Sora shutdown (March 2026), LinkedIn "AI slop" reporting button, Substack anti-AI detection tools — the backlash is real and documented.
- Users are tired of "AI wrapped in a landing page" and tools that phone home.
- BrainCoder's pitch — **zero upload, zero sign-up, zero backend** — is precisely the counter-narrative HN readers want right now.
- Do NOT position against AI directly. Just let the architecture speak: "everything runs in your browser."

**What underperforms:**
- Pure tool directories with no technical hook. You must lead with the Rust/WASM PDF redaction story or the `/verify` proof, not "123 tools."
- Marketing-speak gets instant downvotes. Write like a developer, not a marketer.
- Don't ask for upvotes. Don't share the post URL for upvotes. HN's ring-detection is excellent.

---

## 2. Candidate Titles (Ranked)

| # | Title | Angle | Why |
|---|-------|-------|-----|
| 1 | Show HN: BrainCoder – 123 developer tools that run entirely in your browser (Rust/WASM) | Breadth + tech | Concrete number, Rust mention, specific. Leads with what it is. |
| 2 | Show HN: I built 123 browser dev tools with a Rust/WASM core — files never leave your device | "I built" + privacy | Personal, leads with the privacy guarantee and Rust hook. |
| 3 | Show HN: Browser-based PDF redaction that actually removes content (Rust/WASM, no upload) | Technical deep-dive | Targets the strongest single feature. "Actually removes" is a provable claim. |
| 4 | Show HN: A privacy-first dev toolkit with true PDF redaction, built on Rust/WASM | Privacy + Rust | Clean, honest, uses Rust as the technical anchor. |
| 5 | Show HN: BrainCoder – PDF tools, image converters, JSON formatters and 120 more tools that run offline | Feature breadth | Lists enough to be interesting but not overwhelming. |
| 6 | Show HN: I built a dev tools suite where you can watch zero files leave your browser (/verify proof) | The proof page hook | Unique differentiator — challenges the reader. |
| 7 | Show HN: 123 free developer tools, zero backend, zero uploads — all Rust/WASM in the browser | Counter-AI-slop | Strong framing for the current zeitgeist. |
| 8 | Show HN: BrainCoder – open-source browser tools for PDFs, code, and images (Next.js + Rust/WASM) | Open source + stack | Mentions the full stack; "open source" label helps. |
| 9 | Show HN: PDF redaction that strips the content stream, not just a black box — built in Rust for the browser | Technical specificity | For the security-minded reader; the "not just a black box" line is compelling. |
| 10 | Show HN: A single-page app with 123 dev tools that never upload your files | Simplicity | Clean and simple but less distinctive. |

**Recommended title:**
> Show HN: I built 123 browser dev tools with a Rust/WASM core – files never leave your device

**Backup title:**
> Show HN: BrainCoder – 123 developer tools that run entirely in your browser (Rust/WASM)

---

## 3. Draft Show HN Post Body (~200 words)

```
I built BrainCoder (https://braincoder.sardar.dev) — a collection of 123+ free developer tools that run entirely in your browser. No upload, no sign-up, no backend.

The problem: every PDF tool, image converter, and code formatter online asks you to upload your files. For developers working with sensitive data, that's a non-starter.

So I built everything client-side. The PDF processing core is Rust compiled to WASM (built on the zpdf crate), with a transparent JS fallback for browsers that don't support it. Compression, merging, splitting, editing, protecting — and actual redaction. Not cosmetic black boxes — the content stream is physically excised from the PDF.

To prove it: open /verify (https://braincoder.sardar.dev/verify) and hash a file locally while watching the network tab. Zero outgoing requests.

Stack: Next.js 16, Rust/WASM, zero database, zero auth, zero billing. Everything is free.

It's early. The homepage loads fast, most tools work well, and I'm actively improving the Rust core.

What's the one tool you've always wanted that doesn't exist? I'd rather build what people actually need than guess.
```

**Rules for the author:** No self-praise. No "revolutionary" or "game-changing." No marketing language. Write like you're explaining this to a colleague at a meetup.

---

## 4. Launch Timing + Engagement Plan

**When to post:**
- **Best window:** Tuesday–Thursday, 9–11 AM Pacific (noon–2 PM Eastern).
- Avoid Friday afternoon (low velocity) and weekends (lower engagement on dev tools).
- If you miss the window, do NOT delete and re-post. Wait 2–3 days.

**First 2 hours (critical):**
- Post the submission, then paste the first comment within 2–5 minutes.
- Stay online. Respond to every comment within 15 minutes for the first 2 hours.
- Answer technical questions fully — "how does the WASM redaction work?" deserves a detailed reply.
- Never be defensive. "That's a fair point" is always an acceptable first sentence.
- If someone finds a bug, acknowledge it and link the GitHub issue tracker.

**Hours 2–3:**
- Continue replying. This is when front-page momentum builds or dies.
- Share the /verify proof page proactively if someone questions privacy claims.

**Hours 3–24:**
- Reply to every comment, even short ones.
- Collect feature requests and feedback into a notes file (see Follow-up Plan).
- Do NOT post the link a second time or in other subreddits.

**Responding to likely criticisms:**

| Criticism | Response approach |
|-----------|------------------|
| "Why not just use ilovepdf?" | "ilovepdf uploads your files to their servers. BrainCoder runs locally — nothing leaves your browser. For sensitive docs, that matters." |
| "How is this better than PDFgear?" | "PDFgear is a desktop app. BrainCoder is browser-based, zero install, works on any OS, and is fully open source." |
| "You don't have a backend — how is it maintained?" | "It's open source and deployed on Vercel. The WASM core is the product. Maintenance is adding tools and improving the Rust pipeline." |
| "How do I trust the redaction actually works?" | Link to /verify. Invite them to inspect the network tab. Mention the content-stream excision approach vs. cosmetic overlay. |
| "123 tools is too many — jack of all trades?" | "Fair concern. The core PDF tools are the strongest right now. I'd rather add one well than ship 100 half-baked ones." |
| "What's your business model?" | "No billing yet. Everything is free and open source. I'm building what I'd use." |

---

## 5. Pre-Launch Checklist

- [ ] `npm run build` passes with zero errors on `main`
- [ ] `npm run lint` passes clean (or known issues documented)
- [ ] Repo is pushed to `github.com/RajaSardar/BrainCoder` main branch
- [ ] Homepage loads in < 2 seconds on Vercel (check with Lighthouse)
- [ ] OG image / `<meta>` title renders correctly (test with hn.algolia.com preview)
- [ ] `/verify` page works — intercepts fetch/XHR, shows zero uploads
- [ ] At least 3 core tools tested end-to-end (PDF compress, PDF redact, JSON formatter)
- [ ] No placeholder text, lorem ipsum, or TODO comments in production code
- [ ] Typo pass on all user-facing strings (homepage, tool descriptions, error messages)
- [ ] GitHub repo README has a clear description, screenshot/GIF, and installation instructions
- [ ] Prepare 2–3 comment reply drafts (see table above)
- [ ] Have the HN post title and body copy-paste ready (no last-minute edits)

---

## 6. Follow-Up Plan

**Hours 4–24:**
- Reply to every comment. Prioritize technical questions and bug reports.
- Do NOT spam the thread with additional links. One link in the post body, one in the first comment is enough.
- Do NOT create a second account to upvote — that's a ban.

**Feedback collection:**
- Create a `PLAN.md` (or GitHub issue) to log feature requests from comments.
- Categorize: (a) PDF tools, (b) code tools, (c) image tools, (d) missing features, (e) bugs.
- The most-requested missing tool gets priority for the next release.

**Metrics to watch (24–72 hours):**
| Metric | Tool | What to look for |
|--------|------|-----------------|
| HN points/comments | hn.algolia.com | Front-page threshold is ~80–100+ points |
| GitHub stars | GitHub Insights | 500–2,000 stars in 24h is a strong Show HN result |
| Vercel analytics | Vercel dashboard | Traffic spike, bounce rate, top pages |
| Google Search Console | GSC | Impressions and clicks for branded terms |
| Reddit/Twitter mentions | Manual search | Secondary amplification |

**What NOT to do:**
- Do not post the same link twice — even in a different HN category.
- Do not create a second account or ask friends to upvote — HN detects this and you'll be banned.
- Do not paste the HN post URL in unrelated threads or social media asking for upvotes.
- Do not argue with dismissive comments — just thank them and move on.
- Do not add features or push commits in the first 24 hours just to "improve" for the thread — ship what you have.
