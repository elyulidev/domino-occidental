# Proposal: Scoring Module

## Intent

Implement pure functions for hand scoring, match-end detection, and point calculation — Module 5 of 7 in GameState decomposition. The engine layer calls these functions to compute hand results and determine when a match ends.

## Scope

### In Scope
- `PairIndex`, `ScoreState`, `HandResult`, `MatchResult` types
- 7 pure functions in `src/game/scoring.ts`
- Unit tests in `src/game/__tests__/scoring.test.ts`

### Out of Scope
- Match flow orchestration (the engine calls these — not part of this module)
- Turn management, board placement, first-player selection
- ELO computation (consumes match results later)
- GameState aggregation

## Capabilities

### New Capabilities
- `scoring`: Hand scoring, blocked-hand resolution, match-end detection, and null-round tracking for double-9 domino.

### Modified Capabilities
- None

## Approach

Pure-function module following `deck.ts`/`turn.ts` patterns. No classes, no side effects, immutable returns. `HandResult` is the central contract — the engine feeds it into `applyHandResult()`.

| Function | Signature | Description |
|----------|-----------|-------------|
| `getPairIndex` | `(p: number) => PairIndex` | `0` for P1/P3, `1` for P2/P4 |
| `scoreHand` | `(hands: Tile[][], isBlocked: boolean, consecutiveAnnulled: number) => HandResult` | Computes winner + points for a finished hand |
| `createScoreState` | `() => ScoreState` | Factory: `scores: [0,0]`, `isTiebreaker: false` |
| `applyHandResult` | `(state: ScoreState, result: HandResult) => ScoreState` | Returns new state with points applied |
| `checkMatchEnd` | `(state: ScoreState) => MatchResult` | Returns `{ isOver, winner, reason }` — target 200 |
| `calculateTotal` | `(hand: Tile[]) => number` | Sum of `top + bottom` for all tiles in hand |

### Pair mapping

| PairIndex | Players |
|-----------|---------|
| `0` | P1 (idx 0) + P3 (idx 2) |
| `1` | P2 (idx 1) + P4 (idx 3) |

### Tiebreaker logic

- Both pairs ≥ 200 same round → higher score wins.
- Exact tie → tiebreaker hands until one pair leads.
- `consecutiveAnnulled ≥ 4` → lowest global sum wins (per AGENTS.md §5).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modified | Add `PairIndex`, `ScoreState`, `HandResult`, `MatchResult` |
| `src/game/scoring.ts` | New | 7 pure functions (~200 LOC) |
| `src/game/__tests__/scoring.test.ts` | New | ~20 unit tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Null-round cascade at 4+ | Low | `scoreHand` handles via `consecutiveAnnulled` param |
| Match-end both ≥ 200 | Low | Explicit tiebreaker path in `checkMatchEnd` |

## Rollback Plan

Delete `scoring.ts` and `scoring.test.ts`. Revert types added to `types.ts`. No other modules affected — scoring is a leaf dependency.

## Dependencies

- `Tile` from `src/game/types.ts` (for `calculateTotal` signature)

## Success Criteria

- [ ] `bun test` passes all scoring tests
- [ ] `bun run biome:check` passes
- [ ] `tsc --noEmit` passes
- [ ] All 7 functions covered > 80%, incl. blocked hands, annulled rounds, tiebreaker, match-end edge cases
