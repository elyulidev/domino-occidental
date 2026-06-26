## Exploration: player-state

### Current State
Module 1 (tile-deck) is fully implemented:
- `src/game/types.ts` — `Tile` interface (`top`, `bottom`, `id`), `DealResult` type
- `src/game/deck.ts` — `createDeck()`, `shuffle()`, `deal()` (all immutable, well‑tested)
- `src/game/__tests__/deck.test.ts` — 14 unit tests with bun:test
- Path alias: `@/*` → `./src/*`, TypeScript strict mode, Bun 1.3.3

Module 2 (board-state) is explored but not yet implemented. No player‑state code exists. The player‑state module is a greenfield module that will manage individual player hand, connection status, and pass tracking.

### Affected Areas
- `src/game/types.ts` — Needs new type: `PlayerState` (fields: `id`, `hand`, `consecutivePasses`, `isConnected`, `lastActionAt`)
- `src/game/player.ts` — NEW file: pure functions operating on `PlayerState`
- `src/game/__tests__/player.test.ts` — NEW file: unit tests for player module
- `src/game/deck.ts` — No changes needed (clean interface boundary)
- `src/game/board.ts` — No changes needed (player‑state doesn’t depend on board)

### Approaches

#### Approach 1: Pure‑Function Module (RECOMMENDED)
Follow the immutable pattern established by `deck.ts`. Each function takes a `PlayerState` and returns a new `PlayerState` (or a derived value). No classes, no mutation.

```typescript
// PlayerState added to types.ts
interface PlayerState {
  id: string
  hand: Tile[]
  consecutivePasses: number
  isConnected: boolean
  lastActionAt: Date
}

// player.ts exports:
function createPlayer(id: string, hand: Tile[]): PlayerState
function removeTile(player: PlayerState, tileId: string): PlayerState
function addTile(player: PlayerState, tile: Tile): PlayerState
function hasTile(player: PlayerState, tileId: string): boolean
function handValues(player: PlayerState): number
function markConnected(player: PlayerState, connected: boolean): PlayerState
function recordAction(player: PlayerState): PlayerState
function incrementPasses(player: PlayerState): PlayerState
function resetPasses(player: PlayerState): PlayerState
```

- Pros: Matches existing pattern, easy to test, stateless, composable, fits game‑engine orchestration
- Cons: Slightly more verbose than a class with methods, but verbosity is a feature for readability
- Effort: **Low**

#### Approach 2: Factory‑Return Object (not recommended)
Create a `createPlayer` that returns an object with methods (e.g., `player.removeTile(tileId)`). This would encapsulate state but break the pure‑function pattern and make testing harder (methods would need to be mocked). Also deviates from the established codebase style.

- Pros: Familiar OOP style for some developers
- Cons: Breaks immutability guarantee, harder to test, doesn’t match deck.ts pattern, reduces composability
- Effort: **Low** (but higher maintenance cost)

### Recommendation
**Approach 1 (Pure‑Function Module)** — keep it simple, immutable, and consistent with the tile‑deck module.

Rationale:
1. The codebase already uses pure functions for deck operations; player‑state should follow suit.
2. Immutable updates make it trivial to integrate with React state (Zustand) and avoid accidental side‑effects.
3. Each function does exactly one thing, making unit tests straightforward.
4. The game‑engine layer can compose these functions without worrying about hidden state.

### Key Design Decisions

1. **Immutability**: Every mutating operation returns a new `PlayerState`. The `hand` array is shallow‑cloned when modified; other fields are copied via spread.

2. **Error handling**: Functions that cannot succeed (e.g., `removeTile` with a non‑existent tile) throw a descriptive error. This matches `deck.ts` behavior (`deal` throws on wrong deck size). The game‑engine layer is responsible for pre‑validating moves; these functions are safety nets.

3. **`lastActionAt` update**: `recordAction()` sets `lastActionAt` to `new Date()`. The caller (game‑engine) should call this after every player action (play, pass, draw). This keeps the function pure (no hidden `Date.now()` inside).

4. **`handValues` calculation**: Sum of `tile.top + tile.bottom` for each tile in hand. Used for end‑of‑round scoring (points equal sum of remaining tiles). Returns `0` for empty hand.

5. **`consecutivePasses` semantics**: Incremented by `incrementPasses()`, reset to `0` by `resetPasses()`. The game‑engine decides when to call each (e.g., on a successful play, reset passes; on a pass, increment). This separation keeps player‑state unaware of game rules.

6. **`isConnected` flag**: Toggled by `markConnected()`. The WebSocket layer will call this on disconnect/reconnect events. No timeout logic here; that belongs to the game‑engine.

7. **Tile identity**: Tiles are identified by their `id` field (UUID). Functions compare `tile.id` strings, not tile values.

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty hand | `removeTile` throws (cannot remove from empty hand). `hasTile` returns `false`. `handValues` returns `0`. |
| Tile not found in hand | `removeTile` throws with tile ID. Caller must ensure tile exists (pre‑validation). |
| Adding duplicate tile | `addTile` blindly adds; duplicates are allowed in hand (though game rules prevent drawing a tile already in hand). |
| Negative consecutivePasses | Should never happen; `incrementPasses` only increments, `resetPasses` sets to `0`. No negative values possible. |
| `lastActionAt` precision | Uses `new Date()` which has millisecond precision. Sufficient for timeout calculations (45‑second turn). |
| Player ID uniqueness | Not enforced by player‑state; the game‑engine ensures each player has a unique ID within a match. |

### Types to Reuse
- `Tile` from `src/game/types.ts` — the core domino piece type
- `DealResult` not needed (player‑state doesn’t deal tiles)
- `BoardState` not needed (player‑state doesn’t interact with board)

### File Structure
```
src/game/
├── types.ts          (add PlayerState interface)
├── deck.ts           (unchanged)
├── player.ts         (NEW — all player‑state functions)
├── __tests__/
│   ├── deck.test.ts  (unchanged)
│   └── player.test.ts (NEW — unit tests)
```

### Ready for Proposal
Yes. The scope is clear: 1 new interface, 9 pure functions, ~15‑20 unit tests. The module is small, self‑contained, and follows established patterns. No external dependencies beyond `Tile` type.

### Risks
- **Integration with game‑engine**: The game‑engine must correctly orchestrate calls to these functions (e.g., call `removeTile` only after board validation). Incorrect orchestration could lead to inconsistent state. Mitigated by keeping functions pure and well‑tested.
- **Performance**: Shallow‑cloning the hand array (max 10 tiles) on each operation is negligible. No performance concern.
- **Future extensions**: If player‑state needs to track additional data (e.g., time bank, power‑ups), the interface can be extended without breaking existing functions. The pure‑function pattern scales well.