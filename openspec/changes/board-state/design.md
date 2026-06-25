# Design: Board State Module

## Technical Approach

Pure-function module modeling a domino line-of-play as an immutable linear chain. Follows the `tile-deck` pattern (module 1): exported functions operate on and return `BoardState` without mutation. Placement validation (`canPlay`) is separated from execution (`place`) so the server can pre-validate before committing state changes.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Board model | Simple 2-end chain | Spinner (4 ends), graph | Matches AGENTS.md; spinner deferred |
| Mutability | Pure functions, new objects | Class with methods, mutable Map | Follows `deck.ts` pattern; no shared mutable state across concurrent games |
| Validation | `canPlay()` separate from `place()` | `place()` returns result union | Decoupled check+execute per proposal; server validates before mutating |
| Auto-flip | `place()` handles orientation | Caller pre-flips, store raw | Caller shouldn't know orientation internals; `PlacedTile.tile` stores the canonical (possibly flipped) tile |
| Error handling | `place()` throws on invalid placement | Return `null`, return result union | Matches `deal()` throw pattern; TypeScript narrows by exception |
| `placedTileIds` | `Set<string>` in `BoardState` | Array lookup, Map | O(1) duplicate detection for game integrity — deferred from scope (see Open Questions) |

## Auto-Flip Logic

```
Place on LEFT:
  tile.bottom == leftEnd → new leftEnd = tile.top     (no flip)
  tile.top    == leftEnd → new leftEnd = tile.bottom  (flip → swap top/bottom)

Place on RIGHT:
  tile.top    == rightEnd → new rightEnd = tile.bottom (no flip)
  tile.bottom == rightEnd → new rightEnd = tile.top    (flip → swap top/bottom)

First tile (empty board):
  leftEnd  = tile.bottom   (side = 'left')
  rightEnd = tile.top      (side = 'left')
  // side 'right' inverts: leftEnd = tile.top, rightEnd = tile.bottom
```

**Double rule**: If `tile.top === tile.bottom`, the end value doesn't change regardless of side — the match is unambiguous.

## Data Flow

```
createBoard()
  → { leftEnd: null, rightEnd: null, tiles: [] }

canPlay(tile, side, board)
  → boolean (empty board → true; match on specified end → true; else false)

place(tile, side, playerId, board)
  → validates via canPlay (throw if false)
  → computes auto-flip if needed
  → builds new PlacedTile { tile, side, playerId }
  → returns { leftEnd, rightEnd, tiles: [...board.tiles, placedTile] }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modify | Add `Side`, `PlacedTile`, `BoardState` interfaces |
| `src/game/board.ts` | Create | `createBoard()`, `canPlay()`, `place()` pure functions |
| `src/game/__tests__/board.test.ts` | Create | ~15 unit tests covering all scenarios |

## Interfaces / Contracts

```typescript
// Added to src/game/types.ts
type Side = "left" | "right";

interface PlacedTile {
  tile: Tile;
  side: Side;
  playerId: string;
}

interface BoardState {
  leftEnd: number | null;
  rightEnd: number | null;
  tiles: PlacedTile[];
}
```

```typescript
// src/game/board.ts
function createBoard(): BoardState;

function canPlay(tile: Tile, side: Side, board: BoardState): boolean;

function place(
  tile: Tile,
  side: Side,
  playerId: string,
  board: BoardState,
): BoardState;
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `createBoard()` | Returns `{ null, null, [] }` |
| Unit | `canPlay()` on empty board | Always `true` |
| Unit | `canPlay()` with matching tile | `true` for left match, right match, both ends matching |
| Unit | `canPlay()` with no match | `false` |
| Unit | `place()` first tile | Both ends set correctly |
| Unit | `place()` extends left/right | Correct end updated, opposite unchanged |
| Unit | `place()` auto-flip | Flipped tile stored, new end reflects inner value |
| Unit | `place()` with double | End unchanged |
| Unit | `place()` invalid placement | Throws `Error` |
| Unit | Immutability | Original board unchanged after `place()` |
| Unit | `canPlay()` side-specific | Left placement checks leftEnd only |

**Target:** 15+ tests, 100% branch coverage on board.ts.

## Migration / Rollout

No migration required. Pure functions with no I/O or existing callers. New module in the decomposition sequence.

## Open Questions

- [ ] `placedTileIds: Set<string>` — proposal includes it for O(1) lookup, spec omits it. Confirm: keep it simple and skip the Set (rely on `tiles[]` iteration), or add it now?
- [ ] Auto-flipped tile in `PlacedTile.tile` — should the stored tile reflect the original orientation (before flip) or the canonical orientation (after flip, as it lies on the board)? Current design stores post-flip for debugging; original orientation can be reconstructed from `PlacedTile.side` + board ends.
