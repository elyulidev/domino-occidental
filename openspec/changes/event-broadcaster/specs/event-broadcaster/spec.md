# Event Broadcaster Specification

## Purpose

Thin routing layer that dispatches `GameEvent[]` arrays from the game handler to correct recipients with privacy filtering. Attaches optional `SanitizedMatchState` snapshots and exposes targeted state push for reconnection and initial join.

## Requirements

### Requirement: broadcastEvents routes events per privacy rules

The system **MUST** route `game_error` events exclusively to the `actingPlayerId` (private). All other 10 event types (`round_started`, `tile_played`, `player_passed`, `turn_timeout`, `hand_ended`, `hand_scored`, `match_ended`, `player_disconnected`, `player_reconnected`, `reconnection_window_expiring`, `match_abandoned`) **MUST** broadcast to all 4 players.

The system **MUST** call `sendFn` once per recipient per event. Each call **MUST** pass a `WsServerMessage` envelope. If `state` is provided, it **MUST** be included in the envelope; if undefined, it **MUST** be omitted.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| game_error is private | 4 players, actingPlayerId="p1", a `game_error` event | broadcastEvents called | sendFn called once with "p1" |
| Non-error events broadcast | 4 players, any non-game_error event | broadcastEvents called | sendFn called 4 times (once per player) |
| State included | Valid `SanitizedMatchState` | broadcastEvents with `state` | Envelope includes `{ type, events, state }` |
| State omitted | No `state` parameter | broadcastEvents without `state` | Envelope has no `state` field |
| Empty events is no-op | Empty `events` array (length 0) | broadcastEvents called | sendFn never called |

All 11 event types **SHOULD** be tested individually for correct routing.

#### Scenario: Multiple event types route independently

- GIVEN a batch with `tile_played` and `game_error`
- WHEN `broadcastEvents` is called with 4 players and `actingPlayerId="p1"`
- THEN `tile_played` calls `sendFn` 4 times, `game_error` calls `sendFn` 1 time
- AND total `sendFn` calls = 5

#### Scenario: Optional playerIds overrides recipients

- GIVEN `playerIds = ["p1", "p3"]` instead of the default 4
- WHEN `broadcastEvents` is called with a non-error event
- THEN `sendFn` is called exactly twice ("p1" and "p3")

#### Scenario: sendFn error is caught safely

- GIVEN `sendFn` throws for a specific player ID
- WHEN `broadcastEvents` is called
- THEN the error is caught and logged
- AND remaining recipients still receive the event

### Requirement: sendState pushes targeted state

The system **MUST** call `sendFn` with the given `playerId` and wrap `state` in `{ type: 'game_events', events: [], state }`. This function is self-contained with no event-list dependency.

#### Scenario: sendState delivers to target player

- GIVEN `playerId = "p2"` and a valid `SanitizedMatchState`
- WHEN `sendState` is called
- THEN `sendFn` is called once with `"p2"`
- AND the message is `{ type: 'game_events', events: [], state: <SanitizedMatchState> }`

### Requirement: Types define the broadcast contract

| Type | Signature / Shape | Contract |
|------|------------------|----------|
| `SendFn` | `(playerId: string, event: WsServerMessage) => void` | Synchronous — higher layers may wrap async, broadcaster treats as sync |
| `WsServerMessage` | `{ type: 'game_events', events: GameEvent[], state?: SanitizedMatchState }` | Discriminated union root for all server→client messages; `'game_events'` is the initial variant |
