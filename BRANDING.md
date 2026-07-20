# Branding

The product was renamed from **KargoTrack** to **SERVIO Kargo**.

| | |
| --- | --- |
| Company | **SERVIO** |
| Product | **SERVIO Kargo** |
| Former product name | KargoTrack |

All **user-facing** occurrences were rebranded: README and the other Markdown docs,
admin-panel page titles / headers / wordmark, HTML `<title>` + metadata, the
`APP_NAME` constant, demo seed data, and config-file comments. The customer-facing
Telegram message strings were **not** touched — they interpolate each tenant's own
company name (`tenantName`), never the product name.

## Brand palette

The SERVIO palette (`apps/web/public/Colors.png`) is defined as `--brand-*` CSS
variables in `apps/web/app/globals.css` and exposed as Tailwind utilities under the
`brand.*` namespace (e.g. `text-brand-copper`) in `apps/web/tailwind.config.ts`.
The shadcn/ui design tokens (`--primary`, `--accent`, `--destructive`, …) are mapped
onto this palette. Primary brand color: **Indigo 800 · #2B2687**; accent: **Copper ·
#C2691E** (keep to ≤ ~10% of a surface).

## Brand assets (`apps/web/public/`)

| Asset | Used by |
| --- | --- |
| `logo.png` | Horizontal "servio kargo" lockup — the admin `Wordmark` (`components/brand.tsx`), shown on the login screen and sidebar. |
| `favicon.png` | Browser-tab icon — wired via `metadata.icons` in `apps/web/app/layout.tsx`. |
| `avatar.png` | Circular "V" mark for the **Telegram bot profile photo**. Telegram's Bot API cannot set a bot's avatar, so this is uploaded per tenant via **@BotFather → `/setuserpic`** during onboarding (see `ONBOARDING.md`). No code wiring. |
| `Colors.png` | Reference sheet for the palette above (source of the hex values). |

## Intentionally-unchanged internal identifiers

These keep the lowercase `kargotrack` (or `Kargo`) slug on purpose. Renaming any of
them would break builds, Docker volumes, live DB connections, or existing password
hashes for **zero user-visible benefit**. If a future migration renames them, treat
each as a coordinated infra change, not a cosmetic edit.

### npm / workspace / imports
- npm package scope **`@kargotrack/{db,shared,web,bot}`** and every `@kargotrack/*`
  import path across the monorepo. Root workspace `name: "kargotrack"` (`package.json`).
  Renaming rewrites every import plus `pnpm-lock.yaml`.
- Workspace folders (`apps/web`, `apps/bot`, `packages/db`, `packages/shared`) and the
  repo directory name are not brand-scoped and are left as-is.

### Database
- `POSTGRES_USER`, `POSTGRES_DB`, and the `kargotrack` slug in `DATABASE_URL`
  (`.env.example`, `docker-compose.yml`) — renaming orphans the existing `pgdata`
  volume and breaks connections.

### Docker / infra
- Container names `kargotrack-postgres`, `kargotrack-web`, `kargotrack-bot`,
  `kargotrack-caddy`; image names `kargotrack-web`, `kargotrack-bot`; volume
  `kargotrack_pgdata` (`docker-compose.yml`, `docker-compose.prod.yml`, `deploy.sh`,
  `scripts/backup.sh`).
- Backup locations: `/var/backups/kargotrack`, `kargotrack_*.sql.gz`,
  `/var/log/kargotrack-backup.log` (`scripts/backup.sh`, `DEPLOY.md`).
- Example domains `kargotrack.uz` / `bot.kargotrack.uz` and the `kargotrack` clone
  directory in `DEPLOY.md`, `.env.example`, `ONBOARDING.md` — placeholders each
  deployer replaces with their own domain; not product branding.

### Security-sensitive
- Super-admin session hash salt **`'kargotrack-superadmin-v1'`**
  (`apps/web/lib/superadmin.ts`). Changing this string invalidates every existing
  super-admin unlock hash.

### Demo / code identifiers
- Demo Telegram credentials in `packages/db/src/seed.ts`: bot username
  `kargo_track_test_bot` and the demo bot token — throwaway seed values, not shown
  as product branding.
- Internal type name `KargoContext` (`apps/bot/src/context.ts`) and related bot
  internals — non-user-facing code identifiers.
