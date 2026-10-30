# Free launch access mode

The API is authoritative. `FREE_ACCESS_MODE` defaults to `false`; set it to the literal `true` to make tipster picks public, bypass subscription entitlements, and disable new payment/payout operations. Render production is configured with the flag enabled. The web client should use `NEXT_PUBLIC_FREE_ACCESS_MODE=true` for presentation only; it is not an authorization control.

In free mode, `GET /api/picks/feed` returns active-tipster picks publicly. `GET /api/picks/tipster/:tipsterId/live` accepts anonymous reads; the existing authenticated `/api/picks/me/feed` and user feed export also include the public catalog. Tipster profiles are cached under separate paid/free keys so a mode flip cannot reuse a gated payload. Public responses are explicitly projected and never include pick hashes or nonces. Pick lock cutoff, timing validation, commitment generation, and immutability are unchanged.

Checkout, dev-confirm, billing portal session creation, payout requests, scheduled payouts, and approvals return HTTP 409 with `{ "code": "PAYMENTS_DISABLED" }` or `{ "code": "PAYOUTS_DISABLED" }`. Signed subscription and transfer webhooks remain enabled for safe reconciliation. Notifications retain existing user preferences and opt-in behavior.

Demo seed tipsters, their picks, synthetic fixtures, sample free tips, and `world-cup-final-preview` are seeded only outside production unless `SEED_DEMO_DATA=true` is explicitly set. Before deleting existing demo data, review a local dry run:

```powershell
npm.cmd run ops:purge-demo-data
npm.cmd run ops:purge-demo-data -- --confirm
```

The purge defaults to a count-only dry run and deletes only tipsters with `@overlay.local` addresses plus their dependent records, the known demo article/free-tip identifiers, and seeded events that are unreferenced. Never run the purge against a remote or production database.
