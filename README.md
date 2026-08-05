# SERVIO Kargo

Multi-tenant SaaS for cargo companies shipping **China (Guangzhou / Yiwu) → Uzbekistan**.
Cargo companies drown in daily "yukim qayerda?" (*where is my package?*) messages and track
everything in Excel or on paper. SERVIO Kargo answers those messages automatically and
replaces the spreadsheets.

Every cargo company (= tenant) gets:

- **Its own branded Telegram bot** for customers — register track codes, receive automatic
  status notifications, check balance/debt, calculate shipping cost, get the China warehouse
  address with their personal client code (e.g. `DK-1042`).
- **A mobile-first web admin panel** (uz / ru) — Excel/text import of track codes, bulk
  status updates, weighing with automatic pricing, debt tracking and reminders, batches
  (reyslar), broadcasts, warehouse photos, team management with enforced roles.

Onboarding a new tenant is a single form at `/sa`: the system validates the BotFather token,
sets the Telegram webhook, and creates the company — no code changes, under 5 minutes
([docs/ONBOARDING.md](./docs/ONBOARDING.md)).

```
CREATED → CHINA_WAREHOUSE → IN_TRANSIT → TASHKENT_WAREHOUSE → READY_FOR_PICKUP → DELIVERED
                                (terminal side-states: LOST, RETURNED)
```

Warehouse staff weigh parcels through the bot's staff mode (`CODE 3.2` → weight, price,
photo). Admins import track codes and move whole batches through the pipeline from the
panel. Every status change appends to an audit log and queues a Telegram notification —
throttled to respect Telegram rate limits, retried with backoff.

## Architecture

Everything runs on one VPS under Docker Compose: four containers — `postgres`, `web`,
`bot`, `caddy`. Only Caddy publishes ports.

```
   Customers (Telegram apps)          Admins (phone browsers)
              │                                 │
              ▼                                 ▼
      Telegram Bot API                          │
        │ webhooks ▲ sends (throttled)          │
        ▼          │                            ▼
┌──────────────────┴────── single VPS · Docker Compose ─────────────┐
│                                                                   │
│  caddy :80/:443 — automatic HTTPS (Let's Encrypt)                 │
│    ├─ https://{DOMAIN}     → web:3000   (admin panel, /sa)        │
│    └─ https://bot.{DOMAIN} → bot:8443   (webhook + health server) │
│                                                                   │
│  web  (apps/web, Next.js)         bot  (apps/bot, grammY)         │
│   · screens + server actions       · POST /webhook/:botToken      │
│   · enqueues notification /        · customer + staff handlers    │
│     reminder / broadcast jobs      · pg-boss workers consume and  │
│         │                            send with rate limiting      │
│         ▼                                │                        │
│  postgres (Drizzle tables + pg-boss job tables)                   │
│                                                                   │
│  uploads volume → /data/uploads — warehouse photos,               │
│  written by bot (staff mode), served by web                       │
└───────────────────────────────────────────────────────────────────┘
```

One bot process serves all tenants: each tenant has its own BotFather token, Telegram
posts updates to `/webhook/:botToken`, and the token resolves the tenant. Adding a
tenant = one DB row + one `setWebhook` call — no restart, no code.

**Stack:** TypeScript (strict) · pnpm workspaces (Node ≥ 20, pnpm 10) · Next.js 14 App
Router + Tailwind + Radix + next-intl (uz/ru) · grammY · PostgreSQL 16 + Drizzle ·
pg-boss for **all** outbound Telegram sends · Zod on every external input · Vitest · pino ·
GitHub Actions → GHCR → Docker Compose behind Caddy.
Full rules and conventions: [CLAUDE.md](./CLAUDE.md).

```
apps/web/       admin panel + /sa super-admin area + the public marketing landing (/, /ru)
apps/bot/       grammY multi-bot server: webhook routing, customer flows, staff mode,
                pg-boss workers (notifications, reminders, broadcasts)
packages/db/    Drizzle schema + SQL migrations, pg-boss queue module, demo seed
packages/shared/business-logic services (+ tests), i18n (uz/ru), status enums, track-code
                normalization, money formatting, permissions matrix
docs/           DEPLOY.md (VPS + CI/CD setup), ONBOARDING.md (connect a company)
scripts/        backup.sh — nightly pg_dump, keeps 14 days
deploy.sh       sync → build (or --pull) → migrate → restart → health-gate
```

## Quick start (local dev)

Prerequisites: **Node.js ≥ 20**, **pnpm 10** (`corepack enable`), **Docker**.

```bash
pnpm install
docker compose up -d        # Postgres on localhost:5432 (user/pass/db: kargotrack)
```

Create three workspace env files (all gitignored):

```bash
# packages/db/.env         — used by migrations and the seed
DATABASE_URL=postgres://kargotrack:kargotrack@localhost:5432/kargotrack

# apps/web/.env
DATABASE_URL=postgres://kargotrack:kargotrack@localhost:5432/kargotrack
SESSION_SECRET=dev-session-secret-please-change-32chars
SUPERADMIN_TOKEN=dev-superadmin-token
UPLOADS_DIR=/data/uploads   # any writable directory
NEXT_PUBLIC_APP_URL=http://localhost:3000

# apps/bot/.env
DATABASE_URL=postgres://kargotrack:kargotrack@localhost:5432/kargotrack
PORT=8443
BOT_POLLING=true            # long-poll Telegram in dev — no public HTTPS needed
UPLOADS_DIR=/data/uploads
```

Then:

```bash
pnpm db:migrate   # create tables
pnpm db:seed      # demo tenant "SERVIO Kargo demo": customers, 30 tracks, payments, debt
pnpm dev          # web on :3000, bot on :8443
```

Log in at <http://localhost:3000/login> with the seeded owner — phone `+998901234567`,
password `demo123`. The super-admin area is at `/sa` (asks for your `SUPERADMIN_TOKEN`).

**Talking to a real bot in dev:** create a bot via [@BotFather](https://t.me/BotFather),
put its token on a tenant row (update the seeded tenant's `bot_token` — the seed ships a
deliberately fake one — or onboard through `/sa`, which requires `WEBHOOK_BASE_URL`), and
keep `BOT_POLLING=true`. Polling mode deletes any webhook on startup and needs no public
URL; set `BOT_POLLING_TOKEN=<token>` to poll just your tenant.

| Command                        | What it does                                          |
| ------------------------------ | ----------------------------------------------------- |
| `pnpm dev`                     | web (`:3000`) + bot (`:8443`) in watch mode           |
| `pnpm test`                    | Vitest — money, debt, pricing, statuses, normalization |
| `pnpm lint` / `pnpm typecheck` | must pass before any task counts as done              |
| `pnpm db:generate`             | generate a SQL migration from schema changes          |
| `pnpm db:migrate`              | apply migrations                                      |
| `pnpm db:seed`                 | seed the demo tenant (⚠️ TRUNCATEs every table first)  |
| `pnpm build`                   | build all workspaces                                  |
| `pnpm format`                  | Prettier over the repo                                |

## Known quirks

- `next build` in `apps/web` has been seen exiting 1 locally with a spurious
  `PageNotFoundError` even after compiling successfully — rely on typecheck/lint/test
  locally; the authoritative build is the one the deploy workflow runs inside the Docker
  image, and it gates the deploy.
- A stale production build left in `apps/web/.next` makes `next dev` 404 on every page —
  delete `.next` and restart.

## Production

Pushing to `main` deploys itself: GitHub Actions verifies (typecheck + lint), builds the
web and bot images and pushes them to GHCR tagged with the commit SHA, then SSHes to the
VPS, which pulls those images, runs migrations and restarts — failing the run if either
service does not come back `healthy`. The VPS never builds anything. Rollback is
`IMAGE_TAG=<sha> ./deploy.sh --pull`; `./deploy.sh` with no flag still builds on the server
if you need to deploy without GitHub. Named volumes keep the database and uploaded photos
across deploys; a nightly `pg_dump` keeps the last 14 days.

First-time VPS setup, the CI secrets and rollback, step by step:
**[docs/DEPLOY.md](./docs/DEPLOY.md)**. Configuration lives in a single `.env` (copy
[`.env.example`](./.env.example) and fill it in).

## Documentation

| File                                       | Contents                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| [SPEC.md](./SPEC.md)                       | Functional specification: exact flows, screens, message texts, rules — **the contract**  |
| [CLAUDE.md](./CLAUDE.md)                   | Engineering ground rules (stack, conventions, definition of done)                        |
| [docs/DEPLOY.md](./docs/DEPLOY.md)         | First-time VPS deployment + GitHub Actions CI/CD setup                                   |
| [docs/ONBOARDING.md](./docs/ONBOARDING.md) | Connecting a new cargo company, step by step (uz)                                        |
| [AUDIT.md](./AUDIT.md)                     | Working document: open tasks (T9–T24) + the archive the `AUDIT.md T…` code comments cite |
