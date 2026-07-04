# Exploration: Timeout Visual Feedback Bugs

## Current State

The system broadcasts game state via `broadcastEvents` in 7 places across the backend. The frontend's `use-websocket.ts` (line 114) gates all store updates on `msg.state` existing — without state, `applyWsUpdate` never fires and `players[].isConnected` / `blockedTileIds` remain stale.

## Bug A — Blocked tiles don't show visual indicator

### Root Cause
`player-hand.tsx` line 101:
```ts
const blocked = isMyTurn && blockedTileIds.includes(tile.id);
```

When a 45s timeout fires:
1. Server sets `blockedTileIds` on the timed-out player
2. Server advances `currentTurn` to the next player
3. Server broadcasts state (with `sanitizeState` — this IS included)
4. Frontend receives `blockedTileIds` correctly BUT `currentTurn` has advanced
5. `isMyTurn` is `false` for the timed-out player → `blocked` is always `false`

### Affected Areas
- `packages/frontend/src/components/game/player-hand.tsx` line 101 — the gate
- `packages/frontend/src/components/game/domino-tile.tsx` — consumes `blocked` prop (lines 153-157, 184-188, 197-198, 202)
- `packages/frontend/src/stores/game-store.ts` line 167 — correctly stores `blockedTileIds`

### Safety Analysis: Removing `isMyTurn` from line 101

**Safe.** Reasons:
- `canInteract` (line 102) still requires `isMyTurn` → no interaction possible on wrong turn
- `blockedTileIds` only contains THIS client's blocked tiles (indexed by `playerIdx` in game-store.ts:167)
- Visual indicator (red ✕ overlay + dimmed border) is purely cosmetic
- On the player's NEXT turn, tiles remain correctly blocked (reset only on hand redeal)

## Bug B — Opponent indicator doesn't update isConnected

### Root Cause
3 of 7 `broadcastEvents` calls are missing the 6th argument (`state`). The frontend (`use-websocket.ts:114`) only calls `store.applyWsUpdate()` when `msg.state` exists.

### All broadcastEvents Calls

| # | File | Line | Context | Has State? | Bug? |
|---|------|------|---------|-----------|------|
| 1 | `timer-manager.ts` | 137 | Heartbeat disconnect detection | NO | **YES** |
| 2 | `timer-manager.ts` | 155-162 | Turn timeout checker | YES | No |
| 3 | `timer-manager.ts` | 189 | Abandonment timer | NO | **YES** |
| 4 | `ws/connection.ts` | 229-236 | Reconnect (JWT auth) | YES | No |
| 5 | `ws/connection.ts` | 299-306 | Reconnect (no-auth) | YES | No |
| 6 | `ws/connection.ts` | 386-393 | Message handler | YES | No |
| 7 | `ws/connection.ts` | 432-438 | WS close/disconnect | NO | **YES** |

**Total missing state: 3 calls** (#1, #3, #7)

### Impact
- **#1 (heartbeat):** Most impactful. Server detects dead WS, sets `isConnected: false`, but other clients never see it.
- **#3 (abandonment):** Less critical. Fires 60s after disconnect. `status: "abandoned"` change not reflected.
- **#7 (ws close):** Second most impactful. Player closes WS, server disconnects them, but other clients don't see `isConnected: false` until next state-bearing broadcast.

## Recommendation

**Bug A:** Remove `isMyTurn &&` from `player-hand.tsx` line 101. One-line fix.

**Bug B:** Add `sanitizeState(result.match)` as 6th argument to the 3 missing calls. In all cases, `store.updateGame(matchId, result.match)` executes before the broadcast, so state is current.

## Risks

- **Bug A:** None significant. Blocked tiles will show overlay during opponent's turn — this is desirable.
- **Bug B:** Mechanical change. Must verify `result.match` is updated before `sanitizeState` call (confirmed: `store.updateGame` runs first in all 3 cases).

## Ready for Proposal

Yes. Both bugs confirmed with code evidence. Fixes are mechanical and low-risk.
