# Human-reviewed content automation

## Architecture and trust boundary

Scheduled GitHub Actions workflows (using Copilot CLI) research soccer news and fixture evidence, then send **drafts only** to Overlay. The pipeline is `collect -> draft -> validate facts -> copyedit (articles only) -> revalidate + fact-preservation + copy lint -> optional submit`; tips bypass copy-edit entirely. The copy-edit pass uses the current `.github/skills/overlay-copy-edit/SKILL.md` body at runtime, preserves the validated draft on fact-preservation failure, and adds reviewer warnings for style lint instead of dropping a draft. The API records automation provenance and puts every submitted item in `pending`. An administrator uses the editorial queue to inspect evidence, edit, then approve (publish) or reject. Automation credentials do not authenticate as users and no automation route can set a publish status. Publication is a separate, human-only admin action.

The copy-edit name guard compares whole words case-insensitively with the validated draft, tags and evidence. English function words (including sentence-opening transitions and prepositions) are not names; ordinary prose openers are exempt only at sentence, heading or list-item starts unless also capitalized mid-sentence. Unknown capitalized words are still checked even at sentence starts so a newly introduced person or club cannot slip through. New numbers, scores, dates and new or altered quotations remain rejection reasons. This is a conservative heuristic, not entity recognition or factual verification; human editorial review remains mandatory.

Content provenance is stored inline as JSON arrays/objects (`sources`, `rationale`) and text arrays (`reviewerWarnings`): it is a small, bounded, provider-neutral payload that is fetched and reviewed with the content, with no independent source lifecycle or cross-source queries. `AutomationRun` records the workflow invocation and links to its submitted drafts. `dedupeKey` is nullable and unique per content table. Tips can optionally reference an Overlay `Event`; `kickoffAt` remains available for fixtures not linked to the event catalog.

Free-tip rows that existed before this change are migrated to `published`; new manual free tips enter the same Editorial Queue as automation (`pending`, `origin=manual`). Public article queries continue to require `published`; public free-tip queries require `published` and a null or future kickoff. Pending tips are lazily changed to `expired` when kickoff or expiry has passed; approval expiry does not hide an already-published tip before kickoff.

## Authentication and security

- Configure `AUTOMATION_INGEST_TOKEN` on `overlay-api` as a secret (Render `sync: false`). Use a long random value (at least 32 characters). If unset, automation endpoints return `404` and the feature is off.
- Send only `Authorization: Bearer <AUTOMATION_INGEST_TOKEN>`. Comparison uses SHA-256 digests and constant-time equality. Missing or incorrect credentials return `401`. A user JWT, admin session, or role does not grant machine access.
- Machine routes are separate from admin routes, only accept the DTO allowlists, and hard-code `origin=automation`, `status=pending`; callers cannot supply status, reviewer identity, or publish timestamps. All writes share API rate limiting (30 writes/minute/IP by default) and the global 120 requests/minute/IP limit.
- Admin Editorial Queue routes require a valid user JWT with the `admin` role. Staff and tipster accounts are intentionally excluded from this review/publish surface.
- Treat every generated field as untrusted. Text is size-limited; raw HTML tags and unsafe Markdown link schemes are stripped from article bodies. Source URLs are recorded but are never fetched by the API. Review warnings, sources, rationale, and run metadata are not included in the public free-tip/article shapes.

## Machine API contract

All paths below are under `/api`. Requests use JSON and must satisfy the global strict validation pipe (`whitelist`, unknown fields rejected, transform enabled). Timestamps are ISO-8601; dates are real `YYYY-MM-DD` UTC calendar dates.

### Sources

```json
{
  "url": "https://example.org/report",
  "title": "Source headline",
  "publisher": "Publisher name",
  "retrievedAt": "2026-10-30T06:00:00.000Z",
  "kind": "news"
}
```

`url`: required HTTP(S), max 2048 chars; `title`: 1–300; `publisher`: 1–120; `retrievedAt`: ISO timestamp; `kind`: `news | official | match | odds | other`.

### Submit article

`POST /api/automation/drafts/articles` (machine Bearer auth)

```json
{
  "dedupeKey": "epl-arsenal-chelsea-news-20261030",
  "title": "Matchday news",
  "slug": "optional-explicit-slug",
  "body": "Markdown article body",
  "excerpt": "Optional short excerpt",
  "category": "news",
  "tags": ["Premier League"],
  "sources": [{ "url": "https://example.org/report", "title": "Report", "publisher": "Example", "retrievedAt": "2026-10-30T06:00:00Z", "kind": "news" }],
  "reviewerWarnings": ["Confirm the reported injury update"],
  "automationRunId": "optional-internal-run-id"
}
```

Required: `dedupeKey` (8–160), `title` (3–160), `body` (1–50,000), and 1–20 sources. Optional: `slug` (max 80), `excerpt` (max 300), `category` (`news | content`, default `news`), up to 20 tags (40 chars each), up to 20 reviewer warnings (300 chars each), and an existing `automationRunId`. The stored article is always `pending`, `origin=automation`.

### Submit free tip

`POST /api/automation/drafts/free-tips` (machine Bearer auth)

```json
{
  "dedupeKey": "epl-20261030-arsenal-chelsea-1x2-home",
  "tipDate": "2026-10-30",
  "sport": "soccer",
  "league": "Premier League",
  "match": "Arsenal vs Chelsea",
  "market": "1X2",
  "selection": "Arsenal",
  "odds": 1.95,
  "analysis": "Short public-facing explanation.",
  "kickoffAt": "2026-10-30T18:00:00Z",
  "eventId": "optional-overlay-event-id",
  "expiresAt": "2026-10-30T17:00:00Z",
  "oddsProvider": "Optional provider name",
  "oddsRetrievedAt": "2026-10-30T06:00:00Z",
  "sources": [
    { "url": "https://example.org/fixture", "title": "Fixture listing", "publisher": "Example", "retrievedAt": "2026-10-30T06:00:00Z", "kind": "official" },
    { "url": "https://example.org/team-news", "title": "Team news", "publisher": "Example News", "retrievedAt": "2026-10-30T06:10:00Z", "kind": "news" }
  ],
  "reviewerWarnings": [],
  "rationale": { "rationale": "Evidence and reasoning", "counterarguments": ["Material uncertainty"] },
  "automationRunId": "optional-internal-run-id"
}
```

Required: `dedupeKey` (8–160), `tipDate`, `sport` (soccer/football), enabled `league`, `match` (1–160), `market`, `selection` (1–160), decimal `odds` (>1 and <=1000), `analysis` (1–2,000), `kickoffAt`, and at least 2 sources (max 20). Optional fields are shown above; warnings are max 20/300 chars, `expiresAt` must be future and no later than `kickoffAt` minus the configured approval margin (60 minutes by default), and rationale contains `rationale` (max 4,000) plus up to 10 `counterarguments` (max 1,000 each). When `eventId` is supplied, its catalog kickoff is authoritative. `tipDate` must equal the kickoff's UTC date.

Supported markets are exactly `1X2`, `btts` (both teams to score), and `totals` (total goals over/under), restricted to shared markets that can be settled. Selection must be a team/draw (`1X2`), yes/no (`btts`), or `Over|Under <line>` (`totals`). Decimal odds are finite and <=1000. The enabled competition registry is: Premier League, Championship, League One, League Two, FA Cup, and EFL Cup. Competition keys and names are accepted; disabled phase-2 leagues are rejected. No third-party league IDs are assumed.

The default kickoff lead is 60 minutes. Operators may set `AUTOMATION_MIN_KICKOFF_LEAD_MINUTES` to another positive integer. The default cap is 5 automation-origin tips per `tipDate`, counting all automation-origin tips including rejected and expired items; configure `AUTOMATION_FREE_TIPS_DAILY_CAP` from 0 to 100. A cap of zero disables tip intake. These caps are server-enforced.

## Manual free-tip fallback API

When the third-party provider fails, administrators can submit a manual tip. **Manual does not mean immediately published:** creation always produces `status=pending`, `origin=manual`, visible in the existing Editorial Queue (including `origin=manual` filters).

### Create a manual tip

`POST /api/free-tips` requires a user JWT and `content:moderate` permission. Example:

```json
{
  "sport": "soccer",
  "league": "Premier League",
  "match": "Arsenal vs Chelsea",
  "market": "1X2",
  "selection": "Arsenal",
  "odds": 1.95,
  "analysis": "Optional public-facing explanation.",
  "sortOrder": 0,
  "kickoffAt": "2026-11-02T18:00:00Z",
  "rationale": {
    "rationale": "Human assessment for the reviewer.",
    "counterarguments": ["Lineup uncertainty"]
  }
}
```

Required: `sport` (1?60), `match` (1?160), `market` (1?120), `selection` (1?160), and ISO date-time `kickoffAt`. Optional: `league` (max 120), finite decimal `odds` strictly greater than 1, `analysis` (max 2,000), integer `sortOrder`, and nested `rationale` (`rationale`: 1?4,000 chars; `counterarguments`: up to 10 strings, max 1,000 each). The UI labels counterarguments **Risks**. Rationale and risks are review-only, not public fields.

The kickoff must be in the future and at least the shared approval margin ahead (`AUTOMATION_MIN_KICKOFF_LEAD_MINUTES`, default 60). Too-close/passed kickoff returns `400 TIP_KICKOFF_TOO_SOON`; malformed ISO inputs fail DTO validation (`400` with validation messages), while invalid direct-service inputs use `INVALID_KICKOFF`. `tipDate` is derived from the UTC kickoff day, never the browser's local day. The legacy optional `date` field is accepted only if it matches that day; otherwise `400 TIP_DATE_MISMATCH`. `expiresAt` is set by the server to kickoff minus the margin. Invalid odds return `400` (`INVALID_ODDS` when rejected by the service). Status, origin, expiry, creator/reviewer, source and automation fields cannot be supplied by clients.

There is **no automation daily cap, source minimum, dedupe, automated competition/market restriction, or provider quote-freshness requirement** on manual creation. Repeating the request creates a new pending tip. Manual tips may omit odds and sources. Creation returns `201` with the existing free-tip shape (`id,date,sport,league,match,market,selection,odds,analysis`) plus `status,origin,kickoffAt,expiresAt`.

### Review, attribution, management, and visibility

- Approve with the existing `POST /api/admin/editorial/free-tip/:id/approve` (JWT + admin role); reject and edit through the same Editorial Queue routes used for automation. No manual source-count/quote-freshness requirement is imposed at approval. Kickoff/date/expiry checks remain enforced (`409 TIP_DATE_MISMATCH`, `TIP_STALE`, `TIP_EXPIRED`, `INVALID_EXPIRY`); stale review/edit races return `409 EDITORIAL_STATUS_CONFLICT`.
- Self-approval is allowed for the single-admin team. `FreeTip` has no creator/author column, so creation and its `free-tip.create` audit entry are atomic, with the current admin in `actor` and `payload.createdById`. Approval records both `payload.createdById` (from that creation audit) and `payload.approvedById`, plus the usual `reviewedBy/reviewedAt`. Legacy/manual rows without a creation audit have null creator attribution; the approver remains recorded. No schema migration is required.
- `PATCH /api/free-tips/:id` returns `409 USE_EDITORIAL_QUEUE` for **all existing tips**, including pending/draft manual tips. Route edits to `PATCH /api/admin/editorial/free-tip/:id`; it retains optimistic concurrency and only permits draft/pending rows. Changing a manual kickoff also recomputes its UTC day and default approval expiry unless an explicit valid expiry is supplied. Published tips cannot be edited in place.
- `DELETE /api/free-tips/:id` permits only manual-origin rows (including published); automation rows return `409 USE_EDITORIAL_QUEUE`. Unknown IDs on either legacy mutation route return `404`. The web caller is responsible for revalidation after deletion/publication.
- `GET /api/free-tips/admin/all` keeps its existing fields and adds `status,origin,kickoffAt,expiresAt` on every item for badges. It remains JWT + `content:moderate` protected.
- Both public `GET /api/free-tips?date=YYYY-MM-DD` and `GET /api/free-tips/dates` require `status=published AND (kickoffAt IS NULL OR kickoffAt > now)`. Tips auto-hide exactly at kickoff, without deleting the row or requiring a scheduled job. Legacy null-kickoff tips are unaffected. `expiresAt` is an approval deadline, not a published-visibility cutoff.

### Automation run audit (optional)

- `POST /api/automation/runs` body: `{ "workflowName": "daily-soccer-news", "externalRunId": "123456", "externalRunUrl": "https://github.com/org/repo/actions/runs/123456" }`. `workflowName` is required; external fields optional. The returned `run.id` is passed as `automationRunId` to drafts.
- `POST /api/automation/runs/:id/finish` body: `{ "status": "succeeded", "createdCount": 3, "rejectedCount": 1, "errorSummary": "Optional summary" }`. Status is `succeeded | failed | partial`; counts are nonnegative integers. Repeat finish is idempotent and returns the already-finished run.

### Responses, errors, and idempotency

A successful create returns HTTP `201` with `{ "item": <stored record>, "duplicate": false }`. Repeating a type-specific `dedupeKey` returns HTTP `201` with the original item and `duplicate: true`; it does not create a second row. Duplicate keys are unique within each type, not globally across article and tip tables.

Errors use the API envelope `{ "statusCode": number, "error": string, "code": string, "message": string, "path": string, "timestamp": string }` when a policy code applies. Important codes:

- `401` `Unauthorized`: invalid/missing Bearer token.
- `404` feature disabled: `AUTOMATION_INGEST_TOKEN` is unset.
- `400` `SOURCES_REQUIRED`, `COMPETITION_DISABLED`, `UNSUPPORTED_SPORT`, `UNSUPPORTED_MARKET`, `INVALID_SELECTION`, `INVALID_ODDS`, `KICKOFF_PASSED`, `KICKOFF_TOO_CLOSE`, `TIP_DATE_MISMATCH`, `TIP_EXPIRED`, `INVALID_EXPIRY`, `INVALID_TIP_DATE`, `INVALID_KICKOFF`, `EVENT_NOT_FOUND`, `RUN_NOT_FOUND`, or strict DTO validation failure.
- `409` `DAILY_CAP_REACHED` or `DAILY_CAP_RACE` for concurrent limit submissions; `DUPLICATE_SLUG` for article slug collision; `EDITORIAL_STATUS_CONFLICT` when an edit or review uses an outdated item version; approval returns `INVALID_EXPIRY` if expiry is later than the configured kickoff cutoff.
- `429`: API throttling limit exceeded.

### Admin Editorial Queue (user JWT, `admin` role only)

- `GET /api/admin/editorial?type=article|free-tip&status=draft|pending|published|rejected|expired|archived&origin=manual|automation&page=1&pageSize=25` — all filters optional; response is `{items:[{type,item}],total,page,pageSize,totalPages}`.
- `GET /api/admin/editorial/:type/:id` — detail includes stored sources, warnings, rationale, run relation, and (for tips) linked event.
- `PATCH /api/admin/editorial/:type/:id` — edit draft fields; article supports `title,slug,body,excerpt,category,tags`; free-tip supports `sport,league,match,market,selection,odds,analysis,kickoffAt,expiresAt,rationale`. Only `draft`/`pending` items can be edited. Changing a free-tip kickoff recomputes `tipDate` from its UTC calendar date; approval checks the stored `tipDate` against the effective kickoff. Edits and reviews use optimistic version checks, and stale operations return `409 EDITORIAL_STATUS_CONFLICT`. The audit log records `editorial.edit` and changed field names.
- `POST /api/admin/editorial/:type/:id/approve` — `draft|pending → published`; stamps reviewer and timestamp. Free tips recheck expiry and the configured kickoff approval margin at approval; they return `409 TIP_STALE`/`TIP_EXPIRED` if stale or `409 INVALID_EXPIRY` if expiry exceeds the cutoff.
- `POST /api/admin/editorial/:type/:id/reject` — body `{ "reason": "Reason for rejection" }`; `draft|pending → rejected`; stores reviewer, timestamp, reason. Both decisions append an audit-log row (`editorial.approve` / `editorial.reject`).

Types are `article` and `free-tip`. Published/rejected/expired items cannot be edited or reviewed again through this queue. Automation ingestion cannot invoke these routes because they require the separate JWT + admin role chain.

## Status transitions

- Automated article: `pending → published | rejected` (admin only); existing manual authoring statuses remain available. Public article list/detail/sitemap include only `published`.
- Automated free tip: `pending → published | rejected`; an unread pending tip with kickoff or expiry at/before now becomes `expired`. Approval refuses stale/expired tips. Public free-tip list/date endpoints include only `published` tips whose kickoff is null or strictly after the current time.
- Existing free tips are migrated as `published`; new manual admin tips are `pending` and require Editorial Queue approval, just like automated tips.
- Run: `running → succeeded | failed | partial` via the optional finish endpoint.

## JSON Schema (machine ingestion)

These schemas use JSON Schema 2020-12 semantics. `additionalProperties: false` reflects the API's strict DTO allowlist. The response record is the stored row (ISO strings for dates); a duplicate uses the same item shape with `duplicate: true`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "Source": {
      "type": "object", "additionalProperties": false,
      "required": ["url", "title", "publisher", "retrievedAt", "kind"],
      "properties": {
        "url": { "type": "string", "format": "uri", "pattern": "^https?://", "maxLength": 2048 },
        "title": { "type": "string", "minLength": 1, "maxLength": 300 },
        "publisher": { "type": "string", "minLength": 1, "maxLength": 120 },
        "retrievedAt": { "type": "string", "format": "date-time" },
        "kind": { "enum": ["news", "official", "match", "odds", "other"] }
      }
    },
    "ArticleDraftRequest": {
      "type": "object", "additionalProperties": false,
      "required": ["dedupeKey", "title", "body", "sources"],
      "properties": {
        "dedupeKey": { "type": "string", "minLength": 8, "maxLength": 160 },
        "title": { "type": "string", "minLength": 3, "maxLength": 160 },
        "slug": { "type": "string", "maxLength": 80 },
        "body": { "type": "string", "minLength": 1, "maxLength": 50000 },
        "excerpt": { "type": "string", "maxLength": 300 },
        "category": { "enum": ["news", "content"] },
        "tags": { "type": "array", "maxItems": 20, "items": { "type": "string", "maxLength": 40 } },
        "sources": { "type": "array", "minItems": 1, "maxItems": 20, "items": { "$ref": "#/$defs/Source" } },
        "reviewerWarnings": { "type": "array", "maxItems": 20, "items": { "type": "string", "maxLength": 300 } },
        "automationRunId": { "type": "string", "maxLength": 80 }
      }
    },
    "FreeTipDraftRequest": {
      "type": "object", "additionalProperties": false,
      "required": ["dedupeKey", "tipDate", "sport", "league", "match", "market", "selection", "odds", "analysis", "kickoffAt", "sources"],
      "properties": {
        "dedupeKey": { "type": "string", "minLength": 8, "maxLength": 160 },
        "tipDate": { "type": "string", "format": "date" },
        "sport": { "type": "string", "minLength": 1, "maxLength": 60, "enum": ["soccer", "football"] },
        "league": { "type": "string", "minLength": 1, "maxLength": 120 },
        "match": { "type": "string", "minLength": 1, "maxLength": 160 },
        "market": { "enum": ["1X2", "btts", "totals"] },
        "selection": { "type": "string", "minLength": 1, "maxLength": 160 },
        "odds": { "type": "number", "exclusiveMinimum": 1, "maximum": 1000 },
        "analysis": { "type": "string", "minLength": 1, "maxLength": 2000 },
        "kickoffAt": { "type": "string", "format": "date-time" },
        "eventId": { "type": "string", "maxLength": 80 },
        "expiresAt": { "type": "string", "format": "date-time" },
        "oddsProvider": { "type": "string", "maxLength": 120 },
        "oddsRetrievedAt": { "type": "string", "format": "date-time" },
        "sources": { "type": "array", "minItems": 2, "maxItems": 20, "items": { "$ref": "#/$defs/Source" } },
        "reviewerWarnings": { "type": "array", "maxItems": 20, "items": { "type": "string", "maxLength": 300 } },
        "rationale": { "type": "object", "additionalProperties": false, "required": ["rationale", "counterarguments"], "properties": { "rationale": { "type": "string", "minLength": 1, "maxLength": 4000 }, "counterarguments": { "type": "array", "maxItems": 10, "items": { "type": "string", "maxLength": 1000 } } } },
        "automationRunId": { "type": "string", "maxLength": 80 }
      }
    },
    "IngestResponse": {
      "type": "object", "required": ["item", "duplicate"],
      "properties": { "item": { "type": "object" }, "duplicate": { "type": "boolean" } }
    }
  }
}
```

The API additionally enforces business rules not expressible in these structural schemas: enabled competition membership, `sport` may also be sent as `football`, minimum kickoff lead, tipDate/kickoff UTC-day equality, event lookup, optional expiry no later than the configured kickoff approval cutoff, the configured per-date cap, and valid calendar dates. `IngestResponse.item` is the complete persisted Article or FreeTip record; ingestion responses intentionally do not join the AutomationRun relation.

### Persisted response record schemas

For strict response decoding, each machine create endpoint returns the following envelope. Values for reviewed timestamps/status can differ on an idempotent replay if a human already reviewed the same dedupe key; the stored item is returned unchanged.

```json
{
  "$defs": {
    "Source": {
      "type": "object", "additionalProperties": false,
      "required": ["url", "title", "publisher", "retrievedAt", "kind"],
      "properties": {
        "url": { "type": "string", "format": "uri", "pattern": "^https?://", "maxLength": 2048 },
        "title": { "type": "string", "minLength": 1, "maxLength": 300 },
        "publisher": { "type": "string", "minLength": 1, "maxLength": 120 },
        "retrievedAt": { "type": "string", "format": "date-time" },
        "kind": { "enum": ["news", "official", "match", "odds", "other"] }
      }
    },
    "DateTimeOrNull": { "type": ["string", "null"], "format": "date-time" },
    "ArticleRecord": {
      "type": "object",
      "required": ["id", "slug", "locale", "translationGroupId", "machineTranslated", "translationReviewed", "title", "excerpt", "body", "coverImage", "tags", "status", "category", "readingMinutes", "seoTitle", "seoDescription", "canonicalUrl", "authorId", "origin", "sources", "reviewerWarnings", "automationRunId", "dedupeKey", "reviewedBy", "reviewedAt", "rejectionReason", "publishedAt", "createdAt", "updatedAt"],
      "properties": {
        "id": { "type": "string" }, "slug": { "type": "string" }, "locale": { "type": "string" }, "translationGroupId": { "type": "string" },
        "machineTranslated": { "type": "boolean" }, "translationReviewed": { "type": "boolean" }, "title": { "type": "string" }, "excerpt": { "type": "string" }, "body": { "type": "string" },
        "coverImage": { "type": ["string", "null"] }, "tags": { "type": "array", "items": { "type": "string" } }, "status": { "enum": ["draft", "pending", "published", "rejected", "archived"] }, "category": { "enum": ["content", "news"] },
        "readingMinutes": { "type": "integer" }, "seoTitle": { "type": ["string", "null"] }, "seoDescription": { "type": ["string", "null"] }, "canonicalUrl": { "type": ["string", "null"] }, "authorId": { "type": ["string", "null"] },
        "origin": { "enum": ["manual", "automation"] }, "sources": { "type": "array", "items": { "$ref": "#/$defs/Source" } }, "reviewerWarnings": { "type": "array", "items": { "type": "string" } },
        "automationRunId": { "type": ["string", "null"] }, "dedupeKey": { "type": ["string", "null"] }, "reviewedBy": { "type": ["string", "null"] }, "reviewedAt": { "$ref": "#/$defs/DateTimeOrNull" }, "rejectionReason": { "type": ["string", "null"] }, "publishedAt": { "$ref": "#/$defs/DateTimeOrNull" }, "createdAt": { "type": "string", "format": "date-time" }, "updatedAt": { "type": "string", "format": "date-time" }
      }
    },
    "FreeTipRecord": {
      "type": "object",
      "required": ["id", "tipDate", "sport", "league", "match", "market", "selection", "odds", "analysis", "status", "origin", "sources", "reviewerWarnings", "automationRunId", "dedupeKey", "reviewedBy", "reviewedAt", "rejectionReason", "eventId", "kickoffAt", "expiresAt", "oddsProvider", "oddsRetrievedAt", "rationale", "sortOrder", "createdAt", "updatedAt"],
      "properties": {
        "id": { "type": "string" }, "tipDate": { "type": "string", "format": "date-time" }, "sport": { "type": "string" }, "league": { "type": ["string", "null"] }, "match": { "type": "string" }, "market": { "type": "string" }, "selection": { "type": "string" }, "odds": { "type": ["number", "null"] }, "analysis": { "type": ["string", "null"] },
        "status": { "enum": ["draft", "pending", "published", "rejected", "expired"] }, "origin": { "enum": ["manual", "automation"] }, "sources": { "type": "array", "items": { "$ref": "#/$defs/Source" } }, "reviewerWarnings": { "type": "array", "items": { "type": "string" } }, "automationRunId": { "type": ["string", "null"] }, "dedupeKey": { "type": ["string", "null"] }, "reviewedBy": { "type": ["string", "null"] }, "reviewedAt": { "$ref": "#/$defs/DateTimeOrNull" }, "rejectionReason": { "type": ["string", "null"] },
        "eventId": { "type": ["string", "null"] }, "kickoffAt": { "$ref": "#/$defs/DateTimeOrNull" }, "expiresAt": { "$ref": "#/$defs/DateTimeOrNull" }, "oddsProvider": { "type": ["string", "null"] }, "oddsRetrievedAt": { "$ref": "#/$defs/DateTimeOrNull" }, "rationale": { "type": ["object", "null"] }, "sortOrder": { "type": "integer" }, "createdAt": { "type": "string", "format": "date-time" }, "updatedAt": { "type": "string", "format": "date-time" }
      }
    },
    "RunRecord": {
      "type": "object", "required": ["id", "workflowName", "externalRunId", "externalRunUrl", "startedAt", "finishedAt", "status", "createdCount", "rejectedCount", "errorSummary"],
      "properties": { "id": { "type": "string" }, "workflowName": { "type": "string" }, "externalRunId": { "type": ["string", "null"] }, "externalRunUrl": { "type": ["string", "null"] }, "startedAt": { "type": "string", "format": "date-time" }, "finishedAt": { "$ref": "#/$defs/DateTimeOrNull" }, "status": { "enum": ["running", "succeeded", "failed", "partial"] }, "createdCount": { "type": "integer" }, "rejectedCount": { "type": "integer" }, "errorSummary": { "type": ["string", "null"] } }
    },
    "ArticleIngestResponse": { "type": "object", "required": ["item", "duplicate"], "properties": { "item": { "$ref": "#/$defs/ArticleRecord" }, "duplicate": { "type": "boolean" } } },
    "TipIngestResponse": { "type": "object", "required": ["item", "duplicate"], "properties": { "item": { "$ref": "#/$defs/FreeTipRecord" }, "duplicate": { "type": "boolean" } } },
    "RunResponse": { "type": "object", "required": ["run", "duplicate"], "properties": { "run": { "$ref": "#/$defs/RunRecord" }, "duplicate": { "type": "boolean" } } }
  }
}
```

The `Source` definition is the one above in this document. `ArticleIngestResponse` applies to `POST /api/automation/drafts/articles`; `TipIngestResponse` to `POST /api/automation/drafts/free-tips`; `RunResponse` to both run endpoints.

## Run locally (Windows/macOS/Linux)

Requires Node.js 22+, npm, Docker, and an eligible GitHub Copilot account. No GitHub Actions is involved: `content:local` runs live collection -> real Copilot draft -> deterministic validation -> article copy-edit -> second validation -> optional **pending-only** local API submission. Copy-edit is on by default for articles and is skipped for tips; use `--no-copyedit` to bypass it for an article run. Default is a dry run: it does not contact or write to the API. It still uses live RSS and your Copilot quota. No fake drafts or fixture evidence are substituted.

### 1. Install and authenticate Copilot

From the repository root in PowerShell (use `npm` rather than `npm.cmd` on macOS/Linux):

```powershell
npm.cmd install -g @github/copilot
copilot
# In Copilot: /login, complete authentication, then /exit.
$env:COPILOT_USE_LOGGED_IN = '1'
```

Alternatively, set `$env:COPILOT_GITHUB_TOKEN` in this shell to a fine-grained PAT with **Copilot Requests** permission. Supply it privately; never put the token in source, command examples, committed files, or logs. With a token, `COPILOT_USE_LOGGED_IN` is unnecessary. The explicit logged-in flag asserts you already completed `/login`; if the stored login is expired, drafting fails with an auth/quota/execution error and nothing is submitted. The flag does not create credentials or bypass GitHub authentication.

`COPILOT_CLI` optionally selects an absolute executable/shim path (including paths with spaces). Windows resolves `copilot.exe` first, then `copilot.cmd` on PATH. Native binaries launch without a shell; `.cmd`/`.bat` need a narrowly quoted `cmd.exe` fallback. Shell expansion/metacharacters in shim paths/arguments are rejected; select a native executable or move the shim if needed. The short `-p` argument is 128 bytes; instructions and up to 256 KiB of evidence are files, not command-line arguments. The runner reports their sizes. Only the Copilot token and an allowlist of OS/profile/config-path variables reach Copilot, **not** provider keys, database credentials, or `AUTOMATION_INGEST_TOKEN`.

On macOS/Linux the equivalent is `export COPILOT_USE_LOGGED_IN=1` (or privately set `export COPILOT_GITHUB_TOKEN=...`). Use `export NAME=value` for the environment assignments below and run `npm run start:dev -w @overlay/api` / `npm run dev -w @overlay/web` in separate terminals.

### 2. Start local services and configure the API/web

Do not change or copy the existing root `.env`. Shell assignments below are session-only. The sample database URL is the development Docker Compose database, not production. Use a development Supabase project: the existing web login requires Supabase Auth even when Postgres/Redis and the content API are local. Set `SUPABASE_URL` for the API and the matching `NEXT_PUBLIC_SUPABASE_URL` / public `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the web. Never use a Supabase service-role key as the public anon key.

Copy/paste in the same PowerShell window used for Copilot authentication, replacing the three marked development-account values:

```powershell
Set-Location D:\COGNITRON\overlay
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://overlay:overlay@localhost:5432/overlay?schema=public'
$env:REDIS_URL = 'redis://localhost:6379'
$env:API_PORT = '4000'
Remove-Item Env:PORT -ErrorAction SilentlyContinue # PORT otherwise takes precedence
$env:OVERLAY_API_URL = "http://localhost:$env:API_PORT"
$env:NEXT_PUBLIC_API_URL = $env:OVERLAY_API_URL
$env:SUPABASE_URL = 'https://YOUR-DEV-PROJECT.supabase.co' # replace
$env:NEXT_PUBLIC_SUPABASE_URL = $env:SUPABASE_URL
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'YOUR-DEV-PUBLIC-ANON-KEY' # replace
$env:SEED_ADMIN_EMAIL = 'YOUR-CONFIRMED-SUPABASE-EMAIL' # replace
$env:AUTOMATION_INGEST_TOKEN = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:JWT_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:PICK_HASH_PEPPER = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
npm.cmd run db:up
npm.cmd run prisma:generate
npm.cmd run db:deploy
npm.cmd run build -w @overlay/shared
npm.cmd run db:seed
Start-Process powershell.exe -WorkingDirectory (Get-Location).Path -ArgumentList '-NoExit', '-Command', 'npm.cmd run start:dev -w @overlay/api'
Start-Process powershell.exe -WorkingDirectory (Get-Location).Path -ArgumentList '-NoExit', '-Command', 'npm.cmd run dev -w @overlay/web'
```

The child windows inherit these variables, so the API and runner have the **same random ingest token** without printing or persisting it. If you start the API manually in a different shell, privately set the same value there. Any suitably long random value (32+ characters) is fine for local use. Keep the original runner shell open; regenerating its token without restarting the API will cause `401`. Wait until both servers are ready; `Invoke-RestMethod "$env:OVERLAY_API_URL/api/health/ready"` should return `status=ok`. The runner checks readiness before any collection/drafting when `--submit` is selected, but does not send its ingest credential to the health route. It fails early if the API, Postgres, or Redis is unavailable. `content:local` deliberately refuses non-loopback submission targets.

### 3. Make the reviewer an admin

Create/confirm a development Supabase Auth user with the exact email assigned to `SEED_ADMIN_EMAIL` (Supabase dashboard, or web `/signup` once running). `prisma/seed.mjs` (`npm run db:seed`) upserts that email into the **local** database with `role=admin`; it also adds demo content/tipsters/events, so run it only against a disposable development database. It promotes an existing matching user without changing its password. The API links the matching seeded email to the Supabase identity on first login.

Sign in at `http://localhost:3000/login` using the **Supabase account's password**, not the seed script's legacy password. Seeding does not create a Supabase identity. If the account has an explicit `app_metadata.role` in Supabase, that trusted role overrides the local role: use the development project's admin dashboard/Admin API to set `app_metadata.role` to `admin`, then sign out/in to refresh the JWT. Do not set `user_metadata.role=admin`; self-selected metadata cannot grant administrator privileges. No local auth bypass is added.

### 4. Dry run, submit, and review

In the original runner PowerShell window:

```powershell
npm.cmd run content:local -- --kind article --max 2
npm.cmd run content:local -- --kind article --max 2 --submit
Start-Process 'http://localhost:3000/admin/editorial'
# Optional scoped run (enabled competition keys/names, comma-separated):
npm.cmd run content:local -- --kind article --competitions 'premier-league,championship' --max 2
# Skip the article copy-edit stage when needed:
npm.cmd run content:local -- --kind article --max 2 --no-copyedit
# Tips keep all licensed-data/recency gates; RSS alone cannot justify a tip:
npm.cmd run content:local -- --kind tip --max 2
```

All evidence, raw draft, pre-edit validated, edited and final validated JSON plus `summary.json` are under timestamped `.content-local/` directories, which are gitignored. The copy-edit pass reads the runtime body of `.github/skills/overlay-copy-edit/SKILL.md` and the validated drafts/evidence as sandbox files; Copilot can read/write only inside that workspace, with shell and web tools denied and only the draft-stage Copilot environment allowlist. Article research dates are recorded as reviewer warnings (`Researched <date> UTC from public feed summaries`), not body text. The second validation repeats fact, attribution, source-rights, freshness, verbatim and safety checks. A fact-preservation violation reverts that article to its pre-edit version with a `Copy edit rejected: reason` warning. Copy-lint issues are reviewer warnings (`Copy lint: details`) and do not by themselves drop a valid draft. Collection uses `.content-local/feed-cache.json` to respect the six-hour minimum polling interval and conditional GETs. `.content-local/feed-news.json` retains bounded reader snippets so a dry run followed immediately by `--submit` can use the same evidence without re-polling; original source timestamps are never refreshed. Only enabled, selected, still-recent (under 24 hours) feed evidence is reused after interval/304 skips. Do not delete the caches just to force more requests. Licensed fixture/odds collection is always rerun; stale quotes are never made fresh by caching. Failed stages stop downstream execution and print the retained output directory.

A successful zero-candidate result is valid: news snippets may lack enough corroboration for an article, and tips require licensed fixtures, performance data, current team news and fresh named-bookmaker odds. No candidate means nothing appears in the queue, even with `--submit`. `--max` is 0?5; zero explicitly skips Copilot. Invalid/missing CLI/auth, required submission settings, and API readiness failures stop before collection. Review sources, warnings, originality, factual support and current tip expiry in `/admin/editorial`; only a human admin can approve publication. Submitting does not publish.

For an RSS-only connectivity check with no Copilot/auth step:

```powershell
node --experimental-strip-types scripts\content-automation\cli.mjs collect --out .content-local\rss-check.json --feed-cache .content-local\feed-cache.json
```

## GitHub Actions

Two scheduled workflows use the same local Node pipeline and this document's draft-only API contract:

- `.github/workflows/content-news-drafts.yml`: 07:00 and 17:00 UTC.
- `.github/workflows/content-tip-drafts.yml`: 08:00 and 14:00 UTC, ahead of common kickoff windows.

Each also supports `workflow_dispatch` with `dry_run` (default `true`), comma-separated enabled competition keys/names (blank selects all enabled competitions), and `max_drafts` (0–5). Scheduled runs submit validated drafts; manual runs submit only when `dry_run=false`. Both have a 30-minute timeout, per-workflow non-cancelling concurrency, and `contents: read` only. Ingestion uses only `/api/automation/runs`, `/api/automation/drafts/articles`, `/api/automation/drafts/free-tips`, and `/api/automation/runs/:id/finish`; no workflow can publish.

### Configuration

Required repository secrets:

- `COPILOT_GITHUB_TOKEN`: fine-grained PAT with **Copilot Requests** permission; used only by the Copilot step.
- `API_FOOTBALL_API_KEY` and `THE_ODDS_API_KEY`: provider credentials; used only by collection. Each can fall back to `SPORTS_API_KEY` for compatibility, but separate credentials are preferred.
- `AUTOMATION_INGEST_TOKEN`: the machine-ingestion bearer token; used only by submission.
- `OVERLAY_API_URL`: API origin/base URL without `/api` (for example `https://api.example.org`); used only by submission.

Repository variables `API_FOOTBALL_LICENSE_APPROVED` and `THE_ODDS_API_LICENSE_APPROVED` default to false; provider collection is skipped entirely until the actual contracts explicitly clear automated grounding, commercial derived use, attribution, and evidence retention. The corresponding provider secret is required only when its approval variable is true. Optional variable `SPORTS_ODDS_REGIONS` uses the existing sports configuration allowlist; the collector takes only the first valid region (default `eu`) to bound recurring quota usage. Public news feeds are enabled by default independently of these provider contract gates. See Consumption policy below; public access does not establish a reuse licence.

### Consumption policy

At the owner's direction (30 October 2026), news collection consumes publisher-offered public RSS/Atom feeds like a reader; the owner accepted residual publisher Terms-of-Service risk, including identified AI/commercial-use restrictions. This is a business decision, not a finding of permission or legal clearance. Existing sports-provider licensing gates and free-tip evidence gates are unchanged.

- `scripts/content-automation/sources.mjs` is the per-feed allow/deny catalog, with `enabled` and `termsNote`. BBC Sport football, Sky Sports football and Guardian football RSS are enabled. All three have reviewer-facing terms notes (BBC/Guardian restrictions; Sky's complete applicable terms unverified). No club feed is guessed or enabled without a verified offered endpoint.
- `CONTENT_NEWS_FEEDS_ENABLED=false` (also `0`/`off`) is the kill switch; unset/blank defaults on. `CONTENT_NEWS_FEEDS` optionally selects comma-separated catalog IDs (`bbc,sky,guardian`); `CONTENT_NEWS_FEEDS_DENY` overrides selections. Unknown IDs fail configuration validation. Disabling an individual feed's catalog flag always wins.
- Only catalog feed URLs and their origin's `/robots.txt` are fetched, with an honest `OverlayPicks/1.0` reader User-Agent. No HTML crawling, linked article retrieval, login/paywall access, redirect following, mirrors or bypasses. A robots disallow for this agent/feed path skips the feed; 404 means no robots rules, other inaccessible/invalid robots responses fail closed. General or OverlayPicks-specific groups, wildcard paths and longest-match allow/disallow rules are checked.
- News runs remain 07:00/17:00 UTC. Optional `collect --feed-cache PATH` saves only ETag, Last-Modified and last-attempt metadata, never article bodies. The news workflow restores/saves this metadata through Actions cache, applies a six-hour per-feed minimum between attempts, and sends conditional GETs. Cache eviction may lose request history; the twice-daily schedule remains the baseline frequency. A 304 yields no new evidence; no stored article is replayed. Failed/blocked feeds are skipped with bounded reasons in `policyGates.skippedFeeds`, not retried during the run. The tip workflow disables feeds to avoid extra polling.
- XML responses are bounded to 512 KiB, reject DTD/entities and non-feed HTML. Only headline, at most 60 words/400 characters of description/summary, article link, publisher and publish time are retained as news evidence, plus provenance/policy metadata. Full RSS `content:encoded` and Atom `content` are ignored, never saved or passed to Copilot. No images. General football feeds are conservatively filtered for an explicitly named selected Phase-1 English competition and exclude identified women/youth/international/non-English stories; ambiguous items are omitted. Reviewers must verify final competition identity.
- Copilot must synthesize facts from at least two independent publishers into original prose, name and link each source, and return no candidates if snippets cannot support the article. Validation checks every evidence headline/snippet for any normalized consecutive overlap of **25 or more words**, and rejects missing publisher attribution or source URLs. This detects long verbatim copying, not every form of plagiarism or factual error; humans still verify originality, facts and terms warnings. `termsNote` is copied into API-compatible `reviewerWarnings` automatically.

Offline verification (no live network or Copilot required; PowerShell):

```powershell
node --experimental-strip-types scripts\content-automation\cli.mjs collect --fixture scripts\content-automation\fixtures\providers.json --out .content-fixture-run\evidence.json
node --experimental-strip-types scripts\content-automation\cli.mjs validate --kind article --evidence .content-fixture-run\evidence.json --input scripts\content-automation\fixtures\empty-drafts.json --out .content-fixture-run\validated.json
Remove-Item -Recurse .content-fixture-run
```

The fixture feed dates are refreshed at collection time. Zero drafts is intentional for the smoke flow; unit tests exercise accepted multi-source articles, feed parsing, robots skips, conditional GETs and rejected copying/attribution.

### Dry runs and costs

Use Actions → either workflow → **Run workflow**, leave `dry_run=true`, select competitions and set a small `max_drafts`. It still collects evidence, calls Copilot to draft and (for news) copy-edit, and performs deterministic validation; the job summary displays bounded final validated payloads and drop reasons, but no ingestion run or draft is created. Dry-run is not cost-free: it consumes Copilot AI Credits and GitHub Actions minutes, while provider requests can consume API quota/credits. Scheduled execution adds two runs per workflow per day. Restrict provider markets/competition overrides and monitor provider and Copilot usage; provider/API failures fail closed.

### Trust boundary and controls

Provider collection is deterministic, bounded, and separate from drafting. Provider keys never enter the Copilot step. Copilot receives only the evidence JSON in a per-run isolated directory and its prompt file; the evidence is explicitly untrusted data, not instructions. The CLI grants only read/write file tools (`--allow-tool=read --allow-tool=write --deny-tool=shell --deny-tool=web_search --deny-tool=web_fetch --no-ask-user`), with no shell or web/network tool; evidence is read-only, only the one pre-created output JSON is writable, unexpected files fail the step, and `AUTOMATION_INGEST_TOKEN` is not present in the Copilot environment. Deterministic validation rejects unsupported API fields, disabled competitions/markets, stale odds, prohibited wording, insufficient sources, URLs absent from evidence, and drafts that fail the source-policy gates. Invalid output fails before submission. A zero-candidate result is successful. Provider, Copilot, or fatal validation errors skip submission and fail the run. API dedupe results (including duplicate 409 responses) are idempotent successes. Temporary workflow evidence stays in the hosted runner work directory; do not upload it as an artifact or place provider payloads/secrets in logs.

The repository's GitHub Agentic Workflows (`github/gh-aw`) guidance was considered. Direct Copilot CLI is used here because the workflow needs a small, explicit provider → isolated drafting → deterministic-validation → draft-only API pipeline, with no autonomous code edits or publication capability; adding a second workflow framework would not eliminate the source-rights/API trust boundary. Re-evaluate `gh-aw` if its sandbox/policy model becomes part of the repository's standard runtime.

The API expiry rule matches `CONTENT-SOURCES.md` section 6.3: expiry must be no later than the configured kickoff approval cutoff (60 minutes by default), and approval rechecks both expiry and cutoff freshness. The collector also lacks licensed match-history, verified senior-men/venue eligibility, complete squad-availability and suspension checks, and current team-news evidence for both teams; these missing gates independently block a strong candidate under the policy. Provider competition discovery uses exact supported registry names rather than assumed provider IDs; unmatched Odds API sport titles safely produce no odds data. The ingestion API exposes exact-key idempotency but no seven-day semantic duplicate search, so each article carries a reviewer warning to compare pending, published, and rejected coverage before approval.

## Database-backed integration verification

`apps/api/src/modules/automation/automation.itest.ts` invokes the real automation,
editorial, article and free-tip services against PostgreSQL. Only the article
cache uses an in-memory store. A test-local TypeScript transpiler loads Nest
services under the existing strip-only test runner; production code is unchanged.
Read barriers make competing reviews and stale edits deterministic while all
writes and audit transactions execute in the database.

Run from the repository root in PowerShell, without changing any `.env` file:

```powershell
npm.cmd run db:up
$env:DATABASE_URL = 'postgresql://overlay:overlay@localhost:5432/overlay?schema=public'
npx.cmd prisma migrate deploy --schema prisma\schema.prisma
npm.cmd run prisma:generate
npm.cmd run build -w @overlay/shared
npm.cmd run test:integration
npm.cmd run test:unit
```

The automation suite skips when `DATABASE_URL` is unset, before loading Prisma
(which can otherwise populate environment variables from its generated-client
configuration). Other existing integration suites may still default to the local
compose database. Fixtures use unique prefixes and unused future UTC tip dates;
cleanup removes only this suite's rows and restores policy environment variables.
Coverage includes provenance, idempotency, all-status daily caps, expiry/public
visibility, review/edit races, audit atomicity and UTC kickoff-date edits.
