# Tasks: Quick Match Queue

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450–600 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend types + queue extension + REST endpoints | PR 1 | Base: feature/matchmaking-queue. ~250 lines |
| 2 | Backend WS + matchmaker loop + connection timeout | PR 2 | Base: PR 1 branch. ~180 lines |
| 3 | Frontend hook + button + tests | PR 3 | Base: PR 2 branch. ~170 lines |

## Phase 1: Shared Types

- [ ] 1.1 Add `MatchmakingEvent` union type (`queue_joined | queue_position_update | match_found | queue_error`) to `packages/shared/src/types.ts`
- [ ] 1.2 Add `MatchFoundPayload` interface (`type`, `matchId`, `playerIds`, `timestamp`) to `packages/shared/src/types.ts`
- [ ] 1.3 Add `MatchmakingStatusResponse` interface (`inQueue`, `queueType`, `position`, `estimatedWait`, `queueCount`) to `packages/shared/src/types.ts`

## Phase 2: Backend Queue Extension

- [ ] 2.1 Extend `QueueEntry` in `packages/backend/src/game/matchmaking.ts`: add `pairId?: string`, `partnerId?: string`, `eloType: 'individual' | 'pair'`
- [ ] 2.2 Add `resolvePartner(userId, supabase)` async helper — queries `pairs` table for registered partner, returns `{ partnerId, pairId } | null`
- [ ] 2.3 Add pair-priority pre-pass to `findMatch()`: before solo ELO scan, check if any queued player has a partner also queued; if 2 pairs found → match them immediately
- [ ] 2.4 Update `enqueue()` to accept optional `pairId` and `partnerId` fields on the entry
- [ ] 2.5 Add `MATCH_FOUND_TIMEOUT_MS = 30_000` constant for connection timeout

## Phase 3: Backend REST Endpoints

- [ ] 3.1 Create `packages/backend/src/routes/matchmaking.ts` with `matchmakingRoutes(queue, supabase)` factory
- [ ] 3.2 Implement `POST /quick`: validate JWT, check duplicate (409), call `resolvePartner`, enqueue, return `{ queued, position, queueType }`
- [ ] 3.3 Implement `POST /leave`: validate JWT, dequeue user, dissolve pair if needed (partner re-enqueued as solo)
- [ ] 3.4 Implement `GET /status`: validate JWT, return `{ inQueue, queueType, position, estimatedWait, queueCount }`
- [ ] 3.5 Wire `verifyToken` standalone function — lightweight JWT verify using `SUPABASE_JWT_SECRET` (extract from `authGuard` pattern)

## Phase 4: Backend WS Route

- [ ] 4.1 Create `packages/backend/src/ws/matchmaking-ws.ts` — `matchmakingWsHandler(userChannelManager, verifyToken)` factory
- [ ] 4.2 Implement WS open: verify JWT from `?token=` query, extract userId, call `userChannelManager.register(userId, ws)`
- [ ] 4.3 Implement WS close: call `userChannelManager.disconnect(userId)`
- [ ] 4.4 Mount WS at `/ws/matchmaking/:userId` in `server.ts`

## Phase 5: Backend Server Integration

- [ ] 5.1 Mount `matchmakingRoutes` inside the auth-guarded group in `server.ts`
- [ ] 5.2 Instantiate `createUserChannelManager()` in `server.ts` and pass to routes and WS handler
- [ ] 5.3 Add `setInterval(2000)` matchmaker loop: calls `processMatchmaking`, tracks pending connections, starts 30s timeout per match
- [ ] 5.4 Implement 30s connection timeout: for each `match_found`, start `setTimeout(30_000)` — if `connectionManager.getPlayerIdsForMatch(matchId).length < 4` when timer fires → remove match from store, re-enqueue all 4 players, push `match_cancelled` event
- [ ] 5.5 Start `startCleanupScheduler(queue)` on server boot

## Phase 6: Frontend Hook

- [ ] 6.1 Create `packages/frontend/src/hooks/use-matchmaking.ts` — `useMatchmaking()` hook
- [ ] 6.2 Implement `joinQueue()`: POST `/api/v1/matchmaking/quick` via `apiFetch`, set status to `queued`
- [ ] 6.3 Implement `leaveQueue()`: POST `/api/v1/matchmaking/leave`, set status to `idle`
- [ ] 6.4 Open WS connection to `/ws/matchmaking/:userId?token=<jwt>`, listen for `match_found` → set `matchId`, trigger redirect
- [ ] 6.5 Cleanup on unmount: call `leaveQueue()` if in queue, close WS
- [ ] 6.6 Add `MatchmakingStatusResponse` and `MatchFoundPayload` types to `packages/frontend/src/lib/api/types.ts`

## Phase 7: Frontend Integration

- [ ] 7.1 Refactor `packages/frontend/src/app/(dashboard)/lobby/_components/quick-match-button.tsx` to use `useMatchmaking` hook
- [ ] 7.2 Replace dev endpoint call with `joinQueue()` from hook
- [ ] 7.3 Show queue status: position + estimated wait when `status === 'queued'`, cancel button calling `leaveQueue()`
- [ ] 7.4 Auto-redirect to `/match/:id` when `matchId` is set from `match_found` event

## Phase 8: Tests

- [ ] 8.1 Unit test: pair-priority matching — 2 pairs in queue → matched immediately (in `matchmaking.test.ts`)
- [ ] 8.2 Unit test: partner resolution fallback — DB query fails → solo enqueue
- [ ] 8.3 Unit test: sliding window expansion with pairs
- [ ] 8.4 Integration test: POST /quick → 200 with queued=true
- [ ] 8.5 Integration test: POST /quick duplicate → 409 ALREADY_IN_QUEUE
- [ ] 8.6 Integration test: POST /leave removes from queue
- [ ] 8.7 Integration test: GET /status returns correct queue info

## Verification

- [ ] All existing `matchmaking.test.ts` tests still pass (16 tests)
- [ ] New pair-priority tests pass
- [ ] `bun run biome:check` passes
- [ ] `bun test --coverage` >80% for matchmaking module
- [ ] Manual: click "Jugar ahora" → enters queue → receives match_found → redirects to game
