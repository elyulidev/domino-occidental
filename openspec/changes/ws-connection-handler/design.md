# Design: Module 11 — WS Connection Handler

## Technical Approach

Elysia WS plugin that wires WebSocket transport to the existing game engine. A connection map (`Map<string, WebSocket>`) with composite keys (`matchId:playerId`) tracks active connections. The plugin's `open`/`message`/`close` hooks handle lifecycle, route messages through `handleMessage()` / `broadcastEvents()`, and propagate disconnect/reconnect to the engine. Delivered in two chained PRs: PR1 delivers the connection manager core, PR2 adds JWT auth and rate limiting.

Maps to proposal approach §4–5; covers spec requirements R1–R7.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Nested Map `matchId → Map<playerId, ws>` vs flat composite key | Nested clearer for per-match cleanup; flat simpler for sendFn | **Flat composite key** (`matchId:playerId`) — simpler lookup, no GC needed for empty inner maps |
| playerId in query vs JWT for PR1 | Query is insecure but PR1 is dev-only; JWT added in PR2 | **Query string `?playerId=` for PR1**, overridden by JWT in PR2 — clean dependency inversion |
| Export map CRUD vs encapsulate in plugin | CRUD export enables unit testing without Elysia | **Export `joinMatch`/`leaveMatch`/`getConnection`** — testable pure functions, plugin calls them |
| `node:crypto` vs `jose` for JWT | `jose` is an extra dep; Bun has built-in HMAC | **`node:crypto.createHmac`** — zero deps, Bun-compatible, matches Supabase HS256 |
| Per-connection token bucket vs sliding window log | Bucket simpler, O(1) per check, window log uses more memory | **Token bucket closure** — 10 tokens, 10/sec refill, O(1) for hot path |

## Data Flow

```
WS Client ──ws://──→ Elysia WS Plugin
                        │
  open ──→ verifyToken()? ──→ joinMatch() → reconnectPlayer()
  message ──→ parse JSON ──→ handleMessage() ──→ broadcastEvents()
  close ──→ leaveMatch() ──→ disconnectPlayer()

Connection Map (composite key: "matchId:playerId")
  sendFn = (playerId, msg) → getConnection(matchId, playerId)?.send(msg)
```

## File Changes

| File | PR | Action | Description |
|------|----|--------|-------------|
| `src/ws/connection.ts` | 1 | Create | Elysia WS plugin, connection map CRUD, message routing, SendFn factory |
| `src/ws/__tests__/connection.test.ts` | 1 | Create | Unit tests for connection map, plugin hooks mocked, disconnect/reconnect wiring |
| `package.json` | 1 | Modify | Add `elysia@^1.4.x` as direct dependency |
| `src/ws/auth.ts` | 2 | Create | `verifyToken(token)` using `crypto.createHmac`, Supabase JWT secret |
| `src/ws/rate-limiter.ts` | 2 | Create | Token-bucket rate limiter, `tryConsume()`, cleanup |
| `src/ws/__tests__/auth.test.ts` | 2 | Create | Valid/invalid/expired/malformed token scenarios |
| `src/ws/__tests__/rate-limiter.test.ts` | 2 | Create | 10 passes/11th blocked, refill, isolation, cleanup |
| `src/ws/connection.ts` | 2 | Modify | Add JWT verification in `open` hook; add rate limiter check in `message` hook |

## Interfaces / Contracts

```typescript
// Connection map operations (exported for testing)
function joinMatch(matchId: string, playerId: string, ws: WebSocket): void
function leaveMatch(matchId: string, playerId: string): void
function getConnection(matchId: string, playerId: string): WebSocket | undefined
function createSendFn(matchId: string): SendFn

// Plugin signature (PR1)
function wsConnectionPlugin(app: Elysia, deps: { store: GameStore }): Elysia

// Plugin signature (PR2 — enhanced)
function wsConnectionPlugin(app: Elysia, deps: {
  store: GameStore
  verifyToken?: (token: string) => { userId: string } | null
  rateLimiter?: ReturnType<typeof createRateLimiter>
}): Elysia
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Connection map CRUD | Direct calls to `joinMatch`/`leaveMatch`/`getConnection` with mocked WebSocket |
| Unit | Plugin hook behaviour | Create plugin, call `open`/`message`/`close` with mock `ws` objects (vi.fn()) |
| Unit | Message routing | Mock `handleMessage`, send messages via plugin, verify `broadcastEvents` wiring |
| Unit | JWT verification | `verifyToken()` with valid/invalid/expired/malformed token edge cases |
| Unit | Rate limiter | Token bucket: 10 passes, 11th blocked, refill after 1s, isolated buckets, stale cleanup |
| Integration | Full round-trip | Elysia app with plugin, connect via `ws://`, play tile, verify all 4 receive events |

## Migration / Rollout

No data migration required. PR1 enables core WS transport (dev-mode, no auth). PR2 adds security. No feature flags needed — each PR independently deployable within the same release cycle.

## Open Questions

None.
