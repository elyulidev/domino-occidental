# Tasks: CF Workers + Durable Objects Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1100–1400 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Package scaffold + JWT auth + entrypoint routing | PR 1 | ~200 lines; foundation for all DOs |
| 2 | GameDO skeleton + alarm() state machine + WS lifecycle | PR 2 | ~300 lines; core game DO without shared logic |
| 3 | Game engine integration + broadcaster + reconnect | PR 3 | ~350 lines; wires @domino/shared into GameDO |
| 4 | MatchmakingDO + frontend URL changes + integration tests | PR 4 | ~300 lines; final piece + e2e verification |

---

## Phase 1: Package Scaffold + Infrastructure

- [x] 1.1 Create `packages/workers/package.json` with deps: `jose`, `@domino/shared`, `wrangler` (pinned), `vitest`, `@cloudflare/vitest-pool-workers`. Scripts: `dev`, `deploy`, `test`.
- [x] 1.2 Create `packages/workers/tsconfig.json` targeting `esnext`, `moduleResolution: bundler`, types for `@cloudflare/workers-types`.
- [x] 1.3 Create `packages/workers/wrangler.toml` with DO bindings (`GAME_DO` class `GameDO`, `MATCHMAKING_DO` class `MatchmakingDO`), `compatibility_date`, vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`).
- [x] 1.4 Create `packages/workers/.dev.vars` with local secret values for miniflare dev.
- [x] 1.5 Create `packages/workers/src/auth.ts` — port JWT verify from `jose.jwtVerify()` with `SUPABASE_JWT_SECRET`. Extract `userId` from `sub` claim. Export `verifyToken(token: string): { userId: string } | null`.
- [x] 1.6 Write `packages/workers/src/auth.unit.test.ts` — test valid token, expired token, wrong secret, missing token, URL `?token=` extraction.
- [x] 1.7 Create `packages/workers/src/index.ts` — CF Worker entrypoint. Route `/ws/game/:matchId` to `env.GAME_DO`, `/ws/matchmaking/:userId` to `env.MATCHMAKING_DO`, all else 404. Forward full request to DO `fetch()`.
- [x] 1.8 Write `packages/workers/src/index.unit.test.ts` — test routing: game WS → GameDO, matchmaking → MatchmakingDO, unknown path → 404.
- [x] 1.9 Create `packages/workers/vitest.config.ts` with `@cloudflare/vitest-pool-workers` for DO tests, coverage enabled.
- [x] 1.10 Verify: `cd packages/workers && bun test` passes unit tests (no miniflare needed for auth/routing tests).

---

## Phase 2: GameDO Skeleton — WS Lifecycle + Alarm State Machine

- [x] 2.1 Create `packages/workers/src/types.ts` — internal DO storage types: `GameDOStorage` interface with `match: MatchState`, `heartbeatDue: number`, `turnCheckDue: number`, `abandonmentDue: number | null`, `pausedPlayerId: string | null`, `started: boolean`.
- [ ] 2.2 Create `packages/workers/src/game-do.ts` — `GameDO` class extending `DurableObject`. Export `Env` interface with `GAME_DO: DurableObjectNamespace`, `MATCHMAKING_DO: DurableObjectNamespace`, env vars.
- [ ] 2.3 Implement `GameDO.fetch()` — detect WS upgrade via `Upgrade: websocket` header. If upgrade: extract `?token=`, call `verifyToken()`, then `this.ctx.acceptWebSocket(ws, [userId])`. If not upgrade: 405.
- [ ] 2.4 Implement `GameDO.webSocketOpen()` — accept with tag = userId. Load storage. If match doesn't exist: create `MatchState` via `initializeMatch()` from `@domino/shared` (placeholder — actual init in Phase 3). Set `isConnected = true` for the player slot. Save to storage. If 4 connections AND `!started`: set `started = true`, call `startHand()`, emit `round_started` to all via `this.ctx.getWebSockets()`. Reschedule alarm.
- [ ] 2.5 Implement `GameDO.webSocketMessage()` — parse JSON, validate via `validateWsMessage()` from `@domino/shared`. Dispatch to `handleMessage()` (placeholder — wired in Phase 3). Send response to sender, broadcast to others.
- [ ] 2.6 Implement `GameDO.webSocketClose()` — remove connection from `getWebSockets()` (automatic in hibernation). Set `isConnected = false`. If disconnected player was on turn: set `pausedPlayerId`, `abandonmentDue = now + 60_000`. Save to storage. Reschedule alarm.
- [ ] 2.7 Implement `GameDO.alarm()` — state machine: read storage, check `heartbeatDue`, `turnCheckDue`, `abandonmentDue` against `Date.now()`. Process all due timers in one pass. Reschedule alarm at next earliest deadline via `this.ctx.storage.setAlarm()`. On abandonment: emit `match_abandoned`, call `storage.deleteAlarm()`.
- [ ] 2.8 Create `packages/workers/src/broadcaster.ts` — adapt `broadcastEvents()` from `packages/backend/src/ws/broadcaster.ts`. Replace `sendFn` with iteration over `this.ctx.getWebSockets()`, find socket by tag, call `ws.send(JSON.stringify(msg))`. Keep `game_error` → acting-player-only routing.
- [ ] 2.9 Create `packages/workers/src/rate-limiter.ts` — token bucket via DO storage. `tryConsume(key: string): boolean` checks `storage.get(`rl:${key}`)` with 10 msg/s limit.
- [ ] 2.10 Write `packages/workers/src/game-do.unit.test.ts` — test: alarm dispatch (multiple due timers), skip future timers, reschedule to next deadline, double-start prevention, abandonment on 60s disconnect.
- [ ] 2.11 Verify: `bun test` passes all GameDO unit tests.

---

## Phase 3: Game Engine Integration + Full Game Flow

- [ ] 3.1 Wire `handleMessage()` in `GameDO.webSocketMessage()` — import `playTile`, `passTurn` from `@domino/shared/game`, `sanitizeState` from `@domino/shared/handler`. On `play_tile`: call `playTile(match, playerId, tileId, side)`. On `pass`: call `passTurn(match, playerId)`. On `leave`: set match status to `abandoned`, emit `match_abandoned`. Save updated match to storage after each action.
- [ ] 3.2 Wire `broadcastEvents()` into `GameDO` — after each action, call `broadcastEvents(events, matchId, actingPlayerId, getWebSockets(), playerIds, sanitizedState)`. After `round_started` events: send each player their `yourHand` via targeted message.
- [ ] 3.3 Implement turn timeout in `alarm()` — when `turnCheckDue ≤ now`: call `checkTimeout(match, now)` from `@domino/shared/game/turn`. Emit `turn_timeout` + `player_tiles_blocked` events. Broadcast to all. Save to storage. Advance turn, reschedule alarm.
- [ ] 3.4 Implement heartbeat in `alarm()` — when `heartbeatDue ≤ now`: iterate `getWebSockets()` to check which players are still connected (presence check via tag). Compare against `match.players[i].isConnected`. If mismatch: update `isConnected` in storage, emit `player_disconnected`. Reschedule alarm for next heartbeat (`now + 5000`).
- [ ] 3.5 Implement reconnect in `webSocketOpen()` — if player tag already exists in `getWebSockets()`: close old connection (iterate, find by tag, call `ws.close(4002, "Replaced")`). Accept new. If `match.players[i].isConnected === false`: set `isConnected = true`, `abandonmentDue = null`, emit `player_reconnected`, broadcast to others. Reschedule alarm.
- [ ] 3.6 Persist terminal matches — when `match_ended` or `match_abandoned` events fire: POST to Supabase REST (`SUPABASE_URL/rest/v1/matches`) with `service_role` key. Fire-and-forget (don't block game loop).
- [ ] 3.7 Record match moves — after each `play_tile` or `pass`: POST to Supabase REST (`SUPABASE_URL/rest/v1/match_moves`) with tile data. Fire-and-forget.
- [ ] 3.8 Write `packages/workers/src/game-do.integration.test.ts` — miniflare-based test: 4 WS clients connect → all receive `round_started` → player on turn sends `play_tile` → board updates → hand continues.
- [ ] 3.9 Write `packages/workers/src/game-do.integration.test.ts` (disconnect/reconnect) — P2 disconnects → abandonment timer starts → P2 reconnects within 60s → `player_reconnected` → match continues.
- [ ] 3.10 Write `packages/workers/src/game-do.integration.test.ts` (turn timeout) — player doesn't play within 45s → `turn_timeout` emitted → tiles blocked → turn advances.
- [ ] 3.11 Verify: `bun test` passes all GameDO unit + integration tests.

---

## Phase 4: MatchmakingDO + Frontend URL Changes

- [ ] 4.1 Create `packages/workers/src/matchmaking-do.ts` — singleton DO. `fetch()` accepts WS with JWT verify, tag = userId. Storage: `queue: Array<{ userId: string, elo: number, joinedAt: number }>`.
- [ ] 4.2 Implement `MatchmakingDO.webSocketOpen()` — verify JWT, accept with tag = userId. Load queue from storage. Add player to queue. Push `queue_joined` event. Reschedule alarm to `now + 2000` if not already scheduled.
- [ ] 4.3 Implement `MatchmakingDO.alarm()` — 2s matching loop. Read queue. Run `findMatch()` (import from a new `packages/workers/src/matchmaking.ts` that ports the pure matching algorithm from `@domino/shared`). If match found: generate `matchId`, get GameDO stub via `env.GAME_DO.get(matchId)`, push `match_found` to each matched player's tagged WS, remove from queue. Cleanup stale entries (>60s). Reschedule alarm for `now + 2000`.
- [ ] 4.4 Create `packages/workers/src/matchmaking.ts` — port `findMatch()` pure function. ELO sliding window: ±200 (0-10s), ±400 (10-30s), ±600 (30-60s). Input: queue array. Output: array of matched groups (4 players each).
- [ ] 4.5 Implement `MatchmakingDO.webSocketClose()` — remove player from queue on disconnect. If queue changed: push updated `queue_position_update` to remaining players.
- [ ] 4.6 Write `packages/workers/src/matchmaking-do.unit.test.ts` — test: enqueue, dequeue on disconnect, alarm matching loop creates GameDO, stale cleanup.
- [ ] 4.7 Modify `packages/frontend/src/hooks/use-websocket.ts` — change WS URL from `${WS_BASE_URL}/ws/game/${matchId}/${playerId}` to `${WS_BASE_URL}/ws/game/${matchId}?token=${token}`. Remove `playerId` from path. Obtain token from Supabase session.
- [ ] 4.8 Modify `packages/frontend/src/hooks/use-matchmaking.ts` — verify WS URL format matches `${WS_BASE_URL}/ws/matchmaking/${userId}?token=${token}` (already correct path, just ensure token is passed).
- [ ] 4.9 Write `packages/workers/src/matchmaking-do.integration.test.ts` — 4 players enqueue → alarm fires → `findMatch` succeeds → GameDO created → each player receives `match_found { matchId }`.
- [ ] 4.10 Verify: `bun test` in `packages/workers` — all unit + integration tests pass. `bun run build` in frontend — no errors.

---

## Cross-Cutting: Testing Infrastructure

- [ ] T.1 Configure `packages/workers/vitest.config.ts` — pool: `@cloudflare/vitest-pool-workers`, miniflare options with DO bindings, env vars from `.dev.vars`.
- [ ] T.2 Add `"test:workers": "bun --cwd packages/workers test"` script to root `package.json`.
- [ ] T.3 Add coverage threshold: 80% line coverage for `packages/workers/src/`.
- [ ] T.4 Verify all `@domino/shared` tests still pass unchanged: `cd packages/shared && bun test`.
