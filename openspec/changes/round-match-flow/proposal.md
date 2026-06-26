# Proposal: Round-Match Flow Orchestration

## Intent

Connect 5 existing pure-function modules (deck, board, player, turn, scoring) into a cohesive **match lifecycle** — dealing → hands → scoring → match-end — via a minimal orchestration layer. This is Module 6 of 7, the final logic module before WebSocket integration.

## Scope

### In Scope
- `MatchState`, `MatchStatus`, `GameEvent`, `ActionResult` types in `types.ts`
- `match.ts`: `initializeMatch`, `startHand`, `playTile`, `passTurn`, `checkTimeout`, `handleHandEnd`
- `board.ts`: `isBlocked(board, players)` (pure check, 4 players × tiles × 2 ends)
- All events: `tile_played`, `player_passed`, `turn_timeout`, `hand_ended`, `hand_scored`, `match_ended`, `round_started`
- Unit tests for every function and event sequence

### Out of Scope
- WebSocket/Elysia handlers (Module 7)
- Disconnection/reconnection, forfeit, heartbeat
- Persistent storage or match history
- Drawing from pool (not in double-9 rules)

## Capabilities

### New Capabilities
- `round-match-flow`: Match lifecycle orchestration — turn validation, hand flow, event emission, and match-end detection

### Modified Capabilities
- `board-state`: Add `isBlocked(board, players)` function
- `turn-manager`: Already provides turn advancement, timeout, null-round tracking (consumed, not changed)

## Proposed Types (in `types.ts`)

```typescript
type MatchStatus = 'waiting' | 'in_progress' | 'finished' | 'abandoned'
type TurnAction = 'play' | 'pass' | 'timeout'
type EventType = 'tile_played' | 'player_passed' | 'turn_timeout'
  | 'hand_ended' | 'hand_scored' | 'match_ended' | 'round_started'

interface MatchState {
  matchId: string
  status: MatchStatus
  players: [PlayerState, PlayerState, PlayerState, PlayerState]
  board: BoardState
  turn: TurnState
  score: ScoreState
  poolCount: number          // tiles remaining (never content)
  targetScore: number        // default 200
}

interface GameEvent {
  type: EventType
  matchId: string
  timestamp: number
  data: Record<string, unknown>  // varies by type
}

interface ActionResult {
  match: MatchState
  events: GameEvent[]
}
```

## Proposed Functions (in `match.ts`)

### `initializeMatch(matchId, hands, pool, targetScore?)`
- Sets `MatchStatus.in_progress`, populates players with hands, creates empty BoardState + TurnState + ScoreState
- Calls: `createBoard`, `createTurnState`, `createScoreState`, `createPlayer` (×4)
- Emits: none (match starts, but first hand not yet begun)

### `startHand(match)`
- Resets board, resets all player passes, determines first player via `getFirstPlayer`, sets deadline
- Calls: `createBoard`, `resetPasses`, `getFirstPlayer`, `setCurrentTurn`, `calculateDeadline`
- Emits: `round_started`
- Validates: match must be `in_progress`, hand must have ended or match just started

### `playTile(match, playerId, tileId, side)`
- Validates turn, player ownership, board legality, match status, connection. Removes tile from player, places on board, advances turn, resets player passes, sets new deadline
- Calls: `hasTile`, `removeTile`, `canPlay`, `place`, `advanceTurn`, `resetPasses`, `calculateDeadline`, `updateLastAction`
- Emits: `tile_played`
- On empty hand after play → delegates to `handleHandEnd`
- Validations: correct turn, player has tile, tile playable, match `in_progress`, player connected

### `passTurn(match, playerId)`
- Validates turn and match status. Increments pass counter, advances turn, sets new deadline
- Calls: `incrementPasses`, `advanceTurn`, `calculateDeadline`, `updateLastAction`
- Emits: `player_passed`
- After pass: checks if all 4 players have passed consecutively → `isBlocked` check
- Validations: correct turn, match `in_progress`, player connected

### `checkTimeout(match, now)`
- Pure check via `checkTurnTimeout`. If timed out, forces a pass via `passTurn` logic
- Calls: `checkTurnTimeout` → `passTurn` chain
- Emits: `turn_timeout` (before the forced pass event)

### `handleHandEnd(match)`
- Central junction: determines `isBlocked` (via board check or all-passed), calls `scoreHand`, applies via `applyHandResult`, checks via `checkMatchEnd`
- Calls: `isBlocked`, `scoreHand`, `applyHandResult`, `checkMatchEnd`, `incrementNullRounds`/`resetNullRounds`
- Emits: `hand_ended`, `hand_scored`, then either `match_ended` or schedules next `round_started`

### `isBlocked(board, players)` (in `board.ts`)
- Iterates all 4 players' tiles; if any tile matches `board.leftEnd` or `board.rightEnd` via `canPlay`, returns `false`. Otherwise `true`.
- Pure check, no side effects.

## Validation Rules

| Function | Rule | Error |
|----------|------|-------|
| `playTile` | Must be player's turn | `"Not your turn"` |
| `playTile` | Player must have the tile | `"Tile not in hand"` |
| `playTile` | Tile must be playable on side | `"Invalid placement"` |
| `playTile` | Match must be `in_progress` | `"Match not in progress"` |
| `playTile` | Player must be connected | `"Player disconnected"` |
| `passTurn` | Must be player's turn | `"Not your turn"` |
| `passTurn` | Match must be `in_progress` | `"Match not in progress"` |
| `passTurn` | Player must be connected | `"Player disconnected"` |

## Game Events

| Event | Emitted By | `data` Payload |
|-------|-----------|----------------|
| `tile_played` | `playTile` | `{ playerId, tileId, side, boardSnapshot }` |
| `player_passed` | `passTurn`, `checkTimeout` | `{ playerId, forced: boolean }` |
| `turn_timeout` | `checkTimeout` | `{ playerId }` |
| `hand_ended` | `handleHandEnd` | `{ winnerIndex, isBlocked, isAnnulled }` |
| `hand_scored` | `handleHandEnd` | `{ winningPair, points, newScores }` |
| `match_ended` | `handleHandEnd` | `{ winner: PairIndex, reason }` |
| `round_started` | `startHand` | `{ firstPlayer }` |

## Edge Cases

| Case | Behavior |
|------|----------|
| Empty board (first tile) | Any tile playable, placed on specified side, sets both ends |
| Board blocks on last play | `handleHandEnd` detects via `isBlocked` after the play |
| All 4 pass consecutively | `passTurn` detects all passes → treats as blocked hand |
| Null round cascade (1st–3rd) | `scoreHand` returns `isAnnulled`; `handleHandEnd` increments null counter |
| 4th consecutive annulled | `scoreHand` forces winner via lowest individual sum |
| Both pairs ≥ 200 | `checkMatchEnd` returns `both_over_200`; higher wins |
| Exact tie at 200+ | `checkMatchEnd` returns tiebreaker mode via `isTiebreaker` |
| Turn timeout | `checkTimeout` forces a pass, emits `turn_timeout` event |
| Wrong turn play | Throws `"Not your turn"` |
| Tile not in hand | Throws `"Tile not in hand"` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| State tree complexity | Med | `ActionResult` pattern keeps nested updates explicit; one function per action |
| `isBlocked` 4-players × 10-tiles × 2-ends check | Low | O(80) worst-case per check — trivial perf cost |
| Event ordering in hand-end cascade | Med | Events emitted in deterministic order: `hand_ended` → `hand_scored` → `match_ended` or `round_started` |
| Inline 4th null-round cascade in match.ts | Low | Kept per user design decision; single `handleHandEnd` entry point |

## Rollback Plan

Delete `match.ts`, revert `MatchState`/`GameEvent`/`ActionResult` additions in `types.ts`, remove `isBlocked` from `board.ts`. All 5 existing modules remain unchanged.

## Dependencies

- `board.ts`: `isBlocked` addition
- `turn.ts`: turn advancement, timeout, first-player, null-round tracking
- `scoring.ts`: `scoreHand`, `applyHandResult`, `checkMatchEnd`
- `player.ts`: `hasTile`, `removeTile`, `resetPasses`, `incrementPasses`, `updateLastAction`
- `types.ts`: new `MatchState`, `MatchStatus`, `GameEvent`, `ActionResult`

## Success Criteria

- [ ] `bun test` passes all match-flow tests (~40 test cases)
- [ ] `bun run biome:check` passes
- [ ] `tsc --noEmit` passes with no errors
- [ ] All 7 event types emitted in correct sequences
- [ ] All validation errors tested
- [ ] All 5 existing test suites still pass (no regressions)
- [ ] Coverage > 80% for match.ts
