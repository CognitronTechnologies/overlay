# Product Assessment — Overlay Bets

**Author:** Rusty (Product)  
**Date:** 2026-07-17  
**Scope:** Full product review — tipster/bettor journeys, feature inventory, risks, priorities

---

## 1. Product Summary

Overlay Bets is a **verified sports tipster marketplace** where the moat is **trust**. Every pick is SHA-256 hashed and timestamped before kickoff, then auto-settled from a results API — so no tipster can fake, edit, or delete a loss. Tipsters are ranked by **CLV (Closing Line Value)** and verified yield, not screenshots. Bettors subscribe monthly; the platform takes 20–30%. You sell picks, data, and tools — you take no bets, which sidesteps gambling licensing.

The walking skeleton is **fully built** end-to-end (Phases 0–3 complete). You're in Phase 4: hardening for production. There's a 50+ issue backlog (`PROD-READINESS-BACKLOG.md`) remaining.

---

## 2. Tipster Journey (current state)

| Step | Status | Where |
|---|---|---|
| **Signup** | ✅ Built | `/signup` → Supabase Auth |
| **Choose username** | ✅ Built | `/choose-username` (UsernameGate component gates it) |
| **Onboarding wizard** | ✅ Built (rich multi-step) | `/onboarding` — bio, sports, pricing, billing interval, contact, Stripe Connect, identity verification, social links, payout destination |
| **Profile editing** | ✅ Built | `/dashboard/profile` |
| **Post picks** | ✅ Built | `/dashboard` — event search, market/selection, odds, stake, note, lock |
| **Pick settlement** | ✅ Built | Auto via settlement worker (grading, CLV, stats recompute) |
| **View performance** | ✅ Built | `PerformanceDashboard.tsx` component (ROI, yield, CLV, streaks, drawdown) |
| **Earnings & payouts** | ✅ Built | `/earnings` — projected net, fee, subscriber count, payout history, payout destination settings (Stripe/crypto/mobile money) |
| **Avatar** | ✅ Built | `AvatarPicker` on `/account` |
| **Notifications prefs** | ✅ Built | Account page (email/push/digest frequency) |

**Gaps:**
- **OB-020:** Onboarding wizard doesn't gate publishing until all required steps complete (hardening needed).
- **OB-022:** Pick submission UX needs market-specific inputs, odds format toggle, confirmation modal.
- **OB-023:** Performance dashboard exists as a component but charts need polish (time-series over-time).
- **OB-040/041:** Stripe Connect onboarding and real payout transfers are still **stubbed** — tipsters can't actually get paid yet. **This is the #1 tipster-side blocker.**
- **OB-035:** DB-level pick immutability is app-layer only — a direct SQL update could alter picks.
- **OB-153:** No "rising tipster" graduated gating — new tipsters can't build a free public track record before charging.

---

## 3. Bettor Journey (current state)

| Step | Status | Where |
|---|---|---|
| **Discover tipsters** | ✅ Built | `/tipsters` — filter by sport, max price, min sample; sort by yield/CLV/win rate; paginated |
| **Homepage leaderboard** | ✅ Built | `/` — top 5 verified tipsters |
| **Tipster profiles** | ✅ Built | `/tipsters/[id]` — stats, settled picks, subscribe CTA |
| **Search** | ✅ Built | `/search` — cross-entity search |
| **Follow (free)** | ✅ Built | FollowButton on marketplace and profiles |
| **Subscribe** | ✅ Built (skeleton) | `/subscribe/[tipsterId]` → Stripe checkout + success page |
| **My feed (live picks)** | ✅ Built | `/feed` — aggregated live/settled picks from subscriptions, filterable by tipster/status/outcome, polls every 30s |
| **Manage subscriptions** | ✅ Built | `/account/subscriptions` + portal link |
| **Free daily tips** | ✅ Built | `/tips` — public daily tips with date picker navigation |
| **Blog / content** | ✅ Built | `/blog`, `/content`, `/news` — articles with categories |
| **Odds calculator** | ✅ Built | `/tools/odds-calculator` — converter + returns calculator |
| **Newsletter** | ✅ Built | `/newsletter` — email capture + opt-in |
| **Account** | ✅ Built | `/account` — avatar, username, notification prefs |
| **Legal** | ✅ Built (skeleton) | `/legal/terms`, `/legal/privacy`, `/legal/responsible-gambling` |
| **Support** | ✅ Built | `/support` — feedback form |
| **About / How it works** | ✅ Built | `/about`, `/how-it-works` |

**Gaps:**
- **OB-060/061:** Stripe subscription integration isn't production-complete — webhook lifecycle (invoice.payment_failed, subscription.deleted) and signature verification are pending. **Bettors can't reliably subscribe yet.**
- **OB-011:** Tipster profile needs paywall preview polish — clear "subscribe to see live picks" with hash/integrity explainer.
- **OB-013:** Subscription management UI needs cancel/resume via Stripe billing portal (OB-063).
- **OB-001:** JWT stored in localStorage — XSS-vulnerable. Auth security is inadequate for a payment platform.
- **OB-010:** Marketplace needs better discovery UX (currently functional but raw).
- **OB-132:** Pick delivery is polling (30s) — no realtime WebSocket/SSE.

---

## 4. Feature Inventory

### ✅ Built

| Feature | Tipster | Bettor | Admin |
|---|---|---|---|
| Auth (Supabase) | ✅ | ✅ | ✅ |
| Onboarding wizard | ✅ | — | — |
| Pick submit + hash lock | ✅ | — | — |
| Settlement + CLV | ✅ (auto) | — | — |
| Stats engine (ROI, yield, CLV, drawdown, streak) | ✅ | — | — |
| Leaderboard + marketplace | — | ✅ | — |
| Tipster profiles | ✅ (edit) | ✅ (view) | — |
| Follow (free) | — | ✅ | — |
| Subscriptions (checkout flow) | — | ✅ | — |
| Feed (live picks) | — | ✅ | — |
| Earnings dashboard | ✅ | — | — |
| Payout settings (3 rails) | ✅ | — | — |
| Free daily tips | — | ✅ | ✅ (admin manages) |
| Blog/articles | — | ✅ | ✅ (API) |
| Notifications + preferences | ✅ | ✅ | — |
| Newsletter capture | — | ✅ | — |
| GDPR export/erasure | ✅ | ✅ | — |
| Multi-currency FX | — | ✅ | — |
| Odds calculator | — | ✅ | — |
| Search | — | ✅ | — |
| Admin API (dashboard, users, audit) | — | — | ✅ (API only) |
| Admin pages (scaffold) | — | — | ✅ (partial UI) |

### 🔴 Not built / incomplete (launch-blocking)

| Item | Issue | Why it blocks |
|---|---|---|
| Stripe webhook lifecycle | OB-060/061 | Subscriptions break silently without proper webhook handling |
| Stripe Connect real payouts | OB-040/041 | Tipsters can't get paid |
| JWT → httpOnly cookies | OB-001 | XSS on a payment platform is a dealbreaker |
| Rate limiting (auth + picks) | OB-007/080 | Credential stuffing, abuse |
| DB-level pick immutability | OB-035 | Core trust claim is app-layer only |
| Real sports-data vendor | OB-045/046 | Settlement runs on mock/test data |
| Secrets hardening | OB-082 | Default `change-me` secrets in code |
| Error tracking (Sentry) | OB-090 | Flying blind in prod |
| Deployment (API + Web) | OB-100/101/102 | Not deployed yet |
| Settlement integration tests | OB-110/112 | Can't verify settlement correctness |
| Legal (ToS, privacy, jurisdiction) | OB-140/141 | Can't launch without legal |

---

## 5. Top Product Risks

1. **💰 Money doesn't flow yet.** Stripe subscriptions and Connect payouts are scaffolded but not production-wired (OB-060, OB-040/041). Until tipsters can actually get paid, you have no marketplace. **This is the single biggest risk.**

2. **🔒 Trust claim has a gap.** The entire pitch is "picks can't be faked," but immutability is app-layer only (OB-035). A direct DB update could alter a pick. Need the Postgres trigger before launch.

3. **🏟️ No live data.** Settlement runs against mock/test adapters. Without a live sports-data vendor key (OB-045), settlement and CLV are untested against real fixture data. Launch depends on this.

4. **🔐 Auth is XSS-vulnerable.** JWT in localStorage (OB-001) on a platform that handles payments is a serious liability. Combined with no rate limiting (OB-007), the auth surface is not production-ready.

5. **🐔🥚 Cold-start problem.** The "rising tipster" / free-record-building path (OB-153) isn't implemented. New tipsters can't build a free public track record to attract subscribers. Without it, the chicken-and-egg problem is harder to crack.

6. **📱 No mobile push.** Web push (OB-031) isn't built. Picks are time-sensitive — bettors need to see picks before odds move. Email/polling only may cost bettors real money.

---

## 6. Recommended Next Priorities (product perspective)

**Tier 1 — "Nothing works without this":**
1. **OB-060 + OB-061** — Complete Stripe subscription webhooks + signature verification.
2. **OB-040 + OB-041** — Stripe Connect onboarding + real payout transfers.
3. **OB-045 + OB-046** — Live sports data vendor.
4. **OB-035** — DB-level pick immutability trigger.

**Tier 2 — "Can't launch credibly without this":**
5. **OB-001 + OB-007** — httpOnly cookies + auth rate limiting.
6. **OB-082** — Remove default secrets; boot guard.
7. **OB-140 + OB-141** — ToS, privacy policy expansion, jurisdiction review.
8. **OB-100 → OB-102** — Deploy the stack.

**Tier 3 — "Needed for adoption":**
9. **OB-153** — Rising tipster free-record path.
10. **OB-031** — Web push notifications.
11. **OB-011** — Tipster profile paywall polish.
12. **OB-090** — Sentry error tracking.

**Bottom line:** The product vision is strong, the skeleton is impressively complete, and the data model covers every entity needed. The critical path to launch is: **make money flow (Stripe end-to-end), prove settlement works (live data), and lock down security (auth + immutability).** Everything else is polish.
