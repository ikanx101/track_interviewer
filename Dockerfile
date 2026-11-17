# syntax=docker/dockerfile:1
# IMaN - Interviewer Monitoring at Nutrifood
# Image multi-stage: deps -> builder -> prisma-cli -> runner (standalone Next.js)

ARG NODE_IMAGE=node:22-alpine

# ---------- 1. Dependencies ----------
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# npm 10 (bawaan node:22) menjalankan postinstall seperti biasa;
# `prisma generate` tetap dijalankan eksplisit di tahap builder.
RUN npm ci --no-audit --no-fund

# ---------- 2. Build ----------
FROM ${NODE_IMAGE} AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Pastikan folder public ada (boleh kosong) agar COPY di tahap runner tidak gagal.
RUN mkdir -p public \
 && npx prisma generate \
 && npm run build \
 && node scripts/copy-runtime-deps.mjs /app/.runtime-deps exceljs

# ---------- 3. Prisma CLI (untuk migrate deploy saat container start) ----------
FROM ${NODE_IMAGE} AS prisma-cli
RUN apk add --no-cache openssl
WORKDIR /opt/prisma-cli
COPY package-lock.json /tmp/package-lock.json
RUN PRISMA_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version")" \
 && echo "Prisma CLI ${PRISMA_VERSION}" \
 && npm init -y >/dev/null \
 && npm install --no-audit --no-fund --omit=dev "prisma@${PRISMA_VERSION}" \
 && npm cache clean --force

# ---------- 4. Runtime ----------
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache openssl libc6-compat tini
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=1526 \
    HOSTNAME=0.0.0.0 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Output standalone Next.js (server.js + node_modules hasil tracing)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Lengkapi tracing standalone: exceljs + seluruh dependensinya (file yang dimuat dinamis)
COPY --from=builder --chown=nextjs:nodejs /app/.runtime-deps/node_modules ./node_modules
# Prisma client + client yang sudah di-generate (dipakai server & seed.mjs)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
# Skema, migrasi, dan seed
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma CLI terpisah (tidak tercampur dengan node_modules aplikasi)
COPY --from=prisma-cli --chown=nextjs:nodejs /opt/prisma-cli /opt/prisma-cli
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 1526

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-1526}/api/health" | grep -q '"ok"' || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
