FROM node:22.13.1-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global pnpm@11.18.0 \
  && pnpm --version

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter worker run build

ENV NODE_ENV="production"

# SPEC-046: el worker no abre puertos ni corre migraciones; solo llama al
# mantenimiento interno de web y api con el secreto compartido. Necesita
# WEB_INTERNAL_URL, API_INTERNAL_URL y MAINTENANCE_INTERNAL_SECRET.
CMD ["node", "apps/worker/dist/main.js"]
