## Exploration: turn-manager

### Current State
Module 1 (tile-deck) is fully implemented:
- `src/game/types.ts` — `Tile` interface (`top`, `bottom`, `id`), `DealResult` type
- `src/game/deck.ts` — `createDeck()`, `shuffle()`, `deal()` (all immutable, well‑tested)
- `src/game/__tests__/deck.test.ts` — 14 unit tests with bun:test

Module 2 (board-state) is explored but not yet implemented.
Module 3 (player-state) is explored but not yet implemented.

No turn‑management code exists. The turn‑manager is a greenfield module that will handle turn ordering, timeout enforcement, first‑player selection, and null‑round tracking.

### Affected Areas
- `src/game/types.ts` — Needs new types: `TurnState`, `TurnDeadline`, `TimeoutResult`
- `src/game/turn.ts` — NEW file: pure functions for turn management
- `src/game/__tests__/turn.test.ts` — NEW file: unit tests for turn module
- `src/game/deck.ts` — No changes needed (clean interface boundary)
- `src/game/board.ts` — No changes needed (turn‑manager doesn't depend on board)
- `src/game/player.ts` — No changes needed (turn‑manager doesn't depend on player state)

### Approaches

#### Approach 1: Pure‑Function Module (RECOMMENDED)
Follow the immutable pattern established by `deck.ts`. Each function takes a `TurnState` and returns a new `TurnState` (or a derived value). No classes, no mutation.

```typescript
// TurnState added to types.ts
interface TurnState {
  currentTurn: 0 | 1 | 2 | 3
  turnDeadline: Date | null
  consecutiveNullRounds: number
  roundNumber: number
  lastHandWinner: 0 | 1 | 2 | 3 | null
}

// turn.ts exports:
function createTurnState(): TurnState
function advanceTurn(state: TurnState): TurnState
function setCurrentTurn(state: TurnState, playerIndex: 0 | 1 | 2 | 3): TurnState
function getNextPlayer(state: TurnState): 0 | 1 | 2 | 3
function calculateDeadline(state: TurnState): TurnState
function checkTurnTimeout(state: TurnState, now: Date): TimeoutResult
function incrementNullRounds(state: TurnState): TurnState
function resetNullRounds(state: TurnState): TurnState
function getFirstPlayer(hand: Tile[][]): 0 | 1 | 2 | 3
function isNewRound(state: TurnState): boolean
```

- Pros: Matches existing pattern, easy to test, stateless, composable, fits game‑engine orchestration
- Cons: Slightly more verbose than a class with methods, but verbosity is a feature for readability
- Effort: **Low**

#### Approach 2: Stateful Manager Class (not recommended)
Create a `TurnManager` class that holds state and provides methods. This would encapsulate state but break the pure‑function pattern and make testing harder (methods would need to be mocked). Also deviates from the established codebase style.

- Pros: Familiar OOP style for some developers
- Cons: Breaks immutability guarantee, harder to test, doesn't match deck.ts pattern, reduces composability
- Effort: **Low** (but higher maintenance cost)

### Recommendation
**Approach 1 (Pure‑Function Module)** — keep it simple, immutable, and consistent with the tile‑deck module.

Rationale:
1. The codebase already uses pure functions for deck operations; turn‑manager should follow suit.
2. Immutable updates make it trivial to integrate with React state (Zustand) and avoid accidental side‑effects.
3. Each function does exactly one thing, making unit tests straightforward.
4. The game‑engine layer can compose these functions without worrying about hidden state.

### Key Design Decisions

1. **Immutability**: Every mutating operation returns a new `TurnState`. The state is spread‑copied; fields are updated as needed.

2. **Error handling**: Functions that cannot succeed (e.g., `setCurrentTurn` with invalid index) throw a descriptive error. This matches `deck.ts` behavior (`deal` throws on wrong deck size). The game‑engine layer is responsible for pre‑validating moves; these functions are safety nets.

3. **`turnDeadline` management**: `calculateDeadline()` sets `turnDeadline` to `new Date(Date.now() + 45_000)`. The caller (game‑engine) should call this after every turn change. This keeps the function pure (no hidden `Date.now()` inside).

4. **`checkTurnTimeout` logic**: Takes a `now` parameter (injected time) and returns a `TimeoutResult` indicating whether the turn has timed out. The game‑engine layer calls this with `new Date()` on its 2‑second interval.

5. **`consecutiveNullRounds` semantics**: Incremented by `incrementNullRounds()`, reset to `0` by `resetNullRounds()`. The game‑engine decides when to call each (e.g., on a successful play, reset; on a pass that results in null round, increment). This separation keeps turn‑manager unaware of game rules.

6. **`lastHandWinner` tracking**: Stores the player index who won the previous hand. Used by `getFirstPlayer` for subsequent hands. Initially `null` (first hand of match).

7. **First‑player selection logic**:
   - **First hand of match**: Scan all 4 hands for doubles. If any player has a double, the one with the highest double goes first. If no doubles, the player with the highest sum of all tile values goes first.
   - **Subsequent hands**: The winner of the previous hand (`lastHandWinner`) goes first.
   - This function requires access to all 4 hands (passed as `Tile[][]`), but doesn't depend on any other module state.

8. **Turn order**: P1 → P2 → P3 → P4 → P1 (clockwise). `getNextPlayer` simply returns `(currentTurn + 1) % 4`.

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty board (first move) | `getFirstPlayer` scans hands for doubles/highest sum. Works on raw `Tile[][]` from deal. |
| All players pass (4 consecutive passes) | Hand ends in null round. `incrementNullRounds` is called. If `consecutiveNullRounds >= 3`, next hand uses the "lowest sum" rule instead of "highest double". |
| Timeout while player is disconnected | `checkTurnTimeout` doesn't care about connection status — it only checks time. The game‑engine layer handles disconnection logic separately. |
| Multiple doubles in hand | `getFirstPlayer` picks the player with the highest double (e.g., 9‑9 beats 8‑8). If a player has multiple doubles, only the highest matters. |
| No doubles in any hand | Fall back to highest sum of all tile values. Sum is calculated as `tile.top + tile.bottom` for each tile. |
| `turnDeadline` is null | `checkTurnTimeout` returns `{ timedOut: false }` — no deadline means no timeout. Game‑engine must set deadline via `calculateDeadline`. |
| Round number overflow | `roundNumber` is a plain number. In practice, a single match won't exceed 100+ rounds. No overflow concern for `number` type. |
| New round detection | `isNewRound` returns `true` when `turnDeadline === null` (fresh state) or after `resetNullRounds` is called. Used by game‑engine to determine if `getFirstPlayer` should be called. |

### Types to Reuse
- `Tile` from `src/game/types.ts` — needed for `getFirstPlayer` to scan hands
- `PlayerState` from `src/game/player.ts` — not needed (turn‑manager doesn't track hands or connection)
- `BoardState` from `src/game/board.ts` — not needed (turn‑manager doesn't track board)

### File Structure
```
src/game/
├── types.ts          (add TurnState, TimeoutResult interfaces)
├── deck.ts           (unchanged)
├── board.ts          (unchanged)
├── player.ts         (unchanged)
├── turn.ts           (NEW — all turn‑management functions)
├── __tests__/
│   ├── deck.test.ts  (unchanged)
│   ├── board.test.ts (unchanged)
│   ├── player.test.ts (unchanged)
│   └── turn.test.ts  (NEW — unit tests)
```

### Dependencies on Other Modules
- **Tile type** from `types.ts` — used in `getFirstPlayer` parameter signature
- **No other dependencies** — turn‑manager is a pure utility module that operates on its own state and raw tile data

### Ready for Proposal
Yes. The scope is clear: 2 new interfaces, 10 pure functions, ~20‑25 unit tests. The module is small, self‑contained, and follows established patterns. No external dependencies beyond `Tile` type.

### Risks
- **Integration with game‑engine**: The game‑engine must correctly orchestrate calls to these functions (e.g., call `calculateDeadline` after `advanceTurn`). Incorrect orchestration could lead to inconsistent state. Mitigated by keeping functions pure and well‑tested.
- **Performance**: No concern — all operations are O(1) or O(n) where n ≤ 10 (hand size for `getFirstPlayer`). No cloning of large structures.
- **First‑player selection edge cases**: The "highest double" rule needs careful implementation (e.g., double 9‑9 beats 8‑8, but what about 9‑9 vs 9‑9 from two different players? That can't happen in double‑9 set — each double appears exactly once).
- **Consecutive null rounds**: The 4th consecutive null round triggers a special rule (lowest sum global). This rule must be implemented in the game‑engine, not in turn‑manager. Turn‑manager only tracks the count.
