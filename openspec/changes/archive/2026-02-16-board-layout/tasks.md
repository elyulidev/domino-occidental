# Tasks: Board Layout — Serpentine Redesign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation — Coordinate Calculation Function

- [x] 1.1 Add `TilePosition` interface and `calculateSerpentineLayout` function signature to `game-board.tsx`
- [x] 1.2 Implement `calculateSerpentineLayout` — two-pass center-outward algorithm (left arm, right arm)
- [x] 1.3 Implement bend detection: when next tile exceeds usable width, emit vertical bend, flip direction, alternate up/down
- [x] 1.4 Implement centering offset: post-process positions so first tile sits at container center (R4)

## Phase 2: Core Implementation — GameBoard Rewrite

- [x] 2.1 Rewrite `GameBoard` component: replace `buildCenterRows`/`snakeRows` with `calculateSerpentineLayout` calls
- [x] 2.2 Render tiles using absolute positioning: `<div style={{ left, top, position: 'absolute' }}>` per tile
- [x] 2.3 Wire `BoardTile` sub-component: pass orientation from `TilePosition`, mark bends and first tile
- [x] 2.4 Add `ResizeObserver` with 100ms debounce for coordinate recalculation on container resize (R7)
- [x] 2.5 Add CSS transition class: `transition-all duration-300 ease-out` on tile mount (R6)
- [x] 2.6 Remove `buildCenterRows`, `snakeRows`, `tilesPerRow` exports and functions

## Phase 3: Tests

- [x] 3.1 Test `calculateSerpentineLayout` — single tile, 3 tiles (no bend), 8+ tiles (with bends) (R1)
- [x] 3.2 Test bend alternation: up/down/up with enough tiles (R2)
- [x] 3.3 Test tile orientation by position: first tile vertical, horizontal runs horizontal, bends vertical (R3)
- [x] 3.4 Test first tile centering: single tile and 10-tile chain (R4)
- [x] 3.5 Test responsive: 320px mobile vs 1200px desktop (R5)
- [x] 3.6 Test edge cases: left-only, right-only, mixed sides, 20 tiles (R8)
- [x] 3.7 Keep existing tests for `buildDisplayOrder`, `formatPipValue`, `playerColorClass`, `playerIdToIndex`, `isDoubleTile`

## Phase 4: Integration

- [x] 4.1 Verify build: `bun run build` in frontend passes
- [x] 4.2 Verify tests: `bun test` passes with updated assertions
- [x] 4.3 Run biome: `bun run biome:check` — pre-existing config issue (schema version mismatch), not caused by this change
