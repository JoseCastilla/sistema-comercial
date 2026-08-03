FROM node:22.13.1-bookworm-slim

WORKDIR /app

RUN npm install --global pnpm@11.18.0 \
  && pnpm --version

COPY . .

RUN pnpm install --frozen-lockfile

# URL ficticia utilizada únicamente para generar Prisma Client
# y compilar. No se conserva como credencial de producción.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
  pnpm --filter @repo/contracts run build \
  && DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
  pnpm --filter @repo/validation run build \
  && DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
  pnpm --filter @repo/database run build \
  && DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
  pnpm --filter api run build

ENV NODE_ENV="production"
ENV HOST="0.0.0.0"
ENV PORT="3001"

EXPOSE 3001

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=20s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health/live').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "apps/api/dist/main.js"]
