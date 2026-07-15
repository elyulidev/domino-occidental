# Proposal: Quick Match Queue

## Intent

The lobby's "Jugar ahora" button currently calls a dev-only endpoint that creates matches without matchmaking. Players need a real matchmaking system: enter a queue, get matched by ELO with sliding window expansion, receive a match notification, and be redirected to the game. The queue data structure (`createMatchmakingQueue`) and matching algorithm (`findMatch`) already exist in `matchmaking.ts` with 310 lines of tests — this change wires them into the server, REST API, WS notifications, and frontend.

## Scope

### In Scope
- REST endpoints: `POST /api/v1/matchmaking/quick` (join), `POST /api/v1/matchmaking/leave`, `GET /api/v1/matchmaking/status`
- Dedicated WS route `/ws/matchmaking/:userId` for `match_found` / `queue_update` push
- Matchmaking loop: `setInterval` calling `processMatchmaking()` every 2s, wired to Elysia server startup
- Frontend: `useMatchmaking` hook (join/leave/status via REST + WS listener), queue status in lobby (live player count), match-found → redirect to `/match/:id`
- Pair-based matching: before solo ELO match, check if queued player has a registered partner also in queue (priority 1→2→3 from `pairs` table)
- Replace `QuickMatchButton` dev endpoint call with real `POST /quick`

### Out of Scope
- Persistent queue (DB-backed) — in-memory MVP, acceptable for single-server
- Tournament matchmaking (separate flow)
- Ranked mode or match history recording
- Anti-collusion detection for quick matches
- Cross-region / multi-server queue federation

## Capabilities

### New Capabilities
- `matchmaking-queue`: REST endpoints + matchmaking loop + pair-priority matching + queue lifecycle

### Modified Capabilities
- `ws-connection`: add `/ws/matchmaking/:userId` route for user-channel notifications (existing spec extends)

## Approach

**Architecture:** REST for queue actions (join/leave/status with JWT auth), dedicated WS per user for push notifications. Matchmaking loop runs server-side `setInterval(2000ms)`.

**Matching algorithm (pair-first, then ELO):**
1. Player joins queue → check if any registered partner (from `pairs` table, ordered by priority) is also queued → if yes, enqueue as pair (elo_pair)
2. If no partner queued → enqueue solo (elo_individual)
3. Matchmaker scans queue: for each pending pair/solo, find 2 other pairs/solos within sliding ELO window (±200→±400→±600 over 0→10→30s)
4. Match found → `processMatchmaking()` creates game, pushes `match_found` via `UserChannelManager`

**Data structures:** Extend `QueueEntry` with `pairId?: string` and `eloType: 'pair' | 'individual'`. Existing `createMatchmakingQueue` adapts with minimal changes.

**Integration points:**
- `server.ts`: mount matchmaking REST group + WS route, start cleanup + matching loops
- `UserChannelManager` (already implemented in `user-channel.ts`): receives `match_found` events
- Frontend hook manages join → listen → redirect lifecycle

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/backend/src/server.ts` | Modified | Mount matchmaking routes + WS + start loops |
| `packages/backend/src/game/matchmaking.ts` | Modified | Add pair-based matching to `findMatch`, extend `QueueEntry` |
| `packages/backend/src/game/__tests__/matchmaking.test.ts` | Modified | Tests for pair-priority matching |
| `packages/frontend/.../lobby/_components/quick-match-button.tsx` | Modified | Replace dev endpoint with real queue join |
| `packages/frontend/src/hooks/` | New | `useMatchmaking` hook |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Single-server queue loses state on restart | Low (MVP) | Queue rebuilds naturally as players rejoin; acceptable for MVP |
| Pair matching depends on `pairs` table availability | Medium | Graceful fallback to solo matching if DB query fails |
| WS disconnect during queue → orphaned entry | High | Cleanup scheduler removes stale entries >60s (already implemented) |

## Rollback Plan

Revert `QuickMatchButton` to call `/api/v1/dev/create-match`. Remove matchmaking routes from `server.ts`. Queue code stays but is unused — zero production impact.

## Dependencies

- `UserChannelManager` implementation (exists: `user-channel.ts`)
- `pairs` table with `status`, `invited_by`, `elo_pair` fields (exists in schema)

## Success Criteria

- [ ] Player clicks "Jugar ahora" → enters queue → receives `match_found` within ~15s average
- [ ] Lobby shows live queue count
- [ ] Registered pairs match together when both are queued
- [ ] Players in queue >60s are auto-removed
- [ ] All existing matchmaking tests pass; new pair-priority tests pass
