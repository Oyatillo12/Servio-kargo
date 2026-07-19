# syntax=docker/dockerfile:1
# Multi-stage build for @kargotrack/web (Next.js 14 standalone).
# Build context is the MONOREPO ROOT (see docker-compose.prod.yml), so paths
# below are relative to the repo root, not apps/web.

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# --- Install deps + build the standalone server -----------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kargotrack/web build

# --- Minimal runtime image --------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone/ carries a trimmed node_modules + server.js; static/ is served alongside it.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
