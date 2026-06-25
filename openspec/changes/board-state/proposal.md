# Proposal: Board State Module

## Intent

Model the domino board as an immutable linear chain of placed tiles with two open ends, enabling tile placement validation and board state queries. This is module 2 of the GameState decomposition, following the tile-deck pattern.

## Scope

### In Scope
- `BoardState` type: `leftEnd`, `rightEnd`, `tiles[]`, `placedTileIds` (Set)
- `PlacedTile` type: placed `Tile`, which `side`, `playerId`, auto-flipped orientation
- `Side` type: `'left' | 'right'`
- `createBoard()` — empty board factory
- `canPlay(tile, side, board): boolean` — validates a placement
- `place(tile, side, playerId, board): BoardState` — immutable placement, auto-flip
- Unit tests: valid/invalid placement, doubles, empty board, both-ends-same edge case

### Out of Scope
- Spinner variant (first double = 4 ends) — deferred
- Turn management, scoring, match lifecycle
- GameState, PlayerState, or runtime state beyond the board

## Capabilities

### New Capabilities
- `board-state`: board representation, placement validation, and immutable placement operations for the domino line of play

### Modified Capabilities
- None

## Approach

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Board model | Simple linear chain, 2 ends | Matches AGENTS.md canonical types; spinner deferred |
| Mutability | Pure functions, new objects | Follows tile-deck pattern; safe for concurrent games |
| Tile orientation | `place()` auto-flips | Caller doesn't need to know orientation; `PlacedTile` records original |
| Validation | `canPlay()` separate from `place()` | Decoupled check+execute; server can pre-validate before mutating |
| `placedTileIds` | `Set<string>` | O(1) duplicate detection, critical for game integrity |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modified | Add `BoardState`, `PlacedTile`, `Side` types |
| `src/game/board.ts` | New | `createBoard()`, `canPlay()`, `place()` |
| `src/game/__tests__/board.test.ts` | New | ~15 unit tests, Gherkin scenarios |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Spinner variant needed later | Low | `leftEnd`/`rightEnd` extends to `openEnds[]` without breaking existing tests |
| Auto-flip hides which end matched | Low | `PlacedTile` records `matchedEnd: 'top' | 'bottom'` for audit |

## Rollback Plan

Delete `board.ts`, revert `types.ts` additions, remove `board.test.ts`. Pure functions with no I/O — no migration needed.

## Dependencies

- `Tile` from `@/game/types` (module 1 — already implemented)

## Success Criteria

- [ ] `bun test` passes all board tests
- [ ] `bun run biome:check` passes
- [ ] `tsc --noEmit` passes with no errors
- [ ] 15+ unit tests covering valid/invalid placement, doubles, empty board, both-ends-same scenario
