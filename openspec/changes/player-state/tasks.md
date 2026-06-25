# Tasks: Player State Module

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120 lines (types.ts: 8, player.ts: 95, player.test.ts: 17) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | force-chained |
| Chain strategy | pending |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add PlayerState interface to types.ts | PR 1 | 8 lines, foundational for all functions |
| 2 | Create 9 pure functions in player.ts | PR 2 | ~95 lines, core functionality |
| 3 | Write 15 tests in player.test.ts | PR 3 | ~17 lines, coverage of all scenarios |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Add `PlayerState` interface to `src/game/types.ts`
- [x] 1.2 Add JSDoc comments and proper exports for the interface

## Phase 2: Core Implementation

- [x] 2.1 Create `src/game/player.ts` with export function declarations
- [x] 2.2 Implement `createPlayer()` - factory function creating player with defaults
- [x] 2.3 Implement `removeTile()` - removes tile by ID, throws if not found
- [x] 2.4 Implement `addTile()` - appends tile to hand, returns new array
- [x] 2.5 Implement `hasTile()` - checks if tile with given ID exists
- [x] 2.6 Implement `setConnected()` - updates connection status
- [x] 2.7 Implement `updateLastAction()` - updates timestamp
- [x] 2.8 Implement `incrementPasses()` - increments consecutive passes
- [x] 2.9 Implement `resetPasses()` - resets passes to 0
- [x] 2.10 Implement `sumHand()` - calculates total value of hand tiles

## Phase 3: Testing / Verification

- [x] 3.1 Implement tests for `createPlayer()` — verify shape and defaults
- [x] 3.2 Implement tests for `removeTile()` — immutability and throw on missing
- [x] 3.3 Implement tests for `addTile()` — immutability and correct append
- [x] 3.4 Implement tests for `hasTile()` — true/false for existing/missing/empty
- [x] 3.5 Implement tests for state transition functions:
- [x] 3.5.1 `setConnected()` toggle immutability
- [x] 3.5.2 `updateLastAction()` timestamp update
- [x] 3.5.3 `incrementPasses()` increment logic
- [x] 3.5.4 `resetPasses()` reset logic
- [x] 3.6 Implement tests for `sumHand()` — scoring and edge cases

## Phase 4: Cleanup / Documentation

- [x] 4.1 Add module-level JSDoc to player.ts
- [x] 4.2 Add export documentation for each function's behavior
- [x] 4.3 Ensure all tests pass with `bun test`
- [x] 4.4 Verify TypeScript compilation with no errors
- [x] 4.5 Run `bun run biome:check` and fix any issues

## Review Workload Forecast Constraints

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
