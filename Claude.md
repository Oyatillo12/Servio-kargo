# KargoTrack — Multi-tenant Cargo Tracking System (China → Uzbekistan)

## Project Overview
SaaS platform for cargo companies shipping from China (Guangzhou/Yiwu) to Uzbekistan.
Each cargo company (= tenant) gets:
1. Their own branded Telegram bot for customers: register track codes, receive automatic
   status notifications, check balance/debt.
2. A mobile-friendly web admin panel: Excel/text import of track codes, bulk status
   updates, weight & price calculation, debt tracking, warehouse photos.

Core value: eliminate the daily flood of "where is my package?" messages and replace
Excel/paper chaos. Target: onboarding a new cargo company must take under 5 minutes.

The full functional specification (exact flows, screens, message texts, business
rules) lives in `SPEC.md` in the repo root. Read the relevant SPEC.md section
BEFORE implementing any feature. If CLAUDE.md and SPEC.md conflict, stop and ask.

## Tech Stack (do not deviate without asking)
- **TypeScript everywhere**, strict mode
- **Monorepo:** pnpm workspaces
  - `apps/web` — Next.js 14+ (App Router) admin panel + API route handlers
  - `apps/bot` — grammY Telegram bot server (multi-bot, webhook mode)
  - `packages/db` — Drizzle ORM schema + migrations (PostgreSQL 16)
  - `packages/shared` — services (business logic), types, status enums, i18n strings
- **Queue:** pg-boss (Postgres-backed job queue — no Redis, fewer moving parts)
- **File storage:** local disk `/data/uploads` in MVP; S3-compatible later
- **Deploy:** Docker Compose on a single Ubuntu VPS; Caddy for automatic HTTPS
- **Testing:** Vitest; **Logging:** pino; **Validation:** Zod on every external input

## Architecture Rules (IMPORTANT — read before every task)
1. **Multi-tenant from day one.** Every domain table has `tenant_id`. Every query MUST
   be scoped by tenant. Never write an unscoped query. One codebase, many companies.
2. **One codebase, many bots.** Each tenant has its own Telegram bot token (from
   BotFather). The bot app routes webhooks by path `/webhook/:botToken` and resolves
   the tenant from the token. Adding a tenant = inserting a row + setting a webhook.
   Zero code changes per client.
3. **Telegram rate limits are real:** ~30 msgs/sec global, 1 msg/sec per chat.
   ALL outbound notifications go through the pg-boss queue with throttling and
   retry/backoff. Never send bulk messages in a plain loop.
4. **Track codes are messy.** Store `code_normalized` (uppercase, strip spaces, dashes,
   non-alphanumerics) alongside `code_original`. Match user input after the same
   normalization. Typical codes: 8–20 alphanumeric chars.
5. **i18n:** every user-facing string lives in `packages/shared/i18n/{uz,ru}.ts`.
   Uzbek (Latin) is the default, Russian secondary. Never hardcode user-facing text.
   Customers often mix Latin/Cyrillic — normalize input where it matters.
6. **Money:** store amounts as integer **tiyin** (UZS minor unit, 1 so'm = 100 tiyin).
   Never floats for money. Display as so'm with thousands separators.
7. **Status pipeline (fixed):**
   `CREATED → CHINA_WAREHOUSE → IN_TRANSIT → TASHKENT_WAREHOUSE → READY_FOR_PICKUP → DELIVERED`
   plus terminal side-states `LOST`, `RETURNED`.
   Status changes APPEND to `track_events` (audit log). Never overwrite history.
8. **The bot must never die.** Wrap every handler with error middleware; one malformed
   update must not crash the process. Log and continue.

## Data Model (core tables)
- `tenants` — id, name, bot_token (unique), bot_username, price_per_kg_tiyin,
  pickup_address, settings jsonb (reminder toggles, staff_tg_ids[]), created_at
- `admin_users` — id, tenant_id, phone, password_hash (argon2), role ('owner'|'staff')
- `customers` — id, tenant_id, tg_user_id, phone, full_name, client_code
  (e.g. "DK-1042" = tenant prefix + sequence), lang ('uz'|'ru'), created_at
- `tracks` — id, tenant_id, customer_id (nullable — codes can arrive before a customer
  claims them), code_normalized, code_original, current_status, weight_grams (nullable),
  price_tiyin (nullable), photo_path (nullable), created_at
  - UNIQUE index on (tenant_id, code_normalized)
- `track_events` — id, track_id, status, meta jsonb, created_by, created_at
- `payments` — id, tenant_id, customer_id, amount_tiyin, method
  ('cash'|'click'|'payme'|'other'), note, created_at
- Debt per customer = SUM(price of tracks in READY_FOR_PICKUP or DELIVERED)
  − SUM(payments). Implement as a service function with tests, not scattered SQL.

## Commands
- `pnpm dev` — run web (:3000) + bot (:8443) in dev
- `pnpm db:generate` / `pnpm db:migrate` — Drizzle migrations
- `pnpm test` — Vitest
- `pnpm lint && pnpm typecheck` — must pass before any task is "done"

## Coding Conventions
- Business logic lives in `packages/shared/services/*` — route handlers and bot
  handlers stay thin.
- Zod-validate every API input and every Excel/text-import row.
- Write a Vitest test for every function touching money, debts, status transitions,
  or code normalization.
- Small commits, imperative messages: `feat(bot): claim flow for unassigned tracks`.
- Admin UI: Tailwind, clean and dense, mobile-first (admins work from phones).
  Uzbek labels in the UI.

## Definition of Done (every task)
1. `pnpm typecheck && pnpm lint && pnpm test` all pass
2. Migrations run cleanly on a fresh database
3. Happy path manually verified — list the exact steps you ran
4. All new user-facing strings exist in BOTH uz and ru