# Backend Architecture Assessment — Linus

> Full codebase audit of the NestJS API, Prisma schema, integrations, workers, and shared packages.

---

## 1. Architecture Assessment

**Verdict: Well-structured modular monolith. Clean module boundaries. Ship-ready skeleton.**

The API (`apps/api/src/`) is split into **21 NestJS modules** with clear feature boundaries. Module seams are clean — each owns its routes, service, and DTOs. Cross-module deps flow in the right direction (e.g., Picks → Subscriptions for entitlement, not the reverse).

**Strengths:**
- Provider-agnostic integrations behind interfaces (`PaymentProvider`, `SportsDataProvider`) with DI-injected registry — swap mock/real via env vars.
- Settlement pipeline centralized in `workers/settlement.service.ts` — only code that writes settlement fields.
- Shared business logic (`packages/shared/`) is pure, deterministic, and independently tested — stats math, grading, integrity hashing, odds conversion.
- Global cross-cutting: `AllExceptionsFilter` (never leaks stack traces), tiered rate limiting (global/auth/write), Prometheus SLI metrics, Supabase JWKS auth.

**Concerns:**
- **Notification dispatch is inline** — `notificationsService.dispatchNewPick()` blocks the pick creation response. Should be enqueued (comment in code acknowledges: "v1 awaits here").
- **In-process caching** (odds cache, FX rates) won't survive multi-instance deployment. Needs Redis for distributed cache.
- **No explicit module dependency graph enforced** — NestJS DI handles it, but a circular dep between picks↔subscriptions↔notifications could emerge as features grow.

---

## 2. API Surface

**60+ endpoints across 21 modules. Coverage is comprehensive for MVP.**

| Module | Endpoints | Notes |
|---|---|---|
| Auth | 1 | `GET /auth/me` — Supabase-delegated, minimal |
| Users | 6 | Profile CRUD, avatar upload/preset, username availability |
| Picks | 6 | Create+lock, tipster's own, performance dashboard, subscriber feed, public track record, live picks |
| Tipsters | 8 | Marketplace, public profile, profile update, onboarding wizard (4 steps), subscriber count |
| Subscriptions | 8 | Methods, quote, checkout, webhook (generic + per-provider), portal, list mine, dev-confirm |
| Payouts | 3+3 admin | Earnings summary, batch run, on-demand request + admin approve/reject |
| Stats | 1 | Leaderboard |
| Notifications | 4 | Preferences CRUD, CAN-SPAM unsubscribe (GET+POST) |
| Admin | 16 | Dashboard, user mgmt, tipster suspension, audit log, settlements, reports, payouts, feedback, newsletter |
| Events | 4 | Upcoming, filters, odds, ingest |
| Free Tips | 6 | Public listing/dates + admin CRUD |
| Articles | 9 | Public listing/tags/sitemap/slug + authoring CRUD |
| Follows | 4 | Follow/unfollow, list IDs, list with stats |
| Privacy | 2 | GDPR export + erasure |
| Search | 1 | Global search (tipsters + articles) |
| Reports | 1+2 admin | User feedback about tipsters |
| Feedback | 1+2 admin | Support center |
| Newsletter | 1+1 admin | Subscribe + admin list |
| Exports | 9 | XLSX/CSV/PDF for user/tipster/admin data |
| Health | 2 | Liveness + readiness |
| Metrics | 1 | Prometheus scrape |

**Gaps:**
- No cursor-based pagination on leaderboard, pick lists, or admin queries (fixed `take` limits).
- No public endpoint for newsletter unsubscribe (only CAN-SPAM for notification emails).
- Search is `LIKE` substring — no full-text search or relevance ranking.

---

## 3. Data Model

**15 Prisma models, 8 enums. Solid relational design with some gaps.**

**Strengths:**
- `Pick` is append-only with hash+nonce integrity fields — core architectural invariant.
- `Payment` table is a funds ledger with unique `reference` for idempotency.
- `TipsterStats` materialized view pattern avoids expensive aggregation on reads.
- Composite unique constraints: `Subscription(userId, tipsterId)`, `Follow(userId, tipsterId)`.
- Good index coverage on `Pick(tipsterId, status)`, `Pick(eventId, status)`, `Event(startTime)`, `AuditLog(entity, entityId)`.

**Issues:**
- **String fields that should be enums:** `Tipster.status`, `Event.status`, `Payout.kind`, `TipsterReport.sentiment`, `TipsterReport.reason`. Weakens type safety and query filtering.
- **Missing indexes:**
  - `Tipster.userId` — frequent joins from picks/stats/payouts.
  - `Subscription(userId, tipsterId)` composite for entitlement lookups (unique constraint exists but explicit index useful).
  - `Payment(tipsterId, period)` — payout summation queries scan without it.
- **No DB-level CHECK constraints** on `Pick.oddsAtPick > 1.0`, `Pick.stakeUnits > 0`, `Payout.amountCents > 0` — validation is app-layer only.
- **DB-level immutability trigger still pending** (OB-035) — app-layer guard is the only protection against direct DB updates to picks.
- **`Pick.closingOdds` nullable** but CLV calculation divides by it — needs null guard in `pickClv()` (currently safe because code checks, but fragile).

---

## 4. Integrations Health

### Payments
| Provider | Status | Checkout | Webhooks | Payouts |
|---|---|---|---|---|
| **Stripe** | Skeleton | ✅ Checkout Session | ✅ Verified (HMAC-SHA256, constant-time) | ⚠️ Scaffold — per-tipster Price + customer resolution TODO |
| **Coinbase Commerce** | Real | ✅ Hosted checkout | ✅ Verified | ❌ `transferToTipster` throws "not supported" |
| **Flutterwave** | Real | ✅ Mobile money charge | ✅ Verified (static hash) | ❌ Not implemented |
| **Mock** | Dev only | ✅ Synthetic URLs | ✅ No verification | ✅ Synthetic |

**Critical: Flutterwave charges in local currency but uses raw USD cents without FX conversion** (`mobile-money.provider.ts:34-35`). This will charge wrong amounts in production.

**Registry pattern is clean** — `PaymentProviderRegistry` routes by method, guards mock in production.

### Sports Data
| Provider | Events | Odds | Results/Grading |
|---|---|---|---|
| **The Odds API** | ✅ Real | ⚠️ `getOdds` returns `[]` | ✅ Via `gradeFromScores` |
| **API-Football** | ✅ Real | ❌ Returns `[]` | ✅ FT/AET/PEN only |
| **Mock** | ✅ Deterministic | ✅ Single 1X2 market | ✅ Home always wins |

**Grading only supports 1X2/moneyline.** Spreads and totals return `void` from both mappers — picks on those markets won't settle correctly. Shared `gradeMarket()` handles them, but the mapper layer doesn't pass score data through for spreads/totals.

**HTTP retry logic is solid** — exponential backoff, Retry-After header, 3 max retries (`integrations/sports/http.ts`).

### FX
- `CurrencyService` converts USD cents to local currency with live rate fetch + static fallback.
- In-process cache only (1hr TTL) — no Redis. Multi-instance deployments will have rate divergence.

### Storage
- Supabase Storage adapter (no SDK) — private bucket (signed URLs) + public bucket (avatars). Clean.

---

## 5. Worker/Settlement Pipeline

**Well-designed idempotent pipeline. Main risk is deployment mode.**

### Pipeline Flow (`settlement.service.ts`)
```
captureClosingOdds() → settlePicks() → computeClv() → recomputeStats()
```
Each step is idempotent — `updateMany { where: { id, status: 'pending' } }` prevents double-settling. Void workflow uses `$transaction` for atomicity. Metrics recorded per cycle (duration histogram, success/failure counter, picks-settled throughput).

### Deployment Modes
| Mode | Config | Risk |
|---|---|---|
| **Embedded** (free tier) | `EMBED_WORKER=true` in API process | Render free tier spins down on idle → settlement stops |
| **Queue** (production) | `WORKER_MODE=queue` + Redis | BullMQ repeatable job, concurrency=1, proper lifecycle |
| **Interval** (default) | `WORKER_MODE=interval` | setInterval loop, no Redis needed |

**Risks:**
- **Free-tier deployment** (`render.yaml`) runs embedded mode + mock sports provider + mock payments. Fine for staging, not production.
- **No dead-letter queue** — failed settlement cycles retry next interval but no alert escalation path.
- **Stats recomputation not locked** — concurrent settlement cycles could race on `TipsterStats` updates (concurrency=1 in queue mode mitigates, but interval mode has no guard).
- **Digest fanout** runs on its own timer (`DIGEST_INTERVAL_MS`, 24h default) — no marker tracks which picks were already digested, risking duplicates.

---

## 6. Test Coverage

### What Exists (37 test files total)
**Shared package (13 files):** Excellent coverage — stats, grading (23 cases including Asian quarter-lines), integrity, odds (50+ cases), currencies, subscriptions, content, performance, tipster-profile, daily-tips, consent, countries, markdown.

**API unit tests (24 files):** Good coverage of pure business logic:
- Integrations: `stripe-webhook.test.ts`, `payment-provider.registry.test.ts`, `http.test.ts`, `api-football.mapper.test.ts`, `the-odds-api.mapper.test.ts`
- Modules: `onboarding.test.ts`, `marketplace.test.ts`, `privacy.test.ts`, `feed.test.ts`, `payouts.math.test.ts`, `payout-destination.test.ts`, `newsletter.test.ts`, `templates.test.ts`, `preferences.test.ts`, `notifications.dispatch.test.ts`, `authoring.test.ts`, `exports.test.ts`, `ingestion.test.ts`, `free-tips.test.ts`, `users-query.test.ts`, `settlements.test.ts`, `audit-query.test.ts`
- Common: `metrics.test.ts`, `throttling.test.ts`

### What's Missing
- **Integration tests (OB-110):** Zero `.itest.ts` files found. No tests against real DB/Redis. Settlement pipeline, auth flow, webhook lifecycle, payout math with real data — all untested end-to-end.
- **Controller/HTTP tests:** No Supertest harness. Endpoints not tested with request/response layer.
- **E2E tests (OB-111):** No Playwright/Cypress. Full user journeys (signup→pick→settle→subscribe→payout) unverified.
- **Load tests (OB-114):** No k6/Artillery scripts.

Test runner: Node 22 native `--experimental-strip-types` (no Jest/Vitest).

---

## 7. Code Quality Observations

**Good patterns:**
- Pure mappers for all integrations (no framework deps, testable without network).
- Constant-time comparison for all webhook signature verification (`timingSafeEqual`).
- Metrics library is dependency-free (`common/metrics.ts`) — works with `--experimental-strip-types`.
- Environment validation at boot (`config.ts`) — fail-fast in production.
- Dev fallbacks for crypto/mobile-money providers (success-page JSON when unconfigured, gated by NODE_ENV).

**Anti-patterns / tech debt:**
- **Inline notification dispatch** — blocks pick creation. Should be fire-and-forget queue job.
- **In-process caching everywhere** — odds (60s), FX rates (1hr). Breaks in multi-instance.
- **Hardcoded `take` limits** (100-200) instead of cursor pagination. Will break as data grows.
- **String enums in schema** — `Tipster.status`, `Event.status`, `Payout.kind`. Lose type safety.
- **Contact details in cleartext** — phone, Telegram, WhatsApp. Should be encrypted at rest.
- **Article body not sanitized server-side** — XSS risk if frontend doesn't sanitize.
- **Audit log unbounded** — no archival/retention policy.
- **Hash pepper has no rotation strategy** — if compromised, all picks' hashes invalidatable.

---

## 8. Top Backend Risks

| # | Risk | Severity | OB Issue |
|---|---|---|---|
| 1 | **No integration tests** — settlement, webhooks, payouts untested against real DB | 🔴 Critical | OB-110, OB-112 |
| 2 | **Flutterwave FX bug** — charges raw USD cents as local currency | 🔴 Critical | — |
| 3 | **DB immutability trigger missing** — pick integrity relies on app-layer only | 🔴 Critical | OB-035 |
| 4 | **Stripe provider incomplete** — per-tipster Price, customer resolution, Connect onboarding | 🟠 High | OB-040, OB-060 |
| 5 | **Inline notification dispatch** — blocks API responses, no queue | 🟠 High | OB-032 |
| 6 | **Sports grading incomplete** — spreads/totals return `void` from mappers | 🟠 High | OB-160 |
| 7 | **No CI/CD gates** — can deploy without passing lint/tests | 🟠 High | OB-104 |
| 8 | **Settlement on free tier** — worker pauses when Render spins down | 🟡 Medium | OB-143 |
| 9 | **In-process cache** — FX/odds diverge across instances | 🟡 Medium | — |
| 10 | **No Sentry** — unhandled errors not aggregated | 🟡 Medium | OB-090 |

---

## 9. Recommended Next Priorities

### Immediate (blocks credible launch)
1. **OB-110 + OB-112:** Integration test harness (Testcontainers + Supertest). Settlement pipeline must be tested against real Postgres.
2. **Fix Flutterwave FX bug:** Wire `CurrencyService.quote()` into `mobile-money.provider.ts` before charging.
3. **OB-035:** DB immutability trigger on `picks` table — the core trust invariant can't rely on app-layer alone.
4. **OB-060:** Complete Stripe provider — per-tipster pricing, customer resolution, Connect onboarding (OB-040).

### Short-term (before real users)
5. **OB-032:** Move notification dispatch to BullMQ queue. Unblock pick creation response.
6. **OB-104:** CI/CD gates — lint → typecheck → unit tests → integration tests → deploy.
7. **OB-160:** Fix spreads/totals grading in mappers — pass score data through to `gradeMarket()`.
8. **Schema hardening:** Add enums for `Tipster.status`, `Event.status`, `Payout.kind`. Add missing indexes on `Tipster.userId`, `Payment(tipsterId, period)`.

### Medium-term (production hardening)
9. **OB-090:** Sentry integration for API + worker error aggregation.
10. **OB-055:** Redis cache for leaderboard + cursor-based pagination.
11. **Distributed cache:** Move odds/FX caching to Redis for multi-instance.
12. **OB-085:** Encrypt contact details at rest; retention policy for audit log.

---

*Assessment by Linus — Backend Dev. All findings reference actual files in the repo. OB-### IDs from `docs/PROD-READINESS-BACKLOG.md`.*
