# ---------------------------------------------------------------------------
# Dominó Occidental — Backend (Elysia + Bun)
# Multi-stage build: install deps → run server
# ---------------------------------------------------------------------------

# --- Base: install dependencies ---
FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace root
COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install all workspace dependencies
RUN bun install --frozen-lockfile

# --- Build: copy source and build shared ---
FROM base AS build
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/

# --- Production: minimal image ---
FROM oven/bun:1-slim AS production
WORKDIR /app

# Copy node_modules and source from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/backend ./packages/backend
COPY --from=build /app/package.json ./

# Expose backend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the server
WORKDIR /app/packages/backend
CMD ["bun", "run", "start"]
