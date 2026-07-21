# SERVIO Kargo

Multi-tenant SaaS for cargo companies shipping **China (Guangzhou / Yiwu) → Uzbekistan**.

Every cargo company (= tenant) on the platform gets:

- **Its own branded Telegram bot** for customers — register track codes, receive automatic
  status notifications, check balance/debt, calculate shipping cost, get the China warehouse
  address with their personal client code (e.g. `DK-1042`).
- **A mobile-first web admin panel** (Uzbek UI) — Excel/text import of track codes, bulk
  status updates, weighing with automatic pricing, debt tracking and reminders, batches
  (reyslar), broadcasts, warehouse photos.

One codebase serves every company. Onboarding a new tenant is a single form at `/sa`: the
system validates the BotFather token, sets the Telegram webhook, and creates the company —
no code changes, under 5 minutes ([ONBOARDING.md](./ONBOARDING.md)).

**Why:** cargo companies drown in daily "yukim qayerda?" (*where is my package?*) messages
and track everything in Excel or on paper. SERVIO Kargo answers those messages automatically
and replaces the spreadsheets.

## How it works

```
CREATED → CHINA_WAREHOUSE → IN_TRANSIT → TASHKENT_WAREHOUSE → READY_FOR_PICKUP → DELIVERED
                                (terminal side-states: LOST, RETURNED)
```

Warehouse staff weigh parcels through the bot's staff mode (`CODE 3.2` → weight, price,
photo). Admins import track codes and move whole batches through the pipeline from the
panel. Every status change appends to an audit log and queues a Telegram notification to
the customer — throttled to respect Telegram rate limits, retried with backoff.

## Tech stack

| Layer          | Choice                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Language       | TypeScript everywhere, strict mode                                       |
| Monorepo       | pnpm workspaces (Node ≥ 20, pnpm 10)                                     |
| Admin panel    | Next.js 14 (App Router), Tailwind CSS, Radix UI                          |
| Telegram bots  | grammY — one process serves all tenants' bots (webhook mode)             |
| Database       | PostgreSQL (Docker images pin `postgres:16`) + Drizzle ORM migrations    |
| Job queue      | pg-boss (Postgres-backed, no Redis) for **all** outbound Telegram sends  |
| Validation     | Zod on every external input                                              |
| Tests / logs   | Vitest / pino                                                            |
| Deploy         | Docker Compose on a single VPS, Caddy for automatic HTTPS                |

## Repository layout

```
apps/
  web/       Next.js admin panel: login, dashboard, tracks, import, customers,
             debtors, batches, broadcast, settings + /sa super-admin area
  bot/       grammY multi-bot server: webhook routing per tenant, customer flows,
             staff mode, pg-boss workers (notifications, reminders, broadcasts)
packages/
  db/        Drizzle schema + SQL migrations, pg-boss queue module, demo seed
  shared/    Business-logic services (+ Vitest tests), i18n (uz/ru), status enums,
             track-code normalization, money formatting
scripts/     backup.sh — nightly pg_dump, keeps 14 days
Caddyfile                  HTTPS: admin panel at DOMAIN, webhooks at bot.DOMAIN
docker-compose.yml         Local dev — just Postgres
docker-compose.prod.yml    Production — postgres + web + bot + caddy
deploy.sh                  Pull → build → migrate → restart; safe to re-run
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
put its token on a tenant row (update the seeded tenant's `bot_token`, or onboard through
`/sa` — that path requires `WEBHOOK_BASE_URL` to be set), and keep `BOT_POLLING=true`.
Polling mode deletes any webhook on startup and needs no public URL; set
`BOT_POLLING_TOKEN=<token>` to poll just your tenant.

## Commands

| Command                        | What it does                                          |
| ------------------------------ | ----------------------------------------------------- |
| `pnpm dev`                     | web (`:3000`) + bot (`:8443`) in watch mode           |
| `pnpm test`                    | Vitest — money, debt, pricing, statuses, normalization |
| `pnpm lint` / `pnpm typecheck` | must pass before any task counts as done              |
| `pnpm db:generate`             | generate a SQL migration from schema changes          |
| `pnpm db:migrate`              | apply migrations                                      |
| `pnpm db:seed`                 | seed the SERVIO Kargo demo tenant                     |
| `pnpm build`                   | build all workspaces                                  |
| `pnpm format`                  | Prettier over the repo                                |

## Production

A single Ubuntu VPS running Docker Compose. Caddy terminates HTTPS for two hostnames —
`DOMAIN` (admin panel) and `bot.DOMAIN` (Telegram webhooks) — with certificates obtained
and renewed automatically. Deploys are `./deploy.sh`: pull, build, run migrations, restart;
named volumes keep the database and uploaded photos across deploys. A nightly `pg_dump`
cron keeps the last 14 days of backups.

First-time setup, step by step: **[DEPLOY.md](./DEPLOY.md)**. Configuration lives in a
single `.env` (copy [`.env.example`](./.env.example) and fill it in).

## Documentation

| File                             | Contents                                                              |
| -------------------------------- | --------------------------------------------------------------------- |
| [PROJECT.md](./PROJECT.md)       | Architecture, domain model, flows, operations — how the system works   |
| [Spec.md](./Spec.md)             | Functional specification: exact flows, screens, message texts, rules   |
| [CLAUDE.md](./Claude.md)         | Engineering ground rules (stack, conventions, definition of done)      |
| [DEPLOY.md](./DEPLOY.md)         | First-time VPS deployment guide                                        |
| [ONBOARDING.md](./ONBOARDING.md) | Checklist for connecting a new cargo company (Uzbek)                   |
