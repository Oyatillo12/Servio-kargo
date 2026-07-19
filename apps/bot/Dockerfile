# syntax=docker/dockerfile:1
# Multi-stage build for @kargotrack/bot (grammY, webhook mode).
# The bot imports workspace packages that ship raw TypeScript (@kargotrack/shared,
# @kargotrack/db point `main` at ./src/*.ts), so it runs from source via tsx rather
# than a compiled dist/. This image also carries drizzle-kit, so deploy.sh can run
# migrations with `docker compose run --rm bot ...`.
# Build context is the MONOREPO ROOT (see docker-compose.prod.yml).

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# --- Install the full workspace (dev deps needed: tsx runtime + drizzle-kit) -
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

# --- Runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# Copying the whole /app preserves pnpm's node_modules/.pnpm symlink layout.
COPY --from=deps /app /app
WORKDIR /app/apps/bot
EXPOSE 8443
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
