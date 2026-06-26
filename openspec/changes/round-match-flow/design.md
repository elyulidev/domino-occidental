# Design: Round-Match Flow Orchestration

## Technical Approach

Pure-function orchestration layer connecting 5 existing modules (deck, board, player, turn, scoring) via `ActionResult { match, events }` pattern. Each action validates preconditions, composes existing module calls, and returns an immutable `MatchState` plus a causally-ordered event log. No side effects, no classes, no WebSocket dependency — the next module (Module 7) consumes events to drive real-time game I/O.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|----------|---------|-----------|--------|
| Error handling | Exceptions vs error events | Exceptions crash the caller; error events let WS layer decide recovery | **Error events** — `game_error` returned as event, original match state preserved |
| `handleHandEnd` cascade | Auto-call `startHand` vs return events | Auto-call couples scoring to turn lifecycle; returns give caller control | **Return events only** — caller (WS/test) decides when to `startHand` |
| `isBlocked` location | `match.ts` vs `board.ts` | Keeping in board isolates board knowledge; match.ts is already complex | **board.ts** — board state logic stays with board module |
| `pool` in MatchState | Omit vs store for reconnection | Storage costs memory; required for Module 7 abandoned-match persistence | **Store full pool** — needed for reconnection without re-dealing |

## Data Flow

### playTile flow
```
playTile(match, playerId, tileId, side)
  → validate: currentTurn, status=in_progress, isConnected, hasTile, canPlay
  → place(tile, side, playerId, board) [board.ts] → newBoard
  → removeTile(hand, tileId) [player.ts] → newHand
  → resetPasses(player) [player.ts]
  → advanceTurn(turn) [turn.ts] → nextTurn
  → calculateDeadline(nextTurn) [turn.ts]
  → updateLastAction(player) [player.ts]
  → build new MatchState
  → if newHand is empty: handleHandEnd(newMatch, winnerIdx, 'empty_hand')
  → return ActionResult { match, events }
```

### handleHandEnd flow
```
handleHandEnd(match, winnerPlayerIndex, reason)
  → if reason='empty_hand': scoreHand(hands, false, consecNull)[scoring.ts]
  → if reason='blocked': isBlocked(board, players) → true → scoreHand(hands, true, nullCount)
    → if annulled && count < 3: incrementNullRounds → emit hand_ended(annulled)
    → if annulled && count >= 3 (4th): find min sumHand → forced winner → emit hand_ended(forced_winner) + hand_scored
  → if resolved: applyHandResult(scores, handResult) → resetNullRounds → checkMatchEnd(newScores)
    → if match over: status='finished', emit match_ended
    → if not: emit hand_scored only (caller starts next hand)
  → return ActionResult with accumulated events
```

### Event emission order (deterministic)
```
1. Action event: tile_played | player_passed | turn_timeout
2. hand_ended (if hand is over)
3. hand_scored (if scored — skipped on annulled)
4. match_ended (if match over) OR round_started (caller's startHand)
```

### State transitions
```
INITIALIZED ──startHand──► IN_PROGRESS ──playTile/passTurn──► IN_PROGRESS
                                │                                 │
                                └── handleHandEnd ──► HAND_SCORED ─┘
                                                          │
                                              ┌───────────┴───────────┐
                                              ▼                       ▼
                                      startHand (next)          match_ended
                                              │                       │
                                              ▼                       ▼
                                        IN_PROGRESS              FINISHED
                                                                      ▲
                                                              ABANDONED
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/match.ts` | Create | 6 exported functions: `initializeMatch`, `startHand`, `playTile`, `passTurn`, `checkTimeout`, `handleHandEnd` |
| `src/game/board.ts` | Modify | Add `isBlocked(board, players): boolean` — pure check, O(80) max |
| `src/game/types.ts` | Modify | Add `MatchStatus`, `MatchState`, `ActionResult`, `GameEvent` types |
| `src/game/__tests__/match.test.ts` | Create | ~35-40 tests across 8 groups |
| `src/game/__tests__/board.test.ts` | Modify | Add 3-4 tests for `isBlocked` |

## Interfaces / Contracts

```typescript
// Core types in types.ts
type MatchStatus = 'waiting' | 'in_progress' | 'finished' | 'abandoned'
type GameEvent =
  | { type: 'round_started'; firstPlayer: number }
  | { type: 'tile_played'; playerId: string; tileId: string; side: Side; board: BoardState }
  | { type: 'player_passed'; playerId: string }
  | { type: 'turn_timeout'; playerId: string; forcedPass: boolean }
  | { type: 'hand_ended'; winner: number; reason: 'empty_hand' | 'blocked' | 'annulled' | 'forced_winner' }
  | { type: 'hand_scored'; winningPair: PairIndex; points: number; scores: [number, number] }
  | { type: 'match_ended'; winner: PairIndex; finalScores: [number, number]; reason: string }
  | { type: 'game_error'; code: string; message: string }

interface MatchState {
  matchId: string; players: [PlayerState, PlayerState, PlayerState, PlayerState]
  board: BoardState; turn: TurnState; scores: ScoreState
  pool: Tile[]; poolCount: number; status: MatchStatus; targetScore: number
}

interface ActionResult { match: MatchState; events: GameEvent[] }

// Exported functions in match.ts
initializeMatch(matchId: string, hands: [Tile[], Tile[], Tile[], Tile[]], pool: Tile[], targetScore?: number): ActionResult
startHand(match: MatchState): ActionResult
playTile(match: MatchState, playerId: string, tileId: string, side: Side): ActionResult
passTurn(match: MatchState, playerId: string): ActionResult
checkTimeout(match: MatchState, now: number): ActionResult
handleHandEnd(match: MatchState, winnerPlayerIndex: number, reason: 'empty_hand' | 'blocked'): ActionResult
```

## Validation Matrix

| Function | Precondition | Error Code |
|----------|-------------|------------|
| `playTile` | Correct player turn | `NOT_YOUR_TURN` |
| `playTile/passTurn` | `status === 'in_progress'` | `MATCH_NOT_ACTIVE` |
| `playTile/passTurn` | Player connected | `PLAYER_DISCONNECTED` |
| `playTile` | Tile exists in hand | `TILE_NOT_FOUND` |
| `playTile` | Tile playable on side | `INVALID_PLAY` |
| `passTurn` | Hand not empty | `HAND_EMPTY` |
| Any action | `status !== 'finished'` | `MATCH_ALREADY_OVER` |

## Immutability Pattern

**Strict rule: never mutate inputs. Accept state, return new state.**

```typescript
function updatePlayer(
  players: [PlayerState, PlayerState, PlayerState, PlayerState],
  index: 0|1|2|3,
  updater: (p: PlayerState) => PlayerState
): [PlayerState, PlayerState, PlayerState, PlayerState] {
  return players.map((p, i) => i === index ? updater(p) : p) as typeof players
}
```

Every function in `match.ts` follows this pattern for the 4-player tuple. The `buildMatchState` internal helper recomputes `poolCount = pool.length` automatically.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | All 7 functions + isBlocked | ~35-40 tests, `describe` per function |
| Integration | Full hand cycle | 3 tests: normal win → score → next hand; blocked → annulled; timeout → forced pass |

Key test groups: `initializeMatch` (3), `startHand` (4), `playTile` (8-10), `passTurn` (4-5), `checkTimeout` (3), `handleHandEnd` (6-8), `isBlocked` (4), integration (2-3).

## Migration / Rollout

No migration required. This is a new module with no existing data to migrate. The 5 existing modules are unchanged (except `board.ts` addition of `isBlocked`).

## Open Questions

- `hand_ended.winner` for blocked hands: what value? (Proposal: first player index of winning pair, or -1 if annulled — to be decided in implementation)
- Should `startHand` validate that `board.tiles` is empty (hand already in progress guard)? (Proposal: yes — return `game_error` if board has tiles)
