# Marketing & GTM Assessment — Overlay Bets

**Author:** Basher (Marketing)  
**Date:** 2026-07-17  
**Scope:** Brand, positioning, content strategy, cold-start plan, GTM readiness

---

## 1. Brand & Positioning — ✅ Strong

**"Overlay Bets"** is an excellent name. It self-selects the target audience: serious bettors who know what an overlay is. Casuals bounce; sharps lean in. The tagline *"Find the overlay. Beat the close."* is tight and encodes the thesis (CLV > screenshots).

**Differentiator is razor-sharp:** *"You cannot fake, edit, or delete a losing pick."* This is a single-sentence moat that every page reinforces — README, about, how-it-works, ToS footer. Competitors (Tipstrr, Blogabet, Pyckio) all let tipsters self-report or selectively hide losing records. The hash-lock + CLV ranking is genuinely novel.

**Watch-out:** "Overlay" is a saturated term in CSS/UI contexts — SEO for the brand name will be noisy. Domain/handle availability (`docs/NAMING.md` TODOs) is still unresolved.

---

## 2. Landing Page — ✅ Good bones, 🟡 needs conversion work

**What works** (`apps/web/app/page.tsx`):
- Hero headline *"Hunt real edge. Not screenshots."* is punchy.
- Live leaderboard pull (top 5 verified tipsters) is instant social proof.
- "How it works" 4-step grid is clear and scannable.
- Two CTAs: "Browse tipsters" (primary) + "Today's free tips" (secondary).

**What's missing:**
- **No email capture on the homepage.** The newsletter lives on `/newsletter` only. A hero-area email signup or exit-intent popup would capture top-funnel visitors.
- **No testimonials or social proof quotes.** The leaderboard is data-proof but there's no human voice.
- **No explainer video or visual demo.** The hash-lock concept is powerful but abstract — a 30-second animation would convert non-sharps.
- **No "For Tipsters" hero CTA.** The only tipster CTA is a muted footer link. Tipsters are the supply side — they need a louder call.
- **No OG/social meta tags beyond basics** (`layout.tsx` has `title` + `description` only). No `og:image`, Twitter card, or JSON-LD structured data → poor link previews when shared.

---

## 3. Content Strategy — ✅ Infrastructure built, 🔴 no content yet

The **architecture** is solid:
- **Content hub** (`/content`) — evergreen guides (CLV, bankroll, EV). Schema: `Article` model with `category: content`, SEO fields, slugs, tags, reading time.
- **News hub** (`/news`) — timely betting/sport news. Schema: `Article` with `category: news`.
- **Free Daily Tips** (`/tips`) — curated daily free picks with date navigation, date picker, ISR.
- **Newsletter** (`/newsletter`) — `NewsletterSubscriber` model (email, status), form with API endpoint.
- **Blog detail** (`/blog/[slug]`) — article renderer.
- **Sitemap** (`sitemap.ts`) — dynamically includes articles + tip dates. `robots.ts` is correctly configured.
- **Betting Calculator** (`/tools/odds-calculator`) — SEO magnet tool.

**The problem:** All hubs currently show "No guides published yet" / "No news published yet." The DB models exist but zero content has been published. **This is the single biggest GTM gap.** The SEO engine is built but running empty.

**Backlog items:** `OB-071` (blog authoring workflow), `OB-028` (admin content moderation UI), `OB-072` (marketing/landing pages), `OB-157` (weekly email newsletter "Picks of the Week").

---

## 4. Cold-Start Plan — 🟡 Strategy exists, execution not started

The spec (`SPEC.md §9`) explicitly calls out the cold-start risk and the mitigation: *"Free public leaderboard where tipsters build verified records before charging."* The Free Daily Tips hub is the execution of this.

**What's in place:**
- Free tips page with daily date navigation
- Public leaderboard (no paywall)
- Follow button (track tipsters for free)

**What's missing:**
- No **tipster recruitment** funnel (landing page, outreach templates, onboarding email sequence)
- No **community channel** — no Discord, no Telegram, no X/Twitter presence visible in the product
- No **referral program** — `Referral` model doesn't exist in `schema.prisma`
- No **influencer/affiliate strategy** documented
- WhatsApp chat widget exists (`WhatsAppFloat.tsx`) but that's support, not community

---

## 5. Growth Infrastructure — 🟡 Partial

| Signal | Status |
|---|---|
| Newsletter signup | ✅ Built (`/newsletter` + `NewsletterSubscriber` model) |
| Free tips (SEO bait) | ✅ Built (daily tips, date-indexed, sitemap entries) |
| Follow / bookmark tipsters | ✅ Built (`Follow` model + `FollowButton`) |
| Odds calculator (SEO tool) | ✅ Built (`/tools/odds-calculator`) |
| Sitemap + robots.txt | ✅ Dynamic, properly configured |
| Cookie consent | ✅ Built (`CookieConsent.tsx`) |
| Legal pages (ToS, Privacy, Resp. Gambling) | ✅ Complete with correct disclaimers |
| Email notifications + digests | ✅ Infrastructure (`NotificationPreference`, Resend) |
| Referral program | ❌ Not built, not modeled |
| Social sharing / OG tags | ❌ Missing `og:image`, Twitter cards, JSON-LD |
| Analytics (GA, Plausible, etc.) | ❌ No analytics integration visible |
| A/B testing | ❌ Not in place |
| Push notifications | 🟡 Planned, not built |
| Email capture on homepage | ❌ Only on `/newsletter` |

---

## 6. Competitive Landscape

| Competitor | Model | Overlay Bets differentiator |
|---|---|---|
| **Tipstrr** | Tipster marketplace, self-reported results | We auto-settle from API; hash-lock prevents edits |
| **Blogabet** | Free tipster tracking, manual entry | We enforce pre-kick-off lock; CLV metric exposes skill vs luck |
| **Pyckio** | Premium verified tipsters | We're transparent and public; they're opaque on methodology |
| **Bettin.gs / OLBG** | Community picks | We verify at the protocol level, not just socially |
| **Cappers / Twitter tipsters** | Screenshot-based proof | Our entire thesis is "screenshots are worthless" |

**Key advantage:** No competitor combines (a) cryptographic pick-locking, (b) automated settlement, and (c) CLV-based ranking. This is a defensible moat if executed well.

---

## 7. Target Market

**Ideal first users:**
- **Tipsters:** Semi-professional handicappers on Twitter/X who are tired of "prove it" skepticism. They want a verifiable track record. Sports: **football (soccer)** and **basketball (NBA/Euro)** — highest liquidity, best closing-line data.
- **Bettors:** Sharp/semi-sharp bettors in **UK, Nigeria, Kenya, South Africa, Europe** — markets where tipping culture is strong and mobile money/crypto payments open access.

**Geography:** UK first (regulated, familiar with tipster culture, GBP via Stripe), then West Africa (massive sports betting market, mobile money via Flutterwave), then continental Europe.

---

## 8. GTM Readiness — What's In vs Missing

| Category | In place | Missing / Blocked |
|---|---|---|
| **Product** | Core loop (pick → lock → settle → rank → subscribe → pay) | Auth hardening (OB-001..004), identity verification |
| **Content** | Blog/news/tips architecture | Zero published articles, no authoring UI (OB-071) |
| **SEO** | Sitemap, robots, canonical tags, meta descriptions | No OG images, no JSON-LD, no analytics |
| **Newsletter** | Signup form + subscriber model | No email sequences, no "Picks of the Week" (OB-157) |
| **Legal** | ToS, Privacy, Responsible Gambling | GDPR/cookie policy expansion (OB-155) |
| **Payments** | Stripe + crypto + mobile money | Production API keys + validation (OB-045) |
| **Social** | WhatsApp chat widget | No X/Twitter, Discord, Telegram presence |
| **Growth** | Free tips, follow button, calculator | No referral program, no analytics, no A/B testing |

---

## 9. Top Marketing Risks

1. **Empty shelves at launch.** No content, no published tips, no tipsters with 50+ picks = visitors land on a ghost town.
2. **Two-sided cold start.** Need tipsters AND bettors simultaneously.
3. **Brand SEO conflict.** "Overlay" is a CSS/UI term — organic search will compete with unrelated results.
4. **No analytics = flying blind.** Can't measure conversion, bounce rate, funnel drop-off.
5. **Regulatory surprise.** "Paid tipping" legality varies by jurisdiction.
6. **Payment processor risk.** Stripe could flag the account as gambling-adjacent.

---

## 10. Recommended Next Priorities (Marketing/Growth)

1. **🔴 Publish seed content (NOW).** Write and publish 5–10 evergreen articles: "What is CLV?", "How to spot a fake tipster", "Why win rate is a lie", "Bankroll 101". Requires OB-071 or direct DB seeding.

2. **🔴 Add OG image + social meta tags.** Every page needs `og:image`, `og:title`, Twitter card tags.

3. **🔴 Integrate analytics.** Add Plausible or GA4 before any marketing spend.

4. **🟡 Homepage email capture.** Add inline newsletter signup to the homepage hero section and footer.

5. **🟡 Recruit 5–10 seed tipsters.** Identify sharp cappers on X/Twitter with existing followings.

6. **🟡 Build a "For Tipsters" landing page** (OB-072). Separate CTA focused on the portable, provable reputation value prop.

7. **🟡 Launch X/Twitter + Discord.** Start building community before the product is "done."

8. **🟡 Weekly "Picks of the Week" email** (OB-157). Drives repeat visits, builds habit.

9. **🟢 JSON-LD structured data** for articles, FAQ, and organization schema.

10. **🟢 Referral program model.** Simple "invite a friend, get a month free" loop.

**Bottom line:** The product architecture is remarkably complete — the content infrastructure is all built. But the marketing surfaces are **empty**. The #1 priority before any launch activity is filling the shelves: seed content, seed tipsters, and basic measurement.
