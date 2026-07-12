# How to Run Overlay Bets

A step-by-step guide to get the platform running locally, then push it to GitHub.
Everything runs **offline with mock providers** — no Stripe or sports-data API
keys are required for a first test.

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| **Node.js** | ≥ 22 | `node -v` |
| **npm** | ≥ 10 | `npm -v` |
| **Docker Desktop** | any recent | `docker -v` |
| **Git** | any recent | `git -v` |

> This repo uses **npm workspaces** (not pnpm). Just use `npm`.

---

## 2. Install dependencies

From the repository root (`overlay-bets/`):

```bash
npm install
```

This installs all workspaces: `packages/shared`, `apps/api`, `apps/web`.

---

## 3. Start Postgres + Redis

```bash
npm run db:up      # docker compose up -d (Postgres :5432, Redis :6379)
```

Stop them later with `npm run db:down`.

---

## 4. Configure environment

```bash
cp .env.example .env
```

The defaults work out of the box for local testing:

- `DATABASE_URL` → the docker Postgres
- `PAYMENTS_PROVIDER=mock` → no Stripe needed
- `SPORTS_API_PROVIDER` → set to `mock` for keyless testing (see note below)
- `WORKER_MODE=interval` → no Redis needed for the worker

> **Tip:** For a fully keyless first run, set `SPORTS_API_PROVIDER=mock` in `.env`.
> Switch to `the-odds-api` / `api-football` later once you have keys.

---

## 5. Set up the database

```bash
npm run prisma:generate     # generate the Prisma client
npm run prisma:migrate      # create tables (name the migration e.g. "init")
npm run db:seed             # admin user + 3 starter blog articles
```

The seed prints the admin credentials (defaults: `admin@overlay.local` /
`change-me-now` — override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

---

## 6. Run the apps

Open **two terminals** from the repo root:

**Terminal 1 — API** (http://localhost:4000)
```bash
npm run start:dev -w @overlay/api
```

**Terminal 2 — Web** (http://localhost:3000)
```bash
npm run dev -w @overlay/web
```

Then open **http://localhost:3000**.

### (Optional) Settlement worker

The worker grades picks, captures closing odds, and recomputes stats. It's
**not required** for a first click-through, but to run it:

```bash
# Build once, then run (interval mode — no Redis needed)
npm run build -w @overlay/api
npm run start:worker -w @overlay/api

# Or queue mode (needs Redis, which db:up already started):
WORKER_MODE=queue npm run start:worker -w @overlay/api
```

---

## 7. Try the full flow

1. **Browse** the leaderboard and the **/blog** (seeded articles).
2. **Sign up** at `/signup` as a **Tipster** → you land on **/dashboard**.
3. **Ingest events** so there's something to pick (admin-only). Easiest path:
   sign up/promote an admin, or use the seeded admin to call:
   ```bash
   # log in to get a token, then:
   curl -X POST http://localhost:4000/api/events/ingest \
     -H "authorization: Bearer <ADMIN_JWT>" \
     -H "content-type: application/json" \
     -d '{"sport":"soccer"}'
   ```
   (With `SPORTS_API_PROVIDER=mock`, this returns mock fixtures.)
4. **Submit a pick** from the dashboard — it's hash-locked instantly.
5. In another account, **subscribe** to a tipster from their profile → the mock
   checkout returns to `/subscribe/success` and activates the subscription.
6. **Admin** endpoints live under `/api/admin/*` (dashboard, users, audit log).

---

## 8. Run the tests

Pure-logic tests run with **zero install** using Node's native type stripping:

```bash
npm run test:unit     # stats, integrity, content, payouts, vendor mappers
```

---

## 9. Push to GitHub

The project is already a git repo. To publish it:

```bash
# 1. Create an EMPTY repo on GitHub (no README/license), copy its URL.

# 2. From overlay-bets/:
git remote add origin https://github.com/<you>/overlay-bets.git
git branch -M main
git push -u origin main
```

> `.gitignore` already excludes `node_modules`, `.env`, build output, and
> Prisma artifacts, so no secrets are committed. Double-check with
> `git status` before pushing.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `corepack`/`pnpm` errors | Ignore — this repo uses **npm**, not pnpm. |
| Web can't reach API (CORS) | Ensure API is on `:4000` and `CORS_ORIGINS` includes `http://localhost:3000`. |
| `prisma migrate` can't connect | Is `npm run db:up` running? Check `docker ps`. |
| Port already in use | Change `API_PORT` (.env) or the web port in `apps/web/package.json`. |
| Worker won't start in queue mode | Redis must be up (`npm run db:up`) and `REDIS_URL` set. |
| Type errors on `npm run build` | Run `npm run build` and share the output — some adapter response shapes need live validation. |

---

## What needs real keys (later, for production)

- **Stripe** — set `PAYMENTS_PROVIDER=stripe`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and wire Connect onboarding.
- **Sports data** — set `SPORTS_API_PROVIDER` + `SPORTS_API_KEY`
  (see `docs/VENDOR-SPIKE.md`).
- **Email / Web Push** — `RESEND_API_KEY`, `VAPID_*`.

See `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` (Phase 4) for the hardening
checklist before going live.
