FROM node:22.13.1-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@11.18.0 --activate \
  && pnpm --version

FROM base AS builder

COPY . .

RUN pnpm install --frozen-lockfile

# Valores ficticios usados solamente durante la compilación.
# Las credenciales reales se configuran en EasyPanel.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV BETTER_AUTH_SECRET="build-only-secret-not-used-at-runtime-2026"
ENV BETTER_AUTH_URL="https://app.distribuidoronline.com"

RUN pnpm --filter @repo/contracts run build \
  && pnpm --filter @repo/validation run build \
  && pnpm --filter @repo/database run build \
  && pnpm --filter web run build

FROM node:22.13.1-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV="production"
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs \
  /app/apps/web/.next/standalone ./

COPY --from=builder --chown=nextjs:nodejs \
  /app/apps/web/.next/static ./apps/web/.next/static

COPY --from=builder --chown=nextjs:nodejs \
  /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=20s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "apps/web/server.js"]