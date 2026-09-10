FROM node:24-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN mkdir -p public
RUN npm run build

FROM dependencies AS migrator
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node lib ./lib
COPY --chown=node:node tsconfig.json ./tsconfig.json
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache openssl libc6-compat tini && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs && mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health/live" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
