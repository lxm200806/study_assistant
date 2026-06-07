# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm install --no-audit --no-fund

COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc

# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Prisma CLI + generated client (needed for migrate deploy at startup)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

COPY --from=builder /app/dist ./dist
COPY server/prisma ./prisma
COPY server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3004/ >/dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
