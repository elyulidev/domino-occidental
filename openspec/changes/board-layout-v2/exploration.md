# Exploration: board-layout-v2

## Current State

Two approaches exist for the domino board layout:

**Approach A (External AI Spec)** at `public/board-layout/`:
- Precomputed snake path of 109 `PathSlot` objects with fixed 8-column grid
- Each slot stores: `index`, `col`, `row`, `direction`, `isCorner`, `cornerWall`
- 5 render orientations: `horizontal`, `horizontal-flipped`, `corner-right`, `corner-left`, `perpendicular`
- `PlacedTile` has: `tileId`, `slotIndex`, `slot`, `flipped`, `renderOrientation`
- `computeTileCells()` is the single source of truth for pixel positions
- Fixed grid: 8 columns × 15 rows = 120 slots

**Approach B (Current game-board.tsx)** at `packages/frontend/src/components/game/`:
- Dynamic `calculateSerpentineLayout` — two-pass center-outward algorithm
- Responsive to container width via ResizeObserver (100ms debounce)
- 2 orientations: `horizontal`, `vertical`
- `buildDisplayOrder` creates left-reversed → center → right array
- Centering offset so board is always visually centered
- `PlacedTile` has: `tile`, `side`, `playerId` (no slotIndex, no flipped)

**User Constraints (CRITICAL):**
1. NO L-shaped tiles — no tile gets split across rows. `corner-right`/`corner-left` are OUT.
2. All tiles behave identically — doubles are NOT special. `perpendicular` is OUT.
3. Bend/transition happens BETWEEN tiles, not WITHIN a tile.
4. Maximal simplicity: "for greater simplicity, doubles behave the same as any other tile"

## Affected Areas

- `packages/shared/src/types.ts` (lines 55-82) — `PlacedTile` interface needs `slotIndex` and `flipped` fields
- `packages/frontend/src/components/game/game-board.tsx` — layout algorithm needs simplification (remove L-tile logic)
- `packages/frontend/src/components/game/__tests__/game-board.test.ts` — tests need updating for new PlacedTile shape
- `packages/frontend/src/components/game/domino-tile.tsx` — NO changes needed (already handles horizontal/vertical)
- `packages/shared/src/game/` — NEW: `board-path.ts` for abstract path generation
- `packages/frontend/src/components/game/` — NEW: `layout-engine.ts` for pixel calculation

## Analysis

### What to KEEP from Approach A

| Concept | Why |
|---------|-----|
| Slot index model (0-108) | Clean addressing for game state, replay, and audit |
| `flipped` field | Unambiguous which half faces inward; eliminates runtime swap logic |
| `buildDisplayOrder` mapping | Left-reversed → center → right maps perfectly to slot indices |
| Invariant-driven testing | I1-I10 pattern is excellent for correctness guarantees |

### What to KEEP from Approach B

| Concept | Why |
|---------|-----|
| Responsive container-based layout | Must work on mobile (320px) and desktop (1200px+) |
| Centering offset | Board is always visually centered regardless of chain length |
| Two-pass center-outward algorithm | Natural growth direction for domino chains |
| ResizeObserver with debounce | Handles window resizing gracefully |

### What to DISCARD (per user constraints)

| Concept | Why Discarded |
|---------|---------------|
| `corner-right` / `corner-left` orientations | User explicitly banned L-shaped tiles |
| `perpendicular` orientation | User explicitly said doubles are NOT special |
| Fixed 8-column grid | Must be responsive to container width |
| `computeTileCells()` with 5 cases | Only 2 orientations needed (horizontal, vertical) |
| `isCorner` / `cornerWall` on PathSlot | Corners are determined at render time by container width |

## Approaches

### 1. Hybrid: Slot Indices + Responsive Layout

Fuse the best of both: use Approach A's slot index model for data, Approach B's responsive algorithm for rendering.

**Architecture layers:**

```
Layer 1: BoardPath (pure data, no rendering)
  ├── PathSlot type: { index, arm, distanceFromCenter }
  ├── generatePath(totalSlots) → PathSlot[]
  └── Slot index helpers: nextRightSlotIndex(), nextLeftSlotIndex()

Layer 2: LayoutEngine (pixel calculation, responsive)
  ├── calculateSerpentineLayout(display, centerIdx, containerWidth) → TilePosition[]
  ├── Dynamic tilesPerRow based on container width
  └── Bend alternation (up/down) at container edges

Layer 3: React Component (just renders)
  ├── GameBoard — reads positions from LayoutEngine
  └── BoardTile — renders single tile at computed position
```

**Data model change:**

```typescript
// packages/shared/src/types.ts
interface PlacedTile {
  tile: Tile;           // existing
  side: Side;           // existing
  playerId: string;     // existing
  slotIndex: number;    // NEW: index in path (0-108)
  flipped: boolean;     // NEW: which half faces inward
}
```

**Orientation model (simplified):**

```typescript
// Only 2 orientations, no L-tiles, no perpendicular
type Orientation = 'horizontal' | 'vertical';

// Center tile: vertical
// All other tiles: horizontal
// Bend tiles: handled by position change, NOT by orientation
```

**Flipped concept (unified):**

```typescript
// From Approach A's resolveFlipped — eliminates runtime displayTile swap
function resolveFlipped(tile: Tile, connectingValue: number, end: 'left' | 'right'): boolean {
  if (end === 'right') return tile.top === connectingValue;
  return tile.bottom === connectingValue;
}
```

**Responsive layout (from Approach B):**

```typescript
// Dynamic row width based on container
const usableW = containerWidth - PADDING * 2;
const tilesPerRow = Math.floor(usableW / (H_TILE_W + GAP));

// Same two-pass algorithm, but without L-tile branching
```

- Pros: Clean separation of concerns, responsive, simple orientation model, slot indices for game state
- Cons: Requires PlacedTile interface change (affects multiple files), new test coverage needed
- Effort: **Medium** — data model change is the main work; layout algorithm is mostly subtraction

### 2. Pure Approach A (Fixed Grid)

Adopt the external AI spec wholesale: fixed 8-column grid, 5 orientations, precomputed pixel positions.

- Pros: Battle-tested with 10 invariants, complete spec, reference implementation
- Cons: NOT responsive (breaks on mobile), includes L-tiles and perpendicular (user banned these), over-engineered for our needs
- Effort: **High** — would need to rip out responsive logic AND re-add it, plus remove banned orientations

### 3. Pure Approach B (Keep Current)

Keep the current implementation, add slotIndex and flipped to PlacedTile for game state tracking.

- Pros: Minimal changes, already works, responsive
- Cons: No precomputed path (layout recalculates every render), no flipped field (relies on runtime swap logic), harder to add replay/audit features later
- Effort: **Low** — but misses the architectural improvements from Approach A

## Recommendation

**Approach 1: Hybrid** — the clear winner.

The reasoning:
1. User constraints eliminate 3 of 5 orientations from Approach A, making its fixed grid unnecessary
2. Approach B's responsive layout is essential and already works
3. The slot index model from Approach A is valuable for game state, replay, and audit — worth adding
4. The `flipped` field eliminates the fragile `displayTile` swap logic in `BoardTile`
5. The simplified orientation model (horizontal/vertical only) makes the code easier to maintain

**Implementation order:**
1. Add `slotIndex` and `flipped` to `PlacedTile` in `packages/shared/src/types.ts`
2. Create `packages/shared/src/game/board-path.ts` with path generation and slot helpers
3. Create `packages/frontend/src/components/game/layout-engine.ts` with simplified serpentine algorithm
4. Update `game-board.tsx` to use the new layout engine
5. Update all tests

## Risks

- **Data model migration**: Existing games in progress (if any) would have PlacedTile without `slotIndex`/`flipped`. Need backward-compatible handling or a migration path.
- **Test coverage gap**: Current tests assume the old PlacedTile shape. All tests in `game-board.test.ts` need updating.
- **Layout regression**: The simplified algorithm must produce visually equivalent results to the current one for the same container width. Need visual regression testing.

## Ready for Proposal

**Yes** — the hybrid approach is well-defined and the user constraints are clear. The orchestrator should present the three approaches to the user, highlight that Approach 1 (Hybrid) is recommended, and ask for confirmation before proceeding to spec.
