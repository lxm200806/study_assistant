# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc

# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Prisma CLI + generated client (needed for migrate deploy at startup)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

COPY --from=builder /app/dist ./dist
COPY server/prisma ./prisma
COPY server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3004/ >/dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
