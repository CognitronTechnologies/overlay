# Squad Decisions

## Active Decisions

See the active decisions below.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

## Content Automation Decisions

### 2026-10-30: Content automation is draft-only; humans publish
**By:** Squad (Product, Backend, Frontend, QA)
**What:** Automation may create content drafts for human review, but cannot publish them. Publishing and rejection remain authenticated editorial actions.
**Why:** Scheduled collection and drafting must not bypass editorial accountability or source-rights checks.

### 2026-10-30: Free-tip expiry is bounded by the approval deadline
**By:** Squad (Product, Backend, QA)
**What:** `expiresAt` is the pending-review deadline and must be at or before kickoff minus the approval margin (60 minutes under the current policy). The effective expiry is the earlier of that deadline and quote-receipt time plus 30 minutes.
**Why:** An expired or stale candidate must not remain approvable; the earlier cutoff preserves both the kickoff buffer and odds freshness.

### 2026-10-30: Content candidates require evidence and rights clearance
**By:** Rusty (Product)
**What:** Follow the source hierarchy, usage permissions, competition scope, evidence gates, and review safeguards in `docs/CONTENT-SOURCES.md`. Disable automated official-site/outlet ingestion until permissions are recorded; do not infer reuse rights from public availability. Permit zero candidates and cap new free-tip drafts at five per UTC day.
**Why:** Protect source rights and users from unsupported, stale, or misleading content. This policy is a conservative readiness standard, not evidence of predictive edge or legal exemption.

## Processed Inbox Assessments (Non-directive)

These historical assessments were reviewed during inbox processing. They are preserved here as context, not adopted team decisions or current implementation status:
- **Basher, Marketing & GTM assessment (2026-07-17):** identified content cold-start, conversion, SEO, outreach/community, analytics, payment, legal, and launch-readiness gaps.
- **Danny, QA assessment (2025-07-17):** highlighted missing integration and end-to-end coverage, settlement orchestration risks, concurrency and boundary cases, and test-infrastructure gaps.
- **Linus, Backend architecture assessment:** recorded modular-monolith strengths alongside deployment, caching, integrity, schema, and test-coverage concerns.
- **Rusty, Product assessment (2026-07-17):** summarized product journeys and prioritized payment, security, settlement-data, legal, and cold-start work.

## Public Feed Enablement and Integration Validation

### 2026-10-30: Owner authorizes public feed consumption as a reader
**By:** Dickson Mwendia (user directive, recorded by Scribe)
**What:** News feeds are public; consume RSS/Atom like a reader rather than scrape publisher sites. The owner accepts residual publisher ToS risk. This supersedes the blanket disable-until-permission policy above only for catalog public news feeds, not other source ingestion or provider contract gates.
**Why:** Enable public news collection with explicit owner risk acceptance, not an assertion of reuse rights or legal clearance. Reader-only controls, original multi-source drafting, attribution and human-only publication remain mandatory.

### 2026-10-30: Real-service automation integration tests and deterministic races
**By:** Danny
**What:** Added 20 PostgreSQL-backed tests in `apps/api/src/modules/automation/automation.itest.ts`. The tests use the real ingestion, editorial and public-read services; only the cache is in-memory. A scoped in-memory TypeScript loader handles Nest decorators under the existing strip-only runner. Read barriers force stale-version and competing-review interleavings without replacing database writes/transactions. Unique prefixes and unused future UTC dates isolate fixtures; cleanup was verified to leave zero matching content, runs, users or audits.
**Why:** Mirroring Prisma query shapes would miss service wiring, publication boundaries and race/audit regressions. DATABASE_URL is checked before importing Prisma so generated-client environment loading cannot silently defeat the unset-variable skip.

**Bug found and fixed:** `apps/api/src/modules/automation/editorial.service.ts:280` and `:284` (assertEditable/assertReviewable) returned a generic 409 without `EDITORIAL_STATUS_CONFLICT` when an operation observed a previously committed terminal status. Repro: create a pending article or tip; approve it; then reject, approve or edit it again. The late operation had `getResponse().code === undefined`, whereas a loser reaching the conditional UPDATE received the documented code. Both guards now return the same documented code; article and tip regressions cover this path.

**Verification:** Docker ready; compose PostgreSQL healthy; all 33 migrations deployed; Prisma client and shared package built. Full integration suite: 52 passed, 0 failed (20 new automation tests). Full unit suite: 645 passed, 0 failed (final coordinator-reported result; the initial inbox report recorded 644). API build passed. Automation suite with DATABASE_URL removed skips cleanly without connecting. No commits/pushes or web/workflow changes.

### 2026-10-30: Enable public news feeds with reader-only guardrails
**By:** Linus
**What:** At Dickson Mwendia's explicit direction, enable BBC Sport football, Sky Sports football and Guardian football RSS by default. Replace the news licensing gate with CONTENT_NEWS_FEEDS_ENABLED (default true), per-feed enabled flags and runtime allow/deny IDs. Preserve provider contract gates, strict free-tip evidence requirements and human-only publication. This supersedes the earlier blanket public-news-feed disable decision only for catalog RSS/Atom endpoints.
**Why:** The owner wants public news collection now and accepted residual publisher ToS risk, including known BBC/Guardian AI/commercial restrictions and unverified complete Sky terms. This is not a claim of legal clearance.
**Controls:** Honest OverlayPicks reader User-Agent; only catalog XML feeds and robots.txt; no article crawling, redirects, authentication/paywalls or bypasses; skip robots-disallowed/unavailable feeds; twice-daily news schedule, cached six-hour minimum and conditional GET metadata; bounded headlines/snippets only, never full article bodies or images. Tips workflow disables feeds to avoid additional polling. Require two independent publishers, publisher names and source links; reject normalized consecutive 25-word evidence overlaps. Surface termsNote through reviewerWarnings. Snippets may justify no draft; human factual/originality/scope review remains required.

## Copy Editing, Manual Tips, and Free Launch

### 2026-10-30: Overlay Picks copy-edit style
**By:** Rusty (Product)
**What:** For copy-edited news, use Carabao Cup as the sole canonical competition name (not EFL Cup); full person/club name at first mention then surname/commonly used club short name; UK English; no Oxford comma; scores such as 3-1; dates such as Thursday 29 October; sentence-case headings. Headlines are 45-80 characters, excerpts 35-60 words, and bodies 350-650 words. Use 2-4 descriptive subheads plus a short "What's next"; attribute inline and link each exact source URL once.
**Why:** Consistent, reader-first copy helps editorial review while preserving the original evidence and attribution. These are copy-edit conventions, not permission to change facts or sources.

### 2026-10-30: Add a safeguarded article copy-edit stage
**By:** Linus
**What:** After fact validation, run an article-only Copilot copy edit using the runtime body of `.github/skills/overlay-copy-edit/SKILL.md`, with evidence and validated drafts in a read/write-only sandbox. Revalidate facts, source attribution, rights, freshness, verbatim overlap and safety after editing; reject fact-altering edits back to the original draft with a reviewer warning. Treat house-style lint as reviewer warnings rather than dropping a fact-valid draft. Record the UTC research date in reviewer warnings instead of article prose. Keep tips unchanged and let local operators skip copy editing with `--no-copyedit`.
**Why:** Improve publication readiness while preserving the original evidence-backed draft and keeping editorial judgment with a human reviewer.

### 2026-10-30: Manual fallback tips use the shared Editorial Queue
**By:** Danny (at Dickson Mwendia's direction)
**What:** POST `/api/free-tips` creates pending manual tips with required future kickoff, UTC-derived day and expiry at kickoff minus the shared approval margin. Rationale/risks are review-only. Manual submissions bypass automated source, cap, dedupe and quote-freshness requirements; approval still enforces kickoff/day/expiry and records creator plus approver (self-approval allowed). Existing FreeTip has no creator column, so the existing audit log stores atomic creation attribution; approval copies it to its payload without a migration. All legacy PATCH requests return USE_EDITORIAL_QUEUE; DELETE permits only manual tips, including published. Both public list/date routes hide tips at kickoff; legacy null kickoffs remain visible. Manual kickoff edits recompute the default approval expiry along with UTC day.
**Why:** Provider outages need a practical human fallback without bypassing review, attribution, concurrency safeguards, or time-sensitive visibility. Documentation: `docs/CONTENT-AUTOMATION.md`. Web callers must route edits to Editorial Queue and revalidate after deletion/publication.
**Verification:** Full unit suite 664 passed; API build passed. Built API on port 4010 returned healthy readiness (Postgres and Redis both ok), public tips/dates responded, and the smoke process was stopped without touching port 4000. Final real-service manual/automation suite: 27 passed. Full integration suite: 58 passed, 1 unrelated failure in `stats/indexing.itest.ts:139`: the query planner chose `Pick_tipsterId_status_idx` plus a sort instead of the asserted `Pick_tipsterId_lockedAt_idx`; reproduced with that file alone. The earlier full integration run before the last manual race regression passed all 58 tests. No commits or pushes.

### 2026-10-30: Route manual tip edits through editorial review
**By:** Turk
**What:** Manual tips are submitted as pending Editorial Queue items. The tips admin list provides status/origin filters and badges, links manual pending edits and automation items into the Editorial Queue, and permits deletion only for manual-origin tips. Kickoff entry uses local time while the displayed tip date is derived in UTC; rationale and risks are submitted as rationale/counterarguments.
**Why:** Manual entries are a reviewed fallback when the external tip provider is unavailable, and must follow the same human publication gate as automated drafts. This also keeps edits within the API's editorial workflow and avoids direct updates that bypass review.

### 2026-10-30: API free-access mode is authoritative
**By:** Linus
**What:** Implement `FREE_ACCESS_MODE` as an opt-in API switch (default false). When true, all live-pick subscription entitlements open, public feed reads include active tipsters, and checkout/portal/dev-confirm plus payout transfers are rejected with stable `PAYMENTS_DISABLED` / `PAYOUTS_DISABLED` conflict codes. Public pick projections continue to omit commitment hashes/nonces, and cache keys distinguish free from paid mode. Production Render sets the API flag to true. Demo seed records are suppressed in production unless `SEED_DEMO_DATA=true`; the purge tool is a dry run unless passed `--confirm`.
**Why:** Launch picks free to anonymous visitors with payments off while keeping the API authoritative, preserving pick integrity controls, and preventing synthetic performance records from entering production.

### 2026-10-30: Web free-launch behavior and canonical origin
**By:** Turk (Frontend Dev)
**What:** Added the `NEXT_PUBLIC_FREE_ACCESS_MODE` web presentation switch to expose tipster picks publicly and suppress paid subscription/pricing/payout actions while payments are disabled. The API remains authoritative for access and checkout; its `PAYMENTS_DISABLED` response is shown as a free-launch message. Canonical and metadata origins resolve from `NEXT_PUBLIC_SITE_URL`, then `SITE_URL`, then the production domain.
**Why:** Keep launch UX consistent with the owner-approved free public launch without relying on client state for authorization, and prevent indexing preview-host URLs.

### 2026-10-30: Launch Overlay Picks in free-access mode
**By:** Rusty (Product)
**What:** For the public-now launch, expose tipsters’ picks without subscription entitlement using one coordinated `FREE_ACCESS_MODE` API / `NEXT_PUBLIC_FREE_ACCESS_MODE` web switch; block new checkout and payouts, but preserve signed payment webhooks, historical ledger, and immutable pick proof/cutoff controls. Cancel provider renewals before announcing and remove demo seed claims from public-facing content.
**Why:** The owner chose open signup/login, payments off, and all tips free at launch. Entitlement must not be confused with the pre-kickoff hash/immutability integrity rules, and existing paid customers must not continue being charged for a newly free product.

### 2026-10-30: Free-launch public copy and legal language
**By:** Basher (Marketing)
**What:** Public copy should state that all picks, including tipster picks, are free and public; picks remain timestamped, hashed and locked before kickoff. Tipster earnings and payouts are paused and do not accrue during the current free launch. Legal terms and privacy copy no longer describe active subscriptions, payment processing or paid access.
**Why:** Match public-facing claims to the owner's current free-launch decision without promising that free access is permanent or that pricing will return. Legal text is informational draft copy and needs qualified counsel review.

### 2026-10-30: Local content runner preserves the draft-only boundary
**By:** Linus
**What:** Add `npm run content:local` for collect → Copilot draft → validate → optional submit, defaulting to no API writes. Only loopback API origins are accepted for local submission. Readiness and explicit Copilot authentication are checked before collection. `COPILOT_USE_LOGGED_IN=1` opts into existing profile credentials; CI continues using `COPILOT_GITHUB_TOKEN`. Profile/OS path variables are allowlisted; provider and ingestion credentials never enter the drafting child. Windows executable resolution prefers native `.exe`, then uses a short, expansion-rejecting `.cmd` launch. All instructions/evidence live in the restricted workspace rather than argv; correct the prompt-template repository root.
**Why:** A real Windows local exercise must work with npm shims, profile-based login, command-line limits and real services without quietly publishing, leaking unrelated credentials, or accidentally submitting to production.
**Additional behavior:** Retain bounded feed snippets and shared polling metadata in gitignored `.content-local/`. Reuse only selected, still-recent evidence after interval/304 skips, retaining original timestamps. This supports dry-run then submit without violating the six-hour polling interval. Re-running immediately must neither re-poll feeds nor discard prior dry-run news; cached snippets cannot manufacture freshness. Provider evidence is recollected and normal validation gates remain authoritative. Document Supabase-backed admin login and the existing local seed promotion rather than inventing a password-auth bypass.
**Verification:** Windows real fake-shim integration verifies spaced paths, 100 KB file-backed evidence and bounded argv without Copilot/network. Full unit suite and live BBC/Sky/Guardian collection were run; see task report for final counts. No real Copilot draft executed, no secrets read, no commits/pushes.
