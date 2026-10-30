# Danny — History

## Core Context

- **Project:** A verified sports tipster marketplace connecting tipsters with bettors, built with TypeScript/NestJS backend and React frontend in a monorepo.
- **Role:** QA
- **Joined:** 2026-07-17T21:01:46.088Z

## Learnings

<!-- Append learnings below -->

- 2026-10-30: Test review races with conditional transactional updates, revalidate UTC tip dates after kickoff edits, and enforce expiry as kickoff minus the approval buffer.
- 2026-10-30: Use real-service PostgreSQL integration tests with read barriers to force review races; test both conditional-update losers and already-committed terminal states for EDITORIAL_STATUS_CONFLICT. Check DATABASE_URL before importing Prisma to preserve clean no-database skips; isolate and clean fixtures. Final validation reached 645 unit and 52 integration passes, including 20 automation cases.
- 2026-10-30: Manual tips need review-queue publication, audit attribution, kickoff/expiry validation and kickoff-time hiding; test post-review terminal-state errors and treat isolated query-planner assertions separately. Full release validation remains in progress at this handoff.
- 2026-10-30: Release follow-up reports builds/Prisma passing, integration 59/59 and unit 670 before one added regression (671 not yet confirmed). Fixed first lazy-Redis readiness and brittle index-plan testing. Real draft-only pipeline success does not imply accepted copy-edit success: conservative proper-name checks can fall back on sentence-start words. Distinguish built-service checkout guard verification from authenticated HTTP smoke, which needs a Supabase token.
