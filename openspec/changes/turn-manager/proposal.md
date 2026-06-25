# Proposal: Turn Manager

## Intent

Implement 10 pure functions for turn ordering, timeout enforcement, first-player selection, and null-round tracking. Module 4 of 7 in GameState decomposition, following the pure-function pattern established by tile-deck.

## Scope

### In Scope
- `TurnState` and `TimeoutResult` types in `src/game/types.ts`
- `createTurnState()` — factory returning initial state
- `advanceTurn(state)` — P1→P2→P3→P4→P1 (cyclic)
- `setCurrentTurn(state, playerIndex)` — explicit turn override
- `getNextPlayer(state)` — next player index without mutating
- `calculateDeadline(state, now?)` — set turnDeadline = now + 45s
- `checkTurnTimeout(state, now)` — return `{ timedOut, playerIndex }`
- `incrementNullRounds(state)` / `resetNullRounds(state)` — null-round counter
- `getFirstPlayer(hands)` — highest double wins; fallback to highest sum
- `isNewRound(state)` — detect fresh round from state
- Unit tests in `src/game/__tests__/turn.test.ts`

### Out of Scope
- Game orchestration (engine layer calls these functions)
- Scoring, point calculation, win detection
- Player connection, reconnection, or forfeit logic
- Board state, hand state, or pool tracking

## Capabilities

### New Capabilities
- `turn-manager`: Turn ordering, timeout enforcement, first-player selection, null-round tracking

### Modified Capabilities
- None

## Approach

Pure-function module following deck.ts pattern. Every mutation returns a new `TurnState` (immutable spread). `getFirstPlayer` takes `Tile[][]` to scan for doubles. No classes, no hidden state, no side effects.

**First-player logic**: First hand → scan all hands for highest double (scored by top+bottom). If no doubles, highest sum of all tiles wins. Subsequent hands → winner of previous hand (`lastHandWinner`).

**Timeout**: `calculateDeadline` sets deadline to now+45s. `checkTurnTimeout` compares injected `now` against deadline. Game-engine calls on a 2s interval.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modified | Add `TurnState`, `TimeoutResult` |
| `src/game/turn.ts` | New | All 10 turn functions |
| `src/game/__tests__/turn.test.ts` | New | Unit tests (~20–25 test cases) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Integration with game-engine call order | Low | Pure functions are independently testable |
| `getFirstPlayer` double-detection edge cases | Low | Cover all hands (no double → sum; tie break → impossible with unique doubles) |

## Rollback Plan

Delete `turn.ts`, `turn.test.ts`; revert `TurnState`/`TimeoutResult` additions in `types.ts`. All existing modules unchanged.

## Dependencies

- `Tile` type from `src/game/types.ts` (for `getFirstPlayer` signature)

## Success Criteria

- [ ] `bun test` passes all turn tests
- [ ] `bun run biome:check` passes
- [ ] TypeScript compiles with `tsc --noEmit`
- [ ] All 10 functions fully covered > 80%
- [ ] No existing tests broken (deck, board, player modules unchanged)
