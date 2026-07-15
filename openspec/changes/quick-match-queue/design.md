# Design: Quick Match Queue

## Sequence Diagram

```
┌──────────┐        ┌──────────────┐      ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ Frontend  │        │  REST API    │      │ Matchmaker   │     │  Game Store  │     │ WS Push  │
│ (Lobby)   │        │  (Elysia)    │      │ (setInterval)│     │  (Map)       │     │(UserChan)│
└─────┬─────┘        └──────┬───────┘      └──────┬───────┘     └──────┬───────┘     └────┬─────┘
      │  POST /quick        │                      │                     │                   │
      │────────────────────>│                      │                     │                   │
      │                     │  validate JWT        │                     │                   │
      │                     │  check DB: pairs     │                     │                   │
      │                     │  queue.enqueue()     │                     │                   │
      │  200 {queued: true} │                      │                     │                   │
      │<────────────────────│                      │                     │                   │
      │                     │                      │                     │                   │
      │  WS connect         │                      │                     │                   │
      │  /ws/matchmaking    │                      │                     │                   │
      │───────────────────────────────────────────────────────────────────────────────────>│
      │  (receives match_found push)              │                     │                   │
      │                     │                      │                     │                   │
      │  ... N seconds ...  │                      │                     │                   │
      │                     │              ┌───────│                     │                   │
      │                     │              │ tick  │ findMatch()         │                   │
      │                     │              │ every │                     │                   │
      │                     │              │ 2s    │                     │                   │
      │                     │              └───┬───│                     │                   │
      │                     │                  │   │                     │                   │
      │                     │                  │   │── group found       │                   │
      │                     │                  │   │                     │                   │
      │                     │                  │   │  processMatchmaking()                   │
      │                     │                  │   │  shuffle + deal     │                   │
      │                     │                  │   │  initializeMatch()  │                   │
      │                     │                  │   │────────────────────>│ createGame()      │
      │                     │                  │   │                     │                   │
      │                     │                  │   │  queue.dequeue()    │                   │
      │                     │                  │   │  (×4 players)       │                   │
      │                     │                  │   │                     │                   │
      │                     │                  │   │  push match_found   │                   │
      │                     │                  │   │  (×4 players)       │                   │
      │                     │                  │   │────────────────────────────────────────>│
      │                     │                  │   │                     │                   │
      │  ← match_found      │                  │   │                     │                   │
      │<───────────────────────────────────────────────────────────────────────────────────│
      │                     │                      │                     │                   │
      │  router.push        │                      │                     │                   │
      │  /match/:id         │                      │                     │                   │
      │                     │                      │                     │                   │
```

## Architecture Decisions

### Decision: Dedicated WS route `/ws/matchmaking/:userId`

**Choice**: Separate WS connection for matchmaking notifications, distinct from game WS `/ws/game/:matchId/:playerId`.
**Alternatives considered**: Piggyback on the game WS; use Server-Sent Events (SSE); poll via REST.
**Rationale**: Game WS requires `matchId` which doesn't exist yet at queue time. A lightweight per-user channel reuses the existing `UserChannelManager` interface. SSE would require a new transport pattern. Polling adds latency and wastes bandwidth. The user-channel pattern is already implemented (`user-channel.ts`) and tested — we just need to wire a WS endpoint to it.

### Decision: Extend existing `createMatchmakingQueue` with pair awareness

**Choice**: Add optional `pairId` and `eloType` fields to `QueueEntry`; add pair-priority matching as a pre-pass in `findMatch()`.
**Alternatives considered**: Separate queue per pair vs solo; new class wrapping the existing queue.
**Rationale**: A single queue with a type discriminator avoids duplicate cleanup/matching loops. The existing `findMatch` is 50 lines — adding a pair-priority pre-pass adds ~30 lines. A separate queue would mean managing two intervals and dedup logic when a player could be in either.

### Decision: Pair lookup via Supabase at join time, not at match time

**Choice**: Query `pairs` table when player joins queue to resolve partner; store `partnerId` on `QueueEntry`.
**Alternatives considered**: Resolve partner at match time; cache partner data in server memory.
**Rationale**: At match time the matchmaker loop must be fast (runs every 2s). A DB query per tick for every player would be O(n) queries. Resolving once at join time and storing the result keeps the hot loop O(1). Partner data rarely changes mid-queue. Fallback to solo if DB query fails (per proposal risk mitigation).

### Decision: WS match_found via UserChannelManager (push model)

**Choice**: Server pushes `match_found` via `UserChannelManager.pushToUser()` — the same channel used for future notifications.
**Alternatives considered**: Client polls `/api/v1/matchmaking/status` after join.
**Rationale**: Push gives sub-second latency on match notification. The `UserChannelManager` is already built and tested. Polling would add unnecessary load and delay. The WS connection lifecycle is simple: connect → receive one event → disconnect.

### Decision: Frontend hook `useMatchmaking` manages full lifecycle

**Choice**: Single hook encapsulates join (REST), WS listener, status, and redirect.
**Alternatives considered**: Inline fetch + separate WS in the component; Zustand store for queue state.
**Rationale**: Follows the existing `useWebSocket` hook pattern. Keeps the `QuickMatchButton` component thin (UI only). No need for a global store — queue state is ephemeral and scoped to the lobby session.

## Data Structures

```typescript
// packages/backend/src/game/matchmaking.ts — extended QueueEntry

interface QueueEntry {
  userId: string;
  elo: number;
  joinedAt: number;
  pairId?: string;        // NEW: resolved partner pair ID (null = solo)
  partnerId?: string;     // NEW: partner's userId if also queued
  eloType: 'individual' | 'pair'; // NEW: determines which ELO to use for matching
}

// Packages within matchmaking.ts (no new files needed for these)
// The queue is a single Map<string, QueueEntry> — pairs identified by eloType + partnerId
```

No new `MatchmakerState` type needed — the state is the queue itself plus the `setInterval` handle.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/game/matchmaking.ts` | Modify | Extend `QueueEntry`, add `resolvePartner()` helper, add pair-priority pre-pass to `findMatch()` |
| `packages/backend/src/ws/matchmaking-ws.ts` | Create | Dedicated WS handler for `/ws/matchmaking/:userId` — registers with `UserChannelManager` on open, cleans up on close |
| `packages/backend/src/routes/matchmaking.ts` | Create | REST group: `POST /quick`, `POST /leave`, `GET /status` — mounts inside the auth-guarded group |
| `packages/backend/src/server.ts` | Modify | Import + mount matchmaking routes + WS, create `UserChannelManager`, start matching loop `setInterval(2000ms)` |
| `packages/backend/src/game/__tests__/matchmaking.test.ts` | Modify | Add pair-priority matching tests, partner resolution tests |
| `packages/frontend/src/hooks/use-matchmaking.ts` | Create | `useMatchmaking` hook — join/leave/status via REST, WS listener for `match_found`, auto-redirect |
| `packages/frontend/src/app/(dashboard)/lobby/_components/quick-match-button.tsx` | Modify | Replace dev endpoint with `useMatchmaking` hook integration |
| `packages/frontend/src/lib/api/types.ts` | Modify | Add `MatchmakingStatus` and `MatchFoundEvent` response types |

## Interfaces / Contracts

### REST Endpoints

```typescript
// POST /api/v1/matchmaking/quick — join queue
// Request:  (body empty — userId from JWT)
// Response: { queued: true, position: number }
// Errors:   409 ALREADY_IN_QUEUE, 429 RATE_LIMITED

// POST /api/v1/matchmaking/leave — leave queue
// Request:  (body empty — userId from JWT)
// Response: { left: true }

// GET /api/v1/matchmaking/status — queue status
// Response: { inQueue: true, position: number, waitTimeMs: number, queueSize: number }
//           or { inQueue: false }
```

### WS Message: match_found

```typescript
// Server → Client (via UserChannelManager)
interface MatchFoundEvent {
  type: "match_found";
  matchId: string;
  playerIds: string[];
  timestamp: string; // ISO 8601
}
```

### Frontend Hook Return Type

```typescript
interface UseMatchmakingReturn {
  joinQueue: () => Promise<void>;
  leaveQueue: () => Promise<void>;
  status: "idle" | "queued" | "matched" | "error";
  queuePosition: number | null;
  waitTimeMs: number;
  matchId: string | null;       // set on match_found, triggers redirect
  error: string | null;
}
```

## Error Handling

| Scenario | Detection | Response |
|----------|-----------|----------|
| User already in queue | `queue.getQueueSize()` + check userId exists | REST 409 `ALREADY_IN_QUEUE` |
| Partner not in pairs table | Supabase query returns null | Fallback: enqueue as solo (`eloType: 'individual'`) |
| Partner DB query fails | Supabase error/timeout | Fallback: enqueue as solo, log warning |
| Match creation fails | `processMatchmaking` returns null (shouldn't — 4 players confirmed) | Log error, re-enqueue players |
| WS disconnect during queue | `cleanupStale()` removes entries >60s | Players auto-removed; next `findMatch` skips stale |
| WS not connected at match time | `pushToUser` returns false | Match still created; players find match on reconnect via `/status` |

## Performance

| Concern | Value | Rationale |
|---------|-------|-----------|
| Matchmaker tick | 2000ms | AGENTS.md §6 spec; balances latency vs CPU |
| Cleanup interval | 30000ms | Existing `CLEANUP_INTERVAL_MS`; removes stale entries |
| Stale threshold | 60000ms | AGENTS.md: "Players in queue >60s are auto-removed" |
| Queue size limit | None (MVP) | Single-server, in-memory; acceptable for initial launch |
| Memory per entry | ~200 bytes | `QueueEntry` is 5 scalars + 2 optional strings |
| Max concurrent (est.) | ~1000 players | 200KB queue memory; well within Bun limits |

## Migration / Rollout

No migration required. All new code. The dev endpoint `/api/v1/dev/create-match` is preserved for local testing. The `QuickMatchButton` change is backward-compatible (same UI, different backend call).

## Open Questions

- [ ] Should the matchmaking WS route also be behind the auth guard, or use a separate lightweight JWT verify? (Recommendation: same guard — it's already mounted at `/api/v1` scope. The WS route sits outside the group but shares the verifyToken dep.)
- [ ] How should the frontend handle the case where `match_found` arrives but the user already navigated away? (Recommendation: ignore — the match is created regardless.)
