# ── Base image ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app

# ── Dependencies ───────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Production image ───────────────────────────────────────────────────────────
FROM base AS production

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 inboxiq

# Copy production deps
COPY --from=deps --chown=inboxiq:nodejs /app/node_modules ./node_modules
# Copy application source code
COPY --chown=inboxiq:nodejs . .

# Create logs directory with correct ownership
RUN mkdir -p logs && chown inboxiq:nodejs logs

USER inboxiq

EXPOSE 5000

ENV NODE_ENV=production

# Healthcheck using built-in wget to minimize attack surface (no curl needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:5000/api/v1/health || exit 1

CMD ["node", "src/server.js"]
