# Tasks: Board Layout v2 — Clean Three-Layer Architecture

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

## Phase 1: Foundation — Data Model & BoardPath

- [x] 1.1 Add `slotIndex: number` to PlacedTile in `packages/shared/src/types.ts`
- [x] 1.2 Add `flipped: boolean` to PlacedTile in `packages/shared/src/types.ts`
- [x] 1.3 Mirror PlacedTile changes in `packages/backend/src/game/types.ts`
- [x] 1.4 Create `BoardPathSlot` type + `generatePath()` in `packages/shared/src/game/board-path.ts`
- [x] 1.5 Add `resolveSlotIndex()`, `resolveFlipped()` helpers to board-path.ts
- [x] 1.6 Write RED→GREEN tests: BoardPath deterministic, 109 slots, slot index ranges

## Phase 2: Core — Placement Logic & LayoutEngine

- [x] 2.1 Modify `place()` in `packages/shared/src/game/board.ts` to compute flipped + slotIndex on placement
- [x] 2.2 Write RED→GREEN tests: flipped known pairs (rightEnd=5, tile(5,3)→true; leftEnd=3, tile(6,3)→false)
- [x] 2.3 Write RED→GREEN tests: slotIndex right=1,2,3 / left=-1,-2,-3 in order
- [x] 2.4 Update DominoTile component to accept square-cell dimensions (CELL=48, ratio 2:1)
- [x] 2.5 Create `packages/frontend/src/components/game/layout-engine.ts` — serpentine layout with CELL-based sizing
- [x] 2.6 Write tests: LayoutEngine produces correct grid-aligned positions (no off-grid fractions, no overlap)

## Phase 3: Integration — Simplify game-board.tsx

- [x] 3.1 Update game-board.tsx to import and use LayoutEngine instead of inline algorithm
- [x] 3.2 Remove inline `calculateSerpentineLayout` from game-board.tsx
- [x] 3.3 Replace `displayTile` swap logic with pre-computed `flipped` field
- [x] 3.4 Update orientation logic: doubles in straight runs → vertical, non-doubles in straight runs → horizontal
- [x] 3.5 Update existing test fixtures for new PlacedTile shape (add slotIndex + flipped)

## Phase 4: Verify — Invariant Tests

- [x] 4.1 No overlap: 20-tile full serpentine bounding box intersection check
- [x] 4.2 Orientation invariants: center=vertical, doubles-in-run=vertical, non-doubles-in-run=horizontal, bends=vertical
- [x] 4.3 Responsive consistency: same 8 tiles at 320px, 600px, and 1200px widths
- [x] 4.4 Empty/edge: returns [] for empty input, single tile centered at x=0
- [x] 4.5 Final verification: `bun test` pass + `bun run biome:check` pass
