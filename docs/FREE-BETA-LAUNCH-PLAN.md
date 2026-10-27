# Free beta: five-day launch plan

Status: proposed execution plan, pending Day 1 scope and environment checks.
Prepared: 2026-10-26. Day 1-5 means five working days from approval.

## 1. Decisions captured

- Launch a free beta with real tipsters, visible free picks, and validated results.
- No payments, paid subscriptions, or payouts during this beta.
- Target African audiences interested in football, basketball, hockey, and tennis.
- Initial target countries confirmed by Dickson on 2026-10-27: Nigeria (NG),
  Ghana (GH), Uganda (UG), Tanzania (TZ), Kenya (KE), Rwanda (RW), Zambia (ZM),
  and South Africa (ZA). These are audience markets, not a requirement to cover
  each country's domestic leagues or evidence of regulatory approval.
- Prefer free services; use the existing GitHub Copilot subscription for development where appropriate.
- Use current remote `main` as the release candidate, after identifying the deployed commit.
- Dickson owns delivery and release approval, assisted by the AI team.

Not yet decided: public versus invitation-only access,
initial competitions/markets, results freshness promise, provider account quotas,
and an available reliable execution host. Broad audience intent is not legal
approval or a commitment to support every competition on Day 5.

Recommendation: recruit a small tipster cohort and release a limited free beta.
Start with one tested football competition and one simple pre-match market.
Add basketball, hockey, and tennis only after each passes the same coverage and
grading checks. This is a proposed scope reduction, not an accepted restriction.

## 2. Tracking and evidence

GitHub Issues are the action-item source of truth. This file owns scope, schedule,
decisions, dependencies, and release gates. Do not copy the full backlog here.
Each active issue needs an owner, acceptance tests, evidence, and a target day.
An AI role is a proposed helper, not a human assignee or an approval.

### GitHub snapshot

Checked 2026-10-26: 50 open issues, 7 open PRs. Issues comprise 12 P0, 19 P1,
15 P2, and 4 without priority labels. Only one open issue has an assignee;
none has a `squad:*` label. Existing priority labels describe the earlier paid
launch, not necessarily this free-beta critical path.

Local checkout: `e3ebd908cf1f0c456fe74eaa66b34142d711f08a` (July 17).
Candidate remote main: `6d816e5c7fb055cf6f5eeba41ab11f5ce347921e`.
The latest main push CI run found was successful on August 3:
[CI run](https://github.com/CognitronTechnologies/overlay/actions/runs/30815675560).
That is historical evidence, not a fresh release certification.
Recent dependency PR CI runs failed. There were no push CI runs returned for
`dev` by the query used; do not infer that dev has no PR checks.

The earlier local build/test failures cannot be generalized to newer main.
Newer main already contains an immutability migration, backup/restore workflows,
runbooks, caches, and other changes absent from the old checkout. Verify them
before opening duplicate work or declaring those capabilities missing.

Open PRs: #261 and #257 (dependency groups), #252 (UI), #250 (CodeQL),
#238 (Prisma major upgrade), #230 (affiliates), #225 (moderation).
Do not merge these as a bundle to make the launch look complete. Review only
changes required for the beta, including any necessary dependency remediation.

## 3. Scope that actually needs changing

Inspection of candidate main revealed:

1. Tipster publishing requires a positive subscription price and
   `stripeOnboarded=true`. Free-beta onboarding must explicitly waive billing
   requirements without falsifying Stripe completion or weakening identity,
   ownership, timing, and moderation checks.
2. Daily Tips is admin/staff-managed, editable content. It is not interchangeable
   with the locked `Pick` model, hash evidence, and settlement history.
3. Open tipster live picks can be ungated by graduation/subscription settings,
   but the live endpoint still requires authentication. The aggregated feed
   selects subscribed tipsters. Decide guest versus registered-bettor access
   and connect a genuinely free discovery/feed path across API and web.
4. `PAYMENTS_PROVIDER=mock` is a demo provider, not "payments disabled."
   Suppress billing CTAs and reject checkout, billing, and payout mutations
   server-side in beta mode. Keep webhook handling deliberate and tested;
   it must not create beta access or money movement accidentally.
5. Provider source code proves an adapter exists, not that an account is funded,
   licensed, configured in production, or returning the required competitions.
   Verify status through the owner's dashboards and an approved smoke test;
   never paste keys into issues or this file.

Relevant candidate-main sources:
- [Onboarding](https://github.com/CognitronTechnologies/overlay/blob/6d816e5c7fb055cf6f5eeba41ab11f5ce347921e/apps/api/src/modules/tipsters/onboarding.ts)
- [Locked picks and feed](https://github.com/CognitronTechnologies/overlay/blob/6d816e5c7fb055cf6f5eeba41ab11f5ce347921e/apps/api/src/modules/picks/picks.service.ts)
- [Editorial free tips](https://github.com/CognitronTechnologies/overlay/blob/6d816e5c7fb055cf6f5eeba41ab11f5ce347921e/apps/api/src/modules/free-tips/free-tips.service.ts)
- [Sports provider](https://github.com/CognitronTechnologies/overlay/blob/6d816e5c7fb055cf6f5eeba41ab11f5ce347921e/apps/api/src/integrations/sports/the-odds-api.provider.ts)

## 4. Five-day schedule

| Day | Work and proposed helpers | Exit evidence |
|---|---|---|
| 1: Establish the release | Dickson + Rusty confirm country-specific eligibility for the eight selected markets and select cohort, competitions, market, access mode, and freshness promise. Linus identifies deployed SHA, checks main/dev differences without overwriting the dirty checkout, and validates a clean main-based environment. Verify provider quota/licensing and host availability. Assign a small launch milestone. | Exact candidate SHA and deployment source recorded; clean-install build/tests characterized; actual provider coverage/quota known; agreed scope and stop conditions. Legal/data-use checks start now. |
| 2: Make free publishing real | Linus + Turk implement an explicit free-beta policy across onboarding, server payment guards, public/registered free-pick reads, feed/discovery, and UI. Preserve locked picks as the canonical performance record. Danny tests role/ownership boundaries and unchanged non-beta behavior. | A real tipster can onboard without billing, lock a pre-match pick, and a bettor can view it without checkout. Billing mutations are rejected. No fake Stripe flags or subscriptions. |
| 3: Validate outcomes affordably | Linus implements only missing quota controls and scheduling needed for the selected scope. Batch feeds and reuse existing shared-cache helpers. Test sport-specific grading, missing results, postponed fixtures, retries, restarts, duplicates, and immutable history. Start real-fixture observation no later than today. | Integration replay is deterministic and idempotent; provider-request counts stay within the approved budget; at least one real eligible fixture is being followed end to end. Unsupported markets cannot be published. |
| 4: Release rehearsal and cohort | Danny runs tipster-to-bettor-to-result journeys on staging. Dickson verifies migration, backup/restore evidence, alerts, abuse/reporting, legal copy, age eligibility, and allowed countries. Invite a proposed 3-5 tipsters and 10-20 testers, subject to availability. | Fresh CI passes for the exact candidate; staging smoke evidence; a real fixture's lock-to-result evidence, or an explicit release delay; no unresolved critical access/data-integrity defect; rollback rehearsed. |
| 5: Conditional go-live | Dickson signs off the checklist, deploys the recorded SHA, checks public pages and authenticated flows, and opens the agreed beta cohort. Basher helps with truthful beta messaging; no profit/skill guarantees. Monitor the first sessions and settlements. | Live SHA verified; no payment paths; fresh real results visible with provenance; quota/health alerts reach Dickson; rollback and support work. If a gate fails, retain a waitlist/staging preview instead of claiming a validated beta launch. |

Dependencies: Day 1 scope/baseline gates precede implementation; free-beta
publishing precedes the full user journey; data/worker validation precedes
verified-results claims; legal/data rights and operational gates precede release.
Recorded fixtures accelerate tests but do not substitute for live evidence.
Real match schedules and external approvals may push release beyond five days.

## 5. GitHub action queue

Use existing issues where the acceptance criteria match. The BETA identifiers
below are proposed new tickets, not existing GitHub issues. Do not create
duplicates or close existing issues based only on source-code presence.

| Work | GitHub link or proposed ticket | Treatment |
|---|---|---|
| Baseline, deployed SHA, free-beta scope | BETA-01 | New small launch-control issue, Day 1. |
| No-billing onboarding and backend payment disablement | BETA-02 | New beta behavior; Day 2; test API and UI. |
| Free locked-pick discovery/feed | BETA-03 | New integration of existing open picks; Day 2. Keep editorial FreeTip distinct. |
| Live vendor/coverage validation | [#29](https://github.com/CognitronTechnologies/overlay/issues/29), [#33](https://github.com/CognitronTechnologies/overlay/issues/33), [#165](https://github.com/CognitronTechnologies/overlay/issues/165) | Narrow launch acceptance to supported competitions/markets; do not certify all sports. |
| Reliable scheduled ingestion/capture | [#30](https://github.com/CognitronTechnologies/overlay/issues/30), [#108](https://github.com/CognitronTechnologies/overlay/issues/108), [#32](https://github.com/CognitronTechnologies/overlay/issues/32) | Choose an affordable reliable runner; keep the always-on production worker issue open if using a limited beta alternative. |
| Quota-controlled sports requests | BETA-04 | New bounded optimization under the data/scheduling work; Day 3. |
| Settlement and API integration | [#93](https://github.com/CognitronTechnologies/overlay/issues/93), [#91](https://github.com/CognitronTechnologies/overlay/issues/91) | Reuse existing test tooling; target the free-beta loop, not a new test framework project. |
| Authorization and CORS | [#76](https://github.com/CognitronTechnologies/overlay/issues/76), [#75](https://github.com/CognitronTechnologies/overlay/issues/75) | Launch gate for relevant surfaces. |
| Migrations, environments, seed separation | [#90](https://github.com/CognitronTechnologies/overlay/issues/90), [#88](https://github.com/CognitronTechnologies/overlay/issues/88), [#98](https://github.com/CognitronTechnologies/overlay/issues/98) | Verify newer implementation before modifying it. |
| E2E and image smoke | [#92](https://github.com/CognitronTechnologies/overlay/issues/92), [#110](https://github.com/CognitronTechnologies/overlay/issues/110), [#89](https://github.com/CognitronTechnologies/overlay/issues/89) | Require a fresh check for the release SHA. |
| Error reporting | [#79](https://github.com/CognitronTechnologies/overlay/issues/79) | Need actionable error visibility, with a free option where suitable. Do not require a paid product for its own sake. |
| Countries and privacy | [#104](https://github.com/CognitronTechnologies/overlay/issues/104), [#150](https://github.com/CognitronTechnologies/overlay/issues/150) | Free access does not remove all compliance, age, privacy, or vendor-license obligations. Re-scope acceptance with the owner. |
| Beta go/no-go and observation | BETA-05 | Evidence checklist, support, rollback, and seven-day follow-up. |

Defer payment implementation issues #37, #38, #39, #40, #61, #62, #63,
and #64 from the beta milestone; keep them open for monetization.
Defer bet slips (#253), affiliate growth (#151 / PR #230), livescores (#146),
realtime transport (#102), exports (#154), and broad redesign work unless a
specific beta blocker depends on them. Do not confuse deferral with deletion.

## 6. Cost reduction: deterministic runners first

The sports registry selects one provider, not an automatic combination of both:
The Odds API, API-Football, or mock. API-Football's existing adapter returns no
odds; that route alone cannot prove CLV. Candidate main still performs
sport-level odds and scores requests through per-event methods.

The current event cache is not sufficient evidence of cross-process or
cross-event deduplication. Settlement also calls the provider directly.
Inspect/reuse main's existing cache infrastructure before adding another.

Implement in this order:

1. Record actual provider credit headers, endpoint family, sport, cache hit,
   request count, and observation time. Never log credential-bearing URLs.
2. Fetch each exact sport/region/market feed once per freshness window and
   distribute its events to callers. Coalesce concurrent requests; share the
   cache between API and worker where feasible.
3. Poll only relevant fixtures with unsettled locked picks; avoid expensive
   odds capture for irrelevant old events. Schedule result checks around
   expected completion, with bounded backoff for delays.
4. Add a hard credit budget and reserve. Stop new vendor work and mark data
   stale/pending when exhausted; never fabricate odds, results, or CLV.
5. Restrict enabled sports/markets, keep extended event markets off initially,
   and make browser refreshes read cached data rather than trigger paid calls.

Acceptance example: twenty events on the same sport/feed/cache key within one
window cause at most one upstream request, including concurrent requests.
That is a 20-to-1 reduction for that duplicated operation, not a promise of a
95% reduction in the total bill. Assert exact call counts in tests and compare
credit usage on representative recorded workloads.

### Free quota reality

The Odds API currently advertises 500 free credits/month. Its docs price odds
requests by region and market and expose credit usage headers. Five hundred
credits averages about 16.7/day across thirty days, before accounting for every
other billable endpoint and retries. One three-market poll every minute would
alone imply 4,320 credits/day if each response costs three credits.

A proposed conservative starting envelope is at most 12 credits/day and a
100-credit monthly reserve, subject to the account's actual remaining balance
and complete endpoint accounting. This is not enough to promise continuous
coverage of four sports. If the selected coverage cannot fit, shrink the
cohort/fixtures, accept explicitly delayed result checks, or approve spend.
Do not rotate keys/accounts to bypass vendor limits.

No free API-Football quota or redistribution approval was verified during this
review; its pricing site was inaccessible. Confirm in the owner's dashboard.
Availability of an endpoint never implies permission to redistribute its data.

### Runner/agent choices

| Mechanism | Use now | Limits |
|---|---|---|
| Deterministic ingestion/settlement runner | Scheduled bounded jobs, locks, idempotency, cache and quota enforcement | Requires a host that is actually available. Existing queue-mode startup returns before the interval-mode ingestion/digest setup; test all required schedules before switching modes. |
| GitHub-hosted Actions | CI, bounded provider smoke tests, backup verification and daily health/quota reports | Minutes/availability depend on account/repository limits. Scheduled runs can be delayed or dropped; not a precise kickoff clock. Use protected secrets and trusted workflows, never untrusted PR code with production access. |
| Existing operator-owned machine | Optional small scheduled worker if it can remain online securely | Power, sleep, connectivity, patching, and single-point-of-failure are the owner's responsibility. This is not inherently a reliable free service. |
| Copilot-assisted agent actions | Draft fixes/tests, summarize failed runs, group duplicate issues, propose quota adjustments | Use only available subscription capabilities; hosted automation may have separate entitlement/usage costs. Budget tool calls and require approval before deployment, spend, or policy changes. |

Do not place an LLM in the grading, entitlement, financial, or canonical result
path. An agent can flag anomalies for review, not invent a result or silently
alter a locked pick. No always-on AI runner is needed to reduce vendor requests.

## 7. Honest validation and release gates

Distinguish three things in both API and UI:

- Tipster-submitted odds: an immutable claim, not automatically vendor-verified.
- Result-validated pick: outcome checked against an authorized source, with
  source, timestamp, market rules, and unresolved/disputed state preserved.
- CLV-verified pick: requires a documented bookmaker/market/line, timestamped
  closing reference, and acceptable capture window. Post-kickoff live odds
  must not be relabeled as a pre-match closing line.

Keep CLV unavailable when evidence is absent. Do not rank low-sample tipsters as
proven profitable; show sample sizes and provisional status.

Release only when:

- [ ] Owner has approved countries, cohort, supported markets, access mode, and data-use terms.
- [ ] The exact main-based candidate passes fresh build, tests, migration and deployment smoke checks.
- [ ] Tipsters publish without billing and bettors read free locked picks through the agreed access mode.
- [ ] Payment/payout actions are disabled on the server, not merely hidden.
- [ ] A real eligible fixture has passed lock -> source-backed result -> stats, with no duplicate settlement.
- [ ] Cutoff, ownership, immutability, disputes, and unsupported-market behavior are tested.
- [ ] Quota exhaustion produces explicit stale/pending states; spending stays within the approved cap.
- [ ] Required jobs run independently of browser traffic, with downtime/catch-up behavior understood.
- [ ] Restore/backup evidence, alerts, support, privacy and rollback are verified for the selected environment.
- [ ] No seed/mock data is presented as real tipster performance.

Success during the first seven live days: a proposed minimum of three active
tipsters, ten real bettors/testers, twenty real locked picks over available
fixtures, audited settlement accuracy, zero duplicate settlements, zero enabled
billing actions, and usage within quota. These are proposed targets, not
promises or claims about existing users. Track source-backed settlement
coverage and freshness separately from total picks.

## 8. Outstanding owner decisions

Day 1 must resolve:

1. What eligibility, age, privacy, and data-use requirements apply in each of
   the eight selected countries? Target countries are decided; clearance is not.
2. Is the beta public, invitation-only, or public reading with curated tipsters?
3. Can the first launch narrow sport/league/market coverage to fit verified free quotas?
4. Is delayed result validation acceptable? If yes, what freshness target is shown?
5. Which machine/service can reliably run jobs, and who receives failures?
6. What provider accounts, remaining quota, and data rights actually exist?

Do not change a deployed environment or enable new runners until these
implementation-affecting choices are recorded and the operator approves access.

## Sources checked

- [Open issues](https://github.com/CognitronTechnologies/overlay/issues?q=is%3Aissue+is%3Aopen)
- [Open PRs](https://github.com/CognitronTechnologies/overlay/pulls)
- [The Odds API plans](https://the-odds-api.com/)
- [The Odds API usage and endpoints](https://the-odds-api.com/liveapi/guides/v4/)
- [GitHub scheduled-workflow delay warning](https://github.com/github/docs/blob/main/data/reusables/actions/schedule-delay.md)

This pass created only this planning document. No GitHub issues, labels,
milestones, branches, production settings, runners, or application behavior were
changed.
