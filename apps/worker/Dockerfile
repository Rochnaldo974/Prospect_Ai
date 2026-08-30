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

# Node est lancé DIRECTEMENT, en PID 1. La première version passait par
# « pnpm start » : pnpm devenait PID 1 et tuait son enfant sur SIGTERM au
# lieu de le transmettre — constaté au banc, le log « Arrêt demandé »
# n'apparaissait jamais. Un redéploiement pendant un scan aurait donc
# interrompu les jobs en cours au lieu de les laisser finir.
STOPSIGNAL SIGTERM
CMD ["node", "--import", "tsx", "src/runner.ts"]
