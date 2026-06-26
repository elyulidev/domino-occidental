# Design: Tile Deck Module

## Technical Approach

Pure TypeScript module in `src/game/` — no external dependencies beyond Bun's built-in `crypto.randomUUID()`. Three independent functions (`createDeck`, `shuffle`, `deal`) with clear contracts and no side effects. Implements the 55-tile double-9 domino set per spec §1–5.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Tile ID | `crypto.randomUUID()` vs cuid2 | cuid2 is in package.json, but Bun's Web Crypto is built-in, spec-mandated, and cryptographically sound | **`crypto.randomUUID()`** |
| Deck generation | Nested loops vs formula | Nested loops are O(55) and trivially correct | **Nested loops** (`top` 0–9, `bottom` = `top`–9) |
| Shuffle mutation | New array vs in-place | Immutability prevents bugs when callers reuse the reference | **New array** (spread copy + Fisher-Yates) |
| Error handling | Throw vs return Result type | Early project stage; simple throw aligns with spec | **`throw` with descriptive message** |
| Return type | Named object vs tuple | `{ hands, pool }` is self-documenting vs positional `[hands, pool]` | **Named object `{ hands, pool }`** |

## Data Flow

```
createDeck()
    → Tile[55] (top-bottom combos, each with crypto.randomUUID())
         │
shuffle(deck)
    → Tile[55] (new permutation, original unmodified)
         │
deal(shuffledDeck)
    → { hands: Tile[4][10], pool: Tile[15] }
         │
         ├─ hands[0] → Player 1 (tiles 0-9)
         ├─ hands[1] → Player 2 (tiles 10-19)
         ├─ hands[2] → Player 3 (tiles 20-29)
         ├─ hands[3] → Player 4 (tiles 30-39)
         └─ pool     → tiles 40-54
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/types.ts` | Create | `Tile` interface + `DealResult` type alias |
| `src/game/deck.ts` | Create | `createDeck()`, `shuffle()`, `deal()` exports |
| `src/game/__tests__/deck.test.ts` | Create | Unit tests for all 5 spec scenarios |
| `package.json` | Modify | Add `"test": "bun test"` script |

## Interfaces / Contracts

```typescript
// src/game/types.ts
interface Tile {
  top: number    // 0-9
  bottom: number // 0-9
  id: string     // crypto.randomUUID()
}

interface DealResult {
  hands: [Tile[], Tile[], Tile[], Tile[]]  // 4 arrays of 10
  pool: Tile[]                              // 15 remaining
}
```

```typescript
// src/game/deck.ts
function createDeck(): Tile[]
function shuffle(deck: Tile[]): Tile[]       // pure, no side effects
function deal(deck: Tile[]): DealResult      // throws if deck.length < 55
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `createDeck()`: 55 tiles, all combos, unique IDs | Assert length, dedupe tuples, dedupe IDs |
| Unit | `shuffle()`: permutation, immutability, empty | Compare IDs sets, assert original unmodified |
| Unit | `deal()`: 4x10 + 15, full accounting, error | Assert lengths, flatten+dedupe union, assert throw |
| Unit | ID uniqueness across decks | Two `createDeck()` calls, union of all 110 IDs |

## Migration / Rollout

No migration required. Greenfield module — no existing state to migrate.

## Open Questions

None.
