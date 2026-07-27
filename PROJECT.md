# PROJECT.md — SERVIO Kargo Architecture & Engineering Overview

The technical companion to [Spec.md](./Spec.md) (functional spec — exact flows, screens,
message texts) and [README.md](./README.md) (quick start). Read this to understand how the
system is put together before changing it. `§` references below point into Spec.md.

**Status (July 2026):** MVP is feature-complete against Spec.md v2 — all customer bot
flows, staff mode, admin panel screens, super-admin onboarding, the notification/reminder/
broadcast queues, and the production Docker deployment are implemented. Deliberate
exclusions are listed in [§ Scope](#scope) below.

---

## 1. Product and roles

Cargo companies moving parcels China → Uzbekistan get a shared platform. Customers never
see a web page; admins never need a desktop.

| Role                          | Surface                              | Can do                                                                     |
| ----------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| **Customer**                  | The tenant's Telegram bot, only      | Register, add/claim track codes, look up status, balance, price calculator |
| **Tenant admin** (owner/staff)| Web panel + bot "staff mode" (§3.8)  | Import, statuses, weighing, payments, debtors, batches, broadcast, settings |
| **Super-admin** (platform)    | `/sa`, guarded by `SUPERADMIN_TOKEN` | Onboard tenants, re-set webhooks, enable/disable                            |

## 2. System architecture

Everything runs on one VPS under Docker Compose (`docker-compose.prod.yml`): four
containers — `postgres`, `web`, `bot`, `caddy`. Only Caddy publishes ports; Postgres and
the apps talk over the internal network.

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

### 2.1 Multi-tenancy

- **Every domain table carries `tenant_id`, and every query is scoped by it.** Unscoped
  queries are forbidden (CLAUDE.md rule 1). Track codes are unique per tenant —
  `UNIQUE (tenant_id, code_normalized)` — so two companies can carry the same code.
- **One bot process serves all tenants.** Each tenant has its own BotFather token; Telegram
  posts updates to `/webhook/:botToken`, and the unguessable token doubles as the shared
  secret. `apps/bot/src/registry.ts` lazily builds and caches one grammY instance per
  tenant. Adding a tenant = one DB row + one `setWebhook` call — no restart, no code.
- Dev convenience: `BOT_POLLING=true` long-polls instead of webhooks (no public URL
  needed); `BOT_POLLING_TOKEN` narrows polling to a single tenant.

### 2.2 Outbound messaging — the queue

Telegram enforces ~30 msg/s per bot and 1 msg/s per chat, so **nothing sends directly**.
Producers (web server actions, bot handlers) enqueue; the workers in `apps/bot/src/worker.ts`
consume, throttle to the §8 budget (≤ 25 msg/s per bot, ≤ 1 msg/s per chat via
`rateLimiter.ts`), and send. `packages/db/src/queue.ts` is the single owner of pg-boss —
queue names, policies, and dedupe keys live in one place.

| Queue            | Policy     | Producer                                            | Dedupe                                                                      |
| ---------------- | ---------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| `notify`         | `short`    | Every status change (import, bulk ops, staff weigh) | `singletonKey(trackId, status)` — at most one *queued* job per key (§7.6)   |
| `reminder`       | `short`    | Debtor reminder buttons + weekly sweep              | Weekly: key `(customer, date)`; manual sends use a unique key so re-sending works |
| `reminder_sweep` | `standard` | pg-boss cron `0 * * * *` (Asia/Tashkent)            | Hourly tick; the worker picks tenants whose configured day+hour is now (§7.7) |
| `broadcast`      | `standard` | Admin broadcast screen (§5.8)                       | None — one job per recipient (§7.11)                                        |

All queues: retry ×5 with exponential backoff, `batchSize: 1` (a failure retries only its
own job), and jobs that fail after all retries are logged.

### 2.3 Reliability rules

- **The bot must never die** (CLAUDE.md rule 8). Every handler runs inside grammY's error
  boundary; `apps/bot/src/index.ts` traps `uncaughtException`/`unhandledRejection` and
  logs instead of exiting; a queue worker failing to start does not stop webhook serving.
- The webhook endpoint caps bodies at 1 MB and always ACKs processed updates with `200`
  so Telegram doesn't re-deliver them.
- Same-status writes are no-ops: no event, no notification (§2).
- Users get `error_generic` only when their own interaction failed; background errors are
  log-only.

## 3. Monorepo map

pnpm workspaces: `apps/*` are deployables, `packages/*` are libraries. Route/bot handlers
stay thin; the business core is `packages/shared/src/services`.

### `apps/bot` — multi-tenant Telegram bot server

| Path                | Role                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- |
| `src/index.ts`      | Entrypoint: HTTP server, three queue workers, polling-vs-webhook mode, error traps    |
| `src/server.ts`     | `GET /health` + `POST /webhook/:botToken`                                             |
| `src/registry.ts`   | Token → tenant resolution; lazy per-tenant grammY instance cache                       |
| `src/bot.ts`        | Bot factory: middleware stack, error boundary, handler wiring                          |
| `src/handlers/`     | One module per flow: `start` (language → phone → client code), `addTrack`, `lookup`, `calculator`, `china` (warehouse address), `staffPhoto`, `staffWeigh`, `menu`, `text` (free-text router), `common` |
| `src/worker.ts`     | pg-boss consumers: notifications, reminders (+ hourly sweep), broadcasts               |
| `src/rateLimiter.ts`| Outbound throttle (§8 budget)                                                          |
| `src/queries.ts`    | Tenant-scoped DB reads for handlers                                                    |
| `src/keyboards.ts` / `context.ts` / `config.ts` / `logger.ts` | Keyboards, per-update context (tenant, customer, i18n), env parsing, pino |

### `apps/web` — admin panel (Next.js 14 App Router, Uzbek UI)

| Path                             | Role                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `app/(app)/…`                    | Authenticated tenant screens, each with its server actions (`actions.ts`) beside it: `dashboard` (§5.10), `tracks` + `tracks/[id]` (§5.2–5.3), `import` (§5.4), `customers` + `customers/[id]` (§5.5), `debtors` (§5.6), `batches` + `batches/[id]` (§5.7), `broadcast` (§5.8), `settings` (§5.9) |
| `app/login`                      | Phone + password login (§5.1)                                                    |
| `app/sa`                         | Super-admin: onboarding form, webhook reset, enable/disable (§6)                 |
| `app/api/tracks/[id]/photo`      | Serves warehouse photos from `UPLOADS_DIR`                                       |
| `lib/`                           | `auth.ts` (argon2), `session.ts` (cookie), `queries.ts` / `sa-queries.ts` (scoped reads), `telegram.ts` (`getMe`/`setWebhook`), `xlsx.ts` (import parsing), `datetime.ts` (Asia/Tashkent), `status-ui.ts`, `reminder-actions.ts`, `superadmin.ts` |
| `components/`                    | Radix-based UI kit (`components/ui`) + domain widgets: status badge, debt cell, reminder button, empty states |

### `packages/shared` — the business core

| Path              | Role                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `src/services/`   | `addTrack` (multi-code parse + claim semantics §3.2/§7.3), `statusChange` (event append + notification enqueue), `price` (§7.4 incl. USD freeze + manual override), `debt` (§7.5), `import` (upsert planning §7.2), `batches` (bulk-move rules §7.10), `staff` (weigh / auto-create / CREATED→CHINA promotion §3.8), `reminder` (weekly due-logic §7.7), `notify` (job payloads + dedupe key), `broadcast`, `calc`, `clientCode`, `dashboard`, `myTracks`, `payment`, `tariffs` |
| `src/status.ts`   | The status pipeline: keys, order, labels, emojis                                          |
| `src/normalize.ts`| Track-code normalization (§7.1)                                                           |
| `src/format.ts`   | Money (`1 250 000 so'm`, `3.5$`) and date formatting                                      |
| `src/i18n/`       | Every user-facing string, `uz.ts` (default) + `ru.ts` — canonical texts in §4             |

Services touching money, debt, statuses, or normalization all have a `.test.ts` sibling
(Vitest) — this is a hard convention, not an accident.

### `packages/db` — schema, migrations, queue

| Path                | Role                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| `src/schema.ts`     | Drizzle schema — single source of truth for all tables and columns                 |
| `src/queue.ts`      | The only pg-boss owner: queue creation + policies, dedupe, retries, sweep schedule |
| `src/seed.ts`       | SERVIO Kargo demo tenant (owner admin, 5 customers, 30 tracks, payments)           |
| `drizzle/`          | Generated SQL migrations (`pnpm db:generate` / `db:migrate`)                       |
| `scripts/demo-import.ts` | Bulk demo import helper                                                       |

## 4. Domain model

Tables (columns detailed in `packages/db/src/schema.ts` and CLAUDE.md):

- `tenants` — company, bot token/username, currency (`UZS`/`USD`) + `usd_rate_tiyin`,
  pickup address, `settings` jsonb (staff Telegram IDs, China address template, info text,
  working hours, reminder toggles)
- `tariffs` — per-kg price per tenant; exactly one active default always exists
- `batches` — reys (flight/truck/train) with optional ETA; status limited to the three
  middle pipeline states
- `admin_users` — panel logins, argon2 hashes, `owner`/`staff` roles
- `customers` — Telegram identity, phone, `client_code` (tenant prefix + sequence,
  e.g. `DK-1042`), language
- `tracks` — the parcel: both code forms, current status, weight, prices, tariff, batch,
  photo, `deleted_at` (soft delete)
- `track_events` — **append-only audit log** of every status change (who, when, meta)
- `payments` — cash/Click/Payme/other, amounts in tiyin
- `broadcasts` — history with final sent counts

### Status pipeline (§2)

```
CREATED → CHINA_WAREHOUSE → IN_TRANSIT → TASHKENT_WAREHOUSE → READY_FOR_PICKUP → DELIVERED
                                (terminal side-states: LOST, RETURNED)
```

Admins may set *any* status — corrections happen, backward moves included — and every
change appends a `track_events` row and (for attached customers) queues a notification.
History is never overwritten. Changing a **batch** status applies it to every member track
that isn't terminal or soft-deleted, through the same bulk machinery (§7.10).

### Money & pricing (§7.4)

- Amounts are **integer tiyin** (1 so'm = 100 tiyin), or integer cents in USD mode.
  Never floats.
- UZS: `price_tiyin = round(weight_grams × tariff.price_per_kg_tiyin / 1000)`.
- USD: the cents price converts to som via the tenant's rate, and `usd_rate_used` is
  stored on the track — **the som price is frozen at weighing time**; later rate changes
  never alter existing tracks.
- Changing weight or tariff recomputes the price unless `price_manual = true` (admin
  override for bulky/negotiated cargo); toggling manual off recomputes.
- The bot always shows som; USD tenants also see the `$` amount.

### Debt (§7.5)

```
debt = Σ price of tracks in READY_FOR_PICKUP or DELIVERED (excluding soft-deleted)
     − Σ payments
```

Always in som. Negative debt is displayed as an advance (`Avans`), never a minus sign.
Implemented once, with tests, in `packages/shared/src/services/debt.ts` — not as scattered
SQL.

### Track codes (§7.1, §7.3)

Codes arrive messy (` yt-7583 234 uz `, CJK prefixes). Normalization: uppercase → strip to
`[A-Z0-9]` → valid at 8–20 chars. Both `code_original` and `code_normalized` are stored;
user input is matched after the same normalization. Claiming: an unattached track (codes
often arrive from China before any customer registers them) attaches to the first claimant;
a track owned by someone else is politely refused.

### Time & deletion

Timestamps are stored in UTC and rendered in Asia/Tashkent everywhere (§7.9). Soft-deleted
tracks (`deleted_at`) disappear from every list, lookup, debt calculation, and
notification (§7.8).

## 5. Key flows

**Customer (bot, §3):** `/start` → language → phone contact → client code + main menu.
Add-track accepts many codes in one message (any separators) and answers with a grouped
summary (added / claimed / owned by someone else / invalid). Any free-text message that
normalizes to 8–20 alphanumerics is treated as a status lookup and answered with a status
card (batch ETA line, weight/price, photo when available). Plus: paginated "My tracks"
grouped by status, balance with last payments, a price calculator that never writes to the
DB, the China warehouse address rendered with the customer's client code, and a language
toggle.

**Staff mode (bot, §3.8):** users whose Telegram ID is in `tenant.settings.staff_tg_ids`
get two extra behaviors — a photo captioned with a track code is saved to
`/data/uploads/{tenantId}/{trackId}.jpg` and linked; a message like `CODE 3.2` sets the
weight and computes the price. Weighing a `CREATED` track promotes it to
`CHINA_WAREHOUSE` (event + notification); weighing an unknown code **creates** the track
unattached so the customer can claim it later. This is how the China warehouse operates
without a web login.

**Admin (web, §5):** the tracks list is filterable and its search field works with a USB
barcode scanner out of the box (scanner = keyboard input + Enter). Row selection opens
bulk actions: change status (with "N tracks, M customers will be notified" confirmation)
or assign to a batch. The import wizard (xlsx or pasted text → preview of
new/updated/invalid rows → apply) upserts by `(tenant_id, code_normalized)` and can attach
everything to a batch (§7.2). Customers have payment entry and per-customer reminder
buttons; `/debtors` sorts by debt and supports "remind all". Batches bulk-move their
member tracks. Broadcast sends the admin's text as-is to every customer through the
throttled queue. Settings covers tariffs CRUD, currency + rate, addresses/hours/phone,
China address template, info text, staff IDs, the weekly reminder schedule, and webhook
status with a re-set button. The dashboard shows six stat cards over Bugun/7/30-day
periods (Asia/Tashkent boundaries) plus a 14-day revenue chart.

**Super-admin (§6):** `/sa` lists tenants with counts and per-row webhook-reset and
disable/enable. Creating a company validates the token via `getMe`, sets the webhook to
`{WEBHOOK_BASE_URL}/webhook/{token}`, and creates tenant + default tariff + owner admin in
one step — the "under 5 minutes" onboarding promise ([ONBOARDING.md](./ONBOARDING.md)).

## 6. i18n

Uzbek (Latin) is the default, Russian secondary. Every user-facing string lives in
`packages/shared/src/i18n/{uz,ru}.ts`; the canonical texts are written out in Spec §4 and
must exist in **both** languages before a task is done. Customers mix Latin/Cyrillic
freely — matching-relevant input is normalized. The admin panel is deliberately
Uzbek-only in MVP.

## 7. Operations

### Configuration

Production reads one root `.env` (documented inline in [.env.example](./.env.example)):
`DOMAIN`, `ACME_EMAIL`, `POSTGRES_*`, `DATABASE_URL`, `SESSION_SECRET`,
`SUPERADMIN_TOKEN`, `WEBHOOK_BASE_URL` (public HTTPS origin of the bot server — webhooks
are set to `{it}/webhook/{token}`), `PORT`, `UPLOADS_DIR`. Local dev uses per-workspace
`.env` files instead (see README), with `BOT_POLLING=true` replacing public webhooks.

### Deploy

`deploy.sh` on the VPS is the single deploy path, safe to re-run: checks `.env` →
`git fetch` + `merge --ff-only` (to `DEPLOY_REF` if set, else the tracked upstream) →
**build images locally, or `--pull` them from the registry** → start Postgres and wait for
its healthcheck → run Drizzle migrations (via the bot image) → restart `web`/`bot`/`caddy`
→ wait for both to report `healthy`, dumping logs and failing if they do not → prune
dangling images and unused ones older than 7 days. Named volumes (`pgdata`, `uploads`,
`caddy_*`) are never removed, so deploys cannot lose data.

CI/CD drives that script rather than replacing it. `.github/workflows/deploy.yml` runs on
every push to `main` (or on demand from the Actions tab): **verify** reuses `ci.yml`
(`pnpm typecheck && pnpm lint && pnpm test`), **build** builds the web and bot images on
GitHub's runners with a GHA layer cache and pushes them to
`ghcr.io/<owner>/<repo>-{web,bot}` tagged with the commit SHA, and **deploy** SSHes to the
VPS and runs `IMAGE_TAG=<sha> DEPLOY_REF=<sha> ./deploy.sh --pull`. Images are built on the
runner because a Next.js build does not fit comfortably in 2 vCPU / 4 GB alongside live
traffic; the VPS only pulls. `docker-compose.prod.yml` therefore names the web/bot images
`${WEB_IMAGE:-…}:${IMAGE_TAG:-latest}` so the same file works for both paths. Deploys are
serialised by a `deploy-production` concurrency group that queues instead of cancelling.
GHCR access uses the run-scoped `GITHUB_TOKEN`, logged out again at the end of the remote
script, so no long-lived registry credential lives on the VPS. Rollback is
`IMAGE_TAG=<older-sha> ./deploy.sh --pull` (schema migrations are not reversed — restore
from a backup for those). First-time walkthrough and the required secrets:
[DEPLOY.md](./DEPLOY.md).

### TLS & routing

Caddy terminates HTTPS for `{DOMAIN}` (admin panel; request body cap 25 MB for photo
uploads) and `bot.{DOMAIN}` (webhooks), obtaining and renewing Let's Encrypt certificates
automatically. Neither app container publishes a port.

### Backups & health

`scripts/backup.sh` (cron, nightly 03:00 Asia/Tashkent) runs `pg_dump` inside the
Postgres container, gzips to `/var/backups/kargotrack`, fails loudly on an empty dump, and
prunes past 14 days. The bot exposes `GET /health`; Postgres has a Docker healthcheck that
gates app startup; all containers restart `unless-stopped`.

### Auth

Panel passwords are argon2-hashed (`@node-rs/argon2`); sessions are httpOnly, secure,
30-day cookies signed with `SESSION_SECRET` (§8). `/sa` requires `SUPERADMIN_TOKEN`.

## 8. Testing & conventions

- Business logic lives in `packages/shared/services/*`; route handlers and bot handlers
  stay thin. Anything touching money, debt, status transitions, or normalization ships
  with Vitest tests.
- Zod validates every API input and every import row.
- Definition of done (CLAUDE.md): `pnpm typecheck && pnpm lint && pnpm test` pass,
  migrations run cleanly on a fresh database, the happy path is manually verified, and
  every new string exists in both uz and ru.
- Commits are small and imperative: `feat(bot): claim flow for unassigned tracks`.
- CI (`.github/workflows/ci.yml`) runs those same three commands on every pull request and
  again before any deploy, so `main` is never deployed unverified. `pnpm format:check` is
  not a gate yet — the repo predates Prettier being enforced.
- Known quirk: `next build` in `apps/web` has been seen exiting 1 with a spurious
  `PageNotFoundError` in local dev even after compiling successfully — rely on
  typecheck/lint/test locally; the authoritative build is the one the deploy workflow runs
  inside the Docker image, and it gates the deploy.

## 9. Scope

**Built (MVP):** the full customer bot (registration, add/claim, lookup, my tracks,
balance, calculator, China address, language), staff mode (photos + weighing), all admin
screens (dashboard, tracks, import, customers, debtors, batches, broadcast, settings),
super-admin onboarding, the four-queue outbound pipeline with throttling/dedupe/retries,
seeds and demo data, and the single-VPS Docker/Caddy deployment with nightly backups.

**Deliberately out of scope (§9 — do not build without deciding to):** volumetric pricing
from dimensions, regional delivery (BTS/pochta), courier module, camera QR scanning,
photo/media broadcasts, online payment collection (Click/Payme merchant), SMS channel, a
web mini-panel for the China warehouse, multi-branch tenants, English locale.

## 10. Reading map

| Read…                            | When…                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| [README.md](./README.md)         | You want to run it                                           |
| this file                        | You want to understand it                                    |
| [Spec.md](./Spec.md)             | You're implementing or changing behavior — it is the contract |
| [CLAUDE.md](./Claude.md)         | You're contributing (rules, conventions, definition of done)  |
| [DEPLOY.md](./DEPLOY.md) / [ONBOARDING.md](./ONBOARDING.md) | You're operating it / connecting a company |
