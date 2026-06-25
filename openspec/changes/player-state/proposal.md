# Proposal: Player State Module

## Intent

Implement pure functions for managing individual player hand, connection status, and pass tracking — Module 3 of the GameState decomposition after tile-deck and board-state. Follows the immutable pattern established by `deck.ts`.

## Scope

### In Scope
- `PlayerState` interface in `src/game/types.ts`
- 9 pure functions in `src/game/player.ts`
- Unit tests in `src/game/__tests__/player.test.ts`

### Out of Scope
- Match flow, turn management, scoring (deferred to later modules)
- WebSocket connection/reconnection orchestration
- GameState composition (4-player aggregate)
- UI components

## Capabilities

### New Capabilities
- `player-state`: Pure functions for player hand manipulation, connection state, pass tracking, and hand scoring. Each function is stateless by design — returning new objects rather than mutating inputs.

### Modified Capabilities
None

## Approach

Pure-function module matching `deck.ts` conventions: immutable returns, JSDoc on every export, single-responsibility functions. No classes, no `this`. Hand operations (add/remove/has) accept `Tile[]` directly rather than `PlayerState`, keeping them reusable outside player context.

| Function | Signature | Description |
|----------|-----------|-------------|
| `createPlayer` | `(playerId: string) => PlayerState` | Creates player with empty hand, `isConnected: true`, `consecutivePasses: 0` |
| `removeTile` | `(hand: Tile[], tileId: string) => Tile[]` | Removes tile by ID via filter, throws if not found |
| `addTile` | `(hand: Tile[], tile: Tile) => Tile[]` | Appends tile, returns new array |
| `hasTile` | `(hand: Tile[], tileId: string) => boolean` | Checks ID existence |
| `setConnected` | `(player: PlayerState, connected: boolean) => PlayerState` | Sets `isConnected` flag |
| `updateLastAction` | `(player: PlayerState) => PlayerState` | Sets `lastActionAt` to `new Date()` |
| `incrementPasses` | `(player: PlayerState) => PlayerState` | `consecutivePasses++` |
| `resetPasses` | `(player: PlayerState) => PlayerState` | Resets to 0 |
| `sumHand` | `(hand: Tile[]) => number` | Sum of all `top + bottom`, returns 0 for empty |

**File layout:**
```
src/game/
├── types.ts          (add PlayerState)
├── player.ts         (NEW)
└── __tests__/
    └── player.test.ts (NEW)
```

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modified | Add `PlayerState` interface |
| `src/game/player.ts` | New | 9 pure functions (~150 LOC) |
| `src/game/__tests__/player.test.ts` | New | ~15 unit tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hand array mutated by caller | Low | Pure functions return new arrays; caller must not mutate |
| Future PlayerState growth | Low | Interface extensible, functions backward-compatible |

## Rollback Plan

Revert `player.ts` and `player.test.ts` creation. Remove `PlayerState` interface from `types.ts`. No other files affected.

## Dependencies

None beyond existing `Tile` type in `types.ts`.

## Success Criteria

- [ ] `bun test` passes all player tests
- [ ] `bun run biome:check` passes
- [ ] TypeScript compiles with no errors
- [ ] All 9 functions tested with coverage for edge cases (empty hand, not-found tile)
