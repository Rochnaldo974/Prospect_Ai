# Worker du pipeline — déployé séparément de l'application Next.js.
#
# Les jobs de crawl durent des minutes voire des heures : ils ne peuvent pas
# tourner en serverless. Ce conteneur est un processus long, à héberger sur
# Fly.io, Railway ou un VPS, adossé à la même base Postgres.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile --filter @prospect/worker...

COPY packages/core ./packages/core
COPY apps/worker ./apps/worker

ENV NODE_ENV=production
WORKDIR /app/apps/worker

# SIGTERM déclenche l'arrêt propre : le worker cesse de réclamer et laisse
# finir les jobs en cours. dumb-init n'est pas nécessaire, Node gère le signal.
STOPSIGNAL SIGTERM
CMD ["pnpm", "start"]
