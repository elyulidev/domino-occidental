# Round-Match Flow Specification

## Purpose

Define the match lifecycle orchestration layer that connects deck, board, player, turn, and scoring modules into a cohesive event-driven flow: initialize → start hand → play/pass/timeout → score hand → end match. This is the final pure-logic module (Module 6 of 7) before WebSocket integration.

## Requirements

### Requirement: Match Types

The system MUST define `MatchStatus`, `MatchState`, `ActionResult`, and `GameEvent` in `src/game/types.ts`.

#### Scenario: MatchState after initialization

- GIVEN 4 player hands of 10 tiles each and a 15-tile pool
- WHEN `initializeMatch()` is called
- THEN `status` MUST be `in_progress`
- AND `poolCount` MUST equal `pool.length`
- AND `targetScore` MUST default to 200

#### Scenario: ActionResult contracts

- GIVEN any action on a valid `MatchState`
- WHEN the function returns
- THEN `match` MUST be a complete immutable `MatchState`
- AND `events` MUST be `GameEvent[]` in causal order

### Requirement: Match Lifecycle Functions

The system MUST provide 7 pure functions. Every action validates preconditions and returns `ActionResult { match, events }`.

| Function | Preconditions | Postconditions | Events |
|----------|--------------|----------------|--------|
| `initializeMatch(id, hands, pool, target?)` | 4x10-tile hands + 15 pool | Players, board, turn, scores created; pool stored | None |
| `startHand(m)` | status `in_progress` | Board fresh, passes reset, first player set with deadline | `round_started` |
| `playTile(m, pid, tid, side)` | Correct turn, has tile, playable, connected | Tile removed, board updated, passes reset, turn + deadline advanced | `tile_played`; cascade: `hand_ended` → `hand_scored` → `match_ended` |
| `passTurn(m, pid)` | Correct turn, hand non-empty, connected | Passes incremented, turn + deadline advanced | `player_passed`; may trigger `hand_ended` if blocked |
| `checkTimeout(m, now)` | — | Forces pass if `now > turnDeadline` | `turn_timeout` + forced `player_passed` |
| `handleHandEnd(m)` | Terminal board state | Winner resolved, scores applied, null-round tracked, match-end checked | `hand_ended`, `hand_scored`; optionally `match_ended` |
| `isBlocked(board, players)` | — (pure) | Returns `true` iff no player with tiles can play | None |

#### Scenario: Normal hand — empty hand win

- GIVEN P1 plays a tile that empties their hand
- WHEN `handleHandEnd` is called
- THEN `hand_ended` emits with `reason: 'empty_hand'`, `winner: 0`
- AND P1's pair scores the sum of all opponents' remaining tiles

#### Scenario: Blocked board — all pass

- GIVEN all 4 players cannot play consecutively
- WHEN `isBlocked` returns `true`
- THEN `handleHandEnd` resolves via pair sums (lower sum wins)
- AND if pair sums are equal, the hand is annulled (null round)

#### Scenario: 4th consecutive null round

- GIVEN `consecutiveNullRounds === 3`
- WHEN a 4th blocked hand occurs
- THEN `handleHandEnd` forces winner via lowest individual tile sum
- AND the winner's pair scores normally

#### Scenario: Match ends at target

- GIVEN scores [190, 170] and a hand awards 15 to Pair 0 → [205, 170]
- WHEN `checkMatchEnd` is called
- THEN `{ isOver: true, winner: 0 }` is returned
- AND `match_ended` event is emitted, `status` → `finished`

#### Scenario: Both pairs exceed target

- GIVEN scores [198, 195] and a hand updates to [203, 201]
- THEN the higher score wins
- AND if scores tie exactly, `isTiebreaker` activates

#### Scenario: Turn timeout forces pass

- GIVEN `now > turnDeadline` for current player
- WHEN `checkTimeout` is called
- THEN `turn_timeout` event is emitted
- AND a forced `player_passed` follows, turn advances

#### Scenario: Wrong player rejected

- GIVEN `currentTurn = 1` (P2's turn)
- WHEN P1 calls `playTile`
- THEN `game_error` with code `NOT_YOUR_TURN` is emitted
- AND match state is unchanged

### Requirement: Error Handling

The system MUST return `game_error` events (not throw) for validation failures.

| Code | Condition |
|------|-----------|
| `NOT_YOUR_TURN` | `playerIndex !== currentTurn` |
| `TILE_NOT_FOUND` | `hasTile` returns false |
| `INVALID_PLAY` | `canPlay` returns false |
| `MATCH_NOT_ACTIVE` | `status !== 'in_progress'` |
| `PLAYER_DISCONNECTED` | `isConnected === false` |
| `HAND_EMPTY` | `passTurn` with empty hand |
| `MATCH_ALREADY_OVER` | `status === 'finished'` |

All functions MUST be pure — no mutations of input state. Each MUST return new state objects.
