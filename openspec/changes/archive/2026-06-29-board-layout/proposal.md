# Proposal: Board Layout — Serpentine Redesign

## Intent

Current `buildCenterRows` wraps tiles into disconnected rows (left overflow above, right below, main centered). This breaks visual continuity for longer lines of play. Replace with a continuous serpentine (snake) path where tiles fold at container edges — matching how a physical domino board reads.

## Scope

### In Scope
- Rewrite `game-board.tsx` — absolute positioning with coordinate calculation
- Keep `game-board.snake.tsx` as backup of current implementation
- New `coordinateCalculation` logic: pre-compute x,y for each tile along serpentine path
- Update tests in `game-board.test.ts`: replace `buildCenterRows`/`snakeRows` assertions with new coordinate layout assertions
- Existing pure helpers (`formatPipValue`, `playerColorClass`, `playerIdToIndex`) remain unchanged

### Out of Scope
- Zoom, scroll, drag, magnetic attraction (deferred)
- Tile placement animations beyond CSS transitions
- SVG/Canvas rewrite
- Server-side changes

## Capabilities

### New Capabilities
- `board-rendering`: Visual layout of the domino board — serpentine path algorithm, coordinate calculation, responsive container sizing, tile positioning and orientation

### Modified Capabilities
- None (no existing spec changes behavior — this is a new capability)

## Approach

Absolute positioning with coordinate calculation (exploration recommendation):

1. **Container**: Fixed max-width, responsive (mobile-first), `position: relative`
2. **Algorithm**: Walk display-order tiles; calculate x,y per tile based on container width. Accumulate horizontally; at edge, insert a vertical "bend" tile, flip direction, continue opposite way
3. **Orientation**: Horizontal tiles → left/right, vertical doubles/bends → up/down w/ z-index for overlap
4. **Center**: First tile always centered in viewport at all times
5. **Sizing**: Derive tile dimensions from `DominoTile` `md` size (64×88 vertical, 88×64 horizontal)
6. **Animations**: CSS `transition: all 0.3s ease` on tile mount

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/components/game/game-board.tsx` | Modified (heavily) | Replace row layout with absolute serpentine |
| `packages/frontend/src/components/game/domino-tile.tsx` | Minor | Orientation handling for new bends |
| `packages/frontend/src/components/game/__tests__/game-board.test.ts` | Modified | Update assertions for new coordinate layout |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Coordinate calculation bugs on edge cases (single tile, doubles at bends) | Med | Test with 0, 1, 2, many tiles + all bent positions |
| Resize causes layout jump | Low | `ResizeObserver` recalculates coordinates on resize |
| Animation edge cases during rapid moves | Low | CSS transitions only, no JS animation timeline |

## Rollback Plan

Restore `game-board.snake.tsx` (backup copy of current implementation) to `game-board.tsx`. Revert test assertions to original.

## Dependencies

- N/A — pure frontend change, no backend deps

## Success Criteria

- [ ] Tiles form a single connected serpentine chain
- [ ] Bend direction alternates correctly at container edges
- [ ] First tile remains centered and visible
- [ ] All existing tests pass with updated serpentine assertions (not row-based)
- [ ] Responsive: works on mobile (320px) and desktop (1200px)
- [ ] New tiles animate in with CSS transitions on placement
