# Reconnection-Abandonment Specification

## Purpose

Define the player disconnection lifecycle: heartbeat failure → reconnect window → forced passes → abandonment/forfeit. This is the final game-engine module (Module 7) — pure functions in `connection.ts` that operate on `MatchState` and accept timestamps from the WS layer. Disconnect records live outside MatchState.

## Types

The system MUST define `DisconnectRecord`, `RECONNECT_WINDOW_MS`, `ABANDONMENT_THRESHOLD_MS`, and `HEARTBEAT_MS` in `src/game/types.ts`.

```typescript
export const HEARTBEAT_MS = 5_000
export const RECONNECT_WINDOW_MS = 30_000
export const ABANDONMENT_THRESHOLD_MS = 60_000

interface DisconnectRecord {
  playerId: string
  disconnectedAt: number  // Unix ms
  reason: 'heartbeat' | 'forfeit'
}
```

## Requirements

### Requirement: Player Disconnection (`disconnectPlayer`)

The system MUST mark a player as disconnected and emit `player_disconnected` when the WS layer calls `disconnectPlayer(match, playerId, disconnectedAt)`. SHALL be a no-op if already disconnected. MUST emit `game_error` with `PLAYER_NOT_FOUND` if playerId is invalid.

| Precondition | Postcondition | Events |
|---|---|---|
| Player is connected, match active | `isConnected=false`, `lastActionAt=disconnectedAt` | `player_disconnected` |
| Player already disconnected | No state change | None |
| Invalid playerId | No state change | `game_error { code: PLAYER_NOT_FOUND }` |

#### Scenario: Normal disconnect

- GIVEN P2 is connected and match status is `in_progress`
- WHEN `disconnectPlayer(match, 'p2', 1000)` is called
- THEN `players[1].isConnected` MUST be `false`
- AND `players[1].lastActionAt` MUST be `1000`
- AND events MUST contain `{ type: 'player_disconnected', playerId: 'p2', reconnectWindowMs: 30000 }`

#### Scenario: Already disconnected (no-op)

- GIVEN P2 is already disconnected
- WHEN `disconnectPlayer(match, 'p2', 2000)` is called
- THEN the returned match MUST be identical (same reference or deep-equal)
- AND events MUST be empty

### Requirement: Player Reconnection (`reconnectPlayer`)

The system MUST restore a disconnected player to connected state and emit `player_reconnected` when the WS layer calls `reconnectPlayer(match, playerId, now)`. SHALL be a no-op if already connected.

| Precondition | Postcondition | Events |
|---|---|---|
| Player is disconnected, match active | `isConnected=true`, `lastActionAt=now` | `player_reconnected` |
| Player already connected | No state change | None |
| Invalid playerId | No state change | `game_error { code: PLAYER_NOT_FOUND }` |

#### Scenario: Normal reconnect within window

- GIVEN P2 is disconnected with `isConnected=false`
- WHEN `reconnectPlayer(match, 'p2', 15000)` is called
- THEN `players[1].isConnected` MUST be `true`
- AND events MUST contain `{ type: 'player_reconnected', playerId: 'p2' }`

### Requirement: Forced Pass for Disconnected Player (`forcePassForDisconnected`)

When a disconnected player's turn arrives, the system MUST force a pass via `forcePassForDisconnected(match, playerIndex, now)`. Precondition: player must be at `match.turn.currentTurn`. MUST emit `turn_timeout { forcedPass: true }`. SHALL cascade to `hand_ended` if the board becomes blocked.

| Precondition | Postcondition | Events |
|---|---|---|
| Disconnected player is currentTurn | `player.consecutivePasses++`, turn advanced, deadline reset | `turn_timeout { forcedPass: true }`; may cascade `hand_ended` |
| Player index !== currentTurn | No state change | `game_error { code: NOT_YOUR_TURN }` |

#### Scenario: Normal forced pass

- GIVEN P1 is disconnected and `currentTurn = 0`
- WHEN `forcePassForDisconnected(match, 0, 5000)` is called
- THEN `players[0].consecutivePasses` MUST increment by 1
- AND `turn.currentTurn` MUST advance to 1
- AND events MUST contain `{ type: 'turn_timeout', playerId: 'p1', forcedPass: true }`

#### Scenario: Wrong player index

- GIVEN `currentTurn = 1` (P2's turn)
- WHEN `forcePassForDisconnected(match, 0, 5000)` is called
- THEN events MUST contain `game_error` with `NOT_YOUR_TURN`
- AND match state MUST be unchanged

### Requirement: Reconnect Window Check (`checkReconnectWindow`)

The system MUST provide a pure function `checkReconnectWindow(record, now)` that returns `{ windowExpired: boolean, secondsLeft: number }`. SHALL NEVER modify state or emit events.

#### Scenario: Within window

- GIVEN `record.disconnectedAt = 0`, `now = 15000`
- WHEN `checkReconnectWindow(record, now)` is called
- THEN `windowExpired` MUST be `false`
- AND `secondsLeft` MUST be `15`

#### Scenario: Exactly at window boundary

- GIVEN `record.disconnectedAt = 0`, `now = 30000`
- WHEN `checkReconnectWindow(record, now)` is called
- THEN `windowExpired` MUST be `true`
- AND `secondsLeft` MUST be `0`

#### Scenario: Past window

- GIVEN `record.disconnectedAt = 0`, `now = 45000`
- WHEN `checkReconnectWindow(record, now)` is called
- THEN `windowExpired` MUST be `true`
- AND `secondsLeft` MUST be `0`

### Requirement: Match Abandonment (`checkAbandonment`)

The system MUST end the match if `now - disconnectedAt >= ABANDONMENT_THRESHOLD_MS` (60s). SHALL NOT call `handleHandEnd`. MUST set `status='abandoned'` and emit `match_abandoned { reason: 'abandonment' }`. SHALL be a no-op before threshold.

| Precondition | Postcondition | Events |
|---|---|---|
| elapsed < 60s | No state change | None |
| elapsed >= 60s, match active | `status='abandoned'` | `match_abandoned { reason: 'abandonment' }` |
| match already 'finished' or 'abandoned' | No state change | None |

#### Scenario: Abandonment after threshold

- GIVEN P2 disconnected at `t=0`, `now = 60000`, match status `in_progress`
- WHEN `checkAbandonment(match, record, 60000)` is called
- THEN `status` MUST be `'abandoned'`
- AND events MUST contain `{ type: 'match_abandoned', disconnectedPlayerId: 'p2', reason: 'abandonment' }`

#### Scenario: Before threshold (no-op)

- GIVEN P2 disconnected at `t=0`, `now = 30000`
- WHEN `checkAbandonment(match, record, 30000)` is called
- THEN returned match MUST be unchanged
- AND events MUST be empty

### Requirement: Forfeit (`forfeitMatch`)

A player MAY forfeit voluntarily. The system MUST end the match immediately — no window, no timer. MUST set `status='abandoned'`, `player.isConnected=false`, emit `match_abandoned { reason: 'forfeit' }`. MUST reject with `MATCH_ALREADY_OVER` if match already ended.

#### Scenario: Voluntary forfeit

- GIVEN P3 is connected, match active
- WHEN `forfeitMatch(match, 'p3', 5000)` is called
- THEN `status` MUST be `'abandoned'`
- AND `players[2].isConnected` MUST be `false`
- AND events MUST contain `{ type: 'match_abandoned', disconnectedPlayerId: 'p3', reason: 'forfeit' }`

#### Scenario: Forfeit on finished match (error)

- GIVEN match status is `'finished'`
- WHEN `forfeitMatch(match, 'p3', 5000)` is called
- THEN events MUST contain `game_error { code: 'MATCH_ALREADY_OVER' }`
- AND match state MUST be unchanged

### Error Codes

| Code | Condition | Functions |
|---|---|---|
| `PLAYER_NOT_FOUND` | playerId not found in match.players | `disconnectPlayer`, `reconnectPlayer` |
| `MATCH_ALREADY_OVER` | status is `'finished'` or `'abandoned'` | `forfeitMatch` |
| `NOT_YOUR_TURN` | playerIndex !== currentTurn | `forcePassForDisconnected` |

### Timer Interaction

```
T+0:  disconnectPlayer() → isConnected=false, events emitted
      If currentTurn = disconnected player: WS starts forced-pass cycle
T+5:  Heartbeat timer expires (informational for WS layer)
T+20: WS checks: 10s until reconnect window expires → reconnection_window_expiring
T+30: Reconnect window expires. Player may still reconnect until T+60
T+45: Turn timeout (independent — forces pass even if disconnected)
T+60: checkAbandonment() → status='abandoned', match ends
```

The 45s turn timeout and 60s abandonment timer run INDEPENDENTLY. A disconnected player may have passes forced by either mechanism.

### Test Plan

| Function | Test Cases |
|---|---|
| `disconnectPlayer` | normal disconnect, already disconnected (no-op), invalid playerId |
| `reconnectPlayer` | normal reconnect, already connected (no-op), invalid playerId |
| `forcePassForDisconnected` | normal forced pass, wrong player index, blocked board after pass |
| `checkReconnectWindow` | within window, exactly at window, past window |
| `checkAbandonment` | before threshold, at threshold, past threshold, match already over |
| `forfeitMatch` | normal forfeit, match already over |

Total: ~20-22 tests. Target: all pass under `bun test`, `biome:check`, `tsc --noEmit`.
