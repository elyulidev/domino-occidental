# Exploration: board-layout

## Current State

The current domino board layout in `game-board.tsx` uses a row-based `buildCenterRows` approach that:

1. Groups tiles into rows based on container width
2. Places left overflow tiles ABOVE the main row
3. Places right overflow tiles BELOW the main row
4. Centers the main row with the first tile in the middle
5. Uses `snakeRows` to wrap tiles into rows of fixed width

This creates a disconnected layout where left arm snakes upward from center, right arm snakes downward, with no visual continuity between rows.

## What the User Wants

A continuous serpentine path where domino tiles form a single connected line that "folds" at the container edges:

1. First tile (usually a double) placed VERTICALLY in center
2. Tiles extend HORIZONTALLY to the right
3. At container edge, next tile becomes VERTICAL "bend" tile changing direction
4. Bend direction alternates (UP/DOWN)
5. After bend, tiles continue HORIZONTALLY opposite direction
6. Doubles always VERTICAL
7. Board shows both left and right extensions from center

## Affected Areas

- `packages/frontend/src/components/game/game-board.tsx` — Main board component
- `packages/frontend/src/components/game/domino-tile.tsx` — Tile rendering (orientation)
- `packages/frontend/src/components/game/__tests__/game-board.test.ts` — Layout tests

## Approaches Compared

### A. Absolute Positioning with Coordinate Calculation (RECOMMENDED)

Pre-calculate x,y coordinates for each tile based on the serpentine path. Position tiles using CSS `position: absolute` with `left/top`. Container auto-sizes based on calculated bounds.

| Pros | Cons |
|------|------|
| Full control over exact positioning | Complex coordinate calculation |
| Perfect serpentine path | Needs container resize handling |
| Works with existing DominoTile | More JS computation |
| Responsive container auto-sizing | z-index management for bends |

**Effort:** Medium

### B. Flexbox/Grid with Wrapping Rows

Keep row-based approach with alternating `flex-direction: row-reverse` for odd rows. Bend tiles connect rows visually.

| Pros | Cons |
|------|------|
| Leverages existing logic | May not achieve perfect serpentine |
| CSS handles layout | Bend tiles might not connect visually |
| Better performance | Limited positioning control |

**Effort:** Low-Medium

### C. SVG/Canvas (NOT RECOMMENDED)

Render entire board as SVG or Canvas with full control over tile positioning.

| Pros | Cons |
|------|------|
| Perfect control | Complete rewrite required |
| Smooth animations | Accessibility challenges |
| Single rendering context | Complex hit-testing |
| | High effort |

**Effort:** High

## Recommendation

**Approach A** — Absolute Positioning with Coordinate Calculation. Provides exact control for perfect serpentine path, maintains compatibility with existing DominoTile component, and can be implemented incrementally while preserving existing functionality.

## Risks

- Complex coordinate calculation may introduce bugs
- Container resizing could cause layout jumps
- Need to maintain backward compatibility with existing tests
- May require new test cases for serpentine-specific logic

## Ready for Proposal

Yes — proceed with proposal creation using absolute positioning approach.
