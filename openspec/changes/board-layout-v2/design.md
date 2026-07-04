# Design: Board Layout v2 — Clean Three-Layer Architecture

## Technical Approach

Refactor board rendering from monolithic `game-board.tsx` into 3 layers: (1) abstract `BoardPath` (slot model, pure data), (2) `LayoutEngine` (responsive pixel computation, pure function), (3) React component (consumer only). Simplify orientation to horizontal/vertical only. Add `slotIndex` and `flipped` to `PlacedTile`. Identical visual output guaranteed by invariant identity tests.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Orientation model | horizontal + vertical only | 5 orientations (external spec) | Per R3: no L-tiles, no perpendicular; doubles stay vertical in runs |
| Row width | Dynamic at render time | Fixed 8-col grid | Must be responsive 320–1200px; fixed grid breaks mobile |
| Bend rep. | BETWEEN tiles (position) | WITHIN tile (L-shape) | User constraint: "bend happens between tiles" |
| Slot index | Center=0, right=+N, left=-N | 0–108 absolute (external) | Intuitive: positive/negative mirrors side direction |
| Flipped source | `place()` at server | Render-time swap (current) | Eliminates runtime `displayTile` logic; single source of truth |
| Path precompute | Yes, 109 slots | No precompute (current) | Enables replay, slot-based game state, deterministic addressing |
| Cell sizing | Square sub-cells (CELL=48) | Current 88×64 / 64×88 | Grid alignment, no overlap, clean 2:1 tile ratio |

## Data Flow

```
place() ──→ PlacedTile { tile, side, playerId, slotIndex, flipped }
                │
                ▼
buildDisplayOrder() ──→ PlacedTile[] (left-reversed → center → right)
                │
                ▼
LayoutEngine(display, centerIdx, containerWidth) ──→ TilePosition[]
                │
                ▼
GameBoard (React) ──→ DominoTile × N (absolute positioned)
```

## Data Model Changes

### PlacedTile (both shared + backend `types.ts`)

```typescript
interface PlacedTile {
  tile: Tile;           // existing — canonical orientation (auto-flipped by place())
  side: Side;           // existing
  playerId: string;     // existing
  slotIndex: number;    // NEW — center=0, right→1..N, left→-1..-N
  flipped: boolean;     // NEW — true when tile.top === connectingEnd
}
```

### BoardPath (new: `packages/shared/src/game/board-path.ts`)

```typescript
type BoardPathSlot = {
  index: number;     // 0–108 absolute
  arm: 'left' | 'center' | 'right';  // by index range
  isCorner: boolean; // true at row-wrap edge
};
```

Minimal slot model: no pixel data, no direction encoding, no bend storage. Row width is NOT part of the path — the LayoutEngine determines fit at render time.

### TilePosition (existing, unchanged in `game-board.tsx`)

```typescript
interface TilePosition {
  x: number;  y: number;
  orientation: 'horizontal' | 'vertical';
  isBend: boolean;
}
```

### BoardPath helpers

- `generatePath()` → `BoardPathSlot[]` (109 slots)
- `resolveSlotIndex(side, currentCount)` → slot index
- `resolveFlipped(tile, connectingValue, side)` → boolean
- Slot index resolution: right side gets positive consecutive numbers starting from 1; left gets negative starting from -1

## Flipped Calculation

In `place()` (`packages/shared/src/game/board.ts`), after the existing auto-flip determination:

```typescript
// Inside place(), after the auto-flip block:
const flipped = tile.top === targetEnd;  // true → top connected → tile was flipped

// slotIndex
const sideCount = board.tiles.filter(t => t.side === side).length;
const slotIndex = side === 'right' ? sideCount + 1 : -(sideCount + 1);
```

The renderer then uses `flipped` directly: when `true`, pass `{ top: tile.bottom, bottom: tile.top }` to DominoTile; when `false`, pass tile as-is. This replaces the current `displayTile` swap at lines 259-262 of `game-board.tsx`.

## Orientation Rules (per R3 modified)

| Position | Type | Orientation |
|----------|------|-------------|
| Center (first placed) | any | `vertical` |
| Straight run (non-bend) | non-double | `horizontal` |
| Straight run (non-bend) | **double** | **`vertical`** |
| Bend (container edge) | any | `vertical` |

**Key rule**: doubles PRESERVE their vertical orientation even in straight runs. The only simplification is at bends (no L-tile, no perpendicular — the bend tile is vertical regardless of double status).

Bend detection: in LayoutEngine's walkArm, when `Math.abs(nextX) > usableW / 2`.

## Layout Algorithm

Extracted as pure function in `packages/frontend/src/components/game/layout-engine.ts`:
- Constants: `CELL=48`, `H_TILE_W=96`, `H_TILE_H=48`, `V_TILE_W=48`, `V_TILE_H=96`, `GAP=4`, `PADDING=16`
- Each half of a domino tile = `CELL × CELL` square (48×48px)
- Horizontal tile = 96×48 (2:1 ratio)
- Vertical tile = 48×96 (1:2 ratio)
- Two-pass center-outward: left arm walks backward from `centerIdx`, right arm forward
- First tile (centerIdx): always `{ x:0, y:0, orientation:'vertical', isBend:false }`
- Bend alternation: up/down toggling at each edge wrap
- Centering offset: post-process shift so visual bounding box is centered at x=0
- Purity: no mutation of input array, no DOM reads, no React hooks
- **Note**: cell sizing change means output WON'T match previous pixel output (visual size changes). Identity test is removed; instead verify no-overlap and correct grid alignment.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/game/board-path.ts` | Create | BoardPath type + path generation + slot helpers |
| `packages/frontend/.../layout-engine.ts` | Create | Pure function, extracted + cleaned from current algorithm |
| `packages/shared/src/types.ts` | Modify | Add `slotIndex: number` + `flipped: boolean` to PlacedTile |
| `packages/backend/src/game/types.ts` | Modify | Same PlacedTile additions (keep in sync) |
| `packages/shared/src/game/board.ts` | Modify | `place()` computes `flipped` + `slotIndex` |
| `packages/frontend/.../game-board.tsx` | Modify | Consume LayoutEngine; remove inline algorithm; use `flipped` swap |
| `packages/frontend/.../__tests__/game-board.test.ts` | Modify | New PlacedTile shape + LayoutEngine tests |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | No overlap | 20-tile full serpentine: bounding box intersection check |
| Unit | Grid alignment | Every tile's position aligns to CELL-sized grid (no off-grid fractional positions) |
| Unit | Orientation invariants | center=vertical, bends=vertical, doubles-in-run=vertical, non-doubles-in-run=horizontal |
| Unit | Responsive consistency | Same 8 tiles at 320/600/1200px → more bends at smaller width |
| Unit | Flipped correctness | Known pairs: rightEnd=5, tile(5,3)→true; leftEnd=3, tile(6,3)→false |
| Unit | SlotIndex correctness | Right: 1,2,3 in order; Left: -1,-2,-3 in order |
| Unit | Empty/edge input | Returns [] for empty; single tile centered at x=0 |
| Unit | DominoTile rendering | Verify DominoTile renders correctly with square-cell dimensions |

## Migration / Rollout

No migration required — no production data exists. Single commit, revertable.

## Open Questions

None.
