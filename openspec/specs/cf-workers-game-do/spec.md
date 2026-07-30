# cf-workers-game-do Specification

## Purpose

Durable Object owning a single active match: WebSocket connections (Hibernation API), game state (`this.ctx.storage`), and timers (`alarm()`). Replaces the in-memory `GameState` Map + `TimerManager` from Elysia/Bun.

## Requirements

### Requirement: WS Lifecycle

The system SHALL manage WS connections via CF Hibernation API. On `open`, the DO SHALL extract `?token=` from the request URL, verify JWT via `jose.jwtVerify`, derive `userId` from the token's `sub` claim, and accept via `acceptWebSocket(ws, [userId])`.

#### Scenario: Valid 4th player starts match

- GIVEN 3 players connected, match status `waiting`
- WHEN a 4th player opens a valid WS connection
- THEN `getWebSockets().length >= 4` and `started === false`
- AND status transitions to `in_progress`
- AND `round_started` event broadcast to all 4 players
- AND `started` set to `true` (prevents double-start)

#### Scenario: Missing token rejects connection

- GIVEN a WS open request without `?token=`
- WHEN the `open` handler processes it
- THEN the connection is closed immediately (code 4001)

#### Scenario: Invalid JWT rejects connection

- GIVEN a WS open request with a malformed JWT
- WHEN `jose.jwtVerify` throws
- THEN the connection is closed (code 4001)

### Requirement: alarm() State Machine

The system SHALL use a **single-alarm** design. One alarm fires at `min(heartbeatDue, turnCheckDue, abandonmentDue)`. On fire, the handler checks ALL deadlines against `Date.now()` and processes all due timers in one pass. After processing, the alarm is rescheduled to the next earliest deadline.

#### Scenario: Turn timeout forces pass

- GIVEN `turnCheckDue <= Date.now()` and `turnDeadline` expired
- WHEN `alarm()` fires
- THEN `checkTimeout(match, now)` from `@domino/shared` is called
- AND forced `player_passed` + `turn_timeout` events broadcast
- AND `turnCheckDue` rescheduled to `now + 2000`

#### Scenario: Heartbeat checks presence

- GIVEN `heartbeatDue <= Date.now()`
- WHEN `alarm()` fires
- THEN each player's presence is checked via `getWebSockets()` tag membership
- AND absent players trigger `disconnectPlayer()` + `player_disconnected` broadcast
- AND `heartbeatDue` rescheduled to `now + 5000`

#### Scenario: Abandonment ends match

- GIVEN `abandonmentDue <= Date.now()` and disconnected player hasn't returned
- WHEN `alarm()` fires
- THEN `checkAbandonment(match, record, now)` is called
- AND `match_abandoned` event broadcast to remaining players
- AND `storage.deleteAlarm()` cancels future alarms

#### Scenario: Reconnect cancels abandonment

- GIVEN `abandonmentDue = now + 40000` for disconnected P2
- WHEN P2 reconnects (new WS open with same userId)
- THEN `abandonmentDue` set to `null`
- AND `player_reconnected` broadcast
- AND `turnDeadline` refreshed if P2 was on turn

### Requirement: State Storage

The system SHALL persist all mutable state in `this.ctx.storage`. Storage shape:

| Field | Type | Description |
|-------|------|-------------|
| `match` | `MatchState` | Full game state from `@domino/shared` |
| `heartbeatDue` | `number` | Unix ms for next heartbeat check |
| `turnCheckDue` | `number` | Unix ms for next turn timeout check |
| `abandonmentDue` | `number \| null` | Unix ms; `null` if no disconnect pending |
| `pausedPlayerId` | `string \| null` | Disconnected player on turn (pause turn timer) |
| `started` | `boolean` | Prevents double-start on 4th connection |

#### Scenario: State survives hibernation

- GIVEN a match in progress
- WHEN the DO hibernates (no events for ~10s)
- WHEN a new WS message arrives
- THEN handlers read from `this.ctx.storage` — state is intact

### Requirement: Broadcasting via Tags

The system SHALL broadcast by iterating `this.ctx.getWebSockets()`, matching each socket's tag to `playerId`. The `game_error` event type SHALL only be sent to the acting player (privacy filtering, same logic as current `broadcaster.ts`).

#### Scenario: Private error not leaked

- GIVEN P1 sends an invalid tile play
- WHEN `game_error` `INVALID_PLAY` is generated
- THEN only P1 receives the error
- AND other players' state is unchanged

### Requirement: Reconnection

The system SHALL detect reconnection when a new `open` arrives with a `userId` already in `getWebSockets()`. The old connection SHALL be closed. If the player was `isConnected === false`, emit `player_reconnected` and cancel abandonment.

#### Scenario: Reconnect within window

- GIVEN P2 disconnected 10s ago, `abandonmentDue` set to 50s out
- WHEN P2 opens new WS with valid JWT (same userId)
- THEN old connection closed, new accepted
- AND `player_reconnected` broadcast to other players
- AND `abandonmentDue` set to `null`

### Requirement: Error Handling

The system SHALL catch DO storage failures, log to console, and reject the action. If `alarm()` throws, CF Workers auto-requeues the alarm. All game logic calls are pure functions from `@domino/shared` (< 1ms), well within CF's 30s CPU limit.

#### Scenario: Storage quota exceeded

- GIVEN `storage.put()` throws quota error
- WHEN state update fails
- THEN a `game_error` `STORAGE_ERROR` is sent to the acting player
- AND the alarm remains scheduled (CF auto-retries)
