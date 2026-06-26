# Tasks: Scoring Module

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120 lines (types.ts: 8, scoring.ts: 160, scoring.test.ts: 20, board.ts: 2) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add types (PairIndex, ScoreState, HandResult, MatchResult, TARGET_SCORE) to types.ts | PR 1 | 8 lines, foundational for all functions |
| 2 | Implement pure functions (getPairIndex, calculateTotal, scoreHand, createScoreState, applyHandResult, checkMatchEnd, getLosingPlayers) in scoring.ts | PR 2 | ~160 lines, core scoring logic |
| 3 | Write unit tests (~20 tests) for all scoring functions in scoring.test.ts | PR 3 | ~20 tests, coverage of all scenarios |

## Phase 1: Types (add to types.ts)

- [ ] 1.1 Add `PairIndex` type to `src/game/types.ts`
- [ ] 1.2 Add `ScoreState` interface to `src/game/types.ts`
- [ ] 1.3 Add `HandResult` interface to `src/game/types.ts`
- [ ] 1.4 Add `MatchResult` interface to `src/game/types.ts`
- [ ] 1.5 Add `TARGET_SCORE` constant to `src/game/types.ts`

## Phase 2: Functions (create scoring.ts)

- [ ] 2.1 Implement `getPairIndex` - maps players 0/2→0, 1/3→1
- [ ] 2.2 Implement `calculateTotal` - sums top+bottom for all tiles in hand
- [ ] 2.3 Implement `getLosingPlayers` - helper to get indices of losing players
- [ ] 2.4 Implement `scoreHand` - normal win, blocked hand, annulled cascade logic
- [ ] 2.5 Implement `createScoreState` - factory for initial ScoreState
- [ ] 2.6 Implement `applyHandResult` - immutable ScoreState update with points
- [ ] 2.7 Implement `checkMatchEnd` - detect when match reaches 200 points

## Phase 3: Tests (create scoring.test.ts)

- [ ] 3.1 Test `getPairIndex` for all player indices (0,1,2,3)
- [ ] 3.2 Test `calculateTotal` - normal hand, empty hand, single tile
- [ ] 3.3 Test `getLosingPlayers` - normal wins, blocked scenarios
- [ ] 3.4 Test `scoreHand` - normal win scenarios (P1/P2 empty)
- [ ] 3.5 Test `scoreHand` - blocked hand scenarios (lower pair wins, tie)
- [ ] 3.6 Test `scoreHand` - annulled cascade (3rd annulled, 4th+ override)
- [ ] 3.7 Test `createScoreState` - factory defaults and type checking
- [ ] 3.8 Test `applyHandResult` - points accumulation and immutability
- [ ] 3.9 Test `checkMatchEnd` - under 200, one at 200+, both over 200, tiebreaker
- [ ] 3.10 Test edge cases - empty hands, max values, boundary conditions

## Phase 4: Verification (bun test, biome, tsc)

- [ ] 4.1 Run `bun test` - ensure all scoring tests pass
- [ ] 4.2 Run `bun run biome:check` - ensure lint/formatting passes
- [ ] 4.3 Run `tsc --noEmit` - verify type safety for whole project
- [ ] 4.4 Add JSDoc comments to all exported functions in scoring.ts
- [ ] 4.5 Verify exports are properly exported from types.ts

## Review Workload Forecast Constraints

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Implementation Order

Phase 1 first as types are foundational for all functions. Then Phase 2 implements all pure functions. Phase 3 adds comprehensive unit tests. Phase 4 verifies everything works correctly.

### Test Coverage Requirements

- 4 scenarios for `getPairIndex` (players 0,1,2,3)
- 3 scenarios for `calculateTotal` (normal, empty, single)
- 3 scenarios for `scoreHand` (normal wins, blocked scenarios, annulled cascade)
- 2 scenarios for `applyHandResult` (points accumulation, immutability)
- 4 scenarios for `checkMatchEnd` (under 200, one at 200+, both over 200, tiebreaker)

All edge cases and boundary conditions covered.
