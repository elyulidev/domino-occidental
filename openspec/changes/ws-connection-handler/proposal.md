# Proposal: Module 11 — WS Connection Handler

## Intent

Establish WebSocket infrastructure for real-time domino play, wiring the Elysia WS plugin to the existing game engine (modules 1–10). Without this, the engine has no transport — clients cannot connect, send moves, or receive events.

## Scope

### In Scope
- Elysia WS plugin with `open`/`message`/`close` hooks (playerId → WebSocket map)
- JWT verification via Supabase secret + `crypto` (query param `token`)
- Token-bucket rate limiter (10 msg/s per connection)
- Wire `handleMessage()` → `broadcastEvents()` on incoming WS messages
- Player disconnect cleanup (remove from map on close/error)
- Player reconnect support (update connection map entry)

### Out of Scope
- REST API routes, matchmaking queue, heartbeat/timer workers
- Reconnection timeout / abandonment logic (handled by engine `connection.ts`)
- Social features (friends, presence, notifications)

## Capabilities

### New Capabilities
- `ws-connection`: WebSocket connection lifecycle, JWT auth, rate limiting, transport-level message routing, and SendFn implementation for the game engine.

### Modified Capabilities
- None

## Approach

1. **Add `elysia` to `package.json`** — explicit dep (currently transitive only).
2. **Auth** (`src/ws/auth.ts`): `verifyToken(token)` → `{ userId } | null`. Use Supabase JWT secret + `crypto.subtle.verify()` or `jsonwebtoken` via Bun-compatible path. Validate `exp`, `sub`.
3. **Rate limiter** (`src/ws/rate-limiter.ts`): Token bucket per connection ID. `tryConsume(connectionId): boolean`. 10 tokens, 10/sec refill.
4. **Connection manager** (`src/ws/connection.ts`): Elysia WS plugin. On `open`: verify token from URL query, extract `matchId` from URL path, join the match connection map. On `message`: deserialize JSON → call `handleMessage()` → broadcast returned events. On `close`/`error`: `leaveMatch()`. Expose `createSendFn(matchId)` returning `SendFn` that looks up playerId in the map.

## Sub-PR Slices

This module exceeds 400-line budget. Split into chained PRs:
1. **PR 1**: Auth + Rate limiter (independent utilities, ~120 lines)
2. **PR 2**: Connection manager + Elysia plugin + engine wiring (~350 lines)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `elysia` dependency |
| `src/ws/auth.ts` | New | JWT token verification |
| `src/ws/rate-limiter.ts` | New | Token-bucket rate limiter |
| `src/ws/connection.ts` | New | Elysia WS plugin, connection map, SendFn |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Elysia not in package.json | High | `bun add elysia@^1.4` — PR 1 must include this |
| Next.js + Elysia port conflict | Medium | WS on Next.js same port; verify route setup in dev |
| Connection map memory leak | Medium | Remove on `close` AND `error`; defensive GC in cleanup |

## Rollback Plan

Revert the Elysia WS plugin registration in the server entry and the three new files. Remove `elysia` from `package.json`. No state loss — game engine and broadcaster remain untouched.

## Dependencies

- `elysia@^1.4.x` — must be added before any import
- Existing `src/ws/broadcaster.ts` (compatible, no changes needed)
- Existing `src/game/handler.ts` and `src/game/store.ts`

## Success Criteria

- [ ] WS `/api/game/:matchId` accepts connections with valid JWT, rejects without
- [ ] `play_tile` WS message routes through `handleMessage()` → events broadcast to all 4 players
- [ ] Rate limiter returns 429-equivalent close on >10 msg/s from same connection
- [ ] Disconnect removes player from map; reconnect updates the entry
- [ ] `bun test` passes with unit tests for auth, rate limiter, and connection manager
