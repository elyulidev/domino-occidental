# Proposal: board-layout-v2

## Intent

Refactor the board layout system to a clean three-layer architecture (path model → layout engine → React component) with a simplified orientation model. No L-shaped tiles, no special double handling. Add `slotIndex` and `flipped` fields to `PlacedTile` for unambiguous game state. Visual output stays identical; internal quality improves.

## Scope

### In Scope
- `slotIndex` + `flipped` fields added to `PlacedTile` (shared + backend types)
- `packages/shared/src/game/board-path.ts` — abstract path generation + slot helpers
- `packages/frontend/src/components/game/layout-engine.ts` — responsive serpentine pixel calculation
- `game-board.tsx` rewritten to consume layout engine (replace current inline algorithm)
- `packages/shared/src/game/board.ts` — `place()` updated to compute `flipped`/`slotIndex`
- Test suite updated for new `PlacedTile` shape and layout engine

### Out of Scope
- Visual appearance changes (domino-tile.tsx untouched)
- `game-board.snake.tsx` cleanup (defer to separate cleanup task)
- Replay system (slot indices enable it but don't implement it)
- Backend game types sync (included in scope since it's a type change)

## Capabilities

### New Capabilities

None — this is a refactor of the existing board rendering capability.

### Modified Capabilities

- `board-rendering`: Orientation model simplified to `horizontal`/`vertical` only. Layout engine extracted to pure function. `flipped` field replaces runtime swap logic. Responsive behavior unchanged (320px–1200px+).

## Approach

Three-layer architecture:

1. **BoardPath** (`shared/src/game/board-path.ts`): Precompute abstract path with slot indices (0–108). Each slot knows its index and direction. No pixel data. Pure data, no React.

2. **LayoutEngine** (`frontend/.../layout-engine.ts`): Pure function `(display, centerIdx, containerWidth) → TilePosition[]`. Two-pass center-outward layout. Dynamic row width from container. Only `horizontal`/`vertical` orientations. Bend transitions BETWEEN tiles.

3. **React component** (updated `game-board.tsx`): Consumes layout engine. All orientation logic removed from render path. `BoardTile`'s display swap logic replaced by `flipped` field.

## Affected Files

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add `slotIndex: number` + `flipped: boolean` to `PlacedTile` |
| `packages/shared/src/game/board.ts` | Update `place()` to compute `flipped` + `slotIndex` |
| `packages/shared/src/game/board-path.ts` | **NEW** — path generation, slot helpers, `resolveFlipped()` |
| `packages/frontend/.../layout-engine.ts` | **NEW** — pure serpentine layout function |
| `packages/frontend/.../game-board.tsx` | Rewrite to consume layout engine |
| `packages/frontend/.../__tests__/game-board.test.ts` | Update tests for new `PlacedTile` shape + layout engine |
| `packages/backend/src/game/types.ts` | Add `slotIndex` + `flipped` to `PlacedTile` (keep in sync) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Layout regression (different visual output) | Medium | Compare screenshots before/after; test suite covers centering, bend positions, responsive behavior |
| `flipped` logic mismatch with current swap | Medium | Hard-code known test cases (e.g. right-side tile with connecting value) and assert `flipped === expected` |
| Backend type out of sync | Low | Update both files in same commit; type check passes |

## Rollback Plan

Revert the single commit. All changes are additive or file replacements — no migration needed since no production data exists yet.

## Success Criteria

- [ ] All existing layout tests pass (updated for new PlacedTile shape)
- [ ] No visual regression: identical rendering at 320px, 600px, 1200px widths
- [ ] All `bun run biome:check` passing
- [ ] `bun test --coverage` maintains or improves current coverage
