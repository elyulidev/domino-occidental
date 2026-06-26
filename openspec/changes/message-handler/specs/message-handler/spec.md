# Message Handler Specification

## Purpose

A thin adapter that routes typed WS messages (play_tile, pass, leave) to
pure engine functions, persists state changes via the store, and returns
sanitized events + sanitized state for broadcast. Contains zero WS, timer,
or IO logic.

## Public API

```typescript
function handleMessage(
  store: GameStore,
  matchId: string,
  playerId: string,
  message: WsClientMessage,
): MessageResult

interface GameStore {
  getGame(matchId: string): MatchState | null;
  updateGame(matchId: string, state: MatchState): void;
}

type WsClientMessage =
  | { type: "play_tile"; tileId: string; side: Side }
  | { type: "pass" }
  | { type: "leave" };

interface MessageResult {
  events: GameEvent[];
  sanitizedState?: SanitizedMatchState;
}

interface SanitizedMatchState {
  matchId: string;
  players: Array<{ id: string; handSize: number; isConnected: boolean }>;
  board: BoardState;
  currentTurn: number;
  scores: [number, number];
  roundNumber: number;
  poolCount: number;
  status: string;
  targetScore: number;
}
```

## Message Routing

| Client message | Engine function | Persisted? |
|---|---|---|
| `{ type: "play_tile", tileId, side }` | `playTile(match, playerId, tileId, side)` | Yes |
| `{ type: "pass" }` | `passTurn(match, playerId)` | Yes |
| `{ type: "leave" }` | `forfeitMatch(match, playerId, now)` | Yes |
| Unknown type | None (reject before engine) | No |

## State Sanitization

Strip all server-only fields before returning state:

| Source field | Target field | Rule |
|---|---|---|
| `match.pool` | removed | Server-only, never sent |
| `match.poolCount` | `poolCount` | Preserved as-is |
| `player.hand` | `player.handSize` | Array replaced with `.length` |
| `player.lastActionAt` | removed | Timestamp stripped |
| `player.consecutivePasses` | removed | Internal counter |
| `turn.currentTurn` | `currentTurn` | Flattened |
| `turn.roundNumber` | `roundNumber` | Flattened |
| `turn.lastHandWinner` | removed | Internal |
| `turn.turnDeadline` | removed | Internal (ms timestamp) |
| `turn.consecutiveNullRounds` | removed | Internal |
| `scores.scores` | `scores` | Flattened to `[number, number]` |
| `scores.isTiebreaker` | removed | Internal |

## Error Handling

| Error | Code | Engine called? | State returned? |
|---|---|---|---|
| Unknown message type | `INVALID_MESSAGE` | No | Current sanitized |
| Match not found | `MATCH_NOT_FOUND` | No | `undefined` |
| Engine error (any) | From engine event | Yes | Current sanitized |

## Requirements

### R1: Route play_tile to playTile

MUST call `playTile()` when receiving a `play_tile` message.

#### Scenario: Valid tile play

- GIVEN a match in "in_progress" and it is the player's turn
- WHEN `handleMessage` receives `{ type: "play_tile", tileId: "t1", side: "right" }`
- THEN `playTile(match, playerId, "t1", "right")` is called
- AND `updateGame(matchId, result.match)` persists the new state
- AND the result contains a `tile_played` event and sanitized state

#### Scenario: Match ends after tile play

- GIVEN a match where the current hand pushes a pair past `targetScore`
- WHEN `handleMessage` processes a valid `play_tile`
- THEN the events include `match_ended`
- AND the sanitized state has `status: "finished"`

### R2: Route pass to passTurn

MUST call `passTurn()` when receiving a `pass` message.

#### Scenario: Valid pass

- GIVEN a match in "in_progress" and it is the player's turn
- WHEN `handleMessage` receives `{ type: "pass" }`
- THEN `passTurn(match, playerId)` is called
- AND the result contains a `player_passed` event and sanitized state

### R3: Route leave to forfeitMatch

MUST call `forfeitMatch()` when receiving a `leave` message.

#### Scenario: Valid forfeit

- GIVEN a match in "in_progress" or "waiting" status
- WHEN `handleMessage` receives `{ type: "leave" }`
- THEN `forfeitMatch(match, playerId, new Date())` is called
- AND the result contains `match_abandoned` with reason `"forfeit"`
- AND the sanitized state has `status: "abandoned"`

### R4: Reject unknown message types

MUST NOT call any engine function for unrecognized message types.

#### Scenario: Unknown type

- GIVEN any match state
- WHEN `handleMessage` receives `{ type: "alien_type" }`
- THEN no engine function is called
- AND result events contain `game_error` with code `INVALID_MESSAGE`
- AND sanitized state is the current state (unchanged)

### R5: Reject unknown match IDs

MUST reject messages for matches not in the store.

#### Scenario: Match not found

- GIVEN `getGame(matchId)` returns `null`
- WHEN `handleMessage` is called with that matchId
- THEN no engine function is called
- AND result events contain `game_error` with code `MATCH_NOT_FOUND`
- AND `sanitizedState` is `undefined`

### R6: Pass through engine errors

MUST forward `game_error` events from engine functions without modification.

#### Scenario: Out-of-turn play

- GIVEN a match where it is NOT the player's turn
- WHEN the player sends `{ type: "play_tile", tileId: "t1", side: "right" }`
- THEN engine returns `game_error` with code `NOT_YOUR_TURN`
- AND those events appear as-is in `MessageResult.events`
