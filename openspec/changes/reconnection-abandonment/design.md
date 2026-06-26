# Design: Reconnection & Abandonment

## Technical Approach

Six pure functions in `connection.ts` completing Module 7/7 of the game engine. Functions accept `MatchState` + timestamps, return `ActionResult` — following the exact pattern from `match.ts`. Disconnect records live in the WS layer, never in `MatchState`. Abandonment sets `status='abandoned'` without calling `handleHandEnd`.

## Architecture Decisions

### Decision: forcePassForDisconnected takes `playerIndex` (not `playerId`)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `playerIndex: number` | Caller already knows the index from the WS timer loop. No lookup needed. | **Accept** |
| `playerId: string` | Consistent with disconnectPlayer/reconnectPlayer, but adds an O(n) findIndex call every forced-pass cycle | Rejected |

### Decision: Abandonment short-circuits on non-active status

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Check `status !== 'in_progress'` | Catches `finished`, `abandoned`, `waiting` — any stale state | **Accept** |
| Only check `finished` | Misses double-abandonment race | Rejected |

### Decision: disconnectPlayer uses `disconnectedAt` param (not `new Date()`)

The caller provides the timestamp so WS infrastructure can correlate heartbeat-failure time. This is critical for the abandonment timer — the WS layer's `DisconnectRecord.disconnectedAt` must match what's stamped on the player.

### Decision: reconnectPlayer checks `isConnected` only

No check on match status. A player could theoretically reconnect a finished match (the WS layer should prevent this via other means). The pure function only cares about player state consistency.

## Data Flow

### disconnectPlayer

```
disconnectPlayer(match, playerId, disconnectedAt)
  ↓
findPlayerIndex(match, playerId)
  → -1? → return { match, events: [gameError(PLAYER_NOT_FOUND)] }
  ↓
match.players[index].isConnected === false?
  → yes? → return { match, events: [] }  // no-op
  ↓
setConnected(player, false) → updateLastAction(player, disconnectedAt)
  → newPlayers = map over players, updating at index
  → newMatch = { ...match, players: newPlayers }
  → events = [{ type: 'player_disconnected', playerId, reconnectWindowMs: 30000 }]
  → return { match: newMatch, events }
```

### reconnectPlayer

```
reconnectPlayer(match, playerId, now)
  ↓
findPlayerIndex(match, playerId)
  → -1? → game_error
  ↓
isConnected === true?
  → yes? → no-op
  ↓
setConnected(player, true) → updateLastAction(player, now)
  → newMatch = { ...match, players: updated }
  → events = [{ type: 'player_reconnected', playerId }]
```

### forcePassForDisconnected

```
forcePassForDisconnected(match, playerIndex, now)
  ↓
playerIndex !== match.turn.currentTurn?
  → yes? → game_error(NOT_YOUR_TURN)
  ↓
incrementPasses(player) → updateLastAction(upd, now) → updatePlayers
advanceTurn(match.turn) → calculateDeadline(adv, now) → newTurn
newMatch = { ...match, players: updated, turn: newTurn }
events = [{ type: 'turn_timeout', playerId, forcedPass: true }]
  ↓
isBlocked(newMatch.board, newMatch.players)?
  → yes? → merge handleHandEnd(newMatch, playerIndex, 'blocked') events
  → no? → return { match: newMatch, events }
```

### checkReconnectWindow

```
checkReconnectWindow(record, now)
  ↓  // Pure query — no state, no events
elapsed = now - record.disconnectedAt
windowExpired = elapsed >= RECONNECT_WINDOW_MS
secondsLeft = max(0, floor((RECONNECT_WINDOW_MS - elapsed) / 1000))
→ { windowExpired, secondsLeft }
```

### checkAbandonment

```
checkAbandonment(match, record, now)
  ↓
match.status !== 'in_progress'?
  → yes? → return { match, events: [] }
  ↓
now - record.disconnectedAt < ABANDONMENT_THRESHOLD_MS?
  → yes? → return { match, events: [] }
  ↓
newMatch = { ...match, status: 'abandoned' }
events = [{ type: 'match_abandoned', disconnectedPlayerId: record.playerId, reason: 'abandonment' }]
→ { match: newMatch, events }
```

### forfeitMatch

```
forfeitMatch(match, playerId, now)
  ↓
match.status === 'finished' || match.status === 'abandoned'?
  → yes? → game_error(MATCH_ALREADY_OVER)
  ↓
findPlayerIndex(match, playerId)
  → -1? → game_error(PLAYER_NOT_FOUND)  // speculative — per spec only MATCH_ALREADY_OVER is required
  ↓
setConnected(player, false) → updateLastAction(player, now)
newMatch = { ...match, players: updated, status: 'abandoned' }
events = [{ type: 'match_abandoned', disconnectedPlayerId: playerId, reason: 'forfeit' }]
→ { match: newMatch, events }
```

## State Transition

```
IN_PROGRESS ──disconnectPlayer()──▶ IN_PROGRESS (player.isConnected=false)
    │                                      │
    │                                      │ forcePassForDisconnected (per turn)
    │                                      ▼
    │                                IN_PROGRESS (passes++, turn advances)
    │                                      │
    │                              ┌───────┴────────┐
    │                              │                │
    │                         reconnectPlayer()  checkAbandonment()
    │                              │                │
    │                              ▼                ▼
    │                         IN_PROGRESS      ABANDONED
    │                         (connected)
    │
    └────forfeitMatch()────▶ ABANDONED (immediate)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/connection.ts` | Create | 6 pure functions for disconnect/reconnect/force-pass/window-check/abandonment/forfeit |
| `src/game/types.ts` | Modify | Add 4 GameEvent variants, 3 constants, export DisconnectRecord interface |
| `src/game/__tests__/connection.test.ts` | Create | ~23-25 tests across all 6 functions |

## Interfaces / Contracts

```typescript
// NEW in types.ts
export const HEARTBEAT_MS = 5_000
export const RECONNECT_WINDOW_MS = 30_000
export const ABANDONMENT_THRESHOLD_MS = 60_000

export interface DisconnectRecord {
  playerId: string
  disconnectedAt: number
  reason: 'heartbeat' | 'forfeit'
}

// NEW GameEvent variants (add to existing union)
  | { type: "player_disconnected"; playerId: string; reconnectWindowMs: number }
  | { type: "player_reconnected"; playerId: string }
  | { type: "reconnection_window_expiring"; playerId: string; secondsLeft: number }
  | { type: "match_abandoned"; disconnectedPlayerId: string; reason: "abandonment" | "forfeit" }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `disconnectPlayer` | Normal disconnect, already disconnected (no-op), invalid playerId |
| Unit | `reconnectPlayer` | Normal reconnect, already connected (no-op), invalid playerId |
| Unit | `forcePassForDisconnected` | Normal forced pass, wrong index, blocked board cascade |
| Unit | `checkReconnectWindow` | Within window, at boundary, past window |
| Unit | `checkAbandonment` | Before threshold, at threshold, past threshold, already over |
| Unit | `forfeitMatch` | Normal forfeit, match already over |
| Integration | Full lifecycle | Disconnect → forced passes → reconnect cycle; disconnect → abandonment flow |

## Migration / Rollout

No migration required. This is a new module with no database changes. Existing `MatchState.status` already includes `"abandoned"` in the union type — no type breakage.

## Open Questions

- [ ] Should `forfeitMatch` also validate the player exists (PLAYER_NOT_FOUND) or only check match status? Spec only mentions MATCH_ALREADY_OVER, but consistency suggests adding PLAYER_NOT_FOUND.
- [ ] Should `forcePassForDisconnected` also check if the player is actually disconnected, or leave that to the WS layer? Spec says "WS layer decides when to call it" — but a safety guard could prevent bugs.
