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
