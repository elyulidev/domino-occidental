# Design: Player State Module

## Technical Approach

Pure-function module (`src/game/player.ts`) matching `deck.ts` conventions: immutable returns, JSDoc on every export, single-responsibility. Hand operations (`removeTile`, `addTile`, `hasTile`) accept `Tile[]` directly rather than `PlayerState`, keeping them reusable for pool operations or future use outside player context. `PlayerState` interface added alongside `Tile`/`DealResult` in `types.ts`.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Hand ops accept `Tile[]` not `PlayerState` | `Tile[]` | Accept full `PlayerState` | Reusable for pool/manipulation without coupling to PlayerState shape |
| Error on missing tile | `throw Error` | Return `null`, silent skip | Matches `deal()` validation pattern in `deck.ts`; fail-fast prevents silent bugs |
| `isConnected` defaults `true` | `true` at creation | Default `false` | Player joins connected; set to `false` only on WS disconnect |
| `sumHand` operates on `Tile[]` | Independent fn | Method on hand | Single-responsibility, usable without PlayerState |
| Interface over class | `interface PlayerState` | Class with methods | Consistent with `Tile`, `DealResult`; no `this`, no mutable state |

## Data Flow

```
createPlayer("p1")
  → PlayerState { id: "p1", hand: [], consecutivePasses: 0,
                  isConnected: true, lastActionAt: Date }

deal(deck) → hands[0..3]
  → createPlayer(ids[n]) each getting hands[n] via addTile()
    → PlayerState with full hand → GameState.players[n]

During play:
  removeTile(player.hand, tileId)     → new hand (tile removed)
  addTile(player.hand, tile)           → new hand (tile appended)
  updateLastAction(player)             → new player with fresh timestamp
  incrementPasses(player)              → new player with +1 passes
  setConnected(player, false)          → new player with isConnected: false

After game:
  sumHand(player.hand) → number        → scoring
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modify | Add `PlayerState` interface (8 lines) |
| `src/game/player.ts` | Create | 9 pure functions (~95 LOC) |
| `src/game/__tests__/player.test.ts` | Create | ~15 tests covering all spec scenarios |

## Interfaces / Contracts

```typescript
// Added to src/game/types.ts
export interface PlayerState {
  id: string;
  hand: Tile[];
  consecutivePasses: number;
  isConnected: boolean;
  lastActionAt: Date;
  isBot?: boolean;          // optional, for future AI players
}

// src/game/player.ts — function signatures
export function createPlayer(id: string): PlayerState;
export function removeTile(hand: Tile[], tileId: string): Tile[];
export function addTile(hand: Tile[], tile: Tile): Tile[];
export function hasTile(hand: Tile[], tileId: string): boolean;
export function setConnected(player: PlayerState, connected: boolean): PlayerState;
export function updateLastAction(player: PlayerState): PlayerState;
export function incrementPasses(player: PlayerState): PlayerState;
export function resetPasses(player: PlayerState): PlayerState;
export function sumHand(hand: Tile[]): number;
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `createPlayer` defaults | Verify shape, types, defaults match spec |
| Unit | `removeTile` immutable | Assert new array length, original unchanged, throws on missing |
| Unit | `addTile` immutable | Assert length +1, last element is new tile, original untouched |
| Unit | `hasTile` queries | True/false for existing/missing/empty hand |
| Unit | State transitions | `setConnected`, `updateLastAction`, `incrementPasses`, `resetPasses` — assert value changes, original immutable |
| Unit | `sumHand` scoring | Known sum, empty returns 0 |

~15 tests total, covering all 13 spec scenarios plus immutability assertions on every state-transition function.

## Migration / Rollout

No migration required. New module, no existing consumers. Integrated when GameState composition (later module) imports `player.ts`.

## Open Questions

None. All decisions resolved in spec and proposal.
