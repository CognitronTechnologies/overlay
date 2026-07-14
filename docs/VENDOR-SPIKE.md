# Sports-Data Vendor Spike

> **This is the critical first task.** Everything downstream (settlement, CLV, leaderboard) depends on a vendor that reliably provides **closing odds** and accurate results. Validate this before writing pick-engine code.

---

## Why it matters

- **CLV** (Closing Line Value) is our core anti-luck metric. It requires **odds at pick time** *and* **closing odds** for the same market. Not all vendors expose closing odds.
- **Settlement** must be accurate and timely, or trust collapses.

---

## Requirements checklist (evaluate each vendor against these)

| Requirement | Priority | Notes |
|---|---|---|
| Pre-match odds (multiple books) | Must | For odds-at-pick capture |
| **Closing odds** | Must | Deal-breaker if unavailable |
| Results / settlement feed | Must | Won/lost/void, void handling |
| Coverage of target sports/leagues | Must | Soft, liquid markets preferred |
| Market breadth (1X2, spreads, totals, props) | High | MVP may start with 1X2/moneyline |
| Update latency / websockets | High | For live pick fan-out later |
| Historical odds access | Med | Backfill + seeding leaderboard |
| Rate limits & pricing | Must | Cost model at scale |
| Reliability / SLA / uptime | High | Consider dual-source cross-check |
| Data licensing terms | Must | Redistribution rights for stats |

---

## Candidates to evaluate

### 1. The Odds API
- Known for multi-book odds aggregation; check closing-odds and historical endpoints + pricing tiers.

### 2. SportMonks
- Strong football (soccer) coverage; check odds + results depth and closing-line availability.

### 3. API-Football (API-Sports)
- Broad football coverage, affordable tiers; verify closing odds specifically.

> Add others as needed: Sportradar, OpticOdds, OddsJam (data), Betfair Exchange (implied fair odds via exchange prices — useful as a "true price" reference for CLV).

---

## Spike deliverables

1. Comparison matrix filled in against the checklist above.
2. Confirmed **closing-odds** availability for at least one primary vendor (with a working sample response).
3. Recommendation: primary vendor (+ optional secondary for cross-check).
4. Cost projection at launch scale and at 10x.
5. Sample end-to-end pull: one event → pre-match odds → closing odds → result.

**Exit criteria:** we can fetch an event with pre-match AND closing odds end-to-end from the chosen vendor.

---

## Open questions

1. Which vendor gives reliable closing odds at acceptable cost?
2. Single-source vs. dual-source settlement for trust?
3. Which sports/leagues to launch with? (Soft, high-liquidity markets favor CLV signal.)
4. Use Betfair Exchange closing price as the "true" line for CLV, or book closing odds?

---

## Decision (v1)

We adopt a **multi-vendor, provider-agnostic** approach behind a single `SportsDataProvider` interface so no single vendor lock-in and we can cross-check for trust.

| Role | Vendor | Why |
|---|---|---|
| **Pre-match + closing odds (primary)** | **The Odds API** | Multi-bookmaker aggregation; snapshot near kickoff gives the closing line for CLV; affordable tiers; historical odds for backfill |
| **Fixtures + results/settlement (primary)** | **API-Football (API-Sports)** | Broad league coverage and reliable final scores for auto-grading; affordable |
| **"True" closing line (CLV reference, stretch)** | **Betfair Exchange** | Exchange last-traded price at kickoff is the sharpest available "true" probability — the gold standard for CLV |

**Settlement trust model:** dual-source cross-check — grade primarily from API-Football scores, and flag any disagreement with The Odds API scores for manual review. Start single-source, enable cross-check before public launch.

**CLV source:** use The Odds API closing snapshot for v1 (simpler); upgrade top markets to Betfair Exchange last-traded price in v2.

**Abstraction:** all of the above sit behind `apps/api/src/integrations/sports/SportsDataProvider`. A `MockSportsDataProvider` powers local dev and tests so the pipeline runs end-to-end before any paid key is provisioned.

> ⚠️ Coverage/pricing figures still need live confirmation against each vendor's current docs before committing spend. The interface makes swapping or adding vendors cheap.

---

## Rate limits & cost (v1) — OB-045

> Figures below are indicative from each vendor's public pricing and **must be
> re-confirmed** against current docs before committing spend. They drive the
> ingestion cadence (`INGEST_INTERVAL_MS`) and sport selection (`INGEST_SPORTS`).

| Vendor | Free tier | Paid entry | Quota model | Notes |
|---|---|---|---|---|
| **The Odds API** | ~500 requests/month | e.g. 20k / 100k / 5M req/month tiers | A request costs **credits = regions × markets**; `/events` and `/scores` are cheaper than multi-region `/odds` | Keep `regions=eu&markets=h2h` (1 credit) for the v1 closing snapshot to control cost |
| **API-Football** | ~100 requests/day | e.g. 7.5k+/day paid tiers | Per-request/day quota | Used for fixtures + results only in v1 (no odds), so volume is modest |

**Cost-control levers already in code:**
- `INGEST_INTERVAL_MS` (default 15 min) bounds fixture-pull frequency.
- `INGEST_SPORTS` restricts ingestion to the leagues we actually list.
- The odds request pulls `h2h,spreads,totals` from a single region (credits =
  regions × markets = 1 × 3 per odds call). Drop markets to cut cost.
- **Resilience:** `integrations/sports/http.ts` retries `429`/`5xx` with capped
  exponential backoff (honouring `Retry-After`), so a rate-limit blip doesn't
  fail a whole settlement cycle.

**Markets supported (grading):** `1X2`, `moneyline`, `dnb` (draw no bet),
`double_chance`, `btts`, `odd_even`, `correct_score`, `spreads` (Asian handicap,
incl. quarter/split lines), `totals` (over/under, incl. Asian quarter) and
`team_totals` — see `packages/shared/src/grading.ts`. Spread/total picks encode
the line in the selection (e.g. `home -1.5`, `over 2.5`, `home -0.25`) so a pick
matches its exact closing line. Asian **quarter lines** settle as half-win /
half-loss (`half_won` / `half_lost`). Odds/CLV are captured for h2h + spreads +
totals; other markets grade from the final score (CLV null).

**Rough launch projection:** with ~5 leagues, `/events` + `/odds` + `/scores`
each pulled every 15 min ≈ `3 × 5 × 96 ≈ 1,440` The Odds API calls/day (the
`/odds` call costs 3 credits), comfortably within a 100k/month tier. Re-estimate
before scaling `INGEST_SPORTS` or adding markets/regions.

---

## End-to-end validation runbook (live key) — OB-045

Validate `ingest → capture closing odds → settle → CLV` on real fixtures:

1. Set env: `SPORTS_API_PROVIDER=the-odds-api`, `SPORTS_API_KEY=<key>`,
   `INGEST_SPORTS=soccer_epl` (and any others), `SPORTS_API_PROVIDER` on both API
   and worker.
2. Start the worker (or hit `POST /api/events/ingest {"sport":"soccer_epl"}` as
   an admin). Confirm fixtures land in `Event` (`GET /api/events/upcoming`).
3. As a tipster, lock a pick on an upcoming fixture (captures `oddsAtPick`).
4. After kickoff, the settlement cycle runs `captureClosingOdds` → the pick's
   `closingOdds` is stamped once (idempotent; `Event.closingCapturedAt` set).
5. After full-time, `settlePicks` grades the pick (won/lost/void) and
   `computeClv` writes `clv = oddsAtPick/closingOdds − 1`.
6. Verify on the tipster profile / leaderboard that stats reflect the graded
   pick and CLV.

**Exit criteria:** one real fixture flows end-to-end with a stamped closing line
and a computed CLV. Recorded-payload coverage for the mappers + grading lives in
`the-odds-api.mapper.test.ts`, `api-football.mapper.test.ts` and
`the-odds-api.e2e.test.ts`.

