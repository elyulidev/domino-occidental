# Design: Board Layout — Serpentine Redesign

## Technical Approach

Replace flexbox row-based layout (`buildCenterRows`/`snakeRows`) with absolute-positioned tiles driven by a coordinate calculation function. Walk the display-order tiles in two center-outward passes (left arm, right arm). For each arm, accumulate horizontal tiles left/right from center; when the next tile would overflow the container, emit a vertical bend tile, flip direction, alternate y-axis offset up/down. Post-process all positions to center the first tile in the viewport.

Layout is recalculated on resize via `ResizeObserver` with 100ms debounce. CSS transitions animate tile placement.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Positioning model | `position: absolute` | Flexbox rows, CSS Grid | Disconnected rows break visual continuity. Absolute gives exact pixel control for continuous chain. |
| Tile dimensions | Derive from `DominoTile` `md` size: 88×64 (H), 64×88 (V) | CSS variables, runtime measurement | Single source of truth — `SIZE_MAP.md` in `domino-tile.tsx` already defines these. |
| Gap between tiles | 4px | 0px, 8px | Perceptible separation without breaking visual chain. Matches existing flex-box gap pattern. |
| Bend alternation | Each arm tracks independent `bendUp` bool, starting `true` (up first) | Global counter, mirror both arms | R8 requires independent bends per side. Independent state per arm is simplest correct model. |
| Coordinate system | Anchor at (0,0) for first tile center, post-offset to viewport center | Anchor at left edge | Simpler math per tile. Single centering offset handles R4. |
| Resize handling | `ResizeObserver` + 100ms debounce | `window.resize` event | `ResizeObserver` catches container-specific changes (not just viewport). Debounce avoids thrash during drag. |

## Data Flow

```
game-store: board.tiles[]
       │
       ▼
buildDisplayOrder(tiles)
  → { display: PlacedTile[], centerIdx }
       │
       ▼
calculateSerpentineLayout(display, centerIdx, containerWidth)
  → TilePosition[]  [{ x, y, orientation, isBend }]
       │
       ▼
ResizeObserver (100ms debounce) ──→ recalculate on width change
       │
       ▼
Render: <div> absolutely positioned per TilePosition
  → DominoTile(key, position, orientation, tile, isBend, transitions)
```

The `calculateSerpentineLayout` function is the core — pure function, no DOM, fully testable.

## Algorithm

```
walkArm(tiles[], startIdx, startX, startY, direction, bendUp, usableW):
  x = startX, y = startY, dir = direction, up = bendUp
  for each tile at display-index idx:
    if abs(x + dir * (H_TILE_W + GAP)) > usableW / 2:
      // BEND — tile is VERTICAL at current edge position
      y += up ? -(V_TILE_H + GAP) : (V_TILE_H + GAP)
      positions[idx] = { x: x, y, orientation: "vertical", isBend: true }
      // Flip to continue horizontal row in new direction
      x += dir * (V_TILE_W / 2 + GAP + H_TILE_W / 2)
      dir *= -1; up = !up
    else:
      // HORIZONTAL tile in current arm direction
      positions[idx] = { x: x, y, orientation: "horizontal", isBend: false }
      x += dir * (H_TILE_W + GAP)
```

Constants: `H_TILE_W=88, H_TILE_H=64, V_TILE_W=64, V_TILE_H=88, GAP=4, PADDING=16`.

Centering offset: after both arms are placed, `offsetX = -minX - (maxX - minX) / 2` shifts the first tile to container center.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/frontend/src/components/game/game-board.tsx` | Modify | Remove `buildCenterRows`, `snakeRows`, `tilesPerRow`. Add `calculateSerpentineLayout`. Rewrite component to render absolute-positioned tiles. Keep `buildDisplayOrder`, `formatPipValue`, `playerColorClass`, `playerIdToIndex`. |
| `packages/frontend/src/components/game/__tests__/game-board.test.ts` | Modify | Replace `buildCenterRows`/`snakeRows`/`tilesPerRow` tests with `calculateSerpentineLayout` tests. Keep `buildDisplayOrder`, `formatPipValue`, `playerColorClass`, `playerIdToIndex`, `isDoubleTile` tests. |
| `packages/frontend/src/components/game/game-board.snake.tsx` | Keep | Backup of current implementation — unchanged. |
| `packages/frontend/src/components/game/domino-tile.tsx` | Modify (minor) | No changes needed — already supports `orientation` prop. The `BoardTile` subcomponent handles the orientation logic. |

## Interfaces / Contracts

```typescript
interface TilePosition {
  x: number;           // px relative to container center (after centering offset)
  y: number;           // px relative to center row
  orientation: "horizontal" | "vertical";
  isBend: boolean;
}

function calculateSerpentineLayout(
  display: PlacedTile[],
  centerIdx: number,
  containerWidth: number,
): TilePosition[];
```

Input: display-order tiles (`buildDisplayOrder` output) + container width. Output: one position per input tile. Pure function — zero side effects.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (pure) | `calculateSerpentineLayout` — single tile, 3 tiles (no bend), 8+ tiles (bends), left-only, right-only, mixed sides | Pure function tests: call with known input, assert positions array length and coordinate continuity. No DOM needed. |
| Unit (pure) | Edge cases: empty display, centerIdx boundary, container width = 320 (mobile), 1200 (desktop) | Assert correct bend count and positions stay within container. |
| Unit (pure) | Orientation: first tile vertical, horizontal run tiles horizontal, bend tiles vertical | Each TilePosition orientation field matches R3. |
| Render | `GameBoard` renders tiles with correct position CSS | Mount component with mock store, assert `style={{ left, top }}` values match calculated positions. Verify empty state renders placeholder. |
| Render | CSS transitions on tile mount | Assert `transition` property on new tiles (`.3s ease`). |

## Migration / Rollout

No data migration. This is a component-level replacement. The backup `game-board.snake.tsx` is already in place. Rollback: rename snake backup back to `game-board.tsx` and revert test file.

## Open Questions

- [ ] Should vertical centering (y-offset) be calculated or simply start at y=0 with enough container height? For now, y=0 at center and container grows as-needed.
- [ ] Animation approach: CSS transition on mount works for new tiles. But on resize, ALL positions change — should transition be disabled during resize to avoid visual artifacts?
