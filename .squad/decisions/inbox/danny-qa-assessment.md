# QA Assessment — Overlay Bets

**Author:** Danny (QA)  
**Date:** 2025-07-17  
**Scope:** Full test inventory, coverage analysis, risk assessment, recommended test plan

---

## 1. Test Inventory

| Type | Count | Runner | Location |
|------|-------|--------|----------|
| **Shared unit** | 13 files, ~115 cases | `node --test` | `packages/shared/src/*.test.ts` |
| **API unit** | 25 files | `node --test` | `apps/api/src/**/*.test.ts` |
| **API integration** | 1 file (7 cases) | `node --test` | `apps/api/src/modules/subscriptions/ledger.itest.ts` |
| **E2E** | 0 | — | — |
| **Smoke** | 1 script (manual) | `node` | `scripts/sports-smoke.ts` |
| **Load** | 0 | — | — |
| **Web component** | 0 | — | — |

**Total: ~39 test files, ~170+ test cases. No e2e, no load tests, 1 integration test.**

---

## 2. Coverage Analysis

### Shared Package — STRONG (13/14 modules tested)

| Module | Tests | Rating | Notes |
|--------|-------|--------|-------|
| stats | 9 | ⭐⭐⭐⭐ | Missing: empty array, division-by-zero edge |
| grading | 12 | ⭐⭐⭐⭐ | Missing: parseTeamTotalSelection, extreme scores |
| integrity | 5 | ⭐⭐⭐ | Missing: empty payloads, whitespace edge cases |
| odds | 13 | ⭐⭐⭐⭐⭐ | Excellent boundary coverage |
| performance | 7 | ⭐⭐⭐⭐ | Missing: half_won/half_lost in series |
| content | 6 | ⭐⭐⭐ | Missing: emoji, RTL, empty string edges |
| consent | 8 | ⭐⭐⭐⭐ | Excellent error-path coverage |
| subscriptions | 11 | ⭐⭐⭐⭐⭐ | Excellent time-boundary and immutability tests |
| currencies | 5 | ⭐⭐⭐ | Missing: rate=0 (division by zero), negative amounts |
| countries | 6 | ⭐⭐⭐⭐ | Good data validation |
| markdown | 13 | ⭐⭐⭐⭐ | Strong XSS/sanitization coverage |
| daily-tips | 10 | ⭐⭐⭐⭐ | Leap year, boundaries tested |
| tipster-profile | 10 | ⭐⭐⭐⭐ | Good validation boundary tests |

### API Modules — PARTIAL (12/21 modules have tests)

**Tested modules:**
admin (3 files), articles, events, exports, free-tips, newsletter, notifications (3 files), payouts (2 files), picks, privacy, subscriptions (itest only), tipsters (2 files)

**Completely untested modules (9):**
❌ auth, ❌ feedback, ❌ follows, ❌ health, ❌ metrics, ❌ reports, ❌ search, ❌ stats, ❌ users

### Integrations — MIXED

| Integration | Tests | Quality |
|-------------|-------|---------|
| Stripe webhooks | 11 tests | ⭐⭐⭐⭐⭐ Crypto sig validation, all event types |
| Payment registry | Tests exist | ⭐⭐⭐⭐ Provider routing |
| The Odds API mapper | 11 tests | ⭐⭐⭐⭐⭐ All market types, grading |
| API-Football mapper | Tests exist | ✅ |
| HTTP retry logic | Tests exist | ⭐⭐⭐⭐ Backoff, Retry-After |
| **FX / currency service** | ❌ NONE | 🔴 Financial data path untested |
| **Storage (Supabase)** | ❌ NONE | ⚠️ |

### Workers — NONE

❌ `settlement.service.ts` — **0 tests** despite being the trust-core orchestrator  
❌ `settlement.queue.ts` — no tests  
❌ `settlement.module.ts` — no tests

---

## 3. Critical Path Coverage

| Critical Flow (from SPEC §4/§6) | Unit Tests | Integration Tests | Status |
|----------------------------------|-----------|-------------------|--------|
| **Pick lock (hash + timestamp)** | ✅ integrity.test.ts | ❌ | ⚠️ Partial |
| **Pick immutability post-lock** | ❌ (comment-only, no DB constraint) | ❌ | 🔴 Gap |
| **Settlement grading** | ✅ grading.test.ts + mapper tests | ❌ | ⚠️ Partial |
| **Settlement pipeline (runOnce)** | ❌ | ❌ | 🔴 **CRITICAL** |
| **CLV computation** | ✅ stats.test.ts (unit) | ❌ | ⚠️ Partial |
| **Closing odds capture** | ❌ | ❌ | 🔴 Gap |
| **Stats recomputation** | ✅ stats.test.ts (pure math) | ❌ | ⚠️ Partial |
| **Subscription entitlement** | ✅ subscriptions.test.ts (shared) + feed.test.ts | ✅ ledger.itest.ts | ✅ Decent |
| **Stripe webhook handling** | ✅ stripe-webhook.test.ts (11 tests) | ❌ | ⚠️ Partial |
| **Payout calculation** | ✅ payouts.math.test.ts (10 tests) | ❌ | ⚠️ Partial |

**Verdict:** Pure business logic is well-tested. The orchestration layer (settlement service, auth flow, entitlement gating in controllers) has zero test coverage.

---

## 4. Edge Case Gaps

### High Risk
- **Race conditions:** No concurrent pick submission tests. Two users submitting for same event at lock boundary.
- **Settlement idempotency:** No test proving `runOnce()` is safe to re-run. DB has `Payment.reference @unique` but Pick settlement has no idempotency key.
- **Void after settlement:** Admin void workflow tested (settlements.test.ts) but no integration-level test with stats rollback.
- **Closing odds timing:** No test for the window between event start and odds capture. What if odds arrive late?

### Medium Risk
- **Timezone boundaries:** Daily tips uses UTC consistently, but pick lock time validation at midnight UTC edges untested.
- **Currency conversion with rate=0:** `currencies.ts` doesn't test division-by-zero in `convertUsdCents`.
- **Empty arrays:** `computeTipsterStats([])` not explicitly tested.
- **Half-results in performance series:** `half_won`/`half_lost` tested in grading but not in cumulative performance charts.
- **Webhook replay:** Stripe idempotency tested in ledger.itest.ts but not in webhook handler itself.

### Lower Risk
- **Markdown sanitizer:** Missing deeply-nested tag recursion, malformed HTML edges.
- **Content slugs:** Emoji in slugs, extremely long inputs.
- **Subscription expiry at exact boundary:** 36h window tested but not at ±1ms.

---

## 5. Integration Test Gaps

Only **1 integration test file** exists (`ledger.itest.ts`). Missing:

| Flow | Priority | Backlog |
|------|----------|---------|
| Auth: signup → login → session → CSRF | P0 | OB-001, OB-110 |
| Pick submission → lock → fan-out | P0 | OB-110 |
| Settlement: poll → grade → CLV → stats | P0 | **OB-112** |
| Subscription: checkout → webhook → entitlement | P0 | OB-110 |
| Payout: aggregate → calculate → mark paid | P1 | OB-110 |
| Admin: void pick → rollback stats | P1 | OB-110 |
| Tipster onboarding → approval → marketplace listing | P2 | OB-110 |

---

## 6. Data Integrity Verification

### What the schema enforces:
- ✅ `Subscription @@unique([userId, tipsterId])` — no duplicate subs
- ✅ `Payment.reference @unique` — idempotent payments
- ✅ `Event.vendorEventId @unique` — no duplicate events
- ✅ `User.email/username/supabaseUserId @unique`
- ✅ Good indexes on `Pick(tipsterId, status)`, `Pick(eventId, status)`, `Event(startTime)`

### What the schema does NOT enforce:
- ❌ **Pick immutability after lock** — comment-only ("Append-only. Core fields are immutable after `lockedAt`"), no DB trigger or CHECK constraint (OB-035)
- ❌ **Settlement idempotency on Pick** — no unique constraint on settlement attempt (only Payment has one)
- ❌ **Cascade rules** — all default to RESTRICT, meaning orphan cleanup is app-level
- ❌ **Soft delete** — no `deletedAt` pattern; hard deletes could lose audit trail
- ❌ **Article slug immutability** — "immutable-by-convention once published", no constraint

### Testability:
- Pick immutability: **Not verifiable** through tests today — needs OB-035 first (DB constraint) then test
- Settlement idempotency: **Partially verifiable** through ledger.itest.ts (payment dedup) but not pick-level

---

## 7. Test Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| **Runner** | `node --test` (built-in) | No Jest, no Vitest. Works for pure functions. |
| **Mocking** | `node:test` mock API | Used in API tests (mock repos, services) |
| **Fixtures** | Inline in tests | No shared fixture library |
| **Test DB** | Docker Compose (`infra/`) | Used by ledger.itest.ts via `DATABASE_URL` |
| **Testcontainers** | ❌ Not set up | OB-110 calls for this |
| **CI test step** | Not verified | `npm test` runs all workspaces |
| **Coverage tool** | ❌ None | No `c8`, `istanbul`, or `--experimental-test-coverage` |
| **E2E framework** | ❌ None | OB-111 calls for Playwright |
| **API test client** | ❌ None | No Supertest/Pactum setup |
| **Load testing** | ❌ None | OB-114 calls for k6/Artillery |

**Missing tools:**
1. Coverage reporting (`c8` or `node --experimental-test-coverage`)
2. API integration test harness (Supertest + Testcontainers)
3. E2E framework (Playwright)
4. Shared test fixtures/factories
5. Contract testing for external APIs (Stripe, The Odds API)

---

## 8. Top Quality Risks

Ranked by likelihood × impact:

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **Settlement double-counts or skips picks** | Medium | 🔴 Critical | OB-112: integration tests for `runOnce()` idempotency |
| 2 | **Pick edited after lock** | Low (app prevents) | 🔴 Critical | OB-035: DB constraint + test |
| 3 | **Closing odds captured stale or missed** | Medium | High | Test timing window; mock vendor delays |
| 4 | **Auth bypass / session hijack** | Low | 🔴 Critical | OB-001 + auth module tests |
| 5 | **FX conversion error corrupts payouts** | Medium | High | FX service unit tests needed |
| 6 | **Stripe webhook missed → entitlement desync** | Low | High | Webhook reconciliation tests |
| 7 | **CLV computed on wrong odds** | Medium | Medium | Integration test: capture → compute → verify |
| 8 | **Stats show wrong ROI/yield after void** | Medium | Medium | Admin void → stats recompute integration test |
| 9 | **Race condition on concurrent pick submission** | Low | Medium | Concurrency test at DB level |
| 10 | **Timezone bug at midnight UTC** | Medium | Low | Boundary tests for date functions |

---

## 9. Recommended Test Plan (Prioritized)

### P0 — Must have before production

| # | Test | Type | Backlog | Est. Effort |
|---|------|------|---------|-------------|
| 1 | **Settlement pipeline integration test** — `runOnce()` with mock vendor, verify grading + CLV + stats + idempotency | Integration | OB-112 | 2–3 days |
| 2 | **Pick immutability test** — verify locked picks reject mutations (needs OB-035 DB constraint first) | Unit + Integration | OB-035 | 1 day |
| 3 | **Auth module tests** — login, session, CSRF, role guards | Unit | OB-110 | 1–2 days |
| 4 | **FX service tests** — rate lookup, conversion, fallback on API failure | Unit | — | 0.5 day |
| 5 | **Coverage reporting** — add `c8` or `--experimental-test-coverage` to CI | Infra | — | 0.5 day |

### P1 — Should have for launch confidence

| # | Test | Type | Backlog | Est. Effort |
|---|------|------|---------|-------------|
| 6 | **API test harness** — Supertest + Testcontainers setup | Infra | OB-110 | 2 days |
| 7 | **Subscription entitlement integration** — checkout → webhook → pick visibility | Integration | OB-110 | 1 day |
| 8 | **Shared edge cases** — empty arrays, division-by-zero, extreme values in stats/currencies/integrity | Unit | — | 1 day |
| 9 | **Closing odds capture test** — timing, exactly-once, vendor failure retry | Integration | OB-046 | 1 day |
| 10 | **E2E: core journey** — signup → subscribe → view pick → settle → verify stats | E2E | OB-111 | 3 days |

### P2 — Nice to have

| # | Test | Type | Backlog |
|---|------|------|---------|
| 11 | Payout end-to-end (aggregate → pay → reconcile) | Integration | OB-110 |
| 12 | Admin void + stats rollback integration | Integration | — |
| 13 | Web component tests (pick form, profile, subscribe) | Component | OB-113 |
| 14 | Load test: settlement + pick submission under load | Load | OB-114 |
| 15 | Contract tests for Stripe + The Odds API | Contract | OB-115 |

---

## Decision

**Immediate action items for the team:**
1. Nobody ships settlement changes without OB-112 tests (P0).
2. Add `c8` coverage reporting to CI — we need a baseline number.
3. FX service is a silent financial risk — needs tests before any payout goes live.
4. The 9 untested API modules should get at minimum smoke-level unit tests.

**Current test health: 6/10** — shared logic is solid, but orchestration and integration layers are dangerously under-tested for a financial platform.
