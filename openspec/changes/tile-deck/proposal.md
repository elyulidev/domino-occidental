# Proposal: Tile Deck Implementation

## Intent

Implement the foundational Tile data structure and Deck operations (creation, shuffle, deal) for the double-9 domino set (55 tiles) to enable game logic development.

## Scope

### In Scope
- `Tile` interface in `src/game/types.ts` matching AGENTS.md canonical definition: `{ top: number; bottom: number; id: string }`
- `createDeck()` factory function producing all 55 unique tiles (0-0 through 9-9)
- `shuffle(deck: Tile[]): Tile[]` — pure Fisher-Yates shuffle returning new array
- `deal(deck: Tile[]): { hands: Tile[][]; pool: Tile[] }` — deals 4×10 tiles to hands, 15 to pool
- Unit tests in `src/game/__tests__/deck.test.ts` using `bun:test`
- Add `test` script to `package.json`

### Out of Scope
- Game logic (turns, scoring, validation, win conditions)
- Player management, WebSocket, persistence
- GameState, BoardState, or any runtime state management
- UI components or rendering

## Approach

**Modular, pure TypeScript, immutable by default.**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Types location | `src/game/types.ts` | Matches AGENTS.md §3 canonical location |
| Deck logic | `src/game/deck.ts` | Separation of concerns; testable independently |
| Tile ID | `string` (cuid/uuid) | Aligns with AGENTS.md; future DB integration |
| Deck creation | Factory function `createDeck()` | Simple, composable, no `this` binding |
| Shuffle | Pure function (new array) | Immutability prevents state bugs in concurrent games |
| Deal return | Object `{ hands, pool }` | Self-documenting; named properties |
| Tile values | 0–9 (standard double-9) | Matches AGENTS.md; 55 tiles = 10×11/2 |
| Tests | Co-located `__tests__/deck.test.ts` | Bun convention; runs with `bun test` |

**File layout:**
```
src/game/
├── types.ts
├── deck.ts
└── __tests__/
    └── deck.test.ts
```

## Acceptance Criteria

```gherkin
Feature: Tile Deck Operations

Scenario: Create complete double-9 deck
  Given a fresh deck
  When createDeck() is called
  Then it returns exactly 55 tiles
  And each tile has unique id
  And all combinations 0-0 through 9-9 are present exactly once

Scenario: Shuffle produces unbiased permutation
  Given a deck of 55 tiles
  When shuffle() is called 1000 times
  Then each position contains each tile approximately uniformly
  And original deck is not mutated

Scenario: Deal distributes correctly
  Given a shuffled deck of 55 tiles
  When deal() is called
  Then hands has 4 arrays of 10 tiles each
  And pool has 15 tiles
  And all 55 tiles are accounted for exactly once
  And no tile appears in both hands and pool

Scenario: Deal with insufficient tiles throws
  Given a deck with < 55 tiles
  When deal() is called
  Then it throws an error

Scenario: Tile IDs are unique across deck
  Given createDeck()
  Then all 55 tiles have distinct id values
```

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty deck passed to shuffle | Return empty array (no throw) |
| Deck with < 55 tiles passed to deal | Throw descriptive error |
| Fisher-Yates implementation bias | Use standard algorithm: iterate backward, swap with random index ≤ current |
| Duplicate tile IDs | Generate IDs via `crypto.randomUUID()` or `cuid()` — collision probability negligible |
| Non-array input | TypeScript catches at compile time |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fisher-Yates bias (modulo bias) | Low | Medium | Use `Math.floor(Math.random() * (i + 1))` — correct for power-of-2 RNG |
| Missing test script in package.json | Medium | Low | Add `"test": "bun test"` during implementation |
| No src/game directory exists | Certain | Low | Create directory in apply phase |
| Tile ID collisions | Very Low | High | Use `crypto.randomUUID()` (crypto-grade) |

## Dependencies

- None (pure TypeScript, no external deps beyond Bun stdlib)

## Success Criteria

- [ ] `bun test` passes all deck tests
- [ ] `bun run biome:check` passes
- [ ] TypeScript compiles with no errors (`tsc --noEmit`)
- [ ] 55 unique tiles generated, shuffle verified unbiased, deal verified correct distribution