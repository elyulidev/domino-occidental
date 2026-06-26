## Exploration: board-state

### Current State
Module 1 (tile-deck) is fully implemented:
- `src/game/types.ts` — `Tile` interface (`top`, `bottom`, `id`), `DealResult` type
- `src/game/deck.ts` — `createDeck()`, `shuffle()`, `deal()` (all immutable, well-tested)
- `src/game/__tests__/deck.test.ts` — 14 unit tests with bun:test
- Path alias: `@/*` → `./src/*`, TypeScript strict mode, Bun 1.3.3

No board state code exists yet. The board is a greenfield module.

### Affected Areas
- `src/game/types.ts` — Needs new types: `BoardState`, `BoardTile`, `PlacementResult`
- `src/game/board.ts` — NEW file: `createBoard()`, `canPlay()`, `place()` functions
- `src/game/__tests__/board.test.ts` — NEW file: unit tests for board module
- `src/game/deck.ts` — No changes needed (clean interface boundary)

### Approaches

#### Approach 1: Simple Linear Chain (RECOMMENDED)
Model the board as a linear sequence of placed tiles with two open ends.

```typescript
interface BoardTile {
  tile: Tile
  side: 'left' | 'right'
  playerId: string
}

interface BoardState {
  leftEnd: number | null      // null = empty board
  rightEnd: number | null
  tiles: BoardTile[]          // chronological placement order
  placedTileIds: Set<string>  // O(1) lookup for "already played"
}

function canPlay(tile: Tile, side: 'left' | 'right', board: BoardState): boolean
function place(tile: Tile, side: 'left' | 'right', playerId: string, board: BoardState): BoardState
```

- Pros: Matches AGENTS.md canonical types exactly, simple to reason about, easy to test, matches tile-deck immutable pattern
- Cons: No spinner support (first double = 4 ends), but that's a variant rule, not core
- Effort: **Low**

#### Approach 2: Graph-Based Board (with spinners from start)
Model the board as a directed graph where each placed tile has up to 4 connection points.

```typescript
interface BoardNode {
  tile: Tile
  playerId: string
  connections: { top: string | null; bottom: string | null }
}
interface BoardState {
  nodes: Map<string, BoardNode>
  openEnds: string[]          // 2 (normal) or 4 (after spinner)
}
```

- Pros: Supports cross-wise doubles and spinners natively
- Cons: Much more complex, harder to validate, over-engineered for MVP, doesn't match AGENTS.md types
- Effort: **High**

#### Approach 3: Linear Chain + Spinner Extension Point
Same as Approach 1, but add a `hasSpinner` flag and `openEndCount` for future extension.

- Pros: Clean MVP with clear upgrade path
- Cons: Slightly more types than needed now
- Effort: **Low-Medium**

### Recommendation
**Approach 1 (Simple Linear Chain)** — defer spinners entirely.

Rationale:
1. AGENTS.md canonical types use `leftEnd`/`rightEnd` (2 ends), not a generic `openEnds[]`
2. The tile-deck module established an immutable functional pattern — board should follow the same
3. Spinners (first double = 4 ends) are a variant rule; most domino implementations don't use them
4. Can always add spinner support later by extending `BoardState` without breaking existing tests
5. Keeps module 2 scope tight and completable in one session

### Key Design Decisions

1. **Immutability**: `place()` returns a new `BoardState`, never mutates input. Matches deck.ts pattern.

2. **`canPlay` signature**: `canPlay(tile, side, board)` — takes the board as explicit param, no closures.

3. **First move handling**: `canPlay` should handle empty board (`leftEnd === null && rightEnd === null`) by allowing any tile placement (first player chooses any tile, server validates game rules separately).

4. **Tile orientation**: When a tile is placed, it may need to be "flipped" (top/bottom swapped) to match the end. The `place()` function should auto-flip if needed, or the caller should handle orientation. **Recommendation**: `place()` auto-flips — the board stores the tile as played, and the `BoardTile` records which end matched which side.

5. **`placedTileIds` Set**: O(1) lookup to prevent placing the same tile twice. Critical for game integrity.

6. **Return type for `canPlay`**: Return `boolean` (simple). The orchestrator layer can enrich error messages.

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty board (first move) | `canPlay` returns `true` for any tile on either side. Server-level logic decides who goes first. |
| Playing a double (e.g., 5-5) | Works like any tile — both ends of the placed tile are 5. The open end stays 5. |
| Both ends have same value | Possible after playing certain sequences (e.g., 3-5, 5-5 → both ends are 5). `canPlay` matches correctly. |
| Tile doesn't match either end | `canPlay` returns `false`. Player must pass. |
| Spinner (first double = 4 ends) | **DEFERRED** — not in scope for module 2. Can be added later. |
| Place on empty board | `place` sets the chosen side's end to one value, other end to the other. Both ends become non-null. |

### Types to Reuse
- `Tile` from `src/game/types.ts` — the core domino piece type
- `PlayerState` is not needed here (board doesn't know about players' hands)
- `BoardState` from AGENTS.md §3 is the canonical reference — we implement a subset (without `poolCount` or match-level state)

### Ready for Proposal
Yes. The scope is clear: 3 functions (`createBoard`, `canPlay`, `place`), ~3 types, and ~12-15 unit tests. Defer spinners, keep it simple, follow the immutable pattern from tile-deck.

### Risks
- **Spinner variant**: Some domino variants require spinners. If the game design changes, `BoardState` needs extension. Mitigated by keeping the type extensible (could add `openEnds: [number, number]` later).
- **Tile orientation**: Auto-flipping in `place()` means the `BoardTile` must record the original tile AND which side it matched, for replay/audit purposes. This is important for `match_moves` (module 5).
- **Test coverage for edge cases**: The "both ends same value" scenario needs explicit tests to avoid regressions.
