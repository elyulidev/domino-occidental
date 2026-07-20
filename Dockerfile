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

# Render injects PORT env var automatically (default 3001)
EXPOSE ${PORT:-3001}

# Health check: configure in Render dashboard → /health
# (curl not available in bun:1-slim, Render handles it natively)

# Start the server
WORKDIR /app/packages/backend
CMD ["bun", "run", "start"]
