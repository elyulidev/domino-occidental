# Tasks: Board State Module

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150-200 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (stacked-to-main) |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add BoardState, PlacedTile, Side types to src/game/types.ts | PR 1 | Base types for board module |
| 2 | Implement createBoard(), canPlay(), place() functions | PR 2 | Core board logic functions |
| 3 | Write ~15 unit tests in src/game/__tests__/board.test.ts | PR 3 | Test all board scenarios |

## Phase 1: Foundation / Types

- [x] 1.1 Add `Side` type (`'left' | 'right'`) to `src/game/types.ts`
- [x] 1.2 Add `PlacedTile` interface to `src/game/types.ts`
- [x] 1.3 Add `BoardState` interface to `src/game/types.ts`
- [x] 1.4 Export all new types from `src/game/types.ts`

## Phase 2: Core Implementation

- [x] 2.1 Create `src/game/board.ts` with module exports
- [x] 2.2 Implement `createBoard()` function
- [x] 2.3 Implement `canPlay(tile, side, board)` function
- [x] 2.4 Implement `place(tile, side, playerId, board)` function
- [x] 2.5 Add JSDoc comments and type safety for all functions

## Phase 3: Testing

- [x] 3.1 Write tests for `createBoard()` - empty board structure
- [x] 3.2 Write tests for `canPlay()` on empty board - always true
- [x] 3.3 Write tests for `canPlay()` with matching tiles on left/right
- [x] 3.4 Write tests for `canPlay()` with no matches - should return false
- [x] 3.5 Write tests for `canPlay()` when tile matches both ends
- [x] 3.6 Write tests for `place()` first tile - both ends set
- [x] 3.7 Write tests for `place()` extending left end
- [x] 3.8 Write tests for `place()` extending right end
- [x] 3.9 Write tests for `place()` auto-flip behavior
- [x] 3.10 Write tests for `place()` with doubles (matching top/bottom)
- [x] 3.11 Write tests for `place()` invalid placements - throws error
- [x] 3.12 Write tests for immutability - original board unchanged
- [x] 3.13 Write tests for `canPlay()` side-specific matching logic

## Phase 4: Validation & Finalize

- [x] 4.1 Run `bun test` to verify all 15+ tests pass
- [x] 4.2 Run `bun run biome:check` for lint/format compliance
- [x] 4.3 Run `tsc --noEmit` to verify TypeScript compilation
- [x] 4.4 Verify imports work correctly from other modules
- [x] 4.5 Remove any temporary/debug code