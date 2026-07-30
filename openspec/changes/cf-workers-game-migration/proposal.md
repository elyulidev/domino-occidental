# Proposal: Migrate WebSocket + Game Engine to CF Workers + Durable Objects

## Intent

Move the real-time game layer (WS handlers, timer management, connection tracking, matchmaking) from a long-lived Elysia/Bun process to Cloudflare Workers + Durable Objects. This provides horizontal scaling (one DO per match), automatic hibernation, and global edge deployment while keeping the REST API on Elysia.

## Scope

### In Scope
- `GameDO` — one Durable Object per active match, owns WS connections, timers, and state
- `MatchmakingDO` — singleton DO for queue + matching loop
- `setInterval` → `alarm()` state machine rewrite (heartbeat, turn check, abandonment)
- `ElysiaWS` → CF WS Hibernation API (connection tracking, reconnect, disconnect)
- JWT verification via `jose` library (already a dep, works in Workers)
- Frontend URL changes only (endpoint paths stay the same)
- `wrangler.toml` config for DO bindings

### Out of Scope
- REST API migration (stays on Elysia)
- DB persistence layer migration (stays on Elysia or moves to Supabase direct later)
- `@domino/shared` changes (0 — pure functions, fully reusable)
- Stripe webhooks, admin routes, social features

## Capabilities

### New Capabilities
- `cf-workers-game-do`: GameDO class handling WS, timers, state via alarm() + storage
- `cf-workers-matchmaking-do`: MatchmakingDO with queue, alarm-based matching loop, user-tagged connections

### Modified Capabilities
- `ws-connection`: URL routing changes in frontend hooks (WS_BASE_URL env var)

## Approach

### Target Architecture

```
Client ──WS──► CF Worker (entrypoint)
                │
                ├── GameDO (one per match)
                │   ├── this.ctx.storage (MatchState, timers, player map)
                │   ├── this.ctx.getWebSockets() (hibernation-safe connections)
                │   └── alarm() → state machine for timers
                │
                └── MatchmakingDO (singleton)
                    ├── this.ctx.storage (queue Map, matching state)
                    ├── this.ctx.getWebSockets() (user-tagged connections)
                    └── alarm() → 2s matching loop
```

### State Machine for Timers (alarm() replaces setInterval)

**Single-alarm design per GameDO**: one alarm fires at the earliest deadline. The DO's `alarm()` handler dispatches based on what's due.

```
alarm() fires
  ├── if heartbeatDue ≤ now → check each player's WS presence via getWebSockets()
  │   └── reschedule alarm for next heartbeat (now + 5000)
  ├── if turnDeadline ≤ now → force pass, advance turn
  │   └── reschedule alarm for next turn deadline (now + 2000 check window)
  └── if abandonmentDue ≤ now → abandon match
      └── delete alarm via storage.deleteAlarm()
```

**Key state stored in DO storage**:
```
{
  match: MatchState,           // full game state
  heartbeatDue: number,        // Unix ms
  turnCheckDue: number,        // Unix ms
  abandonmentDue: number|null, // Unix ms, null if no disconnect
  pausedPlayerId: string|null, // player on turn who disconnected
  playerConnections: Record<playerId, { tag: string }>, // WebSocket tags
}
```

**alarm() precision handling**: CF alarms min 1s, may delay. Each alarm fires early-ish and re-checks deadlines against `Date.now()`. The turn checker window (currently 2s) becomes: set alarm for `min(heartbeatDue, turnCheckDue, abandonmentDue)`. On fire, process ALL due timers. This eliminates the multi-interval problem.

### Connection Lifecycle (Hibernation API)

**Key difference**: CF WS has no `readyState`. Connections hibernate between events. Instead of polling `readyState`, we check `this.ctx.getWebSockets()` membership.

```
open: acceptWebSocket(ws, [playerId])
  → store tag = playerId in WS metadata
  → update match.players[i].isConnected = true
  → reschedule alarm to cancel abandonment timer

message: dispatch by tag → handleMessage() or reconnect logic
  → reset turnCheckDue = now + TURN_TIMEOUT_MS if it's their turn

close: ws is automatically removed from getWebSockets()
  → set isConnected = false
  → if was on turn → pauseTurnTimer, set abandonmentDue = now + 60_000
  → reschedule alarm
```

**4-player detection**: On `open`, check `this.ctx.getWebSockets().length`. If ≥ 4 → start match (transition waiting → in_progress). Use a `started` boolean in storage to prevent double-start (same role as `startedMatches` Set).

**Reconnect**: Client sends WS message with reconnect intent. DO checks if `getWebSockets()` already has a connection tagged with that playerId (old tab). If yes → close old, accept new. If player was `isConnected === false` → emit `player_reconnected`, cancel abandonment timer.

### Matchmaking Design

**MatchmakingDO** — singleton, handles the queue and 2s matching loop.

```
alarm() fires every 2s:
  1. Read queue from storage
  2. Run findMatch() (same algorithm from matchmaking.ts — pure, reusable)
  3. If match found:
     → Create GameDO stub via env.GAME_DO.get(matchId)
     → Push match_found to each player's tagged WS connection
     → Remove matched players from queue
  4. Cleanup stale entries (> 60s)
  5. Reschedule alarm(now + 2000)
```

**User connections**: Players connect via `ws://matchmaking` with JWT. DO accepts with tag = userId. Push `match_found` by iterating `getWebSockets()` and matching tags.

**Race condition mitigation**: Queue operations happen in alarm() which is single-threaded per DO. No concurrent modification. `enqueue`/`dequeue` via external fetch calls write to storage before alarm reads.

### File Plan

| Action | File | Description |
|--------|------|-------------|
| **CREATE** | `packages/workers/src/index.ts` | CF Worker entrypoint, routes WS to DOs |
| **CREATE** | `packages/workers/src/game-do.ts` | GameDO class (~300 lines) |
| **CREATE** | `packages/workers/src/matchmaking-do.ts` | MatchmakingDO class (~200 lines) |
| **CREATE** | `packages/workers/src/auth.ts` | JWT verify via `jose` (port of ws/auth.ts) |
| **CREATE** | `packages/workers/src/broadcaster.ts` | Port of ws/broadcaster.ts (sendFn → getWebSockets) |
| **CREATE** | `packages/workers/src/rate-limiter.ts` | Token bucket via DO storage |
| **CREATE** | `packages/workers/wrangler.toml` | DO bindings, routes, env vars |
| **CREATE** | `packages/workers/package.json` | Dependencies (jose, @domino/shared) |
| **CREATE** | `packages/workers/tsconfig.json` | TS config for Workers |
| **REUSE** | `packages/shared/src/game/*.ts` | Zero changes — pure functions |
| **REUSE** | `packages/shared/src/types.ts` | Zero changes |
| **MODIFY** | `packages/frontend/src/hooks/use-websocket.ts` | WS_BASE_URL → CF Workers URL |
| **MODIFY** | `packages/frontend/src/hooks/use-matchmaking.ts` | WS_BASE_URL → CF Workers URL |
| **KEEP** | `packages/backend/src/ws/*.ts` | Existing Elysia WS (dual-run during migration) |
| **KEEP** | `packages/backend/src/game/*.ts` | Game logic, DB persistence |
| **KEEP** | `packages/backend/src/db/*.ts` | All DB operations |

### Phased Approach

**Phase 1 — Scaffold + GameDO skeleton** (no live traffic)
- CF Worker entrypoint, wrangler.toml, GameDO class
- alarm() state machine skeleton (no actual timers yet)
- WS open/message/close handlers with Hibernation API
- JWT auth via jose
- Unit tests: alarm dispatch, connection tracking, state persistence

**Phase 2 — Game engine integration**
- Wire handleMessage() from @domino/shared into GameDO.message()
- Wire broadcastEvents() adapted for getWebSockets()
- Implement turn timeout via alarm() + state machine
- Implement heartbeat via getWebSockets() presence check
- Implement disconnect/reconnect via isConnected flag + alarm rescheduling
- Integration tests: 4-player game flow via CF miniflare

**Phase 3 — MatchmakingDO**
- Singleton DO with alarm-based 2s matching loop
- Queue operations (enqueue, dequeue, findMatch) via storage
- User-tagged WS connections for match_found push
- ELO sliding window matching (reuse matchmaking.ts pure functions)
- Integration tests: queue → match → GameDO creation

**Phase 4 — Dual-run + cutover**
- Frontend points to CF Workers WS endpoints
- Elysia WS kept running (fallback)
- Canary: route 10% of WS traffic to CF, 90% to Elysia
- Monitor: latency, error rates, DO memory usage
- Full cutover: 100% CF, Elysia WS deprecated

**Phase 5 — Cleanup**
- Remove Elysia WS files (connection.ts, timer-manager.ts, etc.)
- Remove started-matches.ts, user-channel.ts, matchmaking-ws.ts
- Remove Bun.CryptoHasher auth (replaced by jose)
- Update AGENTS.md architecture section

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| alarm() delay (>1s) | State machine checks deadlines on every fire; turn window is 2s, so 1s delay is acceptable. Store `deadline` not `interval` — always compare against `Date.now()`. |
| Hibernation kills connections | CF WS Hibernation API keeps WS alive during hibernation. `getWebSockets()` returns connections even after hibernation. No `readyState` needed. |
| DO storage latency (~50ms) | Acceptable for game state (turn timeout is 45s). Batch state + timer updates in single `storage.put()` call. |
| Matchmaking race condition | Queue is single-threaded in alarm(). `enqueue`/`dequeue` via fetch → storage.put() → alarm reads. No concurrent access. |
| 4-player connection race | `started` boolean in storage prevents double-start. `getWebSockets().length` checked on every `open`. |
| Dual-run consistency | REST API stays on Elysia. DB writes from both Elysia and CF via Supabase REST (service_role). No direct DB connection from CF. |

### DB Access from CF Workers

Two options (decide in Phase 1):
1. **Supabase REST API** — `fetch(SUPABASE_URL + '/rest/v1/...')` with service_role key. Simple, no connection pooling needed.
2. **Hyperdrive** — Cloudflare's connection pooler for Postgres. Lower latency if needed.

For Phase 1-3: use Supabase REST. Profile fetching, match persistence, move recording — all via REST. This avoids connection management complexity.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/workers/src/` | New | Entire CF Workers package |
| `packages/frontend/src/hooks/` | Modified | WS URL changes (2 files) |
| `packages/backend/src/ws/` | Deferred removal | Kept for dual-run, removed in Phase 5 |
| `packages/shared/` | None | Zero changes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| alarm() imprecision causes turn timeout drift | Medium | Store absolute deadlines, check against Date.now() on every alarm fire. 2s check window absorbs 1s alarm jitter. |
| Hibernation API behavior changes | Low | CF WS Hibernation is stable API. Pin wrangler version. Test with miniflare. |
| DO storage size limit (128KB) | Low | MatchState is ~2KB. 55 tiles × ~20 bytes = ~1KB. Well within limits. |
| CF Workers CPU time limit (30s) | Low | Game logic is pure functions, <1ms per action. alarm() handler processes one event per fire. |
| Dual-run increases infra cost | Medium | Temporary (Phase 4 only). Elysia instance scaled down during canary. |

## Rollback Plan

- **Phase 1-3**: No rollback needed — new package, no live traffic
- **Phase 4**: Shift traffic back to Elysia WS via frontend env var. No code changes needed.
- **Phase 5**: Restore deleted files from git history (commit tagged before cleanup).

## Dependencies

- `jose` library (already in package.json)
- `wrangler` CLI for dev/deploy
- Cloudflare account with Durable Objects enabled
- Supabase service_role key accessible from CF Workers (via secrets)

## Success Criteria

- [ ] GameDO handles 4-player match lifecycle: connect → play → score → finish
- [ ] alarm() state machine replaces all setInterval/setTimeout (heartbeat, turn, abandonment)
- [ ] Hibernation API handles disconnect/reconnect without readyState checks
- [ ] MatchmakingDO runs 2s matching loop with ELO sliding window
- [ ] All existing @domino/shared tests pass unchanged
- [ ] CF miniflare integration tests cover: game flow, timeout, disconnect/reconnect, matchmaking
- [ ] Frontend connects to CF Workers WS endpoints successfully
- [ ] Latency p95 < 100ms for WS message round-trip
- [ ] Zero changes to @domino/shared package
